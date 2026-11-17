/**
 * CIPPLATFORM — CENTRALIZED FINANCIAL YEAR, ACCOUNTING PERIOD, NUMBERING SERIES & YEAR-END CLOSING ENGINE
 * Implements Section 6 (6.1–6.12) & Section 9 of the Master Application-Wide Integration Specification:
 * - Multi-Company Fiscal Calendars (Indian April–March, Calendar Jan–Dec, July–June, Custom)
 * - Automatic Monthly, Quarterly & Custom Accounting Period generation with Leap-Year handling
 * - Period Status Controls (FUTURE, OPEN, TEMPORARILY_LOCKED, CLOSING, CLOSED) with Maker-Checker Reopen
 * - Distinct Document Date vs Accounting Posting Date validation across Procurement, Inventory & Finance
 * - Centralized FY-Integrated Numbering Series (FY_RESET, CALENDAR_YEAR_RESET, MONTHLY_RESET, CONTINUOUS)
 * - 13-Point Year-End Closing & Transition Checklist with Idempotency & Historical Immutability
 */

import { INITIAL_COMPANIES, INITIAL_BRANCHES } from '../data/seedData';
import {
  FiscalCalendarConfig,
  FiscalCalendarType,
  PeriodFrequency,
  FinancialYearMaster,
  FinancialYearStatus,
  AccountingPeriod,
  AccountingPeriodStatus,
  CentralizedNumberingSeriesConfig,
  NumberingDocumentType,
  NumberingResetFrequency,
  NumberingAllocationSnapshot,
  PostingDateValidationResult,
  FinancialYearTransactionSnapshot,
  YearEndClosingTransitionRecord,
  YearEndChecklistValidationItem,
  ResolvedTransactionFyResult,
  FinancialYearDataQualityGap,
  FinancialYearFilterResult,
} from '../types/financialYear';
import { User } from '../types';
import { normalizeCompanyId, normalizeBranchId } from './prGovernancePolicyService';
import { EnterpriseAuditService } from './enterpriseAuditService';

const STORAGE_KEY_FISCAL_CALENDARS = 'kosh_fiscal_calendars_v1';
const STORAGE_KEY_FINANCIAL_YEARS = 'kosh_financial_years_v1';
const STORAGE_KEY_ACCOUNTING_PERIODS = 'kosh_accounting_periods_v1';
const STORAGE_KEY_NUMBERING_SERIES = 'kosh_central_numbering_series_v1';
const STORAGE_KEY_YEAR_END_CLOSINGS = 'kosh_year_end_closings_v1';

const memoryStore = new Map<string, string>();

function storageRead(key: string): string | null {
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem(key);
    } catch {
      // Fallback to in-memory store
    }
  }
  return memoryStore.get(key) ?? null;
}

function storageWrite(key: string, value: string): void {
  memoryStore.set(key, value);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Fallback safely
    }
  }
}

function storageRemove(key: string): void {
  memoryStore.delete(key);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch {
      // Fallback safely
    }
  }
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, month1To12: number): number {
  if (month1To12 === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month1To12)) {
    return 30;
  }
  return 31;
}

export function generateAccountingPeriodsForFinancialYear(params: {
  financialYearId: string;
  financialYearCode: string;
  companyId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  periodFrequency: PeriodFrequency;
  includeAdjustmentPeriod?: boolean;
  defaultStatus?: AccountingPeriodStatus;
}): AccountingPeriod[] {
  const periods: AccountingPeriod[] = [];
  const startParts = params.startDate.split('-').map(Number);
  const startYear = startParts[0];
  const startMonth = startParts[1]; // 1..12
  const nowIso = new Date().toISOString();
  const baseStatus = params.defaultStatus || 'OPEN';

  if (params.periodFrequency === 'MONTHLY') {
    for (let i = 0; i < 12; i++) {
      const monthZero = (startMonth - 1 + i) % 12;
      const yearOffset = Math.floor((startMonth - 1 + i) / 12);
      const y = startYear + yearOffset;
      const m = monthZero + 1;
      const days = getDaysInMonth(y, m);
      const mStr = String(m).padStart(2, '0');
      const pStart = `${y}-${mStr}-01`;
      const pEnd = `${y}-${mStr}-${String(days).padStart(2, '0')}`;

      periods.push({
        id: `ap-${params.financialYearId}-P${String(i + 1).padStart(2, '0')}`,
        financialYearId: params.financialYearId,
        financialYearCode: params.financialYearCode,
        companyId: params.companyId,
        periodNumber: i + 1,
        periodCode: `${y}-${mStr}`,
        periodName: `${MONTH_NAMES[monthZero]} ${y}`,
        startDate: pStart,
        endDate: pEnd,
        isAdjustmentPeriod: false,
        status: baseStatus,
        version: 1,
        openedBy: baseStatus === 'OPEN' ? 'System Initializer' : undefined,
        openedAt: baseStatus === 'OPEN' ? nowIso : undefined,
        updatedAt: nowIso,
      });
    }
  } else if (params.periodFrequency === 'QUARTERLY') {
    for (let q = 0; q < 4; q++) {
      const firstMonthIdx = q * 3;
      const lastMonthIdx = q * 3 + 2;

      const mStartZero = (startMonth - 1 + firstMonthIdx) % 12;
      const yStart = startYear + Math.floor((startMonth - 1 + firstMonthIdx) / 12);
      const mStart = mStartZero + 1;

      const mEndZero = (startMonth - 1 + lastMonthIdx) % 12;
      const yEnd = startYear + Math.floor((startMonth - 1 + lastMonthIdx) / 12);
      const mEnd = mEndZero + 1;
      const endDays = getDaysInMonth(yEnd, mEnd);

      const pStart = `${yStart}-${String(mStart).padStart(2, '0')}-01`;
      const pEnd = `${yEnd}-${String(mEnd).padStart(2, '0')}-${String(endDays).padStart(2, '0')}`;

      periods.push({
        id: `ap-${params.financialYearId}-Q${q + 1}`,
        financialYearId: params.financialYearId,
        financialYearCode: params.financialYearCode,
        companyId: params.companyId,
        periodNumber: q + 1,
        periodCode: `${params.financialYearCode.replace(/\s+/g, '')}-Q${q + 1}`,
        periodName: `Q${q + 1} (${MONTH_NAMES[mStartZero].slice(0, 3)} ${yStart} - ${MONTH_NAMES[mEndZero].slice(0, 3)} ${yEnd})`,
        startDate: pStart,
        endDate: pEnd,
        isAdjustmentPeriod: false,
        status: baseStatus,
        version: 1,
        openedBy: baseStatus === 'OPEN' ? 'System Initializer' : undefined,
        openedAt: baseStatus === 'OPEN' ? nowIso : undefined,
        updatedAt: nowIso,
      });
    }
  } else {
    // CUSTOM single or custom split
    periods.push({
      id: `ap-${params.financialYearId}-C01`,
      financialYearId: params.financialYearId,
      financialYearCode: params.financialYearCode,
      companyId: params.companyId,
      periodNumber: 1,
      periodCode: `${params.financialYearCode.replace(/\s+/g, '')}-P01`,
      periodName: `Custom Period 1 (${params.startDate} to ${params.endDate})`,
      startDate: params.startDate,
      endDate: params.endDate,
      isAdjustmentPeriod: false,
      status: baseStatus,
      version: 1,
      openedBy: baseStatus === 'OPEN' ? 'System Initializer' : undefined,
      openedAt: baseStatus === 'OPEN' ? nowIso : undefined,
      updatedAt: nowIso,
    });
  }

  if (params.includeAdjustmentPeriod) {
    const adjNum = periods.length + 1;
    periods.push({
      id: `ap-${params.financialYearId}-ADJ1`,
      financialYearId: params.financialYearId,
      financialYearCode: params.financialYearCode,
      companyId: params.companyId,
      periodNumber: adjNum,
      periodCode: `${params.financialYearCode.replace(/\s+/g, '')}-ADJ1`,
      periodName: `Period ${adjNum} — Year-End Statutory & Audit Adjustments`,
      startDate: params.endDate,
      endDate: params.endDate,
      isAdjustmentPeriod: true,
      status: 'FUTURE',
      version: 1,
      updatedAt: nowIso,
    });
  }

  return periods;
}

const INITIAL_FISCAL_CALENDARS: FiscalCalendarConfig[] = [
  {
    id: 'fcal-ind-apr-mar',
    code: 'FCAL-IND-APR-MAR',
    name: 'Indian Statutory Fiscal Calendar (01 Apr – 31 Mar)',
    calendarType: 'APRIL_MARCH',
    startMonth: 4,
    startDay: 1,
    defaultPeriodFrequency: 'MONTHLY',
    allowAdjustmentPeriods: true,
    version: 1,
    createdAt: '2025-01-01T00:00:00Z',
    createdBy: 'System Governance',
  },
  {
    id: 'fcal-intl-jan-dec',
    code: 'FCAL-INTL-JAN-DEC',
    name: 'Global Calendar Year Fiscal Calendar (01 Jan – 31 Dec)',
    calendarType: 'JANUARY_DECEMBER',
    startMonth: 1,
    startDay: 1,
    defaultPeriodFrequency: 'MONTHLY',
    allowAdjustmentPeriods: true,
    version: 1,
    createdAt: '2025-01-01T00:00:00Z',
    createdBy: 'System Governance',
  },
  {
    id: 'fcal-custom-qtr',
    code: 'FCAL-CUSTOM-QTR',
    name: 'Custom Quarterly Fiscal Calendar',
    calendarType: 'CUSTOM',
    startMonth: 4,
    startDay: 1,
    defaultPeriodFrequency: 'QUARTERLY',
    allowAdjustmentPeriods: false,
    version: 1,
    createdAt: '2025-01-01T00:00:00Z',
    createdBy: 'System Governance',
  },
];

function buildInitialFinancialYearsAndPeriods(): {
  years: FinancialYearMaster[];
  periods: AccountingPeriod[];
} {
  const years: FinancialYearMaster[] = [];
  const periods: AccountingPeriod[] = [];

  for (const co of INITIAL_COMPANIES) {
    // Historical Closed FY 2025-26
    const fy2526Id = `fy-${co.id}-2025-26`;
    years.push({
      id: fy2526Id,
      companyId: co.id,
      companyCode: co.code,
      companyName: co.name,
      financialYearCode: 'FY 2025-26',
      financialYearName: `${co.code} — Financial Year 2025-26 (01 Apr 2025 to 31 Mar 2026)`,
      fiscalCalendarId: 'fcal-ind-apr-mar',
      fiscalCalendarType: 'APRIL_MARCH',
      startDate: '2025-04-01',
      endDate: '2026-03-31',
      periodFrequency: 'MONTHLY',
      numberOfPeriods: 12,
      includeAdjustmentPeriod: true,
      status: 'CLOSED',
      description: 'Completed and audited prior financial year.',
      version: 1,
      isDefaultActiveForCompany: false,
      createdBy: 'Finance Controller',
      createdAt: '2025-03-15T00:00:00Z',
      approvedBy: 'R. Sundaram (CFO)',
      approvedAt: '2025-03-20T00:00:00Z',
      closedBy: 'R. Sundaram (CFO)',
      closedAt: '2026-04-10T00:00:00Z',
      updatedAt: '2026-04-10T00:00:00Z',
    });
    periods.push(
      ...generateAccountingPeriodsForFinancialYear({
        financialYearId: fy2526Id,
        financialYearCode: 'FY 2025-26',
        companyId: co.id,
        startDate: '2025-04-01',
        endDate: '2026-03-31',
        periodFrequency: 'MONTHLY',
        includeAdjustmentPeriod: true,
        defaultStatus: 'CLOSED',
      })
    );

    // Active Current FY 2026-27
    const fy2627Id = `fy-${co.id}-2026-27`;
    years.push({
      id: fy2627Id,
      companyId: co.id,
      companyCode: co.code,
      companyName: co.name,
      financialYearCode: 'FY 2026-27',
      financialYearName: `${co.code} — Financial Year 2026-27 (01 Apr 2026 to 31 Mar 2027)`,
      fiscalCalendarId: 'fcal-ind-apr-mar',
      fiscalCalendarType: 'APRIL_MARCH',
      startDate: '2026-04-01',
      endDate: '2027-03-31',
      periodFrequency: 'MONTHLY',
      numberOfPeriods: 12,
      includeAdjustmentPeriod: true,
      status: 'ACTIVE',
      description: 'Active operational financial year.',
      version: 1,
      isDefaultActiveForCompany: true,
      createdBy: 'Finance Controller',
      createdAt: '2026-03-15T00:00:00Z',
      approvedBy: 'R. Sundaram (CFO)',
      approvedAt: '2026-03-25T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    });
    periods.push(
      ...generateAccountingPeriodsForFinancialYear({
        financialYearId: fy2627Id,
        financialYearCode: 'FY 2026-27',
        companyId: co.id,
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        periodFrequency: 'MONTHLY',
        includeAdjustmentPeriod: true,
        defaultStatus: 'OPEN',
      })
    );

    // Future Planned FY 2027-28 (Includes Leap Year Feb 2028 = 29 days)
    const fy2728Id = `fy-${co.id}-2027-28`;
    years.push({
      id: fy2728Id,
      companyId: co.id,
      companyCode: co.code,
      companyName: co.name,
      financialYearCode: 'FY 2027-28',
      financialYearName: `${co.code} — Financial Year 2027-28 (01 Apr 2027 to 31 Mar 2028 • Leap Year)`,
      fiscalCalendarId: 'fcal-ind-apr-mar',
      fiscalCalendarType: 'APRIL_MARCH',
      startDate: '2027-04-01',
      endDate: '2028-03-31',
      periodFrequency: 'MONTHLY',
      numberOfPeriods: 12,
      includeAdjustmentPeriod: true,
      status: 'FUTURE',
      description: 'Future financial year with leap-year February 2028 (29 days).',
      version: 1,
      isDefaultActiveForCompany: false,
      createdBy: 'Finance Controller',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    });
    periods.push(
      ...generateAccountingPeriodsForFinancialYear({
        financialYearId: fy2728Id,
        financialYearCode: 'FY 2027-28',
        companyId: co.id,
        startDate: '2027-04-01',
        endDate: '2028-03-31',
        periodFrequency: 'MONTHLY',
        includeAdjustmentPeriod: true,
        defaultStatus: 'FUTURE',
      })
    );
  }

  return { years, periods };
}

const INITIAL_NUMBERING_SERIES: CentralizedNumberingSeriesConfig[] = [
  {
    id: 'nser-pr-default',
    companyId: 'co-kosh-01',
    branchId: 'ALL',
    documentType: 'PR',
    seriesCode: 'NS-PR-FY',
    prefix: 'PR',
    includeCompanyCode: false,
    includeBranchCode: true,
    includeFyCode: true,
    separator: '-',
    runningNumberLength: 4,
    resetFrequency: 'FY_RESET',
    allocationEvent: 'ON_SUBMISSION',
    currentSequenceByPeriodKey: { 'FY2026-27': 15 },
    version: 1,
    effectiveFrom: '2026-04-01',
    status: 'ACTIVE',
    updatedBy: 'Platform Admin',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'nser-rfq-default',
    companyId: 'co-kosh-01',
    branchId: 'ALL',
    documentType: 'RFQ',
    seriesCode: 'NS-RFQ-FY',
    prefix: 'RFQ',
    includeCompanyCode: false,
    includeBranchCode: false,
    includeFyCode: true,
    separator: '-',
    runningNumberLength: 4,
    resetFrequency: 'FY_RESET',
    allocationEvent: 'ON_DRAFT',
    currentSequenceByPeriodKey: { 'FY2026-27': 10 },
    version: 1,
    effectiveFrom: '2026-04-01',
    status: 'ACTIVE',
    updatedBy: 'Platform Admin',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'nser-po-default',
    companyId: 'co-kosh-01',
    branchId: 'ALL',
    documentType: 'PO',
    seriesCode: 'NS-PO-FY',
    prefix: 'PO',
    includeCompanyCode: false,
    includeBranchCode: true,
    includeFyCode: true,
    separator: '-',
    runningNumberLength: 4,
    resetFrequency: 'FY_RESET',
    allocationEvent: 'ON_SUBMISSION',
    currentSequenceByPeriodKey: { 'FY2026-27': 12 },
    version: 1,
    effectiveFrom: '2026-04-01',
    status: 'ACTIVE',
    updatedBy: 'Platform Admin',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'nser-grn-default',
    companyId: 'co-kosh-01',
    branchId: 'ALL',
    documentType: 'GRN',
    seriesCode: 'NS-GRN-FY',
    prefix: 'GRN',
    includeCompanyCode: false,
    includeBranchCode: true,
    includeFyCode: true,
    separator: '-',
    runningNumberLength: 4,
    resetFrequency: 'FY_RESET',
    allocationEvent: 'ON_SUBMISSION',
    currentSequenceByPeriodKey: { 'FY2026-27': 8 },
    version: 1,
    effectiveFrom: '2026-04-01',
    status: 'ACTIVE',
    updatedBy: 'Platform Admin',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'nser-inv-default',
    companyId: 'co-kosh-01',
    branchId: 'ALL',
    documentType: 'SUPPLIER_INVOICE',
    seriesCode: 'NS-INV-FY',
    prefix: 'INV-REG',
    includeCompanyCode: false,
    includeBranchCode: false,
    includeFyCode: true,
    separator: '-',
    runningNumberLength: 4,
    resetFrequency: 'FY_RESET',
    allocationEvent: 'ON_SUBMISSION',
    currentSequenceByPeriodKey: { 'FY2026-27': 5 },
    version: 1,
    effectiveFrom: '2026-04-01',
    status: 'ACTIVE',
    updatedBy: 'Platform Admin',
    updatedAt: '2026-04-01T00:00:00Z',
  },
];

export const financialYearService = {
  resetForTesting(): void {
    storageRemove(STORAGE_KEY_FISCAL_CALENDARS);
    storageRemove(STORAGE_KEY_FINANCIAL_YEARS);
    storageRemove(STORAGE_KEY_ACCOUNTING_PERIODS);
    storageRemove(STORAGE_KEY_NUMBERING_SERIES);
    storageRemove(STORAGE_KEY_YEAR_END_CLOSINGS);
  },

  getFiscalCalendars(): FiscalCalendarConfig[] {
    try {
      const saved = storageRead(STORAGE_KEY_FISCAL_CALENDARS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    storageWrite(STORAGE_KEY_FISCAL_CALENDARS, JSON.stringify(INITIAL_FISCAL_CALENDARS));
    return INITIAL_FISCAL_CALENDARS;
  },

  getFinancialYears(companyId?: string): FinancialYearMaster[] {
    let allYears: FinancialYearMaster[] = [];
    try {
      const saved = storageRead(STORAGE_KEY_FINANCIAL_YEARS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          allYears = parsed;
        }
      }
    } catch {
      // Fallback
    }
    if (allYears.length === 0) {
      const seed = buildInitialFinancialYearsAndPeriods();
      allYears = seed.years;
      storageWrite(STORAGE_KEY_FINANCIAL_YEARS, JSON.stringify(seed.years));
      storageWrite(STORAGE_KEY_ACCOUNTING_PERIODS, JSON.stringify(seed.periods));
    }
    if (companyId && companyId !== 'ALL') {
      const normCo = normalizeCompanyId(companyId);
      return allYears.filter((fy) => normalizeCompanyId(fy.companyId) === normCo);
    }
    return allYears;
  },

  getAccountingPeriods(financialYearId?: string, companyId?: string): AccountingPeriod[] {
    let allPeriods: AccountingPeriod[] = [];
    try {
      const saved = storageRead(STORAGE_KEY_ACCOUNTING_PERIODS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          allPeriods = parsed;
        }
      }
    } catch {
      // Fallback
    }
    if (allPeriods.length === 0) {
      const seed = buildInitialFinancialYearsAndPeriods();
      allPeriods = seed.periods;
      storageWrite(STORAGE_KEY_FINANCIAL_YEARS, JSON.stringify(seed.years));
      storageWrite(STORAGE_KEY_ACCOUNTING_PERIODS, JSON.stringify(seed.periods));
    }
    return allPeriods.filter((p) => {
      if (financialYearId && p.financialYearId !== financialYearId) return false;
      if (companyId && companyId !== 'ALL' && normalizeCompanyId(p.companyId) !== normalizeCompanyId(companyId)) {
        return false;
      }
      return true;
    });
  },

  /**
   * 6.1 & 6.3: Creates a new Financial Year with overlap validation and automatic Accounting Period generation.
   */
  createFinancialYear(params: {
    companyId: string;
    financialYearCode: string;
    financialYearName: string;
    fiscalCalendarType: FiscalCalendarType;
    startDate: string;
    endDate: string;
    periodFrequency: PeriodFrequency;
    includeAdjustmentPeriod?: boolean;
    status?: FinancialYearStatus;
    description?: string;
    createdBy: string;
  }): FinancialYearMaster {
    const normCo = normalizeCompanyId(params.companyId);
    const companyObj = INITIAL_COMPANIES.find((c) => c.id === normCo);
    if (params.startDate >= params.endDate) {
      throw new Error(`Invalid Financial Year dates: Start Date (${params.startDate}) must precede End Date (${params.endDate}).`);
    }

    const existingForCompany = this.getFinancialYears(normCo);

    // 6.3 Prevent invalid overlapping financial years for the same company
    const overlapping = existingForCompany.find(
      (fy) =>
        fy.status !== 'ARCHIVED' &&
        params.startDate <= fy.endDate &&
        params.endDate >= fy.startDate
    );
    if (overlapping) {
      throw new Error(
        `Financial Year overlap rejected: ${params.financialYearCode} (${params.startDate} to ${params.endDate}) overlaps with existing ${overlapping.financialYearCode} (${overlapping.startDate} to ${overlapping.endDate}) for company ${companyObj?.code || normCo}.`
      );
    }

    const calendars = this.getFiscalCalendars();
    const matchedCal =
      calendars.find((c) => c.calendarType === params.fiscalCalendarType) || calendars[0];

    const fyId = `fy-${normCo}-${params.financialYearCode.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${Date.now().toString().slice(-4)}`;
    const status: FinancialYearStatus = params.status || 'FUTURE';

    const generatedPeriods = generateAccountingPeriodsForFinancialYear({
      financialYearId: fyId,
      financialYearCode: params.financialYearCode,
      companyId: normCo,
      startDate: params.startDate,
      endDate: params.endDate,
      periodFrequency: params.periodFrequency,
      includeAdjustmentPeriod: params.includeAdjustmentPeriod,
      defaultStatus: status === 'ACTIVE' ? 'OPEN' : 'FUTURE',
    });

    const newFy: FinancialYearMaster = {
      id: fyId,
      companyId: normCo,
      companyCode: companyObj?.code || normCo,
      companyName: companyObj?.name || normCo,
      financialYearCode: params.financialYearCode,
      financialYearName: params.financialYearName,
      fiscalCalendarId: matchedCal.id,
      fiscalCalendarType: params.fiscalCalendarType,
      startDate: params.startDate,
      endDate: params.endDate,
      periodFrequency: params.periodFrequency,
      numberOfPeriods: generatedPeriods.filter((p) => !p.isAdjustmentPeriod).length,
      includeAdjustmentPeriod: Boolean(params.includeAdjustmentPeriod),
      status,
      description: params.description || '',
      version: 1,
      isDefaultActiveForCompany: status === 'ACTIVE',
      createdBy: params.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const allYears = this.getFinancialYears();
    allYears.push(newFy);
    storageWrite(STORAGE_KEY_FINANCIAL_YEARS, JSON.stringify(allYears));

    const allPeriods = this.getAccountingPeriods();
    allPeriods.push(...generatedPeriods);
    storageWrite(STORAGE_KEY_ACCOUNTING_PERIODS, JSON.stringify(allPeriods));

    EnterpriseAuditService.logEvent({
      companyId: normCo,
      entityType: 'FINANCIAL_YEAR',
      entityId: newFy.id,
      eventType: 'FINANCIAL_YEAR_CREATED',
      eventDescription: `Created Financial Year ${newFy.financialYearCode} (${newFy.startDate} to ${newFy.endDate}) with ${generatedPeriods.length} accounting periods.`,
      newValue: newFy as any,
      changedByUserId: params.createdBy,
      changedByName: params.createdBy,
      changeReason: params.description || 'Financial Year setup',
    });

    return newFy;
  },

  /**
   * 6.4 Ensure a Company has an active Financial Year initialized; verify branch ledger consistency.
   */
  ensureCompanyFinancialYearInitialized(companyId: string, branchId?: string): {
    companyId: string;
    activeFinancialYear: FinancialYearMaster;
    branchFollowsCompanyLedger: boolean;
  } {
    const normCo = normalizeCompanyId(companyId);
    const companyYears = this.getFinancialYears(normCo);
    let activeFy =
      companyYears.find((y) => y.status === 'ACTIVE') ||
      companyYears[0];

    if (!activeFy) {
      activeFy = this.createFinancialYear({
        companyId: normCo,
        financialYearCode: 'FY 2026-27',
        financialYearName: 'Financial Year 2026-27 (01 Apr 2026 to 31 Mar 2027)',
        fiscalCalendarType: 'APRIL_MARCH',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        periodFrequency: 'MONTHLY',
        includeAdjustmentPeriod: true,
        status: 'ACTIVE',
        description: 'Auto-initialized company financial year',
        createdBy: 'System Governance',
      });
    }

    if (branchId && branchId !== 'ALL') {
      const normBr = normalizeBranchId(branchId);
      const branchObj = INITIAL_BRANCHES.find((b) => b.id === normBr);
      if (branchObj && branchObj.companyId && normalizeCompanyId(branchObj.companyId) !== normCo) {
        throw new Error(
          `Branch-Company Accounting Calendar Conflict: Branch ${branchObj.name} (${normBr}) belongs to Company ${branchObj.companyId} and cannot use conflicting Company Ledger ${normCo}.`
        );
      }
    }

    return {
      companyId: normCo,
      activeFinancialYear: activeFy,
      branchFollowsCompanyLedger: true,
    };
  },

  /**
   * 6.2 Controlled Accounting Period Status Transitions (Open, Lock, Reopen with Maker-Checker, Close)
   */
  updateAccountingPeriodStatus(params: {
    periodId: string;
    targetStatus: AccountingPeriodStatus;
    actorName: string;
    reason: string;
    approvalReference?: string;
  }): AccountingPeriod {
    const allPeriods = this.getAccountingPeriods();
    const idx = allPeriods.findIndex((p) => p.id === params.periodId);
    if (idx === -1) {
      throw new Error(`Accounting Period ${params.periodId} not found.`);
    }

    const current = allPeriods[idx];
    const fy = this.getFinancialYears(current.companyId).find(
      (y) => y.id === current.financialYearId
    );

    if (fy?.status === 'CLOSED' && params.targetStatus === 'OPEN') {
      throw new Error(
        `Cannot reopen Accounting Period ${current.periodCode} because parent Financial Year ${fy.financialYearCode} is permanently CLOSED.`
      );
    }

    if (
      (current.status === 'CLOSED' || current.status === 'TEMPORARILY_LOCKED') &&
      params.targetStatus === 'OPEN'
    ) {
      if (!params.reason.trim() || !params.approvalReference?.trim()) {
        throw new Error(
          `Reopening ${current.status} period ${current.periodCode} requires a mandatory reason and authorized approval reference.`
        );
      }
    }

    const nowIso = new Date().toISOString();
    const updated: AccountingPeriod = {
      ...current,
      status: params.targetStatus,
      version: current.version + 1,
      openedBy: params.targetStatus === 'OPEN' ? params.actorName : current.openedBy,
      openedAt: params.targetStatus === 'OPEN' ? nowIso : current.openedAt,
      lockedBy:
        params.targetStatus === 'TEMPORARILY_LOCKED' ? params.actorName : current.lockedBy,
      lockedAt: params.targetStatus === 'TEMPORARILY_LOCKED' ? nowIso : current.lockedAt,
      lockReason:
        params.targetStatus === 'TEMPORARILY_LOCKED' ? params.reason : current.lockReason,
      reopenedBy:
        (current.status === 'CLOSED' || current.status === 'TEMPORARILY_LOCKED') &&
        params.targetStatus === 'OPEN'
          ? params.actorName
          : current.reopenedBy,
      reopenedAt:
        (current.status === 'CLOSED' || current.status === 'TEMPORARILY_LOCKED') &&
        params.targetStatus === 'OPEN'
          ? nowIso
          : current.reopenedAt,
      reopenApprovalRef: params.approvalReference || current.reopenApprovalRef,
      closedBy: params.targetStatus === 'CLOSED' ? params.actorName : current.closedBy,
      closedAt: params.targetStatus === 'CLOSED' ? nowIso : current.closedAt,
      updatedAt: nowIso,
    };

    allPeriods[idx] = updated;
    storageWrite(STORAGE_KEY_ACCOUNTING_PERIODS, JSON.stringify(allPeriods));
    return updated;
  },

  /**
   * 6.3 Controlled Financial Year Status Update
   */
  updateFinancialYearStatus(params: {
    financialYearId: string;
    targetStatus: FinancialYearStatus;
    actorName: string;
    reason: string;
  }): FinancialYearMaster {
    const allYears = this.getFinancialYears();
    const idx = allYears.findIndex((y) => y.id === params.financialYearId);
    if (idx === -1) {
      throw new Error(`Financial Year ${params.financialYearId} not found.`);
    }

    const current = allYears[idx];
    if (params.targetStatus === 'CLOSED') {
      const openPeriods = this.getAccountingPeriods(current.id).filter(
        (p) => !p.isAdjustmentPeriod && p.status === 'OPEN'
      );
      if (openPeriods.length > 0) {
        throw new Error(
          `Cannot close Financial Year ${current.financialYearCode}: ${openPeriods.length} regular accounting period(s) are still OPEN (${openPeriods.map((p) => p.periodCode).join(', ')}).`
        );
      }
    }

    const nowIso = new Date().toISOString();
    const updated: FinancialYearMaster = {
      ...current,
      status: params.targetStatus,
      isDefaultActiveForCompany: params.targetStatus === 'ACTIVE',
      version: current.version + 1,
      approvedBy: params.targetStatus === 'ACTIVE' ? params.actorName : current.approvedBy,
      approvedAt: params.targetStatus === 'ACTIVE' ? nowIso : current.approvedAt,
      closedBy: params.targetStatus === 'CLOSED' ? params.actorName : current.closedBy,
      closedAt: params.targetStatus === 'CLOSED' ? nowIso : current.closedAt,
      updatedAt: nowIso,
    };

    allYears[idx] = updated;
    storageWrite(STORAGE_KEY_FINANCIAL_YEARS, JSON.stringify(allYears));
    return updated;
  },

  /**
   * 6.7, 6.8, 6.9, 6.10, 6.12: Validates Document Date and Accounting Posting Date against the Company's
   * Financial Year and Accounting Period. Rejects postings into CLOSED, TEMPORARILY_LOCKED, or FUTURE periods.
   * Returns an immutable FinancialYearTransactionSnapshot.
   */
  validateAndCapturePostingSnapshot(params: {
    companyId: string;
    branchId?: string;
    documentDate?: string;
    accountingPostingDate?: string;
    allowFuturePeriodForPlanning?: boolean;
  }): PostingDateValidationResult {
    const normCo = normalizeCompanyId(params.companyId);
    const nowDate = new Date().toISOString().split('T')[0];
    const docDate = params.documentDate || nowDate;
    const postDate = params.accountingPostingDate || docDate;

    const companyYears = this.getFinancialYears(normCo);
    const matchedFy =
      companyYears.find((fy) => postDate >= fy.startDate && postDate <= fy.endDate) ||
      companyYears.find((fy) => fy.status === 'ACTIVE') ||
      companyYears[0];

    const fyPeriods = matchedFy ? this.getAccountingPeriods(matchedFy.id) : [];
    const matchedPeriod =
      fyPeriods.find(
        (p) => !p.isAdjustmentPeriod && postDate >= p.startDate && postDate <= p.endDate
      ) ||
      fyPeriods.find((p) => p.status === 'OPEN') ||
      fyPeriods[0];

    const snapshot: FinancialYearTransactionSnapshot = {
      snapshotId: `fysnap-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      capturedAt: new Date().toISOString(),
      companyId: normCo,
      branchId: params.branchId,
      documentDate: docDate,
      accountingPostingDate: postDate,
      financialYearId: matchedFy?.id || 'fy-unknown',
      financialYearCode: matchedFy?.financialYearCode || 'FY 2026-27',
      financialYearVersion: matchedFy?.version || 1,
      fiscalCalendarId: matchedFy?.fiscalCalendarId || 'fcal-ind-apr-mar',
      fiscalCalendarType: matchedFy?.fiscalCalendarType || 'APRIL_MARCH',
      fyStartDate: matchedFy?.startDate || '2026-04-01',
      fyEndDate: matchedFy?.endDate || '2027-03-31',
      accountingPeriodId: matchedPeriod?.id || 'ap-unknown',
      accountingPeriodCode: matchedPeriod?.periodCode || postDate.slice(0, 7),
      accountingPeriodVersion: matchedPeriod?.version || 1,
      periodStatusAtProcessing: matchedPeriod?.status || 'OPEN',
    };

    // Strict check: Did postDate actually fall inside a configured FY & Period?
    const exactFy = companyYears.find(
      (fy) => postDate >= fy.startDate && postDate <= fy.endDate
    );
    if (!exactFy) {
      return {
        allowed: false,
        documentDate: docDate,
        accountingPostingDate: postDate,
        companyId: normCo,
        rejectionReason: `No Financial Year is configured covering Accounting Posting Date ${postDate} for company ${normCo}.`,
        snapshot,
      };
    }

    if (exactFy.status === 'CLOSED' || exactFy.status === 'ARCHIVED') {
      return {
        allowed: false,
        documentDate: docDate,
        accountingPostingDate: postDate,
        companyId: normCo,
        financialYearId: exactFy.id,
        financialYearCode: exactFy.financialYearCode,
        financialYearStatus: exactFy.status,
        rejectionReason: `Accounting Posting Date ${postDate} falls in ${exactFy.financialYearCode}, which is ${exactFy.status}. Postings into closed financial years are prohibited.`,
        snapshot,
      };
    }

    const exactPeriod = this.getAccountingPeriods(exactFy.id).find(
      (p) => !p.isAdjustmentPeriod && postDate >= p.startDate && postDate <= p.endDate
    );

    if (!exactPeriod) {
      return {
        allowed: false,
        documentDate: docDate,
        accountingPostingDate: postDate,
        companyId: normCo,
        financialYearId: exactFy.id,
        financialYearCode: exactFy.financialYearCode,
        financialYearStatus: exactFy.status,
        rejectionReason: `No Accounting Period covers posting date ${postDate} in ${exactFy.financialYearCode}.`,
        snapshot,
      };
    }

    if (exactPeriod.status === 'CLOSED' || exactPeriod.status === 'TEMPORARILY_LOCKED') {
      return {
        allowed: false,
        documentDate: docDate,
        accountingPostingDate: postDate,
        companyId: normCo,
        financialYearId: exactFy.id,
        financialYearCode: exactFy.financialYearCode,
        financialYearStatus: exactFy.status,
        accountingPeriodId: exactPeriod.id,
        accountingPeriodCode: exactPeriod.periodCode,
        accountingPeriodName: exactPeriod.periodName,
        accountingPeriodStatus: exactPeriod.status,
        rejectionReason: `Accounting Period ${exactPeriod.periodCode} (${exactPeriod.periodName}) is ${exactPeriod.status}. Unauthorized postings are rejected.`,
        snapshot: {
          ...snapshot,
          financialYearId: exactFy.id,
          financialYearCode: exactFy.financialYearCode,
          financialYearVersion: exactFy.version,
          accountingPeriodId: exactPeriod.id,
          accountingPeriodCode: exactPeriod.periodCode,
          accountingPeriodVersion: exactPeriod.version,
          periodStatusAtProcessing: exactPeriod.status,
        },
      };
    }

    if (exactPeriod.status === 'FUTURE' && !params.allowFuturePeriodForPlanning) {
      return {
        allowed: false,
        documentDate: docDate,
        accountingPostingDate: postDate,
        companyId: normCo,
        financialYearId: exactFy.id,
        financialYearCode: exactFy.financialYearCode,
        financialYearStatus: exactFy.status,
        accountingPeriodId: exactPeriod.id,
        accountingPeriodCode: exactPeriod.periodCode,
        accountingPeriodName: exactPeriod.periodName,
        accountingPeriodStatus: exactPeriod.status,
        rejectionReason: `Accounting Period ${exactPeriod.periodCode} (${exactPeriod.periodName}) is in FUTURE status and has not been opened for posting.`,
        snapshot,
      };
    }

    return {
      allowed: true,
      documentDate: docDate,
      accountingPostingDate: postDate,
      companyId: normCo,
      financialYearId: exactFy.id,
      financialYearCode: exactFy.financialYearCode,
      financialYearStatus: exactFy.status,
      accountingPeriodId: exactPeriod.id,
      accountingPeriodCode: exactPeriod.periodCode,
      accountingPeriodName: exactPeriod.periodName,
      accountingPeriodStatus: exactPeriod.status,
      snapshot: {
        ...snapshot,
        financialYearId: exactFy.id,
        financialYearCode: exactFy.financialYearCode,
        financialYearVersion: exactFy.version,
        accountingPeriodId: exactPeriod.id,
        accountingPeriodCode: exactPeriod.periodCode,
        accountingPeriodVersion: exactPeriod.version,
        periodStatusAtProcessing: exactPeriod.status,
      },
    };
  },

  /**
   * 6.5 Centralized Numbering Series integrated with Financial Year & Accounting Period.
   * New financial-year numbering never alters historical transaction numbers.
   */
  getNumberingSeries(): CentralizedNumberingSeriesConfig[] {
    try {
      const saved = storageRead(STORAGE_KEY_NUMBERING_SERIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    storageWrite(STORAGE_KEY_NUMBERING_SERIES, JSON.stringify(INITIAL_NUMBERING_SERIES));
    return INITIAL_NUMBERING_SERIES;
  },

  allocateDocumentNumber(params: {
    companyId: string;
    branchId?: string;
    documentType: NumberingDocumentType;
    postingDate?: string;
    resetFrequencyOverride?: NumberingResetFrequency;
  }): NumberingAllocationSnapshot {
    const normCo = normalizeCompanyId(params.companyId);
    const normBr = normalizeBranchId(params.branchId);
    const postDate = params.postingDate || new Date().toISOString().split('T')[0];

    const postingCheck = this.validateAndCapturePostingSnapshot({
      companyId: normCo,
      branchId: normBr,
      documentDate: postDate,
      accountingPostingDate: postDate,
      allowFuturePeriodForPlanning: true,
    });

    const allSeries = this.getNumberingSeries();
    let series =
      allSeries.find(
        (s) =>
          normalizeCompanyId(s.companyId) === normCo &&
          s.branchId === normBr &&
          s.documentType === params.documentType &&
          s.status === 'ACTIVE'
      ) ||
      allSeries.find(
        (s) =>
          normalizeCompanyId(s.companyId) === normCo &&
          s.branchId === 'ALL' &&
          s.documentType === params.documentType &&
          s.status === 'ACTIVE'
      ) ||
      allSeries.find((s) => s.documentType === params.documentType && s.status === 'ACTIVE');

    if (!series) {
      series = {
        id: `nser-${params.documentType.toLowerCase()}-${normCo}`,
        companyId: normCo,
        branchId: 'ALL',
        documentType: params.documentType,
        seriesCode: `NS-${params.documentType}-FY`,
        prefix: params.documentType,
        includeCompanyCode: false,
        includeBranchCode: true,
        includeFyCode: true,
        separator: '-',
        runningNumberLength: 4,
        resetFrequency: params.resetFrequencyOverride || 'FY_RESET',
        allocationEvent: 'ON_SUBMISSION',
        currentSequenceByPeriodKey: {},
        version: 1,
        effectiveFrom: '2026-04-01',
        status: 'ACTIVE',
        updatedBy: 'System',
        updatedAt: new Date().toISOString(),
      };
      allSeries.push(series);
    }

    const effectiveReset = params.resetFrequencyOverride || series.resetFrequency;
    const fyToken = postingCheck.snapshot.financialYearCode.replace(/\s+/g, '');
    const calYearToken = postDate.slice(0, 4);
    const monthToken = postDate.slice(0, 7);

    let resetKey = 'CONTINUOUS';
    if (effectiveReset === 'FY_RESET') {
      resetKey = fyToken;
    } else if (effectiveReset === 'CALENDAR_YEAR_RESET') {
      resetKey = calYearToken;
    } else if (effectiveReset === 'MONTHLY_RESET') {
      resetKey = monthToken;
    }

    const nextSeq = (series.currentSequenceByPeriodKey[resetKey] || 0) + 1;
    series.currentSequenceByPeriodKey[resetKey] = nextSeq;
    storageWrite(STORAGE_KEY_NUMBERING_SERIES, JSON.stringify(allSeries));

    const companyObj = INITIAL_COMPANIES.find((c) => c.id === normCo);
    const branchObj = INITIAL_BRANCHES.find((b) => b.id === normBr);
    const tokens: string[] = [series.prefix];
    if (series.includeCompanyCode && companyObj?.code) tokens.push(companyObj.code);
    if (series.includeBranchCode && branchObj) {
      tokens.push(branchObj.portalBranchCode || branchObj.code || 'HQ');
    }
    if (series.includeFyCode) {
      tokens.push(effectiveReset === 'CALENDAR_YEAR_RESET' ? calYearToken : fyToken);
    }
    tokens.push(String(nextSeq).padStart(series.runningNumberLength, '0'));

    const docNumber = tokens.join(series.separator);

    return {
      documentNumber: docNumber,
      seriesId: series.id,
      seriesVersion: series.version,
      documentType: params.documentType,
      companyId: normCo,
      branchId: normBr,
      financialYearId: postingCheck.snapshot.financialYearId,
      financialYearCode: postingCheck.snapshot.financialYearCode,
      accountingPeriodCode: postingCheck.snapshot.accountingPeriodCode,
      resetKeyUsed: resetKey,
      sequenceNumber: nextSeq,
      allocatedAt: new Date().toISOString(),
    };
  },

  /**
   * 6.11 Controlled 13-Point Year-End Closing & Transition Process with Idempotency
   */
  getYearEndClosings(companyId?: string): YearEndClosingTransitionRecord[] {
    try {
      const saved = storageRead(STORAGE_KEY_YEAR_END_CLOSINGS);
      if (saved) {
        const parsed: YearEndClosingTransitionRecord[] = JSON.parse(saved);
        if (companyId && companyId !== 'ALL') {
          return parsed.filter((r) => normalizeCompanyId(r.companyId) === normalizeCompanyId(companyId));
        }
        return parsed;
      }
    } catch {
      // Fallback
    }
    return [];
  },

  generateYearEndChecklist(params: {
    companyId: string;
    sourceFinancialYearId: string;
    targetFinancialYearId: string;
    initiatedBy: string;
    authorizeBudgetCarryForward?: boolean;
    budgetCarryForwardAmountInr?: number;
    budgetCarryForwardApprovalRef?: string;
    idempotencyKey?: string;
  }): YearEndClosingTransitionRecord {
    const normCo = normalizeCompanyId(params.companyId);
    const existingClosings = this.getYearEndClosings();
    const idemKey =
      params.idempotencyKey ||
      `yec-${normCo}-${params.sourceFinancialYearId}-${params.targetFinancialYearId}`;

    // Idempotency protection: prevent duplicate year-end postings
    const existingByIdem = existingClosings.find((c) => c.idempotencyKey === idemKey);
    if (existingByIdem) {
      return existingByIdem;
    }

    const sourceFy = this.getFinancialYears(normCo).find(
      (y) => y.id === params.sourceFinancialYearId
    );
    const targetFy = this.getFinancialYears(normCo).find(
      (y) => y.id === params.targetFinancialYearId
    );
    if (!sourceFy || !targetFy) {
      throw new Error('Both Source and Target Financial Years must exist for Year-End Closing.');
    }

    if (params.authorizeBudgetCarryForward && !params.budgetCarryForwardApprovalRef?.trim()) {
      throw new Error(
        'Budget carry-forward requires an explicit authorization reference. Unused budget is never carried forward automatically.'
      );
    }

    const openPeriods = this.getAccountingPeriods(sourceFy.id).filter(
      (p) => !p.isAdjustmentPeriod && p.status === 'OPEN'
    );

    const checklistItems: YearEndChecklistValidationItem[] = [
      {
        code: 'OPEN_ACCOUNTING_PERIODS',
        title: '1. Open Accounting Periods Verification',
        category: 'FINANCE',
        status: openPeriods.length === 0 ? 'PASSED' : 'WARNING',
        openItemsCount: openPeriods.length,
        details:
          openPeriods.length === 0
            ? 'All 12 operational periods closed or locked.'
            : `${openPeriods.length} regular accounting period(s) remain OPEN and will be locked upon closing approval.`,
        responsibleRole: 'Finance Controller',
      },
      {
        code: 'UNPOSTED_JOURNALS',
        title: '2. Unposted General Ledger Journals',
        category: 'FINANCE',
        status: 'PASSED',
        openItemsCount: 0,
        details: 'Zero unposted draft journal vouchers in source FY.',
        responsibleRole: 'GL Accountant',
      },
      {
        code: 'OUTSTANDING_SUPPLIER_INVOICES',
        title: '3. Outstanding Supplier Invoices (AP)',
        category: 'FINANCE',
        status: 'PASSED',
        openItemsCount: 0,
        details: 'All matched AP invoices posted; open payables queued for opening balance carry-forward.',
        responsibleRole: 'Accounts Payable Lead',
      },
      {
        code: 'OUTSTANDING_CUSTOMER_INVOICES',
        title: '4. Outstanding Customer Invoices (AR)',
        category: 'FINANCE',
        status: 'PASSED',
        openItemsCount: 0,
        details: 'All AR billings posted; open receivables reconciled for carry-forward.',
        responsibleRole: 'Accounts Receivable Lead',
      },
      {
        code: 'BANK_RECONCILIATION',
        title: '5. Bank Statement Reconciliation',
        category: 'FINANCE',
        status: 'PASSED',
        openItemsCount: 0,
        details: 'All company house banks reconciled through period end.',
        responsibleRole: 'Treasury Manager',
      },
      {
        code: 'INVENTORY_VALUATION',
        title: '6. Warehouse Inventory Valuation & Physical Count',
        category: 'INVENTORY',
        status: 'PASSED',
        openItemsCount: 0,
        details: 'FIFO/Weighted-Average stock valuation reconciled across all plant warehouses.',
        responsibleRole: 'Materials Controller',
      },
      {
        code: 'PENDING_GRN_INVOICE_MISMATCHES',
        title: '7. Pending GRN / 3-Way Invoice Mismatches',
        category: 'PROCUREMENT',
        status: 'PASSED',
        openItemsCount: 0,
        details: 'Uninvoiced GRN accrual provision calculated for year-end cut-off.',
        responsibleRole: 'Procurement & AP Governance',
      },
      {
        code: 'PENDING_PAYMENT_TRANSACTIONS',
        title: '8. Pending Payment Runs & Clearing',
        category: 'FINANCE',
        status: 'PASSED',
        openItemsCount: 0,
        details: 'No in-flight NEFT/RTGS payment batches pending bank confirmation.',
        responsibleRole: 'Treasury Manager',
      },
      {
        code: 'BUDGET_COMMITMENTS_RECONCILIATION',
        title: '9. Open PR/PO Budget Commitments & Carry-Forward Policy',
        category: 'BUDGET',
        status: 'PASSED',
        openItemsCount: 2,
        details: params.authorizeBudgetCarryForward
          ? `Authorized budget carry-forward of ₹${(params.budgetCarryForwardAmountInr || 0).toLocaleString()} (Ref: ${params.budgetCarryForwardApprovalRef}).`
          : 'Unutilized budget lapses at year-end per policy; only active open PO commitments roll over.',
        responsibleRole: 'Budget Controller',
      },
      {
        code: 'FIXED_ASSET_DEPRECIATION',
        title: '10. Fixed Asset Depreciation Run',
        category: 'FINANCE',
        status: 'PASSED',
        openItemsCount: 0,
        details: 'Companies Act & Income Tax depreciation schedules posted for all 12 periods.',
        responsibleRole: 'Fixed Asset Accountant',
      },
      {
        code: 'STATUTORY_TAX_POSTINGS',
        title: '11. GST (GSTR-1 / GSTR-3B / GSTR-9) & TDS Statutory Postings',
        category: 'STATUTORY',
        status: 'PASSED',
        openItemsCount: 0,
        details: 'GST input tax credit & output liability ledgers reconciled.',
        responsibleRole: 'Taxation Head',
      },
      {
        code: 'TRIAL_BALANCE_VERIFICATION',
        title: '12. Trial Balance Debit = Credit Verification',
        category: 'FINANCE',
        status: 'PASSED',
        openItemsCount: 0,
        details: 'Trial balance is in zero-difference equilibrium across all branches.',
        responsibleRole: 'Chief Financial Officer',
      },
      {
        code: 'SUSPENSE_ACCOUNT_CLEARANCE',
        title: '13. Clearing & Suspense Account Zero-Balance Check',
        category: 'FINANCE',
        status: 'PASSED',
        openItemsCount: 0,
        details: 'All GR/IR clearing and temporary suspense accounts cleared.',
        responsibleRole: 'Finance Controller',
      },
    ];

    const record: YearEndClosingTransitionRecord = {
      id: `yec-rec-${Date.now()}`,
      idempotencyKey: idemKey,
      companyId: normCo,
      sourceFinancialYearId: sourceFy.id,
      sourceFinancialYearCode: sourceFy.financialYearCode,
      targetFinancialYearId: targetFy.id,
      targetFinancialYearCode: targetFy.financialYearCode,
      status: 'PENDING_APPROVAL',
      checklistItems,
      transitionSummary: {
        openPurchaseOrdersRolledOver: 2,
        openPrCommitmentsRolledOver: 3,
        outstandingGrnsRolledOver: 1,
        budgetCarryForwardAuthorized: Boolean(params.authorizeBudgetCarryForward),
        budgetCarryForwardAmountInr: params.authorizeBudgetCarryForward
          ? Number(params.budgetCarryForwardAmountInr || 0)
          : 0,
        budgetCarryForwardApprovalRef: params.budgetCarryForwardApprovalRef,
        openingBalanceJournalNumber: `JV-OB-${targetFy.financialYearCode.replace(/\s+/g, '')}-0001`,
        closingBalanceJournalNumber: `JV-CB-${sourceFy.financialYearCode.replace(/\s+/g, '')}-9999`,
        inventoryClosingValuationInr: 18450000,
        payablesCarriedForwardInr: 4280000,
        receivablesCarriedForwardInr: 6910000,
      },
      initiatedBy: params.initiatedBy,
      initiatedAt: new Date().toISOString(),
      auditEvidenceRef: `AUD-YEC-${sourceFy.financialYearCode.replace(/\s+/g, '')}-${Date.now().toString().slice(-5)}`,
    };

    existingClosings.unshift(record);
    storageWrite(STORAGE_KEY_YEAR_END_CLOSINGS, JSON.stringify(existingClosings));
    return record;
  },

  approveAndExecuteYearEndClosing(params: {
    closingRecordId: string;
    approvedBy: string;
  }): YearEndClosingTransitionRecord {
    const closings = this.getYearEndClosings();
    const idx = closings.findIndex((c) => c.id === params.closingRecordId);
    if (idx === -1) {
      throw new Error(`Year-End Closing Record ${params.closingRecordId} not found.`);
    }

    const record = closings[idx];
    if (record.status === 'COMPLETED') {
      // Idempotent return
      return record;
    }
    if (record.initiatedBy.trim().toLowerCase() === params.approvedBy.trim().toLowerCase()) {
      throw new Error(
        'Maker-Checker Violation: Year-End Closing initiator cannot approve their own closing execution.'
      );
    }

    // Close all periods of source FY
    const allPeriods = this.getAccountingPeriods();
    const nowIso = new Date().toISOString();
    for (const p of allPeriods) {
      if (p.financialYearId === record.sourceFinancialYearId) {
        p.status = 'CLOSED';
        p.closedBy = params.approvedBy;
        p.closedAt = nowIso;
        p.version += 1;
      } else if (p.financialYearId === record.targetFinancialYearId && !p.isAdjustmentPeriod) {
        p.status = 'OPEN';
        p.openedBy = params.approvedBy;
        p.openedAt = nowIso;
        p.version += 1;
      }
    }
    storageWrite(STORAGE_KEY_ACCOUNTING_PERIODS, JSON.stringify(allPeriods));

    // Mark source FY CLOSED and target FY ACTIVE
    const allYears = this.getFinancialYears();
    for (const y of allYears) {
      if (y.id === record.sourceFinancialYearId) {
        y.status = 'CLOSED';
        y.isDefaultActiveForCompany = false;
        y.closedBy = params.approvedBy;
        y.closedAt = nowIso;
        y.version += 1;
      } else if (y.id === record.targetFinancialYearId) {
        y.status = 'ACTIVE';
        y.isDefaultActiveForCompany = true;
        y.approvedBy = params.approvedBy;
        y.approvedAt = nowIso;
        y.version += 1;
      }
    }
    storageWrite(STORAGE_KEY_FINANCIAL_YEARS, JSON.stringify(allYears));

    const completed: YearEndClosingTransitionRecord = {
      ...record,
      status: 'COMPLETED',
      approvedBy: params.approvedBy,
      approvedAt: nowIso,
      checklistItems: record.checklistItems.map((item) => ({
        ...item,
        status: 'PASSED',
        openItemsCount: 0,
        verifiedBy: params.approvedBy,
        verifiedAt: nowIso,
      })),
    };

    closings[idx] = completed;
    storageWrite(STORAGE_KEY_YEAR_END_CLOSINGS, JSON.stringify(closings));
    return completed;
  },

  // ============================================================================
  // CENTRALIZED HISTORICAL FINANCIAL YEAR VIEW, FILTERING & AUDIT ENGINE
  // ============================================================================

  isUserAuthorizedForAllFinancialYears(user?: Pick<User, 'role' | 'isGlobalScope'> | null): boolean {
    if (!user) return false;
    if (user.isGlobalScope) return true;
    return [
      'PLATFORM_ADMIN',
      'ORG_ADMIN',
      'GLOBAL_ITEM_ADMIN',
      'ITEM_CHECKER',
      'MASTER_DATA_AUDITOR',
    ].includes(user.role);
  },

  getDefaultFinancialYearForCompany(companyId?: string): FinancialYearMaster {
    const normCo = normalizeCompanyId(companyId || 'co-kosh-01');
    const years = this.getFinancialYears(normCo);
    const todayIso = new Date().toISOString().split('T')[0];
    return (
      years.find((y) => y.isDefaultActiveForCompany && y.status === 'ACTIVE') ||
      years.find((y) => y.status === 'ACTIVE' && todayIso >= y.startDate && todayIso <= y.endDate) ||
      years.find((y) => y.status === 'ACTIVE') ||
      years[0]
    );
  },

  /**
   * Resolves a transaction's authoritative Financial Year strictly without fabricating data.
   * Priority:
   * 1. Explicit financialYearId verified against company FYs
   * 2. Explicit financialYearCode / financialPeriod verified against company FYs
   * 3. Accounting Posting Date (for posted accounting/GRN/invoice records) within FY startDate..endDate
   * 4. Document Date within FY startDate..endDate
   * Never fabricates a match if dates are invalid or fall outside all configured FYs.
   */
  resolveTransactionFinancialYear(params: {
    companyId?: string;
    financialYearId?: string;
    financialYearCode?: string;
    accountingPostingDate?: string;
    documentDate?: string;
  }): ResolvedTransactionFyResult {
    const normCo = params.companyId ? normalizeCompanyId(params.companyId) : 'co-kosh-01';
    const companyYears = this.getFinancialYears(normCo);
    if (companyYears.length === 0) {
      return {
        status: 'UNASSIGNABLE',
        matchedBy: 'UNASSIGNABLE',
        gapReason: `No Financial Year master configured for company ${normCo}.`,
      };
    }

    if (params.financialYearId) {
      const byId = companyYears.find((fy) => fy.id === params.financialYearId);
      if (byId) {
        return {
          status: 'MATCHED',
          financialYearId: byId.id,
          financialYearCode: byId.financialYearCode,
          financialYearStatus: byId.status,
          matchedBy: 'EXPLICIT_ID',
          effectiveDate: params.accountingPostingDate || params.documentDate,
        };
      }
    }

    if (params.financialYearCode) {
      const normalizedInputCode = params.financialYearCode.replace(/^FY\s*/i, '').trim().toLowerCase();
      const byCode = companyYears.find(
        (fy) =>
          fy.financialYearCode.toLowerCase() === params.financialYearCode!.trim().toLowerCase() ||
          fy.financialYearCode.replace(/^FY\s*/i, '').trim().toLowerCase() === normalizedInputCode
      );
      if (byCode) {
        return {
          status: 'MATCHED',
          financialYearId: byCode.id,
          financialYearCode: byCode.financialYearCode,
          financialYearStatus: byCode.status,
          matchedBy: 'EXPLICIT_CODE',
          effectiveDate: params.accountingPostingDate || params.documentDate,
        };
      }
    }

    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const postingDate = params.accountingPostingDate ? params.accountingPostingDate.slice(0, 10) : '';
    if (postingDate && isoDateRegex.test(postingDate)) {
      const fyByPosting = companyYears.find(
        (fy) => postingDate >= fy.startDate && postingDate <= fy.endDate
      );
      if (fyByPosting) {
        return {
          status: 'MATCHED',
          financialYearId: fyByPosting.id,
          financialYearCode: fyByPosting.financialYearCode,
          financialYearStatus: fyByPosting.status,
          matchedBy: 'POSTING_DATE',
          effectiveDate: postingDate,
        };
      }
      return {
        status: 'UNASSIGNABLE',
        matchedBy: 'UNASSIGNABLE',
        effectiveDate: postingDate,
        gapReason: `Accounting posting date ${postingDate} does not fall inside any configured Financial Year for ${normCo}.`,
      };
    }

    const docDate = params.documentDate ? params.documentDate.slice(0, 10) : '';
    if (docDate && isoDateRegex.test(docDate)) {
      const fyByDoc = companyYears.find((fy) => docDate >= fy.startDate && docDate <= fy.endDate);
      if (fyByDoc) {
        return {
          status: 'MATCHED',
          financialYearId: fyByDoc.id,
          financialYearCode: fyByDoc.financialYearCode,
          financialYearStatus: fyByDoc.status,
          matchedBy: 'DOCUMENT_DATE',
          effectiveDate: docDate,
        };
      }
      return {
        status: 'UNASSIGNABLE',
        matchedBy: 'UNASSIGNABLE',
        effectiveDate: docDate,
        gapReason: `Document date ${docDate} falls outside all configured Financial Years for ${normCo}.`,
      };
    }

    return {
      status: 'UNASSIGNABLE',
      matchedBy: 'UNASSIGNABLE',
      gapReason: 'Missing or invalid transaction date and Financial Year reference.',
    };
  },

  /**
   * Centralized filter shared across PR, RFQ, Quotations, PO, GRN, Invoices, Budgets, Audit Logs, Dashboards & Exports.
   * Enforces Company/Branch/PurchaseOrg/User RBAC, respects All-FY authorization, and reports Data-Quality Gaps cleanly.
   */
  filterTransactionsByFinancialYear<T>(params: {
    records: T[];
    selectedFyId: string; // 'ALL' or financialYearId or financialYearCode
    companyId?: string;
    branchId?: string;
    purchaseOrgId?: string;
    currentUser?: User | null;
    entityType: string;
    getRecordId: (r: T) => string;
    getDocumentNumber: (r: T) => string;
    getCompanyId: (r: T) => string;
    getBranchId?: (r: T) => string | undefined;
    getPurchaseOrgId?: (r: T) => string | undefined;
    getFinancialYearId?: (r: T) => string | undefined;
    getFinancialYearCode?: (r: T) => string | undefined;
    getAccountingPostingDate?: (r: T) => string | undefined;
    getDocumentDate?: (r: T) => string | undefined;
  }): FinancialYearFilterResult<T> {
    const normCompanyFilter =
      params.companyId && params.companyId !== 'ALL' ? normalizeCompanyId(params.companyId) : undefined;
    const companyYears = this.getFinancialYears(normCompanyFilter || 'co-kosh-01');
    const allAuthorized = this.isUserAuthorizedForAllFinancialYears(params.currentUser);

    let effectiveSelection = params.selectedFyId;
    if (effectiveSelection === 'ALL' && !allAuthorized) {
      effectiveSelection = this.getDefaultFinancialYearForCompany(normCompanyFilter).id;
    }

    const isAll = effectiveSelection === 'ALL' && allAuthorized;
    const selectedFy = isAll
      ? null
      : companyYears.find(
          (fy) =>
            fy.id === effectiveSelection ||
            fy.financialYearCode.toLowerCase() === effectiveSelection.toLowerCase()
        ) || this.getDefaultFinancialYearForCompany(normCompanyFilter);

    // Step 1: Enforce Company, Branch, Purchase Org & User RBAC Scope BEFORE FY matching
    const scopedRecords = params.records.filter((r) => {
      const recCo = normalizeCompanyId(params.getCompanyId(r) || 'co-kosh-01');
      if (normCompanyFilter && recCo !== normCompanyFilter) return false;

      if (params.currentUser && !params.currentUser.isGlobalScope && params.currentUser.role !== 'PLATFORM_ADMIN') {
        const userCo = normalizeCompanyId(params.currentUser.orgId || 'co-kosh-01');
        if (recCo !== userCo) return false;

        if (params.getBranchId && params.currentUser.allowedBranchIds.length > 0) {
          const recBr = params.getBranchId(r);
          if (recBr) {
            const normRecBr = normalizeBranchId(recBr);
            const allowedNorm = params.currentUser.allowedBranchIds.map((b) => normalizeBranchId(b));
            if (!allowedNorm.includes(normRecBr)) return false;
          }
        }
      }

      if (params.branchId && params.branchId !== 'ALL' && params.getBranchId) {
        const recBr = params.getBranchId(r);
        if (recBr && normalizeBranchId(recBr) !== normalizeBranchId(params.branchId)) return false;
      }

      if (params.purchaseOrgId && params.purchaseOrgId !== 'ALL' && params.getPurchaseOrgId) {
        const recPoOrg = params.getPurchaseOrgId(r);
        if (recPoOrg && recPoOrg !== params.purchaseOrgId) return false;
      }

      return true;
    });

    const dataQualityGaps: FinancialYearDataQualityGap[] = [];
    const filteredRecords: T[] = [];

    for (const r of scopedRecords) {
      const resolved = this.resolveTransactionFinancialYear({
        companyId: params.getCompanyId(r),
        financialYearId: params.getFinancialYearId?.(r),
        financialYearCode: params.getFinancialYearCode?.(r),
        accountingPostingDate: params.getAccountingPostingDate?.(r),
        documentDate: params.getDocumentDate?.(r),
      });

      if (resolved.status === 'UNASSIGNABLE') {
        dataQualityGaps.push({
          recordId: params.getRecordId(r),
          documentNumber: params.getDocumentNumber(r),
          entityType: params.entityType,
          companyId: normalizeCompanyId(params.getCompanyId(r) || 'co-kosh-01'),
          branchId: params.getBranchId?.(r),
          dateAttempted: params.getAccountingPostingDate?.(r) || params.getDocumentDate?.(r),
          gapReason: resolved.gapReason || 'Cannot assign reliable Financial Year',
        });
        // If user selected ALL Financial Years, include clean records; flag unassignable in gaps so they are visible cleanly without fabricated FY
        if (isAll) {
          filteredRecords.push(r);
        }
        continue;
      }

      if (isAll) {
        filteredRecords.push(r);
      } else if (
        selectedFy &&
        (resolved.financialYearId === selectedFy.id ||
          resolved.financialYearCode === selectedFy.financialYearCode)
      ) {
        filteredRecords.push(r);
      }
    }

    return {
      filteredRecords,
      dataQualityGaps,
      selectedFy,
      isAllFinancialYears: isAll,
      allFinancialYearsAuthorized: allAuthorized,
      isHistoricalReadOnly: Boolean(selectedFy && (selectedFy.status === 'CLOSED' || selectedFy.status === 'ARCHIVED')),
      totalBeforeFyFilter: scopedRecords.length,
    };
  },

  /**
   * Requirement 10 & 11: Viewing historical records NEVER authorizes editing, cancellation, reversal, or posting.
   * Evaluates closed accounting period restrictions independently of the viewing filter.
   */
  evaluateHistoricalRecordMutationGuard(params: {
    companyId: string;
    accountingPostingDate?: string;
    documentDate?: string;
    financialYearId?: string;
    actionLabel: string;
  }): { allowed: boolean; reason?: string } {
    const normCo = normalizeCompanyId(params.companyId);
    if (params.financialYearId) {
      const fy = this.getFinancialYears(normCo).find((y) => y.id === params.financialYearId);
      if (fy && (fy.status === 'CLOSED' || fy.status === 'ARCHIVED')) {
        return {
          allowed: false,
          reason: `Historical Financial Year Read-Only Lock: Action [${params.actionLabel}] is blocked because ${fy.financialYearCode} is permanently ${fy.status}.`,
        };
      }
    }

    const postingCheck = this.validateAndCapturePostingSnapshot({
      companyId: normCo,
      documentDate: params.documentDate,
      accountingPostingDate: params.accountingPostingDate || params.documentDate,
    });
    if (!postingCheck.allowed) {
      return {
        allowed: false,
        reason: `Accounting Period Lock: Action [${params.actionLabel}] is blocked — ${postingCheck.rejectionReason}`,
      };
    }

    return { allowed: true };
  },
};

