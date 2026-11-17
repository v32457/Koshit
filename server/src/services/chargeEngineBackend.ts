/**
 * KOSH INNOVATIONS — SERVER-SIDE CENTRALIZED CHARGE ENGINE
 * Self-contained NodeNext backend service for:
 *  1. Centralized Charge Master CRUD & duplicate active code guard
 *  2. Company & Branch Charge Item Mapping inheritance, central locks & version history
 *  3. Safe AST formula evaluation (zero eval / new Function)
 *  4. Backend-controlled PR Charge Calculation & Immutable Snapshot generation
 *  5. Deterministic Header-to-Line Charge Allocation & Landed Cost calculation
 */

export class ChargeEngineHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type BackendApplicationLevel =
  | 'PR_HEADER'
  | 'PR_LINE'
  | 'PO_HEADER'
  | 'PO_LINE'
  | 'SHIPMENT'
  | 'DELIVERY_SCHEDULE'
  | 'GRN'
  | 'QUANTITY_BASED'
  | 'TRANSPORT_TRIP'
  | 'INVOICE_LEVEL';

export type BackendCalculationMethod =
  | 'FIXED_AMOUNT'
  | 'PERCENTAGE'
  | 'PER_UNIT'
  | 'PER_KG'
  | 'PER_MT'
  | 'PER_VOLUME'
  | 'PER_KM'
  | 'PER_SHIPMENT'
  | 'PER_TRIP'
  | 'PER_DAY'
  | 'ACTUAL_COST'
  | 'FORMULA_BASED';

export type BackendAllocationMethod =
  | 'EQUAL_DISTRIBUTION'
  | 'PROPORTIONAL_VALUE'
  | 'PROPORTIONAL_QUANTITY'
  | 'PROPORTIONAL_WEIGHT'
  | 'PROPORTIONAL_VOLUME'
  | 'MANUAL_ALLOCATION'
  | 'DIRECT_LINE_ALLOCATION';

export type BackendApplicability = 'MANDATORY' | 'OPTIONAL' | 'CONDITIONAL' | 'NOT_APPLICABLE';

export interface BackendChargeMaster {
  id: string;
  chargeCode: string;
  chargeName: string;
  chargeDescription: string;
  chargeCategory: string;
  defaultApplicationLevel: BackendApplicationLevel;
  permittedApplicationLevels: BackendApplicationLevel[];
  defaultCalculationMethod: BackendCalculationMethod;
  defaultRate: number;
  defaultFormulaExpression?: string;
  defaultCurrency: string;
  defaultTaxTreatment: string;
  taxRatePercent: number;
  defaultAllocationBasis: BackendAllocationMethod;
  chargeBearer: string;
  minimumCharge?: number;
  maximumCharge?: number;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
  versionNumber: number;
  createdBy: string;
  modifiedBy: string;
  modifiedDate: string;
}

export interface BackendChargeMapping {
  id: string;
  versionNumber: number;
  companyId: string;
  branchId: string; // 'ALL' = authoritative company mapping
  chargeMasterId: string;
  chargeCode: string;
  isEnabled: boolean;
  applicability: BackendApplicability;
  defaultCalculationMethod: BackendCalculationMethod;
  fixedTariffOrRate: number;
  formulaExpression?: string;
  currency: string;
  taxTreatment: string;
  taxRatePercent: number;
  allocationBasis: BackendAllocationMethod;
  effectiveFrom: string;
  effectiveTo?: string;
  allowBranchOverride: boolean;
  centrallyControlledFields: string[];
  requiresApproval: boolean;
  isBranchOverride: boolean;
  updatedBy: string;
  updatedAt: string;
}

export interface BackendChargeMappingHistory {
  id: string;
  mappingId: string;
  versionNumber: number;
  companyId: string;
  branchId: string;
  chargeMasterId: string;
  chargeCode: string;
  action: string;
  changedBy: string;
  changedAt: string;
  previousSnapshot?: Partial<BackendChargeMapping>;
  newSnapshot: Partial<BackendChargeMapping>;
}

const FX_TO_INR: Record<string, number> = {
  INR: 1,
  USD: 84.5,
  EUR: 91.2,
  GBP: 107.8,
  JPY: 0.55,
};

function getFxRate(fromCurrency: string, toCurrency: string): number {
  const from = (fromCurrency || 'INR').toUpperCase();
  const to = (toCurrency || 'INR').toUpperCase();
  if (from === to) return 1;
  const fromInr = FX_TO_INR[from] ?? 1;
  const toInr = FX_TO_INR[to] ?? 1;
  return Number((fromInr / toInr).toFixed(6));
}

function roundHalfUp(val: number, precision = 2): number {
  const f = Math.pow(10, precision);
  return Math.round((val + Number.EPSILON) * f) / f;
}

// Restricted recursive-descent AST formula evaluator (zero eval / Function)
function evaluateSafeFormula(expr: string, vars: Record<string, number>): number {
  const trimmed = (expr || '').trim();
  if (!trimmed) throw new ChargeEngineHttpError(400, 'INVALID_FORMULA', 'Formula expression cannot be empty.');
  if (/[;{}\[\]`$\\]|new\s|Function|eval|window|global|process|import|require/i.test(trimmed)) {
    throw new ChargeEngineHttpError(400, 'UNSAFE_FORMULA', 'Disallowed syntax in charge formula.');
  }

  type Tok = { kind: 'num'; val: number } | { kind: 'id'; val: string } | { kind: 'op'; val: string };
  const toks: Tok[] = [];
  let i = 0;
  while (i < trimmed.length) {
    const ch = trimmed[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let s = '';
      while (i < trimmed.length && /[0-9.]/.test(trimmed[i])) s += trimmed[i++];
      const num = Number(s);
      if (!Number.isFinite(num)) throw new ChargeEngineHttpError(400, 'INVALID_FORMULA', `Invalid number ${s}`);
      toks.push({ kind: 'num', val: num });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < trimmed.length && /[a-zA-Z0-9_]/.test(trimmed[i])) id += trimmed[i++];
      toks.push({ kind: 'id', val: id });
      continue;
    }
    if ('+-*/(),'.includes(ch)) {
      toks.push({ kind: 'op', val: ch });
      i += 1;
      continue;
    }
    throw new ChargeEngineHttpError(400, 'INVALID_FORMULA', `Unsupported token '${ch}'`);
  }

  let pos = 0;
  const peek = () => toks[pos];
  const eat = () => toks[pos++];

  function parseExpr(): number {
    let left = parseTerm();
    while (peek()?.kind === 'op' && (peek()!.val === '+' || peek()!.val === '-')) {
      const op = eat().val;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseFactor();
    while (peek()?.kind === 'op' && (peek()!.val === '*' || peek()!.val === '/')) {
      const op = eat().val;
      const right = parseFactor();
      if (op === '/') {
        if (right === 0) throw new ChargeEngineHttpError(400, 'DIVIDE_BY_ZERO', 'Division by zero in charge formula.');
        left = left / right;
      } else {
        left = left * right;
      }
    }
    return left;
  }

  function parseFactor(): number {
    const t = peek();
    if (!t) throw new ChargeEngineHttpError(400, 'INVALID_FORMULA', 'Unexpected end of formula.');
    if (t.kind === 'op' && t.val === '-') {
      eat();
      return -parseFactor();
    }
    if (t.kind === 'op' && t.val === '(') {
      eat();
      const v = parseExpr();
      if (eat()?.val !== ')') throw new ChargeEngineHttpError(400, 'INVALID_FORMULA', 'Unmatched parenthesis.');
      return v;
    }
    if (t.kind === 'num') {
      eat();
      return t.val;
    }
    if (t.kind === 'id') {
      eat();
      if (peek()?.kind === 'op' && peek()!.val === '(') {
        eat();
        const args: number[] = [];
        if (!(peek()?.kind === 'op' && peek()!.val === ')')) {
          args.push(parseExpr());
          while (peek()?.kind === 'op' && peek()!.val === ',') {
            eat();
            args.push(parseExpr());
          }
        }
        if (eat()?.val !== ')') throw new ChargeEngineHttpError(400, 'INVALID_FORMULA', 'Expected closing parenthesis.');
        if (t.val === 'min') return Math.min(...args);
        if (t.val === 'max') return Math.max(...args);
        if (t.val === 'round') {
          const digits = args[1] ?? 2;
          return roundHalfUp(args[0] ?? 0, digits);
        }
        if (t.val === 'abs') return Math.abs(args[0] ?? 0);
        throw new ChargeEngineHttpError(400, 'UNKNOWN_FUNCTION', `Unsupported function ${t.val}`);
      }
      if (!(t.val in vars)) {
        throw new ChargeEngineHttpError(400, 'UNKNOWN_VARIABLE', `Unknown formula variable "${t.val}".`);
      }
      return vars[t.val];
    }
    throw new ChargeEngineHttpError(400, 'INVALID_FORMULA', 'Malformed formula token.');
  }

  const result = parseExpr();
  if (pos !== toks.length) throw new ChargeEngineHttpError(400, 'INVALID_FORMULA', 'Trailing tokens in formula.');
  return result;
}

const ADMIN_ROLES = new Set(['PLATFORM_ADMIN', 'ORG_ADMIN']);

function assertAdminRole(actorRole?: string): void {
  if (!actorRole) return;
  if (!ADMIN_ROLES.has(actorRole.toUpperCase())) {
    throw new ChargeEngineHttpError(
      403,
      'FORBIDDEN',
      `Role "${actorRole}" is not authorized to modify Charge Master or Charge Mappings.`
    );
  }
}

export class ChargeEngineBackendStore {
  private masters: BackendChargeMaster[] = [];
  private mappings: BackendChargeMapping[] = [];
  private mappingHistory: BackendChargeMappingHistory[] = [];
  private prChargeSnapshots: Record<string, Array<Record<string, unknown>>> = {};

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults(): void {
    const now = '2026-04-01T00:00:00.000Z';
    this.masters = [
      {
        id: 'cm-load',
        chargeCode: 'CHG-LOAD',
        chargeName: 'Loading Charges',
        chargeDescription: 'Labor and material-handling equipment loading tariff at origin dock.',
        chargeCategory: 'HANDLING',
        defaultApplicationLevel: 'PR_LINE',
        permittedApplicationLevels: ['PR_HEADER', 'PR_LINE', 'PO_HEADER', 'PO_LINE', 'SHIPMENT', 'DELIVERY_SCHEDULE', 'GRN', 'QUANTITY_BASED'],
        defaultCalculationMethod: 'FIXED_AMOUNT',
        defaultRate: 1500,
        defaultCurrency: 'INR',
        defaultTaxTreatment: 'DOMESTIC_GST_TAXABLE',
        taxRatePercent: 18,
        defaultAllocationBasis: 'PROPORTIONAL_QUANTITY',
        chargeBearer: 'BUYER',
        minimumCharge: 0,
        effectiveFrom: '2025-04-01',
        isActive: true,
        versionNumber: 1,
        createdBy: 'System Governance',
        modifiedBy: 'System Governance',
        modifiedDate: now,
      },
      {
        id: 'cm-unload',
        chargeCode: 'CHG-UNLOAD',
        chargeName: 'Unloading Charges',
        chargeDescription: 'Plant receiving bay unloading & dock labor charges per delivery/GRN.',
        chargeCategory: 'HANDLING',
        defaultApplicationLevel: 'DELIVERY_SCHEDULE',
        permittedApplicationLevels: ['PR_HEADER', 'PR_LINE', 'PO_HEADER', 'PO_LINE', 'DELIVERY_SCHEDULE', 'GRN', 'SHIPMENT', 'QUANTITY_BASED'],
        defaultCalculationMethod: 'FIXED_AMOUNT',
        defaultRate: 1500,
        defaultCurrency: 'INR',
        defaultTaxTreatment: 'DOMESTIC_GST_TAXABLE',
        taxRatePercent: 18,
        defaultAllocationBasis: 'PROPORTIONAL_QUANTITY',
        chargeBearer: 'BUYER',
        minimumCharge: 0,
        effectiveFrom: '2025-04-01',
        isActive: true,
        versionNumber: 1,
        createdBy: 'System Governance',
        modifiedBy: 'System Governance',
        modifiedDate: now,
      },
      {
        id: 'cm-freight',
        chargeCode: 'CHG-FREIGHT',
        chargeName: 'Freight Charges',
        chargeDescription: 'Domestic line-haul or international sea/air freight charges.',
        chargeCategory: 'LOGISTICS',
        defaultApplicationLevel: 'PO_HEADER',
        permittedApplicationLevels: ['PR_HEADER', 'PR_LINE', 'PO_HEADER', 'PO_LINE', 'SHIPMENT', 'DELIVERY_SCHEDULE', 'GRN', 'QUANTITY_BASED', 'TRANSPORT_TRIP', 'INVOICE_LEVEL'],
        defaultCalculationMethod: 'FIXED_AMOUNT',
        defaultRate: 4500,
        defaultCurrency: 'INR',
        defaultTaxTreatment: 'DOMESTIC_GST_RCM',
        taxRatePercent: 5,
        defaultAllocationBasis: 'PROPORTIONAL_VALUE',
        chargeBearer: 'BUYER',
        minimumCharge: 0,
        effectiveFrom: '2025-04-01',
        isActive: true,
        versionNumber: 1,
        createdBy: 'System Governance',
        modifiedBy: 'System Governance',
        modifiedDate: now,
      },
      {
        id: 'cm-customs-duty',
        chargeCode: 'CHG-CUSTOMS',
        chargeName: 'Customs Duty (BCD + SWS)',
        chargeDescription: 'Import Basic Customs Duty & Social Welfare Surcharge assessed on CIF value.',
        chargeCategory: 'IMPORT_CUSTOMS',
        defaultApplicationLevel: 'SHIPMENT',
        permittedApplicationLevels: ['PR_HEADER', 'PR_LINE', 'PO_HEADER', 'PO_LINE', 'SHIPMENT', 'INVOICE_LEVEL'],
        defaultCalculationMethod: 'PERCENTAGE',
        defaultRate: 10,
        defaultCurrency: 'INR',
        defaultTaxTreatment: 'IMPORT_CUSTOMS_BCD_SWS',
        taxRatePercent: 10,
        defaultAllocationBasis: 'PROPORTIONAL_VALUE',
        chargeBearer: 'BUYER',
        effectiveFrom: '2025-04-01',
        isActive: true,
        versionNumber: 1,
        createdBy: 'System Governance',
        modifiedBy: 'System Governance',
        modifiedDate: now,
      },
      {
        id: 'cm-insurance',
        chargeCode: 'CHG-INSURANCE',
        chargeName: 'Transit & Marine Cargo Insurance',
        chargeDescription: 'All-risk inland transit or international marine cargo insurance premium.',
        chargeCategory: 'INSURANCE',
        defaultApplicationLevel: 'PO_HEADER',
        permittedApplicationLevels: ['PR_HEADER', 'PO_HEADER', 'SHIPMENT', 'INVOICE_LEVEL'],
        defaultCalculationMethod: 'PERCENTAGE',
        defaultRate: 0.25,
        defaultCurrency: 'INR',
        defaultTaxTreatment: 'DOMESTIC_GST_TAXABLE',
        taxRatePercent: 18,
        defaultAllocationBasis: 'PROPORTIONAL_VALUE',
        chargeBearer: 'BUYER',
        minimumCharge: 250,
        effectiveFrom: '2025-04-01',
        isActive: true,
        versionNumber: 1,
        createdBy: 'System Governance',
        modifiedBy: 'System Governance',
        modifiedDate: now,
      },
    ];

    this.mappings = [
      {
        id: 'cmap-co-kosh-01-all-cm-load',
        versionNumber: 1,
        companyId: 'co-kosh-01',
        branchId: 'ALL',
        chargeMasterId: 'cm-load',
        chargeCode: 'CHG-LOAD',
        isEnabled: true,
        applicability: 'OPTIONAL',
        defaultCalculationMethod: 'FIXED_AMOUNT',
        fixedTariffOrRate: 1500,
        currency: 'INR',
        taxTreatment: 'DOMESTIC_GST_TAXABLE',
        taxRatePercent: 18,
        allocationBasis: 'PROPORTIONAL_QUANTITY',
        effectiveFrom: '2025-04-01',
        allowBranchOverride: true,
        centrallyControlledFields: ['taxTreatment', 'allocationBasis'],
        requiresApproval: false,
        isBranchOverride: false,
        updatedBy: 'System Governance',
        updatedAt: now,
      },
      {
        id: 'cmap-co-kosh-01-all-cm-freight',
        versionNumber: 1,
        companyId: 'co-kosh-01',
        branchId: 'ALL',
        chargeMasterId: 'cm-freight',
        chargeCode: 'CHG-FREIGHT',
        isEnabled: true,
        applicability: 'MANDATORY',
        defaultCalculationMethod: 'FIXED_AMOUNT',
        fixedTariffOrRate: 4500,
        currency: 'INR',
        taxTreatment: 'DOMESTIC_GST_RCM',
        taxRatePercent: 5,
        allocationBasis: 'PROPORTIONAL_VALUE',
        effectiveFrom: '2025-04-01',
        allowBranchOverride: true,
        centrallyControlledFields: ['taxTreatment', 'allocationBasis'],
        requiresApproval: false,
        isBranchOverride: false,
        updatedBy: 'System Governance',
        updatedAt: now,
      },
      {
        id: 'cmap-co-kosh-01-all-cm-insurance',
        versionNumber: 1,
        companyId: 'co-kosh-01',
        branchId: 'ALL',
        chargeMasterId: 'cm-insurance',
        chargeCode: 'CHG-INSURANCE',
        isEnabled: true,
        applicability: 'CONDITIONAL',
        defaultCalculationMethod: 'PERCENTAGE',
        fixedTariffOrRate: 0.25,
        currency: 'INR',
        taxTreatment: 'DOMESTIC_GST_TAXABLE',
        taxRatePercent: 18,
        allocationBasis: 'PROPORTIONAL_VALUE',
        effectiveFrom: '2025-04-01',
        allowBranchOverride: false,
        centrallyControlledFields: ['isEnabled', 'applicability', 'fixedTariffOrRate', 'taxTreatment'],
        requiresApproval: true,
        isBranchOverride: false,
        updatedBy: 'System Governance',
        updatedAt: now,
      },
      {
        id: 'cmap-co-kosh-01-all-cm-customs',
        versionNumber: 1,
        companyId: 'co-kosh-01',
        branchId: 'ALL',
        chargeMasterId: 'cm-customs-duty',
        chargeCode: 'CHG-CUSTOMS',
        isEnabled: true,
        applicability: 'CONDITIONAL',
        defaultCalculationMethod: 'PERCENTAGE',
        fixedTariffOrRate: 10,
        currency: 'INR',
        taxTreatment: 'IMPORT_CUSTOMS_BCD_SWS',
        taxRatePercent: 10,
        allocationBasis: 'PROPORTIONAL_VALUE',
        effectiveFrom: '2025-04-01',
        allowBranchOverride: true,
        centrallyControlledFields: ['taxTreatment', 'defaultCalculationMethod'],
        requiresApproval: true,
        isBranchOverride: false,
        updatedBy: 'System Governance',
        updatedAt: now,
      },
    ];
  }

  listChargeMasters(includeInactive = true): BackendChargeMaster[] {
    return includeInactive ? [...this.masters] : this.masters.filter((m) => m.isActive);
  }

  createChargeMaster(
    payload: Partial<BackendChargeMaster>,
    actorName = 'System Admin',
    actorRole?: string
  ): BackendChargeMaster {
    assertAdminRole(actorRole);
    const code = String(payload.chargeCode || '').trim().toUpperCase();
    const name = String(payload.chargeName || '').trim();
    if (!code) throw new ChargeEngineHttpError(400, 'INVALID_INPUT', 'chargeCode is mandatory.');
    if (!name) throw new ChargeEngineHttpError(400, 'INVALID_INPUT', 'chargeName is mandatory.');

    if (this.masters.some((m) => m.isActive && m.chargeCode.toUpperCase() === code)) {
      throw new ChargeEngineHttpError(409, 'DUPLICATE_ACTIVE_CHARGE_CODE', `Duplicate active charge code "${code}" is not allowed.`);
    }

    if (payload.defaultCalculationMethod === 'FORMULA_BASED') {
      evaluateSafeFormula(payload.defaultFormulaExpression || 'rate', {
        materialValue: 1000,
        quantity: 1,
        weightKg: 100,
        weightMt: 0.1,
        volumeCbm: 1,
        distanceKm: 10,
        rate: Number(payload.defaultRate || 0),
      });
    }

    const now = new Date().toISOString();
    const record: BackendChargeMaster = {
      id: `cm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      chargeCode: code,
      chargeName: name,
      chargeDescription: String(payload.chargeDescription || name),
      chargeCategory: String(payload.chargeCategory || 'OTHER'),
      defaultApplicationLevel: payload.defaultApplicationLevel || 'PR_HEADER',
      permittedApplicationLevels:
        payload.permittedApplicationLevels && payload.permittedApplicationLevels.length > 0
          ? payload.permittedApplicationLevels
          : ['PR_HEADER', 'PR_LINE', 'PO_HEADER'],
      defaultCalculationMethod: payload.defaultCalculationMethod || 'FIXED_AMOUNT',
      defaultRate: Number(payload.defaultRate ?? 0),
      defaultFormulaExpression: payload.defaultFormulaExpression,
      defaultCurrency: String(payload.defaultCurrency || 'INR').toUpperCase(),
      defaultTaxTreatment: String(payload.defaultTaxTreatment || 'DOMESTIC_GST_TAXABLE'),
      taxRatePercent: Number(payload.taxRatePercent ?? 18),
      defaultAllocationBasis: payload.defaultAllocationBasis || 'PROPORTIONAL_VALUE',
      chargeBearer: String(payload.chargeBearer || 'BUYER'),
      minimumCharge: payload.minimumCharge,
      maximumCharge: payload.maximumCharge,
      effectiveFrom: payload.effectiveFrom || now.slice(0, 10),
      effectiveTo: payload.effectiveTo,
      isActive: payload.isActive ?? true,
      versionNumber: 1,
      createdBy: actorName,
      modifiedBy: actorName,
      modifiedDate: now,
    };
    this.masters.unshift(record);
    return record;
  }

  updateChargeMaster(
    id: string,
    updates: Partial<BackendChargeMaster>,
    actorName = 'System Admin',
    actorRole?: string
  ): BackendChargeMaster {
    assertAdminRole(actorRole);
    const idx = this.masters.findIndex((m) => m.id === id);
    if (idx === -1) throw new ChargeEngineHttpError(404, 'CHARGE_MASTER_NOT_FOUND', `Charge Master "${id}" not found.`);
    const current = this.masters[idx];
    const nextCode = (updates.chargeCode || current.chargeCode).trim().toUpperCase();
    const willBeActive = updates.isActive ?? current.isActive;

    if (willBeActive && this.masters.some((m, i) => i !== idx && m.isActive && m.chargeCode.toUpperCase() === nextCode)) {
      throw new ChargeEngineHttpError(409, 'DUPLICATE_ACTIVE_CHARGE_CODE', `Duplicate active charge code "${nextCode}" is not allowed.`);
    }

    const updated: BackendChargeMaster = {
      ...current,
      ...updates,
      chargeCode: nextCode,
      versionNumber: current.versionNumber + 1,
      modifiedBy: actorName,
      modifiedDate: new Date().toISOString(),
    };
    this.masters[idx] = updated;
    return updated;
  }

  listMappings(companyId?: string, branchId?: string): {
    mappings: BackendChargeMapping[];
    history: BackendChargeMappingHistory[];
  } {
    const mappings = this.mappings.filter(
      (m) => (!companyId || m.companyId === companyId) && (!branchId || m.branchId === branchId)
    );
    const history = this.mappingHistory.filter((h) => !companyId || h.companyId === companyId);
    return { mappings, history };
  }

  saveCompanyMapping(
    payload: Partial<BackendChargeMapping> & { companyId: string; chargeMasterId: string },
    actorName = 'System Admin',
    actorRole?: string
  ): BackendChargeMapping {
    assertAdminRole(actorRole);
    const master = this.masters.find((m) => m.id === payload.chargeMasterId || m.chargeCode === payload.chargeMasterId);
    if (!master) throw new ChargeEngineHttpError(404, 'CHARGE_MASTER_NOT_FOUND', 'Charge Master record not found.');

    const idx = this.mappings.findIndex(
      (m) => m.companyId === payload.companyId && m.branchId === 'ALL' && m.chargeMasterId === master.id
    );
    const prev = idx >= 0 ? this.mappings[idx] : undefined;
    const now = new Date().toISOString();

    const record: BackendChargeMapping = {
      id: prev?.id || `cmap-${payload.companyId}-all-${master.id}`,
      versionNumber: (prev?.versionNumber || 0) + 1,
      companyId: payload.companyId,
      branchId: 'ALL',
      chargeMasterId: master.id,
      chargeCode: master.chargeCode,
      isEnabled: payload.isEnabled ?? prev?.isEnabled ?? true,
      applicability: payload.applicability || prev?.applicability || 'OPTIONAL',
      defaultCalculationMethod:
        payload.defaultCalculationMethod || prev?.defaultCalculationMethod || master.defaultCalculationMethod,
      fixedTariffOrRate:
        payload.fixedTariffOrRate !== undefined
          ? Number(payload.fixedTariffOrRate)
          : prev?.fixedTariffOrRate ?? master.defaultRate,
      formulaExpression: payload.formulaExpression ?? prev?.formulaExpression ?? master.defaultFormulaExpression,
      currency: String(payload.currency || prev?.currency || master.defaultCurrency).toUpperCase(),
      taxTreatment: payload.taxTreatment || prev?.taxTreatment || master.defaultTaxTreatment,
      taxRatePercent:
        payload.taxRatePercent !== undefined
          ? Number(payload.taxRatePercent)
          : prev?.taxRatePercent ?? master.taxRatePercent,
      allocationBasis: payload.allocationBasis || prev?.allocationBasis || master.defaultAllocationBasis,
      effectiveFrom: payload.effectiveFrom || prev?.effectiveFrom || master.effectiveFrom,
      effectiveTo: payload.effectiveTo ?? prev?.effectiveTo,
      allowBranchOverride: payload.allowBranchOverride ?? prev?.allowBranchOverride ?? true,
      centrallyControlledFields: payload.centrallyControlledFields ?? prev?.centrallyControlledFields ?? [],
      requiresApproval: payload.requiresApproval ?? prev?.requiresApproval ?? false,
      isBranchOverride: false,
      updatedBy: actorName,
      updatedAt: now,
    };

    if (idx >= 0) this.mappings[idx] = record;
    else this.mappings.unshift(record);

    this.mappingHistory.unshift({
      id: `cmaph-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      mappingId: record.id,
      versionNumber: record.versionNumber,
      companyId: record.companyId,
      branchId: 'ALL',
      chargeMasterId: record.chargeMasterId,
      chargeCode: record.chargeCode,
      action: prev ? 'UPDATED' : 'CREATED',
      changedBy: actorName,
      changedAt: now,
      previousSnapshot: prev,
      newSnapshot: record,
    });
    return record;
  }

  saveBranchOverride(
    payload: Partial<BackendChargeMapping> & { companyId: string; branchId: string; chargeMasterId: string },
    actorName = 'System Admin',
    actorRole?: string
  ): BackendChargeMapping {
    assertAdminRole(actorRole);
    if (!payload.branchId || payload.branchId === 'ALL') {
      return this.saveCompanyMapping(payload, actorName, actorRole);
    }

    const master = this.masters.find((m) => m.id === payload.chargeMasterId || m.chargeCode === payload.chargeMasterId);
    if (!master) throw new ChargeEngineHttpError(404, 'CHARGE_MASTER_NOT_FOUND', 'Charge Master record not found.');

    const companyMapping = this.mappings.find(
      (m) => m.companyId === payload.companyId && m.branchId === 'ALL' && m.chargeMasterId === master.id
    );

    if (companyMapping && !companyMapping.allowBranchOverride) {
      throw new ChargeEngineHttpError(
        403,
        'UNAUTHORIZED_BRANCH_OVERRIDE',
        `Company policy prohibits branch overrides for "${master.chargeCode}".`
      );
    }

    if (companyMapping) {
      for (const field of companyMapping.centrallyControlledFields) {
        const val = (payload as Record<string, unknown>)[field];
        const compVal = (companyMapping as unknown as Record<string, unknown>)[field];
        if (val !== undefined && val !== compVal) {
          throw new ChargeEngineHttpError(
            403,
            'CENTRALLY_CONTROLLED_FIELD_LOCKED',
            `Field "${field}" is centrally controlled by Company policy and cannot be overridden by branch.`
          );
        }
      }
    }

    const idx = this.mappings.findIndex(
      (m) =>
        m.companyId === payload.companyId &&
        m.branchId === payload.branchId &&
        m.chargeMasterId === master.id
    );
    const prev = idx >= 0 ? this.mappings[idx] : undefined;
    const now = new Date().toISOString();
    const base = prev || companyMapping;

    const record: BackendChargeMapping = {
      id: prev?.id || `cmap-${payload.companyId}-${payload.branchId}-${master.id}`,
      versionNumber: (prev?.versionNumber || 0) + 1,
      companyId: payload.companyId,
      branchId: payload.branchId,
      chargeMasterId: master.id,
      chargeCode: master.chargeCode,
      isEnabled: payload.isEnabled ?? base?.isEnabled ?? true,
      applicability: payload.applicability || base?.applicability || 'OPTIONAL',
      defaultCalculationMethod:
        payload.defaultCalculationMethod || base?.defaultCalculationMethod || master.defaultCalculationMethod,
      fixedTariffOrRate:
        payload.fixedTariffOrRate !== undefined
          ? Number(payload.fixedTariffOrRate)
          : base?.fixedTariffOrRate ?? master.defaultRate,
      formulaExpression: payload.formulaExpression ?? base?.formulaExpression ?? master.defaultFormulaExpression,
      currency: String(payload.currency || base?.currency || master.defaultCurrency).toUpperCase(),
      taxTreatment: payload.taxTreatment || base?.taxTreatment || master.defaultTaxTreatment,
      taxRatePercent:
        payload.taxRatePercent !== undefined
          ? Number(payload.taxRatePercent)
          : base?.taxRatePercent ?? master.taxRatePercent,
      allocationBasis: payload.allocationBasis || base?.allocationBasis || master.defaultAllocationBasis,
      effectiveFrom: payload.effectiveFrom || base?.effectiveFrom || master.effectiveFrom,
      effectiveTo: payload.effectiveTo ?? base?.effectiveTo,
      allowBranchOverride: companyMapping?.allowBranchOverride ?? true,
      centrallyControlledFields: companyMapping?.centrallyControlledFields ?? [],
      requiresApproval: payload.requiresApproval ?? base?.requiresApproval ?? false,
      isBranchOverride: true,
      updatedBy: actorName,
      updatedAt: now,
    };

    if (idx >= 0) this.mappings[idx] = record;
    else this.mappings.unshift(record);

    this.mappingHistory.unshift({
      id: `cmaph-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      mappingId: record.id,
      versionNumber: record.versionNumber,
      companyId: record.companyId,
      branchId: record.branchId,
      chargeMasterId: record.chargeMasterId,
      chargeCode: record.chargeCode,
      action: prev ? 'BRANCH_OVERRIDE_UPDATED' : 'BRANCH_OVERRIDE_CREATED',
      changedBy: actorName,
      changedAt: now,
      previousSnapshot: prev || companyMapping,
      newSnapshot: record,
    });
    return record;
  }

  revertBranchOverride(companyId: string, branchId: string, chargeMasterId: string): boolean {
    const before = this.mappings.length;
    this.mappings = this.mappings.filter(
      (m) => !(m.companyId === companyId && m.branchId === branchId && m.chargeMasterId === chargeMasterId)
    );
    return this.mappings.length < before;
  }

  resolveEffectiveMappings(companyId: string, branchId = 'ALL', asOfDate?: string) {
    const refDate = (asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
    return this.masters.map((master) => {
      const companyMap = this.mappings.find(
        (m) => m.companyId === companyId && m.branchId === 'ALL' && m.chargeMasterId === master.id
      );
      const branchMap =
        branchId !== 'ALL'
          ? this.mappings.find(
              (m) => m.companyId === companyId && m.branchId === branchId && m.chargeMasterId === master.id
            )
          : undefined;
      const useBranch = Boolean(branchMap && (!companyMap || companyMap.allowBranchOverride));
      const winning = useBranch ? branchMap! : companyMap;
      const effFrom = winning?.effectiveFrom || master.effectiveFrom;
      const effTo = winning?.effectiveTo ?? master.effectiveTo;
      const isDateEffective =
        (!master.effectiveFrom || refDate >= master.effectiveFrom) &&
        (!master.effectiveTo || refDate <= master.effectiveTo) &&
        (!effFrom || refDate >= effFrom) &&
        (!effTo || refDate <= effTo);

      return {
        chargeMasterId: master.id,
        chargeMasterVersion: master.versionNumber,
        chargeCode: master.chargeCode,
        chargeName: master.chargeName,
        chargeDescription: master.chargeDescription,
        chargeCategory: master.chargeCategory,
        defaultApplicationLevel: master.defaultApplicationLevel,
        permittedApplicationLevels: master.permittedApplicationLevels,
        mappingId: winning?.id || `default-${companyId}-${branchId}-${master.id}`,
        mappingVersion: winning?.versionNumber || 1,
        companyId,
        branchId,
        sourceScope: useBranch ? 'BRANCH_OVERRIDE' : companyMap ? 'COMPANY_INHERITED' : 'MASTER_DEFAULT',
        isActiveInMaster: master.isActive,
        isEnabled: winning?.isEnabled ?? master.isActive,
        isEffectiveNow: master.isActive && (winning?.isEnabled ?? true) && isDateEffective,
        applicability: winning?.applicability || 'OPTIONAL',
        calculationMethod: winning?.defaultCalculationMethod || master.defaultCalculationMethod,
        rate: winning?.fixedTariffOrRate ?? master.defaultRate,
        formulaExpression: winning?.formulaExpression ?? master.defaultFormulaExpression,
        currency: winning?.currency || master.defaultCurrency,
        taxTreatment: winning?.taxTreatment || master.defaultTaxTreatment,
        taxRatePercent: winning?.taxRatePercent ?? master.taxRatePercent,
        allocationBasis: winning?.allocationBasis || master.defaultAllocationBasis,
        allowBranchOverride: companyMap?.allowBranchOverride ?? true,
        centrallyControlledFields: companyMap?.centrallyControlledFields ?? [],
        requiresApproval: winning?.requiresApproval ?? false,
      };
    });
  }

  calculateRawCharge(params: {
    method: BackendCalculationMethod;
    rate: number;
    formulaExpression?: string;
    materialValue: number;
    quantity?: number;
    weightKg?: number;
    volumeCbm?: number;
    distanceKm?: number;
    shipmentsCount?: number;
    tripsCount?: number;
    daysCount?: number;
    actualInvoiceAmount?: number;
    minimumCharge?: number;
    maximumCharge?: number;
    taxRatePercent?: number;
    taxTreatment?: string;
    sourceCurrency?: string;
    targetCurrency?: string;
  }) {
    const rate = Number(params.rate) || 0;
    if (rate < 0) throw new ChargeEngineHttpError(400, 'INVALID_RATE', 'Rate cannot be negative.');
    const qty = Number(params.quantity ?? 1);
    const weightKg = Number(params.weightKg ?? 0);
    let raw = rate;

    switch (params.method) {
      case 'FIXED_AMOUNT':
        raw = rate;
        break;
      case 'PERCENTAGE':
        raw = (Number(params.materialValue || 0) * rate) / 100;
        break;
      case 'PER_UNIT':
        raw = rate * qty;
        break;
      case 'PER_KG':
        raw = rate * weightKg;
        break;
      case 'PER_MT':
        raw = rate * (weightKg / 1000);
        break;
      case 'PER_VOLUME':
        raw = rate * Number(params.volumeCbm ?? 0);
        break;
      case 'PER_KM':
        raw = rate * Number(params.distanceKm ?? 0);
        break;
      case 'PER_SHIPMENT':
        raw = rate * Number(params.shipmentsCount ?? 1);
        break;
      case 'PER_TRIP':
        raw = rate * Number(params.tripsCount ?? 1);
        break;
      case 'PER_DAY':
        raw = rate * Number(params.daysCount ?? 1);
        break;
      case 'ACTUAL_COST':
        raw = Number(params.actualInvoiceAmount ?? rate);
        break;
      case 'FORMULA_BASED':
        raw = evaluateSafeFormula(params.formulaExpression || 'rate', {
          materialValue: Number(params.materialValue || 0),
          quantity: qty,
          weightKg,
          weightMt: weightKg / 1000,
          volumeCbm: Number(params.volumeCbm ?? 0),
          distanceKm: Number(params.distanceKm ?? 0),
          shipments: Number(params.shipmentsCount ?? 1),
          trips: Number(params.tripsCount ?? 1),
          days: Number(params.daysCount ?? 1),
          rate,
        });
        break;
    }

    if (params.minimumCharge !== undefined && params.minimumCharge > 0 && raw > 0) {
      raw = Math.max(params.minimumCharge, raw);
    }
    if (params.maximumCharge !== undefined && params.maximumCharge > 0) {
      raw = Math.min(params.maximumCharge, raw);
    }

    const fx = getFxRate(params.sourceCurrency || 'INR', params.targetCurrency || 'INR');
    const baseAmount = params.method === 'PERCENTAGE' ? roundHalfUp(raw, 2) : roundHalfUp(raw * fx, 2);
    const taxRate = Number(params.taxRatePercent ?? 0);
    const isBcdSws = params.taxTreatment === 'IMPORT_CUSTOMS_BCD_SWS';
    const taxAmount = isBcdSws ? roundHalfUp((baseAmount * 10) / 100, 2) : roundHalfUp((baseAmount * taxRate) / 100, 2);
    const totalWithTax = roundHalfUp(baseAmount + taxAmount, 2);
    const recoverable =
      params.taxTreatment === 'IMPORT_CUSTOMS_BCD_SWS' || params.taxTreatment === 'EXEMPT_ZERO_RATED'
        ? 0
        : taxAmount;
    const nonRecoverable = roundHalfUp(taxAmount - recoverable, 2);

    return { baseAmount, taxAmount, totalWithTax, recoverableTax: recoverable, nonRecoverableTax: nonRecoverable };
  }

  /**
   * Backend-controlled PR Charge calculation and immutable snapshot persistence.
   * Rejects arbitrary unmapped/inactive charge items and duplicate charge selections.
   */
  calculatePrCharges(params: {
    prId?: string;
    companyId: string;
    branchId: string;
    itemsSubtotal: number;
    currency?: string;
    lockSnapshot?: boolean;
    asOfDate?: string;
    selectedCharges: Array<{
      chargeMasterId?: string;
      chargeCode?: string;
      applicability?: 'APPLICABLE' | 'AS_PER_FIXED_CHARGES' | 'NOT_APPLICABLE';
      rateOverride?: number;
      quantity?: number;
      weightKg?: number;
      volumeCbm?: number;
      distanceKm?: number;
    }>;
  }) {
    if (params.prId && this.prChargeSnapshots[params.prId]?.every((s) => Boolean(s.snapshotLockedAt))) {
      return {
        prId: params.prId,
        immutableLocked: true,
        items: this.prChargeSnapshots[params.prId],
      };
    }

    const effective = this.resolveEffectiveMappings(params.companyId, params.branchId, params.asOfDate);
    const seenCodes = new Set<string>();
    const results: Array<Record<string, unknown>> = [];
    const targetCurrency = (params.currency || 'INR').toUpperCase();
    const lockTimestamp = params.lockSnapshot ? new Date().toISOString() : undefined;

    for (const sel of params.selectedCharges || []) {
      const matched = effective.find(
        (e) =>
          (sel.chargeMasterId && e.chargeMasterId === sel.chargeMasterId) ||
          (sel.chargeCode && e.chargeCode.toUpperCase() === sel.chargeCode.toUpperCase())
      );
      if (!matched) {
        throw new ChargeEngineHttpError(
          400,
          'UNMAPPED_CHARGE_REJECTED',
          `Charge "${sel.chargeCode || sel.chargeMasterId}" does not exist in centralized Charge Master.`
        );
      }
      if (!matched.isActiveInMaster || !matched.isEnabled || !matched.isEffectiveNow || matched.applicability === 'NOT_APPLICABLE') {
        throw new ChargeEngineHttpError(
          400,
          'INACTIVE_OR_NOT_APPLICABLE_CHARGE',
          `Charge "${matched.chargeCode}" is inactive, expired, or not applicable for ${params.companyId}/${params.branchId}.`
        );
      }
      if (seenCodes.has(matched.chargeCode)) {
        throw new ChargeEngineHttpError(
          409,
          'DUPLICATE_PR_CHARGE',
          `Duplicate charge "${matched.chargeCode}" in PR charge list is prohibited.`
        );
      }
      seenCodes.add(matched.chargeCode);

      const rateToUse = sel.rateOverride !== undefined ? Number(sel.rateOverride) : matched.rate;
      const calc =
        sel.applicability === 'NOT_APPLICABLE'
          ? { baseAmount: 0, taxAmount: 0, totalWithTax: 0, recoverableTax: 0, nonRecoverableTax: 0 }
          : this.calculateRawCharge({
              method: matched.calculationMethod,
              rate: rateToUse,
              formulaExpression: matched.formulaExpression,
              materialValue: params.itemsSubtotal,
              quantity: sel.quantity ?? 1,
              weightKg: sel.weightKg,
              volumeCbm: sel.volumeCbm,
              distanceKm: sel.distanceKm,
              taxRatePercent: matched.taxRatePercent,
              taxTreatment: matched.taxTreatment,
              sourceCurrency: matched.currency,
              targetCurrency,
            });

      results.push({
        chargeMasterId: matched.chargeMasterId,
        chargeMasterVersion: matched.chargeMasterVersion,
        chargeCode: matched.chargeCode,
        chargeName: matched.chargeName,
        mappingId: matched.mappingId,
        mappingVersion: matched.mappingVersion,
        sourceScope: matched.sourceScope,
        calculationMethod: matched.calculationMethod,
        allocationBasis: matched.allocationBasis,
        rate: rateToUse,
        currency: targetCurrency,
        taxTreatment: matched.taxTreatment,
        gstRatePercent: matched.taxRatePercent,
        estimatedAmount: calc.baseAmount,
        taxAmount: calc.taxAmount,
        totalWithTax: calc.totalWithTax,
        recoverableTax: calc.recoverableTax,
        nonRecoverableTax: calc.nonRecoverableTax,
        calculatedByBackend: true,
        snapshotLockedAt: lockTimestamp,
      });
    }

    if (params.prId && lockTimestamp) {
      this.prChargeSnapshots[params.prId] = results;
    }

    const totalChargesBase = roundHalfUp(
      results.reduce((s, r) => s + Number(r.estimatedAmount || 0), 0),
      2
    );
    const totalChargesTax = roundHalfUp(
      results.reduce((s, r) => s + Number(r.taxAmount || 0), 0),
      2
    );

    return {
      prId: params.prId || null,
      immutableLocked: Boolean(lockTimestamp),
      itemsSubtotal: params.itemsSubtotal,
      applicableChargesBaseTotal: totalChargesBase,
      applicableChargesTaxTotal: totalChargesTax,
      grandTotalWithCharges: roundHalfUp(params.itemsSubtotal + totalChargesBase, 2),
      items: results,
    };
  }

  allocateCharge(params: {
    chargeAmount: number;
    method: BackendAllocationMethod;
    lines: Array<{ lineId: string; itemCode: string; materialValue: number; quantity: number; weightKg?: number; volumeCbm?: number }>;
  }) {
    const weights = params.lines.map((l) => {
      switch (params.method) {
        case 'EQUAL_DISTRIBUTION':
          return 1;
        case 'PROPORTIONAL_QUANTITY':
          return Math.max(0, l.quantity);
        case 'PROPORTIONAL_WEIGHT':
          return Math.max(0, l.weightKg ?? l.quantity);
        case 'PROPORTIONAL_VOLUME':
          return Math.max(0, l.volumeCbm ?? l.quantity);
        case 'PROPORTIONAL_VALUE':
        default:
          return Math.max(0, l.materialValue);
      }
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
    const targetCents = Math.round(params.chargeAmount * 100);
    const exact = weights.map((w) => (targetCents * w) / totalWeight);
    const floored = exact.map((e) => Math.floor(e));
    let rem = targetCents - floored.reduce((a, b) => a + b, 0);
    const order = exact.map((e, i) => ({ i, frac: e - floored[i] })).sort((a, b) => b.frac - a.frac || a.i - b.i);
    let p = 0;
    while (rem > 0 && order.length > 0) {
      floored[order[p % order.length].i] += 1;
      rem -= 1;
      p += 1;
    }
    return {
      originalChargeAmount: params.chargeAmount,
      allocatedTotal: roundHalfUp(floored.reduce((a, b) => a + b, 0) / 100, 2),
      lines: params.lines.map((l, idx) => ({
        lineId: l.lineId,
        itemCode: l.itemCode,
        allocatedChargeAmount: floored[idx] / 100,
      })),
    };
  }
}

export const defaultChargeEngineBackend = new ChargeEngineBackendStore();
