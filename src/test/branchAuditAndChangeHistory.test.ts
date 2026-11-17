import test from 'node:test';
import assert from 'node:assert/strict';
import { itemRuleAndAuditService } from '../services/itemRuleAndAuditService';
import { changeHistoryService } from '../services/changeHistoryService';
import { GlobalItem, BranchItemAvailabilityRecord } from '../types';

const mockGlobalItemApproved: GlobalItem = {
  id: 'gitm-001',
  globalItemCode: 'GI-RAW-STEEL-001',
  isProvisionalCode: false,
  categoryCode: 'RM',
  description: 'Cold Rolled Steel Sheet 2mm 1220x2440mm',
  status: 'APPROVED',
  defaultPurchaseUom: 'SHEET',
  defaultInventoryUom: 'KG',
  defaultUomConversion: {
    fromUomCode: 'SHEET',
    toUomCode: 'KG',
    numerator: 46.5,
    denominator: 1,
    conversionFactor: 46.5,
    decimalPrecision: 3,
    roundingRule: 'NEAREST',
    isActive: true,
  },
  attributes: {
    material: 'STEEL',
    type: 'SHEET',
    specification: 'CR Steel 2mm',
  },
  createdBy: 'usr-admin-01',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  codeRuleVersion: 1,
  descRuleVersion: 1,
  approvalHistory: [],
};

const mockCompliantBranchRecord: Partial<BranchItemAvailabilityRecord> = {
  id: 'bia-co-01-br-01-gitm-001',
  globalItemId: 'gitm-001',
  globalItemCode: 'GI-RAW-STEEL-001',
  companyId: 'co-kosh-01',
  branchId: 'br-pond-01',
  categoryCode: 'RM',
  categoryName: 'Raw Materials',
  itemRole: 'PURCHASE',
  isPurchaseEnabled: true,
  isInventoryEnabled: true,
  effectivePurchaseUom: 'SHEET',
  effectiveInventoryUom: 'KG',
  effectiveConversionFactor: 46.5,
  moq: 10,
  orderMultiple: 5,
  shelfLifeControlled: false,
  serialTrackingEnabled: false,
  warrantyApplicable: false,
  batchTrackingEnabled: true,
  lotTrackingEnabled: false,
  qualityInspectionRequired: true,
  inspectionType: 'RECEIVING',
  storageConditions: 'Dry indoor storage at 25C',
  regulatoryCompliance: 'ISO 9001:2015',
  warehouseConfigs: [
    {
      id: 'whp-01',
      warehouseId: 'wh-main',
      warehouseCode: 'WH-01',
      warehouseName: 'Main Storage',
      isEligible: true,
      isPreferred: true,
      storageLocation: 'RACK-A1',
      safetyStock: 50,
      reorderLevel: 100,
      maximumStock: 500,
    },
  ],
  alternativeItems: [
    {
      id: 'alt-01',
      alternativeGlobalItemId: 'gitm-002',
      alternativeGlobalItemCode: 'GI-RAW-STEEL-002',
      relationshipType: 'SUBSTITUTE',
      effectiveFrom: '2026-01-01',
      isActive: true,
      reason: 'Approved equivalent gauge steel',
      approvalStatus: 'APPROVED',
    },
  ],
  attachments: [
    {
      id: 'att-01',
      documentType: 'TECHNICAL_DATASHEET',
      fileName: 'spec_sheet.pdf',
      fileReference: 'https://docs.kosh.io/specs/steel_sheet.pdf',
      documentVersion: 'v1.0',
      uploadedBy: 'Quality Lead',
      uploadedDate: '2026-01-01',
      approvalStatus: 'APPROVED',
      isActive: true,
      fileSizeBytes: 1024 * 500,
    },
  ],
  barcodes: [
    {
      id: 'bc-01',
      barcodeValue: '8901234567890',
      barcodeType: 'EAN13',
      effectiveFrom: '2026-01-01',
      status: 'ACTIVE',
    },
  ],
  isActive: true,
  effectiveFrom: '2026-01-01',
  branchStatus: 'DRAFT',
  approvalStatus: 'DRAFT',
};

test('Phase 8: 25-checkpoint audit passes with canSubmit=true on compliant branch payload', () => {
  const report = itemRuleAndAuditService.evaluateBranchItemActivation(
    mockCompliantBranchRecord,
    mockGlobalItemApproved,
    []
  );

  assert.equal(report.auditType, 'BRANCH_ITEM_ACTIVATION');
  assert.equal(report.checkpoints.length, 25);
  assert.equal(report.canSubmit, true);
  assert.ok(report.overallResult === 'PASS' || report.overallResult === 'WARNING');
  assert.equal(report.errors.length, 0);
});

test('Phase 8: CP01 blocks activation if referenced global item is not APPROVED', () => {
  const unapprovedGlobalItem: GlobalItem = {
    ...mockGlobalItemApproved,
    status: 'SUBMITTED',
  };

  const report = itemRuleAndAuditService.evaluateBranchItemActivation(
    mockCompliantBranchRecord,
    unapprovedGlobalItem,
    []
  );

  const cp01 = report.checkpoints.find((c) => c.checkpointKey === 'CP01_GLOBAL_ITEM_APPROVED');
  assert.ok(cp01);
  assert.equal(cp01.status, 'BLOCKED');
  assert.equal(report.canSubmit, false);
  assert.ok(report.overallResult === 'BLOCKED');
});

test('Phase 8: CP04 requires mandatory Branch Category code', () => {
  const missingCategoryPayload = {
    ...mockCompliantBranchRecord,
    categoryCode: '',
  };

  const report = itemRuleAndAuditService.evaluateBranchItemActivation(
    missingCategoryPayload,
    mockGlobalItemApproved,
    []
  );

  const cp04 = report.checkpoints.find((c) => c.checkpointKey === 'CP04_MANDATORY_CATEGORY');
  assert.ok(cp04);
  assert.equal(cp04.status, 'ERROR');
  assert.equal(report.canSubmit, false);
});

test('Phase 8: CP05 blocks duplicate active assignment in same branch', () => {
  const existingActiveRecord: BranchItemAvailabilityRecord = {
    ...mockCompliantBranchRecord,
    id: 'bia-existing-active',
  } as BranchItemAvailabilityRecord;

  const duplicatePayload = {
    ...mockCompliantBranchRecord,
    id: 'bia-new-record',
  };

  const report = itemRuleAndAuditService.evaluateBranchItemActivation(
    duplicatePayload,
    mockGlobalItemApproved,
    [existingActiveRecord]
  );

  const cp05 = report.checkpoints.find((c) => c.checkpointKey === 'CP05_UNIQUE_ACTIVATION');
  assert.ok(cp05);
  assert.equal(cp05.status, 'BLOCKED');
  assert.equal(report.canSubmit, false);
});

test('Phase 8: CP11 enforces conversion factor = 1 when Purchase UOM === Inventory UOM', () => {
  const invalidArithmeticPayload = {
    ...mockCompliantBranchRecord,
    effectivePurchaseUom: 'KG',
    effectiveInventoryUom: 'KG',
    effectiveConversionFactor: 2.5, // Mismatch: same UOM must be 1.0
  };

  const report = itemRuleAndAuditService.evaluateBranchItemActivation(
    invalidArithmeticPayload,
    mockGlobalItemApproved,
    []
  );

  const cp11 = report.checkpoints.find((c) => c.checkpointKey === 'CP11_UOM_ARITHMETIC');
  assert.ok(cp11);
  assert.equal(cp11.status, 'ERROR');
  assert.equal(report.canSubmit, false);
});

test('Phase 8: CP12 & CP13 enforce MOQ > 0 and Order Multiple >= 1', () => {
  const invalidMoqPayload = {
    ...mockCompliantBranchRecord,
    moq: 0,
    orderMultiple: 0,
  };

  const report = itemRuleAndAuditService.evaluateBranchItemActivation(
    invalidMoqPayload,
    mockGlobalItemApproved,
    []
  );

  const cp12 = report.checkpoints.find((c) => c.checkpointKey === 'CP12_MOQ_GOVERNANCE');
  const cp13 = report.checkpoints.find((c) => c.checkpointKey === 'CP13_ORDER_MULTIPLE');

  assert.equal(cp12?.status, 'ERROR');
  assert.equal(cp13?.status, 'ERROR');
  assert.equal(report.canSubmit, false);
});

test('Phase 8: CP14 requires duration and unit when shelfLifeControlled is true', () => {
  const invalidShelfLifePayload = {
    ...mockCompliantBranchRecord,
    shelfLifeControlled: true,
    shelfLifeDuration: undefined,
    shelfLifeUnit: undefined,
  };

  const report = itemRuleAndAuditService.evaluateBranchItemActivation(
    invalidShelfLifePayload,
    mockGlobalItemApproved,
    []
  );

  const cp14 = report.checkpoints.find((c) => c.checkpointKey === 'CP14_SHELF_LIFE');
  assert.equal(cp14?.status, 'ERROR');
  assert.equal(report.canSubmit, false);
});

test('Phase 8: CP21 requires at least one eligible warehouse in warehouseConfigs', () => {
  const noEligibleWhPayload = {
    ...mockCompliantBranchRecord,
    warehouseConfigs: [
      {
        id: 'whp-01',
        warehouseId: 'wh-01',
        warehouseCode: 'WH-01',
        warehouseName: 'Storage',
        isEligible: false,
        isPreferred: false,
      },
    ],
  };

  const report = itemRuleAndAuditService.evaluateBranchItemActivation(
    noEligibleWhPayload,
    mockGlobalItemApproved,
    []
  );

  const cp21 = report.checkpoints.find((c) => c.checkpointKey === 'CP21_WAREHOUSE_ELIGIBILITY');
  assert.equal(cp21?.status, 'ERROR');
  assert.equal(report.canSubmit, false);
});

test('Phase 8: CP23 blocks self-referencing alternative item', () => {
  const selfRefAltPayload = {
    ...mockCompliantBranchRecord,
    alternativeItems: [
      {
        id: 'alt-bad',
        alternativeGlobalItemId: 'gitm-001', // Same as globalItemId!
        alternativeGlobalItemCode: 'GI-RAW-STEEL-001',
        relationshipType: 'ALTERNATIVE' as const,
        effectiveFrom: '2026-01-01',
        isActive: true,
        reason: 'Self-reference',
        approvalStatus: 'APPROVED' as const,
      },
    ],
  };

  const report = itemRuleAndAuditService.evaluateBranchItemActivation(
    selfRefAltPayload,
    mockGlobalItemApproved,
    []
  );

  const cp23 = report.checkpoints.find((c) => c.checkpointKey === 'CP23_ALTERNATIVES_INTEGRITY');
  assert.equal(cp23?.status, 'BLOCKED');
  assert.equal(report.canSubmit, false);
});

test('Phase 8: CP24 blocks executable javascript: URI schemes in attachments', () => {
  const dangerousAttachmentPayload = {
    ...mockCompliantBranchRecord,
    attachments: [
      {
        id: 'att-xss',
        documentType: 'TECHNICAL_DATASHEET' as const,
        fileName: 'malicious.pdf',
        fileReference: 'javascript:alert(1)',
        documentVersion: 'v1.0',
        uploadedBy: 'Hacker',
        uploadedDate: '2026-01-01',
        approvalStatus: 'APPROVED' as const,
        isActive: true,
      },
    ],
  };

  const report = itemRuleAndAuditService.evaluateBranchItemActivation(
    dangerousAttachmentPayload,
    mockGlobalItemApproved,
    []
  );

  const cp24 = report.checkpoints.find((c) => c.checkpointKey === 'CP24_ATTACHMENT_SECURITY');
  assert.equal(cp24?.status, 'BLOCKED');
  assert.equal(report.canSubmit, false);
});

test('Phase 8: Field-level change history diffing engine detects modified attributes', async () => {
  const prevRecord = {
    categoryCode: 'RM',
    effectivePurchaseUom: 'SHEET',
    moq: 10,
    shelfLifeControlled: false,
  };

  const newRecord = {
    categoryCode: 'RM',
    effectivePurchaseUom: 'BUNDLE', // Changed
    moq: 25,                        // Changed
    shelfLifeControlled: true,       // Changed
  };

  const changes = await changeHistoryService.diffAndRecordBranchChanges(
    'bia-01',
    'gitm-001',
    'co-kosh-01',
    'br-pond-01',
    prevRecord,
    newRecord,
    {
      changedBy: 'Plant Manager',
      changedByUserId: 'usr-pm-01',
      changeReason: 'Updated minimum order quantity and UOM packaging',
      applicableRuleVersion: 1,
    }
  );

  assert.equal(changes.length, 3);
  const uomChange = changes.find((c) => c.fieldAttribute === 'effectivePurchaseUom');
  const moqChange = changes.find((c) => c.fieldAttribute === 'moq');
  const shelfLifeChange = changes.find((c) => c.fieldAttribute === 'shelfLifeControlled');

  assert.ok(uomChange);
  assert.equal(uomChange.previousValue, 'SHEET');
  assert.equal(uomChange.newValue, 'BUNDLE');

  assert.ok(moqChange);
  assert.equal(moqChange.previousValue, '10');
  assert.equal(moqChange.newValue, '25');

  assert.ok(shelfLifeChange);
  assert.equal(shelfLifeChange.previousValue, 'false');
  assert.equal(shelfLifeChange.newValue, 'true');
});
