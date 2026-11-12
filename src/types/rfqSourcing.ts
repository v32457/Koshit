/**
 * KOSH INNOVATIONS — RFQ AND PROCUREMENT SOURCING DOMAIN TYPES
 * Enterprise Export-Level RFQ & Local LLM Management Subsystem
 */

export type RfqPolicyMode = 'RFQ_ENABLED' | 'RFQ_OPTIONAL' | 'RFQ_DISABLED';

export interface RfqPolicyConfig {
  id: string;
  companyId: string;
  companyCode: string;
  branchId: string; // 'ALL' or specific branch ID
  branchCode: string;
  branchName: string;
  policyMode: RfqPolicyMode;
  isInheritedFromCompany: boolean;
  allowBranchOverride: boolean;
  minSupplierInvitations: number;
  maxSupplierInvitations: number;
  defaultQuotationValidityDays: number;
  evaluationType: 'SINGLE_STAGE' | 'TWO_STAGE';
  sealedCommercialQuotations: boolean;
  directProcurementExemptionLimit?: number;
  allowDirectExemptions?: boolean;
  directExemptionRequiresApproval?: boolean;
  updatedAt: string;
  updatedBy: string;
  approvalReference?: string;
  remarks?: string;
}

export type SourcingDemandStatus =
  | 'DRAFT_PR'
  | 'PENDING_PR_APPROVAL'
  | 'APPROVED_PR'
  | 'SCHEDULED'
  | 'PARTIALLY_SOURCED'
  | 'ON_HOLD'
  | 'FULLY_SOURCED'
  | 'EXEMPTED';

export interface FutureRfqDemandItem {
  id: string;
  prId: string;
  prNumber: string;
  prLineId: string;
  companyId: string;
  companyCode: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  department: string;
  requesterName: string;
  itemCode: string;
  description: string;
  itemCategory: string;
  inventoryUom: string;
  purchaseUom: string;
  inventoryToPurchaseConversion: number; // e.g. 1 BOX = 10 EA => 0.1
  requiredQuantityInvUom: number;
  remainingQuantityInvUom: number;
  requiredQuantityPurchUom: number;
  remainingQuantityPurchUom: number;
  approximateUnitPriceInvUom: number;
  approximateUnitPricePurchUom: number;
  estimatedTotalValue: number;
  requiredDeliveryDate: string;
  prApprovalStatus: string;
  sourcingStatus: SourcingDemandStatus;
  plannedSourcingDate?: string;
  assignedBuyerId?: string;
  assignedBuyerName?: string;
  assignedPurchasingManagerId?: string;
  assignedPurchasingManagerName?: string;
  exemptionReason?: string;
  exemptedBy?: string;
  rfqId?: string;
  technicalSpecifications?: string;
  marketBenchmark?: MarketBenchmarkResult;
  ageingDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConsolidatedDemandGroup {
  groupId: string;
  itemCode: string;
  description: string;
  itemCategory: string;
  inventoryUom: string;
  purchaseUom: string;
  conversionRatio: number;
  totalRequiredQtyInvUom: number;
  totalConvertedQtyInvUom: number;
  totalAvailableQtyInvUom: number;
  totalRequiredQtyPurchUom: number;
  totalConvertedQtyPurchUom: number;
  totalAvailableQtyPurchUom: number;
  marketBenchmark?: MarketBenchmarkResult;
  contributingDemandItems: FutureRfqDemandItem[];
}

export type SupplierPreferenceLevel = 'L1' | 'L2' | 'L3' | 'STANDARD_MARKET';

export interface MarketPriceOffer {
  id: string;
  vendorName: string;
  websiteUrl: string;
  productUrl: string;
  manufacturer: string;
  brand: string;
  model: string;
  productSpecification: string;
  publishedPrice: number;
  currency: string;
  quotedUom: string;
  normalizedPricePurchUom: number;
  moq: number;
  quantityBreaks?: string;
  gstStatus: 'TAX_INCLUSIVE' | 'TAX_EXCLUSIVE' | 'GST_EXEMPT';
  gstPercent?: number;
  estimatedFreight: number;
  estimatedLandedPrice: number;
  availability: string;
  deliveryLeadTimeDays: number;
  vendorLocation: string;
  retrievedAt: string;
  sourceEvidence: string;
  verificationStatus: 'VERIFIED_OFFER' | 'INDICATIVE_LISTING' | 'UNVERIFIED';
  matchClassification: 'EXACT_MATCH' | 'EQUIVALENT_SPEC' | 'ALTERNATIVE';
  preferenceLevel: SupplierPreferenceLevel;
  preferenceReason?: string;
  historicalPerformanceScore?: number;
  warrantyTerms?: string;
  paymentTerms?: string;
  isEligibleForComparison?: boolean;
  exclusionReason?: string;
}

export interface MarketBenchmarkResult {
  id: string;
  itemCode: string;
  description: string;
  technicalSpecs?: string;
  purchaseUom: string;
  inventoryUom: string;
  searchedAt: string;
  searchedBy: string;
  discoveryStatus: 'COMPLETED' | 'PENDING' | 'SEARCH_FAILED' | 'INSUFFICIENT_DATA';
  offers: MarketPriceOffer[];
  lowestPrice: number;
  lowestPublishedPrice: number;
  lowestLandedPrice: number;
  medianPrice: number;
  highestPrice: number;
  recommendedBenchmarkPrice: number;
  sampleSize: number;
  exactMatchCount: number;
  equivalentMatchCount: number;
  l1Supplier?: MarketPriceOffer;
  l2Supplier?: MarketPriceOffer;
  l3Supplier?: MarketPriceOffer;
  excludedOffers?: Array<{
    id?: string;
    supplierName: string;
    vendorName?: string;
    publishedPrice?: number;
    reason: string;
    exclusionReason?: string;
    isEligibleForComparison?: boolean;
  }>;
  disclaimerLabel: string; // 'INDICATIVE MARKET PRICES, NOT FORMAL SUPPLIER QUOTATIONS'
}

export type RfqStatus =
  | 'DRAFT'
  | 'PENDING_RELEASE_APPROVAL'
  | 'RELEASED'
  | 'QUOTATIONS_IN_PROGRESS'
  | 'UNDER_TECHNICAL_EVALUATION'
  | 'TECHNICAL_GATE_APPROVED'
  | 'UNDER_COMMERCIAL_EVALUATION'
  | 'COMPARATIVE_STATEMENT_GENERATED'
  | 'UNDER_NEGOTIATION'
  | 'AWARD_RECOMMENDED'
  | 'PENDING_AWARD_APPROVAL'
  | 'PARTIALLY_AWARDED'
  | 'AWARDED'
  | 'CLOSED'
  | 'CANCELLED';

export interface RfqHeader {
  id: string;
  rfqNumber: string;
  companyId: string;
  companyCode: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  purchaseOrgId: string;
  title: string;
  description: string;
  prReferences: string[];
  rfqDate: string;
  responseDeadline: string;
  quotationValidityDays: number;
  buyerId: string;
  buyerName: string;
  purchasingManagerId: string;
  purchasingManagerName: string;
  currency: string;
  deliveryTerms: string;
  paymentTerms: string;
  incoterms: string;
  evaluationMethod: 'SINGLE_STAGE' | 'TWO_STAGE';
  sealedCommercialQuotations: boolean;
  status: RfqStatus;
  lines: RfqLineItem[];
  invitations: RfqSupplierInvitation[];
  createdAt: string;
  updatedAt: string;
}

export interface RfqLineItem {
  id: string;
  rfqId: string;
  prLineId: string;
  prNumber: string;
  itemCode: string;
  description: string;
  category: string;
  specifications: string;
  manufacturerModelReq?: string;
  quantityPurchUom: number;
  purchaseUom: string;
  inventoryUom: string;
  conversionRatio: number;
  requiredDeliveryDate: string;
  targetWarehouse: string;
  qualityRequirements?: string;
  warrantyMonths?: number;
  packagingTerms?: string;
  targetUnitPrice?: number;
}

export interface RfqSupplierInvitation {
  id: string;
  rfqId: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  contactEmail: string;
  invitedAt: string;
  invitationStatus: 'INVITED' | 'ACKNOWLEDGED' | 'SUBMITTED' | 'DECLINED';
  responseDeadline: string;
}

export interface SupplierQuotationLine {
  id: string;
  quotationId: string;
  rfqLineId: string;
  itemCode: string;
  description: string;
  quotedQuantityPurchUom: number;
  purchaseUom: string;
  unitPricePurchUom: number;
  currency: string;
  gstPercent: number;
  gstAmount: number;
  freightAmount: number;
  insuranceAmount: number;
  otherCharges: number;
  discountPercent: number;
  discountAmount: number;
  netLineTotal: number;
  landedUnitPricePurchUom: number;
  moq: number;
  deliveryLeadTimeDays: number;
  technicalCompliance: 'COMPLIANT' | 'DEVIATION' | 'NON_COMPLIANT';
  technicalDeviations?: string;
}

export interface SupplierQuotation {
  id: string;
  rfqId: string;
  rfqNumber: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  revisionNumber: number; // 1, 2, 3...
  quotationNumber: string;
  quotationDate: string;
  validUntil: string;
  currency: string;
  paymentTerms: string;
  incoterms: string;
  totalQuotedValue: number;
  totalLandedValue: number;
  technicalComplianceStatus: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';
  lines: SupplierQuotationLine[];
  attachments: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    uploadedAt: string;
  }>;
  submittedAt: string;
  submittedBy: string;
  isSealed: boolean;
}

export interface RfqExaminerFinding {
  id: string;
  findingCode: string;
  supplierName: string;
  itemCode: string;
  ruleCategory: 'DOCUMENT_COMPLEENESS' | 'TECHNICAL_COMPLIANCE' | 'COMMERCIAL_MATH' | 'BENCHMARK_VARIANCE' | 'LEAD_TIME_RISK';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  classification: 'MANDATORY' | 'ADVISORY';
  evidence: string;
  sourceDocument: string;
  explanation: string;
  confidenceScore: number; // 0.0 - 1.0
  recommendedAction: string;
}

export interface RfqExaminerRun {
  id: string;
  rfqId: string;
  executedAt: string;
  executedBy: string;
  modelUsed: string;
  overallStatus: 'PASS' | 'PASS_WITH_WARNINGS' | 'CLARIFICATION_REQUIRED' | 'FAIL';
  summaryFindings: string;
  findings: RfqExaminerFinding[];
}

export interface RfqApproverChatQa {
  id: string;
  rfqId: string;
  question: string;
  askedBy: string;
  askedAt: string;
  modelUsed: string;
  answer: string;
  evidenceReferences: string[];
  correlationId: string;
}

export interface RfqEvaluationCriteria {
  id: string;
  criterionKey: 'TECHNICAL' | 'COMMERCIAL' | 'DELIVERY' | 'QUALITY' | 'PAYMENT_TERMS';
  displayName: string;
  weightPercent: number; // e.g. 40, 35, 10, 10, 5
}

export interface RfqEvaluatorScore {
  id: string;
  rfqId: string;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorRole: string;
  vendorId: string;
  vendorName: string;
  stage: 'TECHNICAL' | 'COMMERCIAL';
  scores: Record<string, number>; // criterionKey -> score (0-100)
  totalWeightedScore: number;
  remarks: string;
  submittedAt: string;
}

export interface RfqComparativeStatementRow {
  rfqLineId: string;
  itemCode: string;
  description: string;
  requiredQtyPurchUom: number;
  purchaseUom: string;
  inventoryUom: string;
  marketBenchmarkPrice: number;
  vendorOffers: Array<{
    vendorId: string;
    vendorCode: string;
    vendorName: string;
    unitPricePurchUom: number;
    gstPercent: number;
    freightPerUnit: number;
    landedUnitPrice: number;
    totalLandedCost: number;
    evaluatedScore: number;
    rank: number;
    leadTimeDays: number;
    paymentTerms: string;
    technicalStatus: string;
    budgetVariancePercent: number;
    proposedAllocationPercent: number;
    proposedQuantityPurchUom: number;
  }>;
}

export interface RfqAwardRecommendation {
  id: string;
  rfqId: string;
  rfqNumber: string;
  awardType: 'SINGLE_VENDOR' | 'SPLIT_VENDOR' | 'LINE_BY_LINE';
  allocations: Array<{
    vendorId: string;
    vendorCode: string;
    vendorName: string;
    itemCode: string;
    purchaseUom: string;
    approvedUnitPricePurchUom: number;
    allocationPercent: number;
    allocatedQtyPurchUom: number;
    totalAwardValue: number;
    effectiveFrom: string;
    effectiveTo: string;
  }>;
  totalAwardValue: number;
  justification: string;
  recommendedBy: string;
  recommendedAt: string;
  approvalStatus: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
}

export interface VendorItemPriceAgreement {
  id: string;
  agreementNumber: string;
  companyId: string;
  companyCode: string;
  branchId: string;
  branchCode: string;
  purchaseOrgId: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  itemCode: string;
  description: string;
  rfqId: string;
  rfqNumber: string;
  awardId: string;
  approvedUnitPricePurchUom: number;
  currency: string;
  purchaseUom: string;
  inventoryUom: string;
  conversionRatio: number;
  moq: number;
  effectiveFrom: string;
  effectiveTo: string;
  allocationPercent: number;
  deliveryLeadTimeDays: number;
  paymentTerms: string;
  taxConditions: string;
  status: 'ACTIVE' | 'EXPIRED' | 'SUPERSEDED' | 'SUSPENDED';
  version: number;
  approvedBy: string;
  approvedAt: string;
}

export interface PurchasePriceTier {
  id: string;
  minQtyPurchUom: number;
  maxQtyPurchUom: number; // use 999999 for infinity
  unitPricePurchUom: number;
}

export interface PurchaseDiscountRule {
  id: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'QUANTITY_TIER' | 'CONTRACT_PROMO';
  discountValue: number;
  description: string;
}

export interface PurchasePriceBookLine {
  id: string;
  priceBookId: string;
  itemCode: string;
  description: string;
  purchaseUom: string;
  baseUnitPricePurchUom: number;
  moq: number;
  maxQty?: number;
  tiers: PurchasePriceTier[];
  discountRules: PurchaseDiscountRule[];
  taxConditions: string;
  freightConditions: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface PurchasePriceBook {
  id: string;
  priceBookNumber: string;
  companyId: string;
  companyCode: string;
  branchId: string;
  branchCode: string;
  purchaseOrgId: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  effectiveFrom: string;
  effectiveTo: string;
  status: 'APPROVED' | 'DRAFT' | 'REJECTED';
  lines: PurchasePriceBookLine[];
  updatedAt: string;
  updatedBy: string;
}

export interface PoVendorAllocationProposal {
  itemCode: string;
  purchaseUom: string;
  totalRequiredQtyPurchUom: number;
  priceSource: 'APPROVED_RFQ_AWARD' | 'APPROVED_PRICE_BOOK' | 'EXCEPTION_OVERRIDE';
  vendorAllocations: Array<{
    vendorId: string;
    vendorCode: string;
    vendorName: string;
    originalAllocationPercent: number;
    originalQtyPurchUom: number;
    proposedAllocationPercent: number;
    proposedQtyPurchUom: number;
    unitPricePurchUom: number;
    lineTotalValue: number;
    priceAgreementRef: string;
  }>;
  overrideApplied: boolean;
  overrideJustification?: string;
  overrideProposedBy?: string;
}

export interface PurchaseOrderLine {
  id: string;
  poId: string;
  itemCode: string;
  description: string;
  itemCategory: string;
  purchaseUom: string;
  inventoryUom: string;
  conversionRatio: number;
  orderQtyPurchUom: number;
  orderQtyInvUom: number;
  unitPricePurchUom: number;
  currency: string;
  netAmount: number;
  gstPercent: number;
  gstAmount: number;
  totalAmount: number;
  prNumberRef: string;
  rfqNumberRef?: string;
  priceAgreementRef: string;
  deliveryDate: string;
  receivedQtyPurchUom: number;
  receivedQtyInvUom: number;
  status: 'OPEN' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED' | 'CANCELLED';
}

export interface PurchaseOrderHeader {
  id: string;
  poNumber: string; // e.g. PO-2026-0001
  companyId: string;
  companyCode: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  purchaseOrgId: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  poDate: string;
  paymentTerms: string;
  incoterms: string;
  deliveryAddress: string;
  buyerId: string;
  buyerName: string;
  purchasingManagerId: string;
  purchasingManagerName: string;
  totalNetValue: number;
  totalTaxValue: number;
  totalGrossValue: number;
  currency: string;
  priceSourceMode: 'RFQ_AWARD' | 'PRICE_BOOK';
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'RELEASED' | 'CANCELLED';
  allocationProposals: PoVendorAllocationProposal[];
  hasOverride: boolean;
  overrideJustification?: string;
  lines: PurchaseOrderLine[];
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface GoodsReceiptLine {
  id: string;
  grnId: string;
  poLineId: string;
  itemCode: string;
  description: string;
  purchaseUom: string;
  inventoryUom: string;
  conversionRatio: number;
  receivedQtyPurchUom: number;
  convertedQtyInvUom: number; // receivedQtyPurchUom * conversionRatio
  acceptedQtyInvUom: number;
  rejectedQtyInvUom: number;
  warehouseCode: string;
  batchNumber?: string;
  remarks?: string;
}

export interface GoodsReceiptHeader {
  id: string;
  grnNumber: string; // GRN-2026-0001
  poId: string;
  poNumber: string;
  companyId: string;
  branchId: string;
  branchName: string;
  vendorId: string;
  vendorName: string;
  receiptDate: string;
  challanNumber: string;
  challanDate: string;
  receivedBy: string;
  lines: GoodsReceiptLine[];
  status: 'POSTED' | 'DRAFT';
  createdAt: string;
}

// LOCAL LLM DOMAIN TYPES
export interface LocalLlmModelCatalogueItem {
  id: string;
  name: string;
  publisher: string;
  family: string;
  version: string;
  parameterSize: string; // e.g. '8B', '7B', '3B'
  quantizationOptions: string[]; // ['Q4_K_M', 'Q5_K_M', 'Q8_0', 'FP16']
  contextWindow: number; // e.g. 8192, 16384, 32768
  minRamGb: number;
  recommendedVramGb: number;
  downloadSizeBytes: number;
  license: string;
  supportedCapabilities: string[];
  runtimeCompatibility: string[]; // ['ollama', 'llama.cpp', 'openai-compatible']
  sourceUrl: string;
  sha256Checksum: string;
}

export interface LocalLlmDownloadJob {
  id: string;
  modelId: string;
  modelName: string;
  quantization: string;
  totalSizeBytes: number;
  downloadedBytes: number;
  progressPercent: number;
  status: 'QUEUED' | 'DOWNLOADING' | 'PAUSED' | 'VERIFYING' | 'INSTALLED' | 'FAILED' | 'CANCELLED';
  speedMbps: number;
  startedAt: string;
  estimatedRemainingSec: number;
  errorMessage?: string;
}

export interface LocalLlmRegistryItem {
  id: string;
  modelId: string;
  name: string;
  quantization: string;
  runtime: 'ollama' | 'llama.cpp' | 'openai-compatible';
  installationPath: string;
  endpointUrl: string;
  contextLimit: number;
  vramAllocatedGb: number;
  gpuLayersOffloaded: number;
  cpuThreads: number;
  status: 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR';
  healthStatus: 'HEALTHY' | 'UNHEALTHY' | 'UNTESTED';
  tokenThroughput: number; // tokens/sec
  latencyMs: number;
  registeredAt: string;
  lastUsedAt?: string;
}

export interface LlmTaskMapping {
  taskKey: 'RFQ_DOCUMENT_EXTRACTION' | 'TECHNICAL_EXAMINATION' | 'COMMERCIAL_ANALYSIS' | 'APPROVER_CHAT' | 'SUMMARY_REPORT';
  displayName: string;
  description: string;
  assignedModelId: string;
  fallbackModelId?: string;
}

export interface LocalLlmHealthResult {
  isHealthy: boolean;
  endpointUrl: string;
  runtime: string;
  modelName: string;
  latencyMs: number;
  tokensPerSec: number;
  contextWindowSupported: number;
  jsonOutputTestPassed: boolean;
  examinerTaskTestPassed: boolean;
  testedAt: string;
}

export interface CloudExaminerConfig {
  isEnabled: boolean;
  authorizedByCompany: boolean;
  provider: 'GOOGLE_GEMINI_API' | 'OPENAI_AZURE' | 'CUSTOM_CLOUD';
  apiKeyRef: string;
  modelName: string;
  retentionPolicy: 'ZERO_RETENTION' | 'AUDIT_LOG_ONLY';
  lastUpdated: string;
}

export type LlmClassificationStatus =
  | 'Installed and working'
  | 'Installed but not configured'
  | 'Configured but not downloaded'
  | 'Runtime unavailable'
  | 'Inference test failed'
  | 'Not required or obsolete';

export interface LlmAuditTaskReportItem {
  taskKey: string;
  applicationTask: string;
  requiredLlm: string;
  provider: string;
  runtime: string;
  endpointUrl: string;
  downloadStatus: 'Downloaded & Verified' | 'Downloading (In Progress)' | 'Not Downloaded';
  configurationStatus: 'Registered & Mapped' | 'Mapped (Unregistered)' | 'Not Mapped';
  inferenceTestResult: 'PASSED (Real Response Verified)' | 'FAILED' | 'NOT TESTED';
  classification: LlmClassificationStatus;
  latencyMs: number;
  tokensPerSec: number;
  ramVramStatus: string;
  isLocalEnforced: boolean;
}

export interface FullLlmAuditSummary {
  auditedAt: string;
  totalTasksAudited: number;
  workingCount: number;
  missingCount: number;
  cloudFallbackActive: boolean;
  tasksReport: LlmAuditTaskReportItem[];
}
