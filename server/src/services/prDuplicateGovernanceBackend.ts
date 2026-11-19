/**
 * KOSH INNOVATIONS — SERVER-SIDE DUPLICATE PR GOVERNANCE ENGINE
 * Authoritative persistence, RBAC, Maker-Checker separation, stale status detection,
 * immutable approval protection, and submission blocking gate for Duplicate PR conditions.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getPool } from '../db/pool.js';

export class PrDuplicateGovernanceHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const CLOSED_PR_STATUSES = [
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

export type DuplicateGovernanceState =
  | 'DETECTED'
  | 'ACKNOWLEDGED'
  | 'OVERRIDE_AUTHORISED'
  | 'STALE'
  | 'RESOLVED';

export type DuplicateOverrideApprovalStatus =
  | 'NOT_REQUESTED'
  | 'PENDING_CHECKER_APPROVAL'
  | 'AUTHORISED'
  | 'REJECTED'
  | 'PROHIBITED_BY_POLICY'
  | 'STALE';

export interface BackendActorUser {
  id: string;
  fullName: string;
  role: string;
}

export interface BackendDuplicateLineInput {
  id?: string;
  itemCode: string;
  description?: string;
  requestedQuantity: number;
  inventoryUom?: string;
  purchasePurpose?: string;
}

export interface BackendPrHeaderInput {
  id: string;
  prNumber: string;
  status: string;
  companyId: string;
  branchId: string;
  requesterId?: string;
  requesterName?: string;
  purchasePurpose?: string;
  expectedDeliveryDate?: string;
  requiredBy?: string;
  createdAt?: string;
  updatedAt?: string;
  lines: Array<{
    id?: string;
    itemCode: string;
    requestedQuantity: number;
    inventoryUom?: string;
  }>;
}

export interface BackendDuplicatePolicyInput {
  policyVersion?: string;
  duplicatePrevention?: {
    enableDuplicateDetection?: boolean;
    checkSameItem?: boolean;
    checkSameBranch?: boolean;
    checkSameRequester?: boolean;
    checkSamePurpose?: boolean;
    checkSameRequirementDate?: boolean;
    checkSimilarQuantity?: boolean;
    quantityVarianceTolerancePercent?: number;
    warningLevel?: 'WARNING_WITH_JUSTIFICATION' | 'HARD_BLOCK' | 'ADVISORY_ONLY';
    requireJustification?: boolean;
    allowOverride?: boolean;
    requireCheckerApprovalForOverride?: boolean;
    authorizedOverrideRoles?: string[];
    checkerApprovalRoles?: string[];
  };
}

export interface BackendMatchingPrRef {
  prId: string;
  prNumber: string;
  status: string;
  companyId: string;
  branchId: string;
  itemCode: string;
  requesterId?: string;
  requesterName?: string;
  existingQty: number;
  proposedQty: number;
  inventoryUom?: string;
  expectedDeliveryDate?: string;
  purchasePurpose?: string;
  quantityVariancePercent: number;
  createdAt: string;
  updatedAt?: string;
}

export interface BackendAcknowledgementRecord {
  id: string;
  conditionKey: string;
  companyId: string;
  branchId: string;
  itemCode: string;
  lineId?: string;
  lineIndex: number;
  userId: string;
  userName: string;
  userRole: string;
  timestamp: string;
  justification: string;
  proposedQuantity: number;
  matchingPrRefs: BackendMatchingPrRef[];
  policyVersion: string;
  warningLevelAtAck: 'WARNING_WITH_JUSTIFICATION' | 'HARD_BLOCK' | 'ADVISORY_ONLY';
  persistedVia: 'BACKEND_API';
}

export interface BackendOverrideRecord {
  id: string;
  acknowledgementId: string;
  conditionKey: string;
  status: DuplicateOverrideApprovalStatus;
  requestedByUserId: string;
  requestedByName: string;
  requestedByRole: string;
  requestedAt: string;
  justification: string;
  approvalReference?: string;
  decidedByUserId?: string;
  decidedByName?: string;
  decidedByRole?: string;
  decidedAt?: string;
  decisionRemarks?: string;
  rejectionReason?: string;
  policyVersion: string;
  matchingPrSnapshots: Array<{
    prId: string;
    prNumber: string;
    status: string;
    existingQty: number;
  }>;
}

export interface BackendConditionRecord {
  conditionKey: string;
  lineId?: string;
  lineIndex: number;
  itemCode: string;
  itemDescription?: string;
  proposedQuantity: number;
  inventoryUom?: string;
  companyId: string;
  branchId: string;
  state: DuplicateGovernanceState;
  overrideStatus: DuplicateOverrideApprovalStatus;
  matchingPrCount: number;
  matchingPrs: BackendMatchingPrRef[];
  warningLevel: 'WARNING_WITH_JUSTIFICATION' | 'HARD_BLOCK' | 'ADVISORY_ONLY';
  policyAllowsOverride: boolean;
  requiresCheckerApproval: boolean;
  policyReason: string;
  acknowledgement?: BackendAcknowledgementRecord;
  overrideRecord?: BackendOverrideRecord;
  submissionEligible: boolean;
  blockingReason?: string;
  staleReason?: string;
  lastEvaluatedAt: string;
}

export interface BackendAuditHistoryEntry {
  id: string;
  draftKey: string;
  prId?: string;
  prNumber?: string;
  conditionKey: string;
  itemCode: string;
  companyId: string;
  branchId: string;
  eventType:
    | 'DUPLICATE_DETECTED'
    | 'DUPLICATE_ACKNOWLEDGED'
    | 'OVERRIDE_REQUESTED'
    | 'OVERRIDE_AUTHORISED'
    | 'CHECKER_APPROVED'
    | 'CHECKER_REJECTED'
    | 'OVERRIDE_SUPERSEDED'
    | 'STALE_DETECTED'
    | 'CONDITION_RESOLVED'
    | 'SUBMISSION_ATTEMPTED'
    | 'SUBMISSION_PERMITTED'
    | 'SUBMISSION_BLOCKED';
  actorUserId: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  justification?: string;
  approvalReference?: string;
  reason?: string;
  matchingPrNumbers: string[];
  previousState?: string;
  newState?: string;
}

export interface BackendGovernanceRecord {
  draftKey: string;
  prId?: string;
  prNumber?: string;
  companyId?: string;
  branchId?: string;
  conditionsByKey: Record<
    string,
    {
      acknowledgement?: BackendAcknowledgementRecord;
      overrideRecord?: BackendOverrideRecord;
      lastEvaluatedMatchIds?: string[];
      lastProposedQty?: number;
      lastItemCode?: string;
    }
  >;
  auditHistory: BackendAuditHistoryEntry[];
  updatedAt: string;
}

export interface BackendGovernanceSnapshot {
  draftKey: string;
  policyVersion: string;
  evaluatedAt: string;
  hasDuplicates: boolean;
  totalDuplicateConditions: number;
  totalMatchingPrCount: number;
  submissionEligible: boolean;
  overallStatus:
    | 'CLEAR'
    | 'DETECTED'
    | 'ACKNOWLEDGED'
    | 'AWAITING_CHECKER_APPROVAL'
    | 'REJECTED'
    | 'PROHIBITED'
    | 'STALE'
    | 'OVERRIDE_AUTHORISED';
  blockingReasons: string[];
  conditions: BackendConditionRecord[];
  auditHistory: BackendAuditHistoryEntry[];
}

export function normalizeCompanyId(companyId?: string): string {
  if (!companyId) return 'co-kosh-01';
  const trimmed = companyId.trim();
  if (
    trimmed === 'comp-1' ||
    trimmed === 'org-kosh-01' ||
    trimmed === 'KOSH-HQ' ||
    trimmed === 'KOSH_INNOVATIONS'
  ) {
    return 'co-kosh-01';
  }
  if (
    trimmed === 'org-kosh-02' ||
    trimmed === 'KOSH-SOUTH' ||
    trimmed === 'KOSH-AUTO' ||
    trimmed === 'KOSH_AUTO'
  ) {
    return 'co-kosh-02';
  }
  if (
    trimmed === 'org-kosh-03' ||
    trimmed === 'KOSH-WEST' ||
    trimmed === 'KOSH-TOOL' ||
    trimmed === 'KOSH_TOOL'
  ) {
    return 'co-kosh-03';
  }
  if (trimmed === 'org-kosh-04' || trimmed === 'KOSH-NORTH') {
    return 'co-kosh-04';
  }
  return trimmed;
}

export function normalizeBranchId(branchId?: string): string {
  if (!branchId || branchId === 'ALL') return 'ALL';
  const trimmed = branchId.trim();
  if (trimmed === 'branch-001' || trimmed === '001') return 'br-pond-01';
  if (trimmed === 'branch-002' || trimmed === '002') return 'br-chen-02';
  if (trimmed === 'branch-003' || trimmed === '003') return 'br-hosr-03';
  if (trimmed === 'branch-004' || trimmed === '004') return 'br-pune-04';
  if (trimmed === 'branch-005' || trimmed === '005') return 'br-ddun-05';
  return trimmed;
}

function normalizeItemCode(code?: string): string {
  return String(code || '').trim().toUpperCase();
}

export function buildConditionKey(lineId: string | undefined, lineIndex: number, itemCode: string): string {
  const normItem = normalizeItemCode(itemCode) || 'UNKNOWN';
  const idPart = lineId && lineId.trim() ? lineId.trim() : `line-${lineIndex}`;
  return `${idPart}::${normItem}`;
}

export class PrDuplicateGovernanceBackendStore {
  private readonly persistToDisk: boolean;
  private readonly storeFilePath: string;
  private recordsByKey = new Map<string, BackendGovernanceRecord>();
  private prsById = new Map<string, BackendPrHeaderInput>();

  constructor(options?: { persistToDisk?: boolean; storeFilePath?: string }) {
    this.persistToDisk = options?.persistToDisk ?? false;
    this.storeFilePath =
      options?.storeFilePath ||
      path.resolve(process.cwd(), '.data', 'pr_duplicate_governance_store.json');
    if (this.persistToDisk) {
      this.loadFromDisk();
    }
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.storeFilePath)) return;
      const raw = fs.readFileSync(this.storeFilePath, 'utf8');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.records && typeof parsed.records === 'object') {
        for (const [k, v] of Object.entries(parsed.records)) {
          this.recordsByKey.set(k, v as BackendGovernanceRecord);
        }
      }
      if (parsed?.prs && typeof parsed.prs === 'object') {
        for (const [k, v] of Object.entries(parsed.prs)) {
          this.prsById.set(k, v as BackendPrHeaderInput);
        }
      }
    } catch {
      // Ignore corrupt/missing disk cache
    }
  }

  private saveToDisk(): void {
    if (!this.persistToDisk) return;
    try {
      const dir = path.dirname(this.storeFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const payload = {
        records: Object.fromEntries(this.recordsByKey.entries()),
        prs: Object.fromEntries(this.prsById.entries()),
      };
      fs.writeFileSync(this.storeFilePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch {
      // Ignore write failures
    }
  }

  private async syncRecordToDatabase(rec: BackendGovernanceRecord): Promise<void> {
    if (!this.persistToDisk) return;
    try {
      const pool = getPool();
      await pool.execute(
        `INSERT INTO pr_duplicate_governance_records (
          draft_key, pr_id, pr_number, company_id, branch_id, conditions_json, audit_history_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          pr_id = VALUES(pr_id),
          pr_number = VALUES(pr_number),
          conditions_json = VALUES(conditions_json),
          audit_history_json = VALUES(audit_history_json)`,
        [
          rec.draftKey,
          rec.prId || null,
          rec.prNumber || null,
          rec.companyId || 'co-kosh-01',
          rec.branchId || 'br-pond-01',
          JSON.stringify(rec.conditionsByKey),
          JSON.stringify(rec.auditHistory),
        ]
      );
    } catch {
      // Database optional in container runtime
    }
  }

  syncPrs(prs: BackendPrHeaderInput[], authoritative = true): void {
    if (!Array.isArray(prs)) return;
    for (const pr of prs) {
      if (!pr || !pr.id) continue;
      const existing = this.prsById.get(pr.id);
      if (!existing || authoritative) {
        this.prsById.set(pr.id, pr);
      } else {
        const existTs = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
        const nextTs = pr.updatedAt ? Date.parse(pr.updatedAt) : 0;
        if (nextTs >= existTs) {
          this.prsById.set(pr.id, pr);
        }
      }
    }
    this.saveToDisk();
  }

  private resolveRecord(draftKey: string, prId?: string): BackendGovernanceRecord | undefined {
    const byDraft = this.recordsByKey.get(draftKey);
    if (byDraft) return byDraft;
    if (prId) {
      const byPr = this.recordsByKey.get(prId);
      if (byPr) return byPr;
      for (const rec of this.recordsByKey.values()) {
        if (rec.prId === prId) return rec;
      }
    }
    return undefined;
  }

  private getOrCreateRecord(
    draftKey: string,
    companyId: string,
    branchId: string,
    prId?: string,
    prNumber?: string
  ): BackendGovernanceRecord {
    const existing = this.resolveRecord(draftKey, prId);
    if (existing) {
      if (prId && !existing.prId) existing.prId = prId;
      if (prNumber && !existing.prNumber) existing.prNumber = prNumber;
      this.recordsByKey.set(draftKey, existing);
      if (prId) this.recordsByKey.set(prId, existing);
      return existing;
    }
    const created: BackendGovernanceRecord = {
      draftKey,
      prId,
      prNumber,
      companyId: normalizeCompanyId(companyId),
      branchId: normalizeBranchId(branchId),
      conditionsByKey: {},
      auditHistory: [],
      updatedAt: new Date().toISOString(),
    };
    this.recordsByKey.set(draftKey, created);
    if (prId) this.recordsByKey.set(prId, created);
    return created;
  }

  bindDraftToPr(draftKey: string, prId: string, prNumber?: string): BackendGovernanceRecord | undefined {
    const rec = this.resolveRecord(draftKey, prId);
    if (!rec) return undefined;
    rec.prId = prId;
    if (prNumber) rec.prNumber = prNumber;
    for (const a of rec.auditHistory) {
      if (!a.prId) a.prId = prId;
      if (prNumber && !a.prNumber) a.prNumber = prNumber;
    }
    this.recordsByKey.set(draftKey, rec);
    this.recordsByKey.set(prId, rec);
    this.saveToDisk();
    void this.syncRecordToDatabase(rec);
    return rec;
  }

  getState(): {
    governanceRecords: Record<string, BackendGovernanceRecord>;
    prs: BackendPrHeaderInput[];
  } {
    return {
      governanceRecords: Object.fromEntries(this.recordsByKey.entries()),
      prs: Array.from(this.prsById.values()),
    };
  }

  private findPersistedConditionEntry(
    rec: BackendGovernanceRecord | undefined,
    conditionKey: string,
    lineIndex: number,
    itemCode: string
  ) {
    if (!rec?.conditionsByKey) return undefined;
    if (rec.conditionsByKey[conditionKey]) return rec.conditionsByKey[conditionKey];
    const normItem = normalizeItemCode(itemCode);
    const idxKey = `line-${lineIndex}::${normItem}`;
    if (rec.conditionsByKey[idxKey]) return rec.conditionsByKey[idxKey];
    const matchingKey = Object.keys(rec.conditionsByKey).find((k) => k.endsWith(`::${normItem}`));
    return matchingKey ? rec.conditionsByKey[matchingKey] : undefined;
  }

  private appendAudit(
    rec: BackendGovernanceRecord,
    entry: Omit<BackendAuditHistoryEntry, 'id' | 'timestamp'> & { timestamp?: string }
  ): BackendAuditHistoryEntry {
    const full: BackendAuditHistoryEntry = {
      ...entry,
      id: `dup-aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
    };
    rec.auditHistory = [full, ...(rec.auditHistory || [])];
    rec.updatedAt = full.timestamp;
    return full;
  }

  private resolvePolicyFlags(
    policyInput?: BackendDuplicatePolicyInput,
    actorUser?: BackendActorUser
  ) {
    const dup = policyInput?.duplicatePrevention || {};
    const enableDuplicateDetection = dup.enableDuplicateDetection !== false;
    const warningLevel = dup.warningLevel || 'WARNING_WITH_JUSTIFICATION';
    const allowOverride = dup.allowOverride !== false && warningLevel !== 'HARD_BLOCK';
    const checkSameBranch = dup.checkSameBranch !== false;
    const checkSameRequester = Boolean(dup.checkSameRequester);
    const checkSamePurpose = Boolean(dup.checkSamePurpose);
    const checkSameRequirementDate = Boolean(dup.checkSameRequirementDate);
    const checkSimilarQuantity = dup.checkSimilarQuantity !== false;
    const tolerancePercent = Number(dup.quantityVarianceTolerancePercent ?? 20);
    const authorizedOverrideRoles =
      dup.authorizedOverrideRoles && dup.authorizedOverrideRoles.length > 0
        ? dup.authorizedOverrideRoles
        : DEFAULT_OVERRIDE_ROLES;
    const checkerApprovalRoles =
      dup.checkerApprovalRoles && dup.checkerApprovalRoles.length > 0
        ? dup.checkerApprovalRoles
        : DEFAULT_CHECKER_ROLES;

    const explicitDisallow = dup.allowOverride === false;
    let policyReason = '';
    if (warningLevel === 'HARD_BLOCK') {
      policyReason =
        'Duplicate PR Submission Blocked: Active governance policy Warning Level is HARD_BLOCK (overrides prohibited).';
    } else if (explicitDisallow) {
      policyReason =
        'Duplicate PR Submission Blocked: Active governance policy explicitly prohibits duplicate PR overrides.';
    } else if (dup.requireCheckerApprovalForOverride) {
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
    const requiresCheckerApproval =
      allowOverride &&
      (Boolean(dup.requireCheckerApprovalForOverride) || !authorizedOverrideRoles.includes(role));

    return {
      policyVersion: policyInput?.policyVersion || 'POL-STD-2026',
      enableDuplicateDetection,
      warningLevel,
      policyAllowsOverride: allowOverride,
      policyReason,
      requiresCheckerApproval,
      authorizedOverrideRoles,
      checkerApprovalRoles,
      checkSameBranch,
      checkSameRequester,
      checkSamePurpose,
      checkSameRequirementDate,
      checkSimilarQuantity,
      tolerancePercent,
    };
  }

  private detectStaleness(
    liveMatches: BackendMatchingPrRef[],
    proposedQty: number,
    tolerancePercent: number,
    ack?: BackendAcknowledgementRecord,
    ovr?: BackendOverrideRecord
  ): { isStale: boolean; reason?: string } {
    if (!ack) return { isStale: false };
    const ackByPr = new Map((ack.matchingPrRefs || []).map((r) => [r.prId, r]));

    for (const live of liveMatches) {
      const prev = ackByPr.get(live.prId);
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

    if (ovr?.matchingPrSnapshots && ovr.matchingPrSnapshots.length > 0) {
      const ovrByPr = new Map(ovr.matchingPrSnapshots.map((s) => [s.prId, s]));
      for (const live of liveMatches) {
        const snap = ovrByPr.get(live.prId);
        if (!snap || snap.status !== live.status) {
          return {
            isStale: true,
            reason: `Matching PR ${live.prNumber} status (${live.status}) no longer matches approved override snapshot (${snap?.status || 'MISSING'}).`,
          };
        }
      }
    }

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

  evaluate(params: {
    draftKey: string;
    prId?: string;
    prNumber?: string;
    companyId: string;
    branchId: string;
    requesterId?: string;
    purchasePurpose?: string;
    expectedDeliveryDate?: string;
    lines: BackendDuplicateLineInput[];
    actorUser?: BackendActorUser;
    policy?: BackendDuplicatePolicyInput;
    prs?: BackendPrHeaderInput[];
  }): BackendGovernanceSnapshot {
    if (Array.isArray(params.prs)) {
      this.syncPrs(params.prs, false);
    }

    const nowIso = new Date().toISOString();
    const normComp = normalizeCompanyId(params.companyId);
    const normBr = normalizeBranchId(params.branchId);
    const flags = this.resolvePolicyFlags(params.policy, params.actorUser);

    if (!flags.enableDuplicateDetection || !params.lines || params.lines.length === 0) {
      return {
        draftKey: params.draftKey,
        policyVersion: flags.policyVersion,
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

    const rec = this.resolveRecord(params.draftKey, params.prId);
    const allPrs = Array.from(this.prsById.values());
    const tolRatio = flags.tolerancePercent / 100;
    const conditions: BackendConditionRecord[] = [];
    const seenMatchingPrIds = new Set<string>();
    let mutated = false;

    params.lines.forEach((propLine, lineIdx) => {
      const propItemNorm = normalizeItemCode(propLine.itemCode);
      if (!propItemNorm) return;

      const conditionKey = buildConditionKey(propLine.id, lineIdx, propItemNorm);
      const matches: BackendMatchingPrRef[] = [];

      for (const existingPr of allPrs) {
        if (params.prId && existingPr.id === params.prId) continue;
        if (CLOSED_PR_STATUSES.includes(existingPr.status)) continue;
        if (normalizeCompanyId(existingPr.companyId) !== normComp) continue;
        if (flags.checkSameBranch && normalizeBranchId(existingPr.branchId) !== normBr) continue;
        if (
          flags.checkSameRequester &&
          params.requesterId &&
          existingPr.requesterId !== params.requesterId
        ) {
          continue;
        }
        const propPurpose = (propLine.purchasePurpose || params.purchasePurpose || '').trim().toLowerCase();
        if (
          flags.checkSamePurpose &&
          propPurpose &&
          (existingPr.purchasePurpose || '').trim().toLowerCase() !== propPurpose
        ) {
          continue;
        }
        if (
          flags.checkSameRequirementDate &&
          params.expectedDeliveryDate &&
          (existingPr.expectedDeliveryDate || existingPr.requiredBy) !== params.expectedDeliveryDate
        ) {
          continue;
        }

        for (const existLine of existingPr.lines || []) {
          if (normalizeItemCode(existLine.itemCode) !== propItemNorm) continue;
          const existQty = Number(existLine.requestedQuantity) || 0;
          const propQty = Number(propLine.requestedQuantity) || 0;
          const variancePct =
            existQty > 0 ? Number(((Math.abs(propQty - existQty) / existQty) * 100).toFixed(1)) : 0;

          if (flags.checkSimilarQuantity && existQty > 0 && propQty > 0) {
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

      const persistedEntry = this.findPersistedConditionEntry(rec, conditionKey, lineIdx, propItemNorm);

      if (matches.length === 0) {
        if (
          rec &&
          persistedEntry &&
          (persistedEntry.acknowledgement ||
            (persistedEntry.lastEvaluatedMatchIds && persistedEntry.lastEvaluatedMatchIds.length > 0))
        ) {
          this.appendAudit(rec, {
            draftKey: params.draftKey,
            prId: params.prId,
            prNumber: params.prNumber,
            conditionKey,
            itemCode: propLine.itemCode,
            companyId: normComp,
            branchId: normBr,
            eventType: 'CONDITION_RESOLVED',
            actorUserId: params.actorUser?.id || 'system',
            actorName: params.actorUser?.fullName || 'Duplicate Governance Backend',
            actorRole: params.actorUser?.role || 'SYSTEM',
            reason: 'All matching open PRs are now closed/cancelled; duplicate condition resolved.',
            matchingPrNumbers: [],
            previousState: persistedEntry.overrideRecord?.status || 'DETECTED',
            newState: 'RESOLVED',
          });
          delete rec.conditionsByKey[conditionKey];
          mutated = true;
        }
        return;
      }

      const ack = persistedEntry?.acknowledgement;
      const ovr = persistedEntry?.overrideRecord;
      const staleCheck = this.detectStaleness(
        matches,
        Number(propLine.requestedQuantity) || 0,
        flags.tolerancePercent,
        ack,
        ovr
      );

      let state: DuplicateGovernanceState = 'DETECTED';
      let overrideStatus: DuplicateOverrideApprovalStatus = flags.policyAllowsOverride
        ? 'NOT_REQUESTED'
        : 'PROHIBITED_BY_POLICY';
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
        overrideStatus = flags.policyAllowsOverride ? 'NOT_REQUESTED' : 'PROHIBITED_BY_POLICY';
        submissionEligible = false;
        blockingReason = flags.policyAllowsOverride
          ? `Line #${lineIdx + 1} (${propLine.itemCode}): ${matches.length} matching open PR(s) (${matches
              .map((m) => `${m.prNumber} [${m.status}]`)
              .join(', ')}). Acknowledge with justification and obtain override authorisation.`
          : `Line #${lineIdx + 1} (${propLine.itemCode}): ${flags.policyReason}`;
      } else if (!flags.policyAllowsOverride) {
        state = 'ACKNOWLEDGED';
        overrideStatus = 'PROHIBITED_BY_POLICY';
        submissionEligible = false;
        blockingReason = `Line #${lineIdx + 1} (${propLine.itemCode}): ${flags.policyReason}`;
      } else if (ovr?.status === 'REJECTED') {
        state = 'ACKNOWLEDGED';
        overrideStatus = 'REJECTED';
        submissionEligible = false;
        blockingReason = `Line #${lineIdx + 1} (${propLine.itemCode}): Duplicate PR override rejected by ${
          ovr.decidedByName || 'Checker'
        }${ovr.rejectionReason ? ` — "${ovr.rejectionReason}"` : '.'}`;
      } else if (ovr?.status === 'AUTHORISED') {
        state = 'OVERRIDE_AUTHORISED';
        overrideStatus = 'AUTHORISED';
        submissionEligible = true;
      } else if (ovr?.status === 'PENDING_CHECKER_APPROVAL' || flags.requiresCheckerApproval) {
        state = 'ACKNOWLEDGED';
        overrideStatus = 'PENDING_CHECKER_APPROVAL';
        submissionEligible = false;
        blockingReason = `Line #${lineIdx + 1} (${propLine.itemCode}): Awaiting Checker Approval for duplicate PR override.`;
      } else {
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
        warningLevel: flags.warningLevel,
        policyAllowsOverride: flags.policyAllowsOverride,
        requiresCheckerApproval: flags.requiresCheckerApproval,
        policyReason: flags.policyReason,
        acknowledgement: ack,
        overrideRecord: ovr,
        submissionEligible,
        blockingReason,
        staleReason,
        lastEvaluatedAt: nowIso,
      });
    });

    if (mutated && rec) {
      this.saveToDisk();
      void this.syncRecordToDatabase(rec);
    }

    const blockingReasons = conditions
      .filter((c) => !c.submissionEligible)
      .map((c) => c.blockingReason || `Duplicate condition blocked for ${c.itemCode}.`);
    const submissionEligible =
      conditions.length === 0 || conditions.every((c) => c.submissionEligible);

    let overallStatus: BackendGovernanceSnapshot['overallStatus'] = 'CLEAR';
    if (conditions.length > 0) {
      if (submissionEligible) overallStatus = 'OVERRIDE_AUTHORISED';
      else if (conditions.some((c) => c.state === 'STALE')) overallStatus = 'STALE';
      else if (conditions.some((c) => c.overrideStatus === 'PROHIBITED_BY_POLICY'))
        overallStatus = 'PROHIBITED';
      else if (conditions.some((c) => c.overrideStatus === 'REJECTED')) overallStatus = 'REJECTED';
      else if (conditions.some((c) => c.overrideStatus === 'PENDING_CHECKER_APPROVAL'))
        overallStatus = 'AWAITING_CHECKER_APPROVAL';
      else if (conditions.some((c) => c.state === 'ACKNOWLEDGED')) overallStatus = 'ACKNOWLEDGED';
      else overallStatus = 'DETECTED';
    }

    return {
      draftKey: params.draftKey,
      policyVersion: flags.policyVersion,
      evaluatedAt: nowIso,
      hasDuplicates: conditions.length > 0,
      totalDuplicateConditions: conditions.length,
      totalMatchingPrCount: seenMatchingPrIds.size,
      submissionEligible,
      overallStatus,
      blockingReasons,
      conditions,
      auditHistory: rec?.auditHistory || [],
    };
  }

  acknowledge(params: {
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
    lines: BackendDuplicateLineInput[];
    actorUser: BackendActorUser;
    policy?: BackendDuplicatePolicyInput;
    prs?: BackendPrHeaderInput[];
    allowSupersede?: boolean;
    supersedeReason?: string;
  }) {
    const cleanJustification = (params.justification || '').trim();
    if (!cleanJustification) {
      throw new PrDuplicateGovernanceHttpError(
        400,
        'JUSTIFICATION_REQUIRED',
        'Mandatory Duplicate Override Justification is required before acknowledging.'
      );
    }
    if (!params.actorUser?.id) {
      throw new PrDuplicateGovernanceHttpError(
        400,
        'ACTOR_REQUIRED',
        'Authenticated user ID is required to record duplicate acknowledgement.'
      );
    }

    const beforeSnap = this.evaluate(params);
    const targetCond = beforeSnap.conditions.find((c) => c.conditionKey === params.conditionKey);
    if (!targetCond) {
      throw new PrDuplicateGovernanceHttpError(
        404,
        'CONDITION_NOT_FOUND',
        'Duplicate condition could not be located or has already been resolved.'
      );
    }

    const rec = this.getOrCreateRecord(
      params.draftKey,
      targetCond.companyId,
      targetCond.branchId,
      params.prId,
      params.prNumber
    );
    const existingEntry = this.findPersistedConditionEntry(
      rec,
      targetCond.conditionKey,
      targetCond.lineIndex,
      targetCond.itemCode
    );

    if (
      existingEntry?.overrideRecord?.status === 'AUTHORISED' &&
      targetCond.state !== 'STALE'
    ) {
      if (!params.allowSupersede) {
        throw new PrDuplicateGovernanceHttpError(
          409,
          'APPROVED_OVERRIDE_IMMUTABLE',
          `Cannot modify an already approved override (${existingEntry.overrideRecord.approvalReference}) without recording a superseding audit event.`
        );
      }
      this.appendAudit(rec, {
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
        approvalReference: existingEntry.overrideRecord.approvalReference,
        reason: params.supersedeReason || 'Approved override superseded by new acknowledgement',
        justification: cleanJustification,
        matchingPrNumbers: targetCond.matchingPrs.map((m) => m.prNumber),
        previousState: 'OVERRIDE_AUTHORISED',
        newState: 'ACKNOWLEDGED',
      });
    }

    const nowIso = new Date().toISOString();
    const ackId = `ack-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ackRecord: BackendAcknowledgementRecord = {
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
      persistedVia: 'BACKEND_API',
    };

    if (
      !rec.auditHistory.some(
        (h) => h.conditionKey === targetCond.conditionKey && h.eventType === 'DUPLICATE_DETECTED'
      )
    ) {
      this.appendAudit(rec, {
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

    this.appendAudit(rec, {
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

    let initialOverride: BackendOverrideRecord | undefined;
    if (!targetCond.policyAllowsOverride) {
      initialOverride = {
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
      initialOverride = {
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
      this.appendAudit(rec, {
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

    rec.conditionsByKey[targetCond.conditionKey] = {
      acknowledgement: ackRecord,
      overrideRecord: initialOverride,
      lastEvaluatedMatchIds: targetCond.matchingPrs.map((m) => m.prId),
      lastProposedQty: targetCond.proposedQuantity,
      lastItemCode: targetCond.itemCode,
    };
    this.recordsByKey.set(params.draftKey, rec);
    if (params.prId) this.recordsByKey.set(params.prId, rec);
    this.saveToDisk();
    void this.syncRecordToDatabase(rec);

    const afterSnap = this.evaluate(params);
    const updatedCond = afterSnap.conditions.find((c) => c.conditionKey === targetCond.conditionKey);

    const message = !targetCond.policyAllowsOverride
      ? `Acknowledgement persisted (${ackId}). ${targetCond.policyReason}`
      : targetCond.requiresCheckerApproval
      ? `Acknowledgement persisted (${ackId}). Awaiting Checker Approval before PR submission.`
      : `Acknowledgement persisted (${ackId}). Override Authorisation is still required before PR submission.`;

    return {
      success: true,
      message,
      condition: updatedCond,
      record: rec,
      snapshot: afterSnap,
    };
  }

  requestOverride(params: {
    draftKey: string;
    prId?: string;
    prNumber?: string;
    conditionKey: string;
    companyId: string;
    branchId: string;
    requesterId?: string;
    purchasePurpose?: string;
    expectedDeliveryDate?: string;
    lines: BackendDuplicateLineInput[];
    actorUser: BackendActorUser;
    policy?: BackendDuplicatePolicyInput;
    prs?: BackendPrHeaderInput[];
  }) {
    const beforeSnap = this.evaluate(params);
    const cond = beforeSnap.conditions.find((c) => c.conditionKey === params.conditionKey);
    if (!cond) {
      throw new PrDuplicateGovernanceHttpError(404, 'CONDITION_NOT_FOUND', 'Duplicate condition not found.');
    }
    if (!cond.acknowledgement) {
      throw new PrDuplicateGovernanceHttpError(
        400,
        'ACK_REQUIRED',
        'Acknowledge & Record Justification must be completed before requesting override.'
      );
    }
    if (!cond.policyAllowsOverride) {
      throw new PrDuplicateGovernanceHttpError(403, 'OVERRIDE_PROHIBITED', cond.policyReason);
    }
    if (cond.state === 'STALE') {
      throw new PrDuplicateGovernanceHttpError(
        409,
        'STALE_CONDITION',
        cond.staleReason || 'Condition is stale. Please re-acknowledge before requesting override.'
      );
    }

    const rec = this.getOrCreateRecord(
      params.draftKey,
      cond.companyId,
      cond.branchId,
      params.prId,
      params.prNumber
    );
    const nowIso = new Date().toISOString();
    const ovr: BackendOverrideRecord = {
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

    rec.conditionsByKey[cond.conditionKey] = {
      ...(rec.conditionsByKey[cond.conditionKey] || {}),
      acknowledgement: cond.acknowledgement,
      overrideRecord: ovr,
      lastEvaluatedMatchIds: cond.matchingPrs.map((m) => m.prId),
      lastProposedQty: cond.proposedQuantity,
      lastItemCode: cond.itemCode,
    };

    this.appendAudit(rec, {
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

    this.saveToDisk();
    void this.syncRecordToDatabase(rec);

    const afterSnap = this.evaluate(params);
    return {
      success: true,
      message: `Override request (${ovr.id}) submitted — Awaiting Checker Approval.`,
      condition: afterSnap.conditions.find((c) => c.conditionKey === cond.conditionKey),
      record: rec,
      snapshot: afterSnap,
    };
  }

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
    lines: BackendDuplicateLineInput[];
    actorUser: BackendActorUser;
    policy?: BackendDuplicatePolicyInput;
    prs?: BackendPrHeaderInput[];
  }) {
    const beforeSnap = this.evaluate(params);
    const cond = beforeSnap.conditions.find((c) => c.conditionKey === params.conditionKey);
    if (!cond) {
      throw new PrDuplicateGovernanceHttpError(404, 'CONDITION_NOT_FOUND', 'Duplicate condition not found.');
    }
    if (!cond.acknowledgement) {
      throw new PrDuplicateGovernanceHttpError(
        400,
        'ACK_REQUIRED',
        'Acknowledge & Record Justification must be persisted before authorising an override.'
      );
    }
    if (cond.state === 'STALE') {
      throw new PrDuplicateGovernanceHttpError(
        409,
        'STALE_CONDITION',
        cond.staleReason || 'Matching open PR state changed; re-acknowledgement required.'
      );
    }
    if (!cond.policyAllowsOverride) {
      throw new PrDuplicateGovernanceHttpError(403, 'OVERRIDE_PROHIBITED', cond.policyReason);
    }

    const flags = this.resolvePolicyFlags(params.policy, params.actorUser);
    if (flags.requiresCheckerApproval) {
      throw new PrDuplicateGovernanceHttpError(
        403,
        'CHECKER_APPROVAL_REQUIRED',
        `User role (${params.actorUser.role}) or policy requires Checker approval before duplicate override can be authorised.`
      );
    }
    if (cond.overrideRecord?.status === 'AUTHORISED') {
      throw new PrDuplicateGovernanceHttpError(
        409,
        'APPROVED_OVERRIDE_IMMUTABLE',
        `Override (${cond.overrideRecord.approvalReference}) is already authorised and immutable.`
      );
    }

    const rec = this.getOrCreateRecord(
      params.draftKey,
      cond.companyId,
      cond.branchId,
      params.prId,
      params.prNumber
    );
    const nowIso = new Date().toISOString();
    const approvalRef = `DUP-OVR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const ovr: BackendOverrideRecord = {
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
      decisionRemarks: params.remarks?.trim() || 'Authorised duplicate PR override under policy',
      policyVersion: beforeSnap.policyVersion,
      matchingPrSnapshots: cond.matchingPrs.map((m) => ({
        prId: m.prId,
        prNumber: m.prNumber,
        status: m.status,
        existingQty: m.existingQty,
      })),
    };

    rec.conditionsByKey[cond.conditionKey] = {
      acknowledgement: cond.acknowledgement,
      overrideRecord: ovr,
      lastEvaluatedMatchIds: cond.matchingPrs.map((m) => m.prId),
      lastProposedQty: cond.proposedQuantity,
      lastItemCode: cond.itemCode,
    };

    this.appendAudit(rec, {
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

    this.saveToDisk();
    void this.syncRecordToDatabase(rec);

    const afterSnap = this.evaluate(params);
    return {
      success: true,
      message: `Override Authorised (Ref: ${approvalRef}) for ${cond.itemCode}.`,
      condition: afterSnap.conditions.find((c) => c.conditionKey === cond.conditionKey),
      record: rec,
      snapshot: afterSnap,
    };
  }

  checkerDecision(params: {
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
    lines: BackendDuplicateLineInput[];
    checkerUser: BackendActorUser;
    policy?: BackendDuplicatePolicyInput;
    prs?: BackendPrHeaderInput[];
  }) {
    const beforeSnap = this.evaluate({
      ...params,
      actorUser: params.checkerUser,
    });
    const cond = beforeSnap.conditions.find((c) => c.conditionKey === params.conditionKey);
    if (!cond) {
      throw new PrDuplicateGovernanceHttpError(404, 'CONDITION_NOT_FOUND', 'Duplicate condition not found.');
    }
    if (!cond.acknowledgement) {
      throw new PrDuplicateGovernanceHttpError(
        400,
        'ACK_REQUIRED',
        'Cannot record Checker decision before justification acknowledgement is persisted.'
      );
    }
    if (cond.state === 'STALE') {
      throw new PrDuplicateGovernanceHttpError(
        409,
        'STALE_CONDITION',
        cond.staleReason || 'Condition is stale due to matching PR changes. Re-acknowledgement required.'
      );
    }

    const flags = this.resolvePolicyFlags(params.policy, params.checkerUser);
    if (!flags.policyAllowsOverride && params.decision === 'APPROVED') {
      throw new PrDuplicateGovernanceHttpError(403, 'OVERRIDE_PROHIBITED', flags.policyReason);
    }
    if (!flags.checkerApprovalRoles.includes(params.checkerUser.role)) {
      throw new PrDuplicateGovernanceHttpError(
        403,
        'CHECKER_ROLE_DENIED',
        `Access denied: Role ${params.checkerUser.role} is not authorised to act as Duplicate Override Checker.`
      );
    }
    if (params.checkerUser.id === cond.acknowledgement.userId) {
      throw new PrDuplicateGovernanceHttpError(
        403,
        'MAKER_CHECKER_VIOLATION',
        'Maker-Checker violation: The user who acknowledged/requested the duplicate override cannot approve their own override.'
      );
    }
    if (cond.overrideRecord?.status === 'AUTHORISED') {
      throw new PrDuplicateGovernanceHttpError(
        409,
        'APPROVED_OVERRIDE_IMMUTABLE',
        `Override (${cond.overrideRecord.approvalReference}) is already approved and immutable.`
      );
    }
    const cleanRemarks = (params.remarks || '').trim();
    if (params.decision === 'REJECTED' && !cleanRemarks) {
      throw new PrDuplicateGovernanceHttpError(
        400,
        'REJECTION_REMARKS_REQUIRED',
        'Mandatory rejection reason is required when rejecting a duplicate PR override.'
      );
    }

    const rec = this.getOrCreateRecord(
      params.draftKey,
      cond.companyId,
      cond.branchId,
      params.prId,
      params.prNumber
    );
    const nowIso = new Date().toISOString();
    const approvalRef =
      params.decision === 'APPROVED'
        ? `DUP-CHK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
        : undefined;

    const updatedOvr: BackendOverrideRecord = {
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

    rec.conditionsByKey[cond.conditionKey] = {
      acknowledgement: cond.acknowledgement,
      overrideRecord: updatedOvr,
      lastEvaluatedMatchIds: cond.matchingPrs.map((m) => m.prId),
      lastProposedQty: cond.proposedQuantity,
      lastItemCode: cond.itemCode,
    };

    this.appendAudit(rec, {
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

    this.saveToDisk();
    void this.syncRecordToDatabase(rec);

    const afterSnap = this.evaluate({
      ...params,
      actorUser: params.checkerUser,
    });

    return {
      success: true,
      message:
        params.decision === 'APPROVED'
          ? `Checker Approved Override (Ref: ${approvalRef}) for ${cond.itemCode}.`
          : `Checker Rejected Override for ${cond.itemCode}: ${cleanRemarks}`,
      condition: afterSnap.conditions.find((c) => c.conditionKey === cond.conditionKey),
      record: rec,
      snapshot: afterSnap,
    };
  }

  validateSubmission(params: {
    draftKey: string;
    prId?: string;
    prNumber?: string;
    companyId: string;
    branchId: string;
    requesterId?: string;
    purchasePurpose?: string;
    expectedDeliveryDate?: string;
    lines: BackendDuplicateLineInput[];
    actorUser?: BackendActorUser;
    policy?: BackendDuplicatePolicyInput;
    prs?: BackendPrHeaderInput[];
  }): {
    allowed: boolean;
    message: string;
    blockingReasons: string[];
    snapshot: BackendGovernanceSnapshot;
    httpStatus: number;
  } {
    const snap = this.evaluate(params);

    if (!snap.hasDuplicates) {
      return {
        allowed: true,
        message: 'No duplicate PR conditions detected.',
        blockingReasons: [],
        snapshot: snap,
        httpStatus: 200,
      };
    }

    const rec = this.getOrCreateRecord(
      params.draftKey,
      params.companyId,
      params.branchId,
      params.prId,
      params.prNumber
    );
    const actor = params.actorUser || {
      id: params.requesterId || 'usr-system',
      fullName: 'Requester',
      role: 'REQUESTER',
    };

    for (const cond of snap.conditions) {
      if (cond.state === 'STALE') {
        this.appendAudit(rec, {
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
          actorRole: actor.role || 'REQUESTER',
          reason: cond.staleReason || 'Matching PR status changed prior to submission.',
          matchingPrNumbers: cond.matchingPrs.map((m) => m.prNumber),
          previousState: cond.overrideRecord?.status || 'ACKNOWLEDGED',
          newState: 'STALE',
        });
      }

      this.appendAudit(rec, {
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
        actorRole: actor.role || 'REQUESTER',
        approvalReference: cond.overrideRecord?.approvalReference,
        reason: cond.submissionEligible ? 'Eligible for submission' : cond.blockingReason,
        matchingPrNumbers: cond.matchingPrs.map((m) => m.prNumber),
        previousState: cond.state,
        newState: cond.submissionEligible ? 'SUBMISSION_PERMITTED' : 'SUBMISSION_BLOCKED',
      });

      this.appendAudit(rec, {
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
        actorRole: actor.role || 'REQUESTER',
        approvalReference: cond.overrideRecord?.approvalReference,
        reason: cond.submissionEligible
          ? `Override authorised (${cond.overrideRecord?.approvalReference})`
          : cond.blockingReason,
        matchingPrNumbers: cond.matchingPrs.map((m) => m.prNumber),
        previousState: cond.state,
        newState: cond.submissionEligible ? 'PERMITTED' : 'BLOCKED',
      });
    }

    this.saveToDisk();
    void this.syncRecordToDatabase(rec);

    const updatedSnap = this.evaluate(params);
    const hasStaleOrConflict = updatedSnap.conditions.some((c) => c.state === 'STALE');

    return {
      allowed: updatedSnap.submissionEligible,
      message: updatedSnap.submissionEligible
        ? 'All duplicate PR governance checks passed.'
        : updatedSnap.blockingReasons[0] ||
          'Submission blocked by Duplicate PR Governance policy.',
      blockingReasons: updatedSnap.blockingReasons,
      snapshot: updatedSnap,
      httpStatus: updatedSnap.submissionEligible ? 200 : hasStaleOrConflict ? 409 : 403,
    };
  }
}

export const defaultPrDuplicateGovernanceBackend = new PrDuplicateGovernanceBackendStore({
  persistToDisk: true,
});
