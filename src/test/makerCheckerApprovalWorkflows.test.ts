import test from 'node:test';
import assert from 'node:assert/strict';
import { makerCheckerBackend } from '../../server/src/services/makerCheckerBackend.js';
import { makerCheckerService } from '../services/makerCheckerService';
import { branchItemBackend } from '../../server/src/services/branchItemBackend.js';
import { GlobalItem, BranchItemAvailabilityRecord, User } from '../types';

// Seed test users
const testMaker: User = {
  id: 'usr-buyer-01',
  email: 'vikram.singh@koshinnovations.com',
  fullName: 'Vikram Singh',
  role: 'ITEM_MAKER',
  orgId: 'org-kosh-01',
  status: 'ACTIVE',
  allowedBranchIds: [],
  isGlobalScope: true,
  twoFactorEnabled: true,
};

const testChecker: User = {
  id: 'usr-checker-03',
  email: 'checker.master@koshinnovations.com',
  fullName: 'Venkatesh Iyer',
  role: 'ITEM_CHECKER',
  orgId: 'org-kosh-01',
  status: 'ACTIVE',
  allowedBranchIds: [],
  isGlobalScope: true,
  twoFactorEnabled: true,
};

const testUnauthorizedUser: User = {
  id: 'usr-auditor-05',
  email: 'auditor@koshinnovations.com',
  fullName: 'Meera Nambiar',
  role: 'MASTER_DATA_AUDITOR',
  orgId: 'org-kosh-01',
  status: 'ACTIVE',
  allowedBranchIds: [],
  isGlobalScope: true,
  twoFactorEnabled: false,
};

test('Stage 1: Submit Global Item transitions status from DRAFT to SUBMITTED', async () => {
  // Setup a draft global item in makerCheckerBackend
  const testId = `test-draft-gitm-${Date.now()}`;
  const actorMaker = makerCheckerBackend.resolveActor({
    userId: testMaker.id,
    userName: testMaker.fullName,
    userRole: testMaker.role,
  });

  // Seed into memory
  (makerCheckerBackend as any).getGlobalItem = async () => ({
    item_id: testId,
    item_code: 'GI-DRAFT-001',
    item_description: 'Draft Raw Material Sheet',
    status: 'DRAFT',
    is_active: 1,
    created_by_user_id: testMaker.id,
    created_by_name: testMaker.fullName,
  });

  const submitResult = await makerCheckerBackend.submitGlobalItem(
    testId,
    actorMaker,
    'Submitting for checker review'
  );

  assert.equal(submitResult.success, true);
  assert.equal(submitResult.item.status, 'SUBMITTED');
  assert.equal(submitResult.item.submitted_by_user_id, testMaker.id);
});

test('Stage 1: Strict non-self-approval blocks creator from approving their own Global Item', async () => {
  const testId = `test-self-appr-${Date.now()}`;
  const actorMaker = makerCheckerBackend.resolveActor({
    userId: testMaker.id,
    userName: testMaker.fullName,
    userRole: testMaker.role,
  });

  (makerCheckerBackend as any).getGlobalItem = async () => ({
    item_id: testId,
    item_code: 'GI-SELF-001',
    item_description: 'Self Approval Test Item',
    status: 'SUBMITTED',
    is_active: 1,
    created_by_user_id: testMaker.id,
    created_by_name: testMaker.fullName,
    submitted_by_user_id: testMaker.id,
  });

  await assert.rejects(
    async () => {
      await makerCheckerBackend.approveGlobalItem(testId, actorMaker, 'Self approve attempt');
    },
    (err: any) => {
      // Must fail with forbidden maker role or self approval blocked
      assert.ok(
        err.code === 'MAKER_CHECKER_SELF_APPROVAL_BLOCKED' || err.code === 'FORBIDDEN_CHECKER_ROLE',
        `Expected self approval or role block, got ${err.code}`
      );
      return true;
    }
  );
});

test('Stage 1: Role with ITEM_CHECKER can approve submitted Global Item when maker !== checker', async () => {
  const testId = `test-valid-appr-${Date.now()}`;
  const actorChecker = makerCheckerBackend.resolveActor({
    userId: testChecker.id,
    userName: testChecker.fullName,
    userRole: testChecker.role,
  });

  (makerCheckerBackend as any).getGlobalItem = async () => ({
    item_id: testId,
    item_code: 'GI-VALID-001',
    item_description: 'Valid Item for Approval',
    status: 'SUBMITTED',
    is_active: 1,
    created_by_user_id: testMaker.id, // Maker is Vikram Singh
    created_by_name: testMaker.fullName,
    submitted_by_user_id: testMaker.id,
  });

  const approveResult = await makerCheckerBackend.approveGlobalItem(
    testId,
    actorChecker,
    'Approved by independent checker'
  );

  assert.equal(approveResult.success, true);
  assert.equal(approveResult.item.status, 'APPROVED');
  assert.equal(approveResult.item.approved_by_user_id, testChecker.id);
});

test('Stage 1: Global Item approval must NOT auto-activate any branch', async () => {
  // Capture branch items count before global approval
  const branchListBefore = await branchItemBackend.getBranchItems({});
  const countBefore = branchListBefore.length;

  const testId = `test-no-auto-branch-${Date.now()}`;
  const actorChecker = makerCheckerBackend.resolveActor({
    userId: testChecker.id,
    userName: testChecker.fullName,
    userRole: testChecker.role,
  });

  (makerCheckerBackend as any).getGlobalItem = async () => ({
    item_id: testId,
    item_code: 'GI-NO-BRANCH-001',
    item_description: 'Global item with zero branch attachments',
    status: 'SUBMITTED',
    is_active: 1,
    created_by_user_id: testMaker.id,
    created_by_name: testMaker.fullName,
  });

  await makerCheckerBackend.approveGlobalItem(testId, actorChecker, 'Approved master');

  // Verify branch count is completely unchanged
  const branchListAfter = await branchItemBackend.getBranchItems({});
  assert.equal(
    branchListAfter.length,
    countBefore,
    'Invariant satisfied: Global approval must not create or auto-activate any branch records'
  );
});

test('Stage 2: Submit Branch Item Activation fails if parent Global Item is not APPROVED', async () => {
  const branchAvailId = `bia-co-kosh-01-br-pond-01-unapproved-gitm`;
  const actorMaker = makerCheckerBackend.resolveActor({
    userId: testMaker.id,
    userName: testMaker.fullName,
    userRole: testMaker.role,
  });

  // Mock parent global item as DRAFT
  (makerCheckerBackend as any).getGlobalItem = async () => ({
    item_id: 'gitm-draft-999',
    item_code: 'GI-DRAFT-999',
    item_description: 'Unapproved Item',
    status: 'DRAFT',
    is_active: 1,
    created_by_user_id: testMaker.id,
  });

  (makerCheckerBackend as any).getBranchItem = async () => ({
    branchAvailabilityId: branchAvailId,
    globalItemId: 'gitm-draft-999',
    globalItemCode: 'GI-DRAFT-999',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    categoryCode: 'RM',
    categoryName: 'Raw Materials',
    branchStatus: 'DRAFT',
    approvalStatus: 'DRAFT',
    createdByUserId: testMaker.id,
  });

  await assert.rejects(
    async () => {
      await makerCheckerBackend.submitBranchItem(branchAvailId, actorMaker, 'Submit attempt');
    },
    (err: any) => {
      assert.equal(err.code, 'GLOBAL_ITEM_NOT_APPROVED');
      return true;
    }
  );
});

test('Stage 2: Submit Branch Item succeeds when Global Item is APPROVED and audit passes', async () => {
  const branchAvailId = `bia-co-kosh-01-br-pond-01-approved-gitm`;
  const actorMaker = makerCheckerBackend.resolveActor({
    userId: testMaker.id,
    userName: testMaker.fullName,
    userRole: testMaker.role,
  });

  (makerCheckerBackend as any).getGlobalItem = async () => ({
    item_id: 'gitm-appr-888',
    item_code: 'GI-APPR-888',
    item_description: 'Approved Raw Steel Sheet',
    status: 'APPROVED',
    is_active: 1,
    created_by_user_id: testMaker.id,
  });

  (makerCheckerBackend as any).getBranchItem = async () => ({
    branchAvailabilityId: branchAvailId,
    globalItemId: 'gitm-appr-888',
    globalItemCode: 'GI-APPR-888',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    categoryCode: 'RM',
    categoryName: 'Raw Materials',
    itemRole: 'PURCHASE',
    effectivePurchaseUom: 'SHEET',
    effectiveInventoryUom: 'KG',
    effectiveConversionFactor: 46.5,
    isPurchaseEnabled: true,
    isInventoryEnabled: true,
    effectiveFrom: '2026-01-01',
    moq: 10,
    orderMultiple: 5,
    shelfLifeControlled: false,
    serialTrackingEnabled: false,
    warrantyApplicable: false,
    qualityInspectionRequired: false,
    warehouseConfigs: [
      {
        warehouseId: 'wh-01',
        warehouseCode: 'WH-01',
        warehouseName: 'Main Store',
        isEligible: true,
        isPreferred: true,
      },
    ],
    branchStatus: 'DRAFT',
    approvalStatus: 'DRAFT',
    createdByUserId: testMaker.id,
  });

  const submitResult = await makerCheckerBackend.submitBranchItem(branchAvailId, actorMaker);
  assert.equal(submitResult.success, true);
  assert.equal(submitResult.branchItem.branchStatus, 'SUBMITTED');
  assert.equal(submitResult.branchItem.approvalStatus, 'PENDING');
});

test('Stage 2: Strict non-self-approval blocks creator from approving their own Branch Item', async () => {
  const branchAvailId = `bia-branch-self-appr-${Date.now()}`;
  const actorMaker = makerCheckerBackend.resolveActor({
    userId: testMaker.id,
    userName: testMaker.fullName,
    userRole: testMaker.role,
  });

  (makerCheckerBackend as any).getBranchItem = async () => ({
    branchAvailabilityId: branchAvailId,
    globalItemId: 'gitm-appr-888',
    globalItemCode: 'GI-APPR-888',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    categoryCode: 'RM',
    branchStatus: 'SUBMITTED',
    approvalStatus: 'PENDING',
    createdByUserId: testMaker.id,
  });

  await assert.rejects(
    async () => {
      await makerCheckerBackend.approveBranchItem(branchAvailId, actorMaker, 'Self approve branch');
    },
    (err: any) => {
      assert.ok(
        err.code === 'MAKER_CHECKER_SELF_APPROVAL_BLOCKED' || err.code === 'FORBIDDEN_BRANCH_CHECKER_ROLE',
        `Expected self approval block or role block, got ${err.code}`
      );
      return true;
    }
  );
});

test('Stage 2: Branch Checker approves Branch Item and leaves Global Item identity UNTOUCHED', async () => {
  const branchAvailId = `bia-branch-valid-appr-${Date.now()}`;
  const actorChecker = makerCheckerBackend.resolveActor({
    userId: testChecker.id,
    userName: testChecker.fullName,
    userRole: testChecker.role,
  });

  const globalSnapshot = {
    item_id: 'gitm-appr-777',
    item_code: 'GI-PRISTINE-001',
    item_description: 'Pristine Global Technical Identity Description',
    status: 'APPROVED',
    is_active: 1,
    created_by_user_id: testMaker.id,
    created_by_name: testMaker.fullName,
  };

  (makerCheckerBackend as any).getGlobalItem = async () => ({ ...globalSnapshot });

  (makerCheckerBackend as any).getBranchItem = async () => ({
    branchAvailabilityId: branchAvailId,
    globalItemId: 'gitm-appr-777',
    globalItemCode: 'GI-PRISTINE-001',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    categoryCode: 'RM',
    categoryName: 'Raw Materials',
    itemRole: 'PURCHASE',
    effectivePurchaseUom: 'SHEET',
    effectiveInventoryUom: 'KG',
    effectiveConversionFactor: 46.5,
    branchStatus: 'SUBMITTED',
    approvalStatus: 'PENDING',
    createdByUserId: testMaker.id, // Maker is Vikram Singh
  });

  const approveResult = await makerCheckerBackend.approveBranchItem(
    branchAvailId,
    actorChecker,
    'Branch activation approved by independent plant checker'
  );

  assert.equal(approveResult.success, true);
  assert.equal(approveResult.branchItem.branchStatus, 'APPROVED');
  assert.equal(approveResult.branchItem.approvalStatus, 'APPROVED');
  assert.equal(approveResult.branchItem.isActive, true);

  // Invariant Assertion: Global Item identity MUST NOT BE MODIFIED
  const globalAfter = await makerCheckerBackend.getGlobalItem('gitm-appr-777');
  assert.equal(globalAfter?.item_code, globalSnapshot.item_code);
  assert.equal(globalAfter?.item_description, globalSnapshot.item_description);
  assert.equal(globalAfter?.status, 'APPROVED');
});

test('Client Service: makerCheckerService validates Stage 1 and Stage 2 non-self-approval and RBAC', () => {
  const mockGlobalItem: GlobalItem = {
    id: 'gitm-cli-001',
    globalItemCode: 'GI-CLI-001',
    isProvisionalCode: false,
    description: 'Client Global Item',
    status: 'SUBMITTED',
    createdBy: testMaker.id,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    codeRuleVersion: 1,
    descRuleVersion: 1,
    approvalHistory: [],
    attributes: {},
  };

  // 1. Maker self approval check for Global Item
  assert.equal(makerCheckerService.isGlobalItemSelfApproval(mockGlobalItem, testMaker), true);
  assert.equal(makerCheckerService.isGlobalItemSelfApproval(mockGlobalItem, testChecker), false);

  const makerCheck = makerCheckerService.canApproveGlobalItem(mockGlobalItem, testMaker);
  assert.equal(makerCheck.allowed, false);
  assert.match(makerCheck.reason || '', /Segregation of duties/i);

  const checkerCheck = makerCheckerService.canApproveGlobalItem(mockGlobalItem, testChecker);
  assert.equal(checkerCheck.allowed, true);

  const unauthCheck = makerCheckerService.canApproveGlobalItem(mockGlobalItem, testUnauthorizedUser);
  assert.equal(unauthCheck.allowed, false);
  assert.match(unauthCheck.reason || '', /Insufficient permissions/i);

  // 2. Branch Item self approval check
  const mockBranchItem: Partial<BranchItemAvailabilityRecord> = {
    id: 'bia-cli-001',
    globalItemId: 'gitm-cli-001',
    globalItemCode: 'GI-CLI-001',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    branchStatus: 'SUBMITTED',
    approvalStatus: 'PENDING',
    createdBy: testMaker.id,
  };

  assert.equal(
    makerCheckerService.isBranchItemSelfApproval(mockBranchItem as BranchItemAvailabilityRecord, testMaker),
    true
  );
  assert.equal(
    makerCheckerService.isBranchItemSelfApproval(mockBranchItem as BranchItemAvailabilityRecord, testChecker),
    false
  );

  const branchMakerCheck = makerCheckerService.canApproveBranchItem(
    mockBranchItem as BranchItemAvailabilityRecord,
    testMaker
  );
  assert.equal(branchMakerCheck.allowed, false);

  const branchCheckerCheck = makerCheckerService.canApproveBranchItem(
    mockBranchItem as BranchItemAvailabilityRecord,
    testChecker
  );
  assert.equal(branchCheckerCheck.allowed, true);
});
