import test from 'node:test';
import assert from 'node:assert/strict';
import { prGovernancePolicyService } from '../services/prGovernancePolicyService';
import { PurchaseRequisitionService } from '../services/purchaseRequisitionService';
import { prRfqConversionService } from '../services/prRfqConversionService';
import { User } from '../types';

const makerAdmin: User = {
  id: 'usr-maker-01',
  fullName: 'Rajesh Sharma (Policy Maker)',
  email: 'maker@kosh.in',
  role: 'PLATFORM_ADMIN',
  orgId: 'co-kosh-01',
  allowedBranchIds: ['br-pond-01', 'br-chen-02'],
  status: 'ACTIVE',
  isGlobalScope: true,
  twoFactorEnabled: true,
};

const checkerAdmin: User = {
  id: 'usr-checker-01',
  fullName: 'Vikramaditya Rao (Policy Checker)',
  email: 'checker@kosh.in',
  role: 'ORG_ADMIN',
  orgId: 'co-kosh-01',
  allowedBranchIds: ['br-pond-01', 'br-chen-02'],
  status: 'ACTIVE',
  isGlobalScope: true,
  twoFactorEnabled: true,
};

const companyAUserBranch1Only: User = {
  id: 'usr-compA-br1',
  fullName: 'Arun Kumar (Company A - Branch 1 Only)',
  email: 'arun@kosh.in',
  role: 'BRANCH_COORDINATOR',
  orgId: 'co-kosh-01',
  allowedBranchIds: ['br-pond-01'],
  status: 'ACTIVE',
  isGlobalScope: false,
  twoFactorEnabled: true,
};

const companyBUser: User = {
  id: 'usr-compB-01',
  fullName: 'Karthik Rajan (Company B User)',
  email: 'karthik@kosh-south.in',
  role: 'BRANCH_COORDINATOR',
  orgId: 'co-kosh-02',
  allowedBranchIds: ['br-hosr-03'],
  status: 'ACTIVE',
  isGlobalScope: false,
  twoFactorEnabled: true,
};

test('Q1 & Q2: Company-level policy isolation & Branch inheritance/overrides', () => {
  const compA = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'ALL');
  const compB = prGovernancePolicyService.getEffectivePolicy('co-kosh-02', 'ALL');

  compB.activation.repairPrEnabled = false;
  prGovernancePolicyService.savePolicyConfiguration(
    compB,
    makerAdmin,
    'Disable Repair PR in Company B',
    checkerAdmin
  );

  const compAAfter = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'ALL');
  const compBAfter = prGovernancePolicyService.getEffectivePolicy('co-kosh-02', 'ALL');

  assert.equal(compAAfter.activation.repairPrEnabled, true);
  assert.equal(compBAfter.activation.repairPrEnabled, false);

  // Branch override on Company A Branch 1
  const br1Policy = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'br-pond-01');
  br1Policy.isInheritedFromCompany = false;
  br1Policy.activation.maintenancePrEnabled = false;
  prGovernancePolicyService.savePolicyConfiguration(
    br1Policy,
    companyAUserBranch1Only,
    'Disable Maintenance PR for Branch 1',
    checkerAdmin
  );

  const effBr1 = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'br-pond-01');
  const effBr2 = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'br-chen-02');
  assert.equal(effBr1.resolutionSource, 'BRANCH_OVERRIDE');
  assert.equal(effBr1.activation.maintenancePrEnabled, false);
  assert.equal(effBr2.resolutionSource, 'COMPANY_INHERITED');
  assert.equal(effBr2.activation.maintenancePrEnabled, true);

  // Restore defaults
  prGovernancePolicyService.resetBranchToCompanyDefault('co-kosh-01', 'br-pond-01', makerAdmin);
  compB.activation.repairPrEnabled = true;
  prGovernancePolicyService.savePolicyConfiguration(compB, makerAdmin, 'Restore Repair PR', checkerAdmin);
});

test('Q3 & Q4: Policy Maker-Checker approval, self-approval block, version history & controlled rollback', () => {
  const activeBefore = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'ALL');
  const draftProposal = JSON.parse(JSON.stringify(activeBefore));
  draftProposal.activation.mrpPrCreationEnabled = false;

  // 1. Maker submits change for approval -> Active policy must NOT be silently overwritten
  const { pendingRecord } = prGovernancePolicyService.submitPolicyChangeForApproval(
    draftProposal,
    makerAdmin,
    'Propose disabling MRP PR creation'
  );
  assert.equal(pendingRecord.status, 'PENDING_APPROVAL');

  const stillActive = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'ALL');
  assert.equal(stillActive.activation.mrpPrCreationEnabled, true, 'Active policy must not be overwritten before approval');

  // 2. Maker attempts to approve their own policy change -> MUST FAIL
  assert.throws(
    () => {
      prGovernancePolicyService.approveAndActivatePolicyChange(
        pendingRecord.id,
        makerAdmin,
        'Self approval attempt'
      );
    },
    /Maker-Checker Violation/
  );

  // 3. Separate Checker approves & activates -> Active policy updates and old version becomes SUPERSEDED
  const { activatedPolicy, approvedRecord } =
    prGovernancePolicyService.approveAndActivatePolicyChange(
      pendingRecord.id,
      checkerAdmin,
      'Approved by Governance Checker'
    );
  assert.equal(approvedRecord.status, 'ACTIVE');
  assert.equal(activatedPolicy.activation.mrpPrCreationEnabled, false);
  assert.equal(activatedPolicy.approvedByUserId, checkerAdmin.id);

  const history = prGovernancePolicyService.getPolicyHistory('co-kosh-01', 'ALL');
  assert.ok(history.some((h) => h.status === 'SUPERSEDED'), 'Previous active version marked SUPERSEDED');

  // 4. Controlled Rollback to previous version via Maker-Checker
  const supersededVer = history.find((h) => h.status === 'SUPERSEDED' && h.snapshot.activation.mrpPrCreationEnabled === true);
  assert.ok(supersededVer);
  const rollbackPending = prGovernancePolicyService.requestPolicyRollback({
    targetVersionRecordId: supersededVer!.id,
    maker: makerAdmin,
    reason: 'Rollback MRP PR setting to baseline',
  });
  assert.equal(rollbackPending.status, 'PENDING_APPROVAL');
  assert.equal(rollbackPending.rollbackTargetVersion, supersededVer!.policyVersion);

  const { activatedPolicy: rolledBackPolicy } =
    prGovernancePolicyService.approveAndActivatePolicyChange(
      rollbackPending.id,
      checkerAdmin,
      'Approve rollback'
    );
  assert.equal(rolledBackPolicy.activation.mrpPrCreationEnabled, true);
});

test('Q5 & Q6: Policy Effective-Date handling (effectiveFrom / effectiveUntil) & Immutable Transaction Policy Snapshot', () => {
  const pr = PurchaseRequisitionService.createPR({
    prType: 'MANUAL',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry HQ',
    department: 'Production',
    costCentre: 'CC-100',
    requesterId: 'emp-1',
    requesterName: 'Arun Kumar',
    creatorId: 'emp-1',
    creatorName: 'Arun Kumar',
    priority: 'NORMAL',
    status: 'DRAFT',
    purchasePurpose: 'Snapshot & Effective Date Verification',
    businessJustification: 'Testing historical snapshot',
    deliveryLocation: 'Plant 1',
    estimatedTotalValue: 40000,
    currency: 'INR',
    budgetValidationStatus: 'SUFFICIENT',
    erpStockStatus: 'FRESH',
    lines: [],
    changeHistory: [],
    attachments: [],
  });

  // Verify immutable policySnapshot is preserved on PR transaction
  assert.ok(pr.policySnapshot, 'PR must store immutable policySnapshot at creation');
  assert.equal(pr.policySnapshot?.companyId, 'co-kosh-01');
  assert.ok(pr.policyVersion);

  // Test effectiveFrom / effectiveUntil evaluation
  const testPolicy = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'ALL');
  testPolicy.effectiveFrom = '2026-01-01';
  testPolicy.effectiveUntil = '2026-06-30';
  assert.equal(prGovernancePolicyService.isPolicyEffectiveOnDate(testPolicy, '2026-05-15'), true);
  assert.equal(prGovernancePolicyService.isPolicyEffectiveOnDate(testPolicy, '2026-08-01'), false);
});

test('Q7 & Q8: Cross-Company access rejection, Cross-Company conversion block & Cross-Branch access enforcement', () => {
  // 1. Company B user attempting to create or access a PR in Company A -> REJECTED
  assert.throws(
    () => {
      PurchaseRequisitionService.createPR(
        {
          prType: 'MANUAL',
          companyId: 'co-kosh-01',
          companyCode: 'KOSH-HQ',
          branchId: 'br-pond-01',
          branchCode: '001',
          branchName: 'Puducherry HQ',
          department: 'Production',
          costCentre: 'CC-100',
          requesterId: companyBUser.id,
          requesterName: companyBUser.fullName,
          creatorId: companyBUser.id,
          creatorName: companyBUser.fullName,
          priority: 'NORMAL',
          status: 'DRAFT',
          purchasePurpose: 'Cross-company attempt',
          businessJustification: 'Test',
          deliveryLocation: 'HQ',
          estimatedTotalValue: 10000,
          currency: 'INR',
          budgetValidationStatus: 'SUFFICIENT',
          erpStockStatus: 'FRESH',
          lines: [],
          changeHistory: [],
          attachments: [],
        },
        companyBUser
      );
    },
    /Cross-Company Access Denied/
  );

  // 2a. Attempting to assign a Company B branch ('br-chen-02') to a Company A PR -> Cross-Company Ownership Violation
  assert.throws(
    () => {
      PurchaseRequisitionService.createPR(
        {
          prType: 'MANUAL',
          companyId: 'co-kosh-01',
          companyCode: 'KOSH-HQ',
          branchId: 'br-chen-02',
          branchCode: '002',
          branchName: 'Chennai Branch',
          department: 'Production',
          costCentre: 'CC-100',
          requesterId: makerAdmin.id,
          requesterName: makerAdmin.fullName,
          creatorId: makerAdmin.id,
          creatorName: makerAdmin.fullName,
          priority: 'NORMAL',
          status: 'DRAFT',
          purchasePurpose: 'Cross-company branch mismatch',
          businessJustification: 'Test',
          deliveryLocation: 'Chennai',
          estimatedTotalValue: 10000,
          currency: 'INR',
          budgetValidationStatus: 'SUFFICIENT',
          erpStockStatus: 'FRESH',
          lines: [],
          changeHistory: [],
          attachments: [],
        },
        makerAdmin
      );
    },
    /Cross-Company Ownership Violation/
  );

  // 2b. Company A user authorized ONLY for Branch 1 ('br-pond-01') attempting to create PR in Company A Branch 4 ('br-pune-04') -> Cross-Branch Access Denied
  assert.throws(
    () => {
      PurchaseRequisitionService.createPR(
        {
          prType: 'MANUAL',
          companyId: 'co-kosh-01',
          companyCode: 'KOSH-HQ',
          branchId: 'br-pune-04',
          branchCode: '004',
          branchName: 'Pune Branch',
          department: 'Production',
          costCentre: 'CC-100',
          requesterId: companyAUserBranch1Only.id,
          requesterName: companyAUserBranch1Only.fullName,
          creatorId: companyAUserBranch1Only.id,
          creatorName: companyAUserBranch1Only.fullName,
          priority: 'NORMAL',
          status: 'DRAFT',
          purchasePurpose: 'Cross-branch attempt',
          businessJustification: 'Test',
          deliveryLocation: 'Pune',
          estimatedTotalValue: 10000,
          currency: 'INR',
          budgetValidationStatus: 'SUFFICIENT',
          erpStockStatus: 'FRESH',
          lines: [],
          changeHistory: [],
          attachments: [],
        },
        companyAUserBranch1Only
      );
    },
    /Cross-Branch Access Denied/
  );

  // 3. Cross-Company RFQ Conversion Prevention
  const crossConv = prRfqConversionService.recordConversion({
    prId: 'pr-001',
    prNumber: 'PR-2026-0001',
    prLineId: 'pr-line-001',
    itemCode: 'RM-ALLOY-316L',
    rfqId: 'rfq-cross-co',
    rfqNumber: 'RFQ-CO2-001',
    rfqLineId: 'rfq-line-cross',
    convertQtyInvUom: 10,
    convertQtyPurchUom: 10,
    prInvUom: 'KG',
    rfqPurchUom: 'KG',
    conversionRatio: 1,
    userId: makerAdmin.id,
    userName: makerAdmin.fullName,
    companyId: 'co-kosh-02', // Different company from PR-2026-0001 ('co-kosh-01')
  });
  assert.equal(crossConv.success, false);
  assert.match(crossConv.errorMessage || '', /Cross-Company Conversion Violation/);
});

test('Q9: Controlled Approved PR Line Amendment workflow (Unconverted line amended, Converted line blocked, Original values preserved)', () => {
  const pr = PurchaseRequisitionService.createPR({
    prType: 'MANUAL',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry HQ',
    department: 'Engineering',
    costCentre: 'CC-ENG-01',
    requesterId: 'emp-1',
    requesterName: 'Arun Kumar',
    creatorId: 'emp-1',
    creatorName: 'Arun Kumar',
    priority: 'NORMAL',
    status: 'PENDING_SUBSEQUENT_APPROVAL',
    purchasePurpose: 'Approved PR Amendment Test',
    businessJustification: 'Testing controlled line amendment',
    deliveryLocation: 'Plant 1',
    estimatedTotalValue: 100000,
    currency: 'INR',
    budgetValidationStatus: 'SUFFICIENT',
    erpStockStatus: 'FRESH',
    lines: [
      {
        id: 'line-amd-unconv',
        prId: 'temp',
        itemCode: 'ITEM-UNCONV-01',
        description: 'Unconverted Precision Valve',
        itemCategory: 'SPARES',
        inventoryUom: 'EA',
        requestedQuantity: 10,
        approximateUnitPrice: 5000,
        currency: 'INR',
        estimatedTotalValue: 50000,
        deliverySchedules: [],
        status: 'ACTIVE',
      },
      {
        id: 'line-amd-conv',
        prId: 'temp',
        itemCode: 'ITEM-CONV-02',
        description: 'Converted Hydraulic Pump',
        itemCategory: 'SPARES',
        inventoryUom: 'EA',
        requestedQuantity: 5,
        approximateUnitPrice: 10000,
        currency: 'INR',
        estimatedTotalValue: 50000,
        convertedRfqQuantity: 5,
        deliverySchedules: [],
        status: 'ACTIVE',
      },
    ],
    changeHistory: [],
    attachments: [],
  });

  // Approve PR so it is in APPROVED_PENDING_BUYER
  PurchaseRequisitionService.approvePR(pr.id, checkerAdmin.fullName, checkerAdmin.role, 'Final approval');

  // 1. Attempting to amend the converted line MUST be blocked
  assert.throws(
    () => {
      PurchaseRequisitionService.submitApprovedLineAmendment({
        prId: pr.id,
        lineId: 'line-amd-conv',
        amendmentReason: 'Attempt to change converted line',
        proposedValues: { requestedQuantity: 8 },
        user: makerAdmin,
      });
    },
    /Amendment Blocked/
  );

  // 2. Amending the unconverted line records original & proposed values, routes to PENDING_REAPPROVAL
  const amdRes = PurchaseRequisitionService.submitApprovedLineAmendment({
    prId: pr.id,
    lineId: 'line-amd-unconv',
    amendmentReason: 'Increased quantity required for line 1',
    proposedValues: { requestedQuantity: 12, approximateUnitPrice: 5000 },
    user: makerAdmin,
  });
  assert.equal(amdRes.success, true);
  assert.equal(amdRes.requiresReapproval, true);
  assert.equal(amdRes.pr?.status, 'PENDING_REAPPROVAL');
  assert.equal(amdRes.amendment?.originalValues.requestedQuantity, 10);
  assert.equal(amdRes.amendment?.proposedValues.requestedQuantity, 12);

  // 3. Approving the line amendment applies proposed quantity while preserving originalApprovedQuantity = 10
  const approvedPr = PurchaseRequisitionService.approveLineAmendment({
    prId: pr.id,
    amendmentId: amdRes.amendment!.id,
    approver: checkerAdmin,
    remarks: 'Approved quantity increase',
  });
  assert.equal(approvedPr.status, 'APPROVED_PENDING_BUYER');
  const updatedLine = approvedPr.lines.find((l) => l.id === 'line-amd-unconv')!;
  assert.equal(updatedLine.requestedQuantity, 12);
  assert.equal(updatedLine.originalApprovedQuantity, 10, 'Original approved quantity must be preserved');
});

test('Q10, Q17 & Q18: Currency-aware budget reconciliation (historical FX rate preserved), Failed budget release recovery & Duplicate conversion/release prevention', () => {
  // Create a USD PR (1 USD = 84.50 INR reference rate)
  const usdPr = PurchaseRequisitionService.createPR({
    prType: 'MANUAL',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry HQ',
    department: 'R&D',
    costCentre: 'CC-RD-01',
    requesterId: 'emp-1',
    requesterName: 'Arun Kumar',
    creatorId: 'emp-1',
    creatorName: 'Arun Kumar',
    priority: 'NORMAL',
    status: 'PENDING_SUBSEQUENT_APPROVAL',
    purchasePurpose: 'Imported Sensor Module',
    businessJustification: 'USD Currency Budget Test',
    deliveryLocation: 'Plant 1',
    estimatedTotalValue: 1000, // 1,000 USD
    currency: 'USD',
    budgetValidationStatus: 'SUFFICIENT',
    erpStockStatus: 'FRESH',
    lines: [
      {
        id: 'line-usd-1',
        prId: 'temp',
        itemCode: 'SENS-USD-01',
        description: 'Laser Sensor',
        itemCategory: 'ELECTRONICS',
        inventoryUom: 'EA',
        requestedQuantity: 10,
        approximateUnitPrice: 100, // 100 USD each
        currency: 'USD',
        estimatedTotalValue: 1000,
        deliverySchedules: [],
        status: 'ACTIVE',
      },
    ],
    changeHistory: [],
    attachments: [],
  });

  PurchaseRequisitionService.approvePR(usdPr.id, checkerAdmin.fullName, checkerAdmin.role, 'Approved USD PR');

  // Convert 4 EA (400 USD) to RFQ with idempotency key 'idem-conv-usd-1'
  const conv1 = prRfqConversionService.recordConversion({
    prId: usdPr.id,
    prNumber: usdPr.prNumber,
    prLineId: 'line-usd-1',
    itemCode: 'SENS-USD-01',
    rfqId: 'rfq-usd-01',
    rfqNumber: 'RFQ-USD-0001',
    rfqLineId: 'rfq-line-usd-01',
    convertQtyInvUom: 4,
    convertQtyPurchUom: 4,
    prInvUom: 'EA',
    rfqPurchUom: 'EA',
    conversionRatio: 1,
    userId: makerAdmin.id,
    userName: makerAdmin.fullName,
    idempotencyKey: 'idem-conv-usd-1',
  });
  assert.equal(conv1.success, true);

  // Q18: Retry conversion with same idempotencyKey -> MUST prevent duplicate conversion
  const dupConv = prRfqConversionService.recordConversion({
    prId: usdPr.id,
    prNumber: usdPr.prNumber,
    prLineId: 'line-usd-1',
    itemCode: 'SENS-USD-01',
    rfqId: 'rfq-usd-01',
    rfqNumber: 'RFQ-USD-0001',
    rfqLineId: 'rfq-line-usd-01',
    convertQtyInvUom: 4,
    convertQtyPurchUom: 4,
    prInvUom: 'EA',
    rfqPurchUom: 'EA',
    conversionRatio: 1,
    userId: makerAdmin.id,
    userName: makerAdmin.fullName,
    idempotencyKey: 'idem-conv-usd-1',
  });
  assert.equal(dupConv.success, false);
  assert.match(dupConv.errorMessage || '', /Duplicate Conversion Prevented/);

  // Q17: Simulate a failed budget release during Short Close -> Enqueues in Reconciliation Queue & preserves state
  const failedRel = PurchaseRequisitionService.shortClosePR({
    prId: usdPr.id,
    reason: 'Remaining 6 units no longer needed',
    remarks: 'Testing failure recovery',
    user: makerAdmin,
    idempotencyKey: 'idem-rel-usd-fail',
    simulateBudgetReleaseFailure: true,
  });
  assert.equal(failedRel.success, false);
  assert.ok(failedRel.reconciliationQueueItemId);

  // Reconcile the queue item as authorized administrator
  const reconciledItem = prGovernancePolicyService.reconcileFailureQueueItem({
    queueItemId: failedRel.reconciliationQueueItemId!,
    actor: makerAdmin,
    reason: 'Verified ERP connection restored and reconciled',
    resolutionStatus: 'RECONCILED',
  });
  assert.equal(reconciledItem.status, 'RECONCILED');

  // Execute Short Close for remaining 6 EA (600 USD = 50,700 INR at historical 84.50 rate)
  const scSuccess = PurchaseRequisitionService.shortClosePR({
    prId: usdPr.id,
    reason: 'Close remaining 6 units',
    remarks: 'Release uncommitted USD budget',
    user: makerAdmin,
    idempotencyKey: 'idem-rel-usd-ok',
  });
  assert.equal(scSuccess.success, true);
  assert.equal(scSuccess.releasedBudgetAmount, 600); // 600 USD
  assert.equal(scSuccess.releasedBudgetReportingCurrency, 600 * 84.5); // 50,700 INR

  // Attempting duplicate Short Close with same idempotencyKey -> Blocked
  const dupRel = PurchaseRequisitionService.shortClosePR({
    prId: usdPr.id,
    reason: 'Duplicate release attempt',
    remarks: 'Should be blocked',
    user: makerAdmin,
    idempotencyKey: 'idem-rel-usd-ok',
  });
  assert.equal(dupRel.success, false);
  assert.match(dupRel.message, /Duplicate Short Close \/ Budget Release Prevented/);
});

test('Q11, Q12 & Q13: Duplicate PR warning & mandatory justification, Attachment version history/deletion lock, and Approval Delegation validation', () => {
  // Q11: Create an open PR for item 'DUP-TEST-ITEM-99', then attempt a second PR for same item without justification
  const firstPr = PurchaseRequisitionService.createPR({
    prType: 'MANUAL',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry HQ',
    department: 'Production',
    costCentre: 'CC-100',
    requesterId: 'emp-dup-1',
    requesterName: 'Arun Kumar',
    creatorId: 'emp-dup-1',
    creatorName: 'Arun Kumar',
    priority: 'NORMAL',
    status: 'PENDING_SUBSEQUENT_APPROVAL',
    purchasePurpose: 'Batch 1 requirement',
    businessJustification: 'Initial batch',
    deliveryLocation: 'Plant 1',
    estimatedTotalValue: 20000,
    currency: 'INR',
    budgetValidationStatus: 'SUFFICIENT',
    erpStockStatus: 'FRESH',
    lines: [
      {
        id: 'line-dup-1',
        prId: 'temp',
        itemCode: 'DUP-TEST-ITEM-99',
        description: 'Bearing Assembly',
        itemCategory: 'SPARES',
        inventoryUom: 'EA',
        requestedQuantity: 50,
        approximateUnitPrice: 400,
        currency: 'INR',
        estimatedTotalValue: 20000,
        deliverySchedules: [],
        status: 'ACTIVE',
      },
    ],
    changeHistory: [],
    attachments: [],
  });

  // Attempting second PR for same item & similar qty (52 vs 50) WITHOUT duplicateOverrideJustification -> Blocked
  assert.throws(
    () => {
      PurchaseRequisitionService.createPR({
        prType: 'MANUAL',
        companyId: 'co-kosh-01',
        companyCode: 'KOSH-HQ',
        branchId: 'br-pond-01',
        branchCode: '001',
        branchName: 'Puducherry HQ',
        department: 'Production',
        costCentre: 'CC-100',
        requesterId: 'emp-dup-1',
        requesterName: 'Arun Kumar',
        creatorId: 'emp-dup-1',
        creatorName: 'Arun Kumar',
        priority: 'NORMAL',
        status: 'DRAFT',
        purchasePurpose: 'Repeat requirement without justification',
        businessJustification: 'Test',
        deliveryLocation: 'Plant 1',
        estimatedTotalValue: 20800,
        currency: 'INR',
        budgetValidationStatus: 'SUFFICIENT',
        erpStockStatus: 'FRESH',
        lines: [
          {
            id: 'line-dup-2',
            prId: 'temp',
            itemCode: 'DUP-TEST-ITEM-99',
            description: 'Bearing Assembly',
            itemCategory: 'SPARES',
            inventoryUom: 'EA',
            requestedQuantity: 52,
            approximateUnitPrice: 400,
            currency: 'INR',
            estimatedTotalValue: 20800,
            deliverySchedules: [],
            status: 'ACTIVE',
          },
        ],
        changeHistory: [],
        attachments: [],
      });
    },
    /Potential Duplicate PR Identified/
  );

  // Providing mandatory duplicateOverrideJustification allows authorized creation
  const justifiedPr = PurchaseRequisitionService.createPR({
    prType: 'MANUAL',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry HQ',
    department: 'Production',
    costCentre: 'CC-100',
    requesterId: 'emp-dup-1',
    requesterName: 'Arun Kumar',
    creatorId: 'emp-dup-1',
    creatorName: 'Arun Kumar',
    priority: 'NORMAL',
    status: 'DRAFT',
    purchasePurpose: 'Repeat requirement for Line B',
    businessJustification: 'Line B expansion',
    duplicateOverrideJustification: 'Legitimate repeat requirement for Assembly Line B expansion',
    deliveryLocation: 'Plant 1',
    estimatedTotalValue: 20800,
    currency: 'INR',
    budgetValidationStatus: 'SUFFICIENT',
    erpStockStatus: 'FRESH',
    lines: [
      {
        id: 'line-dup-3',
        prId: 'temp',
        itemCode: 'DUP-TEST-ITEM-99',
        description: 'Bearing Assembly',
        itemCategory: 'SPARES',
        inventoryUom: 'EA',
        requestedQuantity: 52,
        approximateUnitPrice: 400,
        currency: 'INR',
        estimatedTotalValue: 20800,
        deliverySchedules: [],
        status: 'ACTIVE',
      },
    ],
    changeHistory: [],
    attachments: [],
  });
  assert.ok(justifiedPr.id);

  // Q13: Approval Delegation validation (Validates delegatee 'usr-proc-mgr-01' for 'co-kosh-01' / 'br-pond-01' <= 500,000 INR)
  const approvedViaDelegation = PurchaseRequisitionService.approvePR(
    firstPr.id,
    'Ananya Nair (Procurement Manager)',
    'PROCUREMENT_MANAGER',
    'Approved under delegated authority',
    {
      isDelegatedApproval: true,
      delegateeUserId: 'usr-proc-mgr-01',
      evaluationDate: '2026-11-12',
    }
  );
  assert.equal(approvedViaDelegation?.status, 'APPROVED_PENDING_BUYER');
  assert.equal(
    approvedViaDelegation?.approvalHistory?.slice(-1)[0]?.decision,
    'DELEGATED_APPROVAL'
  );

  // Q12: Upload attachment v1 & v2 on Approved PR -> v1 retained as historical approved version, deletion blocked
  const attV1 = PurchaseRequisitionService.uploadPRAttachment({
    prId: firstPr.id,
    fileName: 'Drawing-Spec.pdf',
    fileSizeBytes: 1024 * 500,
    fileType: 'PDF',
    category: 'DRAWING',
    user: makerAdmin,
  });
  assert.equal(attV1.versionNumber, 1);

  const attV2 = PurchaseRequisitionService.uploadPRAttachment({
    prId: firstPr.id,
    fileName: 'Drawing-Spec.pdf',
    fileSizeBytes: 1024 * 600,
    fileType: 'PDF',
    category: 'DRAWING',
    user: makerAdmin,
  });
  assert.equal(attV2.versionNumber, 2);

  // Attempting to delete attachment on Approved PR -> Blocked
  assert.throws(
    () => {
      PurchaseRequisitionService.deletePRAttachment({
        prId: firstPr.id,
        attachmentId: attV1.id,
        user: makerAdmin,
      });
    },
    /Attachment Deletion Blocked/
  );
});

test('Q14, Q15, Q16, Q19 & Q20: Bulk Action partial-failure handling, Policy Simulation without side effects, PR Numbering uniqueness & Consolidated Reporting security', () => {
  // Q16: Policy Simulation without creating or modifying PR transactions
  const countBeforeSim = PurchaseRequisitionService.getPurchaseRequisitions().length;
  const simResult = prGovernancePolicyService.simulatePolicyOutcome({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    userRole: 'PROCUREMENT_MANAGER',
    prType: 'MANUAL',
    prStatus: 'APPROVED_PENDING_BUYER',
    conversionStatus: 'PARTIALLY_CONVERTED',
    estimatedAmount: 250000,
    currency: 'INR',
  });
  const countAfterSim = PurchaseRequisitionService.getPurchaseRequisitions().length;
  assert.equal(countBeforeSim, countAfterSim, 'Simulation must not create or modify PR transactions');
  assert.ok(simResult.availableActions.some((a) => a.action === 'SHORT_CLOSE_PR'));
  assert.ok(
    simResult.restrictedActions.some((a) => a.action === 'CANCEL_PR'),
    'Partially converted PR cannot be Cancelled in simulation'
  );

  // Q14: Bulk Action pre-validation & partial-failure handling (mixing eligible DRAFT PR and ineligible APPROVED PR for SUBMIT)
  const draftPr = PurchaseRequisitionService.createPR({
    prType: 'MANUAL',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry HQ',
    department: 'Quality',
    costCentre: 'CC-QA-01',
    requesterId: 'emp-qa',
    requesterName: 'Meera Krishnan',
    creatorId: 'emp-qa',
    creatorName: 'Meera Krishnan',
    priority: 'NORMAL',
    status: 'DRAFT',
    purchasePurpose: 'Bulk Submit Eligible PR',
    businessJustification: 'QA Lab',
    deliveryLocation: 'Plant 1',
    estimatedTotalValue: 15000,
    currency: 'INR',
    budgetValidationStatus: 'SUFFICIENT',
    erpStockStatus: 'FRESH',
    lines: [],
    changeHistory: [],
    attachments: [],
  });

  const bulkExec = PurchaseRequisitionService.executeBulkPrAction({
    prIds: [draftPr.id, 'pr-001'], // pr-001 is already APPROVED_PENDING_BUYER -> ineligible for SUBMIT
    action: 'SUBMIT',
    reason: 'Batch submission',
    remarks: 'Submitting eligible drafts',
    user: makerAdmin,
  });
  assert.equal(bulkExec.overallOutcome, 'PARTIAL_FAILURE', 'Must not report partial failure/skip as complete success');
  assert.equal(bulkExec.succeeded.length, 1);
  assert.equal(bulkExec.skipped.length, 1);

  // Q19: PR Numbering uniqueness across all PRs
  const allPrs = PurchaseRequisitionService.getPurchaseRequisitions();
  const prNumbers = allPrs.map((p) => p.prNumber);
  const uniquePrNumbers = new Set(prNumbers);
  assert.equal(prNumbers.length, uniquePrNumbers.size, 'All PR numbers must be strictly unique');

  // Q20: Consolidated Reporting respects user's company and branch permissions
  const reportForCompBUser = PurchaseRequisitionService.generateConsolidatedPrReport({
    user: companyBUser,
  });
  assert.ok(
    reportForCompBUser.records.every((r) => r.companyId === 'co-kosh-02'),
    'Company B user report must never leak Company A PR records'
  );
});
