/**
 * CIPPLATFORM - PURCHASE REQUISITION CHARGE ITEMS SERVICE
 * Manages procurement non-inventory cost components (loading, unloading, customs duty,
 * freight, transit insurance, packaging, inspection, and handling).
 * Supports explicit applicability toggle and standardized fixed charge tariff schedules.
 */

import {
  PRChargeItem,
  PRChargeApplicability,
  PRChargeType,
  PRChargeCategory,
  PRChargesSummary,
} from '../types/purchaseRequisition';
import {
  ChargeMasterCategory,
  EffectiveMappedChargeOption,
} from '../types/chargeManagement';
import { chargeMappingService } from './chargeMappingService';
import { chargeMasterService } from './chargeMasterService';
import { executeChargeCalculation } from './chargeManagementService';

export interface StandardChargeTemplate {
  chargeCode: string;
  chargeName: string;
  category: PRChargeCategory;
  defaultChargeType: PRChargeType;
  defaultApplicability: PRChargeApplicability;
  fixedChargeRate: number; // Pre-configured standard fixed tariff
  fixedChargeDescription: string;
  gstRatePercent: number;
  payeeType: 'SUPPLIER' | 'THIRD_PARTY_LOGISTICS' | 'CUSTOMS_AUTHORITY' | 'DIRECT_LABOR' | 'SERVICE_PROVIDER';
  remarks: string;
}

export const STANDARD_CHARGE_TEMPLATES: StandardChargeTemplate[] = [
  {
    chargeCode: 'CHG-LOAD',
    chargeName: 'Loading Charges',
    category: 'HANDLING',
    defaultChargeType: 'FIXED',
    defaultApplicability: 'AS_PER_FIXED_CHARGES',
    fixedChargeRate: 1500,
    fixedChargeDescription: 'Standard Labor & Forklift Loading Tariff (Per Consignment)',
    gstRatePercent: 18,
    payeeType: 'DIRECT_LABOR',
    remarks: 'Factory loading at dispatch dock',
  },
  {
    chargeCode: 'CHG-UNLOAD',
    chargeName: 'Unloading Charges',
    category: 'HANDLING',
    defaultChargeType: 'FIXED',
    defaultApplicability: 'AS_PER_FIXED_CHARGES',
    fixedChargeRate: 1500,
    fixedChargeDescription: 'Standard Receiving & Offloading Tariff (Per Consignment)',
    gstRatePercent: 18,
    payeeType: 'DIRECT_LABOR',
    remarks: 'Receiving bay offloading and store movement',
  },
  {
    chargeCode: 'CHG-CUSTOMS',
    chargeName: 'Customs Duty & Import Tariff',
    category: 'STATUTORY',
    defaultChargeType: 'PERCENTAGE',
    defaultApplicability: 'APPLICABLE',
    fixedChargeRate: 10, // 10% standard tariff
    fixedChargeDescription: 'Basic Customs Duty (BCD) & SWS Statutory Assessment',
    gstRatePercent: 0, // Duty itself is exempt; IGST is levied separately
    payeeType: 'CUSTOMS_AUTHORITY',
    remarks: 'Statutory import clearance and customs assessment',
  },
  {
    chargeCode: 'CHG-FREIGHT',
    chargeName: 'Freight & Transportation Charges',
    category: 'LOGISTICS',
    defaultChargeType: 'FIXED',
    defaultApplicability: 'AS_PER_FIXED_CHARGES',
    fixedChargeRate: 4500,
    fixedChargeDescription: 'Contracted Line-Haul Dedicated Truckload / Transit Tariff',
    gstRatePercent: 18,
    payeeType: 'THIRD_PARTY_LOGISTICS',
    remarks: 'Door-to-door transit to target plant store',
  },
  {
    chargeCode: 'CHG-INSURANCE',
    chargeName: 'Transit Marine & Inland Insurance',
    category: 'INSURANCE',
    defaultChargeType: 'PERCENTAGE',
    defaultApplicability: 'AS_PER_FIXED_CHARGES',
    fixedChargeRate: 0.25, // 0.25% of consignments
    fixedChargeDescription: 'Corporate Open Floater Transit Marine Policy Tariff (0.25%)',
    gstRatePercent: 18,
    payeeType: 'SERVICE_PROVIDER',
    remarks: 'All-risk cargo coverage during inter-state transport',
  },
  {
    chargeCode: 'CHG-PACKAGING',
    chargeName: 'Packaging & Forwarding (P&F)',
    category: 'PACKAGING',
    defaultChargeType: 'FIXED',
    defaultApplicability: 'AS_PER_FIXED_CHARGES',
    fixedChargeRate: 2000,
    fixedChargeDescription: 'Industrial Wooden Pallet & Moisture-Barrier Crating',
    gstRatePercent: 18,
    payeeType: 'SUPPLIER',
    remarks: 'Heavy-duty weather-sealed shipping packaging',
  },
  {
    chargeCode: 'CHG-INSPECTION',
    chargeName: 'Inspection & Quality Testing Charges',
    category: 'SERVICE',
    defaultChargeType: 'FIXED',
    defaultApplicability: 'NOT_APPLICABLE',
    fixedChargeRate: 3000,
    fixedChargeDescription: 'Third-Party NABL Certified Metallurgical / QA Testing',
    gstRatePercent: 18,
    payeeType: 'SERVICE_PROVIDER',
    remarks: 'Pre-dispatch material test certificate verification',
  },
  {
    chargeCode: 'CHG-HANDLING',
    chargeName: 'Handling & Port Demurrage Charges',
    category: 'HANDLING',
    defaultChargeType: 'FIXED',
    defaultApplicability: 'NOT_APPLICABLE',
    fixedChargeRate: 2500,
    fixedChargeDescription: 'ICD / CFS Inland Container Depot Handling Tariff',
    gstRatePercent: 18,
    payeeType: 'THIRD_PARTY_LOGISTICS',
    remarks: 'Container terminal handling and demurrage cover',
  },
  {
    chargeCode: 'CHG-ENTRY-TAX',
    chargeName: 'Octroi / Entry / Municipal Toll Charges',
    category: 'STATUTORY',
    defaultChargeType: 'FIXED',
    defaultApplicability: 'NOT_APPLICABLE',
    fixedChargeRate: 500,
    fixedChargeDescription: 'Municipal Corporation Entry Toll & Green Cess',
    gstRatePercent: 0,
    payeeType: 'CUSTOMS_AUTHORITY',
    remarks: 'State border check-post entry fee',
  },
  {
    chargeCode: 'CHG-INSTALLATION',
    chargeName: 'Installation & Commissioning Charges',
    category: 'SERVICE',
    defaultChargeType: 'FIXED',
    defaultApplicability: 'NOT_APPLICABLE',
    fixedChargeRate: 5000,
    fixedChargeDescription: 'OEM Certified Field Engineer Erection & Trial Run',
    gstRatePercent: 18,
    payeeType: 'SUPPLIER',
    remarks: 'On-site technical commissioning and sign-off',
  },
];

export function getCurrencySymbol(currency: string = 'INR'): string {
  switch ((currency || 'INR').toUpperCase()) {
    case 'INR':
      return '₹';
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    default:
      return `${currency.toUpperCase()} `;
  }
}

export function formatChargeAmount(amount: number, currency: string = 'INR'): string {
  const sym = getCurrencySymbol(currency);
  const val = Number(amount || 0).toLocaleString('en-IN');
  return `${sym}${val}`;
}

function mapMasterCategoryToPrCategory(cat: ChargeMasterCategory): PRChargeCategory {
  switch (cat) {
    case 'HANDLING':
      return 'HANDLING';
    case 'IMPORT_CUSTOMS':
    case 'STATUTORY':
      return 'STATUTORY';
    case 'LOGISTICS':
      return 'LOGISTICS';
    case 'INSURANCE':
      return 'INSURANCE';
    case 'PACKAGING':
      return 'PACKAGING';
    case 'QUALITY_COMPLIANCE':
    case 'SERVICE':
      return 'SERVICE';
    default:
      return 'OTHER';
  }
}

function mapBearerToPayee(bearer: string, cat: ChargeMasterCategory): PRChargeItem['payeeType'] {
  if (cat === 'IMPORT_CUSTOMS' || cat === 'STATUTORY') return 'CUSTOMS_AUTHORITY';
  if (bearer === 'THIRD_PARTY_LOGISTICS' || cat === 'LOGISTICS') return 'THIRD_PARTY_LOGISTICS';
  if (cat === 'HANDLING') return 'DIRECT_LABOR';
  if (cat === 'INSURANCE' || cat === 'QUALITY_COMPLIANCE') return 'SERVICE_PROVIDER';
  return 'SUPPLIER';
}

export interface PRMappedChargeContext {
  quantity?: number;
  weightKg?: number;
  volumeCbm?: number;
  distanceKm?: number;
  applicabilityOverride?: PRChargeApplicability;
  rateOverride?: number;
  remarks?: string;
  payeeType?: PRChargeItem['payeeType'];
}

export const prChargeItemService = {
  /**
   * Retrieves ONLY active, effective, and applicable mapped charges for PR creation/editing.
   */
  getEffectiveMappedChargesForPR(
    companyId: string,
    branchId: string,
    asOfDate?: string
  ): EffectiveMappedChargeOption[] {
    return chargeMappingService.getEffectivePrChargeOptions(companyId, branchId, asOfDate);
  },

  /**
   * Builds a governed PRChargeItem from an EffectiveMappedChargeOption and computes
   * financials through the centralized calculation engine.
   */
  createPrChargeFromMappedOption(
    option: EffectiveMappedChargeOption,
    itemsSubtotal: number,
    targetCurrency?: string,
    context?: PRMappedChargeContext
  ): PRChargeItem {
    if (!option.isActiveInMaster || !option.isEnabled || !option.isEffectiveNow || option.applicability === 'NOT_APPLICABLE') {
      throw new Error(
        `Charge "${option.chargeCode}" (${option.chargeName}) is inactive or not applicable for this Company/Branch.`
      );
    }

    const activeCurrency = (targetCurrency || option.currency || 'INR').toUpperCase();
    const rateToUse = context?.rateOverride !== undefined ? Number(context.rateOverride) : Number(option.rate);
    const applicability: PRChargeApplicability =
      context?.applicabilityOverride || 'AS_PER_FIXED_CHARGES';

    const prChargeType: PRChargeType =
      option.calculationMethod === 'PERCENTAGE'
        ? 'PERCENTAGE'
        : option.calculationMethod === 'ACTUAL_COST'
        ? 'AT_ACTUALS'
        : 'FIXED';

    const taxMapping = chargeMasterService.getTaxMappingById(option.taxMappingId);
    const fxRate = chargeMasterService.getExchangeRate(option.currency, activeCurrency);
    const effectiveRateInTargetCurrency =
      option.calculationMethod === 'PERCENTAGE'
        ? rateToUse
        : Number((rateToUse * fxRate).toFixed(option.decimalPrecision || 2));

    const calcInputs = {
      method: option.calculationMethod,
      basis: option.calculationBasis,
      rate: applicability === 'NOT_APPLICABLE' ? 0 : effectiveRateInTargetCurrency,
      formulaExpression: option.formulaExpression,
      materialValue: itemsSubtotal,
      totalPoMaterialValue: itemsSubtotal,
      quantity: context?.quantity ?? 1,
      grossWeightKg: context?.weightKg,
      volumeCbm: context?.volumeCbm,
      distanceKm: context?.distanceKm,
      sourceCurrency: activeCurrency,
      targetCurrency: activeCurrency,
      exchangeRate: 1,
      minimumCharge: option.minimumCharge,
      maximumCharge: option.maximumCharge,
      roundingRule: option.roundingRule || 'HALF_UP',
      decimalPrecision: option.decimalPrecision ?? 2,
      taxMapping,
    };

    const snap = executeChargeCalculation(calcInputs, `pr-chg-preview-${option.chargeCode}`, 1, 'Charge Engine');
    const baseAmt = applicability === 'NOT_APPLICABLE' ? 0 : snap.clampedAmount;
    const taxAmt =
      applicability === 'NOT_APPLICABLE'
        ? 0
        : Number((snap.taxBreakdown.taxAmount + snap.taxBreakdown.surchargeAmount).toFixed(2));
    const totalWithTax = Number((baseAmt + taxAmt).toFixed(2));

    return {
      id: `chg-${option.chargeCode.toLowerCase()}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      chargeCode: option.chargeCode,
      chargeName: option.chargeName,
      category: mapMasterCategoryToPrCategory(option.chargeCategory),
      applicability,
      chargeType: prChargeType,
      rateOrPercentage: effectiveRateInTargetCurrency,
      currency: activeCurrency,
      estimatedAmount: baseAmt,
      isFixedChargeRule: applicability === 'AS_PER_FIXED_CHARGES',
      fixedChargeRate: effectiveRateInTargetCurrency,
      fixedChargeDescription: `${option.sourceScope === 'BRANCH_OVERRIDE' ? 'Branch Override' : 'Company Policy'} · ${option.calculationMethod.replace(/_/g, ' ')}`,
      gstRatePercent: option.taxRatePercent ?? taxMapping.ratePercent ?? 0,
      taxAmount: taxAmt,
      totalWithTax,
      payeeType: context?.payeeType || mapBearerToPayee(option.chargeBearer, option.chargeCategory),
      remarks: context?.remarks ?? option.remarks ?? option.chargeDescription,
      chargeMasterId: option.chargeMasterId,
      chargeMasterVersion: option.chargeMasterVersion,
      mappingId: option.mappingId,
      mappingVersion: option.mappingVersion,
      applicationLevel: option.defaultApplicationLevel,
      calculationMethod: option.calculationMethod,
      calculationBasis: option.calculationBasis,
      allocationBasis: option.allocationBasis,
      taxMappingId: option.taxMappingId,
      taxTreatment: option.taxTreatment,
      recoverableTax: applicability === 'NOT_APPLICABLE' ? 0 : snap.taxBreakdown.recoverableTax,
      nonRecoverableTax: applicability === 'NOT_APPLICABLE' ? 0 : snap.taxBreakdown.nonRecoverableTax,
      mandateStatus: option.applicability,
      requiresApproval: option.requiresApproval,
      sourceScope: option.sourceScope,
      calculationInputs: {
        itemsSubtotal,
        rateUsed: effectiveRateInTargetCurrency,
        quantity: context?.quantity ?? 1,
        weightKg: context?.weightKg,
        volumeCbm: context?.volumeCbm,
        distanceKm: context?.distanceKm,
      },
      calculatedByBackend: true,
    };
  },

  /**
   * Adds one mapped charge to a PR's Charge Items list while blocking duplicates and inactive/unmapped charges.
   */
  addMappedChargeToPrList(
    currentCharges: PRChargeItem[],
    option: EffectiveMappedChargeOption,
    itemsSubtotal: number,
    targetCurrency?: string,
    context?: PRMappedChargeContext
  ): PRChargeItem[] {
    const duplicate = currentCharges.some(
      (c) =>
        c.chargeCode.toUpperCase() === option.chargeCode.toUpperCase() ||
        (option.chargeMasterId && c.chargeMasterId === option.chargeMasterId)
    );
    if (duplicate) {
      throw new Error(
        `Duplicate charge selection blocked: "${option.chargeCode}" (${option.chargeName}) is already added to this PR.`
      );
    }
    const created = this.createPrChargeFromMappedOption(option, itemsSubtotal, targetCurrency, context);
    return [...currentCharges, created];
  },

  /**
   * Generates standard charge items for a PR with initial applicability settings.
   */
  getDefaultChargeItems(currency = 'INR', itemsSubtotal = 0): PRChargeItem[] {
    return STANDARD_CHARGE_TEMPLATES.map((tmpl) => {
      const isFixed = tmpl.defaultApplicability === 'AS_PER_FIXED_CHARGES';
      const initialItem: PRChargeItem = {
        id: `chg-${tmpl.chargeCode.toLowerCase()}-${Date.now().toString(36)}`,
        chargeCode: tmpl.chargeCode,
        chargeName: tmpl.chargeName,
        category: tmpl.category,
        applicability: tmpl.defaultApplicability,
        chargeType: tmpl.defaultChargeType,
        rateOrPercentage: tmpl.fixedChargeRate,
        currency,
        estimatedAmount: 0,
        isFixedChargeRule: isFixed,
        fixedChargeRate: tmpl.fixedChargeRate,
        fixedChargeDescription: tmpl.fixedChargeDescription,
        gstRatePercent: tmpl.gstRatePercent,
        taxAmount: 0,
        totalWithTax: 0,
        payeeType: tmpl.payeeType,
        remarks: tmpl.remarks,
      };

      return this.calculateChargeItem(initialItem, itemsSubtotal);
    });
  },

  /**
   * Calculates the base amount, tax amount, and total with tax for a given charge item.
   * Respects locked historical snapshots untouched.
   */
  calculateChargeItem(item: PRChargeItem, itemsSubtotal: number, context?: { quantity?: number; weightKg?: number; volumeCbm?: number; distanceKm?: number }): PRChargeItem {
    if (item.snapshotLockedAt) {
      return item; // Immutable historical PR snapshot protection
    }
    const updated = { ...item };

    if (updated.applicability === 'NOT_APPLICABLE') {
      updated.estimatedAmount = 0;
      updated.taxAmount = 0;
      updated.totalWithTax = 0;
      updated.recoverableTax = 0;
      updated.nonRecoverableTax = 0;
      return updated;
    }

    // If governed by non-fixed/non-percentage engine calculation method (e.g. PER_UNIT, PER_KG, FORMULA_BASED)
    if (
      updated.calculationMethod &&
      !['FIXED_AMOUNT', 'PERCENTAGE', 'ACTUAL_COST'].includes(updated.calculationMethod) &&
      updated.taxMappingId
    ) {
      const rate = updated.applicability === 'AS_PER_FIXED_CHARGES'
        ? updated.fixedChargeRate ?? updated.rateOrPercentage ?? 0
        : Number(updated.rateOrPercentage) || 0;
      const taxMapping = chargeMasterService.getTaxMappingById(updated.taxMappingId);
      const snap = executeChargeCalculation(
        {
          method: updated.calculationMethod as any,
          basis: (updated.calculationBasis as any) || 'NET_QUANTITY',
          rate,
          materialValue: itemsSubtotal,
          totalPoMaterialValue: itemsSubtotal,
          quantity: context?.quantity ?? updated.calculationInputs?.quantity ?? 1,
          grossWeightKg: context?.weightKg ?? updated.calculationInputs?.weightKg,
          volumeCbm: context?.volumeCbm ?? updated.calculationInputs?.volumeCbm,
          distanceKm: context?.distanceKm ?? updated.calculationInputs?.distanceKm,
          sourceCurrency: updated.currency || 'INR',
          targetCurrency: updated.currency || 'INR',
          exchangeRate: 1,
          roundingRule: 'HALF_UP',
          decimalPrecision: 2,
          taxMapping,
        },
        updated.id,
        1,
        'Charge Engine'
      );
      updated.isFixedChargeRule = updated.applicability === 'AS_PER_FIXED_CHARGES';
      updated.rateOrPercentage = rate;
      updated.estimatedAmount = snap.clampedAmount;
      updated.taxAmount = Number((snap.taxBreakdown.taxAmount + snap.taxBreakdown.surchargeAmount).toFixed(2));
      updated.totalWithTax = Number((updated.estimatedAmount + updated.taxAmount).toFixed(2));
      updated.recoverableTax = snap.taxBreakdown.recoverableTax;
      updated.nonRecoverableTax = snap.taxBreakdown.nonRecoverableTax;
      updated.calculatedByBackend = true;
      return updated;
    }

    let baseAmount = 0;
    if (updated.applicability === 'AS_PER_FIXED_CHARGES') {
      const fixedRate = updated.fixedChargeRate ?? updated.rateOrPercentage ?? 0;
      if (updated.chargeType === 'PERCENTAGE') {
        baseAmount = Math.round((itemsSubtotal * fixedRate) / 100);
      } else {
        baseAmount = fixedRate;
      }
      updated.isFixedChargeRule = true;
      updated.rateOrPercentage = fixedRate;
    } else {
      // APPLICABLE
      updated.isFixedChargeRule = false;
      if (updated.chargeType === 'PERCENTAGE') {
        baseAmount = Math.round((itemsSubtotal * (Number(updated.rateOrPercentage) || 0)) / 100);
      } else {
        // FIXED or AT_ACTUALS
        baseAmount = Number(updated.rateOrPercentage) || 0;
      }
    }

    const gstPercent = Number(updated.gstRatePercent) || 0;
    const taxAmount = Math.round((baseAmount * gstPercent) / 100);
    const totalWithTax = baseAmount + taxAmount;

    updated.estimatedAmount = baseAmount;
    updated.taxAmount = taxAmount;
    updated.totalWithTax = totalWithTax;

    return updated;
  },

  /**
   * Recalculates all charge items in an array against a new item lines subtotal and optional currency.
   * Locked historical snapshots are preserved verbatim.
   */
  recalculateAllCharges(
    charges: PRChargeItem[] | undefined,
    itemsSubtotal: number,
    currency?: string
  ): PRChargeItem[] {
    if (!charges || charges.length === 0) {
      return this.getDefaultChargeItems(currency || 'INR', itemsSubtotal);
    }
    return charges.map((c) => {
      if (c.snapshotLockedAt) return c;
      return this.calculateChargeItem(currency ? { ...c, currency } : c, itemsSubtotal);
    });
  },

  /**
   * Recalculates user-selected mapped charges cleanly (without falling back to 10 template items when empty).
   */
  recalculateSelectedChargesOnly(
    charges: PRChargeItem[],
    itemsSubtotal: number,
    currency?: string,
    context?: { quantity?: number; weightKg?: number; volumeCbm?: number; distanceKm?: number }
  ): PRChargeItem[] {
    return charges.map((c) => {
      if (c.snapshotLockedAt) return c;
      return this.calculateChargeItem(currency ? { ...c, currency } : c, itemsSubtotal, context);
    });
  },

  /**
   * Calculates summary metrics for the PR header (charges total, tax, grand total).
   */
  calculateRequisitionChargesSummary(
    charges: PRChargeItem[] | undefined,
    itemsSubtotal: number
  ): PRChargesSummary {
    if (!charges || charges.length === 0) {
      return {
        itemsSubtotal,
        applicableChargesCount: 0,
        applicableChargesBaseTotal: 0,
        applicableChargesTaxTotal: 0,
        applicableChargesGrandTotal: 0,
        grandTotalWithCharges: itemsSubtotal,
      };
    }

    let count = 0;
    let baseTotal = 0;
    let taxTotal = 0;

    for (const c of charges) {
      if (c.applicability !== 'NOT_APPLICABLE') {
        count += 1;
        baseTotal += c.estimatedAmount || 0;
        taxTotal += c.taxAmount || 0;
      }
    }

    const grandChargesTotal = baseTotal + taxTotal;

    return {
      itemsSubtotal,
      applicableChargesCount: count,
      applicableChargesBaseTotal: baseTotal,
      applicableChargesTaxTotal: taxTotal,
      applicableChargesGrandTotal: grandChargesTotal,
      grandTotalWithCharges: itemsSubtotal + baseTotal, // Base Requisition landing value
    };
  },

  /**
   * Creates a custom charge item.
   */
  createCustomChargeItem(partial: Partial<PRChargeItem>, itemsSubtotal = 0, currency = 'INR'): PRChargeItem {
    const chargeCode = partial.chargeCode || `CHG-CUSTOM-${Date.now().toString(36).toUpperCase()}`;
    const newItem: PRChargeItem = {
      id: `chg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      chargeCode,
      chargeName: partial.chargeName || 'Custom Incidental Charge',
      category: partial.category || 'OTHER',
      applicability: partial.applicability || 'APPLICABLE',
      chargeType: partial.chargeType || 'FIXED',
      rateOrPercentage: Number(partial.rateOrPercentage) || 0,
      currency: partial.currency || currency,
      estimatedAmount: 0,
      isFixedChargeRule: partial.applicability === 'AS_PER_FIXED_CHARGES',
      fixedChargeRate: partial.fixedChargeRate,
      fixedChargeDescription: partial.fixedChargeDescription || 'Custom Specific Charge',
      gstRatePercent: partial.gstRatePercent !== undefined ? partial.gstRatePercent : 18,
      taxAmount: 0,
      totalWithTax: 0,
      payeeType: partial.payeeType || 'SUPPLIER',
      remarks: partial.remarks || '',
    };

    return this.calculateChargeItem(newItem, itemsSubtotal);
  },

  /**
   * Resets a charge item back to its standard fixed tariff rate card (or mapped rate if governed).
   */
  resetToFixedTariff(item: PRChargeItem, itemsSubtotal: number): PRChargeItem {
    if (item.snapshotLockedAt) return item;
    const tmpl = STANDARD_CHARGE_TEMPLATES.find((t) => t.chargeCode === item.chargeCode);
    const mappedMaster = item.chargeMasterId ? chargeMasterService.getChargeByIdOrCode(item.chargeMasterId) : undefined;
    const targetRate = item.fixedChargeRate ?? mappedMaster?.defaultRate ?? tmpl?.fixedChargeRate ?? 1000;
    const updated: PRChargeItem = {
      ...item,
      applicability: 'AS_PER_FIXED_CHARGES',
      isFixedChargeRule: true,
      fixedChargeRate: targetRate,
      fixedChargeDescription:
        item.fixedChargeDescription ||
        (tmpl ? tmpl.fixedChargeDescription : 'Governed Fixed Tariff'),
      chargeType: tmpl ? tmpl.defaultChargeType : item.chargeType,
      rateOrPercentage: targetRate,
      gstRatePercent: tmpl ? tmpl.gstRatePercent : item.gstRatePercent ?? 18,
    };
    return this.calculateChargeItem(updated, itemsSubtotal);
  },

  /**
   * Locks all charge item snapshots cleanly when a PR is submitted/approved.
   */
  lockChargeSnapshots(charges: PRChargeItem[] | undefined, lockedAtIso = new Date().toISOString()): PRChargeItem[] | undefined {
    if (!charges) return charges;
    return charges.map((c) => (c.snapshotLockedAt ? c : { ...c, snapshotLockedAt: lockedAtIso }));
  },
};
