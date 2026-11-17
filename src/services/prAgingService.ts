/**
 * CIPPLATFORM — SEPARATE PURCHASE REQUISITION (PR) AGING ENGINE
 * Strictly decoupled from Inventory Stock Aging configuration, calculations, and snapshots.
 *
 * Rules:
 * - Default Calculation Basis: PR Submitted Date (submittedAt)
 * - Draft PRs: Excluded from pending approval aging ('EXCLUDED_DRAFT')
 * - Completed / Cancelled / Rejected / Short-Closed PRs: Excluded from active pending aging
 *   unless historical aging mode is explicitly requested
 * - Configurable by Company, Branch, Purchase Org, PR Type, Approval Stage, Priority
 * - Default Buckets: 0–3 Normal, 4–7 Attention, 8–15 Delayed, >15 Critical (editable)
 * - Tracks Stage-Level Aging, SLA Due Date, and Escalation Status
 */

import { PurchaseRequisitionHeader, PRType, PRPriority } from '../types/purchaseRequisition';
import { User } from '../types';
import { normalizeCompanyId, normalizeBranchId } from './prGovernancePolicyService';
import { rbacPermissionService } from './rbacPermissionService';
import { EnterpriseAuditService } from './enterpriseAuditService';

export interface PrAgingBucketDefinition {
  key: 'NORMAL' | 'ATTENTION' | 'DELAYED' | 'CRITICAL' | string;
  label: string;
  fromDays: number;
  toDays: number;
}

export type PrAgingBasis = 'SUBMITTED_DATE' | 'CREATED_DATE' | 'STAGE_ENTERED_DATE';

export interface PrAgingPolicyConfig {
  id: string;
  companyId: string;
  branchId: string; // 'ALL' or specific branchId
  purchaseOrgId: string; // 'ALL' or specific purchaseOrgId
  prType: PRType | 'ALL';
  priority: PRPriority | 'ALL';
  isEnabled: boolean;
  agingBasis: PrAgingBasis;
  excludeDrafts: boolean;
  excludeTerminalClosed: boolean;
  buckets: PrAgingBucketDefinition[];
  stageSlaDays: {
    PENDING_MANAGER_APPROVAL: number;
    PENDING_DEPARTMENT_APPROVAL: number;
    PENDING_SUBSEQUENT_APPROVAL: number;
    APPROVED_PENDING_BUYER: number;
    PENDING_BUYER_CONFIGURATION: number;
    PENDING_RFQ_CONVERSION: number;
  };
  escalationThresholdDays: number;
  version: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  status: 'ACTIVE' | 'SUPERSEDED';
  updatedAt: string;
  updatedBy: string;
  changeReason?: string;
}

export type PrWorkflowAgingStage =
  | 'DRAFT_EXCLUDED'
  | 'Pending Manager Approval'
  | 'Pending Department Approval'
  | 'Pending Category Approval'
  | 'Approved – Pending Buyer Assignment'
  | 'Pending Buyer Action'
  | 'Pending RFQ Conversion'
  | 'CLOSED_TERMINAL';

export interface PrAgingEvaluationResult {
  prId: string;
  prNumber: string;
  companyId: string;
  branchId: string;
  branchName: string;
  department: string;
  prType: PRType;
  priority: PRPriority;
  prStatus: string;
  configId: string;
  configVersion: number;
  isExcludedDraft: boolean;
  isTerminalClosed: boolean;
  isActivePendingAging: boolean;
  submittedDateDisplay: string; // YYYY-MM-DD or 'Not Submitted (Draft)'
  totalPendingAgeDays: number | null;
  agingBucketKey: string;
  agingBucketLabel: string;
  currentAgingStage: PrWorkflowAgingStage;
  stageEnteredDateDisplay: string;
  currentStageAgeDays: number | null;
  slaTargetDays: number | null;
  slaDueDateDisplay: string;
  slaStatus: 'ON_TIME' | 'DUE_SOON' | 'BREACHED' | 'NOT_APPLICABLE';
  isEscalated: boolean;
  escalationReason?: string;
  remarks: string;
}

export const DEFAULT_PR_AGING_BUCKETS: PrAgingBucketDefinition[] = [
  { key: 'NORMAL', label: '0–3 Days (Normal)', fromDays: 0, toDays: 3 },
  { key: 'ATTENTION', label: '4–7 Days (Attention)', fromDays: 4, toDays: 7 },
  { key: 'DELAYED', label: '8–15 Days (Delayed)', fromDays: 8, toDays: 15 },
  { key: 'CRITICAL', label: '>15 Days (Critical)', fromDays: 16, toDays: 999999 },
];

export const INITIAL_PR_AGING_POLICIES: PrAgingPolicyConfig[] = [
  {
    id: 'pr-age-co1-default',
    companyId: 'co-kosh-01',
    branchId: 'ALL',
    purchaseOrgId: 'ALL',
    prType: 'ALL',
    priority: 'ALL',
    isEnabled: true,
    agingBasis: 'SUBMITTED_DATE',
    excludeDrafts: true,
    excludeTerminalClosed: true,
    buckets: JSON.parse(JSON.stringify(DEFAULT_PR_AGING_BUCKETS)),
    stageSlaDays: {
      PENDING_MANAGER_APPROVAL: 3,
      PENDING_DEPARTMENT_APPROVAL: 3,
      PENDING_SUBSEQUENT_APPROVAL: 4,
      APPROVED_PENDING_BUYER: 3,
      PENDING_BUYER_CONFIGURATION: 5,
      PENDING_RFQ_CONVERSION: 7,
    },
    escalationThresholdDays: 7,
    version: 1,
    effectiveFrom: '2026-04-01',
    status: 'ACTIVE',
    updatedAt: '2026-04-01T08:00:00Z',
    updatedBy: 'Platform Governance Admin',
  },
  {
    id: 'pr-age-co1-critical',
    companyId: 'co-kosh-01',
    branchId: 'ALL',
    purchaseOrgId: 'ALL',
    prType: 'ALL',
    priority: 'CRITICAL',
    isEnabled: true,
    agingBasis: 'SUBMITTED_DATE',
    excludeDrafts: true,
    excludeTerminalClosed: true,
    buckets: [
      { key: 'NORMAL', label: '0–1 Days (Normal)', fromDays: 0, toDays: 1 },
      { key: 'ATTENTION', label: '2–3 Days (Attention)', fromDays: 2, toDays: 3 },
      { key: 'DELAYED', label: '4–7 Days (Delayed)', fromDays: 4, toDays: 7 },
      { key: 'CRITICAL', label: '>7 Days (Critical)', fromDays: 8, toDays: 999999 },
    ],
    stageSlaDays: {
      PENDING_MANAGER_APPROVAL: 1,
      PENDING_DEPARTMENT_APPROVAL: 1,
      PENDING_SUBSEQUENT_APPROVAL: 2,
      APPROVED_PENDING_BUYER: 1,
      PENDING_BUYER_CONFIGURATION: 2,
      PENDING_RFQ_CONVERSION: 3,
    },
    escalationThresholdDays: 3,
    version: 1,
    effectiveFrom: '2026-04-01',
    status: 'ACTIVE',
    updatedAt: '2026-04-01T08:00:00Z',
    updatedBy: 'Platform Governance Admin',
  },
];

const STORAGE_KEY_PR_AGING_POLICIES = 'cip_pr_aging_policies_v1';
let memoryPrAgingPolicies: PrAgingPolicyConfig[] | null = null;

function daysBetween(fromIso: string, toIso: string): number | null {
  const d1 = new Date(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const d2 = new Date(`${toIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

function addDaysIso(fromIso: string, days: number): string {
  const d = new Date(`${fromIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return 'Data Unavailable';
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'REJECTED', 'SHORT_CLOSED', 'WITHDRAWN', 'ARCHIVED']);

export const prAgingService = {
  getPolicies(): PrAgingPolicyConfig[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_PR_AGING_POLICIES);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // ignore
      }
    }
    if (!memoryPrAgingPolicies) {
      memoryPrAgingPolicies = JSON.parse(JSON.stringify(INITIAL_PR_AGING_POLICIES));
    }
    return memoryPrAgingPolicies!;
  },

  savePolicies(policies: PrAgingPolicyConfig[]): void {
    memoryPrAgingPolicies = JSON.parse(JSON.stringify(policies));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_PR_AGING_POLICIES, JSON.stringify(policies));
      } catch {
        // ignore
      }
    }
  },

  validateBuckets(buckets: PrAgingBucketDefinition[]): { valid: boolean; message: string } {
    if (!buckets || buckets.length < 2) {
      return { valid: false, message: 'At least 2 PR aging buckets are required.' };
    }
    if (buckets[0].fromDays !== 0) {
      return { valid: false, message: 'First PR aging bucket must start at 0 days.' };
    }
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (b.fromDays > b.toDays) {
        return { valid: false, message: `PR bucket "${b.label}" has fromDays > toDays.` };
      }
      if (i > 0 && b.fromDays !== buckets[i - 1].toDays + 1) {
        return {
          valid: false,
          message: `Gap or overlap between "${buckets[i - 1].label}" and "${b.label}".`,
        };
      }
    }
    return { valid: true, message: 'PR aging buckets validated.' };
  },

  getEffectivePolicy(params: {
    companyId: string;
    branchId?: string;
    purchaseOrgId?: string;
    prType?: PRType;
    priority?: PRPriority;
    asOfDate?: string;
  }): PrAgingPolicyConfig {
    const normCo = normalizeCompanyId(params.companyId);
    const normBr = params.branchId && params.branchId !== 'ALL' ? normalizeBranchId(params.branchId) : 'ALL';
    const asOf = (params.asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 10);

    const active = this.getPolicies()
      .filter((p) => {
        if (p.status !== 'ACTIVE') return false;
        if (normalizeCompanyId(p.companyId) !== normCo) return false;
        if (p.effectiveFrom > asOf) return false;
        if (p.effectiveUntil && p.effectiveUntil < asOf) return false;
        const brMatch = p.branchId === 'ALL' || normalizeBranchId(p.branchId) === normBr;
        const poMatch = !params.purchaseOrgId || p.purchaseOrgId === 'ALL' || p.purchaseOrgId === params.purchaseOrgId;
        const typeMatch = !params.prType || p.prType === 'ALL' || p.prType === params.prType;
        const prioMatch = !params.priority || p.priority === 'ALL' || p.priority === params.priority;
        return brMatch && poMatch && typeMatch && prioMatch;
      })
      .sort((a, b) => {
        const sA =
          (a.branchId !== 'ALL' ? 8 : 0) +
          (a.purchaseOrgId !== 'ALL' ? 4 : 0) +
          (a.prType !== 'ALL' ? 2 : 0) +
          (a.priority !== 'ALL' ? 1 : 0);
        const sB =
          (b.branchId !== 'ALL' ? 8 : 0) +
          (b.purchaseOrgId !== 'ALL' ? 4 : 0) +
          (b.prType !== 'ALL' ? 2 : 0) +
          (b.priority !== 'ALL' ? 1 : 0);
        if (sB !== sA) return sB - sA;
        return b.version - a.version;
      });

    if (active.length > 0) return JSON.parse(JSON.stringify(active[0]));

    return {
      id: `pr-age-fallback-${normCo}`,
      companyId: normCo,
      branchId: 'ALL',
      purchaseOrgId: 'ALL',
      prType: 'ALL',
      priority: 'ALL',
      isEnabled: true,
      agingBasis: 'SUBMITTED_DATE',
      excludeDrafts: true,
      excludeTerminalClosed: true,
      buckets: JSON.parse(JSON.stringify(DEFAULT_PR_AGING_BUCKETS)),
      stageSlaDays: {
        PENDING_MANAGER_APPROVAL: 3,
        PENDING_DEPARTMENT_APPROVAL: 3,
        PENDING_SUBSEQUENT_APPROVAL: 4,
        APPROVED_PENDING_BUYER: 3,
        PENDING_BUYER_CONFIGURATION: 5,
        PENDING_RFQ_CONVERSION: 7,
      },
      escalationThresholdDays: 7,
      version: 1,
      effectiveFrom: '2026-01-01',
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
      updatedBy: 'System Default',
    };
  },

  savePolicyConfig(
    config: Omit<PrAgingPolicyConfig, 'id' | 'version' | 'status' | 'updatedAt'>,
    actor: { id: string; name: string },
    user?: User
  ): PrAgingPolicyConfig {
    if (user && !rbacPermissionService.hasPermission(user, 'PR_AGING_CONFIG_MANAGE')) {
      throw new Error('RBAC Authorization Denied: User lacks PR_AGING_CONFIG_MANAGE permission.');
    }
    const validation = this.validateBuckets(config.buckets);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const policies = this.getPolicies();
    const normCo = normalizeCompanyId(config.companyId);
    const normBr = config.branchId === 'ALL' ? 'ALL' : normalizeBranchId(config.branchId);

    const existingIdx = policies.findIndex(
      (p) =>
        p.status === 'ACTIVE' &&
        normalizeCompanyId(p.companyId) === normCo &&
        (p.branchId === 'ALL' ? 'ALL' : normalizeBranchId(p.branchId)) === normBr &&
        p.purchaseOrgId === (config.purchaseOrgId || 'ALL') &&
        p.prType === (config.prType || 'ALL') &&
        p.priority === (config.priority || 'ALL')
    );

    let nextVersion = 1;
    let prevCopy: PrAgingPolicyConfig | undefined;
    if (existingIdx >= 0) {
      prevCopy = { ...policies[existingIdx] };
      nextVersion = policies[existingIdx].version + 1;
      policies[existingIdx] = {
        ...policies[existingIdx],
        status: 'SUPERSEDED',
        effectiveUntil: config.effectiveFrom || new Date().toISOString().slice(0, 10),
      };
    }

    const created: PrAgingPolicyConfig = {
      ...config,
      id: `pr-age-${normCo}-${normBr}-v${nextVersion}-${Date.now()}`,
      companyId: normCo,
      branchId: normBr,
      version: nextVersion,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
      updatedBy: actor.name,
    };

    policies.unshift(created);
    this.savePolicies(policies);

    EnterpriseAuditService.logEvent({
      companyId: normCo,
      branchId: normBr === 'ALL' ? undefined : normBr,
      entityType: 'PR_AGING',
      entityId: created.id,
      eventType: 'PR_AGING_POLICY_UPDATED',
      eventDescription: `PR Aging Policy v${nextVersion} saved (Basis: ${created.agingBasis}, Escalation: ${created.escalationThresholdDays}d)`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: config.changeReason || 'PR Aging policy update',
      previousValue: prevCopy,
      newValue: created,
    });

    return created;
  },

  resolveWorkflowStage(pr: PurchaseRequisitionHeader): {
    stage: PrWorkflowAgingStage;
    slaKey: keyof PrAgingPolicyConfig['stageSlaDays'] | null;
    stageEnteredIso?: string;
  } {
    if (pr.status === 'DRAFT') {
      return { stage: 'DRAFT_EXCLUDED', slaKey: null };
    }
    if (TERMINAL_STATUSES.has(pr.status)) {
      return { stage: 'CLOSED_TERMINAL', slaKey: null };
    }
    const lastDecision = pr.approvalHistory?.[pr.approvalHistory.length - 1];
    const hasAssignedBuyer = (pr.lines || []).some((l) => Boolean(l.assignedBuyer));
    const hasRfqRef = (pr.lines || []).some((l) => (l.rfqReferences?.length || 0) > 0);

    switch (pr.status) {
      case 'SUBMITTED':
      case 'PENDING_MANAGER_APPROVAL':
      case 'RESUBMITTED':
      case 'RETURNED_FOR_CORRECTION':
        return {
          stage: 'Pending Manager Approval',
          slaKey: 'PENDING_MANAGER_APPROVAL',
          stageEnteredIso: lastDecision?.timestamp || pr.submittedAt || pr.updatedAt,
        };
      case 'PENDING_SUBSEQUENT_APPROVAL':
      case 'PENDING_REAPPROVAL':
        return {
          stage: 'Pending Department Approval',
          slaKey: 'PENDING_DEPARTMENT_APPROVAL',
          stageEnteredIso: lastDecision?.timestamp || pr.submittedAt || pr.updatedAt,
        };
      case 'APPROVED_PENDING_BUYER':
        if (hasAssignedBuyer && !hasRfqRef) {
          return {
            stage: 'Pending RFQ Conversion',
            slaKey: 'PENDING_RFQ_CONVERSION',
            stageEnteredIso: pr.approvedAt || pr.updatedAt,
          };
        }
        return {
          stage: 'Approved – Pending Buyer Assignment',
          slaKey: 'APPROVED_PENDING_BUYER',
          stageEnteredIso: pr.approvedAt || pr.updatedAt,
        };
      case 'PENDING_BUYER_CONFIGURATION':
        return {
          stage: 'Pending Buyer Action',
          slaKey: 'PENDING_BUYER_CONFIGURATION',
          stageEnteredIso: pr.approvedAt || pr.updatedAt,
        };
      default:
        return {
          stage: 'Pending Category Approval',
          slaKey: 'PENDING_SUBSEQUENT_APPROVAL',
          stageEnteredIso: pr.submittedAt || pr.updatedAt,
        };
    }
  },

  evaluatePrAging(
    pr: PurchaseRequisitionHeader,
    options?: { asOfDate?: string; includeHistoricalClosed?: boolean }
  ): PrAgingEvaluationResult {
    const asOf = (options?.asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const policy = this.getEffectivePolicy({
      companyId: pr.companyId,
      branchId: pr.branchId,
      purchaseOrgId: pr.purchaseOrganizationId || pr.purchaseOrgId,
      prType: pr.prType,
      priority: pr.priority,
      asOfDate: asOf,
    });

    const stageInfo = this.resolveWorkflowStage(pr);
    const isDraft = pr.status === 'DRAFT';
    const isTerminal = TERMINAL_STATUSES.has(pr.status);

    // Draft PRs MUST be excluded from pending approval aging
    if (isDraft && policy.excludeDrafts) {
      return {
        prId: pr.id,
        prNumber: pr.prNumber,
        companyId: pr.companyId,
        branchId: pr.branchId,
        branchName: pr.branchName,
        department: pr.department,
        prType: pr.prType,
        priority: pr.priority,
        prStatus: pr.status,
        configId: policy.id,
        configVersion: policy.version,
        isExcludedDraft: true,
        isTerminalClosed: false,
        isActivePendingAging: false,
        submittedDateDisplay: 'Not Submitted (Draft)',
        totalPendingAgeDays: null,
        agingBucketKey: 'EXCLUDED_DRAFT',
        agingBucketLabel: 'Excluded (Draft)',
        currentAgingStage: 'DRAFT_EXCLUDED',
        stageEnteredDateDisplay: 'Not Applicable',
        currentStageAgeDays: null,
        slaTargetDays: null,
        slaDueDateDisplay: 'Not Applicable',
        slaStatus: 'NOT_APPLICABLE',
        isEscalated: false,
        remarks: 'Draft PRs are excluded from pending approval aging until formally submitted.',
      };
    }

    if (isTerminal && !options?.includeHistoricalClosed) {
      return {
        prId: pr.id,
        prNumber: pr.prNumber,
        companyId: pr.companyId,
        branchId: pr.branchId,
        branchName: pr.branchName,
        department: pr.department,
        prType: pr.prType,
        priority: pr.priority,
        prStatus: pr.status,
        configId: policy.id,
        configVersion: policy.version,
        isExcludedDraft: false,
        isTerminalClosed: true,
        isActivePendingAging: false,
        submittedDateDisplay: pr.submittedAt ? pr.submittedAt.slice(0, 10) : 'Data Unavailable',
        totalPendingAgeDays: null,
        agingBucketKey: 'CLOSED_EXCLUDED',
        agingBucketLabel: 'Excluded (Closed / Terminal)',
        currentAgingStage: 'CLOSED_TERMINAL',
        stageEnteredDateDisplay: pr.updatedAt ? pr.updatedAt.slice(0, 10) : 'Data Unavailable',
        currentStageAgeDays: null,
        slaTargetDays: null,
        slaDueDateDisplay: 'Not Applicable',
        slaStatus: 'NOT_APPLICABLE',
        isEscalated: false,
        remarks: `PR status (${pr.status}) is terminal/closed and excluded from active pending aging.`,
      };
    }

    const submittedRaw =
      policy.agingBasis === 'CREATED_DATE'
        ? pr.createdAt
        : pr.submittedAt || pr.approvalHistory?.[0]?.timestamp || pr.createdAt;
    const submittedDateDisplay = submittedRaw ? submittedRaw.slice(0, 10) : 'Data Unavailable';
    const endDateIso = isTerminal ? (pr.updatedAt || asOf).slice(0, 10) : asOf;
    const totalPendingAgeDays =
      submittedDateDisplay !== 'Data Unavailable'
        ? daysBetween(submittedDateDisplay, endDateIso)
        : null;

    const bucket =
      totalPendingAgeDays !== null
        ? policy.buckets.find(
            (b) => totalPendingAgeDays >= b.fromDays && totalPendingAgeDays <= b.toDays
          ) || policy.buckets[policy.buckets.length - 1]
        : null;

    const stageEnteredRaw = stageInfo.stageEnteredIso || submittedRaw;
    const stageEnteredDateDisplay = stageEnteredRaw
      ? stageEnteredRaw.slice(0, 10)
      : 'Data Unavailable';
    const currentStageAgeDays =
      stageEnteredDateDisplay !== 'Data Unavailable'
        ? daysBetween(stageEnteredDateDisplay, endDateIso)
        : null;

    const slaTargetDays = stageInfo.slaKey ? policy.stageSlaDays[stageInfo.slaKey] : null;
    const slaDueDateDisplay =
      slaTargetDays !== null && stageEnteredDateDisplay !== 'Data Unavailable'
        ? addDaysIso(stageEnteredDateDisplay, slaTargetDays)
        : 'Not Applicable';

    let slaStatus: PrAgingEvaluationResult['slaStatus'] = 'NOT_APPLICABLE';
    if (!isTerminal && currentStageAgeDays !== null && slaTargetDays !== null) {
      if (currentStageAgeDays > slaTargetDays) {
        slaStatus = 'BREACHED';
      } else if (slaTargetDays - currentStageAgeDays <= 1) {
        slaStatus = 'DUE_SOON';
      } else {
        slaStatus = 'ON_TIME';
      }
    }

    const isEscalated =
      !isTerminal &&
      ((totalPendingAgeDays !== null && totalPendingAgeDays > policy.escalationThresholdDays) ||
        slaStatus === 'BREACHED');

    return {
      prId: pr.id,
      prNumber: pr.prNumber,
      companyId: pr.companyId,
      branchId: pr.branchId,
      branchName: pr.branchName,
      department: pr.department,
      prType: pr.prType,
      priority: pr.priority,
      prStatus: pr.status,
      configId: policy.id,
      configVersion: policy.version,
      isExcludedDraft: false,
      isTerminalClosed: isTerminal,
      isActivePendingAging: !isTerminal,
      submittedDateDisplay,
      totalPendingAgeDays,
      agingBucketKey: bucket?.key || 'DATA_UNAVAILABLE',
      agingBucketLabel: bucket?.label || 'Data Unavailable',
      currentAgingStage: stageInfo.stage,
      stageEnteredDateDisplay,
      currentStageAgeDays,
      slaTargetDays,
      slaDueDateDisplay,
      slaStatus,
      isEscalated,
      escalationReason: isEscalated
        ? `Stage "${stageInfo.stage}" exceeded SLA (${slaTargetDays ?? policy.escalationThresholdDays}d) or overall threshold (${policy.escalationThresholdDays}d).`
        : undefined,
      remarks: isTerminal
        ? `Historical aging evaluated up to closure date ${endDateIso}.`
        : `Active pending PR aging on ${stageInfo.stage}.`,
    };
  },

  evaluatePortfolio(
    prs: PurchaseRequisitionHeader[],
    options?: { asOfDate?: string; includeHistoricalClosed?: boolean; includeDrafts?: boolean }
  ): PrAgingEvaluationResult[] {
    return prs
      .map((pr) => this.evaluatePrAging(pr, options))
      .filter((res) => {
        if (!options?.includeDrafts && res.isExcludedDraft) return false;
        if (!options?.includeHistoricalClosed && res.isTerminalClosed) return false;
        return true;
      });
  },

  resetForTesting(): void {
    memoryPrAgingPolicies = JSON.parse(JSON.stringify(INITIAL_PR_AGING_POLICIES));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_PR_AGING_POLICIES);
      } catch {
        // ignore
      }
    }
  },
};
