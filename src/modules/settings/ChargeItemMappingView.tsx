import React, { useMemo, useState } from 'react';
import {
  Building2,
  MapPin,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Edit,
  RotateCcw,
  History,
  X,
  ShieldCheck,
  Coins,
} from 'lucide-react';
import { Branch, Company, User } from '../../types';
import { INITIAL_BRANCHES, INITIAL_COMPANIES } from '../../data/seedData';
import {
  CentrallyControlledChargeField,
  ChargeAllocationMethod,
  ChargeApplicabilityStatus,
  ChargeCalculationMethod,
  EffectiveMappedChargeOption,
} from '../../types/chargeManagement';
import { chargeMappingService } from '../../services/chargeMappingService';
import { chargeMasterService } from '../../services/chargeMasterService';
import { normalizeCompanyId } from '../../services/prGovernancePolicyService';
import { rbacPermissionService } from '../../services/rbacPermissionService';

interface ChargeItemMappingViewProps {
  currentUser?: User;
  companies?: Company[];
  branches?: Branch[];
  initialCompanyId?: string;
  initialBranchId?: string;
  embeddedInPrConfig?: boolean;
}

const CENTRAL_FIELD_LABELS: Array<{ key: CentrallyControlledChargeField; label: string }> = [
  { key: 'isEnabled', label: 'Enabled / Disabled' },
  { key: 'applicability', label: 'Applicability (Mandatory / Optional)' },
  { key: 'defaultCalculationMethod', label: 'Calculation Method' },
  { key: 'fixedTariffOrRate', label: 'Fixed Tariff / Rate' },
  { key: 'currency', label: 'Currency' },
  { key: 'taxTreatment', label: 'Tax Treatment' },
  { key: 'allocationBasis', label: 'Allocation Basis' },
  { key: 'requiresApproval', label: 'Approval Requirement' },
  { key: 'effectiveDates', label: 'Effective Dates' },
];

const CALC_METHODS: ChargeCalculationMethod[] = [
  'FIXED_AMOUNT',
  'PERCENTAGE',
  'PER_UNIT',
  'PER_KG',
  'PER_MT',
  'PER_VOLUME',
  'PER_KM',
  'PER_SHIPMENT',
  'PER_TRIP',
  'PER_DAY',
  'ACTUAL_COST',
  'FORMULA_BASED',
];

const ALLOC_BASES: ChargeAllocationMethod[] = [
  'PROPORTIONAL_VALUE',
  'PROPORTIONAL_QUANTITY',
  'EQUAL_DISTRIBUTION',
  'PROPORTIONAL_WEIGHT',
  'PROPORTIONAL_VOLUME',
  'DIRECT_LINE_ALLOCATION',
  'MANUAL_ALLOCATION',
];

export const ChargeItemMappingView: React.FC<ChargeItemMappingViewProps> = ({
  currentUser,
  companies: propCompanies,
  branches: propBranches,
  initialCompanyId,
  initialBranchId,
  embeddedInPrConfig = false,
}) => {
  const companies = useMemo(() => {
    if (propCompanies && propCompanies.length > 0) return propCompanies.filter((c) => c.isEnabled);
    try {
      const raw = localStorage.getItem('kosh_companies');
      const parsed = raw ? (JSON.parse(raw) as Company[]) : INITIAL_COMPANIES;
      return parsed.filter((c) => c.isEnabled);
    } catch {
      return INITIAL_COMPANIES.filter((c) => c.isEnabled);
    }
  }, [propCompanies]);

  const branches = useMemo(() => {
    if (propBranches && propBranches.length > 0) return propBranches;
    try {
      const raw = localStorage.getItem('kosh_branches');
      return raw ? (JSON.parse(raw) as Branch[]) : INITIAL_BRANCHES;
    } catch {
      return INITIAL_BRANCHES;
    }
  }, [propBranches]);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    initialCompanyId || companies[0]?.id || 'co-kosh-01'
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPrEligibleOnly, setShowPrEligibleOnly] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'MAPPINGS' | 'HISTORY'>('MAPPINGS');

  const [versionTick, setVersionTick] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Modal State
  const [editingOption, setEditingOption] = useState<EffectiveMappedChargeOption | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [formEnabled, setFormEnabled] = useState(true);
  const [formApplicability, setFormApplicability] = useState<ChargeApplicabilityStatus>('OPTIONAL');
  const [formCalcMethod, setFormCalcMethod] = useState<ChargeCalculationMethod>('FIXED_AMOUNT');
  const [formRate, setFormRate] = useState<number>(0);
  const [formCurrency, setFormCurrency] = useState('INR');
  const [formTaxId, setFormTaxId] = useState('tax-dom-gst-18');
  const [formAllocBasis, setFormAllocBasis] = useState<ChargeAllocationMethod>('PROPORTIONAL_VALUE');
  const [formEffFrom, setFormEffFrom] = useState('2025-04-01');
  const [formEffTo, setFormEffTo] = useState('');
  const [formAllowBranchOverride, setFormAllowBranchOverride] = useState(true);
  const [formRequiresApproval, setFormRequiresApproval] = useState(false);
  const [formCentralFields, setFormCentralFields] = useState<CentrallyControlledChargeField[]>([]);
  const [formRemarks, setFormRemarks] = useState('');

  const taxMappings = useMemo(() => chargeMasterService.getTaxMappings(), []);

  const canManage = useMemo(() => {
    if (!currentUser) return true;
    return (
      currentUser.role === 'PLATFORM_ADMIN' ||
      currentUser.role === 'ORG_ADMIN' ||
      rbacPermissionService.hasPermission(currentUser, 'CHARGE_MASTER_MANAGE')
    );
  }, [currentUser]);

  const actor = {
    id: currentUser?.id || 'usr-admin',
    name: currentUser?.fullName || 'Platform Administrator',
    user: currentUser,
  };

  const companyBranches = useMemo(() => {
    const normCo = normalizeCompanyId(selectedCompanyId);
    return branches.filter(
      (b) => normalizeCompanyId(b.companyId) === normCo && b.lifecycleStatus !== 'INACTIVE'
    );
  }, [branches, selectedCompanyId]);

  const effectiveOptions = useMemo(() => {
    void versionTick;
    const list = chargeMappingService.resolveEffectiveMappingsForScope(
      selectedCompanyId,
      selectedBranchId
    );
    const q = searchQuery.trim().toLowerCase();
    return list.filter((opt) => {
      if (showPrEligibleOnly) {
        const prOk =
          opt.isActiveInMaster &&
          opt.isEnabled &&
          opt.isEffectiveNow &&
          opt.applicability !== 'NOT_APPLICABLE' &&
          (opt.permittedApplicationLevels.includes('PR_HEADER') ||
            opt.permittedApplicationLevels.includes('PR_LINE'));
        if (!prOk) return false;
      }
      if (!q) return true;
      return (
        opt.chargeCode.toLowerCase().includes(q) ||
        opt.chargeName.toLowerCase().includes(q) ||
        opt.chargeCategory.toLowerCase().includes(q)
      );
    });
  }, [selectedCompanyId, selectedBranchId, searchQuery, showPrEligibleOnly, versionTick]);

  const mappingHistory = useMemo(() => {
    void versionTick;
    return chargeMappingService.getMappingHistory(selectedCompanyId);
  }, [selectedCompanyId, versionTick]);

  const openMappingModal = (opt: EffectiveMappedChargeOption) => {
    setEditError(null);
    setEditingOption(opt);
    setFormEnabled(opt.isEnabled);
    setFormApplicability(opt.applicability);
    setFormCalcMethod(opt.calculationMethod);
    setFormRate(opt.rate);
    setFormCurrency(opt.currency);
    setFormTaxId(opt.taxMappingId);
    setFormAllocBasis(opt.allocationBasis);
    setFormEffFrom(opt.effectiveFrom);
    setFormEffTo(opt.effectiveTo || '');
    setFormAllowBranchOverride(opt.allowBranchOverride);
    setFormRequiresApproval(opt.requiresApproval);
    setFormCentralFields([...opt.centrallyControlledFields]);
    setFormRemarks(opt.remarks || '');
  };

  const isFieldCentrallyLockedInBranchMode = (field: CentrallyControlledChargeField): boolean => {
    if (selectedBranchId === 'ALL' || !editingOption) return false;
    return !editingOption.allowBranchOverride || editingOption.centrallyControlledFields.includes(field);
  };

  const toggleCentralField = (field: CentrallyControlledChargeField) => {
    setFormCentralFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const handleSaveMapping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOption) return;
    setEditError(null);

    const taxObj = taxMappings.find((t) => t.id === formTaxId) || taxMappings[0];
    try {
      if (selectedBranchId === 'ALL') {
        const saved = chargeMappingService.saveCompanyChargeMapping(
          {
            companyId: selectedCompanyId,
            branchId: 'ALL',
            chargeMasterId: editingOption.chargeMasterId,
            isEnabled: formEnabled,
            applicability: formApplicability,
            defaultCalculationMethod: formCalcMethod,
            fixedTariffOrRate: Number(formRate) || 0,
            currency: formCurrency,
            taxMappingId: taxObj.id,
            taxTreatment: taxObj.treatmentType,
            taxRatePercent: taxObj.ratePercent,
            allocationBasis: formAllocBasis,
            effectiveFrom: formEffFrom,
            effectiveTo: formEffTo || undefined,
            allowBranchOverride: formAllowBranchOverride,
            centrallyControlledFields: formCentralFields,
            requiresApproval: formRequiresApproval,
            remarks: formRemarks,
          },
          actor
        );
        setFeedback({
          type: 'success',
          text: `Saved Company Charge Mapping for ${saved.chargeCode} (v${saved.versionNumber}). Branches without overrides inherit this rule automatically.`,
        });
      } else {
        const saved = chargeMappingService.saveBranchChargeOverride(
          {
            companyId: selectedCompanyId,
            branchId: selectedBranchId,
            chargeMasterId: editingOption.chargeMasterId,
            isEnabled: formEnabled,
            applicability: formApplicability,
            defaultCalculationMethod: formCalcMethod,
            fixedTariffOrRate: Number(formRate) || 0,
            currency: formCurrency,
            taxMappingId: taxObj.id,
            taxTreatment: taxObj.treatmentType,
            taxRatePercent: taxObj.ratePercent,
            allocationBasis: formAllocBasis,
            effectiveFrom: formEffFrom,
            effectiveTo: formEffTo || undefined,
            requiresApproval: formRequiresApproval,
            remarks: formRemarks,
          },
          actor
        );
        setFeedback({
          type: 'success',
          text: `Saved Branch Override for ${saved.chargeCode} on ${saved.branchName} (v${saved.versionNumber}).`,
        });
      }
      setVersionTick((v) => v + 1);
      setEditingOption(null);
    } catch (err: any) {
      setEditError(err?.message || 'Unable to save mapping.');
    }
  };

  const handleRevertBranchOverride = (opt: EffectiveMappedChargeOption) => {
    try {
      const ok = chargeMappingService.revertBranchChargeOverride(
        selectedCompanyId,
        selectedBranchId,
        opt.chargeMasterId,
        actor
      );
      if (ok) {
        setVersionTick((v) => v + 1);
        setFeedback({
          type: 'success',
          text: `Reverted Branch Override for ${opt.chargeCode}. Branch now inherits authoritative Company mapping.`,
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Revert failed.' });
    }
  };

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const selectedBranch = companyBranches.find((b) => b.id === selectedBranchId);

  return (
    <div className="space-y-4 text-xs">
      {/* Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-extrabold tracking-tight">
                {embeddedInPrConfig
                  ? 'Purchase Requisition → Charge Item Mapping'
                  : 'General Settings → Purchase Requisition → Charge Item Mapping'}
              </h2>
            </div>
            <p className="text-slate-300 text-xs mt-1">
              Map centralized Charge Master records to Companies and Branches. Company rules are authoritative defaults; branches inherit automatically unless an authorized override is permitted.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('MAPPINGS')}
              className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                activeSubTab === 'MAPPINGS' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              Effective Charge Mappings
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('HISTORY')}
              className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'HISTORY' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Version History ({mappingHistory.length})</span>
            </button>
          </div>
        </div>

        {/* Company & Branch Scope Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="font-bold text-slate-300 whitespace-nowrap">Company (Authoritative):</span>
            <select
              aria-label="Mapping Company Scope"
              value={selectedCompanyId}
              onChange={(e) => {
                setSelectedCompanyId(e.target.value);
                setSelectedBranchId('ALL');
              }}
              className="bg-transparent font-extrabold text-white flex-1 focus:outline-hidden cursor-pointer"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-bold text-slate-300 whitespace-nowrap">Branch Scope:</span>
            <select
              aria-label="Mapping Branch Scope"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent font-extrabold text-amber-300 flex-1 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-white">
                All Branches (Company Default Mapping)
              </option>
              {companyBranches.map((b) => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                  [{b.portalBranchCode}] {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Historical PR Immutability Guarantee Banner */}
      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            Viewing Scope: <strong>{selectedCompany?.name}</strong> →{' '}
            <strong>{selectedBranchId === 'ALL' ? 'Company Authoritative Default' : selectedBranch?.name}</strong>.
            Mapping edits apply only to future PRs — submitted & approved historical PR charge snapshots are never altered.
          </span>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl border font-bold flex items-center justify-between gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeSubTab === 'MAPPINGS' ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search mapped Charge Master items..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showPrEligibleOnly}
                onChange={(e) => setShowPrEligibleOnly(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              <span>Show Active PR-Selectable Only</span>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1140px]">
              <thead>
                <tr className="bg-[#0B192C] text-white font-bold text-[11px]">
                  <th className="p-3 border-r border-slate-800">Charge Master Record</th>
                  <th className="p-3 border-r border-slate-800">Mapping Source</th>
                  <th className="p-3 border-r border-slate-800">Status & Applicability</th>
                  <th className="p-3 border-r border-slate-800">Calculation & Tariff</th>
                  <th className="p-3 border-r border-slate-800">Tax & Allocation</th>
                  <th className="p-3 border-r border-slate-800">Governance & Locks</th>
                  <th className="p-3 border-r border-slate-800">Effective Window</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {effectiveOptions.map((opt) => (
                  <tr
                    key={opt.chargeMasterId}
                    className={`hover:bg-slate-50 ${!opt.isEffectiveNow ? 'bg-slate-50/70 opacity-75' : ''}`}
                  >
                    <td className="p-3 border-r border-slate-200 align-top">
                      <div className="font-mono font-extrabold text-indigo-900">{opt.chargeCode}</div>
                      <div className="font-bold text-slate-900">{opt.chargeName}</div>
                      <div className="text-[10px] text-slate-500">
                        Master v{opt.chargeMasterVersion} · {opt.chargeCategory.replace(/_/g, ' ')}
                      </div>
                    </td>
                    <td className="p-3 border-r border-slate-200 align-top">
                      <div className="font-bold text-slate-800">
                        {opt.sourceScope === 'BRANCH_OVERRIDE'
                          ? 'Branch Override'
                          : opt.sourceScope === 'COMPANY_INHERITED'
                          ? 'Company Authoritative'
                          : 'Master Default'}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">Mapping v{opt.mappingVersion}</div>
                    </td>
                    <td className="p-3 border-r border-slate-200 align-top">
                      <div className={`font-bold ${opt.isEnabled && opt.isActiveInMaster ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {!opt.isActiveInMaster
                          ? 'MASTER INACTIVE'
                          : opt.isEnabled
                          ? 'ENABLED'
                          : 'DISABLED'}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-700 mt-0.5">
                        {opt.applicability.replace(/_/g, ' ')}
                      </div>
                    </td>
                    <td className="p-3 border-r border-slate-200 align-top">
                      <div className="font-semibold text-slate-800">
                        {opt.calculationMethod.replace(/_/g, ' ')}
                      </div>
                      <div className="font-mono font-extrabold text-indigo-700 mt-0.5">
                        {opt.calculationMethod === 'PERCENTAGE'
                          ? `${opt.rate}%`
                          : `${opt.currency} ${Number(opt.rate).toLocaleString('en-IN')}`}
                      </div>
                    </td>
                    <td className="p-3 border-r border-slate-200 align-top">
                      <div className="font-semibold text-slate-800">
                        {opt.taxTreatment.replace(/_/g, ' ')} ({opt.taxRatePercent}%)
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {opt.allocationBasis.replace(/_/g, ' ')}
                      </div>
                    </td>
                    <td className="p-3 border-r border-slate-200 align-top">
                      <div className="flex items-center gap-1 font-semibold text-slate-800">
                        {!opt.allowBranchOverride && <Lock className="w-3 h-3 text-amber-600" />}
                        <span>
                          Branch Override: {opt.allowBranchOverride ? 'Allowed' : 'Locked by Company'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Approval: {opt.requiresApproval ? 'Required' : 'Auto'} · Central Locks:{' '}
                        {opt.centrallyControlledFields.length}
                      </div>
                    </td>
                    <td className="p-3 border-r border-slate-200 align-top font-mono text-[11px]">
                      <div>{opt.effectiveFrom}</div>
                      <div className="text-slate-500">{opt.effectiveTo || 'Open'}</div>
                    </td>
                    <td className="p-3 align-top text-center">
                      {canManage ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openMappingModal(opt)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded border border-indigo-200 cursor-pointer flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" />
                            <span>{selectedBranchId === 'ALL' ? 'Configure' : 'Override'}</span>
                          </button>
                          {selectedBranchId !== 'ALL' && opt.isBranchOverride && (
                            <button
                              type="button"
                              onClick={() => handleRevertBranchOverride(opt)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded border border-amber-200 cursor-pointer flex items-center gap-1"
                              title="Revert to Company Mapping"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Revert</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">Read Only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-800">
            Immutable Company & Branch Charge Mapping Version History
          </div>
          {mappingHistory.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              No mapping modifications recorded in this session yet. Edit a Company or Branch mapping to record a versioned snapshot.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {mappingHistory.map((h) => (
                <div key={h.id} className="p-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900">
                      <span className="font-mono text-indigo-800">{h.chargeCode}</span> — {h.action.replace(/_/g, ' ')} (v{h.versionNumber})
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Scope: {h.branchId === 'ALL' ? 'Company Default' : h.branchId} · {h.reason}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500 font-mono">
                    <div>{h.changedByName}</div>
                    <div>{new Date(h.changedAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Configure Mapping / Branch Override Modal */}
      {editingOption && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-[#0B192C] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm">
                  {selectedBranchId === 'ALL'
                    ? `Company Mapping — ${editingOption.chargeCode}`
                    : `Branch Override (${selectedBranch?.portalBranchCode}) — ${editingOption.chargeCode}`}
                </h3>
                <div className="text-[11px] text-slate-300">{editingOption.chargeName}</div>
              </div>
              <button type="button" onClick={() => setEditingOption(null)} className="text-slate-300 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMapping} className="p-5 overflow-y-auto space-y-4">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded-lg font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {selectedBranchId !== 'ALL' && !editingOption.allowBranchOverride && (
                <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg font-bold flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Company policy disables branch overrides for this charge. Any save attempt will be rejected.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isFieldCentrallyLockedInBranchMode('isEnabled')}
                    checked={formEnabled}
                    onChange={(e) => setFormEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <span>Mapping Enabled for Company / Branch</span>
                  {isFieldCentrallyLockedInBranchMode('isEnabled') && <Lock className="w-3.5 h-3.5 text-amber-600 ml-auto" />}
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isFieldCentrallyLockedInBranchMode('requiresApproval')}
                    checked={formRequiresApproval}
                    onChange={(e) => setFormRequiresApproval(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <span>Requires Approval on PR</span>
                  {isFieldCentrallyLockedInBranchMode('requiresApproval') && <Lock className="w-3.5 h-3.5 text-amber-600 ml-auto" />}
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                    <span>Applicability</span>
                    {isFieldCentrallyLockedInBranchMode('applicability') && <Lock className="w-3 h-3 text-amber-600" />}
                  </label>
                  <select
                    disabled={isFieldCentrallyLockedInBranchMode('applicability')}
                    value={formApplicability}
                    onChange={(e) => setFormApplicability(e.target.value as ChargeApplicabilityStatus)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold disabled:bg-slate-100"
                  >
                    <option value="MANDATORY">Mandatory</option>
                    <option value="OPTIONAL">Optional</option>
                    <option value="CONDITIONAL">Conditional</option>
                    <option value="NOT_APPLICABLE">Not Applicable</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                    <span>Calculation Method</span>
                    {isFieldCentrallyLockedInBranchMode('defaultCalculationMethod') && <Lock className="w-3 h-3 text-amber-600" />}
                  </label>
                  <select
                    disabled={isFieldCentrallyLockedInBranchMode('defaultCalculationMethod')}
                    value={formCalcMethod}
                    onChange={(e) => setFormCalcMethod(e.target.value as ChargeCalculationMethod)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold disabled:bg-slate-100"
                  >
                    {CALC_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                    <span>Fixed Tariff / Rate</span>
                    {isFieldCentrallyLockedInBranchMode('fixedTariffOrRate') && <Lock className="w-3 h-3 text-amber-600" />}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={isFieldCentrallyLockedInBranchMode('fixedTariffOrRate')}
                    value={formRate}
                    onChange={(e) => setFormRate(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-right disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                    <span>Currency</span>
                    {isFieldCentrallyLockedInBranchMode('currency') && <Lock className="w-3 h-3 text-amber-600" />}
                  </label>
                  <select
                    disabled={isFieldCentrallyLockedInBranchMode('currency')}
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold disabled:bg-slate-100"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                    <span>Tax Treatment</span>
                    {isFieldCentrallyLockedInBranchMode('taxTreatment') && <Lock className="w-3 h-3 text-amber-600" />}
                  </label>
                  <select
                    disabled={isFieldCentrallyLockedInBranchMode('taxTreatment')}
                    value={formTaxId}
                    onChange={(e) => setFormTaxId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold disabled:bg-slate-100"
                  >
                    {taxMappings.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.taxCode} ({t.ratePercent}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                    <span>Allocation Basis</span>
                    {isFieldCentrallyLockedInBranchMode('allocationBasis') && <Lock className="w-3 h-3 text-amber-600" />}
                  </label>
                  <select
                    disabled={isFieldCentrallyLockedInBranchMode('allocationBasis')}
                    value={formAllocBasis}
                    onChange={(e) => setFormAllocBasis(e.target.value as ChargeAllocationMethod)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold disabled:bg-slate-100"
                  >
                    {ALLOC_BASES.map((a) => (
                      <option key={a} value={a}>
                        {a.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                    <span>Effective From</span>
                    {isFieldCentrallyLockedInBranchMode('effectiveDates') && <Lock className="w-3 h-3 text-amber-600" />}
                  </label>
                  <input
                    type="date"
                    disabled={isFieldCentrallyLockedInBranchMode('effectiveDates')}
                    value={formEffFrom}
                    onChange={(e) => setFormEffFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                    <span>Effective To</span>
                    {isFieldCentrallyLockedInBranchMode('effectiveDates') && <Lock className="w-3 h-3 text-amber-600" />}
                  </label>
                  <input
                    type="date"
                    disabled={isFieldCentrallyLockedInBranchMode('effectiveDates')}
                    value={formEffTo}
                    onChange={(e) => setFormEffTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono disabled:bg-slate-100"
                  />
                </div>
              </div>

              {selectedBranchId === 'ALL' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                  <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAllowBranchOverride}
                      onChange={(e) => setFormAllowBranchOverride(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span>Allow Branches to Override Permitted Settings</span>
                  </label>

                  <div>
                    <div className="font-bold text-slate-700 mb-1.5">
                      Centrally Controlled Fields (Locked Against Branch Override):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {CENTRAL_FIELD_LABELS.map((f) => (
                        <label key={f.key} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formCentralFields.includes(f.key)}
                            onChange={() => toggleCentralField(f.key)}
                            className="rounded border-slate-300 text-indigo-600"
                          />
                          <span>{f.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Governance Remarks / Change Reason</label>
                <input
                  type="text"
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="Optional tariff reference or override justification"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingOption(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg cursor-pointer shadow-xs"
                >
                  {selectedBranchId === 'ALL' ? 'Save Company Mapping' : 'Save Branch Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
