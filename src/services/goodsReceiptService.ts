/**
 * KOSH INNOVATIONS — GOODS RECEIPT & INVENTORY UOM CONVERSION SERVICE
 * Captures Goods Receipt in Purchase UOM, performs authoritative Inventory UOM conversion,
 * updates inventory stock logs, and updates PO line fulfillment status.
 */

import { GoodsReceiptHeader, GoodsReceiptLine } from '../types/rfqSourcing';
import { purchaseOrderService } from './purchaseOrderService';
import { uomConversionService } from './uomConversionService';
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
        warehouseCode: 'PDY-STR',
        batchNumber: 'BATCH-BASF-2026-90',
        remarks: '100% Passed visual & laboratory moisture check.',
      },
    ],
    createdAt: '2026-11-11T08:00:00Z',
  },
];

export const goodsReceiptService = {
  getReceipts(): GoodsReceiptHeader[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GRNS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading goods receipts:', err);
    }
    return INITIAL_GOODS_RECEIPTS;
  },

  saveReceipts(receipts: GoodsReceiptHeader[]) {
    try {
      localStorage.setItem(STORAGE_KEY_GRNS, JSON.stringify(receipts));
    } catch (err) {
      console.error('Error saving goods receipts:', err);
    }
  },

  postGoodsReceipt(header: Partial<GoodsReceiptHeader>, lines: Partial<GoodsReceiptLine>[]): GoodsReceiptHeader {
    const receipts = this.getReceipts();
    const count = receipts.length + 1;
    const grnNumber = `GRN-2026-${String(count).padStart(4, '0')}`;

    const formattedLines: GoodsReceiptLine[] = lines.map((l, index) => {
      const uomSnap = uomConversionService.getUomSnapshot(l.itemCode || '');
      const recPurch = l.receivedQtyPurchUom || 0;
      const convInv = Math.round(recPurch * uomSnap.conversionRatio);

      return {
        id: `grn-l-${Date.now()}-${index}`,
        grnId: `grn-${Date.now()}`,
        poLineId: l.poLineId || `pol-${index}`,
        itemCode: l.itemCode || '',
        description: l.description || '',
        purchaseUom: uomSnap.purchaseUom,
        inventoryUom: uomSnap.inventoryUom,
        conversionRatio: uomSnap.conversionRatio,
        receivedQtyPurchUom: recPurch,
        convertedQtyInvUom: convInv,
        acceptedQtyInvUom: l.acceptedQtyInvUom !== undefined ? l.acceptedQtyInvUom : convInv,
        rejectedQtyInvUom: l.rejectedQtyInvUom || 0,
        warehouseCode: l.warehouseCode || 'PDY-STR',
        batchNumber: l.batchNumber || `BATCH-${Date.now()}`,
        remarks: l.remarks || 'Receipt posted successfully',
      };
    });

    const newReceipt: GoodsReceiptHeader = {
      id: `grn-${Date.now()}`,
      grnNumber,
      poId: header.poId || 'po-001',
      poNumber: header.poNumber || 'PO-2026-0001',
      companyId: header.companyId || 'co-kosh-01',
      branchId: header.branchId || 'br-pond-01',
      branchName: header.branchName || 'Puducherry Plant',
      vendorId: header.vendorId || 'bp-002',
      vendorName: header.vendorName || 'BASF INDIA LIMITED',
      receiptDate: new Date().toISOString().split('T')[0],
      challanNumber: header.challanNumber || `DC-${Date.now()}`,
      challanDate: header.challanDate || new Date().toISOString().split('T')[0],
      receivedBy: header.receivedBy || 'Stores Officer',
      status: 'POSTED',
      lines: formattedLines,
      createdAt: new Date().toISOString(),
    };

    const updated = [newReceipt, ...receipts];
    this.saveReceipts(updated);

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
