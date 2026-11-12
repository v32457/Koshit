/**
 * KOSH INNOVATIONS — FUTURE RFQ FLOATING SERVICE
 * Sourcing demand pipeline for approved PR requirements in RFQ-enabled branches.
 * Prevents over-allocation, supports consolidation, splitting, scheduling, and exemptions.
 */

import { FutureRfqDemandItem, SourcingDemandStatus, ConsolidatedDemandGroup } from '../types/rfqSourcing';
import { PurchaseRequisitionService } from './purchaseRequisitionService';
import { rfqPolicyService } from './rfqPolicyService';
import { uomConversionService } from './uomConversionService';
import { PurchaseRequisitionHeader, PurchaseRequisitionLine } from '../types/purchaseRequisition';

const STORAGE_KEY_SOURCING_PIPELINE = 'kosh_future_rfq_floating_pipeline_v1';

import { prRfqConversionService } from './prRfqConversionService';
import { marketBenchmarkService } from './marketBenchmarkService';

export const futureRfqFloatingService = {
  getDemandItems(): FutureRfqDemandItem[] {
    return this.refreshFromApprovedPRs();
  },

  saveDemandItems(items: FutureRfqDemandItem[]) {
    try {
      localStorage.setItem(STORAGE_KEY_SOURCING_PIPELINE, JSON.stringify(items));
    } catch (err) {
      console.error('Error saving sourcing pipeline:', err);
    }
  },

  refreshFromApprovedPRs(): FutureRfqDemandItem[] {
    const prs = PurchaseRequisitionService.getPurchaseRequisitions();
    const newDemandList: FutureRfqDemandItem[] = [];

    prs.forEach((pr: PurchaseRequisitionHeader) => {
      // Only Approved PRs are eligible for RFQ conversion & floating queue
      const isApproved = ['APPROVED_PENDING_BUYER', 'APPROVED'].includes(pr.status);

      if (!isApproved) return;

      // Check RFQ policy for Company/Branch
      const rfqEnabled = rfqPolicyService.isRfqEnabled(pr.companyId, pr.branchId);
      if (!rfqEnabled) return; // RFQ disabled branches skip floating pipeline

      pr.lines.forEach((line: PurchaseRequisitionLine) => {
        const uomSnap = uomConversionService.getUomSnapshot(line.itemCode);
        const reqQtyPurch = uomConversionService.convertInvToPurchQty(line.itemCode, line.requestedQuantity);
        const approxPricePurch = uomConversionService.convertPricePurchToInv(line.itemCode, line.approximateUnitPrice) * uomSnap.conversionRatio;

        const summary = prRfqConversionService.getSummaryForPrLine(
          line.id,
          line.requestedQuantity,
          uomSnap.inventoryUom,
          pr.prNumber,
          line.itemCode
        );

        let sourcingStatus: SourcingDemandStatus = 'APPROVED_PR';
        if (summary.conversionStatus === 'FULLY_CONVERTED') {
          sourcingStatus = 'FULLY_SOURCED';
        } else if (summary.conversionStatus === 'PARTIALLY_CONVERTED') {
          sourcingStatus = 'PARTIALLY_SOURCED';
        }

        const remainingPurchQty = uomConversionService.convertInvToPurchQty(line.itemCode, summary.remainingQtyInvUom);
        const benchmark = marketBenchmarkService.getBenchmarkForItem(line.itemCode, line.description, (line as any).specifications);

        newDemandList.push({
          id: `demand-${line.id}`,
          prId: pr.id,
          prNumber: pr.prNumber,
          prLineId: line.id,
          companyId: pr.companyId,
          companyCode: pr.companyCode || 'KOSH-HQ',
          branchId: pr.branchId,
          branchCode: pr.branchCode || '001',
          branchName: pr.branchName || 'HQ Plant',
          department: pr.department,
          requesterName: pr.requesterName,
          itemCode: line.itemCode,
          description: line.description,
          itemCategory: line.itemCategory || 'Raw Materials',
          inventoryUom: uomSnap.inventoryUom,
          purchaseUom: uomSnap.purchaseUom,
          inventoryToPurchaseConversion: uomSnap.conversionRatio,
          requiredQuantityInvUom: line.requestedQuantity,
          remainingQuantityInvUom: summary.remainingQtyInvUom,
          requiredQuantityPurchUom: reqQtyPurch,
          remainingQuantityPurchUom: remainingPurchQty,
          approximateUnitPriceInvUom: line.approximateUnitPrice,
          approximateUnitPricePurchUom: approxPricePurch,
          estimatedTotalValue: line.estimatedTotalValue,
          requiredDeliveryDate: line.deliverySchedules?.[0]?.deliveryDate || '2026-12-01',
          prApprovalStatus: pr.status,
          sourcingStatus,
          technicalSpecifications: (line as any).specifications || `${line.description} - Standard Requirements`,
          marketBenchmark: benchmark,
          assignedBuyerId: 'usr-buyer-01',
          assignedBuyerName: 'Vikram Singh',
          assignedPurchasingManagerId: 'usr-checker-03',
          assignedPurchasingManagerName: 'Venkatesh Iyer',
          ageingDays: Math.floor((Date.now() - new Date(pr.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
          createdAt: pr.createdAt,
          updatedAt: new Date().toISOString(),
        });
      });
    });

    this.saveDemandItems(newDemandList);
    return newDemandList;
  },

  scheduleDemandItem(id: string, plannedDate: string): FutureRfqDemandItem | null {
    const items = this.getDemandItems();
    const item = items.find((i) => i.id === id);
    if (item) {
      item.plannedSourcingDate = plannedDate;
      item.sourcingStatus = 'SCHEDULED';
      item.updatedAt = new Date().toISOString();
      this.saveDemandItems(items);
      return item;
    }
    return null;
  },

  exemptDemandItem(id: string, reason: string, user: string): FutureRfqDemandItem | null {
    const items = this.getDemandItems();
    const item = items.find((i) => i.id === id);
    if (item) {
      item.sourcingStatus = 'EXEMPTED';
      item.exemptionReason = reason;
      item.exemptedBy = user;
      item.updatedAt = new Date().toISOString();
      this.saveDemandItems(items);
      return item;
    }
    return null;
  },

  holdDemandItem(id: string, hold: boolean): FutureRfqDemandItem | null {
    const items = this.getDemandItems();
    const item = items.find((i) => i.id === id);
    if (item) {
      item.sourcingStatus = hold ? 'ON_HOLD' : 'APPROVED_PR';
      item.updatedAt = new Date().toISOString();
      this.saveDemandItems(items);
      return item;
    }
    return null;
  },

  getConsolidatedDemandItems(): ConsolidatedDemandGroup[] {
    const items = this.getDemandItems();
    const groupMap = new Map<string, ConsolidatedDemandGroup>();

    items.forEach((item) => {
      // Exclude exempted or cancelled lines
      if (item.sourcingStatus === 'EXEMPTED') return;

      const groupKey = `${item.itemCode}_${item.purchaseUom}_${item.inventoryUom}_${item.itemCategory}`;

      let group = groupMap.get(groupKey);
      if (!group) {
        group = {
          groupId: `grp-${item.itemCode}`,
          itemCode: item.itemCode,
          description: item.description,
          itemCategory: item.itemCategory,
          inventoryUom: item.inventoryUom,
          purchaseUom: item.purchaseUom,
          conversionRatio: item.inventoryToPurchaseConversion,
          totalRequiredQtyInvUom: 0,
          totalConvertedQtyInvUom: 0,
          totalAvailableQtyInvUom: 0,
          totalRequiredQtyPurchUom: 0,
          totalConvertedQtyPurchUom: 0,
          totalAvailableQtyPurchUom: 0,
          marketBenchmark: item.marketBenchmark || marketBenchmarkService.getBenchmarkForItem(item.itemCode, item.description, item.technicalSpecifications),
          contributingDemandItems: [],
        };
        groupMap.set(groupKey, group);
      }

      const convertedInv = item.requiredQuantityInvUom - item.remainingQuantityInvUom;
      const convertedPurch = item.requiredQuantityPurchUom - item.remainingQuantityPurchUom;

      group.totalRequiredQtyInvUom += item.requiredQuantityInvUom;
      group.totalConvertedQtyInvUom += convertedInv;
      group.totalAvailableQtyInvUom += item.remainingQuantityInvUom;

      group.totalRequiredQtyPurchUom += item.requiredQuantityPurchUom;
      group.totalConvertedQtyPurchUom += convertedPurch;
      group.totalAvailableQtyPurchUom += item.remainingQuantityPurchUom;

      group.contributingDemandItems.push(item);
    });

    return Array.from(groupMap.values());
  }
};
