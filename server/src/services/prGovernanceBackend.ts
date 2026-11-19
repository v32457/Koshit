/**
 * KOSH INNOVATIONS — SERVER-SIDE PR GOVERNANCE ENGINE
 * Authoritative backend validation for:
 * 1. Company & Branch PR Policy Compliance (inheritance, centrally controlled locks, effective dates, ACTIVE status)
 * 2. Approval Workflow Matrix & Tier Resolution (landed valuation, maker-checker, roles, delegation, SLA)
 * 3. Conditional Budget Validation (strict ON/OFF parity)
 * 4. PR Type-Based Category Mapping & Line Revalidation
 * 5. SAP B1 Transaction Creation Readiness Gate
 */

export class PrGovernanceHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface BackendApprovalMatrixTier {
  levelNumber: number;
  levelName: string;
  minAmount: number;
  maxAmount: number | null;
  approverRole: string;
  alternateApproverRole?: string;
  branchScoped: boolean;
  departmentScoped: boolean;
  mandatoryRemarks: boolean;
  slaHours: number;
}

export interface BackendPrPolicyConfig {
  id: string;
  companyId: string;
  companyCode: string;
  companyName?: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  policyScope: 'COMPANY' | 'BRANCH';
  isInheritedFromCompany: boolean;
  allowBranchOverride: boolean;
  centrallyControlledFields: string[];
  policyVersion: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  effectiveStatus?: 'ACTIVE' | 'DRAFT' | 'PENDING_APPROVAL' | 'REJECTED' | 'SUPERSEDED' | 'EXPIRED';
  requireMakerCheckerApproval?: boolean;
  activation: {
    prModuleEnabled: boolean;
    manualPrCreationEnabled: boolean;
    mrpPrCreationEnabled: boolean;
    repairPrEnabled: boolean;
    maintenancePrEnabled: boolean;
    capexAssetPrEnabled: boolean;
    expensePrEnabled?: boolean;
    prEditingEnabled: boolean;
    prSubmissionEnabled: boolean;
    prApprovalEnabled: boolean;
    budgetValidationEnabled: boolean;
    duplicateDetectionEnabled: boolean;
    rfqConversionEnabled: boolean;
    poConversionEnabled: boolean;
    partialConversionEnabled: boolean;
    expectedDeliveryDateEnabled?: boolean;
    expectedDeliveryDateMandatory?: boolean;
    allowSameChargeAtHeaderAndLine?: boolean;
    taxInclusivePricingSupported?: boolean;
    includeTaxInBudgetBasis?: boolean;
  };
  approval: {
    enableApprovalWorkflow: boolean;
    approvalLevels: number;
    amountBasedApproval: boolean;
    departmentLevelApprovers: boolean;
    branchLevelApprovers: boolean;
    managerL1Approval: boolean;
    approvalMatrix: BackendApprovalMatrixTier[];
    mandatoryApprovalRemarks: boolean;
    allowTerminalReject?: boolean;
    approvalDelegation: boolean;
    approvalEscalation: boolean;
    escalationAfterHours: number;
  };
  budget: {
    enableBudgetValidation: boolean;
    budgetCheckingStage: string;
    mandatoryBudgetCheck: boolean;
    allowBudgetOverrideWithApproval: boolean;
    companyReportingCurrency?: string;
  };
}

export interface BackendPrTypeMaster {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  approvalStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  allowedRoles?: string[];
  effectiveFrom?: string;
  effectiveUntil?: string;
  isExpenseType?: boolean;
}

export interface BackendPrTypeMapping {
  id: string;
  prTypeCode: string;
  companyId: string;
  companyCode: string;
  branchId: string;
  branchCode: string;
  purchaseOrgId: string;
  purchaseOrgCode: string;
  itemCategoryCode: string;
  itemCategoryName: string;
  isEligible: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  approvalStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  versionNumber: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  remarks?: string;
}

export interface BackendBudgetLedger {
  id: string;
  companyId: string;
  branchId: string;
  department: string;
  costCenter: string;
  financialYear: string;
  currency: string;
  approvedBudget: number;
  revisedBudget: number;
  committedAmount: number;
  actualExpenditure: number;
  pendingCommitments: number;
  availableBudget: number;
}

export interface BackendBudgetPolicy {
  id: string;
  companyId: string;
  branchId: string;
  costCenter: string;
  department: string;
  isEnabled: boolean;
  validationStage: string;
  enforcementMode:
    | 'NO_VALIDATION'
    | 'WARNING_ONLY'
    | 'BLOCK_WHEN_INSUFFICIENT'
    | 'ALLOW_WITH_EXCEPTION_APPROVAL';
  status: 'ACTIVE' | 'DRAFT' | 'EXPIRED';
}

export interface BackendExpenseCategory {
  code: string;
  name: string;
  display: string;
  sapGlAccountCode: string;
  sapGlAccountName: string;
  defaultTaxCode: string;
  defaultTaxPercent: number;
  status: 'ACTIVE' | 'INACTIVE';
  approvalStatus: 'APPROVED' | 'PENDING_APPROVAL' | 'DRAFT' | 'REJECTED';
}

export interface BackendSapTraceRecord {
  prId: string;
  prNumber: string;
  prType: string;
  procurementMechanism: 'INVENTORY_PR' | 'EXPENSE_PR';
  sapDocType: 'dDocument_Items' | 'dDocument_Service';
  status: 'NOT_STARTED' | 'PENDING' | 'INTEGRATED' | 'FAILED' | 'REQUIRES_RECONCILIATION';
  idempotencyKey: string;
  sapDocEntry?: number;
  sapDocNum?: number;
  attemptCount: number;
  lastAttemptAt?: string;
  integratedAt?: string;
  reconciledAt?: string;
  reconciledBy?: string;
  reconciliationNotes?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  requestPayloadSummary?: Record<string, unknown>;
}

const KNOWN_CATEGORY_DEFINITIONS = [
  { code: 'RM', name: 'Raw Material', display: 'RM - Raw Material' },
  { code: 'CO', name: 'Consumables', display: 'CO - Consumables' },
  { code: 'FA', name: 'Fixed Asset / CAPEX', display: 'FA - Fixed Asset / CAPEX' },
  { code: 'PK', name: 'Packaging Material', display: 'PK - Packaging Material' },
  { code: 'TR', name: 'Trading Goods', display: 'TR - Trading Goods' },
  { code: 'MA', name: 'Machinery & Maintenance', display: 'MA - Machinery & Maintenance' },
  { code: 'SV', name: 'Services & AMC', display: 'SV - Services & AMC' },
  { code: 'OT', name: 'General / Other', display: 'OT - General / Other' },
];

const DEFAULT_EXPENSE_CATEGORIES: BackendExpenseCategory[] = [
  { code: 'EXP-CONS', name: 'Consultancy Charges', display: 'EXP-CONS - Consultancy Charges', sapGlAccountCode: '610100', sapGlAccountName: 'Consultancy & Advisory Expense', defaultTaxCode: 'GST18', defaultTaxPercent: 18, status: 'ACTIVE', approvalStatus: 'APPROVED' },
  { code: 'EXP-PROF', name: 'Professional Fees', display: 'EXP-PROF - Professional Fees', sapGlAccountCode: '610200', sapGlAccountName: 'Professional & Technical Retainer Fees', defaultTaxCode: 'GST18', defaultTaxPercent: 18, status: 'ACTIVE', approvalStatus: 'APPROVED' },
  { code: 'EXP-LEGAL', name: 'Legal Expenses', display: 'EXP-LEGAL - Legal Expenses', sapGlAccountCode: '610300', sapGlAccountName: 'Legal & Regulatory Compliance Fees', defaultTaxCode: 'GST18', defaultTaxPercent: 18, status: 'ACTIVE', approvalStatus: 'APPROVED' },
  { code: 'EXP-AUDIT', name: 'Audit Fees', display: 'EXP-AUDIT - Audit Fees', sapGlAccountCode: '610400', sapGlAccountName: 'Statutory & Internal Audit Expense', defaultTaxCode: 'GST18', defaultTaxPercent: 18, status: 'ACTIVE', approvalStatus: 'APPROVED' },
  { code: 'EXP-RENT', name: 'Office / Warehouse Rent', display: 'EXP-RENT - Office / Warehouse Rent', sapGlAccountCode: '620100', sapGlAccountName: 'Premises & Lease Rental Expense', defaultTaxCode: 'GST18', defaultTaxPercent: 18, status: 'ACTIVE', approvalStatus: 'APPROVED' },
  { code: 'EXP-SAAS', name: 'Software Subscription', display: 'EXP-SAAS - Software Subscription', sapGlAccountCode: '630100', sapGlAccountName: 'Cloud & Software Subscription Expense', defaultTaxCode: 'GST18', defaultTaxPercent: 18, status: 'ACTIVE', approvalStatus: 'APPROVED' },
  { code: 'EXP-TRNG', name: 'Training & Certification', display: 'EXP-TRNG - Training & Certification', sapGlAccountCode: '640100', sapGlAccountName: 'Staff Training & Certification Expense', defaultTaxCode: 'GST18', defaultTaxPercent: 18, status: 'ACTIVE', approvalStatus: 'APPROVED' },
  { code: 'EXP-FAC', name: 'Facility Management', display: 'EXP-FAC - Facility Management', sapGlAccountCode: '650100', sapGlAccountName: 'Facility & Housekeeping Services Expense', defaultTaxCode: 'GST18', defaultTaxPercent: 18, status: 'ACTIVE', approvalStatus: 'APPROVED' },
  { code: 'EXP-MAINT-SVC', name: 'Non-Inventory Maintenance Services', display: 'EXP-MAINT-SVC - Non-Inventory Maintenance Services', sapGlAccountCode: '650200', sapGlAccountName: 'General Non-Inventory Maintenance Services', defaultTaxCode: 'GST18', defaultTaxPercent: 18, status: 'ACTIVE', approvalStatus: 'APPROVED' },
  { code: 'EXP-ADMIN', name: 'Administrative Services', display: 'EXP-ADMIN - Administrative Services', sapGlAccountCode: '660100', sapGlAccountName: 'General Administrative & Office Expense', defaultTaxCode: 'GST18', defaultTaxPercent: 18, status: 'ACTIVE', approvalStatus: 'APPROVED' },
];

const INVENTORY_LINKED_CHARGE_KEYWORDS = [
  'loading charge',
  'unloading charge',
  'inward freight',
  'customs duty',
  'bcd + sws',
  'demurrage',
  'detention charge',
  'port handling',
  'cha clearance',
  'fumigation',
];

const FX_TO_INR: Record<string, number> = {
  INR: 1,
  USD: 84.5,
  EUR: 91.2,
  GBP: 106.8,
  JPY: 0.56,
  AED: 23.0,
};

export function normalizeCompanyId(id?: string): string {
  const upper = (id || '').trim().toUpperCase();
  if (!upper || upper === 'ALL') return upper || 'co-kosh-01';
  if (upper === 'KOSH-HQ' || upper === 'KOSH_INNOVATIONS' || upper === 'CO-KOSH-01') return 'co-kosh-01';
  if (upper === 'KOSH-AUTO' || upper === 'KOSH_AUTO' || upper === 'CO-KOSH-02') return 'co-kosh-02';
  if (upper === 'KOSH-TOOL' || upper === 'KOSH_TOOL' || upper === 'CO-KOSH-03') return 'co-kosh-03';
  return (id || '').trim();
}

export function normalizeBranchId(id?: string): string {
  const raw = (id || '').trim();
  const upper = raw.toUpperCase();
  if (!raw || upper === 'ALL') return 'ALL';
  if (upper === 'BR-001' || upper === '001' || upper === 'BR-POND-01') return 'br-pond-01';
  if (upper === 'BR-002' || upper === '002' || upper === 'BR-HOSUR-02') return 'br-hosur-02';
  if (upper === 'BR-003' || upper === '003' || upper === 'BR-CHENNAI-03') return 'br-chennai-03';
  if (upper === 'BR-004' || upper === '004' || upper === 'BR-BENG-04') return 'br-beng-04';
  return raw;
}

export function normalizeItemCategoryCode(cat?: string): string {
  const trimmed = (cat || '').trim().toUpperCase();
  if (!trimmed || trimmed === 'ALL') return 'ALL';
  const aliasMap: Record<string, string> = {
    RM: 'RM',
    'RAW MATERIAL': 'RM',
    'RAW MATERIALS': 'RM',
    RAW_MATERIAL: 'RM',
    CO: 'CO',
    CONSUMABLES: 'CO',
    CONSUMABLE: 'CO',
    FA: 'FA',
    CAPEX: 'FA',
    CAPITAL_ASSETS: 'FA',
    'FIXED ASSET': 'FA',
    'FIXED ASSET / CAPEX': 'FA',
    PK: 'PK',
    PACKAGING: 'PK',
    'PACKAGING MATERIAL': 'PK',
    TR: 'TR',
    TRADING: 'TR',
    'TRADING GOODS': 'TR',
    MA: 'MA',
    MACHINERY: 'MA',
    MAINTENANCE: 'MA',
    SPARE: 'MA',
    SPARES: 'MA',
    'MACHINERY & MAINTENANCE': 'MA',
    SV: 'SV',
    SERVICES: 'SV',
    'SERVICES & AMC': 'SV',
    AMC: 'SV',
    OT: 'OT',
    GEN: 'OT',
    GENERAL: 'OT',
    'GENERAL / OTHER': 'OT',
    ELECTRONICS: 'OT',
  };
  return aliasMap[trimmed] || trimmed;
}

function buildDefaultPolicy(companyId: string, branchId: string = 'ALL'): BackendPrPolicyConfig {
  const normComp = normalizeCompanyId(companyId);
  const normBr = normalizeBranchId(branchId);
  const codeMap: Record<string, { code: string; name: string }> = {
    'co-kosh-01': { code: 'KOSH-HQ', name: 'Kosh Innovations Pvt Ltd' },
    'co-kosh-02': { code: 'KOSH-AUTO', name: 'Kosh Automotive Division' },
    'co-kosh-03': { code: 'KOSH-TOOL', name: 'Kosh Precision Tooling Ltd' },
  };
  const compMeta = codeMap[normComp] || { code: normComp.toUpperCase(), name: normComp };

  return {
    id: normBr === 'ALL' ? `pr-pol-${normComp}` : `pr-pol-${normComp}-${normBr}`,
    companyId: normComp,
    companyCode: compMeta.code,
    companyName: compMeta.name,
    branchId: normBr,
    branchCode: normBr === 'ALL' ? 'ALL' : normBr.toUpperCase(),
    branchName: normBr === 'ALL' ? 'All Branches (Company Baseline)' : `Branch ${normBr}`,
    policyScope: normBr === 'ALL' ? 'COMPANY' : 'BRANCH',
    isInheritedFromCompany: false,
    allowBranchOverride: true,
    centrallyControlledFields: ['prModuleEnabled', 'budgetValidationEnabled', 'enableApprovalWorkflow'],
    policyVersion: 'v2.4',
    effectiveFrom: '2026-01-01',
    effectiveStatus: 'ACTIVE',
    requireMakerCheckerApproval: false,
    activation: {
      prModuleEnabled: true,
      manualPrCreationEnabled: true,
      mrpPrCreationEnabled: true,
      repairPrEnabled: true,
      maintenancePrEnabled: true,
      capexAssetPrEnabled: true,
      expensePrEnabled: true,
      prEditingEnabled: true,
      prSubmissionEnabled: true,
      prApprovalEnabled: true,
      budgetValidationEnabled: true,
      duplicateDetectionEnabled: true,
      rfqConversionEnabled: true,
      poConversionEnabled: true,
      partialConversionEnabled: true,
      expectedDeliveryDateEnabled: true,
      expectedDeliveryDateMandatory: false,
      allowSameChargeAtHeaderAndLine: false,
      taxInclusivePricingSupported: true,
      includeTaxInBudgetBasis: true,
    },
    approval: {
      enableApprovalWorkflow: true,
      approvalLevels: 3,
      amountBasedApproval: true,
      departmentLevelApprovers: true,
      branchLevelApprovers: true,
      managerL1Approval: true,
      approvalMatrix: [
        {
          levelNumber: 1,
          levelName: 'Manager L1 / Dept Head',
          minAmount: 0,
          maxAmount: 100000,
          approverRole: 'DEPARTMENT_HEAD',
          alternateApproverRole: 'PROCUREMENT_MANAGER',
          branchScoped: true,
          departmentScoped: true,
          mandatoryRemarks: false,
          slaHours: 24,
        },
        {
          levelNumber: 2,
          levelName: 'Procurement Manager & Finance Check',
          minAmount: 100001,
          maxAmount: 1000000,
          approverRole: 'PROCUREMENT_MANAGER',
          alternateApproverRole: 'BRANCH_ADMIN',
          branchScoped: true,
          departmentScoped: false,
          mandatoryRemarks: true,
          slaHours: 48,
        },
        {
          levelNumber: 3,
          levelName: 'Org Admin / Director Strategic Sign-off',
          minAmount: 1000001,
          maxAmount: null,
          approverRole: 'ORG_ADMIN',
          alternateApproverRole: 'PLATFORM_ADMIN',
          branchScoped: false,
          departmentScoped: false,
          mandatoryRemarks: true,
          slaHours: 72,
        },
      ],
      mandatoryApprovalRemarks: false,
      allowTerminalReject: true,
      approvalDelegation: true,
      approvalEscalation: true,
      escalationAfterHours: 48,
    },
    budget: {
      enableBudgetValidation: true,
      budgetCheckingStage: 'ON_SUBMIT_AND_APPROVE',
      mandatoryBudgetCheck: true,
      allowBudgetOverrideWithApproval: true,
      companyReportingCurrency: 'INR',
    },
  };
}

const DEFAULT_PR_TYPES: BackendPrTypeMaster[] = [
  { id: 'prt-manual', code: 'MANUAL', name: 'Manual Requisition', status: 'ACTIVE', approvalStatus: 'APPROVED', allowedRoles: [] },
  { id: 'prt-mrp', code: 'MRP', name: 'MRP Requisition', status: 'ACTIVE', approvalStatus: 'APPROVED', allowedRoles: ['PLATFORM_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'PROCUREMENT_MANAGER'] },
  { id: 'prt-repair', code: 'REPAIR', name: 'Repair Requisition', status: 'ACTIVE', approvalStatus: 'APPROVED', allowedRoles: [] },
  { id: 'prt-maint', code: 'MAINTENANCE', name: 'Maintenance Requisition', status: 'ACTIVE', approvalStatus: 'APPROVED', allowedRoles: ['PLATFORM_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'PROCUREMENT_MANAGER', 'DEPARTMENT_HEAD', 'PLANT_ENGINEER', 'MAINTENANCE_SUPERVISOR'] },
  { id: 'prt-capex', code: 'CAPEX_ASSET', name: 'CAPEX / Fixed Asset Requisition', status: 'ACTIVE', approvalStatus: 'APPROVED', allowedRoles: ['PLATFORM_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'PROCUREMENT_MANAGER', 'DEPARTMENT_HEAD'] },
  { id: 'prt-expense', code: 'EXPENSE', name: 'Expense / Service Requisition', status: 'ACTIVE', approvalStatus: 'APPROVED', allowedRoles: [], isExpenseType: true },
];

const DEFAULT_MAPPINGS: BackendPrTypeMapping[] = [
  {
    id: 'map-capex-hq-fa',
    prTypeCode: 'CAPEX_ASSET',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'ALL',
    branchCode: 'ALL',
    purchaseOrgId: 'ALL',
    purchaseOrgCode: 'ALL',
    itemCategoryCode: 'FA',
    itemCategoryName: 'Fixed Asset / CAPEX',
    isEligible: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    versionNumber: 1,
    effectiveFrom: '2026-04-01',
  },
  {
    id: 'map-maint-hq-ma',
    prTypeCode: 'MAINTENANCE',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'ALL',
    branchCode: 'ALL',
    purchaseOrgId: 'ALL',
    purchaseOrgCode: 'ALL',
    itemCategoryCode: 'MA',
    itemCategoryName: 'Machinery & Maintenance',
    isEligible: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    versionNumber: 1,
    effectiveFrom: '2026-04-01',
  },
  {
    id: 'map-mrp-hq-rm',
    prTypeCode: 'MRP',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'ALL',
    branchCode: 'ALL',
    purchaseOrgId: 'ALL',
    purchaseOrgCode: 'ALL',
    itemCategoryCode: 'RM',
    itemCategoryName: 'Raw Material',
    isEligible: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    versionNumber: 1,
    effectiveFrom: '2026-04-01',
  },
  {
    id: 'map-expense-all',
    prTypeCode: 'EXPENSE',
    companyId: 'ALL',
    companyCode: 'ALL',
    branchId: 'ALL',
    branchCode: 'ALL',
    purchaseOrgId: 'ALL',
    purchaseOrgCode: 'ALL',
    itemCategoryCode: 'ALL',
    itemCategoryName: 'All Governed Expense Categories',
    isEligible: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    versionNumber: 1,
    effectiveFrom: '2026-01-01',
  },
];

const DEFAULT_BUDGET_LEDGERS: BackendBudgetLedger[] = [
  {
    id: 'bgt-ldg-pd-01',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Production',
    costCenter: 'CC-PROD-101',
    financialYear: 'FY 2026-27',
    currency: 'INR',
    approvedBudget: 5000000,
    revisedBudget: 5000000,
    committedAmount: 3000000,
    actualExpenditure: 1000000,
    pendingCommitments: 0,
    availableBudget: 1000000,
  },
  {
    id: 'bgt-ldg-hsr-01',
    companyId: 'co-kosh-01',
    branchId: 'br-hosur-02',
    department: 'Assembly',
    costCenter: 'CC-ASM-202',
    financialYear: 'FY 2026-27',
    currency: 'INR',
    approvedBudget: 4000000,
    revisedBudget: 4000000,
    committedAmount: 1500000,
    actualExpenditure: 500000,
    pendingCommitments: 0,
    availableBudget: 2000000,
  },
];

const DEFAULT_BUDGET_POLICIES: BackendBudgetPolicy[] = [
  {
    id: 'bgt-pol-co1-default',
    companyId: 'co-kosh-01',
    branchId: 'ALL',
    costCenter: 'ALL',
    department: 'ALL',
    isEnabled: true,
    validationStage: 'PR_SUBMISSION',
    enforcementMode: 'BLOCK_WHEN_INSUFFICIENT',
    status: 'ACTIVE',
  },
];

const LEGACY_SYSTEM_TYPES = new Set(['MANUAL', 'MRP', 'REPAIR', 'MAINTENANCE']);

function applyCentrallyControlledLocks(
  baseCompanyPolicy: BackendPrPolicyConfig,
  targetPolicy: BackendPrPolicyConfig
): void {
  const lockedFields = baseCompanyPolicy.centrallyControlledFields || [];
  for (const key of lockedFields) {
    if (key in baseCompanyPolicy.activation) {
      (targetPolicy.activation as Record<string, unknown>)[key] = (
        baseCompanyPolicy.activation as Record<string, unknown>
      )[key];
    }
    if (key in baseCompanyPolicy.budget) {
      (targetPolicy.budget as Record<string, unknown>)[key] = (
        baseCompanyPolicy.budget as Record<string, unknown>
      )[key];
    }
    if (key in baseCompanyPolicy.approval) {
      (targetPolicy.approval as Record<string, unknown>)[key] = (
        baseCompanyPolicy.approval as Record<string, unknown>
      )[key];
    }
  }
  if (lockedFields.includes('budgetValidationEnabled')) {
    targetPolicy.budget.enableBudgetValidation = targetPolicy.activation.budgetValidationEnabled;
  }
}

export class PrGovernanceBackendStore {
  private policies: BackendPrPolicyConfig[] = [
    buildDefaultPolicy('co-kosh-01', 'ALL'),
    buildDefaultPolicy('co-kosh-02', 'ALL'),
    buildDefaultPolicy('co-kosh-03', 'ALL'),
  ];
  private prTypes: BackendPrTypeMaster[] = JSON.parse(JSON.stringify(DEFAULT_PR_TYPES));
  private prTypeMappings: BackendPrTypeMapping[] = JSON.parse(JSON.stringify(DEFAULT_MAPPINGS));
  private budgetLedgers: BackendBudgetLedger[] = JSON.parse(JSON.stringify(DEFAULT_BUDGET_LEDGERS));
  private budgetPolicies: BackendBudgetPolicy[] = JSON.parse(JSON.stringify(DEFAULT_BUDGET_POLICIES));
  private expenseCategories: BackendExpenseCategory[] = JSON.parse(JSON.stringify(DEFAULT_EXPENSE_CATEGORIES));
  private sapTraces: Record<string, BackendSapTraceRecord> = {};
  private sapDocEntrySeq = 91000;
  private sapDocNumSeq = 20269000;
  private syncedAt: string | null = null;

  syncState(payload: {
    policies?: BackendPrPolicyConfig[];
    prTypes?: BackendPrTypeMaster[];
    prTypeMappings?: BackendPrTypeMapping[];
    budgetLedgers?: BackendBudgetLedger[];
    budgetPolicies?: BackendBudgetPolicy[];
    expenseCategories?: BackendExpenseCategory[];
  }): {
    policiesCount: number;
    prTypesCount: number;
    mappingsCount: number;
    ledgersCount: number;
    syncedAt: string;
  } {
    if (Array.isArray(payload.policies) && payload.policies.length > 0) {
      this.policies = JSON.parse(JSON.stringify(payload.policies));
    }
    if (Array.isArray(payload.prTypes) && payload.prTypes.length > 0) {
      this.prTypes = JSON.parse(JSON.stringify(payload.prTypes));
      if (!this.prTypes.some((p) => p.code.toUpperCase() === 'EXPENSE')) {
        this.prTypes.push({
          id: 'prt-expense',
          code: 'EXPENSE',
          name: 'Expense / Service Requisition',
          status: 'ACTIVE',
          approvalStatus: 'APPROVED',
          allowedRoles: [],
          isExpenseType: true,
        });
      }
    }
    if (Array.isArray(payload.prTypeMappings)) {
      this.prTypeMappings = JSON.parse(JSON.stringify(payload.prTypeMappings));
    }
    if (Array.isArray(payload.budgetLedgers) && payload.budgetLedgers.length > 0) {
      this.budgetLedgers = JSON.parse(JSON.stringify(payload.budgetLedgers));
    }
    if (Array.isArray(payload.budgetPolicies) && payload.budgetPolicies.length > 0) {
      this.budgetPolicies = JSON.parse(JSON.stringify(payload.budgetPolicies));
    }
    if (Array.isArray(payload.expenseCategories) && payload.expenseCategories.length > 0) {
      this.expenseCategories = JSON.parse(JSON.stringify(payload.expenseCategories));
    }
    this.syncedAt = new Date().toISOString();
    return {
      policiesCount: this.policies.length,
      prTypesCount: this.prTypes.length,
      mappingsCount: this.prTypeMappings.length,
      ledgersCount: this.budgetLedgers.length,
      syncedAt: this.syncedAt,
    };
  }

  private isPolicyApprovedAndActive(policy: BackendPrPolicyConfig): boolean {
    return !policy.effectiveStatus || policy.effectiveStatus === 'ACTIVE';
  }

  private isPolicyEffectiveOnDate(policy: BackendPrPolicyConfig, evaluationDate?: string): boolean {
    if (!this.isPolicyApprovedAndActive(policy)) return false;
    const evalDate = (evaluationDate || new Date().toISOString()).slice(0, 10);
    if (policy.effectiveFrom && evalDate < policy.effectiveFrom) return false;
    if (policy.effectiveUntil && evalDate > policy.effectiveUntil) return false;
    return true;
  }

  getEffectivePolicy(
    companyId: string,
    branchId?: string,
    evaluationDate?: string
  ): BackendPrPolicyConfig & {
    resolutionSource: 'BRANCH_OVERRIDE' | 'COMPANY_INHERITED' | 'SYSTEM_DEFAULT';
  } {
    const normComp = normalizeCompanyId(companyId);
    const normBr = normalizeBranchId(branchId);

    const companyPolicy = this.policies.find(
      (p) =>
        normalizeCompanyId(p.companyId) === normComp &&
        p.branchId === 'ALL' &&
        this.isPolicyEffectiveOnDate(p, evaluationDate)
    );

    const baseCompany: BackendPrPolicyConfig = companyPolicy
      ? JSON.parse(JSON.stringify(companyPolicy))
      : buildDefaultPolicy(normComp, 'ALL');

    let resolved: BackendPrPolicyConfig;
    let resolutionSource: 'BRANCH_OVERRIDE' | 'COMPANY_INHERITED' | 'SYSTEM_DEFAULT' = companyPolicy
      ? 'COMPANY_INHERITED'
      : 'SYSTEM_DEFAULT';

    if (normBr !== 'ALL') {
      const branchOverride = this.policies.find(
        (p) =>
          normalizeCompanyId(p.companyId) === normComp &&
          normalizeBranchId(p.branchId) === normBr &&
          !p.isInheritedFromCompany &&
          this.isPolicyEffectiveOnDate(p, evaluationDate)
      );

      if (branchOverride && baseCompany.allowBranchOverride) {
        resolved = JSON.parse(JSON.stringify(branchOverride));
        resolved.isInheritedFromCompany = false;
        resolved.policyScope = 'BRANCH';
        resolved.centrallyControlledFields = [...(baseCompany.centrallyControlledFields || [])];
        applyCentrallyControlledLocks(baseCompany, resolved);
        resolutionSource = 'BRANCH_OVERRIDE';
      } else {
        resolved = {
          ...JSON.parse(JSON.stringify(baseCompany)),
          branchId: normBr,
          policyScope: 'BRANCH',
          isInheritedFromCompany: true,
        };
      }
    } else {
      resolved = {
        ...JSON.parse(JSON.stringify(baseCompany)),
        branchId: 'ALL',
        policyScope: 'COMPANY',
        isInheritedFromCompany: false,
      };
    }

    if (!resolved.activation.prModuleEnabled) {
      resolved.activation.manualPrCreationEnabled = false;
      resolved.activation.mrpPrCreationEnabled = false;
      resolved.activation.repairPrEnabled = false;
      resolved.activation.maintenancePrEnabled = false;
      resolved.activation.capexAssetPrEnabled = false;
      resolved.activation.expensePrEnabled = false;
      resolved.activation.prEditingEnabled = false;
      resolved.activation.prSubmissionEnabled = false;
      resolved.activation.rfqConversionEnabled = false;
      resolved.activation.poConversionEnabled = false;
      resolved.activation.partialConversionEnabled = false;
    }

    return {
      ...resolved,
      resolutionSource,
    };
  }

  isBudgetValidationEnabled(companyId: string, branchId?: string, evaluationDate?: string): boolean {
    const eff = this.getEffectivePolicy(companyId, branchId, evaluationDate);
    return Boolean(eff.activation?.budgetValidationEnabled && eff.budget?.enableBudgetValidation);
  }

  getEligibleExpenseCategories(companyId: string, branchId = 'ALL'): BackendExpenseCategory[] {
    const eff = this.getEffectivePolicy(companyId, branchId);
    if (!eff.activation.prModuleEnabled || eff.activation.expensePrEnabled === false) {
      return [];
    }
    return this.expenseCategories.filter((c) => c.status === 'ACTIVE' && c.approvalStatus === 'APPROVED');
  }

  evaluatePrTypeEligibility(params: {
    companyId: string;
    branchId: string;
    purchaseOrgId?: string;
    itemCategoryCode?: string;
    prTypeCode: string;
    evaluationDate?: string;
    userRole?: string;
  }): { eligible: boolean; reason: string; prTypeCode: string } {
    const normComp = normalizeCompanyId(params.companyId);
    const normBranch = normalizeBranchId(params.branchId);
    const normPo = (params.purchaseOrgId || 'ALL').trim() || 'ALL';
    const normCat = normalizeItemCategoryCode(params.itemCategoryCode || 'ALL');
    const prCode = (params.prTypeCode || '').trim().toUpperCase();
    const evalDate = (params.evaluationDate || new Date().toISOString()).slice(0, 10);

    const prTypeRec = this.prTypes.find((p) => p.code.toUpperCase() === prCode);
    if (!prTypeRec) {
      return { eligible: false, reason: `PR Type '${prCode}' is not registered in PR Type Master.`, prTypeCode: prCode };
    }
    if (prTypeRec.status !== 'ACTIVE' || prTypeRec.approvalStatus !== 'APPROVED') {
      return {
        eligible: false,
        reason: `PR Type '${prTypeRec.name}' (${prCode}) is ${prTypeRec.status}/${prTypeRec.approvalStatus} and unavailable.`,
        prTypeCode: prCode,
      };
    }

    const effPolicy = this.getEffectivePolicy(normComp, normBranch, evalDate);
    if (!effPolicy.activation.prModuleEnabled) {
      return { eligible: false, reason: 'PR Module is disabled by effective policy.', prTypeCode: prCode };
    }
    if (prCode === 'MANUAL' && !effPolicy.activation.manualPrCreationEnabled) {
      return { eligible: false, reason: 'Manual PR creation is disabled by policy.', prTypeCode: prCode };
    }
    if (prCode === 'MRP' && !effPolicy.activation.mrpPrCreationEnabled) {
      return { eligible: false, reason: 'MRP PR creation is disabled by policy.', prTypeCode: prCode };
    }
    if (prCode === 'REPAIR' && !effPolicy.activation.repairPrEnabled) {
      return { eligible: false, reason: 'Repair PR creation is disabled by policy.', prTypeCode: prCode };
    }
    if (prCode === 'MAINTENANCE' && !effPolicy.activation.maintenancePrEnabled) {
      return { eligible: false, reason: 'Maintenance PR creation is disabled by policy.', prTypeCode: prCode };
    }
    if (prCode === 'CAPEX_ASSET' && !effPolicy.activation.capexAssetPrEnabled) {
      return { eligible: false, reason: 'CAPEX / Fixed Asset PR creation is disabled by policy.', prTypeCode: prCode };
    }
    if (prCode === 'EXPENSE' && effPolicy.activation.expensePrEnabled === false) {
      return { eligible: false, reason: 'Expense PR creation is disabled by policy.', prTypeCode: prCode };
    }

    if (
      params.userRole &&
      prTypeRec.allowedRoles &&
      prTypeRec.allowedRoles.length > 0 &&
      !prTypeRec.allowedRoles.includes(params.userRole)
    ) {
      return {
        eligible: false,
        reason: `Role '${params.userRole}' is not authorized to use PR Type '${prCode}'.`,
        prTypeCode: prCode,
      };
    }

    if (prCode === 'EXPENSE') {
      const activeExpCats = this.getEligibleExpenseCategories(normComp, normBranch);
      if (activeExpCats.length === 0) {
        return {
          eligible: false,
          reason: `PR Type 'EXPENSE' has no active approved Expense Category & SAP GL Account mappings for ${normComp} / ${normBranch}.`,
          prTypeCode: prCode,
        };
      }
      if (normCat !== 'ALL') {
        const matched = activeExpCats.find((c) => c.code.toUpperCase() === normCat.toUpperCase());
        if (!matched) {
          return {
            eligible: false,
            reason: `Category '${normCat}' is not a valid approved Expense Category for PR Type 'EXPENSE'.`,
            prTypeCode: prCode,
          };
        }
      }
      return {
        eligible: true,
        reason: `Authorized under Expense PR governance for ${normComp} / ${normBranch}.`,
        prTypeCode: prCode,
      };
    }

    const activeContextMappings = this.prTypeMappings.filter((m) => {
      if (m.status !== 'ACTIVE' || m.approvalStatus !== 'APPROVED') return false;
      if (m.effectiveFrom && evalDate < m.effectiveFrom) return false;
      if (m.effectiveUntil && evalDate > m.effectiveUntil) return false;
      const compOk = m.companyId === 'ALL' || normalizeCompanyId(m.companyId) === normComp;
      const brOk = m.branchId === 'ALL' || normalizeBranchId(m.branchId) === normBranch;
      const poOk = m.purchaseOrgId === 'ALL' || normPo === 'ALL' || m.purchaseOrgId === normPo;
      return compOk && brOk && poOk;
    });

    const prTypeContextMappings = activeContextMappings.filter((m) => m.prTypeCode.toUpperCase() === prCode);
    const hasSpecificAllowForPrType = prTypeContextMappings.some(
      (m) => m.itemCategoryCode !== 'ALL' && m.isEligible === true
    );

    const candidates = prTypeContextMappings.filter((m) => {
      if (normCat === 'ALL') return true;
      if (m.itemCategoryCode === 'ALL') {
        if (hasSpecificAllowForPrType && m.isEligible === true) return false;
        return true;
      }
      return normalizeItemCategoryCode(m.itemCategoryCode) === normCat;
    });

    const specificity = (m: BackendPrTypeMapping) =>
      (m.companyId !== 'ALL' ? 8 : 0) +
      (m.branchId !== 'ALL' ? 4 : 0) +
      (m.purchaseOrgId !== 'ALL' ? 2 : 0) +
      (m.itemCategoryCode !== 'ALL' ? 1 : 0);

    if (candidates.length === 0) {
      if (hasSpecificAllowForPrType && normCat !== 'ALL') {
        return {
          eligible: false,
          reason: `Category '${normCat}' is not mapped to PR Type '${prTypeRec.name}' (${prCode}) for ${normComp} / ${normBranch}.`,
          prTypeCode: prCode,
        };
      }
      if (!LEGACY_SYSTEM_TYPES.has(prCode)) {
        return {
          eligible: false,
          reason: `No active approved mapping authorizes PR Type '${prCode}' for category '${normCat}'.`,
          prTypeCode: prCode,
        };
      }
      if (normCat !== 'ALL') {
        const exclusiveOwners = Array.from(
          new Set(
            activeContextMappings
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
        if (exclusiveOwners.length > 0) {
          return {
            eligible: false,
            reason: `Category '${normCat}' is exclusively mapped to PR Type(s) [${exclusiveOwners.join(', ')}] and is not eligible under '${prCode}'.`,
            prTypeCode: prCode,
          };
        }
      }
      return { eligible: true, reason: `Legacy baseline PR Type '${prCode}' permitted.`, prTypeCode: prCode };
    }

    const sorted = [...candidates].sort((a, b) => {
      const diff = specificity(b) - specificity(a);
      if (diff !== 0) return diff;
      if (a.isEligible !== b.isEligible) return a.isEligible ? 1 : -1;
      return b.versionNumber - a.versionNumber;
    });

    const winner = sorted[0];
    if (!winner.isEligible) {
      return {
        eligible: false,
        reason: winner.remarks || `PR Type '${prCode}' explicitly blocked for category '${normCat}'.`,
        prTypeCode: prCode,
      };
    }

    if (normCat !== 'ALL' && winner.itemCategoryCode === 'ALL') {
      const exclusiveOwners = Array.from(
        new Set(
          activeContextMappings
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
      if (exclusiveOwners.length > 0) {
        return {
          eligible: false,
          reason: `Category '${normCat}' is exclusively mapped to PR Type(s) [${exclusiveOwners.join(', ')}] and is not eligible under '${prCode}'.`,
          prTypeCode: prCode,
        };
      }
    }

    return {
      eligible: true,
      reason: `Authorized by mapping ${winner.companyCode}/${winner.branchCode}/${winner.itemCategoryCode} (v${winner.versionNumber}).`,
      prTypeCode: prCode,
    };
  }

  getEligibleCategories(params: {
    companyId: string;
    branchId: string;
    purchaseOrgId?: string;
    prTypeCode: string;
    evaluationDate?: string;
    userRole?: string;
  }): Array<{ code: string; name: string; display: string }> {
    if ((params.prTypeCode || '').trim().toUpperCase() === 'EXPENSE') {
      return this.getEligibleExpenseCategories(params.companyId, params.branchId).map((c) => ({
        code: c.code,
        name: c.name,
        display: c.display,
      }));
    }
    return KNOWN_CATEGORY_DEFINITIONS.filter(
      (cat) =>
        this.evaluatePrTypeEligibility({
          companyId: params.companyId,
          branchId: params.branchId,
          purchaseOrgId: params.purchaseOrgId,
          itemCategoryCode: cat.code,
          prTypeCode: params.prTypeCode,
          evaluationDate: params.evaluationDate,
          userRole: params.userRole,
        }).eligible
    );
  }

  validateLinesCategoriesForPrType(params: {
    companyId: string;
    branchId: string;
    purchaseOrgId?: string;
    prTypeCode: string;
    lines: Array<{ id?: string; itemCode?: string; itemCategory?: string }>;
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
    const headerCheck = this.evaluatePrTypeEligibility({
      companyId: params.companyId,
      branchId: params.branchId,
      purchaseOrgId: params.purchaseOrgId,
      itemCategoryCode: 'ALL',
      prTypeCode: params.prTypeCode,
      evaluationDate: params.evaluationDate,
      userRole: params.userRole,
    });
    const eligibleCategories = this.getEligibleCategories(params);
    const invalidLines: Array<{
      lineIndex: number;
      lineId?: string;
      itemCode?: string;
      rawCategory: string;
      normalizedCategory: string;
      reason: string;
    }> = [];

    const isExpensePr = (params.prTypeCode || '').trim().toUpperCase() === 'EXPENSE';

    (params.lines || []).forEach((line, idx) => {
      if (isExpensePr) {
        invalidLines.push({
          lineIndex: idx,
          lineId: line.id,
          itemCode: line.itemCode,
          rawCategory: line.itemCategory || 'INVENTORY',
          normalizedCategory: line.itemCategory || 'INVENTORY',
          reason: `Inventory line #${idx + 1} (${line.itemCode || 'Item'}) is incompatible with PR Type 'EXPENSE'. Remove inventory lines and enter governed Expense Lines.`,
        });
        return;
      }
      const rawCat = (line.itemCategory || '').trim();
      const normCat = normalizeItemCategoryCode(rawCat);
      if (!rawCat || normCat === 'ALL') {
        invalidLines.push({
          lineIndex: idx,
          lineId: line.id,
          itemCode: line.itemCode,
          rawCategory: rawCat || 'UNSPECIFIED',
          normalizedCategory: normCat,
          reason: `Line #${idx + 1} (${line.itemCode || 'Item'}) does not carry a valid mapped category.`,
        });
        return;
      }
      const lineEval = this.evaluatePrTypeEligibility({
        companyId: params.companyId,
        branchId: params.branchId,
        purchaseOrgId: params.purchaseOrgId,
        itemCategoryCode: normCat,
        prTypeCode: params.prTypeCode,
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
      valid: headerCheck.eligible && invalidLines.length === 0,
      prTypeEligible: headerCheck.eligible,
      prTypeReason: headerCheck.eligible ? undefined : headerCheck.reason,
      eligibleCategories,
      invalidLines,
    };
  }

  resolveApprovalWorkflowPlan(
    pr: {
      companyId: string;
      branchId?: string;
      currency?: string;
      estimatedTotalValue?: number;
      grandTotalWithCharges?: number;
      approvalHistory?: Array<{ cycleNumber?: number; decision?: string }>;
      approvalCycleCount?: number;
    },
    evaluationDate?: string
  ) {
    const eff = this.getEffectivePolicy(pr.companyId, pr.branchId, evaluationDate);
    const txCurrency = (pr.currency || 'INR').toUpperCase();
    const repCurrency = (eff.budget.companyReportingCurrency || 'INR').toUpperCase();
    const rate = txCurrency === repCurrency ? 1 : FX_TO_INR[txCurrency] || 1;
    const txAmount = Number(pr.grandTotalWithCharges ?? pr.estimatedTotalValue ?? 0);
    const reportingAmount = Number((txAmount * rate).toFixed(2));
    const configuredLevels = Math.max(1, Number(eff.approval.approvalLevels) || 1);
    const matrix = [...(eff.approval.approvalMatrix || [])].sort(
      (a, b) => a.levelNumber - b.levelNumber
    );

    let requiredLevels = configuredLevels;
    if (eff.approval.amountBasedApproval && matrix.length > 0) {
      const highestMatch = [...matrix]
        .reverse()
        .find(
          (t) =>
            reportingAmount >= Number(t.minAmount || 0) &&
            (t.maxAmount === null || t.maxAmount === undefined || reportingAmount <= Number(t.maxAmount))
        );
      if (highestMatch) {
        requiredLevels = Math.max(1, Math.min(configuredLevels, highestMatch.levelNumber));
      }
    }

    const currentCycle = pr.approvalCycleCount || 1;
    const approvalsInCycle = (pr.approvalHistory || []).filter(
      (h) =>
        (h.cycleNumber || 1) === currentCycle &&
        (h.decision === 'APPROVED' || h.decision === 'DELEGATED_APPROVAL')
    ).length;

    return {
      enabled: Boolean(eff.activation.prApprovalEnabled && eff.approval.enableApprovalWorkflow),
      configuredLevels,
      requiredLevels,
      approvalsCompletedInCycle: approvalsInCycle,
      valuationReportingAmount: reportingAmount,
      reportingCurrency: repCurrency,
      makerCheckerRequired: Boolean(eff.requireMakerCheckerApproval),
      mandatoryApprovalRemarks: Boolean(eff.approval.mandatoryApprovalRemarks),
      managerL1Required: Boolean(eff.approval.managerL1Approval),
      branchScopedRequired: Boolean(eff.approval.branchLevelApprovers),
      departmentScopedRequired: Boolean(eff.approval.departmentLevelApprovers),
      delegationAllowed: Boolean(eff.approval.approvalDelegation),
      escalationAfterHours: Number(eff.approval.escalationAfterHours || 48),
      applicableTiers: matrix.slice(0, requiredLevels),
    };
  }

  validatePr(payload: {
    action?: 'SAVE_DRAFT' | 'SUBMIT' | 'APPROVE';
    pr: {
      id?: string;
      prNumber?: string;
      companyId: string;
      branchId: string;
      purchaseOrgId?: string;
      prType: string;
      department?: string;
      costCentre?: string;
      currency?: string;
      estimatedTotalValue?: number;
      grandTotalWithCharges?: number;
      budgetValidationStatus?: string;
      approvalHistory?: Array<{ cycleNumber?: number; decision?: string }>;
      approvalCycleCount?: number;
      lines?: Array<{
        id?: string;
        itemCode?: string;
        itemCategory?: string;
        chargeItems?: Array<{ chargeCode?: string; applicability?: string }>;
      }>;
      expenseLines?: Array<{
        id?: string;
        expenseCategoryCode?: string;
        expenseDescription?: string;
        costCentre?: string;
        serviceFromDate?: string;
        serviceToDate?: string;
        expectedServiceDate?: string;
        amount?: number;
        taxPercent?: number;
        sapGlAccountCode?: string;
        purchasePurpose?: string;
        businessJustification?: string;
      }>;
      chargeItems?: Array<{ chargeCode?: string; applicability?: string }>;
    };
    actorUser?: { id?: string; role?: string };
    evaluationDate?: string;
  }) {
    const pr = payload.pr;
    if (!pr || !pr.companyId || !pr.branchId) {
      throw new PrGovernanceHttpError(400, 'INVALID_REQUEST', 'pr.companyId and pr.branchId are required.');
    }

    const eff = this.getEffectivePolicy(pr.companyId, pr.branchId, payload.evaluationDate);
    const errors: string[] = [];
    const warnings: string[] = [];
    const isExpensePr = (pr.prType || '').trim().toUpperCase() === 'EXPENSE';

    if (!eff.activation.prModuleEnabled) {
      errors.push(`Purchase Requisition module is disabled for ${eff.companyCode} / ${eff.branchName}.`);
    }
    if (payload.action !== 'SAVE_DRAFT' && !eff.activation.prSubmissionEnabled) {
      errors.push('PR Submission is disabled under active Company/Branch governance policy.');
    }

    const categoryValidation = this.validateLinesCategoriesForPrType({
      companyId: pr.companyId,
      branchId: pr.branchId,
      purchaseOrgId: pr.purchaseOrgId,
      prTypeCode: pr.prType,
      lines: pr.lines || [],
      evaluationDate: payload.evaluationDate,
      userRole: payload.actorUser?.role,
    });

    if (!categoryValidation.valid) {
      if (!categoryValidation.prTypeEligible && categoryValidation.prTypeReason) {
        errors.push(categoryValidation.prTypeReason);
      }
      for (const bad of categoryValidation.invalidLines) {
        errors.push(bad.reason);
      }
    }

    if (isExpensePr) {
      if ((pr.chargeItems || []).some((c) => c.applicability !== 'NOT_APPLICABLE')) {
        errors.push('Charge Items are only permitted on Inventory PRs and must be removed from EXPENSE PRs.');
      }
      const expLines = pr.expenseLines || [];
      if (payload.action !== 'SAVE_DRAFT' && expLines.length === 0) {
        errors.push('At least one governed Expense Line is required for an EXPENSE PR.');
      }
      const eligibleExpCats = this.getEligibleExpenseCategories(pr.companyId, pr.branchId);
      expLines.forEach((el, idx) => {
        const lineNum = idx + 1;
        const cat = eligibleExpCats.find(
          (c) => c.code.toUpperCase() === String(el.expenseCategoryCode || '').toUpperCase()
        );
        if (!cat) {
          errors.push(`Expense Line #${lineNum}: Category '${el.expenseCategoryCode || 'UNSPECIFIED'}' is not an active approved Expense Category.`);
        }
        const desc = String(el.expenseDescription || '').trim();
        if (!desc) {
          errors.push(`Expense Line #${lineNum}: Expense Description is mandatory.`);
        } else {
          const lower = desc.toLowerCase();
          const hit = INVENTORY_LINKED_CHARGE_KEYWORDS.find((kw) => lower.includes(kw));
          if (hit) {
            errors.push(
              `Expense Line #${lineNum}: Classification violation — "${desc}" matches inventory-linked charge "${hit}". Record inventory-linked costs as Charge Items on an Inventory PR.`
            );
          }
        }
        if (!String(el.costCentre || pr.costCentre || '').trim()) {
          errors.push(`Expense Line #${lineNum}: Cost Centre could not be determined for the selected Company, Branch and Department.`);
        }
        const fromDate = String(el.serviceFromDate || el.expectedServiceDate || '').trim();
        const toDate = String(el.serviceToDate || el.expectedServiceDate || '').trim();
        if (!fromDate) {
          errors.push(`Expense Line #${lineNum}: Service From Date is mandatory.`);
        }
        if (!toDate) {
          errors.push(`Expense Line #${lineNum}: Service To Date is mandatory.`);
        }
        if (fromDate && toDate && toDate < fromDate) {
          errors.push(
            `Expense Line #${lineNum}: Service To Date (${toDate}) cannot be earlier than Service From Date (${fromDate}).`
          );
        }
        if (!(Number(el.amount) > 0)) {
          errors.push(`Expense Line #${lineNum}: Expense Amount must be greater than zero.`);
        }
        if (payload.action !== 'SAVE_DRAFT') {
          if (!String(el.purchasePurpose || '').trim()) {
            errors.push(`Expense Line #${lineNum}: Purchase Purpose is mandatory.`);
          }
          if (!String(el.businessJustification || '').trim()) {
            errors.push(`Expense Line #${lineNum}: Mandatory Business Justification is required.`);
          }
        }
      });
    } else {
      if ((pr.expenseLines || []).length > 0) {
        errors.push(
          `Expense Lines cannot be submitted under Inventory PR Type '${pr.prType}'. Remove Expense Lines or switch PR Type to 'EXPENSE'.`
        );
      }
      if (!eff.activation.allowSameChargeAtHeaderAndLine) {
        const headerCodes = new Set(
          (pr.chargeItems || [])
            .filter((c) => c.applicability !== 'NOT_APPLICABLE' && c.chargeCode)
            .map((c) => String(c.chargeCode).toUpperCase())
        );
        (pr.lines || []).forEach((line, idx) => {
          (line.chargeItems || []).forEach((lc) => {
            const code = String(lc.chargeCode || '').toUpperCase();
            if (lc.applicability !== 'NOT_APPLICABLE' && code && headerCodes.has(code)) {
              errors.push(
                `Charge '${code}' is applied at both PR Header and Line #${idx + 1} (${line.itemCode || ''}), which is prohibited by policy.`
              );
            }
          });
        });
      }
    }

    const workflowPlan = this.resolveApprovalWorkflowPlan(pr, payload.evaluationDate);
    const budgetEnabled = this.isBudgetValidationEnabled(pr.companyId, pr.branchId, payload.evaluationDate);

    let budgetResult: {
      enabled: boolean;
      status: 'NOT_VALIDATED' | 'SUFFICIENT' | 'WARNING' | 'BLOCKED_INSUFFICIENT_BUDGET';
      proposedReportingAmount: number;
      availableBudget?: number;
      shortfall?: number;
      enforcementMode?: string;
      message?: string;
    } = {
      enabled: false,
      status: 'NOT_VALIDATED',
      proposedReportingAmount: workflowPlan.valuationReportingAmount,
    };

    if (budgetEnabled) {
      const normComp = normalizeCompanyId(pr.companyId);
      const normBr = normalizeBranchId(pr.branchId);
      const bPolicy =
        this.budgetPolicies.find(
          (bp) =>
            normalizeCompanyId(bp.companyId) === normComp &&
            (normalizeBranchId(bp.branchId) === normBr || bp.branchId === 'ALL') &&
            bp.status === 'ACTIVE'
        ) || this.budgetPolicies[0];

      const ledger =
        this.budgetLedgers.find(
          (l) =>
            normalizeCompanyId(l.companyId) === normComp &&
            normalizeBranchId(l.branchId) === normBr &&
            (!pr.costCentre || l.costCenter === pr.costCentre)
        ) ||
        this.budgetLedgers.find(
          (l) => normalizeCompanyId(l.companyId) === normComp && normalizeBranchId(l.branchId) === normBr
        );

      const available = ledger ? Number(ledger.availableBudget) : 0;
      const proposed = workflowPlan.valuationReportingAmount;
      const shortfall = Math.max(0, Number((proposed - available).toFixed(2)));
      const enforcement = bPolicy?.enforcementMode || 'BLOCK_WHEN_INSUFFICIENT';

      if (!ledger) {
        if (eff.budget.mandatoryBudgetCheck && enforcement === 'BLOCK_WHEN_INSUFFICIENT') {
          errors.push(`Budget ledger not found for ${eff.companyCode} / ${normBr}; mandatory budget check failed.`);
          budgetResult = {
            enabled: true,
            status: 'BLOCKED_INSUFFICIENT_BUDGET',
            proposedReportingAmount: proposed,
            availableBudget: 0,
            shortfall: proposed,
            enforcementMode: enforcement,
            message: 'Missing budget allocation ledger.',
          };
        } else {
          warnings.push('Budget ledger missing; proceeding with warning.');
          budgetResult = {
            enabled: true,
            status: 'WARNING',
            proposedReportingAmount: proposed,
            availableBudget: 0,
            shortfall: proposed,
            enforcementMode: enforcement,
          };
        }
      } else if (shortfall > 0) {
        if (
          payload.action !== 'SAVE_DRAFT' &&
          eff.budget.mandatoryBudgetCheck &&
          enforcement === 'BLOCK_WHEN_INSUFFICIENT'
        ) {
          errors.push(
            `Budget shortfall of ${workflowPlan.reportingCurrency} ${shortfall.toLocaleString()}: proposed ${proposed.toLocaleString()} exceeds available ${available.toLocaleString()}.`
          );
          budgetResult = {
            enabled: true,
            status: 'BLOCKED_INSUFFICIENT_BUDGET',
            proposedReportingAmount: proposed,
            availableBudget: available,
            shortfall,
            enforcementMode: enforcement,
          };
        } else {
          warnings.push(`Budget shortfall warning (${shortfall.toLocaleString()}).`);
          budgetResult = {
            enabled: true,
            status: 'WARNING',
            proposedReportingAmount: proposed,
            availableBudget: available,
            shortfall,
            enforcementMode: enforcement,
          };
        }
      } else {
        budgetResult = {
          enabled: true,
          status: 'SUFFICIENT',
          proposedReportingAmount: proposed,
          availableBudget: available,
          shortfall: 0,
          enforcementMode: enforcement,
        };
      }
    }

    return {
      allowed: errors.length === 0,
      errors,
      warnings,
      effectivePolicySummary: {
        policyId: eff.id,
        policyVersion: eff.policyVersion,
        resolutionSource: eff.resolutionSource,
        budgetValidationEnabled: budgetEnabled,
      },
      categoryValidation,
      workflowPlan,
      budgetResult,
    };
  }

  validateSapHandoff(payload: {
    pr: {
      id?: string;
      prNumber?: string;
      status: string;
      companyId: string;
      branchId: string;
      purchaseOrgId?: string;
      prType: string;
      department?: string;
      costCentre?: string;
      currency?: string;
      estimatedTotalValue?: number;
      grandTotalWithCharges?: number;
      budgetValidationStatus?: string;
      approvalHistory?: Array<{ cycleNumber?: number; decision?: string; actorId?: string }>;
      approvalCycleCount?: number;
      creatorId?: string;
      duplicateGovernance?: { hasBlockingDuplicates?: boolean };
      lines?: Array<{ id?: string; itemCode?: string; itemCategory?: string }>;
      expenseLines?: Array<{
        id?: string;
        expenseCategoryCode?: string;
        expenseDescription?: string;
        costCentre?: string;
        serviceFromDate?: string;
        serviceToDate?: string;
        expectedServiceDate?: string;
        amount?: number;
        taxPercent?: number;
        sapGlAccountCode?: string;
        purchasePurpose?: string;
        businessJustification?: string;
      }>;
      chargeItems?: Array<{ chargeCode?: string; applicability?: string }>;
    };
    evaluationDate?: string;
  }) {
    const pr = payload.pr;
    if (!pr) {
      throw new PrGovernanceHttpError(400, 'INVALID_REQUEST', 'pr payload is required.');
    }

    const blockingReasons: string[] = [];
    const approvedStatuses = new Set(['APPROVED_PENDING_BUYER', 'APPROVED', 'PARTIALLY_CONVERTED']);
    if (!approvedStatuses.has(pr.status)) {
      blockingReasons.push(`SAP transaction blocked: PR ${pr.prNumber || ''} is in status '${pr.status}' and has not completed required approval.`);
    }

    const workflowPlan = this.resolveApprovalWorkflowPlan(pr, payload.evaluationDate);
    if (workflowPlan.enabled && workflowPlan.approvalsCompletedInCycle < workflowPlan.requiredLevels) {
      blockingReasons.push(
        `SAP transaction blocked: Only ${workflowPlan.approvalsCompletedInCycle} of ${workflowPlan.requiredLevels} required approval levels completed.`
      );
    }

    if (pr.duplicateGovernance?.hasBlockingDuplicates) {
      blockingReasons.push('SAP transaction blocked: Unresolved blocking duplicate PR condition.');
    }

    const prCheck = this.validatePr({ action: 'SUBMIT', pr, evaluationDate: payload.evaluationDate });
    if (!prCheck.allowed) {
      blockingReasons.push(...prCheck.errors);
    }
    if (
      prCheck.budgetResult.enabled &&
      prCheck.budgetResult.status === 'BLOCKED_INSUFFICIENT_BUDGET' &&
      pr.budgetValidationStatus !== 'EXCEPTION_APPROVED' &&
      pr.budgetValidationStatus !== 'SUFFICIENT'
    ) {
      blockingReasons.push('SAP transaction blocked: Mandatory budget check has not passed.');
    }

    return {
      readyForSap: blockingReasons.length === 0,
      blockingReasons,
      workflowPlan,
      budgetValidationEnabled: prCheck.effectivePolicySummary.budgetValidationEnabled,
    };
  }

  getSapTrace(prId: string): BackendSapTraceRecord | null {
    return this.sapTraces[prId] || null;
  }

  postPrToSapServiceLayer(payload: {
    pr: {
      id: string;
      prNumber: string;
      status: string;
      companyId: string;
      branchId: string;
      purchaseOrgId?: string;
      prType: string;
      department?: string;
      costCentre?: string;
      currency?: string;
      estimatedTotalValue?: number;
      grandTotalWithCharges?: number;
      budgetValidationStatus?: string;
      approvalHistory?: Array<{ cycleNumber?: number; decision?: string; actorId?: string }>;
      approvalCycleCount?: number;
      duplicateGovernance?: { hasBlockingDuplicates?: boolean };
      lines?: Array<{
        id?: string;
        itemCode?: string;
        itemCategory?: string;
        requestedQty?: number;
        estimatedUnitPrice?: number;
        warehouseCode?: string;
        requiredDate?: string;
      }>;
      expenseLines?: Array<{
        id?: string;
        expenseCategoryCode?: string;
        expenseDescription?: string;
        costCentre?: string;
        serviceFromDate?: string;
        serviceToDate?: string;
        expectedServiceDate?: string;
        amount?: number;
        taxCode?: string;
        taxPercent?: number;
        sapGlAccountCode?: string;
        purchasePurpose?: string;
        businessJustification?: string;
      }>;
      chargeItems?: Array<{
        chargeCode?: string;
        sapExpenseCode?: number;
        estimatedAmount?: number;
        taxCode?: string;
        applicability?: string;
      }>;
    };
    simulateOutcome?: 'SUCCESS' | 'SAP_VALIDATION_ERROR' | 'NETWORK_TIMEOUT_AMBIGUOUS';
  }): { trace: BackendSapTraceRecord; sapPayload: Record<string, unknown> } {
    const pr = payload.pr;
    if (!pr || !pr.id) {
      throw new PrGovernanceHttpError(400, 'INVALID_REQUEST', 'pr.id is required for SAP Service Layer posting.');
    }

    const isExpense = (pr.prType || '').trim().toUpperCase() === 'EXPENSE';
    const existing = this.sapTraces[pr.id];

    if (existing?.status === 'INTEGRATED') {
      return {
        trace: existing,
        sapPayload: existing.requestPayloadSummary || {},
      };
    }

    if (existing?.status === 'REQUIRES_RECONCILIATION') {
      throw new PrGovernanceHttpError(
        409,
        'SAP_RECONCILIATION_REQUIRED',
        `PR ${pr.prNumber} is in REQUIRES_RECONCILIATION state. Reconcile SAP state before retrying to prevent duplicate SAP documents.`,
        { trace: existing }
      );
    }

    const readiness = this.validateSapHandoff({ pr });
    const now = new Date().toISOString();
    const idempotencyKey = existing?.idempotencyKey || `KOSH-SAP-PR-${pr.id}-C${pr.approvalCycleCount || 1}`;
    const sapDocType = isExpense ? 'dDocument_Service' : 'dDocument_Items';

    const sapPayload: Record<string, unknown> = isExpense
      ? {
          DocType: 'dDocument_Service',
          DocCurrency: pr.currency || 'INR',
          U_KoshPRId: pr.id,
          U_KoshPRNum: pr.prNumber,
          U_KoshPRType: 'EXPENSE',
          U_KoshIdempotencyKey: idempotencyKey,
          DocumentLines: (pr.expenseLines || []).map((el, idx) => ({
            LineNum: idx,
            ItemDescription: `[${el.expenseCategoryCode}] ${el.expenseDescription}`,
            AccountCode: el.sapGlAccountCode || '610100',
            CostingCode: el.costCentre || pr.costCentre || '',
            RequiredDate: el.serviceToDate || el.serviceFromDate || el.expectedServiceDate || '',
            U_KoshServiceFromDate: el.serviceFromDate || el.expectedServiceDate || '',
            U_KoshServiceToDate: el.serviceToDate || el.expectedServiceDate || '',
            TaxCode: el.taxCode || 'GST18',
            LineTotal: Number(el.amount || 0),
          })),
        }
      : {
          DocType: 'dDocument_Items',
          DocCurrency: pr.currency || 'INR',
          U_KoshPRId: pr.id,
          U_KoshPRNum: pr.prNumber,
          U_KoshPRType: pr.prType,
          U_KoshIdempotencyKey: idempotencyKey,
          DocumentLines: (pr.lines || []).map((ln, idx) => ({
            LineNum: idx,
            ItemCode: ln.itemCode,
            Quantity: Number(ln.requestedQty || 1),
            UnitPrice: Number(ln.estimatedUnitPrice || 0),
            WarehouseCode: ln.warehouseCode || 'WH-01',
          })),
          DocumentAdditionalExpenses: (pr.chargeItems || [])
            .filter((c) => c.applicability !== 'NOT_APPLICABLE' && Number(c.estimatedAmount || 0) > 0)
            .map((c) => ({
              ExpenseCode: c.sapExpenseCode || 103,
              LineTotal: Number(c.estimatedAmount || 0),
              TaxCode: c.taxCode || 'GST18',
            })),
        };

    if (!readiness.readyForSap) {
      const failedTrace: BackendSapTraceRecord = {
        prId: pr.id,
        prNumber: pr.prNumber,
        prType: pr.prType,
        procurementMechanism: isExpense ? 'EXPENSE_PR' : 'INVENTORY_PR',
        sapDocType,
        status: 'FAILED',
        idempotencyKey,
        attemptCount: (existing?.attemptCount || 0) + 1,
        lastAttemptAt: now,
        lastErrorCode: 'SAP_PRE_HANDOFF_GOVERNANCE_BLOCKED',
        lastErrorMessage: readiness.blockingReasons.join(' | '),
        requestPayloadSummary: sapPayload,
      };
      this.sapTraces[pr.id] = failedTrace;
      return { trace: failedTrace, sapPayload };
    }

    const outcome = payload.simulateOutcome || 'SUCCESS';
    if (outcome === 'NETWORK_TIMEOUT_AMBIGUOUS') {
      const reconTrace: BackendSapTraceRecord = {
        prId: pr.id,
        prNumber: pr.prNumber,
        prType: pr.prType,
        procurementMechanism: isExpense ? 'EXPENSE_PR' : 'INVENTORY_PR',
        sapDocType,
        status: 'REQUIRES_RECONCILIATION',
        idempotencyKey,
        attemptCount: (existing?.attemptCount || 0) + 1,
        lastAttemptAt: now,
        lastErrorCode: 'SAP_SL_TIMEOUT_AMBIGUOUS',
        lastErrorMessage:
          'SAP Service Layer connection timed out after payload dispatch. Verify U_KoshIdempotencyKey before retrying.',
        requestPayloadSummary: sapPayload,
      };
      this.sapTraces[pr.id] = reconTrace;
      return { trace: reconTrace, sapPayload };
    }

    if (outcome === 'SAP_VALIDATION_ERROR') {
      const errTrace: BackendSapTraceRecord = {
        prId: pr.id,
        prNumber: pr.prNumber,
        prType: pr.prType,
        procurementMechanism: isExpense ? 'EXPENSE_PR' : 'INVENTORY_PR',
        sapDocType,
        status: 'FAILED',
        idempotencyKey,
        attemptCount: (existing?.attemptCount || 0) + 1,
        lastAttemptAt: now,
        lastErrorCode: 'SAP_SL_400_POSTING_PERIOD',
        lastErrorMessage: 'SAP B1 Service Layer rejected posting: Posting period locked or cost center inactive.',
        requestPayloadSummary: sapPayload,
      };
      this.sapTraces[pr.id] = errTrace;
      return { trace: errTrace, sapPayload };
    }

    this.sapDocEntrySeq += 1;
    this.sapDocNumSeq += 1;
    const integratedTrace: BackendSapTraceRecord = {
      prId: pr.id,
      prNumber: pr.prNumber,
      prType: pr.prType,
      procurementMechanism: isExpense ? 'EXPENSE_PR' : 'INVENTORY_PR',
      sapDocType,
      status: 'INTEGRATED',
      idempotencyKey,
      sapDocEntry: this.sapDocEntrySeq,
      sapDocNum: this.sapDocNumSeq,
      attemptCount: (existing?.attemptCount || 0) + 1,
      lastAttemptAt: now,
      integratedAt: now,
      requestPayloadSummary: sapPayload,
    };
    this.sapTraces[pr.id] = integratedTrace;
    return { trace: integratedTrace, sapPayload };
  }

  reconcileSapIntegrationState(payload: {
    prId: string;
    resolution: 'CONFIRMED_NOT_POSTED_ALLOW_RETRY' | 'FOUND_EXISTING_SAP_DOCUMENT';
    actorName?: string;
    notes?: string;
    existingSapDocEntry?: number;
    existingSapDocNum?: number;
  }): { trace: BackendSapTraceRecord } {
    const existing = this.sapTraces[payload.prId];
    if (!existing) {
      throw new PrGovernanceHttpError(404, 'SAP_TRACE_NOT_FOUND', `No SAP trace found for PR ${payload.prId}`);
    }
    if (existing.status !== 'REQUIRES_RECONCILIATION' && existing.status !== 'FAILED') {
      throw new PrGovernanceHttpError(
        400,
        'INVALID_RECONCILE_STATE',
        `Cannot reconcile trace in status '${existing.status}'.`
      );
    }
    const now = new Date().toISOString();
    if (payload.resolution === 'FOUND_EXISTING_SAP_DOCUMENT') {
      existing.status = 'INTEGRATED';
      existing.sapDocEntry = payload.existingSapDocEntry || ++this.sapDocEntrySeq;
      existing.sapDocNum = payload.existingSapDocNum || ++this.sapDocNumSeq;
      existing.integratedAt = now;
      existing.reconciledAt = now;
      existing.reconciledBy = payload.actorName || 'System Admin';
      existing.reconciliationNotes = payload.notes || 'Linked to existing SAP document.';
      existing.lastErrorCode = undefined;
      existing.lastErrorMessage = undefined;
    } else {
      existing.status = 'FAILED';
      existing.reconciledAt = now;
      existing.reconciledBy = payload.actorName || 'System Admin';
      existing.reconciliationNotes = payload.notes || 'Confirmed not posted in SAP; cleared for safe retry.';
      existing.lastErrorCode = 'RECONCILED_SAFE_TO_RETRY';
      existing.lastErrorMessage = 'Cleared for retry after SAP reconciliation.';
    }
    return { trace: existing };
  }
}

export const defaultPrGovernanceBackend = new PrGovernanceBackendStore();
