/**
 * KOSH INNOVATIONS — GOODS RECEIPT & INVENTORY UOM CONVERSION SERVICE
 * Captures Goods Receipt in Purchase UOM, performs authoritative Inventory UOM conversion,
 * updates inventory stock logs, and updates PO line fulfillment status.
 */

import { GoodsReceiptHeader, GoodsReceiptLine } from '../types/rfqSourcing';
import { purchaseOrderService } from './purchaseOrderService';
import { uomConversionService } from './uomConversionService';
import { financialYearService } from './financialYearService';
import { inventoryValidationService } from './inventoryValidationService';
import { EnterpriseAuditService } from './enterpriseAuditService';

const STORAGE_KEY_GRNS = 'kosh_goods_receipts_v1';

export const INITIAL_GOODS_RECEIPTS: GoodsReceiptHeader[] = [
  {
    id: 'grn-001',
    grnNumber: 'GRN-2026-0001',
    poId: 'po-001',
    poNumber: 'PO-2026-0001',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    branchName: 'Puducherry Main Plant & HQ',
    vendorId: 'bp-002',
    vendorName: 'BASF INDIA LIMITED',
    receiptDate: '2026-11-11',
    challanNumber: 'DC-BASF-9921',
    challanDate: '2026-11-10',
    receivedBy: 'S. Venkatesh (Puducherry Stores Manager)',
    isPartialDelivery: false,
    isFinalDelivery: true,
    status: 'POSTED',
    lines: [
      {
        id: 'grn-line-001',
        grnId: 'grn-001',
        poLineId: 'pol-001',
        itemCode: 'RMPAOPOEXLG0001',
        description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
        purchaseUom: 'BAG',
        inventoryUom: 'KG',
        conversionRatio: 25,
        receivedQtyPurchUom: 12, // 12 BAGS
        convertedQtyInvUom: 300, // 300 KG (12 * 25)
        acceptedQtyInvUom: 300,
        rejectedQtyInvUom: 0,
        acceptedQtyPurchUom: 12,
        rejectedQtyPurchUom: 0,
        warehouseCode: 'PDY-STR',
        batchNumber: 'BATCH-BASF-2026-90',
        remarks: '100% Passed visual & laboratory moisture check.',
      },
    ],
    createdAt: '2026-11-11T08:00:00Z',
  },
];

export const HISTORICAL_GOODS_RECEIPTS: GoodsReceiptHeader[] = [
  {
    id: 'grn-fy25-001',
    grnNumber: 'GRN-2025-0061',
    poId: 'po-fy25-001',
    poNumber: 'PO-2025-0074',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    branchName: 'Puducherry Main Plant & HQ',
    vendorId: 'bp-002',
    vendorName: 'BASF INDIA LIMITED',
    receiptDate: '2026-01-25',
    accountingPostingDate: '2026-01-25',
    financialYearId: 'fy-co-kosh-01-2025-26',
    financialYearCode: 'FY 2025-26',
    accountingPeriodCode: '2026-01',
    challanNumber: 'DC-BASF-2501',
    challanDate: '2026-01-24',
    receivedBy: 'S. Venkatesh (Puducherry Stores Manager)',
    isPartialDelivery: false,
    isFinalDelivery: true,
    status: 'POSTED',
    lines: [
      {
        id: 'grn-line-fy25-001',
        grnId: 'grn-fy25-001',
        poLineId: 'pol-fy25-001',
        itemCode: 'RMPAOPOEXLG0001',
        description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
        purchaseUom: 'BAG',
        inventoryUom: 'KG',
        conversionRatio: 25,
        receivedQtyPurchUom: 30,
        convertedQtyInvUom: 750,
        acceptedQtyInvUom: 750,
        rejectedQtyInvUom: 0,
        acceptedQtyPurchUom: 30,
        rejectedQtyPurchUom: 0,
        warehouseCode: 'PDY-STR',
        batchNumber: 'BATCH-BASF-2025-18',
        remarks: 'Historical FY 2025-26 receipt verified and accepted.',
      },
    ],
    createdAt: '2026-01-25T10:30:00Z',
  },
];

let memoryReceipts: GoodsReceiptHeader[] | null = null;

export const goodsReceiptService = {
  resetForTesting(): void {
    memoryReceipts = JSON.parse(JSON.stringify(INITIAL_GOODS_RECEIPTS));
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_GRNS);
    }
  },

  getReceipts(): GoodsReceiptHeader[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_GRNS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (err) {
        console.error('Error loading goods receipts:', err);
      }
    }
    if (!memoryReceipts) {
      memoryReceipts = JSON.parse(JSON.stringify([...INITIAL_GOODS_RECEIPTS, ...HISTORICAL_GOODS_RECEIPTS]));
    }
    return memoryReceipts!;
  },

  saveReceipts(receipts: GoodsReceiptHeader[]) {
    memoryReceipts = JSON.parse(JSON.stringify(receipts));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_GRNS, JSON.stringify(receipts));
      } catch (err) {
        console.error('Error saving goods receipts:', err);
      }
    }
  },

  getReceiptsForPo(poNumberOrId: string): GoodsReceiptHeader[] {
    return this.getReceipts().filter(
      (g) => (g.poId === poNumberOrId || g.poNumber === poNumberOrId) && g.status === 'POSTED'
    );
  },

  postGoodsReceipt(header: Partial<GoodsReceiptHeader>, lines: Partial<GoodsReceiptLine>[]): GoodsReceiptHeader {
    const companyId = header.companyId || 'co-kosh-01';
    const branchId = header.branchId || 'br-pond-01';
    const docDate = header.receiptDate || new Date().toISOString().split('T')[0];
    const postingDate = header.accountingPostingDate || docDate;

    // GAP-005: Financial Year & Accounting Period Posting-Date Gate
    const fyValidation = financialYearService.validateAndCapturePostingSnapshot({
      companyId,
      branchId,
      documentDate: docDate,
      accountingPostingDate: postingDate,
    });
    if (!fyValidation.allowed) {
      throw new Error(
        fyValidation.rejectionReason ||
          `GRN Posting Blocked: Accounting Posting Date ${postingDate} is in a closed or locked accounting period.`
      );
    }

    const receipts = this.getReceipts();
    const allocNum = financialYearService.allocateDocumentNumber({
      companyId,
      branchId,
      documentType: 'GRN',
      postingDate,
    });
    const grnNumber = header.grnNumber || allocNum.documentNumber || `GRN-2026-${String(receipts.length + 1).padStart(4, '0')}`;
    const grnId = `grn-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

    const formattedLines: GoodsReceiptLine[] = lines.map((l, index) => {
      const uomSnap = uomConversionService.getUomSnapshot(l.itemCode || '');
      const ratio = l.conversionRatio || uomSnap.conversionRatio || 1;
      const recPurch = l.receivedQtyPurchUom || 0;
      const convInv = Math.round(recPurch * ratio);
      const rejInv = l.rejectedQtyInvUom !== undefined ? l.rejectedQtyInvUom : (l.rejectedQtyPurchUom || 0) * ratio;
      const accInv = l.acceptedQtyInvUom !== undefined ? l.acceptedQtyInvUom : Math.max(0, convInv - rejInv);
      const accPurch = l.acceptedQtyPurchUom !== undefined ? l.acceptedQtyPurchUom : Number((accInv / ratio).toFixed(4));
      const rejPurch = l.rejectedQtyPurchUom !== undefined ? l.rejectedQtyPurchUom : Number((rejInv / ratio).toFixed(4));

      return {
        id: `grn-l-${Date.now()}-${index}`,
        grnId,
        poLineId: l.poLineId || `pol-${index}`,
        itemCode: l.itemCode || '',
        description: l.description || '',
        purchaseUom: l.purchaseUom || uomSnap.purchaseUom,
        inventoryUom: l.inventoryUom || uomSnap.inventoryUom,
        conversionRatio: ratio,
        receivedQtyPurchUom: recPurch,
        convertedQtyInvUom: convInv,
        acceptedQtyInvUom: accInv,
        rejectedQtyInvUom: rejInv,
        acceptedQtyPurchUom: accPurch,
        rejectedQtyPurchUom: rejPurch,
        warehouseCode: l.warehouseCode || 'PDY-STR',
        batchNumber: l.batchNumber || `BATCH-${Date.now()}`,
        remarks: l.remarks || 'Receipt posted successfully',
      };
    });

    const newReceipt: GoodsReceiptHeader = {
      id: grnId,
      grnNumber,
      poId: header.poId || 'po-001',
      poNumber: header.poNumber || 'PO-2026-0001',
      companyId,
      branchId,
      branchName: header.branchName || 'Puducherry Plant',
      vendorId: header.vendorId || 'bp-002',
      vendorName: header.vendorName || 'BASF INDIA LIMITED',
      receiptDate: docDate,
      accountingPostingDate: postingDate,
      financialYearId: fyValidation.snapshot.financialYearId,
      financialYearCode: fyValidation.snapshot.financialYearCode,
      accountingPeriodId: fyValidation.snapshot.accountingPeriodId,
      accountingPeriodCode: fyValidation.snapshot.accountingPeriodCode,
      fySnapshot: fyValidation.snapshot,
      challanNumber: header.challanNumber || `DC-${Date.now()}`,
      challanDate: header.challanDate || docDate,
      receivedBy: header.receivedBy || 'Stores Officer',
      isPartialDelivery: header.isPartialDelivery ?? false,
      isFinalDelivery: header.isFinalDelivery ?? true,
      status: 'POSTED',
      lines: formattedLines,
      createdAt: new Date().toISOString(),
    };

    const updated = [newReceipt, ...receipts];
    this.saveReceipts(updated);

    // GAP-005: Synchronize accepted GRN quantities into live Warehouse Inventory Balances
    const existingBalances = inventoryValidationService.getBalances();
    for (const gLine of formattedLines) {
      if (gLine.acceptedQtyInvUom > 0 && gLine.itemCode) {
        const matchBal = existingBalances.find(
          (b) =>
            b.itemCode === gLine.itemCode &&
            b.warehouseCode === gLine.warehouseCode &&
            b.branchId === branchId
        );
        const currentPhysical = matchBal?.physicalStock ?? 0;
        const currentIncoming = matchBal?.incomingStock ?? 0;
        inventoryValidationService.upsertInventoryBalance({
          companyId,
          branchId,
          warehouseCode: gLine.warehouseCode,
          itemCode: gLine.itemCode,
          itemDescription: gLine.description,
          uom: gLine.inventoryUom,
          physicalStock: currentPhysical + gLine.acceptedQtyInvUom,
          reservedStock: matchBal?.reservedStock ?? 0,
          allocatedStock: matchBal?.allocatedStock ?? 0,
          incomingStock: Math.max(0, currentIncoming - gLine.acceptedQtyInvUom),
        });
      }
    }

    // Update PO line received quantities
    const pos = purchaseOrderService.getPOs();
    const targetPo = pos.find(
      (p) => p.id === newReceipt.poId || p.poNumber === newReceipt.poNumber
    );
    if (targetPo) {
      for (const gLine of formattedLines) {
        const poLine = targetPo.lines.find(
          (pl) => pl.id === gLine.poLineId || pl.itemCode === gLine.itemCode
        );
        if (poLine) {
          poLine.receivedQtyPurchUom =
            (poLine.receivedQtyPurchUom || 0) + (gLine.acceptedQtyPurchUom ?? gLine.receivedQtyPurchUom);
          poLine.receivedQtyInvUom =
            (poLine.receivedQtyInvUom || 0) + gLine.acceptedQtyInvUom;
          poLine.status =
            poLine.receivedQtyPurchUom >= poLine.orderQtyPurchUom
              ? 'FULLY_RECEIVED'
              : poLine.receivedQtyPurchUom > 0
              ? 'PARTIALLY_RECEIVED'
              : 'OPEN';
        }
      }
      purchaseOrderService.savePOs(pos);
    }

    // Audit log
    EnterpriseAuditService.logEvent({
      companyId: newReceipt.companyId,
      branchId: newReceipt.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: grnNumber,
      eventType: 'POST_GOODS_RECEIPT',
      eventDescription: `Posted Goods Receipt ${grnNumber} for PO ${newReceipt.poNumber}`,
      changedByUserId: 'usr-buyer-01',
      changedByName: newReceipt.receivedBy || 'Stores Officer',
      changeReason: `Goods receipt of ${formattedLines.length} items posted`,
      newValue: {
        grnNumber,
        poNumber: newReceipt.poNumber,
        linesCount: formattedLines.length,
        linesSummary: formattedLines.map(l => `${l.itemCode}: ${l.receivedQtyPurchUom} ${l.purchaseUom} -> ${l.convertedQtyInvUom} ${l.inventoryUom}`),
      },
    });

    return newReceipt;
  }
};
