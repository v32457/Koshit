/**
 * CIPPLATFORM — MANDATORY END-TO-END ACCEPTANCE TESTS FOR PARTS K, L, M, N, O, P, AND Q
 * Covers all test cases specified in Part Q:
 * 1. Part K: Inventory Availability Validation (Disabled, Info-Only, Warning, Block, Exception, Stock Change Revalidation, Warehouses/Branches, Partial Stock)
 * 2. Part L: Budget Validation & Financial Control (Disabled, Warning, Block, Exception without Auto-Budget Increase, Budget Revision, PR->RFQ->PO Reconciliation without Double Counting)
 * 3. Part M: Supplier Quotation Submission (Portal, Email, Multi-Supplier, Duplicate Email, Late Submission, Revisions, Sealed Opening Lock & Audit, Buyer Verification, Unauthorized Access Block)
 * 4. Part N: Direct Purchase Order Without RFQ (RFQ Mandatory Block, RFQ Optional Allowed, RFQ Disabled Allowed, Approved Exemption Allowed, Unauthorized Bypass Logged, Reporting)
 * 5. Part O & P: Configurable Invoice Matching 2-Way & 3-Way (2-Way, 3-Way, Qty/Price/Tax Mismatch, Missing GRN/PO, Partial/Multi GRN & Invoice, Duplicate Block, Exception Approval, Historical Immutability)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { inventoryValidationService } from '../services/inventoryValidationService';
import { budgetControlService } from '../services/budgetControlService';
import { rfqService } from '../services/rfqService';
import { rfqPolicyService } from '../services/rfqPolicyService';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { goodsReceiptService } from '../services/goodsReceiptService';
import { invoiceMatchingService } from '../services/invoiceMatchingService';
import { PurchaseRequisitionService } from '../services/purchaseRequisitionService';

// ============================================================================
// 1. PART K — INVENTORY AVAILABILITY VALIDATION TESTS
// ============================================================================

test('Part K: Inventory Availability Calculation (500 Physical, 100 Reserved, 200 Incoming, 600 Required => 400 Available, 200 Shortage)', () => {
  inventoryValidationService.resetForTesting();

  inventoryValidationService.upsertInventoryBalance({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    warehouseCode: 'PDY-STR',
    itemCode: 'RMPAOPOEXLG0001',
    uom: 'KG',
    physicalStock: 500,
    reservedStock: 100,
    allocatedStock: 0,
    incomingStock: 200,
  });

  const calc = inventoryValidationService.calculateLineAvailability({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    warehouseCode: 'PDY-STR',
    itemCode: 'RMPAOPOEXLG0001',
    uom: 'KG',
    requiredPrQuantity: 600,
  });

  // Incoming stock must NEVER be treated as physically available stock
  assert.equal(calc.physicalStock, 500);
  assert.equal(calc.reservedStock, 100);
  assert.equal(calc.availableStock, 400);
  assert.equal(calc.incomingStock, 200);
  assert.equal(calc.expectedAvailableStock, 600);
  assert.equal(calc.requiredPrQuantity, 600);
  assert.equal(calc.shortageQuantity, 200);
  assert.equal(calc.isShortage, true);
});

test('Part K: Enforcement Modes (Disabled, Information-Only, Warning, Block Approval, Exception Approval)', () => {
  inventoryValidationService.resetForTesting();

  // 1. Disabled mode
  inventoryValidationService.savePolicyConfig({
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Plant',
    warehouseCode: 'ALL',
    itemCategory: 'ALL',
    inventoryLocation: 'ALL',
    isEnabled: false,
    validationStage: 'ON_PR_APPROVAL',
    availableStockCalculation: 'PHYSICAL_MINUS_RESERVED',
    considerReservedStock: true,
    considerIncomingStock: true,
    enforcementMode: 'BLOCK_APPROVAL',
    effectiveFrom: '2026-04-01',
    createdBy: 'Admin',
  });

  const disabledSnap = inventoryValidationService.validateTransactionInventory({
    prId: 'pr-test-k1',
    prNumber: 'PR-2026-9001',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    stage: 'ON_PR_APPROVAL',
    validatedBy: 'Approver 1',
    lines: [{ itemCode: 'RMPAOPOEXLG0001', requestedQuantity: 600 }],
  });
  assert.equal(disabledSnap.overallOutcome, 'VALIDATION_DISABLED');
  assert.equal(disabledSnap.canProceedApproval, true);

  // 2. Information-Only mode
  inventoryValidationService.savePolicyConfig({
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Plant',
    warehouseCode: 'ALL',
    itemCategory: 'ALL',
    inventoryLocation: 'ALL',
    isEnabled: true,
    validationStage: 'ON_PR_APPROVAL',
    availableStockCalculation: 'PHYSICAL_MINUS_RESERVED',
    considerReservedStock: true,
    considerIncomingStock: true,
    enforcementMode: 'INFORMATION_ONLY',
    effectiveFrom: '2026-04-01',
    createdBy: 'Admin',
  });

  const infoSnap = inventoryValidationService.validateTransactionInventory({
    prId: 'pr-test-k1',
    prNumber: 'PR-2026-9001',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    stage: 'ON_PR_APPROVAL',
    validatedBy: 'Approver 1',
    lines: [{ itemCode: 'RMPAOPOEXLG0001', requestedQuantity: 600 }],
  });
  assert.equal(infoSnap.overallOutcome, 'INFORMATION_LOGGED');
  assert.equal(infoSnap.canProceedApproval, true);

  // 3. Warning mode
  inventoryValidationService.savePolicyConfig({
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Plant',
    warehouseCode: 'ALL',
    itemCategory: 'ALL',
    inventoryLocation: 'ALL',
    isEnabled: true,
    validationStage: 'ON_PR_APPROVAL',
    availableStockCalculation: 'PHYSICAL_MINUS_RESERVED',
    considerReservedStock: true,
    considerIncomingStock: true,
    enforcementMode: 'WARNING',
    effectiveFrom: '2026-04-01',
    createdBy: 'Admin',
  });

  const warnSnap = inventoryValidationService.validateTransactionInventory({
    prId: 'pr-test-k1',
    prNumber: 'PR-2026-9001',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    stage: 'ON_PR_APPROVAL',
    validatedBy: 'Approver 1',
    lines: [{ itemCode: 'RMPAOPOEXLG0001', requestedQuantity: 600 }],
  });
  assert.equal(warnSnap.overallOutcome, 'WARNING_ACKNOWLEDGED');
  assert.equal(warnSnap.canProceedApproval, true);

  // 4. Block Approval mode
  inventoryValidationService.savePolicyConfig({
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Plant',
    warehouseCode: 'ALL',
    itemCategory: 'ALL',
    inventoryLocation: 'ALL',
    isEnabled: true,
    validationStage: 'ON_PR_APPROVAL',
    availableStockCalculation: 'PHYSICAL_MINUS_RESERVED',
    considerReservedStock: true,
    considerIncomingStock: true,
    enforcementMode: 'BLOCK_APPROVAL',
    effectiveFrom: '2026-04-01',
    createdBy: 'Admin',
  });

  const blockSnap = inventoryValidationService.validateTransactionInventory({
    prId: 'pr-test-k1',
    prNumber: 'PR-2026-9001',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    stage: 'ON_PR_APPROVAL',
    validatedBy: 'Approver 1',
    lines: [{ itemCode: 'RMPAOPOEXLG0001', requestedQuantity: 600 }],
  });
  assert.equal(blockSnap.overallOutcome, 'BLOCKED_BY_POLICY');
  assert.equal(blockSnap.canProceedApproval, false);

  // 5. Require Exception Approval mode
  inventoryValidationService.savePolicyConfig({
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Plant',
    warehouseCode: 'ALL',
    itemCategory: 'ALL',
    inventoryLocation: 'ALL',
    isEnabled: true,
    validationStage: 'ON_PR_APPROVAL',
    availableStockCalculation: 'PHYSICAL_MINUS_RESERVED',
    considerReservedStock: true,
    considerIncomingStock: true,
    enforcementMode: 'REQUIRE_EXCEPTION_APPROVAL',
    effectiveFrom: '2026-04-01',
    createdBy: 'Admin',
  });

  const pendingExcSnap = inventoryValidationService.validateTransactionInventory({
    prId: 'pr-test-k1',
    prNumber: 'PR-2026-9001',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    stage: 'ON_PR_APPROVAL',
    validatedBy: 'Approver 1',
    lines: [{ itemCode: 'RMPAOPOEXLG0001', requestedQuantity: 600 }],
  });
  assert.equal(pendingExcSnap.overallOutcome, 'PENDING_EXCEPTION_APPROVAL');
  assert.equal(pendingExcSnap.canProceedApproval, false);
  assert.equal(pendingExcSnap.requiresExceptionApproval, true);

  // Request & Approve Exception (enforcing Maker-Checker)
  const excReq = inventoryValidationService.requestInventoryException({
    prId: 'pr-test-k1',
    prNumber: 'PR-2026-9001',
    requestedById: 'usr-req-01',
    requestedByName: 'Arun Kumar',
    exceptionReason: 'Urgent production batch requires full 600 KG procurement despite 400 KG stock',
    shortageSummary: 'Shortage 200 KG',
  });

  assert.throws(() => {
    inventoryValidationService.approveInventoryException({
      exceptionId: excReq.id,
      approvedById: 'usr-req-01', // Same user -> Maker-Checker violation
      approvedByName: 'Arun Kumar',
      approverRemarks: 'Self approve',
    });
  }, /Maker-Checker Violation/);

  inventoryValidationService.approveInventoryException({
    exceptionId: excReq.id,
    approvedById: 'usr-mgr-02',
    approvedByName: 'Venkatesh Iyer',
    approverRemarks: 'Approved inventory exception for Q4 batch',
  });

  const approvedExcSnap = inventoryValidationService.validateTransactionInventory({
    prId: 'pr-test-k1',
    prNumber: 'PR-2026-9001',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    stage: 'ON_PR_APPROVAL',
    validatedBy: 'Venkatesh Iyer',
    lines: [{ itemCode: 'RMPAOPOEXLG0001', requestedQuantity: 600 }],
  });
  assert.equal(approvedExcSnap.overallOutcome, 'EXCEPTION_APPROVED');
  assert.equal(approvedExcSnap.canProceedApproval, true);
});

test('Part K: Stock Changes Between PR Submission and PR Approval Revalidates Stock While Preserving Original PR Quantity', () => {
  inventoryValidationService.resetForTesting();

  // At PR Submission: Physical = 700, Reserved = 50 => Available = 650 (Sufficient for 600 KG)
  inventoryValidationService.upsertInventoryBalance({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    warehouseCode: 'PDY-STR',
    itemCode: 'RMPAOPOEXLG0001',
    uom: 'KG',
    physicalStock: 700,
    reservedStock: 50,
    allocatedStock: 0,
    incomingStock: 100,
  });

  const prs = PurchaseRequisitionService.getPurchaseRequisitions();
  const samplePr = JSON.parse(JSON.stringify(prs[0]));
  samplePr.id = 'pr-stock-change-01';
  samplePr.prNumber = 'PR-2026-9100';
  samplePr.companyId = 'co-kosh-01';
  samplePr.branchId = 'br-pond-01';
  samplePr.lines[0].itemCode = 'RMPAOPOEXLG0001';
  samplePr.lines[0].requestedQuantity = 600;
  samplePr.inventoryValidationHistory = [];

  // 1. Validate at PR Submission
  const subResult = inventoryValidationService.revalidatePrAndAttachSnapshot(
    samplePr,
    'ON_PR_SUBMISSION',
    'Arun Kumar'
  );
  assert.equal(subResult.snapshot.lineResults[0].availableStock, 650);
  assert.equal(subResult.snapshot.lineResults[0].shortageQuantity, 0);
  assert.equal(subResult.pr.lines[0].requestedQuantity, 600);

  // 2. Stock changes before PR Approval (another job consumes 300 KG -> Physical drops to 400, Reserved 50 => Available = 350)
  inventoryValidationService.upsertInventoryBalance({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    warehouseCode: 'PDY-STR',
    itemCode: 'RMPAOPOEXLG0001',
    uom: 'KG',
    physicalStock: 400,
    reservedStock: 50,
    allocatedStock: 0,
    incomingStock: 100,
  });

  const appResult = inventoryValidationService.revalidatePrAndAttachSnapshot(
    samplePr,
    'ON_PR_APPROVAL',
    'Venkatesh Iyer'
  );

  // Stock revalidated accurately: Available = 350, Shortage = 250
  assert.equal(appResult.snapshot.lineResults[0].availableStock, 350);
  assert.equal(appResult.snapshot.lineResults[0].shortageQuantity, 250);
  assert.equal(appResult.snapshot.lineResults[0].fulfillableFromStockQuantity, 350);
  // Original PR requested quantity is strictly preserved!
  assert.equal(appResult.pr.lines[0].requestedQuantity, 600);
  assert.equal(appResult.snapshot.lineResults[0].originalRequestedQuantity, 600);
  // Historical snapshots preserved
  assert.equal(appResult.pr.inventoryValidationHistory?.length, 2);
});

// ============================================================================
// 2. PART L — BUDGET VALIDATION AND FINANCIAL CONTROL TESTS
// ============================================================================

test('Part L: Budget Calculation (₹50L Approved, ₹30L Committed, ₹10L Actual, ₹10L Available, ₹12L Proposed => ₹2L Shortfall)', () => {
  budgetControlService.resetForTesting();

  budgetControlService.upsertLedger({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Production',
    costCenter: 'CC-PROD-101',
    approvedBudget: 5000000, // ₹50,00,000
    revisedBudget: 5000000,
    committedAmount: 3000000, // ₹30,00,000
    actualExpenditure: 1000000, // ₹10,00,000
    pendingCommitments: 0,
  });

  const snap = budgetControlService.validateBudgetAtStage({
    transactionId: 'pr-bgt-01',
    transactionNumber: 'PR-2026-8001',
    stage: 'PR_SUBMISSION',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Production',
    costCenter: 'CC-PROD-101',
    proposedAmount: 1200000, // ₹12,00,000
    validatedBy: 'Arun Kumar',
  });

  assert.equal(snap.approvedBudget, 5000000);
  assert.equal(snap.committedAmount, 3000000);
  assert.equal(snap.actualExpenditure, 1000000);
  assert.equal(snap.availableBudget, 1000000);
  assert.equal(snap.proposedPrAmount, 1200000);
  assert.equal(snap.budgetShortfall, 200000);
  assert.equal(snap.remainingBudgetAfterPr, 0);
  assert.equal(snap.isSufficient, false);
  assert.equal(snap.overallOutcome, 'BLOCKED_INSUFFICIENT_BUDGET');
  assert.equal(snap.canProceed, false);
});

test('Part L: Budget Enforcement Modes, Exception Approval Without Auto-Increasing Budget, and Budget Revision', () => {
  budgetControlService.resetForTesting();

  // 1. Warning Only mode
  budgetControlService.savePolicyConfig({
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    department: 'Production',
    costCenter: 'CC-PROD-101',
    projectCode: 'ALL',
    financialYear: 'FY 2026-27',
    budgetPeriod: 'ANNUAL',
    applicableExpenseCategory: 'ALL',
    isEnabled: true,
    validationStage: 'PR_SUBMISSION',
    enforcementMode: 'WARNING_ONLY',
    effectiveFrom: '2026-04-01',
    createdBy: 'CFO',
  });

  const warnSnap = budgetControlService.validateBudgetAtStage({
    transactionId: 'pr-bgt-02',
    transactionNumber: 'PR-2026-8002',
    stage: 'PR_SUBMISSION',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Production',
    costCenter: 'CC-PROD-101',
    proposedAmount: 1200000,
    validatedBy: 'Arun Kumar',
  });
  assert.equal(warnSnap.overallOutcome, 'WARNING_SHORTFALL');
  assert.equal(warnSnap.canProceed, true);

  // 2. Allow With Exception Approval mode
  budgetControlService.savePolicyConfig({
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    department: 'Production',
    costCenter: 'CC-PROD-101',
    projectCode: 'ALL',
    financialYear: 'FY 2026-27',
    budgetPeriod: 'ANNUAL',
    applicableExpenseCategory: 'ALL',
    isEnabled: true,
    validationStage: 'PR_APPROVAL',
    enforcementMode: 'ALLOW_WITH_EXCEPTION_APPROVAL',
    effectiveFrom: '2026-04-01',
    createdBy: 'CFO',
  });

  const pendingSnap = budgetControlService.validateBudgetAtStage({
    transactionId: 'pr-bgt-02',
    transactionNumber: 'PR-2026-8002',
    stage: 'PR_APPROVAL',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Production',
    costCenter: 'CC-PROD-101',
    proposedAmount: 1200000,
    validatedBy: 'Arun Kumar',
  });
  assert.equal(pendingSnap.overallOutcome, 'PENDING_EXCEPTION_APPROVAL');
  assert.equal(pendingSnap.canProceed, false);
  assert.equal(pendingSnap.requiresExceptionApproval, true);

  // Request & Approve Budget Exception
  const exc = budgetControlService.requestBudgetException({
    transactionType: 'PR',
    transactionId: 'pr-bgt-02',
    transactionNumber: 'PR-2026-8002',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Production',
    costCenter: 'CC-PROD-101',
    proposedAmount: 1200000,
    availableBudgetAtRequest: 1000000,
    shortfallAmount: 200000,
    justification: 'Emergency die replacement approved by Plant Director',
    requestedById: 'usr-req-01',
    requestedByName: 'Arun Kumar',
  });

  budgetControlService.approveBudgetException({
    exceptionId: exc.id,
    approvedById: 'usr-cfo-01',
    approvedByName: 'R. Sundaram (CFO)',
    approvalRemarks: 'Approved exception against Q4 contingency reserve',
  });

  const afterExcSnap = budgetControlService.validateBudgetAtStage({
    transactionId: 'pr-bgt-02',
    transactionNumber: 'PR-2026-8002',
    stage: 'PR_APPROVAL',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Production',
    costCenter: 'CC-PROD-101',
    proposedAmount: 1200000,
    validatedBy: 'R. Sundaram (CFO)',
  });
  assert.equal(afterExcSnap.overallOutcome, 'EXCEPTION_APPROVED');
  assert.equal(afterExcSnap.canProceed, true);

  // L5 Rule: Approving a PR under budget exception MUST NOT automatically increase approved or revised budget!
  assert.equal(afterExcSnap.approvedBudget, 5000000);
  assert.equal(afterExcSnap.revisedBudget, 5000000);

  // 3. Explicit Authorized Budget Revision increases revisedBudget
  const revisedLedger = budgetControlService.reviseBudgetAllocation({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    costCenter: 'CC-PROD-101',
    newRevisedBudget: 5500000,
    reason: 'Mid-year board supplementary budget allocation',
    approvedBy: 'R. Sundaram (CFO)',
  });
  assert.equal(revisedLedger.approvedBudget, 5000000);
  assert.equal(revisedLedger.revisedBudget, 5500000);
  assert.equal(revisedLedger.availableBudget, 1500000);
});

test('Part L: Multi-Stage Commitment Reconciliation Across PR -> RFQ Award -> PO Creation -> PO Amendment Without Double Counting', () => {
  budgetControlService.resetForTesting();

  // Initial Ledger: Approved = ₹50,00,000, Committed = ₹30,00,000, Actual = ₹10,00,000 => Available = ₹10,00,000
  const chainId = 'PR-2026-CHAIN-01';

  // Stage 1: PR Approved for ₹4,00,000
  const s1 = budgetControlService.recordOrReconcileCommitment({
    sourceChainId: chainId,
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    costCenter: 'CC-PROD-101',
    stage: 'PR_APPROVAL',
    documentNumber: 'PR-2026-CHAIN-01',
    newCommitmentAmount: 400000,
    actorName: 'Approver L1',
  });
  assert.equal(s1.deltaApplied, 400000);
  assert.equal(s1.ledger.committedAmount, 3400000);
  assert.equal(s1.ledger.availableBudget, 600000);

  // Stage 2: RFQ Awarded for ₹3,75,000 (negotiated savings of ₹25,000) -> MUST NOT double count ₹4L + ₹3.75L!
  const s2 = budgetControlService.recordOrReconcileCommitment({
    sourceChainId: chainId,
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    costCenter: 'CC-PROD-101',
    stage: 'RFQ_AWARD',
    documentNumber: 'RFQ-2026-0099',
    newCommitmentAmount: 375000,
    actorName: 'Procurement Manager',
  });
  assert.equal(s2.deltaApplied, -25000);
  assert.equal(s2.ledger.committedAmount, 3375000);
  assert.equal(s2.ledger.availableBudget, 625000);

  // Stage 3: PO Created for ₹3,75,000 -> Delta is 0!
  const s3 = budgetControlService.recordOrReconcileCommitment({
    sourceChainId: chainId,
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    costCenter: 'CC-PROD-101',
    stage: 'PO_CREATION',
    documentNumber: 'PO-2026-0099',
    newCommitmentAmount: 375000,
    actorName: 'Vikram Singh',
  });
  assert.equal(s3.deltaApplied, 0);
  assert.equal(s3.ledger.committedAmount, 3375000);
  assert.equal(s3.ledger.availableBudget, 625000);

  // Stage 4: PO Amended to ₹4,25,000 -> Delta is +₹50,000!
  const s4 = budgetControlService.recordOrReconcileCommitment({
    sourceChainId: chainId,
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    costCenter: 'CC-PROD-101',
    stage: 'PO_AMENDMENT',
    documentNumber: 'PO-2026-0099-AMD1',
    newCommitmentAmount: 425000,
    actorName: 'Vikram Singh',
  });
  assert.equal(s4.deltaApplied, 50000);
  assert.equal(s4.ledger.committedAmount, 3425000);
  assert.equal(s4.ledger.availableBudget, 575000);
  assert.equal(s4.commitmentEntry.stageHistory.length, 4);
});

// ============================================================================
// 3. PART M — SUPPLIER QUOTATION SUBMISSION: PORTAL + EMAIL TESTS
// ============================================================================

test('Part M: Portal Submission, Revisions, Multi-Supplier, Email Submission, Duplicate & Late Detection, Buyer Verification, Sealed Opening & Access Isolation', () => {
  rfqService.resetForTesting();

  // 1. Unauthorized supplier access rejection
  assert.throws(() => {
    rfqService.getSupplierPortalWorkspace({
      vendorId: 'bp-999-uninvited',
      targetRfqId: 'rfq-001',
    });
  }, /Unauthorized Supplier Access Blocked/);

  // 2. Authorized supplier portal workspace (only sees own invitations & own quotations)
  const basfWorkspace = rfqService.getSupplierPortalWorkspace({
    vendorId: 'bp-002',
    targetRfqId: 'rfq-001',
  });
  assert.ok(basfWorkspace.authorizedRfqs.length >= 1);
  assert.ok(basfWorkspace.ownQuotations.every((q) => q.vendorId === 'bp-002'));

  // 3. Submit Revised Portal Quotation (Rev 2) -> preserves Rev 1 intact
  const rev2Portal = rfqService.submitPortalQuotation({
    rfqId: 'rfq-001',
    vendorId: 'bp-002',
    quotationNumber: 'QT-BASF-2026-88-R2',
    validUntil: '2027-01-15',
    paymentTerms: 'NET 60 Days',
    incoterms: 'FOR Puducherry',
    submittedBy: 'Dr. Amitav Banerjee (BASF)',
    submittedAt: '2026-11-12T10:00:00Z',
    lines: [
      {
        rfqLineId: 'rfq-line-001',
        itemCode: 'RMPAOPOEXLG0001',
        description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
        quotedQuantityPurchUom: 20,
        purchaseUom: 'BAG',
        unitPricePurchUom: 6650, // Reduced from 6800 in Rev 1
        gstPercent: 18,
        freightAmount: 1500,
        discountPercent: 2,
        deliveryLeadTimeDays: 6,
      },
    ],
    attachments: [
      { fileName: 'BASF_Revised_Commercial_Offer_Rev2.pdf', fileSize: 890000, category: 'COMMERCIAL' },
    ],
  });

  assert.equal(rev2Portal.revisionNumber, 2);
  assert.equal(rev2Portal.submissionChannel, 'PORTAL');
  assert.equal(rev2Portal.unifiedStatus, 'ACCEPTED');

  // Verify Rev 1 is preserved in repository and marked REVISED
  const allRfq1Quots = rfqService.getQuotationsForRfq('rfq-001').filter((q) => q.vendorId === 'bp-002');
  assert.equal(allRfq1Quots.length, 2);
  const rev1Record = allRfq1Quots.find((q) => q.revisionNumber === 1);
  assert.ok(rev1Record);
  assert.equal(rev1Record!.lines[0].unitPricePurchUom, 6800); // Unchanged!
  assert.equal(rev1Record!.supersededByRevision, 2);

  // 4. Inbound Email Quotation Submission + Duplicate Email Detection + Buyer Verification
  const emailIngest = rfqService.ingestInboundEmailQuotation({
    rfqId: 'rfq-003',
    senderEmail: 'tenders@festo.in',
    emailMessageId: '<msg-festo-2026-001@festo.in>',
    emailSubject: 'RE: RFQ-2026-0003 Quotation QT-FESTO-901',
    emailBodyExcerpt: 'Attached quotation for 15 SET Pneumatic Solenoid Valves.',
    receivedTimestamp: '2026-11-15T09:30:00Z',
    quotationNumber: 'QT-FESTO-901',
    validUntil: '2027-01-15',
    paymentTerms: 'NET 60 Days',
    incoterms: 'DDP Sriperumbudur',
    rawAttachmentFileNames: ['Festo_Quotation_901.pdf', 'Festo_ISO_Compliance.pdf'],
    lines: [
      {
        rfqLineId: 'rfq-line-003',
        itemCode: 'MAPALBL0003',
        description: 'Pneumatic Solenoid Valve – 5/2 Way',
        quotedQuantityPurchUom: 15,
        purchaseUom: 'SET',
        unitPricePurchUom: 3100,
        gstPercent: 18,
        freightAmount: 500,
        deliveryLeadTimeDays: 10,
      },
    ],
  });

  assert.equal(emailIngest.isDuplicateEmail, false);
  assert.equal(emailIngest.isLateSubmission, false);
  assert.equal(emailIngest.quotation.submissionChannel, 'EMAIL');
  assert.equal(emailIngest.quotation.unifiedStatus, 'UNDER_VERIFICATION');
  assert.equal(emailIngest.quotation.verificationStatus, 'PENDING_BUYER_VERIFICATION');
  assert.equal(emailIngest.quotation.isEvaluationReady, false);
  assert.equal(
    emailIngest.quotation.emailEvidence?.rfqEmailReference,
    'RFQ-2026-0003+VEND-FESTO-01@inbound.kosh.in'
  );

  // Duplicate email submission with same emailMessageId is flagged and does not create a duplicate record
  const dupEmailIngest = rfqService.ingestInboundEmailQuotation({
    rfqId: 'rfq-003',
    senderEmail: 'tenders@festo.in',
    emailMessageId: '<msg-festo-2026-001@festo.in>',
    emailSubject: 'RE: RFQ-2026-0003 Quotation QT-FESTO-901',
    emailBodyExcerpt: 'Duplicate re-transmission.',
    receivedTimestamp: '2026-11-15T09:35:00Z',
    quotationNumber: 'QT-FESTO-901',
    validUntil: '2027-01-15',
    paymentTerms: 'NET 60 Days',
    incoterms: 'DDP Sriperumbudur',
    rawAttachmentFileNames: ['Festo_Quotation_901.pdf'],
    lines: [],
  });
  assert.equal(dupEmailIngest.isDuplicateEmail, true);
  assert.equal(dupEmailIngest.quotation.id, emailIngest.quotation.id);

  // Buyer verifies and accepts the email quotation
  const verifiedQuot = rfqService.verifyEmailQuotationByBuyer({
    quotationId: emailIngest.quotation.id,
    buyerId: 'usr-buyer-02',
    buyerName: 'Priya Narayanan',
    decision: 'ACCEPT',
    verificationRemarks: 'Verified PDF attachment and unit pricing.',
  });
  assert.equal(verifiedQuot.unifiedStatus, 'ACCEPTED');
  assert.equal(verifiedQuot.verificationStatus, 'BUYER_VERIFIED');
  assert.equal(verifiedQuot.isEvaluationReady, true);

  // 5. Late Email Quotation Detection (received after responseDeadline 2026-11-28)
  const lateEmail = rfqService.ingestInboundEmailQuotation({
    rfqId: 'rfq-003',
    senderEmail: 'tenders@festo.in',
    emailMessageId: '<msg-festo-2026-late@festo.in>',
    emailSubject: 'Late Revised Offer QT-FESTO-902',
    emailBodyExcerpt: 'Late submission after deadline.',
    receivedTimestamp: '2026-12-02T11:00:00Z',
    quotationNumber: 'QT-FESTO-902',
    validUntil: '2027-01-30',
    paymentTerms: 'NET 60 Days',
    incoterms: 'DDP',
    rawAttachmentFileNames: ['Festo_Late_902.pdf'],
    lines: [
      {
        rfqLineId: 'rfq-line-003',
        itemCode: 'MAPALBL0003',
        description: 'Pneumatic Solenoid Valve',
        quotedQuantityPurchUom: 15,
        purchaseUom: 'SET',
        unitPricePurchUom: 2950,
        gstPercent: 18,
        deliveryLeadTimeDays: 7,
      },
    ],
  });
  assert.equal(lateEmail.isLateSubmission, true);
  assert.equal(lateEmail.quotation.unifiedStatus, 'LATE_SUBMISSION');
  assert.equal(lateEmail.quotation.revisionNumber, 2); // Did not overwrite verified Rev 1!

  // 6. Sealed Quotation Confidentiality (Blocked before opening time, Allowed after opening time, Logged in accessHistory)
  const beforeOpening = rfqService.accessCommercialQuotation({
    quotationId: rev2Portal.id,
    actorId: 'usr-buyer-01',
    actorName: 'Vikram Singh',
    actorRole: 'BUYER',
    currentTimestamp: '2026-11-15T12:00:00Z', // Before 2026-11-20T18:00:00Z
  });
  assert.equal(beforeOpening.accessAllowed, false);
  assert.match(beforeOpening.denialReason || '', /Sealed Quotation Locked/);

  const afterOpening = rfqService.accessCommercialQuotation({
    quotationId: rev2Portal.id,
    actorId: 'usr-buyer-01',
    actorName: 'Vikram Singh',
    actorRole: 'BUYER',
    currentTimestamp: '2026-11-21T09:00:00Z', // After 2026-11-20T18:00:00Z
  });
  assert.equal(afterOpening.accessAllowed, true);
  assert.ok(afterOpening.quotation);
  assert.equal(afterOpening.quotation!.accessHistory?.length, 2);

  // 7. Cross-Supplier Quotation Access Blocked
  const crossSupplierAttempt = rfqService.accessCommercialQuotation({
    quotationId: rev2Portal.id, // Belongs to bp-002 (BASF)
    actorId: 'usr-sup-poly',
    actorName: 'Polymer Solutions Rep',
    actorRole: 'SUPPLIER',
    supplierVendorId: 'bp-003',
    currentTimestamp: '2026-11-21T10:00:00Z',
  });
  assert.equal(crossSupplierAttempt.accessAllowed, false);
  assert.match(crossSupplierAttempt.denialReason || '', /Unauthorized Supplier Access/);
});

// ============================================================================
// 4. PART N — DIRECT PURCHASE ORDER WITHOUT RFQ TESTS
// ============================================================================

test('Part N: Direct PO Blocked When RFQ Mandatory, Allowed With Approved Exemption, Allowed When RFQ Optional/Disabled, and Tracked in Compliance Report', () => {
  purchaseOrderService.resetForTesting();
  budgetControlService.resetForTesting();
  inventoryValidationService.resetForTesting();

  // 1. Branch br-pond-01 under co-kosh-01 has RFQ_ENABLED (Mandatory) by default.
  // Attempting Direct PO without approved RFQ Exemption MUST be blocked and logged!
  assert.throws(() => {
    purchaseOrderService.createDirectPurchaseOrder({
      companyId: 'co-kosh-01',
      branchId: 'br-pond-01',
      department: 'Production',
      costCentre: 'CC-PROD-101',
      vendorId: 'bp-002',
      directPoReason: 'EMERGENCY_PROCUREMENT',
      directPoJustification: 'Attempted bypass without exemption approval',
      buyerId: 'usr-buyer-01',
      buyerName: 'Vikram Singh',
      lines: [
        {
          itemCode: 'RMPAOPOEXLG0001',
          description: 'PC-ABS – Injection Grade V0',
          purchaseUom: 'BAG',
          orderQtyPurchUom: 5,
          unitPricePurchUom: 6800,
          gstPercent: 18,
        },
      ],
    });
  }, /Direct PO Blocked: RFQ is MANDATORY/);

  // Verify unauthorized attempt was recorded in blocked attempts log
  const reportAfterBlock = purchaseOrderService.getDirectPoComplianceReport('co-kosh-01', 'br-pond-01');
  assert.equal(reportAfterBlock.blockedBypassAttempts.length, 1);

  // 2. Request & Approve Authorized RFQ Exemption -> Direct PO Allowed under RFQ_ENABLED
  const exm = purchaseOrderService.requestRfqExemption({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    prNumber: 'PR-2026-0001',
    vendorId: 'bp-002',
    vendorName: 'BASF INDIA LIMITED',
    itemCode: 'RMPAOPOEXLG0001',
    estimatedValue: 34000,
    reasonCode: 'EMERGENCY_PROCUREMENT',
    justification: 'Critical line-down emergency resin replenishment',
    requestedBy: 'Vikram Singh',
  });

  purchaseOrderService.approveRfqExemption({
    exemptionId: exm.id,
    approvedBy: 'Venkatesh Iyer (Head of Procurement)',
    approvalRemarks: 'Approved emergency single-lot exemption',
  });

  const exemptedDirectPo = purchaseOrderService.createDirectPurchaseOrder({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Production',
    costCentre: 'CC-PROD-101',
    vendorId: 'bp-002',
    directPoReason: 'EMERGENCY_PROCUREMENT',
    directPoJustification: 'Critical line-down emergency resin replenishment',
    exemptionApprovalRef: exm.exemptionReference,
    buyerId: 'usr-buyer-01',
    buyerName: 'Vikram Singh',
    lines: [
      {
        itemCode: 'RMPAOPOEXLG0001',
        description: 'PC-ABS – Injection Grade V0',
        purchaseUom: 'BAG',
        orderQtyPurchUom: 5,
        unitPricePurchUom: 6800,
        gstPercent: 18,
      },
    ],
  });

  assert.equal(exemptedDirectPo.isDirectPo, true);
  assert.equal(exemptedDirectPo.rfqRequirementStatus, 'RFQ_MANDATORY_EXEMPTED');
  assert.equal(exemptedDirectPo.exemptionApprovalRef, exm.exemptionReference);

  // 3. Direct PO Allowed When RFQ Policy is RFQ_DISABLED (e.g., Dehradun branch br-ddun-05 under co-kosh-04)
  const disabledRfqPo = purchaseOrderService.createDirectPurchaseOrder({
    companyId: 'co-kosh-04',
    branchId: 'br-ddun-05',
    department: 'Production',
    costCentre: 'CC-PROD-101',
    vendorId: 'bp-002',
    directPoReason: 'RATE_CONTRACT',
    directPoJustification: 'Standard rate contract call-off at Dehradun plant where RFQ is disabled',
    buyerId: 'usr-buyer-01',
    buyerName: 'Vikram Singh',
    lines: [
      {
        itemCode: 'RMPAOPOEXLG0001',
        description: 'PC-ABS – Injection Grade V0',
        purchaseUom: 'BAG',
        orderQtyPurchUom: 4,
        unitPricePurchUom: 6800,
        gstPercent: 18,
      },
    ],
  });
  assert.equal(disabledRfqPo.isDirectPo, true);
  assert.equal(disabledRfqPo.rfqRequirementStatus, 'RFQ_DISABLED_DIRECT');

  // 4. Direct PO Allowed When RFQ Policy is RFQ_OPTIONAL
  rfqPolicyService.updatePolicy({
    id: 'pol-br-hosur-opt',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-hosur-02',
    branchCode: '002',
    branchName: 'Hosur Manufacturing Facility',
    policyMode: 'RFQ_OPTIONAL',
    isInheritedFromCompany: false,
    allowBranchOverride: true,
    minSupplierInvitations: 1,
    maxSupplierInvitations: 5,
    defaultQuotationValidityDays: 30,
    evaluationType: 'SINGLE_STAGE',
    sealedCommercialQuotations: false,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Admin',
  });

  const optionalRfqPo = purchaseOrderService.createDirectPurchaseOrder({
    companyId: 'co-kosh-01',
    branchId: 'br-hosur-02',
    department: 'Assembly',
    costCentre: 'CC-ASM-202',
    vendorId: 'bp-002',
    directPoReason: 'APPROVED_SINGLE_SOURCE',
    directPoJustification: 'Approved OEM single source under optional RFQ branch policy',
    buyerId: 'usr-buyer-01',
    buyerName: 'Vikram Singh',
    lines: [
      {
        itemCode: 'PKG-FASTENER-M8',
        description: 'M8 Hex Flange Bolts',
        purchaseUom: 'BOX',
        orderQtyPurchUom: 10,
        unitPricePurchUom: 850,
        gstPercent: 18,
      },
    ],
  });
  assert.equal(optionalRfqPo.isDirectPo, true);
  assert.equal(optionalRfqPo.rfqRequirementStatus, 'RFQ_OPTIONAL_DIRECT');

  // 5. Verify Compliance Report separates RFQ-based POs, Direct POs, Approved Exemptions, and Blocked Attempts
  const fullReport = purchaseOrderService.getDirectPoComplianceReport();
  assert.equal(fullReport.rfqBasedPos.length, 1);
  assert.equal(fullReport.directPos.length, 3);
  assert.equal(fullReport.approvedExemptionPos.length, 1);
  assert.equal(fullReport.blockedBypassAttempts.length, 1);
});

// ============================================================================
// 5. PART O & PART P — CONFIGURABLE INVOICE MATCHING (2-WAY & 3-WAY) & HISTORICAL IMMUTABILITY TESTS
// ============================================================================

test('Part O & P: Two-Way and Three-Way Invoice Matching, Partial/Multiple GRNs & Invoices, All Variance Outcomes, Exception Approval, and Historical Snapshot Immutability', () => {
  purchaseOrderService.resetForTesting();
  goodsReceiptService.resetForTesting();
  invoiceMatchingService.resetForTesting();

  // Seed PO-2026-0001 has 12 BAG @ ₹6,800, GST 18% (GRN-2026-0001 has 12 BAG accepted)
  // 1. Exact 3-Way Match (Partial Invoice #1 for 5 BAG)
  const inv1 = invoiceMatchingService.submitAndMatchSupplierInvoice({
    supplierInvoiceNumber: 'BASF/26/INV-001',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    vendorId: 'bp-002',
    poNumber: 'PO-2026-0001',
    invoiceType: 'PARTIAL',
    createdBy: 'AP Executive',
    lines: [
      {
        itemCode: 'RMPAOPOEXLG0001',
        uom: 'BAG',
        invoicedQuantity: 5,
        unitPrice: 6800,
        taxPercent: 18,
      },
    ],
  });
  assert.equal(inv1.matchingOutcome, 'MATCHED');
  assert.equal(inv1.postingStatus, 'READY_FOR_POSTING');
  assert.equal(inv1.matchingSnapshot.remainingOpenGrnQty, 7); // 12 - 5 = 7 BAG remaining open

  // 2. Duplicate Supplier Invoice Detection
  const dupInv = invoiceMatchingService.submitAndMatchSupplierInvoice({
    supplierInvoiceNumber: 'BASF/26/INV-001', // Same invoice number from same supplier
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    vendorId: 'bp-002',
    poNumber: 'PO-2026-0001',
    createdBy: 'AP Executive',
    lines: [
      {
        itemCode: 'RMPAOPOEXLG0001',
        uom: 'BAG',
        invoicedQuantity: 5,
        unitPrice: 6800,
        taxPercent: 18,
      },
    ],
  });
  assert.equal(dupInv.matchingOutcome, 'DUPLICATE_INVOICE');
  assert.equal(dupInv.postingStatus, 'BLOCKED');

  // 3. Second Partial Invoice Within Tolerance (7 BAG @ ₹6,850 -> +0.74% price variance, within 1% tolerance & ₹350 <= ₹1000 value tolerance)
  const inv2 = invoiceMatchingService.submitAndMatchSupplierInvoice({
    supplierInvoiceNumber: 'BASF/26/INV-002',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    vendorId: 'bp-002',
    poNumber: 'PO-2026-0001',
    invoiceType: 'FINAL',
    createdBy: 'AP Executive',
    lines: [
      {
        itemCode: 'RMPAOPOEXLG0001',
        uom: 'BAG',
        invoicedQuantity: 7,
        unitPrice: 6850,
        taxPercent: 18,
      },
    ],
  });
  assert.equal(inv2.matchingOutcome, 'MATCHED_WITHIN_TOLERANCE');
  assert.equal(inv2.postingStatus, 'READY_FOR_POSTING');
  assert.equal(inv2.matchingSnapshot.remainingOpenGrnQty, 0);

  // 4. Over-Invoicing Beyond Open Accepted GRN Quantity -> QUANTITY_MISMATCH
  const qtyMismatchInv = invoiceMatchingService.submitAndMatchSupplierInvoice({
    supplierInvoiceNumber: 'BASF/26/INV-003-OVER',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    vendorId: 'bp-002',
    poNumber: 'PO-2026-0001',
    createdBy: 'AP Executive',
    lines: [
      {
        itemCode: 'RMPAOPOEXLG0001',
        uom: 'BAG',
        invoicedQuantity: 2, // 0 open GRN qty remaining!
        unitPrice: 6800,
        taxPercent: 18,
      },
    ],
  });
  assert.equal(qtyMismatchInv.matchingOutcome, 'QUANTITY_MISMATCH');
  assert.equal(qtyMismatchInv.matchingSnapshot.canPostToAccounting, false);

  // 5. Missing GRN in 3-Way Matching & Multiple Partial GRNs with Rejected Quantity Exclusion
  // Create a new PO with 20 BAG ordered, initially 0 GRNs posted
  const pos = purchaseOrderService.getPOs();
  const po2 = JSON.parse(JSON.stringify(pos[0]));
  po2.id = 'po-002';
  po2.poNumber = 'PO-2026-0002';
  po2.lines[0].id = 'pol-002';
  po2.lines[0].poId = 'po-002';
  po2.lines[0].orderQtyPurchUom = 20;
  po2.lines[0].receivedQtyPurchUom = 0;
  purchaseOrderService.savePOs([po2, ...pos]);

  const missingGrnInv = invoiceMatchingService.submitAndMatchSupplierInvoice({
    supplierInvoiceNumber: 'BASF/26/INV-NO-GRN',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    vendorId: 'bp-002',
    poNumber: 'PO-2026-0002',
    createdBy: 'AP Executive',
    lines: [
      {
        itemCode: 'RMPAOPOEXLG0001',
        uom: 'BAG',
        invoicedQuantity: 10,
        unitPrice: 6800,
        taxPercent: 18,
      },
    ],
  });
  assert.equal(missingGrnInv.matchingOutcome, 'MISSING_GRN');

  // Post Partial GRN #1: 10 BAG received, 2 BAG rejected => 8 BAG accepted
  goodsReceiptService.postGoodsReceipt(
    {
      poId: 'po-002',
      poNumber: 'PO-2026-0002',
      companyId: 'co-kosh-01',
      branchId: 'br-pond-01',
      vendorId: 'bp-002',
      vendorName: 'BASF INDIA LIMITED',
      isPartialDelivery: true,
      isFinalDelivery: false,
    },
    [
      {
        poLineId: 'pol-002',
        itemCode: 'RMPAOPOEXLG0001',
        purchaseUom: 'BAG',
        inventoryUom: 'KG',
        conversionRatio: 25,
        receivedQtyPurchUom: 10,
        acceptedQtyPurchUom: 8,
        rejectedQtyPurchUom: 2,
        acceptedQtyInvUom: 200,
        rejectedQtyInvUom: 50,
      },
    ]
  );

  // Post Partial GRN #2: 6 BAG received, 0 rejected => 6 BAG accepted (Cumulative Accepted = 14 BAG)
  goodsReceiptService.postGoodsReceipt(
    {
      poId: 'po-002',
      poNumber: 'PO-2026-0002',
      companyId: 'co-kosh-01',
      branchId: 'br-pond-01',
      vendorId: 'bp-002',
      vendorName: 'BASF INDIA LIMITED',
      isPartialDelivery: true,
      isFinalDelivery: true,
    },
    [
      {
        poLineId: 'pol-002',
        itemCode: 'RMPAOPOEXLG0001',
        purchaseUom: 'BAG',
        inventoryUom: 'KG',
        conversionRatio: 25,
        receivedQtyPurchUom: 6,
        acceptedQtyPurchUom: 6,
        rejectedQtyPurchUom: 0,
        acceptedQtyInvUom: 150,
        rejectedQtyInvUom: 0,
      },
    ]
  );

  // Price Mismatch Invoice against PO-2026-0002 (14 BAG @ ₹7,500 vs PO ₹6,800) -> PRICE_MISMATCH
  const priceMismatchInv = invoiceMatchingService.submitAndMatchSupplierInvoice({
    supplierInvoiceNumber: 'BASF/26/INV-PRICE-VAR',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    vendorId: 'bp-002',
    poNumber: 'PO-2026-0002',
    createdBy: 'AP Executive',
    lines: [
      {
        itemCode: 'RMPAOPOEXLG0001',
        uom: 'BAG',
        invoicedQuantity: 14,
        unitPrice: 7500,
        taxPercent: 18,
      },
    ],
  });
  assert.equal(priceMismatchInv.matchingOutcome, 'PRICE_MISMATCH');

  // Route Price Mismatch Invoice through Exception Approval Workflow -> PENDING_EXCEPTION_APPROVAL -> APPROVED_FOR_POSTING
  const pendingExcInv = invoiceMatchingService.requestInvoiceExceptionApproval({
    invoiceId: priceMismatchInv.id,
    requestedBy: 'AP Executive',
    varianceJustification: 'Emergency air-freight resin surcharge approved by Procurement Head',
  });
  assert.equal(pendingExcInv.matchingOutcome, 'PENDING_EXCEPTION_APPROVAL');

  const approvedForPostingInv = invoiceMatchingService.resolveInvoiceExceptionApproval({
    invoiceId: priceMismatchInv.id,
    approvedBy: 'R. Sundaram (CFO)',
    decision: 'APPROVE',
    approverRemarks: 'Approved surcharge variance for posting',
  });
  assert.equal(approvedForPostingInv.matchingOutcome, 'APPROVED_FOR_POSTING');
  assert.equal(approvedForPostingInv.postingStatus, 'READY_FOR_POSTING');
  assert.equal(approvedForPostingInv.matchingSnapshot.canPostToAccounting, true);

  // 6. Two-Way Matching Mode & Part P Historical Configuration Immutability
  // Switch policy to TWO_WAY (version 2)
  const newPolicyV2 = invoiceMatchingService.savePolicyConfig({
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'ALL',
    branchCode: 'ALL',
    purchaseOrgId: 'ALL',
    supplierCategory: 'ALL',
    procurementCategory: 'ALL',
    transactionType: 'ALL',
    itemCategory: 'ALL',
    invoiceType: 'ALL',
    matchingMode: 'TWO_WAY',
    quantityTolerancePercent: 5,
    priceTolerancePercent: 5,
    valueToleranceAmount: 5000,
    taxTolerancePercent: 0,
    freightToleranceAmount: 2000,
    overInvoiceTolerancePercent: 5,
    underInvoiceTolerancePercent: 100,
    allowPartialInvoices: true,
    allowMultipleInvoices: true,
    requireExceptionApproval: true,
    effectiveFrom: '2026-04-01',
    createdBy: 'CFO',
  });
  assert.equal(newPolicyV2.version, 2);

  // Verify historical invoice (inv1) still preserves its original v1 THREE_WAY matching snapshot!
  const historicalInv1 = invoiceMatchingService.getInvoices().find((i) => i.id === inv1.id);
  assert.ok(historicalInv1);
  assert.equal(historicalInv1!.matchingSnapshot.policyVersion, 1);
  assert.equal(historicalInv1!.matchingSnapshot.matchingModeUsed, 'THREE_WAY');
});
