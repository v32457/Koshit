/**
 * CIPPLATFORM — MASTER PURCHASE REQUISITION GOVERNANCE POLICY ENGINE
 * Authoritative Multi-Company & Multi-Branch Policy Resolution, Inheritance,
 * Maker-Checker Policy Administration, Effective-Date Snapshots, Multi-Company/Branch Isolation,
 * Multi-Currency Budget Reconciliation, Delegation & SLA Escalation, Policy Simulation Sandbox,
 * Failure Recovery Queue, and PR Numbering & Financial Period Controls (Requirements A–Q).
 */

import { INITIAL_COMPANIES, INITIAL_BRANCHES } from '../data/seedData';
import { User } from '../types';
import {
  PurchaseRequisitionHeader,
  PurchaseRequisitionLine,
  PRLineLockStatus,
  PRStatus,
  PRType,
} from '../types/purchaseRequisition';
import {
  PrGovernancePolicyConfig,
  PrPolicyVersionRecord,
  PrGovernedActionType,
  PrActionValidationResult,
  PrApprovalMatrixTier,
  PolicyAdminPermission,
  PrApprovalDelegationRecord,
  PrApprovalEscalationRecord,
  PrReconciliationQueueItem,
  PrFailureOperationType,
  PrPolicySimulationInput,
  PrPolicySimulationResult,
} from '../types/prGovernancePolicy';
import { EnterpriseAuditService } from './enterpriseAuditService';

const STORAGE_KEY_PR_POLICIES = 'kosh_pr_governance_policies_v1';
const STORAGE_KEY_PR_POLICY_HISTORY = 'kosh_pr_policy_versions_v1';
const STORAGE_KEY_PR_DELEGATIONS = 'kosh_pr_approval_delegations_v1';
const STORAGE_KEY_PR_ESCALATIONS = 'kosh_pr_approval_escalations_v1';
const STORAGE_KEY_PR_RECON_QUEUE = 'kosh_pr_reconciliation_queue_v1';
const STORAGE_KEY_PR_IDEMPOTENCY = 'kosh_pr_idempotency_keys_v1';

/**
 * Authoritative Reference Exchange Rate Table (Base Company Currency: INR)
 * Requirement F: Explicit, traceable exchange rates with reference IDs and effective dates.
 */
export const AUTHORITATIVE_FX_RATES: Record<
  string,
  { rateToInr: number; ref: string; effectiveDate: string }
> = {
  INR: { rateToInr: 1.0, ref: 'FX-BASE-INR-1.00', effectiveDate: '2026-01-01' },
  USD: { rateToInr: 84.5, ref: 'FX-RBI-2026-USD-84.50', effectiveDate: '2026-11-01' },
  EUR: { rateToInr: 91.2, ref: 'FX-RBI-2026-EUR-91.20', effectiveDate: '2026-11-01' },
  GBP: { rateToInr: 108.4, ref: 'FX-RBI-2026-GBP-108.40', effectiveDate: '2026-11-01' },
  AED: { rateToInr: 23.01, ref: 'FX-RBI-2026-AED-23.01', effectiveDate: '2026-11-01' },
  JPY: { rateToInr: 0.56, ref: 'FX-RBI-2026-JPY-0.56', effectiveDate: '2026-11-01' },
};

/**
 * Normalizes legacy company aliases ('comp-1', 'KOSH-HQ') to canonical company IDs
 * while keeping distinct companies ('co-kosh-01', 'co-kosh-02', 'co-kosh-03', 'co-kosh-04', or custom IDs) strictly isolated.
 */
export function normalizeCompanyId(companyId?: string): string {
  if (!companyId) return 'co-kosh-01';
  const trimmed = companyId.trim();
  if (trimmed === 'comp-1' || trimmed === 'org-kosh-01' || trimmed === 'KOSH-HQ' || trimmed === 'KOSH_INNOVATIONS') {
    return 'co-kosh-01';
  }
  if (trimmed === 'org-kosh-02' || trimmed === 'KOSH-SOUTH' || trimmed === 'KOSH-AUTO' || trimmed === 'KOSH_AUTO') {
    return 'co-kosh-02';
  }
  if (trimmed === 'org-kosh-03' || trimmed === 'KOSH-WEST' || trimmed === 'KOSH-TOOL' || trimmed === 'KOSH_TOOL') {
    return 'co-kosh-03';
  }
  if (trimmed === 'org-kosh-04' || trimmed === 'KOSH-NORTH') {
    return 'co-kosh-04';
  }
  return trimmed;
}

/**
 * Normalizes legacy branch aliases ('branch-001', '001') to canonical branch IDs
 * while preserving 'ALL' or explicit branch IDs.
 */
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

/**
 * Restricts visibility of the Active PR Governance Policy ON/OFF toggle banner
 * exclusively to Enterprise Admin roles (PLATFORM_ADMIN and ORG_ADMIN).
 */
export function canViewPrGovernancePolicyStrip(
  userOrRole?: Pick<User, 'role'> | string | null
): boolean {
  if (!userOrRole) return false;
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
  return role === 'PLATFORM_ADMIN' || role === 'ORG_ADMIN';
}

export const DEFAULT_APPROVAL_MATRIX: PrApprovalMatrixTier[] = [
  {
    id: 'tier-l1',
    levelNumber: 1,
    levelName: 'Level 1 — Reporting / Department Manager',
    minAmount: 0,
    maxAmount: 100000,
    currency: 'INR',
    approverRole: 'DEPARTMENT_HEAD',
    branchScoped: true,
    departmentScoped: true,
    slaHours: 24,
    alternateApproverRole: 'PROCUREMENT_MANAGER',
  },
  {
    id: 'tier-l2',
    levelNumber: 2,
    levelName: 'Level 2 — Plant / Branch Head & Procurement Manager',
    minAmount: 100001,
    maxAmount: 1000000,
    currency: 'INR',
    approverRole: 'PROCUREMENT_MANAGER',
    branchScoped: true,
    departmentScoped: false,
    slaHours: 48,
    alternateApproverRole: 'ORG_ADMIN',
  },
  {
    id: 'tier-l3',
    levelNumber: 3,
    levelName: 'Level 3 — Executive / Finance Director',
    minAmount: 1000001,
    maxAmount: null,
    currency: 'INR',
    approverRole: 'ORG_ADMIN',
    branchScoped: false,
    departmentScoped: false,
    slaHours: 72,
    alternateApproverRole: 'PLATFORM_ADMIN',
  },
];

export function createSystemDefaultPolicy(
  companyId: string,
  branchId: string = 'ALL'
): PrGovernancePolicyConfig {
  const normCompanyId = normalizeCompanyId(companyId);
  const normBranchId = normalizeBranchId(branchId);
  const companyObj = INITIAL_COMPANIES.find((c) => c.id === normCompanyId);
  const branchObj =
    normBranchId !== 'ALL' ? INITIAL_BRANCHES.find((b) => b.id === normBranchId) : undefined;
  const compCode = companyObj?.code || normCompanyId.toUpperCase();

  return {
    id:
      normBranchId === 'ALL'
        ? `pr-pol-${normCompanyId}`
        : `pr-pol-${normCompanyId}-${normBranchId}`,
    companyId: normCompanyId,
    companyCode: compCode,
    companyName: companyObj?.name || `Company ${normCompanyId}`,
    branchId: normBranchId,
    branchCode:
      normBranchId === 'ALL'
        ? 'ALL'
        : branchObj?.portalBranchCode || branchObj?.code || normBranchId,
    branchName:
      normBranchId === 'ALL'
        ? 'All Branches (Company Default)'
        : branchObj?.name || `Branch ${normBranchId}`,
    policyScope: normBranchId === 'ALL' ? 'COMPANY' : 'BRANCH',
    isInheritedFromCompany: normBranchId !== 'ALL',
    allowBranchOverride: true,
    centrallyControlledFields: ['prAuditTrailEnabled', 'budgetValidationEnabled'],
    policyOwner: 'Chief Procurement & Governance Officer',
    effectiveStatus: 'ACTIVE',
    policyVersion: 'v1.0',
    effectiveFrom: '2026-01-01',
    effectiveUntil: undefined,
    createdBy: 'Rajesh Sharma (Platform Admin)',
    createdByUserId: 'usr-admin-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    modifiedBy: 'Rajesh Sharma (Platform Admin)',
    modifiedByUserId: 'usr-admin-01',
    modifiedAt: '2026-11-01T08:00:00.000Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
    approvedByUserId: 'usr-checker-01',
    approvedAt: '2026-11-01T08:05:00.000Z',
    activatedBy: 'Vikramaditya Rao (Org Admin)',
    activatedByUserId: 'usr-checker-01',
    activatedAt: '2026-11-01T08:05:00.000Z',
    requireMakerCheckerApproval: false,
    remarks:
      normBranchId === 'ALL'
        ? 'Standard enterprise Purchase Requisition governance policy.'
        : 'Inherited from Company Default Policy.',

    activation: {
      prModuleEnabled: true,
      manualPrCreationEnabled: true,
      mrpPrCreationEnabled: true,
      repairPrEnabled: true,
      maintenancePrEnabled: true,
      capexAssetPrEnabled: false,
      expensePrEnabled: true,
      allowSameChargeAtHeaderAndLine: false,
      taxInclusivePricingSupported: true,
      includeTaxInBudgetBasis: true,
      prEditingEnabled: true,
      prSubmissionEnabled: true,
      prApprovalEnabled: true,
      prReturnForCorrectionEnabled: true,
      prWithdrawalEnabled: true,
      prCancellationEnabled: true,
      prShortCloseEnabled: true,
      rfqConversionEnabled: true,
      poConversionEnabled: true,
      partialConversionEnabled: true,
      expectedDeliveryDateEnabled: true,
      expectedDeliveryDateMandatory: false,
      budgetValidationEnabled: true,
      mandatoryRemarksEnabled: true,
      prAuditTrailEnabled: true,
    },

    approval: {
      enableApprovalWorkflow: true,
      approvalLevels: 2,
      approvalMatrix: JSON.parse(JSON.stringify(DEFAULT_APPROVAL_MATRIX)),
      branchLevelApprovers: true,
      departmentLevelApprovers: true,
      amountBasedApproval: true,
      managerL1Approval: true,
      additionalApprovalLevels: true,
      approvalEscalation: true,
      escalationAfterHours: 48,
      approvalDelegation: true,
      approvalNotifications: true,
      mandatoryApprovalRemarks: true,
      returnForCorrection: true,
      mandatoryReturnReason: true,
      resubmissionAllowed: true,
      retainSamePrNumberOnResubmit: true,
      withdrawalBeforeApproval: true,
      allowTerminalReject: true,
      requireDelegationApproval: true,
      pendingApprovalReminderHours: 12,
    },

    editingAndLocking: {
      draftPrEditing: true,
      pendingApprovalEditing: false,
      returnedPrEditing: true,
      approvedPrHeaderLock: true,
      approvedPrLineLock: true,
      convertedLineLock: true,
      unconvertedLineEditing: true,
      requireReapprovalOnApprovedLineEdit: true,
      shortClosedPrLock: true,
      cancelledPrLock: true,
      rejectedPrLock: true,
      withdrawnPrLock: true,
      allowApprovedLineAmendment: true,
      amendmentPriceIncreaseTolerancePercent: 5,
    },

    partialConversion: {
      enablePartialRfqConversion: true,
      enablePartialPoConversion: true,
      allowMultipleRfqReferences: true,
      allowMultiplePoReferences: true,
      convertedQuantityTracking: true,
      remainingQuantityTracking: true,
      lineLevelConversionLock: true,
      conversionApprovalValidation: true,
    },

    shortClose: {
      enableShortClose: true,
      applicablePrTypes: ['MANUAL', 'MRP', 'REPAIR', 'MAINTENANCE', 'EXPENSE'],
      applicablePrStatuses: [
        'APPROVED_PENDING_BUYER',
        'PENDING_BUYER_CONFIGURATION',
        'COMPLETED',
      ],
      authorizedRoles: [
        'PLATFORM_ADMIN',
        'ORG_ADMIN',
        'GLOBAL_ITEM_ADMIN',
        'BRANCH_COORDINATOR',
        'BRANCH_ADMIN',
        'PROCUREMENT_MANAGER',
        'DEPARTMENT_HEAD',
        'BUYER',
      ],
      mandatoryReason: true,
      mandatoryRemarks: true,
      budgetReconciliationRequired: true,
      notificationRequired: true,
      allowLineLevelShortClose: true,
      requireApprovalForShortClose: false,
    },

    cancellation: {
      enablePrCancellation: true,
      applicablePrTypes: ['MANUAL', 'MRP', 'REPAIR', 'MAINTENANCE', 'EXPENSE'],
      applicablePrStatuses: [
        'DRAFT',
        'RETURNED_FOR_CORRECTION',
        'PENDING_MANAGER_APPROVAL',
        'PENDING_SUBSEQUENT_APPROVAL',
        'APPROVED_PENDING_BUYER',
      ],
      authorizedRoles: [
        'PLATFORM_ADMIN',
        'ORG_ADMIN',
        'GLOBAL_ITEM_ADMIN',
        'BRANCH_COORDINATOR',
        'BRANCH_ADMIN',
        'PROCUREMENT_MANAGER',
        'DEPARTMENT_HEAD',
        'REQUESTER',
      ],
      mandatoryCancellationReason: true,
      mandatoryCancellationRemarks: true,
      budgetReconciliationRequired: true,
      notificationRequired: true,
      allowLineLevelCancellation: true,
      requireAdditionalApproval: false,
    },

    budget: {
      enableBudgetValidation: true,
      mandatoryBudgetCheck: true,
      budgetReservationOnApproval: true,
      autoUncommittedBudgetRelease: true,
      budgetReleaseOnShortClose: true,
      budgetReleaseOnCancellation: true,
      preservePoCommitments: true,
      preventDuplicateBudgetRelease: true,
      budgetReconciliationAudit: true,
      companyReportingCurrency: 'INR',
      enforceHistoricalExchangeRateOnRelease: true,
    },

    rfqPoIntegration: {
      enablePrToRfqConversion: true,
      enablePrToPoConversion: true,
      enablePartialRfqConversion: true,
      enablePartialPoConversion: true,
      validateApprovedPr: true,
      validateEligiblePrLines: true,
      validateRemainingQuantity: true,
      validateBudget: true,
      preventDuplicateConversion: true,
      preserveConversionReferences: true,
    },

    notifications: {
      prSubmissionNotification: true,
      approvalNotification: true,
      returnForCorrectionNotification: true,
      resubmissionNotification: true,
      shortCloseNotification: true,
      cancellationNotification: true,
      rfqConversionNotification: true,
      poConversionNotification: true,
      budgetReleaseNotification: true,
      buyerAssignmentNotification: true,
      enabledChannels: ['EMAIL', 'WHATSAPP', 'NOTIFICATION_CENTRE'],
    },

    auditAndSecurity: {
      mandatoryAuditTrail: true,
      prStatusChangeAudit: true,
      lineLevelChangeAudit: true,
      approvalHistory: true,
      conversionHistory: true,
      shortCloseHistory: true,
      cancellationHistory: true,
      budgetReleaseHistory: true,
      configurationChangeHistory: true,
    },

    multiBranchProcurement: {
      branchSpecificPrCreation: true,
      branchSpecificApprovalMatrix: true,
      crossBranchProcurementAuthorized: false,
      centralizedBuyerAssignment: true,
      centralizedProcurementVisibility: true,
      designatedCentralBuyerIds: ['usr-admin-01', 'usr-buyer-central-01'],
      branchBudgetValidation: true,
      branchLevelShortClosePermitted: true,
      branchLevelCancellationPermitted: true,
      branchSpecificNumbering: false,
    },

    duplicatePrevention: {
      enableDuplicateDetection: true,
      checkSameCompany: true,
      checkSameBranch: true,
      checkSameRequester: false,
      checkSameItem: true,
      checkSamePurpose: false,
      checkSameRequirementDate: false,
      checkSimilarQuantity: true,
      quantityVarianceTolerancePercent: 20,
      warningLevel: 'WARNING_WITH_JUSTIFICATION',
      requireJustificationToProceed: true,
      allowOverride: true,
      requireCheckerApprovalForOverride: false,
      authorizedOverrideRoles: [
        'PLATFORM_ADMIN',
        'ORG_ADMIN',
        'BRANCH_ADMIN',
        'PROCUREMENT_MANAGER',
        'DEPARTMENT_HEAD',
        'ITEM_CHECKER',
      ],
      checkerApprovalRoles: [
        'PLATFORM_ADMIN',
        'ORG_ADMIN',
        'BRANCH_ADMIN',
        'PROCUREMENT_MANAGER',
        'DEPARTMENT_HEAD',
        'ITEM_CHECKER',
      ],
    },

    attachmentGovernance: {
      allowHeaderAttachments: true,
      allowLineAttachments: true,
      allowedFileTypes: ['PDF', 'PNG', 'JPG', 'JPEG', 'DOCX', 'XLSX', 'CSV', 'DWG', 'STEP'],
      maxFileSizeMb: 25,
      preserveOnReturnAndResubmit: true,
      retainHistoricalVersionsOnApproved: true,
      lockDeletionOnConvertedTransactions: true,
      auditUploadAndDownload: true,
    },

    numberingAndPeriod: {
      numberingScope: 'COMPANY_AND_FY',
      prPrefix: 'PR',
      includeCompanyCode: false,
      includeBranchCode: false,
      includeFinancialYear: true,
      activeFinancialYear: '2026',
      sequenceDigits: 4,
      nextSequenceNumber: 10,
      sequenceLockedAfterTransactions: true,
      openPeriodStart: '2026-01-01',
      openPeriodEnd: '2027-03-31',
      closedFinancialPeriods: ['2024-25', '2025-Q1', '2025-Q2'],
      restrictClosedPeriodTransactions: true,
      allowBackdatedPr: false,
      maxBackdateDays: 0,
    },
  };
}

/**
 * Seed initial Company & Branch PR Governance Policies across all 4 Kosh companies.
 */
export const INITIAL_PR_GOVERNANCE_POLICIES: PrGovernancePolicyConfig[] = [
  (() => {
    const p = createSystemDefaultPolicy('co-kosh-01', 'ALL');
    p.activation.expectedDeliveryDateEnabled = false;
    p.activation.expectedDeliveryDateMandatory = false;
    p.allowBranchOverride = true;
    return p;
  })(),
  {
    ...createSystemDefaultPolicy('co-kosh-02', 'ALL'),
    policyOwner: 'Southern Region Procurement Head',
    remarks: 'Kosh South Industries default PR governance policy.',
  },
  {
    ...createSystemDefaultPolicy('co-kosh-03', 'ALL'),
    policyOwner: 'Western Polymer Division Governance Lead',
    remarks: 'Kosh West Polymer Works default PR governance policy.',
  },
  {
    ...createSystemDefaultPolicy('co-kosh-04', 'ALL'),
    policyOwner: 'Northern Extrusions Operations Director',
    remarks: 'Kosh North Extrusions default PR governance policy.',
  },
];

/**
 * Requirement K: Policy Dependency Validation Engine
 * Enforces mandatory business rules and cross-setting dependencies on a policy object.
 */
export function validateAndNormalizePolicy(
  raw: PrGovernancePolicyConfig
): { normalized: PrGovernancePolicyConfig; warnings: string[] } {
  const warnings: string[] = [];
  const copy: PrGovernancePolicyConfig = JSON.parse(JSON.stringify(raw));

  // Ensure nested enterprise objects exist even on older policy snapshots
  const sysDefault = createSystemDefaultPolicy(copy.companyId || 'co-kosh-01', copy.branchId || 'ALL');
  if (!copy.activation) {
    copy.activation = JSON.parse(JSON.stringify(sysDefault.activation));
  }
  if (!copy.editingAndLocking) {
    copy.editingAndLocking = JSON.parse(JSON.stringify(sysDefault.editingAndLocking));
  }
  if (!copy.approval) {
    copy.approval = JSON.parse(JSON.stringify(sysDefault.approval));
  }
  if (!copy.partialConversion) {
    copy.partialConversion = JSON.parse(JSON.stringify(sysDefault.partialConversion));
  }
  if (!copy.rfqPoIntegration) {
    copy.rfqPoIntegration = JSON.parse(JSON.stringify(sysDefault.rfqPoIntegration));
  }
  if (!copy.shortClose) {
    copy.shortClose = JSON.parse(JSON.stringify(sysDefault.shortClose));
  }
  if (!copy.cancellation) {
    copy.cancellation = JSON.parse(JSON.stringify(sysDefault.cancellation));
  }
  if (!copy.budget) {
    copy.budget = JSON.parse(JSON.stringify(sysDefault.budget));
  }
  if (!copy.centrallyControlledFields) {
    copy.centrallyControlledFields = [];
  }
  if (!copy.multiBranchProcurement) {
    copy.multiBranchProcurement = sysDefault.multiBranchProcurement;
  }
  if (!copy.duplicatePrevention) {
    copy.duplicatePrevention = sysDefault.duplicatePrevention;
  } else {
    if (copy.duplicatePrevention.warningLevel === 'HARD_BLOCK') {
      copy.duplicatePrevention.allowOverride = false;
    } else if (copy.duplicatePrevention.allowOverride === undefined) {
      copy.duplicatePrevention.allowOverride = true;
    }
    if (copy.duplicatePrevention.requireCheckerApprovalForOverride === undefined) {
      copy.duplicatePrevention.requireCheckerApprovalForOverride = false;
    }
    if (!copy.duplicatePrevention.authorizedOverrideRoles) {
      copy.duplicatePrevention.authorizedOverrideRoles =
        sysDefault.duplicatePrevention!.authorizedOverrideRoles;
    }
    if (!copy.duplicatePrevention.checkerApprovalRoles) {
      copy.duplicatePrevention.checkerApprovalRoles =
        sysDefault.duplicatePrevention!.checkerApprovalRoles;
    }
  }
  if (!copy.attachmentGovernance) {
    copy.attachmentGovernance = sysDefault.attachmentGovernance;
  }
  if (!copy.numberingAndPeriod) {
    copy.numberingAndPeriod = sysDefault.numberingAndPeriod;
  }
  if (copy.editingAndLocking.allowApprovedLineAmendment === undefined) {
    copy.editingAndLocking.allowApprovedLineAmendment = true;
  }
  if (copy.activation.expensePrEnabled === undefined) {
    copy.activation.expensePrEnabled = true;
  }
  if (copy.activation.allowSameChargeAtHeaderAndLine === undefined) {
    copy.activation.allowSameChargeAtHeaderAndLine = false;
  }
  if (copy.activation.taxInclusivePricingSupported === undefined) {
    copy.activation.taxInclusivePricingSupported = true;
  }
  if (copy.activation.includeTaxInBudgetBasis === undefined) {
    copy.activation.includeTaxInBudgetBasis = true;
  }
  if (
    copy.activation.expensePrEnabled &&
    copy.shortClose?.applicablePrTypes &&
    !copy.shortClose.applicablePrTypes.includes('EXPENSE')
  ) {
    copy.shortClose.applicablePrTypes.push('EXPENSE');
  }
  if (
    copy.activation.expensePrEnabled &&
    copy.cancellation?.applicablePrTypes &&
    !copy.cancellation.applicablePrTypes.includes('EXPENSE')
  ) {
    copy.cancellation.applicablePrTypes.push('EXPENSE');
  }

  // 1. Mandatory immutable security & locking invariants
  if ((raw.activation as any)?.prAuditTrailEnabled === false) {
    warnings.push('Mandatory PR Audit Trail cannot be disabled by administrators; restored to Enabled.');
  }
  copy.activation.prAuditTrailEnabled = true;
  copy.editingAndLocking.pendingApprovalEditing = false;
  copy.editingAndLocking.approvedPrHeaderLock = true;
  copy.editingAndLocking.convertedLineLock = true;
  copy.editingAndLocking.shortClosedPrLock = true;
  copy.editingAndLocking.cancelledPrLock = true;
  copy.editingAndLocking.rejectedPrLock = true;
  copy.editingAndLocking.withdrawnPrLock = true;
  copy.partialConversion.lineLevelConversionLock = true;
  copy.budget.preservePoCommitments = true;
  copy.budget.preventDuplicateBudgetRelease = true;
  copy.budget.budgetReconciliationAudit = true;
  copy.budget.enforceHistoricalExchangeRateOnRelease = true;
  copy.auditAndSecurity = {
    mandatoryAuditTrail: true,
    prStatusChangeAudit: true,
    lineLevelChangeAudit: true,
    approvalHistory: true,
    conversionHistory: true,
    shortCloseHistory: true,
    cancellationHistory: true,
    budgetReleaseHistory: true,
    configurationChangeHistory: true,
  };

  // Ensure prAuditTrailEnabled is always centrally controlled
  if (!copy.centrallyControlledFields.includes('prAuditTrailEnabled')) {
    copy.centrallyControlledFields.push('prAuditTrailEnabled');
  }

  // Budget release cannot bypass reconciliation
  if (
    (copy.budget.budgetReleaseOnShortClose || copy.budget.budgetReleaseOnCancellation) &&
    (!copy.shortClose.budgetReconciliationRequired || !copy.cancellation.budgetReconciliationRequired)
  ) {
    warnings.push(
      'Budget release cannot bypass reconciliation; Budget Reconciliation Required has been enforced for Short Close and Cancellation.'
    );
    copy.shortClose.budgetReconciliationRequired = true;
    copy.cancellation.budgetReconciliationRequired = true;
  }

  // 2. Sync section toggles with activation flags
  if (!copy.activation.prShortCloseEnabled && copy.shortClose.enableShortClose) {
    warnings.push('Disabling PR Short Close removes Short Close availability across all statuses.');
  }
  copy.shortClose.enableShortClose = copy.activation.prShortCloseEnabled;

  if (!copy.activation.prCancellationEnabled && copy.cancellation.enablePrCancellation) {
    warnings.push('Disabling PR Cancellation removes Cancellation availability across all statuses.');
  }
  copy.cancellation.enablePrCancellation = copy.activation.prCancellationEnabled;

  copy.budget.enableBudgetValidation = copy.activation.budgetValidationEnabled;
  copy.approval.enableApprovalWorkflow = copy.activation.prApprovalEnabled;
  copy.approval.returnForCorrection = copy.activation.prReturnForCorrectionEnabled;
  copy.approval.withdrawalBeforeApproval = copy.activation.prWithdrawalEnabled;
  copy.rfqPoIntegration.enablePrToRfqConversion = copy.activation.rfqConversionEnabled;
  copy.rfqPoIntegration.enablePrToPoConversion = copy.activation.poConversionEnabled;

  if (copy.activation.expectedDeliveryDateEnabled === false) {
    copy.activation.expectedDeliveryDateMandatory = false;
  }

  // 3. Dependency rules
  if (!copy.activation.prModuleEnabled) {
    warnings.push(
      'PR Module is disabled: dependent PR creation, submission, editing, and RFQ/PO conversion features will be inactive in effective policy.'
    );
  }

  if (!copy.activation.rfqConversionEnabled) {
    if (
      copy.partialConversion.enablePartialRfqConversion ||
      copy.rfqPoIntegration.enablePartialRfqConversion
    ) {
      warnings.push(
        'RFQ Conversion is disabled; Partial RFQ Conversion has been automatically disabled.'
      );
    }
    copy.partialConversion.enablePartialRfqConversion = false;
    copy.rfqPoIntegration.enablePartialRfqConversion = false;
  }

  if (!copy.activation.poConversionEnabled) {
    if (
      copy.partialConversion.enablePartialPoConversion ||
      copy.rfqPoIntegration.enablePartialPoConversion
    ) {
      warnings.push(
        'PO Conversion is disabled; Partial PO Conversion has been automatically disabled.'
      );
    }
    copy.partialConversion.enablePartialPoConversion = false;
    copy.rfqPoIntegration.enablePartialPoConversion = false;
  }

  if (!copy.activation.partialConversionEnabled) {
    copy.partialConversion.enablePartialRfqConversion = false;
    copy.partialConversion.enablePartialPoConversion = false;
    copy.rfqPoIntegration.enablePartialRfqConversion = false;
    copy.rfqPoIntegration.enablePartialPoConversion = false;
  } else {
    if (copy.activation.rfqConversionEnabled) {
      copy.rfqPoIntegration.enablePartialRfqConversion =
        copy.partialConversion.enablePartialRfqConversion;
    }
    if (copy.activation.poConversionEnabled) {
      copy.rfqPoIntegration.enablePartialPoConversion =
        copy.partialConversion.enablePartialPoConversion;
    }
  }

  return { normalized: copy, warnings };
}

let memoryPoliciesCache: PrGovernancePolicyConfig[] | null = null;
let memoryHistoryCache: PrPolicyVersionRecord[] | null = null;
let memoryDelegationsCache: PrApprovalDelegationRecord[] | null = null;
let memoryEscalationsCache: PrApprovalEscalationRecord[] | null = null;
let memoryReconQueueCache: PrReconciliationQueueItem[] | null = null;
let memoryIdempotencySet: Set<string> = new Set();

function incrementVersionString(currentVersion: string): string {
  const match = currentVersion.match(/^v(\d+)\.(\d+)$/i);
  if (!match) return 'v1.1';
  const major = Number(match[1]);
  const minor = Number(match[2]) + 1;
  return `v${major}.${minor}`;
}

function applyCentrallyControlledLocks(
  baseCompanyPolicy: PrGovernancePolicyConfig,
  targetPolicy: PrGovernancePolicyConfig
): void {
  const lockedFields = baseCompanyPolicy.centrallyControlledFields || [];
  for (const lockedKey of lockedFields) {
    if (lockedKey in baseCompanyPolicy.activation) {
      (targetPolicy.activation as any)[lockedKey] = (baseCompanyPolicy.activation as any)[
        lockedKey
      ];
    }
    if (baseCompanyPolicy.budget && targetPolicy.budget && lockedKey in baseCompanyPolicy.budget) {
      (targetPolicy.budget as any)[lockedKey] = (baseCompanyPolicy.budget as any)[lockedKey];
    }
    if (
      baseCompanyPolicy.approval &&
      targetPolicy.approval &&
      lockedKey in baseCompanyPolicy.approval
    ) {
      (targetPolicy.approval as any)[lockedKey] = (baseCompanyPolicy.approval as any)[lockedKey];
    }
  }
  if (lockedFields.includes('budgetValidationEnabled')) {
    targetPolicy.budget.enableBudgetValidation = targetPolicy.activation.budgetValidationEnabled;
  }
}

export const prGovernancePolicyService = {
  getPolicies(): PrGovernancePolicyConfig[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PR_POLICIES);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (err) {
        console.error('Error reading PR governance policies:', err);
      }
    }
    if (!memoryPoliciesCache) {
      memoryPoliciesCache = JSON.parse(JSON.stringify(INITIAL_PR_GOVERNANCE_POLICIES));
    }
    return JSON.parse(JSON.stringify(memoryPoliciesCache));
  },

  savePolicies(policies: PrGovernancePolicyConfig[]): void {
    memoryPoliciesCache = JSON.parse(JSON.stringify(policies));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_PR_POLICIES, JSON.stringify(policies));
      } catch (err) {
        console.error('Error saving PR governance policies:', err);
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cip-pr-governance-updated'));
    }
  },

  getPolicyHistory(companyId?: string, branchId?: string): PrPolicyVersionRecord[] {
    let list: PrPolicyVersionRecord[] = [];
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PR_POLICY_HISTORY);
        if (saved) {
          list = JSON.parse(saved);
        }
      } catch {
        list = [];
      }
    } else if (memoryHistoryCache) {
      list = [...memoryHistoryCache];
    }

    if (list.length === 0) {
      list = INITIAL_PR_GOVERNANCE_POLICIES.map((p) => ({
        id: `ver-init-${p.companyId}-${p.branchId}`,
        policyId: p.id,
        companyId: p.companyId,
        companyCode: p.companyCode,
        branchId: p.branchId,
        branchCode: p.branchCode,
        branchName: p.branchName,
        policyScope: p.policyScope,
        policyVersion: p.policyVersion,
        effectiveFrom: p.effectiveFrom,
        effectiveUntil: p.effectiveUntil,
        status: 'ACTIVE',
        createdBy: p.createdBy,
        createdByUserId: p.createdByUserId || 'usr-admin-01',
        createdAt: p.createdAt || p.modifiedAt,
        modifiedBy: p.modifiedBy,
        modifiedByUserId: p.modifiedByUserId || 'usr-admin-01',
        modifiedAt: p.modifiedAt,
        approvedBy: p.approvedBy || 'Vikramaditya Rao (Org Admin)',
        approvedByUserId: p.approvedByUserId || 'usr-checker-01',
        approvedAt: p.approvedAt || p.modifiedAt,
        activatedBy: p.activatedBy || 'Vikramaditya Rao (Org Admin)',
        activatedByUserId: p.activatedByUserId || 'usr-checker-01',
        activatedAt: p.activatedAt || p.modifiedAt,
        changeSummary: 'Initial baseline company Purchase Requisition governance policy (v1.0)',
        snapshot: JSON.parse(JSON.stringify(p)),
      }));
    }

    // Automatically mark any version whose effectiveUntil is strictly before today as EXPIRED
    const todayIso = new Date().toISOString().split('T')[0];
    list.forEach((r) => {
      if (r.effectiveUntil && r.effectiveUntil < todayIso && r.status === 'ACTIVE') {
        r.status = 'EXPIRED';
      }
    });

    if (companyId && companyId !== 'ALL') {
      const normComp = normalizeCompanyId(companyId);
      list = list.filter((r) => normalizeCompanyId(r.companyId) === normComp);
    }
    if (branchId && branchId !== 'ALL') {
      const normBr = normalizeBranchId(branchId);
      list = list.filter((r) => normalizeBranchId(r.branchId) === normBr || r.branchId === 'ALL');
    }

    return list.sort(
      (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    );
  },

  savePolicyHistory(records: PrPolicyVersionRecord[]): void {
    memoryHistoryCache = JSON.parse(JSON.stringify(records));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_PR_POLICY_HISTORY, JSON.stringify(records));
      } catch (err) {
        console.error('Error saving PR policy history:', err);
      }
    }
  },

  /**
   * Requirement A.1: Separate permission to view, create, modify, approve, and activate PR policies.
   */
  hasPolicyPermission(
    user: User | undefined,
    permission: PolicyAdminPermission,
    scope: 'COMPANY' | 'BRANCH' = 'COMPANY'
  ): boolean {
    if (!user) return true;
    const role = String(user.role || '');

    if (permission === 'VIEW_POLICY') {
      return true;
    }

    const companyAdminRoles = ['PLATFORM_ADMIN', 'ORG_ADMIN', 'GLOBAL_ITEM_ADMIN', 'PROCUREMENT_MANAGER'];
    const branchAdminRoles = [...companyAdminRoles, 'BRANCH_COORDINATOR', 'BRANCH_ADMIN'];

    if (permission === 'CREATE_POLICY' || permission === 'MODIFY_POLICY') {
      return scope === 'COMPANY'
        ? companyAdminRoles.includes(role)
        : branchAdminRoles.includes(role);
    }

    if (permission === 'APPROVE_POLICY' || permission === 'ACTIVATE_POLICY') {
      // Only high-level governance administrators can approve/activate policies
      return ['PLATFORM_ADMIN', 'ORG_ADMIN', 'GLOBAL_ITEM_ADMIN'].includes(role);
    }

    return false;
  },

  /**
   * Requirement B.1 & B.2: Checks whether a policy is approved/active and effective on a target YYYY-MM-DD date.
   */
  isPolicyApprovedAndActive(policy?: PrGovernancePolicyConfig): boolean {
    if (!policy) return false;
    return !policy.effectiveStatus || policy.effectiveStatus === 'ACTIVE';
  },

  isPolicyEffectiveOnDate(policy: PrGovernancePolicyConfig, evaluationDate?: string): boolean {
    if (!this.isPolicyApprovedAndActive(policy)) {
      return false;
    }
    const evalDate = (evaluationDate || new Date().toISOString()).split('T')[0];
    if (policy.effectiveFrom && evalDate < policy.effectiveFrom) {
      return false;
    }
    if (policy.effectiveUntil && evalDate > policy.effectiveUntil) {
      return false;
    }
    return true;
  },

  /**
   * Returns true if a specific branch has an explicit, non-inherited override record.
   */
  hasBranchOverride(companyId: string, branchId?: string): boolean {
    const normComp = normalizeCompanyId(companyId);
    const normBranch = normalizeBranchId(branchId);
    if (normBranch === 'ALL') return false;
    const policies = this.getPolicies();
    const companyPolicy = policies.find(
      (p) =>
        normalizeCompanyId(p.companyId) === normComp &&
        p.branchId === 'ALL' &&
        this.isPolicyApprovedAndActive(p)
    );
    if (companyPolicy && !companyPolicy.allowBranchOverride) {
      return false;
    }
    return policies.some(
      (p) =>
        normalizeCompanyId(p.companyId) === normComp &&
        normalizeBranchId(p.branchId) === normBranch &&
        !p.isInheritedFromCompany &&
        this.isPolicyApprovedAndActive(p)
    );
  },

  /**
   * Authoritative 4-Step Policy Inheritance Resolution (with Effective-Date Validation):
   * 1. Load Company Policy (or Approved System Default if none exists or expired).
   * 2. If branchId is specified and Company allows branch overrides and an explicit Branch Override exists (and is effective on evaluationDate):
   *    apply the branch policy EXCEPT for fields marked by Company Policy in `centrallyControlledFields`.
   * 3. If no branch override exists (or it has expired), inherit the Company Policy.
   * 4. Apply runtime dependency enforcement.
   */
  getEffectivePolicy(
    companyId: string,
    branchId?: string,
    evaluationDate?: string
  ): PrGovernancePolicyConfig & {
    resolutionSource: 'BRANCH_OVERRIDE' | 'COMPANY_INHERITED' | 'SYSTEM_DEFAULT';
  } {
    const normComp = normalizeCompanyId(companyId);
    const normBranch = normalizeBranchId(branchId);
    const policies = this.getPolicies();

    const companyPolicyRecord = policies.find(
      (p) =>
        normalizeCompanyId(p.companyId) === normComp &&
        p.branchId === 'ALL' &&
        this.isPolicyEffectiveOnDate(p, evaluationDate)
    );
    const baseCompanyPolicy = companyPolicyRecord
      ? JSON.parse(JSON.stringify(companyPolicyRecord))
      : createSystemDefaultPolicy(normComp, 'ALL');

    let resolved: PrGovernancePolicyConfig;
    let resolutionSource: 'BRANCH_OVERRIDE' | 'COMPANY_INHERITED' | 'SYSTEM_DEFAULT' =
      companyPolicyRecord ? 'COMPANY_INHERITED' : 'SYSTEM_DEFAULT';

    if (normBranch !== 'ALL') {
      const branchRecord = policies.find(
        (p) =>
          normalizeCompanyId(p.companyId) === normComp &&
          normalizeBranchId(p.branchId) === normBranch &&
          !p.isInheritedFromCompany &&
          this.isPolicyEffectiveOnDate(p, evaluationDate)
      );

      if (branchRecord && baseCompanyPolicy.allowBranchOverride) {
        resolved = JSON.parse(JSON.stringify(branchRecord));
        resolved.isInheritedFromCompany = false;
        resolved.policyScope = 'BRANCH';
        resolved.centrallyControlledFields = [...baseCompanyPolicy.centrallyControlledFields];
        resolutionSource = 'BRANCH_OVERRIDE';

        // Rule 4: Never allow a branch to override a setting that company governance marked as centrally controlled!
        applyCentrallyControlledLocks(baseCompanyPolicy, resolved);
      } else {
        const branchObj = INITIAL_BRANCHES.find((b) => b.id === normBranch);
        resolved = {
          ...baseCompanyPolicy,
          branchId: normBranch,
          branchCode: branchObj?.portalBranchCode || branchObj?.code || normBranch,
          branchName: branchObj?.name || `Branch ${normBranch}`,
          policyScope: 'BRANCH',
          isInheritedFromCompany: true,
        };
      }
    } else {
      resolved = {
        ...baseCompanyPolicy,
        branchId: 'ALL',
        policyScope: 'COMPANY',
        isInheritedFromCompany: false,
      };
    }

    const { normalized } = validateAndNormalizePolicy(resolved);

    // Runtime Master Switch: If PR Module is disabled for this company/branch,
    // all creation, submission, and conversion capabilities are inactive in effective policy.
    if (!normalized.activation.prModuleEnabled) {
      normalized.activation.manualPrCreationEnabled = false;
      normalized.activation.mrpPrCreationEnabled = false;
      normalized.activation.repairPrEnabled = false;
      normalized.activation.maintenancePrEnabled = false;
      normalized.activation.capexAssetPrEnabled = false;
      normalized.activation.prEditingEnabled = false;
      normalized.activation.prSubmissionEnabled = false;
      normalized.activation.rfqConversionEnabled = false;
      normalized.activation.poConversionEnabled = false;
      normalized.activation.partialConversionEnabled = false;
      normalized.rfqPoIntegration.enablePrToRfqConversion = false;
      normalized.rfqPoIntegration.enablePrToPoConversion = false;
      normalized.partialConversion.enablePartialRfqConversion = false;
      normalized.partialConversion.enablePartialPoConversion = false;
    }

    return {
      ...normalized,
      resolutionSource,
    };
  },

  /**
   * Requirement B.3 & B.8: Creates an immutable Policy Snapshot to store on a PR transaction.
   */
  createTransactionPolicySnapshot(companyId: string, branchId?: string): Record<string, any> {
    const eff = this.getEffectivePolicy(companyId, branchId);
    return {
      capturedAt: new Date().toISOString(),
      policyId: eff.id,
      policyVersion: eff.policyVersion,
      policyScope: eff.policyScope,
      resolutionSource: eff.resolutionSource,
      effectiveFrom: eff.effectiveFrom,
      effectiveUntil: eff.effectiveUntil,
      companyId: eff.companyId,
      companyCode: eff.companyCode,
      branchId: eff.branchId,
      branchCode: eff.branchCode,
      activation: JSON.parse(JSON.stringify(eff.activation)),
      approvalLevels: eff.approval.approvalLevels,
      budgetReportingCurrency: eff.budget.companyReportingCurrency || 'INR',
      allowApprovedLineAmendment: eff.editingAndLocking.allowApprovedLineAmendment,
    };
  },

  /**
   * Requirement A: Submits a Policy Change Proposal for Maker-Checker Approval WITHOUT overwriting the active policy.
   */
  submitPolicyChangeForApproval(
    policyInput: PrGovernancePolicyConfig,
    maker: User,
    changeSummary: string
  ): {
    pendingRecord: PrPolicyVersionRecord;
    warnings: string[];
  } {
    const normComp = normalizeCompanyId(policyInput.companyId);
    const normBranch = normalizeBranchId(policyInput.branchId);
    const scope = normBranch === 'ALL' ? 'COMPANY' : 'BRANCH';

    if (!this.hasPolicyPermission(maker, 'MODIFY_POLICY', scope)) {
      throw new Error(
        `Unauthorized: Role ${maker.role} is not permitted to propose ${scope} PR Governance policy changes.`
      );
    }

    const policies = this.getPolicies();
    const companyPolicy =
      policies.find((p) => normalizeCompanyId(p.companyId) === normComp && p.branchId === 'ALL') ||
      createSystemDefaultPolicy(normComp, 'ALL');

    if (normBranch !== 'ALL') {
      if (!companyPolicy.allowBranchOverride) {
        throw new Error(`Company policy for ${companyPolicy.companyCode} has disabled branch overrides.`);
      }
      for (const lockedKey of companyPolicy.centrallyControlledFields) {
        if (lockedKey in companyPolicy.activation) {
          (policyInput.activation as any)[lockedKey] = (companyPolicy.activation as any)[lockedKey];
        }
        if (companyPolicy.budget && policyInput.budget && lockedKey in companyPolicy.budget) {
          (policyInput.budget as any)[lockedKey] = (companyPolicy.budget as any)[lockedKey];
        }
        if (companyPolicy.approval && policyInput.approval && lockedKey in companyPolicy.approval) {
          (policyInput.approval as any)[lockedKey] = (companyPolicy.approval as any)[lockedKey];
        }
      }
    }

    const { normalized, warnings } = validateAndNormalizePolicy({
      ...policyInput,
      companyId: normComp,
      branchId: normBranch,
      policyScope: scope,
    });

    const activeExisting = policies.find(
      (p) =>
        normalizeCompanyId(p.companyId) === normComp &&
        normalizeBranchId(p.branchId) === normBranch
    );
    const nextVersion = activeExisting
      ? incrementVersionString(activeExisting.policyVersion)
      : normalized.policyVersion || 'v1.1';
    const nowIso = new Date().toISOString();

    const proposedSnapshot: PrGovernancePolicyConfig = {
      ...normalized,
      id: normBranch === 'ALL' ? `pr-pol-${normComp}` : `pr-pol-${normComp}-${normBranch}`,
      policyVersion: nextVersion,
      effectiveStatus: 'PENDING_APPROVAL',
      createdBy: maker.fullName,
      createdByUserId: maker.id,
      createdAt: nowIso,
      modifiedBy: maker.fullName,
      modifiedByUserId: maker.id,
      modifiedAt: nowIso,
    };

    const pendingRecord: PrPolicyVersionRecord = {
      id: `ver-pend-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      policyId: proposedSnapshot.id,
      companyId: proposedSnapshot.companyId,
      companyCode: proposedSnapshot.companyCode,
      branchId: proposedSnapshot.branchId,
      branchCode: proposedSnapshot.branchCode,
      branchName: proposedSnapshot.branchName,
      policyScope: proposedSnapshot.policyScope,
      policyVersion: nextVersion,
      effectiveFrom: proposedSnapshot.effectiveFrom,
      effectiveUntil: proposedSnapshot.effectiveUntil,
      status: 'PENDING_APPROVAL',
      createdBy: maker.fullName,
      createdByUserId: maker.id,
      createdAt: nowIso,
      modifiedBy: maker.fullName,
      modifiedByUserId: maker.id,
      modifiedAt: nowIso,
      changeSummary: changeSummary || `Proposed ${scope} policy update (${nextVersion}) awaiting Checker approval`,
      previousValues: activeExisting
        ? {
            policyVersion: activeExisting.policyVersion,
            activation: activeExisting.activation,
            effectiveFrom: activeExisting.effectiveFrom,
          }
        : undefined,
      newValues: {
        policyVersion: proposedSnapshot.policyVersion,
        activation: proposedSnapshot.activation,
        effectiveFrom: proposedSnapshot.effectiveFrom,
      },
      snapshot: proposedSnapshot,
    };

    const history = this.getPolicyHistory();
    history.unshift(pendingRecord);
    this.savePolicyHistory(history);

    EnterpriseAuditService.logEvent({
      companyId: proposedSnapshot.companyId,
      companyName: proposedSnapshot.companyName,
      branchId: normBranch !== 'ALL' ? normBranch : undefined,
      entityType: 'PURCHASE_REQUISITION',
      entityId: proposedSnapshot.id,
      eventType: 'PR_POLICY_CHANGE_SUBMITTED_FOR_APPROVAL',
      eventDescription: `Submitted ${scope} PR Policy ${nextVersion} for Maker-Checker approval (Active policy ${activeExisting?.policyVersion || 'v1.0'} remains unchanged until approved)`,
      previousValue: pendingRecord.previousValues,
      newValue: pendingRecord.newValues,
      changedByUserId: maker.id,
      changedByName: maker.fullName,
      changeReason: pendingRecord.changeSummary,
    });

    return { pendingRecord, warnings };
  },

  /**
   * Requirement A.2, A.6, A.8, A.9: Approves and activates a Pending Policy Version (or Rollback Proposal).
   * Strictly enforces Maker-Checker rule: Policy creator/modifier cannot approve their own policy change!
   */
  approveAndActivatePolicyChange(
    versionRecordId: string,
    checker: User,
    approvalRemarks?: string
  ): {
    activatedPolicy: PrGovernancePolicyConfig;
    approvedRecord: PrPolicyVersionRecord;
  } {
    const history = this.getPolicyHistory();
    const recIdx = history.findIndex((r) => r.id === versionRecordId);
    if (recIdx === -1) {
      throw new Error(`Policy version record ${versionRecordId} not found.`);
    }

    const record = history[recIdx];
    if (record.status !== 'PENDING_APPROVAL' && record.status !== 'APPROVED') {
      throw new Error(`Policy version ${record.policyVersion} is in status ${record.status} and is not awaiting approval.`);
    }

    if (!this.hasPolicyPermission(checker, 'APPROVE_POLICY', record.policyScope)) {
      throw new Error(
        `Unauthorized: Role ${checker.role} is not permitted to approve or activate PR Governance policies.`
      );
    }

    // Requirement A.2: Policy creator must NOT approve their own policy changes!
    if (
      (record.createdByUserId && record.createdByUserId === checker.id) ||
      (record.modifiedByUserId && record.modifiedByUserId === checker.id)
    ) {
      throw new Error(
        'Maker-Checker Violation: Policy creator or modifier cannot approve their own policy changes.'
      );
    }

    const nowIso = new Date().toISOString();
    const normComp = normalizeCompanyId(record.companyId);
    const normBranch = normalizeBranchId(record.branchId);

    // Mark previous ACTIVE versions for this scope as SUPERSEDED
    history.forEach((h) => {
      if (
        h.id !== record.id &&
        normalizeCompanyId(h.companyId) === normComp &&
        normalizeBranchId(h.branchId) === normBranch &&
        h.status === 'ACTIVE'
      ) {
        h.status = 'SUPERSEDED';
      }
    });

    const activatedSnapshot: PrGovernancePolicyConfig = {
      ...record.snapshot,
      effectiveStatus: 'ACTIVE',
      approvedBy: checker.fullName,
      approvedByUserId: checker.id,
      approvedAt: nowIso,
      activatedBy: checker.fullName,
      activatedByUserId: checker.id,
      activatedAt: nowIso,
    };

    record.status = 'ACTIVE';
    record.approvedBy = checker.fullName;
    record.approvedByUserId = checker.id;
    record.approvedAt = nowIso;
    record.activatedBy = checker.fullName;
    record.activatedByUserId = checker.id;
    record.activatedAt = nowIso;
    record.snapshot = activatedSnapshot;
    if (approvalRemarks) {
      record.changeSummary = `${record.changeSummary} | Approved: ${approvalRemarks}`;
    }

    this.savePolicyHistory(history);

    // Update active policy store
    const policies = this.getPolicies();
    const existingIdx = policies.findIndex(
      (p) =>
        normalizeCompanyId(p.companyId) === normComp &&
        normalizeBranchId(p.branchId) === normBranch
    );
    if (existingIdx >= 0) {
      policies[existingIdx] = activatedSnapshot;
    } else {
      policies.push(activatedSnapshot);
    }
    this.savePolicies(policies);

    EnterpriseAuditService.logEvent({
      companyId: activatedSnapshot.companyId,
      companyName: activatedSnapshot.companyName,
      branchId: normBranch !== 'ALL' ? normBranch : undefined,
      entityType: 'PURCHASE_REQUISITION',
      entityId: activatedSnapshot.id,
      eventType: 'PR_POLICY_CHANGE_APPROVED_AND_ACTIVATED',
      eventDescription: `Checker ${checker.fullName} approved and activated ${activatedSnapshot.policyScope} Policy ${activatedSnapshot.policyVersion} (Created by ${record.createdBy})`,
      previousValue: record.previousValues,
      newValue: record.newValues,
      changedByUserId: checker.id,
      changedByName: checker.fullName,
      changeReason: approvalRemarks || 'Maker-Checker policy approval & activation',
    });

    return { activatedPolicy: activatedSnapshot, approvedRecord: record };
  },

  /**
   * Rejects a Pending Policy Version without altering the active policy.
   */
  rejectPolicyChange(
    versionRecordId: string,
    checker: User,
    rejectionReason: string
  ): PrPolicyVersionRecord {
    const history = this.getPolicyHistory();
    const record = history.find((r) => r.id === versionRecordId);
    if (!record) {
      throw new Error(`Policy version record ${versionRecordId} not found.`);
    }
    if (record.status !== 'PENDING_APPROVAL') {
      throw new Error(`Only PENDING_APPROVAL policy versions can be rejected.`);
    }
    record.status = 'REJECTED';
    record.approvedBy = checker.fullName;
    record.approvedByUserId = checker.id;
    record.approvedAt = new Date().toISOString();
    record.changeSummary = `${record.changeSummary} | REJECTED: ${rejectionReason}`;
    this.savePolicyHistory(history);
    return record;
  },

  /**
   * Requirement A.8: Controlled Rollback to a previously approved policy version through a Maker-Checker approval process.
   */
  requestPolicyRollback(params: {
    targetVersionRecordId: string;
    maker: User;
    reason: string;
  }): PrPolicyVersionRecord {
    const history = this.getPolicyHistory();
    const targetRec = history.find((r) => r.id === params.targetVersionRecordId);
    if (!targetRec) {
      throw new Error('Target historical policy version not found for rollback.');
    }
    if (!params.reason?.trim()) {
      throw new Error('A mandatory rollback reason is required.');
    }

    const rollbackDraft: PrGovernancePolicyConfig = {
      ...JSON.parse(JSON.stringify(targetRec.snapshot)),
      effectiveFrom: new Date().toISOString().split('T')[0],
      remarks: `Rollback to ${targetRec.policyVersion}: ${params.reason.trim()}`,
    };

    const { pendingRecord } = this.submitPolicyChangeForApproval(
      rollbackDraft,
      params.maker,
      `Controlled Rollback to ${targetRec.policyVersion}: ${params.reason.trim()}`
    );

    // Tag rollbackTargetVersion on the created history record
    const updatedHistory = this.getPolicyHistory();
    const found = updatedHistory.find((h) => h.id === pendingRecord.id);
    if (found) {
      found.rollbackTargetVersion = targetRec.policyVersion;
      this.savePolicyHistory(updatedHistory);
      return found;
    }
    return pendingRecord;
  },

  /**
   * Saves a Company-Level or Branch-Level policy with controlled versioning and immutable audit logging.
   */
  savePolicyConfiguration(
    policyInput: PrGovernancePolicyConfig,
    actor?: User,
    changeSummary?: string,
    approverActor?: User
  ): {
    savedPolicy: PrGovernancePolicyConfig;
    warnings: string[];
  } {
    const actorRole = String(actor?.role || '');
    if (
      actor &&
      ![
        'PLATFORM_ADMIN',
        'ORG_ADMIN',
        'GLOBAL_ITEM_ADMIN',
        'BRANCH_COORDINATOR',
        'BRANCH_ADMIN',
        'PROCUREMENT_MANAGER',
      ].includes(actorRole)
    ) {
      throw new Error(
        `Unauthorized: Role ${actorRole} is not permitted to modify Purchase Requisition Governance Policies.`
      );
    }

    const normComp = normalizeCompanyId(policyInput.companyId);
    const normBranch = normalizeBranchId(policyInput.branchId);
    if (
      actor &&
      (actorRole === 'BRANCH_ADMIN' || actorRole === 'BRANCH_COORDINATOR') &&
      normBranch === 'ALL'
    ) {
      throw new Error(
        'Unauthorized: Branch Administrators cannot modify Company-wide default policies.'
      );
    }

    // If an explicit approverActor is supplied (Maker-Checker validation in direct call), verify Maker !== Checker
    if (actor && approverActor && actor.id === approverActor.id) {
      throw new Error(
        'Maker-Checker Violation: Policy creator cannot approve their own policy changes.'
      );
    }

    const policies = this.getPolicies();
    const companyPolicy =
      policies.find(
        (p) => normalizeCompanyId(p.companyId) === normComp && p.branchId === 'ALL'
      ) || createSystemDefaultPolicy(normComp, 'ALL');

    if (normBranch !== 'ALL') {
      if (!companyPolicy.allowBranchOverride) {
        throw new Error(
          `Company policy for ${companyPolicy.companyCode} has disabled branch overrides.`
        );
      }
      applyCentrallyControlledLocks(companyPolicy, policyInput);
    }

    const { normalized, warnings } = validateAndNormalizePolicy({
      ...policyInput,
      companyId: normComp,
      branchId: normBranch,
      policyScope: normBranch === 'ALL' ? 'COMPANY' : 'BRANCH',
      isInheritedFromCompany: normBranch === 'ALL' ? false : policyInput.isInheritedFromCompany,
    });

    const existingIdx = policies.findIndex(
      (p) =>
        normalizeCompanyId(p.companyId) === normComp &&
        normalizeBranchId(p.branchId) === normBranch
    );

    const previousPolicy = existingIdx >= 0 ? policies[existingIdx] : undefined;
    const nextVersion = previousPolicy
      ? incrementVersionString(previousPolicy.policyVersion)
      : normalized.policyVersion || 'v1.0';

    const nowIso = new Date().toISOString();
    const actorName = actor?.fullName || normalized.modifiedBy || 'Platform Administrator';
    const checkerName = approverActor?.fullName || 'Vikramaditya Rao (Governance Checker)';
    const checkerId = approverActor?.id || 'usr-checker-01';

    const finalPolicy: PrGovernancePolicyConfig = {
      ...normalized,
      id:
        normBranch === 'ALL'
          ? `pr-pol-${normComp}`
          : `pr-pol-${normComp}-${normBranch}`,
      policyVersion: nextVersion,
      createdBy: previousPolicy?.createdBy || actorName,
      createdByUserId: previousPolicy?.createdByUserId || actor?.id || 'usr-admin-01',
      createdAt: previousPolicy?.createdAt || nowIso,
      modifiedBy: actorName,
      modifiedByUserId: actor?.id || 'usr-admin-01',
      modifiedAt: nowIso,
      approvedBy: checkerName,
      approvedByUserId: checkerId,
      approvedAt: nowIso,
      activatedBy: checkerName,
      activatedByUserId: checkerId,
      activatedAt: nowIso,
      effectiveStatus: 'ACTIVE',
    };

    if (existingIdx >= 0) {
      policies[existingIdx] = finalPolicy;
    } else {
      policies.push(finalPolicy);
    }

    this.savePolicies(policies);

    // Record Policy Version History (mark old active versions as SUPERSEDED)
    const history = this.getPolicyHistory();
    history.forEach((h) => {
      if (
        normalizeCompanyId(h.companyId) === normComp &&
        normalizeBranchId(h.branchId) === normBranch &&
        h.status === 'ACTIVE'
      ) {
        h.status = 'SUPERSEDED';
      }
    });

    const newVersionRecord: PrPolicyVersionRecord = {
      id: `ver-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      policyId: finalPolicy.id,
      companyId: finalPolicy.companyId,
      companyCode: finalPolicy.companyCode,
      branchId: finalPolicy.branchId,
      branchCode: finalPolicy.branchCode,
      branchName: finalPolicy.branchName,
      policyScope: finalPolicy.policyScope,
      policyVersion: finalPolicy.policyVersion,
      effectiveFrom: finalPolicy.effectiveFrom,
      effectiveUntil: finalPolicy.effectiveUntil,
      status: 'ACTIVE',
      createdBy: finalPolicy.createdBy,
      createdByUserId: finalPolicy.createdByUserId,
      createdAt: finalPolicy.createdAt,
      modifiedBy: finalPolicy.modifiedBy,
      modifiedByUserId: finalPolicy.modifiedByUserId,
      modifiedAt: finalPolicy.modifiedAt,
      approvedBy: finalPolicy.approvedBy,
      approvedByUserId: finalPolicy.approvedByUserId,
      approvedAt: finalPolicy.approvedAt,
      activatedBy: finalPolicy.activatedBy,
      activatedByUserId: finalPolicy.activatedByUserId,
      activatedAt: finalPolicy.activatedAt,
      changeSummary:
        changeSummary ||
        `Updated ${finalPolicy.policyScope} PR Governance Policy (${finalPolicy.policyVersion})`,
      previousValues: previousPolicy
        ? {
            policyVersion: previousPolicy.policyVersion,
            activation: previousPolicy.activation,
            effectiveFrom: previousPolicy.effectiveFrom,
          }
        : undefined,
      newValues: {
        policyVersion: finalPolicy.policyVersion,
        activation: finalPolicy.activation,
        effectiveFrom: finalPolicy.effectiveFrom,
      },
      snapshot: JSON.parse(JSON.stringify(finalPolicy)),
    };

    history.unshift(newVersionRecord);
    this.savePolicyHistory(history);

    EnterpriseAuditService.logEvent({
      companyId: finalPolicy.companyId,
      companyName: finalPolicy.companyName,
      branchId: finalPolicy.branchId !== 'ALL' ? finalPolicy.branchId : undefined,
      branchName: finalPolicy.branchId !== 'ALL' ? finalPolicy.branchName : undefined,
      entityType: 'PURCHASE_REQUISITION',
      entityId: finalPolicy.id,
      eventType: 'PR_GOVERNANCE_POLICY_UPDATED',
      eventDescription: `Saved ${finalPolicy.policyScope} PR Governance Policy (${finalPolicy.policyVersion}) for ${finalPolicy.companyCode} / ${finalPolicy.branchName}`,
      previousValue: newVersionRecord.previousValues,
      newValue: newVersionRecord.newValues,
      changedByUserId: actor?.id || 'usr-admin-01',
      changedByName: actorName,
      effectiveFrom: finalPolicy.effectiveFrom,
      changeReason:
        changeSummary || `PR Governance configuration update (${finalPolicy.policyVersion})`,
    });

    return { savedPolicy: finalPolicy, warnings };
  },

  /**
   * Resets a branch override back to inheriting the Company Default Policy.
   */
  resetBranchToCompanyDefault(
    companyId: string,
    branchId: string,
    actor?: User
  ): PrGovernancePolicyConfig {
    const normComp = normalizeCompanyId(companyId);
    const normBranch = normalizeBranchId(branchId);
    const policies = this.getPolicies();
    const filtered = policies.filter(
      (p) =>
        !(
          normalizeCompanyId(p.companyId) === normComp &&
          normalizeBranchId(p.branchId) === normBranch &&
          normBranch !== 'ALL'
        )
    );
    this.savePolicies(filtered);

    const effective = this.getEffectivePolicy(normComp, normBranch);

    EnterpriseAuditService.logEvent({
      companyId: normComp,
      branchId: normBranch,
      entityType: 'PURCHASE_REQUISITION',
      entityId: `pr-pol-${normComp}-${normBranch}`,
      eventType: 'PR_BRANCH_POLICY_RESET_TO_COMPANY_DEFAULT',
      eventDescription: `Reset branch ${normBranch} PR policy to inherit Company Default (${effective.policyVersion})`,
      changedByUserId: actor?.id || 'usr-admin-01',
      changedByName: actor?.fullName || 'Platform Administrator',
      changeReason: 'Reset to Company Default Policy',
    });

    return effective;
  },

  /**
   * Requirement C.1, C.2, C.3: Validates Company and Branch ownership on every PR operation.
   */
  validateCompanyAndBranchOwnership(companyId: string, branchId: string): {
    valid: boolean;
    reason?: string;
    normalizedCompanyId: string;
    normalizedBranchId: string;
  } {
    if (!companyId || !companyId.trim()) {
      return {
        valid: false,
        reason: 'Multi-Company Isolation Error: Every PR must belong to a valid company.',
        normalizedCompanyId: '',
        normalizedBranchId: '',
      };
    }
    if (!branchId || !branchId.trim() || branchId === 'ALL') {
      return {
        valid: false,
        reason: 'Multi-Branch Isolation Error: Every PR must belong to a specific authorized branch.',
        normalizedCompanyId: normalizeCompanyId(companyId),
        normalizedBranchId: '',
      };
    }

    const normComp = normalizeCompanyId(companyId);
    const normBranch = normalizeBranchId(branchId);

    const companyExists = INITIAL_COMPANIES.some((c) => c.id === normComp);
    if (!companyExists) {
      return {
        valid: false,
        reason: `Multi-Company Isolation Error: Unknown or unauthorized company ID '${companyId}'.`,
        normalizedCompanyId: normComp,
        normalizedBranchId: normBranch,
      };
    }

    const branchObj = INITIAL_BRANCHES.find((b) => b.id === normBranch);
    if (!branchObj) {
      return {
        valid: false,
        reason: `Multi-Branch Isolation Error: Unknown branch '${branchId}'.`,
        normalizedCompanyId: normComp,
        normalizedBranchId: normBranch,
      };
    }

    // Verify branch belongs to the specified company when branch.companyId is defined
    const branchCompanyId = normalizeCompanyId((branchObj as any).companyId || normComp);
    if ((branchObj as any).companyId && branchCompanyId !== normComp) {
      return {
        valid: false,
        reason: `Cross-Company Ownership Violation: Branch ${branchObj.name} (${normBranch}) belongs to company ${branchCompanyId}, not ${normComp}.`,
        normalizedCompanyId: normComp,
        normalizedBranchId: normBranch,
      };
    }

    return {
      valid: true,
      normalizedCompanyId: normComp,
      normalizedBranchId: normBranch,
    };
  },

  /**
   * Requirement C.6 & D: Validates whether a user is authorized to access or act on a target Company and Branch.
   * - Prevents cross-company access unless user has explicit global scope.
   * - Prevents cross-branch access unless user is authorized for the branch OR centralized procurement is enabled for a designated buyer.
   */
  validateUserCompanyBranchAccess(
    user: User | undefined,
    targetCompanyId: string,
    targetBranchId: string,
    isCentralBuyerOperation: boolean = false
  ): { allowed: boolean; reason?: string } {
    if (!user) return { allowed: true };

    const userComp = normalizeCompanyId(user.orgId);
    const targetComp = normalizeCompanyId(targetCompanyId);

    // Requirement C.6: Cross-company access check
    if (userComp !== targetComp && !user.isGlobalScope) {
      return {
        allowed: false,
        reason: `Cross-Company Access Denied: User ${user.fullName} belongs to company ${userComp} and is not authorized to access company ${targetComp} records.`,
      };
    }

    // Requirement D: Branch-level access check
    if (targetBranchId && targetBranchId !== 'ALL') {
      const normTargetBranch = normalizeBranchId(targetBranchId);
      const allowedBranches = (user.allowedBranchIds || []).map((b) => normalizeBranchId(b));

      if (!user.isGlobalScope && allowedBranches.length > 0 && !allowedBranches.includes(normTargetBranch)) {
        const eff = this.getEffectivePolicy(targetComp, normTargetBranch);
        const mbp = eff.multiBranchProcurement;
        const isDesignatedCentralBuyer =
          mbp?.centralizedProcurementVisibility &&
          (mbp.crossBranchProcurementAuthorized || isCentralBuyerOperation) &&
          (mbp.designatedCentralBuyerIds?.includes(user.id) ||
            ['PROCUREMENT_MANAGER', 'BUYER', 'ORG_ADMIN', 'PLATFORM_ADMIN'].includes(String(user.role)));

        if (!isDesignatedCentralBuyer) {
          return {
            allowed: false,
            reason: `Cross-Branch Access Denied: User ${user.fullName} is only authorized for branch(es) [${allowedBranches.join(', ')}] and cannot access branch ${normTargetBranch}.`,
          };
        }
      }
    }

    return { allowed: true };
  },

  /**
   * Requirement F: Resolves explicit, traceable exchange rate between PR transaction currency and Company reporting currency.
   */
  getExchangeRate(
    transactionCurrency: string,
    reportingCurrency: string = 'INR'
  ): {
    rate: number;
    ref: string;
    effectiveDate: string;
    transactionCurrency: string;
    reportingCurrency: string;
  } {
    const txCurr = (transactionCurrency || 'INR').toUpperCase();
    const repCurr = (reportingCurrency || 'INR').toUpperCase();
    if (txCurr === repCurr) {
      return {
        rate: 1.0,
        ref: `FX-PARITY-${txCurr}`,
        effectiveDate: '2026-01-01',
        transactionCurrency: txCurr,
        reportingCurrency: repCurr,
      };
    }
    const txEntry = AUTHORITATIVE_FX_RATES[txCurr] || {
      rateToInr: 1.0,
      ref: `FX-CUSTOM-${txCurr}`,
      effectiveDate: '2026-11-01',
    };
    const repEntry = AUTHORITATIVE_FX_RATES[repCurr] || AUTHORITATIVE_FX_RATES.INR;
    const crossRate = Number((txEntry.rateToInr / repEntry.rateToInr).toFixed(4));
    return {
      rate: crossRate,
      ref: txEntry.ref,
      effectiveDate: txEntry.effectiveDate,
      transactionCurrency: txCurr,
      reportingCurrency: repCurr,
    };
  },

  /**
   * Resolves the line-level lock status for a PR line based on converted, short-closed, and cancelled quantities.
   */
  getLineLockStatus(
    line: PurchaseRequisitionLine,
    convertedRfqQty: number = 0
  ): {
    lockStatus: PRLineLockStatus;
    originalQty: number;
    convertedQty: number;
    shortClosedQty: number;
    cancelledQty: number;
    remainingQty: number;
    isLockedForEdit: boolean;
  } {
    const originalQty = Number(line.requestedQuantity) || 0;
    const totalConverted = Math.max(
      Number(line.convertedRfqQuantity || 0) + Number(line.convertedPoQuantity || 0),
      convertedRfqQty
    );
    const shortClosedQty = Number(line.shortClosedQuantity || 0);
    const cancelledQty = Number(line.cancelledQuantity || 0);
    const remainingQty = Math.max(
      0,
      originalQty - totalConverted - shortClosedQty - cancelledQty
    );

    if (line.status === 'CANCELLED' || (cancelledQty >= originalQty && originalQty > 0)) {
      return {
        lockStatus: 'CANCELLED',
        originalQty,
        convertedQty: totalConverted,
        shortClosedQty,
        cancelledQty: originalQty - totalConverted,
        remainingQty: 0,
        isLockedForEdit: true,
      };
    }

    if (line.status === 'SHORT_CLOSED' || (shortClosedQty > 0 && remainingQty <= 0.0001)) {
      return {
        lockStatus: 'SHORT_CLOSED',
        originalQty,
        convertedQty: totalConverted,
        shortClosedQty,
        cancelledQty,
        remainingQty: 0,
        isLockedForEdit: true,
      };
    }

    if (totalConverted >= originalQty && originalQty > 0) {
      return {
        lockStatus: 'LOCKED',
        originalQty,
        convertedQty: totalConverted,
        shortClosedQty,
        cancelledQty,
        remainingQty: 0,
        isLockedForEdit: true,
      };
    }

    if (totalConverted > 0) {
      return {
        lockStatus: 'PARTIALLY_CONVERTED',
        originalQty,
        convertedQty: totalConverted,
        shortClosedQty,
        cancelledQty,
        remainingQty,
        isLockedForEdit: true, // Converted quantity cannot be altered on original PR
      };
    }

    return {
      lockStatus: 'AVAILABLE',
      originalQty,
      convertedQty: 0,
      shortClosedQty,
      cancelledQty,
      remainingQty,
      isLockedForEdit: false,
    };
  },

  /**
   * Requirement F & Section 9: Calculates Currency-Aware Budget Reconciliation.
   * - Eligible Release Amount = Original PR Reservation − Valid Outstanding Commitments − Previously Released Amount
   * - Uses ONLY the preserved historical exchange rate recorded at PR validation/reservation (`exchangeRateUsed`),
   *   NEVER an unrelated current exchange rate!
   * - Reconciles both Transaction Currency and Company Reporting Currency separately.
   */
  calculateBudgetReconciliation(
    pr: PurchaseRequisitionHeader,
    convertedValueMap?: Record<string, number>
  ): {
    originalReservation: number;
    validOutstandingCommitments: number;
    previouslyReleasedAmount: number;
    eligibleReleaseAmount: number;
    transactionCurrency: string;
    companyReportingCurrency: string;
    exchangeRateUsed: number;
    exchangeRateRef: string;
    exchangeRateDate: string;
    originalReservationReportingCurrency: number;
    validCommitmentsReportingCurrency: number;
    previouslyReleasedReportingCurrency: number;
    eligibleReleaseReportingCurrency: number;
  } {
    const transactionCurrency = (pr.currency || 'INR').toUpperCase();
    const eff = this.getEffectivePolicy(pr.companyId, pr.branchId);
    const companyReportingCurrency =
      pr.budgetGovernance?.companyReportingCurrency ||
      eff.budget.companyReportingCurrency ||
      'INR';

    const fxInfo = this.getExchangeRate(transactionCurrency, companyReportingCurrency);
    // Requirement F.4 & F.5: Always preserve and use the historical exchange rate from budget validation/reservation
    const exchangeRateUsed = pr.budgetGovernance?.exchangeRateUsed ?? fxInfo.rate;
    const exchangeRateRef = pr.budgetGovernance?.exchangeRateRef ?? fxInfo.ref;
    const exchangeRateDate = pr.budgetGovernance?.exchangeRateDate ?? fxInfo.effectiveDate;

    const originalReservation =
      pr.budgetGovernance?.originalReservationAmount ?? Number(pr.estimatedTotalValue || 0);

    let calculatedCommitted = 0;
    for (const line of pr.lines) {
      const unitPrice = Number(line.approximateUnitPrice) || 0;
      const convertedQty =
        convertedValueMap?.[line.id] ??
        Number(line.convertedRfqQuantity || 0) + Number(line.convertedPoQuantity || 0);
      calculatedCommitted += convertedQty * unitPrice;
    }

    const validOutstandingCommitments = Math.max(
      pr.budgetGovernance?.outstandingCommittedAmount ?? 0,
      calculatedCommitted
    );

    const previouslyReleasedAmount = pr.budgetGovernance?.previouslyReleasedAmount ?? 0;

    const eligibleReleaseAmount = Math.max(
      0,
      originalReservation - validOutstandingCommitments - previouslyReleasedAmount
    );

    return {
      originalReservation,
      validOutstandingCommitments,
      previouslyReleasedAmount,
      eligibleReleaseAmount,
      transactionCurrency,
      companyReportingCurrency,
      exchangeRateUsed,
      exchangeRateRef,
      exchangeRateDate,
      originalReservationReportingCurrency: Number(
        (originalReservation * exchangeRateUsed).toFixed(2)
      ),
      validCommitmentsReportingCurrency: Number(
        (validOutstandingCommitments * exchangeRateUsed).toFixed(2)
      ),
      previouslyReleasedReportingCurrency: Number(
        (previouslyReleasedAmount * exchangeRateUsed).toFixed(2)
      ),
      eligibleReleaseReportingCurrency: Number(
        (eligibleReleaseAmount * exchangeRateUsed).toFixed(2)
      ),
    };
  },

  /**
   * Authoritative Effective Policy Engine Action Evaluator (Section 14 & Requirements A–Q).
   */
  evaluatePrAction(params: {
    action: PrGovernedActionType;
    companyId: string;
    branchId?: string;
    user?: User;
    pr?: PurchaseRequisitionHeader;
    prType?: PRType;
    policyOverride?: PrGovernancePolicyConfig & {
      resolutionSource?: 'BRANCH_OVERRIDE' | 'COMPANY_INHERITED' | 'SYSTEM_DEFAULT';
    };
  }): PrActionValidationResult {
    const eff =
      params.policyOverride || this.getEffectivePolicy(params.companyId, params.branchId);
    const resolutionSource = eff.resolutionSource || 'COMPANY_INHERITED';
    const { activation, approval, editingAndLocking, shortClose, cancellation } = eff;
    const pr = params.pr;
    const role = params.user?.role || 'PLATFORM_ADMIN';

    const deny = (reason: string): PrActionValidationResult => ({
      allowed: false,
      reason,
      effectivePolicyVersion: eff.policyVersion,
      resolutionSource,
    });

    const allow = (): PrActionValidationResult => ({
      allowed: true,
      effectivePolicyVersion: eff.policyVersion,
      resolutionSource,
    });

    // Multi-Company & Multi-Branch User Access Enforcement (Requirements C & D)
    if (params.user && params.action !== 'VIEW_PR_MODULE') {
      const accessCheck = this.validateUserCompanyBranchAccess(
        params.user,
        params.companyId,
        params.branchId || pr?.branchId || 'ALL'
      );
      if (!accessCheck.allowed) {
        return deny(accessCheck.reason || 'Unauthorized company or branch access.');
      }
    }

    if (params.action === 'VIEW_PR_MODULE') {
      return allow();
    }

    if (!activation.prModuleEnabled) {
      return deny(
        `Purchase Requisition Module is disabled for ${eff.companyCode} / ${eff.branchName} (${eff.policyVersion}). Read-only historical access only.`
      );
    }

    switch (params.action) {
      case 'CREATE_PR': {
        if (
          !activation.manualPrCreationEnabled &&
          !activation.mrpPrCreationEnabled &&
          !activation.repairPrEnabled &&
          !activation.maintenancePrEnabled &&
          !activation.capexAssetPrEnabled &&
          activation.expensePrEnabled === false
        ) {
          return deny('All PR creation types are disabled under the active governance policy.');
        }
        return allow();
      }
      case 'CREATE_MANUAL_PR':
        return activation.manualPrCreationEnabled
          ? allow()
          : deny('Manual PR Creation is disabled by active governance policy.');
      case 'CREATE_MRP_PR':
        return activation.mrpPrCreationEnabled
          ? allow()
          : deny('MRP-Based PR Creation is disabled by active governance policy.');
      case 'CREATE_REPAIR_PR':
        return activation.repairPrEnabled
          ? allow()
          : deny('Repair PR Creation is disabled by active governance policy.');
      case 'CREATE_MAINTENANCE_PR':
        return activation.maintenancePrEnabled
          ? allow()
          : deny('Maintenance PR Creation is disabled by active governance policy.');
      case 'CREATE_CAPEX_PR':
        return activation.capexAssetPrEnabled
          ? allow()
          : deny('Capex / Asset PR Creation is disabled by active governance policy.');
      case 'CREATE_EXPENSE_PR':
        return activation.expensePrEnabled !== false
          ? allow()
          : deny('Expense PR Creation is disabled by active governance policy.');

      case 'EDIT_PR_HEADER': {
        if (!activation.prEditingEnabled) {
          return deny('PR Editing is disabled by active governance policy.');
        }
        if (!pr) return allow();
        if (pr.status === 'DRAFT') {
          return editingAndLocking.draftPrEditing
            ? allow()
            : deny('Draft PR editing is disabled by policy.');
        }
        if (pr.status === 'RETURNED_FOR_CORRECTION') {
          return editingAndLocking.returnedPrEditing
            ? allow()
            : deny('Returned PR editing is disabled by policy.');
        }
        if (
          pr.status === 'SUBMITTED' ||
          pr.status === 'PENDING_MANAGER_APPROVAL' ||
          pr.status === 'PENDING_SUBSEQUENT_APPROVAL' ||
          pr.status === 'PENDING_REAPPROVAL'
        ) {
          return deny('Pending Approval PRs are locked and cannot be edited.');
        }
        if (
          pr.status === 'APPROVED_PENDING_BUYER' ||
          pr.status === 'PENDING_BUYER_CONFIGURATION' ||
          pr.status === 'COMPLETED'
        ) {
          return deny('Approved PR headers are permanently immutable.');
        }
        return deny(`PR in terminal status ${pr.status} is permanently locked.`);
      }

      case 'EDIT_PR_LINES': {
        if (!activation.prEditingEnabled) {
          return deny('PR Editing is disabled by active governance policy.');
        }
        if (!pr) return allow();
        if (pr.status === 'DRAFT') {
          return editingAndLocking.draftPrEditing
            ? allow()
            : deny('Draft PR editing is disabled.');
        }
        if (pr.status === 'RETURNED_FOR_CORRECTION') {
          return editingAndLocking.returnedPrEditing
            ? allow()
            : deny('Returned PR editing is disabled.');
        }
        if (
          pr.status === 'APPROVED_PENDING_BUYER' ||
          pr.status === 'PENDING_BUYER_CONFIGURATION'
        ) {
          return editingAndLocking.unconvertedLineEditing
            ? allow()
            : deny('Unconverted line editing on Approved PRs is disabled by policy.');
        }
        return deny(`PR lines cannot be edited while PR status is ${pr.status}.`);
      }

      case 'AMEND_APPROVED_PR_LINE': {
        if (!activation.prEditingEnabled || editingAndLocking.allowApprovedLineAmendment === false) {
          return deny('Approved PR Line Amendment is disabled by active governance policy.');
        }
        if (
          pr &&
          !['APPROVED_PENDING_BUYER', 'PENDING_BUYER_CONFIGURATION'].includes(pr.status)
        ) {
          return deny(`Only Approved PRs can undergo controlled line amendment (current status: ${pr.status}).`);
        }
        return allow();
      }

      case 'SUBMIT_PR': {
        if (!activation.prSubmissionEnabled) {
          return deny('PR Submission is disabled by active governance policy.');
        }
        if (pr && pr.status !== 'DRAFT') {
          return deny(`Only DRAFT PRs can be submitted (current status: ${pr.status}).`);
        }
        return allow();
      }

      case 'RESUBMIT_PR': {
        if (!activation.prSubmissionEnabled || !approval.resubmissionAllowed) {
          return deny('PR Resubmission is disabled by active governance policy.');
        }
        if (pr && pr.status !== 'RETURNED_FOR_CORRECTION') {
          return deny('Only PRs Returned for Correction can be resubmitted.');
        }
        return allow();
      }

      case 'APPROVE_PR': {
        if (!activation.prApprovalEnabled || !approval.enableApprovalWorkflow) {
          return deny('PR Approval workflow is disabled by active governance policy.');
        }
        if (
          pr &&
          ![
            'PENDING_MANAGER_APPROVAL',
            'PENDING_SUBSEQUENT_APPROVAL',
            'PENDING_REAPPROVAL',
            'RESUBMITTED',
          ].includes(pr.status)
        ) {
          return deny(`PR in status ${pr.status} is not awaiting approval.`);
        }
        return allow();
      }

      case 'RETURN_FOR_CORRECTION': {
        if (!activation.prReturnForCorrectionEnabled || !approval.returnForCorrection) {
          return deny('Return for Correction is disabled by active governance policy.');
        }
        if (
          pr &&
          ![
            'PENDING_MANAGER_APPROVAL',
            'PENDING_SUBSEQUENT_APPROVAL',
            'PENDING_REAPPROVAL',
            'RESUBMITTED',
          ].includes(pr.status)
        ) {
          return deny(`PR in status ${pr.status} cannot be returned for correction.`);
        }
        return allow();
      }

      case 'WITHDRAW_PR': {
        if (!activation.prWithdrawalEnabled || !approval.withdrawalBeforeApproval) {
          return deny('PR Withdrawal is disabled by active governance policy.');
        }
        if (
          pr &&
          ![
            'SUBMITTED',
            'PENDING_MANAGER_APPROVAL',
            'PENDING_SUBSEQUENT_APPROVAL',
            'RESUBMITTED',
          ].includes(pr.status)
        ) {
          return deny('PR can only be withdrawn while Pending Approval.');
        }
        return allow();
      }

      case 'SHORT_CLOSE_PR': {
        if (!activation.prShortCloseEnabled || !shortClose.enableShortClose) {
          return deny('PR Short Close is disabled by active governance policy.');
        }
        if (
          eff.multiBranchProcurement &&
          eff.policyScope === 'BRANCH' &&
          !eff.multiBranchProcurement.branchLevelShortClosePermitted &&
          !['PLATFORM_ADMIN', 'ORG_ADMIN'].includes(String(role))
        ) {
          return deny('Branch-level Short Close permission is disabled by multi-branch policy.');
        }
        if (!shortClose.authorizedRoles.includes(role)) {
          return deny(`Role ${role} is not authorized to perform PR Short Close.`);
        }
        if (pr) {
          if (!shortClose.applicablePrTypes.includes(pr.prType)) {
            return deny(`PR Type ${pr.prType} is not eligible for Short Close under policy.`);
          }
          if (!shortClose.applicablePrStatuses.includes(pr.status)) {
            return deny(
              `PR Status ${pr.status} is not eligible for Short Close (Allowed: ${shortClose.applicablePrStatuses.join(', ')}).`
            );
          }
        }
        return allow();
      }

      case 'CANCEL_PR': {
        if (!activation.prCancellationEnabled || !cancellation.enablePrCancellation) {
          return deny('PR Cancellation is disabled by active governance policy.');
        }
        if (
          eff.multiBranchProcurement &&
          eff.policyScope === 'BRANCH' &&
          !eff.multiBranchProcurement.branchLevelCancellationPermitted &&
          !['PLATFORM_ADMIN', 'ORG_ADMIN'].includes(String(role))
        ) {
          return deny('Branch-level Cancellation permission is disabled by multi-branch policy.');
        }
        if (!cancellation.authorizedRoles.includes(role)) {
          return deny(`Role ${role} is not authorized to cancel Purchase Requisitions.`);
        }
        if (pr) {
          if (!cancellation.applicablePrTypes.includes(pr.prType)) {
            return deny(`PR Type ${pr.prType} is not eligible for Cancellation under policy.`);
          }
          if (!cancellation.applicablePrStatuses.includes(pr.status)) {
            return deny(
              `PR Status ${pr.status} is not eligible for Cancellation (Allowed: ${cancellation.applicablePrStatuses.join(', ')}).`
            );
          }
        }
        return allow();
      }

      case 'CONVERT_TO_RFQ':
        return activation.rfqConversionEnabled && eff.rfqPoIntegration.enablePrToRfqConversion
          ? allow()
          : deny('PR to RFQ Conversion is disabled by active governance policy.');

      case 'PARTIAL_CONVERT_TO_RFQ':
        return activation.rfqConversionEnabled &&
          activation.partialConversionEnabled &&
          eff.partialConversion.enablePartialRfqConversion
          ? allow()
          : deny('Partial PR to RFQ Conversion is disabled by active governance policy.');

      case 'CONVERT_TO_PO':
        return activation.poConversionEnabled && eff.rfqPoIntegration.enablePrToPoConversion
          ? allow()
          : deny('PR to PO Conversion is disabled by active governance policy.');

      case 'PARTIAL_CONVERT_TO_PO':
        return activation.poConversionEnabled &&
          activation.partialConversionEnabled &&
          eff.partialConversion.enablePartialPoConversion
          ? allow()
          : deny('Partial PR to PO Conversion is disabled by active governance policy.');

      default:
        return allow();
    }
  },

  /**
   * Requirement L: Policy Simulation & Sandbox Preview
   * Simulates the exact effective policy, available/restricted actions, approval tiers,
   * and budget requirements WITHOUT creating or modifying any actual PR transaction.
   */
  simulatePolicyOutcome(input: PrPolicySimulationInput): PrPolicySimulationResult {
    const eff = input.draftPolicyOverride
      ? {
          ...validateAndNormalizePolicy(input.draftPolicyOverride).normalized,
          resolutionSource: (input.draftPolicyOverride.isInheritedFromCompany
            ? 'COMPANY_INHERITED'
            : 'BRANCH_OVERRIDE') as 'BRANCH_OVERRIDE' | 'COMPANY_INHERITED' | 'SYSTEM_DEFAULT',
        }
      : this.getEffectivePolicy(input.companyId, input.branchId, input.evaluationDate);

    const isPolicyActiveOnDate = this.isPolicyEffectiveOnDate(eff, input.evaluationDate);
    const mockLine: PurchaseRequisitionLine = {
      id: 'sim-line-1',
      prId: 'sim-pr-1',
      itemCode: 'SIM-ITEM-01',
      description: 'Simulated PR Line Item',
      itemCategory: 'GENERAL',
      inventoryUom: 'EA',
      requestedQuantity: 100,
      approximateUnitPrice: (input.estimatedAmount || 50000) / 100,
      currency: input.currency || 'INR',
      estimatedTotalValue: input.estimatedAmount || 50000,
      deliverySchedules: [],
      status: 'ACTIVE',
      convertedRfqQuantity:
        input.conversionStatus === 'FULLY_CONVERTED'
          ? 100
          : input.conversionStatus === 'PARTIALLY_CONVERTED'
          ? 40
          : 0,
    };

    const mockPr: PurchaseRequisitionHeader = {
      id: 'sim-pr-1',
      prNumber: 'SIM-PR-0001',
      prType: input.prType,
      companyId: normalizeCompanyId(input.companyId),
      companyCode: eff.companyCode,
      branchId: normalizeBranchId(input.branchId) === 'ALL' ? 'br-pond-01' : normalizeBranchId(input.branchId),
      branchCode: eff.branchCode,
      branchName: eff.branchName,
      department: 'Engineering',
      costCentre: 'CC-SIM',
      requesterId: 'sim-user',
      requesterName: 'Simulation User',
      creatorId: 'sim-user',
      creatorName: 'Simulation User',
      priority: 'NORMAL',
      status: input.prStatus,
      purchasePurpose: 'Simulation Preview',
      businessJustification: 'Simulation Preview',
      deliveryLocation: 'Main Store',
      estimatedTotalValue: input.estimatedAmount || 50000,
      currency: input.currency || 'INR',
      budgetValidationStatus: 'SUFFICIENT',
      erpStockStatus: 'FRESH',
      lines: [mockLine],
      changeHistory: [],
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockUser: User = {
      id: 'sim-user',
      fullName: 'Simulation Actor',
      email: 'sim@kosh.in',
      role: input.userRole as any,
      orgId: normalizeCompanyId(input.companyId),
      allowedBranchIds: [mockPr.branchId],
      isGlobalScope: ['PLATFORM_ADMIN', 'ORG_ADMIN'].includes(input.userRole),
      twoFactorEnabled: true,
    };

    const actionCatalog: Array<{ action: PrGovernedActionType; label: string }> = [
      { action: 'CREATE_MANUAL_PR', label: 'Create Manual PR' },
      { action: 'CREATE_MRP_PR', label: 'Create MRP PR' },
      { action: 'CREATE_REPAIR_PR', label: 'Create Repair PR' },
      { action: 'CREATE_MAINTENANCE_PR', label: 'Create Maintenance PR' },
      { action: 'EDIT_PR_HEADER', label: 'Edit PR Header' },
      { action: 'EDIT_PR_LINES', label: 'Edit PR Lines' },
      { action: 'AMEND_APPROVED_PR_LINE', label: 'Amend Approved PR Line' },
      { action: 'SUBMIT_PR', label: 'Submit PR' },
      { action: 'APPROVE_PR', label: 'Approve PR' },
      { action: 'RETURN_FOR_CORRECTION', label: 'Return for Correction' },
      { action: 'RESUBMIT_PR', label: 'Resubmit Corrected PR' },
      { action: 'WITHDRAW_PR', label: 'Withdraw Pending PR' },
      { action: 'SHORT_CLOSE_PR', label: 'Short Close Remaining Balance' },
      { action: 'CANCEL_PR', label: 'Cancel Unconverted PR' },
      { action: 'CONVERT_TO_RFQ', label: 'Convert PR to RFQ' },
      { action: 'PARTIAL_CONVERT_TO_RFQ', label: 'Partial Convert PR to RFQ' },
      { action: 'CONVERT_TO_PO', label: 'Convert PR to PO' },
      { action: 'PARTIAL_CONVERT_TO_PO', label: 'Partial Convert PR to PO' },
    ];

    const availableActions: Array<{ action: PrGovernedActionType; label: string }> = [];
    const restrictedActions: Array<{ action: PrGovernedActionType; label: string; reason: string }> = [];

    for (const item of actionCatalog) {
      // Additional conversion-status simulation rules
      if (
        input.conversionStatus === 'FULLY_CONVERTED' &&
        ['EDIT_PR_LINES', 'AMEND_APPROVED_PR_LINE', 'SHORT_CLOSE_PR', 'CANCEL_PR'].includes(item.action)
      ) {
        restrictedActions.push({
          ...item,
          reason: 'All PR lines are 100% converted and permanently locked.',
        });
        continue;
      }
      if (input.conversionStatus === 'PARTIALLY_CONVERTED' && item.action === 'CANCEL_PR') {
        restrictedActions.push({
          ...item,
          reason:
            'Partially converted lines cannot be Cancelled (use Short Close for remaining unconverted quantity).',
        });
        continue;
      }

      const res = this.evaluatePrAction({
        action: item.action,
        companyId: input.companyId,
        branchId: mockPr.branchId,
        user: mockUser,
        pr: mockPr,
        prType: input.prType,
        policyOverride: eff,
      });

      if (res.allowed) {
        availableActions.push(item);
      } else {
        restrictedActions.push({
          ...item,
          reason: res.reason || 'Restricted by policy.',
        });
      }
    }

    const amount = input.estimatedAmount || 50000;
    const matchingTiers = eff.approval.approvalMatrix.filter(
      (t) => amount >= t.minAmount && (t.maxAmount === null || amount <= t.maxAmount)
    );

    const expectedWorkflowOutcome = !eff.activation.prModuleEnabled
      ? 'PR Module Disabled — Historical Read-Only Access Only.'
      : input.conversionStatus === 'FULLY_CONVERTED'
      ? 'Line-Level Lock Active — Converted lines are permanently immutable; downstream RFQ/PO commitments preserved.'
      : `PR (${input.prType} / ${input.prStatus}) requires ${eff.approval.approvalLevels} approval level(s), ${
          eff.budget.mandatoryBudgetCheck ? 'Mandatory Budget Check' : 'Advisory Budget Check'
        }, and ${availableActions.length} governed action(s) are permitted for role ${input.userRole}.`;

    return {
      effectivePolicyVersion: eff.policyVersion,
      resolutionSource: eff.resolutionSource,
      effectiveFrom: eff.effectiveFrom,
      effectiveUntil: eff.effectiveUntil,
      isPolicyActiveOnDate,
      availableActions,
      restrictedActions,
      approvalRequirements: {
        workflowEnabled: eff.approval.enableApprovalWorkflow,
        requiredLevels: eff.approval.approvalLevels,
        matchingTiers: matchingTiers.length > 0 ? matchingTiers : eff.approval.approvalMatrix.slice(0, 1),
        slaHours: matchingTiers[0]?.slaHours || eff.approval.escalationAfterHours || 48,
        delegationAllowed: eff.approval.approvalDelegation,
      },
      budgetRequirements: {
        validationEnabled: eff.budget.enableBudgetValidation,
        mandatoryCheck: eff.budget.mandatoryBudgetCheck,
        reservationOnApproval: eff.budget.budgetReservationOnApproval,
        autoReleaseOnShortCloseOrCancel: eff.budget.autoUncommittedBudgetRelease,
        reportingCurrency: eff.budget.companyReportingCurrency || 'INR',
      },
      expectedWorkflowOutcome,
    };
  },

  /**
   * Requirement I: Approval Delegation & Escalation Management
   */
  getDelegations(companyId?: string, branchId?: string): PrApprovalDelegationRecord[] {
    let list: PrApprovalDelegationRecord[] = [];
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PR_DELEGATIONS);
        if (saved) list = JSON.parse(saved);
      } catch {
        list = [];
      }
    } else if (memoryDelegationsCache) {
      list = [...memoryDelegationsCache];
    }

    if (list.length === 0) {
      list = [
        {
          id: 'del-seed-01',
          companyId: 'co-kosh-01',
          branchId: 'br-pond-01',
          delegatorUserId: 'usr-dept-head-01',
          delegatorName: 'Ramesh Iyer (Department Head)',
          delegatorRole: 'DEPARTMENT_HEAD',
          delegateeUserId: 'usr-proc-mgr-01',
          delegateeName: 'Ananya Nair (Procurement Manager)',
          delegateeRole: 'PROCUREMENT_MANAGER',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          maxApprovalAmount: 500000,
          currency: 'INR',
          scopeDescription: 'Plant annual shutdown temporary L1 approval delegation',
          approvalStatus: 'APPROVED',
          approvedBy: 'Rajesh Sharma (Platform Admin)',
          createdAt: '2026-11-01T09:00:00.000Z',
        },
      ];
    }

    if (companyId && companyId !== 'ALL') {
      const normComp = normalizeCompanyId(companyId);
      list = list.filter((d) => normalizeCompanyId(d.companyId) === normComp);
    }
    if (branchId && branchId !== 'ALL') {
      const normBr = normalizeBranchId(branchId);
      list = list.filter((d) => d.branchId === 'ALL' || normalizeBranchId(d.branchId) === normBr);
    }
    return list;
  },

  saveDelegations(records: PrApprovalDelegationRecord[]): void {
    memoryDelegationsCache = JSON.parse(JSON.stringify(records));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_PR_DELEGATIONS, JSON.stringify(records));
      } catch (err) {
        console.error('Error saving PR delegations:', err);
      }
    }
  },

  createDelegation(
    input: Omit<PrApprovalDelegationRecord, 'id' | 'createdAt' | 'approvalStatus'>,
    actor?: User
  ): PrApprovalDelegationRecord {
    const eff = this.getEffectivePolicy(input.companyId, input.branchId);
    if (!eff.approval.approvalDelegation) {
      throw new Error('Approval Delegation is disabled under the active governance policy.');
    }
    if (input.endDate < input.startDate) {
      throw new Error('Delegation end date cannot be earlier than start date.');
    }

    const requiresApproval = eff.approval.requireDelegationApproval !== false;
    const newRecord: PrApprovalDelegationRecord = {
      ...input,
      companyId: normalizeCompanyId(input.companyId),
      branchId: normalizeBranchId(input.branchId),
      id: `del-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      approvalStatus: requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED',
      approvedBy: requiresApproval ? undefined : actor?.fullName || 'System Auto-Approved',
      createdAt: new Date().toISOString(),
    };

    const all = this.getDelegations();
    all.unshift(newRecord);
    this.saveDelegations(all);
    return newRecord;
  },

  approveDelegation(delegationId: string, approver: User): PrApprovalDelegationRecord {
    const all = this.getDelegations();
    const found = all.find((d) => d.id === delegationId);
    if (!found) throw new Error('Delegation record not found.');
    if (found.delegatorUserId === approver.id || found.delegateeUserId === approver.id) {
      throw new Error('Delegator or Delegatee cannot self-approve a delegation record.');
    }
    found.approvalStatus = 'APPROVED';
    found.approvedBy = approver.fullName;
    this.saveDelegations(all);
    return found;
  },

  /**
   * Requirement I: Validates that a delegated approver does NOT bypass company, branch, date, or amount restrictions!
   */
  validateDelegatedApproval(params: {
    delegateeUserId: string;
    pr: PurchaseRequisitionHeader;
    evaluationDate?: string;
  }): {
    valid: boolean;
    delegation?: PrApprovalDelegationRecord;
    reason?: string;
  } {
    const evalDate = (params.evaluationDate || new Date().toISOString()).split('T')[0];
    const prComp = normalizeCompanyId(params.pr.companyId);
    const prBranch = normalizeBranchId(params.pr.branchId);
    const all = this.getDelegations();

    const candidate = all.find(
      (d) => d.delegateeUserId === params.delegateeUserId && normalizeCompanyId(d.companyId) === prComp
    );

    if (!candidate) {
      return {
        valid: false,
        reason: `No active delegation found for user ${params.delegateeUserId} in company ${prComp}.`,
      };
    }

    if (candidate.approvalStatus !== 'APPROVED') {
      return {
        valid: false,
        reason: `Delegation ${candidate.id} is in status ${candidate.approvalStatus} and has not been approved.`,
      };
    }

    if (
      candidate.branchId !== 'ALL' &&
      normalizeBranchId(candidate.branchId) !== prBranch
    ) {
      return {
        valid: false,
        reason: `Delegation Branch Restriction: Delegation is scoped to branch ${candidate.branchId} and cannot approve PR for branch ${prBranch}.`,
      };
    }

    if (evalDate < candidate.startDate || evalDate > candidate.endDate) {
      return {
        valid: false,
        reason: `Delegation Date Restriction: Delegation is only valid from ${candidate.startDate} to ${candidate.endDate} (evaluated on ${evalDate}).`,
      };
    }

    if (
      candidate.maxApprovalAmount !== null &&
      Number(params.pr.estimatedTotalValue) > candidate.maxApprovalAmount
    ) {
      return {
        valid: false,
        reason: `Delegation Amount Restriction: PR value (${params.pr.currency} ${params.pr.estimatedTotalValue}) exceeds delegated limit (${candidate.currency} ${candidate.maxApprovalAmount}).`,
      };
    }

    return { valid: true, delegation: candidate };
  },

  getEscalations(companyId?: string): PrApprovalEscalationRecord[] {
    let list: PrApprovalEscalationRecord[] = [];
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PR_ESCALATIONS);
        if (saved) list = JSON.parse(saved);
      } catch {
        list = [];
      }
    } else if (memoryEscalationsCache) {
      list = [...memoryEscalationsCache];
    }
    if (companyId && companyId !== 'ALL') {
      const normComp = normalizeCompanyId(companyId);
      list = list.filter((e) => normalizeCompanyId(e.companyId) === normComp);
    }
    return list;
  },

  evaluateSlaEscalations(prs: PurchaseRequisitionHeader[]): PrApprovalEscalationRecord[] {
    const existing = this.getEscalations();
    const nowMs = Date.now();

    for (const pr of prs) {
      if (
        ![
          'PENDING_MANAGER_APPROVAL',
          'PENDING_SUBSEQUENT_APPROVAL',
          'PENDING_REAPPROVAL',
          'RESUBMITTED',
        ].includes(pr.status)
      ) {
        continue;
      }
      const eff = this.getEffectivePolicy(pr.companyId, pr.branchId);
      if (!eff.approval.approvalEscalation) continue;

      const submittedMs = new Date(pr.submittedAt || pr.createdAt).getTime();
      const elapsedHours = Math.floor((nowMs - submittedMs) / 3600000);
      const slaHours = eff.approval.escalationAfterHours || 48;
      const reminderHours = eff.approval.pendingApprovalReminderHours || 12;

      if (elapsedHours >= reminderHours) {
        const alreadyLogged = existing.some((e) => e.prId === pr.id);
        if (!alreadyLogged) {
          existing.unshift({
            id: `esc-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            prId: pr.id,
            prNumber: pr.prNumber,
            companyId: pr.companyId,
            branchId: pr.branchId,
            approvalLevel: pr.status === 'PENDING_MANAGER_APPROVAL' ? 'Level 1' : 'Level 2',
            originalApproverRole: 'DEPARTMENT_HEAD',
            escalatedToRole:
              elapsedHours >= slaHours ? 'PROCUREMENT_MANAGER (Alternate Approver)' : 'DEPARTMENT_HEAD (Reminder)',
            slaHours,
            elapsedHours,
            escalatedAt: new Date().toISOString(),
            status: elapsedHours >= slaHours ? 'ESCALATED_TO_ALTERNATE' : 'REMINDER_SENT',
            remarks:
              elapsedHours >= slaHours
                ? `SLA breached (${elapsedHours}h > ${slaHours}h); escalated to alternate approver.`
                : `Pending approval reminder triggered (${elapsedHours}h elapsed).`,
          });
        }
      }
    }

    memoryEscalationsCache = existing;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_PR_ESCALATIONS, JSON.stringify(existing));
      } catch {
        // ignore
      }
    }
    return existing;
  },

  /**
   * Requirement M: Failure Recovery, Idempotency & Reconciliation Queue
   */
  hasProcessedIdempotencyKey(key?: string): boolean {
    if (!key) return false;
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_PR_IDEMPOTENCY);
        if (raw) {
          const arr: string[] = JSON.parse(raw);
          return arr.includes(key);
        }
      } catch {
        // ignore
      }
    }
    return memoryIdempotencySet.has(key);
  },

  markIdempotencyKeyProcessed(key?: string): void {
    if (!key) return;
    memoryIdempotencySet.add(key);
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_PR_IDEMPOTENCY);
        const arr: string[] = raw ? JSON.parse(raw) : [];
        if (!arr.includes(key)) {
          arr.push(key);
          localStorage.setItem(STORAGE_KEY_PR_IDEMPOTENCY, JSON.stringify(arr));
        }
      } catch {
        // ignore
      }
    }
  },

  getReconciliationQueue(companyId?: string): PrReconciliationQueueItem[] {
    let list: PrReconciliationQueueItem[] = [];
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PR_RECON_QUEUE);
        if (saved) list = JSON.parse(saved);
      } catch {
        list = [];
      }
    } else if (memoryReconQueueCache) {
      list = [...memoryReconQueueCache];
    }

    if (companyId && companyId !== 'ALL') {
      const normComp = normalizeCompanyId(companyId);
      list = list.filter((i) => normalizeCompanyId(i.companyId) === normComp);
    }
    return list;
  },

  saveReconciliationQueue(items: PrReconciliationQueueItem[]): void {
    memoryReconQueueCache = JSON.parse(JSON.stringify(items));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_PR_RECON_QUEUE, JSON.stringify(items));
      } catch {
        // ignore
      }
    }
  },

  enqueueFailureRecoveryItem(params: {
    idempotencyKey?: string;
    operationType: PrFailureOperationType;
    prId: string;
    prNumber: string;
    companyId: string;
    branchId: string;
    errorMessage: string;
    lastValidStateSnapshot: any;
    attemptedPayload?: any;
  }): PrReconciliationQueueItem {
    const queue = this.getReconciliationQueue();
    const item: PrReconciliationQueueItem = {
      id: `recon-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      idempotencyKey: params.idempotencyKey || `idem-${Date.now()}`,
      operationType: params.operationType,
      prId: params.prId,
      prNumber: params.prNumber,
      companyId: normalizeCompanyId(params.companyId),
      branchId: normalizeBranchId(params.branchId),
      errorMessage: params.errorMessage,
      lastValidStateSnapshot: JSON.parse(JSON.stringify(params.lastValidStateSnapshot || {})),
      attemptedPayload: params.attemptedPayload,
      status: 'UNRESOLVED',
      createdAt: new Date().toISOString(),
    };
    queue.unshift(item);
    this.saveReconciliationQueue(queue);

    EnterpriseAuditService.logEvent({
      companyId: item.companyId,
      branchId: item.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: item.prId,
      eventType: 'PR_FAILURE_ENQUEUED_FOR_RECONCILIATION',
      eventDescription: `Operation ${item.operationType} failed on ${item.prNumber}: ${item.errorMessage}. Enqueued for controlled recovery.`,
      changedByUserId: 'system-recovery',
      changedByName: 'Transaction Recovery Engine',
      changeReason: item.errorMessage,
      relatedPrId: item.prId,
    });

    return item;
  },

  reconcileFailureQueueItem(params: {
    queueItemId: string;
    actor: User;
    reason: string;
    resolutionStatus?: 'RECONCILED' | 'RETRIED_SUCCESS' | 'DISMISSED';
  }): PrReconciliationQueueItem {
    const allowedRoles = ['PLATFORM_ADMIN', 'ORG_ADMIN', 'GLOBAL_ITEM_ADMIN', 'PROCUREMENT_MANAGER'];
    if (!allowedRoles.includes(String(params.actor.role))) {
      throw new Error(
        `Unauthorized: Role ${params.actor.role} is not permitted to perform manual failure reconciliation.`
      );
    }
    if (!params.reason?.trim()) {
      throw new Error('A mandatory reconciliation reason is required for exceptional corrections.');
    }

    const queue = this.getReconciliationQueue();
    const item = queue.find((i) => i.id === params.queueItemId);
    if (!item) {
      throw new Error(`Reconciliation queue item ${params.queueItemId} not found.`);
    }
    if (item.status !== 'UNRESOLVED') {
      throw new Error(`Queue item ${item.id} is already in status ${item.status}.`);
    }

    item.status = params.resolutionStatus || 'RECONCILED';
    item.reconciledBy = params.actor.fullName;
    item.reconciledAt = new Date().toISOString();
    item.reconciliationReason = params.reason.trim();
    this.saveReconciliationQueue(queue);

    EnterpriseAuditService.logEvent({
      companyId: item.companyId,
      branchId: item.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: item.prId,
      eventType: 'PR_FAILURE_MANUALLY_RECONCILED',
      eventDescription: `Manually reconciled ${item.operationType} on ${item.prNumber} (${item.status})`,
      changedByUserId: params.actor.id,
      changedByName: params.actor.fullName,
      changeReason: params.reason.trim(),
      relatedPrId: item.prId,
    });

    return item;
  },

  /**
   * Authoritative Expected Delivery Date Policy Gate (Section 5):
   * Enforces company/branch effective policy for PR Header Expected Delivery Date.
   *
   * When Disabled:
   * - Strips/omits expectedDeliveryDate from new/updated PR headers so unauthorized dates are not persisted.
   * - Never rejects or blocks creation/submission because the date is absent.
   * - Disables mandatory requirements.
   * - Preserves historical dates on existing approved/submitted PRs.
   *
   * When Enabled:
   * - Requires date if expectedDeliveryDateMandatory is configured true.
   * - Validates date format (YYYY-MM-DD) and calendar validity.
   */
  validateExpectedDeliveryDate(
    headerDate: string | undefined | null,
    effPolicy: PrGovernancePolicyConfig,
    isExistingHistoricalPr: boolean = false
  ): { valid: boolean; reason?: string; sanitizedDate?: string } {
    const isEnabled = effPolicy.activation?.expectedDeliveryDateEnabled !== false;
    const isMandatory = isEnabled && Boolean(effPolicy.activation?.expectedDeliveryDateMandatory);

    // If policy has Expected Delivery Date DISABLED:
    if (!isEnabled) {
      if (isExistingHistoricalPr && headerDate && headerDate.trim()) {
        // Historical PR: preserve the original recorded date
        return { valid: true, sanitizedDate: headerDate.trim() };
      }
      // New PR or uncommitted edit: omit unauthorized date so it is not stored as an active business requirement
      return { valid: true, sanitizedDate: undefined };
    }

    // If policy has Expected Delivery Date ENABLED:
    const trimmed = (headerDate || '').trim();
    if (!trimmed) {
      if (isMandatory) {
        return {
          valid: false,
          reason: `Mandatory Field: Expected Delivery Date is required under active policy for ${effPolicy.companyCode} / ${effPolicy.branchName}.`,
        };
      }
      return { valid: true, sanitizedDate: undefined };
    }

    // Format validation: YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return {
        valid: false,
        reason: 'Invalid Date Format: Expected Delivery Date must be in YYYY-MM-DD format.',
      };
    }

    const parsed = new Date(`${trimmed}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(trimmed)) {
      return {
        valid: false,
        reason: 'Invalid Calendar Date: Expected Delivery Date is not a valid date.',
      };
    }

    return { valid: true, sanitizedDate: trimmed };
  },

  /**
   * Requirement N: PR Numbering Uniqueness & Financial Period / Backdate Validation
   */
  validateFinancialPeriodAndDate(
    companyId: string,
    branchId: string,
    transactionDateIso?: string,
    financialPeriod?: string
  ): { valid: boolean; reason?: string } {
    const eff = this.getEffectivePolicy(companyId, branchId);
    const numCfg = eff.numberingAndPeriod;
    if (!numCfg) return { valid: true };

    // 1. Check closed financial periods
    if (
      numCfg.restrictClosedPeriodTransactions &&
      financialPeriod &&
      numCfg.closedFinancialPeriods.includes(financialPeriod)
    ) {
      return {
        valid: false,
        reason: `Financial Period Restriction: Period '${financialPeriod}' is closed for company ${eff.companyCode}.`,
      };
    }

    // 2. Check open period window & backdating
    if (transactionDateIso) {
      const txDate = transactionDateIso.split('T')[0];
      const todayDate = new Date().toISOString().split('T')[0];

      if (numCfg.restrictClosedPeriodTransactions) {
        if (numCfg.openPeriodStart && txDate < numCfg.openPeriodStart) {
          return {
            valid: false,
            reason: `Financial Period Restriction: Transaction date ${txDate} is prior to open period start (${numCfg.openPeriodStart}).`,
          };
        }
        if (numCfg.openPeriodEnd && txDate > numCfg.openPeriodEnd) {
          return {
            valid: false,
            reason: `Financial Period Restriction: Transaction date ${txDate} is after open period end (${numCfg.openPeriodEnd}).`,
          };
        }
      }

      if (txDate < todayDate) {
        if (!numCfg.allowBackdatedPr) {
          return {
            valid: false,
            reason: `Backdated PR Restriction: Backdated Purchase Requisitions (${txDate} < ${todayDate}) are prohibited under company policy.`,
          };
        }
        const diffDays = Math.floor(
          (new Date(todayDate).getTime() - new Date(txDate).getTime()) / 86400000
        );
        if (diffDays > (numCfg.maxBackdateDays || 0)) {
          return {
            valid: false,
            reason: `Backdated PR Restriction: Backdate of ${diffDays} days exceeds maximum permitted ${numCfg.maxBackdateDays} days.`,
          };
        }
      }
    }

    return { valid: true };
  },

  generateGovernedPrNumber(
    companyId: string,
    branchId: string,
    existingPrNumbers: string[]
  ): string {
    const eff = this.getEffectivePolicy(companyId, branchId);
    const numCfg = eff.numberingAndPeriod;
    const prefix = numCfg?.prPrefix || 'PR';
    const fy = numCfg?.activeFinancialYear || '2026';
    const digits = numCfg?.sequenceDigits || 4;

    const parts: string[] = [prefix];
    if (numCfg?.includeCompanyCode) {
      parts.push(eff.companyCode);
    }
    if (numCfg?.includeBranchCode && eff.branchCode && eff.branchCode !== 'ALL') {
      parts.push(eff.branchCode);
    }
    if (numCfg?.includeFinancialYear !== false) {
      parts.push(fy);
    }

    const basePrefix = parts.join('-');
    const existingSet = new Set(existingPrNumbers);
    let seq = Math.max(numCfg?.nextSequenceNumber || 1, existingPrNumbers.length + 1);
    let candidate = `${basePrefix}-${String(seq).padStart(digits, '0')}`;

    while (existingSet.has(candidate)) {
      seq++;
      candidate = `${basePrefix}-${String(seq).padStart(digits, '0')}`;
    }

    return candidate;
  },

  /**
   * Authoritative Conditional Budget Validation Flag:
   * True ONLY when both effective activation flag AND budget section toggle are ON.
   */
  isBudgetValidationEnabled(
    companyId: string,
    branchId?: string,
    evaluationDate?: string
  ): boolean {
    const eff = this.getEffectivePolicy(companyId, branchId, evaluationDate);
    return Boolean(eff.activation?.budgetValidationEnabled && eff.budget?.enableBudgetValidation);
  },

  /**
   * Computes PR valuation amount in both transaction currency and company reporting currency
   * respecting PR landed valuation rules (items + applicable charges/tax when present).
   */
  resolvePrValuationAmount(
    pr: Pick<
      PurchaseRequisitionHeader,
      | 'estimatedTotalValue'
      | 'grandTotalWithCharges'
      | 'currency'
      | 'companyId'
      | 'branchId'
      | 'budgetGovernance'
    >,
    effPolicy?: PrGovernancePolicyConfig
  ): {
    transactionCurrency: string;
    reportingCurrency: string;
    transactionAmount: number;
    reportingAmount: number;
    exchangeRateUsed: number;
    exchangeRateRef: string;
  } {
    const eff = effPolicy || this.getEffectivePolicy(pr.companyId, pr.branchId);
    const transactionCurrency = (pr.currency || 'INR').toUpperCase();
    const reportingCurrency = (
      pr.budgetGovernance?.companyReportingCurrency ||
      eff.budget?.companyReportingCurrency ||
      'INR'
    ).toUpperCase();
    const fxInfo = this.getExchangeRate(transactionCurrency, reportingCurrency);
    const exchangeRateUsed = pr.budgetGovernance?.exchangeRateUsed ?? fxInfo.rate;
    const transactionAmount = Number(pr.grandTotalWithCharges ?? pr.estimatedTotalValue ?? 0);
    const reportingAmount = Number((transactionAmount * exchangeRateUsed).toFixed(2));
    return {
      transactionCurrency,
      reportingCurrency,
      transactionAmount,
      reportingAmount,
      exchangeRateUsed,
      exchangeRateRef: pr.budgetGovernance?.exchangeRateRef || fxInfo.ref,
    };
  },

  /**
   * Resolves the configured PR Approval Workflow plan from effective Company/Branch policy,
   * PR valuation, matrix tiers, branch/department approvers, maker-checker, delegation, and SLA.
   */
  resolveApprovalWorkflowPlan(
    pr: Pick<
      PurchaseRequisitionHeader,
      | 'companyId'
      | 'branchId'
      | 'department'
      | 'estimatedTotalValue'
      | 'grandTotalWithCharges'
      | 'currency'
      | 'status'
      | 'approvalCycleCount'
      | 'approvalHistory'
      | 'creatorId'
      | 'creatorName'
    >,
    effPolicy?: PrGovernancePolicyConfig
  ): {
    enabled: boolean;
    configuredLevels: number;
    requiredLevels: number;
    currentStepIndex: number;
    currentTier: PrApprovalMatrixTier | null;
    applicableTiers: PrApprovalMatrixTier[];
    authorizedRoles: string[];
    valuationReportingAmount: number;
    reportingCurrency: string;
    branchScopedRequired: boolean;
    departmentScopedRequired: boolean;
    managerL1Required: boolean;
    makerCheckerRequired: boolean;
    mandatoryApprovalRemarks: boolean;
    delegationAllowed: boolean;
    escalationEnabled: boolean;
    escalationAfterHours: number;
  } {
    const eff = effPolicy || this.getEffectivePolicy(pr.companyId, pr.branchId);
    const approvalCfg = eff.approval;
    const enabled = Boolean(eff.activation.prApprovalEnabled && approvalCfg.enableApprovalWorkflow);
    const valuation = this.resolvePrValuationAmount(pr, eff);
    const configuredLevels = Math.max(1, Number(approvalCfg.approvalLevels) || 1);
    const matrix = [...(approvalCfg.approvalMatrix || [])].sort(
      (a, b) => a.levelNumber - b.levelNumber
    );

    let requiredLevels = configuredLevels;
    if (approvalCfg.amountBasedApproval && matrix.length > 0) {
      const matchedHighest = [...matrix]
        .reverse()
        .find(
          (tier) =>
            valuation.reportingAmount >= Number(tier.minAmount || 0) &&
            (tier.maxAmount === null ||
              tier.maxAmount === undefined ||
              valuation.reportingAmount <= Number(tier.maxAmount))
        );
      if (matchedHighest) {
        requiredLevels = Math.max(1, Math.min(configuredLevels, matchedHighest.levelNumber));
      }
    }

    const applicableTiers = matrix.slice(0, requiredLevels);
    const currentCycle = pr.approvalCycleCount || 1;
    const approvalsInCurrentCycle = (pr.approvalHistory || []).filter(
      (h) =>
        (h.cycleNumber || 1) === currentCycle &&
        (h.decision === 'APPROVED' || h.decision === 'DELEGATED_APPROVAL')
    ).length;

    let currentStepIndex = Math.min(requiredLevels, approvalsInCurrentCycle + 1);
    if (
      (pr.status === 'PENDING_SUBSEQUENT_APPROVAL' || pr.status === 'PENDING_REAPPROVAL') &&
      currentStepIndex < 2 &&
      requiredLevels >= 2
    ) {
      currentStepIndex = 2;
    }

    const currentTier =
      applicableTiers.find((t) => t.levelNumber === currentStepIndex) ||
      applicableTiers[applicableTiers.length - 1] ||
      null;

    const authorizedRoles = Array.from(
      new Set(
        [
          'PLATFORM_ADMIN',
          'ORG_ADMIN',
          currentTier?.approverRole,
          currentTier?.alternateApproverRole,
        ].filter((r): r is string => Boolean(r))
      )
    );

    return {
      enabled,
      configuredLevels,
      requiredLevels,
      currentStepIndex,
      currentTier,
      applicableTiers,
      authorizedRoles,
      valuationReportingAmount: valuation.reportingAmount,
      reportingCurrency: valuation.reportingCurrency,
      branchScopedRequired: Boolean(
        approvalCfg.branchLevelApprovers && (currentTier?.branchScoped ?? true)
      ),
      departmentScopedRequired: Boolean(
        approvalCfg.departmentLevelApprovers && (currentTier?.departmentScoped ?? false)
      ),
      managerL1Required: Boolean(approvalCfg.managerL1Approval),
      makerCheckerRequired: Boolean(eff.requireMakerCheckerApproval),
      mandatoryApprovalRemarks: Boolean(approvalCfg.mandatoryApprovalRemarks),
      delegationAllowed: Boolean(approvalCfg.approvalDelegation),
      escalationEnabled: Boolean(approvalCfg.approvalEscalation),
      escalationAfterHours: Number(currentTier?.slaHours || approvalCfg.escalationAfterHours || 48),
    };
  },
};
