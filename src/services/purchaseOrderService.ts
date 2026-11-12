/**
 * KOSH INNOVATIONS — PURCHASE ORDER & VENDOR ALLOCATION SERVICE
 * Automatically retrieves approved prices (RFQ Award vs Price Book),
 * calculates multi-vendor split allocations, manages buyer/approver overrides,
 * and tracks PO release & approval history.
 */

import {
  PurchaseOrderHeader,
  PurchaseOrderLine,
  PoVendorAllocationProposal,
} from '../types/rfqSourcing';
import { rfqPolicyService } from './rfqPolicyService';
import { vendorPriceRegisterService } from './vendorPriceRegisterService';
import { purchasePriceBookService } from './purchasePriceBookService';
import { uomConversionService } from './uomConversionService';
import { EnterpriseAuditService } from './enterpriseAuditService';

const STORAGE_KEY_POS = 'kosh_purchase_orders_v1';

export const INITIAL_POS: PurchaseOrderHeader[] = [
  {
    id: 'po-001',
    poNumber: 'PO-2026-0001',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Main Plant & HQ',
    purchaseOrgId: 'po-kosh-01',
    vendorId: 'bp-002',
    vendorCode: 'VEND-BASF-01',
    vendorName: 'BASF INDIA LIMITED',
    poDate: '2026-11-10',
    paymentTerms: 'NET 60 Days',
    incoterms: 'DDP Puducherry Plant',
    deliveryAddress: 'CS-46&47, PIPDIC Industrial Estate, Mettupalayam, Puducherry - 605009',
    buyerId: 'usr-buyer-01',
    buyerName: 'Vikram Singh',
    purchasingManagerId: 'usr-checker-03',
    purchasingManagerName: 'Venkatesh Iyer',
    totalNetValue: 81600,
    totalTaxValue: 14688,
    totalGrossValue: 96288,
    currency: 'INR',
    priceSourceMode: 'RFQ_AWARD',
    status: 'PENDING_APPROVAL',
    hasOverride: true,
    overrideJustification: 'Adjusted allocation from 50/50 to 60/40 in favor of BASF due to urgent production delivery requirement at Puducherry Plant.',
    allocationProposals: [
      {
        itemCode: 'RMPAOPOEXLG0001',
        purchaseUom: 'BAG',
        totalRequiredQtyPurchUom: 20,
        priceSource: 'APPROVED_RFQ_AWARD',
        vendorAllocations: [
          {
            vendorId: 'bp-002',
            vendorCode: 'VEND-BASF-01',
            vendorName: 'BASF INDIA LIMITED',
            originalAllocationPercent: 50,
            originalQtyPurchUom: 10,
            proposedAllocationPercent: 60,
            proposedQtyPurchUom: 12,
            unitPricePurchUom: 6800,
            lineTotalValue: 81600,
            priceAgreementRef: 'VPA-2026-0001',
          },
          {
            vendorId: 'bp-003',
            vendorCode: 'VEND-POLY-02',
            vendorName: 'POLYMER SOLUTIONS INDIA LTD',
            originalAllocationPercent: 50,
            originalQtyPurchUom: 10,
            proposedAllocationPercent: 40,
            proposedQtyPurchUom: 8,
            unitPricePurchUom: 7000,
            lineTotalValue: 56000,
            priceAgreementRef: 'VPA-2026-0002',
          },
        ],
        overrideApplied: true,
        overrideJustification: 'Adjusted allocation from 50/50 to 60/40 in favor of BASF due to urgent production delivery requirement at Puducherry Plant.',
        overrideProposedBy: 'Vikram Singh (Senior Procurement Officer)',
      },
    ],
    lines: [
      {
        id: 'pol-001',
        poId: 'po-001',
        itemCode: 'RMPAOPOEXLG0001',
        description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
        itemCategory: 'Raw Materials',
        purchaseUom: 'BAG',
        inventoryUom: 'KG',
        conversionRatio: 25,
        orderQtyPurchUom: 12, // 12 BAGS (300 KG)
        orderQtyInvUom: 300,
        unitPricePurchUom: 6800,
        currency: 'INR',
        netAmount: 81600,
        gstPercent: 18,
        gstAmount: 14688,
        totalAmount: 96288,
        prNumberRef: 'PR-2026-0001',
        rfqNumberRef: 'RFQ-2026-0001',
        priceAgreementRef: 'VPA-2026-0001',
        deliveryDate: '2026-11-25',
        receivedQtyPurchUom: 0,
        receivedQtyInvUom: 0,
        status: 'OPEN',
      },
    ],
    createdAt: '2026-11-10T11:00:00Z',
    updatedAt: '2026-11-10T11:00:00Z',
  },
];

export const purchaseOrderService = {
  getPOs(): PurchaseOrderHeader[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading POs:', err);
    }
    return INITIAL_POS;
  },

  savePOs(pos: PurchaseOrderHeader[]) {
    try {
      localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(pos));
    } catch (err) {
      console.error('Error saving POs:', err);
    }
  },

  getPoById(id: string): PurchaseOrderHeader | undefined {
    return this.getPOs().find(p => p.id === id || p.poNumber === id);
  },

  // Calculate proposed multi-vendor allocation split for a requested item
  calculateVendorAllocation(companyId: string, itemCode: string, totalQtyPurchUom: number, branchId?: string): PoVendorAllocationProposal {
    const isRfqEnabled = rfqPolicyService.isRfqEnabled(companyId, branchId);

    if (isRfqEnabled) {
      const agreements = vendorPriceRegisterService.getActiveAgreementsForItem(companyId, itemCode, branchId);

      if (agreements.length > 0) {
        // Multi-vendor split based on agreement allocation percentages
        let totalAssignedPercent = 0;
        const vendorAllocations = agreements.map((agr) => {
          const origPct = agr.allocationPercent || Math.round(100 / agreements.length);
          totalAssignedPercent += origPct;
          const origQty = Math.round((totalQtyPurchUom * origPct) / 100);
          return {
            vendorId: agr.vendorId,
            vendorCode: agr.vendorCode,
            vendorName: agr.vendorName,
            originalAllocationPercent: origPct,
            originalQtyPurchUom: origQty,
            proposedAllocationPercent: origPct,
            proposedQtyPurchUom: origQty,
            unitPricePurchUom: agr.approvedUnitPricePurchUom,
            lineTotalValue: origQty * agr.approvedUnitPricePurchUom,
            priceAgreementRef: agr.agreementNumber,
          };
        });

        // Exact integer rounding reconciliation
        let currentSumQty = vendorAllocations.reduce((acc, v) => acc + v.proposedQtyPurchUom, 0);
        if (currentSumQty !== totalQtyPurchUom && vendorAllocations.length > 0) {
          vendorAllocations[0].proposedQtyPurchUom += (totalQtyPurchUom - currentSumQty);
          vendorAllocations[0].lineTotalValue = vendorAllocations[0].proposedQtyPurchUom * vendorAllocations[0].unitPricePurchUom;
        }

        return {
          itemCode,
          purchaseUom: agreements[0].purchaseUom,
          totalRequiredQtyPurchUom: totalQtyPurchUom,
          priceSource: 'APPROVED_RFQ_AWARD',
          vendorAllocations,
          overrideApplied: false,
        };
      }
    }

    // RFQ Disabled or no active RFQ agreement -> Use Price Book
    const priceBookInfo = purchasePriceBookService.getPriceBookLineForItem(companyId, itemCode, totalQtyPurchUom, branchId);
    const unitPrice = priceBookInfo ? priceBookInfo.unitPrice : 7500;
    const refNum = priceBookInfo ? priceBookInfo.priceBookNumber : 'PB-DEFAULT';

    return {
      itemCode,
      purchaseUom: priceBookInfo?.line.purchaseUom || 'BAG',
      totalRequiredQtyPurchUom: totalQtyPurchUom,
      priceSource: 'APPROVED_PRICE_BOOK',
      vendorAllocations: [
        {
          vendorId: 'bp-002',
          vendorCode: 'VEND-BASF-01',
          vendorName: 'BASF INDIA LIMITED',
          originalAllocationPercent: 100,
          originalQtyPurchUom: totalQtyPurchUom,
          proposedAllocationPercent: 100,
          proposedQtyPurchUom: totalQtyPurchUom,
          unitPricePurchUom: unitPrice,
          lineTotalValue: totalQtyPurchUom * unitPrice,
          priceAgreementRef: refNum,
        },
      ],
      overrideApplied: false,
    };
  },

  approvePo(poId: string, approvedBy: string): PurchaseOrderHeader | null {
    const pos = this.getPOs();
    const po = pos.find(p => p.id === poId);
    if (po) {
      po.status = 'APPROVED';
      po.approvedBy = approvedBy;
      po.approvedAt = new Date().toISOString();
      po.updatedAt = new Date().toISOString();
      this.savePOs(pos);

      // Record in Enterprise Audit Log
      EnterpriseAuditService.logEvent({
        companyId: po.companyId,
        branchId: po.branchId,
        entityType: 'APPROVAL_MAPPING',
        entityId: po.poNumber,
        eventType: 'APPROVE_PURCHASE_ORDER',
        eventDescription: `Approved Purchase Order ${po.poNumber} (${po.vendorName})`,
        changedByUserId: 'usr-checker-03',
        changedByName: approvedBy,
        changeReason: 'PO Approval granted',
        newValue: {
          poNumber: po.poNumber,
          vendorName: po.vendorName,
          totalGrossValue: po.totalGrossValue,
          hasOverride: po.hasOverride,
          overrideJustification: po.overrideJustification,
        },
      });

      return po;
    }
    return null;
  },

  rejectPo(poId: string, rejectedBy: string, reason: string): PurchaseOrderHeader | null {
    const pos = this.getPOs();
    const po = pos.find(p => p.id === poId);
    if (po) {
      po.status = 'CANCELLED';
      po.updatedAt = new Date().toISOString();
      this.savePOs(pos);

      EnterpriseAuditService.logEvent({
        companyId: po.companyId,
        branchId: po.branchId,
        entityType: 'APPROVAL_MAPPING',
        entityId: po.poNumber,
        eventType: 'REJECT_PURCHASE_ORDER',
        eventDescription: `Rejected Purchase Order ${po.poNumber}: ${reason}`,
        changedByUserId: 'usr-checker-03',
        changedByName: rejectedBy,
        changeReason: reason,
        newValue: {
          poNumber: po.poNumber,
          reason,
        },
      });

      return po;
    }
    return null;
  }
};
