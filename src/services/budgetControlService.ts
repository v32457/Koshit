/**
 * CIPPLATFORM — PART L: BUDGET VALIDATION AND FINANCIAL CONTROL SERVICE
 * Reuses existing Finance & Budget Control records while adding:
 * - Multi-Company / Multi-Branch / Cost Center / Project / Period / Expense Category policy configuration
 * - Enforcement modes: NO_VALIDATION, WARNING_ONLY, BLOCK_WHEN_INSUFFICIENT, ALLOW_WITH_EXCEPTION_APPROVAL
 * - Budget Exception Approval workflow (never auto-increasing budget on PR exception approval)
 * - Multi-stage commitment reconciliation across PR -> RFQ Award -> PO Creation -> PO Amendment without double counting
 * - Immutable historical budget validation snapshots
 */

import {
  BudgetValidationPolicyConfig,
  BudgetControlLedgerRecord,
  BudgetStageCommitmentEntry,
  BudgetExceptionApprovalRecord,
  BudgetValidationSnapshot,
  BudgetValidationStage,
} from '../types/procurementFinanceGovernance';
import { normalizeCompanyId, normalizeBranchId } from './prGovernancePolicyService';
import { EnterpriseAuditService } from './enterpriseAuditService';

const STORAGE_KEY_BGT_POLICIES = 'cip_budget_validation_policies_v1';
const STORAGE_KEY_BGT_LEDGERS = 'cip_budget_control_ledgers_v1';
const STORAGE_KEY_BGT_COMMITMENTS = 'cip_budget_stage_commitments_v1';
const STORAGE_KEY_BGT_EXCEPTIONS = 'cip_budget_exception_approvals_v1';

export const INITIAL_BUDGET_POLICIES: BudgetValidationPolicyConfig[] = [
  {
    id: 'bgt-pol-co1-default',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'ALL',
    branchCode: 'ALL',
    department: 'ALL',
    costCenter: 'ALL',
    projectCode: 'ALL',
    financialYear: 'FY 2026-27',
    budgetPeriod: 'ANNUAL',
    applicableExpenseCategory: 'ALL',
    isEnabled: true,
    validationStage: 'PR_SUBMISSION',
    enforcementMode: 'BLOCK_WHEN_INSUFFICIENT',
    version: 1,
    effectiveFrom: '2026-04-01',
    status: 'ACTIVE',
    createdBy: 'Chief Financial Officer',
    approvedBy: 'Board Finance Committee',
    updatedAt: '2026-04-01T08:00:00Z',
  },
];

export const INITIAL_BUDGET_LEDGERS: BudgetControlLedgerRecord[] = [
  {
    id: 'bgt-ldg-pd-01',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Production',
    costCenter: 'CC-PROD-101',
    projectCode: 'PRJ-GEN',
    financialYear: 'FY 2026-27',
    budgetPeriod: 'ANNUAL',
    expenseCategory: 'OPEX',
    currency: 'INR',
    approvedBudget: 5000000, // ₹50,00,000
    revisedBudget: 5000000,
    committedAmount: 3000000, // ₹30,00,000
    actualExpenditure: 1000000, // ₹10,00,000
    pendingCommitments: 0,
    availableBudget: 1000000, // ₹10,00,000
    revisionHistory: [],
    updatedAt: '2026-04-01T08:00:00Z',
  },
  {
    id: 'bgt-ldg-pd-02',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Maintenance & Engineering',
    costCenter: 'CC-MAINT-202',
    projectCode: 'PRJ-CAPEX-26',
    financialYear: 'FY 2026-27',
    budgetPeriod: 'ANNUAL',
    expenseCategory: 'CAPEX',
    currency: 'INR',
    approvedBudget: 2500000,
    revisedBudget: 2500000,
    committedAmount: 600000,
    actualExpenditure: 400000,
    pendingCommitments: 0,
    availableBudget: 1500000,
    revisionHistory: [],
    updatedAt: '2026-04-01T08:00:00Z',
  },
  {
    id: 'bgt-ldg-hsr-01',
    companyId: 'co-kosh-01',
    branchId: 'br-hosur-02',
    department: 'Assembly',
    costCenter: 'CC-ASM-202',
    projectCode: 'PRJ-GEN',
    financialYear: 'FY 2026-27',
    budgetPeriod: 'ANNUAL',
    expenseCategory: 'OPEX',
    currency: 'INR',
    approvedBudget: 4000000,
    revisedBudget: 4000000,
    committedAmount: 1500000,
    actualExpenditure: 500000,
    pendingCommitments: 0,
    availableBudget: 2000000,
    revisionHistory: [],
    updatedAt: '2026-04-01T08:00:00Z',
  },
];

let memoryPolicies: BudgetValidationPolicyConfig[] | null = null;
let memoryLedgers: BudgetControlLedgerRecord[] | null = null;
let memoryCommitments: BudgetStageCommitmentEntry[] | null = null;
let memoryExceptions: BudgetExceptionApprovalRecord[] | null = null;

export const budgetControlService = {
  getPolicies(): BudgetValidationPolicyConfig[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_BGT_POLICIES);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    if (!memoryPolicies) {
      memoryPolicies = JSON.parse(JSON.stringify(INITIAL_BUDGET_POLICIES));
    }
    return memoryPolicies!;
  },

  savePolicies(policies: BudgetValidationPolicyConfig[]): void {
    memoryPolicies = JSON.parse(JSON.stringify(policies));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_BGT_POLICIES, JSON.stringify(policies));
      } catch {}
    }
  },

  getLedgers(): BudgetControlLedgerRecord[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_BGT_LEDGERS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    if (!memoryLedgers) {
      memoryLedgers = JSON.parse(JSON.stringify(INITIAL_BUDGET_LEDGERS));
    }
    return memoryLedgers!;
  },

  saveLedgers(ledgers: BudgetControlLedgerRecord[]): void {
    memoryLedgers = JSON.parse(JSON.stringify(ledgers));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_BGT_LEDGERS, JSON.stringify(ledgers));
      } catch {}
    }
  },

  getCommitments(): BudgetStageCommitmentEntry[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_BGT_COMMITMENTS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    if (!memoryCommitments) {
      memoryCommitments = [];
    }
    return memoryCommitments!;
  },

  saveCommitments(commitments: BudgetStageCommitmentEntry[]): void {
    memoryCommitments = JSON.parse(JSON.stringify(commitments));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_BGT_COMMITMENTS, JSON.stringify(commitments));
      } catch {}
    }
  },

  getExceptions(): BudgetExceptionApprovalRecord[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_BGT_EXCEPTIONS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    if (!memoryExceptions) {
      memoryExceptions = [];
    }
    return memoryExceptions!;
  },

  saveExceptions(exceptions: BudgetExceptionApprovalRecord[]): void {
    memoryExceptions = JSON.parse(JSON.stringify(exceptions));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_BGT_EXCEPTIONS, JSON.stringify(exceptions));
      } catch {}
    }
  },

  resetForTesting(): void {
    memoryPolicies = JSON.parse(JSON.stringify(INITIAL_BUDGET_POLICIES));
    memoryLedgers = JSON.parse(JSON.stringify(INITIAL_BUDGET_LEDGERS));
    memoryCommitments = [];
    memoryExceptions = [];
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_BGT_POLICIES);
      localStorage.removeItem(STORAGE_KEY_BGT_LEDGERS);
      localStorage.removeItem(STORAGE_KEY_BGT_COMMITMENTS);
      localStorage.removeItem(STORAGE_KEY_BGT_EXCEPTIONS);
    }
  },

  /**
   * Resolves effective Budget Validation Policy for Company, Branch, Department, Cost Center, and Date.
   * Part P: Historical versions remain immutable.
   */
  getEffectivePolicy(params: {
    companyId: string;
    branchId?: string;
    department?: string;
    costCenter?: string;
    expenseCategory?: string;
    transactionDate?: string;
  }): BudgetValidationPolicyConfig {
    const normCo = normalizeCompanyId(params.companyId);
    const normBr = params.branchId && params.branchId !== 'ALL' ? normalizeBranchId(params.branchId) : 'ALL';
    const txDate = params.transactionDate || new Date().toISOString().split('T')[0];

    const candidates = this.getPolicies()
      .filter((p) => {
        if (p.status !== 'ACTIVE') return false;
        if (normalizeCompanyId(p.companyId) !== normCo) return false;
        if (p.effectiveFrom && p.effectiveFrom > txDate) return false;
        if (p.effectiveUntil && p.effectiveUntil < txDate) return false;
        const brOk = p.branchId === 'ALL' || normalizeBranchId(p.branchId) === normBr;
        const ccOk = !params.costCenter || p.costCenter === 'ALL' || p.costCenter === params.costCenter;
        const deptOk =
          !params.department ||
          p.department === 'ALL' ||
          p.department.toLowerCase() === params.department.toLowerCase();
        return brOk && ccOk && deptOk;
      })
      .sort((a, b) => {
        const scoreA =
          (a.branchId !== 'ALL' ? 4 : 0) +
          (a.costCenter !== 'ALL' ? 2 : 0) +
          (a.department !== 'ALL' ? 1 : 0);
        const scoreB =
          (b.branchId !== 'ALL' ? 4 : 0) +
          (b.costCenter !== 'ALL' ? 2 : 0) +
          (b.department !== 'ALL' ? 1 : 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.version - a.version;
      });

    if (candidates.length > 0) {
      return JSON.parse(JSON.stringify(candidates[0]));
    }

    return {
      id: `bgt-pol-default-${normCo}`,
      companyId: normCo,
      companyCode: 'KOSH-HQ',
      branchId: normBr,
      branchCode: normBr,
      department: 'ALL',
      costCenter: 'ALL',
      projectCode: 'ALL',
      financialYear: 'FY 2026-27',
      budgetPeriod: 'ANNUAL',
      applicableExpenseCategory: 'ALL',
      isEnabled: true,
      validationStage: 'PR_SUBMISSION',
      enforcementMode: 'BLOCK_WHEN_INSUFFICIENT',
      version: 1,
      effectiveFrom: '2026-04-01',
      status: 'ACTIVE',
      createdBy: 'System',
      updatedAt: new Date().toISOString(),
    };
  },

  /**
   * Saves a new version of a Budget Validation Policy without overwriting historical versions.
   */
  savePolicyConfig(
    config: Omit<BudgetValidationPolicyConfig, 'id' | 'version' | 'status' | 'updatedAt'>,
    actorName: string = 'Finance Controller'
  ): BudgetValidationPolicyConfig {
    const policies = this.getPolicies();
    const normCo = normalizeCompanyId(config.companyId);
    const normBr = config.branchId === 'ALL' ? 'ALL' : normalizeBranchId(config.branchId);

    const existingIdx = policies.findIndex(
      (p) =>
        p.status === 'ACTIVE' &&
        normalizeCompanyId(p.companyId) === normCo &&
        (p.branchId === 'ALL' ? 'ALL' : normalizeBranchId(p.branchId)) === normBr &&
        p.costCenter === (config.costCenter || 'ALL')
    );

    let nextVersion = 1;
    if (existingIdx >= 0) {
      nextVersion = policies[existingIdx].version + 1;
      policies[existingIdx] = {
        ...policies[existingIdx],
        status: 'SUPERSEDED',
        effectiveUntil: config.effectiveFrom || new Date().toISOString().split('T')[0],
      };
    }

    const created: BudgetValidationPolicyConfig = {
      ...config,
      id: `bgt-pol-${normCo}-${normBr}-v${nextVersion}-${Date.now()}`,
      companyId: normCo,
      branchId: normBr,
      version: nextVersion,
      status: 'ACTIVE',
      createdBy: config.createdBy || actorName,
      updatedAt: new Date().toISOString(),
    };

    policies.unshift(created);
    this.savePolicies(policies);
    return created;
  },

  /**
   * Finds or initializes a Budget Control Ledger record for a given Cost Center / Branch / Company.
   */
  getOrCreateLedger(params: {
    companyId: string;
    branchId: string;
    department?: string;
    costCenter: string;
    projectCode?: string;
    financialYear?: string;
  }): BudgetControlLedgerRecord {
    const ledgers = this.getLedgers();
    const normCo = normalizeCompanyId(params.companyId);
    const normBr = normalizeBranchId(params.branchId);

    const match =
      ledgers.find(
        (l) =>
          normalizeCompanyId(l.companyId) === normCo &&
          normalizeBranchId(l.branchId) === normBr &&
          l.costCenter === params.costCenter
      ) ||
      ledgers.find((l) => l.costCenter === params.costCenter) ||
      ledgers[0];

    if (match) {
      match.availableBudget = Math.max(
        0,
        match.revisedBudget - match.committedAmount - match.actualExpenditure - match.pendingCommitments
      );
      return match;
    }

    const created: BudgetControlLedgerRecord = {
      id: `bgt-ldg-${Date.now()}`,
      companyId: normCo,
      branchId: normBr,
      department: params.department || 'General Operations',
      costCenter: params.costCenter || 'CC-PROD-101',
      projectCode: params.projectCode || 'PRJ-GEN',
      financialYear: params.financialYear || 'FY 2026-27',
      budgetPeriod: 'ANNUAL',
      expenseCategory: 'OPEX',
      currency: 'INR',
      approvedBudget: 5000000,
      revisedBudget: 5000000,
      committedAmount: 3000000,
      actualExpenditure: 1000000,
      pendingCommitments: 0,
      availableBudget: 1000000,
      revisionHistory: [],
      updatedAt: new Date().toISOString(),
    };
    ledgers.push(created);
    this.saveLedgers(ledgers);
    return created;
  },

  /**
   * Upserts a Budget Control Ledger record directly (for configuration or test seeding).
   */
  upsertLedger(
    ledger: Partial<BudgetControlLedgerRecord> & { costCenter: string; companyId: string; branchId: string }
  ): BudgetControlLedgerRecord {
    const ledgers = this.getLedgers();
    const normCo = normalizeCompanyId(ledger.companyId);
    const normBr = normalizeBranchId(ledger.branchId);
    const idx = ledgers.findIndex(
      (l) =>
        normalizeCompanyId(l.companyId) === normCo &&
        normalizeBranchId(l.branchId) === normBr &&
        l.costCenter === ledger.costCenter
    );

    const approvedBudget = ledger.approvedBudget ?? (idx >= 0 ? ledgers[idx].approvedBudget : 5000000);
    const revisedBudget = ledger.revisedBudget ?? (idx >= 0 ? ledgers[idx].revisedBudget : approvedBudget);
    const committedAmount = ledger.committedAmount ?? (idx >= 0 ? ledgers[idx].committedAmount : 0);
    const actualExpenditure = ledger.actualExpenditure ?? (idx >= 0 ? ledgers[idx].actualExpenditure : 0);
    const pendingCommitments = ledger.pendingCommitments ?? (idx >= 0 ? ledgers[idx].pendingCommitments : 0);
    const availableBudget = Math.max(
      0,
      revisedBudget - committedAmount - actualExpenditure - pendingCommitments
    );

    if (idx >= 0) {
      ledgers[idx] = {
        ...ledgers[idx],
        ...ledger,
        companyId: normCo,
        branchId: normBr,
        approvedBudget,
        revisedBudget,
        committedAmount,
        actualExpenditure,
        pendingCommitments,
        availableBudget,
        updatedAt: new Date().toISOString(),
      };
      this.saveLedgers(ledgers);
      return ledgers[idx];
    }

    const created: BudgetControlLedgerRecord = {
      id: ledger.id || `bgt-ldg-${Date.now()}`,
      companyId: normCo,
      branchId: normBr,
      department: ledger.department || 'Production',
      costCenter: ledger.costCenter,
      projectCode: ledger.projectCode || 'PRJ-GEN',
      financialYear: ledger.financialYear || 'FY 2026-27',
      budgetPeriod: ledger.budgetPeriod || 'ANNUAL',
      expenseCategory: ledger.expenseCategory || 'OPEX',
      currency: ledger.currency || 'INR',
      approvedBudget,
      revisedBudget,
      committedAmount,
      actualExpenditure,
      pendingCommitments,
      availableBudget,
      revisionHistory: ledger.revisionHistory || [],
      updatedAt: new Date().toISOString(),
    };
    ledgers.push(created);
    this.saveLedgers(ledgers);
    return created;
  },

  /**
   * Authorized Budget Revision (explicit Finance action to revise budget allocation).
   */
  reviseBudgetAllocation(params: {
    companyId: string;
    branchId: string;
    costCenter: string;
    newRevisedBudget: number;
    reason: string;
    approvedBy: string;
  }): BudgetControlLedgerRecord {
    if (!params.reason || !params.reason.trim()) {
      throw new Error('Budget revision reason is mandatory.');
    }
    const ledgers = this.getLedgers();
    const normCo = normalizeCompanyId(params.companyId);
    const normBr = normalizeBranchId(params.branchId);
    const target = ledgers.find(
      (l) =>
        normalizeCompanyId(l.companyId) === normCo &&
        normalizeBranchId(l.branchId) === normBr &&
        l.costCenter === params.costCenter
    );
    if (!target) {
      throw new Error(`Budget ledger not found for cost center ${params.costCenter}.`);
    }

    const prevRevised = target.revisedBudget;
    target.revisedBudget = Number(params.newRevisedBudget);
    target.availableBudget = Math.max(
      0,
      target.revisedBudget - target.committedAmount - target.actualExpenditure - target.pendingCommitments
    );
    target.revisionHistory.push({
      revisionId: `rev-${Date.now()}`,
      previousRevisedBudget: prevRevised,
      newRevisedBudget: target.revisedBudget,
      reason: params.reason.trim(),
      approvedBy: params.approvedBy,
      timestamp: new Date().toISOString(),
    });
    target.updatedAt = new Date().toISOString();

    this.saveLedgers(ledgers);
    return target;
  },

  /**
   * L3, L4, L5, L6. Evaluates Budget Availability at any procurement stage
   * (PR_SUBMISSION, PR_APPROVAL, RFQ_AWARD, PO_CREATION, PO_AMENDMENT).
   * If a commitment already exists on the same sourceChainId (e.g. moving from PR -> RFQ -> PO),
   * only the incremental delta above the existing chain commitment is tested against availableBudget
   * so commitments are NEVER double-counted!
   */
  validateBudgetAtStage(params: {
    transactionId: string;
    transactionNumber: string;
    sourceChainId?: string; // e.g. prNumber or prId shared across PR -> RFQ -> PO
    stage: BudgetValidationStage;
    companyId: string;
    branchId: string;
    department: string;
    costCenter: string;
    projectCode?: string;
    financialYear?: string;
    expenseCategory?: string;
    proposedAmount: number;
    validatedBy: string;
    transactionDate?: string;
  }): BudgetValidationSnapshot {
    const normCo = normalizeCompanyId(params.companyId);
    const normBr = normalizeBranchId(params.branchId);

    const policy = this.getEffectivePolicy({
      companyId: normCo,
      branchId: normBr,
      department: params.department,
      costCenter: params.costCenter,
      expenseCategory: params.expenseCategory,
      transactionDate: params.transactionDate,
    });

    const ledger = this.getOrCreateLedger({
      companyId: normCo,
      branchId: normBr,
      department: params.department,
      costCenter: params.costCenter,
      projectCode: params.projectCode,
      financialYear: params.financialYear,
    });

    // Check if there is already an active commitment on this procurement chain (PR -> RFQ -> PO)
    const chainId = params.sourceChainId || params.transactionNumber || params.transactionId;
    const existingChainCommitment = this.getCommitments().find(
      (c) => c.sourceChainId === chainId && c.currentStage !== 'RELEASED'
    );
    const alreadyCommittedForThisChain = existingChainCommitment
      ? existingChainCommitment.activeCommittedAmount
      : 0;

    // Effective uncommitted available budget before applying this transaction's full amount
    const effectiveCommittedExcludingSelf = Math.max(
      0,
      ledger.committedAmount - alreadyCommittedForThisChain
    );
    const availableBudget = Math.max(
      0,
      ledger.revisedBudget -
        effectiveCommittedExcludingSelf -
        ledger.actualExpenditure -
        ledger.pendingCommitments
    );

    const proposedPrAmount = Number(params.proposedAmount) || 0;
    const remainingBudgetAfterPr = Math.max(0, availableBudget - proposedPrAmount);
    const budgetShortfall = Math.max(0, proposedPrAmount - availableBudget);
    const isSufficient = budgetShortfall <= 0;

    // Check if an approved Budget Exception exists for this transaction or chain
    const approvedException = this.getExceptions().find(
      (e) =>
        (e.transactionId === params.transactionId ||
          e.transactionNumber === params.transactionNumber ||
          e.transactionNumber === chainId) &&
        e.status === 'APPROVED'
    );

    let overallOutcome: BudgetValidationSnapshot['overallOutcome'] = 'SUFFICIENT';
    let canProceed = true;
    let requiresExceptionApproval = false;

    if (!policy.isEnabled || policy.enforcementMode === 'NO_VALIDATION') {
      overallOutcome = 'VALIDATION_DISABLED';
      canProceed = true;
    } else if (isSufficient) {
      overallOutcome = 'SUFFICIENT';
      canProceed = true;
    } else {
      switch (policy.enforcementMode) {
        case 'WARNING_ONLY':
          overallOutcome = 'WARNING_SHORTFALL';
          canProceed = true;
          break;
        case 'BLOCK_WHEN_INSUFFICIENT':
          overallOutcome = 'BLOCKED_INSUFFICIENT_BUDGET';
          canProceed = false;
          break;
        case 'ALLOW_WITH_EXCEPTION_APPROVAL':
          if (approvedException) {
            overallOutcome = 'EXCEPTION_APPROVED';
            canProceed = true;
          } else {
            overallOutcome = 'PENDING_EXCEPTION_APPROVAL';
            canProceed = false;
            requiresExceptionApproval = true;
          }
          break;
      }
    }

    return {
      snapshotId: `bgt-snap-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      stage: params.stage,
      validatedAt: new Date().toISOString(),
      validatedBy: params.validatedBy,
      companyId: normCo,
      branchId: normBr,
      department: params.department || ledger.department,
      costCenter: params.costCenter || ledger.costCenter,
      projectCode: params.projectCode || ledger.projectCode,
      financialYear: params.financialYear || ledger.financialYear,
      budgetPeriod: ledger.budgetPeriod,
      expenseCategory: params.expenseCategory || ledger.expenseCategory,
      policyId: policy.id,
      policyVersion: policy.version,
      policyEffectiveFrom: policy.effectiveFrom,
      isEnabled: policy.isEnabled,
      enforcementMode: policy.enforcementMode,
      approvedBudget: ledger.approvedBudget,
      revisedBudget: ledger.revisedBudget,
      committedAmount: effectiveCommittedExcludingSelf,
      actualExpenditure: ledger.actualExpenditure,
      pendingCommitments: ledger.pendingCommitments,
      availableBudget,
      proposedPrAmount,
      remainingBudgetAfterPr,
      budgetShortfall,
      isSufficient,
      overallOutcome,
      canProceed,
      requiresExceptionApproval,
      exceptionReference: approvedException?.exceptionReference,
      exceptionRecord: approvedException,
    };
  },

  /**
   * L5. Requests a Budget Exception Approval with mandatory justification.
   */
  requestBudgetException(params: {
    transactionType: 'PR' | 'RFQ_AWARD' | 'PO';
    transactionId: string;
    transactionNumber: string;
    companyId: string;
    branchId: string;
    department: string;
    costCenter: string;
    proposedAmount: number;
    availableBudgetAtRequest: number;
    shortfallAmount: number;
    justification: string;
    requestedById: string;
    requestedByName: string;
  }): BudgetExceptionApprovalRecord {
    if (!params.justification || !params.justification.trim()) {
      throw new Error('Mandatory budget exception justification is required.');
    }
    const exceptions = this.getExceptions();
    const count = exceptions.length + 1;
    const record: BudgetExceptionApprovalRecord = {
      id: `bgt-exc-${Date.now()}`,
      exceptionReference: `BGT-EXC-2026-${String(count).padStart(4, '0')}`,
      transactionType: params.transactionType,
      transactionId: params.transactionId,
      transactionNumber: params.transactionNumber,
      companyId: normalizeCompanyId(params.companyId),
      branchId: normalizeBranchId(params.branchId),
      department: params.department,
      costCenter: params.costCenter,
      proposedAmount: params.proposedAmount,
      availableBudgetAtRequest: params.availableBudgetAtRequest,
      shortfallAmount: params.shortfallAmount,
      justification: params.justification.trim(),
      requestedById: params.requestedById,
      requestedByName: params.requestedByName,
      requestedAt: new Date().toISOString(),
      routingLevel:
        params.shortfallAmount > 500000 ? 'CFO_MANAGEMENT_COMMITTEE' : 'FINANCE_CONTROLLER',
      status: 'PENDING_APPROVAL',
    };
    exceptions.unshift(record);
    this.saveExceptions(exceptions);
    return record;
  },

  /**
   * L5. Approves a Budget Exception Request.
   * CRITICAL REQUIREMENT: Approving a budget exception MUST NOT automatically increase the approved or revised budget!
   */
  approveBudgetException(params: {
    exceptionId?: string;
    transactionId?: string;
    transactionNumber?: string;
    approvedById: string;
    approvedByName: string;
    approvalRemarks: string;
  }): BudgetExceptionApprovalRecord {
    const exceptions = this.getExceptions();
    const target = exceptions.find(
      (e) =>
        (params.exceptionId && e.id === params.exceptionId) ||
        (params.transactionId && e.transactionId === params.transactionId) ||
        (params.transactionNumber && e.transactionNumber === params.transactionNumber)
    );
    if (!target) {
      throw new Error('Budget exception request not found.');
    }
    if (target.requestedById === params.approvedById) {
      throw new Error('Maker-Checker Violation: Requester cannot approve their own budget exception.');
    }

    target.status = 'APPROVED';
    target.approvedById = params.approvedById;
    target.approvedByName = params.approvedByName;
    target.approvedAt = new Date().toISOString();
    target.approvalRemarks = params.approvalRemarks || 'Authorized budget exception approved.';
    this.saveExceptions(exceptions);

    EnterpriseAuditService.logEvent({
      companyId: target.companyId,
      branchId: target.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: target.transactionId,
      eventType: 'BUDGET_EXCEPTION_APPROVED',
      eventDescription: `Approved Budget Exception ${target.exceptionReference} for ${target.transactionNumber} (Shortfall: ₹${target.shortfallAmount}) without increasing master budget`,
      changedByUserId: params.approvedById,
      changedByName: params.approvedByName,
      changeReason: target.approvalRemarks,
      newValue: target,
    });

    return target;
  },

  /**
   * L6. Reconciles commitment across procurement stages (PR_SUBMISSION -> PR_APPROVAL -> RFQ_AWARD -> PO_CREATION -> PO_AMENDMENT)
   * using a unified sourceChainId (e.g. PR Number) so commitments are NEVER double-counted!
   */
  recordOrReconcileCommitment(params: {
    sourceChainId: string; // e.g. 'PR-2026-0001'
    companyId: string;
    branchId: string;
    costCenter: string;
    stage: BudgetValidationStage | 'RELEASED';
    documentNumber: string;
    newCommitmentAmount: number;
    actorName: string;
    prId?: string;
    prNumber?: string;
    rfqId?: string;
    rfqNumber?: string;
    poId?: string;
    poNumber?: string;
  }): {
    commitmentEntry: BudgetStageCommitmentEntry;
    ledger: BudgetControlLedgerRecord;
    deltaApplied: number;
  } {
    const ledgers = this.getLedgers();
    const normCo = normalizeCompanyId(params.companyId);
    const normBr = normalizeBranchId(params.branchId);
    let ledger = ledgers.find(
      (l) =>
        normalizeCompanyId(l.companyId) === normCo &&
        normalizeBranchId(l.branchId) === normBr &&
        l.costCenter === params.costCenter
    );
    if (!ledger) {
      ledger = this.getOrCreateLedger({
        companyId: normCo,
        branchId: normBr,
        costCenter: params.costCenter,
      });
    }

    const commitments = this.getCommitments();
    let entry = commitments.find((c) => c.sourceChainId === params.sourceChainId);

    const stageToStatusMap: Record<
      BudgetValidationStage | 'RELEASED',
      BudgetStageCommitmentEntry['currentStage']
    > = {
      PR_SUBMISSION: 'PR_SUBMITTED',
      PR_APPROVAL: 'PR_APPROVED',
      RFQ_AWARD: 'RFQ_AWARDED',
      PO_CREATION: 'PO_CREATED',
      PO_AMENDMENT: 'PO_AMENDED',
      RELEASED: 'RELEASED',
    };

    const targetAmount = params.stage === 'RELEASED' ? 0 : Math.max(0, Number(params.newCommitmentAmount));
    const previousAmount = entry ? entry.activeCommittedAmount : 0;
    const deltaApplied = targetAmount - previousAmount;

    if (!entry) {
      entry = {
        id: `cmt-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        budgetLedgerId: ledger.id,
        sourceChainId: params.sourceChainId,
        prId: params.prId,
        prNumber: params.prNumber,
        rfqId: params.rfqId,
        rfqNumber: params.rfqNumber,
        poId: params.poId,
        poNumber: params.poNumber,
        currentStage: stageToStatusMap[params.stage],
        activeCommittedAmount: targetAmount,
        stageHistory: [
          {
            stage: params.stage,
            documentNumber: params.documentNumber,
            previousAmount: 0,
            newAmount: targetAmount,
            deltaAppliedToLedger: deltaApplied,
            timestamp: new Date().toISOString(),
            actorName: params.actorName,
          },
        ],
        updatedAt: new Date().toISOString(),
      };
      commitments.unshift(entry);
    } else {
      entry.currentStage = stageToStatusMap[params.stage];
      entry.activeCommittedAmount = targetAmount;
      if (params.prId) entry.prId = params.prId;
      if (params.prNumber) entry.prNumber = params.prNumber;
      if (params.rfqId) entry.rfqId = params.rfqId;
      if (params.rfqNumber) entry.rfqNumber = params.rfqNumber;
      if (params.poId) entry.poId = params.poId;
      if (params.poNumber) entry.poNumber = params.poNumber;
      entry.stageHistory.push({
        stage: params.stage,
        documentNumber: params.documentNumber,
        previousAmount,
        newAmount: targetAmount,
        deltaAppliedToLedger: deltaApplied,
        timestamp: new Date().toISOString(),
        actorName: params.actorName,
      });
      entry.updatedAt = new Date().toISOString();
    }

    // Apply only the delta to the ledger so PR -> RFQ -> PO never double counts!
    const allLedgers = this.getLedgers();
    const lIdx = allLedgers.findIndex((l) => l.id === ledger!.id);
    if (lIdx >= 0) {
      allLedgers[lIdx].committedAmount = Math.max(
        0,
        allLedgers[lIdx].committedAmount + deltaApplied
      );
      allLedgers[lIdx].availableBudget = Math.max(
        0,
        allLedgers[lIdx].revisedBudget -
          allLedgers[lIdx].committedAmount -
          allLedgers[lIdx].actualExpenditure -
          allLedgers[lIdx].pendingCommitments
      );
      allLedgers[lIdx].updatedAt = new Date().toISOString();
      ledger = allLedgers[lIdx];
      this.saveLedgers(allLedgers);
    }

    this.saveCommitments(commitments);
    return { commitmentEntry: entry, ledger: ledger!, deltaApplied };
  },
};
