import test from 'node:test';
import assert from 'node:assert/strict';
import { prGovernancePolicyService, createSystemDefaultPolicy } from '../services/prGovernancePolicyService';
import { prTypeMasterService } from '../services/prTypeMasterService';
import { PurchaseRequisitionService } from '../services/purchaseRequisitionService';
import { PRType, PurchaseRequisitionHeader } from '../types/purchaseRequisition';
import { PrGovernancePolicyConfig } from '../types/prGovernancePolicy';

test('PR Governance: Expected Delivery Date Policy Enforcement Suite', async (t) => {
  const KOSH_COMPANY_ID = 'co-kosh-01';
  const BRANCH_POND_ID = 'br-pond-01';
  const BRANCH_PUNE_ID = 'br-pune-04';

  const makeBasePrPayload = (overrides: Partial<any> = {}) => ({
    prType: 'MANUAL' as PRType,
    companyId: KOSH_COMPANY_ID,
    companyCode: 'KOSH-HQ',
    branchId: BRANCH_POND_ID,
    branchCode: '001',
    branchName: 'Pondicherry Plant',
    department: 'Operations',
    costCentre: 'CC-OPS-01',
    requesterId: 'usr-req-01',
    requesterName: 'Aditya Requester',
    creatorId: 'usr-req-01',
    creatorName: 'Aditya Requester',
    modifiedBy: 'Aditya Requester',
    priority: 'NORMAL' as const,
    status: 'DRAFT' as const,
    purchasePurpose: 'Procurement of test components',
    businessJustification: 'Operational requirement',
    deliveryLocation: 'Pondicherry Central Receiving',
    estimatedTotalValue: 50000,
    currency: 'INR',
    erpStockStatus: 'FRESH' as const,
    budgetValidationStatus: 'SUFFICIENT' as const,
    lines: [],
    changeHistory: [],
    attachments: [],
    ...overrides,
  });

  // Helper to ensure clean slate for tests
  const setupBasePolicies = (
    companyDeliveryDateEnabled: boolean,
    companyDeliveryDateMandatory: boolean = false,
    allowBranchOverride: boolean = true
  ) => {
    const policies = prGovernancePolicyService.getPolicies();
    
    // Find or create company policy for KOSH
    const koshPolicyIdx = policies.findIndex(p => p.companyId === KOSH_COMPANY_ID && p.branchId === 'ALL');
    assert.ok(koshPolicyIdx !== -1, 'KOSH company policy should exist');
    
    policies[koshPolicyIdx].activation.expectedDeliveryDateEnabled = companyDeliveryDateEnabled;
    policies[koshPolicyIdx].activation.expectedDeliveryDateMandatory = companyDeliveryDateMandatory;
    policies[koshPolicyIdx].activation.capexAssetPrEnabled = true;
    policies[koshPolicyIdx].activation.repairPrEnabled = true;
    policies[koshPolicyIdx].activation.maintenancePrEnabled = true;
    policies[koshPolicyIdx].activation.mrpPrCreationEnabled = true;
    policies[koshPolicyIdx].activation.manualPrCreationEnabled = true;
    policies[koshPolicyIdx].allowBranchOverride = allowBranchOverride;
    
    // Clean out branch overrides for KOSH
    const filtered = policies.filter(p => !(p.companyId === KOSH_COMPANY_ID && p.branchId !== 'ALL'));
    prGovernancePolicyService.savePolicies(filtered);
  };

  await t.test('Scenario A: Company Policy Disabled -> Effective policy disables field, clears date, allows PR create & submit without date', () => {
    setupBasePolicies(false, false, true);

    const effPolicy = prGovernancePolicyService.getEffectivePolicy(KOSH_COMPANY_ID, BRANCH_POND_ID);
    assert.equal(effPolicy.activation.expectedDeliveryDateEnabled, false, 'Expected Delivery Date must be disabled in effective policy');
    assert.equal(effPolicy.activation.expectedDeliveryDateMandatory, false, 'Mandatory date must be false when disabled');

    // Validation helper
    const valResult = prGovernancePolicyService.validateExpectedDeliveryDate('2026-11-20', effPolicy, false);
    assert.equal(valResult.valid, true, 'Validation passes without blocking');
    assert.equal(valResult.sanitizedDate, undefined, 'Sanitized date must be undefined (no invented or unauthorized dates persisted)');

    // Create PR without expected delivery date
    const newPr = PurchaseRequisitionService.createPR(
      makeBasePrPayload({
        expectedDeliveryDate: undefined,
        requiredBy: undefined,
        lines: [
          {
            id: 'line-test-1',
            prId: '',
            itemCode: 'RMPAOPOEXLG0001',
            description: 'PC-ABS Injection Grade',
            itemCategory: 'RAW_MATERIAL',
            inventoryUom: 'KG',
            requestedQuantity: 100,
            approximateUnitPrice: 500,
            currency: 'INR',
            estimatedTotalValue: 50000,
            specifications: 'Standard spec',
            purchasePurpose: 'Production Batch A',
            businessJustification: 'Required for batch A',
            deliverySchedules: [],
            lineAttachments: [],
            assignedBuyer: 'Default Buyer',
            buyerStatus: 'PENDING_CONFIGURATION',
            status: 'ACTIVE'
          }
        ]
      })
    );

    assert.ok(newPr.id, 'PR created successfully');
    assert.equal(newPr.expectedDeliveryDate, undefined, 'PR header expectedDeliveryDate must be undefined');
    assert.equal(newPr.requiredBy, undefined, 'PR header requiredBy must be undefined');

    // Submission passes without expected delivery date
    const subResult = PurchaseRequisitionService.submitPR(newPr.id);
    assert.equal(subResult.success, true, `PR submission must succeed when delivery date is disabled by policy. (Error: ${subResult.message})`);
  });

  await t.test('Scenario B: Company Policy Enabled -> Enforces mandatory constraint and date format', () => {
    setupBasePolicies(true, true, true); // Enabled and Mandatory

    const effPolicy = prGovernancePolicyService.getEffectivePolicy(KOSH_COMPANY_ID, BRANCH_POND_ID);
    assert.equal(effPolicy.activation.expectedDeliveryDateEnabled, true, 'Expected Delivery Date enabled');
    assert.equal(effPolicy.activation.expectedDeliveryDateMandatory, true, 'Mandatory flag is true');

    // Missing date should fail validation
    const missingVal = prGovernancePolicyService.validateExpectedDeliveryDate('', effPolicy, false);
    assert.equal(missingVal.valid, false, 'Validation should fail when date is mandatory and missing');
    assert.match(missingVal.reason || '', /Mandatory Field/i);

    // Invalid format should fail
    const invalidFormat = prGovernancePolicyService.validateExpectedDeliveryDate('20-11-2026', effPolicy, false);
    assert.equal(invalidFormat.valid, false, 'Validation should fail on non YYYY-MM-DD format');
    assert.match(invalidFormat.reason || '', /YYYY-MM-DD format/i);

    // Invalid calendar date should fail
    const invalidCalendar = prGovernancePolicyService.validateExpectedDeliveryDate('2026-02-31', effPolicy, false);
    assert.equal(invalidCalendar.valid, false, 'Validation should fail on impossible date 2026-02-31');
    assert.match(invalidCalendar.reason || '', /Invalid Calendar Date/i);

    // Valid date should pass
    const validDate = prGovernancePolicyService.validateExpectedDeliveryDate('2026-12-15', effPolicy, false);
    assert.equal(validDate.valid, true, 'Validation passes on valid ISO date');
    assert.equal(validDate.sanitizedDate, '2026-12-15');
  });

  await t.test('Scenario C: Branch Override Attempt when allowBranchOverride is false -> Rejected and inherits Company Disabled', () => {
    setupBasePolicies(false, false, false); // Company policy: delivery date disabled, branch override NOT allowed

    // Attempt to create a branch override policy enabling delivery date
    const branchPolicy: PrGovernancePolicyConfig = {
      ...createSystemDefaultPolicy(KOSH_COMPANY_ID, BRANCH_POND_ID),
      isInheritedFromCompany: false,
      allowBranchOverride: true,
      activation: {
        ...createSystemDefaultPolicy(KOSH_COMPANY_ID, BRANCH_POND_ID).activation,
        expectedDeliveryDateEnabled: true,
        expectedDeliveryDateMandatory: true,
      }
    };

    const policies = prGovernancePolicyService.getPolicies();
    policies.push(branchPolicy);
    prGovernancePolicyService.savePolicies(policies);

    const eff = prGovernancePolicyService.getEffectivePolicy(KOSH_COMPANY_ID, BRANCH_POND_ID);
    assert.equal(eff.activation.expectedDeliveryDateEnabled, false, 'Branch cannot override when allowBranchOverride is false; must inherit company disabled');
  });

  await t.test('Scenario D: Branch Override Permitted -> Specific branch enables delivery date while other branches inherit Disabled', () => {
    setupBasePolicies(false, false, true); // Company policy: Disabled, branch override allowed

    // Save branch override for Pondicherry
    const baseBranch = createSystemDefaultPolicy(KOSH_COMPANY_ID, BRANCH_POND_ID);
    baseBranch.isInheritedFromCompany = false;
    baseBranch.activation.expectedDeliveryDateEnabled = true;
    baseBranch.activation.expectedDeliveryDateMandatory = false;

    const policies = prGovernancePolicyService.getPolicies().filter(p => !(p.companyId === KOSH_COMPANY_ID && p.branchId === BRANCH_POND_ID));
    policies.push(baseBranch);
    prGovernancePolicyService.savePolicies(policies);

    // Pondicherry branch should have it enabled
    const pondEff = prGovernancePolicyService.getEffectivePolicy(KOSH_COMPANY_ID, BRANCH_POND_ID);
    assert.equal(pondEff.activation.expectedDeliveryDateEnabled, true, 'Pondicherry should have delivery date enabled via approved branch override');

    // Pune branch has no override and must inherit company Disabled
    const puneEff = prGovernancePolicyService.getEffectivePolicy(KOSH_COMPANY_ID, BRANCH_PUNE_ID);
    assert.equal(puneEff.activation.expectedDeliveryDateEnabled, false, 'Pune should inherit company Disabled');
  });

  await t.test('Scenario G: Direct API Bypass Rejection -> Unauthorized dates are sanitized upon PR creation', () => {
    setupBasePolicies(false, false, true); // Policy disabled

    // A direct API call attempts to inject a delivery date
    const prWithInjectedDate = PurchaseRequisitionService.createPR(
      makeBasePrPayload({
        purchasePurpose: 'Direct API test bypass attempt',
        expectedDeliveryDate: '2026-11-20', // Unauthorized injected date!
        requiredBy: '2026-11-20',
      })
    );

    assert.equal(prWithInjectedDate.expectedDeliveryDate, undefined, 'Direct injected delivery date must be sanitized to undefined');
    assert.equal(prWithInjectedDate.requiredBy, undefined, 'Direct injected requiredBy must be sanitized to undefined');
  });

  await t.test('Scenario H: Historical PR Date Protection -> Existing transaction dates are not erased or hidden', () => {
    // 1. Initially enabled: create PR with delivery date
    setupBasePolicies(true, false, true);
    const histPr = PurchaseRequisitionService.createPR(
      makeBasePrPayload({
        purchasePurpose: 'Historical Procurement with recorded date',
        expectedDeliveryDate: '2026-11-15',
        requiredBy: '2026-11-15',
      })
    );

    assert.equal(histPr.expectedDeliveryDate, '2026-11-15', 'Original PR created with date');

    // 2. Company governance now disables Expected Delivery Date
    setupBasePolicies(false, false, true);

    const effNow = prGovernancePolicyService.getEffectivePolicy(KOSH_COMPANY_ID, BRANCH_POND_ID);
    assert.equal(effNow.activation.expectedDeliveryDateEnabled, false);

    // 3. Historical PR validation check must preserve historical date
    const histCheck = prGovernancePolicyService.validateExpectedDeliveryDate(histPr.expectedDeliveryDate, effNow, true);
    assert.equal(histCheck.valid, true, 'Historical PR validation succeeds');
    assert.equal(histCheck.sanitizedDate, '2026-11-15', 'Historical PR date is preserved and not wiped');

    // 4. Update other fields of historical PR -> does not erase historical date
    const updated = PurchaseRequisitionService.updatePR(
      histPr.id,
      {
        priority: 'URGENT',
        purchasePurpose: 'Updated purpose',
      },
      { id: 'usr-req-01', fullName: 'Aditya Requester', role: 'REQUESTER' } as any
    );

    assert.ok(updated, 'Update should return updated PR');
    assert.equal(updated.expectedDeliveryDate, '2026-11-15', 'Historical date remains intact after updating unrelated fields');
  });

  await t.test('Scenario I: Header Date Decoupled from Line Split Delivery Schedules', () => {
    setupBasePolicies(false, false, true); // Header date disabled

    const splitPr = PurchaseRequisitionService.createPR(
      makeBasePrPayload({
        purchasePurpose: 'Staggered delivery split test',
        expectedDeliveryDate: undefined,
        requiredBy: undefined,
        lines: [
          {
            id: 'line-split-1',
            prId: '',
            itemCode: 'RMPAOPOEXLG0001',
            description: 'PC-ABS Injection Grade',
            itemCategory: 'RAW_MATERIAL',
            inventoryUom: 'KG',
            requestedQuantity: 200,
            approximateUnitPrice: 500,
            currency: 'INR',
            estimatedTotalValue: 100000,
            specifications: 'Standard spec',
            purchasePurpose: 'Quarterly split batches',
            businessJustification: 'Staggered delivery requirement',
            deliverySchedules: [
              { id: 'sch-1', lineId: 'line-split-1', deliveryDate: '2026-12-01', quantity: 100 },
              { id: 'sch-2', lineId: 'line-split-1', deliveryDate: '2027-01-15', quantity: 100 },
            ],
            lineAttachments: [],
            assignedBuyer: 'Default Buyer',
            buyerStatus: 'PENDING_CONFIGURATION',
            status: 'ACTIVE'
          }
        ]
      })
    );

    assert.equal(splitPr.expectedDeliveryDate, undefined, 'Header expectedDeliveryDate remains undefined');
    assert.equal(splitPr.lines[0].deliverySchedules.length, 2, 'Item line delivery schedules remain intact');
    assert.equal(splitPr.lines[0].deliverySchedules[0].deliveryDate, '2026-12-01');
    assert.equal(splitPr.lines[0].deliverySchedules[1].deliveryDate, '2027-01-15');
  });

  await t.test('Scenario J: All 5 PR Types respect Expected Delivery Date Policy Enforcement', () => {
    // Ensure CAPEX_ASSET is approved in PR Type Master
    const allMasters = prTypeMasterService.getPrTypes();
    const updatedMasters = allMasters.map((m) =>
      m.code === 'CAPEX_ASSET' ? { ...m, status: 'ACTIVE' as const, approvalStatus: 'APPROVED' as const } : m
    );
    prTypeMasterService.savePrTypes(updatedMasters);

    // Ensure CAPEX_ASSET has an approved applicability mapping
    const maps = prTypeMasterService.getMappings();
    if (!maps.some((m) => m.prTypeCode === 'CAPEX_ASSET' && m.status === 'ACTIVE' && m.approvalStatus === 'APPROVED')) {
      maps.push({
        id: 'map-capex-test',
        companyId: 'ALL',
        companyCode: 'ALL',
        companyName: 'All Companies',
        branchId: 'ALL',
        branchCode: 'ALL',
        branchName: 'All Branches',
        purchaseOrgId: 'ALL',
        purchaseOrgCode: 'ALL',
        purchaseOrgName: 'All Purchase Organizations',
        itemCategoryCode: 'ALL',
        itemCategoryName: 'All Item Categories',
        prTypeCode: 'CAPEX_ASSET',
        isEligible: true,
        effectiveFrom: '2026-01-01',
        status: 'ACTIVE',
        approvalStatus: 'APPROVED',
        versionNumber: 1,
        remarks: 'Test mapping',
        createdAt: new Date().toISOString(),
        createdBy: 'Test User',
        createdByUserId: 'usr-admin-01',
        updatedAt: new Date().toISOString(),
        updatedBy: 'Test User',
        updatedByUserId: 'usr-admin-01',
      });
      prTypeMasterService.saveMappings(maps);
    }

    const prTypes: PRType[] = ['MANUAL', 'MRP', 'REPAIR', 'MAINTENANCE', 'CAPEX_ASSET'];
    setupBasePolicies(false, false, true); // Disabled across company

    for (const type of prTypes) {
      const pr = PurchaseRequisitionService.createPR(
        makeBasePrPayload({
          prType: type,
          purchasePurpose: `Testing PR Type ${type}`,
          expectedDeliveryDate: '2026-11-20', // Should be stripped/omitted by policy
        })
      );

      assert.equal(
        pr.expectedDeliveryDate,
        undefined,
        `PR Type ${type} must enforce policy and sanitize header expectedDeliveryDate to undefined when disabled`
      );
    }
  });
});
