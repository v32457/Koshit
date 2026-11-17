import React, { useState, useMemo } from 'react';
import {
  Calendar,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  History,
  BarChart3,
  ShieldCheck,
  Download,
  Wand2,
} from 'lucide-react';
import { INITIAL_COMPANIES, INITIAL_BRANCHES } from '../../data/seedData';
import { User } from '../../types';
import { financialYearService } from '../../services/financialYearService';
import {
  HolidayService,
  WeeklyOffService,
  WorkdayCalendarService,
  CalendarValidationService,
  CalendarExceptionService,
  CalendarVersionService,
} from '../../services/workdayCalendarService';
import {
  HolidayCategoryType,
  HolidayDurationType,
  WeeklyOffPatternType,
  HolidayWeeklyOffConflictPolicy,
  WorkforceCategoryType,
  CalendarException,
} from '../../types/workdayCalendar';
import { normalizeCompanyId } from '../../services/prGovernancePolicyService';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';

interface WorkdayCalendarSuiteViewProps {
  currentUser?: User;
  initialScreen?:
    | 'holiday-master'
    | 'holiday-calendar'
    | 'weekly-off'
    | 'workday-calendar'
    | 'calendar-generation'
    | 'calendar-exceptions'
    | 'calendar-versions'
    | 'calendar-reports';
}

export const WorkdayCalendarSuiteView: React.FC<WorkdayCalendarSuiteViewProps> = ({
  currentUser,
  initialScreen = 'workday-calendar',
}) => {
  const actorName = currentUser?.fullName || 'HR Governance Admin';
  const [activeScreen, setActiveScreen] = useState(initialScreen);
  const [companyId, setCompanyId] = useState('co-kosh-01');
  const [branchId, setBranchId] = useState('br-pond-01');
  const [plantCode, setPlantCode] = useState('PLT-PDY-INJ');
  const [departmentId, setDepartmentId] = useState('ALL');
  const [refreshTick, setRefreshTick] = useState(0);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const companyBranches = useMemo(
    () =>
      INITIAL_BRANCHES.filter(
        (b) => normalizeCompanyId(b.companyId) === normalizeCompanyId(companyId)
      ),
    [companyId]
  );

  React.useEffect(() => {
    if (companyBranches.length > 0 && !companyBranches.some((b) => b.id === branchId)) {
      setBranchId(companyBranches[0].id);
    }
  }, [companyBranches, branchId]);

  const companyYears = useMemo(
    () => financialYearService.getFinancialYears(companyId),
    [companyId, refreshTick]
  );

  const [financialYearId, setFinancialYearId] = useState<string>(() => {
    const active = companyYears.find((y) => y.status === 'ACTIVE') || companyYears[0];
    return active?.id || '';
  });

  React.useEffect(() => {
    if (!companyYears.some((y) => y.id === financialYearId)) {
      const def = companyYears.find((y) => y.status === 'ACTIVE') || companyYears[0];
      setFinancialYearId(def?.id || '');
    }
  }, [companyYears, financialYearId]);

  const holidayMasters = useMemo(
    () => HolidayService.getHolidayMasters({ companyId, branchId }),
    [companyId, branchId, refreshTick]
  );

  const holidayCalendars = useMemo(
    () => HolidayService.getHolidayCalendars(companyId, financialYearId),
    [companyId, financialYearId, refreshTick]
  );

  const weeklyOffPatterns = useMemo(
    () => WeeklyOffService.getPatterns(companyId),
    [companyId, refreshTick]
  );

  const workdayCalendars = useMemo(
    () =>
      WorkdayCalendarService.getWorkdayCalendars({
        companyId,
        branchId,
        financialYearId,
        includeSuperseded: true,
      }),
    [companyId, branchId, financialYearId, refreshTick]
  );

  const activeWorkdayCalendar =
    workdayCalendars.find((c) => c.status === 'PUBLISHED') || workdayCalendars[0];

  const exceptions = useMemo(
    () =>
      CalendarExceptionService.getExceptions({
        companyId,
        branchId,
        financialYearId,
      }),
    [companyId, branchId, financialYearId, refreshTick]
  );

  const compOffs = useMemo(
    () => CalendarExceptionService.getCompensatoryOffs(companyId, branchId),
    [companyId, branchId, refreshTick]
  );

  const calendarVersions = useMemo(
    () => CalendarVersionService.getVersions(companyId, branchId, financialYearId),
    [companyId, branchId, financialYearId, refreshTick]
  );

  const approvalHistory = useMemo(
    () => CalendarVersionService.getApprovalHistory(companyId),
    [companyId, refreshTick]
  );

  const holidayMasterGrid = useStandardDataGrid({
    gridId: 'workday-holiday-masters',
    userId: currentUser?.id || 'usr-default',
    data: holidayMasters,
    defaultSortField: 'createdAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'holidayCode',
    filterSignature: `${companyId}|${branchId}`,
  });

  const weeklyOffGrid = useStandardDataGrid({
    gridId: 'workday-weekly-off-patterns',
    userId: currentUser?.id || 'usr-default',
    data: weeklyOffPatterns,
    defaultSortField: 'effectiveFrom',
    defaultSortDirection: 'desc',
    tieBreakerField: 'patternCode',
    filterSignature: companyId,
  });

  const versionHistoryGrid = useStandardDataGrid({
    gridId: 'workday-calendar-versions',
    userId: currentUser?.id || 'usr-default',
    data: calendarVersions,
    defaultSortField: 'effectiveFrom',
    defaultSortDirection: 'desc',
    tieBreakerField: 'currentVersionNumber',
    filterSignature: `${companyId}|${branchId}|${financialYearId}`,
  });

  // Screen 4: Workday Calendar View Mode ('MONTHLY' | 'YEARLY' | 'FINANCIAL_YEAR')
  const [calendarViewMode, setCalendarViewMode] = useState<
    'MONTHLY' | 'YEARLY' | 'FINANCIAL_YEAR'
  >('FINANCIAL_YEAR');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('');

  React.useEffect(() => {
    if (activeWorkdayCalendar?.monthlySummaries.length && !selectedMonthKey) {
      setSelectedMonthKey(activeWorkdayCalendar.monthlySummaries[0].monthKey);
    }
  }, [activeWorkdayCalendar, selectedMonthKey]);

  // Screen 1: Create Holiday Master Form
  const [holCode, setHolCode] = useState('HOL-BR-NEW');
  const [holName, setHolName] = useState('Founders Excellence & Quality Holiday');
  const [holCat, setHolCat] = useState<HolidayCategoryType>('COMPANY');
  const [holDur, setHolDur] = useState<HolidayDurationType>('FULL_DAY');
  const [holRecurring, setHolRecurring] = useState(false);
  const [holCustomDate, setHolCustomDate] = useState('2026-12-18');

  // Screen 3: Create Weekly Off Pattern Form
  const [woffCode, setWoffCode] = useState('WOFF-CUSTOM-SAT');
  const [woffName, setWoffName] = useState('1st & 3rd Saturday + Sunday Off');
  const [woffType, setWoffType] = useState<WeeklyOffPatternType>('FIRST_AND_THIRD_SATURDAY_SUNDAY');
  const [woffHours, setWoffHours] = useState(8);

  // Screen 5: 10-Step Calendar Generation Wizard State
  const [genHolCalId, setGenHolCalId] = useState<string>('');
  const [genWoffId, setGenWoffId] = useState<string>('');
  const [genConflictPolicy, setGenConflictPolicy] =
    useState<HolidayWeeklyOffConflictPolicy>('NO_AUTOMATIC_COMPENSATORY_OFF');
  const [genDailyHours, setGenDailyHours] = useState<number>(8);
  const [genReason, setGenReason] = useState<string>('Annual Financial Year Workday Calendar Publication');

  React.useEffect(() => {
    if (holidayCalendars.length > 0 && !genHolCalId) setGenHolCalId(holidayCalendars[0].id);
    if (weeklyOffPatterns.length > 0 && !genWoffId) setGenWoffId(weeklyOffPatterns[0].id);
  }, [holidayCalendars, weeklyOffPatterns, genHolCalId, genWoffId]);

  // Screen 6: Calendar Exception Form State
  const [excDate, setExcDate] = useState('2026-11-15');
  const [excType, setExcType] = useState<CalendarException['exceptionType']>(
    'SPECIAL_WORKING_DAY_ON_WEEKLY_OFF'
  );
  const [excGrantsCompOff, setExcGrantsCompOff] = useState(true);
  const [excReason, setExcReason] = useState('Urgent export shipment Dispatch & Customer Audit');

  // Screen 8: Selected Report Type
  const [reportType, setReportType] = useState<
    | 'FY_HOLIDAY'
    | 'COMPANY_HOLIDAY'
    | 'BRANCH_HOLIDAY'
    | 'PLANT_HOLIDAY'
    | 'WEEKLY_OFF'
    | 'MONTHLY_WORKING'
    | 'FY_WORKING'
    | 'CONFLICT'
    | 'EXCEPTION'
    | 'AUDIT'
  >('MONTHLY_WORKING');

  const notify = (type: 'success' | 'error', text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 5000);
  };

  const handleAddHolidayMaster = () => {
    try {
      HolidayService.saveHolidayMaster({
        holidayCode: holCode,
        holidayName: holName,
        category: holCat,
        durationType: holDur,
        isRecurringAnnual: holRecurring,
        recurringMonthDay: holRecurring ? holCustomDate.slice(5) : undefined,
        customDate: holRecurring ? undefined : holCustomDate,
        applicableCountry: 'India',
        applicableStates: ['ALL'],
        applicableRegions: ['ALL'],
        companyId,
        branchId: holCat === 'COMPANY' ? 'ALL' : branchId,
        plantCode: holCat === 'PLANT_SPECIFIC' ? plantCode : 'ALL',
        departmentId: 'ALL',
        workforceCategory: 'ALL_WORKFORCE',
        isPaidHoliday: true,
        description: `${holCat} holiday added via Holiday Master`,
        status: 'ACTIVE',
        createdBy: actorName,
      });
      setRefreshTick((t) => t + 1);
      notify('success', `Saved Holiday Master ${holCode} (${holName}).`);
    } catch (err: any) {
      notify('error', err?.message || 'Failed to save Holiday Master.');
    }
  };

  const handleGenerateHolidayCalendar = () => {
    try {
      const cal = HolidayService.generateFinancialYearHolidayCalendar({
        companyId,
        branchId,
        plantCode,
        departmentId,
        financialYearId,
        createdBy: actorName,
        modificationReason: 'Generated FY Holiday Calendar',
      });
      setGenHolCalId(cal.id);
      setRefreshTick((t) => t + 1);
      notify('success', `Generated Holiday Calendar ${cal.calendarCode} with ${cal.entries.length} dates.`);
    } catch (err: any) {
      notify('error', err?.message || 'Holiday Calendar generation failed.');
    }
  };

  const handleAddWeeklyOffPattern = () => {
    try {
      const pat = WeeklyOffService.savePattern({
        patternCode: woffCode,
        patternName: woffName,
        companyId,
        branchId,
        plantCode,
        departmentId,
        employeeGroup: 'ALL_WORKFORCE',
        patternType: woffType,
        fixedDaysOfWeek: [0],
        saturdayRule:
          woffType === 'FIRST_AND_THIRD_SATURDAY_SUNDAY'
            ? 'FIRST_AND_THIRD'
            : woffType === 'SECOND_AND_FOURTH_SATURDAY_SUNDAY'
            ? 'SECOND_AND_FOURTH'
            : 'NONE',
        standardDailyWorkingHours: woffHours,
        status: 'ACTIVE',
        effectiveFrom: '2026-04-01',
        createdBy: actorName,
      });
      setGenWoffId(pat.id);
      setRefreshTick((t) => t + 1);
      notify('success', `Saved Weekly Off Pattern ${pat.patternCode}.`);
    } catch (err: any) {
      notify('error', err?.message || 'Failed to save Weekly Off Pattern.');
    }
  };

  const handleGenerateWorkdayCalendar = () => {
    try {
      const cal = WorkdayCalendarService.generateWorkdayCalendar({
        companyId,
        branchId,
        plantCode,
        departmentId,
        financialYearId,
        holidayCalendarId: genHolCalId,
        weeklyOffPatternId: genWoffId,
        conflictPolicy: genConflictPolicy,
        nonShiftDailyHoursPolicy: genDailyHours,
        createdBy: actorName,
        modificationReason: genReason,
      });
      setRefreshTick((t) => t + 1);
      notify(
        'success',
        `Generated Workday Calendar ${cal.calendarCode} (Draft v${cal.versionNumber}) — Net Working Days: ${cal.summary.netWorkingDays}. Submit for Maker-Checker approval to publish.`
      );
    } catch (err: any) {
      notify('error', err?.message || 'Failed to generate Workday Calendar.');
    }
  };

  const handleSubmitAndPublish = (calId: string) => {
    try {
      WorkdayCalendarService.submitWorkdayCalendarForApproval({
        workdayCalendarId: calId,
        submittedBy: actorName,
      });
      const approver =
        actorName === 'Venkatesh Iyer' ? 'R. Sundaram (Director)' : 'Venkatesh Iyer';
      const pub = WorkdayCalendarService.approveAndPublishWorkdayCalendar({
        workdayCalendarId: calId,
        approvedBy: approver,
        remarks: 'Verified holiday conflicts & monthly working day calculations.',
      });
      setRefreshTick((t) => t + 1);
      notify('success', `Published ${pub.calendarCode} (v${pub.versionNumber}).`);
    } catch (err: any) {
      notify('error', err?.message || 'Publish failed.');
    }
  };

  const handleRequestException = () => {
    const fy = companyYears.find((y) => y.id === financialYearId);
    if (!fy) return;
    try {
      const exc = CalendarExceptionService.requestCalendarException({
        companyId,
        branchId,
        plantCode,
        departmentId,
        financialYearId: fy.id,
        financialYearCode: fy.financialYearCode,
        targetDate: excDate,
        exceptionType: excType,
        originalDayStatus: 'WEEKLY_OFF',
        overrideDayStatus:
          excType === 'PLANT_SHUTDOWN_DAY'
            ? 'SHUTDOWN_DAY'
            : excType === 'EMERGENCY_HOLIDAY'
            ? 'HOLIDAY'
            : 'SPECIAL_WORKING_DAY',
        grantsCompensatoryOff: excGrantsCompOff,
        reason: excReason,
        requestedBy: actorName,
      });
      setRefreshTick((t) => t + 1);
      notify('success', `Requested Calendar Exception ${exc.exceptionCode} (Pending Approval).`);
    } catch (err: any) {
      notify('error', err?.message || 'Failed to request Calendar Exception.');
    }
  };

  const handleApproveException = (exc: CalendarException) => {
    try {
      const approver =
        exc.requestedBy === 'Plant Director' ? 'HR Director' : 'Plant Director';
      CalendarExceptionService.approveCalendarException({
        exceptionId: exc.id,
        approvedBy: approver,
        decision: 'APPROVE',
      });
      setRefreshTick((t) => t + 1);
      notify(
        'success',
        `Approved Exception ${exc.exceptionCode}${exc.grantsCompensatoryOff ? ' & Credited Compensatory Off' : ''}.`
      );
    } catch (err: any) {
      notify('error', err?.message || 'Exception approval blocked.');
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Header & Enterprise Scope Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-indigo-600" />
              <span>Financial Year-Based Holiday, Weekly Off & Workday Calendar</span>
            </h1>
            <p className="text-slate-500 mt-0.5">
              Centralized Workday Calendar Engine integrated with Financial Year Master. Calculates Monthly & FY working days, prevents double-counting overlaps, and enforces Maker-Checker versioning.
            </p>
          </div>
          {activeWorkdayCalendar && (
            <div className="bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg text-indigo-900 font-bold">
              Active Calendar: {activeWorkdayCalendar.financialYearCode} • Net Working Days:{' '}
              {activeWorkdayCalendar.summary.netWorkingDays}
            </div>
          )}
        </div>

        {/* Company / Branch / Plant / Department / Financial Year Filter Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100">
          <div>
            <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Company</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
            >
              {INITIAL_COMPANIES.map((co) => (
                <option key={co.id} value={co.id}>
                  {co.code} — {co.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
            >
              {companyBranches.map((br) => (
                <option key={br.id} value={br.id}>
                  {br.portalBranchCode || br.code} — {br.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Plant</label>
            <select
              value={plantCode}
              onChange={(e) => setPlantCode(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
            >
              <option value="ALL">ALL — All Plants</option>
              <option value="PLT-PDY-INJ">PLT-PDY-INJ (Puducherry Injection)</option>
              <option value="PLT-CHN-EXT">PLT-CHN-EXT (Chennai Extrusion)</option>
              <option value="PLT-HSR-CNC">PLT-HSR-CNC (Hosur Precision)</option>
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Department</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
            >
              <option value="ALL">ALL — Plant-Wide Default</option>
              <option value="dept-pdy-01">Production & Plant Ops</option>
              <option value="dept-pdy-02">Quality & R&D</option>
              <option value="dept-pdy-03">Maintenance & Engineering</option>
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-600 text-[10px] uppercase mb-1">Financial Year</label>
            <select
              value={financialYearId}
              onChange={(e) => setFinancialYearId(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-indigo-300 rounded-lg font-bold text-indigo-800"
            >
              {companyYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.financialYearCode} ({fy.status})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-xl border font-bold flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* 8-Screen Navigation Pills */}
      <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
        {[
          { id: 'workday-calendar', label: 'Workday Calendar' },
          { id: 'holiday-master', label: 'Holiday Master' },
          { id: 'holiday-calendar', label: 'Holiday Calendar' },
          { id: 'weekly-off', label: 'Weekly Off Configuration' },
          { id: 'calendar-generation', label: 'Calendar Generation' },
          { id: 'calendar-exceptions', label: 'Calendar Exception Management' },
          { id: 'calendar-versions', label: 'Calendar Version History' },
          { id: 'calendar-reports', label: 'Workday Analytics & Reports' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveScreen(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition ${
              activeScreen === tab.id
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SCREEN 1: HOLIDAY MASTER */}
      {activeScreen === 'holiday-master' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-slate-900">Add / Configure Holiday Master</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              <input
                type="text"
                placeholder="Code"
                value={holCode}
                onChange={(e) => setHolCode(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg font-mono font-bold"
              />
              <input
                type="text"
                placeholder="Holiday Name"
                value={holName}
                onChange={(e) => setHolName(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg font-bold lg:col-span-2"
              />
              <select
                value={holCat}
                onChange={(e) => setHolCat(e.target.value as HolidayCategoryType)}
                className="p-2 border border-slate-300 rounded-lg font-bold"
              >
                <option value="NATIONAL">National</option>
                <option value="STATE">State</option>
                <option value="REGIONAL">Regional</option>
                <option value="COMPANY">Company</option>
                <option value="BRANCH_SPECIFIC">Branch-Specific</option>
                <option value="PLANT_SPECIFIC">Plant-Specific</option>
                <option value="DEPARTMENT_SPECIFIC">Department-Specific</option>
                <option value="OPTIONAL">Optional</option>
                <option value="RESTRICTED">Restricted</option>
                <option value="STATUTORY">Statutory</option>
                <option value="EMERGENCY">Emergency</option>
              </select>
              <select
                value={holDur}
                onChange={(e) => setHolDur(e.target.value as HolidayDurationType)}
                className="p-2 border border-slate-300 rounded-lg font-bold"
              >
                <option value="FULL_DAY">Full-Day (1.0)</option>
                <option value="HALF_DAY_FIRST_HALF">Half-Day Morning (0.5)</option>
                <option value="HALF_DAY_SECOND_HALF">Half-Day Afternoon (0.5)</option>
              </select>
              <input
                type="date"
                value={holCustomDate}
                onChange={(e) => setHolCustomDate(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={holRecurring}
                  onChange={(e) => setHolRecurring(e.target.checked)}
                />
                <span>Recurring Annual Holiday (Applies automatically to every Financial Year)</span>
              </label>
              <button
                type="button"
                onClick={handleAddHolidayMaster}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-bold cursor-pointer"
              >
                Save Holiday Master
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Code</th>
                    <th className="p-3">Holiday Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Schedule</th>
                    <th className="p-3">Scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {holidayMasterGrid.pagedData.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">{h.holidayCode}</td>
                      <td className="p-3 font-bold text-slate-900">{h.holidayName}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                          {h.category}
                        </span>
                      </td>
                      <td className="p-3">{h.durationType}</td>
                      <td className="p-3 font-mono">
                        {h.isRecurringAnnual ? `Annual (${h.recurringMonthDay})` : h.customDate}
                      </td>
                      <td className="p-3 text-[11px] text-slate-600">
                        States: {h.applicableStates.join(', ')} • Branch: {h.branchId} • Plant: {h.plantCode}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-slate-100">
              <DataGridFooter
                currentPage={holidayMasterGrid.currentPage}
                totalPages={holidayMasterGrid.totalPages}
                pageSize={holidayMasterGrid.pageSize}
                totalRecords={holidayMasterGrid.totalRecords}
                onPageChange={holidayMasterGrid.setCurrentPage}
                onPageSizeChange={holidayMasterGrid.setPageSize}
                pageSizeOptions={holidayMasterGrid.pageSizeOptions}
              />
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 2: HOLIDAY CALENDAR */}
      {activeScreen === 'holiday-calendar' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-900">Financial Year Holiday Calendar</h3>
              <p className="text-[11px] text-slate-500">
                Generates complete financial-year holiday entries filtered by Company, State, Branch, Plant & Workforce.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateHolidayCalendar}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-bold cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Generate FY Holiday Calendar</span>
            </button>
          </div>

          {holidayCalendars.map((cal) => (
            <div key={cal.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <span className="font-bold text-indigo-700">{cal.calendarCode}</span>
                  <span className="ml-2 text-slate-700 font-semibold">{cal.calendarName}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                  {cal.approvalStatus} • v{cal.versionNumber} ({cal.entries.length} Holidays)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {cal.entries.map((e) => (
                  <div
                    key={e.id}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{e.holidayName}</div>
                      <div className="text-[10px] text-slate-500">
                        {e.category} • {e.durationType}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-indigo-700">{e.date}</div>
                      <div className="text-[10px] text-slate-500">{e.dayName}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SCREEN 3: WEEKLY OFF CONFIGURATION */}
      {activeScreen === 'weekly-off' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-slate-900">Configure Weekly Off Pattern (Multiple Patterns Supported per Company)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Pattern Code"
                value={woffCode}
                onChange={(e) => setWoffCode(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg font-mono font-bold"
              />
              <input
                type="text"
                placeholder="Pattern Name"
                value={woffName}
                onChange={(e) => setWoffName(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg font-bold"
              />
              <select
                value={woffType}
                onChange={(e) => setWoffType(e.target.value as WeeklyOffPatternType)}
                className="p-2 border border-slate-300 rounded-lg font-bold"
              >
                <option value="SUNDAY_ONLY">Fixed Sunday Off</option>
                <option value="SATURDAY_SUNDAY">Saturday & Sunday Off</option>
                <option value="ALTERNATE_SATURDAY_SUNDAY">Alternate Saturday & Sunday</option>
                <option value="FIRST_AND_THIRD_SATURDAY_SUNDAY">1st & 3rd Saturday + Sunday</option>
                <option value="SECOND_AND_FOURTH_SATURDAY_SUNDAY">2nd & 4th Saturday + Sunday</option>
                <option value="MONDAY_TO_SATURDAY_OFF">Monday–Saturday Off</option>
                <option value="ROTATIONAL_WEEKLY_OFF">Rotational Weekly Off</option>
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={woffHours}
                  onChange={(e) => setWoffHours(Number(e.target.value) || 8)}
                  className="w-24 p-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
                <span className="text-[11px] text-slate-600">Non-Shift Std Hrs/Day</span>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddWeeklyOffPattern}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-bold cursor-pointer"
              >
                Save Weekly Off Pattern
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Pattern Code & Name</th>
                  <th className="p-3">Pattern Type</th>
                  <th className="p-3">Scope (Branch / Plant / Group)</th>
                  <th className="p-3 text-center">Non-Shift Hours/Day</th>
                  <th className="p-3 text-center">Version</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {weeklyOffGrid.pagedData.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-mono font-bold text-indigo-700">{p.patternCode}</div>
                      <div className="font-semibold text-slate-800">{p.patternName}</div>
                    </td>
                    <td className="p-3 font-bold">{p.patternType.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-slate-600">
                      Branch: {p.branchId} • Plant: {p.plantCode} • Group: {p.employeeGroup}
                    </td>
                    <td className="p-3 text-center font-mono font-bold">
                      {p.standardDailyWorkingHours ?? 'N/A'} hrs
                    </td>
                    <td className="p-3 text-center font-mono">v{p.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3 border-t border-slate-100">
              <DataGridFooter
                currentPage={weeklyOffGrid.currentPage}
                totalPages={weeklyOffGrid.totalPages}
                pageSize={weeklyOffGrid.pageSize}
                totalRecords={weeklyOffGrid.totalRecords}
                onPageChange={weeklyOffGrid.setCurrentPage}
                onPageSizeChange={weeklyOffGrid.setPageSize}
                pageSizeOptions={weeklyOffGrid.pageSizeOptions}
              />
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 4: WORKDAY CALENDAR (MONTHLY / YEARLY / FINANCIAL YEAR VIEWS) */}
      {activeScreen === 'workday-calendar' && activeWorkdayCalendar && (
        <div className="space-y-4">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Calendar Days', val: activeWorkdayCalendar.summary.totalCalendarDays, color: 'text-slate-900' },
              { label: 'Net Working Days', val: activeWorkdayCalendar.summary.netWorkingDays, color: 'text-emerald-700' },
              { label: 'Effective Holidays', val: activeWorkdayCalendar.summary.totalHolidays, color: 'text-rose-700' },
              { label: 'Weekly Offs', val: activeWorkdayCalendar.summary.totalWeeklyOffs, color: 'text-indigo-700' },
              { label: 'Overlap Conflicts', val: activeWorkdayCalendar.summary.overlapConflictCount, color: 'text-amber-700' },
              { label: 'Scheduled Hours', val: `${activeWorkdayCalendar.summary.scheduledWorkingHours} h`, color: 'text-slate-800' },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-slate-500">{kpi.label}</div>
                <div className={`text-lg font-black font-mono mt-0.5 ${kpi.color}`}>{kpi.val}</div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-slate-900">
                {activeWorkdayCalendar.calendarName} ({activeWorkdayCalendar.status})
              </div>
              <div className="flex items-center gap-1.5">
                {(['MONTHLY', 'YEARLY', 'FINANCIAL_YEAR'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCalendarViewMode(mode)}
                    className={`px-3 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                      calendarViewMode === mode
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {mode.replace(/_/g, ' ')} VIEW
                  </button>
                ))}
              </div>
            </div>

            {calendarViewMode === 'FINANCIAL_YEAR' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Month / Period</th>
                      <th className="p-2.5 text-right">Calendar Days</th>
                      <th className="p-2.5 text-right">Full Working</th>
                      <th className="p-2.5 text-right">Half Days</th>
                      <th className="p-2.5 text-right">Special Working</th>
                      <th className="p-2.5 text-right">Holidays</th>
                      <th className="p-2.5 text-right">Weekly Offs</th>
                      <th className="p-2.5 text-right">Shutdown</th>
                      <th className="p-2.5 text-right">Net Working Days</th>
                      <th className="p-2.5 text-right">Scheduled Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {activeWorkdayCalendar.monthlySummaries.map((m) => (
                      <tr
                        key={m.monthKey}
                        onClick={() => {
                          setSelectedMonthKey(m.monthKey);
                          setCalendarViewMode('MONTHLY');
                        }}
                        className="hover:bg-indigo-50/40 cursor-pointer"
                      >
                        <td className="p-2.5 font-sans font-bold text-indigo-700">{m.monthLabel}</td>
                        <td className="p-2.5 text-right">{m.totalCalendarDays}</td>
                        <td className="p-2.5 text-right">{m.totalWorkingDays}</td>
                        <td className="p-2.5 text-right">{m.halfWorkingDays}</td>
                        <td className="p-2.5 text-right">{m.specialWorkingDays}</td>
                        <td className="p-2.5 text-right text-rose-700">{m.totalHolidays}</td>
                        <td className="p-2.5 text-right text-indigo-700">{m.totalWeeklyOffs}</td>
                        <td className="p-2.5 text-right">{m.shutdownDays}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-700">{m.netWorkingDays}</td>
                        <td className="p-2.5 text-right">{m.scheduledWorkingHours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {calendarViewMode === 'MONTHLY' && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {activeWorkdayCalendar.monthlySummaries.map((m) => (
                    <button
                      key={m.monthKey}
                      type="button"
                      onClick={() => setSelectedMonthKey(m.monthKey)}
                      className={`px-2.5 py-1 rounded font-bold text-[11px] cursor-pointer ${
                        selectedMonthKey === m.monthKey
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {m.monthLabel}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {activeWorkdayCalendar.entries
                    .filter((e) => e.monthKey === selectedMonthKey)
                    .map((entry) => (
                      <div
                        key={entry.date}
                        className={`p-2.5 rounded-lg border text-[11px] ${
                          entry.status === 'WORKING_DAY'
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : entry.status === 'SPECIAL_WORKING_DAY'
                            ? 'bg-cyan-50 border-cyan-300'
                            : entry.status === 'HALF_WORKING_DAY'
                            ? 'bg-amber-50 border-amber-300'
                            : entry.status === 'HOLIDAY' || entry.status === 'SUBSTITUTE_HOLIDAY'
                            ? 'bg-rose-50 border-rose-300'
                            : entry.status === 'HOLIDAY_AND_WEEKLY_OFF_OVERLAP'
                            ? 'bg-purple-50 border-purple-300'
                            : 'bg-slate-100 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono font-bold">
                          <span>{entry.date.slice(8)}</span>
                          <span className="text-[10px] text-slate-500">{entry.dayName.slice(0, 3)}</span>
                        </div>
                        <div className="font-bold text-[10px] mt-1 truncate">
                          {entry.holidayName || entry.status.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[9px] text-slate-500 mt-0.5">
                          Wt: {entry.workingDayWeight} • {entry.scheduledWorkingHours}h
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {calendarViewMode === 'YEARLY' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {activeWorkdayCalendar.monthlySummaries.map((m) => (
                  <div
                    key={m.monthKey}
                    onClick={() => {
                      setSelectedMonthKey(m.monthKey);
                      setCalendarViewMode('MONTHLY');
                    }}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:border-indigo-300 cursor-pointer space-y-1"
                  >
                    <div className="font-bold text-indigo-700">{m.monthLabel}</div>
                    <div className="text-[11px] text-slate-700">
                      Net Working: <strong className="text-emerald-700">{m.netWorkingDays} days</strong> ({m.scheduledWorkingHours} hrs)
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Holidays: {m.totalHolidays} • Weekly Offs: {m.totalWeeklyOffs} • Overlaps: {m.overlapHolidayOnWeeklyOffCount}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SCREEN 5: CALENDAR GENERATION 10-STEP WORKFLOW */}
      {activeScreen === 'calendar-generation' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-indigo-600" />
              <span>10-Step Workday Calendar Generation, Conflict Validation & Approval Workflow</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Select Holiday Calendar & Weekly Off Pattern, configure explicit conflict handling (never silently applied), generate preview, validate overlaps, submit and Maker-Checker publish.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Holiday Calendar</label>
              <select
                value={genHolCalId}
                onChange={(e) => setGenHolCalId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg font-bold"
              >
                {holidayCalendars.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.calendarCode} ({h.entries.length} holidays)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Weekly Off Pattern</label>
              <select
                value={genWoffId}
                onChange={(e) => setGenWoffId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg font-bold"
              >
                {weeklyOffPatterns.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.patternCode} — {w.patternName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Holiday / Weekly Off Conflict Policy</label>
              <select
                value={genConflictPolicy}
                onChange={(e) => setGenConflictPolicy(e.target.value as HolidayWeeklyOffConflictPolicy)}
                className="w-full p-2 border border-indigo-300 rounded-lg font-bold text-indigo-800"
              >
                <option value="NO_AUTOMATIC_COMPENSATORY_OFF">No Automatic Comp-Off</option>
                <option value="SUBSTITUTE_NEXT_WORKING_DAY">Create Substitute Holiday</option>
                <option value="GRANT_COMPENSATORY_OFF_CREDIT">Grant Compensatory Off Credit</option>
                <option value="MANUAL_AUTHORIZED_EXCEPTION">Manual Authorized Exception</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Non-Shift Working Hours/Day</label>
              <input
                type="number"
                value={genDailyHours}
                onChange={(e) => setGenDailyHours(Number(e.target.value) || 0)}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              type="text"
              value={genReason}
              onChange={(e) => setGenReason(e.target.value)}
              placeholder="Modification / Generation Reason *"
              className="flex-1 min-w-[240px] p-2 border border-slate-300 rounded-lg"
            />
            <button
              type="button"
              onClick={handleGenerateWorkdayCalendar}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer"
            >
              Generate Calendar Preview (vNext)
            </button>
          </div>

          <div className="border-t border-slate-200 pt-3 space-y-2">
            <h4 className="font-bold text-slate-800">Generated Calendars & Maker-Checker Publish Queue</h4>
            {workdayCalendars.map((cal) => (
              <div
                key={cal.id}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <div className="font-bold text-indigo-700">
                    {cal.calendarCode} (v{cal.versionNumber}) — {cal.status}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Net Working Days: <strong>{cal.summary.netWorkingDays}</strong> • Conflicts Detected:{' '}
                    <strong>{cal.conflicts.length}</strong> ({cal.conflictPolicy})
                  </div>
                </div>
                {cal.status === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={() => handleSubmitAndPublish(cal.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold cursor-pointer"
                  >
                    Submit & Maker-Checker Publish
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SCREEN 6: CALENDAR EXCEPTION MANAGEMENT */}
      {activeScreen === 'calendar-exceptions' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-slate-900">Request Calendar Exception / Special Working Day Override</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="date"
                value={excDate}
                onChange={(e) => setExcDate(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg font-mono font-bold"
              />
              <select
                value={excType}
                onChange={(e) => setExcType(e.target.value as any)}
                className="p-2 border border-slate-300 rounded-lg font-bold"
              >
                <option value="SPECIAL_WORKING_DAY_ON_WEEKLY_OFF">Special Working Day (On Weekly Off)</option>
                <option value="SPECIAL_WORKING_DAY_ON_HOLIDAY">Special Working Day (On Holiday)</option>
                <option value="EMERGENCY_HOLIDAY">Emergency Holiday</option>
                <option value="PLANT_SHUTDOWN_DAY">Plant Shutdown Day</option>
                <option value="TEMPORARY_WEEKLY_OFF_OVERRIDE">Temporary Weekly Off Override</option>
              </select>
              <input
                type="text"
                value={excReason}
                onChange={(e) => setExcReason(e.target.value)}
                placeholder="Authorized Reason *"
                className="p-2 border border-slate-300 rounded-lg"
              />
              <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excGrantsCompOff}
                  onChange={(e) => setExcGrantsCompOff(e.target.checked)}
                />
                <span>Grant Comp-Off Credit</span>
              </label>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRequestException}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-bold cursor-pointer"
              >
                Submit Exception Request
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-slate-900">Calendar Exceptions ({exceptions.length})</h4>
              {exceptions.map((e) => (
                <div key={e.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-indigo-700">
                      {e.exceptionCode} • {e.targetDate} ({e.approvalStatus})
                    </div>
                    <div className="text-[11px] text-slate-600">{e.reason}</div>
                  </div>
                  {e.approvalStatus === 'PENDING_APPROVAL' && (
                    <button
                      type="button"
                      onClick={() => handleApproveException(e)}
                      className="px-2.5 py-1 bg-emerald-600 text-white rounded font-bold text-[10px] cursor-pointer"
                    >
                      Approve
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-slate-900">Compensatory Off Credit Ledger ({compOffs.length})</h4>
              {compOffs.map((c) => (
                <div key={c.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-emerald-700">
                      {c.compOffNumber} • Earned {c.earnedOnDate} (+{c.creditDays} day)
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Group: {c.employeeOrGroupRef} • Expires: {c.expiryDate}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 7: CALENDAR VERSION HISTORY */}
      {activeScreen === 'calendar-versions' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">
              Published Calendar Version History (Historical Attendance & Payroll Preserved)
            </h3>
            <span className="text-[11px] text-emerald-700 font-bold">
              Immutable Version Snapshots Active
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Calendar Code</th>
                  <th className="p-2.5">Prev → Curr Version</th>
                  <th className="p-2.5">Effective From / Until</th>
                  <th className="p-2.5">Modified By / Approved By</th>
                  <th className="p-2.5">Modification Reason</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {versionHistoryGrid.pagedData.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold text-indigo-700">{v.calendarCode}</td>
                    <td className="p-2.5 font-mono font-bold">
                      {v.previousVersionNumber ? `v${v.previousVersionNumber} → ` : ''}v{v.currentVersionNumber}
                    </td>
                    <td className="p-2.5 font-mono">
                      {v.effectiveFrom} → {v.effectiveUntil || 'OPEN'}
                    </td>
                    <td className="p-2.5">
                      {v.modifiedBy} / <strong>{v.approvedBy}</strong>
                    </td>
                    <td className="p-2.5">{v.modificationReason}</td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          v.status === 'PUBLISHED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DataGridFooter
            currentPage={versionHistoryGrid.currentPage}
            totalPages={versionHistoryGrid.totalPages}
            pageSize={versionHistoryGrid.pageSize}
            totalRecords={versionHistoryGrid.totalRecords}
            onPageChange={versionHistoryGrid.setCurrentPage}
            onPageSizeChange={versionHistoryGrid.setPageSize}
            pageSizeOptions={versionHistoryGrid.pageSizeOptions}
          />
        </div>
      )}

      {/* SCREEN 8: WORKDAY ANALYTICS & 10 STANDARD REPORTS */}
      {activeScreen === 'calendar-reports' && activeWorkdayCalendar && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-slate-900">Workday Calendar & Holiday Reports (10 Standard Reports)</h3>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
            >
              <option value="FY_HOLIDAY">1. Financial Year Holiday Report</option>
              <option value="COMPANY_HOLIDAY">2. Company-Wise Holiday Report</option>
              <option value="BRANCH_HOLIDAY">3. Branch-Wise Holiday Report</option>
              <option value="PLANT_HOLIDAY">4. Plant-Wise Holiday Report</option>
              <option value="WEEKLY_OFF">5. Weekly Off Report</option>
              <option value="MONTHLY_WORKING">6. Monthly Working Days Report</option>
              <option value="FY_WORKING">7. Financial Year Working Days Report</option>
              <option value="CONFLICT">8. Holiday & Weekly Off Conflict Report</option>
              <option value="EXCEPTION">9. Calendar Exception Report</option>
              <option value="AUDIT">10. Calendar Change Audit Report</option>
            </select>
          </div>

          {(reportType === 'MONTHLY_WORKING' || reportType === 'FY_WORKING') && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Period</th>
                    <th className="p-2.5 text-right">Calendar Days</th>
                    <th className="p-2.5 text-right">Holidays</th>
                    <th className="p-2.5 text-right">Weekly Offs</th>
                    <th className="p-2.5 text-right">Special Working</th>
                    <th className="p-2.5 text-right">Net Working Days</th>
                    <th className="p-2.5 text-right">Scheduled Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {activeWorkdayCalendar.monthlySummaries.map((m) => (
                    <tr key={m.monthKey}>
                      <td className="p-2.5 font-sans font-bold">{m.monthLabel}</td>
                      <td className="p-2.5 text-right">{m.totalCalendarDays}</td>
                      <td className="p-2.5 text-right">{m.totalHolidays}</td>
                      <td className="p-2.5 text-right">{m.totalWeeklyOffs}</td>
                      <td className="p-2.5 text-right">{m.specialWorkingDays}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-700">{m.netWorkingDays}</td>
                      <td className="p-2.5 text-right">{m.scheduledWorkingHours}</td>
                    </tr>
                  ))}
                  <tr className="bg-indigo-50 font-bold">
                    <td className="p-2.5 font-sans">TOTAL FY ({activeWorkdayCalendar.financialYearCode})</td>
                    <td className="p-2.5 text-right">{activeWorkdayCalendar.summary.totalCalendarDays}</td>
                    <td className="p-2.5 text-right">{activeWorkdayCalendar.summary.totalHolidays}</td>
                    <td className="p-2.5 text-right">{activeWorkdayCalendar.summary.totalWeeklyOffs}</td>
                    <td className="p-2.5 text-right">{activeWorkdayCalendar.summary.specialWorkingDays}</td>
                    <td className="p-2.5 text-right text-emerald-700">{activeWorkdayCalendar.summary.netWorkingDays}</td>
                    <td className="p-2.5 text-right">{activeWorkdayCalendar.summary.scheduledWorkingHours}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {reportType === 'CONFLICT' && (
            <div className="space-y-2">
              {activeWorkdayCalendar.conflicts.length === 0 ? (
                <div className="p-4 text-slate-500">No Holiday/Weekly Off overlap conflicts detected in this calendar.</div>
              ) : (
                activeWorkdayCalendar.conflicts.map((c, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-amber-900">
                        {c.date} ({c.dayName}) — {c.holidayName} overlaps {c.weeklyOffPatternCode}
                      </div>
                      <div className="text-[11px] text-amber-800">
                        Policy: {c.conflictPolicyConfigured} • Outcome: {c.resolutionOutcome}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {reportType === 'AUDIT' && (
            <div className="space-y-2">
              {approvalHistory.map((h) => (
                <div key={h.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">
                      {h.action} • {h.entityCode} (v{h.versionNumber})
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Actor: {h.actorName} — {h.remarks}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">{h.timestamp}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
