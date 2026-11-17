import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Plus,
  Edit,
  Power,
  Search,
  Coins,
  Shield,
  Sliders,
  Calculator,
  X,
  Globe,
  FileText,
} from 'lucide-react';
import { User } from '../../types';
import {
  ChargeAllocationMethod,
  ChargeApplicabilityStatus,
  ChargeApplicationLevel,
  ChargeBearer,
  ChargeCalculationBasis,
  ChargeCalculationMethod,
  ChargeMasterCategory,
  ChargeMasterRecord,
} from '../../types/chargeManagement';
import {
  ALL_CHARGE_APPLICATION_LEVELS,
  chargeMasterService,
} from '../../services/chargeMasterService';
import { validateChargeFormula } from '../../services/chargeFormulaEvaluator';
import { rbacPermissionService } from '../../services/rbacPermissionService';

interface ChargeMasterConfigViewProps {
  currentUser?: User;
}

const CATEGORIES: ChargeMasterCategory[] = [
  'HANDLING',
  'LOGISTICS',
  'IMPORT_CUSTOMS',
  'INSURANCE',
  'QUALITY_COMPLIANCE',
  'PACKAGING',
  'STATUTORY',
  'SERVICE',
  'OTHER',
];

const CALC_METHODS: Array<{ value: ChargeCalculationMethod; label: string }> = [
  { value: 'FIXED_AMOUNT', label: 'Fixed Amount' },
  { value: 'PERCENTAGE', label: 'Percentage (%)' },
  { value: 'PER_UNIT', label: 'Per Unit' },
  { value: 'PER_KG', label: 'Per KG' },
  { value: 'PER_MT', label: 'Per Metric Ton (MT)' },
  { value: 'PER_VOLUME', label: 'Per Volume (CBM)' },
  { value: 'PER_KM', label: 'Per Kilometer (KM)' },
  { value: 'PER_SHIPMENT', label: 'Per Shipment' },
  { value: 'PER_TRIP', label: 'Per Transport Trip' },
  { value: 'PER_DAY', label: 'Per Day (Demurrage / Rental)' },
  { value: 'ACTUAL_COST', label: 'Actual Cost' },
  { value: 'FORMULA_BASED', label: 'Formula-Based (AST)' },
];

const CALC_BASES: ChargeCalculationBasis[] = [
  'MATERIAL_LINE_VALUE',
  'TOTAL_PO_MATERIAL_VALUE',
  'NET_QUANTITY',
  'RECEIVED_QUANTITY',
  'GROSS_WEIGHT',
  'NET_WEIGHT',
  'VOLUME',
  'DISTANCE',
  'NUMBER_OF_SHIPMENTS',
  'NUMBER_OF_TRIPS',
  'NUMBER_OF_DAYS',
  'ACTUAL_INVOICE_AMOUNT',
  'EQUAL_ALLOCATION',
  'MANUAL_ALLOCATION',
];

const ALLOC_METHODS: ChargeAllocationMethod[] = [
  'PROPORTIONAL_VALUE',
  'PROPORTIONAL_QUANTITY',
  'EQUAL_DISTRIBUTION',
  'PROPORTIONAL_WEIGHT',
  'PROPORTIONAL_VOLUME',
  'DIRECT_LINE_ALLOCATION',
  'MANUAL_ALLOCATION',
];

const BEARERS: ChargeBearer[] = ['BUYER', 'SUPPLIER', 'SHARED_50_50', 'THIRD_PARTY_LOGISTICS'];

export const ChargeMasterConfigView: React.FC<ChargeMasterConfigViewProps> = ({ currentUser }) => {
  const [subTab, setSubTab] = useState<'MASTER' | 'TAX_FX'>('MASTER');
  const [charges, setCharges] = useState<ChargeMasterRecord[]>(() => chargeMasterService.getCharges(true));
  const [taxMappings] = useState(() => chargeMasterService.getTaxMappings());
  const [fxRates] = useState(() => chargeMasterService.getExchangeRates());

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [editingRecord, setEditingRecord] = useState<ChargeMasterRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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

  // Modal Form State
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState<ChargeMasterCategory>('HANDLING');
  const [formDefaultLevel, setFormDefaultLevel] = useState<ChargeApplicationLevel>('PR_HEADER');
  const [formPermittedLevels, setFormPermittedLevels] = useState<ChargeApplicationLevel[]>(['PR_HEADER', 'PR_LINE', 'PO_HEADER']);
  const [formCalcMethod, setFormCalcMethod] = useState<ChargeCalculationMethod>('FIXED_AMOUNT');
  const [formCalcBasis, setFormCalcBasis] = useState<ChargeCalculationBasis>('TOTAL_PO_MATERIAL_VALUE');
  const [formRate, setFormRate] = useState<number>(1000);
  const [formFormula, setFormFormula] = useState<string>('');
  const [formCurrency, setFormCurrency] = useState<string>('INR');
  const [formTaxId, setFormTaxId] = useState<string>(taxMappings[0]?.id || 'tax-dom-gst-18');
  const [formAllocBasis, setFormAllocBasis] = useState<ChargeAllocationMethod>('PROPORTIONAL_VALUE');
  const [formBearer, setFormBearer] = useState<ChargeBearer>('BUYER');
  const [formApplicability, setFormApplicability] = useState<ChargeApplicabilityStatus>('OPTIONAL');
  const [formMinCharge, setFormMinCharge] = useState<string>('');
  const [formMaxCharge, setFormMaxCharge] = useState<string>('');
  const [formEffFrom, setFormEffFrom] = useState<string>('2026-04-01');
  const [formEffTo, setFormEffTo] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  const formulaValidation = useMemo(() => {
    if (formCalcMethod !== 'FORMULA_BASED') return { valid: true };
    return validateChargeFormula(formFormula);
  }, [formCalcMethod, formFormula]);

  const filteredCharges = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return charges.filter((c) => {
      if (categoryFilter !== 'ALL' && c.chargeCategory !== categoryFilter) return false;
      if (statusFilter === 'ACTIVE' && !c.isActive) return false;
      if (statusFilter === 'INACTIVE' && c.isActive) return false;
      if (!q) return true;
      return (
        c.chargeCode.toLowerCase().includes(q) ||
        c.chargeName.toLowerCase().includes(q) ||
        c.chargeDescription.toLowerCase().includes(q) ||
        c.chargeCategory.toLowerCase().includes(q)
      );
    });
  }, [charges, searchQuery, categoryFilter, statusFilter]);

  const openCreateModal = () => {
    setFormError(null);
    setEditingRecord(null);
    setFormCode('CHG-');
    setFormName('');
    setFormDesc('');
    setFormCategory('HANDLING');
    setFormDefaultLevel('PR_HEADER');
    setFormPermittedLevels(['PR_HEADER', 'PR_LINE', 'PO_HEADER', 'PO_LINE']);
    setFormCalcMethod('FIXED_AMOUNT');
    setFormCalcBasis('TOTAL_PO_MATERIAL_VALUE');
    setFormRate(1500);
    setFormFormula('');
    setFormCurrency('INR');
    setFormTaxId(taxMappings[0]?.id || 'tax-dom-gst-18');
    setFormAllocBasis('PROPORTIONAL_VALUE');
    setFormBearer('BUYER');
    setFormApplicability('OPTIONAL');
    setFormMinCharge('0');
    setFormMaxCharge('');
    setFormEffFrom(new Date().toISOString().slice(0, 10));
    setFormEffTo('');
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (rec: ChargeMasterRecord) => {
    setFormError(null);
    setEditingRecord(rec);
    setFormCode(rec.chargeCode);
    setFormName(rec.chargeName);
    setFormDesc(rec.chargeDescription);
    setFormCategory(rec.chargeCategory);
    setFormDefaultLevel(rec.defaultApplicationLevel);
    setFormPermittedLevels([...rec.permittedApplicationLevels]);
    setFormCalcMethod(rec.defaultCalculationMethod);
    setFormCalcBasis(rec.defaultCalculationBasis);
    setFormRate(rec.defaultRate);
    setFormFormula(rec.defaultFormulaExpression || '');
    setFormCurrency(rec.defaultCurrency);
    setFormTaxId(rec.defaultTaxMappingId);
    setFormAllocBasis(rec.defaultAllocationBasis);
    setFormBearer(rec.chargeBearer);
    setFormApplicability(rec.applicabilityRule);
    setFormMinCharge(rec.minimumCharge !== undefined ? String(rec.minimumCharge) : '');
    setFormMaxCharge(rec.maximumCharge !== undefined ? String(rec.maximumCharge) : '');
    setFormEffFrom(rec.effectiveFrom);
    setFormEffTo(rec.effectiveTo || '');
    setFormIsActive(rec.isActive);
    setIsModalOpen(true);
  };

  const togglePermittedLevel = (level: ChargeApplicationLevel) => {
    setFormPermittedLevels((prev) => {
      if (prev.includes(level)) {
        const next = prev.filter((l) => l !== level);
        return next.length > 0 ? next : prev;
      }
      return [...prev, level];
    });
  };

  const handleSaveMaster = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!canManage) {
      setFormError('Authorization Denied: Administrator permission is required to modify Charge Master.');
      return;
    }

    const permitted = formPermittedLevels.includes(formDefaultLevel)
      ? formPermittedLevels
      : [formDefaultLevel, ...formPermittedLevels];

    const selectedTax = taxMappings.find((t) => t.id === formTaxId) || taxMappings[0];

    try {
      const payload = {
        chargeCode: formCode.trim().toUpperCase(),
        chargeName: formName.trim(),
        chargeDescription: formDesc.trim() || formName.trim(),
        chargeCategory: formCategory,
        defaultApplicationLevel: formDefaultLevel,
        permittedApplicationLevels: permitted,
        defaultCalculationMethod: formCalcMethod,
        defaultCalculationBasis: formCalcBasis,
        defaultRate: Number(formRate) || 0,
        defaultFormulaExpression: formCalcMethod === 'FORMULA_BASED' ? formFormula.trim() : undefined,
        applicabilityRule: formApplicability,
        defaultCurrency: formCurrency,
        defaultTaxMappingId: selectedTax.id,
        defaultTaxTreatment: selectedTax.treatmentType,
        defaultAllocationBasis: formAllocBasis,
        chargeBearer: formBearer,
        recoverability: selectedTax.recoverability,
        minimumCharge: formMinCharge !== '' ? Number(formMinCharge) : undefined,
        maximumCharge: formMaxCharge !== '' ? Number(formMaxCharge) : undefined,
        roundingRule: 'HALF_UP' as const,
        decimalPrecision: 2,
        calculationSequence: editingRecord?.calculationSequence ?? 100,
        effectiveFrom: formEffFrom,
        effectiveTo: formEffTo || undefined,
        isActive: formIsActive,
        createdBy: editingRecord?.createdBy || actor.name,
        modifiedBy: actor.name,
      };

      if (editingRecord) {
        const updated = chargeMasterService.updateCharge(editingRecord.id, payload, actor);
        setFeedback({
          type: 'success',
          text: `Updated centralized Charge Master "${updated.chargeCode}" (${updated.chargeName}) — Version v${updated.versionNumber}.`,
        });
      } else {
        const created = chargeMasterService.createCharge(payload, actor);
        setFeedback({
          type: 'success',
          text: `Created centralized Charge Master "${created.chargeCode}" (${created.chargeName}). Now available for Company & Branch Charge Mapping.`,
        });
      }
      setCharges(chargeMasterService.getCharges(true));
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save Charge Master record.');
    }
  };

  const handleToggleActive = (rec: ChargeMasterRecord) => {
    if (!canManage) {
      setFeedback({ type: 'error', text: 'Only authorized administrators can activate or deactivate Charge Master records.' });
      return;
    }
    try {
      const updated = chargeMasterService.setChargeActiveStatus(rec.id, !rec.isActive, actor);
      setCharges(chargeMasterService.getCharges(true));
      setFeedback({
        type: 'success',
        text: `Charge "${updated.chargeCode}" marked ${updated.isActive ? 'ACTIVE' : 'INACTIVE'}. Existing historical transactions remain unaffected.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Unable to change status.' });
    }
  };

  const activeCount = charges.filter((c) => c.isActive).length;
  const inactiveCount = charges.length - activeCount;
  const formulaCount = charges.filter((c) => c.defaultCalculationMethod === 'FORMULA_BASED').length;

  return (
    <div className="space-y-5 text-xs">
      {/* Header */}
      <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-extrabold tracking-tight">
              General Settings → Procurement Configuration → Charge Master
            </h2>
          </div>
          <p className="text-slate-300 text-xs max-w-3xl">
            Centralized, administrator-controlled Charge Master registry. Companies and Branches map to these canonical definitions rather than duplicating charge records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('MASTER')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition ${
              subTab === 'MASTER' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Charge Master ({charges.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('TAX_FX')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition ${
              subTab === 'TAX_FX' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Tax Treatments & FX
          </button>
          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-lg flex items-center gap-1.5 cursor-pointer transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create Charge Master</span>
            </button>
          )}
        </div>
      </div>

      {!canManage && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-center gap-2 font-semibold">
          <Shield className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Read-Only Mode: Only authorized enterprise administrators can create, edit, or deactivate Charge Master definitions.
          </span>
        </div>
      )}

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
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">Total Master Definitions</div>
          <div className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">{charges.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Single centralized enterprise registry</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">Active / Selectable</div>
          <div className="text-xl font-extrabold text-emerald-700 font-mono mt-0.5">{activeCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{inactiveCount} deactivated / retired</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">Formula-Driven Charges</div>
          <div className="text-xl font-extrabold text-indigo-700 font-mono mt-0.5">{formulaCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Safe AST expression engine</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">Tax Mappings Registered</div>
          <div className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">{taxMappings.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Domestic GST, RCM & Customs BCD+SWS</div>
        </div>
      </div>

      {subTab === 'MASTER' ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Charge Master by code, name, category, or description..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by Charge Category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-700 text-xs"
              >
                <option value="ALL">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-700 text-xs"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#0B192C] text-white font-bold">
                  <th className="px-2.5 py-2.5 border-r border-slate-800 whitespace-nowrap">Code & Ver</th>
                  <th className="px-2.5 py-2.5 border-r border-slate-800">Charge Name & Description</th>
                  <th className="px-2.5 py-2.5 border-r border-slate-800">Category & Levels</th>
                  <th className="px-2.5 py-2.5 border-r border-slate-800">Method, Rate & Bearer</th>
                  <th className="px-2.5 py-2.5 border-r border-slate-800">Tax & Allocation</th>
                  <th className="px-2.5 py-2.5 border-r border-slate-800 whitespace-nowrap">Validity & Bounds</th>
                  <th className="px-2.5 py-2.5 border-r border-slate-800 text-center">Status</th>
                  <th className="px-2.5 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCharges.map((rec) => (
                  <tr
                    key={rec.id}
                    className={`hover:bg-slate-50 transition-colors ${!rec.isActive ? 'bg-slate-50/70 opacity-75' : ''}`}
                  >
                    <td className="px-2.5 py-2.5 border-r border-slate-200 align-top whitespace-nowrap">
                      <div className="font-mono font-extrabold text-indigo-900">{rec.chargeCode}</div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">v{rec.versionNumber || 1}</div>
                    </td>
                    <td className="px-2.5 py-2.5 border-r border-slate-200 align-top max-w-[230px]">
                      <div className="font-bold text-slate-900 leading-snug">{rec.chargeName}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-snug line-clamp-2" title={rec.chargeDescription}>
                        {rec.chargeDescription}
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5 border-r border-slate-200 align-top">
                      <div className="font-bold text-slate-800">{rec.chargeCategory.replace(/_/g, ' ')}</div>
                      <div className="text-[10px] text-slate-600 mt-0.5">
                        {rec.defaultApplicationLevel.replace(/_/g, ' ')} ({rec.permittedApplicationLevels.length})
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5 border-r border-slate-200 align-top">
                      <div className="font-semibold text-slate-800">
                        {rec.defaultCalculationMethod.replace(/_/g, ' ')}
                      </div>
                      <div className="font-mono font-extrabold text-indigo-700 mt-0.5">
                        {rec.defaultCalculationMethod === 'PERCENTAGE'
                          ? `${rec.defaultRate}%`
                          : `${rec.defaultCurrency} ${Number(rec.defaultRate).toLocaleString('en-IN')}`}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Bearer: {rec.chargeBearer.replace(/_/g, ' ')}
                      </div>
                      {rec.defaultFormulaExpression && (
                        <div className="text-[10px] font-mono text-slate-500 truncate max-w-[150px]" title={rec.defaultFormulaExpression}>
                          {rec.defaultFormulaExpression}
                        </div>
                      )}
                    </td>
                    <td className="px-2.5 py-2.5 border-r border-slate-200 align-top">
                      <div className="font-semibold text-slate-800">{rec.defaultTaxTreatment.replace(/_/g, ' ')}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Alloc: {rec.defaultAllocationBasis.replace(/_/g, ' ')}
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5 border-r border-slate-200 align-top font-mono text-[10px] text-slate-700 whitespace-nowrap">
                      <div>{rec.effectiveFrom} → {rec.effectiveTo || 'Open'}</div>
                      <div className="text-slate-500 mt-0.5">
                        Min: {rec.minimumCharge ?? 0} · Max: {rec.maximumCharge ?? '∞'}
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5 border-r border-slate-200 align-top text-center whitespace-nowrap">
                      <span
                        className={`font-bold text-[10px] ${
                          rec.isActive ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {rec.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-2.5 py-2.5 align-top text-center whitespace-nowrap">
                      {canManage ? (
                        <div className="flex flex-col items-stretch gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(rec)}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded border border-indigo-200 cursor-pointer flex items-center justify-center gap-1"
                            title={`Edit ${rec.chargeCode}`}
                          >
                            <Edit className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(rec)}
                            className={`px-2 py-1 font-bold rounded border cursor-pointer flex items-center justify-center gap-1 ${
                              rec.isActive
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                            }`}
                            title={rec.isActive ? `Deactivate ${rec.chargeCode}` : `Activate ${rec.chargeCode}`}
                          >
                            <Power className="w-3 h-3" />
                            <span>{rec.isActive ? 'Deactivate' : 'Activate'}</span>
                          </button>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Statutory Tax Mappings */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900">Statutory Tax Mapping Registry</h3>
            </div>
            <div className="divide-y divide-slate-200">
              {taxMappings.map((t) => (
                <div key={t.id} className="p-3.5 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900">
                      <span className="font-mono text-indigo-800">{t.taxCode}</span> — {t.taxName}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{t.description}</div>
                  </div>
                  <div className="text-right shrink-0 font-mono">
                    <div className="font-extrabold text-slate-900">{t.ratePercent}%</div>
                    <div className="text-[10px] text-slate-500">{t.recoverability.replace(/_/g, ' ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Exchange Rate Registry */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900">Governed Multi-Currency Exchange Rates</h3>
            </div>
            <div className="divide-y divide-slate-200">
              {fxRates.map((fx) => (
                <div key={fx.id} className="p-3.5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 font-mono">
                      1 {fx.fromCurrency} → {fx.toCurrency}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Source: {fx.sourceRef} · Effective: {fx.effectiveDate}
                    </div>
                  </div>
                  <div className="font-mono font-extrabold text-indigo-700 text-sm">{fx.rate}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Charge Master Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-[#0B192C] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <h3 className="font-extrabold text-sm">
                  {editingRecord ? `Edit Charge Master — ${editingRecord.chargeCode}` : 'Create Centralized Charge Master Record'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMaster} className="p-5 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded-lg font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Charge Code *</label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. CHG-CRANE"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Charge Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Mobile Crane Rigging Charges"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Clear business description for procurement and finance governance"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ChargeMasterCategory)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-800"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Default Application Level</label>
                  <select
                    value={formDefaultLevel}
                    onChange={(e) => setFormDefaultLevel(e.target.value as ChargeApplicationLevel)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-800"
                  >
                    {ALL_CHARGE_APPLICATION_LEVELS.map((lvl) => (
                      <option key={lvl.level} value={lvl.level}>
                        {lvl.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Charge Bearer</label>
                  <select
                    value={formBearer}
                    onChange={(e) => setFormBearer(e.target.value as ChargeBearer)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-800"
                  >
                    {BEARERS.map((b) => (
                      <option key={b} value={b}>
                        {b.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Permitted Application Levels</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {ALL_CHARGE_APPLICATION_LEVELS.map((lvl) => (
                    <label key={lvl.level} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formPermittedLevels.includes(lvl.level)}
                        onChange={() => togglePermittedLevel(lvl.level)}
                        className="rounded border-slate-300 text-indigo-600"
                      />
                      <span>{lvl.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Calculation Method</label>
                  <select
                    value={formCalcMethod}
                    onChange={(e) => setFormCalcMethod(e.target.value as ChargeCalculationMethod)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-800"
                  >
                    {CALC_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Calculation Basis</label>
                  <select
                    value={formCalcBasis}
                    onChange={(e) => setFormCalcBasis(e.target.value as ChargeCalculationBasis)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-800"
                  >
                    {CALC_BASES.map((b) => (
                      <option key={b} value={b}>
                        {b.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Default Rate</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={formRate}
                    onChange={(e) => setFormRate(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-right"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Default Currency</label>
                  <select
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                  </select>
                </div>
              </div>

              {formCalcMethod === 'FORMULA_BASED' && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-1.5">
                  <label className="font-bold text-indigo-900 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Restricted Formula Expression</span>
                  </label>
                  <input
                    type="text"
                    value={formFormula}
                    onChange={(e) => setFormFormula(e.target.value)}
                    placeholder="e.g. max(1000, round(weightMt * distanceKm * rate, 2))"
                    className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-lg font-mono text-xs"
                  />
                  {!formulaValidation.valid ? (
                    <div className="text-[11px] font-bold text-rose-700">{formulaValidation.error}</div>
                  ) : (
                    <div className="text-[11px] text-indigo-700">
                      Allowed variables: materialValue, quantity, weightKg, weightMt, volumeCbm, distanceKm, rate. Allowed functions: min, max, round, abs.
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tax Treatment</label>
                  <select
                    value={formTaxId}
                    onChange={(e) => setFormTaxId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-800"
                  >
                    {taxMappings.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.taxCode} ({t.ratePercent}%)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Default Allocation Basis</label>
                  <select
                    value={formAllocBasis}
                    onChange={(e) => setFormAllocBasis(e.target.value as ChargeAllocationMethod)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-800"
                  >
                    {ALLOC_METHODS.map((a) => (
                      <option key={a} value={a}>
                        {a.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Master Applicability Default</label>
                  <select
                    value={formApplicability}
                    onChange={(e) => setFormApplicability(e.target.value as ChargeApplicabilityStatus)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-800"
                  >
                    <option value="MANDATORY">Mandatory</option>
                    <option value="OPTIONAL">Optional</option>
                    <option value="CONDITIONAL">Conditional</option>
                    <option value="NOT_APPLICABLE">Not Applicable</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Min Charge</label>
                  <input
                    type="number"
                    min={0}
                    value={formMinCharge}
                    onChange={(e) => setFormMinCharge(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-right"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max Charge</label>
                  <input
                    type="number"
                    min={0}
                    value={formMaxCharge}
                    onChange={(e) => setFormMaxCharge(e.target.value)}
                    placeholder="No limit"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-right"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Effective From *</label>
                  <input
                    type="date"
                    required
                    value={formEffFrom}
                    onChange={(e) => setFormEffFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Effective To</label>
                  <input
                    type="date"
                    value={formEffTo}
                    onChange={(e) => setFormEffTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span>Active</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg cursor-pointer shadow-xs"
                >
                  {editingRecord ? 'Save Master Update' : 'Create Charge Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
