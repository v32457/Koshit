/**
 * KOSH INNOVATIONS — PR-TO-RFQ CONVERSION LEDGER SERVICE
 * Guarantees strict line-level RFQ conversion tracking, concurrency safety,
 * partial quantity conversions, UOM recalculations, and reversal audit controls.
 */

import { EnterpriseAuditService } from './enterpriseAuditService';
import { PurchaseRequisitionService } from './purchaseRequisitionService';

export type PrConversionStatus = 'NOT_CONVERTED' | 'PARTIALLY_CONVERTED' | 'FULLY_CONVERTED';

export interface PrToRfqConversionRecord {
  id: string;
  prId: string;
  prNumber: string;
  prLineId: string;
  itemCode: string;
  rfqId: string;
  rfqNumber: string;
  rfqLineId: string;
  
  originalPrQtyInvUom: number;
  convertedQtyInvUom: number;
  convertedQtyPurchUom: number;
  
  prInvUom: string;
  rfqPurchUom: string;
  conversionRatio: number; // 1 RFQ Purch UOM = conversionRatio PR Inv UOM
  
  status: 'ACTIVE' | 'REVERSED' | 'CANCELLED';
  convertedByUserId: string;
  convertedByName: string;
  convertedAt: string; // ISO UTC
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
}

export interface PrLineConversionSummary {
  prLineId: string;
  prNumber: string;
  itemCode: string;
  prInvUom: string;
  originalPrQtyInvUom: number;
  convertedQtyInvUom: number;
  remainingQtyInvUom: number;
  conversionStatus: PrConversionStatus;
  records: PrToRfqConversionRecord[];
}

const STORAGE_KEY_CONVERSIONS = 'kosh_pr_rfq_conversion_ledger_v1';

// Seed initial conversion mapping for seed RFQ (RFQ-2026-0001 converting PR-2026-0001 line 1)
const INITIAL_CONVERSIONS: PrToRfqConversionRecord[] = [
  {
    id: 'conv-001',
    prId: 'pr-001',
    prNumber: 'PR-2026-0001',
    prLineId: 'pr-line-001',
    itemCode: 'RM-ALLOY-316L',
    rfqId: 'rfq-001',
    rfqNumber: 'RFQ-2026-0001',
    rfqLineId: 'rfq-line-001',
    originalPrQtyInvUom: 500,
    convertedQtyInvUom: 500,
    convertedQtyPurchUom: 20,
    prInvUom: 'KG',
    rfqPurchUom: 'BAG',
    conversionRatio: 25,
    status: 'ACTIVE',
    convertedByUserId: 'usr-buyer-01',
    convertedByName: 'Vikram Singh',
    convertedAt: '2026-11-05T09:00:00Z',
  },
];

// In-memory locks to handle concurrent conversion requests safely
const locks = new Set<string>();

export const prRfqConversionService = {
  getRecords(): PrToRfqConversionRecord[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONVERSIONS);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY_CONVERSIONS, JSON.stringify(INITIAL_CONVERSIONS));
        return INITIAL_CONVERSIONS;
      }
      return JSON.parse(stored);
    } catch {
      return INITIAL_CONVERSIONS;
    }
  },

  saveRecords(records: PrToRfqConversionRecord[]): void {
    localStorage.setItem(STORAGE_KEY_CONVERSIONS, JSON.stringify(records));
  },

  /**
   * Retrieves full conversion line summary for a given PR line.
   */
  getSummaryForPrLine(
    prLineId: string,
    fallbackOriginalQty?: number,
    fallbackPrInvUom?: string,
    fallbackPrNumber?: string,
    fallbackItemCode?: string
  ): PrLineConversionSummary {
    const allRecords = this.getRecords();
    const activeRecords = allRecords.filter((r) => r.prLineId === prLineId && r.status === 'ACTIVE');

    // Attempt to lookup PR line from PR Master if fallback not supplied
    let originalQty = fallbackOriginalQty || 0;
    let prInvUom = fallbackPrInvUom || 'EA';
    let prNumber = fallbackPrNumber || 'PR-UNKNOWN';
    let itemCode = fallbackItemCode || 'ITEM-UNKNOWN';

    if (!fallbackOriginalQty) {
      const prs = PurchaseRequisitionService.getPurchaseRequisitions();
      for (const p of prs) {
        const line = p.lines.find((l) => l.id === prLineId);
        if (line) {
          originalQty = line.requestedQuantity;
          prInvUom = line.inventoryUom || 'EA';
          prNumber = p.prNumber;
          itemCode = line.itemCode;
          break;
        }
      }
    }

    if (activeRecords.length > 0) {
      const first = activeRecords[0];
      if (first.originalPrQtyInvUom) originalQty = first.originalPrQtyInvUom;
      if (first.prInvUom) prInvUom = first.prInvUom;
      if (first.prNumber) prNumber = first.prNumber;
      if (first.itemCode) itemCode = first.itemCode;
    }

    const convertedQtyInvUom = activeRecords.reduce((acc, r) => acc + (r.convertedQtyInvUom || 0), 0);
    const remainingQtyInvUom = Math.max(0, originalQty - convertedQtyInvUom);

    let conversionStatus: PrConversionStatus = 'NOT_CONVERTED';
    if (convertedQtyInvUom > 0) {
      if (remainingQtyInvUom <= 0.0001) {
        conversionStatus = 'FULLY_CONVERTED';
      } else {
        conversionStatus = 'PARTIALLY_CONVERTED';
      }
    }

    return {
      prLineId,
      prNumber,
      itemCode,
      prInvUom,
      originalPrQtyInvUom: originalQty,
      convertedQtyInvUom,
      remainingQtyInvUom,
      conversionStatus,
      records: allRecords.filter((r) => r.prLineId === prLineId),
    };
  },

  /**
   * Concurrency-safe conversion execution.
   * Validates line availability and logs permanent audit trail.
   */
  recordConversion(params: {
    prId: string;
    prNumber: string;
    prLineId: string;
    itemCode: string;
    rfqId: string;
    rfqNumber: string;
    rfqLineId: string;
    convertQtyInvUom: number;
    convertQtyPurchUom: number;
    prInvUom: string;
    rfqPurchUom: string;
    conversionRatio: number;
    userId: string;
    userName: string;
    companyId?: string;
    branchId?: string;
  }): { success: boolean; record?: PrToRfqConversionRecord; summary: PrLineConversionSummary; errorMessage?: string } {
    const lockKey = params.prLineId;

    // Mutex lock to prevent simultaneous duplicate conversion calls
    if (locks.has(lockKey)) {
      return {
        success: false,
        errorMessage: 'A concurrent conversion transaction is already in progress for this PR line. Please retry.',
        summary: this.getSummaryForPrLine(params.prLineId),
      };
    }

    try {
      locks.add(lockKey);

      const summaryBefore = this.getSummaryForPrLine(
        params.prLineId,
        undefined,
        params.prInvUom,
        params.prNumber,
        params.itemCode
      );

      if (summaryBefore.conversionStatus === 'FULLY_CONVERTED' || summaryBefore.remainingQtyInvUom <= 0) {
        return {
          success: false,
          errorMessage: `This PR line (${params.prNumber} / ${params.itemCode}) has already been fully converted to RFQ. No additional conversion is permitted.`,
          summary: summaryBefore,
        };
      }

      if (params.convertQtyInvUom > summaryBefore.remainingQtyInvUom + 0.0001) {
        return {
          success: false,
          errorMessage: `Requested conversion quantity (${params.convertQtyInvUom} ${params.prInvUom}) exceeds the remaining unconverted quantity (${summaryBefore.remainingQtyInvUom} ${params.prInvUom}) for PR line ${params.prNumber}.`,
          summary: summaryBefore,
        };
      }

      const allRecords = this.getRecords();
      const newRecord: PrToRfqConversionRecord = {
        id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        prId: params.prId,
        prNumber: params.prNumber,
        prLineId: params.prLineId,
        itemCode: params.itemCode,
        rfqId: params.rfqId,
        rfqNumber: params.rfqNumber,
        rfqLineId: params.rfqLineId,
        originalPrQtyInvUom: summaryBefore.originalPrQtyInvUom,
        convertedQtyInvUom: params.convertQtyInvUom,
        convertedQtyPurchUom: params.convertQtyPurchUom,
        prInvUom: params.prInvUom,
        rfqPurchUom: params.rfqPurchUom,
        conversionRatio: params.conversionRatio || 1,
        status: 'ACTIVE',
        convertedByUserId: params.userId,
        convertedByName: params.userName,
        convertedAt: new Date().toISOString(),
      };

      allRecords.unshift(newRecord);
      this.saveRecords(allRecords);

      const summaryAfter = this.getSummaryForPrLine(
        params.prLineId,
        summaryBefore.originalPrQtyInvUom,
        params.prInvUom,
        params.prNumber,
        params.itemCode
      );

      // Audit Log Entry
      EnterpriseAuditService.logEvent({
        companyId: params.companyId || 'co-kosh-01',
        branchId: params.branchId || 'br-pond-01',
        entityType: 'PURCHASE_REQUISITION',
        entityId: params.prLineId,
        eventType: 'PR_LINE_CONVERTED_TO_RFQ',
        eventDescription: `Converted ${params.convertQtyInvUom} ${params.prInvUom} (${params.convertQtyPurchUom} ${params.rfqPurchUom}) from PR line ${params.prNumber} (${params.itemCode}) to RFQ ${params.rfqNumber}`,
        changedByUserId: params.userId,
        changedByName: params.userName,
        changeReason: `Line converted into RFQ ${params.rfqNumber}`,
        previousValue: {
          remainingQtyInvUom: summaryBefore.remainingQtyInvUom,
          status: summaryBefore.conversionStatus,
        },
        newValue: {
          remainingQtyInvUom: summaryAfter.remainingQtyInvUom,
          status: summaryAfter.conversionStatus,
          rfqNumber: params.rfqNumber,
          rfqLineId: params.rfqLineId,
        },
      });

      return {
        success: true,
        record: newRecord,
        summary: summaryAfter,
      };
    } finally {
      locks.delete(lockKey);
    }
  },

  /**
   * Reverses or cancels conversion quantity on RFQ cancellation/rejection.
   * Requires explicit reason and logs full audit trail.
   */
  reverseConversion(
    recordId: string,
    cancelledBy: string,
    reason: string,
    companyId?: string
  ): { success: boolean; message: string; record?: PrToRfqConversionRecord } {
    const allRecords = this.getRecords();
    const target = allRecords.find((r) => r.id === recordId || r.rfqId === recordId || r.rfqLineId === recordId);

    if (!target) {
      return { success: false, message: 'Conversion record not found.' };
    }

    if (target.status !== 'ACTIVE') {
      return { success: false, message: `Conversion record is already in status ${target.status}.` };
    }

    target.status = 'CANCELLED';
    target.cancellationReason = reason;
    target.cancelledBy = cancelledBy;
    target.cancelledAt = new Date().toISOString();

    this.saveRecords(allRecords);

    // Audit Log Entry
    EnterpriseAuditService.logEvent({
      companyId: companyId || 'co-kosh-01',
      entityType: 'PURCHASE_REQUISITION',
      entityId: target.prLineId,
      eventType: 'RFQ_CONVERSION_REVERSED',
      eventDescription: `Reversed conversion of ${target.convertedQtyInvUom} ${target.prInvUom} for PR ${target.prNumber} due to RFQ ${target.rfqNumber} cancellation`,
      changedByUserId: 'usr-admin-01',
      changedByName: cancelledBy,
      changeReason: reason,
      previousValue: { status: 'ACTIVE', convertedQtyInvUom: target.convertedQtyInvUom },
      newValue: { status: 'CANCELLED', cancellationReason: reason },
    });

    return {
      success: true,
      message: `Conversion record for RFQ ${target.rfqNumber} successfully cancelled and quantity released back to PR line ${target.prNumber}.`,
      record: target,
    };
  },
};
