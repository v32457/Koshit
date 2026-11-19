/**
 * CIPPLATFORM — PR TYPE MASTER & CENTRALIZED ELIGIBILITY MAPPING SERVICE
 *
 * Manages:
 * 1. Genuine PR Type Master records (preserving MANUAL, MRP, REPAIR, MAINTENANCE
 *    and adding CAPEX_ASSET as the 5th record, initially INACTIVE / DRAFT).
 * 2. Centralized Company -> Branch -> Purchase Org -> Item Category -> PR Type
 *    versioned mapping with effective dates, active/inactive status, and approval status.
 * 3. Deterministic eligibility evaluation (strict deny-by-default for CAPEX_ASSET
 *    and any non-legacy PR type unless mapped, ACTIVE, APPROVED, and within effective dates).
 * 4. Immutable version history & cryptographic audit trail integration.
 */

import { User } from '../types';
import { PRType } from '../types/purchaseRequisition';
import {
  PRTypeMasterRecord,
  PRTypeMasterStatus,
  PRTypeApprovalStatus,
  PRTypeApplicabilityMappingRecord,
  PRTypeMasterVersionHistoryEntry,
  PRTypeEligibilityEvaluationResult,
} from '../types/prTypeMaster';
import {
  CLASSIFICATION_DIMENSIONS,
  INITIAL_COMPANIES,
  INITIAL_BRANCHES,
} from '../data/seedData';
import { EnterpriseAuditService } from './enterpriseAuditService';
import { normalizeCompanyId, normalizeBranchId } from './prGovernancePolicyService';
import { expenseCategoryService } from './expenseCategoryService';

const STORAGE_KEY_PR_TYPE_MASTER = 'kosh_pr_type_master_v1';
const STORAGE_KEY_PR_TYPE_MAPPINGS = 'kosh_pr_type_applicability_mappings_v1';
const STORAGE_KEY_PR_TYPE_HISTORY = 'kosh_pr_type_master_history_v1';

const LEGACY_SYSTEM_TYPES: ReadonlySet<string> = new Set([
  'MANUAL',
  'MRP',
  'REPAIR',
  'MAINTENANCE',
]);

export const INITIAL_PR_TYPE_MASTERS: PRTypeMasterRecord[] = [
  {
    id: 'prt-manual',
    code: 'MANUAL',
    name: 'Manual Requisition',
    description:
      'Ad-hoc manual purchase requisitions raised by authorized business users for operational, spare, or direct material requirements.',
    isSystemType: true,
    isCapexType: false,
    requiresAssetClassification: false,
    requiresBudgetExceptionFlow: false,
    allowedRoles: [],
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2026-01-01',
    versionNumber: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    createdByUserId: 'usr-admin-01',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    updatedByUserId: 'usr-checker-01',
    approvedAt: '2026-01-01T00:05:00.000Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
    approvedByUserId: 'usr-checker-01',
  },
  {
    id: 'prt-mrp',
    code: 'MRP',
    name: 'MRP Generated',
    description:
      'Automated or planner-triggered material requirements planning (MRP) purchase requisitions for production and inventory replenishment.',
    isSystemType: true,
    isCapexType: false,
    requiresAssetClassification: false,
    requiresBudgetExceptionFlow: false,
    allowedRoles: ['PLATFORM_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'PROCUREMENT_MANAGER'],
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2026-01-01',
    versionNumber: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    createdByUserId: 'usr-admin-01',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    updatedByUserId: 'usr-checker-01',
    approvedAt: '2026-01-01T00:05:00.000Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
    approvedByUserId: 'usr-checker-01',
  },
  {
    id: 'prt-repair',
    code: 'REPAIR',
    name: 'Repair Requisition',
    description:
      'Breakdown and corrective repair procurement linked to equipment/asset maintenance incidents.',
    isSystemType: true,
    isCapexType: false,
    requiresAssetClassification: false,
    requiresBudgetExceptionFlow: false,
    allowedRoles: [],
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2026-01-01',
    versionNumber: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    createdByUserId: 'usr-admin-01',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    updatedByUserId: 'usr-checker-01',
    approvedAt: '2026-01-01T00:05:00.000Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
    approvedByUserId: 'usr-checker-01',
  },
  {
    id: 'prt-maintenance',
    code: 'MAINTENANCE',
    name: 'Maintenance Requisition',
    description:
      'Preventive and scheduled plant/equipment maintenance procurement for routine servicing and overhaul spares.',
    isSystemType: true,
    isCapexType: false,
    requiresAssetClassification: false,
    requiresBudgetExceptionFlow: false,
    allowedRoles: [
      'PLATFORM_ADMIN',
      'ORG_ADMIN',
      'BRANCH_ADMIN',
      'PROCUREMENT_MANAGER',
      'DEPARTMENT_HEAD',
      'PLANT_ENGINEER',
      'MAINTENANCE_SUPERVISOR',
    ],
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2026-01-01',
    versionNumber: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    createdByUserId: 'usr-admin-01',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    updatedByUserId: 'usr-checker-01',
    approvedAt: '2026-01-01T00:05:00.000Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
    approvedByUserId: 'usr-checker-01',
  },
  {
    id: 'prt-capex-asset',
    code: 'CAPEX_ASSET',
    name: 'Capex / Asset Requisition',
    description:
      'Capital investment procurement for approved assets, equipment, machinery, infrastructure and other qualifying capital expenditures.',
    isSystemType: true,
    isCapexType: true,
    requiresAssetClassification: true,
    requiresBudgetExceptionFlow: true,
    allowedRoles: [],
    status: 'INACTIVE',
    approvalStatus: 'DRAFT',
    effectiveFrom: '2026-11-01',
    versionNumber: 1,
    createdAt: '2026-11-13T00:00:00.000Z',
    createdBy: 'System Governance Seed',
    createdByUserId: 'usr-admin-01',
    updatedAt: '2026-11-13T00:00:00.000Z',
    updatedBy: 'System Governance Seed',
    updatedByUserId: 'usr-admin-01',
  },
];

export const EXPENSE_PR_TYPE_MASTER_RECORD: PRTypeMasterRecord = {
  id: 'prt-expense',
  code: 'EXPENSE',
  name: 'Expense Requisition',
  description:
    'Independent non-inventory operational expenses and service procurements (Consultancy, Professional Fees, Legal, Audit, Rent, Software Subscription, Training, Facility Management, Independent Maintenance, Admin Services).',
  isSystemType: true,
  isCapexType: false,
  isExpenseType: true,
  applicableMechanism: 'EXPENSE',
  requiresAssetClassification: false,
  requiresBudgetExceptionFlow: false,
  allowedRoles: [],
  status: 'ACTIVE',
  approvalStatus: 'APPROVED',
  effectiveFrom: '2026-01-01',
  versionNumber: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'Rajesh Sharma (Platform Admin)',
  createdByUserId: 'usr-admin-01',
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedBy: 'Vikramaditya Rao (Org Admin)',
  updatedByUserId: 'usr-checker-01',
  approvedAt: '2026-01-01T00:05:00.000Z',
  approvedBy: 'Vikramaditya Rao (Org Admin)',
  approvedByUserId: 'usr-checker-01',
};

export const INITIAL_EXPENSE_PR_TYPE_MAPPING: PRTypeApplicabilityMappingRecord = {
  id: 'map-prt-expense-all',
  companyId: 'ALL',
  companyCode: 'ALL',
  companyName: 'All Companies',
  branchId: 'ALL',
  branchCode: 'ALL',
  branchName: 'All Branches',
  purchaseOrgId: 'ALL',
  purchaseOrgCode: 'ALL',
  purchaseOrgName: 'All Purchase Organizations',
  itemCategoryCode: 'ALL',
  itemCategoryName: 'All Mapped Expense Categories',
  prTypeCode: 'EXPENSE',
  isEligible: true,
  effectiveFrom: '2026-01-01',
  status: 'ACTIVE',
  approvalStatus: 'APPROVED',
  versionNumber: 1,
  remarks: 'Enterprise eligibility for governed Expense Requisitions across active Expense Category mappings.',
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'Rajesh Sharma (Platform Admin)',
  createdByUserId: 'usr-admin-01',
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedBy: 'Vikramaditya Rao (Org Admin)',
  updatedByUserId: 'usr-checker-01',
  approvedAt: '2026-01-01T00:05:00.000Z',
  approvedBy: 'Vikramaditya Rao (Org Admin)',
  approvedByUserId: 'usr-checker-01',
};

export const INITIAL_PR_TYPE_MAPPINGS: PRTypeApplicabilityMappingRecord[] = [
  {
    id: 'map-prt-manual-all',
    companyId: 'ALL',
    companyCode: 'ALL',
    companyName: 'All Companies',
    branchId: 'ALL',
    branchCode: 'ALL',
    branchName: 'All Branches',
    purchaseOrgId: 'ALL',
    purchaseOrgCode: 'ALL',
    purchaseOrgName: 'All Purchase Organizations',
    itemCategoryCode: 'ALL',
    itemCategoryName: 'All Item Categories',
    prTypeCode: 'MANUAL',
    isEligible: true,
    effectiveFrom: '2026-01-01',
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    versionNumber: 1,
    remarks: 'Baseline enterprise eligibility preserving Manual Requisition.',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    createdByUserId: 'usr-admin-01',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    updatedByUserId: 'usr-checker-01',
    approvedAt: '2026-01-01T00:05:00.000Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
    approvedByUserId: 'usr-checker-01',
  },
  {
    id: 'map-prt-mrp-all',
    companyId: 'ALL',
    companyCode: 'ALL',
    companyName: 'All Companies',
    branchId: 'ALL',
    branchCode: 'ALL',
    branchName: 'All Branches',
    purchaseOrgId: 'ALL',
    purchaseOrgCode: 'ALL',
    purchaseOrgName: 'All Purchase Organizations',
    itemCategoryCode: 'ALL',
    itemCategoryName: 'All Item Categories',
    prTypeCode: 'MRP',
    isEligible: true,
    effectiveFrom: '2026-01-01',
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    versionNumber: 1,
    remarks: 'Baseline enterprise eligibility preserving MRP Generated PR.',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    createdByUserId: 'usr-admin-01',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    updatedByUserId: 'usr-checker-01',
    approvedAt: '2026-01-01T00:05:00.000Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
    approvedByUserId: 'usr-checker-01',
  },
  {
    id: 'map-prt-repair-all',
    companyId: 'ALL',
    companyCode: 'ALL',
    companyName: 'All Companies',
    branchId: 'ALL',
    branchCode: 'ALL',
    branchName: 'All Branches',
    purchaseOrgId: 'ALL',
    purchaseOrgCode: 'ALL',
    purchaseOrgName: 'All Purchase Organizations',
    itemCategoryCode: 'ALL',
    itemCategoryName: 'All Item Categories',
    prTypeCode: 'REPAIR',
    isEligible: true,
    effectiveFrom: '2026-01-01',
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    versionNumber: 1,
    remarks: 'Baseline enterprise eligibility preserving Repair Requisition.',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    createdByUserId: 'usr-admin-01',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    updatedByUserId: 'usr-checker-01',
    approvedAt: '2026-01-01T00:05:00.000Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
    approvedByUserId: 'usr-checker-01',
  },
  {
    id: 'map-prt-maintenance-all',
    companyId: 'ALL',
    companyCode: 'ALL',
    companyName: 'All Companies',
    branchId: 'ALL',
    branchCode: 'ALL',
    branchName: 'All Branches',
    purchaseOrgId: 'ALL',
    purchaseOrgCode: 'ALL',
    purchaseOrgName: 'All Purchase Organizations',
    itemCategoryCode: 'ALL',
    itemCategoryName: 'All Item Categories',
    prTypeCode: 'MAINTENANCE',
    isEligible: true,
    effectiveFrom: '2026-01-01',
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    versionNumber: 1,
    remarks: 'Baseline enterprise eligibility preserving Maintenance Requisition.',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    createdByUserId: 'usr-admin-01',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    updatedByUserId: 'usr-checker-01',
    approvedAt: '2026-01-01T00:05:00.000Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
    approvedByUserId: 'usr-checker-01',
  },
  // NOTE: CAPEX_ASSET is intentionally NOT seeded as ACTIVE/APPROVED across ALL companies,
  // branches, or item categories (strict deny-by-default until explicitly mapped & approved).
];

let memoryPrTypesCache: PRTypeMasterRecord[] | null = null;
let memoryMappingsCache: PRTypeApplicabilityMappingRecord[] | null = null;
let memoryHistoryCache: PRTypeMasterVersionHistoryEntry[] | null = null;
let legacyFiveTypeResetMode = false;

function clone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

export function normalizeItemCategoryCode(categoryInput?: string): string {
  if (!categoryInput || categoryInput.trim() === '' || categoryInput.trim().toUpperCase() === 'ALL') {
    return 'ALL';
  }
  const trimmed = categoryInput.trim();
  const upper = trimmed.toUpperCase();
  const categories = CLASSIFICATION_DIMENSIONS.category?.values || [];
  const exactCode = categories.find((c) => c.code.toUpperCase() === upper);
  if (exactCode) return exactCode.code;

  const byNameOrDisplay = categories.find(
    (c) =>
      c.name.toUpperCase() === upper ||
      c.display.toUpperCase() === upper ||
      upper.includes(`(${c.code.toUpperCase()})`)
  );
  if (byNameOrDisplay) return byNameOrDisplay.code;

  const aliasMap: Record<string, string> = {
    'RAW MATERIAL': 'RM',
    'RAW_MATERIAL': 'RM',
    'RAW MATERIALS': 'RM',
    SPARE: 'MA',
    SPARES: 'MA',
    MAINTENANCE: 'MA',
    'MAINTENANCE / SPARES': 'MA',
    CAPITAL: 'CP',
    CAPEX: 'CP',
    ASSET: 'CP',
    'CAPITAL EQUIPMENT': 'CP',
    SERVICE: 'SV',
    SERVICES: 'SV',
    CONSUMABLE: 'CO',
    CONSUMABLES: 'CO',
  };
  if (aliasMap[upper]) return aliasMap[upper];

  return upper;
}

export function resolveItemCategoryName(categoryCode?: string): string {
  const norm = normalizeItemCategoryCode(categoryCode);
  if (norm === 'ALL') return 'All Item Categories';
  const match = (CLASSIFICATION_DIMENSIONS.category?.values || []).find(
    (c) => c.code.toUpperCase() === norm.toUpperCase()
  );
  return match ? `${match.name} (${match.code})` : norm;
}

function isEffectiveOnDate(
  effectiveFrom: string | undefined,
  effectiveUntil: string | undefined,
  evaluationDate: string
): boolean {
  if (effectiveFrom && evaluationDate < effectiveFrom) return false;
  if (effectiveUntil && evaluationDate > effectiveUntil) return false;
  return true;
}

function computeSpecificityScore(m: PRTypeApplicabilityMappingRecord): number {
  let score = 0;
  if (m.companyId !== 'ALL') score += 1;
  if (m.branchId !== 'ALL') score += 2;
  if (m.purchaseOrgId !== 'ALL') score += 4;
  if (m.itemCategoryCode !== 'ALL') score += 8;
  return score;
}

function normalizeScopeCompanyId(companyId?: string): string {
  if (!companyId || companyId.trim().toUpperCase() === 'ALL') return 'ALL';
  return normalizeCompanyId(companyId);
}

function normalizeScopeBranchId(branchId?: string): string {
  if (!branchId || branchId.trim().toUpperCase() === 'ALL') return 'ALL';
  return normalizeBranchId(branchId);
}

function normalizeScopePurchaseOrgId(purchaseOrgId?: string): string {
  if (!purchaseOrgId || purchaseOrgId.trim() === '' || purchaseOrgId.trim().toUpperCase() === 'ALL') {
    return 'ALL';
  }
  return purchaseOrgId.trim();
}

function actorInfo(actor?: User) {
  return {
    id: actor?.id || 'usr-admin-01',
    name: actor?.fullName || 'Platform Governance Admin',
  };
}

function dispatchUpdateEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cip-pr-type-master-updated'));
  }
}

export const prTypeMasterService = {
  resetForTests(includeExpense = false): void {
    legacyFiveTypeResetMode = !includeExpense;
    memoryPrTypesCache = null;
    memoryMappingsCache = null;
    memoryHistoryCache = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_PR_TYPE_MASTER);
      localStorage.removeItem(STORAGE_KEY_PR_TYPE_MAPPINGS);
      localStorage.removeItem(STORAGE_KEY_PR_TYPE_HISTORY);
    }
  },

  ensureExpensePrTypeRegistered(): PRTypeMasterRecord {
    legacyFiveTypeResetMode = false;
    const all = this.getPrTypes();
    const found = all.find((p) => p.code.toUpperCase() === 'EXPENSE');
    if (found) return found;
    const updated = [...all, clone(EXPENSE_PR_TYPE_MASTER_RECORD)];
    this.savePrTypes(updated);
    const mappings = this.getMappings();
    if (!mappings.some((m) => m.prTypeCode.toUpperCase() === 'EXPENSE')) {
      this.saveMappings([...mappings, clone(INITIAL_EXPENSE_PR_TYPE_MAPPING)]);
    }
    return clone(EXPENSE_PR_TYPE_MASTER_RECORD);
  },

  getPrTypes(includeExpenseOverride?: boolean): PRTypeMasterRecord[] {
    const shouldIncludeExpense =
      includeExpenseOverride !== undefined ? includeExpenseOverride : !legacyFiveTypeResetMode;
    const seedMasters = shouldIncludeExpense
      ? [...INITIAL_PR_TYPE_MASTERS, EXPENSE_PR_TYPE_MASTER_RECORD]
      : INITIAL_PR_TYPE_MASTERS;

    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PR_TYPE_MASTER);
        if (saved) {
          const parsed: PRTypeMasterRecord[] = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const existingCodes = new Set(parsed.map((p) => p.code));
            const missing = seedMasters.filter((m) => !existingCodes.has(m.code));
            if (missing.length > 0) {
              const merged = [...parsed, ...clone(missing)];
              localStorage.setItem(STORAGE_KEY_PR_TYPE_MASTER, JSON.stringify(merged));
              return merged;
            }
            return parsed;
          }
        }
      } catch (err) {
        console.error('Error reading PR Type Master:', err);
      }
    }
    if (!memoryPrTypesCache) {
      memoryPrTypesCache = clone(seedMasters);
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_PR_TYPE_MASTER, JSON.stringify(memoryPrTypesCache));
        } catch {
          // ignore storage quota errors
        }
      }
    }
    return clone(memoryPrTypesCache);
  },

  savePrTypes(records: PRTypeMasterRecord[]): void {
    memoryPrTypesCache = clone(records);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_PR_TYPE_MASTER, JSON.stringify(records));
      } catch (err) {
        console.error('Error saving PR Type Master:', err);
      }
    }
    dispatchUpdateEvent();
  },

  getPrTypeByCode(code: string): PRTypeMasterRecord | undefined {
    const upper = code.trim().toUpperCase();
    const found = this.getPrTypes().find((p) => p.code.toUpperCase() === upper);
    if (found) return found;
    if (upper === 'EXPENSE') {
      return this.ensureExpensePrTypeRegistered();
    }
    return undefined;
  },

  getMappings(filters?: {
    companyId?: string;
    branchId?: string;
    purchaseOrgId?: string;
    itemCategoryCode?: string;
    prTypeCode?: string;
    status?: PRTypeMasterStatus | 'ALL';
    approvalStatus?: PRTypeApprovalStatus | 'ALL';
  }): PRTypeApplicabilityMappingRecord[] {
    let list: PRTypeApplicabilityMappingRecord[] = [];
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PR_TYPE_MAPPINGS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            list = parsed;
          }
        }
      } catch (err) {
        console.error('Error reading PR Type applicability mappings:', err);
      }
    }
    if (list.length === 0) {
      if (!memoryMappingsCache) {
        const seedMappings = legacyFiveTypeResetMode
          ? INITIAL_PR_TYPE_MAPPINGS
          : [...INITIAL_PR_TYPE_MAPPINGS, INITIAL_EXPENSE_PR_TYPE_MAPPING];
        memoryMappingsCache = clone(seedMappings);
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_KEY_PR_TYPE_MAPPINGS, JSON.stringify(memoryMappingsCache));
          } catch {
            // ignore
          }
        }
      }
      list = clone(memoryMappingsCache);
    }

    if (!filters) return list;

    return list.filter((m) => {
      if (filters.companyId && filters.companyId !== 'ALL') {
        const normComp = normalizeScopeCompanyId(filters.companyId);
        if (m.companyId !== 'ALL' && normalizeScopeCompanyId(m.companyId) !== normComp) return false;
      }
      if (filters.branchId && filters.branchId !== 'ALL') {
        const normBr = normalizeScopeBranchId(filters.branchId);
        if (m.branchId !== 'ALL' && normalizeScopeBranchId(m.branchId) !== normBr) return false;
      }
      if (filters.purchaseOrgId && filters.purchaseOrgId !== 'ALL') {
        if (m.purchaseOrgId !== 'ALL' && m.purchaseOrgId !== filters.purchaseOrgId) return false;
      }
      if (filters.itemCategoryCode && filters.itemCategoryCode !== 'ALL') {
        const normCat = normalizeItemCategoryCode(filters.itemCategoryCode);
        if (m.itemCategoryCode !== 'ALL' && normalizeItemCategoryCode(m.itemCategoryCode) !== normCat) {
          return false;
        }
      }
      if (filters.prTypeCode && filters.prTypeCode !== 'ALL') {
        if (m.prTypeCode.toUpperCase() !== filters.prTypeCode.toUpperCase()) return false;
      }
      if (filters.status && filters.status !== 'ALL' && m.status !== filters.status) return false;
      if (
        filters.approvalStatus &&
        filters.approvalStatus !== 'ALL' &&
        m.approvalStatus !== filters.approvalStatus
      ) {
        return false;
      }
      return true;
    });
  },

  saveMappings(mappings: PRTypeApplicabilityMappingRecord[]): void {
    memoryMappingsCache = clone(mappings);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_PR_TYPE_MAPPINGS, JSON.stringify(mappings));
      } catch (err) {
        console.error('Error saving PR Type applicability mappings:', err);
      }
    }
    dispatchUpdateEvent();
  },

  getVersionHistory(entityId?: string): PRTypeMasterVersionHistoryEntry[] {
    let list: PRTypeMasterVersionHistoryEntry[] = [];
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PR_TYPE_HISTORY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) list = parsed;
        }
      } catch {
        list = [];
      }
    } else if (memoryHistoryCache) {
      list = clone(memoryHistoryCache);
    }

    if (list.length === 0) {
      const seedEntries: PRTypeMasterVersionHistoryEntry[] = [
        ...INITIAL_PR_TYPE_MASTERS.map((prt, idx) => ({
          id: `prth-init-${idx + 1}`,
          entityType: 'PR_TYPE_MASTER' as const,
          entityId: prt.id,
          entityCodeOrLabel: `${prt.code} — ${prt.name}`,
          versionNumber: prt.versionNumber,
          action: (prt.approvalStatus === 'APPROVED' ? 'APPROVED' : 'CREATED') as
            | 'APPROVED'
            | 'CREATED',
          actorId: prt.approvedByUserId || prt.createdByUserId || 'usr-admin-01',
          actorName: prt.approvedBy || prt.createdBy,
          timestamp: prt.approvedAt || prt.createdAt,
          changeSummary:
            prt.code === 'CAPEX_ASSET'
              ? 'Seeded Capex / Asset Requisition PR Type Master in DRAFT / INACTIVE state awaiting eligibility configuration and approval.'
              : `Baseline PR Type Master record initialized (${prt.code}).`,
          newSnapshot: clone(prt),
        })),
        ...INITIAL_PR_TYPE_MAPPINGS.map((m, idx) => ({
          id: `prmh-init-${idx + 1}`,
          entityType: 'PR_TYPE_MAPPING' as const,
          entityId: m.id,
          entityCodeOrLabel: `${m.companyCode} / ${m.branchCode} / ${m.itemCategoryCode} → ${m.prTypeCode}`,
          versionNumber: m.versionNumber,
          action: 'APPROVED' as const,
          actorId: m.approvedByUserId || 'usr-checker-01',
          actorName: m.approvedBy || 'Vikramaditya Rao (Org Admin)',
          timestamp: m.approvedAt || m.createdAt,
          changeSummary: m.remarks || `Baseline mapping initialized for ${m.prTypeCode}.`,
          newSnapshot: clone(m),
        })),
      ];
      list = seedEntries;
      this.saveVersionHistory(list);
    }

    const filtered = entityId ? list.filter((e) => e.entityId === entityId) : list;
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  saveVersionHistory(entries: PRTypeMasterVersionHistoryEntry[]): void {
    memoryHistoryCache = clone(entries);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_PR_TYPE_HISTORY, JSON.stringify(entries));
      } catch (err) {
        console.error('Error saving PR Type version history:', err);
      }
    }
  },

  appendHistory(entry: Omit<PRTypeMasterVersionHistoryEntry, 'id' | 'timestamp'>): void {
    const existing = this.getVersionHistory();
    const record: PRTypeMasterVersionHistoryEntry = {
      ...entry,
      id: `prth-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    this.saveVersionHistory([record, ...existing]);
  },

  // =========================================================================
  // PR TYPE MASTER CRUD & MAKER-CHECKER LIFECYCLE
  // =========================================================================

  createPrType(
    input: {
      code: string;
      name: string;
      description: string;
      isCapexType?: boolean;
      requiresAssetClassification?: boolean;
      requiresBudgetExceptionFlow?: boolean;
      allowedRoles?: string[];
      effectiveFrom: string;
      effectiveUntil?: string;
    },
    actor?: User
  ): PRTypeMasterRecord {
    const cleanCode = input.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!cleanCode) {
      throw new Error('PR Type Code is required (letters, numbers, underscores).');
    }
    if (!input.name.trim()) {
      throw new Error('PR Type Name is required.');
    }
    if (input.effectiveUntil && input.effectiveUntil < input.effectiveFrom) {
      throw new Error('Effective Until date cannot be earlier than Effective From date.');
    }

    const existing = this.getPrTypes();
    if (existing.some((p) => p.code.toUpperCase() === cleanCode)) {
      throw new Error(`PR Type Code '${cleanCode}' already exists in PR Type Master.`);
    }

    const who = actorInfo(actor);
    const nowIso = new Date().toISOString();
    const newRecord: PRTypeMasterRecord = {
      id: `prt-${cleanCode.toLowerCase()}-${Date.now().toString().slice(-4)}`,
      code: cleanCode,
      name: input.name.trim(),
      description: input.description.trim() || input.name.trim(),
      isSystemType: false,
      isCapexType: Boolean(input.isCapexType),
      requiresAssetClassification: Boolean(input.requiresAssetClassification),
      requiresBudgetExceptionFlow: Boolean(input.requiresBudgetExceptionFlow),
      allowedRoles: input.allowedRoles || [],
      status: 'INACTIVE',
      approvalStatus: 'DRAFT',
      effectiveFrom: input.effectiveFrom,
      effectiveUntil: input.effectiveUntil || undefined,
      versionNumber: 1,
      createdAt: nowIso,
      createdBy: who.name,
      createdByUserId: who.id,
      updatedAt: nowIso,
      updatedBy: who.name,
      updatedByUserId: who.id,
    };

    this.savePrTypes([...existing, newRecord]);
    this.appendHistory({
      entityType: 'PR_TYPE_MASTER',
      entityId: newRecord.id,
      entityCodeOrLabel: `${newRecord.code} — ${newRecord.name}`,
      versionNumber: 1,
      action: 'CREATED',
      actorId: who.id,
      actorName: who.name,
      changeSummary: `Created PR Type Master record ${newRecord.code} (${newRecord.name}) in DRAFT / INACTIVE state.`,
      newSnapshot: clone(newRecord),
    });

    EnterpriseAuditService.logEvent({
      companyId: 'GLOBAL',
      companyName: 'Global Platform Master',
      entityType: 'PURCHASE_REQUISITION',
      entityId: newRecord.id,
      eventType: 'PR_TYPE_MASTER_CREATED',
      eventDescription: `Created PR Type ${newRecord.code} (${newRecord.name})`,
      newValue: newRecord,
      changedByUserId: who.id,
      changedByName: who.name,
      changeReason: 'PR Type Master creation',
    });

    return newRecord;
  },

  updatePrType(
    id: string,
    patch: Partial<
      Pick<
        PRTypeMasterRecord,
        | 'name'
        | 'description'
        | 'isCapexType'
        | 'requiresAssetClassification'
        | 'requiresBudgetExceptionFlow'
        | 'allowedRoles'
        | 'effectiveFrom'
        | 'effectiveUntil'
      >
    >,
    actor?: User,
    changeReason?: string
  ): PRTypeMasterRecord {
    const list = this.getPrTypes();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`PR Type Master record ${id} not found.`);

    const current = list[idx];
    const nextEffFrom = patch.effectiveFrom ?? current.effectiveFrom;
    const nextEffUntil =
      patch.effectiveUntil !== undefined ? patch.effectiveUntil || undefined : current.effectiveUntil;
    if (nextEffUntil && nextEffUntil < nextEffFrom) {
      throw new Error('Effective Until date cannot be earlier than Effective From date.');
    }

    const who = actorInfo(actor);
    const nowIso = new Date().toISOString();
    const nextVersion = current.versionNumber + 1;

    const updated: PRTypeMasterRecord = {
      ...current,
      ...patch,
      name: patch.name !== undefined ? patch.name.trim() : current.name,
      description: patch.description !== undefined ? patch.description.trim() : current.description,
      effectiveFrom: nextEffFrom,
      effectiveUntil: nextEffUntil,
      approvalStatus: 'DRAFT',
      versionNumber: nextVersion,
      updatedAt: nowIso,
      updatedBy: who.name,
      updatedByUserId: who.id,
    };

    list[idx] = updated;
    this.savePrTypes(list);
    this.appendHistory({
      entityType: 'PR_TYPE_MASTER',
      entityId: updated.id,
      entityCodeOrLabel: `${updated.code} — ${updated.name}`,
      versionNumber: nextVersion,
      action: 'UPDATED',
      actorId: who.id,
      actorName: who.name,
      changeSummary: changeReason?.trim() || `Updated PR Type ${updated.code} (v${nextVersion}, requires re-approval).`,
      previousSnapshot: clone(current),
      newSnapshot: clone(updated),
    });

    EnterpriseAuditService.logEvent({
      companyId: 'GLOBAL',
      companyName: 'Global Platform Master',
      entityType: 'PURCHASE_REQUISITION',
      entityId: updated.id,
      eventType: 'PR_TYPE_MASTER_UPDATED',
      eventDescription: `Updated PR Type ${updated.code} to v${nextVersion}`,
      previousValue: current,
      newValue: updated,
      changedByUserId: who.id,
      changedByName: who.name,
      changeReason: changeReason?.trim() || 'PR Type Master configuration update',
    });

    return updated;
  },

  submitPrTypeForApproval(id: string, actor?: User, remarks?: string): PRTypeMasterRecord {
    const list = this.getPrTypes();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`PR Type Master record ${id} not found.`);

    const current = list[idx];
    const who = actorInfo(actor);
    const nowIso = new Date().toISOString();
    const updated: PRTypeMasterRecord = {
      ...current,
      approvalStatus: 'PENDING_APPROVAL',
      rejectionReason: undefined,
      updatedAt: nowIso,
      updatedBy: who.name,
      updatedByUserId: who.id,
    };
    list[idx] = updated;
    this.savePrTypes(list);

    this.appendHistory({
      entityType: 'PR_TYPE_MASTER',
      entityId: updated.id,
      entityCodeOrLabel: `${updated.code} — ${updated.name}`,
      versionNumber: updated.versionNumber,
      action: 'SUBMITTED',
      actorId: who.id,
      actorName: who.name,
      changeSummary: remarks?.trim() || `Submitted PR Type ${updated.code} (v${updated.versionNumber}) for Maker-Checker approval.`,
      previousSnapshot: clone(current),
      newSnapshot: clone(updated),
    });

    return updated;
  },

  approvePrType(id: string, checker?: User, activateImmediately = true, remarks?: string): PRTypeMasterRecord {
    const list = this.getPrTypes();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`PR Type Master record ${id} not found.`);

    const current = list[idx];
    const who = actorInfo(checker);
    if (current.updatedByUserId && current.updatedByUserId === who.id) {
      throw new Error(
        'Maker-Checker Violation: The user who created or last modified this PR Type cannot approve it.'
      );
    }

    if (activateImmediately && current.code.toUpperCase() === 'EXPENSE') {
      const readiness = expenseCategoryService.checkExpensePrReadiness('co-kosh-01', 'ALL');
      if (!readiness.ready) {
        throw new Error(
          `Cannot activate EXPENSE PR Type: ${readiness.blockingReasons.join(' ')}`
        );
      }
    }

    const nowIso = new Date().toISOString();
    const updated: PRTypeMasterRecord = {
      ...current,
      approvalStatus: 'APPROVED',
      status: activateImmediately ? 'ACTIVE' : current.status,
      approvedAt: nowIso,
      approvedBy: who.name,
      approvedByUserId: who.id,
      rejectionReason: undefined,
      updatedAt: nowIso,
      updatedBy: who.name,
      updatedByUserId: who.id,
    };
    list[idx] = updated;
    this.savePrTypes(list);

    this.appendHistory({
      entityType: 'PR_TYPE_MASTER',
      entityId: updated.id,
      entityCodeOrLabel: `${updated.code} — ${updated.name}`,
      versionNumber: updated.versionNumber,
      action: 'APPROVED',
      actorId: who.id,
      actorName: who.name,
      changeSummary:
        remarks?.trim() ||
        `Approved PR Type ${updated.code} (v${updated.versionNumber}) with status ${updated.status}.`,
      previousSnapshot: clone(current),
      newSnapshot: clone(updated),
    });

    EnterpriseAuditService.logEvent({
      companyId: 'GLOBAL',
      companyName: 'Global Platform Master',
      entityType: 'PURCHASE_REQUISITION',
      entityId: updated.id,
      eventType: 'PR_TYPE_MASTER_APPROVED',
      eventDescription: `Approved PR Type ${updated.code} (status: ${updated.status})`,
      previousValue: current,
      newValue: updated,
      changedByUserId: who.id,
      changedByName: who.name,
      changeReason: remarks?.trim() || 'Maker-Checker PR Type approval',
    });

    return updated;
  },

  rejectPrType(id: string, checker?: User, reason?: string): PRTypeMasterRecord {
    const list = this.getPrTypes();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`PR Type Master record ${id} not found.`);
    if (!reason || !reason.trim()) {
      throw new Error('Mandatory rejection reason is required.');
    }

    const current = list[idx];
    const who = actorInfo(checker);
    if (current.updatedByUserId && current.updatedByUserId === who.id) {
      throw new Error(
        'Maker-Checker Violation: The user who created or last modified this PR Type cannot reject it.'
      );
    }

    const nowIso = new Date().toISOString();
    const updated: PRTypeMasterRecord = {
      ...current,
      approvalStatus: 'REJECTED',
      status: 'INACTIVE',
      rejectionReason: reason.trim(),
      updatedAt: nowIso,
      updatedBy: who.name,
      updatedByUserId: who.id,
    };
    list[idx] = updated;
    this.savePrTypes(list);

    this.appendHistory({
      entityType: 'PR_TYPE_MASTER',
      entityId: updated.id,
      entityCodeOrLabel: `${updated.code} — ${updated.name}`,
      versionNumber: updated.versionNumber,
      action: 'REJECTED',
      actorId: who.id,
      actorName: who.name,
      changeSummary: `Rejected PR Type ${updated.code}: ${reason.trim()}`,
      previousSnapshot: clone(current),
      newSnapshot: clone(updated),
    });

    return updated;
  },

  togglePrTypeStatus(
    id: string,
    targetStatus: PRTypeMasterStatus,
    actor?: User,
    reason?: string
  ): PRTypeMasterRecord {
    const list = this.getPrTypes();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`PR Type Master record ${id} not found.`);

    const current = list[idx];
    if (targetStatus === 'ACTIVE' && current.approvalStatus !== 'APPROVED') {
      throw new Error(
        `PR Type ${current.code} must be APPROVED before it can be activated (current approval status: ${current.approvalStatus}).`
      );
    }

    if (targetStatus === 'ACTIVE' && current.code.toUpperCase() === 'EXPENSE') {
      const readiness = expenseCategoryService.checkExpensePrReadiness('co-kosh-01', 'ALL');
      if (!readiness.ready) {
        throw new Error(
          `Cannot activate EXPENSE PR Type: ${readiness.blockingReasons.join(' ')}`
        );
      }
    }

    const who = actorInfo(actor);
    const nowIso = new Date().toISOString();
    const nextVersion = current.versionNumber + 1;
    const updated: PRTypeMasterRecord = {
      ...current,
      status: targetStatus,
      versionNumber: nextVersion,
      updatedAt: nowIso,
      updatedBy: who.name,
      updatedByUserId: who.id,
    };
    list[idx] = updated;
    this.savePrTypes(list);

    this.appendHistory({
      entityType: 'PR_TYPE_MASTER',
      entityId: updated.id,
      entityCodeOrLabel: `${updated.code} — ${updated.name}`,
      versionNumber: nextVersion,
      action: targetStatus === 'ACTIVE' ? 'ACTIVATED' : 'DEACTIVATED',
      actorId: who.id,
      actorName: who.name,
      changeSummary:
        reason?.trim() || `${targetStatus === 'ACTIVE' ? 'Activated' : 'Deactivated'} PR Type ${updated.code}.`,
      previousSnapshot: clone(current),
      newSnapshot: clone(updated),
    });

    return updated;
  },

  // =========================================================================
  // COMPANY -> BRANCH -> PURCHASE ORG -> ITEM CATEGORY -> PR TYPE MAPPINGS
  // =========================================================================

  createMapping(
    input: {
      companyId: string;
      branchId: string;
      purchaseOrgId: string;
      purchaseOrgCode?: string;
      purchaseOrgName?: string;
      itemCategoryCode: string;
      prTypeCode: PRType | string;
      isEligible: boolean;
      effectiveFrom: string;
      effectiveUntil?: string;
      remarks?: string;
    },
    actor?: User
  ): PRTypeApplicabilityMappingRecord {
    const normComp = normalizeScopeCompanyId(input.companyId);
    const normBranch = normalizeScopeBranchId(input.branchId);
    const normPo = normalizeScopePurchaseOrgId(input.purchaseOrgId);
    const normCat = normalizeItemCategoryCode(input.itemCategoryCode);
    const prCode = input.prTypeCode.trim().toUpperCase();

    if (!this.getPrTypeByCode(prCode)) {
      throw new Error(`PR Type '${prCode}' does not exist in PR Type Master.`);
    }
    if (input.effectiveUntil && input.effectiveUntil < input.effectiveFrom) {
      throw new Error('Effective Until date cannot be earlier than Effective From date.');
    }

    const compObj =
      normComp === 'ALL' ? undefined : INITIAL_COMPANIES.find((c) => c.id === normComp);
    const branchObj =
      normBranch === 'ALL' ? undefined : INITIAL_BRANCHES.find((b) => b.id === normBranch);

    const who = actorInfo(actor);
    const nowIso = new Date().toISOString();

    const record: PRTypeApplicabilityMappingRecord = {
      id: `map-${prCode.toLowerCase()}-${Date.now().toString().slice(-5)}-${Math.random()
        .toString(36)
        .slice(2, 5)}`,
      companyId: normComp,
      companyCode: normComp === 'ALL' ? 'ALL' : compObj?.code || normComp,
      companyName: normComp === 'ALL' ? 'All Companies' : compObj?.name || normComp,
      branchId: normBranch,
      branchCode: normBranch === 'ALL' ? 'ALL' : branchObj?.portalBranchCode || branchObj?.code || normBranch,
      branchName: normBranch === 'ALL' ? 'All Branches' : branchObj?.name || normBranch,
      purchaseOrgId: normPo,
      purchaseOrgCode: normPo === 'ALL' ? 'ALL' : input.purchaseOrgCode || normPo,
      purchaseOrgName:
        normPo === 'ALL' ? 'All Purchase Organizations' : input.purchaseOrgName || normPo,
      itemCategoryCode: normCat,
      itemCategoryName: resolveItemCategoryName(normCat),
      prTypeCode: prCode,
      isEligible: input.isEligible,
      effectiveFrom: input.effectiveFrom,
      effectiveUntil: input.effectiveUntil || undefined,
      status: 'INACTIVE',
      approvalStatus: 'DRAFT',
      versionNumber: 1,
      remarks: input.remarks?.trim(),
      createdAt: nowIso,
      createdBy: who.name,
      createdByUserId: who.id,
      updatedAt: nowIso,
      updatedBy: who.name,
      updatedByUserId: who.id,
    };

    const list = this.getMappings();
    this.saveMappings([record, ...list]);
    this.appendHistory({
      entityType: 'PR_TYPE_MAPPING',
      entityId: record.id,
      entityCodeOrLabel: `${record.companyCode} / ${record.branchCode} / ${record.purchaseOrgCode} / ${record.itemCategoryCode} → ${record.prTypeCode}`,
      versionNumber: 1,
      action: 'CREATED',
      actorId: who.id,
      actorName: who.name,
      changeSummary:
        record.remarks ||
        `Created ${record.isEligible ? 'ALLOW' : 'DENY'} mapping for ${record.prTypeCode} (${record.companyCode} / ${record.branchCode} / ${record.itemCategoryCode}) in DRAFT / INACTIVE state.`,
      newSnapshot: clone(record),
    });

    EnterpriseAuditService.logEvent({
      companyId: normComp === 'ALL' ? 'ALL' : normComp,
      companyName: record.companyName,
      branchId: normBranch === 'ALL' ? undefined : normBranch,
      entityType: 'PURCHASE_REQUISITION',
      entityId: record.id,
      eventType: 'PR_TYPE_MAPPING_CREATED',
      eventDescription: `Created PR Type mapping ${record.companyCode}/${record.branchCode}/${record.itemCategoryCode} → ${record.prTypeCode} (${record.isEligible ? 'ALLOW' : 'DENY'})`,
      newValue: record,
      changedByUserId: who.id,
      changedByName: who.name,
      changeReason: record.remarks || 'PR Type eligibility mapping created',
    });

    return record;
  },

  updateMapping(
    id: string,
    patch: Partial<
      Pick<
        PRTypeApplicabilityMappingRecord,
        | 'companyId'
        | 'branchId'
        | 'purchaseOrgId'
        | 'purchaseOrgCode'
        | 'purchaseOrgName'
        | 'itemCategoryCode'
        | 'prTypeCode'
        | 'isEligible'
        | 'effectiveFrom'
        | 'effectiveUntil'
        | 'remarks'
      >
    >,
    actor?: User,
    changeReason?: string
  ): PRTypeApplicabilityMappingRecord {
    const list = this.getMappings();
    const idx = list.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`Mapping record ${id} not found.`);

    const current = list[idx];
    const nextComp = normalizeScopeCompanyId(patch.companyId ?? current.companyId);
    const nextBranch = normalizeScopeBranchId(patch.branchId ?? current.branchId);
    const nextPo = normalizeScopePurchaseOrgId(patch.purchaseOrgId ?? current.purchaseOrgId);
    const nextCat = normalizeItemCategoryCode(patch.itemCategoryCode ?? current.itemCategoryCode);
    const nextPrCode = (patch.prTypeCode ?? current.prTypeCode).trim().toUpperCase();
    const nextEffFrom = patch.effectiveFrom ?? current.effectiveFrom;
    const nextEffUntil =
      patch.effectiveUntil !== undefined ? patch.effectiveUntil || undefined : current.effectiveUntil;

    if (nextEffUntil && nextEffUntil < nextEffFrom) {
      throw new Error('Effective Until date cannot be earlier than Effective From date.');
    }

    const compObj =
      nextComp === 'ALL' ? undefined : INITIAL_COMPANIES.find((c) => c.id === nextComp);
    const branchObj =
      nextBranch === 'ALL' ? undefined : INITIAL_BRANCHES.find((b) => b.id === nextBranch);

    const who = actorInfo(actor);
    const nowIso = new Date().toISOString();
    const nextVersion = current.versionNumber + 1;

    const updated: PRTypeApplicabilityMappingRecord = {
      ...current,
      companyId: nextComp,
      companyCode: nextComp === 'ALL' ? 'ALL' : compObj?.code || nextComp,
      companyName: nextComp === 'ALL' ? 'All Companies' : compObj?.name || nextComp,
      branchId: nextBranch,
      branchCode:
        nextBranch === 'ALL'
          ? 'ALL'
          : branchObj?.portalBranchCode || branchObj?.code || nextBranch,
      branchName: nextBranch === 'ALL' ? 'All Branches' : branchObj?.name || nextBranch,
      purchaseOrgId: nextPo,
      purchaseOrgCode:
        nextPo === 'ALL' ? 'ALL' : patch.purchaseOrgCode ?? current.purchaseOrgCode ?? nextPo,
      purchaseOrgName:
        nextPo === 'ALL'
          ? 'All Purchase Organizations'
          : patch.purchaseOrgName ?? current.purchaseOrgName ?? nextPo,
      itemCategoryCode: nextCat,
      itemCategoryName: resolveItemCategoryName(nextCat),
      prTypeCode: nextPrCode,
      isEligible: patch.isEligible ?? current.isEligible,
      effectiveFrom: nextEffFrom,
      effectiveUntil: nextEffUntil,
      remarks: patch.remarks !== undefined ? patch.remarks : current.remarks,
      approvalStatus: 'DRAFT',
      versionNumber: nextVersion,
      updatedAt: nowIso,
      updatedBy: who.name,
      updatedByUserId: who.id,
    };

    list[idx] = updated;
    this.saveMappings(list);
    this.appendHistory({
      entityType: 'PR_TYPE_MAPPING',
      entityId: updated.id,
      entityCodeOrLabel: `${updated.companyCode} / ${updated.branchCode} / ${updated.purchaseOrgCode} / ${updated.itemCategoryCode} → ${updated.prTypeCode}`,
      versionNumber: nextVersion,
      action: 'UPDATED',
      actorId: who.id,
      actorName: who.name,
      changeSummary:
        changeReason?.trim() ||
        `Updated mapping v${nextVersion} (${updated.companyCode}/${updated.branchCode}/${updated.itemCategoryCode} → ${updated.prTypeCode}); requires re-approval.`,
      previousSnapshot: clone(current),
      newSnapshot: clone(updated),
    });

    return updated;
  },

  submitMappingForApproval(
    id: string,
    actor?: User,
    remarks?: string
  ): PRTypeApplicabilityMappingRecord {
    const list = this.getMappings();
    const idx = list.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`Mapping record ${id} not found.`);

    const current = list[idx];
    const who = actorInfo(actor);
    const nowIso = new Date().toISOString();
    const updated: PRTypeApplicabilityMappingRecord = {
      ...current,
      approvalStatus: 'PENDING_APPROVAL',
      rejectionReason: undefined,
      updatedAt: nowIso,
      updatedBy: who.name,
      updatedByUserId: who.id,
    };
    list[idx] = updated;
    this.saveMappings(list);

    this.appendHistory({
      entityType: 'PR_TYPE_MAPPING',
      entityId: updated.id,
      entityCodeOrLabel: `${updated.companyCode} / ${updated.branchCode} / ${updated.purchaseOrgCode} / ${updated.itemCategoryCode} → ${updated.prTypeCode}`,
      versionNumber: updated.versionNumber,
      action: 'SUBMITTED',
      actorId: who.id,
      actorName: who.name,
      changeSummary:
        remarks?.trim() || `Submitted mapping v${updated.versionNumber} for Maker-Checker approval.`,
      previousSnapshot: clone(current),
      newSnapshot: clone(updated),
    });

    return updated;
  },

  approveMapping(
    id: string,
    checker?: User,
    activateImmediately = true,
    remarks?: string
  ): PRTypeApplicabilityMappingRecord {
    const list = this.getMappings();
    const idx = list.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`Mapping record ${id} not found.`);

    const current = list[idx];
    const who = actorInfo(checker);
    if (current.updatedByUserId && current.updatedByUserId === who.id) {
      throw new Error(
        'Maker-Checker Violation: The user who created or last modified this mapping cannot approve it.'
      );
    }

    const nowIso = new Date().toISOString();
    const updated: PRTypeApplicabilityMappingRecord = {
      ...current,
      approvalStatus: 'APPROVED',
      status: activateImmediately ? 'ACTIVE' : current.status,
      approvedAt: nowIso,
      approvedBy: who.name,
      approvedByUserId: who.id,
      rejectionReason: undefined,
      updatedAt: nowIso,
      updatedBy: who.name,
      updatedByUserId: who.id,
    };
    list[idx] = updated;
    this.saveMappings(list);

    this.appendHistory({
      entityType: 'PR_TYPE_MAPPING',
      entityId: updated.id,
      entityCodeOrLabel: `${updated.companyCode} / ${updated.branchCode} / ${updated.purchaseOrgCode} / ${updated.itemCategoryCode} → ${updated.prTypeCode}`,
      versionNumber: updated.versionNumber,
      action: 'APPROVED',
      actorId: who.id,
      actorName: who.name,
      changeSummary:
        remarks?.trim() ||
        `Approved mapping v${updated.versionNumber} (${updated.status}, ${updated.isEligible ? 'ALLOW' : 'DENY'}).`,
      previousSnapshot: clone(current),
      newSnapshot: clone(updated),
    });

    EnterpriseAuditService.logEvent({
      companyId: updated.companyId === 'ALL' ? 'ALL' : updated.companyId,
      companyName: updated.companyName,
      branchId: updated.branchId === 'ALL' ? undefined : updated.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: updated.id,
      eventType: 'PR_TYPE_MAPPING_APPROVED',
      eventDescription: `Approved PR Type mapping ${updated.companyCode}/${updated.branchCode}/${updated.itemCategoryCode} → ${updated.prTypeCode} (${updated.status})`,
      previousValue: current,
      newValue: updated,
      changedByUserId: who.id,
      changedByName: who.name,
      changeReason: remarks?.trim() || 'Maker-Checker PR Type mapping approval',
    });

    return updated;
  },

  rejectMapping(
    id: string,
    checker?: User,
    reason?: string
  ): PRTypeApplicabilityMappingRecord {
    const list = this.getMappings();
    const idx = list.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`Mapping record ${id} not found.`);
    if (!reason || !reason.trim()) {
      throw new Error('Mandatory rejection reason is required.');
    }

    const current = list[idx];
    const who = actorInfo(checker);
    if (current.updatedByUserId && current.updatedByUserId === who.id) {
      throw new Error(
        'Maker-Checker Violation: The user who created or last modified this mapping cannot reject it.'
      );
    }

    const nowIso = new Date().toISOString();
    const updated: PRTypeApplicabilityMappingRecord = {
      ...current,
      approvalStatus: 'REJECTED',
      status: 'INACTIVE',
      rejectionReason: reason.trim(),
      updatedAt: nowIso,
      updatedBy: who.name,
      updatedByUserId: who.id,
    };
    list[idx] = updated;
    this.saveMappings(list);

    this.appendHistory({
      entityType: 'PR_TYPE_MAPPING',
      entityId: updated.id,
      entityCodeOrLabel: `${updated.companyCode} / ${updated.branchCode} / ${updated.purchaseOrgCode} / ${updated.itemCategoryCode} → ${updated.prTypeCode}`,
      versionNumber: updated.versionNumber,
      action: 'REJECTED',
      actorId: who.id,
      actorName: who.name,
      changeSummary: `Rejected mapping v${updated.versionNumber}: ${reason.trim()}`,
      previousSnapshot: clone(current),
      newSnapshot: clone(updated),
    });

    return updated;
  },

  toggleMappingStatus(
    id: string,
    targetStatus: PRTypeMasterStatus,
    actor?: User,
    reason?: string
  ): PRTypeApplicabilityMappingRecord {
    const list = this.getMappings();
    const idx = list.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`Mapping record ${id} not found.`);

    const current = list[idx];
    if (targetStatus === 'ACTIVE' && current.approvalStatus !== 'APPROVED') {
      throw new Error(
        `Mapping must be APPROVED before activation (current approval status: ${current.approvalStatus}).`
      );
    }

    const who = actorInfo(actor);
    const nowIso = new Date().toISOString();
    const nextVersion = current.versionNumber + 1;
    const updated: PRTypeApplicabilityMappingRecord = {
      ...current,
      status: targetStatus,
      versionNumber: nextVersion,
      updatedAt: nowIso,
      updatedBy: who.name,
      updatedByUserId: who.id,
    };
    list[idx] = updated;
    this.saveMappings(list);

    this.appendHistory({
      entityType: 'PR_TYPE_MAPPING',
      entityId: updated.id,
      entityCodeOrLabel: `${updated.companyCode} / ${updated.branchCode} / ${updated.purchaseOrgCode} / ${updated.itemCategoryCode} → ${updated.prTypeCode}`,
      versionNumber: nextVersion,
      action: targetStatus === 'ACTIVE' ? 'ACTIVATED' : 'DEACTIVATED',
      actorId: who.id,
      actorName: who.name,
      changeSummary:
        reason?.trim() ||
        `${targetStatus === 'ACTIVE' ? 'Activated' : 'Deactivated'} mapping for ${updated.prTypeCode}.`,
      previousSnapshot: clone(current),
      newSnapshot: clone(updated),
    });

    return updated;
  },

  // =========================================================================
  // CENTRALIZED ELIGIBILITY EVALUATION
  // =========================================================================

  evaluatePrTypeEligibility(params: {
    companyId: string;
    branchId: string;
    purchaseOrgId?: string;
    itemCategoryCode?: string;
    prTypeCode: PRType | string;
    evaluationDate?: string;
    userRole?: string;
  }): PRTypeEligibilityEvaluationResult {
    const prCode = params.prTypeCode.trim().toUpperCase();
    const evalDate = (params.evaluationDate || new Date().toISOString()).slice(0, 10);
    const normComp = normalizeScopeCompanyId(params.companyId);
    const normBranch = normalizeScopeBranchId(params.branchId);
    const normPo = normalizeScopePurchaseOrgId(params.purchaseOrgId);
    const normCat = normalizeItemCategoryCode(params.itemCategoryCode);

    // 1. Verify PR Type Master record
    const prTypeRec = this.getPrTypeByCode(prCode);
    if (!prTypeRec) {
      return {
        eligible: false,
        reason: `PR Type '${prCode}' is not registered in the PR Type Master.`,
        prTypeCode: prCode,
      };
    }

    if (prTypeRec.approvalStatus !== 'APPROVED') {
      return {
        eligible: false,
        reason: `PR Type '${prTypeRec.name}' (${prCode}) is not approved (Approval Status: ${prTypeRec.approvalStatus}).`,
        prTypeCode: prCode,
        prTypeRecord: prTypeRec,
      };
    }

    if (prTypeRec.status !== 'ACTIVE') {
      return {
        eligible: false,
        reason: `PR Type '${prTypeRec.name}' (${prCode}) is currently INACTIVE in PR Type Master.`,
        prTypeCode: prCode,
        prTypeRecord: prTypeRec,
      };
    }

    if (!isEffectiveOnDate(prTypeRec.effectiveFrom, prTypeRec.effectiveUntil, evalDate)) {
      return {
        eligible: false,
        reason: `PR Type '${prTypeRec.name}' (${prCode}) is outside its effective date window (${prTypeRec.effectiveFrom}${prTypeRec.effectiveUntil ? ` to ${prTypeRec.effectiveUntil}` : '+'}).`,
        prTypeCode: prCode,
        prTypeRecord: prTypeRec,
      };
    }

    // 2. Role check if explicitly constrained on PR Type Master
    if (
      params.userRole &&
      prTypeRec.allowedRoles.length > 0 &&
      !prTypeRec.allowedRoles.includes(params.userRole)
    ) {
      return {
        eligible: false,
        reason: `Role '${params.userRole}' is not authorized to initiate '${prTypeRec.name}' requisitions.`,
        prTypeCode: prCode,
        prTypeRecord: prTypeRec,
      };
    }

    // 3. Special governed path for EXPENSE PR Type (Expense Category + SAP GL Account readiness)
    if (prCode === 'EXPENSE') {
      const readiness = expenseCategoryService.checkExpensePrReadiness(normComp, normBranch, evalDate);
      if (!readiness.ready) {
        return {
          eligible: false,
          reason: `EXPENSE PR Type is not ready for ${normComp} / ${normBranch}: ${readiness.blockingReasons.join(' ')}`,
          prTypeCode: prCode,
          prTypeRecord: prTypeRec,
        };
      }

      // Also check if there is an explicit DENY mapping in PRTypeApplicabilityMappingRecord for EXPENSE
      const expenseMappings = this.getMappings({
        status: 'ACTIVE',
        approvalStatus: 'APPROVED',
        prTypeCode: 'EXPENSE',
      }).filter((m) => {
        if (!isEffectiveOnDate(m.effectiveFrom, m.effectiveUntil, evalDate)) return false;
        const compOk = m.companyId === 'ALL' || m.companyId === normComp;
        const branchOk = m.branchId === 'ALL' || m.branchId === normBranch;
        const poOk = m.purchaseOrgId === 'ALL' || normPo === 'ALL' || m.purchaseOrgId === normPo;
        return compOk && branchOk && poOk;
      });

      if (expenseMappings.length > 0) {
        const sortedExp = [...expenseMappings].sort(
          (a, b) => computeSpecificityScore(b) - computeSpecificityScore(a)
        );
        if (!sortedExp[0].isEligible) {
          return {
            eligible: false,
            reason:
              sortedExp[0].remarks ||
              `EXPENSE PR Type is explicitly disabled for ${normComp} / ${normBranch}.`,
            prTypeCode: prCode,
            prTypeRecord: prTypeRec,
            matchedMapping: sortedExp[0],
          };
        }
      }

      if (!params.itemCategoryCode || params.itemCategoryCode.trim().toUpperCase() === 'ALL') {
        return {
          eligible: true,
          reason: `Authorized EXPENSE PR Type with ${readiness.eligibleCategoriesCount} mapped Expense Categories and ${readiness.sapAccountMappingsCount} SAP GL Account mappings.`,
          prTypeCode: prCode,
          prTypeRecord: prTypeRec,
          specificityScore: 4,
        };
      }

      const normExpCode = expenseCategoryService.normalizeExpenseCategoryCode(params.itemCategoryCode);
      const eligibleExpCats = expenseCategoryService.getEligibleExpenseCategories(
        normComp,
        normBranch,
        evalDate
      );
      const matchedExpCat = eligibleExpCats.find(
        (c) => c.categoryCode.toUpperCase() === normExpCode.toUpperCase()
      );
      if (!matchedExpCat) {
        return {
          eligible: false,
          reason: `Category '${params.itemCategoryCode}' is not an eligible, approved Expense Category for EXPENSE PRs in ${normComp} / ${normBranch}. Inventory item categories cannot be used on EXPENSE PRs.`,
          prTypeCode: prCode,
          prTypeRecord: prTypeRec,
        };
      }
      return {
        eligible: true,
        reason: `Authorized Expense Category '${matchedExpCat.categoryName}' (${matchedExpCat.categoryCode}) mapped to SAP GL Account ${matchedExpCat.sapGlAccountCode}.`,
        prTypeCode: prCode,
        prTypeRecord: prTypeRec,
        specificityScore: 8,
      };
    }

    // Block Expense Categories (EXP-*) from being used on Inventory PR Types
    if (
      params.itemCategoryCode &&
      params.itemCategoryCode.trim().toUpperCase() !== 'ALL' &&
      params.itemCategoryCode.trim().toUpperCase().startsWith('EXP-')
    ) {
      return {
        eligible: false,
        reason: `Expense Category '${params.itemCategoryCode}' is mapped exclusively to EXPENSE PRs and cannot be used under Inventory PR Type '${prTypeRec.name}' (${prCode}).`,
        prTypeCode: prCode,
        prTypeRecord: prTypeRec,
      };
    }

    // 4. Evaluate Company -> Branch -> Purchase Org -> Item Category -> PR Type mapping
    const allContextActiveMappings = this.getMappings({
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
    }).filter((m) => {
      if (!isEffectiveOnDate(m.effectiveFrom, m.effectiveUntil, evalDate)) return false;
      const compOk = m.companyId === 'ALL' || m.companyId === normComp;
      const branchOk = m.branchId === 'ALL' || m.branchId === normBranch;
      const poOk = m.purchaseOrgId === 'ALL' || normPo === 'ALL' || m.purchaseOrgId === normPo;
      return compOk && branchOk && poOk;
    });

    const prTypeContextMappings = allContextActiveMappings.filter(
      (m) => m.prTypeCode.toUpperCase() === prCode
    );

    const hasCategorySpecificAllowForPrType = prTypeContextMappings.some(
      (m) => m.itemCategoryCode !== 'ALL' && m.isEligible === true
    );

    const candidates = prTypeContextMappings.filter((m) => {
      if (normCat === 'ALL') {
        return true;
      }
      if (m.itemCategoryCode === 'ALL') {
        // If this PR Type already has explicit category-specific ALLOW mappings for this context,
        // do NOT let a broad wildcard 'ALL' ALLOW mapping bypass them for unmapped categories.
        if (hasCategorySpecificAllowForPrType && m.isEligible === true) {
          return false;
        }
        return true;
      }
      return normalizeItemCategoryCode(m.itemCategoryCode) === normCat;
    });

    if (candidates.length === 0) {
      if (hasCategorySpecificAllowForPrType && normCat !== 'ALL') {
        return {
          eligible: false,
          reason: `Category '${resolveItemCategoryName(normCat)}' is not mapped to PR Type '${prTypeRec.name}' (${prCode}) for ${normComp} / ${normBranch}.`,
          prTypeCode: prCode,
          prTypeRecord: prTypeRec,
        };
      }
      // Strict deny-by-default for CAPEX_ASSET and all non-legacy PR types
      if (!LEGACY_SYSTEM_TYPES.has(prCode)) {
        return {
          eligible: false,
          reason: `No active, approved Company / Branch / Purchase Org / Item Category mapping authorizes '${prTypeRec.name}' (${prCode}) for ${normComp} / ${normBranch} / Category ${normCat} on ${evalDate}.`,
          prTypeCode: prCode,
          prTypeRecord: prTypeRec,
        };
      }
      return {
        eligible: true,
        reason: `Legacy baseline PR Type '${prCode}' permitted.`,
        prTypeCode: prCode,
        prTypeRecord: prTypeRec,
        specificityScore: 0,
      };
    }

    // Highest specificity wins; on tie, explicit DENY overrides ALLOW, else newest version wins
    const sorted = [...candidates].sort((a, b) => {
      const specDiff = computeSpecificityScore(b) - computeSpecificityScore(a);
      if (specDiff !== 0) return specDiff;
      if (a.isEligible !== b.isEligible) return a.isEligible ? 1 : -1;
      return b.versionNumber - a.versionNumber;
    });

    const winner = sorted[0];
    const score = computeSpecificityScore(winner);
    if (!winner.isEligible) {
      return {
        eligible: false,
        reason:
          winner.remarks ||
          `'${prTypeRec.name}' (${prCode}) is explicitly disabled by mapping ${winner.companyCode} / ${winner.branchCode} / ${winner.itemCategoryCode} (v${winner.versionNumber}).`,
        prTypeCode: prCode,
        prTypeRecord: prTypeRec,
        matchedMapping: winner,
        specificityScore: score,
      };
    }

    // Exclusivity enforcement:
    // If winner is only a generic wildcard 'ALL' ALLOW mapping for this PR Type,
    // never expose categories that are explicitly ALLOW-mapped to OTHER PR Type(s) in this context.
    if (normCat !== 'ALL' && winner.itemCategoryCode === 'ALL') {
      const mappedToOtherPrTypes = Array.from(
        new Set(
          allContextActiveMappings
            .filter(
              (m) =>
                m.prTypeCode.toUpperCase() !== prCode &&
                m.isEligible === true &&
                m.itemCategoryCode !== 'ALL' &&
                normalizeItemCategoryCode(m.itemCategoryCode) === normCat
            )
            .map((m) => m.prTypeCode)
        )
      );
      if (mappedToOtherPrTypes.length > 0) {
        return {
          eligible: false,
          reason: `Category '${resolveItemCategoryName(normCat)}' is exclusively mapped to PR Type(s) [${mappedToOtherPrTypes.join(', ')}] and is not eligible under '${prTypeRec.name}' (${prCode}).`,
          prTypeCode: prCode,
          prTypeRecord: prTypeRec,
        };
      }
    }

    return {
      eligible: true,
      reason: `Authorized by mapping ${winner.companyCode} / ${winner.branchCode} / ${winner.purchaseOrgCode} / ${winner.itemCategoryCode} (v${winner.versionNumber}).`,
      prTypeCode: prCode,
      prTypeRecord: prTypeRec,
      matchedMapping: winner,
      specificityScore: score,
    };
  },

  getEligiblePrTypesForContext(params: {
    companyId: string;
    branchId: string;
    purchaseOrgId?: string;
    itemCategoryCode?: string;
    evaluationDate?: string;
    userRole?: string;
  }): Array<{
    prType: PRTypeMasterRecord;
    evaluation: PRTypeEligibilityEvaluationResult;
  }> {
    return this.getPrTypes().map((prType) => ({
      prType,
      evaluation: this.evaluatePrTypeEligibility({
        companyId: params.companyId,
        branchId: params.branchId,
        purchaseOrgId: params.purchaseOrgId,
        itemCategoryCode: params.itemCategoryCode,
        prTypeCode: prType.code,
        evaluationDate: params.evaluationDate,
        userRole: params.userRole,
      }),
    }));
  },

  /**
   * Returns only item/expense categories eligible for the selected Company, Branch, Purchase Org, PR Type, date & user role.
   * For EXPENSE PR Type, returns governed Expense Categories; for Inventory PR Types, returns eligible Item Categories.
   */
  getEligibleCategoriesForContext(params: {
    companyId: string;
    branchId: string;
    purchaseOrgId?: string;
    prTypeCode: PRType | string;
    evaluationDate?: string;
    userRole?: string;
  }): Array<{
    code: string;
    name: string;
    display: string;
    evaluation: PRTypeEligibilityEvaluationResult;
  }> {
    const prCode = params.prTypeCode.trim().toUpperCase();
    if (prCode === 'EXPENSE') {
      const prTypeEval = this.evaluatePrTypeEligibility({
        companyId: params.companyId,
        branchId: params.branchId,
        purchaseOrgId: params.purchaseOrgId,
        itemCategoryCode: 'ALL',
        prTypeCode: 'EXPENSE',
        evaluationDate: params.evaluationDate,
        userRole: params.userRole,
      });
      if (!prTypeEval.eligible) return [];

      const expCats = expenseCategoryService.getEligibleExpenseCategories(
        params.companyId,
        params.branchId,
        params.evaluationDate
      );
      return expCats.map((ec) => ({
        code: ec.categoryCode,
        name: ec.categoryName,
        display: `${ec.categoryName} (${ec.categoryCode}) · GL ${ec.sapGlAccountCode}`,
        evaluation: {
          eligible: true,
          reason: `Mapped Expense Category ${ec.categoryCode} → SAP GL ${ec.sapGlAccountCode}`,
          prTypeCode: 'EXPENSE',
          prTypeRecord: prTypeEval.prTypeRecord,
        },
      }));
    }

    const categories = CLASSIFICATION_DIMENSIONS.category?.values || [];
    const results: Array<{
      code: string;
      name: string;
      display: string;
      evaluation: PRTypeEligibilityEvaluationResult;
    }> = [];

    for (const cat of categories) {
      const evaluation = this.evaluatePrTypeEligibility({
        companyId: params.companyId,
        branchId: params.branchId,
        purchaseOrgId: params.purchaseOrgId,
        itemCategoryCode: cat.code,
        prTypeCode: params.prTypeCode,
        evaluationDate: params.evaluationDate,
        userRole: params.userRole,
      });
      if (evaluation.eligible) {
        results.push({
          code: cat.code,
          name: cat.name,
          display: cat.display,
          evaluation,
        });
      }
    }
    return results;
  },

  /**
   * Revalidates all existing PR lines against a target PR Type & Company/Branch context without deleting lines.
   */
  validateLinesCategoriesForPrType(params: {
    companyId: string;
    branchId: string;
    purchaseOrgId?: string;
    prTypeCode: PRType | string;
    lines: Array<{ id?: string; itemCode?: string; itemCategory?: string; expenseCategoryCode?: string }>;
    evaluationDate?: string;
    userRole?: string;
  }): {
    valid: boolean;
    prTypeEligible: boolean;
    prTypeReason?: string;
    eligibleCategories: Array<{ code: string; name: string; display: string }>;
    invalidLines: Array<{
      lineIndex: number;
      lineId?: string;
      itemCode?: string;
      rawCategory: string;
      normalizedCategory: string;
      reason: string;
    }>;
  } {
    const prCode = params.prTypeCode.trim().toUpperCase();
    const prTypeEval = this.evaluatePrTypeEligibility({
      companyId: params.companyId,
      branchId: params.branchId,
      purchaseOrgId: params.purchaseOrgId,
      itemCategoryCode: 'ALL',
      prTypeCode: prCode,
      evaluationDate: params.evaluationDate,
      userRole: params.userRole,
    });

    const eligibleCategories = this.getEligibleCategoriesForContext({
      companyId: params.companyId,
      branchId: params.branchId,
      purchaseOrgId: params.purchaseOrgId,
      prTypeCode: prCode,
      evaluationDate: params.evaluationDate,
      userRole: params.userRole,
    }).map(({ code, name, display }) => ({ code, name, display }));

    const invalidLines: Array<{
      lineIndex: number;
      lineId?: string;
      itemCode?: string;
      rawCategory: string;
      normalizedCategory: string;
      reason: string;
    }> = [];

    (params.lines || []).forEach((line, idx) => {
      const rawCat = (line.expenseCategoryCode || line.itemCategory || '').trim();
      const normCat =
        prCode === 'EXPENSE'
          ? expenseCategoryService.normalizeExpenseCategoryCode(rawCat)
          : rawCat.toUpperCase().startsWith('EXP-')
          ? rawCat.toUpperCase()
          : normalizeItemCategoryCode(rawCat);

      if (!rawCat || normCat === 'ALL') {
        invalidLines.push({
          lineIndex: idx,
          lineId: line.id,
          itemCode: line.itemCode,
          rawCategory: rawCat || 'UNSPECIFIED',
          normalizedCategory: normCat,
          reason: `Line #${idx + 1} (${line.itemCode || 'Line'}) is missing a valid mapped category for PR Type ${prCode}.`,
        });
        return;
      }

      const lineEval = this.evaluatePrTypeEligibility({
        companyId: params.companyId,
        branchId: params.branchId,
        purchaseOrgId: params.purchaseOrgId,
        itemCategoryCode: normCat,
        prTypeCode: prCode,
        evaluationDate: params.evaluationDate,
        userRole: params.userRole,
      });

      if (!lineEval.eligible) {
        invalidLines.push({
          lineIndex: idx,
          lineId: line.id,
          itemCode: line.itemCode,
          rawCategory: rawCat,
          normalizedCategory: normCat,
          reason: lineEval.reason,
        });
      }
    });

    return {
      valid: prTypeEval.eligible && invalidLines.length === 0,
      prTypeEligible: prTypeEval.eligible,
      prTypeReason: prTypeEval.eligible ? undefined : prTypeEval.reason,
      eligibleCategories,
      invalidLines,
    };
  },
};
