/**
 * CIPPLATFORM — ENTERPRISE PROCUREMENT & FINANCE GOVERNANCE TYPES (PARTS K, L, M, N, O, P, Q)
 * Covers:
 * - Part K: Inventory Availability Validation & Historical Snapshots
 * - Part L: Budget Validation, Financial Control & Multi-Stage Commitment Reconciliation
 * - Part M: Supplier Quotation Submission (Portal + Email, Sealed Opening, Buyer Verification)
 * - Part N: Direct Purchase Order Without RFQ & Policy Exemption Governance
 * - Part O: Configurable Invoice Matching (2-Way & 3-Way, Tolerances, Partial/Multi GRN & Invoice)
 * - Part P: Historical Configuration Immutability
 */

import { FinancialYearTransactionSnapshot } from './financialYear';
import type { ItemStockAgingSummary } from '../services/inventoryAgingService';

// ============================================================================
// PART K — INVENTORY AVAILABILITY VALIDATION
// ============================================================================

export type InventoryValidationStage =
  | 'ON_PR_CREATION'
  | 'ON_PR_SUBMISSION'
  | 'ON_PR_APPROVAL'
  | 'ON_BUYER_ASSIGNMENT'
  | 'ON_RFQ_CREATION'
  | 'ON_RFQ_AWARD'
  | 'ON_PO_CREATION'
  | 'ON_PO_RELEASE';

export type InventoryEnforcementMode =
  | 'INFORMATION_ONLY'
  | 'WARNING'
  | 'BLOCK_APPROVAL'
  | 'REQUIRE_EXCEPTION_APPROVAL';

export type AvailableStockCalculationMode =
  | 'PHYSICAL_MINUS_RESERVED'
  | 'PHYSICAL_MINUS_RESERVED_AND_ALLOCATED';

export type StockVisibilityScope = 'WAREHOUSE' | 'BRANCH' | 'COMPANY';

export type CrossBranchUsabilityMode =
  | 'DISABLED'
  | 'VISIBILITY_ONLY'
  | 'TRANSFER_REQUIRED'
  | 'AUTHORIZED_EXCEPTION';

export type WarehouseSelectionMode =
  | 'DEFAULT_WAREHOUSE_ONLY'
  | 'ALL_ELIGIBLE_IN_BRANCH'
  | 'PRIORITY_ORDER'
  | 'SPECIFIC_WAREHOUSES';

export interface InventoryValidationPolicyConfig {
  id: string;
  companyId: string;
  companyCode: string;
  branchId: string; // 'ALL' or specific branchId
  branchCode: string;
  branchName: string;
  warehouseCode: string; // 'ALL' or specific warehouse code
  itemCategory: string; // 'ALL' or specific category
  itemCode?: string; // 'ALL' or specific item code
  inventoryLocation: string; // 'ALL' or specific bin/bay location
  isEnabled: boolean;
  validationStage: InventoryValidationStage;
  revalidationStages?: InventoryValidationStage[];
  availableStockCalculation: AvailableStockCalculationMode;
  considerReservedStock: boolean;
  considerAllocatedStock?: boolean;
  considerIncomingStock: boolean; // For planning visibility; incoming stock is NEVER treated as physical available stock
  includeQualityInspectionStock?: boolean;
  includeBlockedStock?: boolean;
  includeRejectedStock?: boolean;
  stockVisibilityScope?: StockVisibilityScope;
  crossBranchVisibilityEnabled?: boolean;
  crossBranchUsability?: CrossBranchUsabilityMode;
  warehouseSelectionMode?: WarehouseSelectionMode;
  inventoryAgingEnabled?: boolean;
  prAgingEnabled?: boolean;
  expiryValidationEnabled?: boolean;
  excludeExpiredStock?: boolean;
  nearExpiryThresholdDays?: number; // Default 30 (configurable e.g. 30/60/90)
  enforcementMode: InventoryEnforcementMode;
  changeReason?: string;
  previousPolicyVersion?: number;
  version: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  status: 'ACTIVE' | 'SUPERSEDED' | 'DRAFT';
  createdBy: string;
  approvedBy?: string;
  updatedAt: string;
}

export interface InventoryBatchLotRecord {
  batchNo: string;
  warehouseCode: string;
  binLocation: string;
  receiptDate?: string | null; // YYYY-MM-DD — NEVER fabricated if missing
  expiryDate?: string | null; // YYYY-MM-DD — null if non-expiring
  isPerishable?: boolean;
  quantity: number;
  reservedQuantity?: number;
  qualityStatus?: 'RELEASED' | 'QUALITY_INSPECTION' | 'BLOCKED' | 'REJECTED';
}

export interface InventoryBalanceRecord {
  id: string;
  companyId: string;
  branchId: string;
  branchName?: string;
  warehouseCode: string;
  warehouseName: string;
  inventoryLocation: string;
  itemCode: string;
  itemDescription: string;
  itemCategory: string;
  uom: string;
  physicalStock: number;
  reservedStock: number;
  allocatedStock: number;
  incomingStock: number; // Open PO stock — NEVER treated as physically available
  stockInTransit?: number; // Dispatched inter-branch transfer not yet received — NEVER treated as physically available
  qualityInspectionStock?: number;
  blockedStock?: number;
  rejectedStock?: number;
  isPerishable?: boolean;
  batches?: InventoryBatchLotRecord[];
  lastUpdated: string;
}

export interface WarehouseAvailabilityBreakdown {
  companyId: string;
  branchId: string;
  branchName: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseType: string;
  warehousePriority: number;
  inventoryLocation: string;
  eligibleForLocalValidation: boolean;
  exclusionReason?: string;
  isCrossBranchVisible: boolean;
  isCrossBranchTransferEligible: boolean;
  physicalStock: number;
  reservedStock: number;
  allocatedStock: number;
  expiredExcludedStock: number;
  availableStock: number;
  incomingStock: number;
  stockInTransit: number;
  qualityInspectionStock: number;
  blockedStock: number;
  rejectedStock: number;
  expectedAvailableStock: number;
  recommendedIssueMethod: 'FIFO' | 'FEFO' | 'NOT_APPLICABLE';
  recommendedBatchOrder: string[];
}

export interface CompanyWideStockSummary {
  itemCode: string;
  uom: string;
  crossBranchVisibilityPermitted: boolean;
  crossBranchPolicyMode: CrossBranchUsabilityMode;
  policyRestrictionMessage?: string;
  localBranchEligibleStock: number;
  otherBranchVisibleStock: number;
  companyWideVisibleTotal: number;
  transferEligibleStock: number;
  transferIneligibleStock: number;
  localShortage: number;
  potentialCompanySourcingShortage: number;
  otherBranchRows: WarehouseAvailabilityBreakdown[];
}

export interface InventoryLineValidationResult {
  lineId?: string;
  itemCode: string;
  itemDescription: string;
  itemCategory: string;
  warehouseCode: string;
  inventoryLocation: string;
  uom: string;
  physicalStock: number;
  reservedStock: number;
  allocatedStock: number;
  availableStock: number; // Strictly Physical - Reserved (- Allocated) - Expired; NEVER includes incoming/in-transit/other-branch
  incomingStock: number;
  stockInTransit: number;
  qualityInspectionStock: number;
  blockedStock: number;
  rejectedStock: number;
  expiredStock: number;
  expectedAvailableStock: number; // availableStock + incomingStock (planning visibility only)
  requiredPrQuantity: number;
  originalRequestedQuantity: number; // Preserved even when stock changes
  shortageQuantity: number; // Math.max(0, requiredPrQuantity - availableStock)
  fulfillableFromStockQuantity: number; // Math.min(requiredPrQuantity, availableStock)
  isShortage: boolean;
  isStockAlreadyAvailable: boolean;
  hasNearExpiryWarning?: boolean;
  hasExpiredStockExcluded?: boolean;
  calculationMethodSummary?: string;
  warehouseBreakdowns?: WarehouseAvailabilityBreakdown[];
  companyWideSummary?: CompanyWideStockSummary;
  stockAgingSummary?: ItemStockAgingSummary;
  message: string;
}

export interface InventoryExceptionApprovalRecord {
  id: string;
  prId: string;
  prNumber: string;
  companyId?: string;
  branchId?: string;
  exceptionType?: 'SHORTAGE_OVERRIDE' | 'CROSS_BRANCH_EXCEPTION';
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  exceptionReason: string;
  shortageSummary: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  approverRemarks?: string;
}

export interface InventoryRevalidationDelta {
  itemCode: string;
  previousAvailableStock: number;
  currentAvailableStock: number;
  availableStockDelta: number;
  previousShortage: number;
  currentShortage: number;
  shortageDelta: number;
  summary: string;
}

export interface InventoryValidationSnapshot {
  snapshotId: string;
  stage: InventoryValidationStage;
  validatedAt: string;
  validatedBy: string;
  companyId: string;
  branchId: string;
  policyId: string;
  policyVersion: number;
  policyEffectiveFrom: string;
  stockAgingConfigVersion?: number;
  prAgingConfigVersion?: number;
  isEnabled: boolean;
  enforcementMode: InventoryEnforcementMode;
  crossBranchMode?: CrossBranchUsabilityMode;
  overallOutcome:
    | 'VALIDATION_DISABLED'
    | 'INFORMATION_LOGGED'
    | 'WARNING_ACKNOWLEDGED'
    | 'SUFFICIENT_OR_CLEAR'
    | 'BLOCKED_BY_POLICY'
    | 'PENDING_EXCEPTION_APPROVAL'
    | 'EXCEPTION_APPROVED'
    | 'TRANSFER_RECOMMENDED';
  canProceedCreation: boolean;
  canProceedSubmission: boolean;
  canProceedApproval: boolean;
  requiresExceptionApproval: boolean;
  lineResults: InventoryLineValidationResult[];
  exceptionRecord?: InventoryExceptionApprovalRecord;
  deltasFromPrevious?: InventoryRevalidationDelta[];
}

export type InventoryTransferStatus =
  | 'REQUESTED'
  | 'APPROVED_PENDING_DISPATCH'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'REJECTED'
  | 'CANCELLED';

export interface InventoryTransferRecord {
  id: string;
  transferNumber: string;
  companyId: string;
  sourceBranchId: string;
  sourceBranchName: string;
  sourceWarehouseCode: string;
  destinationBranchId: string;
  destinationBranchName: string;
  destinationWarehouseCode: string;
  prId?: string;
  prNumber?: string;
  itemCode: string;
  itemDescription: string;
  uom: string;
  requestedQuantity: number;
  dispatchedQuantity?: number;
  receivedQuantity?: number;
  status: InventoryTransferStatus;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  reason: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  dispatchedAt?: string;
  receivedById?: string;
  receivedByName?: string;
  receivedAt?: string;
  rejectionReason?: string;
}

// ============================================================================
// PART L — BUDGET VALIDATION AND FINANCIAL CONTROL
// ============================================================================

export type BudgetValidationStage =
  | 'PR_SUBMISSION'
  | 'PR_APPROVAL'
  | 'RFQ_AWARD'
  | 'PO_CREATION'
  | 'PO_AMENDMENT';

export type BudgetEnforcementMode =
  | 'NO_VALIDATION'
  | 'WARNING_ONLY'
  | 'BLOCK_WHEN_INSUFFICIENT'
  | 'ALLOW_WITH_EXCEPTION_APPROVAL';

export type BudgetPeriodType = 'ANNUAL' | 'QUARTERLY' | 'MONTHLY';

export interface BudgetValidationPolicyConfig {
  id: string;
  companyId: string;
  companyCode: string;
  branchId: string; // 'ALL' or specific branchId
  branchCode: string;
  department: string; // 'ALL' or specific department
  costCenter: string; // 'ALL' or specific cost center
  projectCode: string; // 'ALL' or specific project code
  financialYear: string; // e.g. 'FY 2026-27'
  budgetPeriod: BudgetPeriodType;
  applicableExpenseCategory: string; // 'ALL' | 'OPEX' | 'CAPEX' | specific category
  isEnabled: boolean;
  validationStage: BudgetValidationStage;
  enforcementMode: BudgetEnforcementMode;
  version: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  status: 'ACTIVE' | 'SUPERSEDED' | 'DRAFT';
  createdBy: string;
  approvedBy?: string;
  updatedAt: string;
}

export interface BudgetControlLedgerRecord {
  id: string;
  companyId: string;
  branchId: string;
  department: string;
  costCenter: string;
  projectCode: string;
  financialYear: string;
  budgetPeriod: BudgetPeriodType;
  expenseCategory: string; // 'OPEX' | 'CAPEX' | 'ALL'
  currency: string;
  approvedBudget: number;
  revisedBudget: number; // Tracks authorized budget revisions; NEVER auto-increased by PR exception approval
  committedAmount: number; // Active reconciled commitments across PR/RFQ/PO
  actualExpenditure: number; // Posted invoices / settled expenditure
  pendingCommitments: number; // In-flight draft/pending reservations
  availableBudget: number; // revisedBudget - committedAmount - actualExpenditure - pendingCommitments
  revisionHistory: Array<{
    revisionId: string;
    previousRevisedBudget: number;
    newRevisedBudget: number;
    reason: string;
    approvedBy: string;
    timestamp: string;
  }>;
  updatedAt: string;
}

export interface BudgetStageCommitmentEntry {
  id: string;
  budgetLedgerId: string;
  sourceChainId: string; // Unique chain key (e.g. PR ID / PR Number) shared across PR -> RFQ Award -> PO so commitments never double-count
  prId?: string;
  prNumber?: string;
  rfqId?: string;
  rfqNumber?: string;
  poId?: string;
  poNumber?: string;
  currentStage: 'PR_SUBMITTED' | 'PR_APPROVED' | 'RFQ_AWARDED' | 'PO_CREATED' | 'PO_AMENDED' | 'RELEASED';
  activeCommittedAmount: number;
  stageHistory: Array<{
    stage: BudgetValidationStage | 'RELEASED';
    documentNumber: string;
    previousAmount: number;
    newAmount: number;
    deltaAppliedToLedger: number;
    timestamp: string;
    actorName: string;
  }>;
  updatedAt: string;
}

export interface BudgetExceptionApprovalRecord {
  id: string;
  exceptionReference: string; // e.g. 'BGT-EXC-2026-0001'
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
  requestedAt: string;
  routingLevel: 'FINANCE_CONTROLLER' | 'CFO_MANAGEMENT_COMMITTEE';
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  approvalRemarks?: string;
}

export interface BudgetValidationSnapshot {
  snapshotId: string;
  stage: BudgetValidationStage;
  validatedAt: string;
  validatedBy: string;
  companyId: string;
  branchId: string;
  department: string;
  costCenter: string;
  projectCode: string;
  financialYear: string;
  budgetPeriod: BudgetPeriodType;
  expenseCategory: string;
  policyId: string;
  policyVersion: number;
  policyEffectiveFrom: string;
  isEnabled: boolean;
  enforcementMode: BudgetEnforcementMode;
  approvedBudget: number;
  revisedBudget: number;
  committedAmount: number;
  actualExpenditure: number;
  pendingCommitments: number;
  availableBudget: number;
  proposedPrAmount: number;
  remainingBudgetAfterPr: number;
  budgetShortfall: number;
  isSufficient: boolean;
  overallOutcome:
    | 'VALIDATION_DISABLED'
    | 'SUFFICIENT'
    | 'WARNING_SHORTFALL'
    | 'BLOCKED_INSUFFICIENT_BUDGET'
    | 'PENDING_EXCEPTION_APPROVAL'
    | 'EXCEPTION_APPROVED';
  canProceed: boolean;
  requiresExceptionApproval: boolean;
  exceptionReference?: string;
  exceptionRecord?: BudgetExceptionApprovalRecord;
}

// ============================================================================
// PART M — SUPPLIER QUOTATION SUBMISSION: PORTAL + EMAIL
// ============================================================================

export type QuotationSubmissionChannel = 'PORTAL' | 'EMAIL';

export type UnifiedQuotationStatus =
  | 'INVITATION_SENT'
  | 'RESPONSE_PENDING'
  | 'RECEIVED'
  | 'UNDER_VERIFICATION'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'LATE_SUBMISSION'
  | 'REVISED'
  | 'WITHDRAWN';

export interface QuotationAttachmentVersion {
  versionNumber: number;
  attachmentId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  category: 'TECHNICAL' | 'COMMERCIAL' | 'COMPLIANCE' | 'EMAIL_ORIGINAL';
  uploadedAt: string;
  uploadedBy: string;
}

export interface InboundEmailQuotationEvidence {
  emailMessageId: string;
  rfqEmailReference: string; // e.g. RFQ-2026-0001+VEND-BASF-01@inbound.kosh.in
  senderEmail: string;
  verifiedVendorEmail: boolean;
  emailSubject: string;
  emailBodyExcerpt: string;
  receivedTimestamp: string;
  rawAttachmentFileNames: string[];
  extractedByBuyerId?: string;
  extractedByBuyerName?: string;
  verifiedAt?: string;
  verificationRemarks?: string;
}

export interface QuotationAccessAuditEntry {
  id: string;
  quotationId: string;
  rfqId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  vendorIdScope?: string;
  action: 'VIEW_SUMMARY' | 'VIEW_COMMERCIAL_PRICING' | 'DOWNLOAD_ATTACHMENT' | 'BUYER_VERIFY' | 'PORTAL_ACCESS';
  accessAllowed: boolean;
  denialReason?: string;
  timestamp: string;
}

export interface QuotationClarificationMessage {
  id: string;
  quotationId: string;
  rfqId: string;
  senderRole: 'BUYER' | 'SUPPLIER';
  senderName: string;
  message: string;
  timestamp: string;
}

// ============================================================================
// PART N — DIRECT PURCHASE ORDER WITHOUT RFQ
// ============================================================================

export type DirectPoReasonCode =
  | 'APPROVED_SINGLE_SOURCE'
  | 'EMERGENCY_PROCUREMENT'
  | 'PROPRIETARY_ITEM'
  | 'EXISTING_CONTRACT'
  | 'RATE_CONTRACT'
  | 'APPROVED_BLANKET_PO'
  | 'REGULATORY_REQUIREMENT'
  | 'APPROVED_EXCEPTION'
  | 'OTHER_AUTHORIZED_REASON';

export type RfqRequirementStatusOnPo =
  | 'RFQ_MANDATORY_COMPLETED'
  | 'RFQ_MANDATORY_EXEMPTED'
  | 'RFQ_OPTIONAL_DIRECT'
  | 'RFQ_DISABLED_DIRECT';

export interface RfqExemptionApprovalRecord {
  id: string;
  exemptionReference: string; // e.g. 'EXM-RFQ-2026-0001'
  companyId: string;
  branchId: string;
  prNumber?: string;
  vendorId: string;
  vendorName: string;
  itemCode: string;
  estimatedValue: number;
  reasonCode: DirectPoReasonCode;
  justification: string;
  requestedBy: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
  approvalRemarks?: string;
}

export interface BlockedDirectPoAttemptLog {
  id: string;
  companyId: string;
  branchId: string;
  attemptedByUserId: string;
  attemptedByName: string;
  vendorId: string;
  vendorName: string;
  itemCode: string;
  attemptedValue: number;
  effectiveRfqPolicyMode: string;
  directPoReason?: DirectPoReasonCode;
  blockReason: string;
  timestamp: string;
}

// ============================================================================
// PART O — CONFIGURABLE INVOICE MATCHING (TWO-WAY AND THREE-WAY)
// ============================================================================

export type InvoiceMatchingMode = 'NO_MATCHING' | 'TWO_WAY' | 'THREE_WAY';

export type InvoiceMatchingOutcome =
  | 'MATCHED'
  | 'MATCHED_WITHIN_TOLERANCE'
  | 'QUANTITY_MISMATCH'
  | 'PRICE_MISMATCH'
  | 'TAX_MISMATCH'
  | 'MISSING_GRN'
  | 'MISSING_PO'
  | 'DUPLICATE_INVOICE'
  | 'PENDING_EXCEPTION_APPROVAL'
  | 'BLOCKED'
  | 'APPROVED_FOR_POSTING';

export interface InvoiceMatchingPolicyConfig {
  id: string;
  companyId: string;
  companyCode: string;
  branchId: string; // 'ALL' or specific branchId
  branchCode: string;
  purchaseOrgId: string; // 'ALL' or specific purchase org
  supplierCategory: string; // 'ALL' or specific category
  procurementCategory: string; // 'ALL' or specific category
  transactionType: 'ALL' | 'MATERIAL' | 'SERVICE' | 'CAPEX' | 'DIRECT';
  itemCategory: string; // 'ALL' or specific item category
  invoiceType: 'ALL' | 'STANDARD' | 'PARTIAL' | 'FINAL' | 'CREDIT_MEMO';
  matchingMode: InvoiceMatchingMode;
  quantityTolerancePercent: number; // e.g. 2%
  priceTolerancePercent: number; // e.g. 1%
  valueToleranceAmount: number; // e.g. 500 INR
  taxTolerancePercent: number; // e.g. 0%
  freightToleranceAmount: number; // e.g. 1000 INR
  overInvoiceTolerancePercent: number; // e.g. 2%
  underInvoiceTolerancePercent: number; // e.g. 100% (when partial allowed)
  allowPartialInvoices: boolean;
  allowMultipleInvoices: boolean;
  requireExceptionApproval: boolean;
  version: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  status: 'ACTIVE' | 'SUPERSEDED' | 'DRAFT';
  createdBy: string;
  approvedBy?: string;
  updatedAt: string;
}

export interface InvoiceVarianceDetail {
  lineId: string;
  itemCode: string;
  varianceType:
    | 'QUANTITY_EXCEEDS_PO'
    | 'QUANTITY_EXCEEDS_GRN'
    | 'UNIT_PRICE_VARIANCE'
    | 'TAX_RATE_VARIANCE'
    | 'FREIGHT_VARIANCE'
    | 'TOTAL_VALUE_VARIANCE'
    | 'MISSING_GRN_FOR_3WAY'
    | 'MISSING_PO_REFERENCE'
    | 'PARTIAL_INVOICE_NOT_ALLOWED'
    | 'MULTIPLE_INVOICE_NOT_ALLOWED';
  expectedValue: number;
  invoicedValue: number;
  varianceAmount: number;
  variancePercent: number;
  allowedTolerancePercent: number;
  allowedToleranceAmount: number;
  withinTolerance: boolean;
  description: string;
}

export interface SupplierInvoiceLine {
  id: string;
  invoiceId: string;
  poLineId?: string;
  grnLineIds?: string[];
  itemCode: string;
  description: string;
  uom: string;
  invoicedQuantity: number;
  unitPrice: number;
  netAmount: number;
  taxPercent: number;
  taxAmount: number;
  freightAmount: number;
  totalLineAmount: number;
  // Matching reference quantities at evaluation time
  poOrderedQty?: number;
  poUnitPrice?: number;
  poTaxPercent?: number;
  grnAcceptedQty?: number;
  grnRejectedQty?: number;
  previouslyInvoicedQty?: number;
  remainingOpenQtyAfterInvoice?: number;
}

export interface InvoiceExceptionApprovalRecord {
  id: string;
  invoiceId: string;
  supplierInvoiceNumber: string;
  requestedBy: string;
  requestedAt: string;
  varianceJustification: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
  approverRemarks?: string;
}

export interface InvoiceMatchingSnapshot {
  snapshotId: string;
  matchedAt: string;
  matchedBy: string;
  policyId: string;
  policyVersion: number;
  policyEffectiveFrom: string;
  matchingModeUsed: InvoiceMatchingMode;
  tolerancesUsed: {
    quantityTolerancePercent: number;
    priceTolerancePercent: number;
    valueToleranceAmount: number;
    taxTolerancePercent: number;
    freightToleranceAmount: number;
    overInvoiceTolerancePercent: number;
    allowPartialInvoices: boolean;
    allowMultipleInvoices: boolean;
  };
  poSnapshot?: {
    poId: string;
    poNumber: string;
    vendorId: string;
    totalOrderedQty: number;
    totalNetValue: number;
  };
  grnSnapshots: Array<{
    grnId: string;
    grnNumber: string;
    receiptDate: string;
    acceptedQtyPurchUom: number;
    rejectedQtyPurchUom: number;
  }>;
  cumulativePreviouslyInvoicedQty: number;
  currentInvoiceQty: number;
  remainingOpenPoQty: number;
  remainingOpenGrnQty: number;
  variances: InvoiceVarianceDetail[];
  outcome: InvoiceMatchingOutcome;
  canPostToAccounting: boolean;
  exceptionRecord?: InvoiceExceptionApprovalRecord;
}

export interface SupplierInvoiceRecord {
  id: string;
  internalInvoiceNumber: string; // e.g. INV-REG-2026-0001
  supplierInvoiceNumber: string; // Vendor's bill number e.g. BASF/INV/26/901
  invoiceDate: string;
  companyId: string;
  companyCode: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  purchaseOrgId: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  poId?: string;
  poNumber?: string;
  grnIds: string[];
  grnNumbers: string[];
  transactionType: 'MATERIAL' | 'SERVICE' | 'CAPEX' | 'DIRECT';
  invoiceType: 'STANDARD' | 'PARTIAL' | 'FINAL' | 'CREDIT_MEMO';
  isFinalInvoice: boolean;
  isFinalDelivery: boolean;
  currency: string;
  totalNetAmount: number;
  totalTaxAmount: number;
  totalFreightAmount: number;
  totalGrossAmount: number;
  lines: SupplierInvoiceLine[];
  matchingOutcome: InvoiceMatchingOutcome;
  postingStatus: 'ON_HOLD' | 'PENDING_EXCEPTION_APPROVAL' | 'BLOCKED' | 'READY_FOR_POSTING' | 'POSTED';
  matchingSnapshot: InvoiceMatchingSnapshot;
  matchingHistory: InvoiceMatchingSnapshot[];
  supportingAttachments: Array<{
    id: string;
    fileName: string;
    uploadedAt: string;
  }>;
  financialYearId?: string;
  financialYearCode?: string;
  accountingPeriodId?: string;
  accountingPeriodCode?: string;
  accountingPostingDate?: string;
  fySnapshot?: FinancialYearTransactionSnapshot;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
  postedBy?: string;
}
