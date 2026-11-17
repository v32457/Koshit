import React, { useState } from 'react';
import {
  Sliders,
  Building,
  CheckCircle2,
  XCircle,
  Shield,
  AlertTriangle,
  Save,
  Check,
  RefreshCw,
  GitBranch,
  Info,
  Calendar,
  Lock,
  FileCheck,
  Layers,
  ArrowLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { User, Company, Branch } from '../../types';
import { rfqPolicyService } from '../../services/rfqPolicyService';
import { RfqPolicyConfig, RfqPolicyMode } from '../../types/rfqSourcing';
import { INITIAL_COMPANIES, INITIAL_BRANCHES } from '../../data/seedData';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';

interface RfqPolicyViewProps {
  currentUser?: User;
  companies?: Company[];
  branches?: Branch[];
  onNavigate?: (route: string) => void;
  hideHeader?: boolean;
}

export const RfqPolicyView: React.FC<RfqPolicyViewProps> = ({
  currentUser,
  companies = INITIAL_COMPANIES,
  branches = INITIAL_BRANCHES,
  onNavigate,
  hideHeader = false,
}) => {
  const [policies, setPolicies] = useState<RfqPolicyConfig[]>(() => rfqPolicyService.getPolicies());
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('co-kosh-01');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');

  const activePolicy = rfqPolicyService.getEffectivePolicy(
    selectedCompanyId,
    selectedBranchId === 'ALL' ? undefined : selectedBranchId
  );

  const [formState, setFormState] = useState<RfqPolicyConfig>(activePolicy);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const policyAuditGrid = useStandardDataGrid({
    gridId: 'rfq-policy-audit-register',
    userId: currentUser?.id,
    data: policies,
    defaultSortField: 'updatedAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
  });

  const companyBranches = branches.filter((b) => b.companyId === selectedCompanyId);
  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) || companies[0];
  const selectedBranch = selectedBranchId !== 'ALL' ? branches.find((b) => b.id === selectedBranchId) : null;

  const isBranchScoped = selectedBranchId !== 'ALL';
  const isBranchOverrideActive =
    isBranchScoped &&
    (!formState.isInheritedFromCompany ||
      policies.some((p) => p.companyId === selectedCompanyId && p.branchId === selectedBranchId && !p.isInheritedFromCompany));

  const handleSelectCompany = (cId: string) => {
    setSelectedCompanyId(cId);
    setSelectedBranchId('ALL');
    const compPolicy = rfqPolicyService.getEffectivePolicy(cId, undefined);
    setFormState(compPolicy);
  };

  const handleSelectBranch = (bId: string) => {
    setSelectedBranchId(bId);
    const effPolicy = rfqPolicyService.getEffectivePolicy(selectedCompanyId, bId === 'ALL' ? undefined : bId);
    setFormState(effPolicy);
  };

  const handleEnableBranchOverride = () => {
    const branchObj = selectedBranch || branches.find((b) => b.id === selectedBranchId);
    if (!branchObj) return;
    const companyPolicy = rfqPolicyService.getEffectivePolicy(selectedCompanyId, undefined);
    const newPolicy: RfqPolicyConfig = {
      ...companyPolicy,
      id: `pol-br-${branchObj.code || Date.now()}`,
      companyId: selectedCompanyId,
      companyCode: selectedCompany?.code || 'KOSH',
      branchId: branchObj.id,
      branchCode: branchObj.code || '001',
      branchName: branchObj.name,
      isInheritedFromCompany: false,
      allowBranchOverride: false,
      remarks: `Authorized branch override for ${branchObj.name}`,
    };
    rfqPolicyService.updatePolicy(newPolicy);
    setPolicies(rfqPolicyService.getPolicies());
    setFormState(newPolicy);
    setSaveSuccessMessage(`Authorized branch override enabled for ${branchObj.name}.`);
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  };

  const handleRevertToCompanyInheritance = () => {
    const branchObj = selectedBranch || branches.find((b) => b.id === selectedBranchId);
    if (!branchObj) return;
    rfqPolicyService.revertBranchToInheritance(selectedCompanyId, branchObj.id);
    setPolicies(rfqPolicyService.getPolicies());
    const eff = rfqPolicyService.getEffectivePolicy(selectedCompanyId, branchObj.id);
    setFormState(eff);
    setSaveSuccessMessage(`Branch ${branchObj.name} reverted to inherit Company Default Policy.`);
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  };

  const handleSave = () => {
    const comp = companies.find((c) => c.id === selectedCompanyId);
    const br = selectedBranchId !== 'ALL' ? branches.find((b) => b.id === selectedBranchId) : null;

    const policyToSave: RfqPolicyConfig = {
      ...formState,
      companyId: selectedCompanyId,
      companyCode: comp?.code || formState.companyCode || 'KOSH-HQ',
      branchId: selectedBranchId,
      branchCode: br?.code || (selectedBranchId === 'ALL' ? 'ALL' : '001'),
      branchName: br?.name || (selectedBranchId === 'ALL' ? 'All Branches (Company Default)' : 'Branch Plant'),
      isInheritedFromCompany: selectedBranchId !== 'ALL' ? formState.isInheritedFromCompany : false,
      updatedBy: currentUser?.fullName || 'Platform Administrator',
      updatedAt: new Date().toISOString(),
    };

    rfqPolicyService.updatePolicy(policyToSave);
    setPolicies(rfqPolicyService.getPolicies());
    setSaveSuccessMessage(
      `RFQ Policy configuration for ${comp?.code || selectedCompanyId} (${
        selectedBranchId === 'ALL' ? 'All Branches' : br?.name || selectedBranchId
      }) saved and published successfully.`
    );
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Success Notification Alert */}
      {saveSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl shadow-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
          <button
            onClick={() => setSaveSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Header */}
      {!hideHeader && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-1">
              <span>General Settings</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span>RFQ Sourcing Governance</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600" />
              <span>Company & Branch RFQ Policy Configuration</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure company-level and branch-level RFQ enablement, authorized branch overrides, mandatory/optional/disabled policies, and price book fallback rules.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save & Apply Policy</span>
          </button>
        </div>
      )}

      {/* Scope Selector Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-600" />
            <span>Select Target Enterprise Scope</span>
          </h2>
          <span className="text-[11px] text-slate-400">
            {isBranchScoped ? 'Plant-Specific Scope' : 'Company-Wide Scope'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Operating Company</label>
            <select
              value={selectedCompanyId}
              onChange={(e) => handleSelectCompany(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Branch Plant Scope (Inheritance / Override)
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => handleSelectBranch(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Branches (Company Default Policy)</option>
              {companyBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code}) — {b.city}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Scope Status Banner */}
        <div className="pt-2">
          {isBranchScoped ? (
            <div
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                isBranchOverrideActive
                  ? 'bg-purple-50/70 border-purple-200 text-purple-900'
                  : 'bg-blue-50/70 border-blue-200 text-blue-900'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <GitBranch className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold flex items-center gap-2">
                    <span>{selectedBranch?.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        isBranchOverrideActive
                          ? 'bg-purple-200 text-purple-950'
                          : 'bg-blue-200 text-blue-950'
                      }`}
                    >
                      {isBranchOverrideActive ? 'Authorized Branch Override Active' : 'Inheriting Company Default'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {isBranchOverrideActive
                      ? 'This branch currently maintains an authorized local procurement override. RFQ and price book rules deviate from company defaults.'
                      : `This branch automatically inherits the baseline procurement policy configured for ${selectedCompany?.name}.`}
                  </p>
                </div>
              </div>

              <div>
                {isBranchOverrideActive ? (
                  <button
                    onClick={handleRevertToCompanyInheritance}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                  >
                    Revert to Company Inheritance
                  </button>
                ) : (
                  <button
                    onClick={handleEnableBranchOverride}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                  >
                    Enable Branch Override
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl border bg-slate-50 border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Building className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900">
                    Company-Wide Master Policy ({selectedCompany?.name})
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Applies universally to all branches and facilities unless an authorized branch override is explicitly approved.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allow_branch_override"
                  checked={formState.allowBranchOverride}
                  onChange={(e) => setFormState({ ...formState, allowBranchOverride: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="allow_branch_override" className="font-bold text-slate-700 text-xs cursor-pointer">
                  Allow Authorized Branch Overrides
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Purchasing Mechanism & Policy Mode Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>RFQ Purchasing Policy Mode</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Governs whether Purchase Requisitions require competitive RFQ floating or source pre-negotiated prices from the Purchase Price Book.
          </p>
        </div>

        {/* 3-Way Policy Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. RFQ Mandatory */}
          <div
            onClick={() => setFormState({ ...formState, policyMode: 'RFQ_ENABLED' })}
            className={`p-4 border rounded-xl cursor-pointer transition flex flex-col justify-between ${
              formState.policyMode === 'RFQ_ENABLED'
                ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">RFQ Mandatory (Enabled)</span>
                <CheckCircle2
                  className={`w-5 h-5 ${
                    formState.policyMode === 'RFQ_ENABLED' ? 'text-indigo-600' : 'text-slate-300'
                  }`}
                />
              </div>
              <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                All approved PR lines must be floated through competitive RFQ. Approved RFQ Awards automatically populate the Approved Vendor Item Price Register.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-indigo-100/50 flex items-center justify-between text-[10px]">
              <span className="font-bold text-indigo-800">Source: RFQ Awards</span>
              <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 font-extrabold">STRICT</span>
            </div>
          </div>

          {/* 2. RFQ Optional / Hybrid */}
          <div
            onClick={() => setFormState({ ...formState, policyMode: 'RFQ_OPTIONAL' })}
            className={`p-4 border rounded-xl cursor-pointer transition flex flex-col justify-between ${
              formState.policyMode === 'RFQ_OPTIONAL'
                ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">RFQ Optional / Hybrid</span>
                <CheckCircle2
                  className={`w-5 h-5 ${
                    formState.policyMode === 'RFQ_OPTIONAL' ? 'text-blue-600' : 'text-slate-300'
                  }`}
                />
              </div>
              <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                Standard items float to RFQ, but authorized buyers may claim Direct Procurement or Emergency Exemptions below configured threshold limits.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-blue-100/50 flex items-center justify-between text-[10px]">
              <span className="font-bold text-blue-800">Source: Hybrid (RFQ + PO Direct)</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 font-extrabold">EXEMPTIONS</span>
            </div>
          </div>

          {/* 3. RFQ Disabled */}
          <div
            onClick={() => setFormState({ ...formState, policyMode: 'RFQ_DISABLED' })}
            className={`p-4 border rounded-xl cursor-pointer transition flex flex-col justify-between ${
              formState.policyMode === 'RFQ_DISABLED'
                ? 'border-amber-600 bg-amber-50/50 ring-2 ring-amber-500/20 shadow-xs'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">RFQ Disabled (Price Book)</span>
                <XCircle
                  className={`w-5 h-5 ${
                    formState.policyMode === 'RFQ_DISABLED' ? 'text-amber-600' : 'text-slate-300'
                  }`}
                />
              </div>
              <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                RFQ pipeline is bypassed. Purchase orders must source strictly contracted pricing directly from the Approved Purchase Price Book.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-amber-100/50 flex items-center justify-between text-[10px]">
              <span className="font-bold text-amber-900">Source: Purchase Price Book</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-extrabold">CONTRACT</span>
            </div>
          </div>
        </div>

        {/* Direct Procurement Exemptions Configuration (When RFQ Enabled or Optional) */}
        {formState.policyMode !== 'RFQ_DISABLED' && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                <span>Direct Procurement & Emergency Exemption Rules</span>
              </h3>
              <span className="text-[10px] text-slate-400">Controls single-source & urgent bypass</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Direct Exemption Threshold Limit (₹)
                </label>
                <input
                  type="number"
                  value={formState.directProcurementExemptionLimit || 50000}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      directProcurementExemptionLimit: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-900"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  PRs under this amount are eligible for direct purchase order conversion.
                </span>
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="allow_direct_exemptions"
                  checked={formState.allowDirectExemptions ?? true}
                  onChange={(e) =>
                    setFormState({ ...formState, allowDirectExemptions: e.target.checked })
                  }
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="allow_direct_exemptions" className="font-semibold text-slate-700 cursor-pointer">
                  Allow Direct Procurement Exemptions
                </label>
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="exemption_requires_approval"
                  checked={formState.directExemptionRequiresApproval ?? true}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      directExemptionRequiresApproval: e.target.checked,
                    })
                  }
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="exemption_requires_approval"
                  className="font-semibold text-slate-700 cursor-pointer"
                >
                  Require Manager Approval for Exemption
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Sourcing & Quotation Parameters */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Quotation Governance & Evaluation Controls</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Min Supplier Invitations</label>
              <input
                type="number"
                value={formState.minSupplierInvitations}
                onChange={(e) =>
                  setFormState({ ...formState, minSupplierInvitations: parseInt(e.target.value) || 1 })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Minimum bidders required</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Max Supplier Invitations</label>
              <input
                type="number"
                value={formState.maxSupplierInvitations}
                onChange={(e) =>
                  setFormState({ ...formState, maxSupplierInvitations: parseInt(e.target.value) || 10 })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Invitation ceiling</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quotation Validity (Days)</label>
              <input
                type="number"
                value={formState.defaultQuotationValidityDays}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    defaultQuotationValidityDays: parseInt(e.target.value) || 30,
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Standard response shelf-life</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Evaluation Methodology</label>
              <select
                value={formState.evaluationType}
                onChange={(e) => setFormState({ ...formState, evaluationType: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800"
              >
                <option value="TWO_STAGE">Two-Stage (Technical Gate then Commercial)</option>
                <option value="SINGLE_STAGE">Single-Stage Combined Evaluation</option>
              </select>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Technical audit gate</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sealed_commercial_quotations"
                checked={formState.sealedCommercialQuotations}
                onChange={(e) =>
                  setFormState({ ...formState, sealedCommercialQuotations: e.target.checked })
                }
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label
                htmlFor="sealed_commercial_quotations"
                className="text-xs font-semibold text-slate-800 cursor-pointer flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>Sealed Commercial Quotations Protection</span>
              </label>
            </div>
            <span className="text-[11px] text-slate-500">
              Commercial quotations remain encrypted and hidden from buyers until technical evaluation gate approval.
            </span>
          </div>
        </div>

        {/* Approval Requirements & Governance Reference */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Management Approval Reference
              </label>
              <input
                type="text"
                placeholder="e.g. CPO-POLICY-REV-2026-04"
                value={formState.approvalReference || ''}
                onChange={(e) => setFormState({ ...formState, approvalReference: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Policy Governance Remarks</label>
              <input
                type="text"
                placeholder="e.g. Approved under corporate multi-plant sourcing overhaul."
                value={formState.remarks || ''}
                onChange={(e) => setFormState({ ...formState, remarks: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save & Apply RFQ Policy</span>
          </button>
        </div>
      </div>

      {/* Configuration Audit Register & History Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>RFQ Policy Configuration Audit Register</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live enterprise ledger of all active company and branch RFQ policy configurations.
            </p>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            {policies.length} Registered Configurations
          </span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold">
              <tr>
                <th className="p-3">Company Scope</th>
                <th className="p-3">Branch Scope</th>
                <th className="p-3 text-center">Policy Mode</th>
                <th className="p-3 text-center">Inheritance Status</th>
                <th className="p-3 text-right">Direct Exemption Limit</th>
                <th className="p-3 text-center">Bidders (Min / Max)</th>
                <th className="p-3">Last Updated By</th>
                <th className="p-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {policyAuditGrid.pagedData.map((pol) => (
                <tr
                  key={pol.id}
                  className={`hover:bg-slate-50/80 transition ${
                    pol.companyId === selectedCompanyId && pol.branchId === selectedBranchId
                      ? 'bg-indigo-50/40 font-semibold'
                      : ''
                  }`}
                >
                  <td className="p-3 font-bold text-slate-900">{pol.companyCode}</td>
                  <td className="p-3">
                    <div className="font-semibold text-slate-800">{pol.branchName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{pol.branchCode}</div>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        pol.policyMode === 'RFQ_ENABLED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : pol.policyMode === 'RFQ_OPTIONAL'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {pol.policyMode === 'RFQ_ENABLED'
                        ? 'RFQ MANDATORY'
                        : pol.policyMode === 'RFQ_OPTIONAL'
                        ? 'RFQ OPTIONAL'
                        : 'RFQ DISABLED'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {pol.branchId === 'ALL' ? (
                      <span className="text-[10px] font-bold text-slate-600">Company Master</span>
                    ) : pol.isInheritedFromCompany ? (
                      <span className="text-[10px] font-bold text-blue-700">Inherited</span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800">
                        Branch Override
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right font-bold text-slate-800">
                    {pol.directProcurementExemptionLimit
                      ? `₹${pol.directProcurementExemptionLimit.toLocaleString()}`
                      : '—'}
                  </td>
                  <td className="p-3 text-center font-mono text-[11px]">
                    {pol.minSupplierInvitations} / {pol.maxSupplierInvitations}
                  </td>
                  <td className="p-3 text-slate-700">{pol.updatedBy}</td>
                  <td className="p-3 text-slate-500 text-[11px]">
                    {new Date(pol.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DataGridFooter
          currentPage={policyAuditGrid.currentPage}
          totalPages={policyAuditGrid.totalPages}
          pageSize={policyAuditGrid.pageSize}
          totalRecords={policyAuditGrid.totalRecords}
          onPageChange={policyAuditGrid.setCurrentPage}
          onPageSizeChange={policyAuditGrid.setPageSize}
          pageSizeOptions={policyAuditGrid.pageSizeOptions}
          defaultSortNotice="Sorted Newest First (Updated Timestamp DESC)"
        />
      </div>
    </div>
  );
};
