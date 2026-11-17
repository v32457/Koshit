/**
 * CIPPLATFORM — FINANCIAL YEAR-BASED HOLIDAY, WEEKLY OFF & WORKDAY CALENDAR MANAGEMENT TYPES
 * Scope Revision Compliance:
 * - Implements ONLY Holiday Management, Weekly Off Management, and Workday Calendar Management.
 * - Shift Management is 100% excluded (no shift tables, services, or UI).
 * - Maintains clean modular extension interface (ExternalWorkScheduleInputHook) so future modules can plug into WorkdayCalendarEngine without redesign.
 */

export type HolidayCategoryType =
  | 'NATIONAL'
  | 'STATE'
  | 'REGIONAL'
  | 'COMPANY'
  | 'BRANCH_SPECIFIC'
  | 'PLANT_SPECIFIC'
  | 'DEPARTMENT_SPECIFIC'
  | 'OPTIONAL'
  | 'RESTRICTED'
  | 'STATUTORY'
  | 'EMERGENCY';

export type HolidayDurationType = 'FULL_DAY' | 'HALF_DAY_FIRST_HALF' | 'HALF_DAY_SECOND_HALF';

export type WorkforceCategoryType =
  | 'ALL_WORKFORCE'
  | 'PLANT_OPERATIONS'
  | 'CORPORATE_STAFF'
  | 'QUALITY_ENGINEERING'
  | 'WAREHOUSE_LOGISTICS'
  | 'CONTRACT_WORKFORCE';

export type CalendarApprovalStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'SUPERSEDED'
  | 'REJECTED';

export interface HolidayMaster {
  id: string;
  holidayCode: string;
  holidayName: string;
  category: HolidayCategoryType;
  durationType: HolidayDurationType;
  isRecurringAnnual: boolean;
  recurringMonthDay?: string; // 'MM-DD' e.g. '01-26', '08-15', '10-02'
  customDate?: string;        // 'YYYY-MM-DD' for movable/custom holidays
  applicableCountry: string;
  applicableStates: string[]; // ['ALL'] or ['Tamil Nadu', 'Puducherry', 'Maharashtra', 'Gujarat']
  applicableRegions: string[];
  companyId: string;          // 'ALL' or specific companyId
  branchId: string;           // 'ALL' or specific branchId
  plantCode: string;          // 'ALL' or specific plant/unit code
  departmentId: string;       // 'ALL' or specific departmentId
  workforceCategory: WorkforceCategoryType;
  isPaidHoliday: boolean;
  maxRestrictedSelectionQuota?: number;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HolidayCalendarEntry {
  id: string;
  holidayMasterId: string;
  holidayCode: string;
  holidayName: string;
  date: string; // YYYY-MM-DD within the Financial Year
  dayOfWeek: number; // 0 (Sun) .. 6 (Sat)
  dayName: string;
  category: HolidayCategoryType;
  durationType: HolidayDurationType;
  dayWeight: 1 | 0.5;
  applicableStates: string[];
  branchId: string;
  plantCode: string;
  departmentId: string;
  workforceCategory: WorkforceCategoryType;
  isOptionalOrRestricted: boolean;
}

export interface HolidayCalendar {
  id: string;
  calendarCode: string;
  calendarName: string;
  companyId: string;
  companyCode: string;
  branchId: string;     // 'ALL' or specific branchId
  plantCode: string;    // 'ALL' or specific plantCode
  departmentId: string; // 'ALL' or specific departmentId
  workforceCategory: WorkforceCategoryType;
  stateName: string;
  financialYearId: string;
  financialYearCode: string;
  startDate: string;
  endDate: string;
  entries: HolidayCalendarEntry[];
  maxOptionalHolidaysAllowed: number;
  versionNumber: number;
  previousVersionId?: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  approvalStatus: CalendarApprovalStatus;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  modificationReason?: string;
}

export interface HolidayCalendarAssignment {
  id: string;
  companyId: string;
  branchId: string;
  plantCode: string;
  departmentId: string;
  workforceCategory: WorkforceCategoryType;
  financialYearId: string;
  financialYearCode: string;
  holidayCalendarId: string;
  holidayCalendarVersion: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  assignedBy: string;
  assignedAt: string;
}

export type WeeklyOffPatternType =
  | 'SUNDAY_ONLY'
  | 'SATURDAY_SUNDAY'
  | 'ALTERNATE_SATURDAY_SUNDAY'
  | 'FIRST_AND_THIRD_SATURDAY_SUNDAY'
  | 'SECOND_AND_FOURTH_SATURDAY_SUNDAY'
  | 'MONDAY_TO_SATURDAY_OFF'
  | 'CUSTOM_FIXED_DAYS'
  | 'ROTATIONAL_WEEKLY_OFF';

export interface WeeklyOffPattern {
  id: string;
  patternCode: string;
  patternName: string;
  companyId: string;
  branchId: string;     // 'ALL' or specific branchId
  plantCode: string;    // 'ALL' or specific plantCode
  departmentId: string; // 'ALL' or specific departmentId
  employeeGroup: WorkforceCategoryType;
  patternType: WeeklyOffPatternType;
  fixedDaysOfWeek: number[]; // 0 = Sun, 1 = Mon ... 6 = Sat
  saturdayRule?: 'NONE' | 'ALL' | 'ALTERNATE_ODD_WEEKS' | 'ALTERNATE_EVEN_WEEKS' | 'FIRST_AND_THIRD' | 'SECOND_AND_FOURTH';
  halfDayWeekday?: number; // Optional e.g. 6 (Saturday Half Day)
  rotationalCycleDays?: {
    workingDaysConsecutive: number; // e.g. 6 days on
    offDaysConsecutive: number;     // e.g. 1 or 2 days off
    anchorStartDate: string;        // YYYY-MM-DD
    rotationGroupCode: string;      // e.g. 'GROUP-A', 'GROUP-B'
  };
  standardDailyWorkingHours?: number; // Non-shift standard daily hours policy (e.g. 8 hours)
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  createdBy: string;
  createdAt: string;
}

export interface WeeklyOffAssignment {
  id: string;
  companyId: string;
  branchId: string;
  plantCode: string;
  departmentId: string;
  employeeGroup: WorkforceCategoryType;
  financialYearId: string;
  financialYearCode: string;
  weeklyOffPatternId: string;
  weeklyOffPatternCode: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  assignedBy: string;
  assignedAt: string;
}

export type HolidayWeeklyOffConflictPolicy =
  | 'NO_AUTOMATIC_COMPENSATORY_OFF'
  | 'SUBSTITUTE_NEXT_WORKING_DAY'
  | 'GRANT_COMPENSATORY_OFF_CREDIT'
  | 'MANUAL_AUTHORIZED_EXCEPTION';

export type CalendarExceptionType =
  | 'SPECIAL_WORKING_DAY_ON_WEEKLY_OFF'
  | 'SPECIAL_WORKING_DAY_ON_HOLIDAY'
  | 'EMERGENCY_HOLIDAY'
  | 'PLANT_SHUTDOWN_DAY'
  | 'TEMPORARY_WEEKLY_OFF_OVERRIDE'
  | 'SUBSTITUTE_HOLIDAY_OVERRIDE'
  | 'HALF_DAY_WORKING_OVERRIDE';

export interface CalendarException {
  id: string;
  exceptionCode: string;
  companyId: string;
  branchId: string;
  plantCode: string;
  departmentId: string;
  financialYearId: string;
  financialYearCode: string;
  targetDate: string; // YYYY-MM-DD
  exceptionType: CalendarExceptionType;
  originalDayStatus: 'WORKING_DAY' | 'HOLIDAY' | 'WEEKLY_OFF' | 'HALF_WORKING_DAY';
  overrideDayStatus: 'WORKING_DAY' | 'HOLIDAY' | 'WEEKLY_OFF' | 'HALF_WORKING_DAY' | 'SHUTDOWN_DAY' | 'SPECIAL_WORKING_DAY';
  grantsCompensatoryOff: boolean;
  substituteHolidayDate?: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  approvalStatus: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
}

export interface CompensatoryOff {
  id: string;
  compOffNumber: string;
  companyId: string;
  branchId: string;
  plantCode: string;
  departmentId: string;
  financialYearId: string;
  financialYearCode: string;
  employeeOrGroupRef: string;
  earnedOnDate: string; // Holiday or Weekly Off date worked or overlapped
  sourceReason: 'SPECIAL_WORKING_DAY' | 'HOLIDAY_ON_WEEKLY_OFF_POLICY' | 'AUTHORIZED_EMERGENCY_WORK';
  relatedExceptionId?: string;
  relatedHolidayCode?: string;
  creditDays: 1 | 0.5;
  expiryDate: string;
  utilizedOnDate?: string;
  status: 'EARNED_AVAILABLE' | 'UTILIZED' | 'EXPIRED' | 'CANCELLED';
  approvedBy: string;
  createdAt: string;
}

export type WorkdayStatusType =
  | 'WORKING_DAY'
  | 'HALF_WORKING_DAY'
  | 'HOLIDAY'
  | 'WEEKLY_OFF'
  | 'HOLIDAY_AND_WEEKLY_OFF_OVERLAP'
  | 'SUBSTITUTE_HOLIDAY'
  | 'SPECIAL_WORKING_DAY'
  | 'SHUTDOWN_DAY';

export interface WorkdayCalendarEntry {
  date: string; // YYYY-MM-DD
  dayOfWeek: number;
  dayName: string;
  monthKey: string; // YYYY-MM
  accountingPeriodCode: string;
  status: WorkdayStatusType;
  isWorkingDay: boolean;
  workingDayWeight: 1 | 0.5 | 0;
  isHoliday: boolean;
  isWeeklyOff: boolean;
  isOverlapConflict: boolean;
  isSpecialWorkingDay: boolean;
  isShutdownDay: boolean;
  holidayCode?: string;
  holidayName?: string;
  holidayCategory?: HolidayCategoryType;
  weeklyOffPatternCode?: string;
  conflictResolutionApplied?: HolidayWeeklyOffConflictPolicy;
  exceptionId?: string;
  exceptionReason?: string;
  scheduledWorkingHours: number; // Calculated ONLY when non-shift working hours policy is configured
}

export interface MonthlyWorkingDaysSummary {
  monthKey: string; // YYYY-MM
  monthLabel: string;
  accountingPeriodCode: string;
  totalCalendarDays: number;
  totalWorkingDays: number;      // Full working days count (excluding half/special)
  totalHolidays: number;         // Effective holidays (preventing double-counting on overlap)
  rawHolidaysCount: number;      // Total holidays including those falling on weekly offs
  totalWeeklyOffs: number;
  overlapHolidayOnWeeklyOffCount: number;
  halfWorkingDays: number;
  specialWorkingDays: number;
  shutdownDays: number;
  netWorkingDays: number;        // Full Working Days + Special Working Days + (0.5 * Half Working Days)
  scheduledWorkingHours: number;
}

export interface HolidayWeeklyOffConflictRecord {
  date: string;
  dayName: string;
  holidayCode: string;
  holidayName: string;
  holidayCategory: HolidayCategoryType;
  weeklyOffPatternCode: string;
  conflictPolicyConfigured: HolidayWeeklyOffConflictPolicy;
  resolutionOutcome: 'WEEKLY_OFF_ABSORBED_NO_DOUBLE_COUNT' | 'SUBSTITUTE_HOLIDAY_CREATED' | 'COMP_OFF_CREDITED' | 'PENDING_MANUAL_RESOLUTION';
  substituteDateCreated?: string;
  compOffIdCreated?: string;
}

export interface WorkdayCalendar {
  id: string;
  calendarCode: string;
  calendarName: string;
  companyId: string;
  companyCode: string;
  branchId: string;
  branchName: string;
  plantCode: string;
  departmentId: string;
  workforceCategory: WorkforceCategoryType;
  financialYearId: string;
  financialYearCode: string;
  startDate: string;
  endDate: string;
  holidayCalendarId: string;
  holidayCalendarVersion: number;
  weeklyOffPatternId: string;
  weeklyOffPatternCode: string;
  conflictPolicy: HolidayWeeklyOffConflictPolicy;
  nonShiftDailyHoursPolicy?: number; // Optional non-shift standard daily hours (e.g. 8.0)
  summary: {
    totalCalendarDays: number;
    totalWorkingDays: number;
    totalHolidays: number;
    rawHolidaysCount: number;
    totalWeeklyOffs: number;
    overlapConflictCount: number;
    halfWorkingDays: number;
    specialWorkingDays: number;
    shutdownDays: number;
    netWorkingDays: number;
    scheduledWorkingHours: number;
  };
  monthlySummaries: MonthlyWorkingDaysSummary[];
  conflicts: HolidayWeeklyOffConflictRecord[];
  entries: WorkdayCalendarEntry[];
  versionNumber: number;
  previousVersionId?: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  status: CalendarApprovalStatus;
  createdBy: string;
  createdAt: string;
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  publishedBy?: string;
  publishedAt?: string;
  modificationReason: string;
}

export interface CalendarVersion {
  id: string;
  workdayCalendarId: string;
  calendarCode: string;
  companyId: string;
  branchId: string;
  plantCode: string;
  departmentId: string;
  financialYearId: string;
  financialYearCode: string;
  previousVersionNumber: number | null;
  currentVersionNumber: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  modifiedBy: string;
  approvedBy: string;
  modificationReason: string;
  approvalDate: string;
  status: 'PUBLISHED' | 'SUPERSEDED' | 'ARCHIVED';
  immutableSummarySnapshot: WorkdayCalendar['summary'];
  preserveHistoricalAttendanceAndPayroll: true;
}

export interface CalendarApprovalHistory {
  id: string;
  entityType: 'HOLIDAY_CALENDAR' | 'WEEKLY_OFF_PATTERN' | 'WORKDAY_CALENDAR' | 'CALENDAR_EXCEPTION';
  entityId: string;
  entityCode: string;
  companyId: string;
  branchId: string;
  financialYearCode: string;
  versionNumber: number;
  action: 'SUBMITTED' | 'APPROVED' | 'PUBLISHED' | 'REJECTED' | 'SUPERSEDED';
  actorUserId: string;
  actorName: string;
  remarks: string;
  timestamp: string;
}

/**
 * Clean Extension Hook for Future Schedule Providers (Section 10 Future Extensibility)
 * Allows a future independent schedule provider to query or supply daily hour multipliers
 * without any shift tables, shift services, or shift logic in the current codebase.
 */
export interface WorkdayScheduleExtensionContext {
  companyId: string;
  branchId: string;
  plantCode: string;
  departmentId: string;
  date: string;
  baseWorkingDayWeight: 1 | 0.5 | 0;
}
export type WorkdayScheduleExtensionProvider = (
  ctx: WorkdayScheduleExtensionContext
) => { dailyHoursOverride?: number } | null;
