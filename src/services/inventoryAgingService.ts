/**
 * CIPPLATFORM — INVENTORY STOCK AGING & EXPIRY / SHELF-LIFE ENGINE
 * Strictly independent from Purchase Requisition (PR) Aging.
 *
 * Guarantees:
 * - Configurable Aging Buckets (Default: 0–30 Fresh, 31–90 Normal, 91–180 Aging, 181–365 Old, >365 Critical)
 * - Configurable Expiry / Near-Expiry Thresholds (30 / 60 / 90 days)
 * - Non-expiring items cleanly marked 'NOT_APPLICABLE' (never fail expiry checks)
 * - Missing receipt/batch dates NEVER fabricated — explicitly reported as 'Data Unavailable'
 * - Expired batches automatically excluded from usable Available Stock when enabled
 * - Supports FIFO (oldest receipt first) and FEFO (earliest expiry first) sequence recommendation
 * - Versioned historical configurations + RBAC gated access
 */

import {
  InventoryBalanceRecord,
  InventoryBatchLotRecord,
} from '../types/procurementFinanceGovernance';
import { User } from '../types';
import { normalizeCompanyId, normalizeBranchId } from './prGovernancePolicyService';
import { rbacPermissionService } from './rbacPermissionService';
import { EnterpriseAuditService } from './enterpriseAuditService';

export interface StockAgingBucketDefinition {
  key: 'FRESH' | 'NORMAL' | 'AGING' | 'OLD' | 'CRITICAL' | string;
  label: string;
  fromDays: number;
  toDays: number; // 999999 for open-ended
}

export interface StockAgingPolicyConfig {
  id: string;
  companyId: string;
  branchId: string; // 'ALL' or branchId
  warehouseCode: string; // 'ALL' or warehouseCode
  itemCategory: string; // 'ALL' or itemCategory
  isEnabled: boolean;
  expiryValidationEnabled: boolean;
  excludeExpiredFromAvailable: boolean;
  nearExpiryThresholdDays: number; // e.g. 30, 60, 90
  secondaryExpiryThresholdDays: number; // e.g. 60
  criticalExpiryThresholdDays: number; // e.g. 90
  issueMethod: 'FIFO' | 'FEFO';
  buckets: StockAgingBucketDefinition[];
  version: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  status: 'ACTIVE' | 'SUPERSEDED';
  updatedAt: string;
  updatedBy: string;
  changeReason?: string;
}

export type BatchExpiryStatus =
  | 'EXPIRED'
  | 'NEAR_EXPIRY'
  | 'VALID'
  | 'NOT_APPLICABLE'
  | 'DATA_UNAVAILABLE';

export interface StockBatchAgingAnalysis {
  companyId: string;
  branchId: string;
  warehouseCode: string;
  warehouseName: string;
  binLocation: string;
  itemCode: string;
  itemDescription: string;
  itemCategory: string;
  uom: string;
  batchNo: string;
  receiptDateDisplay: string; // YYYY-MM-DD or 'Data Unavailable'
  stockAgeDays: number | null;
  agingBucketLabel: string; // e.g. '0–30 Days (Fresh)' or 'Data Unavailable'
  agingBucketKey: string;
  expiryDateDisplay: string; // YYYY-MM-DD or 'Not Applicable'
  daysToExpiry: number | null;
  expiryStatus: BatchExpiryStatus;
  quantity: number;
  usableQuantity: number; // 0 if expired & excludeExpiredFromAvailable
  recommendedDispatchRank: number;
  issueMethodApplied: 'FIFO' | 'FEFO';
}

export interface ItemStockAgingSummary {
  itemCode: string;
  uom: string;
  configId: string;
  configVersion: number;
  totalAnalyzedQuantity: number;
  usableNonExpiredQuantity: number;
  expiredQuantity: number;
  nearExpiryQuantity: number;
  dataUnavailableQuantity: number;
  oldestReceiptDate: string; // 'Data Unavailable' if none
  oldestStockAgeDays: number | null;
  earliestExpiryDate: string; // 'Not Applicable' if non-expiring
  hasExpiredStock: boolean;
  hasNearExpiryWarning: boolean;
  recommendedIssueMethod: 'FIFO' | 'FEFO';
  recommendedBatchSequence: string[];
  bucketTotals: Array<{ key: string; label: string; quantity: number }>;
  batches: StockBatchAgingAnalysis[];
}

export const DEFAULT_STOCK_AGING_BUCKETS: StockAgingBucketDefinition[] = [
  { key: 'FRESH', label: '0–30 Days (Fresh)', fromDays: 0, toDays: 30 },
  { key: 'NORMAL', label: '31–90 Days (Normal)', fromDays: 31, toDays: 90 },
  { key: 'AGING', label: '91–180 Days (Aging)', fromDays: 91, toDays: 180 },
  { key: 'OLD', label: '181–365 Days (Old)', fromDays: 181, toDays: 365 },
  { key: 'CRITICAL', label: '>365 Days (Critical / Slow-Moving)', fromDays: 366, toDays: 999999 },
];

export const INITIAL_STOCK_AGING_POLICIES: StockAgingPolicyConfig[] = [
  {
    id: 'stk-age-co1-default',
    companyId: 'co-kosh-01',
    branchId: 'ALL',
    warehouseCode: 'ALL',
    itemCategory: 'ALL',
    isEnabled: true,
    expiryValidationEnabled: true,
    excludeExpiredFromAvailable: true,
    nearExpiryThresholdDays: 30,
    secondaryExpiryThresholdDays: 60,
    criticalExpiryThresholdDays: 90,
    issueMethod: 'FEFO',
    buckets: JSON.parse(JSON.stringify(DEFAULT_STOCK_AGING_BUCKETS)),
    version: 1,
    effectiveFrom: '2026-04-01',
    status: 'ACTIVE',
    updatedAt: '2026-04-01T08:00:00Z',
    updatedBy: 'Platform Governance Admin',
  },
  {
    id: 'stk-age-co2-default',
    companyId: 'co-kosh-02',
    branchId: 'ALL',
    warehouseCode: 'ALL',
    itemCategory: 'ALL',
    isEnabled: true,
    expiryValidationEnabled: true,
    excludeExpiredFromAvailable: true,
    nearExpiryThresholdDays: 30,
    secondaryExpiryThresholdDays: 60,
    criticalExpiryThresholdDays: 90,
    issueMethod: 'FIFO',
    buckets: JSON.parse(JSON.stringify(DEFAULT_STOCK_AGING_BUCKETS)),
    version: 1,
    effectiveFrom: '2026-04-01',
    status: 'ACTIVE',
    updatedAt: '2026-04-01T08:00:00Z',
    updatedBy: 'Platform Governance Admin',
  },
];

const STORAGE_KEY_STOCK_AGING_POLICIES = 'cip_stock_aging_policies_v1';
let memoryStockAgingPolicies: StockAgingPolicyConfig[] | null = null;

function daysBetween(fromIso: string, toIso: string): number | null {
  const d1 = new Date(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const d2 = new Date(`${toIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

export const inventoryAgingService = {
  getPolicies(): StockAgingPolicyConfig[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_STOCK_AGING_POLICIES);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // ignore
      }
    }
    if (!memoryStockAgingPolicies) {
      memoryStockAgingPolicies = JSON.parse(JSON.stringify(INITIAL_STOCK_AGING_POLICIES));
    }
    return memoryStockAgingPolicies!;
  },

  savePolicies(policies: StockAgingPolicyConfig[]): void {
    memoryStockAgingPolicies = JSON.parse(JSON.stringify(policies));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_STOCK_AGING_POLICIES, JSON.stringify(policies));
      } catch {
        // ignore
      }
    }
  },

  validateBuckets(buckets: StockAgingBucketDefinition[]): { valid: boolean; message: string } {
    if (!buckets || buckets.length < 2) {
      return { valid: false, message: 'At least 2 stock aging buckets are required.' };
    }
    if (buckets[0].fromDays !== 0) {
      return { valid: false, message: 'First stock aging bucket must start at 0 days.' };
    }
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (b.fromDays > b.toDays) {
        return { valid: false, message: `Bucket "${b.label}" has fromDays > toDays.` };
      }
      if (i > 0 && b.fromDays !== buckets[i - 1].toDays + 1) {
        return {
          valid: false,
          message: `Gap or overlap between "${buckets[i - 1].label}" and "${b.label}".`,
        };
      }
    }
    return { valid: true, message: 'Stock aging buckets validated.' };
  },

  getEffectivePolicy(params: {
    companyId: string;
    branchId?: string;
    warehouseCode?: string;
    itemCategory?: string;
    asOfDate?: string;
  }): StockAgingPolicyConfig {
    const normCo = normalizeCompanyId(params.companyId);
    const normBr = params.branchId && params.branchId !== 'ALL' ? normalizeBranchId(params.branchId) : 'ALL';
    const asOf = (params.asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 10);

    const active = this.getPolicies()
      .filter((p) => {
        if (p.status !== 'ACTIVE') return false;
        if (normalizeCompanyId(p.companyId) !== normCo) return false;
        if (p.effectiveFrom > asOf) return false;
        if (p.effectiveUntil && p.effectiveUntil < asOf) return false;
        const brMatch = p.branchId === 'ALL' || normalizeBranchId(p.branchId) === normBr;
        const whMatch =
          !params.warehouseCode ||
          p.warehouseCode === 'ALL' ||
          p.warehouseCode.toUpperCase() === params.warehouseCode.toUpperCase();
        const catMatch =
          !params.itemCategory ||
          p.itemCategory === 'ALL' ||
          p.itemCategory.toLowerCase() === params.itemCategory.toLowerCase();
        return brMatch && whMatch && catMatch;
      })
      .sort((a, b) => {
        const sA = (a.branchId !== 'ALL' ? 4 : 0) + (a.warehouseCode !== 'ALL' ? 2 : 0) + (a.itemCategory !== 'ALL' ? 1 : 0);
        const sB = (b.branchId !== 'ALL' ? 4 : 0) + (b.warehouseCode !== 'ALL' ? 2 : 0) + (b.itemCategory !== 'ALL' ? 1 : 0);
        if (sB !== sA) return sB - sA;
        return b.version - a.version;
      });

    if (active.length > 0) return JSON.parse(JSON.stringify(active[0]));

    return {
      id: `stk-age-fallback-${normCo}`,
      companyId: normCo,
      branchId: 'ALL',
      warehouseCode: 'ALL',
      itemCategory: 'ALL',
      isEnabled: true,
      expiryValidationEnabled: true,
      excludeExpiredFromAvailable: true,
      nearExpiryThresholdDays: 30,
      secondaryExpiryThresholdDays: 60,
      criticalExpiryThresholdDays: 90,
      issueMethod: 'FEFO',
      buckets: JSON.parse(JSON.stringify(DEFAULT_STOCK_AGING_BUCKETS)),
      version: 1,
      effectiveFrom: '2026-01-01',
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
      updatedBy: 'System Default',
    };
  },

  savePolicyConfig(
    config: Omit<StockAgingPolicyConfig, 'id' | 'version' | 'status' | 'updatedAt'>,
    actor: { id: string; name: string },
    user?: User
  ): StockAgingPolicyConfig {
    if (user && !rbacPermissionService.hasPermission(user, 'INVENTORY_AGING_CONFIG_MANAGE')) {
      throw new Error('RBAC Authorization Denied: User lacks INVENTORY_AGING_CONFIG_MANAGE permission.');
    }
    const validation = this.validateBuckets(config.buckets);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const policies = this.getPolicies();
    const normCo = normalizeCompanyId(config.companyId);
    const normBr = config.branchId === 'ALL' ? 'ALL' : normalizeBranchId(config.branchId);

    const existingIdx = policies.findIndex(
      (p) =>
        p.status === 'ACTIVE' &&
        normalizeCompanyId(p.companyId) === normCo &&
        (p.branchId === 'ALL' ? 'ALL' : normalizeBranchId(p.branchId)) === normBr &&
        p.warehouseCode === (config.warehouseCode || 'ALL') &&
        p.itemCategory === (config.itemCategory || 'ALL')
    );

    let nextVersion = 1;
    let prevCopy: StockAgingPolicyConfig | undefined;
    if (existingIdx >= 0) {
      prevCopy = { ...policies[existingIdx] };
      nextVersion = policies[existingIdx].version + 1;
      policies[existingIdx] = {
        ...policies[existingIdx],
        status: 'SUPERSEDED',
        effectiveUntil: config.effectiveFrom || new Date().toISOString().slice(0, 10),
      };
    }

    const created: StockAgingPolicyConfig = {
      ...config,
      id: `stk-age-${normCo}-${normBr}-v${nextVersion}-${Date.now()}`,
      companyId: normCo,
      branchId: normBr,
      version: nextVersion,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
      updatedBy: actor.name,
    };

    policies.unshift(created);
    this.savePolicies(policies);

    EnterpriseAuditService.logEvent({
      companyId: normCo,
      branchId: normBr === 'ALL' ? undefined : normBr,
      entityType: 'STOCK_AGING',
      entityId: created.id,
      eventType: 'STOCK_AGING_POLICY_UPDATED',
      eventDescription: `Stock Aging Policy v${nextVersion} saved (${created.issueMethod}, Near-Expiry ${created.nearExpiryThresholdDays}d)`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: config.changeReason || 'Stock Aging policy configuration update',
      previousValue: prevCopy,
      newValue: created,
    });

    return created;
  },

  classifyAgeBucket(
    ageDays: number | null,
    buckets: StockAgingBucketDefinition[]
  ): { key: string; label: string } {
    if (ageDays === null || !Number.isFinite(ageDays)) {
      return { key: 'DATA_UNAVAILABLE', label: 'Data Unavailable' };
    }
    const safeAge = Math.max(0, Math.floor(ageDays));
    const found = buckets.find((b) => safeAge >= b.fromDays && safeAge <= b.toDays);
    return found ? { key: found.key, label: found.label } : { key: 'UNCLASSIFIED', label: 'Unclassified' };
  },

  evaluateBalances(params: {
    balances: InventoryBalanceRecord[];
    companyId: string;
    branchId?: string;
    itemCode?: string;
    asOfDate?: string;
    policyOverride?: StockAgingPolicyConfig;
  }): ItemStockAgingSummary {
    const asOf = (params.asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const first = params.balances[0];
    const policy =
      params.policyOverride ||
      this.getEffectivePolicy({
        companyId: params.companyId,
        branchId: params.branchId || first?.branchId,
        warehouseCode: first?.warehouseCode,
        itemCategory: first?.itemCategory,
        asOfDate: asOf,
      });

    const analyzed: StockBatchAgingAnalysis[] = [];

    for (const bal of params.balances) {
      const batchList: InventoryBatchLotRecord[] =
        bal.batches && bal.batches.length > 0
          ? bal.batches
          : bal.physicalStock > 0
          ? [
              {
                batchNo: `BAL-${bal.warehouseCode}`,
                warehouseCode: bal.warehouseCode,
                binLocation: bal.inventoryLocation,
                receiptDate: null, // NEVER fabricate receipt date when missing!
                expiryDate: null,
                isPerishable: Boolean(bal.isPerishable),
                quantity: bal.physicalStock,
                reservedQuantity: bal.reservedStock,
                qualityStatus: 'RELEASED',
              },
            ]
          : [];

      for (const batch of batchList) {
        const netBatchQty = Math.max(0, Number(batch.quantity || 0) - Number(batch.reservedQuantity || 0));
        const hasReceiptDate = Boolean(batch.receiptDate && batch.receiptDate.trim());
        const ageDays = hasReceiptDate ? daysBetween(batch.receiptDate!, asOf) : null;
        const bucket = this.classifyAgeBucket(ageDays, policy.buckets);

        const isPerishableItem = batch.isPerishable ?? bal.isPerishable ?? Boolean(batch.expiryDate);
        let expiryStatus: BatchExpiryStatus = 'NOT_APPLICABLE';
        let daysToExpiry: number | null = null;
        let expiryDateDisplay = 'Not Applicable';

        if (isPerishableItem) {
          if (!batch.expiryDate || !batch.expiryDate.trim()) {
            expiryStatus = 'DATA_UNAVAILABLE';
            expiryDateDisplay = 'Data Unavailable';
          } else {
            expiryDateDisplay = batch.expiryDate.slice(0, 10);
            daysToExpiry = daysBetween(asOf, expiryDateDisplay);
            if (daysToExpiry !== null && daysToExpiry < 0) {
              expiryStatus = 'EXPIRED';
            } else if (
              daysToExpiry !== null &&
              daysToExpiry <= policy.nearExpiryThresholdDays
            ) {
              expiryStatus = 'NEAR_EXPIRY';
            } else {
              expiryStatus = 'VALID';
            }
          }
        }

        const isExcludedForExpiry =
          policy.expiryValidationEnabled &&
          policy.excludeExpiredFromAvailable &&
          expiryStatus === 'EXPIRED';

        const isReleased = !batch.qualityStatus || batch.qualityStatus === 'RELEASED';
        const usableQuantity = isExcludedForExpiry || !isReleased ? 0 : netBatchQty;

        analyzed.push({
          companyId: bal.companyId,
          branchId: bal.branchId,
          warehouseCode: batch.warehouseCode || bal.warehouseCode,
          warehouseName: bal.warehouseName,
          binLocation: batch.binLocation || bal.inventoryLocation,
          itemCode: bal.itemCode,
          itemDescription: bal.itemDescription,
          itemCategory: bal.itemCategory,
          uom: bal.uom,
          batchNo: batch.batchNo,
          receiptDateDisplay: hasReceiptDate ? batch.receiptDate!.slice(0, 10) : 'Data Unavailable',
          stockAgeDays: ageDays,
          agingBucketLabel: bucket.label,
          agingBucketKey: bucket.key,
          expiryDateDisplay,
          daysToExpiry,
          expiryStatus,
          quantity: Number(batch.quantity || 0),
          usableQuantity,
          recommendedDispatchRank: 0,
          issueMethodApplied: policy.issueMethod,
        });
      }
    }

    // Order usable batches by FEFO or FIFO
    const usableBatches = analyzed.filter((b) => b.usableQuantity > 0);
    usableBatches.sort((a, b) => {
      if (policy.issueMethod === 'FEFO') {
        const expA = a.daysToExpiry ?? Number.MAX_SAFE_INTEGER;
        const expB = b.daysToExpiry ?? Number.MAX_SAFE_INTEGER;
        if (expA !== expB) return expA - expB;
      }
      // FIFO fallback: oldest stock age (largest ageDays) first
      const ageA = a.stockAgeDays ?? -1;
      const ageB = b.stockAgeDays ?? -1;
      if (ageB !== ageA) return ageB - ageA;
      return a.batchNo.localeCompare(b.batchNo);
    });

    usableBatches.forEach((b, idx) => {
      b.recommendedDispatchRank = idx + 1;
    });

    const bucketTotals = policy.buckets.map((bk) => ({
      key: bk.key,
      label: bk.label,
      quantity: analyzed
        .filter((a) => a.agingBucketKey === bk.key)
        .reduce((sum, a) => sum + a.quantity, 0),
    }));

    const validAges = analyzed
      .map((a) => ({ age: a.stockAgeDays, date: a.receiptDateDisplay }))
      .filter((x) => x.age !== null) as Array<{ age: number; date: string }>;
    validAges.sort((a, b) => b.age - a.age);

    const validExpiries = analyzed
      .filter((a) => a.daysToExpiry !== null)
      .sort((a, b) => (a.daysToExpiry ?? 0) - (b.daysToExpiry ?? 0));

    return {
      itemCode: params.itemCode || first?.itemCode || '',
      uom: first?.uom || 'EA',
      configId: policy.id,
      configVersion: policy.version,
      totalAnalyzedQuantity: analyzed.reduce((sum, a) => sum + a.quantity, 0),
      usableNonExpiredQuantity: analyzed.reduce((sum, a) => sum + a.usableQuantity, 0),
      expiredQuantity: analyzed
        .filter((a) => a.expiryStatus === 'EXPIRED')
        .reduce((sum, a) => sum + a.quantity, 0),
      nearExpiryQuantity: analyzed
        .filter((a) => a.expiryStatus === 'NEAR_EXPIRY')
        .reduce((sum, a) => sum + a.quantity, 0),
      dataUnavailableQuantity: analyzed
        .filter((a) => a.agingBucketKey === 'DATA_UNAVAILABLE')
        .reduce((sum, a) => sum + a.quantity, 0),
      oldestReceiptDate: validAges[0]?.date || 'Data Unavailable',
      oldestStockAgeDays: validAges[0]?.age ?? null,
      earliestExpiryDate: validExpiries[0]?.expiryDateDisplay || 'Not Applicable',
      hasExpiredStock: analyzed.some((a) => a.expiryStatus === 'EXPIRED'),
      hasNearExpiryWarning: analyzed.some((a) => a.expiryStatus === 'NEAR_EXPIRY'),
      recommendedIssueMethod: policy.issueMethod,
      recommendedBatchSequence: usableBatches.map((b) => b.batchNo),
      bucketTotals,
      batches: analyzed,
    };
  },

  resetForTesting(): void {
    memoryStockAgingPolicies = JSON.parse(JSON.stringify(INITIAL_STOCK_AGING_POLICIES));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_STOCK_AGING_POLICIES);
      } catch {
        // ignore
      }
    }
  },
};
