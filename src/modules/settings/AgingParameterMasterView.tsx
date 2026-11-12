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
import { Company, Branch } from '../../types';
import { INITIAL_COMPANIES, INITIAL_BRANCHES } from '../../data/seedData';

interface AgingParameterMasterViewProps {
  embedded?: boolean; // If embedded inside GeneralSettingsView
}

export const AgingParameterMasterView: React.FC<AgingParameterMasterViewProps> = ({
  embedded = false,
}) => {
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
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create Aging Parameter
          </button>
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
        {filteredConfigs.length === 0 ? (
          <div className="p-8 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
            <Clock className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="font-bold text-slate-700 text-sm">No Aging Parameter configurations found</p>
            <p className="text-slate-500 text-xs">Try adjusting your filters or create a new aging parameter master.</p>
          </div>
        ) : (
          filteredConfigs.map((cfg) => (
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
