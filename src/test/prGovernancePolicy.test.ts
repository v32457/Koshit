import test from 'node:test';
import assert from 'node:assert/strict';
import { prGovernancePolicyService } from '../services/prGovernancePolicyService';
import { PurchaseRequisitionService } from '../services/purchaseRequisitionService';
import { prRfqConversionService } from '../services/prRfqConversionService';
import { User } from '../types';

const adminUser: User = {
  id: 'usr-admin-01',
  fullName: 'Rajesh Sharma (Platform Admin)',
  email: 'admin@kosh.in',
  role: 'PLATFORM_ADMIN',
  orgId: 'co-kosh-01',
  allowedBranchIds: ['br-pond-01', 'br-chen-02'],
  status: 'ACTIVE',
  isGlobalScope: true,
  twoFactorEnabled: true,
};

const branchAdminUser: User = {
  id: 'usr-br-admin-01',
  fullName: 'Suresh Kumar (Branch Admin)',
  email: 'branch@kosh.in',
  role: 'BRANCH_COORDINATOR',
  orgId: 'co-kosh-01',
  allowedBranchIds: ['br-pond-01'],
  status: 'ACTIVE',
  isGlobalScope: false,
  twoFactorEnabled: true,
};

const requesterUser: User = {
  id: 'usr-req-01',
  fullName: 'Arun Kumar (Requester)',
  email: 'arun@kosh.in',
  role: 'READ_ONLY_USER',
  orgId: 'co-kosh-01',
  allowedBranchIds: ['br-pond-01'],
  status: 'ACTIVE',
  isGlobalScope: false,
  twoFactorEnabled: false,
};

test('1. Multi-Company Independence: Company A and Company B maintain isolated policies', () => {
  const compA = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'ALL');
  const compB = prGovernancePolicyService.getEffectivePolicy('co-kosh-02', 'ALL');

  // Modify Company B to disable Manual PR Creation
  compB.activation.manualPrCreationEnabled = false;
  const { savedPolicy } = prGovernancePolicyService.savePolicyConfiguration(
    compB,
    adminUser,
    'Disable Manual PR in Company B'
  );

  assert.equal(savedPolicy.activation.manualPrCreationEnabled, false);
  assert.equal(savedPolicy.policyVersion, 'v1.1');

  // Verify Company A remains completely unaffected
  const compAAfter = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'ALL');
  assert.equal(compAAfter.activation.manualPrCreationEnabled, true);
  assert.equal(compAAfter.policyVersion, compA.policyVersion);
});

test('2. Branch Inheritance, Authorized Overrides, Centrally Controlled Locks & Reset to Default', () => {
  // Ensure Company A marks budgetValidationEnabled as centrally controlled
  const compA = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'ALL');
  compA.centrallyControlledFields = ['prAuditTrailEnabled', 'budgetValidationEnabled'];
  compA.activation.budgetValidationEnabled = true;
  compA.activation.prShortCloseEnabled = true;
  prGovernancePolicyService.savePolicyConfiguration(compA, adminUser, 'Lock budget validation');

  // Branch br-pond-01 inherits Company A by default
  const brInherited = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'br-pond-01');
  assert.equal(brInherited.isInheritedFromCompany, true);
  assert.equal(brInherited.resolutionSource, 'COMPANY_INHERITED');
  assert.equal(brInherited.activation.prShortCloseEnabled, true);

  // Configure a Branch Override on br-pond-01 disabling Short Close AND attempting to disable centrally locked budgetValidationEnabled
  const brOverrideInput = {
    ...brInherited,
    isInheritedFromCompany: false,
    activation: {
      ...brInherited.activation,
      prShortCloseEnabled: false,
      budgetValidationEnabled: false, // Should be blocked by Company central lock!
    },
  };
  prGovernancePolicyService.savePolicyConfiguration(
    brOverrideInput,
    branchAdminUser,
    'Branch override for Pondicherry'
  );

  const brEffective = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'br-pond-01');
  assert.equal(brEffective.resolutionSource, 'BRANCH_OVERRIDE');
  assert.equal(brEffective.isInheritedFromCompany, false);
  // Permitted override took effect:
  assert.equal(brEffective.activation.prShortCloseEnabled, false);
  // Centrally locked setting remained true from Company Policy:
  assert.equal(brEffective.activation.budgetValidationEnabled, true);

  // Branch br-chen-02 still inherits Company A (Short Close = Enabled)
  const brChennai = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'br-chen-02');
  assert.equal(brChennai.isInheritedFromCompany, true);
  assert.equal(brChennai.activation.prShortCloseEnabled, true);

  // Reset br-pond-01 to Company Default
  const resetPol = prGovernancePolicyService.resetBranchToCompanyDefault(
    'co-kosh-01',
    'br-pond-01',
    adminUser
  );
  assert.equal(resetPol.isInheritedFromCompany, true);
  assert.equal(resetPol.activation.prShortCloseEnabled, true);
});

test('3. Authorization & Dependency Validation Rules', () => {
  // Unauthorized requester cannot save policy
  const compA = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'ALL');
  assert.throws(() => {
    prGovernancePolicyService.savePolicyConfiguration(compA, requesterUser);
  }, /Unauthorized/);

  // Branch admin cannot modify Company-wide policy
  assert.throws(() => {
    prGovernancePolicyService.savePolicyConfiguration(compA, branchAdminUser);
  }, /Branch Administrators cannot modify Company-wide/);

  // Dependency validation: Disabling RFQ Conversion automatically disables Partial RFQ Conversion
  const compC = prGovernancePolicyService.getEffectivePolicy('co-kosh-03', 'ALL');
  compC.activation.rfqConversionEnabled = false;
  compC.partialConversion.enablePartialRfqConversion = true;
  const { savedPolicy, warnings } = prGovernancePolicyService.savePolicyConfiguration(
    compC,
    adminUser
  );
  assert.equal(savedPolicy.partialConversion.enablePartialRfqConversion, false);
  assert.ok(warnings.length > 0);
});

test('4. Service Enforcement: Disabled Manual PR creation & Return-for-Correction Resubmission Cycle', () => {
  // Company B ('co-kosh-02') has manualPrCreationEnabled = false from Test 1
  assert.throws(() => {
    PurchaseRequisitionService.createPR({
      prType: 'MANUAL',
      companyId: 'co-kosh-02',
      companyCode: 'KOSH-SOUTH',
      branchId: 'br-hosr-03',
      branchCode: 'HSR',
      branchName: 'Hosur Plant',
      department: 'Production',
      costCentre: 'CC-101',
      requesterId: requesterUser.id,
      requesterName: requesterUser.fullName,
      creatorId: requesterUser.id,
      creatorName: requesterUser.fullName,
      priority: 'NORMAL',
      status: 'DRAFT',
      purchasePurpose: 'Test disabled manual PR',
      businessJustification: 'Testing enforcement',
      deliveryLocation: 'Hosur',
      estimatedTotalValue: 10000,
      currency: 'INR',
      budgetValidationStatus: 'SUFFICIENT',
      erpStockStatus: 'FRESH',
      lines: [],
      changeHistory: [],
      attachments: [],
    });
  }, /Manual PR Creation is disabled/);

  // Create a valid PR in Company A ('co-kosh-01')
  const created = PurchaseRequisitionService.createPR({
    prType: 'MANUAL',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Main Plant',
    department: 'Engineering',
    costCentre: 'CC-ENG-01',
    requesterId: requesterUser.id,
    requesterName: requesterUser.fullName,
    creatorId: requesterUser.id,
    creatorName: requesterUser.fullName,
    priority: 'URGENT',
    status: 'DRAFT',
    purchasePurpose: 'Precision bearings for spindle assembly',
    businessJustification: 'Line 2 assembly requirement',
    deliveryLocation: 'Bay 1',
    estimatedTotalValue: 50000,
    currency: 'INR',
    expectedDeliveryDate: '2026-12-05',
    budgetValidationStatus: 'SUFFICIENT',
    erpStockStatus: 'FRESH',
    lines: [
      {
        id: 'line-gov-1',
        prId: '',
        itemCode: 'BRG-SKF-6205',
        description: 'SKF Deep Groove Ball Bearing 6205',
        itemCategory: 'Spares',
        inventoryUom: 'EA',
        requestedQuantity: 50,
        approximateUnitPrice: 1000,
        currency: 'INR',
        estimatedTotalValue: 50000,
        purchasePurpose: 'Spindle assembly',
        deliverySchedules: [],
        status: 'ACTIVE',
      },
    ],
    changeHistory: [],
    attachments: [],
  });

  const originalPrNumber = created.prNumber;
  assert.ok(created.policyVersion);

  // Submit PR -> status becomes PENDING_MANAGER_APPROVAL
  const subRes = PurchaseRequisitionService.submitPR(created.id, requesterUser);
  assert.equal(subRes.success, true);
  assert.equal(subRes.pr?.status, 'PENDING_MANAGER_APPROVAL');

  // Pending Approval PRs are locked against editing
  assert.throws(() => {
    PurchaseRequisitionService.updatePR(created.id, { purchasePurpose: 'Illegal edit while pending' }, requesterUser);
  }, /Pending Approval and locked/);

  // Return for Correction requires mandatory reason
  assert.throws(() => {
    PurchaseRequisitionService.returnForCorrection(created.id, '   ', adminUser.fullName);
  }, /mandatory return reason/);

  const returned = PurchaseRequisitionService.returnForCorrection(
    created.id,
    'Please update delivery schedule and purpose specification',
    adminUser.fullName
  );
  assert.equal(returned?.status, 'RETURNED_FOR_CORRECTION');

  // Returned PR IS editable by requester!
  const corrected = PurchaseRequisitionService.updatePR(
    created.id,
    { purchasePurpose: 'Updated precision bearings specification per L1 review' },
    requesterUser
  );
  assert.equal(
    corrected?.purchasePurpose,
    'Updated precision bearings specification per L1 review'
  );

  // Resubmit Returned PR -> retains the SAME PR Number and increments approvalCycleCount to 2!
  const resubRes = PurchaseRequisitionService.resubmitPR(
    created.id,
    requesterUser.fullName,
    'Corrected specification and resubmitted',
    requesterUser
  );
  assert.equal(resubRes.success, true);
  assert.equal(resubRes.pr?.prNumber, originalPrNumber);
  assert.equal(resubRes.pr?.status, 'PENDING_MANAGER_APPROVAL');
  assert.equal(resubRes.pr?.approvalCycleCount, 2);
  assert.ok((resubRes.pr?.approvalHistory?.length || 0) >= 3);
});

test('5. Line-Level Locking, Partial Conversion, Short Close & Budget Reconciliation Formula', () => {
  // Create & Approve a PR with 2 lines: Line 1 (50 EA @ 1000 = 50,000), Line 2 (100 EA @ 500 = 50,000), Total = 100,000
  const pr = PurchaseRequisitionService.createPR({
    prType: 'MANUAL',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Main Plant',
    department: 'Production',
    costCentre: 'CC-PROD-01',
    requesterId: requesterUser.id,
    requesterName: requesterUser.fullName,
    creatorId: requesterUser.id,
    creatorName: requesterUser.fullName,
    priority: 'NORMAL',
    status: 'PENDING_SUBSEQUENT_APPROVAL',
    purchasePurpose: 'Multi-line partial conversion and budget release test',
    businessJustification: 'Production batch Q4',
    deliveryLocation: 'Store 1',
    estimatedTotalValue: 100000,
    currency: 'INR',
    budgetValidationStatus: 'SUFFICIENT',
    erpStockStatus: 'FRESH',
    lines: [
      {
        id: 'line-sc-1',
        prId: '',
        itemCode: 'ITEM-PARTIAL-01',
        description: 'Partial Conversion Test Item',
        itemCategory: 'Raw Material',
        inventoryUom: 'KG',
        requestedQuantity: 50,
        approximateUnitPrice: 1000,
        currency: 'INR',
        estimatedTotalValue: 50000,
        deliverySchedules: [],
        status: 'ACTIVE',
      },
      {
        id: 'line-sc-2',
        prId: '',
        itemCode: 'ITEM-UNCONV-02',
        description: 'Unconverted Test Item',
        itemCategory: 'Raw Material',
        inventoryUom: 'KG',
        requestedQuantity: 100,
        approximateUnitPrice: 500,
        currency: 'INR',
        estimatedTotalValue: 50000,
        deliverySchedules: [],
        status: 'ACTIVE',
      },
    ],
    changeHistory: [],
    attachments: [],
  });

  const approved = PurchaseRequisitionService.approvePR(
    pr.id,
    adminUser.fullName,
    adminUser.role,
    'Final Approval granted'
  );
  assert.equal(approved?.status, 'APPROVED_PENDING_BUYER');

  // Approved PR header is immutable
  assert.throws(() => {
    PurchaseRequisitionService.updatePR(pr.id, { currency: 'USD' }, adminUser);
  }, /Approved PR Header .* is permanently immutable/);

  // Partially convert 20 KG of Line 1 (worth 20,000 INR) to RFQ
  const convRes = prRfqConversionService.recordConversion({
    prId: pr.id,
    prNumber: pr.prNumber,
    prLineId: 'line-sc-1',
    itemCode: 'ITEM-PARTIAL-01',
    rfqId: 'rfq-test-99',
    rfqNumber: 'RFQ-2026-0099',
    rfqLineId: 'rfq-line-99',
    convertQtyInvUom: 20,
    convertQtyPurchUom: 20,
    prInvUom: 'KG',
    rfqPurchUom: 'KG',
    conversionRatio: 1,
    userId: adminUser.id,
    userName: adminUser.fullName,
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
  });
  assert.equal(convRes.success, true);
  assert.equal(convRes.summary.convertedQtyInvUom, 20);
  assert.equal(convRes.summary.remainingQtyInvUom, 30);
  assert.equal(convRes.summary.conversionStatus, 'PARTIALLY_CONVERTED');

  // Attempt to cancel Line 1 (which has converted quantity = 20) -> Cannot cancel a line with converted quantity!
  const cancelConvertedLine = PurchaseRequisitionService.cancelPR({
    prId: pr.id,
    lineIds: ['line-sc-1'],
    reason: 'Try cancelling converted line',
    remarks: 'Should be rejected because 20 KG is already converted',
    user: adminUser,
  });
  assert.equal(cancelConvertedLine.success, false);

  // Cancel unconverted Line 2 (100 KG @ 500 = 50,000 INR) -> Succeeds and releases 50,000 INR!
  const cancelUnconvLine = PurchaseRequisitionService.cancelPR({
    prId: pr.id,
    lineIds: ['line-sc-2'],
    reason: 'Line 2 no longer required',
    remarks: 'Cancelled unconverted line 2',
    user: adminUser,
  });
  assert.equal(cancelUnconvLine.success, true);
  assert.equal(cancelUnconvLine.releasedBudgetAmount, 50000);

  // Now Short Close the remaining 30 KG on Line 1 (worth 30,000 INR) while preserving the 20 KG converted commitment (20,000 INR)!
  const shortCloseRes = PurchaseRequisitionService.shortClosePR({
    prId: pr.id,
    lineIds: ['line-sc-1'],
    reason: 'Balance 30 KG no longer required',
    remarks: 'Short closing remaining 30 KG on Line 1',
    user: adminUser,
  });
  assert.equal(shortCloseRes.success, true);
  assert.equal(shortCloseRes.releasedBudgetAmount, 30000);
  assert.equal(shortCloseRes.pr?.status, 'SHORT_CLOSED');

  // Verify Budget Governance totals:
  // Original Reservation = 100,000; Valid Commitments = 20,000; Total Released = 50,000 + 30,000 = 80,000; Remaining Eligible = 0
  const finalRecon = prGovernancePolicyService.calculateBudgetReconciliation(shortCloseRes.pr!);
  assert.equal(finalRecon.originalReservation, 100000);
  assert.equal(finalRecon.validOutstandingCommitments, 20000);
  assert.equal(finalRecon.previouslyReleasedAmount, 80000);
  assert.equal(finalRecon.eligibleReleaseAmount, 0);
});
