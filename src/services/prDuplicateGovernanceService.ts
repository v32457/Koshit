/**
 * CIPPLATFORM — UNIFIED DUPLICATE PR GOVERNANCE SERVICE
 * Single authoritative governance engine for BOTH header-level and line-level duplicate PR:
 * - Detection (Company, Branch, Item Code, Matching PR Number & Status, Quantity/Requirement tolerance)
 * - State Machine Separation:
 *     A. DETECTED -> Duplicate exists, submission blocked
 *     B. ACKNOWLEDGED -> Justification persisted (userId, timestamp, justification, company, branch, itemCode, matchingPrRefs); submission NOT auto-granted
 *     C. OVERRIDE_AUTHORISED -> Policy allows override + user/checker authorisation verified + approval reference & audit trail recorded
 *     + STALE -> Matching PR status changed or new duplicate appeared; requires re-acknowledgement & re-authorisation
 *     + RESOLVED -> Underlying matching open PRs closed/cancelled
 * - Backend API synchronization & revalidation (/api/pr-duplicate-governance/*)
 * - Immutable audit history (in condition snapshot + EnterpriseAuditService)
 */

import { User } from '../types';
import {
  DuplicateAcknowledgementRecord,
  DuplicateAuditHistoryEntry,
  DuplicateConditionRecord,
  DuplicateGovernanceState,
  DuplicateMatchingPrRef,
  DuplicateOverrideRecord,
  PRDuplicateGovernanceSnapshot,
  PRStatus,
  PurchaseRequisitionHeader,
} from '../types/purchaseRequisition';
import { PrDuplicatePreventionSettings } from '../types/prGovernancePolicy';
import {
  normalizeBranchId,
  normalizeCompanyId,
  prGovernancePolicyService,
} from './prGovernancePolicyService';
import { EnterpriseAuditService } from './enterpriseAuditService';

const STORAGE_KEY_DUP_GOV = 'kosh_pr_duplicate_governance_v1';
const STORAGE_KEY_PRS = 'cip_purchase_requisitions_v1';

export const CLOSED_PR_STATUSES: PRStatus[] = [
  'CANCELLED',
  'SHORT_CLOSED',
  'WITHDRAWN',
  'REJECTED',
  'ARCHIVED',
  'COMPLETED',
];

export const DEFAULT_OVERRIDE_ROLES = [
  'PLATFORM_ADMIN',
  'ORG_ADMIN',
  'BRANCH_ADMIN',
  'PROCUREMENT_MANAGER',
  'DEPARTMENT_HEAD',
  'ITEM_CHECKER',
];

export const DEFAULT_CHECKER_ROLES = [
  'PLATFORM_ADMIN',
  'ORG_ADMIN',
  'BRANCH_ADMIN',
  'PROCUREMENT_MANAGER',
  'DEPARTMENT_HEAD',
  'ITEM_CHECKER',
];

export interface PersistedDraftDuplicateState {
  draftKey: string;
  prId?: string;
  prNumber?: string;
  conditionsByKey: Record<
    string,
    {
      acknowledgement?: DuplicateAcknowledgementRecord;
      overrideRecord?: DuplicateOverrideRecord;
      lastEvaluatedMatchIds?: string[];
      lastEvaluatedMatchStatuses?: Record<string, string>;
      lastProposedQty?: number;
      lastItemCode?: string;
    }
  >;
  auditHistory: DuplicateAuditHistoryEntry[];
  updatedAt: string;
}

export interface DuplicateLineInput {
  id?: string;
  itemCode: string;
  description?: string;
  requestedQuantity: number;
  inventoryUom?: string;
  purchasePurpose?: string;
}

export interface EvaluateDuplicateInput {
  draftKey: string;
  prId?: string;
  prNumber?: string;
  companyId: string;
  branchId: string;
  requesterId?: string;
  purchasePurpose?: string;
  expectedDeliveryDate?: string;
  lines: DuplicateLineInput[];
  actorUser?: User;
  existingPrs?: PurchaseRequisitionHeader[];
  persistedSnapshot?: PRDuplicateGovernanceSnapshot;
}

let memoryStoreFallback: Record<string, PersistedDraftDuplicateState> = {};

function loadStore(): Record<string, PersistedDraftDuplicateState> {
  try {
    if (typeof localStorage === 'undefined') {
      return memoryStoreFallback;
    }
    const raw = localStorage.getItem(STORAGE_KEY_DUP_GOV);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return memoryStoreFallback;
  }
}

function saveStore(store: Record<string, PersistedDraftDuplicateState>): void {
  memoryStoreFallback = store;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_DUP_GOV, JSON.stringify(store));
    }
  } catch {
    // ignore storage quota errors
  }
}

function loadPrsFromLocalStorage(): PurchaseRequisitionHeader[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY_PRS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeItemCode(code?: string): string {
  return String(code || '').trim().toUpperCase();
}

export function buildConditionKey(
  lineId: string | undefined,
  lineIndex: number,
  itemCode: string
): string {
  const normItem = normalizeItemCode(itemCode) || 'UNKNOWN';
  const idPart = lineId && lineId.trim() ? lineId.trim() : `line-${lineIndex}`;
  return `${idPart}::${normItem}`;
}

function findPersistedConditionEntry(
  draftState: PersistedDraftDuplicateState | undefined,
  conditionKey: string,
  lineIndex: number,
  itemCode: string
) {
  if (!draftState?.conditionsByKey) return undefined;
  if (draftState.conditionsByKey[conditionKey]) {
    return draftState.conditionsByKey[conditionKey];
  }
  const normItem = normalizeItemCode(itemCode);
  const indexKey = `line-${lineIndex}::${normItem}`;
  if (draftState.conditionsByKey[indexKey]) {
    return draftState.conditionsByKey[indexKey];
  }
  // Fallback: match persisted entry by same itemCode if line ID was regenerated during draft save
  const matchingEntryKey = Object.keys(draftState.conditionsByKey).find((k) =>
    k.endsWith(`::${normItem}`)
  );
  return matchingEntryKey ? draftState.conditionsByKey[matchingEntryKey] : undefined;
}

function resolveDraftState(
  store: Record<string, PersistedDraftDuplicateState>,
  draftKey: string,
  prId?: string
): PersistedDraftDuplicateState | undefined {
  if (store[draftKey]) return store[draftKey];
  if (prId && store[prId]) return store[prId];
  if (prId) {
    return Object.values(store).find((entry) => entry.prId === prId);
  }
  return undefined;
}

function getOrCreateDraftState(
  store: Record<string, PersistedDraftDuplicateState>,
  draftKey: string,
  prId?: string,
  prNumber?: string
): PersistedDraftDuplicateState {
  const existing = resolveDraftState(store, draftKey, prId);
  if (existing) {
    if (prId && !existing.prId) existing.prId = prId;
    if (prNumber && !existing.prNumber) existing.prNumber = prNumber;
    return existing;
  }
  const created: PersistedDraftDuplicateState = {
    draftKey,
    prId,
    prNumber,
    conditionsByKey: {},
    auditHistory: [],
    updatedAt: new Date().toISOString(),
  };
  store[draftKey] = created;
  return created;
}

function resolveDuplicatePolicyFlags(
  dupCfg: PrDuplicatePreventionSettings,
  actorUser?: User
): {
  warningLevel: 'WARNING_WITH_JUSTIFICATION' | 'HARD_BLOCK' | 'ADVISORY_ONLY';
  policyAllowsOverride: boolean;
  policyReason: string;
  requiresCheckerApproval: boolean;
  userCanSelfAuthorise: boolean;
  authorizedOverrideRoles: string[];
  checkerApprovalRoles: string[];
} {
  const warningLevel = dupCfg.warningLevel || 'WARNING_WITH_JUSTIFICATION';
  const authorizedOverrideRoles =
    dupCfg.authorizedOverrideRoles && dupCfg.authorizedOverrideRoles.length > 0
      ? dupCfg.authorizedOverrideRoles
      : DEFAULT_OVERRIDE_ROLES;
  const checkerApprovalRoles =
    dupCfg.checkerApprovalRoles && dupCfg.checkerApprovalRoles.length > 0
      ? dupCfg.checkerApprovalRoles
      : DEFAULT_CHECKER_ROLES;

  const explicitDisallow = dupCfg.allowOverride === false;
  const policyAllowsOverride = warningLevel !== 'HARD_BLOCK' && !explicitDisallow;

  let policyReason = '';
  if (warningLevel === 'HARD_BLOCK') {
    policyReason =
      'Duplicate PR Submission Blocked: Active governance policy Warning Level is HARD_BLOCK (overrides prohibited).';
  } else if (explicitDisallow) {
    policyReason =
      'Duplicate PR Submission Blocked: Active governance policy explicitly prohibits duplicate PR overrides.';
  } else if (dupCfg.requireCheckerApprovalForOverride) {
    policyReason =
      'Governance policy permits duplicate override subject to justification and mandatory Checker approval.';
  } else if (warningLevel === 'ADVISORY_ONLY') {
    policyReason =
      'Advisory duplicate governance policy permits override after acknowledgement and authorisation.';
  } else {
    policyReason =
      'Governance policy permits duplicate override after persisted justification and authorised approval.';
  }

  const role = actorUser?.role || 'REQUESTER';
  const userCanSelfAuthorise =
    policyAllowsOverride &&
    !dupCfg.requireCheckerApprovalForOverride &&
    authorizedOverrideRoles.includes(role);

  const requiresCheckerApproval =
    policyAllowsOverride &&
    (Boolean(dupCfg.requireCheckerApprovalForOverride) || !authorizedOverrideRoles.includes(role));

  return {
    warningLevel,
    policyAllowsOverride,
    policyReason,
    requiresCheckerApproval,
    userCanSelfAuthorise,
    authorizedOverrideRoles,
    checkerApprovalRoles,
  };
}

function appendAuditEntry(
  draftState: PersistedDraftDuplicateState,
  entry: Omit<DuplicateAuditHistoryEntry, 'id' | 'timestamp'> & { timestamp?: string },
  alsoLogEnterprise: boolean = true
): DuplicateAuditHistoryEntry {
  const full: DuplicateAuditHistoryEntry = {
    ...entry,
    id: `dup-aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: entry.timestamp || new Date().toISOString(),
  };
  draftState.auditHistory = [full, ...(draftState.auditHistory || [])];
  draftState.updatedAt = full.timestamp;

  if (alsoLogEnterprise) {
    EnterpriseAuditService.logEvent({
      companyId: full.companyId,
      branchId: full.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: full.prId || full.draftKey,
      eventType: `PR_${full.eventType}`,
      eventDescription: `[Duplicate PR Governance] ${full.eventType} for ${full.itemCode} (Matches: ${
        full.matchingPrNumbers.join(', ') || 'None'
      })`,
      previousValue: full.previousState ? { state: full.previousState } : undefined,
      newValue: {
        state: full.newState,
        conditionKey: full.conditionKey,
        justification: full.justification,
        approvalReference: full.approvalReference,
        matchingPrNumbers: full.matchingPrNumbers,
      },
      changedByUserId: full.actorUserId,
      changedByName: full.actorName,
      changeReason: full.reason || full.justification || full.eventType,
      authorizationReference: full.approvalReference,
      relatedPrId: full.prId,
    });
  }
  return full;
}

function detectStaleness(
  liveMatches: DuplicateMatchingPrRef[],
  proposedQty: number,
  tolerancePercent: number,
  ack?: DuplicateAcknowledgementRecord,
  overrideRec?: DuplicateOverrideRecord
): { isStale: boolean; reason?: string } {
  if (!ack) return { isStale: false };

  const ackRefs = ack.matchingPrRefs || [];
  const ackByPrId = new Map(ackRefs.map((r) => [r.prId, r]));

  for (const live of liveMatches) {
    const prev = ackByPrId.get(live.prId);
    if (!prev) {
      return {
        isStale: true,
        reason: `New matching open PR (${live.prNumber}, Status: ${live.status}) was created after acknowledgement. Re-acknowledgement required.`,
      };
    }
    if (prev.status !== live.status) {
      return {
        isStale: true,
        reason: `Matching PR ${live.prNumber} changed status from ${prev.status} to ${live.status}. Revalidation and re-acknowledgement required.`,
      };
    }
    if (prev.existingQty !== live.existingQty) {
      return {
        isStale: true,
        reason: `Matching PR ${live.prNumber} quantity changed from ${prev.existingQty} to ${live.existingQty}. Re-acknowledgement required.`,
      };
    }
  }

  // Check override snapshot drift as well
  if (overrideRec?.matchingPrSnapshots && overrideRec.matchingPrSnapshots.length > 0) {
    const ovrByPrId = new Map(overrideRec.matchingPrSnapshots.map((s) => [s.prId, s]));
    for (const live of liveMatches) {
      const snap = ovrByPrId.get(live.prId);
      if (!snap || snap.status !== live.status) {
        return {
          isStale: true,
          reason: `Matching PR ${live.prNumber} status (${live.status}) no longer matches approved override snapshot (${snap?.status || 'MISSING'}).`,
        };
      }
    }
  }

  // Check if user increased/changed line quantity significantly since acknowledgement
  if (ack.proposedQuantity > 0 && proposedQty !== ack.proposedQuantity) {
    const pctDiff = (Math.abs(proposedQty - ack.proposedQuantity) / ack.proposedQuantity) * 100;
    const allowedShift = Math.max(5, Math.min(tolerancePercent, 20));
    if (pctDiff > allowedShift) {
      return {
        isStale: true,
        reason: `Proposed quantity changed from ${ack.proposedQuantity} to ${proposedQty} after acknowledgement. Re-acknowledgement required.`,
      };
    }
  }

  return { isStale: false };
}

export const prDuplicateGovernanceService = {
  clearStoreForTests(): void {
    memoryStoreFallback = {};
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_DUP_GOV);
      }
    } catch {
      // ignore
    }
  },

  seedPersistedSnapshot(snapshot: PRDuplicateGovernanceSnapshot, prId?: string, prNumber?: string): void {
    const store = loadStore();
    const key = snapshot.draftKey || prId || `pr-dup-${Date.now()}`;
    const state = getOrCreateDraftState(store, key, prId, prNumber);
    for (const cond of snapshot.conditions || []) {
      if (cond.acknowledgement || cond.overrideRecord) {
        state.conditionsByKey[cond.conditionKey] = {
          acknowledgement: cond.acknowledgement,
          overrideRecord: cond.overrideRecord,
          lastEvaluatedMatchIds: cond.matchingPrs.map((m) => m.prId),
          lastProposedQty: cond.proposedQuantity,
          lastItemCode: cond.itemCode,
        };
      }
    }
    if (snapshot.auditHistory && snapshot.auditHistory.length > 0) {
      const existingIds = new Set(state.auditHistory.map((a) => a.id));
      for (const a of snapshot.auditHistory) {
        if (!existingIds.has(a.id)) state.auditHistory.push(a);
      }
    }
    saveStore(store);
  },

  bindDraftSessionToPr(draftKey: string, prId: string, prNumber: string): void {
    const store = loadStore();
    const draftState = resolveDraftState(store, draftKey, prId);
    if (!draftState) return;
    draftState.prId = prId;
    draftState.prNumber = prNumber;
    for (const entry of draftState.auditHistory) {
      if (!entry.prId) entry.prId = prId;
      if (!entry.prNumber) entry.prNumber = prNumber;
    }
    store[prId] = draftState;
    store[draftKey] = draftState;
    saveStore(store);

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      fetch('/api/pr-duplicate-governance/bind-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftKey, prId, prNumber }),
      }).catch(() => {});
    }
  },

  getDraftStateSnapshot(draftKey: string, prId?: string): PersistedDraftDuplicateState | undefined {
    const store = loadStore();
    return resolveDraftState(store, draftKey, prId);
  },

  /**
   * Authoritative unified evaluation for both Header and Line-Level Duplicate PR Detection.
   */
  evaluateDuplicateConditions(input: EvaluateDuplicateInput): PRDuplicateGovernanceSnapshot {
    const nowIso = new Date().toISOString();
    const normComp = normalizeCompanyId(input.companyId);
    const normBr = normalizeBranchId(input.branchId);
    const effPolicy = prGovernancePolicyService.getEffectivePolicy(normComp, normBr);
    const dupCfg = effPolicy.duplicatePrevention;

    if (!dupCfg || !dupCfg.enableDuplicateDetection || !input.lines || input.lines.length === 0) {
      return {
        draftKey: input.draftKey,
        policyVersion: effPolicy.policyVersion,
        evaluatedAt: nowIso,
        hasDuplicates: false,
        totalDuplicateConditions: 0,
        totalMatchingPrCount: 0,
        submissionEligible: true,
        overallStatus: 'CLEAR',
        blockingReasons: [],
        conditions: [],
        auditHistory: [],
      };
    }

    const store = loadStore();
    let draftState = resolveDraftState(store, input.draftKey, input.prId);
    if (!draftState && input.persistedSnapshot) {
      this.seedPersistedSnapshot(input.persistedSnapshot, input.prId, input.prNumber);
      draftState = resolveDraftState(loadStore(), input.draftKey, input.prId);
    }

    const policyEval = resolveDuplicatePolicyFlags(dupCfg, input.actorUser);
    const allPrs = input.existingPrs || loadPrsFromLocalStorage();
    const tolPercent = Number(dupCfg.quantityVarianceTolerancePercent ?? 20);
    const tolRatio = tolPercent / 100;

    const conditions: DuplicateConditionRecord[] = [];
    const seenMatchingPrIds = new Set<string>();
    let storeMutated = false;

    input.lines.forEach((propLine, lineIdx) => {
      const propItemNorm = normalizeItemCode(propLine.itemCode);
      if (!propItemNorm) return;

      const conditionKey = buildConditionKey(propLine.id, lineIdx, propItemNorm);
      const matches: DuplicateMatchingPrRef[] = [];

      for (const existingPr of allPrs) {
        if (input.prId && existingPr.id === input.prId) continue;
        if (CLOSED_PR_STATUSES.includes(existingPr.status)) continue;

        if (normalizeCompanyId(existingPr.companyId) !== normComp) continue;
        if (dupCfg.checkSameBranch && normalizeBranchId(existingPr.branchId) !== normBr) continue;
        if (dupCfg.checkSameRequester && input.requesterId && existingPr.requesterId !== input.requesterId) {
          continue;
        }
        const propPurpose = (propLine.purchasePurpose || input.purchasePurpose || '').trim().toLowerCase();
        if (
          dupCfg.checkSamePurpose &&
          propPurpose &&
          (existingPr.purchasePurpose || '').trim().toLowerCase() !== propPurpose
        ) {
          continue;
        }
        if (
          dupCfg.checkSameRequirementDate &&
          input.expectedDeliveryDate &&
          (existingPr.expectedDeliveryDate || existingPr.requiredBy) !== input.expectedDeliveryDate
        ) {
          continue;
        }

        for (const existLine of existingPr.lines || []) {
          // NEVER treat unrelated items as duplicates merely because they belong to the same branch
          if (normalizeItemCode(existLine.itemCode) !== propItemNorm) continue;

          const existQty = Number(existLine.requestedQuantity) || 0;
          const propQty = Number(propLine.requestedQuantity) || 0;
          const variancePct =
            existQty > 0 ? Number(((Math.abs(propQty - existQty) / existQty) * 100).toFixed(1)) : 0;

          if (dupCfg.checkSimilarQuantity && existQty > 0 && propQty > 0) {
            if (Math.abs(propQty - existQty) / existQty > tolRatio) continue;
          }

          matches.push({
            prId: existingPr.id,
            prNumber: existingPr.prNumber,
            status: existingPr.status,
            companyId: normalizeCompanyId(existingPr.companyId),
            branchId: normalizeBranchId(existingPr.branchId),
            itemCode: existLine.itemCode,
            requesterId: existingPr.requesterId,
            requesterName: existingPr.requesterName,
            existingQty: existQty,
            proposedQty: propQty,
            inventoryUom: propLine.inventoryUom || existLine.inventoryUom,
            expectedDeliveryDate: existingPr.expectedDeliveryDate || existingPr.requiredBy,
            purchasePurpose: existingPr.purchasePurpose,
            quantityVariancePercent: variancePct,
            createdAt: (existingPr.createdAt || nowIso).split('T')[0],
            updatedAt: existingPr.updatedAt,
          });
          seenMatchingPrIds.add(existingPr.id);
        }
      }

      const persistedEntry = findPersistedConditionEntry(draftState, conditionKey, lineIdx, propItemNorm);

      // Scenario 9: Existing duplicate PR(s) were cancelled/closed -> refresh clears condition cleanly
      if (matches.length === 0) {
        if (
          persistedEntry &&
          (persistedEntry.acknowledgement ||
            (persistedEntry.lastEvaluatedMatchIds && persistedEntry.lastEvaluatedMatchIds.length > 0))
        ) {
          if (draftState) {
            appendAuditEntry(
              draftState,
              {
                draftKey: input.draftKey,
                prId: input.prId,
                prNumber: input.prNumber,
                conditionKey,
                itemCode: propLine.itemCode,
                companyId: normComp,
                branchId: normBr,
                eventType: 'CONDITION_RESOLVED',
                actorUserId: input.actorUser?.id || 'system',
                actorName: input.actorUser?.fullName || 'Duplicate Governance Engine',
                actorRole: input.actorUser?.role || 'SYSTEM',
                reason: 'All matching open PRs are now closed/cancelled; duplicate condition resolved.',
                matchingPrNumbers: [],
                previousState: persistedEntry.overrideRecord?.status || 'DETECTED',
                newState: 'RESOLVED',
              },
              false
            );
            delete draftState.conditionsByKey[conditionKey];
            storeMutated = true;
          }
        }
        return;
      }

      // Active duplicate matches exist! Evaluate State A / B / C / STALE
      const ack = persistedEntry?.acknowledgement;
      const ovr = persistedEntry?.overrideRecord;
      const staleCheck = detectStaleness(
        matches,
        Number(propLine.requestedQuantity) || 0,
        tolPercent,
        ack,
        ovr
      );

      let state: DuplicateGovernanceState = 'DETECTED';
      let overrideStatus = policyEval.policyAllowsOverride
        ? ('NOT_REQUESTED' as DuplicateConditionRecord['overrideStatus'])
        : ('PROHIBITED_BY_POLICY' as DuplicateConditionRecord['overrideStatus']);
      let submissionEligible = false;
      let blockingReason: string | undefined;
      let staleReason: string | undefined;

      if (staleCheck.isStale) {
        state = 'STALE';
        overrideStatus = 'STALE';
        submissionEligible = false;
        staleReason = staleCheck.reason;
        blockingReason = staleCheck.reason;
      } else if (!ack) {
        state = 'DETECTED';
        overrideStatus = policyEval.policyAllowsOverride
          ? 'NOT_REQUESTED'
          : 'PROHIBITED_BY_POLICY';
        submissionEligible = false;
        blockingReason = policyEval.policyAllowsOverride
          ? `Line #${lineIdx + 1} (${propLine.itemCode}): ${matches.length} matching open PR(s) (${matches
              .map((m) => `${m.prNumber} [${m.status}]`)
              .join(', ')}). Acknowledge with justification and obtain override authorisation.`
          : `Line #${lineIdx + 1} (${propLine.itemCode}): ${policyEval.policyReason}`;
      } else if (!policyEval.policyAllowsOverride) {
        // State B persisted, but policy prohibits override -> blocked!
        state = 'ACKNOWLEDGED';
        overrideStatus = 'PROHIBITED_BY_POLICY';
        submissionEligible = false;
        blockingReason = `Line #${lineIdx + 1} (${propLine.itemCode}): ${policyEval.policyReason}`;
      } else if (ovr?.status === 'REJECTED') {
        state = 'ACKNOWLEDGED';
        overrideStatus = 'REJECTED';
        submissionEligible = false;
        blockingReason = `Line #${lineIdx + 1} (${propLine.itemCode}): Duplicate PR override rejected by ${
          ovr.decidedByName || 'Checker'
        }${ovr.rejectionReason ? ` — "${ovr.rejectionReason}"` : '.'}`;
      } else if (ovr?.status === 'AUTHORISED') {
        // State C: Override Authorised (verified policy allows + approval exists + not stale)
        state = 'OVERRIDE_AUTHORISED';
        overrideStatus = 'AUTHORISED';
        submissionEligible = true;
      } else if (
        ovr?.status === 'PENDING_CHECKER_APPROVAL' ||
        policyEval.requiresCheckerApproval
      ) {
        state = 'ACKNOWLEDGED';
        overrideStatus = 'PENDING_CHECKER_APPROVAL';
        submissionEligible = false;
        blockingReason = `Line #${lineIdx + 1} (${propLine.itemCode}): Awaiting Checker Approval for duplicate PR override.`;
      } else {
        // State B: Acknowledged by user, policy permits override, explicit authorisation step not yet completed
        state = 'ACKNOWLEDGED';
        overrideStatus = 'NOT_REQUESTED';
        submissionEligible = false;
        blockingReason = `Line #${lineIdx + 1} (${propLine.itemCode}): Acknowledgement persisted (Ref: ${ack.id}), awaiting explicit Override Authorisation.`;
      }

      conditions.push({
        conditionKey,
        lineId: propLine.id,
        lineIndex: lineIdx,
        itemCode: propLine.itemCode,
        itemDescription: propLine.description,
        proposedQuantity: Number(propLine.requestedQuantity) || 0,
        inventoryUom: propLine.inventoryUom,
        companyId: normComp,
        branchId: normBr,
        state,
        overrideStatus,
        matchingPrCount: matches.length,
        matchingPrs: matches,
        warningLevel: policyEval.warningLevel,
        policyAllowsOverride: policyEval.policyAllowsOverride,
        requiresCheckerApproval: policyEval.requiresCheckerApproval,
        policyReason: policyEval.policyReason,
        acknowledgement: ack,
        overrideRecord: ovr,
        submissionEligible,
        blockingReason,
        staleReason,
        lastEvaluatedAt: nowIso,
      });
    });

    if (storeMutated) {
      saveStore(store);
    }

    const blockingReasons = conditions
      .filter((c) => !c.submissionEligible)
      .map((c) => c.blockingReason || `Duplicate condition blocked for ${c.itemCode}.`);

    const submissionEligible =
      conditions.length === 0 || conditions.every((c) => c.submissionEligible);

    let overallStatus: PRDuplicateGovernanceSnapshot['overallStatus'] = 'CLEAR';
    if (conditions.length > 0) {
      if (submissionEligible) {
        overallStatus = 'OVERRIDE_AUTHORISED';
      } else if (conditions.some((c) => c.state === 'STALE')) {
        overallStatus = 'STALE';
      } else if (conditions.some((c) => c.overrideStatus === 'PROHIBITED_BY_POLICY')) {
        overallStatus = 'PROHIBITED';
      } else if (conditions.some((c) => c.overrideStatus === 'REJECTED')) {
        overallStatus = 'REJECTED';
      } else if (conditions.some((c) => c.overrideStatus === 'PENDING_CHECKER_APPROVAL')) {
        overallStatus = 'AWAITING_CHECKER_APPROVAL';
      } else if (conditions.some((c) => c.state === 'ACKNOWLEDGED')) {
        overallStatus = 'ACKNOWLEDGED';
      } else {
        overallStatus = 'DETECTED';
      }
    }

    return {
      draftKey: input.draftKey,
      policyVersion: effPolicy.policyVersion,
      evaluatedAt: nowIso,
      hasDuplicates: conditions.length > 0,
      totalDuplicateConditions: conditions.length,
      totalMatchingPrCount: seenMatchingPrIds.size,
      submissionEligible,
      overallStatus,
      blockingReasons,
      conditions,
      auditHistory: draftState?.auditHistory || [],
    };
  },

  /**
   * State B: Acknowledge & Record Justification
   * Persists acknowledgement metadata (userId, timestamp, justification, company, branch, itemCode, matchingPrRefs)
   * and evaluates policy without auto-granting submission permission.
   */
  acknowledgeCondition(params: {
    draftKey: string;
    prId?: string;
    prNumber?: string;
    conditionKey: string;
    justification: string;
    companyId: string;
    branchId: string;
    requesterId?: string;
    purchasePurpose?: string;
    expectedDeliveryDate?: string;
    lines: DuplicateLineInput[];
    actorUser: User;
    existingPrs?: PurchaseRequisitionHeader[];
    persistedVia?: 'BACKEND_API' | 'LOCAL_STORE';
    allowSupersede?: boolean;
    supersedeReason?: string;
  }): {
    success: boolean;
    message: string;
    condition?: DuplicateConditionRecord;
    snapshot: PRDuplicateGovernanceSnapshot;
  } {
    const cleanJustification = (params.justification || '').trim();
    if (!cleanJustification) {
      const snap = this.evaluateDuplicateConditions({
        draftKey: params.draftKey,
        prId: params.prId,
        prNumber: params.prNumber,
        companyId: params.companyId,
        branchId: params.branchId,
        requesterId: params.requesterId,
        purchasePurpose: params.purchasePurpose,
        expectedDeliveryDate: params.expectedDeliveryDate,
        lines: params.lines,
        actorUser: params.actorUser,
        existingPrs: params.existingPrs,
      });
      return {
        success: false,
        message: 'Mandatory Duplicate Override Justification is required before acknowledging.',
        snapshot: snap,
      };
    }

    const beforeSnap = this.evaluateDuplicateConditions({
      draftKey: params.draftKey,
      prId: params.prId,
      prNumber: params.prNumber,
      companyId: params.companyId,
      branchId: params.branchId,
      requesterId: params.requesterId,
      purchasePurpose: params.purchasePurpose,
      expectedDeliveryDate: params.expectedDeliveryDate,
      lines: params.lines,
      actorUser: params.actorUser,
      existingPrs: params.existingPrs,
    });

    const targetCond = beforeSnap.conditions.find((c) => c.conditionKey === params.conditionKey);
    if (!targetCond) {
      return {
        success: false,
        message: 'Duplicate condition could not be located or has already been resolved.',
        snapshot: beforeSnap,
      };
    }

    const store = loadStore();
    const draftState = getOrCreateDraftState(store, params.draftKey, params.prId, params.prNumber);
    const existingEntry = findPersistedConditionEntry(
      draftState,
      targetCond.conditionKey,
      targetCond.lineIndex,
      targetCond.itemCode
    );

    // Requirement 7: Prevent silent mutation of an already approved override
    if (
      existingEntry?.overrideRecord?.status === 'AUTHORISED' &&
      !beforeSnap.conditions.find((c) => c.conditionKey === targetCond.conditionKey && c.state === 'STALE')
    ) {
      if (!params.allowSupersede) {
        return {
          success: false,
          message: `Cannot modify an already approved override (${existingEntry.overrideRecord.approvalReference}) without recording a superseding audit event.`,
          condition: targetCond,
          snapshot: beforeSnap,
        };
      }
      const prevOvr = existingEntry.overrideRecord;
      appendAuditEntry(draftState, {
        draftKey: params.draftKey,
        prId: params.prId,
        prNumber: params.prNumber,
        conditionKey: targetCond.conditionKey,
        itemCode: targetCond.itemCode,
        companyId: targetCond.companyId,
        branchId: targetCond.branchId,
        eventType: 'OVERRIDE_SUPERSEDED',
        actorUserId: params.actorUser.id,
        actorName: params.actorUser.fullName,
        actorRole: params.actorUser.role,
        approvalReference: prevOvr.approvalReference,
        reason: params.supersedeReason || 'Approved override superseded by new acknowledgement',
        justification: cleanJustification,
        matchingPrNumbers: targetCond.matchingPrs.map((m) => m.prNumber),
        previousState: 'OVERRIDE_AUTHORISED',
        newState: 'ACKNOWLEDGED',
      });
    }

    const nowIso = new Date().toISOString();
    const ackId = `ack-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ackRecord: DuplicateAcknowledgementRecord = {
      id: ackId,
      conditionKey: targetCond.conditionKey,
      companyId: targetCond.companyId,
      branchId: targetCond.branchId,
      itemCode: targetCond.itemCode,
      lineId: targetCond.lineId,
      lineIndex: targetCond.lineIndex,
      userId: params.actorUser.id,
      userName: params.actorUser.fullName,
      userRole: params.actorUser.role,
      timestamp: nowIso,
      justification: cleanJustification,
      proposedQuantity: targetCond.proposedQuantity,
      matchingPrRefs: targetCond.matchingPrs,
      policyVersion: beforeSnap.policyVersion,
      warningLevelAtAck: targetCond.warningLevel,
      persistedVia: params.persistedVia || 'LOCAL_STORE',
    };

    // Log detection if first time seen in audit trail
    if (
      !(draftState.auditHistory || []).some(
        (h) => h.conditionKey === targetCond.conditionKey && h.eventType === 'DUPLICATE_DETECTED'
      )
    ) {
      appendAuditEntry(draftState, {
        draftKey: params.draftKey,
        prId: params.prId,
        prNumber: params.prNumber,
        conditionKey: targetCond.conditionKey,
        itemCode: targetCond.itemCode,
        companyId: targetCond.companyId,
        branchId: targetCond.branchId,
        eventType: 'DUPLICATE_DETECTED',
        actorUserId: params.actorUser.id,
        actorName: params.actorUser.fullName,
        actorRole: params.actorUser.role,
        reason: `Detected ${targetCond.matchingPrCount} matching open PR(s) for ${targetCond.itemCode}`,
        matchingPrNumbers: targetCond.matchingPrs.map((m) => m.prNumber),
        newState: 'DETECTED',
      });
    }

    appendAuditEntry(draftState, {
      draftKey: params.draftKey,
      prId: params.prId,
      prNumber: params.prNumber,
      conditionKey: targetCond.conditionKey,
      itemCode: targetCond.itemCode,
      companyId: targetCond.companyId,
      branchId: targetCond.branchId,
      eventType: 'DUPLICATE_ACKNOWLEDGED',
      actorUserId: params.actorUser.id,
      actorName: params.actorUser.fullName,
      actorRole: params.actorUser.role,
      justification: cleanJustification,
      reason: `Acknowledgement persisted (${ackId})`,
      matchingPrNumbers: targetCond.matchingPrs.map((m) => m.prNumber),
      previousState: targetCond.state,
      newState: 'ACKNOWLEDGED',
    });

    // Evaluate next override status WITHOUT granting submission permission automatically
    let initialOverrideRecord: DuplicateOverrideRecord | undefined;
    if (!targetCond.policyAllowsOverride) {
      initialOverrideRecord = {
        id: `ovr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        acknowledgementId: ackId,
        conditionKey: targetCond.conditionKey,
        status: 'PROHIBITED_BY_POLICY',
        requestedByUserId: params.actorUser.id,
        requestedByName: params.actorUser.fullName,
        requestedByRole: params.actorUser.role,
        requestedAt: nowIso,
        justification: cleanJustification,
        policyVersion: beforeSnap.policyVersion,
        rejectionReason: targetCond.policyReason,
        matchingPrSnapshots: targetCond.matchingPrs.map((m) => ({
          prId: m.prId,
          prNumber: m.prNumber,
          status: m.status,
          existingQty: m.existingQty,
        })),
      };
    } else if (targetCond.requiresCheckerApproval) {
      initialOverrideRecord = {
        id: `ovr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        acknowledgementId: ackId,
        conditionKey: targetCond.conditionKey,
        status: 'PENDING_CHECKER_APPROVAL',
        requestedByUserId: params.actorUser.id,
        requestedByName: params.actorUser.fullName,
        requestedByRole: params.actorUser.role,
        requestedAt: nowIso,
        justification: cleanJustification,
        policyVersion: beforeSnap.policyVersion,
        matchingPrSnapshots: targetCond.matchingPrs.map((m) => ({
          prId: m.prId,
          prNumber: m.prNumber,
          status: m.status,
          existingQty: m.existingQty,
        })),
      };
      appendAuditEntry(draftState, {
        draftKey: params.draftKey,
        prId: params.prId,
        prNumber: params.prNumber,
        conditionKey: targetCond.conditionKey,
        itemCode: targetCond.itemCode,
        companyId: targetCond.companyId,
        branchId: targetCond.branchId,
        eventType: 'OVERRIDE_REQUESTED',
        actorUserId: params.actorUser.id,
        actorName: params.actorUser.fullName,
        actorRole: params.actorUser.role,
        justification: cleanJustification,
        reason: 'Queued for Checker Approval per governance policy / role authorisation.',
        matchingPrNumbers: targetCond.matchingPrs.map((m) => m.prNumber),
        previousState: 'ACKNOWLEDGED',
        newState: 'PENDING_CHECKER_APPROVAL',
      });
    }

    draftState.conditionsByKey[targetCond.conditionKey] = {
      acknowledgement: ackRecord,
      overrideRecord: initialOverrideRecord,
      lastEvaluatedMatchIds: targetCond.matchingPrs.map((m) => m.prId),
      lastProposedQty: targetCond.proposedQuantity,
      lastItemCode: targetCond.itemCode,
    };
    saveStore(store);

    const afterSnap = this.evaluateDuplicateConditions({
      draftKey: params.draftKey,
      prId: params.prId,
      prNumber: params.prNumber,
      companyId: params.companyId,
      branchId: params.branchId,
      requesterId: params.requesterId,
      purchasePurpose: params.purchasePurpose,
      expectedDeliveryDate: params.expectedDeliveryDate,
      lines: params.lines,
      actorUser: params.actorUser,
      existingPrs: params.existingPrs,
    });
    const updatedCond = afterSnap.conditions.find(
      (c) => c.conditionKey === targetCond.conditionKey
    );

    const statusMsg = !targetCond.policyAllowsOverride
      ? `Acknowledgement persisted (${ackId}). ${targetCond.policyReason}`
      : targetCond.requiresCheckerApproval
      ? `Acknowledgement persisted (${ackId}). Awaiting Checker Approval before PR submission.`
      : `Acknowledgement persisted (${ackId}). Override Authorisation is still required before PR submission.`;

    return {
      success: true,
      message: statusMsg,
      condition: updatedCond,
      snapshot: afterSnap,
    };
  },

  /**
   * Explicitly requests Checker Approval for an ACKNOWLEDGED condition.
   */
  requestCheckerOverride(params: {
    draftKey: string;
    prId?: string;
    prNumber?: string;
    conditionKey: string;
    companyId: string;
    branchId: string;
    requesterId?: string;
    purchasePurpose?: string;
    expectedDeliveryDate?: string;
    lines: DuplicateLineInput[];
    actorUser: User;
    existingPrs?: PurchaseRequisitionHeader[];
  }): {
    success: boolean;
    message: string;
    condition?: DuplicateConditionRecord;
    snapshot: PRDuplicateGovernanceSnapshot;
  } {
    const beforeSnap = this.evaluateDuplicateConditions({
      draftKey: params.draftKey,
      prId: params.prId,
      prNumber: params.prNumber,
      companyId: params.companyId,
      branchId: params.branchId,
      requesterId: params.requesterId,
      purchasePurpose: params.purchasePurpose,
      expectedDeliveryDate: params.expectedDeliveryDate,
      lines: params.lines,
      actorUser: params.actorUser,
      existingPrs: params.existingPrs,
    });

    const cond = beforeSnap.conditions.find((c) => c.conditionKey === params.conditionKey);
    if (!cond) {
      return { success: false, message: 'Duplicate condition not found.', snapshot: beforeSnap };
    }
    if (!cond.acknowledgement) {
      return {
        success: false,
        message: 'Acknowledge & Record Justification must be completed before requesting override.',
        condition: cond,
        snapshot: beforeSnap,
      };
    }
    if (!cond.policyAllowsOverride) {
      return {
        success: false,
        message: cond.policyReason,
        condition: cond,
        snapshot: beforeSnap,
      };
    }
    if (cond.state === 'STALE') {
      return {
        success: false,
        message: cond.staleReason || 'Condition is stale. Please re-acknowledge before requesting override.',
        condition: cond,
        snapshot: beforeSnap,
      };
    }

    const store = loadStore();
    const draftState = getOrCreateDraftState(store, params.draftKey, params.prId, params.prNumber);
    const nowIso = new Date().toISOString();

    const ovr: DuplicateOverrideRecord = {
      id: `ovr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      acknowledgementId: cond.acknowledgement.id,
      conditionKey: cond.conditionKey,
      status: 'PENDING_CHECKER_APPROVAL',
      requestedByUserId: params.actorUser.id,
      requestedByName: params.actorUser.fullName,
      requestedByRole: params.actorUser.role,
      requestedAt: nowIso,
      justification: cond.acknowledgement.justification,
      policyVersion: beforeSnap.policyVersion,
      matchingPrSnapshots: cond.matchingPrs.map((m) => ({
        prId: m.prId,
        prNumber: m.prNumber,
        status: m.status,
        existingQty: m.existingQty,
      })),
    };

    draftState.conditionsByKey[cond.conditionKey] = {
      ...(draftState.conditionsByKey[cond.conditionKey] || {}),
      acknowledgement: cond.acknowledgement,
      overrideRecord: ovr,
      lastEvaluatedMatchIds: cond.matchingPrs.map((m) => m.prId),
      lastProposedQty: cond.proposedQuantity,
      lastItemCode: cond.itemCode,
    };

    appendAuditEntry(draftState, {
      draftKey: params.draftKey,
      prId: params.prId,
      prNumber: params.prNumber,
      conditionKey: cond.conditionKey,
      itemCode: cond.itemCode,
      companyId: cond.companyId,
      branchId: cond.branchId,
      eventType: 'OVERRIDE_REQUESTED',
      actorUserId: params.actorUser.id,
      actorName: params.actorUser.fullName,
      actorRole: params.actorUser.role,
      justification: cond.acknowledgement.justification,
      reason: 'Override approval requested from Checker.',
      matchingPrNumbers: cond.matchingPrs.map((m) => m.prNumber),
      previousState: cond.overrideStatus,
      newState: 'PENDING_CHECKER_APPROVAL',
    });

    saveStore(store);

    const afterSnap = this.evaluateDuplicateConditions({
      draftKey: params.draftKey,
      prId: params.prId,
      prNumber: params.prNumber,
      companyId: params.companyId,
      branchId: params.branchId,
      requesterId: params.requesterId,
      purchasePurpose: params.purchasePurpose,
      expectedDeliveryDate: params.expectedDeliveryDate,
      lines: params.lines,
      actorUser: params.actorUser,
      existingPrs: params.existingPrs,
    });

    return {
      success: true,
      message: `Override request (${ovr.id}) submitted — Awaiting Checker Approval.`,
      condition: afterSnap.conditions.find((c) => c.conditionKey === cond.conditionKey),
      snapshot: afterSnap,
    };
  },

  /**
   * State C (Direct Authorised Role): Authorise Override when policy permits override AND
   * checker approval is not required AND actor holds an authorized override role.
   */
  authoriseOverride(params: {
    draftKey: string;
    prId?: string;
    prNumber?: string;
    conditionKey: string;
    remarks?: string;
    companyId: string;
    branchId: string;
    requesterId?: string;
    purchasePurpose?: string;
    expectedDeliveryDate?: string;
    lines: DuplicateLineInput[];
    actorUser: User;
    existingPrs?: PurchaseRequisitionHeader[];
  }): {
    success: boolean;
    message: string;
    condition?: DuplicateConditionRecord;
    snapshot: PRDuplicateGovernanceSnapshot;
  } {
    const beforeSnap = this.evaluateDuplicateConditions({
      draftKey: params.draftKey,
      prId: params.prId,
      prNumber: params.prNumber,
      companyId: params.companyId,
      branchId: params.branchId,
      requesterId: params.requesterId,
      purchasePurpose: params.purchasePurpose,
      expectedDeliveryDate: params.expectedDeliveryDate,
      lines: params.lines,
      actorUser: params.actorUser,
      existingPrs: params.existingPrs,
    });

    const cond = beforeSnap.conditions.find((c) => c.conditionKey === params.conditionKey);
    if (!cond) {
      return { success: false, message: 'Duplicate condition not found.', snapshot: beforeSnap };
    }
    if (!cond.acknowledgement) {
      return {
        success: false,
        message: 'Cannot authorise override before acknowledgement & justification are persisted.',
        condition: cond,
        snapshot: beforeSnap,
      };
    }
    if (cond.state === 'STALE') {
      return {
        success: false,
        message: cond.staleReason || 'Matching PRs changed. Re-acknowledgement required.',
        condition: cond,
        snapshot: beforeSnap,
      };
    }
    if (!cond.policyAllowsOverride) {
      return {
        success: false,
        message: cond.policyReason,
        condition: cond,
        snapshot: beforeSnap,
      };
    }

    const eff = prGovernancePolicyService.getEffectivePolicy(cond.companyId, cond.branchId);
    const policyFlags = resolveDuplicatePolicyFlags(eff.duplicatePrevention!, params.actorUser);

    if (policyFlags.requiresCheckerApproval) {
      return {
        success: false,
        message: `Role ${params.actorUser.role} or active policy requires separate Checker Approval (Awaiting Checker Approval).`,
        condition: cond,
        snapshot: beforeSnap,
      };
    }

    if (cond.overrideRecord?.status === 'AUTHORISED') {
      return {
        success: true,
        message: `Override already authorised (${cond.overrideRecord.approvalReference}).`,
        condition: cond,
        snapshot: beforeSnap,
      };
    }

    const store = loadStore();
    const draftState = getOrCreateDraftState(store, params.draftKey, params.prId, params.prNumber);
    const nowIso = new Date().toISOString();
    const approvalRef = `DUP-OVR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const ovr: DuplicateOverrideRecord = {
      id: `ovr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      acknowledgementId: cond.acknowledgement.id,
      conditionKey: cond.conditionKey,
      status: 'AUTHORISED',
      requestedByUserId: cond.acknowledgement.userId,
      requestedByName: cond.acknowledgement.userName,
      requestedByRole: cond.acknowledgement.userRole,
      requestedAt: cond.acknowledgement.timestamp,
      justification: cond.acknowledgement.justification,
      approvalReference: approvalRef,
      decidedByUserId: params.actorUser.id,
      decidedByName: params.actorUser.fullName,
      decidedByRole: params.actorUser.role,
      decidedAt: nowIso,
      decisionRemarks: params.remarks?.trim() || 'Authorised under active Duplicate PR Governance Policy.',
      policyVersion: beforeSnap.policyVersion,
      matchingPrSnapshots: cond.matchingPrs.map((m) => ({
        prId: m.prId,
        prNumber: m.prNumber,
        status: m.status,
        existingQty: m.existingQty,
      })),
    };

    draftState.conditionsByKey[cond.conditionKey] = {
      acknowledgement: cond.acknowledgement,
      overrideRecord: ovr,
      lastEvaluatedMatchIds: cond.matchingPrs.map((m) => m.prId),
      lastProposedQty: cond.proposedQuantity,
      lastItemCode: cond.itemCode,
    };

    appendAuditEntry(draftState, {
      draftKey: params.draftKey,
      prId: params.prId,
      prNumber: params.prNumber,
      conditionKey: cond.conditionKey,
      itemCode: cond.itemCode,
      companyId: cond.companyId,
      branchId: cond.branchId,
      eventType: 'OVERRIDE_AUTHORISED',
      actorUserId: params.actorUser.id,
      actorName: params.actorUser.fullName,
      actorRole: params.actorUser.role,
      justification: cond.acknowledgement.justification,
      approvalReference: approvalRef,
      reason: ovr.decisionRemarks,
      matchingPrNumbers: cond.matchingPrs.map((m) => m.prNumber),
      previousState: cond.state,
      newState: 'OVERRIDE_AUTHORISED',
    });

    saveStore(store);

    const afterSnap = this.evaluateDuplicateConditions({
      draftKey: params.draftKey,
      prId: params.prId,
      prNumber: params.prNumber,
      companyId: params.companyId,
      branchId: params.branchId,
      requesterId: params.requesterId,
      purchasePurpose: params.purchasePurpose,
      expectedDeliveryDate: params.expectedDeliveryDate,
      lines: params.lines,
      actorUser: params.actorUser,
      existingPrs: params.existingPrs,
    });

    return {
      success: true,
      message: `Override Authorised (Ref: ${approvalRef}) for ${cond.itemCode}.`,
      condition: afterSnap.conditions.find((c) => c.conditionKey === cond.conditionKey),
      snapshot: afterSnap,
    };
  },

  /**
   * State C (Checker Approval / Rejection):
   * Verifies Checker RBAC, Maker-Checker segregation, policy allowance, and records immutable audit entry.
   */
  recordCheckerDecision(params: {
    draftKey: string;
    prId?: string;
    prNumber?: string;
    conditionKey: string;
    decision: 'APPROVED' | 'REJECTED';
    remarks: string;
    companyId: string;
    branchId: string;
    requesterId?: string;
    purchasePurpose?: string;
    expectedDeliveryDate?: string;
    lines: DuplicateLineInput[];
    checkerUser: User;
    existingPrs?: PurchaseRequisitionHeader[];
  }): {
    success: boolean;
    message: string;
    condition?: DuplicateConditionRecord;
    snapshot: PRDuplicateGovernanceSnapshot;
  } {
    const beforeSnap = this.evaluateDuplicateConditions({
      draftKey: params.draftKey,
      prId: params.prId,
      prNumber: params.prNumber,
      companyId: params.companyId,
      branchId: params.branchId,
      requesterId: params.requesterId,
      purchasePurpose: params.purchasePurpose,
      expectedDeliveryDate: params.expectedDeliveryDate,
      lines: params.lines,
      actorUser: params.checkerUser,
      existingPrs: params.existingPrs,
    });

    const cond = beforeSnap.conditions.find((c) => c.conditionKey === params.conditionKey);
    if (!cond) {
      return { success: false, message: 'Duplicate condition not found.', snapshot: beforeSnap };
    }
    if (!cond.acknowledgement) {
      return {
        success: false,
        message: 'Cannot record Checker decision before justification acknowledgement is persisted.',
        condition: cond,
        snapshot: beforeSnap,
      };
    }
    if (cond.state === 'STALE') {
      return {
        success: false,
        message: cond.staleReason || 'Condition is stale due to matching PR changes. Re-acknowledgement required.',
        condition: cond,
        snapshot: beforeSnap,
      };
    }

    const eff = prGovernancePolicyService.getEffectivePolicy(cond.companyId, cond.branchId);
    const policyFlags = resolveDuplicatePolicyFlags(eff.duplicatePrevention!, params.checkerUser);

    if (!policyFlags.policyAllowsOverride && params.decision === 'APPROVED') {
      return {
        success: false,
        message: policyFlags.policyReason,
        condition: cond,
        snapshot: beforeSnap,
      };
    }
    if (!policyFlags.checkerApprovalRoles.includes(params.checkerUser.role)) {
      return {
        success: false,
        message: `Access denied: Role ${params.checkerUser.role} is not authorised to act as Duplicate Override Checker.`,
        condition: cond,
        snapshot: beforeSnap,
      };
    }
    if (params.checkerUser.id === cond.acknowledgement.userId) {
      return {
        success: false,
        message: 'Maker-Checker violation: The user who acknowledged/requested the duplicate override cannot approve their own override.',
        condition: cond,
        snapshot: beforeSnap,
      };
    }
    if (cond.overrideRecord?.status === 'AUTHORISED') {
      return {
        success: false,
        message: `Override (${cond.overrideRecord.approvalReference}) is already approved and immutable.`,
        condition: cond,
        snapshot: beforeSnap,
      };
    }
    const cleanRemarks = (params.remarks || '').trim();
    if (params.decision === 'REJECTED' && !cleanRemarks) {
      return {
        success: false,
        message: 'Mandatory rejection reason is required when rejecting a duplicate PR override.',
        condition: cond,
        snapshot: beforeSnap,
      };
    }

    const store = loadStore();
    const draftState = getOrCreateDraftState(store, params.draftKey, params.prId, params.prNumber);
    const nowIso = new Date().toISOString();
    const approvalRef =
      params.decision === 'APPROVED'
        ? `DUP-CHK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
        : undefined;

    const updatedOvr: DuplicateOverrideRecord = {
      id: cond.overrideRecord?.id || `ovr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      acknowledgementId: cond.acknowledgement.id,
      conditionKey: cond.conditionKey,
      status: params.decision === 'APPROVED' ? 'AUTHORISED' : 'REJECTED',
      requestedByUserId: cond.acknowledgement.userId,
      requestedByName: cond.acknowledgement.userName,
      requestedByRole: cond.acknowledgement.userRole,
      requestedAt: cond.acknowledgement.timestamp,
      justification: cond.acknowledgement.justification,
      approvalReference: approvalRef,
      decidedByUserId: params.checkerUser.id,
      decidedByName: params.checkerUser.fullName,
      decidedByRole: params.checkerUser.role,
      decidedAt: nowIso,
      decisionRemarks: cleanRemarks || 'Approved by Checker',
      rejectionReason: params.decision === 'REJECTED' ? cleanRemarks : undefined,
      policyVersion: beforeSnap.policyVersion,
      matchingPrSnapshots: cond.matchingPrs.map((m) => ({
        prId: m.prId,
        prNumber: m.prNumber,
        status: m.status,
        existingQty: m.existingQty,
      })),
    };

    draftState.conditionsByKey[cond.conditionKey] = {
      acknowledgement: cond.acknowledgement,
      overrideRecord: updatedOvr,
      lastEvaluatedMatchIds: cond.matchingPrs.map((m) => m.prId),
      lastProposedQty: cond.proposedQuantity,
      lastItemCode: cond.itemCode,
    };

    appendAuditEntry(draftState, {
      draftKey: params.draftKey,
      prId: params.prId,
      prNumber: params.prNumber,
      conditionKey: cond.conditionKey,
      itemCode: cond.itemCode,
      companyId: cond.companyId,
      branchId: cond.branchId,
      eventType: params.decision === 'APPROVED' ? 'CHECKER_APPROVED' : 'CHECKER_REJECTED',
      actorUserId: params.checkerUser.id,
      actorName: params.checkerUser.fullName,
      actorRole: params.checkerUser.role,
      justification: cond.acknowledgement.justification,
      approvalReference: approvalRef,
      reason: cleanRemarks || `Checker ${params.decision}`,
      matchingPrNumbers: cond.matchingPrs.map((m) => m.prNumber),
      previousState: cond.overrideStatus,
      newState: updatedOvr.status,
    });

    saveStore(store);

    const afterSnap = this.evaluateDuplicateConditions({
      draftKey: params.draftKey,
      prId: params.prId,
      prNumber: params.prNumber,
      companyId: params.companyId,
      branchId: params.branchId,
      requesterId: params.requesterId,
      purchasePurpose: params.purchasePurpose,
      expectedDeliveryDate: params.expectedDeliveryDate,
      lines: params.lines,
      actorUser: params.checkerUser,
      existingPrs: params.existingPrs,
    });

    return {
      success: true,
      message:
        params.decision === 'APPROVED'
          ? `Checker Approved Override (Ref: ${approvalRef}) for ${cond.itemCode}.`
          : `Checker Rejected Override for ${cond.itemCode}: ${cleanRemarks}`,
      condition: afterSnap.conditions.find((c) => c.conditionKey === cond.conditionKey),
      snapshot: afterSnap,
    };
  },

  /**
   * Submission Validation Gate:
   * Revalidates all lines against live PRs & policy, enforces persisted acknowledgement,
   * override authorisation / checker approval, and detects matching PR status drift (STALE).
   */
  validateForSubmission(params: EvaluateDuplicateInput): {
    allowed: boolean;
    message: string;
    blockingReasons: string[];
    snapshot: PRDuplicateGovernanceSnapshot;
  } {
    const snap = this.evaluateDuplicateConditions(params);

    if (!snap.hasDuplicates) {
      return {
        allowed: true,
        message: 'No duplicate PR conditions detected.',
        blockingReasons: [],
        snapshot: snap,
      };
    }

    const store = loadStore();
    const draftState = getOrCreateDraftState(store, params.draftKey, params.prId, params.prNumber);
    const actor = params.actorUser || {
      id: params.requesterId || 'usr-system',
      fullName: 'Requester',
      role: 'REQUESTER',
    };

    for (const cond of snap.conditions) {
      if (cond.state === 'STALE') {
        appendAuditEntry(draftState, {
          draftKey: params.draftKey,
          prId: params.prId,
          prNumber: params.prNumber,
          conditionKey: cond.conditionKey,
          itemCode: cond.itemCode,
          companyId: cond.companyId,
          branchId: cond.branchId,
          eventType: 'STALE_DETECTED',
          actorUserId: actor.id,
          actorName: actor.fullName,
          actorRole: (actor as any).role || 'REQUESTER',
          reason: cond.staleReason || 'Matching PR status changed prior to submission.',
          matchingPrNumbers: cond.matchingPrs.map((m) => m.prNumber),
          previousState: cond.overrideRecord?.status || 'ACKNOWLEDGED',
          newState: 'STALE',
        });
      }

      appendAuditEntry(draftState, {
        draftKey: params.draftKey,
        prId: params.prId,
        prNumber: params.prNumber,
        conditionKey: cond.conditionKey,
        itemCode: cond.itemCode,
        companyId: cond.companyId,
        branchId: cond.branchId,
        eventType: 'SUBMISSION_ATTEMPTED',
        actorUserId: actor.id,
        actorName: actor.fullName,
        actorRole: (actor as any).role || 'REQUESTER',
        approvalReference: cond.overrideRecord?.approvalReference,
        reason: cond.submissionEligible ? 'Eligible for submission' : cond.blockingReason,
        matchingPrNumbers: cond.matchingPrs.map((m) => m.prNumber),
        previousState: cond.state,
        newState: cond.submissionEligible ? 'SUBMISSION_PERMITTED' : 'SUBMISSION_BLOCKED',
      });

      appendAuditEntry(draftState, {
        draftKey: params.draftKey,
        prId: params.prId,
        prNumber: params.prNumber,
        conditionKey: cond.conditionKey,
        itemCode: cond.itemCode,
        companyId: cond.companyId,
        branchId: cond.branchId,
        eventType: cond.submissionEligible ? 'SUBMISSION_PERMITTED' : 'SUBMISSION_BLOCKED',
        actorUserId: actor.id,
        actorName: actor.fullName,
        actorRole: (actor as any).role || 'REQUESTER',
        approvalReference: cond.overrideRecord?.approvalReference,
        reason: cond.submissionEligible
          ? `Override authorised (${cond.overrideRecord?.approvalReference})`
          : cond.blockingReason,
        matchingPrNumbers: cond.matchingPrs.map((m) => m.prNumber),
        previousState: cond.state,
        newState: cond.submissionEligible ? 'PERMITTED' : 'BLOCKED',
      });
    }

    saveStore(store);

    const updatedSnap = this.evaluateDuplicateConditions(params);

    return {
      allowed: updatedSnap.submissionEligible,
      message: updatedSnap.submissionEligible
        ? 'All duplicate PR governance checks passed.'
        : updatedSnap.blockingReasons[0] ||
          'Submission blocked by Duplicate PR Governance policy.',
      blockingReasons: updatedSnap.blockingReasons,
      snapshot: updatedSnap,
    };
  },

  // ---------------------------------------------------------------------------
  // BACKEND API SYNCHRONIZATION HELPERS (/api/pr-duplicate-governance/*)
  // Gracefully persists & validates against Express backend in browser sessions
  // ---------------------------------------------------------------------------
  async syncPrsWithBackend(prs: PurchaseRequisitionHeader[]): Promise<void> {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return;
    try {
      await fetch('/api/pr-duplicate-governance/sync-prs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prs }),
      });
    } catch {
      // Non-blocking fallback when offline or in isolated unit tests
    }
  },

  async hydrateFromBackend(): Promise<{
    prs?: PurchaseRequisitionHeader[];
    governanceRecords?: Record<string, PersistedDraftDuplicateState>;
  } | null> {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return null;
    try {
      const res = await fetch('/api/pr-duplicate-governance/state');
      if (!res.ok) return null;
      const json = await res.json();
      const data = json?.data;
      if (data?.governanceRecords && typeof data.governanceRecords === 'object') {
        const current = loadStore();
        const merged = { ...current, ...data.governanceRecords };
        saveStore(merged);
      }
      return data || null;
    } catch {
      return null;
    }
  },

  async acknowledgeConditionRemote(params: Parameters<typeof this.acknowledgeCondition>[0]): Promise<{
    success: boolean;
    message: string;
    condition?: DuplicateConditionRecord;
    snapshot: PRDuplicateGovernanceSnapshot;
  }> {
    const localRes = this.acknowledgeCondition({ ...params, persistedVia: 'BACKEND_API' });
    if (!localRes.success) return localRes;

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        const res = await fetch('/api/pr-duplicate-governance/acknowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftKey: params.draftKey,
            prId: params.prId,
            prNumber: params.prNumber,
            conditionKey: params.conditionKey,
            justification: params.justification,
            companyId: params.companyId,
            branchId: params.branchId,
            requesterId: params.requesterId,
            purchasePurpose: params.purchasePurpose,
            expectedDeliveryDate: params.expectedDeliveryDate,
            lines: params.lines,
            actorUser: params.actorUser,
            allowSupersede: params.allowSupersede,
            supersedeReason: params.supersedeReason,
            policy: prGovernancePolicyService.getEffectivePolicy(params.companyId, params.branchId),
            prs: params.existingPrs || loadPrsFromLocalStorage(),
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.data?.record) {
            const store = loadStore();
            store[params.draftKey] = json.data.record;
            if (params.prId) store[params.prId] = json.data.record;
            saveStore(store);
          }
          if (json?.data?.snapshot) {
            return {
              success: Boolean(json.data.success ?? true),
              message: json.data.message || localRes.message,
              condition: json.data.condition || localRes.condition,
              snapshot: json.data.snapshot,
            };
          }
        }
      } catch {
        // fallback to local persistence
      }
    }
    return localRes;
  },

  async requestCheckerOverrideRemote(params: Parameters<typeof this.requestCheckerOverride>[0]): Promise<{
    success: boolean;
    message: string;
    condition?: DuplicateConditionRecord;
    snapshot: PRDuplicateGovernanceSnapshot;
  }> {
    const localRes = this.requestCheckerOverride(params);
    if (!localRes.success) return localRes;

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        const res = await fetch('/api/pr-duplicate-governance/request-override', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftKey: params.draftKey,
            prId: params.prId,
            prNumber: params.prNumber,
            conditionKey: params.conditionKey,
            companyId: params.companyId,
            branchId: params.branchId,
            requesterId: params.requesterId,
            purchasePurpose: params.purchasePurpose,
            expectedDeliveryDate: params.expectedDeliveryDate,
            lines: params.lines,
            actorUser: params.actorUser,
            policy: prGovernancePolicyService.getEffectivePolicy(params.companyId, params.branchId),
            prs: params.existingPrs || loadPrsFromLocalStorage(),
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          return {
            success: false,
            message: json?.error?.message || 'Backend rejected Checker override request.',
            snapshot: this.evaluateDuplicateConditions(params),
          };
        }
        if (json?.data?.record) {
          const store = loadStore();
          store[params.draftKey] = json.data.record;
          if (params.prId) store[params.prId] = json.data.record;
          saveStore(store);
        }
        if (json?.data?.snapshot) {
          return {
            success: true,
            message: json.data.message || localRes.message,
            condition: json.data.condition || localRes.condition,
            snapshot: json.data.snapshot,
          };
        }
      } catch {
        // fallback
      }
    }
    return localRes;
  },

  async authoriseOverrideRemote(params: Parameters<typeof this.authoriseOverride>[0]): Promise<{
    success: boolean;
    message: string;
    condition?: DuplicateConditionRecord;
    snapshot: PRDuplicateGovernanceSnapshot;
  }> {
    const localRes = this.authoriseOverride(params);
    if (!localRes.success) return localRes;

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        const res = await fetch('/api/pr-duplicate-governance/authorise-override', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftKey: params.draftKey,
            prId: params.prId,
            prNumber: params.prNumber,
            conditionKey: params.conditionKey,
            remarks: params.remarks,
            companyId: params.companyId,
            branchId: params.branchId,
            requesterId: params.requesterId,
            purchasePurpose: params.purchasePurpose,
            expectedDeliveryDate: params.expectedDeliveryDate,
            lines: params.lines,
            actorUser: params.actorUser,
            policy: prGovernancePolicyService.getEffectivePolicy(params.companyId, params.branchId),
            prs: params.existingPrs || loadPrsFromLocalStorage(),
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          return {
            success: false,
            message: json?.error?.message || 'Backend rejected duplicate override authorisation.',
            snapshot: this.evaluateDuplicateConditions(params),
          };
        }
        if (json?.data?.record) {
          const store = loadStore();
          store[params.draftKey] = json.data.record;
          if (params.prId) store[params.prId] = json.data.record;
          saveStore(store);
        }
        if (json?.data?.snapshot) {
          return {
            success: true,
            message: json.data.message || localRes.message,
            condition: json.data.condition || localRes.condition,
            snapshot: json.data.snapshot,
          };
        }
      } catch {
        // fallback to local validation result
      }
    }
    return localRes;
  },

  async checkerDecisionRemote(params: Parameters<typeof this.recordCheckerDecision>[0]): Promise<{
    success: boolean;
    message: string;
    condition?: DuplicateConditionRecord;
    snapshot: PRDuplicateGovernanceSnapshot;
  }> {
    const localRes = this.recordCheckerDecision(params);
    if (!localRes.success) return localRes;

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        const res = await fetch('/api/pr-duplicate-governance/checker-decision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftKey: params.draftKey,
            prId: params.prId,
            prNumber: params.prNumber,
            conditionKey: params.conditionKey,
            decision: params.decision,
            remarks: params.remarks,
            companyId: params.companyId,
            branchId: params.branchId,
            requesterId: params.requesterId,
            purchasePurpose: params.purchasePurpose,
            expectedDeliveryDate: params.expectedDeliveryDate,
            lines: params.lines,
            checkerUser: params.checkerUser,
            policy: prGovernancePolicyService.getEffectivePolicy(params.companyId, params.branchId),
            prs: params.existingPrs || loadPrsFromLocalStorage(),
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          return {
            success: false,
            message: json?.error?.message || 'Backend rejected Checker decision.',
            snapshot: this.evaluateDuplicateConditions(params),
          };
        }
        if (json?.data?.record) {
          const store = loadStore();
          store[params.draftKey] = json.data.record;
          if (params.prId) store[params.prId] = json.data.record;
          saveStore(store);
        }
        if (json?.data?.snapshot) {
          return {
            success: true,
            message: json.data.message || localRes.message,
            condition: json.data.condition || localRes.condition,
            snapshot: json.data.snapshot,
          };
        }
      } catch {
        // fallback
      }
    }
    return localRes;
  },

  async validateSubmissionRemote(params: EvaluateDuplicateInput): Promise<{
    allowed: boolean;
    message: string;
    blockingReasons: string[];
    snapshot: PRDuplicateGovernanceSnapshot;
  }> {
    const localRes = this.validateForSubmission(params);
    if (!localRes.allowed) return localRes;

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        const res = await fetch('/api/pr-duplicate-governance/validate-submission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftKey: params.draftKey,
            prId: params.prId,
            prNumber: params.prNumber,
            companyId: params.companyId,
            branchId: params.branchId,
            requesterId: params.requesterId,
            purchasePurpose: params.purchasePurpose,
            expectedDeliveryDate: params.expectedDeliveryDate,
            lines: params.lines,
            actorUser: params.actorUser,
            policy: prGovernancePolicyService.getEffectivePolicy(params.companyId, params.branchId),
            prs: params.existingPrs || loadPrsFromLocalStorage(),
          }),
        });
        const json = await res.json().catch(() => null);
        if (res.status === 403 || res.status === 409) {
          return {
            allowed: false,
            message: json?.error?.message || json?.data?.message || 'Backend blocked duplicate PR submission.',
            blockingReasons: json?.data?.blockingReasons || [json?.error?.message || 'Blocked by backend governance'],
            snapshot: json?.data?.snapshot || localRes.snapshot,
          };
        }
        if (res.ok && json?.data) {
          return json.data;
        }
      } catch {
        // fallback to local check
      }
    }
    return localRes;
  },
};
