/**
 * KOSH INNOVATIONS — AUTHORITATIVE DECIMAL-SAFE PR FINANCIAL CALCULATOR
 *
 * Pure, deterministic financial computation engine using integer minor-unit arithmetic
 * (default 2 decimal places, HALF_UP rounding) for both:
 *  1) Inventory PR: Inventory Subtotal + Inventory Tax + Header Charge Items + Line-Level Charge Items + Charge Taxes = Total Landed PR Value
 *  2) Expense PR:   Sum(Expense Line Base Amounts) + Applicable Expense Taxes = Total Expense PR Value
 */

import type {
  ExpensePrLineRecord,
  PRChargeItem,
  PRType,
  PurchaseRequisitionLine,
} from '../types/purchaseRequisition';

export type CurrencyPrecisionMap = Record<string, number>;

const CURRENCY_DECIMALS: CurrencyPrecisionMap = {
  JPY: 0,
  KRW: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
};

export function getCurrencyPrecision(currency = 'INR'): number {
  const code = (currency || 'INR').toUpperCase();
  return CURRENCY_DECIMALS[code] ?? 2;
}

/**
 * Deterministic HALF_UP rounding to specified decimal precision (default 2).
 */
export function roundMoney(value: number, precision = 2): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const factor = Math.pow(10, precision);
  // Avoid IEEE-754 half-way drift by scaling via exponential notation when safe
  const sign = num < 0 ? -1 : 1;
  const abs = Math.abs(num);
  const rounded = Math.floor(abs * factor + 0.5 + 1e-11) / factor;
  const out = sign * rounded;
  return Object.is(out, -0) ? 0 : out;
}

export function resolvePrecision(precisionOrCurrency?: number | string): number {
  if (typeof precisionOrCurrency === 'number') return precisionOrCurrency;
  return getCurrencyPrecision(precisionOrCurrency || 'INR');
}

export function toMinorUnits(value: number, precisionOrCurrency: number | string = 2): number {
  const precision = resolvePrecision(precisionOrCurrency);
  const factor = Math.pow(10, precision);
  return Math.round(roundMoney(value, precision) * factor);
}

export function fromMinorUnits(minorUnits: number, precisionOrCurrency: number | string = 2): number {
  const precision = resolvePrecision(precisionOrCurrency);
  const factor = Math.pow(10, precision);
  return roundMoney(minorUnits / factor, precision);
}

export function sumMoney(values: number[], precisionOrCurrency: number | string = 2): number {
  const precision = resolvePrecision(precisionOrCurrency);
  const minorSum = values.reduce((acc, v) => acc + toMinorUnits(v, precision), 0);
  return fromMinorUnits(minorSum, precision);
}

export function assertNonNegativeAmount(value: number, fieldLabel: string): void {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`Invalid financial value: ${fieldLabel} cannot be negative (${value}).`);
  }
}

export interface CalculatedExpenseLineResult {
  baseAmount: number;
  taxAmount: number;
  totalAmount: number;
  totalWithTax: number;
}

/**
 * Computes authoritative Base, Tax, and Total amounts for a single Expense PR line.
 * Supports:
 *  - Optional quantity + unitRate, or direct lump-sum amount/unitRate (qty defaults to 1 when omitted)
 *  - Tax-exclusive (default) and Tax-inclusive pricing decomposition
 */
export function computeExpenseLineAmounts(params: {
  quantity?: number;
  unitRate?: number;
  amount?: number;
  gstRatePercent?: number;
  taxPercent?: number;
  taxRatePercent?: number;
  taxInclusive?: boolean;
  isTaxInclusive?: boolean;
  currency?: string;
}): CalculatedExpenseLineResult {
  const precision = getCurrencyPrecision(params.currency);
  const rawQty = params.quantity === undefined || params.quantity === null ? 1 : Number(params.quantity);
  const qty = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : params.quantity === 0 ? 0 : 1;
  const rate =
    params.unitRate !== undefined && params.unitRate !== null
      ? Number(params.unitRate) || 0
      : Number(params.amount) || 0;
  const gstPct =
    params.gstRatePercent !== undefined
      ? Number(params.gstRatePercent) || 0
      : params.taxPercent !== undefined
      ? Number(params.taxPercent) || 0
      : Number(params.taxRatePercent) || 0;
  const inclusive = Boolean(params.taxInclusive ?? params.isTaxInclusive);

  assertNonNegativeAmount(qty, 'Expense line quantity');
  assertNonNegativeAmount(rate, 'Expense line unit rate');
  assertNonNegativeAmount(gstPct, 'Expense line GST/tax rate');

  const grossOrNet =
    params.unitRate !== undefined && params.unitRate !== null
      ? roundMoney(qty * rate, precision)
      : roundMoney(rate * (params.quantity !== undefined ? qty : 1), precision);

  if (inclusive && gstPct > 0) {
    const baseAmount = roundMoney(grossOrNet / (1 + gstPct / 100), precision);
    const taxAmount = roundMoney(grossOrNet - baseAmount, precision);
    return {
      baseAmount,
      taxAmount,
      totalAmount: grossOrNet,
      totalWithTax: grossOrNet,
    };
  }

  const baseAmount = grossOrNet;
  const taxAmount = roundMoney((baseAmount * gstPct) / 100, precision);
  const totalAmount = sumMoney([baseAmount, taxAmount], precision);
  return { baseAmount, taxAmount, totalAmount, totalWithTax: totalAmount };
}

export const calculateExpensePrLine = computeExpenseLineAmounts;
export const calculateExpenseLineAmounts = computeExpenseLineAmounts;

export interface AuthoritativeInventoryPrTotals {
  mode: 'INVENTORY';
  currency: string;
  precision: number;
  inventorySubtotal: number;
  inventoryTaxTotal: number;
  headerChargesBaseTotal: number;
  headerChargesTaxTotal: number;
  lineChargesBaseTotal: number;
  lineChargesTaxTotal: number;
  applicableChargesCount: number;
  applicableChargesBaseTotal: number;
  applicableChargesTaxTotal: number;
  applicableChargeTaxTotal: number;
  applicableChargesGrandTotal: number;
  lineChargesCount: number;
  totalLandedPrValue: number;
}

export interface AuthoritativeExpensePrTotals {
  mode: 'EXPENSE';
  currency: string;
  precision: number;
  expenseSubtotal: number;
  expenseBaseTotal: number;
  expenseTaxTotal: number;
  totalExpensePrValue: number;
  activeLinesCount: number;
}

export type AuthoritativePrFinancialTotals =
  | AuthoritativeInventoryPrTotals
  | AuthoritativeExpensePrTotals;

export function calculateInventoryPrTotals(params: {
  currency?: string;
  lines?: Array<{
    requestedQuantity?: number;
    approximateUnitPrice?: number;
    estimatedTotalValue?: number;
    gstRatePercent?: number;
    taxPercent?: number;
    taxRatePercent?: number;
    priceIncludesTax?: boolean;
    taxAmount?: number;
    lineCharges?: PRChargeItem[];
    status?: string;
  }>;
  headerCharges?: PRChargeItem[];
  itemsSubtotalOverride?: number;
}): AuthoritativeInventoryPrTotals {
  const currency = (params.currency || 'INR').toUpperCase();
  const precision = getCurrencyPrecision(currency);
  const lines = params.lines || [];

  const lineBases: number[] = [];
  const lineTaxes: number[] = [];
  let lineChargesCount = 0;
  const lineChargeBases: number[] = [];
  const lineChargeTaxes: number[] = [];

  for (const line of lines) {
    if (line.status === 'CANCELLED' || line.status === 'REJECTED') continue;
    const qty = Number(line.requestedQuantity) || 0;
    const unitPrice = Number(line.approximateUnitPrice) || 0;
    assertNonNegativeAmount(qty, 'PR line quantity');
    assertNonNegativeAmount(unitPrice, 'PR line unit price');

    const lineBase =
      line.estimatedTotalValue !== undefined
        ? roundMoney(Number(line.estimatedTotalValue) || 0, precision)
        : roundMoney(qty * unitPrice, precision);
    lineBases.push(lineBase);

    const taxPct =
      line.gstRatePercent !== undefined
        ? Number(line.gstRatePercent) || 0
        : line.taxPercent !== undefined
        ? Number(line.taxPercent) || 0
        : Number(line.taxRatePercent) || 0;

    const lineTax =
      line.taxAmount !== undefined
        ? roundMoney(Number(line.taxAmount) || 0, precision)
        : taxPct > 0
        ? roundMoney((lineBase * taxPct) / 100, precision)
        : 0;
    assertNonNegativeAmount(lineTax, 'PR line tax');
    lineTaxes.push(lineTax);

    if (Array.isArray(line.lineCharges)) {
      for (const lc of line.lineCharges) {
        if (lc.applicability !== 'NOT_APPLICABLE') {
          lineChargesCount += 1;
          const base = roundMoney(Number(lc.estimatedAmount) || 0, precision);
          const tax = roundMoney(Number(lc.taxAmount) || 0, precision);
          assertNonNegativeAmount(base, `Line charge (${lc.chargeCode}) base amount`);
          assertNonNegativeAmount(tax, `Line charge (${lc.chargeCode}) tax amount`);
          lineChargeBases.push(base);
          lineChargeTaxes.push(tax);
        }
      }
    }
  }

  const inventorySubtotal =
    params.itemsSubtotalOverride !== undefined
      ? roundMoney(params.itemsSubtotalOverride, precision)
      : sumMoney(lineBases, precision);
  const inventoryTaxTotal = sumMoney(lineTaxes, precision);

  let headerChargesCount = 0;
  const headerChargeBases: number[] = [];
  const headerChargeTaxes: number[] = [];
  for (const hc of params.headerCharges || []) {
    if (hc.applicability !== 'NOT_APPLICABLE') {
      headerChargesCount += 1;
      const base = roundMoney(Number(hc.estimatedAmount) || 0, precision);
      const tax = roundMoney(Number(hc.taxAmount) || 0, precision);
      assertNonNegativeAmount(base, `Header charge (${hc.chargeCode}) base amount`);
      assertNonNegativeAmount(tax, `Header charge (${hc.chargeCode}) tax amount`);
      headerChargeBases.push(base);
      headerChargeTaxes.push(tax);
    }
  }

  const headerChargesBaseTotal = sumMoney(headerChargeBases, precision);
  const headerChargesTaxTotal = sumMoney(headerChargeTaxes, precision);
  const lineChargesBaseTotal = sumMoney(lineChargeBases, precision);
  const lineChargesTaxTotal = sumMoney(lineChargeTaxes, precision);

  const applicableChargesBaseTotal = sumMoney([headerChargesBaseTotal, lineChargesBaseTotal], precision);
  const applicableChargesTaxTotal = sumMoney([headerChargesTaxTotal, lineChargesTaxTotal], precision);
  const applicableChargesGrandTotal = sumMoney(
    [applicableChargesBaseTotal, applicableChargesTaxTotal],
    precision
  );

  const totalLandedPrValue = sumMoney(
    [inventorySubtotal, inventoryTaxTotal, applicableChargesBaseTotal, applicableChargesTaxTotal],
    precision
  );

  return {
    mode: 'INVENTORY',
    currency,
    precision,
    inventorySubtotal,
    inventoryTaxTotal,
    headerChargesBaseTotal,
    headerChargesTaxTotal,
    lineChargesBaseTotal,
    lineChargesTaxTotal,
    applicableChargesCount: headerChargesCount + lineChargesCount,
    applicableChargesBaseTotal,
    applicableChargesTaxTotal,
    applicableChargeTaxTotal: applicableChargesTaxTotal,
    applicableChargesGrandTotal,
    lineChargesCount,
    totalLandedPrValue,
  };
}

export const calculateInventoryPrFinancials = calculateInventoryPrTotals;

export function calculateExpensePrTotals(
  paramsOrLines:
    | {
        currency?: string;
        expenseLines?: Array<Partial<ExpensePrLineRecord>>;
      }
    | Array<Partial<ExpensePrLineRecord>>,
  currencyArg?: string
): AuthoritativeExpensePrTotals {
  const isArray = Array.isArray(paramsOrLines);
  const currency = (
    (isArray ? currencyArg : paramsOrLines?.currency) || 'INR'
  ).toUpperCase();
  const precision = getCurrencyPrecision(currency);
  const rawLines = isArray ? paramsOrLines : paramsOrLines?.expenseLines || [];
  const activeLines = rawLines.filter(
    (l) => l && l.status !== 'CANCELLED' && l.status !== 'REJECTED'
  );

  const baseList: number[] = [];
  const taxList: number[] = [];

  for (const line of activeLines) {
    const computed = computeExpenseLineAmounts({
      quantity: line.quantity,
      unitRate: line.unitRate ?? line.amount ?? line.baseAmount ?? 0,
      gstRatePercent: line.gstRatePercent ?? line.taxPercent ?? line.taxRatePercent ?? 0,
      taxInclusive: line.taxInclusive ?? line.isTaxInclusive,
      currency,
    });
    baseList.push(computed.baseAmount);
    taxList.push(computed.taxAmount);
  }

  const expenseSubtotal = sumMoney(baseList, precision);
  const expenseTaxTotal = sumMoney(taxList, precision);
  const totalExpensePrValue = sumMoney([expenseSubtotal, expenseTaxTotal], precision);

  return {
    mode: 'EXPENSE',
    currency,
    precision,
    expenseSubtotal,
    expenseBaseTotal: expenseSubtotal,
    expenseTaxTotal,
    totalExpensePrValue,
    activeLinesCount: activeLines.length,
  };
}

export const calculateExpensePrFinancials = calculateExpensePrTotals;

export function calculatePrAuthoritativeTotals(params: {
  prType: PRType | string;
  currency?: string;
  lines?: PurchaseRequisitionLine[];
  headerCharges?: PRChargeItem[];
  expenseLines?: ExpensePrLineRecord[];
  itemsSubtotalOverride?: number;
}): AuthoritativePrFinancialTotals {
  if (params.prType === 'EXPENSE') {
    return calculateExpensePrTotals({
      currency: params.currency,
      expenseLines: params.expenseLines,
    });
  }
  return calculateInventoryPrTotals({
    currency: params.currency,
    lines: params.lines,
    headerCharges: params.headerCharges,
    itemsSubtotalOverride: params.itemsSubtotalOverride,
  });
}
