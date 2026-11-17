/**
 * KOSH INNOVATIONS — GLOBAL & BRANCH UOM MASTER + CONVERSION GOVERNANCE ENGINE
 *
 * Manages:
 * 1. Centralized UOM Master (Dimensions, Base Units, Precision, Active/Inactive).
 * 2. UOM Conversion & Dimensional Compatibility Validation
 *    (Identical unit factor = 1; Cross-dimension Weight<->Volume requires density basis;
 *     Incompatible dimensions like Length<->Time rejected).
 * 3. Quantity & Price Conversion Snapshot resolution honoring:
 *    Branch Override (if configured) -> Global Item Default UOM & Conversion -> Seeded Snapshot.
 */

import {
  GlobalItem,
  BranchItemAvailabilityRecord,
  UomMasterRecord,
  UomConversionDefinition,
  UomValidationResult,
  RoundingRule,
  UomDimension,
} from '../types';
import { EnterpriseAuditService } from './enterpriseAuditService';

const STORAGE_KEY_UOM_MASTER = 'kosh_uom_master_v1';

export const INITIAL_UOM_MASTER: UomMasterRecord[] = [
  { id: 'uom-kg', code: 'KG', name: 'Kilogram', dimension: 'WEIGHT', isBaseUnit: true, decimalPrecision: 3, allowFractional: true, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'System Seed' },
  { id: 'uom-g', code: 'G', name: 'Gram', dimension: 'WEIGHT', isBaseUnit: false, baseUnitCode: 'KG', decimalPrecision: 2, allowFractional: true, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'System Seed' },
  { id: 'uom-mt', code: 'MT', name: 'Metric Ton', dimension: 'WEIGHT', isBaseUnit: false, baseUnitCode: 'KG', decimalPrecision: 4, allowFractional: true, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'System Seed' },
  { id: 'uom-ltr', code: 'LTR', name: 'Litre', dimension: 'VOLUME', isBaseUnit: true, decimalPrecision: 3, allowFractional: true, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'System Seed' },
  { id: 'uom-ml', code: 'ML', name: 'Millilitre', dimension: 'VOLUME', isBaseUnit: false, baseUnitCode: 'LTR', decimalPrecision: 2, allowFractional: true, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'System Seed' },
  { id: 'uom-ea', code: 'EA', name: 'Each', dimension: 'COUNT', isBaseUnit: true, decimalPrecision: 0, allowFractional: false, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'System Seed' },
  { id: 'uom-nos', code: 'NOS', name: 'Numbers', dimension: 'COUNT', isBaseUnit: true, decimalPrecision: 0, allowFractional: false, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'System Seed' },
  { id: 'uom-set', code: 'SET', name: 'Set', dimension: 'COUNT', isBaseUnit: false, baseUnitCode: 'EA', decimalPrecision: 0, allowFractional: false, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'System Seed' },
  { id: 'uom-box', code: 'BOX', name: 'Box', dimension: 'PACKAGING', isBaseUnit: false, decimalPrecision: 0, allowFractional: false, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'System Seed' },
  { id: 'uom-bag', code: 'BAG', name: 'Bag', dimension: 'PACKAGING', isBaseUnit: false, decimalPrecision: 0, allowFractional: false, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'System Seed' },
  { id: 'uom-roll', code: 'ROLL', name: 'Roll', dimension: 'PACKAGING', isBaseUnit: false, decimalPrecision: 2, allowFractional: true, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'System Seed' },
  { id: 'uom-drum', code: 'DRUM', name: 'Drum', dimension: 'PACKAGING', isBaseUnit: false, decimalPrecision: 0, allowFractional: false, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'System Seed' },
  { id: 'uom-m', code: 'M', name: 'Metre', dimension: 'LENGTH', isBaseUnit: true, decimalPrecision: 3, allowFractional: true, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'System Seed' },
  { id: 'uom-mm', code: 'MM', name: 'Millimetre', dimension: 'LENGTH', isBaseUnit: false, baseUnitCode: 'M', decimalPrecision: 2, allowFractional: true, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'System Seed' },
  { id: 'uom-sqm', code: 'SQM', name: 'Square Metre', dimension: 'AREA', isBaseUnit: true, decimalPrecision: 3, allowFractional: true, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'System Seed' },
  { id: 'uom-hr', code: 'HR', name: 'Hour', dimension: 'TIME', isBaseUnit: true, decimalPrecision: 2, allowFractional: true, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'System Seed' },
];

export interface UomConversionSnapshot {
  itemCode: string;
  inventoryUom: string;
  purchaseUom: string;
  conversionRatio: number; // 1 Purchase UOM = X Inventory UOM
  roundingRule?: RoundingRule;
  decimalPrecision?: number;
  source?: 'BRANCH_OVERRIDE' | 'GLOBAL_DEFAULT' | 'LEGACY_CATALOG';
}

// Preserved deterministic default conversions for the 3 existing seeded master items
const LEGACY_SEED_UOM_MAP: Record<string, UomConversionSnapshot> = {
  RMPAOPOEXLG0001: {
    itemCode: 'RMPAOPOEXLG0001',
    inventoryUom: 'KG',
    purchaseUom: 'BAG', // 1 BAG = 25 KG
    conversionRatio: 25,
    roundingRule: 'NONE',
    decimalPrecision: 3,
    source: 'LEGACY_CATALOG',
  },
  FGHDMCRGY0002: {
    itemCode: 'FGHDMCRGY0002',
    inventoryUom: 'EA',
    purchaseUom: 'BOX', // 1 BOX = 50 EA
    conversionRatio: 50,
    roundingRule: 'NONE',
    decimalPrecision: 0,
    source: 'LEGACY_CATALOG',
  },
  MAPALBL0003: {
    itemCode: 'MAPALBL0003',
    inventoryUom: 'EA',
    purchaseUom: 'SET', // 1 SET = 1 EA
    conversionRatio: 1,
    roundingRule: 'NONE',
    decimalPrecision: 0,
    source: 'LEGACY_CATALOG',
  },
};

let memoryUoms: UomMasterRecord[] | null = null;

function applyRounding(value: number, precision: number, rule: RoundingRule = 'NONE'): number {
  const safePrec = Math.max(0, Math.min(6, precision));
  const multiplier = Math.pow(10, safePrec);
  if (rule === 'ROUND_UP') {
    return Math.ceil(value * multiplier) / multiplier;
  }
  if (rule === 'ROUND_DOWN') {
    return Math.floor(value * multiplier) / multiplier;
  }
  if (rule === 'NEAREST') {
    return Math.round(value * multiplier) / multiplier;
  }
  return Number(value.toFixed(safePrec));
}

export const uomConversionService = {
  resetForTesting(): void {
    memoryUoms = JSON.parse(JSON.stringify(INITIAL_UOM_MASTER));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_UOM_MASTER);
      } catch {
        // ignore
      }
    }
  },

  getUoms(includeInactive = true): UomMasterRecord[] {
    let list: UomMasterRecord[];
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_UOM_MASTER);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            list = parsed;
            return includeInactive ? list : list.filter((u) => u.isActive);
          }
        }
      } catch {
        // ignore
      }
    }
    if (!memoryUoms) {
      memoryUoms = JSON.parse(JSON.stringify(INITIAL_UOM_MASTER));
    }
    list = memoryUoms!;
    return includeInactive ? [...list] : list.filter((u) => u.isActive);
  },

  saveUoms(uoms: UomMasterRecord[]): void {
    memoryUoms = JSON.parse(JSON.stringify(uoms));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_UOM_MASTER, JSON.stringify(uoms));
      } catch {
        // ignore
      }
    }
  },

  upsertUom(
    input: {
      id?: string;
      code: string;
      name: string;
      dimension: UomDimension;
      isBaseUnit: boolean;
      baseUnitCode?: string;
      decimalPrecision: number;
      allowFractional: boolean;
      isActive?: boolean;
    },
    actorName: string,
    actorUserId = 'usr-admin-01',
    reason = 'UOM Master configuration update'
  ): UomMasterRecord {
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    if (!code || !/^[A-Z0-9_-]{1,16}$/.test(code)) {
      throw new Error('UOM Code must be 1–16 uppercase alphanumeric characters.');
    }
    if (!name) {
      throw new Error('UOM Name is required.');
    }
    if (!input.isBaseUnit && input.baseUnitCode) {
      const existingBase = this.getUoms(true).find(
        (u) => u.code === input.baseUnitCode!.trim().toUpperCase()
      );
      if (!existingBase) {
        throw new Error(`Referenced Base UOM "${input.baseUnitCode}" does not exist.`);
      }
    }

    const list = this.getUoms(true);
    const dup = list.find((u) => u.code === code && u.id !== input.id);
    if (dup) {
      throw new Error(`Duplicate UOM Code "${code}" already exists in UOM Master.`);
    }

    const now = new Date().toISOString();
    const existingIdx = input.id ? list.findIndex((u) => u.id === input.id) : -1;
    let saved: UomMasterRecord;

    if (existingIdx >= 0) {
      const prev = list[existingIdx];
      saved = {
        ...prev,
        code,
        name,
        dimension: input.dimension,
        isBaseUnit: input.isBaseUnit,
        baseUnitCode: input.isBaseUnit ? undefined : input.baseUnitCode?.trim().toUpperCase(),
        decimalPrecision: Math.max(0, Math.min(6, Number(input.decimalPrecision) || 0)),
        allowFractional: input.allowFractional,
        isActive: input.isActive !== undefined ? input.isActive : prev.isActive,
        updatedAt: now,
        updatedBy: actorName,
      };
      list[existingIdx] = saved;
    } else {
      saved = {
        id: `uom-${code.toLowerCase()}-${Date.now()}`,
        code,
        name,
        dimension: input.dimension,
        isBaseUnit: input.isBaseUnit,
        baseUnitCode: input.isBaseUnit ? undefined : input.baseUnitCode?.trim().toUpperCase(),
        decimalPrecision: Math.max(0, Math.min(6, Number(input.decimalPrecision) || 0)),
        allowFractional: input.allowFractional,
        isActive: input.isActive !== undefined ? input.isActive : true,
        createdAt: now,
        updatedAt: now,
        updatedBy: actorName,
      };
      list.unshift(saved);
    }

    this.saveUoms(list);
    EnterpriseAuditService.logEvent({
      companyId: 'co-kosh-01',
      entityType: 'UOM_MASTER',
      entityId: saved.id,
      eventType: existingIdx >= 0 ? 'UOM_UPDATED' : 'UOM_CREATED',
      eventDescription: `${existingIdx >= 0 ? 'Updated' : 'Created'} UOM ${saved.code} (${saved.name}) [${saved.dimension}]`,
      changedByUserId: actorUserId,
      changedByName: actorName,
      changeReason: reason,
      newValue: saved,
    });
    return saved;
  },

  toggleUomStatus(id: string, isActive: boolean, actorName: string, actorUserId = 'usr-admin-01'): UomMasterRecord {
    const list = this.getUoms(true);
    const idx = list.findIndex((u) => u.id === id || u.code === id);
    if (idx < 0) {
      throw new Error(`UOM "${id}" not found.`);
    }
    const prev = list[idx];
    const updated: UomMasterRecord = {
      ...prev,
      isActive,
      updatedAt: new Date().toISOString(),
      updatedBy: actorName,
    };
    list[idx] = updated;
    this.saveUoms(list);
    EnterpriseAuditService.logEvent({
      companyId: 'co-kosh-01',
      entityType: 'UOM_MASTER',
      entityId: updated.id,
      eventType: isActive ? 'UOM_ACTIVATED' : 'UOM_DEACTIVATED',
      eventDescription: `${isActive ? 'Activated' : 'Soft-deactivated'} UOM ${updated.code}`,
      changedByUserId: actorUserId,
      changedByName: actorName,
      changeReason: `UOM lifecycle changed to ${isActive ? 'ACTIVE' : 'INACTIVE'}`,
      previousValue: { isActive: prev.isActive },
      newValue: { isActive },
    });
    return updated;
  },

  getUomByCode(code?: string): UomMasterRecord | undefined {
    if (!code) return undefined;
    const norm = code.trim().toUpperCase();
    return this.getUoms(true).find((u) => u.code === norm);
  },

  /**
   * Validates UOM selection and conversion formula integrity:
   * - Purchase UOM is strictly mandatory.
   * - Inventory UOM is required when inventory tracking is enabled or conversion is defined.
   * - Numerator & denominator must be strictly positive.
   * - Identical Purchase & Inventory UOM requires factor === 1.
   * - Weight <-> Volume conversion requires explicit density basis (`requiresDensityBasis && densityFactor > 0`).
   * - Incompatible fixed dimensions (e.g., WEIGHT <-> LENGTH, TIME <-> WEIGHT) without packaging/pack basis are rejected.
   */
  validateUomConversion(params: {
    purchaseUom?: string;
    inventoryUom?: string;
    inventoryRequired?: boolean;
    numerator?: number;
    denominator?: number;
    conversionFactor?: number;
    densityFactor?: number;
    requiresDensityBasis?: boolean;
    decimalPrecision?: number;
  }): UomValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const pCode = (params.purchaseUom || '').trim().toUpperCase();
    const iCode = (params.inventoryUom || '').trim().toUpperCase();

    if (!pCode) {
      errors.push('Purchase UOM is mandatory.');
      return { valid: false, errors, warnings, normalizedFactor: 0 };
    }

    const pUom = this.getUomByCode(pCode);
    if (!pUom) {
      errors.push(`Purchase UOM "${pCode}" is not registered in UOM Master.`);
    } else if (!pUom.isActive) {
      errors.push(`Purchase UOM "${pCode}" is inactive.`);
    }

    if (params.inventoryRequired !== false && !iCode) {
      errors.push('Inventory / Base UOM is required when inventory tracking applies.');
    }

    const effectiveInvCode = iCode || pCode;
    const iUom = this.getUomByCode(effectiveInvCode);
    if (iCode && !iUom) {
      errors.push(`Inventory UOM "${effectiveInvCode}" is not registered in UOM Master.`);
    } else if (iUom && !iUom.isActive) {
      errors.push(`Inventory UOM "${effectiveInvCode}" is inactive.`);
    }

    const num = params.numerator !== undefined ? Number(params.numerator) : (params.conversionFactor !== undefined ? Number(params.conversionFactor) : 1);
    const den = params.denominator !== undefined ? Number(params.denominator) : 1;

    if (!Number.isFinite(num) || num <= 0) {
      errors.push('Conversion numerator / factor must be greater than zero.');
    }
    if (!Number.isFinite(den) || den <= 0) {
      errors.push('Conversion denominator must be greater than zero.');
    }

    const factor = num > 0 && den > 0 ? Number((num / den).toFixed(6)) : 0;

    if (pCode && effectiveInvCode && pCode === effectiveInvCode) {
      if (Math.abs(factor - 1) > 1e-6) {
        errors.push(`When Purchase UOM equals Inventory UOM (${pCode}), conversion factor must be exactly 1.`);
      }
    } else if (pUom && iUom && pCode !== effectiveInvCode) {
      if (factor <= 0) {
        errors.push(`A valid positive conversion factor is required between ${pCode} and ${effectiveInvCode}.`);
      }

      const d1 = pUom.dimension;
      const d2 = iUom.dimension;
      const hasPackUnit = d1 === 'PACKAGING' || d2 === 'PACKAGING' || d1 === 'OTHER' || d2 === 'OTHER';

      if (!hasPackUnit && d1 !== d2) {
        const isMassVolume =
          (d1 === 'WEIGHT' && d2 === 'VOLUME') || (d1 === 'VOLUME' && d2 === 'WEIGHT');
        if (isMassVolume) {
          if (!params.densityFactor || Number(params.densityFactor) <= 0) {
            errors.push(
              `Conversion between Weight (${d1 === 'WEIGHT' ? pCode : effectiveInvCode}) and Volume (${d1 === 'VOLUME' ? pCode : effectiveInvCode}) requires a positive approved density factor.`
            );
          }
        } else {
          errors.push(
            `Incompatible UOM dimensions: cannot convert ${pCode} (${d1}) to ${effectiveInvCode} (${d2}) without a packaging or approved physical basis.`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      normalizedFactor: factor,
    };
  },

  buildConversionDefinition(params: {
    fromUomCode: string;
    toUomCode: string;
    numerator: number;
    denominator: number;
    decimalPrecision?: number;
    roundingRule?: RoundingRule;
    densityFactor?: number;
    compatibilityNote?: string;
  }): UomConversionDefinition {
    const num = Number(params.numerator);
    const den = Number(params.denominator);
    const fromCode = params.fromUomCode.trim().toUpperCase();
    const toCode = params.toUomCode.trim().toUpperCase();
    const pUom = this.getUomByCode(fromCode);
    const iUom = this.getUomByCode(toCode);
    const isMassVolume =
      !!pUom &&
      !!iUom &&
      ((pUom.dimension === 'WEIGHT' && iUom.dimension === 'VOLUME') ||
        (pUom.dimension === 'VOLUME' && iUom.dimension === 'WEIGHT'));

    return {
      fromUomCode: fromCode,
      toUomCode: toCode,
      numerator: num,
      denominator: den,
      conversionFactor: num > 0 && den > 0 ? Number((num / den).toFixed(6)) : 0,
      decimalPrecision: params.decimalPrecision ?? 4,
      roundingRule: params.roundingRule || 'NONE',
      requiresDensityBasis: isMassVolume,
      densityFactor: params.densityFactor,
      compatibilityNote: params.compatibilityNote,
      isActive: true,
    };
  },

  getUomSnapshot(
    itemCode: string,
    itemObj?: GlobalItem,
    branchAvail?: BranchItemAvailabilityRecord
  ): UomConversionSnapshot {
    // 1. Branch Item Availability Override takes highest priority when present
    if (branchAvail) {
      return {
        itemCode,
        purchaseUom: branchAvail.effectivePurchaseUom,
        inventoryUom: branchAvail.effectiveInventoryUom,
        conversionRatio: branchAvail.effectiveConversionFactor || 1,
        roundingRule: branchAvail.branchConversionOverride?.roundingRule || itemObj?.defaultUomConversion?.roundingRule || 'NONE',
        decimalPrecision: branchAvail.branchConversionOverride?.decimalPrecision ?? itemObj?.defaultUomConversion?.decimalPrecision ?? 4,
        source: branchAvail.branchPurchaseUom || branchAvail.branchInventoryUom ? 'BRANCH_OVERRIDE' : 'GLOBAL_DEFAULT',
      };
    }

    // 2. Global Item explicit default UOM & conversion configuration
    if (itemObj && (itemObj.defaultPurchaseUom || itemObj.defaultInventoryUom || itemObj.defaultUomConversion)) {
      const purchUom = itemObj.defaultPurchaseUom || itemObj.defaultUomConversion?.fromUomCode || itemObj.defaultInventoryUom || itemObj.inventoryUom || 'EA';
      const invUom = itemObj.defaultInventoryUom || itemObj.defaultUomConversion?.toUomCode || itemObj.inventoryUom || itemObj.procurementControls?.inventoryUom || purchUom;
      const ratio = itemObj.defaultUomConversion?.conversionFactor && itemObj.defaultUomConversion.conversionFactor > 0
        ? itemObj.defaultUomConversion.conversionFactor
        : (purchUom === invUom ? 1 : (LEGACY_SEED_UOM_MAP[itemCode]?.conversionRatio || 1));

      return {
        itemCode,
        purchaseUom: purchUom,
        inventoryUom: invUom,
        conversionRatio: ratio,
        roundingRule: itemObj.defaultUomConversion?.roundingRule || 'NONE',
        decimalPrecision: itemObj.defaultUomConversion?.decimalPrecision ?? 4,
        source: 'GLOBAL_DEFAULT',
      };
    }

    // 3. Seeded historical item snapshots
    if (LEGACY_SEED_UOM_MAP[itemCode]) {
      return LEGACY_SEED_UOM_MAP[itemCode];
    }

    // 4. Fallback for minimal legacy GlobalItem objects without explicit UOM conversion
    if (itemObj) {
      const invUom = itemObj.inventoryUom || itemObj.procurementControls?.inventoryUom || 'EA';
      return {
        itemCode,
        inventoryUom: invUom,
        purchaseUom: invUom,
        conversionRatio: 1,
        roundingRule: 'NONE',
        decimalPrecision: 4,
        source: 'GLOBAL_DEFAULT',
      };
    }

    return {
      itemCode,
      inventoryUom: 'EA',
      purchaseUom: 'EA',
      conversionRatio: 1,
      roundingRule: 'NONE',
      decimalPrecision: 4,
      source: 'LEGACY_CATALOG',
    };
  },

  convertInvToPurchQty(
    itemCode: string,
    qtyInvUom: number,
    itemObj?: GlobalItem,
    branchAvail?: BranchItemAvailabilityRecord
  ): number {
    const snapshot = this.getUomSnapshot(itemCode, itemObj, branchAvail);
    if (snapshot.conversionRatio <= 0) return qtyInvUom;
    return applyRounding(
      qtyInvUom / snapshot.conversionRatio,
      snapshot.decimalPrecision ?? 4,
      snapshot.roundingRule || 'NONE'
    );
  },

  convertPurchToInvQty(
    itemCode: string,
    qtyPurchUom: number,
    itemObj?: GlobalItem,
    branchAvail?: BranchItemAvailabilityRecord
  ): number {
    const snapshot = this.getUomSnapshot(itemCode, itemObj, branchAvail);
    return applyRounding(
      qtyPurchUom * snapshot.conversionRatio,
      snapshot.decimalPrecision ?? 4,
      snapshot.roundingRule || 'NONE'
    );
  },

  convertPricePurchToInv(
    itemCode: string,
    unitPricePurchUom: number,
    itemObj?: GlobalItem,
    branchAvail?: BranchItemAvailabilityRecord
  ): number {
    const snapshot = this.getUomSnapshot(itemCode, itemObj, branchAvail);
    if (snapshot.conversionRatio <= 0) return unitPricePurchUom;
    return Number((unitPricePurchUom / snapshot.conversionRatio).toFixed(2));
  },
};
