/**
 * KOSH INNOVATIONS — GLOBAL ITEM MASTER & BRANCH ITEM AVAILABILITY GOVERNANCE TYPES
 *
 * Architectural Separation:
 * - Global Item Master owns: Item Code, Item Description, Item Type, Technical Specs,
 *   Material, Material Form, Process, Colour, Manufacturer/Brand/Customer Part Refs,
 *   Default Purchase UOM (Mandatory), Default Inventory/Base UOM, Default UOM Conversion,
 *   Global Attachments, Global Duplicate Detection, Global Change History, Global Checker Approval.
 * - Branch Item Availability owns: Company + Branch + GlobalItem uniqueness,
 *   Branch Category (single active per GlobalItem+Company+Branch), Branch UOM Overrides,
 *   Purchasing/Inventory Enablement, Compliance (Shelf-Life, Serial, Warranty, MOQ,
 *   Order Multiple, Service, Batch/Lot, Quality Inspection, Storage, Regulatory),
 *   Multi-Warehouse Planning, Alternative Item References, Branch Attachments,
 *   Barcode/GTIN, Branch Revisions, Branch Change History, Branch Checker Approval.
 */

export type UomDimension =
  | 'WEIGHT'
  | 'VOLUME'
  | 'COUNT'
  | 'LENGTH'
  | 'AREA'
  | 'TIME'
  | 'PACKAGING'
  | 'OTHER';

export type RoundingRule = 'NONE' | 'NEAREST' | 'ROUND_UP' | 'ROUND_DOWN';

export interface UomMasterRecord {
  id: string;
  code: string; // e.g., KG, G, MT, LTR, ML, EA, NOS, BOX, BAG, SET, M, MM
  name: string;
  dimension: UomDimension;
  isBaseUnit: boolean;
  baseUnitCode?: string; // e.g., KG for G/MT, EA for BOX/SET
  decimalPrecision: number;
  allowFractional: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface UomConversionDefinition {
  id?: string;
  fromUomCode: string; // Purchase UOM (e.g., BAG)
  toUomCode: string; // Inventory / Base UOM (e.g., KG)
  numerator: number; // e.g., 25
  denominator: number; // e.g., 1
  conversionFactor: number; // numerator / denominator (1 fromUom = conversionFactor toUom)
  decimalPrecision: number;
  roundingRule: RoundingRule;
  requiresDensityBasis?: boolean; // Required for Weight <-> Volume
  densityFactor?: number; // e.g., kg/L when converting mass to volume
  compatibilityNote?: string;
  isActive: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface UomValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalizedFactor: number;
}

export interface GlobalItemAttachment {
  id: string;
  documentType:
    | 'TECHNICAL_DATASHEET'
    | 'ENGINEERING_DRAWING'
    | 'TECHNICAL_SPECIFICATION'
    | 'OTHER';
  fileName: string;
  fileReference: string;
  description?: string;
  documentVersion: string;
  uploadedBy: string;
  uploadedDate: string;
  effectiveDate?: string;
  expiryDate?: string;
  approvalStatus: 'DRAFT' | 'APPROVED' | 'REJECTED';
  isActive: boolean;
  fileSizeBytes?: number;
  mimeType?: string;
}

export interface GlobalChangeHistoryEntry {
  id: string;
  entityId: string;
  companyId?: string;
  branchId?: string;
  fieldAttribute: string;
  previousValue: string;
  newValue: string;
  changedBy: string;
  changedByUserId: string;
  changedAt: string;
  changeReason: string;
  approvalReference?: string;
  applicableRuleVersion?: number;
  relatedRequestRef?: string;
}

export interface BranchChangeHistoryEntry {
  id: string;
  entityId: string; // branchAvailabilityId
  globalItemId: string;
  companyId: string;
  branchId: string;
  fieldAttribute: string;
  previousValue: string;
  newValue: string;
  changedBy: string;
  changedByUserId: string;
  changedAt: string;
  changeReason: string;
  approvalReference?: string;
  applicableRuleVersion?: number;
  relatedRequestRef?: string;
}

export type DuplicateMatchSeverity = 'HARD_CONFLICT' | 'POTENTIAL_MATCH';

export interface DuplicateMatchCandidate {
  matchedItemId: string;
  matchedItemCode: string;
  matchedItemDescription: string;
  matchedItemStatus: string;
  severity: DuplicateMatchSeverity;
  matchReason: string;
  similarityScore: number; // 0-100
  matchedDimensions: string[];
}

export interface DuplicateDetectionReport {
  hasHardConflict: boolean;
  hasPotentialDuplicates: boolean;
  candidates: DuplicateMatchCandidate[];
  checkedAt: string;
}

export interface ItemMergeRecord {
  id: string;
  sourceItemId: string;
  sourceItemCode: string;
  targetItemId: string;
  targetItemCode: string;
  mergeReason: string;
  mergedByUserId: string;
  mergedByName: string;
  mergedAt: string;
  preservedBranchLinksCount: number;
  approvalReference?: string;
}

export type ItemRuleScope = 'GLOBAL_ITEM_CREATION' | 'BRANCH_ITEM_ACTIVATION';

export type ItemRuleLifecycleStatus =
  | 'DRAFT'
  | 'VALIDATED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'RETIRED';

export type RuleAuditResultStatus = 'PASS' | 'WARNING' | 'ERROR' | 'BLOCKED';

export interface RuleAuditCheckpointConfig {
  id: string;
  checkpointKey: string;
  checkpointLabel: string;
  ruleScope: ItemRuleScope;
  severity: 'ERROR' | 'WARNING' | 'BLOCKED';
  isMandatory: boolean;
  isEnabled: boolean;
  order: number;
  description?: string;
}

export interface RuleMasterVersionRecord {
  id: string;
  ruleName: string;
  ruleScope: ItemRuleScope;
  ruleVersion: number;
  lifecycleStatus: ItemRuleLifecycleStatus;
  effectiveDate: string;
  checkpoints: RuleAuditCheckpointConfig[];
  createdBy: string;
  createdAt: string;
  validatedAt?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  publishedAt?: string;
  retiredAt?: string;
  changeReason?: string;
}

export interface RuleAuditCheckpointResult {
  checkpointKey: string;
  checkpointLabel: string;
  status: RuleAuditResultStatus;
  evaluatedFields: string[];
  message: string;
  isMandatory: boolean;
}

export interface RuleAuditReport {
  auditId: string;
  entityId: string;
  auditType: ItemRuleScope;
  ruleVersion: number;
  overallResult: RuleAuditResultStatus;
  checkpoints: RuleAuditCheckpointResult[];
  errors: string[];
  warnings: string[];
  evaluatedBy: string;
  evaluatedByUserId: string;
  timestamp: string;
  canSubmit: boolean;
}

export interface BranchWarehousePlanningConfig {
  id: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  isEligible: boolean;
  isPreferred: boolean;
  storageLocation?: string;
  safetyStock?: number;
  reorderLevel?: number;
  maximumStock?: number;
  replenishmentMethod?: 'MIN_MAX' | 'REORDER_POINT' | 'MRP' | 'ON_DEMAND';
  procurementLeadTimeDays?: number;
}

export interface BranchAlternativeItemRef {
  id: string;
  alternativeGlobalItemId: string;
  alternativeGlobalItemCode: string;
  alternativeGlobalItemDescription?: string;
  relationshipType: 'ALTERNATIVE' | 'SUBSTITUTE' | 'EQUIVALENT';
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
  reason: string;
  approvalStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
}

export type BranchAttachmentDocType =
  | 'TECHNICAL_DATASHEET'
  | 'ENGINEERING_DRAWING'
  | 'TECHNICAL_SPECIFICATION'
  | 'TEST_CERTIFICATE'
  | 'QUALITY_CERTIFICATE'
  | 'REGULATORY_CERTIFICATE'
  | 'SAFETY_DATA_SHEET'
  | 'OTHER';

export interface BranchItemAttachment {
  id: string;
  documentType: BranchAttachmentDocType;
  fileName: string;
  fileReference: string;
  description?: string;
  documentVersion: string;
  uploadedBy: string;
  uploadedDate: string;
  effectiveDate?: string;
  expiryDate?: string;
  approvalStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  isActive: boolean;
  fileSizeBytes?: number;
  mimeType?: string;
}

export interface BranchBarcodeRecord {
  id: string;
  barcodeValue: string;
  barcodeType: 'EAN13' | 'UPC' | 'CODE128' | 'QR' | 'GTIN14';
  gtin?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: 'ACTIVE' | 'INACTIVE';
  isIntentionallyShared?: boolean;
  sharedJustification?: string;
}

export interface BranchRevisionInfo {
  id: string;
  revisionNumber: string;
  revisionDescription: string;
  technicalChangeRef?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  changeReason: string;
  approvedBy?: string;
  approvalStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
}

export type BranchItemWorkflowStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'RETURNED_FOR_CORRECTION'
  | 'APPROVED'
  | 'REJECTED'
  | 'MIGRATION_REVIEW_REQUIRED';

export interface BranchItemAvailabilityRecord {
  id: string;
  // Section A — Key Scope
  globalItemId: string;
  globalItemCode: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  branchId: string;
  branchCode: string;
  branchName: string;

  // Section B — Branch Category (Exclusive Branch Ownership)
  categoryCode: string;
  categoryName: string;
  itemRole: 'STOCK' | 'PURCHASE' | 'MANUFACTURE' | 'SALES' | 'SERVICE';
  branchSpecificDescription?: string;

  // Section C — Branch UOM Overrides
  branchPurchaseUom?: string;
  branchInventoryUom?: string;
  branchConversionOverride?: UomConversionDefinition;
  effectivePurchaseUom: string;
  effectiveInventoryUom: string;
  effectiveConversionFactor: number;
  preferredWarehouseId?: string;
  preferredBuyerId?: string;
  preferredSupplierId?: string;
  procurementLeadTimeDays?: number;

  // Section D — Branch Item Controls & Compliance
  shelfLifeControlled: boolean;
  shelfLifeDuration?: number;
  shelfLifeUnit?: 'DAYS' | 'MONTHS' | 'YEARS';
  minRemainingShelfLifeDays?: number;
  serialTrackingEnabled: boolean;
  serialPrefix?: string;
  serialFormat?: string;
  warrantyApplicable: boolean;
  warrantyDuration?: number;
  warrantyUnit?: 'MONTHS' | 'YEARS' | 'DAYS';
  warrantyTerms?: string;
  moq: number;
  orderMultiple: number;
  serviceControlEnabled: boolean;
  batchTrackingEnabled: boolean;
  lotTrackingEnabled: boolean;
  qualityInspectionRequired: boolean;
  inspectionType?: 'RECEIVING' | 'IN_PROCESS' | 'PRE_DISPATCH' | 'LAB_CERT';
  storageConditions?: string;
  regulatoryCompliance?: string;

  // Section E — Warehouse & Inventory Planning (Multi-warehouse)
  warehouseConfigs: BranchWarehousePlanningConfig[];

  // Section F — Alternative Item References
  alternativeItems: BranchAlternativeItemRef[];

  // Section G — Item Attachments
  attachments: BranchItemAttachment[];

  // Section H — Barcode / GTIN
  barcodes: BranchBarcodeRecord[];

  // Section I — Revision / Version
  currentRevision?: BranchRevisionInfo;
  revisionHistory: BranchRevisionInfo[];

  // Section J — Branch Availability & Dual Approval
  isPurchaseEnabled: boolean;
  isInventoryEnabled: boolean;
  isStocked: boolean;
  isManufactured: boolean;
  isSalesPermitted: boolean;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  activationReason: string;
  branchStatus: BranchItemWorkflowStatus;
  approvalStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  lastAuditReportId?: string;
  lastAuditStatus?: RuleAuditResultStatus;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedBy: string;
  updatedByName: string;
  updatedAt: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  sapItemCode?: string;
  approvalHistory: Array<{
    id: string;
    action: 'SAVE_DRAFT' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'ACTIVATE' | 'DEACTIVATE';
    actorId: string;
    actorName: string;
    actorRole: string;
    timestamp: string;
    remarks: string;
    previousStatus: string;
    newStatus: string;
  }>;
  migrationNote?: string;
}

export interface LegacyMigrationItemResult {
  globalItemId: string;
  globalItemCode: string;
  preservedCodeAndDesc: boolean;
  extractedCategoryCode?: string;
  extractedComplianceFlags: string[];
  migratedBranchRecords: Array<{
    branchId: string;
    branchName: string;
    companyId: string;
    categoryCode: string;
    status: 'MIGRATED_APPROVED' | 'MIGRATION_REVIEW_REQUIRED';
  }>;
  reviewRequired: boolean;
  reviewReason?: string;
}

export interface LegacyMigrationReconciliationReport {
  runId: string;
  executedAt: string;
  executedBy: string;
  totalGlobalItemsScanned: number;
  migratedCleanCount: number;
  reviewRequiredCount: number;
  branchRecordsCreatedCount: number;
  historicalTransactionsPreservedCount: number;
  items: LegacyMigrationItemResult[];
}
