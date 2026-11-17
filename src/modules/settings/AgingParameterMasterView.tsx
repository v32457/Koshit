import React, { useState, useMemo } from 'react';
import {
  Clock,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Check,
  XCircle,
  Copy,
  Edit,
  Trash2,
  Sliders,
  Building2,
  Calendar,
  Layers,
  Shield,
  Tag,
  CheckCircle,
  FileText,
} from 'lucide-react';
import {
  AgingParameterConfig,
  AgingBasis,
  AgingBucketRange,
  ApplicableModuleKey,
  INTEGRATED_MODULES_LIST,
} from '../../types/agingParameter';
import {
  AgingParameterService,
  DEFAULT_AGING_BUCKETS,
} from '../../services/agingParameterService';
import { Company, Branch, User } from '../../types';
import { INITIAL_COMPANIES, INITIAL_BRANCHES } from '../../data/seedData';
import { DataGridFooter } from '../../components/DataGridFooter';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import {
  inventoryAgingService,
  StockAgingPolicyConfig,
  DEFAULT_STOCK_AGING_BUCKETS,
} from '../../services/inventoryAgingService';
import {
  prAgingService,
  PrAgingPolicyConfig,
  PrAgingBasis,
  DEFAULT_PR_AGING_BUCKETS,
} from '../../services/prAgingService';
import { PRPriority, PRType } from '../../types/purchaseRequisition';

interface AgingParameterMasterViewProps {
  embedded?: boolean; // If embedded inside GeneralSettingsView
  currentUser?: User;
}

export const AgingParameterMasterView: React.FC<AgingParameterMasterViewProps> = ({
  embedded = false,
  currentUser,
}) => {
  const [activeAgingTab, setActiveAgingTab] = useState<'FINANCIAL' | 'STOCK_AGING' | 'PR_AGING'>('FINANCIAL');
  // Configs state
  const [configs, setConfigs] = useState<AgingParameterConfig[]>(() => AgingParameterService.getConfigs());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [basisFilter, setBasisFilter] = useState<'ALL' | AgingBasis>('ALL');

  // Company and Branch Master
  const [companies] = useState<Company[]>(() => {
    try {
      const stored = localStorage.getItem('kosh_companies');
      return stored ? JSON.parse(stored) : INITIAL_COMPANIES;
    } catch {
      return INITIAL_COMPANIES;
    }
  });

  const [branches] = useState<Branch[]>(() => {
    try {
      const stored = localStorage.getItem('kosh_branches');
      return stored ? JSON.parse(stored) : INITIAL_BRANCHES;
    } catch {
      return INITIAL_BRANCHES;
    }
  });

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companies[0]?.id || 'co-kosh-01');

  // Filtered Configs
  const filteredConfigs = useMemo(() => {
    return configs.filter((c) => {
      if (selectedCompanyId !== 'ALL' && c.companyId !== selectedCompanyId && c.companyId !== 'ALL') {
        return false;
      }
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (basisFilter !== 'ALL' && c.agingBasis !== basisFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCode = c.code.toLowerCase().includes(q);
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesDesc = c.description.toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [configs, selectedCompanyId, statusFilter, basisFilter, searchQuery]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AgingParameterConfig | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Standardized Grid Pagination + Default DESC Sort for Financial Aging Configs
  const financialGrid = useStandardDataGrid({
    gridId: 'aging-parameter-financial',
    userId: currentUser?.id || 'usr-default',
    data: filteredConfigs,
    defaultSortField: 'updatedAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'code',
    filterSignature: `${selectedCompanyId}|${statusFilter}|${basisFilter}|${searchQuery}`,
  });

  // ============================================================================
  // TAB 2: INVENTORY STOCK AGING POLICIES STATE
  // ============================================================================
  const [stockPolicies, setStockPolicies] = useState<StockAgingPolicyConfig[]>(() =>
    inventoryAgingService.getPolicies()
  );
  const [stockScopeBranch, setStockScopeBranch] = useState<string>('ALL');
  const [stockScopeWarehouse, setStockScopeWarehouse] = useState<string>('ALL');
  const [stockScopeCategory, setStockScopeCategory] = useState<string>('ALL');
  const [stockDraft, setStockDraft] = useState<StockAgingPolicyConfig>(() =>
    inventoryAgingService.getEffectivePolicy({ companyId: companies[0]?.id || 'co-kosh-01' })
  );

  const companyBranches = useMemo(
    () => branches.filter((b) => b.orgId === selectedCompanyId || selectedCompanyId === 'ALL'),
    [branches, selectedCompanyId]
  );

  const availableWarehouses = useMemo(() => {
    const list: Array<{ code: string; name: string }> = [];
    companyBranches.forEach((b) => {
      (b.warehouses || []).forEach((w) => {
        if (!list.some((x) => x.code === w.warehouseCode)) {
          list.push({ code: w.warehouseCode, name: `${w.warehouseName} (${b.name})` });
        }
      });
    });
    return list;
  }, [companyBranches]);

  const handleLoadStockPolicy = (
    compId = selectedCompanyId,
    brId = stockScopeBranch,
    whCode = stockScopeWarehouse,
    cat = stockScopeCategory
  ) => {
    const eff = inventoryAgingService.getEffectivePolicy({
      companyId: compId === 'ALL' ? 'co-kosh-01' : compId,
      branchId: brId,
      warehouseCode: whCode,
      itemCategory: cat,
    });
    setStockDraft({
      ...eff,
      branchId: brId,
      warehouseCode: whCode,
      itemCategory: cat,
    });
  };

  const handleSaveStockPolicy = () => {
    try {
      const saved = inventoryAgingService.savePolicyConfig(
        {
          companyId: selectedCompanyId === 'ALL' ? 'co-kosh-01' : selectedCompanyId,
          branchId: stockScopeBranch,
          warehouseCode: stockScopeWarehouse,
          itemCategory: stockScopeCategory,
          isEnabled: stockDraft.isEnabled,
          expiryValidationEnabled: stockDraft.expiryValidationEnabled,
          excludeExpiredFromAvailable: stockDraft.excludeExpiredFromAvailable,
          nearExpiryThresholdDays: Number(stockDraft.nearExpiryThresholdDays) || 30,
          secondaryExpiryThresholdDays: Number(stockDraft.secondaryExpiryThresholdDays) || 60,
          criticalExpiryThresholdDays: Number(stockDraft.criticalExpiryThresholdDays) || 90,
          issueMethod: stockDraft.issueMethod,
          buckets: stockDraft.buckets,
          effectiveFrom: stockDraft.effectiveFrom || new Date().toISOString().slice(0, 10),
          updatedBy: currentUser?.fullName || 'Platform Governance Admin',
          changeReason: stockDraft.changeReason || 'Stock Aging Policy Configuration Update',
        },
        { id: currentUser?.id || 'usr-admin', name: currentUser?.fullName || 'Platform Governance Admin' },
        currentUser
      );
      setStockPolicies(inventoryAgingService.getPolicies());
      setStockDraft(saved);
      showNotice('success', `Saved Inventory Stock Aging Policy v${saved.version} (${saved.issueMethod}).`);
    } catch (err: any) {
      showNotice('error', err?.message || 'Unable to save Stock Aging Policy.');
    }
  };

  const stockPolicyGrid = useStandardDataGrid({
    gridId: 'stock-aging-policy-history',
    userId: currentUser?.id || 'usr-default',
    data: stockPolicies,
    defaultSortField: 'updatedAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
  });

  // ============================================================================
  // TAB 3: SEPARATE PR AGING POLICIES STATE
  // ============================================================================
  const [prPolicies, setPrPolicies] = useState<PrAgingPolicyConfig[]>(() =>
    prAgingService.getPolicies()
  );
  const [prScopeBranch, setPrScopeBranch] = useState<string>('ALL');
  const [prScopeType, setPrScopeType] = useState<PRType | 'ALL'>('ALL');
  const [prScopePriority, setPrScopePriority] = useState<PRPriority | 'ALL'>('ALL');
  const [prDraft, setPrDraft] = useState<PrAgingPolicyConfig>(() =>
    prAgingService.getEffectivePolicy({ companyId: companies[0]?.id || 'co-kosh-01' })
  );

  const handleLoadPrPolicy = (
    compId = selectedCompanyId,
    brId = prScopeBranch,
    prType: PRType | 'ALL' = prScopeType,
    priority: PRPriority | 'ALL' = prScopePriority
  ) => {
    const eff = prAgingService.getEffectivePolicy({
      companyId: compId === 'ALL' ? 'co-kosh-01' : compId,
      branchId: brId,
      prType: prType === 'ALL' ? undefined : prType,
      priority: priority === 'ALL' ? undefined : priority,
    });
    setPrDraft({
      ...eff,
      branchId: brId,
      prType,
      priority,
    });
  };

  const handleSavePrPolicy = () => {
    try {
      const saved = prAgingService.savePolicyConfig(
        {
          companyId: selectedCompanyId === 'ALL' ? 'co-kosh-01' : selectedCompanyId,
          branchId: prScopeBranch,
          purchaseOrgId: 'ALL',
          prType: prScopeType,
          priority: prScopePriority,
          isEnabled: prDraft.isEnabled,
          agingBasis: prDraft.agingBasis,
          excludeDrafts: prDraft.excludeDrafts,
          excludeTerminalClosed: prDraft.excludeTerminalClosed,
          buckets: prDraft.buckets,
          stageSlaDays: prDraft.stageSlaDays,
          escalationThresholdDays: Number(prDraft.escalationThresholdDays) || 7,
          effectiveFrom: prDraft.effectiveFrom || new Date().toISOString().slice(0, 10),
          updatedBy: currentUser?.fullName || 'Platform Governance Admin',
          changeReason: prDraft.changeReason || 'Separate PR Aging Policy Configuration Update',
        },
        { id: currentUser?.id || 'usr-admin', name: currentUser?.fullName || 'Platform Governance Admin' },
        currentUser
      );
      setPrPolicies(prAgingService.getPolicies());
      setPrDraft(saved);
      showNotice('success', `Saved PR Aging Policy v${saved.version} (Basis: ${saved.agingBasis}).`);
    } catch (err: any) {
      showNotice('error', err?.message || 'Unable to save PR Aging Policy.');
    }
  };

  const prPolicyGrid = useStandardDataGrid({
    gridId: 'pr-aging-policy-history',
    userId: currentUser?.id || 'usr-default',
    data: prPolicies,
    defaultSortField: 'updatedAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
  });

  // Handlers
  const handleOpenCreateModal = () => {
    const nextNum = configs.length + 1;
    const newCode = `AGE-STD-0${nextNum}`;
    setEditingConfig({
      id: `age-cfg-${Date.now()}`,
      code: newCode,
      name: `Custom Enterprise Aging Parameter #${nextNum}`,
      description: 'Defined aging bucket ranges for financial and operational transaction analysis.',
      companyId: selectedCompanyId === 'ALL' ? 'co-kosh-01' : selectedCompanyId,
      branchId: 'ALL',
      agingBasis: 'DUE_DATE',
      buckets: JSON.parse(JSON.stringify(DEFAULT_AGING_BUCKETS)),
      status: 'ACTIVE',
      isDefault: false,
      applicableModules: ['AP_AGING', 'AR_AGING', 'VENDOR_OUTSTANDING', 'CUSTOMER_OUTSTANDING'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: 'Platform Admin',
    });
    setNotice(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (config: AgingParameterConfig) => {
    setEditingConfig(JSON.parse(JSON.stringify(config)));
    setNotice(null);
    setIsModalOpen(true);
  };

  const handleCloneConfig = (config: AgingParameterConfig) => {
    const cloned: AgingParameterConfig = {
      ...JSON.parse(JSON.stringify(config)),
      id: `age-cfg-${Date.now()}`,
      code: `${config.code}-COPY`,
      name: `${config.name} (Copy)`,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: 'Platform Admin',
    };
    const res = AgingParameterService.saveOrUpdateConfig(cloned);
    if (res.success) {
      setConfigs(AgingParameterService.getConfigs());
      showNotice('success', `Configuration duplicated as "${cloned.code}".`);
    } else {
      showNotice('error', res.message);
    }
  };

  const handleToggleStatus = (id: string) => {
    const res = AgingParameterService.toggleStatus(id);
    if (res.success) {
      setConfigs(AgingParameterService.getConfigs());
      showNotice('success', res.message);
    } else {
      showNotice('error', res.message);
    }
  };

  const handleDeleteConfig = (id: string) => {
    if (confirm('Are you sure you want to delete this aging parameter configuration?')) {
      const res = AgingParameterService.deleteConfig(id);
      if (res.success) {
        setConfigs(AgingParameterService.getConfigs());
        showNotice('success', res.message);
      } else {
        showNotice('error', res.message);
      }
    }
  };

  const handleSaveModal = () => {
    if (!editingConfig) return;
    if (!editingConfig.code.trim() || !editingConfig.name.trim()) {
      showNotice('error', 'Aging Parameter Code and Name are required.');
      return;
    }

    const res = AgingParameterService.saveOrUpdateConfig(editingConfig);
    if (res.success) {
      setConfigs(AgingParameterService.getConfigs());
      setIsModalOpen(false);
      setEditingConfig(null);
      showNotice('success', res.message);
    } else {
      showNotice('error', res.message);
    }
  };

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 4000);
  };

  // Bucket Validation status inside modal
  const modalValidation = useMemo(() => {
    if (!editingConfig) return { valid: true, message: '' };
    return AgingParameterService.validateBuckets(editingConfig.buckets);
  }, [editingConfig?.buckets]);

  const handleUpdateBucketDays = (index: number, field: 'fromDays' | 'toDays' | 'label', val: any) => {
    if (!editingConfig) return;
    const newBuckets = [...editingConfig.buckets];
    if (field === 'label') {
      newBuckets[index].label = val;
    } else {
      const numVal = Math.max(0, parseInt(val) || 0);
      newBuckets[index][field] = numVal;

      // Auto-adjust next bucket fromDays if modifying toDays of previous
      if (field === 'toDays' && index < newBuckets.length - 1) {
        newBuckets[index + 1].fromDays = numVal + 1;
      }
    }
    setEditingConfig({ ...editingConfig, buckets: newBuckets });
  };

  const getAgingBasisBadge = (basis: AgingBasis) => {
    switch (basis) {
      case 'DUE_DATE':
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded text-[10px]">Due Date Basis</span>;
      case 'DOCUMENT_DATE':
        return <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold rounded text-[10px]">Document Date Basis</span>;
      case 'POSTING_DATE':
        return <span className="px-2 py-0.5 bg-purple-100 text-purple-900 border border-purple-300 font-bold rounded text-[10px]">Posting Date Basis</span>;
    }
  };

  return (
    <div className={`space-y-5 text-xs font-sans select-none ${embedded ? '' : 'bg-white rounded-xl border border-slate-200 p-6 shadow-xs max-w-6xl'}`}>
      {/* Header Banner */}
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Aging Parameter
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure standardized aging bucket intervals (Current, 1–30d, 31–60d, 61–90d, 91–120d, 121–180d, &gt;180d) across Accounts Payable, Accounts Receivable, Procurement, and Sales outstanding reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeAgingTab === 'FINANCIAL' && (
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create Aging Parameter
            </button>
          )}
        </div>
      </div>

      {/* Independent Aging Engines Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveAgingTab('FINANCIAL')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeAgingTab === 'FINANCIAL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-white'
            }`}
          >
            Financial & AP/AR Aging ({configs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveAgingTab('STOCK_AGING')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeAgingTab === 'STOCK_AGING'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-white'
            }`}
          >
            Inventory Stock Aging & Expiry Policies ({stockPolicies.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveAgingTab('PR_AGING')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeAgingTab === 'PR_AGING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-white'
            }`}
          >
            PR Aging & Stage SLA Policies ({prPolicies.length})
          </button>
        </div>

        <div className="flex items-center gap-2 px-2">
          <Building2 className="w-3.5 h-3.5 text-indigo-600" />
          <select
            value={selectedCompanyId}
            onChange={(e) => {
              const cid = e.target.value;
              setSelectedCompanyId(cid);
              handleLoadStockPolicy(cid, 'ALL', 'ALL', 'ALL');
              handleLoadPrPolicy(cid, 'ALL', 'ALL', 'ALL');
            }}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 cursor-pointer"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          className={`p-3.5 rounded-xl border font-bold flex items-center gap-2 text-xs ${
            notice.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {notice.type === 'success' ? <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0" />}
          <span>{notice.message}</span>
        </div>
      )}

      {activeAgingTab === 'FINANCIAL' && (
        <>

      {/* Scope & Search Filter Toolbar */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Aging Basis Filter */}
          <div className="flex items-center gap-2 bg-white border border-slate-300 px-3 py-1.5 rounded-lg shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-purple-600" />
            <span className="font-bold text-slate-700">Aging Basis:</span>
            <select
              value={basisFilter}
              onChange={(e) => setBasisFilter(e.target.value as any)}
              className="bg-transparent font-bold text-slate-900 cursor-pointer focus:outline-hidden text-xs"
            >
              <option value="ALL">All Calculation Bases</option>
              <option value="DUE_DATE">Due Date</option>
              <option value="DOCUMENT_DATE">Document Date</option>
              <option value="POSTING_DATE">Posting Date</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-white border border-slate-300 px-3 py-1.5 rounded-lg shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-bold text-slate-700">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent font-bold text-slate-900 cursor-pointer focus:outline-hidden text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Search input */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search parameter code, name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
          />
        </div>
      </div>

      {/* Active Aging Configurations List Cards */}
      <div className="space-y-4">
        {financialGrid.pagedData.length === 0 ? (
          <div className="p-8 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
            <Clock className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="font-bold text-slate-700 text-sm">No Aging Parameter configurations found</p>
            <p className="text-slate-500 text-xs">Try adjusting your filters or create a new aging parameter master.</p>
          </div>
        ) : (
          financialGrid.pagedData.map((cfg) => (
            <div key={cfg.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3 hover:border-slate-300 transition">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 bg-indigo-900 text-white font-mono font-extrabold rounded-lg text-xs tracking-wider shadow-2xs">
                    {cfg.code}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-slate-900 text-sm">{cfg.name}</h3>
                      {cfg.isDefault && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 font-bold rounded text-[10px]">
                          Default Scope Parameter
                        </span>
                      )}
                      {getAgingBasisBadge(cfg.agingBasis)}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{cfg.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Status Toggle */}
                  <button
                    onClick={() => handleToggleStatus(cfg.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition flex items-center gap-1 ${
                      cfg.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {cfg.status === 'ACTIVE' ? <CheckCircle className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-500" />}
                    <span>{cfg.status}</span>
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(cfg)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-indigo-700 border border-slate-300 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow-2xs"
                  >
                    <Edit className="w-3.5 h-3.5 text-indigo-600" /> Edit
                  </button>

                  <button
                    onClick={() => handleCloneConfig(cfg)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow-2xs"
                    title="Duplicate Configuration"
                  >
                    <Copy className="w-3.5 h-3.5 text-purple-600" /> Clone
                  </button>

                  {!cfg.isDefault && (
                    <button
                      onClick={() => handleDeleteConfig(cfg.id)}
                      className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition"
                      title="Delete Configuration"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Bucket Breakdown Visualization Bar */}
              <div className="space-y-1.5 pt-1">
                <span className="font-bold text-slate-700 text-[11px] block">Defined Aging Buckets Range Boundaries:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {cfg.buckets.map((b) => (
                    <div key={b.bucketIndex} className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-center space-y-0.5">
                      <span className="text-[10px] font-bold text-indigo-700 block truncate">{b.label}</span>
                      <span className="font-mono text-[10px] text-slate-600 block">
                        {b.bucketIndex === 0 ? 'Day 0 (Not Due)' : b.bucketIndex === 6 ? `> ${b.fromDays - 1} Days` : `${b.fromDays}–${b.toDays}d`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Applicable Integrated Modules Tags */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-slate-500 font-bold text-[10px]">Assigned Modules:</span>
                  {cfg.applicableModules.map((mKey) => {
                    const info = INTEGRATED_MODULES_LIST.find((m) => m.key === mKey);
                    return (
                      <span key={mKey} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 font-medium text-[10px]">
                        {info?.label || mKey}
                      </span>
                    );
                  })}
                </div>

                <span className="text-[10px] text-slate-400 font-mono">
                  Updated by {cfg.updatedBy} on {new Date(cfg.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      <DataGridFooter
        currentPage={financialGrid.currentPage}
        totalPages={financialGrid.totalPages}
        pageSize={financialGrid.pageSize}
        totalRecords={financialGrid.totalRecords}
        onPageChange={financialGrid.setCurrentPage}
        onPageSizeChange={financialGrid.setPageSize}
        defaultSortNotice="Default Sort: Newest Updated First (DESC)"
      />
      </>
      )}

      {/* TAB 2: INVENTORY STOCK AGING & EXPIRY POLICIES */}
      {activeAgingTab === 'STOCK_AGING' && (
        <div className="space-y-4">
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-emerald-950 text-sm">
                  Inventory Stock Aging & Shelf-Life Policy Configuration (v{stockDraft.version})
                </h3>
                <p className="text-[11px] text-emerald-800">
                  Strictly independent from PR Aging. Missing batch receipt dates show &ldquo;Data Unavailable&rdquo;; non-expiring items show &ldquo;Not Applicable&rdquo;.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveStockPolicy}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Save Stock Aging Version
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Branch Scope</label>
                <select
                  value={stockScopeBranch}
                  onChange={(e) => {
                    setStockScopeBranch(e.target.value);
                    handleLoadStockPolicy(selectedCompanyId, e.target.value, stockScopeWarehouse, stockScopeCategory);
                  }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs"
                >
                  <option value="ALL">All Branches (Company Default)</option>
                  {companyBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Warehouse Scope</label>
                <select
                  value={stockScopeWarehouse}
                  onChange={(e) => {
                    setStockScopeWarehouse(e.target.value);
                    handleLoadStockPolicy(selectedCompanyId, stockScopeBranch, e.target.value, stockScopeCategory);
                  }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs"
                >
                  <option value="ALL">All Warehouses</option>
                  {availableWarehouses.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Item Category Scope</label>
                <select
                  value={stockScopeCategory}
                  onChange={(e) => {
                    setStockScopeCategory(e.target.value);
                    handleLoadStockPolicy(selectedCompanyId, stockScopeBranch, stockScopeWarehouse, e.target.value);
                  }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Raw Materials">Raw Materials</option>
                  <option value="Consumables">Consumables</option>
                  <option value="Spare Parts">Spare Parts</option>
                  <option value="Chemicals & Adhesives">Chemicals & Adhesives</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-emerald-200">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Issue Sequence Rule</label>
                <select
                  value={stockDraft.issueMethod}
                  onChange={(e) => setStockDraft({ ...stockDraft, issueMethod: e.target.value as 'FIFO' | 'FEFO' })}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs"
                >
                  <option value="FEFO">FEFO (Earliest Expiry First)</option>
                  <option value="FIFO">FIFO (Oldest Receipt First)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Near-Expiry Warning (Days)</label>
                <input
                  type="number"
                  min={1}
                  value={stockDraft.nearExpiryThresholdDays}
                  onChange={(e) => setStockDraft({ ...stockDraft, nearExpiryThresholdDays: Number(e.target.value) || 30 })}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs"
                />
              </div>
              <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer pt-5">
                <input
                  type="checkbox"
                  checked={stockDraft.expiryValidationEnabled}
                  onChange={(e) => setStockDraft({ ...stockDraft, expiryValidationEnabled: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span>Enable Expiry Checks</span>
              </label>
              <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer pt-5">
                <input
                  type="checkbox"
                  checked={stockDraft.excludeExpiredFromAvailable}
                  onChange={(e) => setStockDraft({ ...stockDraft, excludeExpiredFromAvailable: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span>Exclude Expired from Available</span>
              </label>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
              <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-800">Editable Stock Aging Buckets</span>
                <button
                  type="button"
                  onClick={() => setStockDraft({ ...stockDraft, buckets: JSON.parse(JSON.stringify(DEFAULT_STOCK_AGING_BUCKETS)) })}
                  className="text-[11px] font-bold text-indigo-600 underline cursor-pointer"
                >
                  Reset 0–30 / 31–90 / 91–180 / 181–365 / &gt;365
                </button>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase border-b border-slate-200">
                    <th className="p-2.5">Bucket Key</th>
                    <th className="p-2.5">Label</th>
                    <th className="p-2.5 text-center">From Days</th>
                    <th className="p-2.5 text-center">To Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockDraft.buckets.map((bk, idx) => (
                    <tr key={bk.key}>
                      <td className="p-2.5 font-mono font-bold text-slate-700">{bk.key}</td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={bk.label}
                          onChange={(e) => {
                            const next = [...stockDraft.buckets];
                            next[idx] = { ...next[idx], label: e.target.value };
                            setStockDraft({ ...stockDraft, buckets: next });
                          }}
                          className="w-full p-1.5 border border-slate-300 rounded font-semibold"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min={0}
                          disabled={idx === 0}
                          value={bk.fromDays}
                          onChange={(e) => {
                            const next = [...stockDraft.buckets];
                            next[idx] = { ...next[idx], fromDays: Number(e.target.value) || 0 };
                            setStockDraft({ ...stockDraft, buckets: next });
                          }}
                          className="w-20 p-1.5 border border-slate-300 rounded text-center font-mono font-bold disabled:bg-slate-100"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min={0}
                          value={bk.toDays}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            const next = [...stockDraft.buckets];
                            next[idx] = { ...next[idx], toDays: v };
                            if (idx < next.length - 1) {
                              next[idx + 1] = { ...next[idx + 1], fromDays: v + 1 };
                            }
                            setStockDraft({ ...stockDraft, buckets: next });
                          }}
                          className="w-24 p-1.5 border border-slate-300 rounded text-center font-mono font-bold"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-800">
              Stock Aging Policy Versions (Sorted Newest First DESC)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase border-b border-slate-200">
                    <th className="p-2.5">Version</th>
                    <th className="p-2.5">Scope</th>
                    <th className="p-2.5">Issue Method</th>
                    <th className="p-2.5">Near Expiry</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockPolicyGrid.pagedData.map((p) => (
                    <tr key={p.id}>
                      <td className="p-2.5 font-mono font-bold">v{p.version}</td>
                      <td className="p-2.5">{p.companyId} / {p.branchId} / {p.warehouseCode} / {p.itemCategory}</td>
                      <td className="p-2.5 font-bold">{p.issueMethod}</td>
                      <td className="p-2.5 font-mono">{p.nearExpiryThresholdDays}d</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-slate-500">{p.updatedAt.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DataGridFooter
            currentPage={stockPolicyGrid.currentPage}
            totalPages={stockPolicyGrid.totalPages}
            pageSize={stockPolicyGrid.pageSize}
            totalRecords={stockPolicyGrid.totalRecords}
            onPageChange={stockPolicyGrid.setCurrentPage}
            onPageSizeChange={stockPolicyGrid.setPageSize}
            defaultSortNotice="Default Sort: Newest Versions First (DESC)"
          />
        </div>
      )}

      {/* TAB 3: SEPARATE PR AGING & STAGE SLA POLICIES */}
      {activeAgingTab === 'PR_AGING' && (
        <div className="space-y-4">
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-amber-950 text-sm">
                  Purchase Requisition (PR) Pending & Stage Aging Policy (v{prDraft.version})
                </h3>
                <p className="text-[11px] text-amber-800">
                  Strictly separated from Stock Aging. Draft PRs and Closed/Cancelled PRs are excluded from active pending aging.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSavePrPolicy}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Save PR Aging Version
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Branch Scope</label>
                <select
                  value={prScopeBranch}
                  onChange={(e) => {
                    setPrScopeBranch(e.target.value);
                    handleLoadPrPolicy(selectedCompanyId, e.target.value, prScopeType, prScopePriority);
                  }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs"
                >
                  <option value="ALL">All Branches</option>
                  {companyBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">PR Type</label>
                <select
                  value={prScopeType}
                  onChange={(e) => {
                    const t = e.target.value as PRType | 'ALL';
                    setPrScopeType(t);
                    handleLoadPrPolicy(selectedCompanyId, prScopeBranch, t, prScopePriority);
                  }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs"
                >
                  <option value="ALL">All PR Types</option>
                  <option value="MANUAL">Manual</option>
                  <option value="MRP">MRP</option>
                  <option value="REPAIR">Repair</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="CAPEX_ASSET">Capex / Asset</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">PR Priority</label>
                <select
                  value={prScopePriority}
                  onChange={(e) => {
                    const p = e.target.value as PRPriority | 'ALL';
                    setPrScopePriority(p);
                    handleLoadPrPolicy(selectedCompanyId, prScopeBranch, prScopeType, p);
                  }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-amber-200">
              <div>
                <label className="block font-bold text-slate-700 mb-1">PR Aging Calculation Basis</label>
                <select
                  value={prDraft.agingBasis}
                  onChange={(e) => setPrDraft({ ...prDraft, agingBasis: e.target.value as PrAgingBasis })}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs"
                >
                  <option value="SUBMITTED_DATE">PR Submitted Date (Default)</option>
                  <option value="CREATED_DATE">PR Created Date</option>
                  <option value="STAGE_ENTERED_DATE">Current Stage Entered Date</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Escalation Threshold (Days)</label>
                <input
                  type="number"
                  min={1}
                  value={prDraft.escalationThresholdDays}
                  onChange={(e) => setPrDraft({ ...prDraft, escalationThresholdDays: Number(e.target.value) || 7 })}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs"
                />
              </div>
              <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer pt-5">
                <input
                  type="checkbox"
                  checked={prDraft.excludeDrafts}
                  onChange={(e) => setPrDraft({ ...prDraft, excludeDrafts: e.target.checked })}
                  className="w-4 h-4 accent-amber-600"
                />
                <span>Exclude Draft PRs</span>
              </label>
              <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer pt-5">
                <input
                  type="checkbox"
                  checked={prDraft.excludeTerminalClosed}
                  onChange={(e) => setPrDraft({ ...prDraft, excludeTerminalClosed: e.target.checked })}
                  className="w-4 h-4 accent-amber-600"
                />
                <span>Exclude Closed/Cancelled</span>
              </label>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-800">Editable PR Pending Aging Buckets</span>
                  <button
                    type="button"
                    onClick={() => setPrDraft({ ...prDraft, buckets: JSON.parse(JSON.stringify(DEFAULT_PR_AGING_BUCKETS)) })}
                    className="text-[11px] font-bold text-indigo-600 underline cursor-pointer"
                  >
                    Reset 0–3 / 4–7 / 8–15 / &gt;15
                  </button>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase border-b border-slate-200">
                      <th className="p-2">Label</th>
                      <th className="p-2 text-center">From</th>
                      <th className="p-2 text-center">To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {prDraft.buckets.map((bk, idx) => (
                      <tr key={bk.key}>
                        <td className="p-2">
                          <input
                            type="text"
                            value={bk.label}
                            onChange={(e) => {
                              const next = [...prDraft.buckets];
                              next[idx] = { ...next[idx], label: e.target.value };
                              setPrDraft({ ...prDraft, buckets: next });
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded font-semibold"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min={0}
                            disabled={idx === 0}
                            value={bk.fromDays}
                            onChange={(e) => {
                              const next = [...prDraft.buckets];
                              next[idx] = { ...next[idx], fromDays: Number(e.target.value) || 0 };
                              setPrDraft({ ...prDraft, buckets: next });
                            }}
                            className="w-16 p-1.5 border border-slate-300 rounded text-center font-mono font-bold disabled:bg-slate-100"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min={0}
                            value={bk.toDays}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0;
                              const next = [...prDraft.buckets];
                              next[idx] = { ...next[idx], toDays: v };
                              if (idx < next.length - 1) {
                                next[idx + 1] = { ...next[idx + 1], fromDays: v + 1 };
                              }
                              setPrDraft({ ...prDraft, buckets: next });
                            }}
                            className="w-20 p-1.5 border border-slate-300 rounded text-center font-mono font-bold"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                <div className="font-bold text-slate-800">Stage-Wise SLA Targets (Days)</div>
                <div className="grid grid-cols-2 gap-2.5">
                  {([
                    ['PENDING_MANAGER_APPROVAL', 'Pending Manager Approval'],
                    ['PENDING_DEPARTMENT_APPROVAL', 'Pending Department Approval'],
                    ['PENDING_SUBSEQUENT_APPROVAL', 'Pending Category Approval'],
                    ['APPROVED_PENDING_BUYER', 'Approved Pending Buyer'],
                    ['PENDING_BUYER_CONFIGURATION', 'Pending Buyer Action'],
                    ['PENDING_RFQ_CONVERSION', 'Pending RFQ Conversion'],
                  ] as const).map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-[11px] font-bold text-slate-600 mb-0.5">{label}</label>
                      <input
                        type="number"
                        min={1}
                        value={prDraft.stageSlaDays[key]}
                        onChange={(e) =>
                          setPrDraft({
                            ...prDraft,
                            stageSlaDays: {
                              ...prDraft.stageSlaDays,
                              [key]: Number(e.target.value) || 1,
                            },
                          })
                        }
                        className="w-full p-1.5 border border-slate-300 rounded font-mono font-bold text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-800">
              PR Aging Policy Versions (Sorted Newest First DESC)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase border-b border-slate-200">
                    <th className="p-2.5">Version</th>
                    <th className="p-2.5">Scope</th>
                    <th className="p-2.5">Basis</th>
                    <th className="p-2.5">Escalation SLA</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {prPolicyGrid.pagedData.map((p) => (
                    <tr key={p.id}>
                      <td className="p-2.5 font-mono font-bold">v{p.version}</td>
                      <td className="p-2.5">{p.companyId} / {p.branchId} / {p.prType} / {p.priority}</td>
                      <td className="p-2.5 font-bold">{p.agingBasis}</td>
                      <td className="p-2.5 font-mono">{p.escalationThresholdDays}d</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-slate-500">{p.updatedAt.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DataGridFooter
            currentPage={prPolicyGrid.currentPage}
            totalPages={prPolicyGrid.totalPages}
            pageSize={prPolicyGrid.pageSize}
            totalRecords={prPolicyGrid.totalRecords}
            onPageChange={prPolicyGrid.setCurrentPage}
            onPageSizeChange={prPolicyGrid.setPageSize}
            defaultSortNotice="Default Sort: Newest Versions First (DESC)"
          />
        </div>
      )}

      {/* CREATE / EDIT AGING PARAMETER MODAL */}
      {isModalOpen && editingConfig && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm">
                    {configs.some((c) => c.id === editingConfig.id) ? `Edit Aging Parameter (${editingConfig.code})` : 'Create New Aging Parameter Master'}
                  </h3>
                  <p className="text-xs text-slate-300">Define aging calculation basis, bucket boundaries, and module assignment.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer text-base">
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* General Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Aging Parameter Code *</label>
                  <input
                    type="text"
                    value={editingConfig.code}
                    onChange={(e) => setEditingConfig({ ...editingConfig, code: e.target.value.toUpperCase() })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                    placeholder="e.g. AGE-STD-01"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Aging Parameter Name *</label>
                  <input
                    type="text"
                    value={editingConfig.name}
                    onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
                    placeholder="e.g. Standard Enterprise 180-Day Aging"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Business Context</label>
                <input
                  type="text"
                  value={editingConfig.description}
                  onChange={(e) => setEditingConfig({ ...editingConfig, description: e.target.value })}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-700"
                  placeholder="e.g. Standard 30-day bucket intervals for AP/AR outstanding reports"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Company Scope *</label>
                  <select
                    value={editingConfig.companyId}
                    onChange={(e) => setEditingConfig({ ...editingConfig, companyId: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  >
                    {companies.map((co) => (
                      <option key={co.id} value={co.id}>
                        {co.name} ({co.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Aging Calculation Basis *</label>
                  <select
                    value={editingConfig.agingBasis}
                    onChange={(e) => setEditingConfig({ ...editingConfig, agingBasis: e.target.value as AgingBasis })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="DUE_DATE">Due Date (Recommended for AP/AR)</option>
                    <option value="DOCUMENT_DATE">Document Date (Invoice/PO Date)</option>
                    <option value="POSTING_DATE">Posting Date (G/L Entry Date)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Configuration Status</label>
                  <select
                    value={editingConfig.status}
                    onChange={(e) => setEditingConfig({ ...editingConfig, status: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Bucket Boundaries Editor Table */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    Aging Bucket Range Boundary Configuration
                  </span>

                  <button
                    type="button"
                    onClick={() => setEditingConfig({ ...editingConfig, buckets: JSON.parse(JSON.stringify(DEFAULT_AGING_BUCKETS)) })}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer underline"
                  >
                    Reset to Default 30-Day Ranges
                  </button>
                </div>

                {/* Boundary Validation Alert */}
                <div
                  className={`p-2.5 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                    modalValidation.valid ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'
                  }`}
                >
                  {modalValidation.valid ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{modalValidation.message}</span>
                </div>

                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                        <th className="p-2.5">Bucket</th>
                        <th className="p-2.5">Display Label *</th>
                        <th className="p-2.5 text-center">From Days *</th>
                        <th className="p-2.5 text-center">To Days *</th>
                        <th className="p-2.5 text-center">Range Preview</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {editingConfig.buckets.map((b, idx) => (
                        <tr key={idx} className="hover:bg-white transition">
                          <td className="p-2.5 font-bold text-slate-900">{b.bucketName}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={b.label}
                              onChange={(e) => handleUpdateBucketDays(idx, 'label', e.target.value)}
                              className="w-full p-1.5 bg-white border border-slate-300 rounded font-bold text-xs"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min={0}
                              disabled={idx === 0} // Current is always 0
                              value={b.fromDays}
                              onChange={(e) => handleUpdateBucketDays(idx, 'fromDays', e.target.value)}
                              className="w-20 p-1.5 bg-white border border-slate-300 rounded text-center font-mono font-bold text-xs disabled:bg-slate-100"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min={0}
                              disabled={idx === 0} // Current is always 0
                              value={b.toDays}
                              onChange={(e) => handleUpdateBucketDays(idx, 'toDays', e.target.value)}
                              className="w-24 p-1.5 bg-white border border-slate-300 rounded text-center font-mono font-bold text-xs disabled:bg-slate-100"
                            />
                          </td>
                          <td className="p-2 text-center font-mono text-[10px] font-bold text-indigo-700">
                            {idx === 0 ? 'Current / Not Due' : idx === 6 ? `> ${b.fromDays - 1} Days` : `${b.fromDays} to ${b.toDays} Days`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Applicable Integrated Modules Matrix */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-900 text-xs block">
                  Select Applicable Integrated Financial & Operational Modules:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {INTEGRATED_MODULES_LIST.map((m) => {
                    const isAssigned = editingConfig.applicableModules.includes(m.key);
                    return (
                      <label
                        key={m.key}
                        className={`p-2.5 rounded-lg border transition cursor-pointer flex items-center gap-2 ${
                          isAssigned ? 'bg-indigo-50 border-indigo-300 text-indigo-900' : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={(e) => {
                            const newMods = e.target.checked
                              ? [...editingConfig.applicableModules, m.key]
                              : editingConfig.applicableModules.filter((k) => k !== m.key);
                            setEditingConfig({ ...editingConfig, applicableModules: newMods });
                          }}
                          className="rounded text-indigo-600 w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <span className="font-bold text-xs block">{m.label}</span>
                          <span className="text-[9px] text-slate-400 block">{m.group}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-xs">
                <input
                  type="checkbox"
                  checked={editingConfig.isDefault}
                  onChange={(e) => setEditingConfig({ ...editingConfig, isDefault: e.target.checked })}
                  className="rounded text-amber-600 w-4 h-4 cursor-pointer"
                />
                <span>Set as Default Aging Configuration for Company</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveModal}
                  disabled={!modalValidation.valid}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
