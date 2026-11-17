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

export type PRType = 'MRP' | 'MANUAL' | 'REPAIR' | 'MAINTENANCE' | 'CAPEX_ASSET';

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
  currency: string;
  estimatedAmount: number;
  isFixedChargeRule: boolean;
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
}

export interface PRChargesSummary {
  itemsSubtotal: number;
  applicableChargesCount: number;
  applicableChargesBaseTotal: number;
  applicableChargesTaxTotal: number;
  applicableChargesGrandTotal: number;
  grandTotalWithCharges: number;
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
