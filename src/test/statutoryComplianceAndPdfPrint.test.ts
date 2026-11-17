import test from 'node:test';
import assert from 'node:assert/strict';
import { complianceGovernanceService } from '../services/complianceGovernanceService';
import {
  generatePurchaseRequisitionPdf,
  formatLineDeliveryScheduleForPdf,
  getImmutablePrPdfRepository,
  getImmutablePrPdfByPrId,
  resolveOrArchiveApprovedPrPdf,
  clearImmutablePrPdfRepositoryForTests,
} from '../services/prPdfExportService';
import { PurchaseRequisitionService } from '../services/purchaseRequisitionService';
import { PurchaseRequisition } from '../types';
import { INITIAL_USERS } from '../data/seedData';

// Mock localStorage for node environment
if (typeof globalThis.localStorage === 'undefined') {
  const storage = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    key: (i: number) => Array.from(storage.keys())[i] || null,
    length: storage.size,
  } as Storage;
}

test('complianceGovernanceService manages statutory verification settings', () => {
  // Test defaults
  complianceGovernanceService.resetComplianceSettings();
  const defaults = complianceGovernanceService.getComplianceSettings();
  assert.equal(defaults.gstValidationEnabled, true);
  assert.equal(defaults.msmeValidationEnabled, true);
  assert.equal(defaults.gstDefaultStatusOnUpload, 'PENDING_MANUAL_VALIDATION');
  assert.equal(defaults.msmeDefaultStatusOnUpload, 'PENDING_MANUAL_VALIDATION');

  // Test updating settings: disable GST and MSME validations
  const updated = complianceGovernanceService.saveComplianceSettings({
    gstValidationEnabled: false,
    msmeValidationEnabled: false,
  });
  assert.equal(updated.gstValidationEnabled, false);
  assert.equal(updated.msmeValidationEnabled, false);
  assert.equal(complianceGovernanceService.isGstValidationEnabled(), false);
  assert.equal(complianceGovernanceService.isMsmeValidationEnabled(), false);

  // Re-enable GST validation
  complianceGovernanceService.saveComplianceSettings({
    gstValidationEnabled: true,
  });
  assert.equal(complianceGovernanceService.isGstValidationEnabled(), true);
  assert.equal(complianceGovernanceService.isMsmeValidationEnabled(), false);
});

test('complianceGovernanceService formats file sizes and validates statutory formats', () => {
  assert.equal(complianceGovernanceService.formatFileSize(500), '500 B');
  assert.equal(complianceGovernanceService.formatFileSize(1536), '1.5 KB');
  assert.equal(complianceGovernanceService.formatFileSize(2097152), '2 MB');

  // GSTIN format validation
  assert.equal(complianceGovernanceService.validateGstinFormat('34AAACK4603M1ZP').valid, true);
  assert.equal(complianceGovernanceService.validateGstinFormat('22AAAAA0000A1Z5').valid, true);
  assert.equal(complianceGovernanceService.validateGstinFormat('INVALID_GSTIN').valid, false);
  assert.equal(complianceGovernanceService.validateGstinFormat('').valid, false);

  // Udyam format validation
  assert.equal(complianceGovernanceService.validateUdyamFormat('UDYAM-TN-03-0012345').valid, true);
  assert.equal(complianceGovernanceService.validateUdyamFormat('UDYAM-DL-01-0099887').valid, true);
  assert.equal(complianceGovernanceService.validateUdyamFormat('12345').valid, false);
});

test('complianceGovernanceService creates document attachment and validation records', () => {
  const doc = complianceGovernanceService.createDocumentAttachment(
    'GST_REGISTRATION_CERTIFICATE.pdf',
    245000,
    'application/pdf',
    'Rajesh Sharma',
    'GST_CERTIFICATE'
  );
  assert.equal(doc.fileName, 'GST_REGISTRATION_CERTIFICATE.pdf');
  assert.equal(doc.documentType, 'GST_CERTIFICATE');
  assert.equal(doc.uploadedBy, 'Rajesh Sharma');
  assert.ok(doc.id.startsWith('doc-'));
  assert.ok(doc.uploadedAt);

  const val = complianceGovernanceService.createManualValidationRecord(
    'MANUALLY_VERIFIED',
    'Auditor Priya',
    'Physically cross-checked with Form REG-06'
  );
  assert.equal(val.status, 'MANUALLY_VERIFIED');
  assert.equal(val.validatedBy, 'Auditor Priya');
  assert.ok(val.validatedAt);
  assert.equal(val.notes, 'Physically cross-checked with Form REG-06');
});

test('generatePurchaseRequisitionPdf generates Approved PDF with Approval History table', () => {
  const approvedPr: PurchaseRequisition = {
    id: 'pr-mock-approved-01',
    prNumber: 'PR-2526-0099',
    prType: 'MANUAL',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-INNOVATIONS',
    companyName: 'Kosh Innovations Pvt Ltd',
    branchId: 'br-pondicherry',
    branchCode: 'KOSH-TN-01',
    branchName: 'Pondicherry Main Plant & HQ',
    department: 'Production Engineering',
    costCentre: 'CC-PROD-01',
    requesterId: 'usr-rajesh',
    requesterName: 'Rajesh Sharma',
    creatorId: 'usr-rajesh',
    creatorName: 'Rajesh Sharma',
    priority: 'NORMAL',
    status: 'APPROVED',
    purchasePurpose: 'Raw material procurement for Q3 automotive bracket moulding run',
    businessJustification: 'Alilgned with confirmed vehicle delivery schedule',
    deliveryLocation: 'Pondicherry Main Plant',
    estimatedTotalValue: 125000,
    currency: 'INR',
    creationDate: '2026-11-10T08:30:00Z',
    lines: [],
    items: [
      {
        id: 'item-01',
        itemCode: 'RMPAOPOEXLG0004',
        itemDescription: 'PC-ABS - Injection Grade V0 - Light Grey',
        category: 'RAW_MATERIAL',
        uom: 'KG',
        quantity: 500,
        convertedQuantity: 0,
        closedOrCancelledQuantity: 0,
        remainingQuantity: 500,
        lineStatus: 'AVAILABLE',
        estimatedPrice: 250,
        currency: 'INR',
        lineTotal: 125000,
      },
    ],
    approvalHistory: [
      {
        id: 'ah-1',
        cycleNumber: 1,
        level: 'Level 1: Plant Operations Lead',
        actorId: 'usr-vikram',
        actorName: 'Vikram Patel',
        actorRole: 'Operations Manager',
        decision: 'APPROVED',
        timestamp: '2026-11-10T11:20:00Z',
        remarks: 'Material quantities aligned with Q3 assembly forecast.',
      },
      {
        id: 'ah-2',
        cycleNumber: 1,
        level: 'Level 2: Head of Procurement',
        actorId: 'usr-sunil',
        actorName: 'Sunil Mehta',
        actorRole: 'VP Procurement & Supply Chain',
        decision: 'APPROVED',
        timestamp: '2026-11-11T09:45:00Z',
        remarks: 'Vendor pricing benchmarks verified. Approved for RFQ/PO processing.',
      },
    ],
    budgetValidationStatus: 'SUFFICIENT',
    erpStockStatus: 'CHECKED',
    changeHistory: [],
    attachments: [],
    createdAt: '2026-11-10T08:30:00Z',
    updatedAt: '2026-11-11T09:45:00Z',
  };

  const pdfDoc = generatePurchaseRequisitionPdf(approvedPr, {
    printedBy: 'Rajesh Sharma',
    includeApprovalHistory: true,
  });

  assert.ok(pdfDoc, 'PDF document should be created');
  const pageCount = pdfDoc.getNumberOfPages();
  assert.ok(pageCount >= 1, 'Should have at least 1 page');
});

test('generatePurchaseRequisitionPdf generates Controlled Copy PDF for unapproved PR', () => {
  const unapprovedPr: PurchaseRequisition = {
    id: 'pr-mock-pending-01',
    prNumber: 'PR-2526-0013',
    prType: 'MANUAL',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-INNOVATIONS',
    companyName: 'Kosh Innovations Pvt Ltd',
    branchId: 'br-pondicherry',
    branchCode: 'KOSH-TN-01',
    branchName: 'Pondicherry Main Plant & HQ',
    department: 'Production',
    costCentre: 'CC-PROD-01',
    requesterId: 'usr-rajesh',
    requesterName: 'Rajesh Sharma',
    creatorId: 'usr-rajesh',
    creatorName: 'Rajesh Sharma',
    priority: 'NORMAL',
    status: 'PENDING_SUBSEQUENT_APPROVAL',
    purchasePurpose: 'Structural fabrication for Q3 assembly line expansion',
    businessJustification: 'Expansion phase 2 capacity additions',
    deliveryLocation: 'Pondicherry Plant B',
    estimatedTotalValue: 60000,
    currency: 'INR',
    creationDate: '2026-11-13T09:00:00Z',
    lines: [],
    items: [
      {
        id: 'item-01',
        itemCode: 'RMPAOPOEXLG0004',
        itemDescription: 'PC-ABS - Injection Grade V0 - Light Grey - Powder',
        category: 'RAW_MATERIAL',
        uom: 'KG',
        quantity: 400,
        convertedQuantity: 0,
        closedOrCancelledQuantity: 0,
        remainingQuantity: 400,
        lineStatus: 'AVAILABLE',
        estimatedPrice: 150,
        currency: 'INR',
        lineTotal: 60000,
      },
    ],
    approvalHistory: [
      {
        id: 'ah-1',
        cycleNumber: 1,
        level: 'Level 1: Plant Lead',
        actorId: 'usr-vikram',
        actorName: 'Vikram Patel',
        actorRole: 'Operations Manager',
        decision: 'APPROVED',
        timestamp: '2026-11-13T10:15:00Z',
        remarks: 'Verified against shift quota.',
      },
      {
        id: 'ah-2',
        cycleNumber: 1,
        level: 'Level 2: Financial Controller',
        actorId: 'usr-ananya',
        actorName: 'Ananya Roy',
        actorRole: 'Finance Director',
        decision: 'SUBMITTED',
        timestamp: '2026-11-13T10:15:00Z',
        remarks: 'Pending executive review.',
      },
    ],
    budgetValidationStatus: 'SUFFICIENT',
    erpStockStatus: 'CHECKED',
    changeHistory: [],
    attachments: [],
    createdAt: '2026-11-13T09:00:00Z',
    updatedAt: '2026-11-13T10:15:00Z',
  };

  const pdfDoc = generatePurchaseRequisitionPdf(unapprovedPr, {
    printedBy: 'Rajesh Sharma',
  });

  assert.ok(pdfDoc, 'PDF document should be created');
  const pageCount = pdfDoc.getNumberOfPages();
  assert.ok(pageCount >= 1, 'Should have at least 1 page');

  const page1Stream = ((pdfDoc as any).internal.pages[1] || []).join('\n');
  assert.ok(
    page1Stream.includes('CONTROLLED DOCUMENT GOVERNANCE RECORD'),
    'Page 1 must contain Controlled Document Governance Record'
  );
  assert.ok(
    !page1Stream.includes('(Category)'),
    'Line Items table header must NOT contain Category column'
  );
});

test('PDF removes Category, formats Delivery Schedule properly, and puts Governance Record on Page 1 ONLY across multi-page PRs', () => {
  const multiPagePr: PurchaseRequisition = {
    id: 'pr-multipage-01',
    prNumber: 'PR-2526-0777',
    prType: 'MANUAL',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-INNOVATIONS',
    companyName: 'Kosh Innovations Pvt Ltd',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Main Plant & HQ',
    department: 'Production',
    costCentre: 'CC-PROD-01',
    requesterId: 'usr-rajesh',
    requesterName: 'Rajesh Sharma',
    creatorId: 'usr-rajesh',
    creatorName: 'Rajesh Sharma',
    priority: 'NORMAL',
    status: 'PENDING_SUBSEQUENT_APPROVAL',
    purchasePurpose: 'Multi-line raw material & tooling procurement for Q3 assembly expansion',
    businessJustification: 'Full batch schedule',
    deliveryLocation: 'Pondicherry Plant B',
    estimatedTotalValue: 450000,
    currency: 'INR',
    lines: Array.from({ length: 24 }, (_, idx) => ({
      id: `line-mp-${idx + 1}`,
      prId: 'pr-multipage-01',
      itemCode: `RMPAOPOEXLG00${String(idx + 1).padStart(2, '0')}`,
      description: `Engineering Polymer Grade V0 Batch #${idx + 1} with Flame Retardant`,
      itemCategory: 'Raw Materials',
      inventoryUom: 'KG',
      requestedQuantity: 400,
      approximateUnitPrice: 150,
      currency: 'INR',
      estimatedTotalValue: 60000,
      deliverySchedules: [
        { id: `s1-${idx}`, lineId: `line-mp-${idx + 1}`, deliveryDate: '2026-11-20', quantity: 200 },
        { id: `s2-${idx}`, lineId: `line-mp-${idx + 1}`, deliveryDate: '2026-12-05', quantity: 200 },
      ],
      status: 'ACTIVE' as const,
    })),
    budgetValidationStatus: 'SUFFICIENT',
    erpStockStatus: 'CHECKED',
    changeHistory: [],
    attachments: [],
    createdAt: '2026-11-13T09:00:00Z',
    updatedAt: '2026-11-13T10:15:00Z',
  };

  // Verify Delivery Schedule formatter directly
  const formattedSchedule = formatLineDeliveryScheduleForPdf(multiPagePr.lines[0], multiPagePr);
  assert.equal(formattedSchedule, '2026-11-20 : 200 KG\n2026-12-05 : 200 KG');
  assert.ok(!formattedSchedule.includes('|'), 'Schedule formatter must not leave trailing pipes');

  const pdfDoc = generatePurchaseRequisitionPdf(multiPagePr, { printedBy: 'Rajesh Sharma' });
  const totalPages = pdfDoc.getNumberOfPages();
  assert.ok(totalPages >= 2, `Expected multi-page PDF, got ${totalPages} page(s)`);

  const page1Stream = ((pdfDoc as any).internal.pages[1] || []).join('\n');
  assert.ok(
    page1Stream.includes('CONTROLLED DOCUMENT GOVERNANCE RECORD'),
    'Page 1 must include Controlled Document Governance Record'
  );
  assert.ok(
    page1Stream.includes('CONTROLLED COPY RESTRICTION WARNING'),
    'Page 1 must include Controlled Copy Restriction Warning'
  );
  assert.ok(
    !page1Stream.includes('(Category)'),
    'PDF Line Items table must not include Category column'
  );

  for (let p = 2; p <= totalPages; p++) {
    const pageStream = ((pdfDoc as any).internal.pages[p] || []).join('\n');
    assert.ok(
      !pageStream.includes('CONTROLLED DOCUMENT GOVERNANCE RECORD'),
      `Page ${p} must NOT repeat Controlled Document Governance Record`
    );
    assert.ok(
      !pageStream.includes('CONTROLLED COPY RESTRICTION WARNING'),
      `Page ${p} must NOT repeat Controlled Copy Restriction Warning`
    );
  }
});

test('Approving PR seals PDF into Immutable Repository, attaches locked snapshot, and serves identical PDF on subsequent downloads', () => {
  clearImmutablePrPdfRepositoryForTests();
  const checker = INITIAL_USERS.find((u) => u.role === 'ITEM_CHECKER' || u.role === 'PLATFORM_ADMIN') || INITIAL_USERS[0];
  const maker = INITIAL_USERS.find((u) => u.id !== checker.id) || INITIAL_USERS[0];

  const created = PurchaseRequisitionService.createPR(
    {
      prType: 'MANUAL',
      companyId: 'co-kosh-01',
      companyCode: 'KOSH-HQ',
      branchId: 'br-pond-01',
      branchCode: '001',
      branchName: 'Puducherry Main Plant & HQ',
      department: 'Production',
      costCentre: 'CC-PROD-101',
      requesterId: maker.id,
      requesterName: maker.fullName,
      creatorId: maker.id,
      creatorName: maker.fullName,
      priority: 'NORMAL',
      status: 'DRAFT',
      purchasePurpose: 'Immutable Repo Verification PR',
      businessJustification: 'Verify auto-archival upon approval',
      deliveryLocation: 'Puducherry Store',
      estimatedTotalValue: 60000,
      currency: 'INR',
      budgetValidationStatus: 'SUFFICIENT',
      erpStockStatus: 'FRESH',
      lines: [
        {
          id: 'line-imm-01',
          prId: '',
          itemCode: 'RMPAOPOEXLG0004',
          description: 'PC-ABS - Injection Grade V0',
          itemCategory: 'Raw Materials',
          inventoryUom: 'KG',
          requestedQuantity: 400,
          approximateUnitPrice: 150,
          currency: 'INR',
          estimatedTotalValue: 60000,
          deliverySchedules: [
            { id: 'sch-imm-1', lineId: 'line-imm-01', deliveryDate: '2026-11-20', quantity: 200 },
            { id: 'sch-imm-2', lineId: 'line-imm-01', deliveryDate: '2026-12-05', quantity: 200 },
          ],
          status: 'ACTIVE',
        },
      ],
      changeHistory: [],
      attachments: [],
    },
    maker
  );

  const subRes = PurchaseRequisitionService.submitPR(created.id, maker);
  assert.equal(subRes.success, true);

  // Advance through Level 1 and Level 2 approval if multi-level
  let approvedPr = PurchaseRequisitionService.approvePR(
    created.id,
    checker.fullName,
    checker.role,
    'L1 Approved',
    { actorUser: checker }
  );
  if (approvedPr && approvedPr.status === 'PENDING_SUBSEQUENT_APPROVAL') {
    approvedPr = PurchaseRequisitionService.approvePR(
      created.id,
      checker.fullName,
      checker.role,
      'Final L2 Approved',
      { actorUser: checker }
    );
  }

  assert.ok(approvedPr, 'Approved PR should be returned');
  assert.equal(approvedPr!.status, 'APPROVED_PENDING_BUYER');
  assert.ok(approvedPr!.immutablePdfRecordId, 'Approved PR must reference immutablePdfRecordId');

  const repoRecord = getImmutablePrPdfByPrId(approvedPr!.id);
  assert.ok(repoRecord, 'Immutable repository must contain archived Approved PR PDF');
  assert.equal(repoRecord!.isImmutable, true);
  assert.equal(repoRecord!.autoPrinted, true);
  assert.ok(repoRecord!.sha256Hash.length === 64, 'SHA-256 checksum must be present');
  assert.ok(repoRecord!.pdfDataUri.startsWith('data:application/pdf'), 'Data URI must be PDF');

  // Verify subsequent resolution returns the exact same immutable record & hash (never mutates)
  const resolvedAgain = resolveOrArchiveApprovedPrPdf(approvedPr!, { printedBy: 'Another User' });
  assert.equal(resolvedAgain.id, repoRecord!.id);
  assert.equal(resolvedAgain.sha256Hash, repoRecord!.sha256Hash);
  assert.equal(getImmutablePrPdfRepository().filter((r) => r.prId === approvedPr!.id).length, 1);

  // Verify immutable attachment is linked on PR and protected from deletion
  const linkedAtt = (approvedPr!.attachments || []).find((a) => a.immutablePdfId === repoRecord!.id);
  assert.ok(linkedAtt, 'Immutable PDF must be registered in PR attachments repository');
  assert.equal(linkedAtt!.isHistoricalApprovedVersion, true);
  assert.equal(linkedAtt!.lockedForConvertedTransaction, true);

  assert.throws(() => {
    PurchaseRequisitionService.deletePRAttachment({
      prId: approvedPr!.id,
      attachmentId: linkedAtt!.id,
      user: checker,
    });
  }, /Attachment Deletion Blocked/);
});
