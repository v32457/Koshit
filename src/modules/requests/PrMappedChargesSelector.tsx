import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, CheckCircle2, AlertTriangle, Lock, Layers, ChevronDown } from 'lucide-react';
import { EffectiveMappedChargeOption } from '../../types/chargeManagement';
import { PRChargeItem } from '../../types/purchaseRequisition';
import { formatChargeAmount, getCurrencySymbol } from '../../services/prChargeItemService';

interface PrMappedChargesSelectorProps {
  effectiveOptions: EffectiveMappedChargeOption[];
  selectedChargeItems: PRChargeItem[];
  companyName: string;
  branchName: string;
  currency?: string;
  referenceSubtotal?: number;
  title?: string;
  onAddChargeOption: (option: EffectiveMappedChargeOption, customAmount?: number) => void;
  onAddMultipleOptions?: (options: EffectiveMappedChargeOption[]) => void;
  errorNotice?: string | null;
  onDismissError?: () => void;
}

export const PrMappedChargesSelector: React.FC<PrMappedChargesSelectorProps> = ({
  effectiveOptions,
  selectedChargeItems,
  companyName,
  branchName,
  currency = 'INR',
  referenceSubtotal = 0,
  title = 'Select & Add Charge Item',
  onAddChargeOption,
  errorNotice,
  onDismissError,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChargeId, setSelectedChargeId] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

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

  const selectedOption = useMemo(
    () => effectiveOptions.find((o) => o.chargeMasterId === selectedChargeId) || null,
    [effectiveOptions, selectedChargeId]
  );

  // Clear selection if selected option disappears on company/branch change
  useEffect(() => {
    if (selectedChargeId && !selectedOption) {
      setSelectedChargeId('');
      setAmountInput('');
    }
  }, [selectedChargeId, selectedOption]);

  const computeDefaultAmount = (opt: EffectiveMappedChargeOption): number => {
    if (opt.calculationMethod === 'PERCENTAGE') {
      return Math.round(((referenceSubtotal || 0) * Number(opt.rate || 0)) / 100);
    }
    return Number(opt.rate || 0);
  };

  const filteredOptions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return effectiveOptions;
    return effectiveOptions.filter(
      (opt) =>
        opt.chargeCode.toLowerCase().includes(q) ||
        opt.chargeName.toLowerCase().includes(q) ||
        opt.chargeCategory.toLowerCase().includes(q) ||
        opt.calculationMethod.toLowerCase().includes(q)
    );
  }, [effectiveOptions, searchQuery]);

  const handleSelectOption = (opt: EffectiveMappedChargeOption) => {
    setSelectedChargeId(opt.chargeMasterId);
    setAmountInput(String(computeDefaultAmount(opt)));
    setLocalError(null);
    if (onDismissError) onDismissError();
    setDropdownOpen(false);
  };

  const handleAddClick = () => {
    if (!selectedOption) {
      setLocalError('Please select a charge item first.');
      return;
    }
    if (isAlreadyAdded(selectedOption)) {
      setLocalError(`${selectedOption.chargeName} (${selectedOption.chargeCode}) is already added.`);
      return;
    }
    const parsedAmount = Number(amountInput);
    if (amountInput.trim() === '' || Number.isNaN(parsedAmount) || parsedAmount < 0) {
      setLocalError('Please enter a valid non-negative charge amount.');
      return;
    }
    setLocalError(null);
    onAddChargeOption(selectedOption, parsedAmount);
    setSelectedChargeId('');
    setAmountInput('');
    setSearchQuery('');
  };

  const displayError = errorNotice || localError;
  const availableCount = effectiveOptions.filter((o) => !isAlreadyAdded(o)).length;

  return (
    <div
      ref={containerRef}
      className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3.5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>
              {title} ({companyName} / {branchName})
            </span>
          </h5>
          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
            <Lock className="w-3 h-3 text-slate-400 shrink-0" />
            <span>
              Select an active charge mapped to this Company &amp; Branch, enter its amount, and add it.
            </span>
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white border border-indigo-200 text-indigo-700">
          {availableCount} Available to Add
        </span>
      </div>

      {displayError && (
        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 text-[11px] font-bold flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{displayError}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss charge error"
            onClick={() => {
              setLocalError(null);
              if (onDismissError) onDismissError();
            }}
            className="px-1.5 text-rose-600 hover:text-rose-900 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Select Charge Item + Amount Input + Add Button */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
        {/* Searchable Charge Item Select */}
        <div className="md:col-span-6 relative">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Charge Item *
          </label>
          <button
            type="button"
            aria-label="Select Charge Item"
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="w-full px-3 py-2 bg-white border border-slate-300 hover:border-indigo-400 rounded-lg text-xs flex items-center justify-between gap-2 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {selectedOption ? (
              <span className="truncate font-semibold text-slate-900">
                <span className="font-mono text-indigo-700 mr-1.5">{selectedOption.chargeCode}</span>
                {selectedOption.chargeName}
              </span>
            ) : (
              <span className="text-slate-400 truncate">
                Select mapped charge item ({effectiveOptions.length} configured)...
              </span>
            )}
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {dropdownOpen && (
            <div
              role="listbox"
              aria-label="Company and Branch Charge Options"
              className="absolute left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
            >
              <div className="p-2 border-b border-slate-100 bg-slate-50">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    aria-label="Search mapped charge options"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search charge by code or name..."
                    autoFocus
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                {filteredOptions.length === 0 ? (
                  <div className="p-3 text-center text-[11px] text-slate-500">
                    No active mapped charges match "{searchQuery}".
                  </div>
                ) : (
                  filteredOptions.map((opt) => {
                    const added = isAlreadyAdded(opt);
                    const isSelected = opt.chargeMasterId === selectedChargeId;
                    return (
                      <button
                        key={opt.chargeMasterId}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={added}
                        onClick={() => handleSelectOption(opt)}
                        className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 transition ${
                          added
                            ? 'bg-emerald-50/40 text-slate-400 cursor-not-allowed'
                            : isSelected
                            ? 'bg-indigo-50 text-indigo-900'
                            : 'hover:bg-slate-50 text-slate-800 cursor-pointer'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold truncate">
                            {opt.chargeName}
                          </div>
                          <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-indigo-700">{opt.chargeCode}</span>
                            <span>·</span>
                            <span>{opt.chargeCategory.replace(/_/g, ' ')}</span>
                            <span>·</span>
                            <span>{opt.calculationMethod.replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {added ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[10px]">
                              <CheckCircle2 className="w-3 h-3" />
                              Added
                            </span>
                          ) : (
                            <div className="font-mono font-bold text-[11px] text-slate-700">
                              {opt.calculationMethod === 'PERCENTAGE'
                                ? `${opt.rate}%`
                                : formatChargeAmount(opt.rate, opt.currency)}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {selectedOption && (
            <div className="text-[10px] text-slate-600 mt-1 flex flex-wrap items-center gap-1.5">
              <span>
                Default:{' '}
                <strong className="font-mono">
                  {selectedOption.calculationMethod === 'PERCENTAGE'
                    ? `${selectedOption.rate}% (${formatChargeAmount(computeDefaultAmount(selectedOption), currency)})`
                    : formatChargeAmount(selectedOption.rate, selectedOption.currency)}
                </strong>
              </span>
              <span>·</span>
              <span>GST {selectedOption.taxRatePercent ?? 0}%</span>
              <span>·</span>
              <span className="font-semibold text-indigo-700">
                {selectedOption.sourceScope === 'BRANCH_OVERRIDE' ? 'Branch Override' : 'Company Policy'}
              </span>
            </div>
          )}
        </div>

        {/* Amount Input */}
        <div className="md:col-span-3">
          <label
            htmlFor="pr-charge-amount-input"
            className="block text-[11px] font-bold text-slate-700 mb-1"
          >
            Amount ({getCurrencySymbol(currency).trim()}) *
          </label>
          <input
            id="pr-charge-amount-input"
            type="number"
            min="0"
            step="any"
            aria-label="Charge Amount"
            disabled={!selectedOption}
            value={amountInput}
            onChange={(e) => {
              setAmountInput(e.target.value);
              setLocalError(null);
            }}
            placeholder={selectedOption ? 'Enter amount...' : 'Select charge first'}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-right text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Add Button */}
        <div className="md:col-span-3 md:pt-5">
          <button
            type="button"
            disabled={!selectedOption}
            onClick={handleAddClick}
            className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Charge Item</span>
          </button>
        </div>
      </div>
    </div>
  );
};
