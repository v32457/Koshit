/**
 * CIPPLATFORM — PART K: ENHANCED INVENTORY AVAILABILITY VALIDATION SERVICE
 *
 * Enterprise Capabilities:
 * - Company -> Branch -> Warehouse -> Item Category -> Item Policy Hierarchy (lower levels cannot weaken restrictive company rules)
 * - Default Cross-Branch Mode: VISIBILITY_ONLY (same company only; never counted as locally available; never crosses companies)
 * - Full Reuse of existing Warehouse Master (Branch.warehouses in kosh_branches / INITIAL_BRANCHES)
 * - Warehouse Priority Ordering, Availability Eligibility, Cross-Branch Visibility & Transfer Eligibility, Category/Item Restrictions
 * - Granular Stock Categories: Physical, Reserved, Allocated, Available, Incoming, In-Transit, Quality Inspection, Blocked, Rejected, Expired
 * - Batch/Lot & Expiry Exclusion Integration via inventoryAgingService (never fabricates receipt dates)
 * - 8 Stage-Gated Revalidation Stages with Immutable Snapshot & Delta History
 * - Formal Inter-Branch Stock Transfer Lifecycle (Request -> Approve -> Dispatch -> Receive) — NO virtual stock movement
 * - Mandatory RBAC Permission Enforcement & Hash-Chained Audit Trail
 */

import {
  InventoryValidationPolicyConfig,
  InventoryBalanceRecord,
  InventoryLineValidationResult,
  InventoryValidationSnapshot,
  InventoryExceptionApprovalRecord,
  InventoryValidationStage,
  WarehouseAvailabilityBreakdown,
  CompanyWideStockSummary,
  InventoryRevalidationDelta,
  InventoryTransferRecord,
  CrossBranchUsabilityMode,
} from '../types/procurementFinanceGovernance';
import { PurchaseRequisitionHeader } from '../types/purchaseRequisition';
import { Branch, User, Warehouse } from '../types';
import { INITIAL_BRANCHES } from '../data/seedData';
import { normalizeCompanyId, normalizeBranchId } from './prGovernancePolicyService';
import { EnterpriseAuditService } from './enterpriseAuditService';
import { rbacPermissionService } from './rbacPermissionService';
import { inventoryAgingService } from './inventoryAgingService';

const STORAGE_KEY_INV_POLICIES = 'cip_inventory_validation_policies_v2';
const STORAGE_KEY_INV_BALANCES = 'cip_inventory_warehouse_balances_v2';
const STORAGE_KEY_INV_EXCEPTIONS = 'cip_inventory_exception_approvals_v2';
const STORAGE_KEY_INV_TRANSFERS = 'cip_inventory_transfers_v1';

const CROSS_BRANCH_RESTRICTION_RANK: Record<CrossBranchUsabilityMode, number> = {
  DISABLED: 4,
  VISIBILITY_ONLY: 3,
  TRANSFER_REQUIRED: 2,
  AUTHORIZED_EXCEPTION: 1,
};

function getMasterBranches(): Branch[] {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('kosh_branches');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
  }
  return INITIAL_BRANCHES;
}

export const INITIAL_INVENTORY_POLICIES: InventoryValidationPolicyConfig[] = [
  {
    id: 'inv-pol-co1-default',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'ALL',
    branchCode: 'ALL',
    branchName: 'All Branches (Company Default)',
    warehouseCode: 'ALL',
    itemCategory: 'ALL',
    itemCode: 'ALL',
    inventoryLocation: 'ALL',
    isEnabled: true,
    validationStage: 'ON_PR_APPROVAL',
    revalidationStages: ['ON_PR_CREATION', 'ON_PR_SUBMISSION', 'ON_PR_APPROVAL', 'ON_PO_CREATION'],
    availableStockCalculation: 'PHYSICAL_MINUS_RESERVED',
    considerReservedStock: true,
    considerAllocatedStock: false,
    considerIncomingStock: true,
    includeQualityInspectionStock: false,
    includeBlockedStock: false,
    includeRejectedStock: false,
    stockVisibilityScope: 'COMPANY',
    crossBranchVisibilityEnabled: true,
    crossBranchUsability: 'VISIBILITY_ONLY',
    warehouseSelectionMode: 'PRIORITY_ORDER',
    inventoryAgingEnabled: true,
    prAgingEnabled: true,
    expiryValidationEnabled: true,
    excludeExpiredStock: true,
    nearExpiryThresholdDays: 30,
    enforcementMode: 'WARNING',
    version: 1,
    effectiveFrom: '2026-04-01',
    status: 'ACTIVE',
    createdBy: 'Platform Governance Admin',
    approvedBy: 'Chief Supply Chain Officer',
    updatedAt: '2026-04-01T08:00:00Z',
  },
  {
    id: 'inv-pol-br-hosur',
    companyId: 'co-kosh-02',
    companyCode: 'KOSH-SOUTH',
    branchId: 'br-hosr-03',
    branchCode: '003',
    branchName: 'Hosur OEM & Assembly Works',
    warehouseCode: 'HSR-STR',
    itemCategory: 'ALL',
    itemCode: 'ALL',
    inventoryLocation: 'ALL',
    isEnabled: true,
    validationStage: 'ON_PR_APPROVAL',
    revalidationStages: ['ON_PR_CREATION', 'ON_PR_SUBMISSION', 'ON_PR_APPROVAL', 'ON_PO_CREATION'],
    availableStockCalculation: 'PHYSICAL_MINUS_RESERVED',
    considerReservedStock: true,
    considerAllocatedStock: false,
    considerIncomingStock: true,
    includeQualityInspectionStock: false,
    includeBlockedStock: false,
    includeRejectedStock: false,
    stockVisibilityScope: 'COMPANY',
    crossBranchVisibilityEnabled: true,
    crossBranchUsability: 'TRANSFER_REQUIRED',
    warehouseSelectionMode: 'PRIORITY_ORDER',
    inventoryAgingEnabled: true,
    prAgingEnabled: true,
    expiryValidationEnabled: true,
    excludeExpiredStock: true,
    nearExpiryThresholdDays: 30,
    enforcementMode: 'REQUIRE_EXCEPTION_APPROVAL',
    version: 1,
    effectiveFrom: '2026-04-01',
    status: 'ACTIVE',
    createdBy: 'Hosur Plant Controller',
    approvedBy: 'VP Operations',
    updatedAt: '2026-04-01T08:30:00Z',
  },
];

export const INITIAL_INVENTORY_BALANCES: InventoryBalanceRecord[] = [
  {
    id: 'bal-001',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    branchName: 'Puducherry Main Plant & HQ',
    warehouseCode: 'PDY-STR',
    warehouseName: 'Puducherry Stores',
    inventoryLocation: 'BAY-A1',
    itemCode: 'RMPAOPOEXLG0001',
    itemDescription: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
    itemCategory: 'Raw Materials',
    uom: 'KG',
    physicalStock: 500,
    reservedStock: 100,
    allocatedStock: 0,
    incomingStock: 200,
    stockInTransit: 50,
    qualityInspectionStock: 35,
    blockedStock: 10,
    rejectedStock: 5,
    isPerishable: true,
    batches: [
      {
        batchNo: 'LOT-PDY-2026-01',
        warehouseCode: 'PDY-STR',
        binLocation: 'BAY-A1',
        receiptDate: '2026-08-10',
        expiryDate: '2027-06-30',
        isPerishable: true,
        quantity: 350,
        reservedQuantity: 100,
        qualityStatus: 'RELEASED',
      },
      {
        batchNo: 'LOT-PDY-2026-02',
        warehouseCode: 'PDY-STR',
        binLocation: 'BAY-A2',
        receiptDate: '2026-10-20',
        expiryDate: '2026-12-01', // Near expiry within 30 days
        isPerishable: true,
        quantity: 150,
        reservedQuantity: 0,
        qualityStatus: 'RELEASED',
      },
    ],
    lastUpdated: '2026-11-10T08:00:00Z',
  },
  {
    id: 'bal-001b',
    companyId: 'co-kosh-01',
    branchId: 'br-pune-04',
    branchName: 'Pune Western Region Plant & Main HQ',
    warehouseCode: 'PUN-STR',
    warehouseName: 'Pune Main Stores',
    inventoryLocation: 'RACK-P2',
    itemCode: 'RMPAOPOEXLG0001',
    itemDescription: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
    itemCategory: 'Raw Materials',
    uom: 'KG',
    physicalStock: 420,
    reservedStock: 20,
    allocatedStock: 0,
    incomingStock: 0,
    stockInTransit: 0,
    qualityInspectionStock: 0,
    blockedStock: 0,
    rejectedStock: 0,
    isPerishable: true,
    batches: [
      {
        batchNo: 'LOT-PUN-2026-09',
        warehouseCode: 'PUN-STR',
        binLocation: 'RACK-P2',
        receiptDate: '2026-09-12',
        expiryDate: '2027-09-12',
        isPerishable: true,
        quantity: 420,
        reservedQuantity: 20,
        qualityStatus: 'RELEASED',
      },
    ],
    lastUpdated: '2026-11-10T09:00:00Z',
  },
  {
    id: 'bal-002',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    branchName: 'Puducherry Main Plant & HQ',
    warehouseCode: 'PDY-STR',
    warehouseName: 'Puducherry Stores',
    inventoryLocation: 'BAY-B2',
    itemCode: 'RM-ALLOY-316L',
    itemDescription: 'Stainless Steel 316L Alloy Plates 12mm',
    itemCategory: 'Raw Materials',
    uom: 'KG',
    physicalStock: 500,
    reservedStock: 100,
    allocatedStock: 0,
    incomingStock: 200,
    stockInTransit: 0,
    qualityInspectionStock: 0,
    blockedStock: 0,
    rejectedStock: 0,
    isPerishable: false,
    batches: [
      {
        batchNo: 'LOT-SS-2025-11',
        warehouseCode: 'PDY-STR',
        binLocation: 'BAY-B2',
        receiptDate: '2025-10-01', // >365 days critical age bucket
        expiryDate: null,
        isPerishable: false,
        quantity: 500,
        reservedQuantity: 100,
        qualityStatus: 'RELEASED',
      },
    ],
    lastUpdated: '2026-11-10T08:00:00Z',
  },
  {
    id: 'bal-003',
    companyId: 'co-kosh-02',
    branchId: 'br-hosr-03',
    branchName: 'Hosur OEM & Assembly Works',
    warehouseCode: 'HSR-STR',
    warehouseName: 'Hosur-Stores',
    inventoryLocation: 'RACK-F1',
    itemCode: 'PKG-FASTENER-M8',
    itemDescription: 'M8 x 45mm High-Tensile Grade 8.8 Hex Flange Bolts',
    itemCategory: 'Packaging & Fasteners',
    uom: 'BOX',
    physicalStock: 80,
    reservedStock: 20,
    allocatedStock: 10,
    incomingStock: 40,
    stockInTransit: 15,
    qualityInspectionStock: 10,
    blockedStock: 5,
    rejectedStock: 2,
    isPerishable: false,
    batches: [
      {
        batchNo: 'LOT-HSR-M8-01',
        warehouseCode: 'HSR-STR',
        binLocation: 'RACK-F1',
        receiptDate: '2026-07-01',
        expiryDate: null,
        isPerishable: false,
        quantity: 80,
        reservedQuantity: 20,
        qualityStatus: 'RELEASED',
      },
    ],
    lastUpdated: '2026-11-10T08:00:00Z',
  },
  {
    id: 'bal-003b',
    companyId: 'co-kosh-02',
    branchId: 'br-chen-02',
    branchName: 'Chennai Automotive Components Unit',
    warehouseCode: 'CHE-STR',
    warehouseName: 'Chennai Stores',
    inventoryLocation: 'RACK-C4',
    itemCode: 'PKG-FASTENER-M8',
    itemDescription: 'M8 x 45mm High-Tensile Grade 8.8 Hex Flange Bolts',
    itemCategory: 'Packaging & Fasteners',
    uom: 'BOX',
    physicalStock: 120,
    reservedStock: 10,
    allocatedStock: 0,
    incomingStock: 0,
    stockInTransit: 0,
    qualityInspectionStock: 0,
    blockedStock: 0,
    rejectedStock: 0,
    isPerishable: false,
    lastUpdated: '2026-11-10T08:30:00Z',
  },
  {
    id: 'bal-004',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    branchName: 'Puducherry Main Plant & HQ',
    warehouseCode: 'PDY-FG',
    warehouseName: 'Puducherry Finished Goods',
    inventoryLocation: 'BIN-M04',
    itemCode: 'MAPALBL0003',
    itemDescription: 'Pneumatic Solenoid Valve – 5/2 Way Single Solenoid – 24V DC G1/4"',
    itemCategory: 'Maintenance & Spares',
    uom: 'EA',
    physicalStock: 5,
    reservedStock: 2,
    allocatedStock: 0,
    incomingStock: 10,
    stockInTransit: 0,
    qualityInspectionStock: 0,
    blockedStock: 0,
    rejectedStock: 0,
    isPerishable: false,
    lastUpdated: '2026-11-10T08:00:00Z',
  },
  {
    id: 'bal-005',
    companyId: 'co-kosh-01',
    branchId: 'br-pune-04',
    branchName: 'Pune Western Region Plant & Main HQ',
    warehouseCode: 'PUN-STR',
    warehouseName: 'Pune Main Stores',
    inventoryLocation: 'ZONE-C2',
    itemCode: 'FGHDMCRGY0002',
    itemDescription: 'HDPE Corrugated Protective Sleeve – 35mm OD – Industrial Grey',
    itemCategory: 'Finished Goods',
    uom: 'MTR',
    physicalStock: 1500,
    reservedStock: 300,
    allocatedStock: 0,
    incomingStock: 500,
    stockInTransit: 0,
    qualityInspectionStock: 0,
    blockedStock: 0,
    rejectedStock: 0,
    isPerishable: false,
    lastUpdated: '2026-11-10T08:00:00Z',
  },
];

let memoryPolicies: InventoryValidationPolicyConfig[] | null = null;
let memoryBalances: InventoryBalanceRecord[] | null = null;
let memoryExceptions: InventoryExceptionApprovalRecord[] | null = null;
let memoryTransfers: InventoryTransferRecord[] | null = null;

function clampPolicyWithCompanyCeiling(
  specific: InventoryValidationPolicyConfig,
  companyDefault: InventoryValidationPolicyConfig | undefined
): InventoryValidationPolicyConfig {
  if (!companyDefault || specific.id === companyDefault.id) return specific;

  const result = { ...specific };
  // Company cross-branch restriction ceiling: lower levels cannot weaken restrictive company rules
  const companyCbEnabled = companyDefault.crossBranchVisibilityEnabled !== false;
  if (!companyCbEnabled) {
    result.crossBranchVisibilityEnabled = false;
  }

  const companyMode = companyDefault.crossBranchUsability || 'VISIBILITY_ONLY';
  const branchMode = result.crossBranchUsability || companyMode;
  if (CROSS_BRANCH_RESTRICTION_RANK[companyMode] > CROSS_BRANCH_RESTRICTION_RANK[branchMode]) {
    result.crossBranchUsability = companyMode;
  }

  // If company disables cross-branch usability, enforce DISABLED
  if (companyMode === 'DISABLED') {
    result.crossBranchVisibilityEnabled = false;
    result.crossBranchUsability = 'DISABLED';
  }
  return result;
}

function getWarehouseMeta(
  branches: Branch[],
  branchId: string,
  warehouseCode: string
): { branch?: Branch; warehouse?: Warehouse } {
  const normBr = normalizeBranchId(branchId);
  const branch = branches.find(
    (b) => normalizeBranchId(b.id) === normBr || b.code === branchId || b.portalBranchCode === branchId
  );
  if (!branch) return {};
  const warehouse = (branch.warehouses || []).find(
    (w) => w.warehouseCode.toUpperCase() === warehouseCode.toUpperCase()
  );
  return { branch, warehouse };
}

function checkWarehouseEligibility(
  wh: Warehouse | undefined,
  itemCode: string,
  itemCategory?: string
): { eligible: boolean; reason?: string } {
  if (!wh) {
    return { eligible: true };
  }
  if (wh.isInactive) {
    return { eligible: false, reason: 'Warehouse Inactive' };
  }
  if (wh.isAvailableForValidation === false) {
    return { eligible: false, reason: 'Excluded from PR Availability Validation' };
  }
  if (wh.isNettable === false && wh.isAvailableForValidation !== true) {
    return { eligible: false, reason: 'Non-Nettable / Quarantine Warehouse' };
  }
  if (
    wh.restrictedItemCategories &&
    wh.restrictedItemCategories.length > 0 &&
    itemCategory &&
    !wh.restrictedItemCategories.some((c) => c.toLowerCase() === itemCategory.toLowerCase())
  ) {
    return { eligible: false, reason: `Restricted to categories: ${wh.restrictedItemCategories.join(', ')}` };
  }
  if (
    wh.restrictedItemCodes &&
    wh.restrictedItemCodes.length > 0 &&
    !wh.restrictedItemCodes.includes(itemCode)
  ) {
    return { eligible: false, reason: 'Item not in warehouse allowlist' };
  }
  return { eligible: true };
}

export const inventoryValidationService = {
  getPolicies(): InventoryValidationPolicyConfig[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_INV_POLICIES);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // ignore
      }
    }
    if (!memoryPolicies) {
      memoryPolicies = JSON.parse(JSON.stringify(INITIAL_INVENTORY_POLICIES));
    }
    return memoryPolicies!;
  },

  savePolicies(policies: InventoryValidationPolicyConfig[]): void {
    memoryPolicies = JSON.parse(JSON.stringify(policies));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_INV_POLICIES, JSON.stringify(policies));
      } catch {
        // ignore
      }
    }
  },

  getBalances(): InventoryBalanceRecord[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_INV_BALANCES);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // ignore
      }
    }
    if (!memoryBalances) {
      memoryBalances = JSON.parse(JSON.stringify(INITIAL_INVENTORY_BALANCES));
    }
    return memoryBalances!;
  },

  saveBalances(balances: InventoryBalanceRecord[]): void {
    memoryBalances = JSON.parse(JSON.stringify(balances));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_INV_BALANCES, JSON.stringify(balances));
      } catch {
        // ignore
      }
    }
  },

  getExceptions(): InventoryExceptionApprovalRecord[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_INV_EXCEPTIONS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {
        // ignore
      }
    }
    if (!memoryExceptions) {
      memoryExceptions = [];
    }
    return memoryExceptions!;
  },

  saveExceptions(exceptions: InventoryExceptionApprovalRecord[]): void {
    memoryExceptions = JSON.parse(JSON.stringify(exceptions));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_INV_EXCEPTIONS, JSON.stringify(exceptions));
      } catch {
        // ignore
      }
    }
  },

  getTransfers(): InventoryTransferRecord[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_INV_TRANSFERS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {
        // ignore
      }
    }
    if (!memoryTransfers) {
      memoryTransfers = [];
    }
    return memoryTransfers!;
  },

  saveTransfers(transfers: InventoryTransferRecord[]): void {
    memoryTransfers = JSON.parse(JSON.stringify(transfers));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_INV_TRANSFERS, JSON.stringify(transfers));
      } catch {
        // ignore
      }
    }
  },

  resetForTesting(): void {
    memoryPolicies = JSON.parse(JSON.stringify(INITIAL_INVENTORY_POLICIES));
    memoryBalances = JSON.parse(JSON.stringify(INITIAL_INVENTORY_BALANCES));
    memoryExceptions = [];
    memoryTransfers = [];
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_INV_POLICIES);
        localStorage.removeItem(STORAGE_KEY_INV_BALANCES);
        localStorage.removeItem(STORAGE_KEY_INV_EXCEPTIONS);
        localStorage.removeItem(STORAGE_KEY_INV_TRANSFERS);
      } catch {
        // ignore
      }
    }
  },

  /**
   * Resolves effective Inventory Validation Policy using strict hierarchy:
   * Company -> Branch -> Warehouse -> Item Category -> Item.
   * Missing configuration safely defaults to crossBranchUsability = 'VISIBILITY_ONLY'.
   */
  getEffectivePolicy(params: {
    companyId: string;
    branchId?: string;
    warehouseCode?: string;
    itemCategory?: string;
    itemCode?: string;
    transactionDate?: string;
  }): InventoryValidationPolicyConfig {
    const normCo = normalizeCompanyId(params.companyId);
    const normBr =
      params.branchId && params.branchId !== 'ALL' ? normalizeBranchId(params.branchId) : 'ALL';
    const txDate = (params.transactionDate || new Date().toISOString().split('T')[0]).slice(0, 10);

    const activePolicies = this.getPolicies().filter((p) => {
      if (p.status !== 'ACTIVE') return false;
      if (normalizeCompanyId(p.companyId) !== normCo) return false;
      if (p.effectiveFrom && p.effectiveFrom > txDate) return false;
      if (p.effectiveUntil && p.effectiveUntil < txDate) return false;
      return true;
    });

    const companyDefault = activePolicies
      .filter((p) => p.branchId === 'ALL' && p.warehouseCode === 'ALL' && p.itemCategory === 'ALL')
      .sort((a, b) => b.version - a.version)[0];

    const scored = activePolicies
      .filter((p) => {
        const brMatch = p.branchId === 'ALL' || normalizeBranchId(p.branchId) === normBr;
        const whMatch =
          !params.warehouseCode ||
          p.warehouseCode === 'ALL' ||
          p.warehouseCode.toUpperCase() === params.warehouseCode.toUpperCase();
        const catMatch =
          !params.itemCategory ||
          p.itemCategory === 'ALL' ||
          p.itemCategory.toLowerCase() === params.itemCategory.toLowerCase();
        const itemMatch =
          !params.itemCode ||
          !p.itemCode ||
          p.itemCode === 'ALL' ||
          p.itemCode.toUpperCase() === params.itemCode.toUpperCase();
        return brMatch && whMatch && catMatch && itemMatch;
      })
      .sort((a, b) => {
        const scoreA =
          (a.branchId !== 'ALL' ? 8 : 0) +
          (a.warehouseCode !== 'ALL' ? 4 : 0) +
          (a.itemCategory !== 'ALL' ? 2 : 0) +
          (a.itemCode && a.itemCode !== 'ALL' ? 1 : 0);
        const scoreB =
          (b.branchId !== 'ALL' ? 8 : 0) +
          (b.warehouseCode !== 'ALL' ? 4 : 0) +
          (b.itemCategory !== 'ALL' ? 2 : 0) +
          (b.itemCode && b.itemCode !== 'ALL' ? 1 : 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.version - a.version;
      });

    if (scored.length > 0) {
      const winner = JSON.parse(JSON.stringify(scored[0])) as InventoryValidationPolicyConfig;
      return clampPolicyWithCompanyCeiling(
        {
          crossBranchVisibilityEnabled: true,
          crossBranchUsability: 'VISIBILITY_ONLY',
          stockVisibilityScope: 'COMPANY',
          warehouseSelectionMode: 'PRIORITY_ORDER',
          inventoryAgingEnabled: true,
          prAgingEnabled: true,
          expiryValidationEnabled: true,
          excludeExpiredStock: true,
          nearExpiryThresholdDays: 30,
          ...winner,
        },
        companyDefault
      );
    }

    return {
      id: `inv-pol-default-${normCo}`,
      companyId: normCo,
      companyCode: 'KOSH-HQ',
      branchId: normBr,
      branchCode: normBr,
      branchName: 'Default Branch',
      warehouseCode: 'ALL',
      itemCategory: 'ALL',
      itemCode: 'ALL',
      inventoryLocation: 'ALL',
      isEnabled: true,
      validationStage: 'ON_PR_APPROVAL',
      revalidationStages: ['ON_PR_CREATION', 'ON_PR_SUBMISSION', 'ON_PR_APPROVAL', 'ON_PO_CREATION'],
      availableStockCalculation: 'PHYSICAL_MINUS_RESERVED',
      considerReservedStock: true,
      considerAllocatedStock: false,
      considerIncomingStock: true,
      includeQualityInspectionStock: false,
      includeBlockedStock: false,
      includeRejectedStock: false,
      stockVisibilityScope: 'COMPANY',
      crossBranchVisibilityEnabled: true,
      crossBranchUsability: 'VISIBILITY_ONLY',
      warehouseSelectionMode: 'PRIORITY_ORDER',
      inventoryAgingEnabled: true,
      prAgingEnabled: true,
      expiryValidationEnabled: true,
      excludeExpiredStock: true,
      nearExpiryThresholdDays: 30,
      enforcementMode: 'WARNING',
      version: 1,
      effectiveFrom: '2026-01-01',
      status: 'ACTIVE',
      createdBy: 'System Default',
      updatedAt: new Date().toISOString(),
    };
  },

  /**
   * Saves a new versioned Inventory Validation Policy (marking superseded versions immutably).
   */
  savePolicyConfig(
    config: Omit<InventoryValidationPolicyConfig, 'id' | 'version' | 'status' | 'updatedAt'> & {
      id?: string;
    },
    actorName: string = 'Governance Admin',
    user?: User
  ): InventoryValidationPolicyConfig {
    if (user && !rbacPermissionService.hasPermission(user, 'INVENTORY_VALIDATION_CONFIG_MANAGE')) {
      throw new Error('RBAC Authorization Denied: User lacks INVENTORY_VALIDATION_CONFIG_MANAGE permission.');
    }

    const policies = this.getPolicies();
    const normCo = normalizeCompanyId(config.companyId);
    const normBr = config.branchId === 'ALL' ? 'ALL' : normalizeBranchId(config.branchId);

    // Enforce company-level ceiling on save too when branch override weakens restrictive company policy
    if (normBr !== 'ALL') {
      const companyDefault = this.getEffectivePolicy({ companyId: normCo, branchId: 'ALL' });
      const companyMode = companyDefault.crossBranchUsability || 'VISIBILITY_ONLY';
      const reqMode = config.crossBranchUsability || 'VISIBILITY_ONLY';
      if (CROSS_BRANCH_RESTRICTION_RANK[companyMode] > CROSS_BRANCH_RESTRICTION_RANK[reqMode]) {
        throw new Error(
          `Policy Hierarchy Violation: Company policy restricts cross-branch mode to ${companyMode}; lower-level branch/warehouse cannot weaken it to ${reqMode}.`
        );
      }
    }

    const existingActiveIdx = policies.findIndex(
      (p) =>
        p.status === 'ACTIVE' &&
        normalizeCompanyId(p.companyId) === normCo &&
        (p.branchId === 'ALL' ? 'ALL' : normalizeBranchId(p.branchId)) === normBr &&
        p.warehouseCode === (config.warehouseCode || 'ALL') &&
        p.itemCategory === (config.itemCategory || 'ALL') &&
        (p.itemCode || 'ALL') === (config.itemCode || 'ALL')
    );

    let nextVersion = 1;
    let previousPolicy: InventoryValidationPolicyConfig | undefined;
    if (existingActiveIdx >= 0) {
      previousPolicy = { ...policies[existingActiveIdx] };
      nextVersion = policies[existingActiveIdx].version + 1;
      policies[existingActiveIdx] = {
        ...policies[existingActiveIdx],
        status: 'SUPERSEDED',
        effectiveUntil: config.effectiveFrom || new Date().toISOString().split('T')[0],
      };
    }

    const newPolicy: InventoryValidationPolicyConfig = {
      crossBranchVisibilityEnabled: true,
      crossBranchUsability: 'VISIBILITY_ONLY',
      stockVisibilityScope: 'COMPANY',
      warehouseSelectionMode: 'PRIORITY_ORDER',
      inventoryAgingEnabled: true,
      prAgingEnabled: true,
      expiryValidationEnabled: true,
      excludeExpiredStock: true,
      nearExpiryThresholdDays: 30,
      ...config,
      id: `inv-pol-${normCo}-${normBr}-v${nextVersion}-${Date.now()}`,
      companyId: normCo,
      branchId: normBr,
      previousPolicyVersion: previousPolicy?.version,
      version: nextVersion,
      status: 'ACTIVE',
      createdBy: config.createdBy || actorName,
      updatedAt: new Date().toISOString(),
    };

    policies.unshift(newPolicy);
    this.savePolicies(policies);

    EnterpriseAuditService.logEvent({
      companyId: normCo,
      branchId: normBr === 'ALL' ? undefined : normBr,
      entityType: 'INVENTORY_VALIDATION',
      entityId: newPolicy.id,
      eventType: 'INVENTORY_POLICY_UPDATED',
      eventDescription: `Inventory Validation Policy v${nextVersion} activated (Mode: ${newPolicy.enforcementMode}, Cross-Branch: ${newPolicy.crossBranchUsability})`,
      changedByUserId: user?.id || 'usr-admin',
      changedByName: actorName,
      changeReason: config.changeReason || 'Inventory Validation policy update',
      previousValue: previousPolicy,
      newValue: newPolicy,
    });

    return newPolicy;
  },

  upsertInventoryBalance(balance: Partial<InventoryBalanceRecord> & { itemCode: string }): InventoryBalanceRecord {
    const balances = this.getBalances();
    const normCo = balance.companyId ? normalizeCompanyId(balance.companyId) : 'co-kosh-01';
    const normBr = balance.branchId ? normalizeBranchId(balance.branchId) : 'br-pond-01';
    const whCode = balance.warehouseCode || 'PDY-STR';

    const idx = balances.findIndex(
      (b) =>
        b.itemCode === balance.itemCode &&
        normalizeCompanyId(b.companyId) === normCo &&
        normalizeBranchId(b.branchId) === normBr &&
        (!balance.warehouseCode || b.warehouseCode.toUpperCase() === whCode.toUpperCase())
    );

    if (idx >= 0) {
      balances[idx] = {
        ...balances[idx],
        ...balance,
        companyId: normCo,
        branchId: normBr,
        warehouseCode: whCode,
        lastUpdated: new Date().toISOString(),
      };
      this.saveBalances(balances);
      return balances[idx];
    }

    const created: InventoryBalanceRecord = {
      id: `bal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      companyId: normCo,
      branchId: normBr,
      branchName: balance.branchName || normBr,
      warehouseCode: whCode,
      warehouseName: balance.warehouseName || `${whCode} Warehouse`,
      inventoryLocation: balance.inventoryLocation || 'BAY-01',
      itemCode: balance.itemCode,
      itemDescription: balance.itemDescription || balance.itemCode,
      itemCategory: balance.itemCategory || 'Raw Materials',
      uom: balance.uom || 'KG',
      physicalStock: balance.physicalStock ?? 0,
      reservedStock: balance.reservedStock ?? 0,
      allocatedStock: balance.allocatedStock ?? 0,
      incomingStock: balance.incomingStock ?? 0,
      stockInTransit: balance.stockInTransit ?? 0,
      qualityInspectionStock: balance.qualityInspectionStock ?? 0,
      blockedStock: balance.blockedStock ?? 0,
      rejectedStock: balance.rejectedStock ?? 0,
      isPerishable: balance.isPerishable ?? false,
      batches: balance.batches,
      lastUpdated: new Date().toISOString(),
    };

    balances.push(created);
    this.saveBalances(balances);
    return created;
  },

  /**
   * Computes warehouse-level availability breakdown for a given balance record + policy.
   */
  evaluateWarehouseBalanceRow(
    bal: InventoryBalanceRecord,
    policy: InventoryValidationPolicyConfig,
    branches: Branch[],
    asOfDate?: string
  ): WarehouseAvailabilityBreakdown {
    const { branch, warehouse } = getWarehouseMeta(branches, bal.branchId, bal.warehouseCode);
    const elig = checkWarehouseEligibility(warehouse, bal.itemCode, bal.itemCategory);

    // Evaluate batches if present for expired stock exclusion & FIFO/FEFO order
    let expiredExcludedStock = 0;
    let recommendedIssueMethod: 'FIFO' | 'FEFO' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE';
    let recommendedBatchOrder: string[] = [];

    if (bal.batches && bal.batches.length > 0) {
      const agingSummary = inventoryAgingService.evaluateBalances({
        balances: [bal],
        companyId: bal.companyId,
        branchId: bal.branchId,
        itemCode: bal.itemCode,
        asOfDate,
      });
      if (policy.expiryValidationEnabled !== false && policy.excludeExpiredStock !== false) {
        expiredExcludedStock = agingSummary.expiredQuantity;
      }
      recommendedIssueMethod = agingSummary.recommendedIssueMethod;
      recommendedBatchOrder = agingSummary.recommendedBatchSequence;
    }

    const physicalStock = Number(bal.physicalStock || 0);
    const reservedStock = Number(bal.reservedStock || 0);
    const allocatedStock = Number(bal.allocatedStock || 0);
    const incomingStock = Number(bal.incomingStock || 0);
    const stockInTransit = Number(bal.stockInTransit || 0);
    const qualityInspectionStock = Number(bal.qualityInspectionStock || 0);
    const blockedStock = Number(bal.blockedStock || 0);
    const rejectedStock = Number(bal.rejectedStock || 0);

    const reservedDeduction = policy.considerReservedStock ? reservedStock : 0;
    const allocatedDeduction =
      policy.availableStockCalculation === 'PHYSICAL_MINUS_RESERVED_AND_ALLOCATED' ||
      policy.considerAllocatedStock
        ? allocatedStock
        : 0;

    // QC / Blocked / Rejected are only added if explicitly configured (default false)
    const qcBonus = policy.includeQualityInspectionStock ? qualityInspectionStock : 0;
    const blockedBonus = policy.includeBlockedStock ? blockedStock : 0;
    const rejectedBonus = policy.includeRejectedStock ? rejectedStock : 0;

    // Incoming Stock and Stock in Transit are NEVER treated as physically available
    const rawAvailable = Math.max(
      0,
      physicalStock - reservedDeduction - allocatedDeduction - expiredExcludedStock + qcBonus + blockedBonus + rejectedBonus
    );
    const availableStock = elig.eligible ? rawAvailable : 0;
    const expectedAvailableStock = policy.considerIncomingStock
      ? availableStock + incomingStock
      : availableStock;

    return {
      companyId: normalizeCompanyId(bal.companyId),
      branchId: normalizeBranchId(bal.branchId),
      branchName: branch?.name || bal.branchName || bal.branchId,
      warehouseCode: bal.warehouseCode,
      warehouseName: warehouse?.warehouseName || bal.warehouseName,
      warehouseType: warehouse?.warehouseType || 'GENERAL',
      warehousePriority: warehouse?.warehousePriority ?? (warehouse?.isDefault ? 1 : 10),
      inventoryLocation: bal.inventoryLocation || 'DEFAULT-BIN',
      eligibleForLocalValidation: elig.eligible,
      exclusionReason: elig.reason,
      isCrossBranchVisible:
        warehouse?.isCrossBranchVisible !== undefined
          ? warehouse.isCrossBranchVisible
          : warehouse?.isNettable !== false && !warehouse?.isInactive,
      isCrossBranchTransferEligible:
        warehouse?.isCrossBranchTransferEligible !== undefined
          ? warehouse.isCrossBranchTransferEligible
          : warehouse?.isNettable !== false && !warehouse?.isInactive,
      physicalStock,
      reservedStock,
      allocatedStock,
      expiredExcludedStock,
      availableStock,
      incomingStock,
      stockInTransit,
      qualityInspectionStock,
      blockedStock,
      rejectedStock,
      expectedAvailableStock,
      recommendedIssueMethod,
      recommendedBatchOrder,
    };
  },

  /**
   * Authoritative Inventory Availability Calculation for a single item/line:
   * - Strictly isolates by Company & Branch! Never leaks another branch or company's stock into local availableStock.
   * - Evaluates multiple eligible warehouses in the requesting branch ordered by priority.
   * - Separately builds Company-Wide Cross-Branch visibility summary when both policy AND user RBAC permit.
   */
  calculateLineAvailability(params: {
    companyId: string;
    branchId: string;
    warehouseCode?: string;
    itemCode: string;
    itemDescription?: string;
    itemCategory?: string;
    uom?: string;
    requiredPrQuantity: number;
    originalRequestedQuantity?: number;
    lineId?: string;
    policy?: InventoryValidationPolicyConfig;
    user?: User;
    asOfDate?: string;
    hasApprovedCrossBranchException?: boolean;
  }): InventoryLineValidationResult {
    const normCo = normalizeCompanyId(params.companyId);
    const normBr = normalizeBranchId(params.branchId);
    const branches = getMasterBranches();

    // Validate requested warehouse ownership if specifically specified
    if (params.warehouseCode) {
      const allBranchWithWh = branches.find(
        (b) =>
          normalizeCompanyId(b.companyId || 'co-kosh-01') === normCo &&
          (b.warehouses || []).some(
            (w) => w.warehouseCode.toUpperCase() === params.warehouseCode!.toUpperCase()
          )
      );
      if (allBranchWithWh && normalizeBranchId(allBranchWithWh.id) !== normBr) {
        throw new Error(
          `Warehouse Ownership Violation: Warehouse ${params.warehouseCode} belongs to branch ${allBranchWithWh.name}, not requesting branch ${normBr}.`
        );
      }
    }

    const policy =
      params.policy ||
      this.getEffectivePolicy({
        companyId: normCo,
        branchId: normBr,
        warehouseCode: params.warehouseCode,
        itemCategory: params.itemCategory,
        itemCode: params.itemCode,
        transactionDate: params.asOfDate,
      });

    // Strict company isolation: NEVER inspect balances from another companyId
    const companyItemBalances = this.getBalances().filter(
      (b) =>
        b.itemCode === params.itemCode &&
        normalizeCompanyId(b.companyId) === normCo
    );

    const localBalancesRaw = companyItemBalances.filter((b) => {
      if (normalizeBranchId(b.branchId) !== normBr) return false;
      if (
        params.warehouseCode &&
        policy.warehouseSelectionMode === 'DEFAULT_WAREHOUSE_ONLY'
      ) {
        return (
          b.warehouseCode.toUpperCase() === params.warehouseCode.toUpperCase() ||
          params.warehouseCode.includes(b.warehouseCode)
        );
      }
      if (params.warehouseCode && policy.warehouseSelectionMode === 'SPECIFIC_WAREHOUSES') {
        return (
          b.warehouseCode.toUpperCase() === params.warehouseCode.toUpperCase() ||
          params.warehouseCode.includes(b.warehouseCode)
        );
      }
      return true;
    });

    const localBreakdowns = localBalancesRaw
      .map((b) => this.evaluateWarehouseBalanceRow(b, policy, branches, params.asOfDate))
      .sort((a, b) => a.warehousePriority - b.warehousePriority);

    // If specific warehouse requested on line and no warehouseSelectionMode excludes others, prioritize that warehouse first
    const targetedBreakdowns =
      params.warehouseCode && localBreakdowns.some((w) => w.warehouseCode === params.warehouseCode)
        ? localBreakdowns.sort((a, b) => {
            if (a.warehouseCode === params.warehouseCode) return -1;
            if (b.warehouseCode === params.warehouseCode) return 1;
            return a.warehousePriority - b.warehousePriority;
          })
        : localBreakdowns;

    const physicalStock = targetedBreakdowns.reduce((s, w) => s + w.physicalStock, 0);
    const reservedStock = targetedBreakdowns.reduce((s, w) => s + w.reservedStock, 0);
    const allocatedStock = targetedBreakdowns.reduce((s, w) => s + w.allocatedStock, 0);
    const incomingStock = targetedBreakdowns.reduce((s, w) => s + w.incomingStock, 0);
    const stockInTransit = targetedBreakdowns.reduce((s, w) => s + w.stockInTransit, 0);
    const qualityInspectionStock = targetedBreakdowns.reduce((s, w) => s + w.qualityInspectionStock, 0);
    const blockedStock = targetedBreakdowns.reduce((s, w) => s + w.blockedStock, 0);
    const rejectedStock = targetedBreakdowns.reduce((s, w) => s + w.rejectedStock, 0);
    const expiredStock = targetedBreakdowns.reduce((s, w) => s + w.expiredExcludedStock, 0);

    const localAvailableStock = targetedBreakdowns.reduce((s, w) => s + w.availableStock, 0);

    // Cross-branch same-company visibility check (BOTH policy AND user RBAC permission required)
    const crossBranchMode: CrossBranchUsabilityMode = policy.crossBranchUsability || 'VISIBILITY_ONLY';
    const policyAllowsCrossBranch =
      policy.stockVisibilityScope === 'COMPANY' &&
      policy.crossBranchVisibilityEnabled !== false &&
      crossBranchMode !== 'DISABLED';
    const rbacAllowsCrossBranch = params.user
      ? rbacPermissionService.hasPermission(params.user, 'INVENTORY_CROSS_BRANCH_STOCK_VIEW')
      : true;
    const crossBranchVisibilityPermitted = policyAllowsCrossBranch && rbacAllowsCrossBranch;

    let otherBranchRows: WarehouseAvailabilityBreakdown[] = [];
    let policyRestrictionMessage: string | undefined;

    if (!policyAllowsCrossBranch) {
      policyRestrictionMessage =
        'Cross-branch stock visibility is disabled by Company/Branch Inventory Policy.';
    } else if (!rbacAllowsCrossBranch) {
      policyRestrictionMessage =
        'Access Restricted: Your role does not hold INVENTORY_CROSS_BRANCH_STOCK_VIEW permission.';
    } else {
      otherBranchRows = companyItemBalances
        .filter((b) => normalizeBranchId(b.branchId) !== normBr)
        .map((b) => this.evaluateWarehouseBalanceRow(b, policy, branches, params.asOfDate))
        .filter((w) => w.isCrossBranchVisible);
    }

    const otherBranchVisibleStock = otherBranchRows.reduce((s, w) => s + w.availableStock, 0);
    const transferEligibleStock = otherBranchRows
      .filter((w) => w.isCrossBranchTransferEligible)
      .reduce((s, w) => s + w.availableStock, 0);
    const transferIneligibleStock = otherBranchRows
      .filter((w) => !w.isCrossBranchTransferEligible)
      .reduce((s, w) => s + w.availableStock, 0);

    // CRITICAL INVARIANT: Other-branch stock is NEVER counted as locally available unless AUTHORIZED_EXCEPTION is explicitly approved!
    const effectiveAvailableStock =
      crossBranchMode === 'AUTHORIZED_EXCEPTION' && params.hasApprovedCrossBranchException
        ? localAvailableStock + otherBranchVisibleStock
        : localAvailableStock;

    const expectedAvailableStock = policy.considerIncomingStock
      ? effectiveAvailableStock + incomingStock
      : effectiveAvailableStock;

    const requiredPrQuantity = Number(params.requiredPrQuantity) || 0;
    const originalRequestedQuantity =
      params.originalRequestedQuantity !== undefined
        ? Number(params.originalRequestedQuantity)
        : requiredPrQuantity;

    const shortageQuantity = Math.max(0, requiredPrQuantity - effectiveAvailableStock);
    const fulfillableFromStockQuantity = Math.min(requiredPrQuantity, effectiveAvailableStock);
    const isShortage = shortageQuantity > 0;
    const isStockAlreadyAvailable = effectiveAvailableStock >= requiredPrQuantity && requiredPrQuantity > 0;

    // Aging/near-expiry warnings on local balances
    const localAging =
      localBalancesRaw.length > 0
        ? inventoryAgingService.evaluateBalances({
            balances: localBalancesRaw,
            companyId: normCo,
            branchId: normBr,
            itemCode: params.itemCode,
            asOfDate: params.asOfDate,
          })
        : null;

    const companyWideSummary: CompanyWideStockSummary = {
      itemCode: params.itemCode,
      uom: params.uom || localBalancesRaw[0]?.uom || 'KG',
      crossBranchVisibilityPermitted,
      crossBranchPolicyMode: crossBranchMode,
      policyRestrictionMessage,
      localBranchEligibleStock: localAvailableStock,
      otherBranchVisibleStock: crossBranchVisibilityPermitted ? otherBranchVisibleStock : 0,
      companyWideVisibleTotal:
        localAvailableStock + (crossBranchVisibilityPermitted ? otherBranchVisibleStock : 0),
      transferEligibleStock: crossBranchVisibilityPermitted ? transferEligibleStock : 0,
      transferIneligibleStock: crossBranchVisibilityPermitted ? transferIneligibleStock : 0,
      localShortage: Math.max(0, requiredPrQuantity - localAvailableStock),
      potentialCompanySourcingShortage: Math.max(
        0,
        requiredPrQuantity -
          (localAvailableStock + (crossBranchVisibilityPermitted ? transferEligibleStock : 0))
      ),
      otherBranchRows,
    };

    const primaryWh = targetedBreakdowns[0];
    const calcSummary = `${policy.availableStockCalculation} (Reserved: ${
      policy.considerReservedStock ? 'Deducted' : 'Ignored'
    }, Incoming/In-Transit: Excluded, Expired: ${expiredStock})`;

    let message = '';
    if (!policy.isEnabled) {
      message = `Inventory validation disabled by policy (${policy.id} v${policy.version}).`;
    } else if (isShortage) {
      const xBranchHint =
        crossBranchVisibilityPermitted && transferEligibleStock > 0
          ? ` (${transferEligibleStock} ${params.uom || 'EA'} visible in other same-company branches under ${crossBranchMode})`
          : '';
      message = `Local shortage of ${shortageQuantity} ${
        params.uom || localBalancesRaw[0]?.uom || 'EA'
      } (Local Available: ${effectiveAvailableStock}, Required: ${requiredPrQuantity}, Incoming: ${incomingStock}, In-Transit: ${stockInTransit})${xBranchHint}.`;
    } else {
      message = `Full required quantity (${requiredPrQuantity} ${
        params.uom || localBalancesRaw[0]?.uom || 'EA'
      }) is physically available in local branch stock (Available: ${effectiveAvailableStock}).`;
    }

    return {
      lineId: params.lineId,
      itemCode: params.itemCode,
      itemDescription: params.itemDescription || localBalancesRaw[0]?.itemDescription || params.itemCode,
      itemCategory: params.itemCategory || localBalancesRaw[0]?.itemCategory || 'General',
      warehouseCode: primaryWh?.warehouseCode || params.warehouseCode || 'MAIN-WH',
      inventoryLocation: primaryWh?.inventoryLocation || 'DEFAULT-BIN',
      uom: params.uom || localBalancesRaw[0]?.uom || 'KG',
      physicalStock,
      reservedStock,
      allocatedStock,
      availableStock: effectiveAvailableStock,
      incomingStock,
      stockInTransit,
      qualityInspectionStock,
      blockedStock,
      rejectedStock,
      expiredStock,
      expectedAvailableStock,
      requiredPrQuantity,
      originalRequestedQuantity,
      shortageQuantity,
      fulfillableFromStockQuantity,
      isShortage,
      isStockAlreadyAvailable,
      hasNearExpiryWarning: localAging?.hasNearExpiryWarning || false,
      hasExpiredStockExcluded: expiredStock > 0,
      calculationMethodSummary: calcSummary,
      warehouseBreakdowns: targetedBreakdowns,
      companyWideSummary,
      stockAgingSummary: localAging || undefined,
      message,
    };
  },

  validateTransactionInventory(params: {
    prId?: string;
    prNumber?: string;
    companyId: string;
    branchId: string;
    stage: InventoryValidationStage;
    validatedBy: string;
    user?: User;
    lines: Array<{
      id?: string;
      itemCode: string;
      description?: string;
      itemCategory?: string;
      inventoryUom?: string;
      requestedQuantity: number;
      originalRequestedQuantity?: number;
      defaultWarehouse?: string;
    }>;
    transactionDate?: string;
    previousSnapshot?: InventoryValidationSnapshot;
  }): InventoryValidationSnapshot {
    const normCo = normalizeCompanyId(params.companyId);
    const normBr = normalizeBranchId(params.branchId);
    const firstWh = params.lines[0]?.defaultWarehouse;
    const firstCat = params.lines[0]?.itemCategory;

    const policy = this.getEffectivePolicy({
      companyId: normCo,
      branchId: normBr,
      warehouseCode: firstWh,
      itemCategory: firstCat,
      transactionDate: params.transactionDate,
    });

    const existingException = params.prId
      ? this.getExceptions().find(
          (e) =>
            (e.prId === params.prId || e.prNumber === params.prNumber) &&
            e.status === 'APPROVED'
        )
      : undefined;

    const hasCrossBranchException = Boolean(
      existingException && existingException.exceptionType === 'CROSS_BRANCH_EXCEPTION'
    );

    const lineResults: InventoryLineValidationResult[] = params.lines.map((line) =>
      this.calculateLineAvailability({
        companyId: normCo,
        branchId: normBr,
        warehouseCode: line.defaultWarehouse,
        itemCode: line.itemCode,
        itemDescription: line.description,
        itemCategory: line.itemCategory,
        uom: line.inventoryUom,
        requiredPrQuantity: line.requestedQuantity,
        originalRequestedQuantity: line.originalRequestedQuantity ?? line.requestedQuantity,
        lineId: line.id,
        policy,
        user: params.user,
        asOfDate: params.transactionDate,
        hasApprovedCrossBranchException: hasCrossBranchException,
      })
    );

    const hasShortage = lineResults.some((r) => r.isShortage);
    const hasTransferCandidate = lineResults.some(
      (r) =>
        r.isShortage &&
        (r.companyWideSummary?.transferEligibleStock || 0) > 0 &&
        policy.crossBranchUsability === 'TRANSFER_REQUIRED'
    );

    let overallOutcome: InventoryValidationSnapshot['overallOutcome'] = 'SUFFICIENT_OR_CLEAR';
    const canProceedCreation = true;
    const canProceedSubmission = true;
    let canProceedApproval = true;
    let requiresExceptionApproval = false;

    if (!policy.isEnabled) {
      overallOutcome = 'VALIDATION_DISABLED';
      canProceedApproval = true;
    } else if (!hasShortage) {
      overallOutcome = 'SUFFICIENT_OR_CLEAR';
    } else if (hasTransferCandidate && policy.enforcementMode === 'BLOCK_APPROVAL') {
      overallOutcome = 'TRANSFER_RECOMMENDED';
      if (params.stage === 'ON_PR_APPROVAL' || policy.validationStage === params.stage) {
        canProceedApproval = false;
      }
    } else {
      switch (policy.enforcementMode) {
        case 'INFORMATION_ONLY':
          overallOutcome = 'INFORMATION_LOGGED';
          break;
        case 'WARNING':
          overallOutcome = 'WARNING_ACKNOWLEDGED';
          break;
        case 'BLOCK_APPROVAL':
          overallOutcome = 'BLOCKED_BY_POLICY';
          if (params.stage === 'ON_PR_APPROVAL' || policy.validationStage === params.stage) {
            canProceedApproval = false;
          }
          break;
        case 'REQUIRE_EXCEPTION_APPROVAL':
          if (existingException) {
            overallOutcome = 'EXCEPTION_APPROVED';
            canProceedApproval = true;
          } else {
            overallOutcome = 'PENDING_EXCEPTION_APPROVAL';
            requiresExceptionApproval = true;
            if (params.stage === 'ON_PR_APPROVAL' || policy.validationStage === params.stage) {
              canProceedApproval = false;
            }
          }
          break;
      }
    }

    // Compute delta against previous snapshot if revalidating
    const deltasFromPrevious: InventoryRevalidationDelta[] | undefined = params.previousSnapshot
      ? lineResults.map((curr) => {
          const prev = params.previousSnapshot!.lineResults.find(
            (p) => p.itemCode === curr.itemCode && (!curr.lineId || p.lineId === curr.lineId)
          );
          const prevAvail = prev ? prev.availableStock : 0;
          const prevShort = prev ? prev.shortageQuantity : 0;
          const availDelta = curr.availableStock - prevAvail;
          const shortDelta = curr.shortageQuantity - prevShort;
          return {
            itemCode: curr.itemCode,
            previousAvailableStock: prevAvail,
            currentAvailableStock: curr.availableStock,
            availableStockDelta: availDelta,
            previousShortage: prevShort,
            currentShortage: curr.shortageQuantity,
            shortageDelta: shortDelta,
            summary:
              availDelta === 0
                ? 'No stock change since prior stage.'
                : `Available stock changed by ${availDelta >= 0 ? '+' : ''}${availDelta}; shortage changed by ${shortDelta >= 0 ? '+' : ''}${shortDelta}.`,
          };
        })
      : undefined;

    const stockAgingPolicy = inventoryAgingService.getEffectivePolicy({
      companyId: normCo,
      branchId: normBr,
      asOfDate: params.transactionDate,
    });

    const snapshot: InventoryValidationSnapshot = {
      snapshotId: `inv-snap-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      stage: params.stage,
      validatedAt: new Date().toISOString(),
      validatedBy: params.validatedBy,
      companyId: normCo,
      branchId: normBr,
      policyId: policy.id,
      policyVersion: policy.version,
      policyEffectiveFrom: policy.effectiveFrom,
      stockAgingConfigVersion: stockAgingPolicy.version,
      isEnabled: policy.isEnabled,
      enforcementMode: policy.enforcementMode,
      crossBranchMode: policy.crossBranchUsability || 'VISIBILITY_ONLY',
      overallOutcome,
      canProceedCreation,
      canProceedSubmission,
      canProceedApproval,
      requiresExceptionApproval,
      lineResults,
      exceptionRecord: existingException,
      deltasFromPrevious,
    };

    return snapshot;
  },

  revalidatePrAndAttachSnapshot(
    pr: PurchaseRequisitionHeader,
    stage: InventoryValidationStage,
    actorName: string,
    user?: User
  ): { pr: PurchaseRequisitionHeader; snapshot: InventoryValidationSnapshot } {
    const previousSnapshot = pr.inventoryValidationSnapshot;
    const snapshot = this.validateTransactionInventory({
      prId: pr.id,
      prNumber: pr.prNumber,
      companyId: pr.companyId,
      branchId: pr.branchId,
      stage,
      validatedBy: actorName,
      user,
      previousSnapshot,
      lines: pr.lines.map((l) => ({
        id: l.id,
        itemCode: l.itemCode,
        description: l.description,
        itemCategory: l.itemCategory,
        inventoryUom: l.inventoryUom,
        requestedQuantity: l.requestedQuantity,
        originalRequestedQuantity: l.originalApprovedQuantity ?? l.requestedQuantity,
        defaultWarehouse: l.defaultWarehouse,
      })),
    });

    pr.inventoryValidationSnapshot = snapshot;
    pr.inventoryValidationHistory = [...(pr.inventoryValidationHistory || []), snapshot];
    pr.erpStockStatus = 'CHECKED';
    pr.erpStockTimestamp = snapshot.validatedAt;

    EnterpriseAuditService.logEvent({
      companyId: pr.companyId,
      branchId: pr.branchId,
      entityType: 'INVENTORY_VALIDATION',
      entityId: pr.id,
      relatedPrId: pr.id,
      eventType: `INVENTORY_REVALIDATED_${stage}`,
      eventDescription: `Revalidated inventory at ${stage} for ${pr.prNumber}: ${snapshot.overallOutcome}`,
      changedByUserId: user?.id || 'usr-system',
      changedByName: actorName,
      changeReason: `Stage-gated revalidation at ${stage}`,
      previousValue: previousSnapshot
        ? { snapshotId: previousSnapshot.snapshotId, overallOutcome: previousSnapshot.overallOutcome }
        : undefined,
      newValue: {
        snapshotId: snapshot.snapshotId,
        overallOutcome: snapshot.overallOutcome,
        deltas: snapshot.deltasFromPrevious,
      },
    });

    return { pr, snapshot };
  },

  requestInventoryException(params: {
    prId: string;
    prNumber: string;
    companyId?: string;
    branchId?: string;
    exceptionType?: 'SHORTAGE_OVERRIDE' | 'CROSS_BRANCH_EXCEPTION';
    requestedById: string;
    requestedByName: string;
    exceptionReason: string;
    shortageSummary: string;
  }): InventoryExceptionApprovalRecord {
    if (!params.exceptionReason || !params.exceptionReason.trim()) {
      throw new Error('Inventory exception reason is mandatory.');
    }
    const exceptions = this.getExceptions();
    const record: InventoryExceptionApprovalRecord = {
      id: `inv-exc-${Date.now()}`,
      prId: params.prId,
      prNumber: params.prNumber,
      companyId: params.companyId || 'co-kosh-01',
      branchId: params.branchId,
      exceptionType: params.exceptionType || 'SHORTAGE_OVERRIDE',
      requestedById: params.requestedById,
      requestedByName: params.requestedByName,
      requestedAt: new Date().toISOString(),
      exceptionReason: params.exceptionReason.trim(),
      shortageSummary: params.shortageSummary,
      status: 'PENDING',
    };
    exceptions.unshift(record);
    this.saveExceptions(exceptions);
    return record;
  },

  approveInventoryException(params: {
    exceptionId?: string;
    prId?: string;
    approvedById: string;
    approvedByName: string;
    approverRemarks: string;
    approverUser?: User;
  }): InventoryExceptionApprovalRecord {
    if (
      params.approverUser &&
      !rbacPermissionService.hasPermission(
        params.approverUser,
        'INVENTORY_VALIDATION_OVERRIDE_APPROVE'
      )
    ) {
      throw new Error(
        'RBAC Authorization Denied: Approver lacks INVENTORY_VALIDATION_OVERRIDE_APPROVE permission.'
      );
    }

    const exceptions = this.getExceptions();
    const target = exceptions.find(
      (e) =>
        (params.exceptionId && e.id === params.exceptionId) ||
        (params.prId && e.prId === params.prId)
    );
    if (!target) {
      throw new Error('Inventory exception request not found.');
    }
    if (target.requestedById === params.approvedById) {
      throw new Error(
        'Maker-Checker Violation: Requester cannot approve their own inventory exception.'
      );
    }
    target.status = 'APPROVED';
    target.approvedById = params.approvedById;
    target.approvedByName = params.approvedByName;
    target.approvedAt = new Date().toISOString();
    target.approverRemarks = params.approverRemarks || 'Authorized inventory exception approved.';
    this.saveExceptions(exceptions);

    EnterpriseAuditService.logEvent({
      companyId: target.companyId || 'co-kosh-01',
      branchId: target.branchId,
      entityType: 'INVENTORY_VALIDATION',
      entityId: target.prId,
      relatedPrId: target.prId,
      eventType: 'INVENTORY_EXCEPTION_APPROVED',
      eventDescription: `Approved Inventory Validation Exception for ${target.prNumber}`,
      changedByUserId: params.approvedById,
      changedByName: params.approvedByName,
      changeReason: target.approverRemarks,
      newValue: target,
    });

    return target;
  },

  // ============================================================================
  // INTER-BRANCH STOCK TRANSFER LIFECYCLE (Same Company Only, NO Virtual Movement)
  // ============================================================================

  requestStockTransfer(params: {
    companyId: string;
    sourceBranchId: string;
    sourceWarehouseCode: string;
    destinationBranchId: string;
    destinationWarehouseCode: string;
    prId?: string;
    prNumber?: string;
    itemCode: string;
    itemDescription?: string;
    uom?: string;
    requestedQuantity: number;
    reason: string;
    requestedById: string;
    requestedByName: string;
    user?: User;
  }): InventoryTransferRecord {
    if (
      params.user &&
      !rbacPermissionService.hasPermission(params.user, 'INVENTORY_CROSS_BRANCH_TRANSFER_REQUEST')
    ) {
      throw new Error(
        'RBAC Authorization Denied: User lacks INVENTORY_CROSS_BRANCH_TRANSFER_REQUEST permission.'
      );
    }

    const normCo = normalizeCompanyId(params.companyId);
    const normSrcBr = normalizeBranchId(params.sourceBranchId);
    const normDstBr = normalizeBranchId(params.destinationBranchId);

    if (normSrcBr === normDstBr) {
      throw new Error('Inter-branch transfer requires distinct source and destination branches.');
    }
    if (!params.requestedQuantity || params.requestedQuantity <= 0) {
      throw new Error('Transfer quantity must be greater than zero.');
    }
    if (!params.reason || !params.reason.trim()) {
      throw new Error('Business reason for stock transfer is mandatory.');
    }

    const branches = getMasterBranches();
    const srcMeta = getWarehouseMeta(branches, normSrcBr, params.sourceWarehouseCode);
    const dstMeta = getWarehouseMeta(branches, normDstBr, params.destinationWarehouseCode);

    if (!srcMeta.branch || normalizeCompanyId(srcMeta.branch.companyId || 'co-kosh-01') !== normCo) {
      throw new Error('Cross-Company Isolation: Source branch does not belong to requesting company.');
    }
    if (!dstMeta.branch || normalizeCompanyId(dstMeta.branch.companyId || 'co-kosh-01') !== normCo) {
      throw new Error('Cross-Company Isolation: Destination branch does not belong to requesting company.');
    }
    if (srcMeta.warehouse && srcMeta.warehouse.isCrossBranchTransferEligible === false) {
      throw new Error(
        `Source warehouse ${params.sourceWarehouseCode} is marked ineligible for cross-branch transfers.`
      );
    }

    // Verify source branch balance has sufficient available stock
    const srcAvail = this.calculateLineAvailability({
      companyId: normCo,
      branchId: normSrcBr,
      warehouseCode: params.sourceWarehouseCode,
      itemCode: params.itemCode,
      requiredPrQuantity: params.requestedQuantity,
    });

    if (srcAvail.availableStock < params.requestedQuantity) {
      throw new Error(
        `Insufficient transfer-eligible stock in ${params.sourceWarehouseCode}: Available ${srcAvail.availableStock}, Requested ${params.requestedQuantity}.`
      );
    }

    const transfers = this.getTransfers();
    const record: InventoryTransferRecord = {
      id: `trf-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      transferNumber: `ITRF-${new Date().getFullYear()}-${String(transfers.length + 101).padStart(4, '0')}`,
      companyId: normCo,
      sourceBranchId: normSrcBr,
      sourceBranchName: srcMeta.branch.name,
      sourceWarehouseCode: params.sourceWarehouseCode,
      destinationBranchId: normDstBr,
      destinationBranchName: dstMeta.branch.name,
      destinationWarehouseCode: params.destinationWarehouseCode,
      prId: params.prId,
      prNumber: params.prNumber,
      itemCode: params.itemCode,
      itemDescription: params.itemDescription || srcAvail.itemDescription,
      uom: params.uom || srcAvail.uom,
      requestedQuantity: params.requestedQuantity,
      status: 'REQUESTED',
      requestedById: params.requestedById,
      requestedByName: params.requestedByName,
      requestedAt: new Date().toISOString(),
      reason: params.reason.trim(),
    };

    transfers.unshift(record);
    this.saveTransfers(transfers);

    EnterpriseAuditService.logEvent({
      companyId: normCo,
      branchId: normDstBr,
      entityType: 'INVENTORY_TRANSFER',
      entityId: record.id,
      relatedPrId: params.prId,
      eventType: 'TRANSFER_REQUESTED',
      eventDescription: `Requested transfer ${record.transferNumber} (${record.requestedQuantity} ${record.uom} of ${record.itemCode} from ${record.sourceWarehouseCode} to ${record.destinationWarehouseCode})`,
      changedByUserId: params.requestedById,
      changedByName: params.requestedByName,
      changeReason: record.reason,
      newValue: record,
    });

    return record;
  },

  approveStockTransfer(params: {
    transferId: string;
    approvedById: string;
    approvedByName: string;
    approverUser?: User;
  }): InventoryTransferRecord {
    if (
      params.approverUser &&
      !rbacPermissionService.hasPermission(
        params.approverUser,
        'INVENTORY_CROSS_BRANCH_TRANSFER_APPROVE'
      )
    ) {
      throw new Error(
        'RBAC Authorization Denied: User lacks INVENTORY_CROSS_BRANCH_TRANSFER_APPROVE permission.'
      );
    }
    const transfers = this.getTransfers();
    const trf = transfers.find((t) => t.id === params.transferId);
    if (!trf) throw new Error('Inventory transfer record not found.');
    if (trf.status !== 'REQUESTED') {
      throw new Error(`Transfer ${trf.transferNumber} is in status ${trf.status} and cannot be approved.`);
    }
    if (trf.requestedById === params.approvedById) {
      throw new Error('Maker-Checker Violation: Transfer requester cannot approve their own transfer.');
    }

    // Reserve stock at source warehouse (still not in destination physical stock!)
    const balances = this.getBalances();
    const srcBal = balances.find(
      (b) =>
        b.itemCode === trf.itemCode &&
        normalizeCompanyId(b.companyId) === normalizeCompanyId(trf.companyId) &&
        normalizeBranchId(b.branchId) === normalizeBranchId(trf.sourceBranchId) &&
        b.warehouseCode.toUpperCase() === trf.sourceWarehouseCode.toUpperCase()
    );
    if (!srcBal || srcBal.physicalStock - srcBal.reservedStock < trf.requestedQuantity) {
      throw new Error('Source warehouse no longer has enough available stock to approve transfer.');
    }

    srcBal.reservedStock += trf.requestedQuantity;
    srcBal.lastUpdated = new Date().toISOString();
    this.saveBalances(balances);

    trf.status = 'APPROVED_PENDING_DISPATCH';
    trf.approvedById = params.approvedById;
    trf.approvedByName = params.approvedByName;
    trf.approvedAt = new Date().toISOString();
    this.saveTransfers(transfers);

    EnterpriseAuditService.logEvent({
      companyId: trf.companyId,
      branchId: trf.sourceBranchId,
      entityType: 'INVENTORY_TRANSFER',
      entityId: trf.id,
      relatedPrId: trf.prId,
      eventType: 'TRANSFER_APPROVED',
      eventDescription: `Approved transfer ${trf.transferNumber} & reserved ${trf.requestedQuantity} ${trf.uom} in ${trf.sourceWarehouseCode}`,
      changedByUserId: params.approvedById,
      changedByName: params.approvedByName,
      changeReason: 'Approved inter-branch stock transfer',
      newValue: trf,
    });

    return trf;
  },

  dispatchStockTransfer(params: {
    transferId: string;
    dispatchedById: string;
    dispatchedByName: string;
    dispatchedQuantity?: number;
  }): InventoryTransferRecord {
    const transfers = this.getTransfers();
    const trf = transfers.find((t) => t.id === params.transferId);
    if (!trf) throw new Error('Inventory transfer record not found.');
    if (trf.status !== 'APPROVED_PENDING_DISPATCH') {
      throw new Error(`Transfer ${trf.transferNumber} must be APPROVED_PENDING_DISPATCH before dispatch.`);
    }

    const qty = params.dispatchedQuantity ?? trf.requestedQuantity;
    if (qty <= 0 || qty > trf.requestedQuantity) {
      throw new Error('Dispatched quantity must be between 1 and requested quantity.');
    }

    const balances = this.getBalances();
    const srcBal = balances.find(
      (b) =>
        b.itemCode === trf.itemCode &&
        normalizeCompanyId(b.companyId) === normalizeCompanyId(trf.companyId) &&
        normalizeBranchId(b.branchId) === normalizeBranchId(trf.sourceBranchId) &&
        b.warehouseCode.toUpperCase() === trf.sourceWarehouseCode.toUpperCase()
    );
    if (!srcBal) throw new Error('Source balance not found.');

    srcBal.physicalStock = Math.max(0, srcBal.physicalStock - qty);
    srcBal.reservedStock = Math.max(0, srcBal.reservedStock - trf.requestedQuantity);
    srcBal.lastUpdated = new Date().toISOString();

    // Add to destination Stock In Transit (NOT physicalStock yet!)
    let dstBal = balances.find(
      (b) =>
        b.itemCode === trf.itemCode &&
        normalizeCompanyId(b.companyId) === normalizeCompanyId(trf.companyId) &&
        normalizeBranchId(b.branchId) === normalizeBranchId(trf.destinationBranchId) &&
        b.warehouseCode.toUpperCase() === trf.destinationWarehouseCode.toUpperCase()
    );
    if (!dstBal) {
      dstBal = {
        id: `bal-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        companyId: trf.companyId,
        branchId: trf.destinationBranchId,
        branchName: trf.destinationBranchName,
        warehouseCode: trf.destinationWarehouseCode,
        warehouseName: `${trf.destinationWarehouseCode} Store`,
        inventoryLocation: 'INBOUND-STAGE',
        itemCode: trf.itemCode,
        itemDescription: trf.itemDescription,
        itemCategory: srcBal.itemCategory,
        uom: trf.uom,
        physicalStock: 0,
        reservedStock: 0,
        allocatedStock: 0,
        incomingStock: 0,
        stockInTransit: qty,
        lastUpdated: new Date().toISOString(),
      };
      balances.push(dstBal);
    } else {
      dstBal.stockInTransit = (dstBal.stockInTransit || 0) + qty;
      dstBal.lastUpdated = new Date().toISOString();
    }

    this.saveBalances(balances);

    trf.status = 'IN_TRANSIT';
    trf.dispatchedQuantity = qty;
    trf.dispatchedAt = new Date().toISOString();
    this.saveTransfers(transfers);

    EnterpriseAuditService.logEvent({
      companyId: trf.companyId,
      branchId: trf.destinationBranchId,
      entityType: 'INVENTORY_TRANSFER',
      entityId: trf.id,
      relatedPrId: trf.prId,
      eventType: 'TRANSFER_DISPATCHED',
      eventDescription: `Dispatched transfer ${trf.transferNumber} (${qty} ${trf.uom} now IN_TRANSIT to ${trf.destinationWarehouseCode})`,
      changedByUserId: params.dispatchedById,
      changedByName: params.dispatchedByName,
      changeReason: 'Physical dispatch from source branch',
      newValue: trf,
    });

    return trf;
  },

  receiveStockTransfer(params: {
    transferId: string;
    receivedById: string;
    receivedByName: string;
    receivedQuantity?: number;
  }): InventoryTransferRecord {
    const transfers = this.getTransfers();
    const trf = transfers.find((t) => t.id === params.transferId);
    if (!trf) throw new Error('Inventory transfer record not found.');
    if (trf.status !== 'IN_TRANSIT') {
      throw new Error(`Transfer ${trf.transferNumber} must be IN_TRANSIT before physical receipt.`);
    }

    const dispatchedQty = trf.dispatchedQuantity ?? trf.requestedQuantity;
    const recQty = params.receivedQuantity ?? dispatchedQty;
    if (recQty <= 0 || recQty > dispatchedQty) {
      throw new Error('Received quantity cannot exceed dispatched quantity.');
    }

    const balances = this.getBalances();
    const dstBal = balances.find(
      (b) =>
        b.itemCode === trf.itemCode &&
        normalizeCompanyId(b.companyId) === normalizeCompanyId(trf.companyId) &&
        normalizeBranchId(b.branchId) === normalizeBranchId(trf.destinationBranchId) &&
        b.warehouseCode.toUpperCase() === trf.destinationWarehouseCode.toUpperCase()
    );
    if (!dstBal) throw new Error('Destination balance record missing.');

    dstBal.stockInTransit = Math.max(0, (dstBal.stockInTransit || 0) - dispatchedQty);
    dstBal.physicalStock += recQty;
    const todayIso = new Date().toISOString().slice(0, 10);
    dstBal.batches = [
      ...(dstBal.batches || []),
      {
        batchNo: `TRF-${trf.transferNumber}`,
        warehouseCode: trf.destinationWarehouseCode,
        binLocation: dstBal.inventoryLocation,
        receiptDate: todayIso,
        expiryDate: null,
        isPerishable: Boolean(dstBal.isPerishable),
        quantity: recQty,
        reservedQuantity: 0,
        qualityStatus: 'RELEASED',
      },
    ];
    dstBal.lastUpdated = new Date().toISOString();
    this.saveBalances(balances);

    trf.status = 'RECEIVED';
    trf.receivedQuantity = recQty;
    trf.receivedById = params.receivedById;
    trf.receivedByName = params.receivedByName;
    trf.receivedAt = new Date().toISOString();
    this.saveTransfers(transfers);

    EnterpriseAuditService.logEvent({
      companyId: trf.companyId,
      branchId: trf.destinationBranchId,
      entityType: 'INVENTORY_TRANSFER',
      entityId: trf.id,
      relatedPrId: trf.prId,
      eventType: 'TRANSFER_RECEIVED',
      eventDescription: `Received transfer ${trf.transferNumber} (+${recQty} ${trf.uom} posted to ${trf.destinationWarehouseCode} physical stock)`,
      changedByUserId: params.receivedById,
      changedByName: params.receivedByName,
      changeReason: 'Physical receipt confirmed at destination warehouse',
      newValue: trf,
    });

    return trf;
  },
};
