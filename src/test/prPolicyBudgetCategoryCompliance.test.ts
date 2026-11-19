import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prGovernancePolicyService,
  INITIAL_PR_GOVERNANCE_POLICIES,
} from '../services/prGovernancePolicyService';
import { prTypeMasterService } from '../services/prTypeMasterService';
import { PurchaseRequisitionService } from '../services/purchaseRequisitionService';
import { User } from '../types';

const ADMIN_MAKER: User = {
  id: 'usr-maker-compliance-1',
  fullName: 'Rajesh Sharma',
  email: 'rajesh@kosh.in',
  role: 'PLATFORM_ADMIN',
  orgId: 'co-kosh-01',
  allowedBranchIds: ['br-pond-01', 'br-hosur-02'],
  status: 'ACTIVE',
  isGlobalScope: true,
  twoFactorEnabled: true,
};

const DEPT_HEAD: User = {
  id: 'usr-dept-compliance-1',
  fullName: 'Meenakshi Sundaram',
  email: 'meenakshi@kosh.in',
  role: 'ORG_ADMIN',
  orgId: 'co-kosh-01',
  allowedBranchIds: ['br-pond-01'],
  status: 'ACTIVE',
  isGlobalScope: false,
  twoFactorEnabled: true,
};

const PROC_MGR: User = {
  id: 'usr-pm-compliance-1',
  fullName: 'Karthik Subramanian',
  email: 'karthik@kosh.in',
  role: 'BRANCH_COORDINATOR',
  orgId: 'co-kosh-01',
  allowedBranchIds: ['br-pond-01'],
  status: 'ACTIVE',
  isGlobalScope: false,
  twoFactorEnabled: true,
};

function resetGovernancePolicies() {
  prGovernancePolicyService.savePolicies(
    JSON.parse(JSON.stringify(INITIAL_PR_GOVERNANCE_POLICIES))
  );
}

test('1. Company & Branch Policy Compliance: Centrally controlled locks, branch override gate, effective dates & ACTIVE isolation', () => {
  resetGovernancePolicies();
  try {
    const policies = prGovernancePolicyService.getPolicies();
    const companyPol = policies.find((p) => p.companyId === 'co-kosh-01' && p.branchId === 'ALL')!;
    companyPol.allowBranchOverride = true;
    companyPol.centrallyControlledFields = ['budgetValidationEnabled', 'enableApprovalWorkflow'];
    companyPol.activation.budgetValidationEnabled = false;
    companyPol.budget.enableBudgetValidation = false;
    companyPol.approval.enableApprovalWorkflow = true;

    // Branch attempts to turn budgetValidationEnabled ON and turn approval OFF despite central locks,
    // plus an unapproved DRAFT override on another branch
    const activeBranchOverride = {
      ...JSON.parse(JSON.stringify(companyPol)),
      id: 'pr-pol-co-kosh-01-br-pond-01',
      branchId: 'br-pond-01',
      branchCode: '001',
      branchName: 'Pondicherry Main Plant',
      policyScope: 'BRANCH' as const,
      isInheritedFromCompany: false,
      effectiveStatus: 'ACTIVE' as const,
      effectiveFrom: '2026-01-01',
      activation: {
        ...companyPol.activation,
        budgetValidationEnabled: true, // locked by company -> must stay false
      },
      budget: {
        ...companyPol.budget,
        enableBudgetValidation: true, // locked by company -> must sync to false
      },
      approval: {
        ...companyPol.approval,
        enableApprovalWorkflow: false, // locked by company -> must stay true
        approvalLevels: 2, // not locked -> branch can customize
      },
    };

    const draftBranchOverride = {
      ...JSON.parse(JSON.stringify(companyPol)),
      id: 'pr-pol-co-kosh-01-br-hosur-02-draft',
      branchId: 'br-hosur-02',
      branchCode: '002',
      branchName: 'Hosur Plant',
      policyScope: 'BRANCH' as const,
      isInheritedFromCompany: false,
      effectiveStatus: 'DRAFT' as const,
      activation: {
        ...companyPol.activation,
        prModuleEnabled: false,
      },
    };

    prGovernancePolicyService.savePolicies([
      ...policies.filter((p) => p.companyId !== 'co-kosh-01'),
      companyPol,
      activeBranchOverride,
      draftBranchOverride,
    ]);

    const effPond = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'br-pond-01', '2026-11-18');
    assert.equal(effPond.resolutionSource, 'BRANCH_OVERRIDE');
    assert.equal(effPond.activation.budgetValidationEnabled, false, 'Central lock keeps budget OFF');
    assert.equal(effPond.budget.enableBudgetValidation, false, 'Central lock syncs budget section OFF');
    assert.equal(effPond.approval.enableApprovalWorkflow, true, 'Central lock keeps approval workflow ON');
    assert.equal(effPond.approval.approvalLevels, 2, 'Unlocked approval levels follow branch override');

    // Draft branch override must NOT take effect
    const effHosur = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'br-hosur-02', '2026-11-18');
    assert.equal(effHosur.resolutionSource, 'COMPANY_INHERITED');
    assert.equal(effHosur.activation.prModuleEnabled, true);
  } finally {
    resetGovernancePolicies();
  }
});

test('2. Approval Workflow Matrix, Multi-Level Progression, Maker-Checker & SAP Handoff Gate', () => {
  resetGovernancePolicies();
  try {
    const policies = prGovernancePolicyService.getPolicies();
    const companyPol = policies.find((p) => p.companyId === 'co-kosh-01' && p.branchId === 'ALL')!;
    companyPol.requireMakerCheckerApproval = true;
    companyPol.approval.mandatoryApprovalRemarks = true;
    companyPol.approval.approvalLevels = 3;
    if (companyPol.approval.approvalMatrix?.[1]) {
      companyPol.approval.approvalMatrix[1].alternateApproverRole = 'BRANCH_COORDINATOR';
    }
    // Turn budget OFF to prove approval workflow still operates strictly without budget
    companyPol.activation.budgetValidationEnabled = false;
    companyPol.budget.enableBudgetValidation = false;
    prGovernancePolicyService.savePolicies(policies);

    // Valuation 250,000 => Tier 2 (100,001 .. 1,000,000) -> 2 approval levels required
    const created = PurchaseRequisitionService.createPR(
      {
        prType: 'MANUAL',
        companyId: 'co-kosh-01',
        companyCode: 'KOSH-HQ',
        branchId: 'br-pond-01',
        branchCode: '001',
        branchName: 'Pondicherry Main Plant',
        department: 'Production',
        costCentre: 'CC-PROD-101',
        requesterId: ADMIN_MAKER.id,
        requesterName: ADMIN_MAKER.fullName,
        creatorId: ADMIN_MAKER.id,
        creatorName: ADMIN_MAKER.fullName,
        modifiedBy: ADMIN_MAKER.fullName,
        priority: 'NORMAL',
        status: 'DRAFT',
        purchasePurpose: 'Tooling Steel Procurement',
        businessJustification: 'Production expansion',
        deliveryLocation: 'Bay 1',
        estimatedTotalValue: 220000,
        chargesTotalValue: 30000,
        grandTotalWithCharges: 250000,
        currency: 'INR',
        budgetValidationStatus: 'NOT_VALIDATED',
        erpStockStatus: 'FRESH',
        erpStockTimestamp: '2026-11-18T08:00:00Z',
        lines: [
          {
            id: 'ln-wf-1',
            prId: '',
            itemCode: 'PK-BOX-01',
            description: 'Corrugated Packaging Carton',
            itemCategory: 'PK',
            inventoryUom: 'NOS',
            requestedQuantity: 100,
            approximateUnitPrice: 2200,
            currency: 'INR',
            estimatedTotalValue: 220000,
            specifications: 'Heavy duty',
            purchasePurpose: 'Packaging',
            deliverySchedules: [],
            assignedBuyer: 'Default Buyer',
            buyerStatus: 'PENDING_CONFIGURATION',
            status: 'ACTIVE',
          },
        ],
        changeHistory: [],
        attachments: [],
      },
      ADMIN_MAKER
    );

    const submitRes = PurchaseRequisitionService.submitPR(created.id, ADMIN_MAKER);
    assert.equal(submitRes.success, true);

    // SAP B1 creation must be blocked while PR is still pending approval
    const sapPending = PurchaseRequisitionService.validateSapB1TransactionReadiness(created.id);
    assert.equal(sapPending.ready, false);

    // Maker cannot self-approve when requireMakerCheckerApproval=true
    assert.throws(
      () =>
        PurchaseRequisitionService.approvePR(
          created.id,
          ADMIN_MAKER.fullName,
          ADMIN_MAKER.role,
          'Self approve attempt',
          { actorUser: ADMIN_MAKER }
        ),
      /Maker-Checker Control/i
    );

    // Blank remarks rejected when mandatoryApprovalRemarks=true
    assert.throws(
      () =>
        PurchaseRequisitionService.approvePR(
          created.id,
          DEPT_HEAD.fullName,
          DEPT_HEAD.role,
          '   ',
          { actorUser: DEPT_HEAD }
        ),
      /remarks are mandatory/i
    );

    // Level 1 approval moves PR to PENDING_SUBSEQUENT_APPROVAL (not yet ready for SAP)
    const afterL1 = PurchaseRequisitionService.approvePR(
      created.id,
      DEPT_HEAD.fullName,
      DEPT_HEAD.role,
      'Level 1 Department Head approved',
      { actorUser: DEPT_HEAD }
    );
    assert.equal(afterL1?.status, 'PENDING_SUBSEQUENT_APPROVAL');
    const sapAfterL1 = PurchaseRequisitionService.validateSapB1TransactionReadiness(created.id);
    assert.equal(sapAfterL1.ready, false);

    // Level 2 approval completes matrix -> APPROVED_PENDING_BUYER and SAP-ready
    const afterL2 = PurchaseRequisitionService.approvePR(
      created.id,
      PROC_MGR.fullName,
      PROC_MGR.role,
      'Level 2 Procurement Manager approved',
      { actorUser: PROC_MGR }
    );
    assert.equal(afterL2?.status, 'APPROVED_PENDING_BUYER');
    const sapAfterL2 = PurchaseRequisitionService.validateSapB1TransactionReadiness(created.id);
    assert.equal(sapAfterL2.ready, true);
  } finally {
    resetGovernancePolicies();
  }
});

test('3. Conditional Budget Validation: Strict OFF vs ON behavior across Submit, Approve & Short Close', () => {
  resetGovernancePolicies();
  try {
    const policies = prGovernancePolicyService.getPolicies();
    const companyPol = policies.find((p) => p.companyId === 'co-kosh-01' && p.branchId === 'ALL')!;
    // Case A: Budget Validation OFF -> 80L PR (>10L available ledger) MUST succeed cleanly without budget snapshot/release
    companyPol.activation.budgetValidationEnabled = false;
    companyPol.budget.enableBudgetValidation = false;
    prGovernancePolicyService.savePolicies(policies);

    assert.equal(prGovernancePolicyService.isBudgetValidationEnabled('co-kosh-01', 'br-pond-01'), false);

    const offPr = PurchaseRequisitionService.createPR(
      {
        prType: 'MANUAL',
        companyId: 'co-kosh-01',
        companyCode: 'KOSH-HQ',
        branchId: 'br-pond-01',
        branchCode: '001',
        branchName: 'Pondicherry Main Plant',
        department: 'Production',
        costCentre: 'CC-PROD-101',
        requesterId: DEPT_HEAD.id,
        requesterName: DEPT_HEAD.fullName,
        creatorId: DEPT_HEAD.id,
        creatorName: DEPT_HEAD.fullName,
        modifiedBy: DEPT_HEAD.fullName,
        priority: 'NORMAL',
        status: 'DRAFT',
        purchasePurpose: 'Large Unbudgeted Emergency Order',
        businessJustification: 'Budget validation is OFF by policy',
        deliveryLocation: 'Bay 1',
        estimatedTotalValue: 8000000,
        currency: 'INR',
        budgetValidationStatus: 'NOT_VALIDATED',
        erpStockStatus: 'FRESH',
        erpStockTimestamp: '2026-11-18T08:00:00Z',
        lines: [
          {
            id: 'ln-bgt-off-1',
            prId: '',
            itemCode: 'PK-BOX-02',
            description: 'Crate Pack',
            itemCategory: 'PK',
            inventoryUom: 'NOS',
            requestedQuantity: 1000,
            approximateUnitPrice: 8000,
            currency: 'INR',
            estimatedTotalValue: 8000000,
            specifications: 'Std',
            purchasePurpose: 'Ops',
            deliverySchedules: [],
            assignedBuyer: 'Buyer',
            buyerStatus: 'PENDING_CONFIGURATION',
            status: 'ACTIVE',
          },
        ],
        changeHistory: [],
        attachments: [],
      },
      DEPT_HEAD
    );
    assert.equal(offPr.budgetValidationStatus, 'NOT_VALIDATED');
    assert.equal(offPr.budgetValidationSnapshot, undefined);
    assert.equal(offPr.budgetGovernance, undefined);

    const submitOff = PurchaseRequisitionService.submitPR(offPr.id, DEPT_HEAD);
    assert.equal(submitOff.success, true, 'Submission must NOT block on budget when Budget Validation is OFF');

    // Approve PR across configured 2 levels while Budget Validation is OFF, then Short Close
    const l1Off = PurchaseRequisitionService.approvePR(
      offPr.id,
      ADMIN_MAKER.fullName,
      ADMIN_MAKER.role,
      'Level 1 approved with budget OFF',
      { actorUser: ADMIN_MAKER }
    );
    assert.equal(l1Off?.status, 'PENDING_SUBSEQUENT_APPROVAL');
    const l2Off = PurchaseRequisitionService.approvePR(
      offPr.id,
      'Vikramaditya Rao',
      'ORG_ADMIN',
      'Level 2 approved with budget OFF'
    );
    assert.equal(l2Off?.status, 'APPROVED_PENDING_BUYER');

    // Short closing PR created when Budget Validation is OFF performs zero budget release
    const shortCloseOff = PurchaseRequisitionService.shortClosePR({
      prId: offPr.id,
      lineIds: ['ln-bgt-off-1'],
      reason: 'Requirement fulfilled elsewhere',
      remarks: 'Verified no budget release needed',
      user: ADMIN_MAKER,
    });
    assert.equal(shortCloseOff.success, true);
    assert.equal(shortCloseOff.releasedBudgetAmount, 0);

    // Case B: Budget Validation ON -> 80L PR MUST fail mandatory budget check on submit
    companyPol.activation.budgetValidationEnabled = true;
    companyPol.budget.enableBudgetValidation = true;
    companyPol.budget.mandatoryBudgetCheck = true;
    prGovernancePolicyService.savePolicies(policies);

    assert.equal(prGovernancePolicyService.isBudgetValidationEnabled('co-kosh-01', 'br-pond-01'), true);

    const onPr = PurchaseRequisitionService.createPR(
      {
        prType: 'MANUAL',
        companyId: 'co-kosh-01',
        companyCode: 'KOSH-HQ',
        branchId: 'br-pond-01',
        branchCode: '001',
        branchName: 'Pondicherry Main Plant',
        department: 'Production',
        costCentre: 'CC-PROD-101',
        requesterId: DEPT_HEAD.id,
        requesterName: DEPT_HEAD.fullName,
        creatorId: DEPT_HEAD.id,
        creatorName: DEPT_HEAD.fullName,
        modifiedBy: DEPT_HEAD.fullName,
        priority: 'NORMAL',
        status: 'DRAFT',
        purchasePurpose: 'Large Exceeding Order With Budget ON',
        businessJustification: 'Budget validation test',
        deliveryLocation: 'Bay 1',
        estimatedTotalValue: 8000000,
        currency: 'INR',
        budgetValidationStatus: 'NOT_VALIDATED',
        erpStockStatus: 'FRESH',
        erpStockTimestamp: '2026-11-18T08:00:00Z',
        lines: [
          {
            id: 'ln-bgt-on-1',
            prId: '',
            itemCode: 'PK-BOX-03',
            description: 'Crate Pack',
            itemCategory: 'PK',
            inventoryUom: 'NOS',
            requestedQuantity: 1000,
            approximateUnitPrice: 8000,
            currency: 'INR',
            estimatedTotalValue: 8000000,
            specifications: 'Std',
            purchasePurpose: 'Ops',
            deliverySchedules: [],
            assignedBuyer: 'Buyer',
            buyerStatus: 'PENDING_CONFIGURATION',
            status: 'ACTIVE',
          },
        ],
        changeHistory: [],
        attachments: [],
      },
      DEPT_HEAD
    );

    const submitOn = PurchaseRequisitionService.submitPR(onPr.id, DEPT_HEAD);
    assert.equal(submitOn.success, false, 'Submission MUST block when Budget Validation is ON and ledger has shortfall');
    assert.match(submitOn.message, /Budget/i);
  } finally {
    resetGovernancePolicies();
  }
});

test('4. PR Type-Based Category Mapping Exclusivity & Dynamic PR Type Change Line Revalidation', () => {
  prTypeMasterService.resetForTests();
  resetGovernancePolicies();
  try {
    // Enable CAPEX_ASSET in governance policy & approve CAPEX_ASSET in PR Type Master
    const policies = prGovernancePolicyService.getPolicies();
    const companyPol = policies.find((p) => p.companyId === 'co-kosh-01' && p.branchId === 'ALL')!;
    companyPol.activation.capexAssetPrEnabled = true;
    prGovernancePolicyService.savePolicies(policies);

    const capexPrt = prTypeMasterService.getPrTypeByCode('CAPEX_ASSET')!;
    prTypeMasterService.submitPrTypeForApproval(capexPrt.id, ADMIN_MAKER);
    prTypeMasterService.approvePrType(capexPrt.id, DEPT_HEAD, true);

    const createAndApproveMapping = (itemCategoryCode: string, prTypeCode: 'CAPEX_ASSET' | 'MAINTENANCE' | 'MRP') => {
      const m = prTypeMasterService.createMapping(
        {
          companyId: 'co-kosh-01',
          branchId: 'br-pond-01',
          purchaseOrgId: 'ALL',
          itemCategoryCode,
          prTypeCode,
          isEligible: true,
          effectiveFrom: '2026-01-01',
        },
        ADMIN_MAKER
      );
      prTypeMasterService.submitMappingForApproval(m.id, ADMIN_MAKER);
      prTypeMasterService.approveMapping(m.id, DEPT_HEAD, true);
    };

    createAndApproveMapping('CP', 'CAPEX_ASSET');
    createAndApproveMapping('MA', 'MAINTENANCE');
    createAndApproveMapping('RM', 'MRP');

    // Verify category lists are dynamically segregated per PR Type in co-kosh-01 / br-pond-01
    const capexCats = prTypeMasterService
      .getEligibleCategoriesForContext({
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        prTypeCode: 'CAPEX_ASSET',
        userRole: ADMIN_MAKER.role,
      })
      .map((c) => c.code);
    assert.deepEqual(capexCats, ['CP'], 'CAPEX_ASSET must only expose Capital Equipment (CP) category');

    const maintCats = prTypeMasterService
      .getEligibleCategoriesForContext({
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        prTypeCode: 'MAINTENANCE',
        userRole: ADMIN_MAKER.role,
      })
      .map((c) => c.code);
    assert.deepEqual(maintCats, ['MA'], 'MAINTENANCE must only expose MA when explicitly mapped');

    const mrpCats = prTypeMasterService
      .getEligibleCategoriesForContext({
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        prTypeCode: 'MRP',
        userRole: ADMIN_MAKER.role,
      })
      .map((c) => c.code);
    assert.deepEqual(mrpCats, ['RM'], 'MRP must only expose RM when explicitly mapped');

    const manualCats = prTypeMasterService
      .getEligibleCategoriesForContext({
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        prTypeCode: 'MANUAL',
        userRole: ADMIN_MAKER.role,
      })
      .map((c) => c.code);
    assert.equal(manualCats.includes('CP'), false, 'CP mapped to CAPEX_ASSET must NOT leak into MANUAL');
    assert.equal(manualCats.includes('MA'), false, 'MA mapped to MAINTENANCE must NOT leak into MANUAL');
    assert.equal(manualCats.includes('RM'), false, 'RM mapped to MRP must NOT leak into MANUAL');

    // Dynamic PR Type change validation retains all lines while surfacing incompatible lines
    const lines = [
      { id: 'l1', itemCode: 'RMPAOPOEXLG0001', itemCategory: 'RM' },
      { id: 'l2', itemCode: 'CPMC001', itemCategory: 'CP' },
    ];
    const revalForCapex = prTypeMasterService.validateLinesCategoriesForPrType({
      companyId: 'co-kosh-01',
      branchId: 'br-pond-01',
      prTypeCode: 'CAPEX_ASSET',
      lines,
      userRole: ADMIN_MAKER.role,
    });
    assert.equal(revalForCapex.valid, false);
    assert.equal(revalForCapex.invalidLines.length, 1);
    assert.equal(revalForCapex.invalidLines[0].lineIndex, 0);
    assert.equal(revalForCapex.invalidLines[0].normalizedCategory, 'RM');

    // Attempting createPR with mismatched line category for CAPEX_ASSET must throw cleanly
    assert.throws(
      () =>
        PurchaseRequisitionService.createPR(
          {
            prType: 'CAPEX_ASSET',
            companyId: 'co-kosh-01',
            companyCode: 'KOSH-HQ',
            branchId: 'br-pond-01',
            branchCode: '001',
            branchName: 'Pondicherry Main Plant',
            department: 'Production',
            costCentre: 'CC-PROD-101',
            requesterId: ADMIN_MAKER.id,
            requesterName: ADMIN_MAKER.fullName,
            creatorId: ADMIN_MAKER.id,
            creatorName: ADMIN_MAKER.fullName,
            modifiedBy: ADMIN_MAKER.fullName,
            priority: 'NORMAL',
            status: 'DRAFT',
            purchasePurpose: 'Mismatched CAPEX PR',
            businessJustification: 'Negative test',
            deliveryLocation: 'Bay 1',
            estimatedTotalValue: 50000,
            currency: 'INR',
            budgetValidationStatus: 'NOT_VALIDATED',
            erpStockStatus: 'FRESH',
            erpStockTimestamp: '2026-11-18T08:00:00Z',
            lines: [
              {
                id: 'ln-bad-capex-1',
                prId: '',
                itemCode: 'RMPAOPOEXLG0001',
                description: 'Raw Material Plastic Resin',
                itemCategory: 'RM',
                inventoryUom: 'KG',
                requestedQuantity: 100,
                approximateUnitPrice: 500,
                currency: 'INR',
                estimatedTotalValue: 50000,
                specifications: 'Std',
                purchasePurpose: 'Test',
                deliverySchedules: [],
                assignedBuyer: 'Buyer',
                buyerStatus: 'PENDING_CONFIGURATION',
                status: 'ACTIVE',
              },
            ],
            changeHistory: [],
            attachments: [],
          },
          ADMIN_MAKER
        ),
      /not mapped|not eligible/i
    );
  } finally {
    prTypeMasterService.resetForTests();
    resetGovernancePolicies();
  }
});
