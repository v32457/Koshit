/**
 * CIPPLATFORM — PR TYPE MASTER & CENTRALIZED ELIGIBILITY MAPPING PANEL
 *
 * Manages genuine PR Type Master records (MANUAL, MRP, REPAIR, MAINTENANCE, CAPEX_ASSET,
 * and custom PR Types) plus Company -> Branch -> Purchase Org -> Item Category -> PR Type
 * versioned eligibility mappings with Maker-Checker approval and effective dates.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit2,
  Send,
  ShieldCheck,
  Power,
  History,
  Sliders,
  Eye,
  X,
} from 'lucide-react';
import { Company, Branch, User } from '../../types';
import {
  INITIAL_COMPANIES,
  INITIAL_BRANCHES,
  CLASSIFICATION_DIMENSIONS,
} from '../../data/seedData';
import { PurchaseOrganizationService } from '../../services/purchaseOrganizationService';
import { prTypeMasterService } from '../../services/prTypeMasterService';
import {
  PRTypeMasterRecord,
  PRTypeApplicabilityMappingRecord,
  PRTypeMasterVersionHistoryEntry,
  PRTypeApprovalStatus,
  PRTypeMasterStatus,
} from '../../types/prTypeMaster';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';

interface PrTypeMasterPanelProps {
  currentUser?: User;
  companies?: Company[];
  branches?: Branch[];
  initialSubTab?: 'types' | 'mappings' | 'history' | 'checker';
  onUpdated?: () => void;
}

type PanelSubTab = 'types' | 'mappings' | 'history' | 'checker';

export const PrTypeMasterPanel: React.FC<PrTypeMasterPanelProps> = ({
  currentUser,
  companies = INITIAL_COMPANIES,
  branches = INITIAL_BRANCHES,
  initialSubTab = 'types',
  onUpdated,
}) => {
  const [subTab, setSubTab] = useState<PanelSubTab>(initialSubTab);
  const [refreshTick, setRefreshTick] = useState(0);
  const [notice, setNotice] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const activeCompanies = useMemo(
    () => companies.filter((c) => c.isEnabled !== false),
    [companies]
  );
  const purchaseOrgs = useMemo(() => PurchaseOrganizationService.getOrganizations(), []);
  const itemCategories = useMemo(
    () => (CLASSIFICATION_DIMENSIONS.category?.values || []).filter((c) => c.isActive !== false),
    []
  );

  // Listen to external updates
  useEffect(() => {
    const handler = () => setRefreshTick((t) => t + 1);
    window.addEventListener('cip-pr-type-master-updated', handler);
    return () => window.removeEventListener('cip-pr-type-master-updated', handler);
  }, []);

  const prTypes = useMemo(() => prTypeMasterService.getPrTypes(), [refreshTick]);
  const mappings = useMemo(() => prTypeMasterService.getMappings(), [refreshTick]);
  const historyEntries = useMemo(() => prTypeMasterService.getVersionHistory(), [refreshTick]);

  const bump = () => {
    setRefreshTick((t) => t + 1);
    onUpdated?.();
  };

  // =========================================================================
  // TAB 1: PR TYPE MASTER STATE & MODALS
  // =========================================================================
  const [typeSearch, setTypeSearch] = useState('');
  const filteredPrTypes = useMemo(() => {
    if (!typeSearch.trim()) return prTypes;
    const q = typeSearch.toLowerCase().trim();
    return prTypes.filter(
      (t) =>
        t.code.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }, [prTypes, typeSearch]);

  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<PRTypeMasterRecord | null>(null);
  const [typeForm, setTypeForm] = useState({
    code: '',
    name: '',
    description: '',
    isCapexType: false,
    requiresAssetClassification: false,
    requiresBudgetExceptionFlow: false,
    effectiveFrom: '2026-11-01',
    effectiveUntil: '',
    changeReason: '',
  });

  const openCreateTypeModal = () => {
    setEditingType(null);
    setTypeForm({
      code: '',
      name: '',
      description: '',
      isCapexType: false,
      requiresAssetClassification: false,
      requiresBudgetExceptionFlow: false,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveUntil: '',
      changeReason: '',
    });
    setTypeModalOpen(true);
  };

  const openEditTypeModal = (rec: PRTypeMasterRecord) => {
    setEditingType(rec);
    setTypeForm({
      code: rec.code,
      name: rec.name,
      description: rec.description,
      isCapexType: rec.isCapexType,
      requiresAssetClassification: rec.requiresAssetClassification,
      requiresBudgetExceptionFlow: rec.requiresBudgetExceptionFlow,
      effectiveFrom: rec.effectiveFrom,
      effectiveUntil: rec.effectiveUntil || '',
      changeReason: '',
    });
    setTypeModalOpen(true);
  };

  const handleSavePrType = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingType) {
        const updated = prTypeMasterService.updatePrType(
          editingType.id,
          {
            name: typeForm.name,
            description: typeForm.description,
            isCapexType: typeForm.isCapexType,
            requiresAssetClassification: typeForm.requiresAssetClassification,
            requiresBudgetExceptionFlow: typeForm.requiresBudgetExceptionFlow,
            effectiveFrom: typeForm.effectiveFrom,
            effectiveUntil: typeForm.effectiveUntil || undefined,
          },
          currentUser,
          typeForm.changeReason || undefined
        );
        setNotice({
          type: 'success',
          message: `Updated PR Type ${updated.code} (v${updated.versionNumber}) as DRAFT — submit & approve to activate changes.`,
        });
      } else {
        const created = prTypeMasterService.createPrType(
          {
            code: typeForm.code,
            name: typeForm.name,
            description: typeForm.description,
            isCapexType: typeForm.isCapexType,
            requiresAssetClassification: typeForm.requiresAssetClassification,
            requiresBudgetExceptionFlow: typeForm.requiresBudgetExceptionFlow,
            effectiveFrom: typeForm.effectiveFrom,
            effectiveUntil: typeForm.effectiveUntil || undefined,
          },
          currentUser
        );
        setNotice({
          type: 'success',
          message: `Created PR Type ${created.code} (${created.name}) in DRAFT / INACTIVE state.`,
        });
      }
      setTypeModalOpen(false);
      bump();
    } catch (err: any) {
      setNotice({ type: 'error', message: err?.message || 'Unable to save PR Type.' });
    }
  };

  // =========================================================================
  // TAB 2: MAPPING FILTERS & MODAL STATE
  // =========================================================================
  const [mapFilterCompany, setMapFilterCompany] = useState<string>('ALL');
  const [mapFilterBranch, setMapFilterBranch] = useState<string>('ALL');
  const [mapFilterPrType, setMapFilterPrType] = useState<string>('ALL');
  const [mapFilterCategory, setMapFilterCategory] = useState<string>('ALL');
  const [mapFilterStatus, setMapFilterStatus] = useState<PRTypeMasterStatus | 'ALL'>('ALL');
  const [mapFilterApproval, setMapFilterApproval] = useState<PRTypeApprovalStatus | 'ALL'>('ALL');

  const filteredMappings = useMemo(() => {
    return prTypeMasterService.getMappings({
      companyId: mapFilterCompany,
      branchId: mapFilterBranch,
      itemCategoryCode: mapFilterCategory,
      prTypeCode: mapFilterPrType,
      status: mapFilterStatus,
      approvalStatus: mapFilterApproval,
    });
  }, [
    refreshTick,
    mapFilterCompany,
    mapFilterBranch,
    mapFilterPrType,
    mapFilterCategory,
    mapFilterStatus,
    mapFilterApproval,
  ]);

  const mappingGrid = useStandardDataGrid({
    gridId: 'pr-type-master-mappings',
    userId: currentUser?.id,
    data: filteredMappings,
    defaultSortField: 'updatedAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
    filterSignature: `${mapFilterCompany}|${mapFilterBranch}|${mapFilterPrType}|${mapFilterCategory}|${mapFilterStatus}|${mapFilterApproval}`,
  });

  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<PRTypeApplicabilityMappingRecord | null>(
    null
  );
  const [mappingForm, setMappingForm] = useState({
    companyId: activeCompanies[0]?.id || 'co-kosh-01',
    branchId: 'ALL',
    purchaseOrgId: 'ALL',
    itemCategoryCode: 'CP',
    prTypeCode: 'CAPEX_ASSET',
    isEligible: true,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveUntil: '',
    remarks: '',
  });

  const modalCompanyBranches = useMemo(() => {
    if (mappingForm.companyId === 'ALL') return branches.filter((b) => b.lifecycleStatus !== 'INACTIVE');
    return branches.filter(
      (b) => (b.companyId || 'co-kosh-01') === mappingForm.companyId && b.lifecycleStatus !== 'INACTIVE'
    );
  }, [branches, mappingForm.companyId]);

  const modalCompanyPurchaseOrgs = useMemo(() => {
    if (mappingForm.companyId === 'ALL') return purchaseOrgs;
    return purchaseOrgs.filter((po) => po.companyId === mappingForm.companyId);
  }, [purchaseOrgs, mappingForm.companyId]);

  const openCreateMappingModal = (presetPrType = 'CAPEX_ASSET') => {
    setEditingMapping(null);
    setMappingForm({
      companyId: activeCompanies[0]?.id || 'co-kosh-01',
      branchId: 'ALL',
      purchaseOrgId: 'ALL',
      itemCategoryCode: presetPrType === 'CAPEX_ASSET' ? 'CP' : 'ALL',
      prTypeCode: presetPrType,
      isEligible: true,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveUntil: '',
      remarks: '',
    });
    setMappingModalOpen(true);
  };

  const openEditMappingModal = (rec: PRTypeApplicabilityMappingRecord) => {
    setEditingMapping(rec);
    setMappingForm({
      companyId: rec.companyId,
      branchId: rec.branchId,
      purchaseOrgId: rec.purchaseOrgId,
      itemCategoryCode: rec.itemCategoryCode,
      prTypeCode: rec.prTypeCode,
      isEligible: rec.isEligible,
      effectiveFrom: rec.effectiveFrom,
      effectiveUntil: rec.effectiveUntil || '',
      remarks: rec.remarks || '',
    });
    setMappingModalOpen(true);
  };

  const handleSaveMapping = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedPo = purchaseOrgs.find((p) => p.id === mappingForm.purchaseOrgId);
      if (editingMapping) {
        const updated = prTypeMasterService.updateMapping(
          editingMapping.id,
          {
            companyId: mappingForm.companyId,
            branchId: mappingForm.branchId,
            purchaseOrgId: mappingForm.purchaseOrgId,
            purchaseOrgCode: selectedPo?.code || 'ALL',
            purchaseOrgName: selectedPo?.name || 'All Purchase Organizations',
            itemCategoryCode: mappingForm.itemCategoryCode,
            prTypeCode: mappingForm.prTypeCode,
            isEligible: mappingForm.isEligible,
            effectiveFrom: mappingForm.effectiveFrom,
            effectiveUntil: mappingForm.effectiveUntil || undefined,
            remarks: mappingForm.remarks,
          },
          currentUser,
          mappingForm.remarks || undefined
        );
        setNotice({
          type: 'success',
          message: `Updated mapping v${updated.versionNumber} for ${updated.prTypeCode}. Submit for Maker-Checker approval to activate.`,
        });
      } else {
        const created = prTypeMasterService.createMapping(
          {
            companyId: mappingForm.companyId,
            branchId: mappingForm.branchId,
            purchaseOrgId: mappingForm.purchaseOrgId,
            purchaseOrgCode: selectedPo?.code || 'ALL',
            purchaseOrgName: selectedPo?.name || 'All Purchase Organizations',
            itemCategoryCode: mappingForm.itemCategoryCode,
            prTypeCode: mappingForm.prTypeCode,
            isEligible: mappingForm.isEligible,
            effectiveFrom: mappingForm.effectiveFrom,
            effectiveUntil: mappingForm.effectiveUntil || undefined,
            remarks: mappingForm.remarks,
          },
          currentUser
        );
        setNotice({
          type: 'success',
          message: `Created mapping ${created.companyCode} / ${created.branchCode} / ${created.itemCategoryCode} → ${created.prTypeCode} in DRAFT state.`,
        });
      }
      setMappingModalOpen(false);
      bump();
    } catch (err: any) {
      setNotice({ type: 'error', message: err?.message || 'Unable to save mapping.' });
    }
  };

  // =========================================================================
  // REJECTION REASON MODAL (No window.prompt)
  // =========================================================================
  const [rejectTarget, setRejectTarget] = useState<{
    kind: 'PR_TYPE' | 'MAPPING';
    id: string;
    label: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    try {
      if (rejectTarget.kind === 'PR_TYPE') {
        prTypeMasterService.rejectPrType(rejectTarget.id, currentUser, rejectReason);
      } else {
        prTypeMasterService.rejectMapping(rejectTarget.id, currentUser, rejectReason);
      }
      setNotice({
        type: 'warning',
        message: `Rejected ${rejectTarget.label}: ${rejectReason.trim()}`,
      });
      setRejectTarget(null);
      setRejectReason('');
      bump();
    } catch (err: any) {
      setNotice({ type: 'error', message: err?.message || 'Rejection failed.' });
    }
  };

  // =========================================================================
  // TAB 3: VERSION HISTORY
  // =========================================================================
  const [historyFilterKind, setHistoryFilterKind] = useState<
    'ALL' | 'PR_TYPE_MASTER' | 'PR_TYPE_MAPPING'
  >('ALL');
  const [snapshotEntry, setSnapshotEntry] = useState<PRTypeMasterVersionHistoryEntry | null>(null);

  const filteredHistory = useMemo(() => {
    if (historyFilterKind === 'ALL') return historyEntries;
    return historyEntries.filter((h) => h.entityType === historyFilterKind);
  }, [historyEntries, historyFilterKind]);

  const historyGrid = useStandardDataGrid({
    gridId: 'pr-type-master-history',
    userId: currentUser?.id,
    data: filteredHistory,
    defaultSortField: 'timestamp',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
    filterSignature: historyFilterKind,
  });

  // =========================================================================
  // TAB 4: LIVE ELIGIBILITY CHECKER
  // =========================================================================
  const [checkCompanyId, setCheckCompanyId] = useState<string>(
    activeCompanies[0]?.id || 'co-kosh-01'
  );
  const checkCompanyBranches = useMemo(
    () =>
      branches.filter(
        (b) => (b.companyId || 'co-kosh-01') === checkCompanyId && b.lifecycleStatus !== 'INACTIVE'
      ),
    [branches, checkCompanyId]
  );
  const [checkBranchId, setCheckBranchId] = useState<string>(
    checkCompanyBranches[0]?.id || 'br-pond-01'
  );
  const [checkPoId, setCheckPoId] = useState<string>('ALL');
  const [checkCategory, setCheckCategory] = useState<string>('CP');
  const [checkPrType, setCheckPrType] = useState<string>('CAPEX_ASSET');
  const [checkDate, setCheckDate] = useState<string>(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (
      checkCompanyBranches.length > 0 &&
      !checkCompanyBranches.some((b) => b.id === checkBranchId)
    ) {
      setCheckBranchId(checkCompanyBranches[0].id);
    }
  }, [checkCompanyId, checkCompanyBranches, checkBranchId]);

  const checkResult = useMemo(
    () =>
      prTypeMasterService.evaluatePrTypeEligibility({
        companyId: checkCompanyId,
        branchId: checkBranchId,
        purchaseOrgId: checkPoId,
        itemCategoryCode: checkCategory,
        prTypeCode: checkPrType,
        evaluationDate: checkDate,
        userRole: currentUser?.role,
      }),
    [
      refreshTick,
      checkCompanyId,
      checkBranchId,
      checkPoId,
      checkCategory,
      checkPrType,
      checkDate,
      currentUser?.role,
    ]
  );

  // =========================================================================
  // ACTION HELPERS
  // =========================================================================
  const runAction = (fn: () => string) => {
    try {
      const msg = fn();
      setNotice({ type: 'success', message: msg });
      bump();
    } catch (err: any) {
      setNotice({ type: 'error', message: err?.message || 'Action could not be completed.' });
    }
  };

  const renderApprovalText = (status: PRTypeApprovalStatus) => {
    switch (status) {
      case 'APPROVED':
        return <span className="text-emerald-700 font-semibold">Approved</span>;
      case 'PENDING_APPROVAL':
        return <span className="text-amber-700 font-semibold">Pending Approval</span>;
      case 'REJECTED':
        return <span className="text-rose-700 font-semibold">Rejected</span>;
      default:
        return <span className="text-slate-600 font-semibold">Draft</span>;
    }
  };

  const renderStatusText = (status: PRTypeMasterStatus) =>
    status === 'ACTIVE' ? (
      <span className="text-emerald-700 font-semibold">Active</span>
    ) : (
      <span className="text-slate-500 font-semibold">Inactive</span>
    );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>PR Type Master &amp; Eligibility Mapping</span>
          </h3>
          <p className="text-slate-500 mt-1 max-w-3xl">
            Central registry of Purchase Requisition Types (preserving Manual, MRP, Repair, and
            Maintenance while governing Capex / Asset Requisition) and versioned Company, Branch,
            Purchase Organization, and Item Category eligibility mappings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreateTypeModal}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            <span>New PR Type</span>
          </button>
          <button
            type="button"
            onClick={() => openCreateMappingModal('CAPEX_ASSET')}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Eligibility Mapping</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {notice && (
        <div
          className={`px-4 py-3 rounded-lg border flex items-center justify-between gap-3 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : notice.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : notice.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notice.message}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
            className="text-slate-500 hover:text-slate-900 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Segmented Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setSubTab('types')}
            className={`px-3 py-1.5 rounded-md font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              subTab === 'types'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            PR Type Master ({prTypes.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('mappings')}
            className={`px-3 py-1.5 rounded-md font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              subTab === 'mappings'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Company / Branch / Category Mapping ({mappings.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`px-3 py-1.5 rounded-md font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              subTab === 'history'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Version History ({historyEntries.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('checker')}
            className={`px-3 py-1.5 rounded-md font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              subTab === 'checker'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Eligibility Checker</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 flex items-center gap-2 tabular-nums">
          <span>Active Actor:</span>
          <span className="font-semibold text-slate-800">
            {currentUser?.fullName || 'Platform Admin'}
          </span>
          <span aria-hidden="true">·</span>
          <span>Maker-Checker enforced on approvals</span>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SUB-TAB 1: PR TYPE MASTER TABLE                                     */}
      {/* =================================================================== */}
      {subTab === 'types' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Search PR Type Master"
                value={typeSearch}
                onChange={(e) => setTypeSearch(e.target.value)}
                placeholder="Search PR Type code, name, or description..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="text-[11px] text-slate-500 tabular-nums">
              {prTypes.filter((t) => t.status === 'ACTIVE').length} Active ·{' '}
              {prTypes.filter((t) => t.status === 'INACTIVE').length} Inactive
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">PR Type Name &amp; Description</th>
                  <th className="py-2.5 px-3">Governance Attributes</th>
                  <th className="py-2.5 px-3">Effective Dates</th>
                  <th className="py-2.5 px-3 text-right">Ver.</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Approval</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPrTypes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No PR Types match your search query.
                    </td>
                  </tr>
                ) : (
                  filteredPrTypes.map((prt) => (
                    <tr key={prt.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 align-top font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {prt.code}
                      </td>
                      <td className="py-3 px-3 align-top max-w-md">
                        <div className="font-semibold text-slate-900">{prt.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          {prt.description}
                        </div>
                        {prt.rejectionReason && (
                          <div className="text-[11px] text-rose-700 mt-1">
                            Rejection note: {prt.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top text-[11px] text-slate-600">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{prt.isCapexType ? 'Capital Expenditure' : 'Standard PR'}</span>
                          <span aria-hidden="true">·</span>
                          <span>{prt.isSystemType ? 'System Type' : 'Custom'}</span>
                          {prt.requiresAssetClassification && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Asset Classification</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top font-mono tabular-nums text-[11px] text-slate-700 whitespace-nowrap">
                        {prt.effectiveFrom}
                        {prt.effectiveUntil ? ` → ${prt.effectiveUntil}` : ' → Open'}
                      </td>
                      <td className="py-3 px-3 align-top text-right font-mono tabular-nums text-slate-700">
                        v{prt.versionNumber}
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        {renderStatusText(prt.status)}
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        {renderApprovalText(prt.approvalStatus)}
                      </td>
                      <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditTypeModal(prt)}
                            aria-label={`Edit ${prt.name}`}
                            className="px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded cursor-pointer inline-flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          {prt.approvalStatus === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() =>
                                runAction(() => {
                                  const res = prTypeMasterService.submitPrTypeForApproval(
                                    prt.id,
                                    currentUser
                                  );
                                  return `Submitted ${res.code} for Maker-Checker approval.`;
                                })
                              }
                              aria-label={`Submit ${prt.name} for approval`}
                              className="px-2 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded cursor-pointer inline-flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" />
                              <span>Submit</span>
                            </button>
                          )}

                          {prt.approvalStatus === 'PENDING_APPROVAL' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  runAction(() => {
                                    const res = prTypeMasterService.approvePrType(
                                      prt.id,
                                      currentUser,
                                      true
                                    );
                                    return `Approved & activated PR Type ${res.code}.`;
                                  })
                                }
                                aria-label={`Approve ${prt.name}`}
                                className="px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded cursor-pointer inline-flex items-center gap-1"
                              >
                                <ShieldCheck className="w-3 h-3" />
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectTarget({
                                    kind: 'PR_TYPE',
                                    id: prt.id,
                                    label: `${prt.code} (${prt.name})`,
                                  });
                                  setRejectReason('');
                                }}
                                aria-label={`Reject ${prt.name}`}
                                className="px-2 py-1 text-[11px] font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {prt.approvalStatus === 'APPROVED' && (
                            <button
                              type="button"
                              onClick={() =>
                                runAction(() => {
                                  const next: PRTypeMasterStatus =
                                    prt.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                                  const res = prTypeMasterService.togglePrTypeStatus(
                                    prt.id,
                                    next,
                                    currentUser
                                  );
                                  return `${res.code} is now ${res.status}.`;
                                })
                              }
                              aria-label={`${
                                prt.status === 'ACTIVE' ? 'Deactivate' : 'Activate'
                              } ${prt.name}`}
                              className="px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded cursor-pointer inline-flex items-center gap-1"
                            >
                              <Power className="w-3 h-3" />
                              <span>{prt.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 2: COMPANY / BRANCH / PO / ITEM CATEGORY -> PR TYPE MAPPING */}
      {/* =================================================================== */}
      {subTab === 'mappings' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Company
              </label>
              <select
                aria-label="Filter mappings by Company"
                value={mapFilterCompany}
                onChange={(e) => {
                  setMapFilterCompany(e.target.value);
                  setMapFilterBranch('ALL');
                }}
                className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs text-slate-800"
              >
                <option value="ALL">All Companies</option>
                {activeCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Branch
              </label>
              <select
                aria-label="Filter mappings by Branch"
                value={mapFilterBranch}
                onChange={(e) => setMapFilterBranch(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs text-slate-800"
              >
                <option value="ALL">All Branches</option>
                {branches
                  .filter(
                    (b) =>
                      b.lifecycleStatus !== 'INACTIVE' &&
                      (mapFilterCompany === 'ALL' || (b.companyId || 'co-kosh-01') === mapFilterCompany)
                  )
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.portalBranchCode || b.code} — {b.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Item Category
              </label>
              <select
                aria-label="Filter mappings by Item Category"
                value={mapFilterCategory}
                onChange={(e) => setMapFilterCategory(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs text-slate-800"
              >
                <option value="ALL">All Categories</option>
                {itemCategories.map((cat) => (
                  <option key={cat.code} value={cat.code}>
                    {cat.code} — {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                PR Type
              </label>
              <select
                aria-label="Filter mappings by PR Type"
                value={mapFilterPrType}
                onChange={(e) => setMapFilterPrType(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs text-slate-800"
              >
                <option value="ALL">All PR Types</option>
                {prTypes.map((t) => (
                  <option key={t.id} value={t.code}>
                    {t.code} — {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Active Status
              </label>
              <select
                aria-label="Filter mappings by Status"
                value={mapFilterStatus}
                onChange={(e) => setMapFilterStatus(e.target.value as any)}
                className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs text-slate-800"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Approval Status
              </label>
              <select
                aria-label="Filter mappings by Approval Status"
                value={mapFilterApproval}
                onChange={(e) => setMapFilterApproval(e.target.value as any)}
                className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs text-slate-800"
              >
                <option value="ALL">All Approvals</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="DRAFT">Draft</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {/* Mapping Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">Company</th>
                  <th className="py-2.5 px-3">Branch</th>
                  <th className="py-2.5 px-3">Purchase Org</th>
                  <th className="py-2.5 px-3">Item Category</th>
                  <th className="py-2.5 px-3">PR Type</th>
                  <th className="py-2.5 px-3">Rule</th>
                  <th className="py-2.5 px-3">Effective Dates</th>
                  <th className="py-2.5 px-3 text-right">Ver.</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Approval</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mappingGrid.paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-slate-500 space-y-2">
                      <div>
                        No Company / Branch / Category → PR Type mappings match the current filter.
                      </div>
                      <button
                        type="button"
                        onClick={() => openCreateMappingModal('CAPEX_ASSET')}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold text-xs cursor-pointer inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Eligibility Mapping</span>
                      </button>
                    </td>
                  </tr>
                ) : (
                  mappingGrid.paginatedData.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 align-top">
                        <div className="font-medium text-slate-900">{m.companyCode}</div>
                        <div className="text-[11px] text-slate-500">{m.companyName}</div>
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <div className="font-medium text-slate-900">{m.branchCode}</div>
                        <div className="text-[11px] text-slate-500">{m.branchName}</div>
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <div className="font-medium text-slate-900">{m.purchaseOrgCode}</div>
                        <div className="text-[11px] text-slate-500">{m.purchaseOrgName}</div>
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <div className="font-mono font-semibold text-slate-900">
                          {m.itemCategoryCode}
                        </div>
                        <div className="text-[11px] text-slate-500">{m.itemCategoryName}</div>
                      </td>
                      <td className="py-2.5 px-3 align-top font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {m.prTypeCode}
                      </td>
                      <td className="py-2.5 px-3 align-top whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            m.isEligible ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {m.isEligible ? 'Allow' : 'Deny'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 align-top font-mono tabular-nums text-[11px] text-slate-700 whitespace-nowrap">
                        {m.effectiveFrom}
                        {m.effectiveUntil ? ` → ${m.effectiveUntil}` : ' → Open'}
                      </td>
                      <td className="py-2.5 px-3 align-top text-right font-mono tabular-nums text-slate-700">
                        v{m.versionNumber}
                      </td>
                      <td className="py-2.5 px-3 align-top whitespace-nowrap">
                        {renderStatusText(m.status)}
                      </td>
                      <td className="py-2.5 px-3 align-top whitespace-nowrap">
                        {renderApprovalText(m.approvalStatus)}
                      </td>
                      <td className="py-2.5 px-3 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditMappingModal(m)}
                            aria-label={`Edit mapping ${m.id}`}
                            className="px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded cursor-pointer inline-flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          {m.approvalStatus === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() =>
                                runAction(() => {
                                  const res = prTypeMasterService.submitMappingForApproval(
                                    m.id,
                                    currentUser
                                  );
                                  return `Submitted mapping ${res.companyCode}/${res.branchCode}/${res.itemCategoryCode} → ${res.prTypeCode} for approval.`;
                                })
                              }
                              aria-label={`Submit mapping ${m.id}`}
                              className="px-2 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded cursor-pointer inline-flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" />
                              <span>Submit</span>
                            </button>
                          )}

                          {m.approvalStatus === 'PENDING_APPROVAL' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  runAction(() => {
                                    const res = prTypeMasterService.approveMapping(
                                      m.id,
                                      currentUser,
                                      true
                                    );
                                    return `Approved & activated mapping for ${res.prTypeCode} (${res.companyCode}/${res.branchCode}/${res.itemCategoryCode}).`;
                                  })
                                }
                                aria-label={`Approve mapping ${m.id}`}
                                className="px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded cursor-pointer inline-flex items-center gap-1"
                              >
                                <ShieldCheck className="w-3 h-3" />
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectTarget({
                                    kind: 'MAPPING',
                                    id: m.id,
                                    label: `${m.companyCode}/${m.branchCode}/${m.itemCategoryCode} → ${m.prTypeCode}`,
                                  });
                                  setRejectReason('');
                                }}
                                aria-label={`Reject mapping ${m.id}`}
                                className="px-2 py-1 text-[11px] font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {m.approvalStatus === 'APPROVED' && (
                            <button
                              type="button"
                              onClick={() =>
                                runAction(() => {
                                  const next: PRTypeMasterStatus =
                                    m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                                  const res = prTypeMasterService.toggleMappingStatus(
                                    m.id,
                                    next,
                                    currentUser
                                  );
                                  return `Mapping for ${res.prTypeCode} is now ${res.status}.`;
                                })
                              }
                              aria-label={`${
                                m.status === 'ACTIVE' ? 'Deactivate' : 'Activate'
                              } mapping ${m.id}`}
                              className="px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded cursor-pointer inline-flex items-center gap-1"
                            >
                              <Power className="w-3 h-3" />
                              <span>{m.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <DataGridFooter
            currentPage={mappingGrid.currentPage}
            totalPages={mappingGrid.totalPages}
            totalRecords={mappingGrid.totalRecords}
            pageSize={mappingGrid.pageSize}
            onPageChange={mappingGrid.setCurrentPage}
            onPageSizeChange={mappingGrid.setPageSize}
            pageSizeOptions={mappingGrid.pageSizeOptions}
            entityLabel="eligibility mappings"
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 3: VERSION & AUDIT HISTORY                                  */}
      {/* =================================================================== */}
      {subTab === 'history' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              {(['ALL', 'PR_TYPE_MASTER', 'PR_TYPE_MAPPING'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setHistoryFilterKind(kind)}
                  className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
                    historyFilterKind === kind
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {kind === 'ALL'
                    ? 'All Events'
                    : kind === 'PR_TYPE_MASTER'
                    ? 'PR Type Master'
                    : 'Eligibility Mappings'}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Entity</th>
                  <th className="py-2.5 px-3">Record</th>
                  <th className="py-2.5 px-3 text-right">Ver.</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Summary</th>
                  <th className="py-2.5 px-3 text-right">Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyGrid.paginatedData.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono tabular-nums text-[11px] text-slate-600 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] font-medium text-slate-700 whitespace-nowrap">
                      {entry.entityType === 'PR_TYPE_MASTER' ? 'PR Type' : 'Mapping'}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      {entry.entityCodeOrLabel}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      v{entry.versionNumber}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                      {entry.action}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{entry.actorName}</td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-md">{entry.changeSummary}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSnapshotEntry(entry)}
                        aria-label={`View snapshot ${entry.id}`}
                        className="px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DataGridFooter
            currentPage={historyGrid.currentPage}
            totalPages={historyGrid.totalPages}
            totalRecords={historyGrid.totalRecords}
            pageSize={historyGrid.pageSize}
            onPageChange={historyGrid.setCurrentPage}
            onPageSizeChange={historyGrid.setPageSize}
            pageSizeOptions={historyGrid.pageSizeOptions}
            entityLabel="history records"
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 4: LIVE ELIGIBILITY CHECKER                                 */}
      {/* =================================================================== */}
      {subTab === 'checker' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Company</label>
              <select
                value={checkCompanyId}
                onChange={(e) => setCheckCompanyId(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs text-slate-900"
              >
                {activeCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Branch</label>
              <select
                value={checkBranchId}
                onChange={(e) => setCheckBranchId(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs text-slate-900"
              >
                {checkCompanyBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.portalBranchCode || b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Purchase Organization
              </label>
              <select
                value={checkPoId}
                onChange={(e) => setCheckPoId(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs text-slate-900"
              >
                <option value="ALL">All Purchase Organizations</option>
                {purchaseOrgs
                  .filter((p) => p.companyId === checkCompanyId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Item Category
              </label>
              <select
                value={checkCategory}
                onChange={(e) => setCheckCategory(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs text-slate-900"
              >
                {itemCategories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">PR Type</label>
              <select
                value={checkPrType}
                onChange={(e) => setCheckPrType(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs text-slate-900"
              >
                {prTypes.map((t) => (
                  <option key={t.id} value={t.code}>
                    {t.code} — {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Transaction Date
              </label>
              <input
                type="date"
                value={checkDate}
                onChange={(e) => setCheckDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-md font-mono text-xs text-slate-900"
              />
            </div>
          </div>

          <div
            className={`p-4 rounded-lg border flex items-start gap-3 ${
              checkResult.eligible
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}
          >
            {checkResult.eligible ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-semibold text-sm">
                {checkResult.eligible
                  ? `Eligible: ${checkPrType} is permitted for this context`
                  : `Blocked: ${checkPrType} is NOT permitted for this context`}
              </div>
              <div className="text-xs">{checkResult.reason}</div>
              {checkResult.matchedMapping && (
                <div className="text-[11px] font-mono text-slate-600 pt-1">
                  Matched Rule: {checkResult.matchedMapping.id} · v
                  {checkResult.matchedMapping.versionNumber} · Specificity Score:{' '}
                  {checkResult.specificityScore}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CREATE / EDIT PR TYPE                                        */}
      {/* =================================================================== */}
      {typeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePrType}
            className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">
                {editingType ? `Edit PR Type — ${editingType.code}` : 'Create New PR Type'}
              </h4>
              <button
                type="button"
                aria-label="Close PR Type modal"
                onClick={() => setTypeModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PR Type Code *</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingType)}
                    value={typeForm.code}
                    onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. CAPEX_ASSET"
                    className="w-full p-2 border border-slate-300 rounded-md font-mono disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PR Type Name *</label>
                  <input
                    type="text"
                    required
                    value={typeForm.name}
                    onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                    placeholder="e.g. Capex / Asset Requisition"
                    className="w-full p-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description *</label>
                <textarea
                  required
                  rows={3}
                  value={typeForm.description}
                  onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Effective From *
                  </label>
                  <input
                    type="date"
                    required
                    value={typeForm.effectiveFrom}
                    onChange={(e) => setTypeForm({ ...typeForm, effectiveFrom: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Effective Until (Optional)
                  </label>
                  <input
                    type="date"
                    value={typeForm.effectiveUntil}
                    onChange={(e) => setTypeForm({ ...typeForm, effectiveUntil: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={typeForm.isCapexType}
                    onChange={(e) => setTypeForm({ ...typeForm, isCapexType: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="font-medium text-slate-800">
                    Capital Expenditure (Capex) Requisition Type
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={typeForm.requiresAssetClassification}
                    onChange={(e) =>
                      setTypeForm({ ...typeForm, requiresAssetClassification: e.target.checked })
                    }
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="font-medium text-slate-800">
                    Requires Asset Class &amp; Asset Category Classification
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={typeForm.requiresBudgetExceptionFlow}
                    onChange={(e) =>
                      setTypeForm({ ...typeForm, requiresBudgetExceptionFlow: e.target.checked })
                    }
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="font-medium text-slate-800">
                    Requires Budget Exception Approval Flow
                  </span>
                </label>
              </div>

              {editingType && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Change Summary / Audit Reason
                  </label>
                  <input
                    type="text"
                    value={typeForm.changeReason}
                    onChange={(e) => setTypeForm({ ...typeForm, changeReason: e.target.value })}
                    placeholder="Reason for updating PR Type Master..."
                    className="w-full p-2 border border-slate-300 rounded-md"
                  />
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTypeModalOpen(false)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                {editingType ? 'Save as Draft Version' : 'Create Draft PR Type'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CREATE / EDIT ELIGIBILITY MAPPING                            */}
      {/* =================================================================== */}
      {mappingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveMapping}
            className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-xl w-full overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">
                {editingMapping
                  ? `Edit Eligibility Mapping (v${editingMapping.versionNumber})`
                  : 'Add Company / Branch / Category → PR Type Mapping'}
              </h4>
              <button
                type="button"
                aria-label="Close mapping modal"
                onClick={() => setMappingModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company *</label>
                  <select
                    value={mappingForm.companyId}
                    onChange={(e) =>
                      setMappingForm({
                        ...mappingForm,
                        companyId: e.target.value,
                        branchId: 'ALL',
                        purchaseOrgId: 'ALL',
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-md"
                  >
                    <option value="ALL">All Companies</option>
                    {activeCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Branch *</label>
                  <select
                    value={mappingForm.branchId}
                    onChange={(e) => setMappingForm({ ...mappingForm, branchId: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-md"
                  >
                    <option value="ALL">All Branches</option>
                    {modalCompanyBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.portalBranchCode || b.code} — {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Purchase Organization
                  </label>
                  <select
                    value={mappingForm.purchaseOrgId}
                    onChange={(e) =>
                      setMappingForm({ ...mappingForm, purchaseOrgId: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-md"
                  >
                    <option value="ALL">All Purchase Organizations</option>
                    {modalCompanyPurchaseOrgs.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.code} — {po.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Item Category *</label>
                  <select
                    value={mappingForm.itemCategoryCode}
                    onChange={(e) =>
                      setMappingForm({ ...mappingForm, itemCategoryCode: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-md"
                  >
                    <option value="ALL">All Item Categories</option>
                    {itemCategories.map((cat) => (
                      <option key={cat.code} value={cat.code}>
                        {cat.code} — {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PR Type *</label>
                  <select
                    value={mappingForm.prTypeCode}
                    onChange={(e) => setMappingForm({ ...mappingForm, prTypeCode: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-md font-mono"
                  >
                    {prTypes.map((t) => (
                      <option key={t.id} value={t.code}>
                        {t.code} — {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Eligibility Decision *
                  </label>
                  <select
                    value={mappingForm.isEligible ? 'ALLOW' : 'DENY'}
                    onChange={(e) =>
                      setMappingForm({ ...mappingForm, isEligible: e.target.value === 'ALLOW' })
                    }
                    className="w-full p-2 border border-slate-300 rounded-md font-semibold"
                  >
                    <option value="ALLOW">ALLOW — Eligible for PR Creation</option>
                    <option value="DENY">DENY — Explicitly Restricted</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Effective From *
                  </label>
                  <input
                    type="date"
                    required
                    value={mappingForm.effectiveFrom}
                    onChange={(e) =>
                      setMappingForm({ ...mappingForm, effectiveFrom: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Effective Until (Optional)
                  </label>
                  <input
                    type="date"
                    value={mappingForm.effectiveUntil}
                    onChange={(e) =>
                      setMappingForm({ ...mappingForm, effectiveUntil: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Governance Remarks / Audit Note
                </label>
                <input
                  type="text"
                  value={mappingForm.remarks}
                  onChange={(e) => setMappingForm({ ...mappingForm, remarks: e.target.value })}
                  placeholder="e.g. Authorized Capital Equipment PR scope for Puducherry Plant"
                  className="w-full p-2 border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMappingModalOpen(false)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                {editingMapping ? 'Save Draft Revision' : 'Create Draft Mapping'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: MANDATORY REJECTION REASON                                   */}
      {/* =================================================================== */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmReject}
            className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">Reject {rejectTarget.label}</h4>
              <button
                type="button"
                aria-label="Close reject modal"
                onClick={() => setRejectTarget(null)}
                className="text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-2 text-xs">
              <label className="block font-semibold text-slate-700">
                Mandatory Rejection Reason *
              </label>
              <textarea
                required
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter specific governance reason for rejection..."
                className="w-full p-2 border border-slate-300 rounded-md"
              />
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: VERSION SNAPSHOT INSPECTOR                                   */}
      {/* =================================================================== */}
      {snapshotEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Version Snapshot — {snapshotEntry.entityCodeOrLabel} (v
                  {snapshotEntry.versionNumber})
                </h4>
                <p className="text-[11px] text-slate-500">
                  {snapshotEntry.action} by {snapshotEntry.actorName} ·{' '}
                  {new Date(snapshotEntry.timestamp).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close snapshot modal"
                onClick={() => setSnapshotEntry(null)}
                className="text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3 text-xs">
              {snapshotEntry.previousSnapshot && (
                <div>
                  <div className="font-semibold text-slate-700 mb-1">Previous Snapshot</div>
                  <pre className="p-3 bg-slate-50 border border-slate-200 rounded-lg overflow-x-auto font-mono text-[11px] text-slate-700">
                    {JSON.stringify(snapshotEntry.previousSnapshot, null, 2)}
                  </pre>
                </div>
              )}
              <div>
                <div className="font-semibold text-slate-700 mb-1">New Snapshot</div>
                <pre className="p-3 bg-slate-50 border border-slate-200 rounded-lg overflow-x-auto font-mono text-[11px] text-slate-900">
                  {JSON.stringify(snapshotEntry.newSnapshot, null, 2)}
                </pre>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSnapshotEntry(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
