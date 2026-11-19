/**
 * DUPLICATE PR GOVERNANCE — ACCEPTANCE TEST SUITE (Scenarios 1–12 + Security & Audit)
 * Validates unified header & line-level duplicate governance, state separation (DETECTED -> ACKNOWLEDGED -> OVERRIDE_AUTHORISED),
 * Checker approval / rejection, policy prohibitions, matching PR cancellation / status drift (STALE),
 * persistence across reloads, independent multi-line conditions, and immutable override audit trails.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { User } from '../types';
import { PurchaseRequisitionHeader } from '../types/purchaseRequisition';
import { PrDuplicatePreventionSettings, PrGovernancePolicyConfig } from '../types/prGovernancePolicy';
import { prGovernancePolicyService } from '../services/prGovernancePolicyService';
import { PurchaseRequisitionService } from '../services/purchaseRequisitionService';
import { prDuplicateGovernanceService } from '../services/prDuplicateGovernanceService';

const MAKER_ADMIN: User = {
  id: 'usr-maker-admin',
  fullName: 'Vikram Singh',
  email: 'vikram@kosh.local',
  role: 'PLATFORM_ADMIN',
  orgId: 'co-kosh-01',
  allowedBranchIds: ['br-pond-01'],
  isGlobalScope: true,
  twoFactorEnabled: false,
  department: 'Procurement',
};

const MAKER_REQUESTER: User = {
  id: 'usr-maker-req',
  fullName: 'Arun Kumar',
  email: 'arun@kosh.local',
  role: 'ITEM_MAKER',
  orgId: 'co-kosh-01',
  allowedBranchIds: ['br-pond-01'],
  isGlobalScope: false,
  twoFactorEnabled: false,
  department: 'Production',
};

const CHECKER_USER: User = {
  id: 'usr-checker-mgr',
  fullName: 'Venkatesh Iyer',
  email: 'venkatesh@kosh.local',
  role: 'ITEM_CHECKER',
  orgId: 'co-kosh-01',
  allowedBranchIds: ['br-pond-01'],
  isGlobalScope: false,
  twoFactorEnabled: false,
  department: 'Procurement',
};

function makeOpenPr(overrides: Partial<PurchaseRequisitionHeader> = {}): PurchaseRequisitionHeader {
  const id = overrides.id || `pr-open-${Math.random().toString(36).slice(2, 7)}`;
  const prNumber = overrides.prNumber || 'PR-2026-9001';
  const now = new Date().toISOString();
  return {
    id,
    prNumber,
    prType: 'MANUAL',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Main Plant & HQ',
    department: 'Production',
    costCentre: 'CC-PROD-101',
    requesterId: MAKER_REQUESTER.id,
    requesterName: MAKER_REQUESTER.fullName,
    creatorId: MAKER_REQUESTER.id,
    creatorName: MAKER_REQUESTER.fullName,
    priority: 'NORMAL',
    status: 'PENDING_MANAGER_APPROVAL',
    purchasePurpose: 'Assembly replenishment',
    businessJustification: 'Production plan Q4',
    deliveryLocation: 'WH-RM-01',
    estimatedTotalValue: 30000,
    currency: 'INR',
    budgetValidationStatus: 'SUFFICIENT',
    erpStockStatus: 'FRESH',
    lines: [
      {
        id: `line-${id}-1`,
        prId: id,
        itemCode: 'DUP-ITEM-A',
        description: 'Polymer Resin Grade A',
        itemCategory: 'RM',
        inventoryUom: 'KG',
        requestedQuantity: 100,
        approximateUnitPrice: 300,
        currency: 'INR',
        estimatedTotalValue: 30000,
        deliverySchedules: [],
        status: 'ACTIVE',
      },
    ],
    changeHistory: [],
    attachments: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function resetPolicyAndStores(policyPatch?: Partial<PrDuplicatePreventionSettings>) {
  prDuplicateGovernanceService.clearStoreForTests();
  const policies = prGovernancePolicyService.getPolicies();
  const base = prGovernancePolicyService.getEffectivePolicy('co-kosh-01', 'br-pond-01');
  const existing = policies.find((p) => p.companyId === 'co-kosh-01' && p.branchId === 'ALL') || policies[0];
  const duplicatePrevention: PrDuplicatePreventionSettings = {
    ...(existing?.duplicatePrevention || {}),
    checkSameCompany: true,
    enableDuplicateDetection: true,
    checkSameBranch: Boolean(base.duplicatePrevention?.checkSameBranch ?? true),
    checkSameRequester: Boolean(base.duplicatePrevention?.checkSameRequester ?? false),
    checkSameItem: true,
    checkSamePurpose: Boolean(base.duplicatePrevention?.checkSamePurpose ?? false),
    checkSameRequirementDate: Boolean(base.duplicatePrevention?.checkSameRequirementDate ?? false),
    checkSimilarQuantity: true,
    quantityVarianceTolerancePercent: 20,
    warningLevel: 'WARNING_WITH_JUSTIFICATION',
    requireJustificationToProceed: true,
    allowOverride: true,
    requireCheckerApprovalForOverride: false,
  };
  if (policyPatch) {
    Object.assign(duplicatePrevention, policyPatch);
  }
  const nextPolicy: PrGovernancePolicyConfig = {
    ...(existing || base),
    id: existing?.id || base.id || 'pol-co-kosh-01',
    companyId: 'co-kosh-01',
    companyCode: existing?.companyCode || base.companyCode,
    companyName: existing?.companyName || base.companyName,
    branchId: 'ALL',
    branchCode: 'ALL',
    branchName: 'All Branches (Company Default)',
    duplicatePrevention,
  };
  const idx = policies.findIndex((p) => p.companyId === 'co-kosh-01' && p.branchId === 'ALL');
  if (idx >= 0) policies[idx] = nextPolicy;
  else policies.push(nextPolicy);
  prGovernancePolicyService.savePolicies(policies);
}

test('Scenario 1: No duplicate PR — normal creation and submission succeed (unrelated same-branch items never falsely flagged)', () => {
  resetPolicyAndStores();
  const existingPr = makeOpenPr({
    id: 'pr-exist-s1',
    prNumber: 'PR-2026-7101',
    lines: [
      {
        id: 'l-s1',
        prId: 'pr-exist-s1',
        itemCode: 'UNRELATED-ITEM-XYZ',
        description: 'Unrelated Bearing',
        itemCategory: 'SPARES',
        inventoryUom: 'NOS',
        requestedQuantity: 50,
        approximateUnitPrice: 100,
        currency: 'INR',
        estimatedTotalValue: 5000,
        deliverySchedules: [],
        status: 'ACTIVE',
      },
    ],
  });

  const snap = prDuplicateGovernanceService.evaluateDuplicateConditions({
    draftKey: 'draft-s1',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines: [{ id: 'line-1', itemCode: 'FRESH-UNIQUE-001', requestedQuantity: 50 }],
    actorUser: MAKER_ADMIN,
    existingPrs: [existingPr],
  });

  assert.equal(snap.hasDuplicates, false);
  assert.equal(snap.submissionEligible, true);
  assert.equal(snap.overallStatus, 'CLEAR');

  const subCheck = prDuplicateGovernanceService.validateForSubmission({
    draftKey: 'draft-s1',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines: [{ id: 'line-1', itemCode: 'FRESH-UNIQUE-001', requestedQuantity: 50 }],
    actorUser: MAKER_ADMIN,
    existingPrs: [existingPr],
  });
  assert.equal(subCheck.allowed, true);
});

test('Scenario 2 & 3: One & Multiple duplicate PRs — unified snapshot identifies all matching PRs, counts, items, and statuses', () => {
  resetPolicyAndStores();
  const prA = makeOpenPr({ id: 'pr-a', prNumber: 'PR-2026-7201', status: 'DRAFT' });
  const prB = makeOpenPr({ id: 'pr-b', prNumber: 'PR-2026-7202', status: 'PENDING_MANAGER_APPROVAL' });
  const prC = makeOpenPr({ id: 'pr-c', prNumber: 'PR-2026-7203', status: 'APPROVED_PENDING_BUYER' });

  const singleSnap = prDuplicateGovernanceService.evaluateDuplicateConditions({
    draftKey: 'draft-s2',
    companyId: 'KOSH-HQ',
    branchId: 'branch-001',
    lines: [{ id: 'l-1', itemCode: 'DUP-ITEM-A', requestedQuantity: 100 }],
    actorUser: MAKER_ADMIN,
    existingPrs: [prA],
  });
  assert.equal(singleSnap.hasDuplicates, true);
  assert.equal(singleSnap.totalMatchingPrCount, 1);
  assert.equal(singleSnap.conditions[0].state, 'DETECTED');
  assert.equal(singleSnap.submissionEligible, false);

  const multiSnap = prDuplicateGovernanceService.evaluateDuplicateConditions({
    draftKey: 'draft-s3',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines: [{ id: 'l-1', itemCode: 'DUP-ITEM-A', requestedQuantity: 100 }],
    actorUser: MAKER_ADMIN,
    existingPrs: [prA, prB, prC],
  });
  assert.equal(multiSnap.totalMatchingPrCount, 3);
  assert.deepEqual(
    multiSnap.conditions[0].matchingPrs.map((m) => `${m.prNumber}:${m.status}`),
    ['PR-2026-7201:DRAFT', 'PR-2026-7202:PENDING_MANAGER_APPROVAL', 'PR-2026-7203:APPROVED_PENDING_BUYER']
  );
});

test('Scenario 4 & 5: Justification acknowledgement persists full metadata, does NOT auto-authorise override, and blocks submission when prohibited or unauthorised', () => {
  // Part A: Policy allows override, but user has NOT authorised override yet -> still blocked
  resetPolicyAndStores({ allowOverride: true, requireCheckerApprovalForOverride: false });
  const openPr = makeOpenPr({ id: 'pr-s4', prNumber: 'PR-2026-7301' });

  const ackRes = prDuplicateGovernanceService.acknowledgeCondition({
    draftKey: 'draft-s4',
    conditionKey: 'l-1::DUP-ITEM-A',
    justification: 'Separate emergency line requirement for Plant B',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines: [{ id: 'l-1', itemCode: 'DUP-ITEM-A', requestedQuantity: 100 }],
    actorUser: MAKER_ADMIN,
    existingPrs: [openPr],
  });

  assert.equal(ackRes.success, true);
  assert.equal(ackRes.condition?.state, 'ACKNOWLEDGED');
  assert.equal(ackRes.condition?.acknowledgement?.userId, MAKER_ADMIN.id);
  assert.equal(ackRes.condition?.acknowledgement?.itemCode, 'DUP-ITEM-A');
  assert.equal(ackRes.condition?.acknowledgement?.matchingPrRefs[0].prNumber, 'PR-2026-7301');
  // Critical: Acknowledgement does NOT auto-grant submission permission!
  assert.equal(ackRes.snapshot.submissionEligible, false);

  const blockedSubmit = prDuplicateGovernanceService.validateForSubmission({
    draftKey: 'draft-s4',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines: [{ id: 'l-1', itemCode: 'DUP-ITEM-A', requestedQuantity: 100 }],
    actorUser: MAKER_ADMIN,
    existingPrs: [openPr],
  });
  assert.equal(blockedSubmit.allowed, false);
  assert.match(blockedSubmit.message, /Override Authorisation/i);

  // Part B: Policy prohibits overrides (HARD_BLOCK) -> retains blocking state with clear policy reason
  resetPolicyAndStores({ warningLevel: 'HARD_BLOCK', allowOverride: false });
  const hardAck = prDuplicateGovernanceService.acknowledgeCondition({
    draftKey: 'draft-s5-hard',
    conditionKey: 'l-1::DUP-ITEM-A',
    justification: 'Urgent production request',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines: [{ id: 'l-1', itemCode: 'DUP-ITEM-A', requestedQuantity: 100 }],
    actorUser: MAKER_ADMIN,
    existingPrs: [openPr],
  });
  assert.equal(hardAck.success, true);
  assert.equal(hardAck.condition?.overrideStatus, 'PROHIBITED_BY_POLICY');
  assert.equal(hardAck.snapshot.submissionEligible, false);
  assert.match(hardAck.condition?.blockingReason || '', /HARD_BLOCK|prohibited/i);

  const authFail = prDuplicateGovernanceService.authoriseOverride({
    draftKey: 'draft-s5-hard',
    conditionKey: 'l-1::DUP-ITEM-A',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines: [{ id: 'l-1', itemCode: 'DUP-ITEM-A', requestedQuantity: 100 }],
    actorUser: MAKER_ADMIN,
    existingPrs: [openPr],
  });
  assert.equal(authFail.success, false);
});

test('Scenario 6: Override authorised — submission succeeds end-to-end through PurchaseRequisitionService.submitPR', () => {
  resetPolicyAndStores({ allowOverride: true, requireCheckerApprovalForOverride: false });
  const existingPr = makeOpenPr({ id: 'pr-s6-orig', prNumber: 'PR-2026-7401' });
  PurchaseRequisitionService.savePurchaseRequisitions([existingPr]);

  const draftKey = 'draft-s6-new';
  const lineInput = [{ id: 'l-s6', itemCode: 'DUP-ITEM-A', requestedQuantity: 100 }];

  const ackRes = prDuplicateGovernanceService.acknowledgeCondition({
    draftKey,
    conditionKey: 'l-s6::DUP-ITEM-A',
    justification: 'Customer rush order requires dedicated batch',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines: lineInput,
    actorUser: MAKER_ADMIN,
    existingPrs: [existingPr],
  });
  assert.equal(ackRes.success, true);

  const ovrRes = prDuplicateGovernanceService.authoriseOverride({
    draftKey,
    conditionKey: 'l-s6::DUP-ITEM-A',
    remarks: 'Approved under procurement emergency authority',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines: lineInput,
    actorUser: MAKER_ADMIN,
    existingPrs: [existingPr],
  });
  assert.equal(ovrRes.success, true);
  assert.equal(ovrRes.condition?.state, 'OVERRIDE_AUTHORISED');
  assert.ok(ovrRes.condition?.overrideRecord?.approvalReference?.startsWith('DUP-OVR-'));
  assert.equal(ovrRes.snapshot.submissionEligible, true);

  const createdDraft = PurchaseRequisitionService.createPR(
    {
      prType: 'MANUAL',
      companyId: 'co-kosh-01',
      companyCode: 'KOSH-HQ',
      branchId: 'br-pond-01',
      branchCode: '001',
      branchName: 'Puducherry Main Plant & HQ',
      department: 'Production',
      costCentre: 'CC-PROD-101',
      requesterId: MAKER_ADMIN.id,
      requesterName: MAKER_ADMIN.fullName,
      creatorId: MAKER_ADMIN.id,
      creatorName: MAKER_ADMIN.fullName,
      priority: 'NORMAL',
      status: 'DRAFT',
      purchasePurpose: 'Dedicated batch',
      businessJustification: 'Rush order',
      deliveryLocation: 'WH-RM-01',
      estimatedTotalValue: 30000,
      currency: 'INR',
      budgetValidationStatus: 'SUFFICIENT',
      erpStockStatus: 'FRESH',
      duplicateGovernanceKey: draftKey,
      lines: [
        {
          id: 'l-s6',
          prId: '',
          itemCode: 'DUP-ITEM-A',
          description: 'Polymer Resin Grade A',
          itemCategory: 'RM',
          inventoryUom: 'KG',
          requestedQuantity: 100,
          approximateUnitPrice: 300,
          currency: 'INR',
          estimatedTotalValue: 30000,
          deliverySchedules: [],
          status: 'ACTIVE',
        },
      ],
      changeHistory: [],
      attachments: [],
    },
    MAKER_ADMIN
  );

  const submitRes = PurchaseRequisitionService.submitPR(createdDraft.id, MAKER_ADMIN);
  assert.equal(submitRes.success, true);
  assert.equal(submitRes.pr?.status, 'PENDING_MANAGER_APPROVAL');
});

test('Scenario 7 & 8: Checker approval pending blocks submission; Checker rejection blocks submission; Maker cannot self-approve as Checker', () => {
  resetPolicyAndStores({ allowOverride: true, requireCheckerApprovalForOverride: true });
  const existingPr = makeOpenPr({ id: 'pr-s7-orig', prNumber: 'PR-2026-7501' });
  const draftKey = 'draft-s7';
  const lines = [{ id: 'l-s7', itemCode: 'DUP-ITEM-A', requestedQuantity: 100 }];

  const ackRes = prDuplicateGovernanceService.acknowledgeCondition({
    draftKey,
    conditionKey: 'l-s7::DUP-ITEM-A',
    justification: 'Buffer stock request',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines,
    actorUser: MAKER_REQUESTER,
    existingPrs: [existingPr],
  });
  assert.equal(ackRes.condition?.overrideStatus, 'PENDING_CHECKER_APPROVAL');
  assert.equal(ackRes.snapshot.submissionEligible, false);

  // Pending Checker Approval -> blocked
  const pendingBlock = prDuplicateGovernanceService.validateForSubmission({
    draftKey,
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines,
    actorUser: MAKER_REQUESTER,
    existingPrs: [existingPr],
  });
  assert.equal(pendingBlock.allowed, false);
  assert.match(pendingBlock.message, /Awaiting Checker Approval/i);

  // Maker cannot approve own override
  const selfApprove = prDuplicateGovernanceService.recordCheckerDecision({
    draftKey,
    conditionKey: 'l-s7::DUP-ITEM-A',
    decision: 'APPROVED',
    remarks: 'Trying self approval',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines,
    checkerUser: MAKER_REQUESTER,
    existingPrs: [existingPr],
  });
  assert.equal(selfApprove.success, false);
  assert.match(selfApprove.message, /Maker-Checker|not authorised/i);

  // Checker Rejects override -> submission remains blocked with reason
  const rejRes = prDuplicateGovernanceService.recordCheckerDecision({
    draftKey,
    conditionKey: 'l-s7::DUP-ITEM-A',
    decision: 'REJECTED',
    remarks: 'Consolidate with existing PR-2026-7501 instead',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines,
    checkerUser: CHECKER_USER,
    existingPrs: [existingPr],
  });
  assert.equal(rejRes.success, true);
  assert.equal(rejRes.condition?.overrideStatus, 'REJECTED');
  assert.equal(rejRes.snapshot.submissionEligible, false);

  const postRejSubmit = prDuplicateGovernanceService.validateForSubmission({
    draftKey,
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines,
    actorUser: MAKER_REQUESTER,
    existingPrs: [existingPr],
  });
  assert.equal(postRejSubmit.allowed, false);
  assert.match(postRejSubmit.message, /rejected/i);
});

test('Scenario 9: Existing duplicate PR is cancelled — duplicate validation refreshes cleanly and unblocks submission', () => {
  resetPolicyAndStores();
  const existingPr = makeOpenPr({ id: 'pr-s9-orig', prNumber: 'PR-2026-7601', status: 'APPROVED_PENDING_BUYER' });
  const prsList = [existingPr];
  const lines = [{ id: 'l-s9', itemCode: 'DUP-ITEM-A', requestedQuantity: 100 }];

  const snap1 = prDuplicateGovernanceService.evaluateDuplicateConditions({
    draftKey: 'draft-s9',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines,
    actorUser: MAKER_ADMIN,
    existingPrs: prsList,
  });
  assert.equal(snap1.hasDuplicates, true);
  assert.equal(snap1.submissionEligible, false);

  // Cancel the existing duplicate PR
  prsList[0] = { ...existingPr, status: 'CANCELLED', updatedAt: new Date().toISOString() };

  const snap2 = prDuplicateGovernanceService.evaluateDuplicateConditions({
    draftKey: 'draft-s9',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines,
    actorUser: MAKER_ADMIN,
    existingPrs: prsList,
  });
  assert.equal(snap2.hasDuplicates, false);
  assert.equal(snap2.submissionEligible, true);
  assert.equal(snap2.overallStatus, 'CLEAR');
});

test('Scenario 10: Matching duplicate PR status changes prior to submission — stale detection blocks stale submission', () => {
  resetPolicyAndStores({ allowOverride: true, requireCheckerApprovalForOverride: false });
  const existingPr = makeOpenPr({ id: 'pr-s10-orig', prNumber: 'PR-2026-7701', status: 'DRAFT' });
  const lines = [{ id: 'l-s10', itemCode: 'DUP-ITEM-A', requestedQuantity: 100 }];
  const draftKey = 'draft-s10';

  prDuplicateGovernanceService.acknowledgeCondition({
    draftKey,
    conditionKey: 'l-s10::DUP-ITEM-A',
    justification: 'Initial ack when PR-2026-7701 was DRAFT',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines,
    actorUser: MAKER_ADMIN,
    existingPrs: [existingPr],
  });
  prDuplicateGovernanceService.authoriseOverride({
    draftKey,
    conditionKey: 'l-s10::DUP-ITEM-A',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines,
    actorUser: MAKER_ADMIN,
    existingPrs: [existingPr],
  });

  // Matching PR status changes before submission -> APPROVED_PENDING_BUYER
  const mutatedExisting = { ...existingPr, status: 'APPROVED_PENDING_BUYER' as const };
  const staleCheck = prDuplicateGovernanceService.validateForSubmission({
    draftKey,
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines,
    actorUser: MAKER_ADMIN,
    existingPrs: [mutatedExisting],
  });
  assert.equal(staleCheck.allowed, false);
  assert.equal(staleCheck.snapshot.overallStatus, 'STALE');
  assert.equal(staleCheck.snapshot.conditions[0].state, 'STALE');
  assert.match(staleCheck.message, /changed status from DRAFT to APPROVED_PENDING_BUYER/i);
});

test('Scenario 11 & 12: Reload consistency + Multiple duplicate items maintain independent governance states & immutable override supersede audit', () => {
  resetPolicyAndStores({ allowOverride: true, requireCheckerApprovalForOverride: false });
  const openPr = makeOpenPr({
    id: 'pr-s12-orig',
    prNumber: 'PR-2026-7801',
    lines: [
      {
        id: 'l-orig-1',
        prId: 'pr-s12-orig',
        itemCode: 'DUP-MULTI-01',
        description: 'Item 1',
        itemCategory: 'RM',
        inventoryUom: 'KG',
        requestedQuantity: 50,
        approximateUnitPrice: 100,
        currency: 'INR',
        estimatedTotalValue: 5000,
        deliverySchedules: [],
        status: 'ACTIVE',
      },
      {
        id: 'l-orig-2',
        prId: 'pr-s12-orig',
        itemCode: 'DUP-MULTI-02',
        description: 'Item 2',
        itemCategory: 'RM',
        inventoryUom: 'KG',
        requestedQuantity: 75,
        approximateUnitPrice: 200,
        currency: 'INR',
        estimatedTotalValue: 15000,
        deliverySchedules: [],
        status: 'ACTIVE',
      },
    ],
  });

  const draftKey = 'draft-s12';
  const twoLines = [
    { id: 'd-1', itemCode: 'DUP-MULTI-01', requestedQuantity: 50 },
    { id: 'd-2', itemCode: 'DUP-MULTI-02', requestedQuantity: 75 },
  ];

  // Acknowledge + authorise ONLY Line 1 (DUP-MULTI-01); leave Line 2 (DUP-MULTI-02) DETECTED
  prDuplicateGovernanceService.acknowledgeCondition({
    draftKey,
    conditionKey: 'd-1::DUP-MULTI-01',
    justification: 'Line 1 valid secondary demand',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines: twoLines,
    actorUser: MAKER_ADMIN,
    existingPrs: [openPr],
  });
  prDuplicateGovernanceService.authoriseOverride({
    draftKey,
    conditionKey: 'd-1::DUP-MULTI-01',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines: twoLines,
    actorUser: MAKER_ADMIN,
    existingPrs: [openPr],
  });

  // Acknowledge ONLY Line 2 (no override authorisation yet)
  prDuplicateGovernanceService.acknowledgeCondition({
    draftKey,
    conditionKey: 'd-2::DUP-MULTI-02',
    justification: 'Line 2 acknowledged pending override',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines: twoLines,
    actorUser: MAKER_ADMIN,
    existingPrs: [openPr],
  });

  // Simulated browser reload re-evaluates from persisted store
  const reloadedSnap = prDuplicateGovernanceService.evaluateDuplicateConditions({
    draftKey,
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines: twoLines,
    actorUser: MAKER_ADMIN,
    existingPrs: [openPr],
  });

  const cond1 = reloadedSnap.conditions.find((c) => c.itemCode === 'DUP-MULTI-01');
  const cond2 = reloadedSnap.conditions.find((c) => c.itemCode === 'DUP-MULTI-02');
  assert.equal(cond1?.state, 'OVERRIDE_AUTHORISED');
  assert.equal(cond1?.submissionEligible, true);
  assert.equal(cond2?.state, 'ACKNOWLEDGED');
  assert.equal(cond2?.submissionEligible, false);
  // Overall submission must still be blocked until Line 2 is also authorised
  assert.equal(reloadedSnap.submissionEligible, false);

  // Requirement 7: Attempting to silently modify an already approved override (Line 1) without allowSupersede fails
  const silentEdit = prDuplicateGovernanceService.acknowledgeCondition({
    draftKey,
    conditionKey: 'd-1::DUP-MULTI-01',
    justification: 'Trying silent edit',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines: twoLines,
    actorUser: MAKER_ADMIN,
    existingPrs: [openPr],
  });
  assert.equal(silentEdit.success, false);
  assert.match(silentEdit.message, /already approved override|superseding audit event/i);

  // Explicit supersede records OVERRIDE_SUPERSEDED in immutable audit trail
  const explicitSupersede = prDuplicateGovernanceService.acknowledgeCondition({
    draftKey,
    conditionKey: 'd-1::DUP-MULTI-01',
    justification: 'Updated justification with audit event',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    lines: twoLines,
    actorUser: MAKER_ADMIN,
    existingPrs: [openPr],
    allowSupersede: true,
    supersedeReason: 'Updated batch schedule',
  });
  assert.equal(explicitSupersede.success, true);
  assert.ok(
    explicitSupersede.snapshot.auditHistory.some((h) => h.eventType === 'OVERRIDE_SUPERSEDED')
  );
});
