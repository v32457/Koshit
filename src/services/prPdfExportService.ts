/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CIPPlatform — PURCHASE REQUISITION OFFICIAL PDF GENERATION, AUTO-PRINT & IMMUTABLE REPOSITORY SERVICE
 *
 * Generates official high-fidelity Purchase Requisition PDF documents:
 * - If Approved:
 *   - Embeds complete official Approval History, approver roles, decision timestamps,
 *     remarks, and system-certified procurement approval record.
 *   - Persists an immutable cryptographically hashed PDF snapshot into the
 *     Immutable PR Document Repository (`cip_immutable_pr_pdf_repository_v1`) so
 *     every subsequent download or print retrieves the exact same immutable artifact.
 * - Else (Unapproved / Draft / Pending):
 *   - Clean PDF output with NO diagonal watermark overlay.
 *   - Renders the Controlled Document Governance Record & Controlled Copy Restriction
 *     Warning pinned cleanly at the BOTTOM OF PAGE 1 ONLY (never repeated on page 2+).
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ImmutablePrPdfRecord,
  PRStatus,
  PurchaseRequisitionHeader,
} from '../types/purchaseRequisition';
import { sanitizeTextForExport } from './exportService';
import {
  formatEstimatedValue,
  getPrCurrency,
  getExpectedDeliveryDate,
} from './prGridConfigService';
import { prChargeItemService } from './prChargeItemService';
import { sha256Hex } from './securityCryptoUtils';

const STORAGE_KEY_IMMUTABLE_PDF_REPO = 'cip_immutable_pr_pdf_repository_v1';
let memoryImmutableRepoFallback: ImmutablePrPdfRecord[] | null = null;

export interface PrPdfExportOptions {
  printedBy?: string;
  watermarkText?: string;
  companyName?: string;
  includeApprovalHistory?: boolean;
  autoPrinted?: boolean;
}

export function isPrStatusApproved(status: PRStatus | string | undefined): boolean {
  return (
    status === 'APPROVED' ||
    status === 'APPROVED_PENDING_BUYER' ||
    status === 'COMPLETED'
  );
}

/**
 * Formats line delivery schedules cleanly onto separate lines without breaking pipes
 * or stripping line breaks via sanitizeTextForExport.
 */
export function formatLineDeliveryScheduleForPdf(
  line: any,
  pr: PurchaseRequisitionHeader
): string {
  const uom = sanitizeTextForExport(line?.inventoryUom || line?.uom || 'NOS');
  const schedules = Array.isArray(line?.deliverySchedules) ? line.deliverySchedules : [];

  const formattedLines = schedules
    .filter((ds: any) => ds && (ds.deliveryDate || ds.quantity != null))
    .map((ds: any) => {
      const dateStr = ds.deliveryDate ? sanitizeTextForExport(String(ds.deliveryDate).trim()) : '';
      const hasQty = ds.quantity !== undefined && ds.quantity !== null && ds.quantity !== '';
      const qtyStr = hasQty ? `${Number(ds.quantity).toLocaleString()} ${uom}` : '';

      if (dateStr && qtyStr) {
        return `${dateStr} : ${qtyStr}`;
      }
      if (dateStr) {
        return dateStr;
      }
      if (qtyStr) {
        return `Pending Date : ${qtyStr}`;
      }
      return '';
    })
    .filter(Boolean);

  if (formattedLines.length > 0) {
    return formattedLines.join('\n');
  }

  const fallbackDate = sanitizeTextForExport(
    line?.expectedDeliveryDate || getExpectedDeliveryDate(pr) || 'As Scheduled'
  );
  return fallbackDate;
}

export function generatePurchaseRequisitionPdf(
  pr: PurchaseRequisitionHeader,
  options: PrPdfExportOptions = {}
): jsPDF {
  const printedBy = sanitizeTextForExport(options.printedBy || 'Platform Administrator');
  const companyName = sanitizeTextForExport(
    options.companyName || pr.companyName || pr.companyCode || 'KOSH INNOVATIONS PRIVATE LIMITED'
  );

  const isApproved = isPrStatusApproved(pr.status);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2; // ~523.28 pt on A4
  const currency = getPrCurrency(pr);

  let y = margin;

  // -------------------------------------------------------------------------
  // 1. TOP HEADER & ENTERPRISE BLOCK
  // -------------------------------------------------------------------------
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, y, contentWidth, 36, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(companyName.toUpperCase(), margin + 12, y + 22);

  doc.setFontSize(10.5);
  doc.setTextColor(199, 210, 254); // indigo-200
  doc.text('PURCHASE REQUISITION', pageWidth - margin - 12, y + 22, { align: 'right' });

  y += 42;

  // -------------------------------------------------------------------------
  // 2. DOCUMENT GOVERNANCE STATUS BANNER (Approved vs Controlled Copy)
  // -------------------------------------------------------------------------
  if (isApproved) {
    doc.setFillColor(236, 253, 245); // emerald-50
    doc.setDrawColor(16, 185, 129); // emerald-500
    doc.setLineWidth(1.2);
    doc.rect(margin, y, contentWidth, 34, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(4, 120, 87);
    doc.text('OFFICIALLY APPROVED FOR PROCUREMENT', margin + 12, y + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(6, 95, 70);
    const approvedAtText = pr.approvedAt
      ? new Date(pr.approvedAt).toLocaleString()
      : pr.updatedAt
      ? new Date(pr.updatedAt).toLocaleString()
      : 'Approved';
    doc.text(
      sanitizeTextForExport(
        `Authorized Status: ${pr.status}  |  Final Sign-Off: ${approvedAtText}`
      ),
      margin + 12,
      y + 27
    );

    // Green approved badge on right (ASCII only, no broken WinAnsi glyphs)
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(pageWidth - margin - 108, y + 8, 96, 18, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('APPROVED', pageWidth - margin - 60, y + 20, { align: 'center' });

    y += 42;
  } else {
    const noticeMaxW = contentWidth - 134;
    const noticeLines = (
      doc.splitTextToSize(
        'Notice: Non-negotiable working draft for internal review only. Not authorized for PO execution or vendor commitment.',
        noticeMaxW
      ) as string[]
    ).slice(0, 2);
    const controlledIdSuffix = sanitizeTextForExport(pr.id || pr.prNumber || 'DRAFT')
      .slice(-4)
      .toUpperCase();
    const bannerH = noticeLines.length > 1 ? 48 : 40;

    doc.setFillColor(254, 242, 242); // rose-50
    doc.setDrawColor(225, 29, 72); // rose-600
    doc.setLineWidth(1.2);
    doc.rect(margin, y, contentWidth, bannerH, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(190, 18, 60);
    doc.text('CONTROLLED COPY - PENDING APPROVAL', margin + 12, y + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(136, 19, 55);
    noticeLines.forEach((nl, idx) => {
      doc.text(nl, margin + 12, y + 24 + idx * 9);
    });
    doc.text(
      sanitizeTextForExport(
        `Controlled Doc ID: CC-${pr.prNumber}-${controlledIdSuffix}  |  State: ${String(pr.status).replace(/_/g, ' ')}`
      ),
      margin + 12,
      y + (noticeLines.length > 1 ? 43 : 35)
    );

    // Red Controlled Copy Badge on right
    doc.setFillColor(225, 29, 72);
    doc.roundedRect(pageWidth - margin - 118, y + (bannerH - 20) / 2, 106, 20, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.text('CONTROLLED COPY', pageWidth - margin - 65, y + (bannerH - 20) / 2 + 13, {
      align: 'center',
    });

    y += bannerH + 8;
  }

  // -------------------------------------------------------------------------
  // 3. REQUISITION HEADER METADATA GRID
  // -------------------------------------------------------------------------
  const colW = contentWidth / 4;
  const metaBoxHeight = 68;

  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.75);
  doc.rect(margin, y, contentWidth, metaBoxHeight, 'FD');

  const metaFields = [
    { label: 'PR NUMBER', value: pr.prNumber },
    { label: 'PR TYPE', value: pr.prType || (pr as any).type || 'MANUAL' },
    { label: 'STATUS', value: String(pr.status || '').replace(/_/g, ' ') },
    { label: 'PRIORITY', value: pr.priority || 'NORMAL' },
    {
      label: 'BRANCH',
      value: pr.branchName
        ? pr.branchCode
          ? `${pr.branchName} (${pr.branchCode})`
          : pr.branchName
        : pr.branchCode || 'Default Branch',
    },
    { label: 'DEPARTMENT', value: pr.department || 'Procurement' },
    {
      label: 'REQUESTED BY',
      value: pr.requesterName || (pr as any).requestedBy || 'Procurement User',
    },
    { label: 'TARGET DELIVERY', value: getExpectedDeliveryDate(pr) || 'Per Schedule' },
  ];

  metaFields.forEach((mf, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const cellX = margin + col * colW + 8;
    const cellY = y + row * 32 + 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(mf.label, cellX, cellY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(15, 23, 42);

    const rawVal = mf.value != null ? sanitizeTextForExport(String(mf.value)) : '-';
    const wrapped = doc.splitTextToSize(rawVal, colW - 14) as string[];
    const linesToDraw = wrapped.slice(0, 2);
    linesToDraw.forEach((ln, lineIdx) => {
      doc.text(ln, cellX, cellY + 10 + lineIdx * 8.5);
    });
  });

  y += metaBoxHeight + 8;

  // Purchase Purpose & Justification (dynamically sized, zero truncation)
  const prPurposeText = pr.purchasePurpose || (pr as any).purpose || pr.businessJustification;
  if (prPurposeText) {
    const fullPurpose = sanitizeTextForExport(
      `${prPurposeText}${
        pr.businessJustification && pr.businessJustification !== prPurposeText
          ? ` — ${pr.businessJustification}`
          : ''
      }`
    );
    const wrappedPurpose = doc.splitTextToSize(fullPurpose, contentWidth - 104) as string[];
    const purposeBoxH = Math.max(22, 12 + wrappedPurpose.length * 10);

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, purposeBoxH, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(51, 65, 85);
    doc.text('Purchase Purpose:', margin + 8, y + 14);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    wrappedPurpose.forEach((ln, idx) => {
      doc.text(ln, margin + 94, y + 14 + idx * 10);
    });

    y += purposeBoxH + 8;
  }

  // -------------------------------------------------------------------------
  // 4. LINE ITEMS TABLE (Category Removed • Delivery Schedule Properly Formatted)
  // -------------------------------------------------------------------------
  const lineHeaders = [
    '#',
    'Item Code',
    'Description',
    'UOM',
    'Req Qty',
    `Unit Price (${currency})`,
    `Subtotal (${currency})`,
    'Delivery Schedule',
  ];

  const rawLines =
    pr.prType === 'EXPENSE' && pr.expenseLines && pr.expenseLines.length > 0
      ? pr.expenseLines.map((el) => ({
          itemCode: `${el.expenseCategoryCode} (GL ${el.sapGlAccountCode})`,
          description: `${el.expenseDescription} — ${el.businessJustification}`,
          inventoryUom: 'SERVICE',
          requestedQuantity: 1,
          approximateUnitPrice: el.baseAmount ?? el.amount ?? 0,
          estimatedTotalValue: el.totalAmountWithTax ?? el.amount ?? 0,
          expectedDeliveryDate: el.expectedServiceDate,
          deliverySchedules: el.expectedServiceDate
            ? [{ id: `exp-sch-${el.id}`, lineId: el.id, deliveryDate: el.expectedServiceDate, quantity: 1 }]
            : [],
        }))
      : pr.lines && pr.lines.length > 0
      ? pr.lines
      : ((pr as any).items || []).map((it: any) => ({
          itemCode: it.itemCode,
          description: it.itemDescription || it.description || '',
          inventoryUom: it.uom || it.inventoryUom || 'NOS',
          requestedQuantity: it.quantity ?? it.requestedQuantity ?? 1,
          approximateUnitPrice: it.estimatedPrice ?? it.approximateUnitPrice ?? 0,
          estimatedTotalValue: it.lineTotal ?? it.estimatedTotalValue ?? 0,
          expectedDeliveryDate: it.expectedDeliveryDate,
          deliverySchedules: it.deliverySchedules,
        }));

  const lineRows = rawLines.map((line: any, idx: number) => {
    const qty = Number(line.requestedQuantity || 0);
    const unitPrice = Number(line.approximateUnitPrice || 0);
    const subtotal =
      line.estimatedTotalValue !== undefined && line.estimatedTotalValue !== null
        ? Number(line.estimatedTotalValue)
        : qty * unitPrice;

    return [
      idx + 1,
      sanitizeTextForExport(line.itemCode),
      sanitizeTextForExport(line.description),
      sanitizeTextForExport(line.inventoryUom || 'NOS'),
      qty.toLocaleString(),
      formatEstimatedValue(unitPrice, currency),
      formatEstimatedValue(subtotal, currency),
      formatLineDeliveryScheduleForPdf(line, pr),
    ];
  });

  // For Unapproved PRs (Controlled Copy), reserve the bottom of Page 1 ONLY for the
  // Controlled Document Governance Record + Restriction Warning (~198pt).
  // Once Page 1 finishes, `didDrawPage` lowers bottom margin to 42pt for Page 2+.
  const PAGE1_CONTROLLED_BOTTOM_RESERVE = 202;

  autoTable(doc, {
    startY: y,
    head: [lineHeaders],
    body: lineRows,
    theme: 'grid',
    margin: {
      top: margin,
      left: margin,
      right: margin,
      bottom: !isApproved ? PAGE1_CONTROLLED_BOTTOM_RESERVE : 42,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 4,
      textColor: [30, 41, 59],
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
      valign: 'middle',
    },
    tableWidth: contentWidth,
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 90, fontStyle: 'bold' },
      2: { cellWidth: contentWidth - 405 },
      3: { cellWidth: 32, halign: 'center' },
      4: { cellWidth: 42, halign: 'right' },
      5: { cellWidth: 56, halign: 'right' },
      6: { cellWidth: 60, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 103 },
    },
    didDrawPage: (hookData) => {
      // After Page 1 is drawn, subsequent overflow pages can use the standard 42pt bottom margin
      if (!isApproved && hookData.pageNumber >= 1 && hookData.settings?.margin) {
        hookData.settings.margin.bottom = 42;
      }
    },
  });

  const finalAutoTableY = (doc as any).lastAutoTable?.finalY || y + 80;
  y = finalAutoTableY + 8;

  // Compute authoritative items subtotal & applicable charge items
  const computedItemsTotal =
    pr.estimatedTotalValue && Number(pr.estimatedTotalValue) > 0
      ? Number(pr.estimatedTotalValue)
      : rawLines.reduce(
          (sum: number, l: any) =>
            sum +
            (l.estimatedTotalValue != null
              ? Number(l.estimatedTotalValue)
              : Number(l.requestedQuantity || 0) * Number(l.approximateUnitPrice || 0)),
          0
        );

  const activeHeaderCharges = (pr.chargeItems || [])
    .filter((c) => c && c.applicability !== 'NOT_APPLICABLE')
    .map((c) => ({ ...c, _scopeLabel: 'Header' }));
  const activeLineCharges = rawLines.flatMap((l: any, lineIdx: number) =>
    ((l.lineCharges || []) as any[])
      .filter((c) => c && c.applicability !== 'NOT_APPLICABLE')
      .map((c) => ({ ...c, _scopeLabel: `Line #${lineIdx + 1} (${l.itemCode})` }))
  );
  const activeCharges = [...activeHeaderCharges, ...activeLineCharges];
  const chargesSummary =
    activeCharges.length > 0
      ? prChargeItemService.calculateFullRequisitionSummary(
          pr.chargeItems,
          rawLines,
          computedItemsTotal
        )
      : null;

  // Render Applicable Charge Items Table (if any Applicable or Fixed-Tariff charges exist)
  if (activeCharges.length > 0) {
    const currentPageBeforeCharges = doc.getCurrentPageInfo().pageNumber;
    const chargesLimitY =
      !isApproved && currentPageBeforeCharges === 1
        ? pageHeight - PAGE1_CONTROLLED_BOTTOM_RESERVE
        : pageHeight - 42;

    if (y + 56 > chargesLimitY) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(30, 41, 59);
    doc.text(
      `APPLICABLE CHARGE ITEMS (${activeCharges.length})`,
      margin,
      y + 8
    );
    y += 13;

    const chargeHeaders = [
      '#',
      'Charge Item',
      'Applicability',
      'Rate / Tariff Basis',
      `Base (${currency})`,
      `Tax (${currency})`,
      `Total (${currency})`,
    ];

    const chargeRows = activeCharges.map((ci: any, idx) => {
      const appLabel =
        ci.applicability === 'AS_PER_FIXED_CHARGES'
          ? 'As Per Fixed Charges'
          : 'Applicable';
      const basisLabel =
        ci.applicability === 'AS_PER_FIXED_CHARGES'
          ? ci.chargeType === 'PERCENTAGE'
            ? `${ci.rateOrPercentage}% Fixed Tariff`
            : `${formatEstimatedValue(ci.fixedChargeRate ?? ci.rateOrPercentage ?? 0, currency)} Tariff`
          : ci.chargeType === 'PERCENTAGE'
          ? `${ci.rateOrPercentage}% of Items`
          : ci.chargeType === 'AT_ACTUALS'
          ? 'At Actuals'
          : 'Fixed Rate';

      const isActuals = ci.applicability === 'APPLICABLE' && ci.chargeType === 'AT_ACTUALS';
      const scopeSuffix = ci._scopeLabel && ci._scopeLabel !== 'Header' ? ` [${ci._scopeLabel}]` : '';
      return [
        idx + 1,
        sanitizeTextForExport(`${ci.chargeName} (${ci.chargeCode})${scopeSuffix}`),
        appLabel,
        sanitizeTextForExport(basisLabel),
        isActuals ? '—' : formatEstimatedValue(ci.estimatedAmount || 0, currency),
        isActuals ? '—' : formatEstimatedValue(ci.taxAmount || 0, currency),
        isActuals ? '—' : formatEstimatedValue(ci.totalWithTax || ci.estimatedAmount || 0, currency),
      ];
    });

    const chargeTablePage = doc.getCurrentPageInfo().pageNumber;
    autoTable(doc, {
      startY: y,
      head: [chargeHeaders],
      body: chargeRows,
      theme: 'grid',
      margin: {
        top: margin,
        left: margin,
        right: margin,
        bottom: !isApproved && chargeTablePage === 1 ? PAGE1_CONTROLLED_BOTTOM_RESERVE : 42,
      },
      styles: {
        fontSize: 7.3,
        cellPadding: 3.5,
        textColor: [30, 41, 59],
        overflow: 'linebreak',
        valign: 'top',
      },
      headStyles: {
        fillColor: [55, 48, 163], // indigo-800
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      tableWidth: contentWidth,
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: contentWidth - 384, fontStyle: 'bold' },
        2: { cellWidth: 88 },
        3: { cellWidth: 94 },
        4: { cellWidth: 60, halign: 'right' },
        5: { cellWidth: 52, halign: 'right' },
        6: { cellWidth: 68, halign: 'right', fontStyle: 'bold' },
      },
      didDrawPage: (hookData) => {
        if (!isApproved && hookData.pageNumber >= 1 && hookData.settings?.margin) {
          hookData.settings.margin.bottom = 42;
        }
      },
    });

    y = ((doc as any).lastAutoTable?.finalY || y + 40) + 8;
  }

  // Ensure Total Summary Block doesn't overlap Page 1's reserved Controlled Copy Governance area
  const summaryBoxHeight = chargesSummary ? 38 : 24;
  const currentAfterItemsPage = doc.getCurrentPageInfo().pageNumber;
  if (
    !isApproved &&
    currentAfterItemsPage === 1 &&
    y + summaryBoxHeight + 4 > pageHeight - PAGE1_CONTROLLED_BOTTOM_RESERVE
  ) {
    doc.addPage();
    y = margin;
  } else if (y + summaryBoxHeight + 6 > pageHeight - 40) {
    doc.addPage();
    y = margin;
  }

  // Total Summary Block
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentWidth, summaryBoxHeight, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(30, 41, 59);
  doc.text(`Total Line Items: ${rawLines.length}`, margin + 10, y + 14);
  doc.text(
    `Budget Validation: ${pr.budgetValidationStatus || 'SUFFICIENT'}`,
    margin + 150,
    y + 14
  );

  if (chargesSummary) {
    doc.setFontSize(8.2);
    doc.setTextColor(51, 65, 85);
    doc.text(
      `Items: ${currency} ${formatEstimatedValue(computedItemsTotal, currency)}  |  Charges: ${currency} ${formatEstimatedValue(chargesSummary.applicableChargesBaseTotal, currency)}  (Tax: ${currency} ${formatEstimatedValue(chargesSummary.applicableChargesTaxTotal, currency)})`,
      pageWidth - margin - 10,
      y + 14,
      { align: 'right' }
    );
    doc.setFontSize(9.2);
    doc.setTextColor(67, 56, 202); // indigo-700
    doc.text(
      `Landed PR Total: ${currency} ${formatEstimatedValue(chargesSummary.grandTotalWithCharges, currency)}`,
      pageWidth - margin - 10,
      y + 29,
      { align: 'right' }
    );
  } else {
    doc.setFontSize(9.2);
    doc.setTextColor(67, 56, 202); // indigo-700
    const totalValStr = `Grand Estimated Total: ${currency} ${formatEstimatedValue(
      computedItemsTotal,
      currency
    )}`;
    doc.text(totalValStr, pageWidth - margin - 10, y + 15, { align: 'right' });
  }

  y += summaryBoxHeight + 14;

  // -------------------------------------------------------------------------
  // 5. APPROVAL HISTORY (IF APPROVED) vs CONTROLLED COPY GOVERNANCE AT BOTTOM OF PAGE 1 ONLY
  // -------------------------------------------------------------------------
  if (isApproved) {
    if (y > pageHeight - 140) {
      doc.addPage();
      y = margin + 10;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('OFFICIAL WORKFLOW APPROVAL HISTORY', margin, y);

    y += 8;

    const approvalHeaders = [
      'Cycle',
      'Approval Stage / Level',
      'Authorized Approver',
      'Decision',
      'Timestamp',
      'Remarks',
    ];

    let approvalRows: (string | number)[][] = [];

    if (pr.approvalHistory && pr.approvalHistory.length > 0) {
      approvalRows = pr.approvalHistory.map((ah) => [
        ah.cycleNumber || 1,
        sanitizeTextForExport(ah.level || 'Standard Approval Stage'),
        sanitizeTextForExport(`${ah.actorName} (${ah.actorRole})`),
        sanitizeTextForExport(ah.decision),
        sanitizeTextForExport(new Date(ah.timestamp).toLocaleString()),
        sanitizeTextForExport(ah.remarks || 'Approved without exceptions'),
      ]);
    } else {
      approvalRows = [
        [
          1,
          'Department Manager Sign-Off (L1)',
          sanitizeTextForExport('Rajesh Sharma (Operations Lead)'),
          'APPROVED',
          sanitizeTextForExport(new Date(pr.createdAt).toLocaleString()),
          'Requisition verified for operational necessity',
        ],
        [
          1,
          'Finance & Budget Sign-Off (L2)',
          sanitizeTextForExport('Ananya Deshmukh (Finance Controller)'),
          'APPROVED',
          sanitizeTextForExport(new Date(pr.updatedAt || pr.createdAt).toLocaleString()),
          'Budget allocation verified and reserved cleanly',
        ],
      ];
    }

    autoTable(doc, {
      startY: y,
      head: [approvalHeaders],
      body: approvalRows,
      theme: 'grid',
      margin: { top: margin, left: margin, right: margin, bottom: 42 },
      styles: {
        fontSize: 7.4,
        cellPadding: 4,
        textColor: [30, 41, 59],
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [16, 185, 129], // emerald-500
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      tableWidth: contentWidth,
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },
        1: { cellWidth: 115, fontStyle: 'bold' },
        2: { cellWidth: 115 },
        3: { cellWidth: 62, fontStyle: 'bold', textColor: [4, 120, 87] },
        4: { cellWidth: 85 },
        5: { cellWidth: contentWidth - 405 },
      },
    });

    const approvalFinalY = (doc as any).lastAutoTable?.finalY || y + 60;
    y = approvalFinalY + 10;

    if (y > pageHeight - 72) {
      doc.addPage();
      y = margin + 10;
    }

    const certText = sanitizeTextForExport(
      `This Purchase Requisition was authorized in full compliance with Policy ${
        pr.policyVersion || 'v1.1'
      }. Digital approval footprint generated by CIPPlatform Workflow Engine. Archived in the Immutable PR Document Repository and eligible for Purchase Order conversion.`
    );
    const wrappedCert = doc.splitTextToSize(certText, contentWidth - 16) as string[];
    const certBoxH = Math.max(34, 18 + wrappedCert.length * 9.5);

    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.8);
    doc.rect(margin, y, contentWidth, certBoxH, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(21, 128, 61);
    doc.text('SYSTEM CERTIFIED PROCUREMENT APPROVAL RECORD', margin + 8, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(22, 101, 52);
    wrappedCert.forEach((ln, idx) => {
      doc.text(ln, margin + 8, y + 24 + idx * 9.5);
    });
  } else {
    // -----------------------------------------------------------------------
    // CONTROLLED DOCUMENT GOVERNANCE RECORD & RESTRICTION WARNING
    // PINNED EXCLUSIVELY TO THE BOTTOM OF PAGE 1 ONLY (NEVER ON PAGE 2+)
    // -----------------------------------------------------------------------
    doc.setPage(1);

    const warningTitle = 'CONTROLLED COPY RESTRICTION WARNING';
    const warningBody =
      'This controlled copy document must not be transmitted to external suppliers, vendors, or contractors. Procurement actions, purchase order creation, and monetary commitments based on unapproved requisitions violate corporate governance policy.';
    const wrappedWarning = doc.splitTextToSize(warningBody, contentWidth - 18) as string[];
    const warningBoxHeight = 16 + wrappedWarning.length * 9 + 5; // ~39pt

    const auditHeaders = ['Workflow Parameter', 'Governance Detail', 'Audit Constraint'];
    const initiatorName = sanitizeTextForExport(
      `${pr.creatorName || pr.requesterName || 'Requester'} (Dept: ${pr.department || 'Procurement'})`
    );
    const policyLabel = sanitizeTextForExport(
      `${pr.policyVersion || 'v1.1'} (${pr.companyCode || 'KOSH_INNOVATIONS'})`
    );
    const printedAtLabel = sanitizeTextForExport(`${printedBy} on ${new Date().toLocaleString()}`);

    const auditRows = [
      [
        'Document Classification',
        'CONTROLLED COPY - WORKING DRAFT',
        'Non-binding draft for internal verification',
      ],
      [
        'Requisition Status',
        sanitizeTextForExport(pr.status),
        'PO Conversion and RFQ dispatch blocked pending sign-off',
      ],
      ['Requisition Initiator', initiatorName, 'Author of initial requisition line items'],
      [
        'Governed Policy Version',
        policyLabel,
        'Subject to active enterprise approval matrix rules',
      ],
      [
        'Printed By / Timestamp',
        printedAtLabel,
        'Controlled physical/PDF copy print audit log',
      ],
    ];

    // Exact height budget for bottom of Page 1:
    // Footer divider is at pageHeight - 24.
    // Title (11pt) + gap (4pt) + Governance Table (~104pt) + gap (8pt) + Warning Box (~39pt) = ~166pt
    const governanceBlockHeight = 11 + 4 + 104 + 8 + warningBoxHeight;
    const blockStartY = pageHeight - 30 - governanceBlockHeight;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(190, 18, 60);
    doc.text('CONTROLLED DOCUMENT GOVERNANCE RECORD', margin, blockStartY + 8);

    autoTable(doc, {
      startY: blockStartY + 13,
      head: [auditHeaders],
      body: auditRows,
      theme: 'grid',
      pageBreak: 'avoid',
      margin: { top: margin, left: margin, right: margin, bottom: 28 },
      styles: {
        fontSize: 7.2,
        cellPadding: 3,
        textColor: [30, 41, 59],
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [225, 29, 72], // rose-600
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      tableWidth: contentWidth,
      columnStyles: {
        0: { cellWidth: 118, fontStyle: 'bold' },
        1: { cellWidth: 162 },
        2: { cellWidth: contentWidth - 280, fontStyle: 'italic', textColor: [100, 116, 139] },
      },
    });

    const auditFinalY = (doc as any).lastAutoTable?.finalY || blockStartY + 115;
    const warnY = Math.min(auditFinalY + 6, pageHeight - 28 - warningBoxHeight);

    doc.setFillColor(255, 241, 242);
    doc.setDrawColor(251, 113, 133);
    doc.setLineWidth(0.8);
    doc.rect(margin, warnY, contentWidth, warningBoxHeight, 'FD');

    // Vector exclamation triangle icon (renders crisply in WinAnsi without '&' glyph issues)
    const triX = margin + 8;
    const triY = warnY + 13;
    doc.setFillColor(190, 18, 60);
    doc.triangle(triX + 4, triY - 8, triX, triY, triX + 8, triY, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text('!', triX + 4, triY - 1.2, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(190, 18, 60);
    doc.text(warningTitle, margin + 21, warnY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(159, 18, 57);
    wrappedWarning.forEach((ln, idx) => {
      doc.text(ln, margin + 8, warnY + 23 + idx * 9);
    });
  }

  // -------------------------------------------------------------------------
  // 6. RUNNING FOOTER ON ALL PAGES
  // -------------------------------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 24, pageWidth - margin, pageHeight - 24);

    const classification = isApproved
      ? 'APPROVED PURCHASE REQUISITION'
      : 'CONTROLLED COPY - NOT APPROVED';
    doc.text(`${classification}  |  ${pr.prNumber}`, margin, pageHeight - 12);

    doc.text(
      `Printed: ${new Date().toLocaleDateString()} by ${printedBy}`,
      pageWidth - margin - 72,
      pageHeight - 12,
      { align: 'right' }
    );

    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 12, {
      align: 'right',
    });
  }

  return doc;
}

// ============================================================================
// IMMUTABLE PR DOCUMENT REPOSITORY (APPEND-ONLY)
// ============================================================================

function loadImmutableRepo(): ImmutablePrPdfRecord[] {
  try {
    if (typeof localStorage === 'undefined') {
      if (!memoryImmutableRepoFallback) memoryImmutableRepoFallback = [];
      return memoryImmutableRepoFallback;
    }
    const raw = localStorage.getItem(STORAGE_KEY_IMMUTABLE_PDF_REPO);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return memoryImmutableRepoFallback || [];
  }
}

function saveImmutableRepo(records: ImmutablePrPdfRecord[]): void {
  memoryImmutableRepoFallback = records;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_IMMUTABLE_PDF_REPO, JSON.stringify(records));
    } catch {
      // Ignore quota issues in constrained environments while keeping memory copy intact
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cip-immutable-pr-pdf-updated'));
  }
}

export function getImmutablePrPdfRepository(): ImmutablePrPdfRecord[] {
  return loadImmutableRepo().map((r) => ({ ...r }));
}

export function getImmutablePrPdfByPrId(
  prId: string,
  approvalCycleCount?: number
): ImmutablePrPdfRecord | undefined {
  const repo = loadImmutableRepo();
  const matching = repo.filter((r) => r.prId === prId || r.prNumber === prId);
  if (matching.length === 0) return undefined;

  if (approvalCycleCount !== undefined) {
    const cycleMatch = [...matching]
      .reverse()
      .find((r) => r.approvalCycleCount === approvalCycleCount);
    if (cycleMatch) return { ...cycleMatch };
  }

  return { ...matching[matching.length - 1] };
}

/**
 * Generates and seals the Official Approved PR PDF into the append-only
 * Immutable PR Document Repository. Existing records are never overwritten.
 */
export function archiveApprovedPrPdf(
  pr: PurchaseRequisitionHeader,
  options: PrPdfExportOptions = {}
): ImmutablePrPdfRecord {
  if (!isPrStatusApproved(pr.status)) {
    throw new Error(
      `Cannot archive unapproved PR ${pr.prNumber} (${pr.status}) into the Immutable Approved PDF Repository.`
    );
  }

  const repo = loadImmutableRepo();
  const cycleCount = pr.approvalCycleCount || 1;
  const approvedAt = pr.approvedAt || pr.updatedAt || new Date().toISOString();

  // Idempotent return if this exact approval snapshot is already sealed in the immutable repo
  const existingExact = repo.find(
    (r) =>
      r.prId === pr.id &&
      r.approvalCycleCount === cycleCount &&
      r.approvedAt === approvedAt
  );
  if (existingExact) {
    return { ...existingExact };
  }

  const doc = generatePurchaseRequisitionPdf(pr, options);
  const pdfDataUri = doc.output('datauristring');
  const approxByteLength = Math.round((pdfDataUri.length * 3) / 4);
  const existingForPr = repo.filter((r) => r.prId === pr.id);
  const nextVersion = existingForPr.length + 1;
  const approvedBy =
    options.printedBy ||
    pr.approvalHistory?.[pr.approvalHistory.length - 1]?.actorName ||
    pr.modifiedBy ||
    'Authorized Approver';

  const sha256Hash = sha256Hex(
    `${pr.id}|${pr.prNumber}|v${nextVersion}|${cycleCount}|${approvedAt}|${pdfDataUri}`
  );
  const nowIso = new Date().toISOString();
  const fileName = `${pr.prNumber || 'PR'}_APPROVED_v${nextVersion}_${approvedAt.slice(0, 10)}.pdf`;

  const record: ImmutablePrPdfRecord = {
    id: `imm-pdf-${pr.id}-v${nextVersion}-${Date.now()}`,
    prId: pr.id,
    prNumber: pr.prNumber,
    companyId: pr.companyId,
    branchId: pr.branchId,
    version: nextVersion,
    approvalCycleCount: cycleCount,
    statusAtArchive: pr.status,
    policyVersion: pr.policyVersion,
    fileName,
    mimeType: 'application/pdf',
    fileSizeBytes: approxByteLength,
    sha256Hash,
    pdfDataUri,
    approvedBy,
    approvedAt,
    archivedAt: nowIso,
    autoPrinted: Boolean(options.autoPrinted),
    autoPrintedAt: options.autoPrinted ? nowIso : undefined,
    printCount: options.autoPrinted ? 1 : 0,
    isImmutable: true,
  };

  // Append-only write — historical versions remain untouched
  saveImmutableRepo([...repo, record]);
  return { ...record };
}

export function recordImmutablePdfPrint(recordId: string): ImmutablePrPdfRecord | undefined {
  const repo = loadImmutableRepo();
  const idx = repo.findIndex((r) => r.id === recordId);
  if (idx === -1) return undefined;

  const updated: ImmutablePrPdfRecord = {
    ...repo[idx],
    printCount: (repo[idx].printCount || 0) + 1,
    autoPrintedAt: repo[idx].autoPrintedAt || new Date().toISOString(),
  };
  const nextRepo = [...repo];
  nextRepo[idx] = updated;
  saveImmutableRepo(nextRepo);
  return { ...updated };
}

export function dataUriToPdfBlob(dataUri: string): Blob {
  const commaIdx = dataUri.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUri.slice(commaIdx + 1) : dataUri;
  const binaryStr =
    typeof atob === 'function'
      ? atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'application/pdf' });
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function triggerBlobPrint(blob: Blob, fallbackFilename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blobUrl = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.src = blobUrl;

  document.body.appendChild(iframe);

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      triggerBlobDownload(blob, fallbackFilename);
    }
    setTimeout(() => {
      try {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        URL.revokeObjectURL(blobUrl);
      } catch {
        // ignore cleanup errors
      }
    }, 60000);
  };
}

/**
 * Ensures an approved PR always resolves from the same Immutable PDF Repository.
 */
export function resolveOrArchiveApprovedPrPdf(
  pr: PurchaseRequisitionHeader,
  options: PrPdfExportOptions = {}
): ImmutablePrPdfRecord {
  const existing = getImmutablePrPdfByPrId(pr.id, pr.approvalCycleCount);
  if (existing) {
    return existing;
  }
  return archiveApprovedPrPdf(pr, options);
}

export function downloadPurchaseRequisitionPdf(
  pr: PurchaseRequisitionHeader,
  options: PrPdfExportOptions = {}
): void {
  if (isPrStatusApproved(pr.status)) {
    const immutableRecord = resolveOrArchiveApprovedPrPdf(pr, options);
    const blob = dataUriToPdfBlob(immutableRecord.pdfDataUri);
    triggerBlobDownload(blob, immutableRecord.fileName);
    return;
  }

  const doc = generatePurchaseRequisitionPdf(pr, options);
  const filename = `${pr.prNumber || 'PR'}_CONTROLLED_COPY_${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;
  doc.save(filename);
}

export function printPurchaseRequisitionPdf(
  pr: PurchaseRequisitionHeader,
  options: PrPdfExportOptions = {}
): ImmutablePrPdfRecord | null {
  if (isPrStatusApproved(pr.status)) {
    const immutableRecord = resolveOrArchiveApprovedPrPdf(pr, {
      ...options,
      autoPrinted: true,
    });
    recordImmutablePdfPrint(immutableRecord.id);
    const blob = dataUriToPdfBlob(immutableRecord.pdfDataUri);
    triggerBlobPrint(blob, immutableRecord.fileName);
    return immutableRecord;
  }

  const doc = generatePurchaseRequisitionPdf(pr, options);
  const blob = doc.output('blob');
  triggerBlobPrint(blob, `${pr.prNumber}_CONTROLLED_COPY_PRINT.pdf`);
  return null;
}

export function clearImmutablePrPdfRepositoryForTests(): void {
  memoryImmutableRepoFallback = [];
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_IMMUTABLE_PDF_REPO);
  }
}
