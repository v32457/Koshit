import React, { useState, useMemo } from 'react';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  Plus,
  RefreshCw,
  ShieldCheck,
  FileCheck2,
  Hash,
  ClipboardCheck,
  AlertTriangle,
  ArrowRightLeft,
} from 'lucide-react';
import { financialYearService } from '../../services/financialYearService';
import {
  FiscalCalendarType,
  PeriodFrequency,
  FinancialYearMaster,
  AccountingPeriod,
  NumberingDocumentType,
  YearEndClosingTransitionRecord,
} from '../../types/financialYear';
import { INITIAL_COMPANIES } from '../../data/seedData';
import { normalizeCompanyId } from '../../services/prGovernancePolicyService';
import { User } from '../../types';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';

interface FinancialYearManagementViewProps {
  companyId?: string;
  currentUser?: User;
}

export const FinancialYearManagementView: React.FC<FinancialYearManagementViewProps> = ({
  companyId: propCompanyId,
  currentUser,
}) => {
  const actorName = currentUser?.fullName || 'Finance Controller';
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    normalizeCompanyId(propCompanyId || 'co-kosh-01')
  );
  const [activeSubTab, setActiveSubTab] = useState<
    'fy-master' | 'periods' | 'numbering' | 'year-end'
  >('fy-master');
  const [refreshTick, setRefreshTick] = useState(0);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const financialYears = useMemo(
    () => financialYearService.getFinancialYears(selectedCompanyId),
    [selectedCompanyId, refreshTick]
  );

  const [selectedFyId, setSelectedFyId] = useState<string>(() => {
    const active =
      financialYears.find((y) => y.status === 'ACTIVE') || financialYears[0];
    return active?.id || '';
  });

  React.useEffect(() => {
    const yrs = financialYearService.getFinancialYears(selectedCompanyId);
    if (!yrs.some((y) => y.id === selectedFyId)) {
      const def = yrs.find((y) => y.status === 'ACTIVE') || yrs[0];
      setSelectedFyId(def?.id || '');
    }
  }, [selectedCompanyId, selectedFyId, refreshTick]);

  const activeFy = useMemo(
    () => financialYears.find((y) => y.id === selectedFyId) || financialYears[0],
    [financialYears, selectedFyId]
  );

  const periods = useMemo(
    () => (activeFy ? financialYearService.getAccountingPeriods(activeFy.id) : []),
    [activeFy, refreshTick]
  );

  const numberingSeries = useMemo(
    () => financialYearService.getNumberingSeries(),
    [refreshTick]
  );

  const yearEndClosings = useMemo(
    () => financialYearService.getYearEndClosings(selectedCompanyId),
    [selectedCompanyId, refreshTick]
  );

  const fyGrid = useStandardDataGrid({
    data: financialYears,
    gridId: 'financial-year-master',
    userId: currentUser?.id || 'usr-default',
    primarySortField: 'startDate',
    tieBreakerField: 'financialYearCode',
    filterSignature: selectedCompanyId,
  });

  const periodGrid = useStandardDataGrid({
    data: periods,
    gridId: 'financial-year-periods',
    userId: currentUser?.id || 'usr-default',
    primarySortField: 'startDate',
    tieBreakerField: 'periodCode',
    filterSignature: `${selectedCompanyId}|${activeFy?.id || ''}`,
  });

  const numberingGrid = useStandardDataGrid({
    data: numberingSeries,
    gridId: 'financial-year-numbering',
    userId: currentUser?.id || 'usr-default',
    primarySortField: 'version',
    tieBreakerField: 'seriesCode',
    filterSignature: selectedCompanyId,
  });

  // Create FY Modal State
  const [showCreateFy, setShowCreateFy] = useState(false);
  const [newFyCode, setNewFyCode] = useState('FY 2028-29');
  const [newFyName, setNewFyName] = useState('Financial Year 2028-29 (Apr-Mar)');
  const [newCalType, setNewCalType] = useState<FiscalCalendarType>('APRIL_MARCH');
  const [newStartDate, setNewStartDate] = useState('2028-04-01');
  const [newEndDate, setNewEndDate] = useState('2029-03-31');
  const [newFreq, setNewFreq] = useState<PeriodFrequency>('MONTHLY');
  const [includeAdjPeriod, setIncludeAdjPeriod] = useState(true);

  // Posting Date Sandbox State
  const [testDocDate, setTestDocDate] = useState('2026-11-12');
  const [testPostDate, setTestPostDate] = useState('2026-11-12');
  const [postingTestResult, setPostingTestResult] = useState<any>(null);

  // Numbering Allocation Preview State
  const [testNumDocType, setTestNumDocType] = useState<NumberingDocumentType>('PO');
  const [testNumPostDate, setTestNumPostDate] = useState('2026-11-12');
  const [allocatedPreview, setAllocatedPreview] = useState<any>(null);

  // Year-End Closing Form State
  const [targetFyId, setTargetFyId] = useState<string>('');
  const [carryFwdAuthorized, setCarryFwdAuthorized] = useState(false);
  const [carryFwdAmount, setCarryFwdAmount] = useState(500000);
  const [carryFwdRef, setCarryFwdRef] = useState('');

  React.useEffect(() => {
    const fut = financialYears.find((y) => y.id !== activeFy?.id && (y.status === 'FUTURE' || y.status === 'ACTIVE'));
    if (fut) setTargetFyId(fut.id);
  }, [financialYears, activeFy]);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 5000);
  };

  const handleCreateFy = () => {
    try {
      const created = financialYearService.createFinancialYear({
        companyId: selectedCompanyId,
        financialYearCode: newFyCode,
        financialYearName: newFyName,
        fiscalCalendarType: newCalType,
        startDate: newStartDate,
        endDate: newEndDate,
        periodFrequency: newFreq,
        includeAdjustmentPeriod: includeAdjPeriod,
        status: 'FUTURE',
        description: `Configured ${newCalType} fiscal year`,
        createdBy: actorName,
      });
      setRefreshTick((t) => t + 1);
      setSelectedFyId(created.id);
      setShowCreateFy(false);
      showNotice(
        'success',
        `Created ${created.financialYearCode} with ${created.numberOfPeriods} accounting periods.`
      );
    } catch (err: any) {
      showNotice('error', err?.message || 'Failed to create Financial Year.');
    }
  };

  const handlePeriodAction = (
    p: AccountingPeriod,
    targetStatus: AccountingPeriod['status']
  ) => {
    try {
      const approvalRef =
        targetStatus === 'OPEN' && (p.status === 'CLOSED' || p.status === 'TEMPORARILY_LOCKED')
          ? `CFO-REOPEN-${Date.now().toString().slice(-4)}`
          : undefined;
      financialYearService.updateAccountingPeriodStatus({
        periodId: p.id,
        targetStatus,
        actorName,
        reason: `Controlled transition from ${p.status} to ${targetStatus}`,
        approvalReference: approvalRef,
      });
      setRefreshTick((t) => t + 1);
      showNotice('success', `Period ${p.periodCode} transitioned to ${targetStatus}.`);
    } catch (err: any) {
      showNotice('error', err?.message || 'Period transition blocked.');
    }
  };

  const handleTestPostingDate = () => {
    const res = financialYearService.validateAndCapturePostingSnapshot({
      companyId: selectedCompanyId,
      documentDate: testDocDate,
      accountingPostingDate: testPostDate,
    });
    setPostingTestResult(res);
  };

  const handleGenerateYearEndChecklist = () => {
    if (!activeFy || !targetFyId) {
      showNotice('error', 'Select both Source and Target Financial Years.');
      return;
    }
    try {
      const rec = financialYearService.generateYearEndChecklist({
        companyId: selectedCompanyId,
        sourceFinancialYearId: activeFy.id,
        targetFinancialYearId: targetFyId,
        initiatedBy: actorName,
        authorizeBudgetCarryForward: carryFwdAuthorized,
        budgetCarryForwardAmountInr: carryFwdAmount,
        budgetCarryForwardApprovalRef: carryFwdRef,
      });
      setRefreshTick((t) => t + 1);
      showNotice(
        'success',
        `Year-End Checklist generated (${rec.checklistItems.length} validations). Ready for Maker-Checker CFO approval.`
      );
    } catch (err: any) {
      showNotice('error', err?.message || 'Checklist generation failed.');
    }
  };

  const handleApproveYearEnd = (rec: YearEndClosingTransitionRecord) => {
    try {
      const approver =
        rec.initiatedBy === 'R. Sundaram (CFO)'
          ? 'Platform Governance Approver'
          : 'R. Sundaram (CFO)';
      const completed = financialYearService.approveAndExecuteYearEndClosing({
        closingRecordId: rec.id,
        approvedBy: approver,
      });
      setRefreshTick((t) => t + 1);
      showNotice(
        'success',
        `Year-End Closing ${completed.sourceFinancialYearCode} → ${completed.targetFinancialYearCode} approved & executed cleanly.`
      );
    } catch (err: any) {
      showNotice('error', err?.message || 'Year-End approval blocked.');
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <span>Financial Year & Accounting Period Management</span>
          </h2>
          <p className="text-slate-500 mt-0.5">
            Centralized authoritative source for Fiscal Calendars, Accounting Periods, FY-integrated Numbering Series, Posting-Date Validation, and Year-End Closing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Select Company for Financial Year"
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
          >
            {INITIAL_COMPANIES.map((co) => (
              <option key={co.id} value={co.id}>
                {co.code} — {co.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowCreateFy(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Financial Year</span>
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`p-3 rounded-xl border font-bold flex items-center gap-2 ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
        {[
          { id: 'fy-master', label: '1. Financial Year Master', icon: Calendar },
          { id: 'periods', label: '2. Accounting Periods & Posting Gate', icon: Lock },
          { id: 'numbering', label: '3. FY Numbering Series', icon: Hash },
          { id: 'year-end', label: '4. Year-End Closing & Carry-Forward', icon: ClipboardCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition ${
                active
                  ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: FINANCIAL YEAR MASTER */}
      {activeSubTab === 'fy-master' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-900">
                Configured Financial Years ({financialYears.length})
              </span>
              <span className="text-[11px] text-slate-500">
                Supports April–March, January–December & Custom Calendars • Overlapping active FYs strictly blocked
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">FY Code & Name</th>
                    <th className="p-3">Fiscal Calendar</th>
                    <th className="p-3">Start Date</th>
                    <th className="p-3">End Date</th>
                    <th className="p-3 text-center">Periods</th>
                    <th className="p-3 text-center">Version</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fyGrid.pagedData.map((fy: FinancialYearMaster) => (
                    <tr
                      key={fy.id}
                      onClick={() => setSelectedFyId(fy.id)}
                      className={`cursor-pointer transition ${
                        selectedFyId === fy.id ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-3">
                        <div className="font-bold text-indigo-700">{fy.financialYearCode}</div>
                        <div className="text-[11px] text-slate-500">{fy.financialYearName}</div>
                      </td>
                      <td className="p-3 font-semibold text-slate-800">
                        {fy.fiscalCalendarType.replace(/_/g, ' ')} ({fy.periodFrequency})
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800">{fy.startDate}</td>
                      <td className="p-3 font-mono font-bold text-slate-800">{fy.endDate}</td>
                      <td className="p-3 text-center font-mono font-bold">
                        {fy.numberOfPeriods} {fy.includeAdjustmentPeriod ? '+ Adj' : ''}
                      </td>
                      <td className="p-3 text-center font-mono">v{fy.version}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            fy.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : fy.status === 'FUTURE'
                              ? 'bg-blue-100 text-blue-800'
                              : fy.status === 'CLOSED'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {fy.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFyId(fy.id);
                            setActiveSubTab('periods');
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-bold text-[11px] cursor-pointer"
                        >
                          Inspect Periods
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DataGridFooter
              totalRecords={fyGrid.totalRecords}
              currentPage={fyGrid.currentPage}
              pageSize={fyGrid.pageSize}
              totalPages={fyGrid.totalPages}
              onPageChange={fyGrid.onPageChange}
              onPageSizeChange={fyGrid.onPageSizeChange}
              entityLabel="financial years"
              sortNotice="Sorted newest start date first"
            />
          </div>
        </div>
      )}

      {/* TAB 2: ACCOUNTING PERIODS & POSTING DATE GATE */}
      {activeSubTab === 'periods' && activeFy && (
        <div className="space-y-4">
          {/* Document Date vs Accounting Posting Date Validator */}
          <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-indigo-300 uppercase text-[11px]">
                  Live Accounting Period Posting-Date Validation Gate
                </h4>
                <p className="text-[11px] text-slate-400">
                  Validates distinction between Document Date and Accounting Posting Date across Finance, Procurement, and Inventory. Closed/Locked periods reject unauthorized postings.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTestPostingDate}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer"
              >
                Validate Posting Date
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                  Document Date (e.g. Prior-FY PO Date)
                </label>
                <input
                  type="date"
                  value={testDocDate}
                  onChange={(e) => setTestDocDate(e.target.value)}
                  className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                  Accounting Posting Date (GRN / Invoice / JV)
                </label>
                <input
                  type="date"
                  value={testPostDate}
                  onChange={(e) => setTestPostDate(e.target.value)}
                  className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>
              <div className="flex items-end">
                {postingTestResult && (
                  <div
                    className={`w-full p-2 rounded-lg border text-[11px] font-bold ${
                      postingTestResult.allowed
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                        : 'bg-rose-950/60 border-rose-500 text-rose-300'
                    }`}
                  >
                    {postingTestResult.allowed
                      ? `ALLOWED • ${postingTestResult.financialYearCode} / ${postingTestResult.accountingPeriodCode} (${postingTestResult.accountingPeriodStatus})`
                      : `REJECTED • ${postingTestResult.rejectionReason}`}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-900">
                Accounting Periods for {activeFy.financialYearCode} ({periods.length} Periods)
              </span>
              <span className="text-[11px] text-slate-500">
                Includes Leap-Year date boundary handling & adjustment period control
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5 text-center">#</th>
                    <th className="p-2.5">Period Code</th>
                    <th className="p-2.5">Period Name</th>
                    <th className="p-2.5">Start Date</th>
                    <th className="p-2.5">End Date</th>
                    <th className="p-2.5 text-center">Type</th>
                    <th className="p-2.5 text-center">Status</th>
                    <th className="p-2.5 text-right">Controlled Transitions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {periodGrid.pagedData.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-2.5 text-center font-mono font-bold">{p.periodNumber}</td>
                      <td className="p-2.5 font-mono font-bold text-indigo-700">{p.periodCode}</td>
                      <td className="p-2.5 font-semibold text-slate-800">{p.periodName}</td>
                      <td className="p-2.5 font-mono">{p.startDate}</td>
                      <td className="p-2.5 font-mono">{p.endDate}</td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.isAdjustmentPeriod
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {p.isAdjustmentPeriod ? 'ADJUSTMENT' : 'OPERATIONAL'}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === 'OPEN'
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.status === 'TEMPORARILY_LOCKED'
                              ? 'bg-amber-100 text-amber-800'
                              : p.status === 'CLOSED'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {p.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-2.5 text-right space-x-1">
                        {p.status !== 'OPEN' && activeFy.status !== 'CLOSED' && (
                          <button
                            type="button"
                            onClick={() => handlePeriodAction(p, 'OPEN')}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded font-bold text-[10px] cursor-pointer"
                          >
                            {p.status === 'CLOSED' || p.status === 'TEMPORARILY_LOCKED'
                              ? 'Authorized Reopen'
                              : 'Open Period'}
                          </button>
                        )}
                        {p.status === 'OPEN' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handlePeriodAction(p, 'TEMPORARILY_LOCKED')}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded font-bold text-[10px] cursor-pointer"
                            >
                              Temp Lock
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePeriodAction(p, 'CLOSED')}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded font-bold text-[10px] cursor-pointer"
                            >
                              Close Period
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DataGridFooter
              totalRecords={periodGrid.totalRecords}
              currentPage={periodGrid.currentPage}
              pageSize={periodGrid.pageSize}
              totalPages={periodGrid.totalPages}
              onPageChange={periodGrid.onPageChange}
              onPageSizeChange={periodGrid.onPageSizeChange}
              entityLabel="accounting periods"
              sortNotice="Sorted newest period first"
            />
          </div>
        </div>
      )}

      {/* TAB 3: CENTRALIZED FY NUMBERING SERIES */}
      {activeSubTab === 'numbering' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-900">
                  FY-Integrated Centralized Numbering Series Simulator
                </h4>
                <p className="text-[11px] text-slate-500">
                  Verifies automatic FY reset vs continuous numbering without altering historical numbers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const snap = financialYearService.allocateDocumentNumber({
                    companyId: selectedCompanyId,
                    documentType: testNumDocType,
                    postingDate: testNumPostDate,
                  });
                  setAllocatedPreview(snap);
                  setRefreshTick((t) => t + 1);
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer"
              >
                Allocate Next Number Snapshot
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Document Type</label>
                <select
                  value={testNumDocType}
                  onChange={(e) => setTestNumDocType(e.target.value as NumberingDocumentType)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="PR">Purchase Requisition (PR)</option>
                  <option value="RFQ">Sourcing RFQ</option>
                  <option value="PO">Purchase Order (PO)</option>
                  <option value="GRN">Goods Receipt (GRN)</option>
                  <option value="SUPPLIER_INVOICE">Supplier Invoice</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Transaction Posting Date</label>
                <input
                  type="date"
                  value={testNumPostDate}
                  onChange={(e) => setTestNumPostDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div className="flex items-end">
                {allocatedPreview && (
                  <div className="w-full p-2 bg-indigo-50 border border-indigo-200 rounded-lg font-mono font-bold text-indigo-800">
                    {allocatedPreview.documentNumber} ({allocatedPreview.financialYearCode} • Reset Key:{' '}
                    {allocatedPreview.resetKeyUsed})
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Series Code & Document Type</th>
                    <th className="p-3">Reset Frequency</th>
                    <th className="p-3">Allocation Event</th>
                    <th className="p-3">Active Sequence Counters by FY/Period</th>
                    <th className="p-3 text-center">Version</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {numberingGrid.pagedData.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <div className="font-bold text-indigo-700">{s.seriesCode}</div>
                        <div className="text-[11px] text-slate-500">{s.documentType}</div>
                      </td>
                      <td className="p-3 font-bold text-slate-800">{s.resetFrequency}</td>
                      <td className="p-3">{s.allocationEvent}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-700">
                        {Object.entries(s.currentSequenceByPeriodKey)
                          .map(([k, v]) => `${k}: #${v}`)
                          .join(' | ')}
                      </td>
                      <td className="p-3 text-center font-mono font-bold">v{s.version}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DataGridFooter
              totalRecords={numberingGrid.totalRecords}
              currentPage={numberingGrid.currentPage}
              pageSize={numberingGrid.pageSize}
              totalPages={numberingGrid.totalPages}
              onPageChange={numberingGrid.onPageChange}
              onPageSizeChange={numberingGrid.onPageSizeChange}
              entityLabel="numbering series"
              sortNotice="Sorted newest version & code first"
            />
          </div>
        </div>
      )}

      {/* TAB 4: YEAR-END CLOSING & TRANSITION */}
      {activeSubTab === 'year-end' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
              <span>Controlled 13-Point Year-End Closing & Opening Balance Transition</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Source Financial Year</label>
                <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg font-bold">
                  {activeFy?.financialYearCode || '—'}
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Next Financial Year</label>
                <select
                  value={targetFyId}
                  onChange={(e) => setTargetFyId(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
                >
                  {financialYears
                    .filter((y) => y.id !== activeFy?.id)
                    .map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.financialYearCode} ({y.status})
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={carryFwdAuthorized}
                    onChange={(e) => setCarryFwdAuthorized(e.target.checked)}
                  />
                  <span>Authorize Budget Carry-Forward?</span>
                </label>
                <span className="text-[10px] text-slate-500">
                  Unused budget never auto-carries forward without approval ref.
                </span>
              </div>
              {carryFwdAuthorized && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Amount INR"
                    value={carryFwdAmount}
                    onChange={(e) => setCarryFwdAmount(Number(e.target.value) || 0)}
                    className="p-2 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Approval Ref *"
                    value={carryFwdRef}
                    onChange={(e) => setCarryFwdRef(e.target.value)}
                    className="p-2 border border-indigo-300 rounded-lg font-bold"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleGenerateYearEndChecklist}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer"
              >
                Run 13-Point Pre-Close Validation Checklist
              </button>
            </div>
          </div>

          {yearEndClosings.map((rec) => (
            <div key={rec.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <span className="font-bold text-indigo-700">
                    {rec.sourceFinancialYearCode} → {rec.targetFinancialYearCode}
                  </span>
                  <span className="ml-2 font-mono text-[10px] text-slate-500">
                    Idempotency Key: {rec.idempotencyKey} • Evidence: {rec.auditEvidenceRef}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      rec.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {rec.status}
                  </span>
                  {rec.status === 'PENDING_APPROVAL' && (
                    <button
                      type="button"
                      onClick={() => handleApproveYearEnd(rec)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold cursor-pointer"
                    >
                      CFO Approve & Execute Year-End Close
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {rec.checklistItems.map((item) => (
                  <div
                    key={item.code}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-slate-800 text-[11px]">{item.title}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          item.status === 'PASSED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600">{item.details}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Financial Year Modal */}
      {showCreateFy && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-3 border border-slate-200 shadow-2xl">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              Create New Financial Year ({selectedCompanyId})
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">FY Code *</label>
                <input
                  type="text"
                  value={newFyCode}
                  onChange={(e) => setNewFyCode(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Fiscal Calendar *</label>
                <select
                  value={newCalType}
                  onChange={(e) => setNewCalType(e.target.value as FiscalCalendarType)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="APRIL_MARCH">April – March (Indian FY)</option>
                  <option value="JANUARY_DECEMBER">January – December (Calendar Year)</option>
                  <option value="JULY_JUNE">July – June</option>
                  <option value="CUSTOM">Custom Date Boundaries</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Financial Year Name *</label>
                <input
                  type="text"
                  value={newFyName}
                  onChange={(e) => setNewFyName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Start Date *</label>
                <input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">End Date *</label>
                <input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Period Frequency</label>
                <select
                  value={newFreq}
                  onChange={(e) => setNewFreq(e.target.value as PeriodFrequency)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="MONTHLY">Monthly (12 Periods)</option>
                  <option value="QUARTERLY">Quarterly (4 Periods)</option>
                  <option value="CUSTOM">Custom Single Period</option>
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAdjPeriod}
                    onChange={(e) => setIncludeAdjPeriod(e.target.checked)}
                  />
                  <span>Include Audit Adjustment Period</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateFy(false)}
                className="px-3 py-1.5 bg-slate-100 rounded-lg font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateFy}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-bold cursor-pointer"
              >
                Create Financial Year & Generate Periods
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
