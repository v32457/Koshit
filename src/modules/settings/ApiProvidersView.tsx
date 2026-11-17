import React, { useState, useMemo } from 'react';
import {
  Database,
  Globe,
  FileCheck,
  Plus,
  Check,
  ShieldCheck,
  Search,
  CheckCircle,
  XCircle,
  RefreshCw,
  Zap,
  Edit,
  Trash2,
  Server,
  Activity,
  BarChart3,
  Clock,
  Download,
  Filter,
  TrendingUp,
} from 'lucide-react';
import {
  getGstVerificationMode,
  setGstVerificationMode,
} from '../../services/gstService';
import {
  getGstProviders,
  getMsmeProviders,
  getAllProviders,
  saveOrUpdateProvider,
  deleteProvider,
  toggleProviderActive,
  testProviderHealth,
  getApiUsageLogs,
  clearApiUsageLogs,
  computeApiUsageMetrics,
} from '../../services/apiProviderService';
import { GSTVerificationMode, ApiProviderConfig } from '../../types';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';

export const ApiProvidersView: React.FC = () => {
  // Verification modes state
  const [gstMode, setGstModeState] = useState<GSTVerificationMode>(() => getGstVerificationMode());
  const [msmeMode, setMsmeMode] = useState<'AUTOMATIC' | 'MANUAL'>('AUTOMATIC');
  const [modeSaveNotice, setModeSaveNotice] = useState<string | null>(null);

  // Provider configuration state
  const [serviceFilter, setServiceFilter] = useState<'ALL' | 'GST' | 'MSME'>('ALL');
  const [providerSearch, setProviderSearch] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Providers list
  const providers = useMemo(() => {
    return getAllProviders(serviceFilter);
  }, [serviceFilter, refreshTrigger]);

  const filteredProviders = useMemo(() => {
    if (!providerSearch.trim()) return providers;
    const q = providerSearch.toLowerCase().trim();
    return providers.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        p.providerName.toLowerCase().includes(q) ||
        p.endpointUrl.toLowerCase().includes(q)
    );
  }, [providers, providerSearch]);

  // Modal State for Add / Edit Provider
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ApiProviderConfig | null>(null);
  const [modalTestStatus, setModalTestStatus] = useState<{ success: boolean; msg: string; latency?: number } | null>(null);
  const [isModalTesting, setIsModalTesting] = useState(false);

  // Inline testing state
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; msg: string; latency?: number }>>({});

  // Usage logs & analytics state
  const [logSearch, setLogSearch] = useState('');
  const [logServiceFilter, setLogServiceFilter] = useState<'ALL' | 'GST' | 'MSME'>('ALL');
  const [logStatusFilter, setLogStatusFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED' | 'TIMEOUT'>('ALL');

  const usageLogs = useMemo(() => {
    return getApiUsageLogs();
  }, [refreshTrigger]);

  const filteredLogs = useMemo(() => {
    return usageLogs.filter((log) => {
      if (logServiceFilter !== 'ALL' && log.serviceType !== logServiceFilter) return false;
      if (logStatusFilter !== 'ALL' && log.status !== logStatusFilter) return false;
      if (logSearch.trim()) {
        const q = logSearch.toLowerCase().trim();
        const matchesTarget = log.targetIdentifier.toLowerCase().includes(q);
        const matchesProvider = log.providerName.toLowerCase().includes(q);
        const matchesUser = log.requestedBy.toLowerCase().includes(q);
        if (!matchesTarget && !matchesProvider && !matchesUser) return false;
      }
      return true;
    });
  }, [usageLogs, logServiceFilter, logStatusFilter, logSearch]);

  const metrics = useMemo(() => {
    return computeApiUsageMetrics();
  }, [refreshTrigger]);

  const usageLogsGrid = useStandardDataGrid({
    gridId: 'settings-api-usage-logs',
    data: filteredLogs,
    defaultSortField: 'timestamp',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
    filterSignature: `${logServiceFilter}|${logStatusFilter}|${logSearch}`,
  });

  // Handlers
  const handleSaveVerificationModes = () => {
    setGstVerificationMode(gstMode);
    setModeSaveNotice('Verification modes and failover policies saved successfully.');
    setTimeout(() => setModeSaveNotice(null), 3500);
  };

  const handleToggleActive = (provider: ApiProviderConfig) => {
    toggleProviderActive(provider.id, provider.serviceType);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleDeleteProvider = (provider: ApiProviderConfig) => {
    if (confirm(`Are you sure you want to remove ${provider.displayName} from the active provider pool?`)) {
      deleteProvider(provider.id, provider.serviceType);
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  const handleTestProvider = async (provider: ApiProviderConfig) => {
    setTestingProviderId(provider.id);
    try {
      const res = await testProviderHealth(provider);
      setTestResults((prev) => ({
        ...prev,
        [provider.id]: { success: res.success, msg: res.message, latency: res.latencyMs },
      }));
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [provider.id]: { success: false, msg: err.message || 'Connection test failed.' },
      }));
    } finally {
      setTestingProviderId(null);
    }
  };

  const handleOpenAddModal = (serviceType: 'GST' | 'MSME' = 'GST') => {
    setEditingProvider({
      id: `prov-${serviceType.toLowerCase()}-${Date.now().toString().slice(-4)}`,
      serviceType,
      providerName: serviceType === 'GST' ? 'CLEAR_TAX' : 'UDYAM_GOVT_SANDBOX',
      displayName: serviceType === 'GST' ? 'New GST API Provider Gateway' : 'New MSME / Udyam API Provider Gateway',
      endpointUrl: serviceType === 'GST' ? 'https://api.cleartax.in/v2/gstin/search' : 'https://udyamregistration.gov.in/api/v1/enterprise/verify',
      apiKey: '',
      clientId: '',
      clientSecret: '',
      isActive: true,
      priority: serviceType === 'GST' ? getGstProviders().length + 1 : getMsmeProviders().length + 1,
      selectionStrategy: 'HIGHEST_BALANCE',
      totalCredits: 10000,
      remainingCredits: 10000,
      dailyLimit: 1000,
      dailyUsed: 0,
      monthlyLimit: 25000,
      monthlyUsed: 0,
      resetTimezone: 'Asia/Kolkata',
      healthStatus: 'HEALTHY',
      timeoutSeconds: 15,
      costPerRequest: 1.0,
    });
    setModalTestStatus(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (provider: ApiProviderConfig) => {
    setEditingProvider({ ...provider });
    setModalTestStatus(null);
    setIsModalOpen(true);
  };

  const handleSaveModalProvider = () => {
    if (!editingProvider) return;
    if (!editingProvider.displayName.trim() || !editingProvider.endpointUrl.trim()) {
      alert('Display Name and Endpoint URL are required.');
      return;
    }
    saveOrUpdateProvider(editingProvider);
    setIsModalOpen(false);
    setEditingProvider(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleModalTest = async () => {
    if (!editingProvider) return;
    setIsModalTesting(true);
    setModalTestStatus(null);
    try {
      const res = await testProviderHealth(editingProvider);
      setModalTestStatus({ success: res.success, msg: res.message, latency: res.latencyMs });
    } catch (err: any) {
      setModalTestStatus({ success: false, msg: err.message || 'Connection test failed.' });
    } finally {
      setIsModalTesting(false);
    }
  };

  const handleClearLogs = () => {
    if (confirm('Clear all API provider usage logs? This action cannot be undone.')) {
      clearApiUsageLogs();
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  const handleExportLogsCsv = () => {
    const headers = ['Timestamp', 'Service', 'Provider ID', 'Provider Name', 'Target Identifier', 'Status', 'Latency (ms)', 'Credits Consumed', 'Requested By', 'Details'];
    const rows = filteredLogs.map((l) => [
      l.timestamp,
      l.serviceType,
      l.providerId,
      l.providerName,
      l.targetIdentifier,
      l.status,
      l.latencyMs,
      l.creditsConsumed,
      `"${(l.requestedBy || '').replace(/"/g, '""')}"`,
      `"${(l.responseSummary || l.errorMessage || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `api_provider_usage_logs_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getTemplateConfig = (templateKey: string, serviceType: 'GST' | 'MSME') => {
    if (serviceType === 'GST') {
      switch (templateKey) {
        case 'CLEAR_TAX':
          return {
            providerName: 'CLEAR_TAX',
            displayName: 'ClearTax GST Enterprise Gateway',
            endpointUrl: 'https://api.cleartax.in/v2/gstin/search',
            costPerRequest: 1.0,
            timeoutSeconds: 15,
          };
        case 'IRIS_GST':
          return {
            providerName: 'IRIS_GST',
            displayName: 'IRIS GST Peridot Enterprise',
            endpointUrl: 'https://api.irisgst.com/v2/search',
            costPerRequest: 1.2,
            timeoutSeconds: 12,
          };
        case 'MASTERS_INDIA':
          return {
            providerName: 'MASTERS_INDIA',
            displayName: 'Masters India GST API Gateway',
            endpointUrl: 'https://api.mastersindia.co/v1/gstin/verify',
            costPerRequest: 0.9,
            timeoutSeconds: 15,
          };
        case 'GOVT_DIRECT_SANDBOX':
          return {
            providerName: 'GOVT_DIRECT_SANDBOX',
            displayName: 'Official Govt GSTN Developer Sandbox',
            endpointUrl: 'https://sandbox.gst.gov.in/taxpayerapi/v1.0/search',
            costPerRequest: 0.5,
            timeoutSeconds: 20,
          };
        default:
          return {
            providerName: 'CUSTOM_REST',
            displayName: 'Custom Enterprise REST Gateway',
            endpointUrl: 'https://api.custom-gst-gateway.internal/v1/lookup',
            costPerRequest: 1.0,
            timeoutSeconds: 15,
          };
      }
    } else {
      switch (templateKey) {
        case 'UDYAM_GOVT_SANDBOX':
          return {
            providerName: 'UDYAM_GOVT_SANDBOX',
            displayName: 'Official Udyam Govt Developer Sandbox',
            endpointUrl: 'https://udyamregistration.gov.in/api/v1/enterprise/verify',
            costPerRequest: 1.0,
            timeoutSeconds: 15,
          };
        case 'CLEARTAX_MSME':
          return {
            providerName: 'CLEARTAX_MSME',
            displayName: 'ClearTax MSME & Udyam Gateway',
            endpointUrl: 'https://api.cleartax.in/v2/msme/verify',
            costPerRequest: 1.5,
            timeoutSeconds: 12,
          };
        case 'MASTERS_INDIA_MSME':
          return {
            providerName: 'MASTERS_INDIA_MSME',
            displayName: 'Masters India Udyam Verification API',
            endpointUrl: 'https://api.mastersindia.co/v1/msme/verify',
            costPerRequest: 1.1,
            timeoutSeconds: 15,
          };
        default:
          return {
            providerName: 'CUSTOM_REST',
            displayName: 'Custom Enterprise MSME Gateway',
            endpointUrl: 'https://enterprise-api.kosh.internal/msme/verify',
            costPerRequest: 1.0,
            timeoutSeconds: 10,
          };
      }
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6 text-xs max-w-6xl font-sans select-none">
      {/* Header Banner */}
      <div className="border-b border-slate-100 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            API Providers & Usage Control Console
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Govern GST and MSME automated verification modes, configure multi-gateway priority routing & credit quotas, and track real-time API performance analytics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenAddModal('GST')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add GST Gateway</span>
          </button>
          <button
            onClick={() => handleOpenAddModal('MSME')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add MSME Gateway</span>
          </button>
          <button
            onClick={handleSaveVerificationModes}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Policies</span>
          </button>
        </div>
      </div>

      {modeSaveNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl font-bold flex items-center gap-2 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{modeSaveNotice}</span>
        </div>
      )}

      {/* Analytics Quick Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total API Requests</span>
            <Activity className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">{metrics.totalRequests.toLocaleString()}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Across all registered gateways</div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Success Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-emerald-600 mt-1 font-mono">{metrics.successRatePercentage.toFixed(1)}%</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{metrics.successfulRequests} successful lookups</div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Avg Response Latency</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">{metrics.averageLatencyMs} ms</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Fast API responses</div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Credits Consumed</span>
            <BarChart3 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">{metrics.totalCreditsConsumed.toLocaleString()}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Quota deduction total</div>
        </div>
      </div>

      {/* Verification Modes Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-600" />
            GST Taxpayer Verification Mode
          </h4>
          <div className="space-y-2">
            <label
              onClick={() => setGstModeState('PAID_API')}
              className={`p-3 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                gstMode === 'PAID_API' ? 'border-indigo-600 bg-white shadow-xs' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-900 text-xs">Automated Multi-Provider API Pool (Recommended)</span>
                <span className="px-2 py-0.2 rounded text-[9px] font-mono font-bold bg-indigo-100 text-indigo-800">Multi-Gateway</span>
              </div>
              <p className="text-[10px] text-slate-600">Queries highest-priority healthy GST provider with available credits. Automatic failover.</p>
            </label>

            <label
              onClick={() => setGstModeState('MANUAL_CAPTCHA')}
              className={`p-3 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                gstMode === 'MANUAL_CAPTCHA' ? 'border-indigo-600 bg-white shadow-xs' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-900 text-xs">Manual CAPTCHA Mode</span>
                <span className="px-2 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-200 text-slate-700">Govt Portal</span>
              </div>
              <p className="text-[10px] text-slate-600">User-assisted inline CAPTCHA challenge without API call cost.</p>
            </label>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            MSME / Udyam Verification Mode
          </h4>
          <div className="space-y-2">
            <label
              onClick={() => setMsmeMode('AUTOMATIC')}
              className={`p-3 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                msmeMode === 'AUTOMATIC' ? 'border-emerald-600 bg-white shadow-xs' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-900 text-xs">Automated Multi-Provider Quota Rotation</span>
                <span className="px-2 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800">Auto-Routing</span>
              </div>
              <p className="text-[10px] text-slate-600">Dynamically chooses optimal MSME provider based on credit balance and daily consumption.</p>
            </label>

            <label
              onClick={() => setMsmeMode('MANUAL')}
              className={`p-3 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                msmeMode === 'MANUAL' ? 'border-emerald-600 bg-white shadow-xs' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-900 text-xs">Manual Certificate Verification</span>
                <span className="px-2 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-200 text-slate-700">Offline</span>
              </div>
              <p className="text-[10px] text-slate-600">Requires manual reference entry and compliance document validation.</p>
            </label>
          </div>
        </div>
      </div>

      {/* Filter & Providers List */}
      <div className="space-y-3 pt-2">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold text-[11px]">Provider Pool:</span>
            <button
              onClick={() => setServiceFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                serviceFilter === 'ALL' ? 'bg-[#0B192C] text-white shadow-2xs' : 'bg-white text-slate-700 border border-slate-300'
              }`}
            >
              All ({getAllProviders('ALL').length})
            </button>
            <button
              onClick={() => setServiceFilter('GST')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                serviceFilter === 'GST' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-white text-slate-700 border border-slate-300'
              }`}
            >
              GST ({getGstProviders().length})
            </button>
            <button
              onClick={() => setServiceFilter('MSME')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                serviceFilter === 'MSME' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-white text-slate-700 border border-slate-300'
              }`}
            >
              MSME ({getMsmeProviders().length})
            </button>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search provider..."
              value={providerSearch}
              onChange={(e) => setProviderSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium"
            />
          </div>
        </div>

        {/* Providers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProviders.map((provider) => {
            const test = testResults[provider.id];
            const remainingPct = Math.round((provider.remainingCredits / (provider.totalCredits || 1)) * 100);

            return (
              <div
                key={provider.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {provider.isActive ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-400" />
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          provider.serviceType === 'GST' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {provider.serviceType}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        Priority #{provider.priority}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {provider.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                          <CheckCircle className="w-3 h-3 text-emerald-600" /> Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">
                          <XCircle className="w-3 h-3 text-slate-500" /> Disabled
                        </span>
                      )}
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={provider.isActive}
                          onChange={() => handleToggleActive(provider)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        <span className="ml-1.5 font-bold text-xs text-slate-700">{provider.isActive ? 'On' : 'Off'}</span>
                      </label>
                    </div>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm">{provider.displayName}</h4>
                  <div className="font-mono text-[10px] text-slate-500 truncate">{provider.endpointUrl}</div>

                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-600">Remaining Quota</span>
                      <span className="text-slate-900 font-mono">
                        {provider.remainingCredits.toLocaleString()} / {provider.totalCredits.toLocaleString()} ({remainingPct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${remainingPct > 20 ? 'bg-indigo-600' : 'bg-rose-500'}`}
                        style={{ width: `${Math.min(100, Math.max(0, remainingPct))}%` }}
                      />
                    </div>
                  </div>

                  {test && (
                    <div
                      className={`p-2 rounded-lg text-[11px] font-bold flex items-center gap-2 mt-2 ${
                        test.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {test.success ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                      <span className="truncate">{test.msg}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Cost: {provider.costPerRequest} cr/req</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTestProvider(provider)}
                      disabled={testingProviderId === provider.id}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {testingProviderId === provider.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 text-amber-500" />}
                      <span>Test</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(provider)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Edit className="w-3 h-3 text-blue-600" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProvider(provider)}
                      className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Usage Logs & Audit Trail */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              API Provider Execution & Gateway Audit Log
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Real-time log of GST & MSME lookup queries executed through provider APIs.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportLogsCsv}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" /> Export CSV
            </button>
            <button
              onClick={handleClearLogs}
              className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Logs
            </button>
          </div>
        </div>

        {/* Filters bar for logs */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-slate-500 font-bold text-[11px]">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </div>
            <select
              value={logServiceFilter}
              onChange={(e) => setLogServiceFilter(e.target.value as any)}
              className="p-1 bg-white border border-slate-300 rounded font-bold text-xs"
            >
              <option value="ALL">All Services</option>
              <option value="GST">GST Only</option>
              <option value="MSME">MSME Only</option>
            </select>

            <select
              value={logStatusFilter}
              onChange={(e) => setLogStatusFilter(e.target.value as any)}
              className="p-1 bg-white border border-slate-300 rounded font-bold text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">Success Only</option>
              <option value="FAILED">Failed Only</option>
              <option value="TIMEOUT">Timeout Only</option>
            </select>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search target identifier, user..."
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium"
            />
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-bold uppercase text-[10px]">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Service</th>
                  <th className="p-3">Provider Gateway</th>
                  <th className="p-3">Target Identifier</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Latency</th>
                  <th className="p-3 text-right">Credits</th>
                  <th className="p-3">Requested By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {usageLogsGrid.pagedData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 font-sans">
                      No API execution logs found matching filter criteria.
                    </td>
                  </tr>
                ) : (
                  usageLogsGrid.pagedData.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 text-slate-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="p-3 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.serviceType === 'GST' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {log.serviceType}
                        </span>
                      </td>
                      <td className="p-3 font-sans font-bold text-slate-900">{log.providerName}</td>
                      <td className="p-3 font-bold text-slate-800">{log.targetIdentifier}</td>
                      <td className="p-3 text-center font-sans">
                        {log.status === 'SUCCESS' ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">SUCCESS</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">{log.status}</span>
                        )}
                      </td>
                      <td className="p-3 text-right text-slate-700">{log.latencyMs} ms</td>
                      <td className="p-3 text-right text-slate-700">{log.creditsConsumed}</td>
                      <td className="p-3 font-sans text-slate-600">{log.requestedBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50 border-t border-slate-200">
            <DataGridFooter
              currentPage={usageLogsGrid.currentPage}
              totalPages={usageLogsGrid.totalPages}
              pageSize={usageLogsGrid.pageSize}
              totalRecords={usageLogsGrid.totalRecords}
              onPageChange={usageLogsGrid.setCurrentPage}
              onPageSizeChange={usageLogsGrid.setPageSize}
              pageSizeOptions={usageLogsGrid.pageSizeOptions}
              defaultSortNotice="Sorted Newest First (Timestamp DESC)"
            />
          </div>
        </div>
      </div>

      {/* ADD / EDIT PROVIDER MODAL */}
      {isModalOpen && editingProvider && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-sm">
                    {editingProvider.id.includes('new') ? 'Configure New API Gateway' : `Edit ${editingProvider.displayName}`}
                  </h3>
                  <p className="text-xs text-slate-300">Set up credentials, quota balance, daily limit, and rotation strategy.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Service Type *</label>
                  <select
                    value={editingProvider.serviceType}
                    onChange={(e) => {
                      const st = e.target.value as 'GST' | 'MSME';
                      const tpl = getTemplateConfig(st === 'GST' ? 'CLEAR_TAX' : 'UDYAM_GOVT_SANDBOX', st);
                      setEditingProvider({ ...editingProvider, serviceType: st, ...tpl });
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="GST">GST Verification Service</option>
                    <option value="MSME">MSME / Udyam Verification Service</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Preset Provider Template</label>
                  <select
                    value={editingProvider.providerName}
                    onChange={(e) => {
                      const tpl = getTemplateConfig(e.target.value, editingProvider.serviceType);
                      setEditingProvider({ ...editingProvider, ...tpl });
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  >
                    {editingProvider.serviceType === 'GST' ? (
                      <>
                        <option value="CLEAR_TAX">ClearTax GST API (Recommended)</option>
                        <option value="IRIS_GST">IRIS GST Peridot Enterprise</option>
                        <option value="MASTERS_INDIA">Masters India GST Gateway</option>
                        <option value="GOVT_DIRECT_SANDBOX">Official Govt GSTN Developer Sandbox</option>
                        <option value="CUSTOM_REST">Custom Enterprise REST Endpoint</option>
                      </>
                    ) : (
                      <>
                        <option value="UDYAM_GOVT_SANDBOX">Official Udyam Govt Sandbox (Recommended)</option>
                        <option value="CLEARTAX_MSME">ClearTax MSME & Udyam Gateway</option>
                        <option value="MASTERS_INDIA_MSME">Masters India Udyam Verification API</option>
                        <option value="CUSTOM_REST">Custom Enterprise MSME Gateway</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Display Name *</label>
                  <input
                    type="text"
                    value={editingProvider.displayName}
                    onChange={(e) => setEditingProvider({ ...editingProvider, displayName: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Endpoint URL *</label>
                  <input
                    type="text"
                    value={editingProvider.endpointUrl}
                    onChange={(e) => setEditingProvider({ ...editingProvider, endpointUrl: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total Credits</label>
                  <input
                    type="number"
                    value={editingProvider.totalCredits}
                    onChange={(e) => setEditingProvider({ ...editingProvider, totalCredits: Number(e.target.value) || 0 })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Remaining Balance</label>
                  <input
                    type="number"
                    value={editingProvider.remainingCredits}
                    onChange={(e) => setEditingProvider({ ...editingProvider, remainingCredits: Number(e.target.value) || 0 })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Daily Limit</label>
                  <input
                    type="number"
                    value={editingProvider.dailyLimit}
                    onChange={(e) => setEditingProvider({ ...editingProvider, dailyLimit: Number(e.target.value) || 0 })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Priority</label>
                  <input
                    type="number"
                    value={editingProvider.priority}
                    onChange={(e) => setEditingProvider({ ...editingProvider, priority: Number(e.target.value) || 1 })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              {modalTestStatus && (
                <div
                  className={`p-3 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                    modalTestStatus.success ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'
                  }`}
                >
                  {modalTestStatus.success ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{modalTestStatus.msg}</span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={handleModalTest}
                disabled={isModalTesting}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                {isModalTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
                <span>Test Connection</span>
              </button>

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
                  onClick={handleSaveModalProvider}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Save Provider
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
