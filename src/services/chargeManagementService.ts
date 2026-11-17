/**
 * KOSH INNOVATIONS — CENTRALIZED CHARGE MANAGEMENT, ALLOCATION,
 * RECONCILIATION & LANDED COST ENGINE
 *
 * Implements:
 * - All 10 Charge Application Levels
 * - All 12 Calculation Methods & 14 Calculation Bases (backend/pure domain evaluation)
 * - Restricted AST Formula Evaluation & Deterministic Rounding
 * - Domestic GST, RCM, Customs Duty (BCD + SWS), and Import IGST Tax Controls
 * - All 7 Header-to-Line Allocation Methods with Zero-Drift Cent Reconciliation
 * - Full Lifecycle Integration (PR -> RFQ -> Supplier Quote Comparison -> PO -> Shipment/Trip -> Schedule -> Partial GRN -> Invoice)
 * - Estimated -> Quoted -> Approved -> Actual -> Final Reconciled Landed Cost Engine
 * - Mandatory Charge Protection, RBAC Enforcement, Duplicate Guard, Soft Delete, Idempotency & Audit Trail
 */

import { User } from '../types';
import {
  ChargeApplicationLevel,
  ChargeAllocationMethod,
  ChargeAllocationRecord,
  ChargeAllocationLine,
  ChargeApprovalRecord,
  ChargeAuditLogEntry,
  ChargeCalculationInputs,
  ChargeCalculationMethod,
  ChargeCalculationBasis,
  ChargeCalculationSnapshot,
  ChargeDashboardSummary,
  ChargeLifecycleStage,
  ChargeMasterRecord,
  ChargeReconciliationRecord,
  ChargeTaxBreakdown,
  LandedCostItemSummary,
  LandedCostShipmentSummary,
  LandedCostStageBreakdown,
  NormalizedSupplierChargeComparison,
  ShipmentRecord,
  StatutoryTaxMapping,
  SupplierChargeQuotationInclusion,
  TransactionChargeItem,
  TransportTripRecord,
  ChargeApplicabilityStatus,
} from '../types/chargeManagement';
import { chargeMasterService } from './chargeMasterService';
import { evaluateChargeFormula, roundWithRule } from './chargeFormulaEvaluator';
import { rbacPermissionService } from './rbacPermissionService';
import { EnterpriseAuditService } from './enterpriseAuditService';

const STORAGE_KEY_TX_CHARGES = 'kosh_tx_charge_items_v1';
const STORAGE_KEY_RECON = 'kosh_charge_reconciliation_v1';
const STORAGE_KEY_AUDIT = 'kosh_charge_audit_log_v1';
const STORAGE_KEY_SHIPMENTS = 'kosh_charge_shipments_v1';
const STORAGE_KEY_TRIPS = 'kosh_charge_trips_v1';

let memTxCharges: TransactionChargeItem[] | null = null;
let memRecon: ChargeReconciliationRecord[] | null = null;
let memAudit: ChargeAuditLogEntry[] | null = null;
let memShipments: ShipmentRecord[] | null = null;
let memTrips: TransportTripRecord[] | null = null;

export interface AllocationTargetLine {
  lineId: string;
  itemCode: string;
  description?: string;
  materialValue: number;
  quantity: number;
  weightKg?: number;
  volumeCbm?: number;
  manualAmount?: number;
  grnId?: string;
  grnNumber?: string;
  shipmentId?: string;
  deliveryScheduleId?: string;
}

function getStorage<T>(key: string, memRef: T | null, seedFn: () => T): T {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as T;
      }
    } catch {}
  }
  if (memRef !== null) return memRef;
  return seedFn();
}

function setStorage<T>(key: string, data: T): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {}
  }
}

export function computeTaxBreakdown(
  chargeAmount: number,
  taxMapping: StatutoryTaxMapping,
  precision = 2,
  roundingRule: 'HALF_UP' | 'FLOOR' | 'CEIL' | 'BANKERS' = 'HALF_UP',
  customsMaterialAssessableValue = 0
): ChargeTaxBreakdown {
  const safeAmount = Math.max(0, Number(chargeAmount) || 0);
  const ratePct = Math.max(0, Number(taxMapping.ratePercent) || 0);
  const surchargePct = Math.max(0, Number(taxMapping.surchargePercent) || 0);

  // Determine taxable base according to statutory tax treatment without double taxation
  let taxableBase = safeAmount;
  let taxAmount = 0;
  let surchargeAmount = 0;

  if (taxMapping.treatmentType === 'EXEMPT_ZERO_RATED' || taxMapping.treatmentType === 'OUT_OF_SCOPE') {
    taxableBase = safeAmount;
    taxAmount = 0;
    surchargeAmount = 0;
  } else if (taxMapping.treatmentType === 'IMPORT_CUSTOMS_BCD_SWS') {
    // BCD is already the charge amount (or percentage assessed on customs assessable value);
    // Social Welfare Surcharge applies strictly on the BCD amount (never stacked recursively).
    taxableBase = customsMaterialAssessableValue > 0 ? customsMaterialAssessableValue : safeAmount;
    taxAmount = 0; // BCD itself is represented by safeAmount
    surchargeAmount = roundWithRule((safeAmount * surchargePct) / 100, precision, roundingRule);
  } else {
    // DOMESTIC_GST_TAXABLE, DOMESTIC_GST_RCM, IMPORT_IGST
    taxableBase = safeAmount;
    taxAmount = roundWithRule((safeAmount * ratePct) / 100, precision, roundingRule);
    surchargeAmount = 0;
  }

  const totalStatutoryTax = roundWithRule(taxAmount + surchargeAmount, precision, roundingRule);
  const recShare = Math.min(100, Math.max(0, Number(taxMapping.recoverableSharePercent) || 0));

  let recoverableTax = 0;
  let nonRecoverableTax = 0;

  if (taxMapping.recoverability === 'RECOVERABLE_INPUT_CREDIT') {
    recoverableTax = roundWithRule((totalStatutoryTax * recShare) / 100, precision, roundingRule);
    nonRecoverableTax = roundWithRule(totalStatutoryTax - recoverableTax, precision, roundingRule);
  } else if (taxMapping.recoverability === 'PARTIALLY_RECOVERABLE') {
    recoverableTax = roundWithRule((totalStatutoryTax * recShare) / 100, precision, roundingRule);
    nonRecoverableTax = roundWithRule(totalStatutoryTax - recoverableTax, precision, roundingRule);
  } else {
    recoverableTax = 0;
    nonRecoverableTax = totalStatutoryTax;
  }

  // Landed cost includes charge base + non-recoverable taxes (never recoverable ITC)
  const landedCostContribution = roundWithRule(safeAmount + nonRecoverableTax, precision, roundingRule);

  return {
    taxMappingId: taxMapping.id,
    taxCode: taxMapping.taxCode,
    taxName: taxMapping.taxName,
    treatmentType: taxMapping.treatmentType,
    chargeAmount: safeAmount,
    taxableBase,
    taxRatePercent: ratePct,
    surchargePercent: surchargePct,
    taxAmount,
    surchargeAmount,
    recoverableTax,
    nonRecoverableTax,
    landedCostContribution,
  };
}

export function resolveCalculationBasisValue(
  basis: ChargeCalculationBasis,
  inputs: ChargeCalculationInputs
): number {
  switch (basis) {
    case 'MATERIAL_LINE_VALUE':
      return Number(inputs.materialValue) || 0;
    case 'TOTAL_PO_MATERIAL_VALUE':
      return Number(inputs.totalPoMaterialValue ?? inputs.materialValue) || 0;
    case 'NET_QUANTITY':
      return Number(inputs.quantity) || 0;
    case 'RECEIVED_QUANTITY':
      return Number(inputs.receivedQuantity ?? inputs.quantity) || 0;
    case 'GROSS_WEIGHT':
      return Number(inputs.grossWeightKg) || 0;
    case 'NET_WEIGHT':
      return Number(inputs.netWeightKg ?? inputs.grossWeightKg) || 0;
    case 'VOLUME':
      return Number(inputs.volumeCbm) || 0;
    case 'DISTANCE':
      return Number(inputs.distanceKm) || 0;
    case 'NUMBER_OF_SHIPMENTS':
      return Number(inputs.shipmentsCount ?? 1) || 0;
    case 'NUMBER_OF_TRIPS':
      return Number(inputs.tripsCount ?? 1) || 0;
    case 'NUMBER_OF_DAYS':
      return Number(inputs.daysCount ?? 1) || 0;
    case 'ACTUAL_INVOICE_AMOUNT':
      return Number(inputs.actualInvoiceAmount ?? inputs.baseChargeAmountOverride ?? 0) || 0;
    case 'MANUAL_ALLOCATION':
    case 'EQUAL_ALLOCATION':
    default:
      return Number(inputs.baseChargeAmountOverride ?? inputs.materialValue) || 0;
  }
}

export function executeChargeCalculation(
  inputs: ChargeCalculationInputs,
  transactionChargeId = 'preview',
  version = 1,
  calculatedBy = 'System Engine'
): ChargeCalculationSnapshot {
  if (inputs.rate < 0) {
    throw new Error('Charge rate cannot be negative.');
  }
  if (inputs.exchangeRate <= 0) {
    throw new Error('Exchange rate must be greater than zero.');
  }

  const rawBasisValue = resolveCalculationBasisValue(inputs.basis, inputs);
  let rawComputed = 0;
  let formulaTrace: string | undefined;

  switch (inputs.method) {
    case 'FIXED_AMOUNT':
      rawComputed = inputs.rate;
      break;
    case 'PERCENTAGE':
      rawComputed = (rawBasisValue * inputs.rate) / 100;
      break;
    case 'PER_UNIT': {
      const qty =
        inputs.basis === 'RECEIVED_QUANTITY'
          ? Number(inputs.receivedQuantity ?? inputs.quantity ?? 0)
          : Number(inputs.quantity ?? rawBasisValue ?? 0);
      rawComputed = inputs.rate * qty;
      break;
    }
    case 'PER_KG': {
      const weightKg = Number(inputs.grossWeightKg ?? inputs.netWeightKg ?? rawBasisValue ?? 0);
      rawComputed = inputs.rate * weightKg;
      break;
    }
    case 'PER_MT': {
      const weightKg = Number(inputs.grossWeightKg ?? inputs.netWeightKg ?? 0);
      const weightMt = weightKg > 0 ? weightKg / 1000 : rawBasisValue;
      rawComputed = inputs.rate * weightMt;
      break;
    }
    case 'PER_VOLUME': {
      const vol = Number(inputs.volumeCbm ?? rawBasisValue ?? 0);
      rawComputed = inputs.rate * vol;
      break;
    }
    case 'PER_KM': {
      const km = Number(inputs.distanceKm ?? rawBasisValue ?? 0);
      rawComputed = inputs.rate * km;
      break;
    }
    case 'PER_SHIPMENT': {
      const ships = Number(inputs.shipmentsCount ?? rawBasisValue ?? 1);
      rawComputed = inputs.rate * ships;
      break;
    }
    case 'PER_TRIP': {
      const trips = Number(inputs.tripsCount ?? rawBasisValue ?? 1);
      rawComputed = inputs.rate * trips;
      break;
    }
    case 'PER_DAY': {
      const days = Number(inputs.daysCount ?? rawBasisValue ?? 1);
      rawComputed = inputs.rate * days;
      break;
    }
    case 'ACTUAL_COST': {
      rawComputed = Number(inputs.actualInvoiceAmount ?? inputs.baseChargeAmountOverride ?? inputs.rate) || 0;
      break;
    }
    case 'FORMULA_BASED': {
      const weightKg = Number(inputs.grossWeightKg ?? 0);
      const evalRes = evaluateChargeFormula(inputs.formulaExpression || 'rate', {
        materialValue: inputs.materialValue,
        totalPoMaterialValue: inputs.totalPoMaterialValue ?? inputs.materialValue,
        quantity: inputs.quantity,
        receivedQuantity: inputs.receivedQuantity ?? inputs.quantity,
        grossWeightKg: weightKg,
        netWeightKg: inputs.netWeightKg ?? weightKg,
        weightMt: weightKg / 1000,
        volumeCbm: inputs.volumeCbm ?? 0,
        distanceKm: inputs.distanceKm ?? 0,
        shipments: inputs.shipmentsCount ?? 1,
        trips: inputs.tripsCount ?? 1,
        days: inputs.daysCount ?? 1,
        rate: inputs.rate,
        customsValue: inputs.customsValue ?? inputs.materialValue,
        invoiceAmount: inputs.actualInvoiceAmount ?? 0,
      });
      rawComputed = evalRes.value;
      formulaTrace = evalRes.trace;
      break;
    }
    default:
      rawComputed = inputs.rate;
  }

  if (rawComputed < 0) {
    throw new Error(`Negative computed charge (${rawComputed}) is prohibited.`);
  }

  // Min / Max clamp (only apply non-zero minimum if rawComputed > 0 or method requires floor)
  let clamped = rawComputed;
  if (inputs.minimumCharge !== undefined && inputs.minimumCharge > 0 && rawComputed > 0) {
    clamped = Math.max(inputs.minimumCharge, clamped);
  }
  if (inputs.maximumCharge !== undefined && inputs.maximumCharge > 0) {
    clamped = Math.min(inputs.maximumCharge, clamped);
  }

  const roundedSource = roundWithRule(clamped, inputs.decimalPrecision, inputs.roundingRule);
  const convertedReporting = roundWithRule(
    roundedSource * inputs.exchangeRate,
    inputs.decimalPrecision,
    inputs.roundingRule
  );

  const taxBreakdown = computeTaxBreakdown(
    roundedSource,
    inputs.taxMapping,
    inputs.decimalPrecision,
    inputs.roundingRule,
    inputs.customsValue ?? inputs.materialValue
  );

  const totalWithTax = roundWithRule(
    roundedSource + taxBreakdown.taxAmount + taxBreakdown.surchargeAmount,
    inputs.decimalPrecision,
    inputs.roundingRule
  );

  return {
    id: `ccalc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    transactionChargeId,
    version,
    calculatedAt: new Date().toISOString(),
    calculatedBy,
    inputs,
    rawBasisValue,
    rawComputedAmount: rawComputed,
    clampedAmount: roundedSource,
    convertedCurrencyAmount: convertedReporting,
    taxBreakdown,
    totalWithTax,
    formulaAuditTrace: formulaTrace,
  };
}

/**
 * Deterministic largest-remainder apportionment so sum(allocated) === targetTotal exactly.
 */
function distributeAmountDeterministically(
  totalAmount: number,
  weights: number[],
  precision = 2
): { shares: number[]; delta: number } {
  const factor = Math.pow(10, precision);
  const targetUnits = Math.round(totalAmount * factor);
  if (weights.length === 0 || targetUnits === 0) {
    return { shares: weights.map(() => 0), delta: 0 };
  }

  const totalWeight = weights.reduce((acc, w) => acc + Math.max(0, w), 0);
  if (totalWeight <= 0) {
    // Equal fallback
    const eqWeights = weights.map(() => 1);
    return distributeAmountDeterministically(totalAmount, eqWeights, precision);
  }

  const exactShares = weights.map((w) => (targetUnits * Math.max(0, w)) / totalWeight);
  const floored = exactShares.map((s) => Math.floor(s));
  let remainder = targetUnits - floored.reduce((acc, v) => acc + v, 0);

  const indexedRemainders = exactShares
    .map((s, idx) => ({ idx, frac: s - floored[idx] }))
    .sort((a, b) => b.frac - a.frac || a.idx - b.idx);

  let ptr = 0;
  while (remainder > 0 && indexedRemainders.length > 0) {
    floored[indexedRemainders[ptr % indexedRemainders.length].idx] += 1;
    remainder -= 1;
    ptr += 1;
  }

  const shares = floored.map((u) => u / factor);
  const sumShares = shares.reduce((acc, s) => acc + s, 0);
  return {
    shares,
    delta: Number((totalAmount - sumShares).toFixed(precision)),
  };
}

function createInitialShipments(): ShipmentRecord[] {
  return [
    {
      id: 'ship-demo-001',
      shipmentNumber: 'SHIP-2026-0001',
      poId: 'po-001',
      poNumber: 'PO-2026-0001',
      companyId: 'co-kosh-01',
      branchId: 'br-pond-01',
      vendorId: 'bp-002',
      vendorName: 'BASF INDIA LIMITED',
      procurementType: 'DOMESTIC',
      shipmentMethod: 'ROAD',
      incoterms: 'EXW',
      vehicleOrVesselName: 'TN-01-BX-4421 (Dedicated LCV)',
      dispatchDate: '2026-11-12',
      estimatedArrivalDate: '2026-11-14',
      distanceKm: 185,
      grossWeightKg: 300,
      volumeCbm: 1.8,
      currency: 'INR',
      status: 'DELIVERED',
      lineQuantities: [
        { poLineId: 'pol-001', itemCode: 'RMPAOPOEXLG0001', shippedQtyPurchUom: 12, weightKg: 300, volumeCbm: 1.8 },
      ],
      createdBy: 'Vikram Singh',
      createdAt: '2026-11-12T08:00:00Z',
    },
  ];
}

function createInitialTrips(): TransportTripRecord[] {
  return [
    {
      id: 'trip-demo-001',
      tripNumber: 'TRIP-2026-0001',
      poId: 'po-001',
      poNumber: 'PO-2026-0001',
      shipmentId: 'ship-demo-001',
      shipmentNumber: 'SHIP-2026-0001',
      transporterName: 'SafeExpress Industrial Logistics',
      vehicleNumber: 'TN-01-BX-4421',
      originLocation: 'Chennai Industrial Hub',
      destinationLocation: 'Puducherry Main Plant & HQ',
      distanceKm: 185,
      tripDays: 1,
      freightRate: 42,
      currency: 'INR',
      tripDate: '2026-11-12',
      status: 'COMPLETED',
    },
  ];
}

function createInitialTxCharges(): TransactionChargeItem[] {
  const masterFreight = chargeMasterService.getChargeByIdOrCode('CHG-FREIGHT')!;
  const masterLoad = chargeMasterService.getChargeByIdOrCode('CHG-LOAD')!;
  const taxGta = chargeMasterService.getTaxMappingById(masterFreight.defaultTaxMappingId);
  const taxGst = chargeMasterService.getTaxMappingById(masterLoad.defaultTaxMappingId);

  const freightSnap = executeChargeCalculation(
    {
      method: 'FIXED_AMOUNT',
      basis: 'TOTAL_PO_MATERIAL_VALUE',
      rate: 4500,
      materialValue: 81600,
      totalPoMaterialValue: 81600,
      quantity: 12,
      sourceCurrency: 'INR',
      targetCurrency: 'INR',
      exchangeRate: 1,
      roundingRule: 'HALF_UP',
      decimalPrecision: 2,
      taxMapping: taxGta,
    },
    'txchg-seed-po1-freight',
    1,
    'Vikram Singh'
  );

  const loadSnap = executeChargeCalculation(
    {
      method: 'FIXED_AMOUNT',
      basis: 'NET_QUANTITY',
      rate: 1500,
      materialValue: 145000,
      totalPoMaterialValue: 145000,
      quantity: 500,
      sourceCurrency: 'INR',
      targetCurrency: 'INR',
      exchangeRate: 1,
      roundingRule: 'HALF_UP',
      decimalPrecision: 2,
      taxMapping: taxGst,
    },
    'txchg-seed-pr1-load',
    1,
    'Arun Kumar'
  );

  return [
    {
      id: 'txchg-seed-pr1-load',
      idempotencyKey: 'seed-pr1-load',
      chargeMasterId: masterLoad.id,
      chargeCode: masterLoad.chargeCode,
      chargeName: masterLoad.chargeName,
      chargeCategory: masterLoad.chargeCategory,
      procurementType: 'DOMESTIC',
      sourceDocumentType: 'PR',
      sourceDocumentId: 'pr-001',
      sourceDocumentNumber: 'PR-2026-0001',
      originPrId: 'pr-001',
      originPrNumber: 'PR-2026-0001',
      applicationLevel: 'PR_HEADER',
      applicability: 'MANDATORY',
      calculationMethod: 'FIXED_AMOUNT',
      calculationBasis: 'NET_QUANTITY',
      allocationMethod: 'PROPORTIONAL_VALUE',
      rate: 1500,
      currency: 'INR',
      targetReportingCurrency: 'INR',
      exchangeRateUsed: 1,
      chargeBearer: 'BUYER',
      supplierInclusionMode: 'SEPARATELY_QUOTED',
      taxMappingId: taxGst.id,
      lifecycleStage: 'ESTIMATED',
      estimatedChargeAmount: 1500,
      quotedChargeAmount: 0,
      approvedChargeAmount: 0,
      actualChargeAmount: 0,
      chargeAmount: 1500,
      chargeAmountReportingCurrency: 1500,
      taxBreakdown: loadSnap.taxBreakdown,
      totalWithTax: loadSnap.totalWithTax,
      allocationStatus: 'UNALLOCATED',
      allocatedAmount: 0,
      remainingUnallocatedAmount: 1500,
      allocationHistory: [],
      approvalStatus: 'NOT_REQUIRED',
      approvals: [],
      reconciliationStatus: 'ESTIMATED_ONLY',
      calculationHistory: [loadSnap],
      attachments: [],
      remarks: 'Initial estimated dock loading fee for PR-2026-0001',
      createdBy: 'Arun Kumar',
      createdAt: '2026-10-01T10:00:00Z',
      updatedBy: 'Arun Kumar',
      updatedAt: '2026-10-01T10:00:00Z',
    },
    {
      id: 'txchg-seed-po1-freight',
      idempotencyKey: 'seed-po1-freight',
      chargeMasterId: masterFreight.id,
      chargeCode: masterFreight.chargeCode,
      chargeName: masterFreight.chargeName,
      chargeCategory: masterFreight.chargeCategory,
      procurementType: 'DOMESTIC',
      sourceDocumentType: 'PO',
      sourceDocumentId: 'po-001',
      sourceDocumentNumber: 'PO-2026-0001',
      originPrId: 'pr-001',
      originPrNumber: 'PR-2026-0001',
      originRfqId: 'rfq-001',
      originRfqNumber: 'RFQ-2026-0001',
      originPoId: 'po-001',
      originPoNumber: 'PO-2026-0001',
      supplierId: 'bp-002',
      supplierName: 'BASF INDIA LIMITED',
      applicationLevel: 'PO_HEADER',
      applicability: 'MANDATORY',
      calculationMethod: 'FIXED_AMOUNT',
      calculationBasis: 'TOTAL_PO_MATERIAL_VALUE',
      allocationMethod: 'PROPORTIONAL_VALUE',
      rate: 4500,
      currency: 'INR',
      targetReportingCurrency: 'INR',
      exchangeRateUsed: 1,
      chargeBearer: 'BUYER',
      supplierInclusionMode: 'SEPARATELY_QUOTED',
      taxMappingId: taxGta.id,
      lifecycleStage: 'APPROVED',
      estimatedChargeAmount: 4500,
      quotedChargeAmount: 4500,
      approvedChargeAmount: 4500,
      actualChargeAmount: 0,
      chargeAmount: 4500,
      chargeAmountReportingCurrency: 4500,
      taxBreakdown: freightSnap.taxBreakdown,
      totalWithTax: freightSnap.totalWithTax,
      allocationStatus: 'UNALLOCATED',
      allocatedAmount: 0,
      remainingUnallocatedAmount: 4500,
      allocationHistory: [],
      approvalStatus: 'APPROVED',
      approvals: [],
      reconciliationStatus: 'APPROVED_PENDING_ACTUAL',
      calculationHistory: [freightSnap],
      attachments: [],
      remarks: 'Approved line-haul freight for PO-2026-0001',
      createdBy: 'Vikram Singh',
      createdAt: '2026-11-10T11:00:00Z',
      updatedBy: 'Vikram Singh',
      updatedAt: '2026-11-10T11:00:00Z',
    },
  ];
}

function assertAuthorized(user: User | undefined, permission: any, actionDescription: string): void {
  if (!user) return; // System/internal workflow execution when explicit user not passed
  if (user.role === 'PLATFORM_ADMIN' || user.role === 'ORG_ADMIN') return;
  if (!rbacPermissionService.hasPermission(user, permission)) {
    throw new Error(
      `RBAC Authorization Denied: User "${user.fullName}" (${user.role}) lacks "${permission}" permission to ${actionDescription}.`
    );
  }
}

export const chargeManagementService = {
  resetForTesting(): void {
    chargeMasterService.resetForTesting();
    memTxCharges = createInitialTxCharges();
    memRecon = [];
    memAudit = [];
    memShipments = createInitialShipments();
    memTrips = createInitialTrips();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_TX_CHARGES);
      localStorage.removeItem(STORAGE_KEY_RECON);
      localStorage.removeItem(STORAGE_KEY_AUDIT);
      localStorage.removeItem(STORAGE_KEY_SHIPMENTS);
      localStorage.removeItem(STORAGE_KEY_TRIPS);
    }
  },

  getTransactionCharges(includeDeleted = false): TransactionChargeItem[] {
    const list = getStorage<TransactionChargeItem[]>(STORAGE_KEY_TX_CHARGES, memTxCharges, createInitialTxCharges);
    memTxCharges = list;
    return includeDeleted ? list : list.filter((c) => !c.isSoftDeleted);
  },

  saveTransactionCharges(list: TransactionChargeItem[]): void {
    memTxCharges = JSON.parse(JSON.stringify(list));
    setStorage(STORAGE_KEY_TX_CHARGES, memTxCharges);
  },

  getAuditLogs(): ChargeAuditLogEntry[] {
    const list = getStorage<ChargeAuditLogEntry[]>(STORAGE_KEY_AUDIT, memAudit, () => []);
    memAudit = list;
    return list;
  },

  recordAudit(entry: Omit<ChargeAuditLogEntry, 'id' | 'timestamp'>): ChargeAuditLogEntry {
    const rec: ChargeAuditLogEntry = {
      ...entry,
      id: `caud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    const next = [rec, ...this.getAuditLogs()];
    memAudit = next;
    setStorage(STORAGE_KEY_AUDIT, next);

    EnterpriseAuditService.logEvent({
      companyId: 'co-kosh-01',
      entityType: 'CHARGE_GOVERNANCE',
      entityId: entry.transactionChargeId,
      eventType: `CHARGE_${entry.action}`,
      eventDescription: `Charge ${entry.action} on ${entry.sourceDocumentType} ${entry.sourceDocumentNumber}`,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      changedByUserId: entry.actorId,
      changedByName: entry.actorName,
      changeReason: entry.reason || `[Charge ${entry.action}]`,
    });
    return rec;
  },

  getChargesForDocument(
    sourceDocumentType: TransactionChargeItem['sourceDocumentType'],
    sourceDocumentIdOrNumber: string
  ): TransactionChargeItem[] {
    return this.getTransactionCharges().filter(
      (c) =>
        c.sourceDocumentType === sourceDocumentType &&
        (c.sourceDocumentId === sourceDocumentIdOrNumber || c.sourceDocumentNumber === sourceDocumentIdOrNumber)
    );
  },

  /**
   * Creates or attaches a governed Transaction Charge Item across any of the 10 application levels.
   */
  addTransactionCharge(
    params: {
      idempotencyKey?: string;
      chargeCodeOrId: string;
      procurementType?: 'DOMESTIC' | 'IMPORT';
      sourceDocumentType: TransactionChargeItem['sourceDocumentType'];
      sourceDocumentId: string;
      sourceDocumentNumber: string;
      sourceLineId?: string;
      originPrId?: string;
      originPrNumber?: string;
      originPrLineId?: string;
      originRfqId?: string;
      originRfqNumber?: string;
      originQuotationId?: string;
      originPoId?: string;
      originPoNumber?: string;
      originPoLineId?: string;
      shipmentId?: string;
      shipmentNumber?: string;
      deliveryScheduleId?: string;
      grnId?: string;
      grnNumber?: string;
      transportTripId?: string;
      invoiceId?: string;
      invoiceNumber?: string;
      supplierId?: string;
      supplierName?: string;
      incoterms?: string;
      applicationLevel?: ChargeApplicationLevel;
      applicability?: ChargeApplicabilityStatus;
      conditionalConfirmed?: boolean;
      calculationMethod?: ChargeCalculationMethod;
      calculationBasis?: ChargeCalculationBasis;
      allocationMethod?: ChargeAllocationMethod;
      rate?: number;
      formulaExpression?: string;
      currency?: string;
      targetReportingCurrency?: string;
      taxMappingId?: string;
      supplierInclusionMode?: SupplierChargeQuotationInclusion;
      materialValue?: number;
      totalPoMaterialValue?: number;
      quantity?: number;
      receivedQuantity?: number;
      grossWeightKg?: number;
      netWeightKg?: number;
      volumeCbm?: number;
      distanceKm?: number;
      shipmentsCount?: number;
      tripsCount?: number;
      daysCount?: number;
      actualInvoiceAmount?: number;
      customsValue?: number;
      baseChargeAmountOverride?: number;
      remarks?: string;
      exceptionApprovalRef?: string;
    },
    actor: { id: string; name: string; user?: User }
  ): TransactionChargeItem {
    if (actor.user) {
      assertAuthorized(actor.user, 'CHARGE_TRANSACTION_EDIT', 'create or attach transaction charges');
    }

    const existingAll = this.getTransactionCharges(false);

    // Idempotency guard
    if (params.idempotencyKey) {
      const idem = existingAll.find((c) => c.idempotencyKey === params.idempotencyKey);
      if (idem) return idem;
    }

    const master = chargeMasterService.getChargeByIdOrCode(params.chargeCodeOrId);
    if (!master) {
      throw new Error(`Charge Master "${params.chargeCodeOrId}" not found.`);
    }
    if (!master.isActive) {
      throw new Error(`Inactive Charge "${master.chargeCode}" (${master.chargeName}) cannot be newly selected.`);
    }

    const appLevel = params.applicationLevel || master.defaultApplicationLevel;
    if (!master.permittedApplicationLevels.includes(appLevel)) {
      throw new Error(
        `Application level "${appLevel}" is not permitted for Charge "${master.chargeCode}". Allowed: ${master.permittedApplicationLevels.join(', ')}`
      );
    }

    // Prevent duplicate charge on exact same document/line/level/chargeCode
    const duplicate = existingAll.find(
      (c) =>
        c.sourceDocumentType === params.sourceDocumentType &&
        c.sourceDocumentId === params.sourceDocumentId &&
        (c.sourceLineId || '') === (params.sourceLineId || '') &&
        (c.shipmentId || '') === (params.shipmentId || '') &&
        (c.deliveryScheduleId || '') === (params.deliveryScheduleId || '') &&
        (c.grnId || '') === (params.grnId || '') &&
        c.applicationLevel === appLevel &&
        c.chargeCode === master.chargeCode
    );
    if (duplicate) {
      throw new Error(
        `Duplicate charge prevented: "${master.chargeCode}" is already attached to ${params.sourceDocumentType} ${params.sourceDocumentNumber} at level ${appLevel}.`
      );
    }

    const procurementType = params.procurementType || 'DOMESTIC';
    const evalRes = chargeMasterService.evaluateApplicability(
      master,
      {
        procurementType,
        supplierId: params.supplierId,
        incoterms: params.incoterms,
        currency: params.currency || master.defaultCurrency,
        materialValue: params.materialValue ?? params.totalPoMaterialValue ?? 0,
        quantity: params.quantity ?? 0,
        weightKg: params.grossWeightKg,
        volumeCbm: params.volumeCbm,
        hasDeliverySchedule: Boolean(params.deliveryScheduleId),
      },
      appLevel
    );

    const effectiveApplicability = params.applicability || evalRes.applicability;

    // Enforce mandatory charge protection (cannot set NOT_APPLICABLE on MANDATORY without exception approval)
    if (evalRes.applicability === 'MANDATORY' && effectiveApplicability === 'NOT_APPLICABLE') {
      if (!params.exceptionApprovalRef) {
        throw new Error(
          `Mandatory charge "${master.chargeName}" cannot be bypassed without an authorized exception approval reference.`
        );
      }
    }

    const method = params.calculationMethod || master.defaultCalculationMethod;
    const basis = params.calculationBasis || master.defaultCalculationBasis;
    const allocationMethod = params.allocationMethod || master.defaultAllocationBasis;
    const rate = params.rate !== undefined ? Number(params.rate) : master.defaultRate;
    const formulaExpression = params.formulaExpression ?? master.defaultFormulaExpression;
    const sourceCurrency = (params.currency || master.defaultCurrency || 'INR').toUpperCase();
    const targetCurrency = (params.targetReportingCurrency || 'INR').toUpperCase();
    const exchangeRate = chargeMasterService.getExchangeRate(sourceCurrency, targetCurrency);
    const taxMapping = chargeMasterService.getTaxMappingById(params.taxMappingId || master.defaultTaxMappingId);

    const txId = `txchg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const supplierInclusionMode = params.supplierInclusionMode || 'SEPARATELY_QUOTED';

    let calcSnapshot: ChargeCalculationSnapshot;
    if (effectiveApplicability === 'NOT_APPLICABLE' || supplierInclusionMode === 'INCLUDED_IN_MATERIAL_PRICE') {
      calcSnapshot = executeChargeCalculation(
        {
          method: 'FIXED_AMOUNT',
          basis,
          rate: 0,
          materialValue: params.materialValue ?? 0,
          totalPoMaterialValue: params.totalPoMaterialValue ?? params.materialValue ?? 0,
          quantity: params.quantity ?? 0,
          sourceCurrency,
          targetCurrency,
          exchangeRate,
          roundingRule: master.roundingRule,
          decimalPrecision: master.decimalPrecision,
          taxMapping,
        },
        txId,
        1,
        actor.name
      );
    } else {
      calcSnapshot = executeChargeCalculation(
        {
          method,
          basis,
          rate,
          formulaExpression,
          materialValue: params.materialValue ?? 0,
          totalPoMaterialValue: params.totalPoMaterialValue ?? params.materialValue ?? 0,
          quantity: params.quantity ?? 0,
          receivedQuantity: params.receivedQuantity,
          grossWeightKg: params.grossWeightKg,
          netWeightKg: params.netWeightKg,
          volumeCbm: params.volumeCbm,
          distanceKm: params.distanceKm,
          shipmentsCount: params.shipmentsCount,
          tripsCount: params.tripsCount,
          daysCount: params.daysCount,
          actualInvoiceAmount: params.actualInvoiceAmount,
          customsValue: params.customsValue,
          baseChargeAmountOverride: params.baseChargeAmountOverride,
          sourceCurrency,
          targetCurrency,
          exchangeRate,
          minimumCharge: master.minimumCharge,
          maximumCharge: master.maximumCharge,
          roundingRule: master.roundingRule,
          decimalPrecision: master.decimalPrecision,
          taxMapping,
        },
        txId,
        1,
        actor.name
      );
    }

    const stage: ChargeLifecycleStage =
      params.sourceDocumentType === 'PR'
        ? 'ESTIMATED'
        : params.sourceDocumentType === 'RFQ' || params.sourceDocumentType === 'QUOTATION'
        ? 'QUOTED'
        : params.sourceDocumentType === 'PO'
        ? 'APPROVED'
        : 'ACTUAL';

    const baseAmt = calcSnapshot.clampedAmount;
    const now = new Date().toISOString();

    const record: TransactionChargeItem = {
      id: txId,
      idempotencyKey: params.idempotencyKey,
      chargeMasterId: master.id,
      chargeCode: master.chargeCode,
      chargeName: master.chargeName,
      chargeCategory: master.chargeCategory,
      procurementType,
      sourceDocumentType: params.sourceDocumentType,
      sourceDocumentId: params.sourceDocumentId,
      sourceDocumentNumber: params.sourceDocumentNumber,
      sourceLineId: params.sourceLineId,
      originPrId: params.originPrId || (params.sourceDocumentType === 'PR' ? params.sourceDocumentId : undefined),
      originPrNumber: params.originPrNumber || (params.sourceDocumentType === 'PR' ? params.sourceDocumentNumber : undefined),
      originPrLineId: params.originPrLineId,
      originRfqId: params.originRfqId,
      originRfqNumber: params.originRfqNumber,
      originQuotationId: params.originQuotationId,
      originPoId: params.originPoId || (params.sourceDocumentType === 'PO' ? params.sourceDocumentId : undefined),
      originPoNumber: params.originPoNumber || (params.sourceDocumentType === 'PO' ? params.sourceDocumentNumber : undefined),
      originPoLineId: params.originPoLineId,
      shipmentId: params.shipmentId,
      shipmentNumber: params.shipmentNumber,
      deliveryScheduleId: params.deliveryScheduleId,
      grnId: params.grnId,
      grnNumber: params.grnNumber,
      transportTripId: params.transportTripId,
      invoiceId: params.invoiceId,
      invoiceNumber: params.invoiceNumber,
      supplierId: params.supplierId,
      supplierName: params.supplierName,
      incoterms: params.incoterms,
      applicationLevel: appLevel,
      applicability: effectiveApplicability,
      conditionalConfirmed: params.conditionalConfirmed,
      calculationMethod: method,
      calculationBasis: basis,
      allocationMethod,
      rate,
      formulaExpression,
      currency: sourceCurrency,
      targetReportingCurrency: targetCurrency,
      exchangeRateUsed: exchangeRate,
      chargeBearer: master.chargeBearer,
      supplierInclusionMode,
      taxMappingId: taxMapping.id,
      lifecycleStage: stage,
      estimatedChargeAmount: stage === 'ESTIMATED' ? baseAmt : 0,
      quotedChargeAmount: stage === 'QUOTED' ? baseAmt : 0,
      approvedChargeAmount: stage === 'APPROVED' ? baseAmt : 0,
      actualChargeAmount: stage === 'ACTUAL' ? baseAmt : 0,
      chargeAmount: baseAmt,
      chargeAmountReportingCurrency: calcSnapshot.convertedCurrencyAmount,
      taxBreakdown: calcSnapshot.taxBreakdown,
      totalWithTax: calcSnapshot.totalWithTax,
      allocationStatus: 'UNALLOCATED',
      allocatedAmount: 0,
      remainingUnallocatedAmount: baseAmt,
      allocationHistory: [],
      approvalStatus: params.exceptionApprovalRef ? 'APPROVED' : 'NOT_REQUIRED',
      approvals: [],
      reconciliationStatus:
        stage === 'ESTIMATED'
          ? 'ESTIMATED_ONLY'
          : stage === 'QUOTED'
          ? 'QUOTED_PENDING_APPROVAL'
          : stage === 'APPROVED'
          ? 'APPROVED_PENDING_ACTUAL'
          : 'PENDING_RECONCILIATION',
      calculationHistory: [calcSnapshot],
      attachments: [],
      remarks: params.remarks,
      createdBy: actor.name,
      createdAt: now,
      updatedBy: actor.name,
      updatedAt: now,
    };

    const allWithDeleted = this.getTransactionCharges(true);
    this.saveTransactionCharges([record, ...allWithDeleted]);

    this.recordAudit({
      transactionChargeId: record.id,
      sourceDocumentType: record.sourceDocumentType,
      sourceDocumentNumber: record.sourceDocumentNumber,
      action: 'CREATED',
      actorId: actor.id,
      actorName: actor.name,
      newValue: {
        chargeCode: record.chargeCode,
        applicationLevel: record.applicationLevel,
        method: record.calculationMethod,
        chargeAmount: record.chargeAmount,
        currency: record.currency,
      },
      reason: `Attached ${record.chargeCode} at ${record.applicationLevel}`,
      calculationVersion: 1,
      approvalReference: params.exceptionApprovalRef,
    });

    return record;
  },

  /**
   * Allocates a Transaction Charge across target lines (PR/PO/Shipment/GRN) deterministically.
   * Preserves previous allocation versions, prevents silently overwriting manually approved allocations,
   * and enforces partial GRN / split-delivery non-duplication.
   */
  allocateChargeToLines(
    params: {
      transactionChargeId: string;
      allocationMethod?: ChargeAllocationMethod;
      targetLines: AllocationTargetLine[];
      portionFactor?: number; // e.g., 0.4 for 40 of 100 units on partial GRN
      grnId?: string;
      isManualOverride?: boolean;
      overrideReason?: string;
      isApprovedOverride?: boolean;
    },
    actor: { id: string; name: string; user?: User }
  ): ChargeAllocationRecord {
    const all = this.getTransactionCharges(true);
    const idx = all.findIndex((c) => c.id === params.transactionChargeId && !c.isSoftDeleted);
    if (idx === -1) throw new Error(`Transaction Charge "${params.transactionChargeId}" not found.`);
    const tx = { ...all[idx] };

    if (params.isManualOverride) {
      if (actor.user) {
        assertAuthorized(actor.user, 'CHARGE_ALLOCATION_OVERRIDE', 'override charge allocation manually');
      }
      if (!params.overrideReason?.trim()) {
        throw new Error('Explicit override reason is mandatory for manual allocation overrides.');
      }
    }

    const latestAlloc = tx.allocationHistory[0];
    if (latestAlloc?.isManuallyOverridden && latestAlloc?.isApprovedOverride && !params.isManualOverride) {
      throw new Error(
        'Cannot silently overwrite a manually approved charge allocation. Submit an authorized manual allocation override.'
      );
    }

    // Prevent duplicate GRN allocation for the exact same GRN ID
    if (params.grnId) {
      const alreadyAllocatedForGrn = tx.allocationHistory.some((h) =>
        h.lines.some((l) => l.grnId === params.grnId)
      );
      if (alreadyAllocatedForGrn) {
        throw new Error(`Duplicate allocation blocked: Charge ${tx.chargeCode} already allocated for GRN ${params.grnId}.`);
      }
    }

    const method = params.allocationMethod || tx.allocationMethod;
    const taxMapping = chargeMasterService.getTaxMappingById(tx.taxMappingId);
    const recShare =
      taxMapping.recoverability === 'RECOVERABLE_INPUT_CREDIT' || taxMapping.recoverability === 'PARTIALLY_RECOVERABLE'
        ? (taxMapping.recoverableSharePercent || 0) / 100
        : 0;

    const totalChargeRemaining = tx.chargeAmount;
    const targetAllocationBase =
      params.portionFactor !== undefined && params.portionFactor > 0 && params.portionFactor <= 1
        ? roundWithRule(tx.chargeAmount * params.portionFactor, 2, 'HALF_UP')
        : totalChargeRemaining;

    if (targetAllocationBase > tx.remainingUnallocatedAmount + 0.01 && !params.isManualOverride && params.grnId) {
      throw new Error(
        `Allocation exceeds remaining unallocated charge balance (${tx.remainingUnallocatedAmount} ${tx.currency}).`
      );
    }

    let weights: number[] = [];
    if (method === 'EQUAL_DISTRIBUTION') {
      weights = params.targetLines.map(() => 1);
    } else if (method === 'PROPORTIONAL_VALUE') {
      weights = params.targetLines.map((l) => l.materialValue);
    } else if (method === 'PROPORTIONAL_QUANTITY') {
      weights = params.targetLines.map((l) => l.quantity);
    } else if (method === 'PROPORTIONAL_WEIGHT') {
      weights = params.targetLines.map((l) => l.weightKg ?? l.quantity);
    } else if (method === 'PROPORTIONAL_VOLUME') {
      weights = params.targetLines.map((l) => l.volumeCbm ?? l.quantity);
    } else if (method === 'DIRECT_LINE_ALLOCATION') {
      weights = params.targetLines.map((l, i) =>
        tx.sourceLineId ? (l.lineId === tx.sourceLineId ? 1 : 0) : i === 0 ? 1 : 0
      );
    } else {
      // MANUAL_ALLOCATION
      weights = params.targetLines.map((l) => Number(l.manualAmount) || 0);
    }

    let shares: number[] = [];
    let delta = 0;

    if (method === 'MANUAL_ALLOCATION' && params.targetLines.some((l) => l.manualAmount !== undefined)) {
      const manualSum = params.targetLines.reduce((acc, l) => acc + (Number(l.manualAmount) || 0), 0);
      if (Math.abs(manualSum - targetAllocationBase) > 0.05) {
        throw new Error(
          `Manual allocation sum (${manualSum}) must reconcile exactly with charge amount (${targetAllocationBase}).`
        );
      }
      shares = params.targetLines.map((l) => roundWithRule(Number(l.manualAmount) || 0, 2, 'HALF_UP'));
      delta = roundWithRule(targetAllocationBase - shares.reduce((a, b) => a + b, 0), 2, 'HALF_UP');
    } else {
      const dist = distributeAmountDeterministically(targetAllocationBase, weights, 2);
      shares = dist.shares;
      delta = dist.delta;
    }

    const totalWeight = weights.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const totalTaxOnCharge = roundWithRule(
      (tx.taxBreakdown.taxAmount + tx.taxBreakdown.surchargeAmount) *
        (tx.chargeAmount > 0 ? targetAllocationBase / tx.chargeAmount : 0),
      2,
      'HALF_UP'
    );
    const { shares: taxShares } = distributeAmountDeterministically(totalTaxOnCharge, weights, 2);

    const allocRecordId = `calloc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const version = (tx.allocationHistory[0]?.version || 0) + 1;

    const allocLines: ChargeAllocationLine[] = params.targetLines.map((line, i) => {
      const amt = shares[i] || 0;
      const lineTax = taxShares[i] || 0;
      const recTax = roundWithRule(lineTax * recShare, 2, 'HALF_UP');
      const nonRecTax = roundWithRule(lineTax - recTax, 2, 'HALF_UP');
      return {
        id: `callocl-${Date.now()}-${i}`,
        allocationRecordId: allocRecordId,
        targetLineId: line.lineId,
        targetItemCode: line.itemCode,
        targetDescription: line.description,
        grnId: line.grnId || params.grnId,
        grnNumber: line.grnNumber,
        shipmentId: line.shipmentId,
        deliveryScheduleId: line.deliveryScheduleId,
        allocationWeightFactor: Number((Math.max(0, weights[i]) / totalWeight).toFixed(6)),
        allocatedChargeAmount: amt,
        allocatedTaxAmount: lineTax,
        allocatedRecoverableTax: recTax,
        allocatedNonRecoverableTax: nonRecTax,
        allocatedLandedCostContribution: roundWithRule(amt + nonRecTax, 2, 'HALF_UP'),
      };
    });

    const allocatedNow = roundWithRule(allocLines.reduce((a, l) => a + l.allocatedChargeAmount, 0), 2, 'HALF_UP');
    const cumulativeAllocated = params.grnId
      ? roundWithRule((tx.allocatedAmount || 0) + allocatedNow, 2, 'HALF_UP')
      : allocatedNow;
    const remaining = roundWithRule(Math.max(0, tx.chargeAmount - cumulativeAllocated), 2, 'HALF_UP');

    const allocRecord: ChargeAllocationRecord = {
      id: allocRecordId,
      transactionChargeId: tx.id,
      version,
      allocationMethod: method,
      originalChargeAmount: targetAllocationBase,
      allocatedTotalAmount: allocatedNow,
      remainingUnallocatedAmount: remaining,
      roundingAdjustmentDelta: delta,
      currency: tx.currency,
      isManuallyOverridden: Boolean(params.isManualOverride),
      isApprovedOverride: Boolean(params.isManualOverride && params.isApprovedOverride),
      overrideApprovedBy: params.isManualOverride && params.isApprovedOverride ? actor.name : undefined,
      overrideReason: params.overrideReason,
      lines: allocLines,
      allocatedBy: actor.name,
      allocatedAt: new Date().toISOString(),
    };

    tx.allocationHistory = [allocRecord, ...tx.allocationHistory];
    tx.currentAllocationId = allocRecord.id;
    tx.allocatedAmount = cumulativeAllocated;
    tx.remainingUnallocatedAmount = remaining;
    tx.allocationStatus = params.isManualOverride
      ? 'OVERRIDDEN'
      : remaining <= 0.01
      ? 'FULLY_ALLOCATED'
      : 'PARTIALLY_ALLOCATED';
    tx.updatedBy = actor.name;
    tx.updatedAt = new Date().toISOString();

    all[idx] = tx;
    this.saveTransactionCharges(all);

    this.recordAudit({
      transactionChargeId: tx.id,
      sourceDocumentType: tx.sourceDocumentType,
      sourceDocumentNumber: tx.sourceDocumentNumber,
      action: params.isManualOverride ? 'ALLOCATION_OVERRIDDEN' : 'ALLOCATED',
      actorId: actor.id,
      actorName: actor.name,
      newValue: {
        version,
        method,
        allocatedNow,
        cumulativeAllocated,
        remaining,
      },
      reason: params.overrideReason || `Allocated via ${method} (v${version})`,
    });

    return allocRecord;
  },

  /**
   * Updates applicability of a transaction charge with Mandatory protection & audit trail.
   */
  changeChargeApplicability(
    transactionChargeId: string,
    newApplicability: ChargeApplicabilityStatus,
    reason: string,
    actor: { id: string; name: string; user?: User },
    exceptionApprovalRef?: string
  ): TransactionChargeItem {
    if (actor.user) {
      assertAuthorized(actor.user, 'CHARGE_TRANSACTION_EDIT', 'modify charge applicability');
    }

    const all = this.getTransactionCharges(true);
    const idx = all.findIndex((c) => c.id === transactionChargeId && !c.isSoftDeleted);
    if (idx === -1) throw new Error('Transaction charge not found.');
    const tx = { ...all[idx] };

    if (tx.applicability === 'MANDATORY' && newApplicability === 'NOT_APPLICABLE' && !exceptionApprovalRef) {
      throw new Error(
        `Mandatory charge "${tx.chargeName}" cannot be set to Not Applicable without authorized exception approval.`
      );
    }

    const prevApp = tx.applicability;
    tx.applicability = newApplicability;
    if (newApplicability === 'NOT_APPLICABLE') {
      tx.chargeAmount = 0;
      tx.chargeAmountReportingCurrency = 0;
      tx.totalWithTax = 0;
      tx.remainingUnallocatedAmount = 0;
    }
    tx.updatedBy = actor.name;
    tx.updatedAt = new Date().toISOString();
    all[idx] = tx;
    this.saveTransactionCharges(all);

    this.recordAudit({
      transactionChargeId: tx.id,
      sourceDocumentType: tx.sourceDocumentType,
      sourceDocumentNumber: tx.sourceDocumentNumber,
      action: 'APPLICABILITY_CHANGED',
      actorId: actor.id,
      actorName: actor.name,
      previousValue: { applicability: prevApp },
      newValue: { applicability: newApplicability },
      reason: reason || 'Applicability updated',
      approvalReference: exceptionApprovalRef,
    });

    return tx;
  },

  /**
   * Soft delete transaction charge (retains audit trail, blocks approved/actual deletions).
   */
  softDeleteCharge(
    transactionChargeId: string,
    reason: string,
    actor: { id: string; name: string; user?: User }
  ): void {
    if (actor.user) {
      assertAuthorized(actor.user, 'CHARGE_TRANSACTION_EDIT', 'remove transaction charge');
    }

    const all = this.getTransactionCharges(true);
    const idx = all.findIndex((c) => c.id === transactionChargeId && !c.isSoftDeleted);
    if (idx === -1) throw new Error('Transaction charge not found.');
    const tx = { ...all[idx] };

    if (tx.approvalStatus === 'APPROVED' && (tx.sourceDocumentType === 'PO' || tx.sourceDocumentType === 'INVOICE')) {
      throw new Error('Cannot delete an approved PO/Invoice charge. Request an authorized charge amendment instead.');
    }

    tx.isSoftDeleted = true;
    tx.deletedBy = actor.name;
    tx.deletedAt = new Date().toISOString();
    all[idx] = tx;
    this.saveTransactionCharges(all);

    this.recordAudit({
      transactionChargeId: tx.id,
      sourceDocumentType: tx.sourceDocumentType,
      sourceDocumentNumber: tx.sourceDocumentNumber,
      action: 'SOFT_DELETED',
      actorId: actor.id,
      actorName: actor.name,
      previousValue: { chargeAmount: tx.chargeAmount },
      reason: reason || 'Removed prior to approval',
    });
  },

  /**
   * Requests an authorized approval for charge amendment, mandatory exception, or variance.
   */
  requestChargeApproval(
    transactionChargeId: string,
    approvalType: ChargeApprovalRecord['approvalType'],
    proposedValue: any,
    reason: string,
    actor: { id: string; name: string }
  ): ChargeApprovalRecord {
    const all = this.getTransactionCharges(true);
    const idx = all.findIndex((c) => c.id === transactionChargeId);
    if (idx === -1) throw new Error('Transaction charge not found.');

    const tx = { ...all[idx] };
    const reqRec: ChargeApprovalRecord = {
      id: `cappr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      transactionChargeId,
      approvalType,
      requestedBy: actor.name,
      requestedAt: new Date().toISOString(),
      reason,
      previousValue: { chargeAmount: tx.chargeAmount, applicability: tx.applicability },
      proposedValue,
      status: 'PENDING',
    };
    tx.approvals = [reqRec, ...tx.approvals];
    tx.approvalStatus = 'PENDING_APPROVAL';
    all[idx] = tx;
    this.saveTransactionCharges(all);

    this.recordAudit({
      transactionChargeId,
      sourceDocumentType: tx.sourceDocumentType,
      sourceDocumentNumber: tx.sourceDocumentNumber,
      action: 'EXCEPTION_REQUESTED',
      actorId: actor.id,
      actorName: actor.name,
      previousValue: reqRec.previousValue,
      newValue: proposedValue,
      reason,
    });

    return reqRec;
  },

  decideChargeApproval(
    transactionChargeId: string,
    approvalId: string,
    decision: 'APPROVED' | 'REJECTED',
    remarks: string,
    actor: { id: string; name: string; user?: User }
  ): TransactionChargeItem {
    if (actor.user) {
      assertAuthorized(actor.user, 'CHARGE_VARIANCE_APPROVE', 'approve or reject charge governance requests');
    }

    const all = this.getTransactionCharges(true);
    const idx = all.findIndex((c) => c.id === transactionChargeId);
    if (idx === -1) throw new Error('Transaction charge not found.');
    const tx = { ...all[idx] };

    const aIdx = tx.approvals.findIndex((a) => a.id === approvalId);
    if (aIdx === -1) throw new Error('Approval request not found.');

    const updatedApproval: ChargeApprovalRecord = {
      ...tx.approvals[aIdx],
      status: decision,
      decidedBy: actor.name,
      decidedAt: new Date().toISOString(),
      decisionRemarks: remarks,
    };
    tx.approvals[aIdx] = updatedApproval;
    tx.approvalStatus = decision;

    if (decision === 'APPROVED' && updatedApproval.proposedValue?.newAmount !== undefined) {
      const oldAmt = tx.chargeAmount;
      const newAmt = Number(updatedApproval.proposedValue.newAmount);
      const taxMapping = chargeMasterService.getTaxMappingById(tx.taxMappingId);
      const snap = executeChargeCalculation(
        {
          method: 'FIXED_AMOUNT',
          basis: tx.calculationBasis,
          rate: newAmt,
          materialValue: newAmt,
          quantity: 1,
          sourceCurrency: tx.currency,
          targetCurrency: tx.targetReportingCurrency,
          exchangeRate: tx.exchangeRateUsed,
          roundingRule: 'HALF_UP',
          decimalPrecision: 2,
          taxMapping,
        },
        tx.id,
        tx.calculationHistory.length + 1,
        actor.name
      );
      tx.chargeAmount = snap.clampedAmount;
      if (tx.sourceDocumentType === 'PO') tx.approvedChargeAmount = snap.clampedAmount;
      tx.taxBreakdown = snap.taxBreakdown;
      tx.totalWithTax = snap.totalWithTax;
      tx.chargeAmountReportingCurrency = snap.convertedCurrencyAmount;
      tx.calculationHistory = [snap, ...tx.calculationHistory];
      tx.remainingUnallocatedAmount = Math.max(0, tx.chargeAmount - tx.allocatedAmount);

      this.recordAudit({
        transactionChargeId: tx.id,
        sourceDocumentType: tx.sourceDocumentType,
        sourceDocumentNumber: tx.sourceDocumentNumber,
        action: 'AMENDED',
        actorId: actor.id,
        actorName: actor.name,
        previousValue: { chargeAmount: oldAmt },
        newValue: { chargeAmount: newAmt },
        reason: remarks || updatedApproval.reason,
        approvalReference: updatedApproval.id,
        calculationVersion: tx.calculationHistory.length,
      });
    } else {
      this.recordAudit({
        transactionChargeId: tx.id,
        sourceDocumentType: tx.sourceDocumentType,
        sourceDocumentNumber: tx.sourceDocumentNumber,
        action: 'EXCEPTION_APPROVED',
        actorId: actor.id,
        actorName: actor.name,
        newValue: { decision },
        reason: remarks,
        approvalReference: updatedApproval.id,
      });
    }

    tx.updatedBy = actor.name;
    tx.updatedAt = new Date().toISOString();
    all[idx] = tx;
    this.saveTransactionCharges(all);
    return tx;
  },

  /**
   * Lifecycle Transition: Carry PR estimated charges independently to RFQ without altering PR estimates.
   */
  carryPrChargesToRfq(
    prId: string,
    rfqId: string,
    rfqNumber: string,
    actor: { id: string; name: string }
  ): TransactionChargeItem[] {
    const prCharges = this.getChargesForDocument('PR', prId);
    const created: TransactionChargeItem[] = [];

    for (const prChg of prCharges) {
      if (prChg.applicability === 'NOT_APPLICABLE') continue;
      const cloned = this.addTransactionCharge(
        {
          idempotencyKey: `carry-pr-rfq-${prChg.id}-${rfqId}`,
          chargeCodeOrId: prChg.chargeCode,
          procurementType: prChg.procurementType,
          sourceDocumentType: 'RFQ',
          sourceDocumentId: rfqId,
          sourceDocumentNumber: rfqNumber,
          originPrId: prChg.originPrId || prId,
          originPrNumber: prChg.originPrNumber,
          originPrLineId: prChg.sourceLineId,
          originRfqId: rfqId,
          originRfqNumber: rfqNumber,
          applicationLevel: prChg.applicationLevel,
          applicability: prChg.applicability,
          calculationMethod: prChg.calculationMethod,
          calculationBasis: prChg.calculationBasis,
          allocationMethod: prChg.allocationMethod,
          rate: prChg.rate,
          formulaExpression: prChg.formulaExpression,
          currency: prChg.currency,
          taxMappingId: prChg.taxMappingId,
          baseChargeAmountOverride: prChg.estimatedChargeAmount,
          remarks: `Carried from PR ${prChg.originPrNumber || prId} (Est: ${prChg.estimatedChargeAmount} ${prChg.currency})`,
        },
        actor
      );
      // Preserve estimatedChargeAmount trace
      const all = this.getTransactionCharges(true);
      const idx = all.findIndex((c) => c.id === cloned.id);
      if (idx >= 0) {
        all[idx].estimatedChargeAmount = prChg.estimatedChargeAmount;
        this.saveTransactionCharges(all);
        created.push(all[idx]);
      }
    }
    return created;
  },

  /**
   * Records a Supplier's quoted charges against an RFQ Quotation (Supports Included-in-Price vs Separate vs Weight-based).
   */
  submitSupplierChargeQuote(
    params: {
      rfqId: string;
      rfqNumber: string;
      quotationId: string;
      vendorId: string;
      vendorName: string;
      procurementType: 'DOMESTIC' | 'IMPORT';
      currency: string;
      incoterms?: string;
      charges: Array<{
        chargeCode: string;
        inclusionMode: SupplierChargeQuotationInclusion;
        calculationMethod: ChargeCalculationMethod;
        rate: number;
        materialValue: number;
        quantity: number;
        grossWeightKg?: number;
        taxMappingId?: string;
        estimatedReferenceAmount?: number;
      }>;
    },
    actor: { id: string; name: string }
  ): TransactionChargeItem[] {
    const saved: TransactionChargeItem[] = [];
    for (const item of params.charges) {
      const tx = this.addTransactionCharge(
        {
          idempotencyKey: `quot-${params.quotationId}-${item.chargeCode}`,
          chargeCodeOrId: item.chargeCode,
          procurementType: params.procurementType,
          sourceDocumentType: 'QUOTATION',
          sourceDocumentId: params.quotationId,
          sourceDocumentNumber: `${params.rfqNumber}/${params.vendorName}`,
          originRfqId: params.rfqId,
          originRfqNumber: params.rfqNumber,
          originQuotationId: params.quotationId,
          supplierId: params.vendorId,
          supplierName: params.vendorName,
          incoterms: params.incoterms,
          calculationMethod: item.calculationMethod,
          rate: item.rate,
          currency: params.currency,
          supplierInclusionMode: item.inclusionMode,
          taxMappingId: item.taxMappingId,
          materialValue: item.materialValue,
          quantity: item.quantity,
          grossWeightKg: item.grossWeightKg,
        },
        actor
      );
      if (item.estimatedReferenceAmount !== undefined) {
        const all = this.getTransactionCharges(true);
        const idx = all.findIndex((c) => c.id === tx.id);
        if (idx >= 0) {
          all[idx].estimatedChargeAmount = item.estimatedReferenceAmount;
          this.saveTransactionCharges(all);
          saved.push(all[idx]);
          continue;
        }
      }
      saved.push(tx);
    }
    return saved;
  },

  /**
   * Normalizes multi-supplier quotation commercial values (avoiding double counting when a supplier includes freight in unit price).
   */
  compareSupplierChargesForRfq(
    rfqId: string,
    rfqNumber: string,
    supplierOffers: Array<{
      quotationId: string;
      vendorId: string;
      vendorCode: string;
      vendorName: string;
      currency: string;
      materialSubtotal: number;
    }>,
    baseCurrency = 'INR'
  ): NormalizedSupplierChargeComparison[] {
    const allCharges = this.getTransactionCharges();

    return supplierOffers
      .map((offer) => {
        const fx = chargeMasterService.getExchangeRate(offer.currency, baseCurrency);
        const quotCharges = allCharges.filter(
          (c) =>
            c.sourceDocumentType === 'QUOTATION' &&
            (c.originQuotationId === offer.quotationId || c.sourceDocumentId === offer.quotationId)
        );

        let includedCount = 0;
        let separateBaseTotal = 0;
        let separateNonRecTax = 0;
        let recTaxTotal = 0;

        const chargeLines = quotCharges.map((c) => {
          if (c.supplierInclusionMode === 'INCLUDED_IN_MATERIAL_PRICE') {
            includedCount += 1;
            return {
              chargeCode: c.chargeCode,
              chargeName: c.chargeName,
              inclusionMode: c.supplierInclusionMode,
              calculationMethod: c.calculationMethod,
              rawAmount: 0,
              normalizedBaseAmount: 0,
              nonRecoverableTax: 0,
              recoverableTax: 0,
            };
          }
          const normBase = roundWithRule(c.chargeAmount * fx, 2, 'HALF_UP');
          const normNonRecTax = roundWithRule(c.taxBreakdown.nonRecoverableTax * fx, 2, 'HALF_UP');
          const normRecTax = roundWithRule(c.taxBreakdown.recoverableTax * fx, 2, 'HALF_UP');

          separateBaseTotal += normBase;
          separateNonRecTax += normNonRecTax;
          recTaxTotal += normRecTax;

          return {
            chargeCode: c.chargeCode,
            chargeName: c.chargeName,
            inclusionMode: c.supplierInclusionMode,
            calculationMethod: c.calculationMethod,
            rawAmount: c.chargeAmount,
            normalizedBaseAmount: normBase,
            nonRecoverableTax: normNonRecTax,
            recoverableTax: normRecTax,
          };
        });

        const materialBase = roundWithRule(offer.materialSubtotal * fx, 2, 'HALF_UP');
        const normalizedTotal = roundWithRule(materialBase + separateBaseTotal + separateNonRecTax, 2, 'HALF_UP');

        return {
          rfqId,
          rfqNumber,
          vendorId: offer.vendorId,
          vendorCode: offer.vendorCode,
          vendorName: offer.vendorName,
          currency: offer.currency,
          exchangeRateToBase: fx,
          materialSubtotalBaseCurrency: materialBase,
          includedInPriceChargesCount: includedCount,
          separatelyQuotedChargesTotal: roundWithRule(separateBaseTotal, 2, 'HALF_UP'),
          separatelyQuotedNonRecoverableTax: roundWithRule(separateNonRecTax, 2, 'HALF_UP'),
          recoverableTaxTotal: roundWithRule(recTaxTotal, 2, 'HALF_UP'),
          normalizedTotalLandedCost: normalizedTotal,
          chargeLines,
        };
      })
      .sort((a, b) => a.normalizedTotalLandedCost - b.normalizedTotalLandedCost);
  },

  /**
   * Shipments & Transport Trips CRUD
   */
  getShipments(): ShipmentRecord[] {
    const list = getStorage<ShipmentRecord[]>(STORAGE_KEY_SHIPMENTS, memShipments, createInitialShipments);
    memShipments = list;
    return list;
  },

  createShipment(shipment: Omit<ShipmentRecord, 'id' | 'createdAt'>): ShipmentRecord {
    const rec: ShipmentRecord = {
      ...shipment,
      id: `ship-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      createdAt: new Date().toISOString(),
    };
    const next = [rec, ...this.getShipments()];
    memShipments = next;
    setStorage(STORAGE_KEY_SHIPMENTS, next);
    return rec;
  },

  getTrips(): TransportTripRecord[] {
    const list = getStorage<TransportTripRecord[]>(STORAGE_KEY_TRIPS, memTrips, createInitialTrips);
    memTrips = list;
    return list;
  },

  createTrip(trip: Omit<TransportTripRecord, 'id'>): TransportTripRecord {
    const rec: TransportTripRecord = {
      ...trip,
      id: `trip-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    };
    const next = [rec, ...this.getTrips()];
    memTrips = next;
    setStorage(STORAGE_KEY_TRIPS, next);
    return rec;
  },

  /**
   * Invoice Actual Charge Capture & Estimated vs Quoted vs Approved vs Actual Reconciliation
   */
  recordInvoiceActualCharge(
    params: {
      relatedApprovedChargeId?: string;
      chargeCodeOrId: string;
      invoiceId: string;
      invoiceNumber: string;
      poId?: string;
      poNumber?: string;
      poLineId?: string;
      shipmentId?: string;
      grnId?: string;
      supplierId?: string;
      supplierName?: string;
      procurementType?: 'DOMESTIC' | 'IMPORT';
      actualAmount: number;
      currency: string;
      taxMappingId?: string;
      tolerancePercent?: number;
      remarks?: string;
    },
    actor: { id: string; name: string; user?: User }
  ): { invoiceCharge: TransactionChargeItem; reconciliation: ChargeReconciliationRecord } {
    const tx = this.addTransactionCharge(
      {
        idempotencyKey: `inv-act-${params.invoiceId}-${params.chargeCodeOrId}-${params.grnId || params.shipmentId || 'hdr'}`,
        chargeCodeOrId: params.chargeCodeOrId,
        procurementType: params.procurementType || 'DOMESTIC',
        sourceDocumentType: 'INVOICE',
        sourceDocumentId: params.invoiceId,
        sourceDocumentNumber: params.invoiceNumber,
        sourceLineId: params.poLineId,
        originPoId: params.poId,
        originPoNumber: params.poNumber,
        originPoLineId: params.poLineId,
        shipmentId: params.shipmentId,
        grnId: params.grnId,
        invoiceId: params.invoiceId,
        invoiceNumber: params.invoiceNumber,
        supplierId: params.supplierId,
        supplierName: params.supplierName,
        applicationLevel: 'INVOICE_LEVEL',
        calculationMethod: 'ACTUAL_COST',
        calculationBasis: 'ACTUAL_INVOICE_AMOUNT',
        rate: params.actualAmount,
        actualInvoiceAmount: params.actualAmount,
        currency: params.currency,
        taxMappingId: params.taxMappingId,
        remarks: params.remarks,
      },
      actor
    );

    const all = this.getTransactionCharges(true);
    const parent = params.relatedApprovedChargeId
      ? all.find((c) => c.id === params.relatedApprovedChargeId)
      : undefined;

    const est = parent?.estimatedChargeAmount ?? 0;
    const quot = parent?.quotedChargeAmount ?? 0;
    const appr = parent?.approvedChargeAmount ?? 0;
    const act = tx.chargeAmount;

    const txIdx = all.findIndex((c) => c.id === tx.id);
    if (txIdx >= 0) {
      all[txIdx].estimatedChargeAmount = est;
      all[txIdx].quotedChargeAmount = quot;
      all[txIdx].approvedChargeAmount = appr;
      all[txIdx].actualChargeAmount = act;
      all[txIdx].originPrId = parent?.originPrId;
      all[txIdx].originPrNumber = parent?.originPrNumber;
      all[txIdx].originRfqId = parent?.originRfqId;
      all[txIdx].originRfqNumber = parent?.originRfqNumber;
    }

    const baseline = appr > 0 ? appr : est > 0 ? est : act;
    const variance = roundWithRule(act - baseline, 2, 'HALF_UP');
    const variancePct = baseline > 0 ? roundWithRule((Math.abs(variance) / baseline) * 100, 2, 'HALF_UP') : 0;
    const tolPct = params.tolerancePercent ?? 5;
    const status = variancePct <= tolPct ? 'WITHIN_TOLERANCE' : 'VARIANCE_APPROVAL_REQUIRED';

    if (txIdx >= 0) {
      all[txIdx].reconciliationStatus = status;
      this.saveTransactionCharges(all);
    }

    const reconRec: ChargeReconciliationRecord = {
      id: `crecon-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      transactionChargeId: tx.id,
      chargeCode: tx.chargeCode,
      chargeName: tx.chargeName,
      prNumber: parent?.originPrNumber,
      rfqNumber: parent?.originRfqNumber,
      poNumber: params.poNumber || parent?.originPoNumber,
      grnNumber: parent?.grnNumber,
      invoiceNumber: params.invoiceNumber,
      estimatedAmount: est,
      quotedAmount: quot,
      approvedAmount: appr,
      actualAmount: act,
      varianceApprovedVsActual: variance,
      variancePercent: variancePct,
      tolerancePercent: tolPct,
      status,
      notes: params.remarks,
    };

    const recons = getStorage<ChargeReconciliationRecord[]>(STORAGE_KEY_RECON, memRecon, () => []);
    memRecon = [reconRec, ...recons];
    setStorage(STORAGE_KEY_RECON, memRecon);

    return {
      invoiceCharge: txIdx >= 0 ? all[txIdx] : tx,
      reconciliation: reconRec,
    };
  },

  getReconciliations(): ChargeReconciliationRecord[] {
    const list = getStorage<ChargeReconciliationRecord[]>(STORAGE_KEY_RECON, memRecon, () => []);
    memRecon = list;
    return list;
  },

  completeReconciliation(
    reconciliationId: string,
    decision: 'RECONCILED' | 'VARIANCE_APPROVED',
    remarks: string,
    actor: { id: string; name: string; user?: User }
  ): ChargeReconciliationRecord {
    if (actor.user) {
      assertAuthorized(actor.user, 'CHARGE_VARIANCE_APPROVE', 'complete charge reconciliation');
    }
    const recons = this.getReconciliations();
    const idx = recons.findIndex((r) => r.id === reconciliationId);
    if (idx === -1) throw new Error('Reconciliation record not found.');

    const updated: ChargeReconciliationRecord = {
      ...recons[idx],
      status: 'RECONCILED',
      reconciledBy: actor.name,
      reconciledAt: new Date().toISOString(),
      approvalRef: `APPR-VAR-${Date.now().toString(36).toUpperCase()}`,
      notes: remarks || recons[idx].notes,
    };
    recons[idx] = updated;
    memRecon = recons;
    setStorage(STORAGE_KEY_RECON, recons);

    // Update underlying transaction charge status to RECONCILED
    const all = this.getTransactionCharges(true);
    const txIdx = all.findIndex((c) => c.id === updated.transactionChargeId);
    if (txIdx >= 0) {
      all[txIdx].reconciliationStatus = 'RECONCILED';
      all[txIdx].lifecycleStage = 'RECONCILED';
      this.saveTransactionCharges(all);
    }

    this.recordAudit({
      transactionChargeId: updated.transactionChargeId,
      sourceDocumentType: 'INVOICE',
      sourceDocumentNumber: updated.invoiceNumber || updated.poNumber || 'RECON',
      action: 'RECONCILED',
      actorId: actor.id,
      actorName: actor.name,
      newValue: { status: 'RECONCILED', decision, variance: updated.varianceApprovedVsActual },
      reason: remarks || 'Reconciliation completed',
      approvalReference: updated.approvalRef,
    });

    return updated;
  },

  /**
   * Landed Cost Engine: Item-wise breakdown across Estimated, Quoted, Approved, Actual, Final Reconciled stages.
   * Excludes recoverable input taxes from landed inventory valuation.
   */
  calculateItemWiseLandedCost(params: {
    itemCode: string;
    description: string;
    sourceDocType: 'PR' | 'RFQ' | 'PO' | 'GRN';
    sourceDocId: string;
    sourceDocNumber: string;
    sourceLineId: string;
    quantity: number;
    uom: string;
    materialCost: number;
    currency: string;
    additionalChargeIds?: string[];
  }): LandedCostItemSummary {
    const allCharges = this.getTransactionCharges().filter((c) => {
      if (params.additionalChargeIds && params.additionalChargeIds.includes(c.id)) return true;
      return (
        c.sourceDocumentId === params.sourceDocId ||
        c.sourceDocumentNumber === params.sourceDocNumber ||
        c.originPoId === params.sourceDocId ||
        c.originPoNumber === params.sourceDocNumber ||
        c.originPrId === params.sourceDocId ||
        c.originPrNumber === params.sourceDocNumber
      );
    });

    const stageBuckets: Record<
      'ESTIMATED' | 'QUOTED' | 'APPROVED' | 'ACTUAL' | 'FINAL_RECONCILED',
      LandedCostStageBreakdown
    > = {
      ESTIMATED: {
        stage: 'ESTIMATED',
        materialCost: params.materialCost,
        directLineCharges: 0,
        allocatedIndirectCharges: 0,
        nonRecoverableTaxes: 0,
        recoverableInputTaxExcluded: 0,
        totalLandedCost: params.materialCost,
        landedUnitCost: params.quantity > 0 ? roundWithRule(params.materialCost / params.quantity, 2) : 0,
        contributingChargeIds: [],
      },
      QUOTED: {
        stage: 'QUOTED',
        materialCost: params.materialCost,
        directLineCharges: 0,
        allocatedIndirectCharges: 0,
        nonRecoverableTaxes: 0,
        recoverableInputTaxExcluded: 0,
        totalLandedCost: params.materialCost,
        landedUnitCost: params.quantity > 0 ? roundWithRule(params.materialCost / params.quantity, 2) : 0,
        contributingChargeIds: [],
      },
      APPROVED: {
        stage: 'APPROVED',
        materialCost: params.materialCost,
        directLineCharges: 0,
        allocatedIndirectCharges: 0,
        nonRecoverableTaxes: 0,
        recoverableInputTaxExcluded: 0,
        totalLandedCost: params.materialCost,
        landedUnitCost: params.quantity > 0 ? roundWithRule(params.materialCost / params.quantity, 2) : 0,
        contributingChargeIds: [],
      },
      ACTUAL: {
        stage: 'ACTUAL',
        materialCost: params.materialCost,
        directLineCharges: 0,
        allocatedIndirectCharges: 0,
        nonRecoverableTaxes: 0,
        recoverableInputTaxExcluded: 0,
        totalLandedCost: params.materialCost,
        landedUnitCost: params.quantity > 0 ? roundWithRule(params.materialCost / params.quantity, 2) : 0,
        contributingChargeIds: [],
      },
      FINAL_RECONCILED: {
        stage: 'FINAL_RECONCILED',
        materialCost: params.materialCost,
        directLineCharges: 0,
        allocatedIndirectCharges: 0,
        nonRecoverableTaxes: 0,
        recoverableInputTaxExcluded: 0,
        totalLandedCost: params.materialCost,
        landedUnitCost: params.quantity > 0 ? roundWithRule(params.materialCost / params.quantity, 2) : 0,
        contributingChargeIds: [],
      },
    };

    const chargeTrace: LandedCostItemSummary['chargeTrace'] = [];

    for (const c of allCharges) {
      if (c.applicability === 'NOT_APPLICABLE') continue;
      if (c.supplierInclusionMode === 'INCLUDED_IN_MATERIAL_PRICE') continue;

      const fx = chargeMasterService.getExchangeRate(c.currency, params.currency);

      // Find specific allocation to this line if allocation exists
      const latestAlloc = c.allocationHistory[0];
      const allocLine = latestAlloc?.lines.find((l) => l.targetLineId === params.sourceLineId);
      const isDirectLine =
        c.applicationLevel === 'PR_LINE' ||
        c.applicationLevel === 'PO_LINE' ||
        c.allocationMethod === 'DIRECT_LINE_ALLOCATION';

      if (latestAlloc && !allocLine && c.sourceLineId !== params.sourceLineId) {
        // Charge was explicitly allocated to other lines, not this one
        continue;
      }

      const baseAmt = roundWithRule(
        (allocLine ? allocLine.allocatedChargeAmount : c.chargeAmount) * fx,
        2
      );
      const nonRecTax = roundWithRule(
        (allocLine ? allocLine.allocatedNonRecoverableTax : c.taxBreakdown.nonRecoverableTax) * fx,
        2
      );
      const recTax = roundWithRule(
        (allocLine ? allocLine.allocatedRecoverableTax : c.taxBreakdown.recoverableTax) * fx,
        2
      );

      const stageKey =
        c.lifecycleStage === 'RECONCILED' ? 'FINAL_RECONCILED' : c.lifecycleStage;
      const bucket = stageBuckets[stageKey];

      if (isDirectLine) bucket.directLineCharges = roundWithRule(bucket.directLineCharges + baseAmt, 2);
      else bucket.allocatedIndirectCharges = roundWithRule(bucket.allocatedIndirectCharges + baseAmt, 2);

      bucket.nonRecoverableTaxes = roundWithRule(bucket.nonRecoverableTaxes + nonRecTax, 2);
      bucket.recoverableInputTaxExcluded = roundWithRule(bucket.recoverableInputTaxExcluded + recTax, 2);
      bucket.contributingChargeIds.push(c.id);

      chargeTrace.push({
        transactionChargeId: c.id,
        chargeCode: c.chargeCode,
        chargeName: c.chargeName,
        applicationLevel: c.applicationLevel,
        lifecycleStage: c.lifecycleStage,
        allocatedBaseAmount: baseAmt,
        nonRecoverableTax: nonRecTax,
        recoverableTaxExcluded: recTax,
        landedContribution: roundWithRule(baseAmt + nonRecTax, 2),
      });
    }

    (Object.values(stageBuckets) as LandedCostStageBreakdown[]).forEach((b) => {
      b.totalLandedCost = roundWithRule(
        b.materialCost + b.directLineCharges + b.allocatedIndirectCharges + b.nonRecoverableTaxes,
        2
      );
      b.landedUnitCost = params.quantity > 0 ? roundWithRule(b.totalLandedCost / params.quantity, 2) : 0;
    });

    return {
      itemCode: params.itemCode,
      description: params.description,
      sourceDocType: params.sourceDocType,
      sourceDocNumber: params.sourceDocNumber,
      sourceLineId: params.sourceLineId,
      quantity: params.quantity,
      uom: params.uom,
      currency: params.currency,
      stages: {
        estimated: stageBuckets.ESTIMATED,
        quoted: stageBuckets.QUOTED,
        approved: stageBuckets.APPROVED,
        actual: stageBuckets.ACTUAL,
        finalReconciled: stageBuckets.FINAL_RECONCILED,
      },
      chargeTrace,
    };
  },

  calculateShipmentLandedCost(shipmentId: string, materialValueInShipment: number): LandedCostShipmentSummary {
    const shipment = this.getShipments().find((s) => s.id === shipmentId);
    if (!shipment) throw new Error(`Shipment "${shipmentId}" not found.`);

    const charges = this.getTransactionCharges().filter(
      (c) =>
        c.applicability !== 'NOT_APPLICABLE' &&
        (c.shipmentId === shipmentId || (c.sourceDocumentType === 'SHIPMENT' && c.sourceDocumentId === shipmentId))
    );

    let directCharges = 0;
    let nonRecTax = 0;
    let recTaxExcluded = 0;

    const chargeBreakdown = charges.map((c) => {
      const fx = chargeMasterService.getExchangeRate(c.currency, shipment.currency);
      const base = roundWithRule(c.chargeAmount * fx, 2);
      const nr = roundWithRule(c.taxBreakdown.nonRecoverableTax * fx, 2);
      const r = roundWithRule(c.taxBreakdown.recoverableTax * fx, 2);
      directCharges += base;
      nonRecTax += nr;
      recTaxExcluded += r;
      return {
        transactionChargeId: c.id,
        chargeCode: c.chargeCode,
        chargeName: c.chargeName,
        baseAmount: base,
        nonRecoverableTax: nr,
        recoverableTaxExcluded: r,
      };
    });

    return {
      shipmentId: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      poNumber: shipment.poNumber,
      currency: shipment.currency,
      materialValueInShipment,
      shipmentDirectCharges: roundWithRule(directCharges, 2),
      allocatedHeaderCharges: 0,
      nonRecoverableTaxes: roundWithRule(nonRecTax, 2),
      recoverableInputTaxExcluded: roundWithRule(recTaxExcluded, 2),
      totalShipmentLandedCost: roundWithRule(materialValueInShipment + directCharges + nonRecTax, 2),
      chargeBreakdown,
    };
  },

  getDashboardSummary(currency = 'INR'): ChargeDashboardSummary {
    const charges = this.getTransactionCharges();
    const recons = this.getReconciliations();

    let est = 0;
    let quot = 0;
    let appr = 0;
    let act = 0;
    let unalloc = 0;
    let pendingAppr = 0;

    for (const c of charges) {
      if (c.applicability === 'NOT_APPLICABLE') continue;
      const fx = chargeMasterService.getExchangeRate(c.currency, currency);
      est += c.estimatedChargeAmount * fx;
      quot += c.quotedChargeAmount * fx;
      appr += c.approvedChargeAmount * fx;
      act += c.actualChargeAmount * fx;
      unalloc += (c.remainingUnallocatedAmount || 0) * fx;
      if (c.approvalStatus === 'PENDING_APPROVAL') pendingAppr += 1;
    }

    const pendingReconCount = recons.filter((r) => r.status !== 'RECONCILED').length;
    const varianceTotal = recons.reduce((acc, r) => acc + r.varianceApprovedVsActual, 0);

    return {
      totalEstimatedCharges: roundWithRule(est, 2),
      totalQuotedCharges: roundWithRule(quot, 2),
      totalApprovedCharges: roundWithRule(appr, 2),
      totalActualCharges: roundWithRule(act, 2),
      unallocatedChargesTotal: roundWithRule(unalloc, 2),
      pendingReconciliationCount: pendingReconCount,
      pendingApprovalCount: pendingAppr,
      chargeVarianceTotal: roundWithRule(varianceTotal, 2),
      currency,
    };
  },
};
