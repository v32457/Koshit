/**
 * CIPPLATFORM - PHASE 1 PURCHASE REQUEST (PR) DOMAIN TYPES
 * Extended with Enterprise Governance Requirements A–Q:
 * - Policy Snapshot preservation against each PR
 * - Approved PR Line Amendment History & Original Approved Value preservation
 * - Multi-Currency Budget & Exchange Rate Governance
 * - Versioned Header & Line Attachments with Upload/Download Audit Trail
 */

import {
  InventoryValidationSnapshot,
  BudgetValidationSnapshot,
} from './procurementFinanceGovernance';
import { FinancialYearTransactionSnapshot } from './financialYear';

export type PRType = 'MRP' | 'MANUAL' | 'REPAIR' | 'MAINTENANCE' | 'CAPEX_ASSET' | 'EXPENSE';

export type ProcurementMechanism = 'INVENTORY' | 'EXPENSE' | 'INVENTORY_PR' | 'EXPENSE_PR';

export type PRPriority = 'NORMAL' | 'URGENT' | 'CRITICAL';

export type PRStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_MANAGER_APPROVAL'
  | 'PENDING_SUBSEQUENT_APPROVAL'
  | 'PENDING_REAPPROVAL'
  | 'APPROVED'
  | 'APPROVED_PENDING_BUYER'
  | 'PENDING_BUYER_CONFIGURATION'
  | 'REJECTED'
  | 'RETURNED_FOR_CORRECTION'
  | 'RESUBMITTED'
  | 'WITHDRAWN'
  | 'SHORT_CLOSED'
  | 'CANCELLED'
  | 'ARCHIVED'
  | 'COMPLETED';

export interface PRDeliverySchedule {
  id: string;
  lineId: string;
  deliveryDate: string;
  quantity: number;
}

export type PRLineLockStatus =
  | 'AVAILABLE'
  | 'PARTIALLY_CONVERTED'
  | 'LOCKED'
  | 'SHORT_CLOSED'
  | 'CANCELLED';

export interface PRAttachmentAuditEntry {
  id: string;
  action: 'UPLOADED' | 'DOWNLOADED' | 'NEW_VERSION_ADDED' | 'DELETION_BLOCKED' | 'DELETED';
  actorId: string;
  actorName: string;
  timestamp: string;
  remarks?: string;
}

export interface PRAttachmentRecord {
  id: string;
  fileName: string;
  fileSize: number | string;
  fileType?: string;
  category?:
    | 'TECHNICAL_SPEC'
    | 'DRAWING'
    | 'MAINTENANCE_REQUEST'
    | 'REPAIR_REPORT'
    | 'QUOTATION'
    | 'SUPPORTING_APPROVAL'
    | 'BUDGET_JUSTIFICATION'
    | 'GENERAL';
  versionNumber?: number;
  isHistoricalApprovedVersion?: boolean;
  lockedForConvertedTransaction?: boolean;
  uploadedAt: string;
  uploadedBy?: string;
  url?: string;
  immutablePdfId?: string;
  immutablePdfHash?: string;
  auditHistory?: PRAttachmentAuditEntry[];
}

export interface PRAmendmentRecord {
  id: string;
  prId: string;
  prNumber: string;
  lineId: string;
  itemCode: string;
  amendmentNumber: number;
  amendmentReason: string;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  requiresReapproval: boolean;
  status: 'PENDING_REAPPROVAL' | 'APPROVED' | 'REJECTED';
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  approvalRemarks?: string;
  originalValues: {
    itemCode: string;
    description: string;
    requestedQuantity: number;
    approximateUnitPrice: number;
    estimatedTotalValue: number;
    expectedDeliveryDate?: string;
    specifications?: string;
  };
  proposedValues: {
    itemCode: string;
    description: string;
    requestedQuantity: number;
    approximateUnitPrice: number;
    estimatedTotalValue: number;
    expectedDeliveryDate?: string;
    specifications?: string;
  };
}

export interface PurchaseRequisitionLine {
  id: string;
  prId: string;
  itemCode: string;
  description: string;
  itemCategory: string;
  inventoryUom: string; // Authoritative UOM locked to Item Master
  requestedQuantity: number;
  approximateUnitPrice: number;
  currency: string;
  estimatedTotalValue: number;
  specifications?: string;
  purchasePurpose?: string;
  businessJustification?: string;
  remarks?: string;
  defaultWarehouse?: string;
  deliverySchedules: PRDeliverySchedule[];
  lineAttachments?: PRAttachmentRecord[];
  lineCharges?: PRChargeItem[];
  lineChargesTotalValue?: number;
  lineChargesTaxTotalValue?: number;
  taxCode?: string;
  gstRatePercent?: number;
  taxAmount?: number;
  sapTaxCode?: string;
  assignedBuyer?: string;
  buyerStatus?: 'PENDING_BUYER_ACTION' | 'PENDING_CONFIGURATION' | 'ACKNOWLEDGED';
  status: 'ACTIVE' | 'ARCHIVED' | 'SHORT_CLOSED' | 'CANCELLED' | 'REJECTED';
  approvedQuantity?: number;
  rejectedQuantity?: number;
  receivedQuantity?: number;
  // Original Approved Snapshot (Requirement E.7: Preserved during amendments)
  originalApprovedQuantity?: number;
  originalApprovedUnitPrice?: number;
  originalApprovedItemCode?: string;
  originalApprovedDeliveryDate?: string;
  // Governance & Line-Level Conversion / Closure Tracking
  convertedRfqQuantity?: number;
  convertedPoQuantity?: number;
  shortClosedQuantity?: number;
  cancelledQuantity?: number;
  rfqReferences?: string[];
  poReferences?: string[];
  lineLockStatus?: PRLineLockStatus;
  shortCloseReason?: string;
  shortCloseRemarks?: string;
  shortClosedBy?: string;
  shortClosedAt?: string;
  cancelReason?: string;
  cancelRemarks?: string;
  cancelledBy?: string;
  cancelledAt?: string;
}

export interface ExpensePrLineRecord {
  id: string;
  prId?: string;
  lineNumber?: number;
  expenseCategoryCode: string;
  expenseCategoryName: string;
  expenseCode?: string;
  description: string;
  expenseDescription?: string;
  quantity?: number;
  uom?: string;
  unitRate?: number;
  amount?: number;
  currency?: string;
  baseAmount: number;
  taxCode: string;
  gstRatePercent?: number;
  taxPercent?: number;
  taxRatePercent?: number;
  taxAmount: number;
  totalAmount?: number;
  totalWithTax?: number;
  totalAmountWithTax?: number;
  taxInclusive?: boolean;
  isTaxInclusive?: boolean;
  vendorOrPayee?: string;
  vendorSuggestion?: string;
  costCenter?: string;
  costCentre?: string;
  department?: string;
  serviceFromDate?: string;
  serviceToDate?: string;
  requiredDate?: string;
  expectedServiceDate?: string;
  sapServiceAccountCode?: string;
  sapGlAccountCode?: string;
  sapGlAccountName?: string;
  sapCostCenterCode?: string;
  sapExpenseCode?: string;
  sapTaxCode?: string;
  purchasePurpose?: string;
  businessJustification?: string;
  remarks?: string;
  attachments?: PRAttachmentRecord[];
  lineAttachments?: PRAttachmentRecord[];
  poReferences?: string[];
  convertedPoAmount?: number;
  status?: 'ACTIVE' | 'SHORT_CLOSED' | 'CANCELLED' | 'REJECTED';
}

export type SapIntegrationStatus =
  | 'NOT_STARTED'
  | 'PENDING'
  | 'INTEGRATED'
  | 'FAILED'
  | 'REQUIRES_RECONCILIATION';

export interface SapIntegrationHistoryEntry {
  id: string;
  timestamp: string;
  status: SapIntegrationStatus;
  action: string;
  actorId?: string;
  actorName: string;
  idempotencyKey?: string;
  sapDocEntry?: number;
  sapDocNum?: number | string;
  message?: string;
  errorCode?: string;
  errorMessage?: string;
  payloadSummary?: string;
}

export interface SapIntegrationTraceRecord {
  status: SapIntegrationStatus;
  targetEntity?: 'PurchaseRequests' | 'PurchaseOrders' | string;
  sapObjectType?: string;
  sapDocType: 'dDocument_Items' | 'dDocument_Service';
  sapDocEntry?: number;
  sapDocNum?: number | string;
  sapPrDocEntry?: number;
  sapPrDocNum?: number | string;
  sapCompanyDb?: string;
  serviceLayerUrl?: string;
  idempotencyKey?: string;
  attemptCount?: number;
  retryCount?: number;
  reconciliationRequired?: boolean;
  postingTimestamp?: string;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  errorCode?: string;
  errorMessage?: string;
  reconciledAt?: string;
  reconciledBy?: string;
  reconciliationNotes?: string;
  lastPayloadSnapshot?: Record<string, any>;
  payloadSnapshot?: Record<string, any>;
  transportMode?: 'SIMULATED_SERVICE_LAYER' | 'LIVE_SERVICE_LAYER';
  history: SapIntegrationHistoryEntry[];
}

export interface PRChangeHistory {
  id: string;
  prId: string;
  changedBy: string;
  changedByName: string;
  timestamp: string;
  reason: string;
  fieldDeltas: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  status: 'PENDING_REAPPROVAL' | 'APPROVED' | 'REJECTED';
}

export interface PRApprovalDecisionRecord {
  id: string;
  cycleNumber: number;
  level: string;
  decision:
    | 'SUBMITTED'
    | 'APPROVED'
    | 'RETURNED_FOR_CORRECTION'
    | 'RESUBMITTED'
    | 'REJECTED'
    | 'WITHDRAWN'
    | 'DELEGATED_APPROVAL'
    | 'ESCALATED';
  actorId: string;
  actorName: string;
  actorRole: string;
  delegatedOnBehalfOf?: string;
  remarks: string;
  timestamp: string;
}

export interface PRBudgetReleaseEntry {
  id: string;
  idempotencyKey?: string;
  actionType: 'SHORT_CLOSE' | 'CANCELLATION' | 'RECONCILIATION' | 'AMENDMENT_ADJUSTMENT';
  originalReservation: number;
  validCommitments: number;
  previouslyReleased: number;
  releasedAmount: number;
  currency: string;
  exchangeRateUsed?: number;
  exchangeRateRef?: string;
  exchangeRateDate?: string;
  reportingCurrency?: string;
  releasedAmountReportingCurrency?: number;
  reason: string;
  remarks: string;
  releasedBy: string;
  timestamp: string;
}

export interface PRBudgetGovernanceSummary {
  originalReservationAmount: number;
  outstandingCommittedAmount: number; // Existing RFQ/PO downstream commitments
  previouslyReleasedAmount: number;
  transactionCurrency?: string;
  companyReportingCurrency?: string;
  exchangeRateUsed?: number; // Preserved historical exchange rate at budget validation/reservation
  exchangeRateRef?: string; // e.g. 'FX-RBI-2026-11-01-USD-INR'
  exchangeRateDate?: string;
  originalReservationReportingCurrency?: number;
  outstandingCommittedReportingCurrency?: number;
  previouslyReleasedReportingCurrency?: number;
  reservationIdempotencyKey?: string;
  releaseIdempotencyKeys?: string[];
  releaseHistory: PRBudgetReleaseEntry[];
}

export interface PurchaseRequisitionHeader {
  id: string;
  prNumber: string; // e.g. PR-2026-0001
  prType: PRType;
  companyId: string;
  companyCode: string;
  companyName?: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  department: string;
  costCentre: string;
  projectCode?: string;
  requesterId: string;
  requesterName: string;
  requestedBy?: string;
  creatorId: string;
  creatorName: string;
  priority: PRPriority;
  status: PRStatus;
  purchasePurpose: string;
  purpose?: string;
  businessJustification: string;
  deliveryLocation: string;
  estimatedTotalValue: number;
  estimatedValue?: number;
  currency: string;
  expectedDeliveryDate?: string; // YYYY-MM-DD required/expected delivery date
  creationDate?: string; // Optional creation date alias
  requiredBy?: string; // Optional separately maintained required-by date
  modifiedBy?: string; // Last modified user display name
  purchaseOrganizationId?: string;
  purchaseOrgId?: string;
  financialPeriod?: string; // e.g. '2026-27'
  financialYearId?: string;
  financialYearCode?: string;
  accountingPeriodId?: string;
  accountingPeriodCode?: string;
  documentDate?: string;
  accountingPostingDate?: string;
  fySnapshot?: FinancialYearTransactionSnapshot;
  isDataQualityGap?: boolean;
  policyVersion?: string; // Governed policy version active at PR creation/submission
  policyEffectiveFrom?: string;
  policySnapshot?: Record<string, any>; // Requirement B.3/B.8: Immutable historical policy snapshot at transaction time
  duplicateOverrideJustification?: string; // Requirement G: Mandatory justification if duplicate warning overridden
  duplicateGovernanceKey?: string;
  duplicateGovernance?: PRDuplicateGovernanceSnapshot;
  approvalCycleCount?: number; // Increments on Resubmission after Return for Correction
  approvalHistory?: PRApprovalDecisionRecord[];
  amendmentHistory?: PRAmendmentRecord[]; // Requirement E: Controlled Approved PR Line Amendment History
  budgetGovernance?: PRBudgetGovernanceSummary;
  // Part K: Inventory Availability Validation Snapshots
  inventoryValidationSnapshot?: InventoryValidationSnapshot;
  inventoryValidationHistory?: InventoryValidationSnapshot[];
  // Part L: Budget Control Validation Snapshots
  budgetValidationSnapshot?: BudgetValidationSnapshot;
  budgetValidationHistory?: BudgetValidationSnapshot[];
  shortCloseReason?: string;
  shortCloseRemarks?: string;
  shortClosedBy?: string;
  shortClosedAt?: string;
  cancelReason?: string;
  cancelRemarks?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  withdrawnReason?: string;
  withdrawnBy?: string;
  withdrawnAt?: string;
  budgetValidationStatus:
    | 'NOT_VALIDATED'
    | 'SUFFICIENT'
    | 'INSUFFICIENT'
    | 'MISSING_ASSIGNMENT'
    | 'EXCEPTION_APPROVED';
  budgetSourceRef?: string;
  erpStockStatus: 'FRESH' | 'STALE' | 'UNAVAILABLE' | 'CHECKED';
  erpStockTimestamp?: string;
  equipmentId?: string; // Optional for Repair and Maintenance
  breakdownRef?: string; // Optional for Repair
  maintenanceScheduleRef?: string; // Optional for Maintenance
  mrpRunRef?: string; // Optional for MRP
  procurementMechanism?: ProcurementMechanism;
  expectedServiceDate?: string;
  expenseLines?: ExpensePrLineRecord[];
  inventorySubtotal?: number;
  inventoryTaxTotal?: number;
  headerChargesBaseTotal?: number;
  lineChargesBaseTotal?: number;
  applicableChargesTaxTotal?: number;
  expenseSubtotal?: number;
  expenseBaseTotal?: number;
  expenseTaxTotal?: number;
  sapIntegration?: SapIntegrationTraceRecord;
  sapIntegrationTrace?: SapIntegrationTraceRecord;
  optimisticVersion?: number; // Requirement M: Concurrent update conflict protection
  lines: PurchaseRequisitionLine[];
  items?: any[];
  chargeItems?: PRChargeItem[];
  chargesTotalValue?: number;
  grandTotalWithCharges?: number;
  changeHistory: PRChangeHistory[];
  attachments: PRAttachmentRecord[];
  immutablePdfRecordId?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
}

export type PRChargeApplicability = 'APPLICABLE' | 'AS_PER_FIXED_CHARGES' | 'NOT_APPLICABLE';

export type PRChargeType = 'FIXED' | 'PERCENTAGE' | 'AT_ACTUALS';

export type PRChargeCategory =
  | 'HANDLING'
  | 'STATUTORY'
  | 'LOGISTICS'
  | 'INSURANCE'
  | 'PACKAGING'
  | 'SERVICE'
  | 'OTHER';

export interface PRChargeItem {
  id: string;
  chargeCode: string;
  chargeName: string;
  category: PRChargeCategory;
  applicability: PRChargeApplicability;
  chargeType: PRChargeType;
  rateOrPercentage: number;
  currency?: string;
  estimatedAmount: number;
  isFixedChargeRule?: boolean;
  fixedChargeRate?: number;
  fixedChargeDescription?: string;
  gstRatePercent?: number;
  taxAmount?: number;
  totalWithTax?: number;
  payeeType?: 'SUPPLIER' | 'THIRD_PARTY_LOGISTICS' | 'CUSTOMS_AUTHORITY' | 'DIRECT_LABOR' | 'SERVICE_PROVIDER';
  remarks?: string;
  // Immutable Master & Company/Branch Mapping Governance Snapshot
  chargeMasterId?: string;
  chargeMasterVersion?: number;
  mappingId?: string;
  mappingVersion?: number;
  applicationLevel?: string;
  calculationMethod?: string;
  calculationBasis?: string;
  allocationBasis?: string;
  taxMappingId?: string;
  taxTreatment?: string;
  recoverableTax?: number;
  nonRecoverableTax?: number;
  mandateStatus?: 'MANDATORY' | 'OPTIONAL' | 'CONDITIONAL' | 'NOT_APPLICABLE';
  requiresApproval?: boolean;
  sourceScope?: 'COMPANY_INHERITED' | 'BRANCH_OVERRIDE' | 'MASTER_DEFAULT' | 'STANDARD_TEMPLATE';
  calculationInputs?: Record<string, any>;
  calculatedByBackend?: boolean;
  snapshotLockedAt?: string;
  sapExpenseCode?: string | number;
  sapExpenseName?: string;
  sapGlAccountCode?: string;
  taxCode?: string;
  chargeLevel?: 'HEADER' | 'LINE';
  prLineId?: string;
}

export interface PRChargesSummary {
  itemsSubtotal: number;
  inventoryTaxTotal?: number;
  applicableChargesCount: number;
  applicableChargesBaseTotal: number;
  applicableChargesTaxTotal: number;
  applicableChargesGrandTotal: number;
  grandTotalWithCharges: number;
  headerChargesBaseTotal?: number;
  headerChargesTaxTotal?: number;
  lineChargesBaseTotal?: number;
  lineChargesTaxTotal?: number;
  lineChargesCount?: number;
  expenseSubtotal?: number;
  expenseTaxTotal?: number;
}

export interface ImmutablePrPdfRecord {
  id: string;
  prId: string;
  prNumber: string;
  companyId: string;
  branchId: string;
  version: number;
  approvalCycleCount: number;
  statusAtArchive: PRStatus;
  policyVersion?: string;
  fileName: string;
  mimeType: 'application/pdf';
  fileSizeBytes: number;
  sha256Hash: string;
  pdfDataUri: string;
  approvedBy: string;
  approvedAt: string;
  archivedAt: string;
  autoPrinted: boolean;
  autoPrintedAt?: string;
  printCount: number;
  isImmutable: true;
}

export interface PRApplicabilityConfig {
  id: string;
  companyId: string;
  branchId: string; // 'ALL' or specific branch
  groupId: string; // 'ALL' or specific group
  prType: PRType | 'ALL';
  isEnabled: boolean;
  allowedAssetCategories?: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface PRCleanupConfig {
  isEnabled: boolean;
  ageThresholdDays: number; // e.g. 45 days
  calculationBasis: 'LINE_CREATION' | 'PR_CREATION' | 'LAST_SUBMISSION' | 'LAST_ACTIVITY';
  eligibleStatuses: PRStatus[];
  exemptUrgentCritical: boolean;
  executionMode: 'PREVIEW' | 'MANUAL_BULK' | 'SCHEDULED';
  advanceWarningDays: number;
}

export interface BranchPRCleanupPolicy {
  branchId: string;
  branchCode: string;
  branchName: string;
  ageThresholdDays: number; // e.g. 45 days
  advanceWarningDays: number; // e.g. 5 days before threshold for message initiation
  isEnabled: boolean;
  notifyRequesters: boolean;
  notifyApprovers: boolean;
  notifyBuyers: boolean;
  channels: Array<'IN_PORTAL' | 'EMAIL' | 'WHATSAPP'>;
  updatedAt: string;
  updatedBy: string;
}

export interface PRArchiveLog {
  id: string;
  prId: string;
  lineId?: string;
  prNumber: string;
  itemCode: string;
  archivedAt: string;
  archivedBy: string;
  reason: string;
  ageInDays: number;
  originalStatus: PRStatus;
  restoredAt?: string;
  restoredBy?: string;
}

export type DuplicateGovernanceState =
  | 'DETECTED'
  | 'ACKNOWLEDGED'
  | 'OVERRIDE_AUTHORISED'
  | 'STALE'
  | 'RESOLVED';

export type DuplicateOverrideApprovalStatus =
  | 'NOT_REQUESTED'
  | 'NOT_REQUIRED'
  | 'PROHIBITED_BY_POLICY'
  | 'PENDING_CHECKER_APPROVAL'
  | 'AUTHORISED'
  | 'REJECTED'
  | 'STALE'
  | 'SUPERSEDED';

export interface DuplicateMatchingPrRef {
  prId: string;
  prNumber: string;
  status: PRStatus;
  companyId: string;
  branchId: string;
  itemCode: string;
  requesterId: string;
  requesterName: string;
  existingQty: number;
  proposedQty: number;
  inventoryUom?: string;
  expectedDeliveryDate?: string;
  purchasePurpose?: string;
  quantityVariancePercent: number;
  createdAt: string;
  updatedAt?: string;
}

export interface DuplicateAcknowledgementRecord {
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
  matchingPrRefs: DuplicateMatchingPrRef[];
  policyVersion: string;
  warningLevelAtAck: 'WARNING_WITH_JUSTIFICATION' | 'HARD_BLOCK' | 'ADVISORY_ONLY';
  persistedVia: 'BACKEND_API' | 'LOCAL_STORE';
}

export interface DuplicateOverrideRecord {
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
    status: PRStatus;
    existingQty: number;
  }>;
  supersededByOverrideId?: string;
  supersededAt?: string;
  supersededReason?: string;
}

export interface DuplicateConditionRecord {
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
  matchingPrs: DuplicateMatchingPrRef[];
  warningLevel: 'WARNING_WITH_JUSTIFICATION' | 'HARD_BLOCK' | 'ADVISORY_ONLY';
  policyAllowsOverride: boolean;
  requiresCheckerApproval: boolean;
  policyReason: string;
  acknowledgement?: DuplicateAcknowledgementRecord;
  overrideRecord?: DuplicateOverrideRecord;
  submissionEligible: boolean;
  blockingReason?: string;
  staleReason?: string;
  lastEvaluatedAt: string;
}

export interface DuplicateAuditHistoryEntry {
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
    | 'SUBMISSION_BLOCKED'
    | 'SUBMISSION_PERMITTED';
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

export interface PRDuplicateGovernanceSnapshot {
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
    | 'PROHIBITED'
    | 'REJECTED'
    | 'STALE'
    | 'OVERRIDE_AUTHORISED';
  blockingReasons: string[];
  conditions: DuplicateConditionRecord[];
  auditHistory: DuplicateAuditHistoryEntry[];
}

