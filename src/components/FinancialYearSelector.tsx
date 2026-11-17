import React, { useMemo, useState } from 'react';
import { Calendar, AlertTriangle, Lock, CheckCircle2, Clock, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { User } from '../types';
import { FinancialYearMaster, FinancialYearDataQualityGap } from '../types/financialYear';
import { financialYearService } from '../services/financialYearService';

export interface FinancialYearSelectorProps {
  companyId?: string;
  selectedFyId: string;
  onSelectFy: (fyId: string) => void;
  currentUser?: User | null;
  dataQualityGaps?: FinancialYearDataQualityGap[];
  entityLabel?: string;
  compact?: boolean;
  className?: string;
}

export const FinancialYearSelector: React.FC<FinancialYearSelectorProps> = ({
  companyId = 'co-kosh-01',
  selectedFyId,
  onSelectFy,
  currentUser,
  dataQualityGaps = [],
  entityLabel = 'Transactions',
  compact = false,
  className = '',
}) => {
  const [showGaps, setShowGaps] = useState(false);

  const financialYears = useMemo<FinancialYearMaster[]>(() => {
    const list = financialYearService.getFinancialYears(companyId === 'ALL' ? 'co-kosh-01' : companyId);
    // Order: ACTIVE first, then CLOSED newest-first, then FUTURE
    return [...list].sort((a, b) => {
      const rank = (s: string) => (s === 'ACTIVE' ? 0 : s === 'CLOSED' ? 1 : 2);
      if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
      return b.startDate.localeCompare(a.startDate);
    });
  }, [companyId]);

  const allAuthorized = useMemo(
    () => financialYearService.isUserAuthorizedForAllFinancialYears(currentUser),
    [currentUser]
  );

  const effectiveFyId = useMemo(() => {
    if (selectedFyId === 'ALL' && allAuthorized) return 'ALL';
    const match = financialYears.find((y) => y.id === selectedFyId || y.financialYearCode === selectedFyId);
    if (match) return match.id;
    return financialYearService.getDefaultFinancialYearForCompany(companyId === 'ALL' ? 'co-kosh-01' : companyId)?.id || '';
  }, [selectedFyId, allAuthorized, financialYears, companyId]);

  const selectedFy = useMemo(
    () => (effectiveFyId === 'ALL' ? null : financialYears.find((y) => y.id === effectiveFyId) || null),
    [effectiveFyId, financialYears]
  );

  const isHistoricalClosed = Boolean(selectedFy && (selectedFy.status === 'CLOSED' || selectedFy.status === 'ARCHIVED'));

  const formatShortDate = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div
        className={`flex flex-wrap items-center gap-2.5 rounded-xl border ${
          isHistoricalClosed
            ? 'border-amber-200 bg-amber-50/70'
            : 'border-slate-200 bg-white'
        } ${compact ? 'px-3 py-2' : 'px-3.5 py-2.5'} shadow-xs`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isHistoricalClosed
                ? 'bg-amber-100 text-amber-700'
                : effectiveFyId === 'ALL'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {isHistoricalClosed ? <Lock className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
          </div>
          <div className="flex flex-col">
            <label
              htmlFor={`fy-selector-${entityLabel.replace(/\s+/g, '-').toLowerCase()}`}
              className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 leading-none mb-1"
            >
              Financial Year
            </label>
            <select
              id={`fy-selector-${entityLabel.replace(/\s+/g, '-').toLowerCase()}`}
              aria-label={`Financial Year selector for ${entityLabel}`}
              value={effectiveFyId}
              onChange={(e) => onSelectFy(e.target.value)}
              className="text-sm font-semibold text-slate-900 bg-transparent border-0 p-0 pr-5 focus:outline-none focus:ring-0 cursor-pointer"
            >
              {financialYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.financialYearCode} ({fy.status === 'CLOSED' ? 'CLOSED • Historical' : fy.status})
                </option>
              ))}
              {allAuthorized && (
                <option value="ALL">All Financial Years (Authorized Global View)</option>
              )}
            </select>
          </div>
        </div>

        {/* Date range display */}
        <div className="hidden sm:flex items-center gap-1.5 pl-2.5 border-l border-slate-200 text-xs text-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-medium">
            {selectedFy
              ? `${formatShortDate(selectedFy.startDate)} – ${formatShortDate(selectedFy.endDate)}`
              : 'All Configured Fiscal Periods'}
          </span>
        </div>

        {/* Status badge */}
        {selectedFy && (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
              selectedFy.status === 'ACTIVE'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : selectedFy.status === 'CLOSED' || selectedFy.status === 'ARCHIVED'
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-sky-100 text-sky-800 border border-sky-200'
            }`}
          >
            {selectedFy.status === 'ACTIVE' ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : selectedFy.status === 'CLOSED' || selectedFy.status === 'ARCHIVED' ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <Info className="w-3.5 h-3.5" />
            )}
            {selectedFy.status === 'CLOSED'
              ? 'CLOSED • Historical Read-Only'
              : selectedFy.status === 'ACTIVE'
              ? 'ACTIVE FY'
              : selectedFy.status}
          </span>
        )}

        {effectiveFyId === 'ALL' && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            Multi-Year Consolidated
          </span>
        )}

        {/* Data-Quality Gaps Warning Button */}
        {dataQualityGaps.length > 0 && (
          <button
            type="button"
            onClick={() => setShowGaps((prev) => !prev)}
            className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
            title="Records missing a valid FY reference or falling outside configured fiscal calendars (shown transparently without fabricating FY data)"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{dataQualityGaps.length} Data-Quality Gap{dataQualityGaps.length > 1 ? 's' : ''}</span>
            {showGaps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Explicit Historical Read-Only Enforcement Banner */}
      {isHistoricalClosed && (
        <div className="flex flex-wrap items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
          <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>
            <strong>Historical Read-Only View ({selectedFy?.financialYearCode}):</strong>{' '}
            Closed accounting periods prohibit editing, cancellation, reversal, or new postings. Original transaction dates, FY references, and configuration snapshots remain preserved.
          </span>
        </div>
      )}

      {/* Expandable Data-Quality Gaps Drawer */}
      {showGaps && dataQualityGaps.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="font-semibold text-rose-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Unassignable Financial Year Records (Data-Quality Audit — No Fabricated Associations)
            </div>
            <button
              type="button"
              onClick={() => setShowGaps(false)}
              className="text-rose-700 hover:text-rose-900 font-medium"
            >
              Close
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-rose-200 text-rose-800">
                  <th className="py-1.5 pr-3 font-semibold">Document #</th>
                  <th className="py-1.5 pr-3 font-semibold">Entity</th>
                  <th className="py-1.5 pr-3 font-semibold">Date Observed</th>
                  <th className="py-1.5 font-semibold">Data-Quality Finding</th>
                </tr>
              </thead>
              <tbody>
                {dataQualityGaps.map((gap) => (
                  <tr key={`${gap.entityType}-${gap.recordId}`} className="border-b border-rose-100 last:border-0 text-rose-900">
                    <td className="py-1.5 pr-3 font-mono font-semibold">{gap.documentNumber}</td>
                    <td className="py-1.5 pr-3">{gap.entityType}</td>
                    <td className="py-1.5 pr-3 font-mono">{gap.dateAttempted || 'MISSING'}</td>
                    <td className="py-1.5">{gap.gapReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
export default FinancialYearSelector;
