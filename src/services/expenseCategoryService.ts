/**
 * KOSH INNOVATIONS — EXPENSE CATEGORY MASTER, COMPANY/BRANCH MAPPING,
 * SAP EXPENSE ACCOUNT MAPPING & CLASSIFICATION RULE CONFLICT GUARD
 *
 * Governs Expense PR (PRType = 'EXPENSE') procurement separately from inventory Charge Items:
 * - Inventory-linked expenses (freight, loading, unloading, customs, transit insurance, P&F) = Charge Items
 * - Independent non-inventory expenses/services = EXPENSE PR using governed Expense Categories
 */

import { User } from '../types';
import {
  CompanyBranchExpenseCategoryMapping,
  ExpenseCategoryOptionResolved,
  ExpenseCategoryRecord,
  ExpensePrReadinessResult,
  PRTypeApprovalStatus,
  PRTypeMasterStatus,
  SapExpenseAccountMapping,
} from '../types/prTypeMaster';
import { PRType } from '../types/purchaseRequisition';
import { INITIAL_BRANCHES, INITIAL_COMPANIES } from '../data/seedData';
import { EnterpriseAuditService } from './enterpriseAuditService';
import { costCentreMasterService } from './costCentreMasterService';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const STORAGE_KEY_EXP_CATEGORIES = 'kosh_expense_category_master_v1';
const STORAGE_KEY_EXP_MAPPINGS = 'kosh_expense_category_mappings_v1';
const STORAGE_KEY_SAP_EXP_ACCOUNTS = 'kosh_sap_expense_account_mappings_v1';

function normCompanyId(companyId?: string): string {
  const raw = (companyId || '').trim();
  const upper = raw.toUpperCase();
  if (!raw || upper === 'ALL') return raw ? 'ALL' : 'co-kosh-01';
  if (
    raw === 'comp-1' ||
    upper === 'COMP-001' ||
    upper === 'KOSH-HQ' ||
    upper === 'KOSH_INNOVATIONS' ||
    upper === 'CO-KOSH-01'
  ) {
    return 'co-kosh-01';
  }
  if (raw === 'comp-2' || upper === 'COMP-002' || upper === 'KOSH-AUTO' || upper === 'CO-KOSH-02') {
    return 'co-kosh-02';
  }
  return raw;
}

function normBranchId(branchId?: string): string {
  const raw = (branchId || '').trim();
  const upper = raw.toUpperCase();
  if (!raw || upper === 'ALL') return 'ALL';
  if (raw === 'branch-001' || upper === 'BR-001' || upper === '001' || upper === 'BR-POND-01') {
    return 'br-pond-01';
  }
  if (raw === 'branch-002' || upper === 'BR-002' || upper === '002' || upper === 'BR-HOSUR-02') {
    return 'br-hosur-02';
  }
  return raw;
}

function isEffectiveOnDate(effectiveFrom: string, effectiveUntil: string | undefined, dateIso: string): boolean {
  const d = (dateIso || new Date().toISOString()).slice(0, 10);
  if (effectiveFrom && d < effectiveFrom.slice(0, 10)) return false;
  if (effectiveUntil && d > effectiveUntil.slice(0, 10)) return false;
  return true;
}

export const INITIAL_EXPENSE_CATEGORIES: ExpenseCategoryRecord[] = [
  {
    id: 'expcat-cons',
    code: 'EXP-CONS',
    name: 'Consultancy & Advisory Services',
    description: 'External engineering, management, strategy, and specialized technical consultancy services.',
    expenseCode: 'SVC-CONSULTANCY',
    defaultTaxCode: 'SAC-GST-18',
    defaultGstRatePercent: 18,
    requiresQuantityUom: false,
    defaultUom: 'SVC',
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2026-01-01',
    versionNumber: 1,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    approvedAt: '2026-01-01T00:10:00Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
  },
  {
    id: 'expcat-prof',
    code: 'EXP-PROF',
    name: 'Professional Fees',
    description: 'Chartered accountant, chartered engineer, valuation, and specialist professional engagements.',
    expenseCode: 'SVC-PROF-FEES',
    defaultTaxCode: 'SAC-GST-18',
    defaultGstRatePercent: 18,
    requiresQuantityUom: false,
    defaultUom: 'SVC',
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2026-01-01',
    versionNumber: 1,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    approvedAt: '2026-01-01T00:10:00Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
  },
  {
    id: 'expcat-legal',
    code: 'EXP-LEGAL',
    name: 'Legal & Statutory Retainership',
    description: 'Corporate legal counsel, regulatory filings, patent compliance, and arbitration retainers.',
    expenseCode: 'SVC-LEGAL',
    defaultTaxCode: 'SAC-RCM-18',
    defaultGstRatePercent: 18,
    requiresQuantityUom: false,
    defaultUom: 'SVC',
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2026-01-01',
    versionNumber: 1,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    approvedAt: '2026-01-01T00:10:00Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
  },
  {
    id: 'expcat-audit',
    code: 'EXP-AUDIT',
    name: 'Audit & Assurance Services',
    description: 'Statutory financial audit, internal controls audit, ISO surveillance audit, and ESG assurance.',
    expenseCode: 'SVC-AUDIT',
    defaultTaxCode: 'SAC-GST-18',
    defaultGstRatePercent: 18,
    requiresQuantityUom: false,
    defaultUom: 'SVC',
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2026-01-01',
    versionNumber: 1,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    approvedAt: '2026-01-01T00:10:00Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
  },
  {
    id: 'expcat-rent',
    code: 'EXP-RENT',
    name: 'Office / Warehouse / Equipment Rent',
    description: 'Non-capital operating leases, regional office rent, and external warehouse space rental.',
    expenseCode: 'SVC-RENT-LEASE',
    defaultTaxCode: 'SAC-GST-18',
    defaultGstRatePercent: 18,
    requiresQuantityUom: true,
    defaultUom: 'MON',
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2026-01-01',
    versionNumber: 1,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    approvedAt: '2026-01-01T00:10:00Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
  },
  {
    id: 'expcat-saas',
    code: 'EXP-SAAS',
    name: 'Software Subscription & Cloud Services',
    description: 'Enterprise SaaS licenses, CAD/CAM subscriptions, ERP hosting, and cybersecurity tools.',
    expenseCode: 'SVC-SAAS-SUB',
    defaultTaxCode: 'SAC-GST-18',
    defaultGstRatePercent: 18,
    requiresQuantityUom: true,
    defaultUom: 'LIC',
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2026-01-01',
    versionNumber: 1,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    approvedAt: '2026-01-01T00:10:00Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
  },
  {
    id: 'expcat-train',
    code: 'EXP-TRAIN',
    name: 'Training & Workforce Certification',
    description: 'Technical skill workshops, safety training, Six Sigma coaching, and employee certification programs.',
    expenseCode: 'SVC-TRAINING',
    defaultTaxCode: 'SAC-GST-18',
    defaultGstRatePercent: 18,
    requiresQuantityUom: true,
    defaultUom: 'SES',
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2026-01-01',
    versionNumber: 1,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    approvedAt: '2026-01-01T00:10:00Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
  },
  {
    id: 'expcat-facil',
    code: 'EXP-FACIL',
    name: 'Facility Management & Security Services',
    description: 'Housekeeping, campus security, HVAC annual facility management, and cafeteria operations.',
    expenseCode: 'SVC-FACILITY',
    defaultTaxCode: 'SAC-GST-18',
    defaultGstRatePercent: 18,
    requiresQuantityUom: true,
    defaultUom: 'MON',
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2026-01-01',
    versionNumber: 1,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    approvedAt: '2026-01-01T00:10:00Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
  },
  {
    id: 'expcat-maint',
    code: 'EXP-MAINT',
    name: 'Independent Maintenance / Service Contracts',
    description: 'Standalone non-inventory AMC, IT support retainer, and independent calibration contracts.',
    expenseCode: 'SVC-IND-MAINT',
    defaultTaxCode: 'SAC-GST-18',
    defaultGstRatePercent: 18,
    requiresQuantityUom: false,
    defaultUom: 'SVC',
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2026-01-01',
    versionNumber: 1,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    approvedAt: '2026-01-01T00:10:00Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
  },
  {
    id: 'expcat-admin',
    code: 'EXP-ADMIN',
    name: 'Administrative & General Operating Services',
    description: 'Courier retainers, printing/stationery service contracts, corporate travel desk, and admin services.',
    expenseCode: 'SVC-ADMIN-OPS',
    defaultTaxCode: 'SAC-GST-18',
    defaultGstRatePercent: 18,
    requiresQuantityUom: false,
    defaultUom: 'SVC',
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2026-01-01',
    versionNumber: 1,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    approvedAt: '2026-01-01T00:10:00Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
  },
];

export const INITIAL_EXPENSE_CATEGORY_MAPPINGS: CompanyBranchExpenseCategoryMapping[] =
  INITIAL_EXPENSE_CATEGORIES.map((cat) => ({
    id: `expmap-all-${cat.code.toLowerCase()}`,
    companyId: 'ALL',
    companyCode: 'ALL',
    branchId: 'ALL',
    branchCode: 'ALL',
    prTypeCode: 'EXPENSE',
    expenseCategoryCode: cat.code,
    expenseCategoryName: cat.name,
    isEligible: true,
    effectiveFrom: '2026-01-01',
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    versionNumber: 1,
    remarks: 'Governed default Expense Category eligibility mapping for Expense PRs.',
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'Rajesh Sharma (Platform Admin)',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'Vikramaditya Rao (Org Admin)',
    approvedAt: '2026-01-01T00:10:00Z',
    approvedBy: 'Vikramaditya Rao (Org Admin)',
  }));

const SAP_GL_ACCOUNT_DEFAULTS: Record<
  string,
  { glCode: string; glName: string; sapExpenseCode: string; taxCode: string; gstPct: number }
> = {
  'EXP-CONS': {
    glCode: '610100',
    glName: 'Consultancy & Technical Advisory Expenses',
    sapExpenseCode: 'SAP-EXP-CONS',
    taxCode: 'GST@18S',
    gstPct: 18,
  },
  'EXP-PROF': {
    glCode: '610300',
    glName: 'Professional & Statutory Certification Fees',
    sapExpenseCode: 'SAP-EXP-PROF',
    taxCode: 'GST@18S',
    gstPct: 18,
  },
  'EXP-LEGAL': {
    glCode: '610200',
    glName: 'Legal & Regulatory Retainership Account',
    sapExpenseCode: 'SAP-EXP-LEGAL',
    taxCode: 'RCM@18S',
    gstPct: 18,
  },
  'EXP-AUDIT': {
    glCode: '610400',
    glName: 'Audit & Assurance Fees Account',
    sapExpenseCode: 'SAP-EXP-AUDIT',
    taxCode: 'GST@18S',
    gstPct: 18,
  },
  'EXP-RENT': {
    glCode: '620100',
    glName: 'Premises & Warehouse Lease Rent',
    sapExpenseCode: 'SAP-EXP-RENT',
    taxCode: 'GST@18S',
    gstPct: 18,
  },
  'EXP-SAAS': {
    glCode: '630100',
    glName: 'Software Subscriptions & Cloud Hosting',
    sapExpenseCode: 'SAP-EXP-SAAS',
    taxCode: 'GST@18S',
    gstPct: 18,
  },
  'EXP-TRAIN': {
    glCode: '640100',
    glName: 'Workforce Training & Capability Development',
    sapExpenseCode: 'SAP-EXP-TRAIN',
    taxCode: 'GST@18S',
    gstPct: 18,
  },
  'EXP-FACIL': {
    glCode: '650100',
    glName: 'Facility Management & Plant Security Services',
    sapExpenseCode: 'SAP-EXP-FACIL',
    taxCode: 'GST@18S',
    gstPct: 18,
  },
  'EXP-MAINT': {
    glCode: '650200',
    glName: 'Independent Maintenance & Service Contracts',
    sapExpenseCode: 'SAP-EXP-MAINT',
    taxCode: 'GST@18S',
    gstPct: 18,
  },
  'EXP-ADMIN': {
    glCode: '660100',
    glName: 'Administrative & General Operating Expenses',
    sapExpenseCode: 'SAP-EXP-ADMIN',
    taxCode: 'GST@18S',
    gstPct: 18,
  },
};

export const INITIAL_SAP_EXPENSE_ACCOUNT_MAPPINGS: SapExpenseAccountMapping[] =
  INITIAL_EXPENSE_CATEGORIES.map((cat) => {
    const gl = SAP_GL_ACCOUNT_DEFAULTS[cat.code] || {
      glCode: '699900',
      glName: `${cat.name} Expense Account`,
      sapExpenseCode: `SAP-${cat.code}`,
      taxCode: 'GST@18S',
      gstPct: cat.defaultGstRatePercent,
    };
    return {
      id: `sapexp-all-${cat.code.toLowerCase()}`,
      companyId: 'ALL',
      companyCode: 'ALL',
      branchId: 'ALL',
      expenseCategoryCode: cat.code,
      sapExpenseCode: gl.sapExpenseCode,
      sapServiceAccountCode: gl.glCode,
      sapAccountName: gl.glName,
      sapTaxCode: gl.taxCode,
      gstRatePercent: gl.gstPct,
      costCenterRequired: true,
      effectiveFrom: '2026-01-01',
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
      versionNumber: 1,
      updatedAt: '2026-01-01T00:00:00Z',
      updatedBy: 'SAP Finance Integration Lead',
    };
  });

const INVENTORY_CHARGE_KEYWORDS = [
  'loading charge',
  'unloading charge',
  'freight charge',
  'customs duty',
  'import duty',
  'bcd',
  'transit insurance',
  'marine insurance',
  'packaging charge',
  'packing charge',
  'demurrage',
  'octroi',
  'chg-load',
  'chg-unload',
  'chg-freight',
  'chg-customs',
  'chg-insurance',
  'chg-packaging',
];

let memoryExpCategories: ExpenseCategoryRecord[] | null = null;
let memoryExpMappings: CompanyBranchExpenseCategoryMapping[] | null = null;
let memorySapExpMappings: SapExpenseAccountMapping[] | null = null;

function readStore<T>(key: string, mem: T[] | null, fallback: T[]): T[] {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as T[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fall through
    }
  }
  if (mem) return JSON.parse(JSON.stringify(mem));
  return JSON.parse(JSON.stringify(fallback));
}

function writeStore<T>(key: string, data: T[], setMem: (val: T[]) => void): void {
  const cloned = JSON.parse(JSON.stringify(data));
  setMem(cloned);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(cloned));
    } catch {
      // ignore storage quota errors in headless tests
    }
  }
}

export const expenseCategoryService = {
  getCategories(): ExpenseCategoryRecord[] {
    const list = readStore(STORAGE_KEY_EXP_CATEGORIES, memoryExpCategories, INITIAL_EXPENSE_CATEGORIES);
    if (!memoryExpCategories) memoryExpCategories = JSON.parse(JSON.stringify(list));
    return list;
  },

  saveCategories(records: ExpenseCategoryRecord[]): void {
    writeStore(STORAGE_KEY_EXP_CATEGORIES, records, (val) => {
      memoryExpCategories = val;
    });
  },

  getMappings(): CompanyBranchExpenseCategoryMapping[] {
    const list = readStore(STORAGE_KEY_EXP_MAPPINGS, memoryExpMappings, INITIAL_EXPENSE_CATEGORY_MAPPINGS);
    if (!memoryExpMappings) memoryExpMappings = JSON.parse(JSON.stringify(list));
    return list;
  },

  saveMappings(records: CompanyBranchExpenseCategoryMapping[]): void {
    writeStore(STORAGE_KEY_EXP_MAPPINGS, records, (val) => {
      memoryExpMappings = val;
    });
  },

  getSapExpenseAccountMappings(): SapExpenseAccountMapping[] {
    const list = readStore(
      STORAGE_KEY_SAP_EXP_ACCOUNTS,
      memorySapExpMappings,
      INITIAL_SAP_EXPENSE_ACCOUNT_MAPPINGS
    );
    if (!memorySapExpMappings) memorySapExpMappings = JSON.parse(JSON.stringify(list));
    return list;
  },

  saveSapExpenseAccountMappings(records: SapExpenseAccountMapping[]): void {
    writeStore(STORAGE_KEY_SAP_EXP_ACCOUNTS, records, (val) => {
      memorySapExpMappings = val;
    });
  },

  resolveSapAccountMapping(params: {
    companyId: string;
    branchId: string;
    expenseCategoryCode: string;
    evaluationDate?: string;
  }): SapExpenseAccountMapping | undefined {
    const normCo = normCompanyId(params.companyId);
    const normBr = normBranchId(params.branchId);
    const evalDate = (params.evaluationDate || new Date().toISOString()).slice(0, 10);
    const candidates = this.getSapExpenseAccountMappings().filter(
      (m) =>
        m.expenseCategoryCode.toUpperCase() === params.expenseCategoryCode.toUpperCase() &&
        m.status === 'ACTIVE' &&
        m.approvalStatus === 'APPROVED' &&
        (m.companyId === 'ALL' || normCompanyId(m.companyId) === normCo) &&
        (m.branchId === 'ALL' || normBranchId(m.branchId) === normBr) &&
        isEffectiveOnDate(m.effectiveFrom, m.effectiveUntil, evalDate)
    );
    if (candidates.length === 0) return undefined;
    candidates.sort((a, b) => {
      const scoreA = (a.companyId !== 'ALL' ? 2 : 0) + (a.branchId !== 'ALL' ? 4 : 0);
      const scoreB = (b.companyId !== 'ALL' ? 2 : 0) + (b.branchId !== 'ALL' ? 4 : 0);
      return scoreB - scoreA;
    });
    return candidates[0];
  },

  /**
   * Resolves ONLY active, approved, effective Expense Categories mapped to the target
   * Company, Branch, and PR Type (typically 'EXPENSE').
   */
  getEligibleExpenseCategories(
    companyIdOrParams:
      | string
      | {
          companyId: string;
          branchId?: string;
          prTypeCode?: PRType | string;
          evaluationDate?: string;
        },
    branchIdArg?: string,
    asOfDateArg?: string
  ): ExpenseCategoryOptionResolved[] {
    const params =
      typeof companyIdOrParams === 'string'
        ? {
            companyId: companyIdOrParams,
            branchId: branchIdArg || 'ALL',
            prTypeCode: 'EXPENSE',
            evaluationDate: asOfDateArg,
          }
        : companyIdOrParams;

    const normCo = normCompanyId(params.companyId);
    const normBr = normBranchId(params.branchId);
    const prType = (params.prTypeCode || 'EXPENSE').toUpperCase();
    const evalDate = (params.evaluationDate || new Date().toISOString()).slice(0, 10);

    const categories = this.getCategories().filter(
      (c) =>
        c.status === 'ACTIVE' &&
        c.approvalStatus === 'APPROVED' &&
        isEffectiveOnDate(c.effectiveFrom, c.effectiveUntil, evalDate)
    );

    const mappings = this.getMappings().filter(
      (m) =>
        m.status === 'ACTIVE' &&
        m.approvalStatus === 'APPROVED' &&
        m.prTypeCode.toUpperCase() === prType &&
        (m.companyId === 'ALL' || normCompanyId(m.companyId) === normCo) &&
        (m.branchId === 'ALL' || normBranchId(m.branchId) === normBr) &&
        isEffectiveOnDate(m.effectiveFrom, m.effectiveUntil, evalDate)
    );

    const results: ExpenseCategoryOptionResolved[] = [];
    for (const cat of categories) {
      const matching = mappings.filter(
        (m) => m.expenseCategoryCode.toUpperCase() === cat.code.toUpperCase()
      );
      if (matching.length === 0) continue;
      matching.sort((a, b) => {
        const sA = (a.companyId !== 'ALL' ? 2 : 0) + (a.branchId !== 'ALL' ? 4 : 0);
        const sB = (b.companyId !== 'ALL' ? 2 : 0) + (b.branchId !== 'ALL' ? 4 : 0);
        return sB - sA;
      });
      const best = matching[0];
      if (!best.isEligible) continue;
      const sapAccountMapping = this.resolveSapAccountMapping({
        companyId: normCo,
        branchId: normBr,
        expenseCategoryCode: cat.code,
        evaluationDate: evalDate,
      });
      results.push({
        category: cat,
        mapping: best,
        sapAccountMapping,
        categoryCode: cat.code,
        categoryName: cat.name,
        description: cat.description,
        defaultTaxCode: sapAccountMapping?.sapTaxCode || cat.defaultTaxCode,
        defaultTaxPercent: sapAccountMapping?.gstRatePercent ?? cat.defaultGstRatePercent,
        sapGlAccountCode: sapAccountMapping?.sapServiceAccountCode || '699900',
        sapGlAccountName: sapAccountMapping?.sapAccountName || `${cat.name} Expense Account`,
        sapExpenseCode: sapAccountMapping?.sapExpenseCode || cat.expenseCode,
      });
    }
    return results;
  },

  /**
   * Builds a normalized ExpensePrLineRecord with SAP GL Account, Service From/To Dates,
   * and automatically determined Cost Centre from Cost Centre Master.
   */
  buildExpensePrLine(params: {
    id?: string;
    prId?: string;
    lineNumber?: number;
    companyId: string;
    branchId: string;
    userId?: string;
    expenseCategoryCode: string;
    description: string;
    costCentre?: string;
    costCenter?: string;
    department?: string;
    serviceFromDate?: string;
    serviceToDate?: string;
    expectedServiceDate?: string;
    requiredDate?: string;
    quantity?: number;
    uom?: string;
    amount?: number;
    unitRate?: number;
    currency?: string;
    taxCode?: string;
    taxRatePercent?: number;
    taxPercent?: number;
    gstRatePercent?: number;
    taxInclusive?: boolean;
    isTaxInclusive?: boolean;
    vendorSuggestion?: string;
    vendorOrPayee?: string;
    purchasePurpose?: string;
    businessJustification?: string;
    remarks?: string;
  }): any {
    const eligible = this.getEligibleExpenseCategories({
      companyId: params.companyId,
      branchId: params.branchId,
      prTypeCode: 'EXPENSE',
    });
    const matched = eligible.find(
      (c) => c.categoryCode.toUpperCase() === (params.expenseCategoryCode || '').toUpperCase()
    );
    const catName = matched?.categoryName || params.expenseCategoryCode;
    const taxCode = params.taxCode || matched?.defaultTaxCode || 'SAC-GST-18';
    const taxPct =
      params.taxRatePercent ??
      params.taxPercent ??
      params.gstRatePercent ??
      matched?.defaultTaxPercent ??
      18;
    const qty = params.quantity && params.quantity > 0 ? Number(params.quantity) : 1;
    const rate = Number(params.unitRate ?? params.amount ?? 0);
    const inclusive = Boolean(params.taxInclusive ?? params.isTaxInclusive);
    const grossOrNet = Number((qty * rate).toFixed(2));
    const baseAmount =
      inclusive && taxPct > 0
        ? Number((grossOrNet / (1 + taxPct / 100)).toFixed(2))
        : grossOrNet;
    const taxAmount =
      inclusive && taxPct > 0
        ? Number((grossOrNet - baseAmount).toFixed(2))
        : Number(((baseAmount * taxPct) / 100).toFixed(2));
    const totalAmount = Number((baseAmount + taxAmount).toFixed(2));
    const sapGl = matched?.sapGlAccountCode || '610100';
    const sapGlName = matched?.sapGlAccountName || `${catName} Expense Account`;

    const resolvedDepartment = (params.department || 'Production & Plant Operations').trim();
    const ccDetermination = costCentreMasterService.resolveCostCentresForContext({
      companyId: params.companyId,
      branchId: params.branchId,
      department: resolvedDepartment,
      userId: params.userId,
    });

    const explicitCc = (params.costCentre || params.costCenter || '').trim().toUpperCase();
    const costCentre = ccDetermination.valid
      ? explicitCc &&
        ccDetermination.eligibleCostCentres.some((c) => c.code.toUpperCase() === explicitCc)
        ? explicitCc
        : ccDetermination.defaultCostCentreCode
      : '';

    const defaultFromIso = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const defaultToIso = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const serviceFromDate = (
      params.serviceFromDate ||
      params.expectedServiceDate ||
      params.requiredDate ||
      defaultFromIso
    ).trim();
    const serviceToDate = (
      params.serviceToDate ||
      params.expectedServiceDate ||
      params.requiredDate ||
      (serviceFromDate >= defaultToIso ? serviceFromDate : defaultToIso)
    ).trim();
    const svcDate = serviceToDate || serviceFromDate;

    return {
      id: params.id || `exp-line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      prId: params.prId || '',
      lineNumber: params.lineNumber || 1,
      expenseCategoryCode: params.expenseCategoryCode,
      expenseCategoryName: catName,
      expenseCode: matched?.sapExpenseCode || `SVC-${params.expenseCategoryCode}`,
      description: params.description,
      expenseDescription: params.description,
      quantity: qty,
      uom: params.uom || matched?.category.defaultUom || 'SVC',
      unitRate: rate,
      amount: baseAmount,
      currency: params.currency || 'INR',
      baseAmount,
      taxCode,
      gstRatePercent: taxPct,
      taxPercent: taxPct,
      taxRatePercent: taxPct,
      taxAmount,
      totalAmount,
      totalWithTax: totalAmount,
      totalAmountWithTax: totalAmount,
      taxInclusive: inclusive,
      isTaxInclusive: inclusive,
      vendorOrPayee: params.vendorOrPayee || params.vendorSuggestion || '',
      vendorSuggestion: params.vendorSuggestion || params.vendorOrPayee || '',
      costCenter: costCentre,
      costCentre,
      department: resolvedDepartment,
      serviceFromDate,
      serviceToDate,
      requiredDate: svcDate,
      expectedServiceDate: svcDate,
      sapServiceAccountCode: sapGl,
      sapGlAccountCode: sapGl,
      sapGlAccountName: sapGlName,
      sapCostCenterCode: costCentre,
      sapExpenseCode: matched?.sapExpenseCode || `SAP-${params.expenseCategoryCode}`,
      sapTaxCode: taxCode,
      purchasePurpose: params.purchasePurpose || params.description,
      businessJustification: params.businessJustification || params.remarks || params.description,
      remarks: params.remarks || '',
      attachments: [],
      lineAttachments: [],
      status: 'ACTIVE',
    };
  },

  /**
   * Validates a list of Expense PR lines against governed Expense Categories,
   * Service From / To Dates, and Cost Centre Master mappings.
   */
  validateExpenseLinesForPr(params: {
    companyId: string;
    branchId: string;
    department?: string;
    userId?: string;
    prTypeCode?: PRType | string;
    expenseLines: Array<any>;
    headerCostCentre?: string;
    headerExpectedServiceDate?: string;
    headerBusinessJustification?: string;
    evaluationDate?: string;
    asOfDate?: string;
  }): {
    valid: boolean;
    blockingReasons: string[];
    errors: string[];
    lineErrors: Record<number, string[]>;
    normalizedLines: Array<any>;
    eligibleCategories: ExpenseCategoryOptionResolved[];
  } {
    const evalDate = params.evaluationDate || params.asOfDate;
    const eligibleCategories = this.getEligibleExpenseCategories({
      companyId: params.companyId,
      branchId: params.branchId,
      prTypeCode: params.prTypeCode || 'EXPENSE',
      evaluationDate: evalDate,
    });
    const blockingReasons: string[] = [];
    const lineErrors: Record<number, string[]> = {};
    const normalizedLines: Array<any> = [];

    if (!params.expenseLines || params.expenseLines.length === 0) {
      blockingReasons.push('Expense PR requires at least one Expense / Service line.');
      return {
        valid: false,
        blockingReasons,
        errors: blockingReasons,
        lineErrors,
        normalizedLines,
        eligibleCategories,
      };
    }

    params.expenseLines.forEach((line, idx) => {
      const ln = line.lineNumber || idx + 1;
      const rowErrs: string[] = [];
      const catCode = (line.expenseCategoryCode || '').trim().toUpperCase();
      if (!catCode) {
        rowErrs.push(`Expense Line #${ln}: Expense Category is mandatory.`);
      }
      const matched = eligibleCategories.find(
        (opt) => opt.category.code.toUpperCase() === catCode
      );
      if (catCode && !matched) {
        rowErrs.push(
          `Expense Line #${ln}: Expense Category '${line.expenseCategoryCode}' is inactive, unapproved, expired, or not mapped to ${normCompanyId(params.companyId)} / ${normBranchId(params.branchId)}.`
        );
      } else if (
        matched &&
        !matched.sapAccountMapping &&
        !line.sapServiceAccountCode &&
        !line.sapGlAccountCode
      ) {
        rowErrs.push(
          `Expense Line #${ln}: SAP Service Account mapping missing for Expense Category '${matched.category.name}'.`
        );
      }

      const desc = (line.description || line.expenseDescription || '').trim();
      if (!desc) {
        rowErrs.push(`Expense Line #${ln}: Expense / Service description is mandatory.`);
      }

      // 1. Validate Service From Date and Service To Date
      const fromDate = String(
        line.serviceFromDate ?? line.expectedServiceDate ?? line.requiredDate ?? ''
      ).trim();
      const toDate = String(
        line.serviceToDate ?? line.expectedServiceDate ?? line.requiredDate ?? ''
      ).trim();

      if (!fromDate || !ISO_DATE_RE.test(fromDate)) {
        rowErrs.push(`Expense Line #${ln}: Service From Date is mandatory (YYYY-MM-DD).`);
      }
      if (!toDate || !ISO_DATE_RE.test(toDate)) {
        rowErrs.push(`Expense Line #${ln}: Service To Date is mandatory (YYYY-MM-DD).`);
      }
      if (fromDate && toDate && ISO_DATE_RE.test(fromDate) && ISO_DATE_RE.test(toDate)) {
        if (toDate < fromDate) {
          rowErrs.push(
            `Expense Line #${ln}: Service To Date (${toDate}) cannot be earlier than Service From Date (${fromDate}).`
          );
        }
      }

      // 2. Validate Automatic Cost Centre Determination from Cost Centre Master
      const lineDept = String(line.department || params.department || '').trim();
      const ccResolution = costCentreMasterService.resolveCostCentresForContext({
        companyId: params.companyId,
        branchId: params.branchId,
        department: lineDept,
        userId: params.userId,
        evaluationDate: evalDate,
      });

      const resolvedLineCc = String(
        line.costCentre ?? line.costCenter ?? params.headerCostCentre ?? ccResolution.defaultCostCentreCode ?? ''
      )
        .trim()
        .toUpperCase();

      if (!ccResolution.valid || ccResolution.eligibleCostCentres.length === 0) {
        rowErrs.push(
          `Expense Line #${ln}: ${
            ccResolution.validationMessage ||
            `No valid Cost Centre mapping exists for Company '${params.companyId}', Branch '${params.branchId}', and Department '${lineDept}'.`
          }`
        );
      } else if (!resolvedLineCc) {
        rowErrs.push(
          `Expense Line #${ln}: Cost Centre is mandatory and must be selected from mapped Cost Centres (${ccResolution.eligibleCostCentres
            .map((c) => c.code)
            .join(', ')}).`
        );
      } else if (
        !ccResolution.eligibleCostCentres.some((c) => c.code.toUpperCase() === resolvedLineCc)
      ) {
        rowErrs.push(
          `Expense Line #${ln}: Cost Centre '${resolvedLineCc}' is not a valid mapped Cost Centre for ${params.companyId} / ${params.branchId} / ${lineDept}. Eligible Cost Centre(s): ${ccResolution.eligibleCostCentres
            .map((c) => c.code)
            .join(', ')}.`
        );
      }

      const rateVal = Number(line.unitRate ?? line.amount ?? line.baseAmount ?? 0);
      if (rateVal <= 0) {
        rowErrs.push(`Expense Line #${ln}: Amount / Unit Rate must be greater than zero.`);
      }

      const conflict = this.detectClassificationConflict({
        prType: 'EXPENSE',
        expenseCategoryCode: line.expenseCategoryCode,
        description: desc,
      });
      if (conflict.conflict) {
        rowErrs.push(`Expense Line #${ln}: ${conflict.reason}`);
      }

      if (rowErrs.length > 0) {
        lineErrors[idx] = rowErrs;
        blockingReasons.push(...rowErrs);
      }

      const built = this.buildExpensePrLine({
        ...line,
        lineNumber: ln,
        companyId: params.companyId,
        branchId: params.branchId,
        userId: params.userId,
        department: lineDept || 'Production & Plant Operations',
        expenseCategoryCode: catCode || line.expenseCategoryCode || 'EXP-CONS',
        description: desc,
        costCentre: ccResolution.valid ? resolvedLineCc : '',
        serviceFromDate: fromDate,
        serviceToDate: toDate,
        expectedServiceDate: toDate || fromDate,
        businessJustification:
          line.businessJustification || params.headerBusinessJustification || desc,
      });
      normalizedLines.push(built);
    });

    return {
      valid: blockingReasons.length === 0,
      blockingReasons,
      errors: blockingReasons,
      lineErrors,
      normalizedLines,
      eligibleCategories,
    };
  },

  /**
   * Classification Rule Conflict Guard:
   * - Inventory-linked expenses = Charge Item
   * - Independent expense/service = EXPENSE PR
   */
  detectClassificationConflict(params: {
    mechanism?: 'INVENTORY_CHARGE_ITEM' | 'EXPENSE_PR_LINE';
    prType?: PRType | string;
    code?: string;
    expenseCategoryCode?: string;
    description?: string;
    linkedChargeCode?: string;
    linkedInventoryPrRef?: string;
    lines?: Array<any>;
    expenseLines?: Array<any>;
    chargeItems?: Array<any>;
  }): { conflict: boolean; hasConflict: boolean; reason: string; conflicts: string[] } {
    const conflicts: string[] = [];
    const code = (params.code || params.expenseCategoryCode || '').toUpperCase();
    const desc = (params.description || '').toLowerCase();

    if (params.mechanism === 'INVENTORY_CHARGE_ITEM') {
      const isIndependentExpense =
        code.startsWith('EXP-') ||
        desc.includes('legal') ||
        desc.includes('audit') ||
        desc.includes('consultancy') ||
        desc.includes('retainer') ||
        desc.includes('rent') ||
        desc.includes('software subscription');
      if (isIndependentExpense) {
        const msg = `Classification Rule Conflict: "${params.description || code}" is an independent non-inventory expense. Mandatory Rule: Independent expense/service = EXPENSE PR (do not record as an Inventory Charge Item).`;
        conflicts.push(msg);
      }
    }

    if (params.mechanism === 'EXPENSE_PR_LINE' || params.prType === 'EXPENSE') {
      if (params.linkedChargeCode || code.startsWith('CHG-')) {
        const msg = `Classification Rule Conflict: '${params.linkedChargeCode || code}' is an inventory-linked charge. Mandatory Rule: Inventory-linked expense = Charge Item on the Inventory PR (do not duplicate as an EXPENSE PR line).`;
        conflicts.push(msg);
      }
      if (params.linkedInventoryPrRef) {
        const msg = `Classification Rule Conflict: Expense references Inventory PR '${params.linkedInventoryPrRef}'. Mandatory Rule: Inventory-linked expense = Charge Item on the Inventory PR.`;
        conflicts.push(msg);
      }
      const matchedKeyword = INVENTORY_CHARGE_KEYWORDS.find((kw) => desc.includes(kw));
      if (matchedKeyword && code !== 'EXP-MAINT') {
        const msg = `Classification Rule Conflict: "${params.description}" matches inventory-linked Charge Item ('${matchedKeyword}'). Mandatory Rule: Inventory-linked expense = Charge Item on the Inventory PR; Independent expense/service = EXPENSE PR.`;
        conflicts.push(msg);
      }
      if (Array.isArray(params.lines) && params.lines.length > 0) {
        conflicts.push(
          'Classification Rule Conflict: EXPENSE Purchase Requisitions must not include Inventory Item lines.'
        );
      }
      if (
        Array.isArray(params.chargeItems) &&
        params.chargeItems.some((c) => c && c.applicability !== 'NOT_APPLICABLE')
      ) {
        conflicts.push(
          'Classification Rule Conflict: EXPENSE Purchase Requisitions must not include Inventory Charge Items.'
        );
      }
      if (Array.isArray(params.expenseLines)) {
        for (const el of params.expenseLines) {
          const elDesc = (el.description || el.expenseDescription || '').toLowerCase();
          const kw = INVENTORY_CHARGE_KEYWORDS.find((k) => elDesc.includes(k));
          if (kw && el.expenseCategoryCode !== 'EXP-MAINT') {
            conflicts.push(
              `Classification Rule Conflict: Expense line "${el.description || el.expenseDescription}" matches inventory-linked Charge Item ('${kw}'). Inventory-linked expense = Charge Item.`
            );
          }
        }
      }
    } else if (
      params.prType &&
      params.prType !== 'EXPENSE' &&
      Array.isArray(params.expenseLines) &&
      params.expenseLines.length > 0
    ) {
      conflicts.push(
        `Classification Rule Conflict: Inventory Purchase Requisition (${params.prType}) must not include independent Expense PR lines.`
      );
    }

    const hasConflict = conflicts.length > 0;
    return {
      conflict: hasConflict,
      hasConflict,
      reason: conflicts[0] || '',
      conflicts,
    };
  },

  normalizeExpenseCategoryCode(code?: string): string {
    const raw = (code || '').trim().toUpperCase();
    if (!raw) return '';
    const map: Record<string, string> = {
      CONSULTANCY: 'EXP-CONS',
      'CONSULTANCY CHARGES': 'EXP-CONS',
      PROFESSIONAL: 'EXP-PROF',
      'PROFESSIONAL FEES': 'EXP-PROF',
      LEGAL: 'EXP-LEGAL',
      'LEGAL EXPENSES': 'EXP-LEGAL',
      AUDIT: 'EXP-AUDIT',
      'AUDIT FEES': 'EXP-AUDIT',
      RENT: 'EXP-RENT',
      SAAS: 'EXP-SAAS',
      'SOFTWARE SUBSCRIPTION': 'EXP-SAAS',
      TRAINING: 'EXP-TRAIN',
      'EXP-TRNG': 'EXP-TRAIN',
      FACILITY: 'EXP-FACIL',
      'EXP-FAC': 'EXP-FACIL',
      'EXP-MAINT-SVC': 'EXP-MAINT',
      ADMIN: 'EXP-ADMIN',
    };
    return map[raw] || raw;
  },

  /**
   * Completeness Gate required before PR Type MASTER 'EXPENSE' can be activated/approved.
   */
  checkExpensePrReadiness(
    companyIdOrParams:
      | string
      | {
          companyId: string;
          branchId?: string;
          approvalWorkflowEnabled?: boolean;
          evaluationDate?: string;
        },
    branchIdArg?: string,
    approvalOrEvalDateArg?: boolean | string
  ): ExpensePrReadinessResult {
    const params =
      typeof companyIdOrParams === 'string'
        ? {
            companyId: companyIdOrParams,
            branchId: branchIdArg || 'ALL',
            approvalWorkflowEnabled:
              typeof approvalOrEvalDateArg === 'boolean' ? approvalOrEvalDateArg : true,
            evaluationDate:
              typeof approvalOrEvalDateArg === 'string' ? approvalOrEvalDateArg : undefined,
          }
        : {
            ...companyIdOrParams,
            approvalWorkflowEnabled: companyIdOrParams.approvalWorkflowEnabled ?? true,
          };

    const normCo = normCompanyId(params.companyId);
    const normBr = normBranchId(params.branchId || 'ALL');
    const eligible = this.getEligibleExpenseCategories({
      companyId: normCo,
      branchId: normBr,
      prTypeCode: 'EXPENSE',
      evaluationDate: params.evaluationDate,
    });

    const blockingReasons: string[] = [];
    if (eligible.length === 0) {
      blockingReasons.push(
        `No active approved Expense Category Mappings configured for ${normCo} / ${normBr}.`
      );
    }

    const withSap = eligible.filter(
      (e) => e.sapAccountMapping && e.sapAccountMapping.sapServiceAccountCode
    );
    const missingSapMappings = eligible
      .filter((e) => !e.sapAccountMapping || !e.sapAccountMapping.sapServiceAccountCode)
      .map((e) => e.category.code);
    if (missingSapMappings.length > 0) {
      blockingReasons.push(
        `Missing active SAP Expense Account / Tax mapping for Expense Categories: ${missingSapMappings.join(', ')}.`
      );
    }

    if (!params.approvalWorkflowEnabled) {
      blockingReasons.push('PR Approval Workflow must be enabled before activating Expense PR.');
    }

    return {
      ready: blockingReasons.length === 0,
      blockingReasons,
      activeMappingsCount: eligible.length,
      activeCategoryMappingsCount: eligible.length,
      activeSapGlMappingsCount: withSap.length,
      eligibleCategoriesCount: eligible.length,
      sapAccountMappingsCount: withSap.length,
      missingSapMappings,
      approvalConfigured: Boolean(params.approvalWorkflowEnabled),
    };
  },

  // Governance CRUD operations for Settings UI
  upsertCategory(
    input: Omit<
      ExpenseCategoryRecord,
      'id' | 'versionNumber' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'
    > & { id?: string },
    actor?: User
  ): ExpenseCategoryRecord {
    const all = this.getCategories();
    const now = new Date().toISOString();
    const actorName = actor?.fullName || 'Platform Administrator';
    const existingIdx = input.id
      ? all.findIndex((c) => c.id === input.id)
      : all.findIndex((c) => c.code.toUpperCase() === input.code.trim().toUpperCase());

    let saved: ExpenseCategoryRecord;
    if (existingIdx >= 0) {
      const prev = all[existingIdx];
      saved = {
        ...prev,
        ...input,
        code: input.code.trim().toUpperCase(),
        versionNumber: prev.versionNumber + 1,
        updatedAt: now,
        updatedBy: actorName,
      };
      all[existingIdx] = saved;
    } else {
      saved = {
        ...input,
        id: `expcat-${Date.now().toString(36)}`,
        code: input.code.trim().toUpperCase(),
        versionNumber: 1,
        createdAt: now,
        createdBy: actorName,
        updatedAt: now,
        updatedBy: actorName,
      };
      all.unshift(saved);
    }
    this.saveCategories(all);

    EnterpriseAuditService.logEvent({
      companyId: actor?.orgId || 'co-kosh-01',
      entityType: 'PURCHASE_REQUISITION',
      entityId: saved.id,
      eventType: existingIdx >= 0 ? 'EXPENSE_CATEGORY_UPDATED' : 'EXPENSE_CATEGORY_CREATED',
      eventDescription: `${existingIdx >= 0 ? 'Updated' : 'Created'} Expense Category ${saved.code} (${saved.name})`,
      newValue: saved,
      changedByUserId: actor?.id || 'usr-admin-01',
      changedByName: actorName,
      changeReason: 'Expense Category governance configuration',
    });

    return saved;
  },

  upsertMapping(
    input: Omit<
      CompanyBranchExpenseCategoryMapping,
      | 'id'
      | 'companyCode'
      | 'branchCode'
      | 'versionNumber'
      | 'createdAt'
      | 'createdBy'
      | 'updatedAt'
      | 'updatedBy'
    > & { id?: string },
    actor?: User
  ): CompanyBranchExpenseCategoryMapping {
    const all = this.getMappings();
    const now = new Date().toISOString();
    const actorName = actor?.fullName || 'Platform Administrator';
    const normCo = input.companyId === 'ALL' ? 'ALL' : normCompanyId(input.companyId);
    const normBr = input.branchId === 'ALL' ? 'ALL' : normBranchId(input.branchId);
    const coObj = INITIAL_COMPANIES.find((c) => c.id === normCo);
    const brObj = INITIAL_BRANCHES.find((b) => b.id === normBr);

    const existingIdx = input.id
      ? all.findIndex((m) => m.id === input.id)
      : all.findIndex(
          (m) =>
            m.companyId === normCo &&
            m.branchId === normBr &&
            m.prTypeCode === input.prTypeCode &&
            m.expenseCategoryCode.toUpperCase() === input.expenseCategoryCode.toUpperCase()
        );

    let saved: CompanyBranchExpenseCategoryMapping;
    if (existingIdx >= 0) {
      const prev = all[existingIdx];
      saved = {
        ...prev,
        ...input,
        companyId: normCo,
        companyCode: coObj?.code || normCo,
        branchId: normBr,
        branchCode: brObj?.code || normBr,
        versionNumber: prev.versionNumber + 1,
        updatedAt: now,
        updatedBy: actorName,
      };
      all[existingIdx] = saved;
    } else {
      saved = {
        ...input,
        id: `expmap-${Date.now().toString(36)}`,
        companyId: normCo,
        companyCode: coObj?.code || normCo,
        branchId: normBr,
        branchCode: brObj?.code || normBr,
        versionNumber: 1,
        createdAt: now,
        createdBy: actorName,
        updatedAt: now,
        updatedBy: actorName,
      };
      all.unshift(saved);
    }
    this.saveMappings(all);
    return saved;
  },

  upsertSapAccountMapping(
    input: Omit<SapExpenseAccountMapping, 'id' | 'companyCode' | 'versionNumber' | 'updatedAt' | 'updatedBy'> & {
      id?: string;
    },
    actor?: User
  ): SapExpenseAccountMapping {
    const all = this.getSapExpenseAccountMappings();
    const now = new Date().toISOString();
    const actorName = actor?.fullName || 'Platform Administrator';
    const normCo = input.companyId === 'ALL' ? 'ALL' : normCompanyId(input.companyId);
    const normBr = input.branchId === 'ALL' ? 'ALL' : normBranchId(input.branchId);
    const coObj = INITIAL_COMPANIES.find((c) => c.id === normCo);

    const existingIdx = input.id
      ? all.findIndex((m) => m.id === input.id)
      : all.findIndex(
          (m) =>
            m.companyId === normCo &&
            m.branchId === normBr &&
            m.expenseCategoryCode.toUpperCase() === input.expenseCategoryCode.toUpperCase()
        );

    let saved: SapExpenseAccountMapping;
    if (existingIdx >= 0) {
      const prev = all[existingIdx];
      saved = {
        ...prev,
        ...input,
        companyId: normCo,
        companyCode: coObj?.code || normCo,
        branchId: normBr,
        versionNumber: prev.versionNumber + 1,
        updatedAt: now,
        updatedBy: actorName,
      };
      all[existingIdx] = saved;
    } else {
      saved = {
        ...input,
        id: `sapexp-${Date.now().toString(36)}`,
        companyId: normCo,
        companyCode: coObj?.code || normCo,
        branchId: normBr,
        versionNumber: 1,
        updatedAt: now,
        updatedBy: actorName,
      };
      all.unshift(saved);
    }
    this.saveSapExpenseAccountMappings(all);

    EnterpriseAuditService.logEvent({
      companyId: normCo === 'ALL' ? 'co-kosh-01' : normCo,
      entityType: 'PURCHASE_REQUISITION',
      entityId: saved.id,
      eventType: 'SAP_EXPENSE_ACCOUNT_MAPPING_UPDATED',
      eventDescription: `Mapped Expense Category ${saved.expenseCategoryCode} -> SAP GL ${saved.sapServiceAccountCode} (${saved.sapTaxCode})`,
      newValue: saved,
      changedByUserId: actor?.id || 'usr-admin-01',
      changedByName: actorName,
      changeReason: 'SAP Expense Account Mapping configuration',
    });

    return saved;
  },

  updateMappingGovernanceStatus(
    mappingId: string,
    updates: { status?: PRTypeMasterStatus; approvalStatus?: PRTypeApprovalStatus },
    actor?: User
  ): CompanyBranchExpenseCategoryMapping {
    const all = this.getMappings();
    const idx = all.findIndex((m) => m.id === mappingId);
    if (idx === -1) throw new Error('Expense Category mapping not found.');
    const now = new Date().toISOString();
    all[idx] = {
      ...all[idx],
      ...updates,
      updatedAt: now,
      updatedBy: actor?.fullName || 'Platform Administrator',
      ...(updates.approvalStatus === 'APPROVED'
        ? { approvedAt: now, approvedBy: actor?.fullName || 'Governance Checker' }
        : {}),
    };
    this.saveMappings(all);
    return all[idx];
  },

  resetToSeededDefaults(): void {
    this.saveCategories(INITIAL_EXPENSE_CATEGORIES);
    this.saveMappings(INITIAL_EXPENSE_CATEGORY_MAPPINGS);
    this.saveSapExpenseAccountMappings(INITIAL_SAP_EXPENSE_ACCOUNT_MAPPINGS);
  },

  resetToDefaults(): void {
    this.resetToSeededDefaults();
  },
};
