/**
 * KOSH INNOVATIONS — COMPANY & BRANCH CHARGE ITEM MAPPING SERVICE
 * Manages Company-level authoritative charge mappings and controlled Branch overrides
 * referencing centralized Charge Master records (never duplicating Charge Master rows).
 * Enforces centrally controlled field locks, inheritance, effective date filtering,
 * RBAC protection, immutable mapping version history, and historical PR isolation.
 */

import { INITIAL_BRANCHES, INITIAL_COMPANIES } from '../data/seedData';
import { User } from '../types';
import {
  CentrallyControlledChargeField,
  ChargeApplicabilityStatus,
  ChargeAllocationMethod,
  ChargeCalculationBasis,
  ChargeCalculationMethod,
  ChargeMasterRecord,
  CompanyBranchChargeMapping,
  CompanyBranchChargeMappingHistory,
  EffectiveMappedChargeOption,
  TaxTreatmentType,
} from '../types/chargeManagement';
import { chargeMasterService } from './chargeMasterService';
import { EnterpriseAuditService } from './enterpriseAuditService';
import { normalizeBranchId, normalizeCompanyId } from './prGovernancePolicyService';
import { rbacPermissionService } from './rbacPermissionService';

const STORAGE_KEY_MAPPINGS = 'kosh_company_branch_charge_mappings_v1';
const STORAGE_KEY_MAPPING_HISTORY = 'kosh_company_branch_charge_mapping_history_v1';

let memMappings: CompanyBranchChargeMapping[] | null = null;
let memMappingHistory: CompanyBranchChargeMappingHistory[] | null = null;

function assertAdminGovernanceActor(actor: { id: string; name: string; user?: User }, actionLabel: string): void {
  if (!actor.user) return;
  if (actor.user.role === 'PLATFORM_ADMIN' || actor.user.role === 'ORG_ADMIN') return;
  if (!rbacPermissionService.hasPermission(actor.user, 'CHARGE_MASTER_MANAGE')) {
    throw new Error(
      `Authorization Denied: User "${actor.user.fullName}" (${actor.user.role}) is not authorized to ${actionLabel}.`
    );
  }
}

function getCompanyMeta(companyId: string): { id: string; code: string; name: string } {
  const norm = normalizeCompanyId(companyId);
  const found = INITIAL_COMPANIES.find((c) => c.id === norm || c.code === companyId);
  if (found) return { id: found.id, code: found.code, name: found.name };
  return { id: norm, code: norm.toUpperCase(), name: norm };
}

function getBranchMeta(branchId: string): { id: string; code: string; name: string } {
  const norm = normalizeBranchId(branchId);
  if (norm === 'ALL') {
    return { id: 'ALL', code: 'ALL', name: 'All Branches (Company Default)' };
  }
  const found = INITIAL_BRANCHES.find((b) => b.id === norm || b.portalBranchCode === branchId || b.code === branchId);
  if (found) return { id: found.id, code: found.portalBranchCode || found.code, name: found.name };
  return { id: norm, code: norm.toUpperCase(), name: norm };
}

function isEffectiveOnDate(effectiveFrom?: string, effectiveTo?: string, asOfDate?: string): boolean {
  const refDate = (asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  if (effectiveFrom && refDate < effectiveFrom.slice(0, 10)) return false;
  if (effectiveTo && refDate > effectiveTo.slice(0, 10)) return false;
  return true;
}

const DEFAULT_SEEDED_CODES: Array<{
  chargeCode: string;
  applicability: ChargeApplicabilityStatus;
  allowBranchOverride: boolean;
  centrallyControlledFields: CentrallyControlledChargeField[];
  requiresApproval: boolean;
  rateOverride?: number;
}> = [
  {
    chargeCode: 'CHG-LOAD',
    applicability: 'OPTIONAL',
    allowBranchOverride: true,
    centrallyControlledFields: ['taxTreatment', 'allocationBasis'],
    requiresApproval: false,
  },
  {
    chargeCode: 'CHG-UNLOAD',
    applicability: 'OPTIONAL',
    allowBranchOverride: true,
    centrallyControlledFields: ['taxTreatment'],
    requiresApproval: false,
  },
  {
    chargeCode: 'CHG-FREIGHT',
    applicability: 'MANDATORY',
    allowBranchOverride: true,
    centrallyControlledFields: ['taxTreatment', 'allocationBasis'],
    requiresApproval: false,
  },
  {
    chargeCode: 'CHG-PACKAGING',
    applicability: 'OPTIONAL',
    allowBranchOverride: true,
    centrallyControlledFields: ['taxTreatment'],
    requiresApproval: false,
  },
  {
    chargeCode: 'CHG-INSURANCE',
    applicability: 'CONDITIONAL',
    allowBranchOverride: false,
    centrallyControlledFields: ['isEnabled', 'applicability', 'fixedTariffOrRate', 'taxTreatment'],
    requiresApproval: true,
  },
  {
    chargeCode: 'CHG-INSPECTION',
    applicability: 'OPTIONAL',
    allowBranchOverride: true,
    centrallyControlledFields: ['taxTreatment'],
    requiresApproval: false,
  },
  {
    chargeCode: 'CHG-CUSTOMS',
    applicability: 'CONDITIONAL',
    allowBranchOverride: true,
    centrallyControlledFields: ['taxTreatment', 'defaultCalculationMethod'],
    requiresApproval: true,
  },
  {
    chargeCode: 'CHG-CHA',
    applicability: 'CONDITIONAL',
    allowBranchOverride: true,
    centrallyControlledFields: ['taxTreatment'],
    requiresApproval: false,
  },
  {
    chargeCode: 'CHG-HANDLING',
    applicability: 'OPTIONAL',
    allowBranchOverride: true,
    centrallyControlledFields: [],
    requiresApproval: false,
  },
  {
    chargeCode: 'CHG-INSTALLATION',
    applicability: 'OPTIONAL',
    allowBranchOverride: true,
    centrallyControlledFields: [],
    requiresApproval: true,
  },
  {
    chargeCode: 'CHG-TRIP',
    applicability: 'OPTIONAL',
    allowBranchOverride: true,
    centrallyControlledFields: ['taxTreatment'],
    requiresApproval: false,
  },
];

function createInitialMappings(): CompanyBranchChargeMapping[] {
  const masters = chargeMasterService.getCharges(true);
  const taxMappings = chargeMasterService.getTaxMappings();
  const activeCompanies = INITIAL_COMPANIES.filter((c) => c.isEnabled);
  const seeded: CompanyBranchChargeMapping[] = [];

  for (const co of activeCompanies) {
    for (const def of DEFAULT_SEEDED_CODES) {
      const master = masters.find((m) => m.chargeCode === def.chargeCode);
      if (!master) continue;
      const tax = taxMappings.find((t) => t.id === master.defaultTaxMappingId) || taxMappings[0];
      const coRate =
        co.id === 'co-kosh-02' && master.chargeCode === 'CHG-FREIGHT'
          ? 4800
          : def.rateOverride ?? master.defaultRate;

      seeded.push({
        id: `cmap-${co.id}-all-${master.id}`,
        versionNumber: 1,
        companyId: co.id,
        companyCode: co.code,
        companyName: co.name,
        branchId: 'ALL',
        branchCode: 'ALL',
        branchName: 'All Branches (Company Default)',
        chargeMasterId: master.id,
        chargeCode: master.chargeCode,
        isEnabled: master.isActive,
        applicability: def.applicability,
        defaultCalculationMethod: master.defaultCalculationMethod,
        calculationBasis: master.defaultCalculationBasis,
        fixedTariffOrRate: coRate,
        formulaExpression: master.defaultFormulaExpression,
        currency: master.defaultCurrency,
        taxMappingId: master.defaultTaxMappingId,
        taxTreatment: master.defaultTaxTreatment,
        taxRatePercent: tax?.ratePercent ?? 18,
        allocationBasis: master.defaultAllocationBasis,
        effectiveFrom: master.effectiveFrom || '2025-04-01',
        effectiveTo: master.effectiveTo,
        allowBranchOverride: def.allowBranchOverride,
        centrallyControlledFields: def.centrallyControlledFields,
        requiresApproval: def.requiresApproval,
        isBranchOverride: false,
        applicablePrTypes: master.applicablePrTypes || ['MANUAL', 'MRP', 'REPAIR', 'MAINTENANCE', 'CAPEX_ASSET'],
        sapExpenseCode: master.sapExpenseCode,
        sapExpenseName: master.sapExpenseName,
        sapGlAccountCode: master.sapGlAccountCode,
        taxCode: master.taxCode || tax?.taxCode,
        approvalStatus: 'APPROVED',
        approvedBy: 'Vikramaditya Rao (Org Admin)',
        approvedAt: '2026-04-01T00:05:00Z',
        remarks: `Company-level authoritative charge mapping for ${co.code}`,
        createdBy: 'System Governance',
        createdAt: '2026-04-01T00:00:00Z',
        updatedBy: 'System Governance',
        updatedAt: '2026-04-01T00:00:00Z',
      });
    }
  }

  // Seed one authorized branch override for Chennai Plant (co-kosh-02 / br-chen-02) on CHG-FREIGHT
  const chenFreightCompany = seeded.find(
    (m) => m.companyId === 'co-kosh-02' && m.branchId === 'ALL' && m.chargeCode === 'CHG-FREIGHT'
  );
  const chenBranch = getBranchMeta('br-chen-02');
  if (chenFreightCompany) {
    seeded.push({
      ...chenFreightCompany,
      id: `cmap-co-kosh-02-br-chen-02-${chenFreightCompany.chargeMasterId}`,
      versionNumber: 1,
      branchId: chenBranch.id,
      branchCode: chenBranch.code,
      branchName: chenBranch.name,
      fixedTariffOrRate: 5200,
      isBranchOverride: true,
      inheritedFromMappingId: chenFreightCompany.id,
      remarks: 'Chennai corridor dedicated freight tariff override',
      createdBy: 'Platform Administrator',
      createdAt: '2026-05-01T00:00:00Z',
      updatedBy: 'Platform Administrator',
      updatedAt: '2026-05-01T00:00:00Z',
    });
  }

  return seeded;
}

function readMappings(): CompanyBranchChargeMapping[] {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_MAPPINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memMappings = parsed;
          return parsed;
        }
      }
    } catch {}
  }
  if (!memMappings) {
    memMappings = createInitialMappings();
  }
  return memMappings;
}

function writeMappings(mappings: CompanyBranchChargeMapping[]): void {
  memMappings = JSON.parse(JSON.stringify(mappings));
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_MAPPINGS, JSON.stringify(mappings));
    } catch {}
  }
}

function readHistory(): CompanyBranchChargeMappingHistory[] {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_MAPPING_HISTORY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memMappingHistory = parsed;
          return parsed;
        }
      }
    } catch {}
  }
  if (!memMappingHistory) memMappingHistory = [];
  return memMappingHistory;
}

function writeHistory(history: CompanyBranchChargeMappingHistory[]): void {
  memMappingHistory = JSON.parse(JSON.stringify(history));
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_MAPPING_HISTORY, JSON.stringify(history));
    } catch {}
  }
}

export interface SaveChargeMappingPayload {
  companyId: string;
  branchId?: string;
  chargeMasterId: string;
  isEnabled: boolean;
  applicability: ChargeApplicabilityStatus;
  defaultCalculationMethod: ChargeCalculationMethod;
  calculationBasis?: ChargeCalculationBasis;
  fixedTariffOrRate: number;
  formulaExpression?: string;
  currency: string;
  taxMappingId?: string;
  taxTreatment: TaxTreatmentType;
  taxRatePercent?: number;
  allocationBasis: ChargeAllocationMethod;
  effectiveFrom: string;
  effectiveTo?: string;
  allowBranchOverride?: boolean;
  centrallyControlledFields?: CentrallyControlledChargeField[];
  requiresApproval?: boolean;
  applicablePrTypes?: Array<'MANUAL' | 'MRP' | 'REPAIR' | 'MAINTENANCE' | 'CAPEX_ASSET' | 'EXPENSE'>;
  sapExpenseCode?: string;
  sapExpenseName?: string;
  sapGlAccountCode?: string;
  taxCode?: string;
  approvalStatus?: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  remarks?: string;
}

function arraysEqualUnordered(a: string[] = [], b: string[] = []): boolean {
  if (a.length !== b.length) return false;
  const sA = [...a].sort();
  const sB = [...b].sort();
  return sA.every((v, idx) => v === sB[idx]);
}

function validateCentralFieldControl(
  companyMapping: CompanyBranchChargeMapping,
  proposed: SaveChargeMappingPayload
): void {
  if (!companyMapping.allowBranchOverride) {
    throw new Error(
      `Branch override rejected: Company policy (${companyMapping.companyCode}) prohibits branch overrides for "${companyMapping.chargeCode}".`
    );
  }

  const locked = companyMapping.centrallyControlledFields || [];
  for (const field of locked) {
    switch (field) {
      case 'isEnabled':
        if (proposed.isEnabled !== companyMapping.isEnabled) {
          throw new Error(
            `Branch override rejected: "Enabled/Disabled" is centrally controlled by ${companyMapping.companyCode} for ${companyMapping.chargeCode}.`
          );
        }
        break;
      case 'applicability':
        if (proposed.applicability !== companyMapping.applicability) {
          throw new Error(
            `Branch override rejected: "Applicability" is centrally controlled by ${companyMapping.companyCode} for ${companyMapping.chargeCode}.`
          );
        }
        break;
      case 'defaultCalculationMethod':
        if (proposed.defaultCalculationMethod !== companyMapping.defaultCalculationMethod) {
          throw new Error(
            `Branch override rejected: "Calculation Method" is centrally controlled by ${companyMapping.companyCode} for ${companyMapping.chargeCode}.`
          );
        }
        break;
      case 'fixedTariffOrRate':
        if (Number(proposed.fixedTariffOrRate) !== Number(companyMapping.fixedTariffOrRate)) {
          throw new Error(
            `Branch override rejected: "Fixed Tariff / Rate" is centrally controlled by ${companyMapping.companyCode} for ${companyMapping.chargeCode}.`
          );
        }
        break;
      case 'currency':
        if ((proposed.currency || '').toUpperCase() !== (companyMapping.currency || '').toUpperCase()) {
          throw new Error(
            `Branch override rejected: "Currency" is centrally controlled by ${companyMapping.companyCode} for ${companyMapping.chargeCode}.`
          );
        }
        break;
      case 'taxTreatment':
        if (
          proposed.taxTreatment !== companyMapping.taxTreatment ||
          (proposed.taxMappingId && proposed.taxMappingId !== companyMapping.taxMappingId)
        ) {
          throw new Error(
            `Branch override rejected: "Tax Treatment" is centrally controlled by ${companyMapping.companyCode} for ${companyMapping.chargeCode}.`
          );
        }
        break;
      case 'allocationBasis':
        if (proposed.allocationBasis !== companyMapping.allocationBasis) {
          throw new Error(
            `Branch override rejected: "Allocation Basis" is centrally controlled by ${companyMapping.companyCode} for ${companyMapping.chargeCode}.`
          );
        }
        break;
      case 'requiresApproval':
        if (
          proposed.requiresApproval !== undefined &&
          proposed.requiresApproval !== companyMapping.requiresApproval
        ) {
          throw new Error(
            `Branch override rejected: "Approval Requirement" is centrally controlled by ${companyMapping.companyCode} for ${companyMapping.chargeCode}.`
          );
        }
        break;
      case 'effectiveDates':
        if (
          (proposed.effectiveFrom || '') !== (companyMapping.effectiveFrom || '') ||
          (proposed.effectiveTo || '') !== (companyMapping.effectiveTo || '')
        ) {
          throw new Error(
            `Branch override rejected: "Effective Dates" are centrally controlled by ${companyMapping.companyCode} for ${companyMapping.chargeCode}.`
          );
        }
        break;
    }
  }
}

export const chargeMappingService = {
  resetForTesting(): void {
    memMappings = null;
    memMappingHistory = [];
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_MAPPINGS);
      localStorage.removeItem(STORAGE_KEY_MAPPING_HISTORY);
    }
  },

  getAllMappings(): CompanyBranchChargeMapping[] {
    return JSON.parse(JSON.stringify(readMappings()));
  },

  getMappingHistory(companyId?: string, chargeMasterId?: string): CompanyBranchChargeMappingHistory[] {
    const normCo = companyId ? normalizeCompanyId(companyId) : undefined;
    return readHistory().filter(
      (h) =>
        (!normCo || normalizeCompanyId(h.companyId) === normCo) &&
        (!chargeMasterId || h.chargeMasterId === chargeMasterId)
    );
  },

  getCompanyMapping(companyId: string, chargeMasterId: string): CompanyBranchChargeMapping | undefined {
    const normCo = normalizeCompanyId(companyId);
    return readMappings().find(
      (m) =>
        normalizeCompanyId(m.companyId) === normCo &&
        m.branchId === 'ALL' &&
        m.chargeMasterId === chargeMasterId
    );
  },

  getBranchOverrideMapping(
    companyId: string,
    branchId: string,
    chargeMasterId: string
  ): CompanyBranchChargeMapping | undefined {
    const normCo = normalizeCompanyId(companyId);
    const normBr = normalizeBranchId(branchId);
    if (normBr === 'ALL') return undefined;
    return readMappings().find(
      (m) =>
        normalizeCompanyId(m.companyId) === normCo &&
        normalizeBranchId(m.branchId) === normBr &&
        m.chargeMasterId === chargeMasterId
    );
  },

  saveCompanyChargeMapping(
    payload: SaveChargeMappingPayload,
    actor: { id: string; name: string; user?: User }
  ): CompanyBranchChargeMapping {
    assertAdminGovernanceActor(actor, 'configure Company Charge Item Mapping');
    const master = chargeMasterService.getChargeByIdOrCode(payload.chargeMasterId);
    if (!master) {
      throw new Error(`Charge Master "${payload.chargeMasterId}" does not exist.`);
    }
    if (Number(payload.fixedTariffOrRate) < 0) {
      throw new Error('Fixed tariff / rate cannot be negative.');
    }
    if (payload.effectiveTo && payload.effectiveFrom && payload.effectiveTo < payload.effectiveFrom) {
      throw new Error('Effective To date cannot precede Effective From date.');
    }

    const companyMeta = getCompanyMeta(payload.companyId);
    const all = readMappings();
    const existingIdx = all.findIndex(
      (m) =>
        normalizeCompanyId(m.companyId) === companyMeta.id &&
        m.branchId === 'ALL' &&
        m.chargeMasterId === master.id
    );
    const prev = existingIdx >= 0 ? all[existingIdx] : undefined;
    const now = new Date().toISOString();
    const taxMapping = chargeMasterService.getTaxMappingById(
      payload.taxMappingId || prev?.taxMappingId || master.defaultTaxMappingId
    );

    const nextRecord: CompanyBranchChargeMapping = {
      id: prev?.id || `cmap-${companyMeta.id}-all-${master.id}-${Date.now().toString(36)}`,
      versionNumber: (prev?.versionNumber || 0) + 1,
      companyId: companyMeta.id,
      companyCode: companyMeta.code,
      companyName: companyMeta.name,
      branchId: 'ALL',
      branchCode: 'ALL',
      branchName: 'All Branches (Company Default)',
      chargeMasterId: master.id,
      chargeCode: master.chargeCode,
      isEnabled: Boolean(payload.isEnabled),
      applicability: payload.applicability,
      defaultCalculationMethod: payload.defaultCalculationMethod,
      calculationBasis: payload.calculationBasis || prev?.calculationBasis || master.defaultCalculationBasis,
      fixedTariffOrRate: Number(payload.fixedTariffOrRate),
      formulaExpression: payload.formulaExpression ?? prev?.formulaExpression ?? master.defaultFormulaExpression,
      currency: (payload.currency || master.defaultCurrency || 'INR').toUpperCase(),
      taxMappingId: taxMapping.id,
      taxTreatment: payload.taxTreatment || taxMapping.treatmentType,
      taxRatePercent: payload.taxRatePercent ?? taxMapping.ratePercent ?? 18,
      allocationBasis: payload.allocationBasis,
      effectiveFrom: payload.effectiveFrom || master.effectiveFrom,
      effectiveTo: payload.effectiveTo || undefined,
      allowBranchOverride: payload.allowBranchOverride ?? prev?.allowBranchOverride ?? true,
      centrallyControlledFields:
        payload.centrallyControlledFields ?? prev?.centrallyControlledFields ?? [],
      requiresApproval: payload.requiresApproval ?? prev?.requiresApproval ?? false,
      isBranchOverride: false,
      applicablePrTypes:
        payload.applicablePrTypes ??
        prev?.applicablePrTypes ??
        master.applicablePrTypes ??
        ['MANUAL', 'MRP', 'REPAIR', 'MAINTENANCE', 'CAPEX_ASSET'],
      sapExpenseCode: payload.sapExpenseCode ?? prev?.sapExpenseCode ?? master.sapExpenseCode,
      sapExpenseName: payload.sapExpenseName ?? prev?.sapExpenseName ?? master.sapExpenseName,
      sapGlAccountCode: payload.sapGlAccountCode ?? prev?.sapGlAccountCode ?? master.sapGlAccountCode,
      taxCode: payload.taxCode ?? prev?.taxCode ?? master.taxCode ?? taxMapping.taxCode,
      approvalStatus: payload.approvalStatus ?? prev?.approvalStatus ?? 'APPROVED',
      remarks: payload.remarks ?? prev?.remarks,
      createdBy: prev?.createdBy || actor.name,
      createdAt: prev?.createdAt || now,
      updatedBy: actor.name,
      updatedAt: now,
    };

    const nextAll = [...all];
    if (existingIdx >= 0) nextAll[existingIdx] = nextRecord;
    else nextAll.unshift(nextRecord);
    writeMappings(nextAll);

    const histEntry: CompanyBranchChargeMappingHistory = {
      id: `cmaph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mappingId: nextRecord.id,
      versionNumber: nextRecord.versionNumber,
      companyId: nextRecord.companyId,
      branchId: 'ALL',
      chargeMasterId: nextRecord.chargeMasterId,
      chargeCode: nextRecord.chargeCode,
      action: prev ? 'UPDATED' : 'CREATED',
      changedById: actor.id,
      changedByName: actor.name,
      changedAt: now,
      previousSnapshot: prev,
      newSnapshot: nextRecord,
      reason: payload.remarks || `Company mapping ${prev ? 'updated' : 'created'} for ${nextRecord.chargeCode}`,
    };
    writeHistory([histEntry, ...readHistory()]);

    EnterpriseAuditService.logEvent({
      companyId: nextRecord.companyId,
      branchId: 'ALL',
      entityType: 'SYSTEM_CONFIG',
      entityId: nextRecord.id,
      eventType: 'CHARGE_COMPANY_MAPPING_SAVED',
      eventDescription: `Saved Company Charge Mapping for ${nextRecord.chargeCode} (${nextRecord.companyCode}) v${nextRecord.versionNumber}`,
      previousValue: prev,
      newValue: nextRecord,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: histEntry.reason,
    });

    return nextRecord;
  },

  saveBranchChargeOverride(
    payload: SaveChargeMappingPayload,
    actor: { id: string; name: string; user?: User }
  ): CompanyBranchChargeMapping {
    assertAdminGovernanceActor(actor, 'configure Branch Charge Item Override');
    const normBr = normalizeBranchId(payload.branchId);
    if (!payload.branchId || normBr === 'ALL') {
      return this.saveCompanyChargeMapping(payload, actor);
    }

    const master = chargeMasterService.getChargeByIdOrCode(payload.chargeMasterId);
    if (!master) {
      throw new Error(`Charge Master "${payload.chargeMasterId}" does not exist.`);
    }
    if (Number(payload.fixedTariffOrRate) < 0) {
      throw new Error('Fixed tariff / rate cannot be negative.');
    }
    if (payload.effectiveTo && payload.effectiveFrom && payload.effectiveTo < payload.effectiveFrom) {
      throw new Error('Effective To date cannot precede Effective From date.');
    }

    const companyMeta = getCompanyMeta(payload.companyId);
    const branchMeta = getBranchMeta(normBr);

    // Verify authoritative company mapping before allowing branch override
    let companyMapping = this.getCompanyMapping(companyMeta.id, master.id);
    if (!companyMapping) {
      // Auto-materialize a default company mapping from master only if none exists yet, allowing overrides
      companyMapping = {
        id: `cmap-${companyMeta.id}-all-${master.id}`,
        versionNumber: 1,
        companyId: companyMeta.id,
        companyCode: companyMeta.code,
        companyName: companyMeta.name,
        branchId: 'ALL',
        branchCode: 'ALL',
        branchName: 'All Branches (Company Default)',
        chargeMasterId: master.id,
        chargeCode: master.chargeCode,
        isEnabled: master.isActive,
        applicability: master.applicabilityRule,
        defaultCalculationMethod: master.defaultCalculationMethod,
        calculationBasis: master.defaultCalculationBasis,
        fixedTariffOrRate: master.defaultRate,
        formulaExpression: master.defaultFormulaExpression,
        currency: master.defaultCurrency,
        taxMappingId: master.defaultTaxMappingId,
        taxTreatment: master.defaultTaxTreatment,
        taxRatePercent: chargeMasterService.getTaxMappingById(master.defaultTaxMappingId)?.ratePercent ?? 18,
        allocationBasis: master.defaultAllocationBasis,
        effectiveFrom: master.effectiveFrom,
        effectiveTo: master.effectiveTo,
        allowBranchOverride: true,
        centrallyControlledFields: [],
        requiresApproval: false,
        isBranchOverride: false,
        createdBy: 'System Governance',
        createdAt: '2026-04-01T00:00:00Z',
        updatedBy: 'System Governance',
        updatedAt: '2026-04-01T00:00:00Z',
      };
    }

    // Strict central lock enforcement
    validateCentralFieldControl(companyMapping, payload);

    if (
      payload.centrallyControlledFields &&
      !arraysEqualUnordered(payload.centrallyControlledFields, companyMapping.centrallyControlledFields)
    ) {
      throw new Error('Branches cannot modify Company centrally controlled field locks.');
    }

    const all = readMappings();
    const existingIdx = all.findIndex(
      (m) =>
        normalizeCompanyId(m.companyId) === companyMeta.id &&
        normalizeBranchId(m.branchId) === branchMeta.id &&
        m.chargeMasterId === master.id
    );
    const prev = existingIdx >= 0 ? all[existingIdx] : undefined;
    const now = new Date().toISOString();
    const taxMapping = chargeMasterService.getTaxMappingById(
      payload.taxMappingId || prev?.taxMappingId || companyMapping.taxMappingId
    );

    const nextRecord: CompanyBranchChargeMapping = {
      id: prev?.id || `cmap-${companyMeta.id}-${branchMeta.id}-${master.id}-${Date.now().toString(36)}`,
      versionNumber: (prev?.versionNumber || 0) + 1,
      companyId: companyMeta.id,
      companyCode: companyMeta.code,
      companyName: companyMeta.name,
      branchId: branchMeta.id,
      branchCode: branchMeta.code,
      branchName: branchMeta.name,
      chargeMasterId: master.id,
      chargeCode: master.chargeCode,
      isEnabled: Boolean(payload.isEnabled),
      applicability: payload.applicability,
      defaultCalculationMethod: payload.defaultCalculationMethod,
      calculationBasis: payload.calculationBasis || prev?.calculationBasis || companyMapping.calculationBasis,
      fixedTariffOrRate: Number(payload.fixedTariffOrRate),
      formulaExpression: payload.formulaExpression ?? prev?.formulaExpression ?? companyMapping.formulaExpression,
      currency: (payload.currency || companyMapping.currency || 'INR').toUpperCase(),
      taxMappingId: taxMapping.id,
      taxTreatment: payload.taxTreatment || taxMapping.treatmentType,
      taxRatePercent: payload.taxRatePercent ?? taxMapping.ratePercent ?? 18,
      allocationBasis: payload.allocationBasis,
      effectiveFrom: payload.effectiveFrom || companyMapping.effectiveFrom,
      effectiveTo: payload.effectiveTo || undefined,
      allowBranchOverride: companyMapping.allowBranchOverride,
      centrallyControlledFields: companyMapping.centrallyControlledFields,
      requiresApproval: payload.requiresApproval ?? prev?.requiresApproval ?? companyMapping.requiresApproval,
      isBranchOverride: true,
      inheritedFromMappingId: companyMapping.id,
      applicablePrTypes:
        payload.applicablePrTypes ??
        prev?.applicablePrTypes ??
        companyMapping.applicablePrTypes ??
        master.applicablePrTypes ??
        ['MANUAL', 'MRP', 'REPAIR', 'MAINTENANCE', 'CAPEX_ASSET'],
      sapExpenseCode:
        payload.sapExpenseCode ?? prev?.sapExpenseCode ?? companyMapping.sapExpenseCode ?? master.sapExpenseCode,
      sapExpenseName:
        payload.sapExpenseName ?? prev?.sapExpenseName ?? companyMapping.sapExpenseName ?? master.sapExpenseName,
      sapGlAccountCode:
        payload.sapGlAccountCode ?? prev?.sapGlAccountCode ?? companyMapping.sapGlAccountCode ?? master.sapGlAccountCode,
      taxCode: payload.taxCode ?? prev?.taxCode ?? companyMapping.taxCode ?? master.taxCode ?? taxMapping.taxCode,
      approvalStatus: payload.approvalStatus ?? prev?.approvalStatus ?? 'APPROVED',
      remarks: payload.remarks ?? prev?.remarks,
      createdBy: prev?.createdBy || actor.name,
      createdAt: prev?.createdAt || now,
      updatedBy: actor.name,
      updatedAt: now,
    };

    const nextAll = [...all];
    if (existingIdx >= 0) nextAll[existingIdx] = nextRecord;
    else nextAll.unshift(nextRecord);
    writeMappings(nextAll);

    const histEntry: CompanyBranchChargeMappingHistory = {
      id: `cmaph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mappingId: nextRecord.id,
      versionNumber: nextRecord.versionNumber,
      companyId: nextRecord.companyId,
      branchId: nextRecord.branchId,
      chargeMasterId: nextRecord.chargeMasterId,
      chargeCode: nextRecord.chargeCode,
      action: prev ? 'BRANCH_OVERRIDE_UPDATED' : 'BRANCH_OVERRIDE_CREATED',
      changedById: actor.id,
      changedByName: actor.name,
      changedAt: now,
      previousSnapshot: prev || companyMapping,
      newSnapshot: nextRecord,
      reason:
        payload.remarks ||
        `Branch override ${prev ? 'updated' : 'created'} for ${branchMeta.code} / ${nextRecord.chargeCode}`,
    };
    writeHistory([histEntry, ...readHistory()]);

    EnterpriseAuditService.logEvent({
      companyId: nextRecord.companyId,
      branchId: nextRecord.branchId,
      branchName: nextRecord.branchName,
      entityType: 'SYSTEM_CONFIG',
      entityId: nextRecord.id,
      eventType: 'CHARGE_BRANCH_OVERRIDE_SAVED',
      eventDescription: `Saved Branch Override for ${nextRecord.chargeCode} on ${nextRecord.branchName} v${nextRecord.versionNumber}`,
      previousValue: prev || companyMapping,
      newValue: nextRecord,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: histEntry.reason,
    });

    return nextRecord;
  },

  revertBranchChargeOverride(
    companyId: string,
    branchId: string,
    chargeMasterId: string,
    actor: { id: string; name: string; user?: User },
    reason = 'Reverted branch override to inherit Company authoritative charge mapping'
  ): boolean {
    assertAdminGovernanceActor(actor, 'revert Branch Charge Item Override');
    const normCo = normalizeCompanyId(companyId);
    const normBr = normalizeBranchId(branchId);
    if (normBr === 'ALL') return false;

    const all = readMappings();
    const target = all.find(
      (m) =>
        normalizeCompanyId(m.companyId) === normCo &&
        normalizeBranchId(m.branchId) === normBr &&
        m.chargeMasterId === chargeMasterId
    );
    if (!target) return false;

    const next = all.filter((m) => m.id !== target.id);
    writeMappings(next);

    const now = new Date().toISOString();
    const companyMapping = this.getCompanyMapping(normCo, chargeMasterId);
    writeHistory([
      {
        id: `cmaph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        mappingId: target.id,
        versionNumber: target.versionNumber + 1,
        companyId: normCo,
        branchId: normBr,
        chargeMasterId,
        chargeCode: target.chargeCode,
        action: 'REVERTED_TO_COMPANY',
        changedById: actor.id,
        changedByName: actor.name,
        changedAt: now,
        previousSnapshot: target,
        newSnapshot: companyMapping || {},
        reason,
      },
      ...readHistory(),
    ]);

    return true;
  },

  /**
   * Resolves effective charge configuration across ALL Charge Master items for a Company & Branch.
   * Joins centralized Charge Master with Company Mapping (authoritative) + permitted Branch Override.
   * Note: When a Charge Master is inactive in master, effective option marks isActiveInMaster = false.
   */
  resolveEffectiveMappingsForScope(
    companyId: string,
    branchId: string = 'ALL',
    asOfDate?: string
  ): EffectiveMappedChargeOption[] {
    const normCo = normalizeCompanyId(companyId);
    const normBr = normalizeBranchId(branchId);
    const masters = chargeMasterService.getCharges(true);
    const taxMappings = chargeMasterService.getTaxMappings();
    const allMappings = readMappings();

    return masters
      .map((master: ChargeMasterRecord): EffectiveMappedChargeOption => {
        const companyMapping = allMappings.find(
          (m) =>
            normalizeCompanyId(m.companyId) === normCo &&
            m.branchId === 'ALL' &&
            m.chargeMasterId === master.id
        );
        const branchMapping =
          normBr !== 'ALL'
            ? allMappings.find(
                (m) =>
                  normalizeCompanyId(m.companyId) === normCo &&
                  normalizeBranchId(m.branchId) === normBr &&
                  m.chargeMasterId === master.id
              )
            : undefined;

        // If branch override exists AND company still permits overrides (or no company lock disables it)
        const useBranch = Boolean(
          branchMapping && (!companyMapping || companyMapping.allowBranchOverride !== false)
        );
        const winning = useBranch ? branchMapping! : companyMapping;
        const sourceScope: EffectiveMappedChargeOption['sourceScope'] = useBranch
          ? 'BRANCH_OVERRIDE'
          : companyMapping
          ? 'COMPANY_INHERITED'
          : 'MASTER_DEFAULT';

        // If company centrally controls a field while branch override exists, project company's central value safely
        const lockedFields = companyMapping?.centrallyControlledFields || [];
        const pickCentral = <K extends keyof CompanyBranchChargeMapping>(
          centralField: CentrallyControlledChargeField,
          prop: K,
          fallback: CompanyBranchChargeMapping[K]
        ): CompanyBranchChargeMapping[K] => {
          if (useBranch && companyMapping && lockedFields.includes(centralField)) {
            return companyMapping[prop];
          }
          return winning ? winning[prop] : fallback;
        };

        const taxId =
          (useBranch && companyMapping && lockedFields.includes('taxTreatment')
            ? companyMapping.taxMappingId
            : winning?.taxMappingId) || master.defaultTaxMappingId;
        const taxObj = taxMappings.find((t) => t.id === taxId) || taxMappings[0];

        const effectiveFrom =
          (useBranch && companyMapping && lockedFields.includes('effectiveDates')
            ? companyMapping.effectiveFrom
            : winning?.effectiveFrom) || master.effectiveFrom;
        const effectiveTo =
          useBranch && companyMapping && lockedFields.includes('effectiveDates')
            ? companyMapping.effectiveTo
            : winning?.effectiveTo ?? master.effectiveTo;

        const isMasterEffective = isEffectiveOnDate(master.effectiveFrom, master.effectiveTo, asOfDate);
        const isMappingEffective = isEffectiveOnDate(effectiveFrom, effectiveTo, asOfDate);
        const isEnabled = winning
          ? Boolean(pickCentral('isEnabled', 'isEnabled', master.isActive))
          : master.isActive;

        const isMasterApproved = !master.approvalStatus || master.approvalStatus === 'APPROVED';
        const isMappingApproved = !winning?.approvalStatus || winning.approvalStatus === 'APPROVED';
        const effectiveApprovalStatus =
          !isMasterApproved
            ? master.approvalStatus
            : !isMappingApproved
            ? winning?.approvalStatus
            : 'APPROVED';

        return {
          chargeMasterId: master.id,
          chargeMasterVersion: master.versionNumber || 1,
          chargeCode: master.chargeCode,
          chargeName: master.chargeName,
          chargeDescription: master.chargeDescription,
          chargeCategory: master.chargeCategory,
          defaultApplicationLevel: master.defaultApplicationLevel,
          permittedApplicationLevels: master.permittedApplicationLevels,
          mappingId: winning?.id || `default-${normCo}-${normBr}-${master.id}`,
          mappingVersion: winning?.versionNumber || 1,
          companyId: normCo,
          branchId: normBr,
          sourceScope,
          isEnabled,
          isActiveInMaster: master.isActive,
          isEffectiveNow:
            master.isActive &&
            isMasterApproved &&
            isMappingApproved &&
            isEnabled &&
            isMasterEffective &&
            isMappingEffective,
          isBranchOverride: useBranch,
          allowBranchOverride: companyMapping?.allowBranchOverride ?? true,
          centrallyControlledFields: lockedFields,
          applicability: pickCentral('applicability', 'applicability', master.applicabilityRule),
          calculationMethod: pickCentral(
            'defaultCalculationMethod',
            'defaultCalculationMethod',
            master.defaultCalculationMethod
          ),
          calculationBasis: winning?.calculationBasis || master.defaultCalculationBasis,
          rate: Number(pickCentral('fixedTariffOrRate', 'fixedTariffOrRate', master.defaultRate)),
          formulaExpression: winning?.formulaExpression ?? master.defaultFormulaExpression,
          currency: String(pickCentral('currency', 'currency', master.defaultCurrency) || 'INR'),
          taxMappingId: taxId,
          taxTreatment: pickCentral('taxTreatment', 'taxTreatment', master.defaultTaxTreatment),
          taxRatePercent: winning?.taxRatePercent ?? taxObj?.ratePercent ?? 18,
          allocationBasis: pickCentral('allocationBasis', 'allocationBasis', master.defaultAllocationBasis),
          chargeBearer: master.chargeBearer,
          minimumCharge: master.minimumCharge,
          maximumCharge: master.maximumCharge,
          roundingRule: master.roundingRule,
          decimalPrecision: master.decimalPrecision,
          effectiveFrom,
          effectiveTo,
          requiresApproval: Boolean(pickCentral('requiresApproval', 'requiresApproval', false)),
          applicablePrTypes:
            winning?.applicablePrTypes ||
            companyMapping?.applicablePrTypes ||
            master.applicablePrTypes ||
            ['MANUAL', 'MRP', 'REPAIR', 'MAINTENANCE', 'CAPEX_ASSET'],
          sapExpenseCode:
            winning?.sapExpenseCode || companyMapping?.sapExpenseCode || master.sapExpenseCode,
          sapExpenseName:
            winning?.sapExpenseName || companyMapping?.sapExpenseName || master.sapExpenseName,
          sapGlAccountCode:
            winning?.sapGlAccountCode || companyMapping?.sapGlAccountCode || master.sapGlAccountCode,
          taxCode:
            winning?.taxCode || companyMapping?.taxCode || master.taxCode || taxObj?.taxCode,
          approvalStatus: effectiveApprovalStatus,
          remarks: winning?.remarks,
        };
      })
      .sort((a, b) => a.chargeCode.localeCompare(b.chargeCode));
  },

  /**
   * Returns ONLY active, approved, enabled, effective, and applicable charges mapped for PR selection.
   * Inventory Charge Items are never returned for EXPENSE PRs.
   */
  getEffectivePrChargeOptions(
    companyId: string,
    branchId: string = 'ALL',
    asOfDateOrOptions?: string | { prType?: string; asOfDate?: string },
    prTypeArg?: string
  ): EffectiveMappedChargeOption[] {
    let asOfDate: string | undefined;
    let prType: string | undefined = prTypeArg;

    if (typeof asOfDateOrOptions === 'object' && asOfDateOrOptions !== null) {
      prType = asOfDateOrOptions.prType || prType;
      asOfDate = asOfDateOrOptions.asOfDate;
    } else if (typeof asOfDateOrOptions === 'string') {
      const trimmed = asOfDateOrOptions.trim().toUpperCase();
      if (['MANUAL', 'MRP', 'REPAIR', 'MAINTENANCE', 'CAPEX_ASSET', 'EXPENSE'].includes(trimmed)) {
        prType = prType || trimmed;
      } else {
        asOfDate = asOfDateOrOptions;
      }
    }

    if (prType && prType.trim().toUpperCase() === 'EXPENSE') {
      return [];
    }
    const upperPrType = prType ? prType.trim().toUpperCase() : undefined;
    return this.resolveEffectiveMappingsForScope(companyId, branchId, asOfDate).filter(
      (opt) =>
        opt.isActiveInMaster &&
        (!opt.approvalStatus || opt.approvalStatus === 'APPROVED') &&
        opt.isEnabled &&
        opt.isEffectiveNow &&
        opt.applicability !== 'NOT_APPLICABLE' &&
        (!upperPrType ||
          !opt.applicablePrTypes ||
          opt.applicablePrTypes.length === 0 ||
          opt.applicablePrTypes.includes(upperPrType as any)) &&
        (opt.permittedApplicationLevels.includes('PR_HEADER') ||
          opt.permittedApplicationLevels.includes('PR_LINE'))
    );
  },

  resetToDefaults(): void {
    this.resetForTesting();
  },
};
