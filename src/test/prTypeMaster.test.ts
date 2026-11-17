import test from 'node:test';
import assert from 'node:assert/strict';
import { prTypeMasterService } from '../services/prTypeMasterService';
import { prGovernancePolicyService } from '../services/prGovernancePolicyService';
import { PurchaseRequisitionService } from '../services/purchaseRequisitionService';
import { User } from '../types';

const MAKER_USER: User = {
  id: 'usr-admin-01',
  email: 'admin@koshinnovations.com',
  fullName: 'Rajesh Sharma',
  employeeId: 'EMP-1001',
  designation: 'Platform Admin',
  department: 'Governance',
  status: 'ACTIVE',
  role: 'PLATFORM_ADMIN',
  orgId: 'org-kosh-01',
  allowedBranchIds: [],
  isGlobalScope: true,
  twoFactorEnabled: true,
};

const CHECKER_USER: User = {
  id: 'usr-checker-01',
  email: 'checker@koshinnovations.com',
  fullName: 'Vikramaditya Rao',
  employeeId: 'EMP-2001',
  designation: 'Org Admin',
  department: 'Corporate Governance',
  status: 'ACTIVE',
  role: 'ORG_ADMIN',
  orgId: 'org-kosh-01',
  allowedBranchIds: [],
  isGlobalScope: true,
  twoFactorEnabled: true,
};

test('PR Type Master seeds 4 active legacy PR types and 1 inactive/draft CAPEX_ASSET record', () => {
  prTypeMasterService.resetForTests();
  const types = prTypeMasterService.getPrTypes();
  assert.equal(types.length, 5);

  const codes = types.map((t) => t.code);
  assert.deepEqual(codes, ['MANUAL', 'MRP', 'REPAIR', 'MAINTENANCE', 'CAPEX_ASSET']);

  for (const legacy of ['MANUAL', 'MRP', 'REPAIR', 'MAINTENANCE']) {
    const rec = types.find((t) => t.code === legacy)!;
    assert.equal(rec.status, 'ACTIVE');
    assert.equal(rec.approvalStatus, 'APPROVED');
  }

  const capex = types.find((t) => t.code === 'CAPEX_ASSET')!;
  assert.equal(capex.name, 'Capex / Asset Requisition');
  assert.equal(capex.status, 'INACTIVE');
  assert.equal(capex.approvalStatus, 'DRAFT');
  assert.equal(capex.isCapexType, true);
  assert.equal(capex.requiresAssetClassification, true);
  assert.equal(capex.requiresBudgetExceptionFlow, true);
});

test('CAPEX_ASSET is strictly deny-by-default across companies, branches, and categories', () => {
  prTypeMasterService.resetForTests();

  const res1 = prTypeMasterService.evaluatePrTypeEligibility({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    itemCategoryCode: 'CP',
    prTypeCode: 'CAPEX_ASSET',
    evaluationDate: '2026-11-13',
  });
  assert.equal(res1.eligible, false);
  assert.match(res1.reason, /not approved|INACTIVE/i);

  const legacyManual = prTypeMasterService.evaluatePrTypeEligibility({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    itemCategoryCode: 'RM',
    prTypeCode: 'MANUAL',
    evaluationDate: '2026-11-13',
  });
  assert.equal(legacyManual.eligible, true);
});

test('Maker-Checker enforcement and versioned Company/Branch/PO/Category mapping control CAPEX_ASSET eligibility', () => {
  prTypeMasterService.resetForTests();

  const capex = prTypeMasterService.getPrTypeByCode('CAPEX_ASSET')!;
  prTypeMasterService.submitPrTypeForApproval(capex.id, MAKER_USER, 'Submit CAPEX_ASSET');

  // Maker cannot approve own record
  assert.throws(
    () => prTypeMasterService.approvePrType(capex.id, MAKER_USER, true),
    /Maker-Checker Violation/
  );

  // Separate checker approves and activates
  const approvedCapex = prTypeMasterService.approvePrType(capex.id, CHECKER_USER, true, 'Approved');
  assert.equal(approvedCapex.approvalStatus, 'APPROVED');
  assert.equal(approvedCapex.status, 'ACTIVE');

  // Even after PR Type is ACTIVE + APPROVED, CAPEX_ASSET remains blocked without an active approved mapping!
  const beforeMapping = prTypeMasterService.evaluatePrTypeEligibility({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    itemCategoryCode: 'CP',
    prTypeCode: 'CAPEX_ASSET',
    evaluationDate: '2026-11-13',
  });
  assert.equal(beforeMapping.eligible, false);
  assert.match(beforeMapping.reason, /No active, approved/);

  // Create mapping scoped strictly to co-kosh-01 / br-pond-01 / po-kosh-01 / CP
  const mapping = prTypeMasterService.createMapping(
    {
      companyId: 'co-kosh-01',
      branchId: 'br-pond-01',
      purchaseOrgId: 'po-kosh-01',
      purchaseOrgCode: 'PO-HQ-01',
      purchaseOrgName: 'Kosh Central Procurement Organization',
      itemCategoryCode: 'CP',
      prTypeCode: 'CAPEX_ASSET',
      isEligible: true,
      effectiveFrom: '2026-11-01',
      effectiveUntil: '2027-03-31',
      remarks: 'Enable Capex PR for Puducherry Capital Equipment',
    },
    MAKER_USER
  );
  assert.equal(mapping.status, 'INACTIVE');
  assert.equal(mapping.approvalStatus, 'DRAFT');

  prTypeMasterService.submitMappingForApproval(mapping.id, MAKER_USER);
  assert.throws(
    () => prTypeMasterService.approveMapping(mapping.id, MAKER_USER, true),
    /Maker-Checker Violation/
  );
  const approvedMapping = prTypeMasterService.approveMapping(mapping.id, CHECKER_USER, true);
  assert.equal(approvedMapping.status, 'ACTIVE');
  assert.equal(approvedMapping.approvalStatus, 'APPROVED');

  // Eligible for mapped scope & date
  const eligible = prTypeMasterService.evaluatePrTypeEligibility({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    purchaseOrgId: 'po-kosh-01',
    itemCategoryCode: 'CP',
    prTypeCode: 'CAPEX_ASSET',
    evaluationDate: '2026-11-13',
  });
  assert.equal(eligible.eligible, true);
  assert.equal(eligible.matchedMapping?.id, mapping.id);

  // Blocked for unmapped category (RM), unmapped branch (br-pune-04), and outside effectiveUntil
  assert.equal(
    prTypeMasterService.evaluatePrTypeEligibility({
      companyId: 'co-kosh-01',
      branchId: 'br-pond-01',
      purchaseOrgId: 'po-kosh-01',
      itemCategoryCode: 'RM',
      prTypeCode: 'CAPEX_ASSET',
      evaluationDate: '2026-11-13',
    }).eligible,
    false
  );
  assert.equal(
    prTypeMasterService.evaluatePrTypeEligibility({
      companyId: 'co-kosh-01',
      branchId: 'br-pune-04',
      purchaseOrgId: 'po-kosh-01',
      itemCategoryCode: 'CP',
      prTypeCode: 'CAPEX_ASSET',
      evaluationDate: '2026-11-13',
    }).eligible,
    false
  );
  assert.equal(
    prTypeMasterService.evaluatePrTypeEligibility({
      companyId: 'co-kosh-01',
      branchId: 'br-pond-01',
      purchaseOrgId: 'po-kosh-01',
      itemCategoryCode: 'CP',
      prTypeCode: 'CAPEX_ASSET',
      evaluationDate: '2027-04-01',
    }).eligible,
    false
  );

  // History captures full audit trail
  const history = prTypeMasterService.getVersionHistory(mapping.id);
  assert.ok(history.some((h) => h.action === 'CREATED'));
  assert.ok(history.some((h) => h.action === 'SUBMITTED'));
  assert.ok(history.some((h) => h.action === 'APPROVED'));
});

test('More specific DENY mapping overrides broad baseline ALLOW mapping', () => {
  prTypeMasterService.resetForTests();

  const denyMap = prTypeMasterService.createMapping(
    {
      companyId: 'co-kosh-02',
      branchId: 'br-hosr-03',
      purchaseOrgId: 'ALL',
      itemCategoryCode: 'SV',
      prTypeCode: 'MRP',
      isEligible: false,
      effectiveFrom: '2026-01-01',
      remarks: 'Services category cannot use MRP PR at Hosur',
    },
    MAKER_USER
  );
  prTypeMasterService.submitMappingForApproval(denyMap.id, MAKER_USER);
  prTypeMasterService.approveMapping(denyMap.id, CHECKER_USER, true);

  const denied = prTypeMasterService.evaluatePrTypeEligibility({
    companyId: 'co-kosh-02',
    branchId: 'br-hosr-03',
    itemCategoryCode: 'SV',
    prTypeCode: 'MRP',
    evaluationDate: '2026-11-13',
  });
  assert.equal(denied.eligible, false);
  assert.equal(denied.matchedMapping?.id, denyMap.id);

  const stillAllowed = prTypeMasterService.evaluatePrTypeEligibility({
    companyId: 'co-kosh-02',
    branchId: 'br-hosr-03',
    itemCategoryCode: 'RM',
    prTypeCode: 'MRP',
    evaluationDate: '2026-11-13',
  });
  assert.equal(stillAllowed.eligible, true);
});

test('PurchaseRequisitionService.createPR enforces CAPEX_ASSET eligibility gate', () => {
  prTypeMasterService.resetForTests();

  // Enable governance switch for CAPEX_ASSET in co-kosh-01
  const pol = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'ALL');
  prGovernancePolicyService.savePolicyConfiguration(
    {
      ...pol,
      activation: {
        ...pol.activation,
        capexAssetPrEnabled: true,
      },
    },
    MAKER_USER,
    'Enable CAPEX_ASSET governance switch for test'
  );

  const basePrInput = {
    prType: 'CAPEX_ASSET' as const,
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Main Plant & HQ',
    department: 'Production',
    costCentre: 'CC-PROD-101',
    requesterId: MAKER_USER.id,
    requesterName: MAKER_USER.fullName,
    creatorId: MAKER_USER.id,
    creatorName: MAKER_USER.fullName,
    priority: 'NORMAL' as const,
    status: 'DRAFT' as const,
    purchasePurpose: 'CNC Machine Acquisition',
    businessJustification: 'Capacity expansion',
    deliveryLocation: 'Puducherry Main Plant',
    estimatedTotalValue: 450000,
    currency: 'INR',
    budgetValidationStatus: 'NOT_VALIDATED' as const,
    erpStockStatus: 'FRESH' as const,
    lines: [
      {
        id: 'line-capex-1',
        prId: 'temp',
        itemCode: 'CPMC001',
        description: '5-Axis CNC Machining Center',
        itemCategory: 'CP',
        inventoryUom: 'EA',
        requestedQuantity: 1,
        approximateUnitPrice: 450000,
        currency: 'INR',
        estimatedTotalValue: 450000,
        deliverySchedules: [],
        status: 'ACTIVE' as const,
      },
    ],
    changeHistory: [],
    attachments: [],
  };

  // Fails before CAPEX_ASSET PR Type Master is approved/active and mapped
  assert.throws(
    () => PurchaseRequisitionService.createPR(basePrInput, MAKER_USER),
    /not approved|INACTIVE/i
  );

  // Approve CAPEX_ASSET & map CP for co-kosh-01 / br-pond-01
  const capex = prTypeMasterService.getPrTypeByCode('CAPEX_ASSET')!;
  prTypeMasterService.submitPrTypeForApproval(capex.id, MAKER_USER);
  prTypeMasterService.approvePrType(capex.id, CHECKER_USER, true);

  const map = prTypeMasterService.createMapping(
    {
      companyId: 'co-kosh-01',
      branchId: 'br-pond-01',
      purchaseOrgId: 'ALL',
      itemCategoryCode: 'CP',
      prTypeCode: 'CAPEX_ASSET',
      isEligible: true,
      effectiveFrom: '2026-01-01',
    },
    MAKER_USER
  );
  prTypeMasterService.submitMappingForApproval(map.id, MAKER_USER);
  prTypeMasterService.approveMapping(map.id, CHECKER_USER, true);

  const created = PurchaseRequisitionService.createPR(basePrInput, MAKER_USER);
  assert.equal(created.prType, 'CAPEX_ASSET');
});
