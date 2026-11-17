/**
 * CIPPLATFORM — FINANCIAL YEAR-BASED HOLIDAY, WEEKLY OFF & WORKDAY CALENDAR ENGINE
 * Implements the 7 required centralized services:
 * 1. HolidayService
 * 2. WeeklyOffService
 * 3. CalendarValidationService
 * 4. CalendarGenerationService
 * 5. WorkdayCalendarService
 * 6. CalendarVersionService
 * 7. CalendarExceptionService
 *
 * Scope Restriction Enforced:
 * - Zero Shift Management tables, services, or placeholders.
 * - Clean extension hook (registerScheduleExtensionProvider) for future extensibility without redesign.
 */

import { INITIAL_COMPANIES, INITIAL_BRANCHES } from '../data/seedData';
import {
  HolidayMaster,
  HolidayCalendar,
  HolidayCalendarEntry,
  HolidayCalendarAssignment,
  WeeklyOffPattern,
  WeeklyOffAssignment,
  HolidayWeeklyOffConflictPolicy,
  HolidayWeeklyOffConflictRecord,
  CalendarException,
  CompensatoryOff,
  WorkdayCalendar,
  WorkdayCalendarEntry,
  MonthlyWorkingDaysSummary,
  CalendarVersion,
  CalendarApprovalHistory,
  WorkforceCategoryType,
  WorkdayScheduleExtensionProvider,
} from '../types/workdayCalendar';
import { financialYearService } from './financialYearService';
import { normalizeCompanyId, normalizeBranchId } from './prGovernancePolicyService';

const STORAGE_KEY_HOLIDAY_MASTERS = 'kosh_holiday_masters_v1';
const STORAGE_KEY_HOLIDAY_CALENDARS = 'kosh_holiday_calendars_v1';
const STORAGE_KEY_HOLIDAY_ASSIGNMENTS = 'kosh_holiday_assignments_v1';
const STORAGE_KEY_WEEKLY_OFF_PATTERNS = 'kosh_weekly_off_patterns_v1';
const STORAGE_KEY_WEEKLY_OFF_ASSIGNMENTS = 'kosh_weekly_off_assignments_v1';
const STORAGE_KEY_WORKDAY_CALENDARS = 'kosh_workday_calendars_v1';
const STORAGE_KEY_CALENDAR_EXCEPTIONS = 'kosh_calendar_exceptions_v1';
const STORAGE_KEY_COMPENSATORY_OFFS = 'kosh_compensatory_offs_v1';
const STORAGE_KEY_CALENDAR_VERSIONS = 'kosh_calendar_versions_v1';
const STORAGE_KEY_CALENDAR_APPROVAL_HISTORY = 'kosh_calendar_approval_history_v1';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const calMemStore = new Map<string, string>();
const calStorage = {
  getItem(key: string): string | null {
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(key);
      } catch {
        // Fallback
      }
    }
    return calMemStore.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    calMemStore.set(key, value);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Fallback
      }
    }
  },
};

let registeredScheduleExtension: WorkdayScheduleExtensionProvider | null = null;

export function registerWorkdayScheduleExtension(provider: WorkdayScheduleExtensionProvider | null): void {
  registeredScheduleExtension = provider;
}

function parseUtcDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateStr: string, days: number): string {
  const dt = parseUtcDate(dateStr);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatUtcDate(dt);
}

function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let curr = parseUtcDate(startDate);
  const end = parseUtcDate(endDate);
  while (curr <= end) {
    dates.push(formatUtcDate(curr));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

const INITIAL_HOLIDAY_MASTERS: HolidayMaster[] = [
  {
    id: 'hol-nat-01',
    holidayCode: 'HOL-NAT-REP',
    holidayName: 'Republic Day',
    category: 'NATIONAL',
    durationType: 'FULL_DAY',
    isRecurringAnnual: true,
    recurringMonthDay: '01-26',
    applicableCountry: 'India',
    applicableStates: ['ALL'],
    applicableRegions: ['ALL'],
    companyId: 'ALL',
    branchId: 'ALL',
    plantCode: 'ALL',
    departmentId: 'ALL',
    workforceCategory: 'ALL_WORKFORCE',
    isPaidHoliday: true,
    description: 'National Gazette Holiday — Republic Day of India',
    status: 'ACTIVE',
    createdBy: 'HR Governance Admin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'hol-nat-02',
    holidayCode: 'HOL-NAT-IND',
    holidayName: 'Independence Day',
    category: 'NATIONAL',
    durationType: 'FULL_DAY',
    isRecurringAnnual: true,
    recurringMonthDay: '08-15',
    applicableCountry: 'India',
    applicableStates: ['ALL'],
    applicableRegions: ['ALL'],
    companyId: 'ALL',
    branchId: 'ALL',
    plantCode: 'ALL',
    departmentId: 'ALL',
    workforceCategory: 'ALL_WORKFORCE',
    isPaidHoliday: true,
    description: 'National Gazette Holiday — Independence Day',
    status: 'ACTIVE',
    createdBy: 'HR Governance Admin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'hol-nat-03',
    holidayCode: 'HOL-NAT-GJ',
    holidayName: 'Gandhi Jayanti',
    category: 'NATIONAL',
    durationType: 'FULL_DAY',
    isRecurringAnnual: true,
    recurringMonthDay: '10-02',
    applicableCountry: 'India',
    applicableStates: ['ALL'],
    applicableRegions: ['ALL'],
    companyId: 'ALL',
    branchId: 'ALL',
    plantCode: 'ALL',
    departmentId: 'ALL',
    workforceCategory: 'ALL_WORKFORCE',
    isPaidHoliday: true,
    description: 'National Gazette Holiday — Mahatma Gandhi Jayanti',
    status: 'ACTIVE',
    createdBy: 'HR Governance Admin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'hol-stat-01',
    holidayCode: 'HOL-STAT-MAY',
    holidayName: 'May Day / International Workers Day',
    category: 'STATUTORY',
    durationType: 'FULL_DAY',
    isRecurringAnnual: true,
    recurringMonthDay: '05-01',
    applicableCountry: 'India',
    applicableStates: ['Tamil Nadu', 'Puducherry', 'Maharashtra'],
    applicableRegions: ['South', 'West'],
    companyId: 'ALL',
    branchId: 'ALL',
    plantCode: 'ALL',
    departmentId: 'ALL',
    workforceCategory: 'ALL_WORKFORCE',
    isPaidHoliday: true,
    description: 'Statutory Factories Act Holiday',
    status: 'ACTIVE',
    createdBy: 'HR Governance Admin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'hol-state-tn-01',
    holidayCode: 'HOL-ST-TN-NY',
    holidayName: 'Tamil Puthandu (Tamil New Year)',
    category: 'STATE',
    durationType: 'FULL_DAY',
    isRecurringAnnual: true,
    recurringMonthDay: '04-14',
    applicableCountry: 'India',
    applicableStates: ['Tamil Nadu', 'Puducherry'],
    applicableRegions: ['South'],
    companyId: 'ALL',
    branchId: 'ALL',
    plantCode: 'ALL',
    departmentId: 'ALL',
    workforceCategory: 'ALL_WORKFORCE',
    isPaidHoliday: true,
    description: 'State Holiday for Tamil Nadu & Puducherry branches',
    status: 'ACTIVE',
    createdBy: 'HR Governance Admin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'hol-state-tn-02',
    holidayCode: 'HOL-ST-PONGAL',
    holidayName: 'Thai Pongal / Makar Sankranti',
    category: 'REGIONAL',
    durationType: 'FULL_DAY',
    isRecurringAnnual: true,
    recurringMonthDay: '01-15',
    applicableCountry: 'India',
    applicableStates: ['Tamil Nadu', 'Puducherry', 'Gujarat'],
    applicableRegions: ['South', 'West'],
    companyId: 'ALL',
    branchId: 'ALL',
    plantCode: 'ALL',
    departmentId: 'ALL',
    workforceCategory: 'ALL_WORKFORCE',
    isPaidHoliday: true,
    description: 'Regional Harvest Festival Holiday',
    status: 'ACTIVE',
    createdBy: 'HR Governance Admin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'hol-comp-01',
    holidayCode: 'HOL-COMP-FOUND',
    holidayName: 'Kosh Innovations Founder & Safety Day',
    category: 'COMPANY',
    durationType: 'FULL_DAY',
    isRecurringAnnual: true,
    recurringMonthDay: '11-18',
    applicableCountry: 'India',
    applicableStates: ['ALL'],
    applicableRegions: ['ALL'],
    companyId: 'co-kosh-01',
    branchId: 'ALL',
    plantCode: 'ALL',
    departmentId: 'ALL',
    workforceCategory: 'ALL_WORKFORCE',
    isPaidHoliday: true,
    description: 'Company-wide annual foundation holiday for Kosh Innovations Pvt Ltd',
    status: 'ACTIVE',
    createdBy: 'HR Governance Admin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'hol-br-pdy-01',
    holidayCode: 'HOL-BR-PDY-LIB',
    holidayName: 'Puducherry De Jure Transfer / Liberation Day',
    category: 'BRANCH_SPECIFIC',
    durationType: 'FULL_DAY',
    isRecurringAnnual: true,
    recurringMonthDay: '08-16',
    applicableCountry: 'India',
    applicableStates: ['Puducherry'],
    applicableRegions: ['South'],
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    plantCode: 'ALL',
    departmentId: 'ALL',
    workforceCategory: 'ALL_WORKFORCE',
    isPaidHoliday: true,
    description: 'Branch-specific holiday for Puducherry Manufacturing Plant',
    status: 'ACTIVE',
    createdBy: 'Puducherry Plant HR',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'hol-plt-inj-01',
    holidayCode: 'HOL-PLT-AYUDHA',
    holidayName: 'Ayudha Pooja & Annual Tool-Room Calibration Half-Day',
    category: 'PLANT_SPECIFIC',
    durationType: 'HALF_DAY_SECOND_HALF',
    isRecurringAnnual: false,
    customDate: '2026-10-20',
    applicableCountry: 'India',
    applicableStates: ['ALL'],
    applicableRegions: ['ALL'],
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    plantCode: 'PLT-PDY-INJ',
    departmentId: 'ALL',
    workforceCategory: 'PLANT_OPERATIONS',
    isPaidHoliday: true,
    description: 'Plant-specific half-day holiday for Injection Moulding Plant worship & calibration',
    status: 'ACTIVE',
    createdBy: 'Plant Operations Head',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'hol-fest-diwali',
    holidayCode: 'HOL-FEST-DIWALI',
    holidayName: 'Deepavali (Diwali Festival)',
    category: 'NATIONAL',
    durationType: 'FULL_DAY',
    isRecurringAnnual: false,
    customDate: '2026-11-08', // Sunday in 2026 — demonstrates Holiday on Weekly Off conflict detection!
    applicableCountry: 'India',
    applicableStates: ['ALL'],
    applicableRegions: ['ALL'],
    companyId: 'ALL',
    branchId: 'ALL',
    plantCode: 'ALL',
    departmentId: 'ALL',
    workforceCategory: 'ALL_WORKFORCE',
    isPaidHoliday: true,
    description: 'Deepavali festival (falls on Sunday 08-Nov-2026 to test overlap conflict handling)',
    status: 'ACTIVE',
    createdBy: 'HR Governance Admin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'hol-opt-xmas-eve',
    holidayCode: 'HOL-OPT-XMASEVE',
    holidayName: 'Christmas Eve Restricted / Optional Holiday',
    category: 'RESTRICTED',
    durationType: 'FULL_DAY',
    isRecurringAnnual: true,
    recurringMonthDay: '12-24',
    applicableCountry: 'India',
    applicableStates: ['ALL'],
    applicableRegions: ['ALL'],
    companyId: 'ALL',
    branchId: 'ALL',
    plantCode: 'ALL',
    departmentId: 'ALL',
    workforceCategory: 'ALL_WORKFORCE',
    isPaidHoliday: true,
    maxRestrictedSelectionQuota: 2,
    description: 'Restricted / Optional Holiday selectable within employee annual quota',
    status: 'ACTIVE',
    createdBy: 'HR Governance Admin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const INITIAL_WEEKLY_OFF_PATTERNS: WeeklyOffPattern[] = [
  {
    id: 'woff-pdy-alt-sat',
    patternCode: 'WOFF-ALT-SAT-SUN',
    patternName: '2nd & 4th Saturday + All Sundays Off (Corporate & Technical)',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    plantCode: 'ALL',
    departmentId: 'ALL',
    employeeGroup: 'CORPORATE_STAFF',
    patternType: 'SECOND_AND_FOURTH_SATURDAY_SUNDAY',
    fixedDaysOfWeek: [0], // Sunday
    saturdayRule: 'SECOND_AND_FOURTH',
    standardDailyWorkingHours: 8,
    status: 'ACTIVE',
    version: 1,
    effectiveFrom: '2026-04-01',
    createdBy: 'HR Governance Admin',
    createdAt: '2026-03-15T00:00:00Z',
  },
  {
    id: 'woff-plant-sun-only',
    patternCode: 'WOFF-SUN-FIXED',
    patternName: 'Sunday Fixed Weekly Off (Manufacturing Plant Operations)',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    plantCode: 'PLT-PDY-INJ',
    departmentId: 'ALL',
    employeeGroup: 'PLANT_OPERATIONS',
    patternType: 'SUNDAY_ONLY',
    fixedDaysOfWeek: [0],
    saturdayRule: 'NONE',
    standardDailyWorkingHours: 8,
    status: 'ACTIVE',
    version: 1,
    effectiveFrom: '2026-04-01',
    createdBy: 'Plant HR Head',
    createdAt: '2026-03-15T00:00:00Z',
  },
  {
    id: 'woff-1st-3rd-sat',
    patternCode: 'WOFF-1ST-3RD-SAT',
    patternName: '1st & 3rd Saturday + All Sundays Off (Quality & R&D)',
    companyId: 'co-kosh-01',
    branchId: 'ALL',
    plantCode: 'ALL',
    departmentId: 'dept-pdy-02',
    employeeGroup: 'QUALITY_ENGINEERING',
    patternType: 'FIRST_AND_THIRD_SATURDAY_SUNDAY',
    fixedDaysOfWeek: [0],
    saturdayRule: 'FIRST_AND_THIRD',
    standardDailyWorkingHours: 8,
    status: 'ACTIVE',
    version: 1,
    effectiveFrom: '2026-04-01',
    createdBy: 'HR Governance Admin',
    createdAt: '2026-03-15T00:00:00Z',
  },
  {
    id: 'woff-rotational-6-1',
    patternCode: 'WOFF-ROT-6ON-1OFF',
    patternName: 'Rotational Weekly Off (6 Working Days / 1 Rotational Off — Group A)',
    companyId: 'co-kosh-02',
    branchId: 'br-chen-02',
    plantCode: 'PLT-CHN-EXT',
    departmentId: 'ALL',
    employeeGroup: 'PLANT_OPERATIONS',
    patternType: 'ROTATIONAL_WEEKLY_OFF',
    fixedDaysOfWeek: [],
    rotationalCycleDays: {
      workingDaysConsecutive: 6,
      offDaysConsecutive: 1,
      anchorStartDate: '2026-04-01',
      rotationGroupCode: 'ROT-GRP-A',
    },
    standardDailyWorkingHours: 8,
    status: 'ACTIVE',
    version: 1,
    effectiveFrom: '2026-04-01',
    createdBy: 'Chennai Plant HR',
    createdAt: '2026-03-15T00:00:00Z',
  },
];

function appendCalendarApprovalLog(entry: Omit<CalendarApprovalHistory, 'id' | 'timestamp'>): void {
  try {
    const raw = calStorage.getItem(STORAGE_KEY_CALENDAR_APPROVAL_HISTORY);
    const list: CalendarApprovalHistory[] = raw ? JSON.parse(raw) : [];
    list.unshift({
      ...entry,
      id: `cal-hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    });
    calStorage.setItem(STORAGE_KEY_CALENDAR_APPROVAL_HISTORY, JSON.stringify(list));
  } catch {
    // Ignore storage error
  }
}

/**
 * 1. HOLIDAY SERVICE
 */
export const HolidayService = {
  getHolidayMasters(filters?: {
    companyId?: string;
    branchId?: string;
    plantCode?: string;
    state?: string;
    category?: string;
  }): HolidayMaster[] {
    let masters: HolidayMaster[] = [];
    try {
      const saved = calStorage.getItem(STORAGE_KEY_HOLIDAY_MASTERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) masters = parsed;
      }
    } catch {
      // Fallback
    }
    if (masters.length === 0) {
      masters = INITIAL_HOLIDAY_MASTERS;
      calStorage.setItem(STORAGE_KEY_HOLIDAY_MASTERS, JSON.stringify(masters));
    }

    if (!filters) return masters;
    return masters.filter((h) => {
      if (
        filters.companyId &&
        filters.companyId !== 'ALL' &&
        h.companyId !== 'ALL' &&
        normalizeCompanyId(h.companyId) !== normalizeCompanyId(filters.companyId)
      ) {
        return false;
      }
      if (
        filters.branchId &&
        filters.branchId !== 'ALL' &&
        h.branchId !== 'ALL' &&
        normalizeBranchId(h.branchId) !== normalizeBranchId(filters.branchId)
      ) {
        return false;
      }
      if (
        filters.plantCode &&
        filters.plantCode !== 'ALL' &&
        h.plantCode !== 'ALL' &&
        h.plantCode !== filters.plantCode
      ) {
        return false;
      }
      if (
        filters.state &&
        filters.state !== 'ALL' &&
        !h.applicableStates.includes('ALL') &&
        !h.applicableStates.includes(filters.state)
      ) {
        return false;
      }
      if (filters.category && filters.category !== 'ALL' && h.category !== filters.category) {
        return false;
      }
      return true;
    });
  },

  saveHolidayMaster(
    payload: Omit<HolidayMaster, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): HolidayMaster {
    const masters = this.getHolidayMasters();
    const nowIso = new Date().toISOString();
    const existingIdx = payload.id ? masters.findIndex((m) => m.id === payload.id) : -1;

    const record: HolidayMaster = {
      ...payload,
      id: payload.id || `hol-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      companyId: payload.companyId === 'ALL' ? 'ALL' : normalizeCompanyId(payload.companyId),
      branchId: payload.branchId === 'ALL' ? 'ALL' : normalizeBranchId(payload.branchId),
      createdAt: existingIdx >= 0 ? masters[existingIdx].createdAt : nowIso,
      updatedAt: nowIso,
    };

    if (existingIdx >= 0) {
      masters[existingIdx] = record;
    } else {
      masters.unshift(record);
    }
    calStorage.setItem(STORAGE_KEY_HOLIDAY_MASTERS, JSON.stringify(masters));
    return record;
  },

  getHolidayCalendars(companyId?: string, financialYearId?: string): HolidayCalendar[] {
    let calendars: HolidayCalendar[] = [];
    try {
      const saved = calStorage.getItem(STORAGE_KEY_HOLIDAY_CALENDARS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) calendars = parsed;
      }
    } catch {
      // Fallback
    }
    return calendars.filter((c) => {
      if (
        companyId &&
        companyId !== 'ALL' &&
        normalizeCompanyId(c.companyId) !== normalizeCompanyId(companyId)
      ) {
        return false;
      }
      if (financialYearId && financialYearId !== 'ALL' && c.financialYearId !== financialYearId) {
        return false;
      }
      return true;
    });
  },

  /**
   * Generates a complete Financial-Year Holiday Calendar by resolving recurring & custom HolidayMaster records
   * across the exact Financial Year startDate..endDate range for the specified Company, Branch, Plant, State, and Workforce Category.
   */
  generateFinancialYearHolidayCalendar(params: {
    companyId: string;
    branchId: string;
    plantCode?: string;
    departmentId?: string;
    workforceCategory?: WorkforceCategoryType;
    financialYearId: string;
    calendarName?: string;
    maxOptionalHolidaysAllowed?: number;
    createdBy: string;
    modificationReason?: string;
  }): HolidayCalendar {
    const normCo = normalizeCompanyId(params.companyId);
    const normBr = normalizeBranchId(params.branchId);
    const companyObj = INITIAL_COMPANIES.find((c) => c.id === normCo);
    const branchObj = INITIAL_BRANCHES.find((b) => b.id === normBr);
    const stateName = branchObj?.state || companyObj?.state || 'Tamil Nadu';
    const plantCode = params.plantCode || 'ALL';
    const departmentId = params.departmentId || 'ALL';
    const workforceCategory = params.workforceCategory || 'ALL_WORKFORCE';

    const fy =
      financialYearService.getFinancialYears(normCo).find((y) => y.id === params.financialYearId) ||
      financialYearService.ensureCompanyFinancialYearInitialized(normCo).activeFinancialYear;

    const allMasters = this.getHolidayMasters().filter((m) => m.status === 'ACTIVE');

    // Filter applicable HolidayMasters for this Company + State + Branch + Plant + Department + Workforce
    const applicableMasters = allMasters.filter((m) => {
      const coMatch = m.companyId === 'ALL' || normalizeCompanyId(m.companyId) === normCo;
      const stateMatch =
        m.applicableStates.includes('ALL') || m.applicableStates.includes(stateName);
      const brMatch = m.branchId === 'ALL' || normalizeBranchId(m.branchId) === normBr;
      const pltMatch =
        m.plantCode === 'ALL' || plantCode === 'ALL' || m.plantCode === plantCode;
      const deptMatch =
        m.departmentId === 'ALL' || departmentId === 'ALL' || m.departmentId === departmentId;
      const wfMatch =
        m.workforceCategory === 'ALL_WORKFORCE' ||
        workforceCategory === 'ALL_WORKFORCE' ||
        m.workforceCategory === workforceCategory;
      return coMatch && stateMatch && brMatch && pltMatch && deptMatch && wfMatch;
    });

    const startYear = Number(fy.startDate.slice(0, 4));
    const endYear = Number(fy.endDate.slice(0, 4));
    const candidateYears = startYear === endYear ? [startYear] : [startYear, endYear];

    const entries: HolidayCalendarEntry[] = [];

    for (const master of applicableMasters) {
      if (master.isRecurringAnnual && master.recurringMonthDay) {
        for (const yr of candidateYears) {
          const candidateDate = `${yr}-${master.recurringMonthDay}`;
          if (candidateDate >= fy.startDate && candidateDate <= fy.endDate) {
            const dt = parseUtcDate(candidateDate);
            const dow = dt.getUTCDay();
            entries.push({
              id: `hce-${master.id}-${candidateDate}`,
              holidayMasterId: master.id,
              holidayCode: master.holidayCode,
              holidayName: master.holidayName,
              date: candidateDate,
              dayOfWeek: dow,
              dayName: DAY_NAMES[dow],
              category: master.category,
              durationType: master.durationType,
              dayWeight: master.durationType === 'FULL_DAY' ? 1 : 0.5,
              applicableStates: master.applicableStates,
              branchId: master.branchId,
              plantCode: master.plantCode,
              departmentId: master.departmentId,
              workforceCategory: master.workforceCategory,
              isOptionalOrRestricted:
                master.category === 'OPTIONAL' || master.category === 'RESTRICTED',
            });
          }
        }
      } else if (master.customDate) {
        if (master.customDate >= fy.startDate && master.customDate <= fy.endDate) {
          const dt = parseUtcDate(master.customDate);
          const dow = dt.getUTCDay();
          entries.push({
            id: `hce-${master.id}-${master.customDate}`,
            holidayMasterId: master.id,
            holidayCode: master.holidayCode,
            holidayName: master.holidayName,
            date: master.customDate,
            dayOfWeek: dow,
            dayName: DAY_NAMES[dow],
            category: master.category,
            durationType: master.durationType,
            dayWeight: master.durationType === 'FULL_DAY' ? 1 : 0.5,
            applicableStates: master.applicableStates,
            branchId: master.branchId,
            plantCode: master.plantCode,
            departmentId: master.departmentId,
            workforceCategory: master.workforceCategory,
            isOptionalOrRestricted:
              master.category === 'OPTIONAL' || master.category === 'RESTRICTED',
          });
        }
      }
    }

    entries.sort((a, b) => a.date.localeCompare(b.date));

    const existingCalendars = this.getHolidayCalendars(normCo, fy.id).filter(
      (c) =>
        normalizeBranchId(c.branchId) === normBr &&
        c.plantCode === plantCode &&
        c.departmentId === departmentId
    );
    const prevLatest =
      existingCalendars.length > 0
        ? existingCalendars.reduce((a, b) => (a.versionNumber > b.versionNumber ? a : b))
        : undefined;

    const nextVersion = prevLatest ? prevLatest.versionNumber + 1 : 1;

    const allCalendars = this.getHolidayCalendars();
    if (prevLatest) {
      const idx = allCalendars.findIndex((c) => c.id === prevLatest.id);
      if (idx >= 0) {
        allCalendars[idx] = {
          ...allCalendars[idx],
          approvalStatus: 'SUPERSEDED',
          effectiveUntil: new Date().toISOString().split('T')[0],
        };
      }
    }

    const calendar: HolidayCalendar = {
      id: `hcal-${normCo}-${normBr}-${fy.financialYearCode.replace(/\s+/g, '')}-v${nextVersion}-${Date.now().toString().slice(-4)}`,
      calendarCode: `HCAL-${companyObj?.code || 'CO'}-${branchObj?.portalBranchCode || 'ALL'}-${fy.financialYearCode.replace(/\s+/g, '')}-V${nextVersion}`,
      calendarName:
        params.calendarName ||
        `${companyObj?.code || normCo} (${branchObj?.name || 'All Branches'}) — ${fy.financialYearCode} Holiday Calendar`,
      companyId: normCo,
      companyCode: companyObj?.code || normCo,
      branchId: normBr,
      plantCode,
      departmentId,
      workforceCategory,
      stateName,
      financialYearId: fy.id,
      financialYearCode: fy.financialYearCode,
      startDate: fy.startDate,
      endDate: fy.endDate,
      entries,
      maxOptionalHolidaysAllowed: params.maxOptionalHolidaysAllowed ?? 2,
      versionNumber: nextVersion,
      previousVersionId: prevLatest?.id,
      effectiveFrom: fy.startDate,
      approvalStatus: 'APPROVED',
      createdBy: params.createdBy,
      createdAt: new Date().toISOString(),
      approvedBy: 'HR Governance Board',
      approvedAt: new Date().toISOString(),
      modificationReason: params.modificationReason || 'Financial Year Holiday Calendar Generation',
    };

    allCalendars.unshift(calendar);
    calStorage.setItem(STORAGE_KEY_HOLIDAY_CALENDARS, JSON.stringify(allCalendars));

    // Also record assignment
    const assignments = this.getHolidayCalendarAssignments();
    assignments.unshift({
      id: `hasgn-${Date.now()}`,
      companyId: normCo,
      branchId: normBr,
      plantCode,
      departmentId,
      workforceCategory,
      financialYearId: fy.id,
      financialYearCode: fy.financialYearCode,
      holidayCalendarId: calendar.id,
      holidayCalendarVersion: calendar.versionNumber,
      effectiveFrom: fy.startDate,
      assignedBy: params.createdBy,
      assignedAt: new Date().toISOString(),
    });
    calStorage.setItem(STORAGE_KEY_HOLIDAY_ASSIGNMENTS, JSON.stringify(assignments));

    return calendar;
  },

  getHolidayCalendarAssignments(): HolidayCalendarAssignment[] {
    try {
      const saved = calStorage.getItem(STORAGE_KEY_HOLIDAY_ASSIGNMENTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return [];
  },
};

/**
 * 2. WEEKLY OFF SERVICE
 */
export const WeeklyOffService = {
  getPatterns(companyId?: string, branchId?: string): WeeklyOffPattern[] {
    let patterns: WeeklyOffPattern[] = [];
    try {
      const saved = calStorage.getItem(STORAGE_KEY_WEEKLY_OFF_PATTERNS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) patterns = parsed;
      }
    } catch {
      // Fallback
    }
    if (patterns.length === 0) {
      patterns = INITIAL_WEEKLY_OFF_PATTERNS;
      calStorage.setItem(STORAGE_KEY_WEEKLY_OFF_PATTERNS, JSON.stringify(patterns));
    }

    return patterns.filter((p) => {
      if (
        companyId &&
        companyId !== 'ALL' &&
        p.companyId !== 'ALL' &&
        normalizeCompanyId(p.companyId) !== normalizeCompanyId(companyId)
      ) {
        return false;
      }
      if (
        branchId &&
        branchId !== 'ALL' &&
        p.branchId !== 'ALL' &&
        normalizeBranchId(p.branchId) !== normalizeBranchId(branchId)
      ) {
        return false;
      }
      return true;
    });
  },

  savePattern(
    payload: Omit<WeeklyOffPattern, 'id' | 'createdAt' | 'version'> & { id?: string }
  ): WeeklyOffPattern {
    const patterns = this.getPatterns();
    const existingIdx = payload.id ? patterns.findIndex((p) => p.id === payload.id) : -1;
    const nextVersion = existingIdx >= 0 ? patterns[existingIdx].version + 1 : 1;

    const record: WeeklyOffPattern = {
      ...payload,
      id: payload.id || `woff-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      companyId: payload.companyId === 'ALL' ? 'ALL' : normalizeCompanyId(payload.companyId),
      branchId: payload.branchId === 'ALL' ? 'ALL' : normalizeBranchId(payload.branchId),
      version: nextVersion,
      createdAt: existingIdx >= 0 ? patterns[existingIdx].createdAt : new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      patterns[existingIdx] = record;
    } else {
      patterns.unshift(record);
    }
    calStorage.setItem(STORAGE_KEY_WEEKLY_OFF_PATTERNS, JSON.stringify(patterns));
    return record;
  },

  /**
   * Evaluates whether a specific YYYY-MM-DD date is a Weekly Off under the given WeeklyOffPattern.
   * Supports:
   * - Fixed Sunday Off
   * - Monday–Saturday Off
   * - Alternate Saturday (Odd/Even weeks of the year)
   * - First & Third Saturday of the month
   * - Second & Fourth Saturday of the month
   * - Custom Fixed Days
   * - Rotational Weekly Off (e.g., 6 consecutive working days + 1 or 2 off days from anchor date)
   */
  isDateWeeklyOff(dateStr: string, pattern: WeeklyOffPattern): boolean {
    const dt = parseUtcDate(dateStr);
    const dow = dt.getUTCDay(); // 0 = Sun .. 6 = Sat
    const dayOfMonth = dt.getUTCDate(); // 1..31
    const occurrenceInMonth = Math.ceil(dayOfMonth / 7); // 1st, 2nd, 3rd, 4th, 5th occurrence of this weekday in month

    if (pattern.patternType === 'ROTATIONAL_WEEKLY_OFF' && pattern.rotationalCycleDays) {
      const anchor = parseUtcDate(pattern.rotationalCycleDays.anchorStartDate);
      const diffMs = dt.getTime() - anchor.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const cycleLen =
        pattern.rotationalCycleDays.workingDaysConsecutive +
        pattern.rotationalCycleDays.offDaysConsecutive;
      if (cycleLen <= 0) return false;
      const mod = ((diffDays % cycleLen) + cycleLen) % cycleLen;
      return mod >= pattern.rotationalCycleDays.workingDaysConsecutive;
    }

    if (pattern.patternType === 'SUNDAY_ONLY') {
      return dow === 0;
    }

    if (pattern.patternType === 'SATURDAY_SUNDAY') {
      return dow === 0 || dow === 6;
    }

    if (pattern.patternType === 'MONDAY_TO_SATURDAY_OFF') {
      return dow >= 1 && dow <= 6;
    }

    if (pattern.patternType === 'FIRST_AND_THIRD_SATURDAY_SUNDAY') {
      if (dow === 0) return true;
      if (dow === 6) return occurrenceInMonth === 1 || occurrenceInMonth === 3;
      return false;
    }

    if (pattern.patternType === 'SECOND_AND_FOURTH_SATURDAY_SUNDAY') {
      if (dow === 0) return true;
      if (dow === 6) return occurrenceInMonth === 2 || occurrenceInMonth === 4;
      return false;
    }

    if (pattern.patternType === 'ALTERNATE_SATURDAY_SUNDAY') {
      if (dow === 0) return true;
      if (dow === 6) {
        if (pattern.saturdayRule === 'FIRST_AND_THIRD') {
          return occurrenceInMonth === 1 || occurrenceInMonth === 3;
        }
        if (pattern.saturdayRule === 'SECOND_AND_FOURTH') {
          return occurrenceInMonth === 2 || occurrenceInMonth === 4;
        }
        // True alternate Saturday across calendar weeks
        const jan1 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
        const weekIndex = Math.floor(
          (dt.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24 * 7)
        );
        return pattern.saturdayRule === 'ALTERNATE_ODD_WEEKS'
          ? weekIndex % 2 === 1
          : weekIndex % 2 === 0;
      }
      return false;
    }

    // CUSTOM_FIXED_DAYS or fallback
    if (pattern.fixedDaysOfWeek.includes(dow)) return true;
    if (dow === 6) {
      if (pattern.saturdayRule === 'ALL') return true;
      if (pattern.saturdayRule === 'FIRST_AND_THIRD') {
        return occurrenceInMonth === 1 || occurrenceInMonth === 3;
      }
      if (pattern.saturdayRule === 'SECOND_AND_FOURTH') {
        return occurrenceInMonth === 2 || occurrenceInMonth === 4;
      }
    }
    return false;
  },

  getAssignments(): WeeklyOffAssignment[] {
    try {
      const saved = calStorage.getItem(STORAGE_KEY_WEEKLY_OFF_ASSIGNMENTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return [];
  },
};

/**
 * 3. CALENDAR EXCEPTION & COMPENSATORY OFF SERVICE
 */
export const CalendarExceptionService = {
  getExceptions(filters?: {
    companyId?: string;
    branchId?: string;
    financialYearId?: string;
  }): CalendarException[] {
    let list: CalendarException[] = [];
    try {
      const saved = calStorage.getItem(STORAGE_KEY_CALENDAR_EXCEPTIONS);
      if (saved) list = JSON.parse(saved);
    } catch {
      // Fallback
    }
    if (!filters) return list;
    return list.filter((e) => {
      if (
        filters.companyId &&
        filters.companyId !== 'ALL' &&
        normalizeCompanyId(e.companyId) !== normalizeCompanyId(filters.companyId)
      ) {
        return false;
      }
      if (
        filters.branchId &&
        filters.branchId !== 'ALL' &&
        e.branchId !== 'ALL' &&
        normalizeBranchId(e.branchId) !== normalizeBranchId(filters.branchId)
      ) {
        return false;
      }
      if (
        filters.financialYearId &&
        filters.financialYearId !== 'ALL' &&
        e.financialYearId !== filters.financialYearId
      ) {
        return false;
      }
      return true;
    });
  },

  requestCalendarException(params: {
    companyId: string;
    branchId: string;
    plantCode?: string;
    departmentId?: string;
    financialYearId: string;
    financialYearCode: string;
    targetDate: string;
    exceptionType: CalendarException['exceptionType'];
    originalDayStatus: CalendarException['originalDayStatus'];
    overrideDayStatus: CalendarException['overrideDayStatus'];
    grantsCompensatoryOff?: boolean;
    substituteHolidayDate?: string;
    reason: string;
    requestedBy: string;
  }): CalendarException {
    if (!params.reason.trim()) {
      throw new Error('Mandatory justification reason is required for a Calendar Exception.');
    }
    const list = this.getExceptions();
    const record: CalendarException = {
      id: `cal-exc-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      exceptionCode: `CEXC-${params.targetDate.replace(/-/g, '')}-${list.length + 1}`,
      companyId: normalizeCompanyId(params.companyId),
      branchId: normalizeBranchId(params.branchId),
      plantCode: params.plantCode || 'ALL',
      departmentId: params.departmentId || 'ALL',
      financialYearId: params.financialYearId,
      financialYearCode: params.financialYearCode,
      targetDate: params.targetDate,
      exceptionType: params.exceptionType,
      originalDayStatus: params.originalDayStatus,
      overrideDayStatus: params.overrideDayStatus,
      grantsCompensatoryOff: Boolean(params.grantsCompensatoryOff),
      substituteHolidayDate: params.substituteHolidayDate,
      reason: params.reason.trim(),
      requestedBy: params.requestedBy,
      requestedAt: new Date().toISOString(),
      approvalStatus: 'PENDING_APPROVAL',
    };
    list.unshift(record);
    calStorage.setItem(STORAGE_KEY_CALENDAR_EXCEPTIONS, JSON.stringify(list));
    return record;
  },

  approveCalendarException(params: {
    exceptionId: string;
    approvedBy: string;
    decision: 'APPROVE' | 'REJECT';
    employeeOrGroupRef?: string;
  }): CalendarException {
    const list = this.getExceptions();
    const idx = list.findIndex((e) => e.id === params.exceptionId);
    if (idx === -1) {
      throw new Error(`Calendar Exception ${params.exceptionId} not found.`);
    }
    const current = list[idx];
    if (current.requestedBy.trim().toLowerCase() === params.approvedBy.trim().toLowerCase()) {
      throw new Error(
        'Maker-Checker Violation: Calendar Exception requester cannot approve their own exception.'
      );
    }

    const updated: CalendarException = {
      ...current,
      approvalStatus: params.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      approvedBy: params.approvedBy,
      approvedAt: new Date().toISOString(),
    };
    list[idx] = updated;
    calStorage.setItem(STORAGE_KEY_CALENDAR_EXCEPTIONS, JSON.stringify(list));

    // If approved and grantsCompensatoryOff is true (e.g. Special Working Day on Weekly Off / Holiday), issue Comp-Off credit
    if (params.decision === 'APPROVE' && updated.grantsCompensatoryOff) {
      this.issueCompensatoryOff({
        companyId: updated.companyId,
        branchId: updated.branchId,
        plantCode: updated.plantCode,
        departmentId: updated.departmentId,
        financialYearId: updated.financialYearId,
        financialYearCode: updated.financialYearCode,
        employeeOrGroupRef: params.employeeOrGroupRef || 'PLANT_OPERATIONS_WORKFORCE',
        earnedOnDate: updated.targetDate,
        sourceReason: 'SPECIAL_WORKING_DAY',
        relatedExceptionId: updated.id,
        creditDays: 1,
        approvedBy: params.approvedBy,
      });
    }

    return updated;
  },

  getCompensatoryOffs(companyId?: string, branchId?: string): CompensatoryOff[] {
    let list: CompensatoryOff[] = [];
    try {
      const saved = calStorage.getItem(STORAGE_KEY_COMPENSATORY_OFFS);
      if (saved) list = JSON.parse(saved);
    } catch {
      // Ignore
    }
    return list.filter((c) => {
      if (
        companyId &&
        companyId !== 'ALL' &&
        normalizeCompanyId(c.companyId) !== normalizeCompanyId(companyId)
      ) {
        return false;
      }
      if (
        branchId &&
        branchId !== 'ALL' &&
        c.branchId !== 'ALL' &&
        normalizeBranchId(c.branchId) !== normalizeBranchId(branchId)
      ) {
        return false;
      }
      return true;
    });
  },

  issueCompensatoryOff(params: {
    companyId: string;
    branchId: string;
    plantCode?: string;
    departmentId?: string;
    financialYearId: string;
    financialYearCode: string;
    employeeOrGroupRef: string;
    earnedOnDate: string;
    sourceReason: CompensatoryOff['sourceReason'];
    relatedExceptionId?: string;
    relatedHolidayCode?: string;
    creditDays: 1 | 0.5;
    approvedBy: string;
  }): CompensatoryOff {
    const list = this.getCompensatoryOffs();
    const record: CompensatoryOff = {
      id: `coff-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      compOffNumber: `COFF-${params.earnedOnDate.replace(/-/g, '')}-${list.length + 1}`,
      companyId: normalizeCompanyId(params.companyId),
      branchId: normalizeBranchId(params.branchId),
      plantCode: params.plantCode || 'ALL',
      departmentId: params.departmentId || 'ALL',
      financialYearId: params.financialYearId,
      financialYearCode: params.financialYearCode,
      employeeOrGroupRef: params.employeeOrGroupRef,
      earnedOnDate: params.earnedOnDate,
      sourceReason: params.sourceReason,
      relatedExceptionId: params.relatedExceptionId,
      relatedHolidayCode: params.relatedHolidayCode,
      creditDays: params.creditDays,
      expiryDate: addDays(params.earnedOnDate, 90),
      status: 'EARNED_AVAILABLE',
      approvedBy: params.approvedBy,
      createdAt: new Date().toISOString(),
    };
    list.unshift(record);
    calStorage.setItem(STORAGE_KEY_COMPENSATORY_OFFS, JSON.stringify(list));
    return record;
  },
};

/**
 * 4. CALENDAR VALIDATION SERVICE
 * Validates Holiday and Weekly Off conflicts without silently applying substitution policies.
 */
export const CalendarValidationService = {
  detectHolidayWeeklyOffConflicts(params: {
    holidayCalendar: HolidayCalendar;
    weeklyOffPattern: WeeklyOffPattern;
    conflictPolicy: HolidayWeeklyOffConflictPolicy;
  }): HolidayWeeklyOffConflictRecord[] {
    const conflicts: HolidayWeeklyOffConflictRecord[] = [];
    for (const hEntry of params.holidayCalendar.entries) {
      if (hEntry.isOptionalOrRestricted) continue;
      const isOff = WeeklyOffService.isDateWeeklyOff(hEntry.date, params.weeklyOffPattern);
      if (isOff) {
        let outcome: HolidayWeeklyOffConflictRecord['resolutionOutcome'] =
          'WEEKLY_OFF_ABSORBED_NO_DOUBLE_COUNT';
        if (params.conflictPolicy === 'SUBSTITUTE_NEXT_WORKING_DAY') {
          outcome = 'SUBSTITUTE_HOLIDAY_CREATED';
        } else if (params.conflictPolicy === 'GRANT_COMPENSATORY_OFF_CREDIT') {
          outcome = 'COMP_OFF_CREDITED';
        } else if (params.conflictPolicy === 'MANUAL_AUTHORIZED_EXCEPTION') {
          outcome = 'PENDING_MANUAL_RESOLUTION';
        }

        conflicts.push({
          date: hEntry.date,
          dayName: hEntry.dayName,
          holidayCode: hEntry.holidayCode,
          holidayName: hEntry.holidayName,
          holidayCategory: hEntry.category,
          weeklyOffPatternCode: params.weeklyOffPattern.patternCode,
          conflictPolicyConfigured: params.conflictPolicy,
          resolutionOutcome: outcome,
        });
      }
    }
    return conflicts;
  },
};

/**
 * 5 & 6. CALENDAR GENERATION, WORKDAY CALENDAR & CALENDAR VERSION SERVICES
 */
export const CalendarVersionService = {
  getVersions(companyId?: string, branchId?: string, financialYearId?: string): CalendarVersion[] {
    let list: CalendarVersion[] = [];
    try {
      const saved = calStorage.getItem(STORAGE_KEY_CALENDAR_VERSIONS);
      if (saved) list = JSON.parse(saved);
    } catch {
      // Ignore
    }
    return list.filter((v) => {
      if (
        companyId &&
        companyId !== 'ALL' &&
        normalizeCompanyId(v.companyId) !== normalizeCompanyId(companyId)
      ) {
        return false;
      }
      if (
        branchId &&
        branchId !== 'ALL' &&
        v.branchId !== 'ALL' &&
        normalizeBranchId(v.branchId) !== normalizeBranchId(branchId)
      ) {
        return false;
      }
      if (
        financialYearId &&
        financialYearId !== 'ALL' &&
        v.financialYearId !== financialYearId
      ) {
        return false;
      }
      return true;
    });
  },

  getApprovalHistory(companyId?: string): CalendarApprovalHistory[] {
    try {
      const saved = calStorage.getItem(STORAGE_KEY_CALENDAR_APPROVAL_HISTORY);
      if (saved) {
        const list: CalendarApprovalHistory[] = JSON.parse(saved);
        if (companyId && companyId !== 'ALL') {
          return list.filter((h) => normalizeCompanyId(h.companyId) === normalizeCompanyId(companyId));
        }
        return list;
      }
    } catch {
      // Ignore
    }
    return [];
  },
};

export const WorkdayCalendarService = {
  getWorkdayCalendars(filters?: {
    companyId?: string;
    branchId?: string;
    plantCode?: string;
    departmentId?: string;
    financialYearId?: string;
    includeSuperseded?: boolean;
  }): WorkdayCalendar[] {
    let calendars: WorkdayCalendar[] = [];
    try {
      const saved = calStorage.getItem(STORAGE_KEY_WORKDAY_CALENDARS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) calendars = parsed;
      }
    } catch {
      // Ignore
    }

    if (calendars.length === 0) {
      // Auto-bootstrap default FY 2026-27 Workday Calendar for Puducherry Plant so the UI has rich initial data
      const fy = financialYearService.ensureCompanyFinancialYearInitialized('co-kosh-01').activeFinancialYear;
      const holCal = HolidayService.generateFinancialYearHolidayCalendar({
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        plantCode: 'PLT-PDY-INJ',
        departmentId: 'ALL',
        workforceCategory: 'ALL_WORKFORCE',
        financialYearId: fy.id,
        createdBy: 'System Initializer',
      });
      const woffPattern = WeeklyOffService.getPatterns('co-kosh-01', 'br-pond-01')[0];
      const generated = this.generateWorkdayCalendar({
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        plantCode: 'PLT-PDY-INJ',
        departmentId: 'ALL',
        workforceCategory: 'ALL_WORKFORCE',
        financialYearId: fy.id,
        holidayCalendarId: holCal.id,
        weeklyOffPatternId: woffPattern.id,
        conflictPolicy: 'NO_AUTOMATIC_COMPENSATORY_OFF',
        nonShiftDailyHoursPolicy: 8,
        createdBy: 'HR Governance Admin',
        modificationReason: 'Initial FY 2026-27 Workday Calendar Generation',
        autoPublishForSeed: true,
      });
      calendars = [generated];
    }

    if (!filters) return calendars;
    return calendars.filter((c) => {
      if (!filters.includeSuperseded && c.status === 'SUPERSEDED') return false;
      if (
        filters.companyId &&
        filters.companyId !== 'ALL' &&
        normalizeCompanyId(c.companyId) !== normalizeCompanyId(filters.companyId)
      ) {
        return false;
      }
      if (
        filters.branchId &&
        filters.branchId !== 'ALL' &&
        c.branchId !== 'ALL' &&
        normalizeBranchId(c.branchId) !== normalizeBranchId(filters.branchId)
      ) {
        return false;
      }
      if (
        filters.plantCode &&
        filters.plantCode !== 'ALL' &&
        c.plantCode !== 'ALL' &&
        c.plantCode !== filters.plantCode
      ) {
        return false;
      }
      if (
        filters.departmentId &&
        filters.departmentId !== 'ALL' &&
        c.departmentId !== 'ALL' &&
        c.departmentId !== filters.departmentId
      ) {
        return false;
      }
      if (
        filters.financialYearId &&
        filters.financialYearId !== 'ALL' &&
        c.financialYearId !== filters.financialYearId
      ) {
        return false;
      }
      return true;
    });
  },

  /**
   * 4 & 5. Centralized Workday Calendar Engine
   * Calculates actual working days across the Financial Year:
   * - Prevents double-counting when a holiday falls on a weekly off
   * - Respects configured HolidayWeeklyOffConflictPolicy (never silently substituting unless configured)
   * - Applies approved CalendarExceptions (Special Working Days, Emergency Holidays, Plant Shutdowns, Half-Days)
   * - Calculates Monthly & Financial-Year summaries and non-shift Scheduled Working Hours
   */
  generateWorkdayCalendar(params: {
    companyId: string;
    branchId: string;
    plantCode?: string;
    departmentId?: string;
    workforceCategory?: WorkforceCategoryType;
    financialYearId: string;
    holidayCalendarId: string;
    weeklyOffPatternId: string;
    conflictPolicy: HolidayWeeklyOffConflictPolicy;
    nonShiftDailyHoursPolicy?: number;
    createdBy: string;
    modificationReason: string;
    autoPublishForSeed?: boolean;
  }): WorkdayCalendar {
    const normCo = normalizeCompanyId(params.companyId);
    const normBr = normalizeBranchId(params.branchId);
    const companyObj = INITIAL_COMPANIES.find((c) => c.id === normCo);
    const branchObj = INITIAL_BRANCHES.find((b) => b.id === normBr);
    const plantCode = params.plantCode || 'ALL';
    const departmentId = params.departmentId || 'ALL';
    const workforceCategory = params.workforceCategory || 'ALL_WORKFORCE';

    const fy =
      financialYearService.getFinancialYears(normCo).find((y) => y.id === params.financialYearId) ||
      financialYearService.ensureCompanyFinancialYearInitialized(normCo).activeFinancialYear;

    const holCal =
      HolidayService.getHolidayCalendars(normCo).find((h) => h.id === params.holidayCalendarId) ||
      HolidayService.generateFinancialYearHolidayCalendar({
        companyId: normCo,
        branchId: normBr,
        plantCode,
        departmentId,
        workforceCategory,
        financialYearId: fy.id,
        createdBy: params.createdBy,
      });

    const woffPattern =
      WeeklyOffService.getPatterns().find((w) => w.id === params.weeklyOffPatternId) ||
      WeeklyOffService.getPatterns(normCo, normBr)[0] ||
      INITIAL_WEEKLY_OFF_PATTERNS[0];

    const approvedExceptions = CalendarExceptionService.getExceptions({
      companyId: normCo,
      branchId: normBr,
      financialYearId: fy.id,
    }).filter(
      (e) =>
        e.approvalStatus === 'APPROVED' &&
        (e.plantCode === 'ALL' || plantCode === 'ALL' || e.plantCode === plantCode) &&
        (e.departmentId === 'ALL' || departmentId === 'ALL' || e.departmentId === departmentId)
    );

    const exceptionByDate = new Map<string, CalendarException>();
    for (const exc of approvedExceptions) {
      exceptionByDate.set(exc.targetDate, exc);
    }

    // Map Mandatory/Regular Holidays by Date (Optional/Restricted holidays do not close the plant calendar by default)
    const holidayByDate = new Map<string, HolidayCalendarEntry>();
    for (const h of holCal.entries) {
      if (!h.isOptionalOrRestricted) {
        holidayByDate.set(h.date, h);
      }
    }

    const allDates = getDatesBetween(fy.startDate, fy.endDate);
    const substituteHolidayDates = new Map<string, { originalHoliday: HolidayCalendarEntry }>();
    const conflicts: HolidayWeeklyOffConflictRecord[] = [];

    // First pass: detect Holiday + Weekly Off overlaps and apply explicit Conflict Policy (never silently)
    for (const dateStr of allDates) {
      const h = holidayByDate.get(dateStr);
      const isOff = WeeklyOffService.isDateWeeklyOff(dateStr, woffPattern);
      if (h && isOff) {
        if (params.conflictPolicy === 'SUBSTITUTE_NEXT_WORKING_DAY') {
          // Find next regular working day that is neither a weekly off nor an existing holiday
          let probe = addDays(dateStr, 1);
          while (
            probe <= fy.endDate &&
            (WeeklyOffService.isDateWeeklyOff(probe, woffPattern) ||
              holidayByDate.has(probe) ||
              substituteHolidayDates.has(probe))
          ) {
            probe = addDays(probe, 1);
          }
          if (probe <= fy.endDate) {
            substituteHolidayDates.set(probe, { originalHoliday: h });
          }
          conflicts.push({
            date: dateStr,
            dayName: h.dayName,
            holidayCode: h.holidayCode,
            holidayName: h.holidayName,
            holidayCategory: h.category,
            weeklyOffPatternCode: woffPattern.patternCode,
            conflictPolicyConfigured: params.conflictPolicy,
            resolutionOutcome: 'SUBSTITUTE_HOLIDAY_CREATED',
            substituteDateCreated: probe <= fy.endDate ? probe : undefined,
          });
        } else if (params.conflictPolicy === 'GRANT_COMPENSATORY_OFF_CREDIT') {
          const compOff = CalendarExceptionService.issueCompensatoryOff({
            companyId: normCo,
            branchId: normBr,
            plantCode,
            departmentId,
            financialYearId: fy.id,
            financialYearCode: fy.financialYearCode,
            employeeOrGroupRef: workforceCategory,
            earnedOnDate: dateStr,
            sourceReason: 'HOLIDAY_ON_WEEKLY_OFF_POLICY',
            relatedHolidayCode: h.holidayCode,
            creditDays: h.dayWeight,
            approvedBy: params.createdBy,
          });
          conflicts.push({
            date: dateStr,
            dayName: h.dayName,
            holidayCode: h.holidayCode,
            holidayName: h.holidayName,
            holidayCategory: h.category,
            weeklyOffPatternCode: woffPattern.patternCode,
            conflictPolicyConfigured: params.conflictPolicy,
            resolutionOutcome: 'COMP_OFF_CREDITED',
            compOffIdCreated: compOff.id,
          });
        } else if (params.conflictPolicy === 'MANUAL_AUTHORIZED_EXCEPTION') {
          conflicts.push({
            date: dateStr,
            dayName: h.dayName,
            holidayCode: h.holidayCode,
            holidayName: h.holidayName,
            holidayCategory: h.category,
            weeklyOffPatternCode: woffPattern.patternCode,
            conflictPolicyConfigured: params.conflictPolicy,
            resolutionOutcome: 'PENDING_MANUAL_RESOLUTION',
          });
        } else {
          // NO_AUTOMATIC_COMPENSATORY_OFF: Weekly off absorbs the overlap; prevent double counting
          conflicts.push({
            date: dateStr,
            dayName: h.dayName,
            holidayCode: h.holidayCode,
            holidayName: h.holidayName,
            holidayCategory: h.category,
            weeklyOffPatternCode: woffPattern.patternCode,
            conflictPolicyConfigured: params.conflictPolicy,
            resolutionOutcome: 'WEEKLY_OFF_ABSORBED_NO_DOUBLE_COUNT',
          });
        }
      }
    }

    const dailyHoursBase =
      params.nonShiftDailyHoursPolicy !== undefined
        ? params.nonShiftDailyHoursPolicy
        : woffPattern.standardDailyWorkingHours || 0;

    const entries: WorkdayCalendarEntry[] = [];
    const monthlyMap = new Map<string, MonthlyWorkingDaysSummary>();

    for (const dateStr of allDates) {
      const dt = parseUtcDate(dateStr);
      const dow = dt.getUTCDay();
      const monthKey = dateStr.slice(0, 7);
      const [yNum, mNum] = monthKey.split('-').map(Number);
      const monthLabel = `${SHORT_MONTH_NAMES[mNum - 1]} ${yNum}`;

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          monthKey,
          monthLabel,
          accountingPeriodCode: monthKey,
          totalCalendarDays: 0,
          totalWorkingDays: 0,
          totalHolidays: 0,
          rawHolidaysCount: 0,
          totalWeeklyOffs: 0,
          overlapHolidayOnWeeklyOffCount: 0,
          halfWorkingDays: 0,
          specialWorkingDays: 0,
          shutdownDays: 0,
          netWorkingDays: 0,
          scheduledWorkingHours: 0,
        });
      }
      const mSum = monthlyMap.get(monthKey)!;
      mSum.totalCalendarDays += 1;

      const h = holidayByDate.get(dateStr);
      const subHol = substituteHolidayDates.get(dateStr);
      const isOff = WeeklyOffService.isDateWeeklyOff(dateStr, woffPattern);
      const exc = exceptionByDate.get(dateStr);

      let status: WorkdayCalendarEntry['status'] = 'WORKING_DAY';
      let workingDayWeight: 1 | 0.5 | 0 = 1;
      let isHoliday = false;
      let isWeeklyOff = false;
      let isOverlapConflict = false;
      let isSpecialWorkingDay = false;
      let isShutdownDay = false;

      if (h) {
        mSum.rawHolidaysCount += 1;
      }

      // 1. Check Approved Calendar Exception Override first
      if (exc) {
        if (
          exc.overrideDayStatus === 'SPECIAL_WORKING_DAY' ||
          exc.overrideDayStatus === 'WORKING_DAY'
        ) {
          status = 'SPECIAL_WORKING_DAY';
          workingDayWeight = 1;
          isSpecialWorkingDay = true;
          mSum.specialWorkingDays += 1;
        } else if (exc.overrideDayStatus === 'HALF_WORKING_DAY') {
          status = 'HALF_WORKING_DAY';
          workingDayWeight = 0.5;
          mSum.halfWorkingDays += 1;
        } else if (exc.overrideDayStatus === 'SHUTDOWN_DAY') {
          status = 'SHUTDOWN_DAY';
          workingDayWeight = 0;
          isShutdownDay = true;
          mSum.shutdownDays += 1;
        } else if (exc.overrideDayStatus === 'HOLIDAY') {
          status = 'HOLIDAY';
          workingDayWeight = 0;
          isHoliday = true;
          mSum.totalHolidays += 1;
        } else if (exc.overrideDayStatus === 'WEEKLY_OFF') {
          status = 'WEEKLY_OFF';
          workingDayWeight = 0;
          isWeeklyOff = true;
          mSum.totalWeeklyOffs += 1;
        }
      } else if (h && isOff) {
        // 2. Overlap between Holiday and Weekly Off: NEVER double count non-working days!
        // Count under Weekly Off + record overlap; do NOT increment both totalHolidays and totalWeeklyOffs for the same day.
        status = 'HOLIDAY_AND_WEEKLY_OFF_OVERLAP';
        workingDayWeight = 0;
        isHoliday = true;
        isWeeklyOff = true;
        isOverlapConflict = true;
        mSum.totalWeeklyOffs += 1;
        mSum.overlapHolidayOnWeeklyOffCount += 1;
      } else if (subHol) {
        // 3. Substitute Holiday created on next working day when policy === 'SUBSTITUTE_NEXT_WORKING_DAY'
        status = 'SUBSTITUTE_HOLIDAY';
        workingDayWeight = 0;
        isHoliday = true;
        mSum.totalHolidays += 1;
      } else if (h) {
        // 4. Regular Full-Day or Half-Day Holiday
        if (h.durationType === 'FULL_DAY') {
          status = 'HOLIDAY';
          workingDayWeight = 0;
          isHoliday = true;
          mSum.totalHolidays += 1;
        } else {
          status = 'HALF_WORKING_DAY';
          workingDayWeight = 0.5;
          isHoliday = true;
          mSum.halfWorkingDays += 1;
        }
      } else if (isOff) {
        // 5. Regular Weekly Off
        status = 'WEEKLY_OFF';
        workingDayWeight = 0;
        isWeeklyOff = true;
        mSum.totalWeeklyOffs += 1;
      } else if (woffPattern.halfDayWeekday !== undefined && dow === woffPattern.halfDayWeekday) {
        // 6. Half Working Day per pattern
        status = 'HALF_WORKING_DAY';
        workingDayWeight = 0.5;
        mSum.halfWorkingDays += 1;
      } else {
        // 7. Standard Full Working Day
        status = 'WORKING_DAY';
        workingDayWeight = 1;
        mSum.totalWorkingDays += 1;
      }

      // Calculate Net Working Days and Non-Shift Scheduled Working Hours
      mSum.netWorkingDays = Number(
        (
          mSum.totalWorkingDays +
          mSum.specialWorkingDays +
          mSum.halfWorkingDays * 0.5
        ).toFixed(2)
      );

      let scheduledHours = Number((workingDayWeight * dailyHoursBase).toFixed(2));
      if (registeredScheduleExtension) {
        const ext = registeredScheduleExtension({
          companyId: normCo,
          branchId: normBr,
          plantCode,
          departmentId,
          date: dateStr,
          baseWorkingDayWeight: workingDayWeight,
        });
        if (ext?.dailyHoursOverride !== undefined) {
          scheduledHours = ext.dailyHoursOverride;
        }
      }
      mSum.scheduledWorkingHours = Number(
        (mSum.scheduledWorkingHours + scheduledHours).toFixed(2)
      );

      entries.push({
        date: dateStr,
        dayOfWeek: dow,
        dayName: DAY_NAMES[dow],
        monthKey,
        accountingPeriodCode: monthKey,
        status,
        isWorkingDay: workingDayWeight > 0,
        workingDayWeight,
        isHoliday,
        isWeeklyOff,
        isOverlapConflict,
        isSpecialWorkingDay,
        isShutdownDay,
        holidayCode: h?.holidayCode || subHol?.originalHoliday.holidayCode,
        holidayName: subHol
          ? `${subHol.originalHoliday.holidayName} (Substitute Holiday)`
          : h?.holidayName,
        holidayCategory: h?.category || subHol?.originalHoliday.category,
        weeklyOffPatternCode: isWeeklyOff ? woffPattern.patternCode : undefined,
        conflictResolutionApplied: isOverlapConflict ? params.conflictPolicy : undefined,
        exceptionId: exc?.id,
        exceptionReason: exc?.reason,
        scheduledWorkingHours: scheduledHours,
      });
    }

    const monthlySummaries = Array.from(monthlyMap.values());
    const summary = monthlySummaries.reduce(
      (acc, m) => ({
        totalCalendarDays: acc.totalCalendarDays + m.totalCalendarDays,
        totalWorkingDays: acc.totalWorkingDays + m.totalWorkingDays,
        totalHolidays: acc.totalHolidays + m.totalHolidays,
        rawHolidaysCount: acc.rawHolidaysCount + m.rawHolidaysCount,
        totalWeeklyOffs: acc.totalWeeklyOffs + m.totalWeeklyOffs,
        overlapConflictCount: acc.overlapConflictCount + m.overlapHolidayOnWeeklyOffCount,
        halfWorkingDays: acc.halfWorkingDays + m.halfWorkingDays,
        specialWorkingDays: acc.specialWorkingDays + m.specialWorkingDays,
        shutdownDays: acc.shutdownDays + m.shutdownDays,
        netWorkingDays: Number((acc.netWorkingDays + m.netWorkingDays).toFixed(2)),
        scheduledWorkingHours: Number(
          (acc.scheduledWorkingHours + m.scheduledWorkingHours).toFixed(2)
        ),
      }),
      {
        totalCalendarDays: 0,
        totalWorkingDays: 0,
        totalHolidays: 0,
        rawHolidaysCount: 0,
        totalWeeklyOffs: 0,
        overlapConflictCount: 0,
        halfWorkingDays: 0,
        specialWorkingDays: 0,
        shutdownDays: 0,
        netWorkingDays: 0,
        scheduledWorkingHours: 0,
      }
    );

    // Check existing versions for this scope
    let allCalendars: WorkdayCalendar[] = [];
    try {
      const saved = calStorage.getItem(STORAGE_KEY_WORKDAY_CALENDARS);
      if (saved) allCalendars = JSON.parse(saved);
    } catch {
      // Ignore
    }

    const existingForScope = allCalendars.filter(
      (c) =>
        normalizeCompanyId(c.companyId) === normCo &&
        normalizeBranchId(c.branchId) === normBr &&
        c.plantCode === plantCode &&
        c.departmentId === departmentId &&
        c.financialYearId === fy.id
    );
    const prevLatest =
      existingForScope.length > 0
        ? existingForScope.reduce((a, b) => (a.versionNumber > b.versionNumber ? a : b))
        : undefined;
    const nextVersion = prevLatest ? prevLatest.versionNumber + 1 : 1;

    const nowIso = new Date().toISOString();
    const initialStatus: WorkdayCalendar['status'] = params.autoPublishForSeed
      ? 'PUBLISHED'
      : 'DRAFT';

    const calendar: WorkdayCalendar = {
      id: `wdcal-${normCo}-${normBr}-${fy.financialYearCode.replace(/\s+/g, '')}-v${nextVersion}-${Date.now().toString().slice(-4)}`,
      calendarCode: `WDCAL-${companyObj?.code || 'CO'}-${branchObj?.portalBranchCode || 'ALL'}-${plantCode}-${fy.financialYearCode.replace(/\s+/g, '')}-V${nextVersion}`,
      calendarName: `${companyObj?.code || normCo} • ${branchObj?.name || 'All Branches'} (${plantCode}) — ${fy.financialYearCode} Workday Calendar v${nextVersion}`,
      companyId: normCo,
      companyCode: companyObj?.code || normCo,
      branchId: normBr,
      branchName: branchObj?.name || 'All Branches',
      plantCode,
      departmentId,
      workforceCategory,
      financialYearId: fy.id,
      financialYearCode: fy.financialYearCode,
      startDate: fy.startDate,
      endDate: fy.endDate,
      holidayCalendarId: holCal.id,
      holidayCalendarVersion: holCal.versionNumber,
      weeklyOffPatternId: woffPattern.id,
      weeklyOffPatternCode: woffPattern.patternCode,
      conflictPolicy: params.conflictPolicy,
      nonShiftDailyHoursPolicy: dailyHoursBase,
      summary,
      monthlySummaries,
      conflicts,
      entries,
      versionNumber: nextVersion,
      previousVersionId: prevLatest?.id,
      effectiveFrom: fy.startDate,
      status: initialStatus,
      createdBy: params.createdBy,
      createdAt: nowIso,
      approvedBy: params.autoPublishForSeed ? 'Plant Operations Director' : undefined,
      approvedAt: params.autoPublishForSeed ? nowIso : undefined,
      publishedBy: params.autoPublishForSeed ? 'Plant Operations Director' : undefined,
      publishedAt: params.autoPublishForSeed ? nowIso : undefined,
      modificationReason: params.modificationReason,
    };

    allCalendars.unshift(calendar);
    calStorage.setItem(STORAGE_KEY_WORKDAY_CALENDARS, JSON.stringify(allCalendars));

    if (params.autoPublishForSeed) {
      this.recordPublishedVersionSnapshot(calendar, 'Plant Operations Director');
    }

    return calendar;
  },

  submitWorkdayCalendarForApproval(params: {
    workdayCalendarId: string;
    submittedBy: string;
    remarks?: string;
  }): WorkdayCalendar {
    const all = this.getWorkdayCalendars({ includeSuperseded: true });
    const idx = all.findIndex((c) => c.id === params.workdayCalendarId);
    if (idx === -1) {
      throw new Error(`Workday Calendar ${params.workdayCalendarId} not found.`);
    }
    const updated: WorkdayCalendar = {
      ...all[idx],
      status: 'PENDING_APPROVAL',
      submittedBy: params.submittedBy,
      submittedAt: new Date().toISOString(),
    };
    all[idx] = updated;
    calStorage.setItem(STORAGE_KEY_WORKDAY_CALENDARS, JSON.stringify(all));

    appendCalendarApprovalLog({
      entityType: 'WORKDAY_CALENDAR',
      entityId: updated.id,
      entityCode: updated.calendarCode,
      companyId: updated.companyId,
      branchId: updated.branchId,
      financialYearCode: updated.financialYearCode,
      versionNumber: updated.versionNumber,
      action: 'SUBMITTED',
      actorUserId: params.submittedBy,
      actorName: params.submittedBy,
      remarks: params.remarks || 'Submitted Workday Calendar for Maker-Checker approval',
    });

    return updated;
  },

  /**
   * 6. Maker-Checker Approval & Publishing of Workday Calendar with Versioning & Historical Preservation
   */
  approveAndPublishWorkdayCalendar(params: {
    workdayCalendarId: string;
    approvedBy: string;
    effectiveFrom?: string;
    remarks?: string;
  }): WorkdayCalendar {
    const all = this.getWorkdayCalendars({ includeSuperseded: true });
    const idx = all.findIndex((c) => c.id === params.workdayCalendarId);
    if (idx === -1) {
      throw new Error(`Workday Calendar ${params.workdayCalendarId} not found.`);
    }

    const current = all[idx];
    const creatorOrSubmitter = current.submittedBy || current.createdBy;
    if (creatorOrSubmitter.trim().toLowerCase() === params.approvedBy.trim().toLowerCase()) {
      throw new Error(
        'Maker-Checker Violation: Workday Calendar creator/submitter cannot approve and publish their own calendar.'
      );
    }

    const nowIso = new Date().toISOString();
    const effFrom = params.effectiveFrom || nowIso.split('T')[0];

    // Supersede previous published version for the same scope without altering its historical snapshot
    for (let i = 0; i < all.length; i++) {
      const other = all[i];
      if (
        other.id !== current.id &&
        other.companyId === current.companyId &&
        other.branchId === current.branchId &&
        other.plantCode === current.plantCode &&
        other.departmentId === current.departmentId &&
        other.financialYearId === current.financialYearId &&
        other.status === 'PUBLISHED'
      ) {
        all[i] = {
          ...other,
          status: 'SUPERSEDED',
          effectiveUntil: effFrom,
        };
      }
    }

    const published: WorkdayCalendar = {
      ...current,
      status: 'PUBLISHED',
      effectiveFrom: effFrom,
      approvedBy: params.approvedBy,
      approvedAt: nowIso,
      publishedBy: params.approvedBy,
      publishedAt: nowIso,
    };

    all[idx] = published;
    calStorage.setItem(STORAGE_KEY_WORKDAY_CALENDARS, JSON.stringify(all));

    this.recordPublishedVersionSnapshot(published, params.approvedBy);

    appendCalendarApprovalLog({
      entityType: 'WORKDAY_CALENDAR',
      entityId: published.id,
      entityCode: published.calendarCode,
      companyId: published.companyId,
      branchId: published.branchId,
      financialYearCode: published.financialYearCode,
      versionNumber: published.versionNumber,
      action: 'PUBLISHED',
      actorUserId: params.approvedBy,
      actorName: params.approvedBy,
      remarks: params.remarks || `Approved & Published v${published.versionNumber}`,
    });

    return published;
  },

  recordPublishedVersionSnapshot(calendar: WorkdayCalendar, approvedBy: string): CalendarVersion {
    const versions = CalendarVersionService.getVersions();
    // Mark prior version for same scope as SUPERSEDED
    for (let i = 0; i < versions.length; i++) {
      const v = versions[i];
      if (
        v.companyId === calendar.companyId &&
        v.branchId === calendar.branchId &&
        v.plantCode === calendar.plantCode &&
        v.departmentId === calendar.departmentId &&
        v.financialYearId === calendar.financialYearId &&
        v.status === 'PUBLISHED'
      ) {
        versions[i] = {
          ...v,
          status: 'SUPERSEDED',
          effectiveUntil: calendar.effectiveFrom,
        };
      }
    }

    const newVer: CalendarVersion = {
      id: `cver-${calendar.id}-v${calendar.versionNumber}`,
      workdayCalendarId: calendar.id,
      calendarCode: calendar.calendarCode,
      companyId: calendar.companyId,
      branchId: calendar.branchId,
      plantCode: calendar.plantCode,
      departmentId: calendar.departmentId,
      financialYearId: calendar.financialYearId,
      financialYearCode: calendar.financialYearCode,
      previousVersionNumber: calendar.versionNumber > 1 ? calendar.versionNumber - 1 : null,
      currentVersionNumber: calendar.versionNumber,
      effectiveFrom: calendar.effectiveFrom,
      effectiveUntil: calendar.effectiveUntil,
      modifiedBy: calendar.createdBy,
      approvedBy,
      modificationReason: calendar.modificationReason,
      approvalDate: new Date().toISOString(),
      status: 'PUBLISHED',
      immutableSummarySnapshot: { ...calendar.summary },
      preserveHistoricalAttendanceAndPayroll: true,
    };

    versions.unshift(newVer);
    calStorage.setItem(STORAGE_KEY_CALENDAR_VERSIONS, JSON.stringify(versions));
    return newVer;
  },
};

export const CalendarGenerationService = {
  previewAndGenerateCalendar: WorkdayCalendarService.generateWorkdayCalendar.bind(
    WorkdayCalendarService
  ),
};
