/**
 * KOSH INNOVATIONS — CENTRALIZED CHARGE MANAGEMENT ENGINE DOMAIN TYPES
 * Enterprise Procurement Additional Charges, Rules, Calculation, Allocation,
 * Domestic/Import Tax Governance, Split Delivery / Partial GRN Tracking,
 * Reconciliation & Item-Wise Landed Cost Engine.
 */

export type ChargeApplicationLevel =
  | 'PR_HEADER'
  | 'PR_LINE'
  | 'PO_HEADER'
  | 'PO_LINE'
  | 'SHIPMENT'
  | 'DELIVERY_SCHEDULE'
  | 'GRN'
  | 'QUANTITY_BASED'
  | 'TRANSPORT_TRIP'
  | 'INVOICE_LEVEL';

export type ChargeCalculationMethod =
  | 'FIXED_AMOUNT'
  | 'PERCENTAGE'
  | 'PER_UNIT'
  | 'PER_KG'
  | 'PER_MT'
  | 'PER_VOLUME'
  | 'PER_KM'
  | 'PER_SHIPMENT'
  | 'PER_TRIP'
  | 'PER_DAY'
  | 'ACTUAL_COST'
  | 'FORMULA_BASED';

export type ChargeCalculationBasis =
  | 'MATERIAL_LINE_VALUE'
  | 'TOTAL_PO_MATERIAL_VALUE'
  | 'NET_QUANTITY'
  | 'RECEIVED_QUANTITY'
  | 'GROSS_WEIGHT'
  | 'NET_WEIGHT'
  | 'VOLUME'
  | 'DISTANCE'
  | 'NUMBER_OF_SHIPMENTS'
  | 'NUMBER_OF_TRIPS'
  | 'NUMBER_OF_DAYS'
  | 'MANUAL_ALLOCATION'
  | 'EQUAL_ALLOCATION'
  | 'ACTUAL_INVOICE_AMOUNT';

export type ChargeAllocationMethod =
  | 'EQUAL_DISTRIBUTION'
  | 'PROPORTIONAL_VALUE'
  | 'PROPORTIONAL_QUANTITY'
  | 'PROPORTIONAL_WEIGHT'
  | 'PROPORTIONAL_VOLUME'
  | 'MANUAL_ALLOCATION'
  | 'DIRECT_LINE_ALLOCATION';

export type ChargeMasterCategory =
  | 'LOGISTICS'
  | 'IMPORT_CUSTOMS'
  | 'INSURANCE'
  | 'QUALITY_COMPLIANCE'
  | 'HANDLING'
  | 'PACKAGING'
  | 'STATUTORY'
  | 'SERVICE'
  | 'OTHER';

export type ChargeApplicabilityStatus =
  | 'MANDATORY'
  | 'OPTIONAL'
  | 'CONDITIONAL'
  | 'NOT_APPLICABLE';

export type ChargeLifecycleStage =
  | 'ESTIMATED'
  | 'QUOTED'
  | 'APPROVED'
  | 'ACTUAL'
  | 'RECONCILED';

export type ChargeBearer =
  | 'BUYER'
  | 'SUPPLIER'
  | 'SHARED_50_50'
  | 'THIRD_PARTY_LOGISTICS';

export type TaxTreatmentType =
  | 'DOMESTIC_GST_TAXABLE'
  | 'DOMESTIC_GST_RCM'
  | 'IMPORT_CUSTOMS_BCD_SWS'
  | 'IMPORT_IGST'
  | 'EXEMPT_ZERO_RATED'
  | 'OUT_OF_SCOPE';

export type TaxRecoverabilityType =
  | 'RECOVERABLE_INPUT_CREDIT'
  | 'PARTIALLY_RECOVERABLE'
  | 'NON_RECOVERABLE';

export type RoundingRule = 'HALF_UP' | 'FLOOR' | 'CEIL' | 'BANKERS';

export type ChargeApprovalStatus =
  | 'NOT_REQUIRED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

export type ChargeAllocationStatus =
  | 'UNALLOCATED'
  | 'PARTIALLY_ALLOCATED'
  | 'FULLY_ALLOCATED'
  | 'OVERRIDDEN';

export type ChargeReconciliationStatus =
  | 'ESTIMATED_ONLY'
  | 'QUOTED_PENDING_APPROVAL'
  | 'APPROVED_PENDING_ACTUAL'
  | 'PENDING_RECONCILIATION'
  | 'WITHIN_TOLERANCE'
  | 'VARIANCE_APPROVAL_REQUIRED'
  | 'RECONCILED';

export type SupplierChargeQuotationInclusion =
  | 'SEPARATELY_QUOTED'
  | 'INCLUDED_IN_MATERIAL_PRICE'
  | 'NOT_APPLICABLE_FREE';

export interface StatutoryTaxMapping {
  id: string;
  taxCode: string;
  taxName: string;
  procurementScope: 'DOMESTIC' | 'IMPORT' | 'BOTH';
  treatmentType: TaxTreatmentType;
  ratePercent: number;
  surchargePercent?: number; // e.g., Social Welfare Surcharge on BCD
  recoverability: TaxRecoverabilityType;
  recoverableSharePercent: number; // 100 for full ITC, 0 for non-recoverable
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
  description: string;
  updatedBy: string;
  updatedAt: string;
}

export interface ExchangeRateEntry {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: string;
  sourceRef: string;
}

export interface ChargeMasterRecord {
  id: string;
  chargeCode: string;
  chargeName: string;
  chargeDescription: string;
  chargeCategory: ChargeMasterCategory;
  defaultApplicationLevel: ChargeApplicationLevel;
  permittedApplicationLevels: ChargeApplicationLevel[];
  defaultCalculationMethod: ChargeCalculationMethod;
  defaultCalculationBasis: ChargeCalculationBasis;
  defaultRate: number;
  defaultFormulaExpression?: string;
  applicabilityRule: ChargeApplicabilityStatus;
  defaultCurrency: string;
  defaultTaxMappingId: string;
  defaultTaxTreatment: TaxTreatmentType;
  defaultAllocationBasis: ChargeAllocationMethod;
  chargeBearer: ChargeBearer;
  recoverability: TaxRecoverabilityType;
  minimumCharge?: number;
  maximumCharge?: number;
  roundingRule: RoundingRule;
  decimalPrecision: number;
  calculationSequence: number;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
  isSystemSeeded?: boolean;
  versionNumber?: number;
  applicablePrTypes?: string[]; // e.g. ['MANUAL', 'MRP', 'REPAIR', 'MAINTENANCE', 'CAPEX_ASSET']
  sapExpenseCode?: string | number;
  sapExpenseName?: string;
  sapGlAccountCode?: string;
  taxCode?: string;
  approvalStatus?: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
  createdBy: string;
  createdDate: string;
  modifiedBy: string;
  modifiedDate: string;
}

export type CentrallyControlledChargeField =
  | 'isEnabled'
  | 'applicability'
  | 'defaultCalculationMethod'
  | 'fixedTariffOrRate'
  | 'currency'
  | 'taxTreatment'
  | 'allocationBasis'
  | 'requiresApproval'
  | 'effectiveDates';

export interface CompanyBranchChargeMapping {
  id: string;
  versionNumber: number;
  companyId: string;
  companyCode: string;
  companyName: string;
  branchId: string; // 'ALL' = authoritative company mapping; specific branchId = branch override
  branchCode: string;
  branchName: string;
  chargeMasterId: string;
  chargeCode: string;
  isEnabled: boolean;
  applicability: ChargeApplicabilityStatus;
  defaultCalculationMethod: ChargeCalculationMethod;
  calculationBasis: ChargeCalculationBasis;
  fixedTariffOrRate: number;
  formulaExpression?: string;
  currency: string;
  taxMappingId: string;
  taxTreatment: TaxTreatmentType;
  taxRatePercent: number;
  allocationBasis: ChargeAllocationMethod;
  effectiveFrom: string;
  effectiveTo?: string;
  allowBranchOverride: boolean;
  centrallyControlledFields: CentrallyControlledChargeField[];
  requiresApproval: boolean;
  isBranchOverride: boolean;
  inheritedFromMappingId?: string;
  applicablePrTypes?: string[];
  sapExpenseCode?: string | number;
  sapExpenseName?: string;
  sapGlAccountCode?: string;
  taxCode?: string;
  approvalStatus?: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
  remarks?: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface CompanyBranchChargeMappingHistory {
  id: string;
  mappingId: string;
  versionNumber: number;
  companyId: string;
  branchId: string;
  chargeMasterId: string;
  chargeCode: string;
  action: 'CREATED' | 'UPDATED' | 'BRANCH_OVERRIDE_CREATED' | 'BRANCH_OVERRIDE_UPDATED' | 'REVERTED_TO_COMPANY';
  changedById: string;
  changedByName: string;
  changedAt: string;
  previousSnapshot?: Partial<CompanyBranchChargeMapping>;
  newSnapshot: Partial<CompanyBranchChargeMapping>;
  reason: string;
}

export interface EffectiveMappedChargeOption {
  chargeMasterId: string;
  chargeMasterVersion: number;
  chargeCode: string;
  chargeName: string;
  chargeDescription: string;
  chargeCategory: ChargeMasterCategory;
  defaultApplicationLevel: ChargeApplicationLevel;
  permittedApplicationLevels: ChargeApplicationLevel[];
  mappingId: string;
  mappingVersion: number;
  companyId: string;
  branchId: string;
  sourceScope: 'COMPANY_INHERITED' | 'BRANCH_OVERRIDE' | 'MASTER_DEFAULT';
  isEnabled: boolean;
  isActiveInMaster: boolean;
  isEffectiveNow: boolean;
  isBranchOverride: boolean;
  allowBranchOverride: boolean;
  centrallyControlledFields: CentrallyControlledChargeField[];
  applicability: ChargeApplicabilityStatus;
  calculationMethod: ChargeCalculationMethod;
  calculationBasis: ChargeCalculationBasis;
  rate: number;
  formulaExpression?: string;
  currency: string;
  taxMappingId: string;
  taxTreatment: TaxTreatmentType;
  taxRatePercent: number;
  allocationBasis: ChargeAllocationMethod;
  chargeBearer: ChargeBearer;
  minimumCharge?: number;
  maximumCharge?: number;
  roundingRule: RoundingRule;
  decimalPrecision: number;
  effectiveFrom: string;
  effectiveTo?: string;
  requiresApproval: boolean;
  applicablePrTypes?: string[];
  sapExpenseCode?: string | number;
  sapExpenseName?: string;
  sapGlAccountCode?: string;
  taxCode?: string;
  approvalStatus?: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  remarks?: string;
}

export type ChargeRuleConditionField =
  | 'procurementCategory'
  | 'itemCategory'
  | 'procurementType'
  | 'supplierId'
  | 'supplierCountry'
  | 'purchaseOrgId'
  | 'plantId'
  | 'currency'
  | 'incoterms'
  | 'deliveryTerms'
  | 'shipmentMethod'
  | 'materialValue'
  | 'quantity'
  | 'weightKg'
  | 'volumeCbm'
  | 'hasDeliverySchedule';

export type ChargeRuleOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'IN'
  | 'GREATER_THAN'
  | 'GREATER_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_OR_EQUAL';

export interface ChargeRuleCondition {
  id: string;
  field: ChargeRuleConditionField;
  operator: ChargeRuleOperator;
  value: string | number | string[];
}

export interface ChargeRuleRecord {
  id: string;
  ruleCode: string;
  ruleName: string;
  chargeMasterId: string;
  chargeCode: string;
  targetApplicability: ChargeApplicabilityStatus;
  targetApplicationLevels: ChargeApplicationLevel[];
  priority: number;
  logicalOperator: 'AND' | 'OR';
  conditions: ChargeRuleCondition[];
  requiresExplicitConfirmationIfConditional: boolean;
  allowMandatoryBypassWithException: boolean;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface ChargeRuleEvaluationContext {
  prType?: string;
  procurementCategory?: string;
  itemCategory?: string;
  procurementType: 'DOMESTIC' | 'IMPORT';
  supplierId?: string;
  supplierCountry?: string;
  purchaseOrgId?: string;
  plantId?: string;
  currency?: string;
  incoterms?: string;
  deliveryTerms?: string;
  shipmentMethod?: string;
  materialValue: number;
  quantity: number;
  weightKg?: number;
  volumeCbm?: number;
  hasDeliverySchedule?: boolean;
  transactionDate?: string;
}

export interface ChargeCalculationInputs {
  method: ChargeCalculationMethod;
  basis: ChargeCalculationBasis;
  rate: number;
  formulaExpression?: string;
  materialValue: number;
  totalPoMaterialValue?: number;
  quantity: number;
  receivedQuantity?: number;
  grossWeightKg?: number;
  netWeightKg?: number;
  volumeCbm?: number;
  distanceKm?: number;
  shipmentsCount?: number;
  tripsCount?: number;
  daysCount?: number;
  actualInvoiceAmount?: number;
  customsValue?: number;
  baseChargeAmountOverride?: number;
  sourceCurrency: string;
  targetCurrency: string;
  exchangeRate: number;
  minimumCharge?: number;
  maximumCharge?: number;
  roundingRule: RoundingRule;
  decimalPrecision: number;
  taxMapping: StatutoryTaxMapping;
}

export interface ChargeTaxBreakdown {
  taxMappingId: string;
  taxCode: string;
  taxName: string;
  treatmentType: TaxTreatmentType;
  chargeAmount: number;
  taxableBase: number;
  taxRatePercent: number;
  surchargePercent: number;
  taxAmount: number;
  surchargeAmount: number;
  recoverableTax: number;
  nonRecoverableTax: number;
  landedCostContribution: number;
}

export interface ChargeCalculationSnapshot {
  id: string;
  transactionChargeId: string;
  version: number;
  calculatedAt: string;
  calculatedBy: string;
  inputs: ChargeCalculationInputs;
  rawBasisValue: number;
  rawComputedAmount: number;
  clampedAmount: number;
  convertedCurrencyAmount: number;
  taxBreakdown: ChargeTaxBreakdown;
  totalWithTax: number;
  formulaAuditTrace?: string;
}

export interface ChargeAttachmentRecord {
  id: string;
  transactionChargeId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  documentType: 'FREIGHT_BILL' | 'CUSTOMS_BOE' | 'INSURANCE_POLICY' | 'SURVEY_REPORT' | 'VENDOR_QUOTE' | 'OTHER';
  uploadedBy: string;
  uploadedAt: string;
  notes?: string;
}

export interface ChargeAllocationLine {
  id: string;
  allocationRecordId: string;
  targetLineId: string;
  targetItemCode: string;
  targetDescription?: string;
  grnId?: string;
  grnNumber?: string;
  shipmentId?: string;
  deliveryScheduleId?: string;
  allocationWeightFactor: number;
  allocatedChargeAmount: number;
  allocatedTaxAmount: number;
  allocatedRecoverableTax: number;
  allocatedNonRecoverableTax: number;
  allocatedLandedCostContribution: number;
}

export interface ChargeAllocationRecord {
  id: string;
  transactionChargeId: string;
  version: number;
  allocationMethod: ChargeAllocationMethod;
  originalChargeAmount: number;
  allocatedTotalAmount: number;
  remainingUnallocatedAmount: number;
  roundingAdjustmentDelta: number;
  currency: string;
  isManuallyOverridden: boolean;
  isApprovedOverride: boolean;
  overrideApprovedBy?: string;
  overrideReason?: string;
  lines: ChargeAllocationLine[];
  allocatedBy: string;
  allocatedAt: string;
}

export interface ChargeApprovalRecord {
  id: string;
  transactionChargeId: string;
  approvalType:
    | 'CHARGE_CREATION'
    | 'MANDATORY_BYPASS_EXCEPTION'
    | 'AMOUNT_AMENDMENT'
    | 'ALLOCATION_OVERRIDE'
    | 'PO_CHARGE_AMENDMENT'
    | 'VARIANCE_RECONCILIATION'
    | 'FORMULA_OVERRIDE';
  requestedBy: string;
  requestedAt: string;
  reason: string;
  previousValue?: any;
  proposedValue?: any;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decidedBy?: string;
  decidedAt?: string;
  decisionRemarks?: string;
}

export interface ChargeReconciliationRecord {
  id: string;
  transactionChargeId: string;
  chargeCode: string;
  chargeName: string;
  prNumber?: string;
  rfqNumber?: string;
  poNumber?: string;
  grnNumber?: string;
  invoiceNumber?: string;
  estimatedAmount: number;
  quotedAmount: number;
  approvedAmount: number;
  actualAmount: number;
  varianceApprovedVsActual: number;
  variancePercent: number;
  tolerancePercent: number;
  status: ChargeReconciliationStatus;
  reconciledBy?: string;
  reconciledAt?: string;
  approvalRef?: string;
  notes?: string;
}

export interface ChargeAuditLogEntry {
  id: string;
  timestamp: string;
  transactionChargeId: string;
  sourceDocumentType: string;
  sourceDocumentNumber: string;
  action:
    | 'CREATED'
    | 'UPDATED'
    | 'APPLICABILITY_CHANGED'
    | 'CALCULATED'
    | 'ALLOCATED'
    | 'ALLOCATION_OVERRIDDEN'
    | 'EXCEPTION_REQUESTED'
    | 'EXCEPTION_APPROVED'
    | 'AMENDED'
    | 'CARRIED_FORWARD'
    | 'RECONCILED'
    | 'SOFT_DELETED';
  actorId: string;
  actorName: string;
  previousValue?: any;
  newValue?: any;
  reason: string;
  calculationVersion?: number;
  approvalReference?: string;
}

export interface TransactionChargeItem {
  id: string;
  idempotencyKey?: string;
  chargeMasterId: string;
  chargeCode: string;
  chargeName: string;
  chargeCategory: ChargeMasterCategory;
  procurementType: 'DOMESTIC' | 'IMPORT';
  sourceDocumentType: 'PR' | 'RFQ' | 'QUOTATION' | 'PO' | 'SHIPMENT' | 'DELIVERY_SCHEDULE' | 'GRN' | 'INVOICE';
  sourceDocumentId: string;
  sourceDocumentNumber: string;
  sourceLineId?: string;
  // Lifecycle traceability chain (preserved independently across stages!)
  originPrId?: string;
  originPrNumber?: string;
  originPrLineId?: string;
  originRfqId?: string;
  originRfqNumber?: string;
  originQuotationId?: string;
  originPoId?: string;
  originPoNumber?: string;
  originPoLineId?: string;
  shipmentId?: string;
  shipmentNumber?: string;
  deliveryScheduleId?: string;
  grnId?: string;
  grnNumber?: string;
  transportTripId?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  supplierId?: string;
  supplierName?: string;
  incoterms?: string;
  // Configuration
  applicationLevel: ChargeApplicationLevel;
  applicability: ChargeApplicabilityStatus;
  conditionalConfirmed?: boolean;
  calculationMethod: ChargeCalculationMethod;
  calculationBasis: ChargeCalculationBasis;
  allocationMethod: ChargeAllocationMethod;
  rate: number;
  formulaExpression?: string;
  basisQuantityOrMetric?: number; // Weight/Volume/KM/Days/Shipments/Trips override
  currency: string;
  targetReportingCurrency: string;
  exchangeRateUsed: number;
  chargeBearer: ChargeBearer;
  supplierInclusionMode: SupplierChargeQuotationInclusion;
  taxMappingId: string;
  // Stage-separated financial amounts (never overwrite estimated with actual!)
  lifecycleStage: ChargeLifecycleStage;
  estimatedChargeAmount: number;
  quotedChargeAmount: number;
  approvedChargeAmount: number;
  actualChargeAmount: number;
  // Active computed figures for current stage
  chargeAmount: number; // Base charge in transaction currency
  chargeAmountReportingCurrency: number;
  taxBreakdown: ChargeTaxBreakdown;
  totalWithTax: number;
  // Allocation & Governance
  allocationStatus: ChargeAllocationStatus;
  allocatedAmount: number;
  remainingUnallocatedAmount: number;
  currentAllocationId?: string;
  allocationHistory: ChargeAllocationRecord[];
  approvalStatus: ChargeApprovalStatus;
  approvals: ChargeApprovalRecord[];
  reconciliationStatus: ChargeReconciliationStatus;
  calculationHistory: ChargeCalculationSnapshot[];
  attachments: ChargeAttachmentRecord[];
  remarks?: string;
  isSoftDeleted?: boolean;
  deletedBy?: string;
  deletedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface ShipmentRecord {
  id: string;
  shipmentNumber: string;
  poId: string;
  poNumber: string;
  companyId: string;
  branchId: string;
  vendorId: string;
  vendorName: string;
  procurementType: 'DOMESTIC' | 'IMPORT';
  shipmentMethod: 'ROAD' | 'SEA' | 'AIR' | 'RAIL' | 'COURIER';
  incoterms: string;
  blOrAwbNumber?: string;
  vehicleOrVesselName?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  dispatchDate: string;
  estimatedArrivalDate: string;
  actualArrivalDate?: string;
  distanceKm?: number;
  grossWeightKg: number;
  volumeCbm: number;
  currency: string;
  status: 'PLANNED' | 'IN_TRANSIT' | 'CUSTOMS_CLEARANCE' | 'ARRIVED' | 'DELIVERED';
  lineQuantities: Array<{
    poLineId: string;
    itemCode: string;
    shippedQtyPurchUom: number;
    weightKg: number;
    volumeCbm: number;
  }>;
  createdBy: string;
  createdAt: string;
}

export interface TransportTripRecord {
  id: string;
  tripNumber: string;
  poId?: string;
  poNumber?: string;
  shipmentId?: string;
  shipmentNumber?: string;
  transporterName: string;
  vehicleNumber: string;
  originLocation: string;
  destinationLocation: string;
  distanceKm: number;
  tripDays: number;
  freightRate: number;
  currency: string;
  tripDate: string;
  status: 'SCHEDULED' | 'IN_TRANSIT' | 'COMPLETED';
}

export interface LandedCostStageBreakdown {
  stage: 'ESTIMATED' | 'QUOTED' | 'APPROVED' | 'ACTUAL' | 'FINAL_RECONCILED';
  materialCost: number;
  directLineCharges: number;
  allocatedIndirectCharges: number;
  nonRecoverableTaxes: number;
  recoverableInputTaxExcluded: number;
  totalLandedCost: number;
  landedUnitCost: number;
  contributingChargeIds: string[];
}

export interface LandedCostItemSummary {
  itemCode: string;
  description: string;
  sourceDocType: 'PR' | 'RFQ' | 'PO' | 'GRN';
  sourceDocNumber: string;
  sourceLineId: string;
  quantity: number;
  uom: string;
  currency: string;
  stages: {
    estimated?: LandedCostStageBreakdown;
    quoted?: LandedCostStageBreakdown;
    approved?: LandedCostStageBreakdown;
    actual?: LandedCostStageBreakdown;
    finalReconciled?: LandedCostStageBreakdown;
  };
  chargeTrace: Array<{
    transactionChargeId: string;
    chargeCode: string;
    chargeName: string;
    applicationLevel: ChargeApplicationLevel;
    lifecycleStage: ChargeLifecycleStage;
    allocatedBaseAmount: number;
    nonRecoverableTax: number;
    recoverableTaxExcluded: number;
    landedContribution: number;
  }>;
}

export interface LandedCostShipmentSummary {
  shipmentId: string;
  shipmentNumber: string;
  poNumber: string;
  currency: string;
  materialValueInShipment: number;
  shipmentDirectCharges: number;
  allocatedHeaderCharges: number;
  nonRecoverableTaxes: number;
  recoverableInputTaxExcluded: number;
  totalShipmentLandedCost: number;
  chargeBreakdown: Array<{
    transactionChargeId: string;
    chargeCode: string;
    chargeName: string;
    baseAmount: number;
    nonRecoverableTax: number;
    recoverableTaxExcluded: number;
  }>;
}

export interface ChargeDashboardSummary {
  totalEstimatedCharges: number;
  totalQuotedCharges: number;
  totalApprovedCharges: number;
  totalActualCharges: number;
  unallocatedChargesTotal: number;
  pendingReconciliationCount: number;
  pendingApprovalCount: number;
  chargeVarianceTotal: number;
  currency: string;
}

export interface NormalizedSupplierChargeComparison {
  rfqId: string;
  rfqNumber: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  currency: string;
  exchangeRateToBase: number;
  materialSubtotalBaseCurrency: number;
  includedInPriceChargesCount: number;
  separatelyQuotedChargesTotal: number;
  separatelyQuotedNonRecoverableTax: number;
  recoverableTaxTotal: number;
  normalizedTotalLandedCost: number;
  chargeLines: Array<{
    chargeCode: string;
    chargeName: string;
    inclusionMode: SupplierChargeQuotationInclusion;
    calculationMethod: ChargeCalculationMethod;
    rawAmount: number;
    normalizedBaseAmount: number;
    nonRecoverableTax: number;
    recoverableTax: number;
  }>;
}
