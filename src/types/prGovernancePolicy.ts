/**
 * CIPPLATFORM — MASTER PURCHASE REQUISITION GOVERNANCE POLICY TYPES
 * Multi-Company | Multi-Branch | General Settings → Purchase Requisition
 * Includes Enterprise Requirements A–Q:
 * - Maker-Checker Policy Administration & Rollback
 * - Effective Date Range (effectiveFrom / effectiveUntil) & Transaction Snapshots
 * - Multi-Company Data Isolation & Multi-Branch Procurement Policy
 * - Approved PR Line Amendment Governance
 * - Multi-Currency Budget & Exchange Rate Governance
 * - Configurable Duplicate PR Prevention
 * - Supporting Documents & Versioned Attachment Governance
 * - Approval Delegation & SLA Escalation
 * - Controlled Bulk Processing
 * - Policy Dependency Engine & Policy Simulation Sandbox
 * - Failure Recovery & Reconciliation Queue
 * - PR Numbering & Financial Period Controls
 * - Consolidated Security-Scoped Reporting
 */

import { PRStatus, PRType } from './purchaseRequisition';

export type PrPolicyScope = 'COMPANY' | 'BRANCH';

export type PrPolicyLifecycleStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'SUPERSEDED'
  | 'EXPIRED'
  | 'REJECTED';

export type PolicyAdminPermission =
  | 'VIEW_POLICY'
  | 'CREATE_POLICY'
  | 'MODIFY_POLICY'
  | 'APPROVE_POLICY'
  | 'ACTIVATE_POLICY';

export interface PrApprovalMatrixTier {
  id: string;
  levelNumber: number;
  levelName: string;
  minAmount: number;
  maxAmount: number | null; // null = Unlimited
  currency: string;
  approverRole: string;
  branchScoped: boolean;
  departmentScoped: boolean;
  slaHours: number;
  alternateApproverRole?: string;
}

export interface PrGovernanceActivationSettings {
  prModuleEnabled: boolean;
  manualPrCreationEnabled: boolean;
  mrpPrCreationEnabled: boolean;
  repairPrEnabled: boolean;
  maintenancePrEnabled: boolean;
  capexAssetPrEnabled?: boolean;
  expensePrEnabled?: boolean;
  allowSameChargeAtHeaderAndLine?: boolean;
  taxInclusivePricingSupported?: boolean;
  includeTaxInBudgetBasis?: boolean;
  prEditingEnabled: boolean;
  prSubmissionEnabled: boolean;
  prApprovalEnabled: boolean;
  prReturnForCorrectionEnabled: boolean;
  prWithdrawalEnabled: boolean;
  prCancellationEnabled: boolean;
  prShortCloseEnabled: boolean;
  rfqConversionEnabled: boolean;
  poConversionEnabled: boolean;
  partialConversionEnabled: boolean;
  expectedDeliveryDateEnabled: boolean;
  expectedDeliveryDateMandatory?: boolean;
  budgetValidationEnabled: boolean;
  mandatoryRemarksEnabled: boolean;
  prAuditTrailEnabled: true; // Mandatory immutable true
}

export interface PrApprovalPolicySettings {
  enableApprovalWorkflow: boolean;
  approvalLevels: number;
  approvalMatrix: PrApprovalMatrixTier[];
  branchLevelApprovers: boolean;
  departmentLevelApprovers: boolean;
  amountBasedApproval: boolean;
  managerL1Approval: boolean;
  additionalApprovalLevels: boolean;
  approvalEscalation: boolean;
  escalationAfterHours: number;
  approvalDelegation: boolean;
  approvalNotifications: boolean;
  mandatoryApprovalRemarks: boolean;
  returnForCorrection: boolean;
  mandatoryReturnReason: boolean;
  resubmissionAllowed: boolean;
  retainSamePrNumberOnResubmit: boolean;
  withdrawalBeforeApproval: boolean;
  allowTerminalReject: boolean;
  requireDelegationApproval?: boolean;
  pendingApprovalReminderHours?: number;
}

export interface PrEditingAndLockingSettings {
  draftPrEditing: boolean;
  pendingApprovalEditing: false; // Mandatory business rule #2: Pending Approval PRs are not editable
  returnedPrEditing: boolean; // Mandatory business rule #3: Returned PRs can be corrected and resubmitted
  approvedPrHeaderLock: true; // Mandatory business rule #4: Approved PR headers are immutable
  approvedPrLineLock: boolean;
  convertedLineLock: true; // Mandatory business rule #5: Converted PR lines are permanently locked
  unconvertedLineEditing: boolean; // Mandatory business rule #6: Unconverted lines may be edited/amended where policy permits
  requireReapprovalOnApprovedLineEdit: boolean; // Rule #7: Changes to approved unconverted lines follow amendment/reapproval
  shortClosedPrLock: true; // Rule #8: Short Closed lines are read-only
  cancelledPrLock: true; // Rule #8: Cancelled lines are read-only
  rejectedPrLock: true; // Rule #9: Terminal records cannot be reopened
  withdrawnPrLock: true;
  allowApprovedLineAmendment?: boolean; // Requirement E: Controlled amendment of unconverted approved lines
  amendmentPriceIncreaseTolerancePercent?: number; // Above this % requires reapproval even if minor amendment allowed
}

export interface PrPartialConversionSettings {
  enablePartialRfqConversion: boolean;
  enablePartialPoConversion: boolean;
  allowMultipleRfqReferences: boolean;
  allowMultiplePoReferences: boolean;
  convertedQuantityTracking: boolean;
  remainingQuantityTracking: boolean;
  lineLevelConversionLock: true; // Selected business rule: LINE-LEVEL LOCKING
  conversionApprovalValidation: boolean;
}

export interface PrShortClosePolicySettings {
  enableShortClose: boolean;
  applicablePrTypes: PRType[];
  applicablePrStatuses: PRStatus[];
  authorizedRoles: string[];
  mandatoryReason: boolean;
  mandatoryRemarks: boolean;
  budgetReconciliationRequired: boolean;
  notificationRequired: boolean;
  allowLineLevelShortClose: boolean;
  requireApprovalForShortClose: boolean;
}

export interface PrCancellationPolicySettings {
  enablePrCancellation: boolean;
  applicablePrTypes: PRType[];
  applicablePrStatuses: PRStatus[];
  authorizedRoles: string[];
  mandatoryCancellationReason: boolean;
  mandatoryCancellationRemarks: boolean;
  budgetReconciliationRequired: boolean;
  notificationRequired: boolean;
  allowLineLevelCancellation: boolean;
  requireAdditionalApproval: boolean;
}

export interface PrBudgetGovernanceSettings {
  enableBudgetValidation: boolean;
  mandatoryBudgetCheck: boolean;
  budgetReservationOnApproval: boolean;
  autoUncommittedBudgetRelease: boolean;
  budgetReleaseOnShortClose: boolean;
  budgetReleaseOnCancellation: boolean;
  preservePoCommitments: true;
  preventDuplicateBudgetRelease: true;
  budgetReconciliationAudit: true;
  companyReportingCurrency?: string; // Requirement F: e.g. 'INR'
  enforceHistoricalExchangeRateOnRelease?: true; // Requirement F.5: Never release using unrelated current exchange rate
}

export interface PrRfqPoIntegrationSettings {
  enablePrToRfqConversion: boolean;
  enablePrToPoConversion: boolean;
  enablePartialRfqConversion: boolean;
  enablePartialPoConversion: boolean;
  validateApprovedPr: boolean;
  validateEligiblePrLines: boolean;
  validateRemainingQuantity: boolean;
  validateBudget: boolean;
  preventDuplicateConversion: boolean;
  preserveConversionReferences: boolean;
}

export interface PrNotificationPolicySettings {
  prSubmissionNotification: boolean;
  approvalNotification: boolean;
  returnForCorrectionNotification: boolean;
  resubmissionNotification: boolean;
  shortCloseNotification: boolean;
  cancellationNotification: boolean;
  rfqConversionNotification: boolean;
  poConversionNotification: boolean;
  budgetReleaseNotification: boolean;
  buyerAssignmentNotification: boolean;
  enabledChannels: Array<'EMAIL' | 'WHATSAPP' | 'NOTIFICATION_CENTRE'>;
}

export interface PrAuditAndSecuritySettings {
  mandatoryAuditTrail: true;
  prStatusChangeAudit: true;
  lineLevelChangeAudit: true;
  approvalHistory: true;
  conversionHistory: true;
  shortCloseHistory: true;
  cancellationHistory: true;
  budgetReleaseHistory: true;
  configurationChangeHistory: true;
}

/**
 * Requirement D: Multi-Branch Procurement Policy Settings
 */
export interface PrMultiBranchProcurementSettings {
  branchSpecificPrCreation: boolean;
  branchSpecificApprovalMatrix: boolean;
  crossBranchProcurementAuthorized: boolean;
  centralizedBuyerAssignment: boolean;
  centralizedProcurementVisibility: boolean;
  designatedCentralBuyerIds: string[];
  branchBudgetValidation: boolean;
  branchLevelShortClosePermitted: boolean;
  branchLevelCancellationPermitted: boolean;
  branchSpecificNumbering: boolean;
}

/**
 * Requirement G: Duplicate PR Prevention Policy Settings
 */
export interface PrDuplicatePreventionSettings {
  enableDuplicateDetection: boolean;
  checkSameCompany: true;
  checkSameBranch: boolean;
  checkSameRequester: boolean;
  checkSameItem: boolean;
  checkSamePurpose: boolean;
  checkSameRequirementDate: boolean;
  checkSimilarQuantity: boolean;
  quantityVarianceTolerancePercent: number; // e.g. 15%
  warningLevel: 'WARNING_WITH_JUSTIFICATION' | 'HARD_BLOCK' | 'ADVISORY_ONLY';
  requireJustificationToProceed: boolean;
  allowOverride?: boolean;
  requireCheckerApprovalForOverride?: boolean;
  authorizedOverrideRoles?: string[];
  checkerApprovalRoles?: string[];
}

/**
 * Requirement H: Supporting Documents & Attachment Governance Settings
 */
export interface PrAttachmentPolicySettings {
  allowHeaderAttachments: boolean;
  allowLineAttachments: boolean;
  allowedFileTypes: string[]; // e.g. ['PDF', 'PNG', 'JPG', 'DOCX', 'XLSX', 'DWG']
  maxFileSizeMb: number; // e.g. 25
  preserveOnReturnAndResubmit: true;
  retainHistoricalVersionsOnApproved: true;
  lockDeletionOnConvertedTransactions: true;
  auditUploadAndDownload: true;
}

/**
 * Requirement N: PR Numbering and Financial Period Controls
 */
export interface PrNumberingAndPeriodSettings {
  numberingScope: 'COMPANY' | 'BRANCH' | 'COMPANY_AND_FY' | 'COMPANY_BRANCH_FY';
  prPrefix: string; // e.g. 'PR'
  includeCompanyCode: boolean;
  includeBranchCode: boolean;
  includeFinancialYear: boolean;
  activeFinancialYear: string; // e.g. '2026-27' or '2026'
  sequenceDigits: number; // e.g. 4 -> 0001
  nextSequenceNumber: number;
  sequenceLockedAfterTransactions: boolean;
  openPeriodStart: string; // YYYY-MM-DD
  openPeriodEnd: string; // YYYY-MM-DD
  closedFinancialPeriods: string[]; // e.g. ['2024-25', '2025-Q1']
  restrictClosedPeriodTransactions: boolean;
  allowBackdatedPr: boolean;
  maxBackdateDays: number;
}

/**
 * Keys in `activation` that a Company Policy can mark as Centrally Controlled
 * (so branches cannot override them even when branch override mode is enabled).
 */
export type PrActivationFieldKey = keyof PrGovernanceActivationSettings;

export interface PrGovernancePolicyConfig {
  id: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  branchId: string; // 'ALL' for Level 1 Company Policy, or specific branchId for Level 2 Branch Policy
  branchCode: string;
  branchName: string;
  policyScope: PrPolicyScope;
  isInheritedFromCompany: boolean;
  allowBranchOverride: boolean;
  /**
   * Settings marked by Company Policy as Centrally Controlled.
   * Branches are strictly prohibited from overriding any key listed here.
   */
  centrallyControlledFields: string[];
  policyOwner: string;
  effectiveStatus: PrPolicyLifecycleStatus;
  policyVersion: string; // e.g. 'v1.0', 'v1.1'
  effectiveFrom: string; // YYYY-MM-DD
  effectiveUntil?: string; // Optional YYYY-MM-DD (Requirement B.2)
  createdBy: string;
  createdByUserId?: string;
  createdAt?: string;
  modifiedBy: string;
  modifiedByUserId?: string;
  modifiedAt: string; // ISO UTC
  approvedBy?: string;
  approvedByUserId?: string;
  approvedAt?: string;
  activatedBy?: string;
  activatedByUserId?: string;
  activatedAt?: string;
  requireMakerCheckerApproval?: boolean;
  remarks?: string;

  // Section Configurations
  activation: PrGovernanceActivationSettings;
  approval: PrApprovalPolicySettings;
  editingAndLocking: PrEditingAndLockingSettings;
  partialConversion: PrPartialConversionSettings;
  shortClose: PrShortClosePolicySettings;
  cancellation: PrCancellationPolicySettings;
  budget: PrBudgetGovernanceSettings;
  rfqPoIntegration: PrRfqPoIntegrationSettings;
  notifications: PrNotificationPolicySettings;
  auditAndSecurity: PrAuditAndSecuritySettings;

  // Extended Enterprise Governance Sections (Requirements D, G, H, N)
  multiBranchProcurement?: PrMultiBranchProcurementSettings;
  duplicatePrevention?: PrDuplicatePreventionSettings;
  attachmentGovernance?: PrAttachmentPolicySettings;
  numberingAndPeriod?: PrNumberingAndPeriodSettings;
}

export interface PrPolicyVersionRecord {
  id: string;
  policyId: string;
  companyId: string;
  companyCode: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  policyScope: PrPolicyScope;
  policyVersion: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'SUPERSEDED' | 'EXPIRED' | 'REJECTED' | 'HISTORICAL';
  createdBy: string;
  createdByUserId?: string;
  createdAt?: string;
  modifiedBy: string;
  modifiedByUserId?: string;
  modifiedAt: string;
  approvedBy?: string;
  approvedByUserId?: string;
  approvedAt?: string;
  activatedBy?: string;
  activatedByUserId?: string;
  activatedAt?: string;
  changeSummary: string;
  previousValues?: Partial<PrGovernancePolicyConfig>;
  newValues?: Partial<PrGovernancePolicyConfig>;
  rollbackTargetVersion?: string;
  snapshot: PrGovernancePolicyConfig;
}

/**
 * Requirement I: Approval Delegation & Escalation Records
 */
export interface PrApprovalDelegationRecord {
  id: string;
  companyId: string;
  branchId: string; // 'ALL' or specific branchId
  delegatorUserId: string;
  delegatorName: string;
  delegatorRole: string;
  delegateeUserId: string;
  delegateeName: string;
  delegateeRole: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  maxApprovalAmount: number | null;
  currency: string;
  scopeDescription: string;
  approvalStatus: 'PENDING_APPROVAL' | 'APPROVED' | 'EXPIRED' | 'REVOKED';
  approvedBy?: string;
  createdAt: string;
}

export interface PrApprovalEscalationRecord {
  id: string;
  prId: string;
  prNumber: string;
  companyId: string;
  branchId: string;
  approvalLevel: string;
  originalApproverRole: string;
  escalatedToRole: string;
  slaHours: number;
  elapsedHours: number;
  escalatedAt: string;
  status: 'REMINDER_SENT' | 'ESCALATED_TO_ALTERNATE' | 'RESOLVED';
  remarks: string;
}

/**
 * Requirement M: Failure Recovery and Reconciliation Queue
 */
export type PrFailureOperationType =
  | 'FAILED_RFQ_CONVERSION'
  | 'FAILED_PO_CONVERSION'
  | 'FAILED_BUDGET_RESERVATION'
  | 'FAILED_BUDGET_RELEASE'
  | 'FAILED_NOTIFICATION'
  | 'INTERRUPTED_SHORT_CLOSE'
  | 'INTERRUPTED_CANCELLATION'
  | 'CONCURRENT_UPDATE_CONFLICT';

export interface PrReconciliationQueueItem {
  id: string;
  idempotencyKey: string;
  operationType: PrFailureOperationType;
  prId: string;
  prNumber: string;
  companyId: string;
  branchId: string;
  errorMessage: string;
  lastValidStateSnapshot: any;
  attemptedPayload: any;
  status: 'UNRESOLVED' | 'RECONCILED' | 'RETRIED_SUCCESS' | 'DISMISSED';
  createdAt: string;
  reconciledBy?: string;
  reconciledAt?: string;
  reconciliationReason?: string;
}

/**
 * Requirement L: Policy Simulation Input & Result
 */
export interface PrPolicySimulationInput {
  companyId: string;
  branchId: string;
  userRole: string;
  prType: PRType;
  prStatus: PRStatus;
  conversionStatus: 'UNCONVERTED' | 'PARTIALLY_CONVERTED' | 'FULLY_CONVERTED';
  estimatedAmount?: number;
  currency?: string;
  evaluationDate?: string;
  draftPolicyOverride?: PrGovernancePolicyConfig;
}

export interface PrPolicySimulationResult {
  effectivePolicyVersion: string;
  resolutionSource: 'BRANCH_OVERRIDE' | 'COMPANY_INHERITED' | 'SYSTEM_DEFAULT';
  effectiveFrom: string;
  effectiveUntil?: string;
  isPolicyActiveOnDate: boolean;
  availableActions: Array<{ action: PrGovernedActionType; label: string }>;
  restrictedActions: Array<{ action: PrGovernedActionType; label: string; reason: string }>;
  approvalRequirements: {
    workflowEnabled: boolean;
    requiredLevels: number;
    matchingTiers: PrApprovalMatrixTier[];
    slaHours: number;
    delegationAllowed: boolean;
  };
  budgetRequirements: {
    validationEnabled: boolean;
    mandatoryCheck: boolean;
    reservationOnApproval: boolean;
    autoReleaseOnShortCloseOrCancel: boolean;
    reportingCurrency: string;
  };
  expectedWorkflowOutcome: string;
}

export type PrGovernedActionType =
  | 'VIEW_PR_MODULE'
  | 'CREATE_PR'
  | 'CREATE_MANUAL_PR'
  | 'CREATE_MRP_PR'
  | 'CREATE_REPAIR_PR'
  | 'CREATE_MAINTENANCE_PR'
  | 'CREATE_CAPEX_PR'
  | 'CREATE_EXPENSE_PR'
  | 'EDIT_PR_HEADER'
  | 'EDIT_PR_LINES'
  | 'AMEND_APPROVED_PR_LINE'
  | 'SUBMIT_PR'
  | 'APPROVE_PR'
  | 'RETURN_FOR_CORRECTION'
  | 'RESUBMIT_PR'
  | 'WITHDRAW_PR'
  | 'SHORT_CLOSE_PR'
  | 'CANCEL_PR'
  | 'CONVERT_TO_RFQ'
  | 'PARTIAL_CONVERT_TO_RFQ'
  | 'CONVERT_TO_PO'
  | 'PARTIAL_CONVERT_TO_PO';

export interface PrActionValidationResult {
  allowed: boolean;
  reason?: string;
  effectivePolicyVersion: string;
  resolutionSource: 'BRANCH_OVERRIDE' | 'COMPANY_INHERITED' | 'SYSTEM_DEFAULT';
}
