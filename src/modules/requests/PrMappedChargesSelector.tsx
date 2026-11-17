import React, { useMemo, useState } from 'react';
import { Search, Plus, CheckCircle2, AlertTriangle, Lock, Layers } from 'lucide-react';
import { EffectiveMappedChargeOption } from '../../types/chargeManagement';
import { PRChargeItem } from '../../types/purchaseRequisition';
import { formatChargeAmount } from '../../services/prChargeItemService';

interface PrMappedChargesSelectorProps {
  effectiveOptions: EffectiveMappedChargeOption[];
  selectedChargeItems: PRChargeItem[];
  companyName: string;
  branchName: string;
  onAddChargeOption: (option: EffectiveMappedChargeOption) => void;
  onAddMultipleOptions: (options: EffectiveMappedChargeOption[]) => void;
  errorNotice?: string | null;
  onDismissError?: () => void;
}

export const PrMappedChargesSelector: React.FC<PrMappedChargesSelectorProps> = ({
  effectiveOptions,
  selectedChargeItems,
  companyName,
  branchName,
  onAddChargeOption,
  onAddMultipleOptions,
  errorNotice,
  onDismissError,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [applicabilityFilter, setApplicabilityFilter] = useState<string>('ALL');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const addedCodes = useMemo(() => {
    const s = new Set<string>();
    for (const ci of selectedChargeItems) {
      if (ci.chargeCode) s.add(ci.chargeCode.toUpperCase());
      if (ci.chargeMasterId) s.add(ci.chargeMasterId);
    }
    return s;
  }, [selectedChargeItems]);

  const isAlreadyAdded = (opt: EffectiveMappedChargeOption): boolean =>
    addedCodes.has(opt.chargeCode.toUpperCase()) || addedCodes.has(opt.chargeMasterId);

  const filteredOptions = useMemo(() => {
    return effectiveOptions.filter((opt) => {
      if (applicabilityFilter !== 'ALL' && opt.applicability !== applicabilityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          opt.chargeCode.toLowerCase().includes(q) ||
          opt.chargeName.toLowerCase().includes(q) ||
          opt.chargeCategory.toLowerCase().includes(q) ||
          opt.calculationMethod.toLowerCase().includes(q) ||
          (opt.chargeDescription || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [effectiveOptions, applicabilityFilter, searchQuery]);

  const toggleCheck = (optId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(optId)) next.delete(optId);
      else next.add(optId);
      return next;
    });
  };

  const selectedOptionsToAdd = useMemo(
    () => filteredOptions.filter((opt) => checkedIds.has(opt.chargeMasterId) && !isAlreadyAdded(opt)),
    [filteredOptions, checkedIds, addedCodes]
  );

  const handleBulkAdd = () => {
    if (selectedOptionsToAdd.length === 0) return;
    onAddMultipleOptions(selectedOptionsToAdd);
    setCheckedIds(new Set());
  };

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Mapped Charges Catalog ({companyName} / {branchName})</span>
          </h5>
          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
            <Lock className="w-3 h-3 text-slate-400 shrink-0" />
            <span>
              Only active charges mapped to this Company &amp; Branch are selectable. Free-text custom charge creation is restricted to Charge Master Administrators.
            </span>
          </p>
        </div>

        <button
          type="button"
          disabled={selectedOptionsToAdd.length === 0}
          onClick={handleBulkAdd}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Selected ({selectedOptionsToAdd.length})</span>
        </button>
      </div>

      {errorNotice && (
        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 text-[11px] font-bold flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorNotice}</span>
          </div>
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              className="px-1.5 text-rose-600 hover:text-rose-900 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            aria-label="Search effective mapped charges"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search mapped charges by code, name, category, or method..."
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
          />
        </div>
        <select
          aria-label="Filter mapped charges by applicability"
          value={applicabilityFilter}
          onChange={(e) => setApplicabilityFilter(e.target.value)}
          className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
        >
          <option value="ALL">All Applicability ({effectiveOptions.length})</option>
          <option value="MANDATORY">Mandatory</option>
          <option value="OPTIONAL">Optional</option>
          <option value="CONDITIONAL">Conditional</option>
        </select>
      </div>

      {/* Searchable Selection Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto max-h-52">
          <table className="w-full text-left text-[11px] border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                <th className="p-2 w-9 text-center">Sel</th>
                <th className="p-2">Charge Code &amp; Name</th>
                <th className="p-2">Category</th>
                <th className="p-2">Method &amp; Effective Tariff</th>
                <th className="p-2">Tax &amp; Allocation</th>
                <th className="p-2">Applicability</th>
                <th className="p-2">Scope</th>
                <th className="p-2 text-center w-28">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredOptions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-slate-500">
                    No active mapped charges match your search for {companyName} / {branchName}.
                  </td>
                </tr>
              ) : (
                filteredOptions.map((opt) => {
                  const added = isAlreadyAdded(opt);
                  const checked = checkedIds.has(opt.chargeMasterId);
                  return (
                    <tr
                      key={opt.chargeMasterId}
                      className={added ? 'bg-emerald-50/40 text-slate-500' : 'hover:bg-slate-50'}
                    >
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Select charge ${opt.chargeCode}`}
                          disabled={added}
                          checked={added || checked}
                          onChange={() => toggleCheck(opt.chargeMasterId)}
                          className="rounded border-slate-300 text-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="p-2">
                        <div className="font-bold text-slate-900">{opt.chargeName}</div>
                        <div className="font-mono text-[10px] text-indigo-700">{opt.chargeCode}</div>
                      </td>
                      <td className="p-2 font-semibold text-slate-700">
                        {opt.chargeCategory.replace(/_/g, ' ')}
                      </td>
                      <td className="p-2 font-mono">
                        <div className="font-bold text-slate-900">
                          {opt.calculationMethod === 'PERCENTAGE'
                            ? `${opt.rate}%`
                            : formatChargeAmount(opt.rate, opt.currency)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans">
                          {opt.calculationMethod.replace(/_/g, ' ')}
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="text-slate-800">{opt.taxTreatment.replace(/_/g, ' ')}</div>
                        <div className="text-[10px] text-slate-500">
                          {opt.allocationBasis.replace(/_/g, ' ')}
                        </div>
                      </td>
                      <td className="p-2 font-bold">
                        <span
                          className={
                            opt.applicability === 'MANDATORY'
                              ? 'text-rose-700'
                              : opt.applicability === 'CONDITIONAL'
                              ? 'text-amber-700'
                              : 'text-slate-700'
                          }
                        >
                          {opt.applicability}
                        </span>
                      </td>
                      <td className="p-2 text-[10px] font-medium text-slate-600">
                        {opt.sourceScope === 'BRANCH_OVERRIDE' ? 'Branch Override' : 'Company Policy'}
                      </td>
                      <td className="p-2 text-center">
                        {added ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[10px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Added
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onAddChargeOption(opt)}
                            aria-label={`Add mapped charge ${opt.chargeCode}`}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[11px] cursor-pointer"
                          >
                            Add Charge
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
