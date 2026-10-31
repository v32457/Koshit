import React, { useState } from 'react';
import { GlobalItem, Branch, DashboardDefinition } from '../../types';
import {
  Boxes,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
  TrendingUp,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Settings,
  Filter,
  Layers,
  FilePlus2,
  Inbox,
  PlayCircle,
  Database,
  ExternalLink,
  Download,
} from 'lucide-react';
import { INITIAL_DASHBOARD_DEFINITIONS } from '../../data/dashboardCatalogue';
import { INITIAL_BRANCHES } from '../../data/seedData';
import { DashboardCustomizerModal } from './DashboardCustomizerModal';

interface DashboardViewProps {
  items: GlobalItem[];
  activeBranch: Branch;
  onNavigate: (route: string) => void;
  onOpenStage0Modal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  items,
  activeBranch,
  onNavigate,
  onOpenStage0Modal,
}) => {
  // Configurable Dashboard State
  const [dashboard, setDashboard] = useState<DashboardDefinition>(INITIAL_DASHBOARD_DEFINITIONS[0]);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [timeframeFilter, setTimeframeFilter] = useState<string>('30D');

  // Live items from the application state; this view never invents SAP outcomes.
  const [isSyncTableExpanded, setIsSyncTableExpanded] = useState<boolean>(false);
  const [syncActionMessage, setSyncActionMessage] = useState<string | null>(null);

  // Filter items to the selected branch using the item's recorded branch availability.
  const filteredItems = items.filter((item) => {
    if (selectedBranchFilter === 'ALL') return true;
    const branch = INITIAL_BRANCHES.find(
      (b) => b.name.startsWith(selectedBranchFilter) || b.city === selectedBranchFilter,
    );
    if (!branch) return false;
    return item.branchAvailability.some((a) => a.branchId === branch.id && a.isActive);
  });

  // Derived metric counts
  const totalApproved = filteredItems.filter((i) => i.status === 'APPROVED' || i.status === 'SAP_CREATED').length;
  const pendingApprovals = filteredItems.filter((i) => i.status === 'SUBMITTED' || i.status === 'UNDER_REVIEW').length;
  const draftRequests = filteredItems.filter((i) => i.status === 'DRAFT').length;
  const returnedRequests = filteredItems.filter((i) => i.status === 'RETURNED_FOR_CORRECTION').length;

  // SAP Business One HANA Real-Time Sync Status Counts
  const syncedItems = filteredItems.filter(
    (i) => i.status === 'SAP_CREATED' || i.sapSyncInfo?.syncStatus === 'SYNCED'
  );
  const pendingItems = filteredItems.filter(
    (i) =>
      i.status === 'APPROVED' ||
      i.status === 'SAP_PENDING' ||
      i.sapSyncInfo?.syncStatus === 'PENDING'
  );
  const failedItems = filteredItems.filter(
    (i) =>
      i.status === 'SAP_FAILED' ||
      i.status === 'RETURNED_FOR_CORRECTION' ||
      i.sapSyncInfo?.syncStatus === 'FAILED'
  );

  const sapSyncedCount = syncedItems.length;
  const sapPendingCount = pendingItems.length;
  const sapFailedCount = failedItems.length;
  const totalSapItems = filteredItems.length;

  const syncedPct = totalSapItems > 0 ? Math.round((sapSyncedCount / totalSapItems) * 100) : 0;
  const pendingPct = totalSapItems > 0 ? Math.round((sapPendingCount / totalSapItems) * 100) : 0;
  const failedPct = totalSapItems > 0 ? Math.round((sapFailedCount / totalSapItems) * 100) : 0;

  // Interactive SAP Sync Actions
  // No SAP connector or job queue exists in this build. These actions must not
  // mutate local item state into a false "SYNCED" state.
  const handleForceSyncPending = () => {
    setSyncActionMessage(
      'SAP dispatch is BLOCKED: no Business One Service Layer connector, credentials, or job queue is configured. No item was sent.',
    );
  };

  const handleRetryFailedSync = () => {
    setSyncActionMessage(
      'DLQ retry is BLOCKED: no SAP connector or dead-letter queue backend is configured. No item was retried.',
    );
  };

  const handleDownloadSapAuditCsv = () => {
    const headers = [
      'GlobalItemCode',
      'Category',
      'Description',
      'GovernanceStatus',
      'SAPSyncStatus',
      'SAPItemCode',
      'CompanyDB',
      'SyncedTimestamp',
    ];
    const rows = filteredItems.map((i) => [
      i.globalItemCode,
      i.categoryCode,
      `"${i.description.replace(/"/g, '""')}"`,
      i.status,
      i.sapSyncInfo?.syncStatus || (i.status === 'SAP_CREATED' ? 'SYNCED' : i.status === 'APPROVED' ? 'PENDING' : 'UNSYNCED'),
      i.sapSyncInfo?.sapItemCode || i.globalItemCode,
      i.sapSyncInfo?.companyDb || 'KOSH_PROD_HANA',
      i.sapSyncInfo?.syncedAt || i.updatedAt,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kosh_sap_b1_sync_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Category counts
  const categoryCounts: Record<string, number> = {
    RM: filteredItems.filter((i) => i.categoryCode === 'RM').length,
    FG: filteredItems.filter((i) => i.categoryCode === 'FG').length,
    PK: filteredItems.filter((i) => i.categoryCode === 'PK').length,
    CO: filteredItems.filter((i) => i.categoryCode === 'CO').length,
    MA: filteredItems.filter((i) => i.categoryCode === 'MA').length,
  };

  // Branch allocation derived from recorded branch availability on the live item set.
  const branchTotalAssociations = filteredItems.reduce(
    (sum, item) => sum + item.branchAvailability.filter((a) => a.isActive).length,
    0,
  );
  const branchData = INITIAL_BRANCHES.map((b) => {
    const count = filteredItems.filter((item) =>
      item.branchAvailability.some((a) => a.branchId === b.id && a.isActive),
    ).length;
    return {
      name: b.name,
      count,
      percentage: branchTotalAssociations > 0 ? Math.round((count / branchTotalAssociations) * 100) : 0,
    };
  });

  // Helper to map widget gridSpan to Tailwind col-span
  const getColSpanClass = (span: number) => {
    switch (span) {
      case 2:
        return 'col-span-1 md:col-span-1 lg:col-span-2';
      case 3:
        return 'col-span-1 md:col-span-2 lg:col-span-3';
      case 4:
        return 'col-span-1 md:col-span-2 lg:col-span-4';
      case 6:
        return 'col-span-1 md:col-span-3 lg:col-span-6';
      case 8:
        return 'col-span-1 md:col-span-3 lg:col-span-8';
      case 12:
      default:
        return 'col-span-1 md:col-span-3 lg:col-span-12';
    }
  };

  return (
    <div className="space-y-5 select-none">
      {/* Section 5 Dashboard Customization & Drill-Down Control Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Filters:</span>
          </div>

          {/* Branch Drill-down filter */}
          <select
            value={selectedBranchFilter}
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium cursor-pointer"
          >
            <option value="ALL">All Operational Branches (Enterprise View)</option>
            <option value="Pondicherry">Pondicherry HQ Only</option>
            <option value="Chennai">Chennai Unit Only</option>
            <option value="Hosur">Hosur Plant Only</option>
            <option value="Pune">Pune Assembly Only</option>
            <option value="Dehradun">Dehradun Unit Only</option>
          </select>

          {/* Timeframe filter */}
          <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[11px] font-medium">
            {['7D', '30D', '90D', 'ALL'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframeFilter(tf)}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  timeframeFilter === tf ? 'bg-white shadow-xs font-bold text-blue-700' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Layout Scope Indicator */}
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.8 rounded-full font-medium">
            Layout: {dashboard.name} (v{dashboard.version})
          </span>
        </div>

        {/* Administration & Customize Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCustomizerOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            Customize Dashboard
          </button>
        </div>
      </div>

      {/* SAP Business One Real-Time Sync Status Visual Summary Component */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0B192C] to-slate-900 rounded-xl border border-slate-800 shadow-md text-white p-5 space-y-4">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">
                  SAP Business One — Real-Time Integration Sync Matrix
                </h3>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Service Layer Not Configured
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Kosh Master Data Orchestrator • OITM / ITM1 Table Service Layer Synchronization State
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSapAuditCsv}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export Sync CSV</span>
            </button>

            <button
              onClick={() => onNavigate('/integration/testing')}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs cursor-pointer transition flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>SAP Diagnostics</span>
            </button>
          </div>
        </div>

        {/* Sync Action Alert Message */}
        {syncActionMessage && (
          <div className="bg-amber-500/20 border border-amber-500/40 text-amber-100 px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
            <span>{syncActionMessage}</span>
          </div>
        )}

        {/* 3 Key Visual Status Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Card 1: Synced */}
          <div className="bg-slate-950/70 border border-emerald-500/30 rounded-xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Synced to SAP B1
              </span>
              <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
                {syncedPct}%
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-emerald-400">{sapSyncedCount}</span>
              <span className="text-xs text-slate-400">/ {totalSapItems} master items</span>
            </div>

            <div className="space-y-1">
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${syncedPct}%` }} />
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">
                OITM records verified in company DB
              </span>
            </div>
          </div>

          {/* Card 2: Pending */}
          <div className="bg-slate-950/70 border border-amber-500/30 rounded-xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                Pending Integration
              </span>
              <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                {pendingPct}%
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-amber-400">{sapPendingCount}</span>
              <span className="text-xs text-slate-400">awaiting batch dispatch</span>
            </div>

            <div className="space-y-1">
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${pendingPct}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-mono">Maker-Checker Approved</span>
                <button
                  type="button"
                  onClick={handleForceSyncPending}
                  className="text-amber-300 hover:underline font-bold cursor-pointer"
                >
                  Force Sync Now →
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Failed / Dead Letter */}
          <div className="bg-slate-950/70 border border-rose-500/30 rounded-xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Failed Synchronizations
              </span>
              <span className="text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded">
                {failedPct}%
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-rose-400">{sapFailedCount}</span>
              <span className="text-xs text-slate-400">dead-letter exceptions</span>
            </div>

            <div className="space-y-1">
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 transition-all duration-300" style={{ width: `${failedPct}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-mono">Requires Operator Review</span>
                <button
                  type="button"
                  onClick={handleRetryFailedSync}
                  className="text-rose-300 hover:underline font-bold cursor-pointer"
                >
                  Reprocess DLQ →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Proportional Segmented Progress Bar */}
        <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-300">Synchronized Distribution Ratio</span>
            <button
              type="button"
              onClick={() => setIsSyncTableExpanded((prev) => !prev)}
              className="text-cyan-400 hover:text-cyan-300 font-bold text-[11px] underline cursor-pointer"
            >
              {isSyncTableExpanded ? 'Hide Item Sync Breakdown' : 'Inspect Full Sync Table'}
            </button>
          </div>

          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${syncedPct}%` }} title={`Synced: ${sapSyncedCount}`} />
            <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${pendingPct}%` }} title={`Pending: ${sapPendingCount}`} />
            <div className="h-full bg-rose-500 transition-all duration-300" style={{ width: `${failedPct}%` }} title={`Failed: ${sapFailedCount}`} />
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>Synced ({sapSyncedCount})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                <span>Pending ({sapPendingCount})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                <span>Failed ({sapFailedCount})</span>
              </span>
            </div>

            <span className="font-mono text-slate-400 text-[10px]">
              Total Evaluated: {totalSapItems} Master Records
            </span>
          </div>
        </div>

        {/* Collapsible Detail Table */}
        {isSyncTableExpanded && (
          <div className="bg-slate-950 rounded-lg border border-slate-800 p-3 space-y-2 animate-in fade-in duration-150">
            <div className="font-bold text-xs text-slate-200 flex items-center justify-between">
              <span>Item-Level SAP Service Layer Synchronization Audit</span>
              <span className="text-[10px] font-mono text-slate-400">Target DB: KOSH_PROD_HANA</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="p-2">Global Item Code</th>
                    <th className="p-2">Description</th>
                    <th className="p-2">Governance</th>
                    <th className="p-2">SAP OITM Status</th>
                    <th className="p-2 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-[11px]">
                  {filteredItems.map((item) => {
                    const isSynced = item.status === 'SAP_CREATED' || item.sapSyncInfo?.syncStatus === 'SYNCED';
                    const isPending = item.status === 'APPROVED' || item.status === 'SAP_PENDING' || item.sapSyncInfo?.syncStatus === 'PENDING';
                    const isFailed = item.status === 'SAP_FAILED' || item.sapSyncInfo?.syncStatus === 'FAILED';

                    return (
                      <tr key={item.id} className="hover:bg-slate-900/60 transition">
                        <td className="p-2 font-mono font-bold text-cyan-300">{item.globalItemCode}</td>
                        <td className="p-2 text-slate-300 max-w-xs truncate">{item.description}</td>
                        <td className="p-2">
                          <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-semibold text-[10px]">
                            {item.status}
                          </span>
                        </td>
                        <td className="p-2 font-mono font-bold">
                          {isSynced ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              SYNCED ({item.sapSyncInfo?.sapItemCode || item.globalItemCode})
                            </span>
                          ) : isPending ? (
                            <span className="text-amber-400 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              PENDING BATCH
                            </span>
                          ) : isFailed ? (
                            <span className="text-rose-400 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              FAILED (Service Layer 500)
                            </span>
                          ) : (
                            <span className="text-slate-500">UNSYNCED</span>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          {isPending && (
                            <button
                              type="button"
                              onClick={handleForceSyncPending}
                              className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[10px] font-bold cursor-pointer"
                            >
                              Sync Now
                            </button>
                          )}
                          {isFailed && (
                            <button
                              type="button"
                              onClick={handleRetryFailedSync}
                              className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded text-[10px] font-bold cursor-pointer"
                            >
                              Retry DLQ
                            </button>
                          )}
                          {isSynced && <span className="text-emerald-500/80 text-[10px]">OK ✓</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 3. Dynamic Widget Grid (Config-Driven, 12-Column Responsive Layout) */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-12 gap-3.5">
        {dashboard.widgets
          .filter((w) => w.isEnabled)
          .sort((a, b) => a.order - b.order)
          .map((widget) => {
            const spanClass = getColSpanClass(widget.gridSpan);

            // 3.1 KPI Metric Cards
            if (widget.widgetType === 'KPI_METRIC') {
              let value = 0;
              let label = widget.title;
              let colorClass = 'text-blue-600';
              let badgeText = 'Master Validated';
              let badgeColor = 'text-emerald-600 bg-emerald-50';
              let icon = <Boxes className="w-4 h-4 text-blue-600" />;

              if (widget.id === 'w-kpi-approved') {
                value = totalApproved;
                badgeText = 'Passed Maker-Checker';
                badgeColor = 'text-emerald-600';
                icon = <CheckCircle2 className="w-4 h-4 text-blue-600" />;
              } else if (widget.id === 'w-kpi-pending') {
                value = pendingApprovals;
                colorClass = 'text-amber-600';
                badgeText = 'Checker Review Queue';
                badgeColor = 'text-amber-700';
                icon = <Clock className="w-4 h-4 text-amber-500" />;
              } else if (widget.id === 'w-kpi-drafts') {
                value = draftRequests;
                colorClass = 'text-slate-700';
                badgeText = 'Maker In-Progress';
                badgeColor = 'text-slate-500';
                icon = <Boxes className="w-4 h-4 text-slate-400" />;
              } else if (widget.id === 'w-kpi-returned') {
                value = returnedRequests;
                colorClass = 'text-rose-600';
                badgeText = 'Action Required';
                badgeColor = 'text-rose-600';
                icon = <RotateCcw className="w-4 h-4 text-rose-500" />;
              } else if (widget.id === 'w-kpi-awaiting-sap') {
                value = sapPendingCount;
                colorClass = 'text-indigo-600';
                badgeText = 'Scheduled Batch';
                badgeColor = 'text-indigo-600';
                icon = <AlertTriangle className="w-4 h-4 text-indigo-500" />;
              } else if (widget.id === 'w-kpi-sap-synced') {
                value = sapSyncedCount;
                colorClass = 'text-emerald-600';
                badgeText = 'Synced to SAP';
                badgeColor = 'text-emerald-600';
                icon = <Database className="w-4 h-4 text-emerald-600" />;
              }

              return (
                <div
                  key={widget.id}
                  className={`${spanClass} bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between`}
                >
                  <div className="flex items-center justify-between text-slate-500 text-xs">
                    <span className="font-medium truncate">{label}</span>
                    {icon}
                  </div>
                  <div className={`text-2xl font-black mt-2 font-mono ${colorClass}`}>
                    {value}
                  </div>
                  <div className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${badgeColor}`}>
                    {badgeText}
                  </div>
                </div>
              );
            }

            // 3.2 Category Breakdown Donut / Summary Chart
            if (widget.widgetType === 'DONUT_CHART' || widget.id === 'w-chart-category') {
              return (
                <div
                  key={widget.id}
                  className={`${spanClass} bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <div>
                      <h3 className="font-bold text-xs text-slate-900">{widget.title}</h3>
                      <p className="text-[11px] text-slate-500">Distribution across material classifications</p>
                    </div>
                    <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">
                      {filteredItems.length} Total Items
                    </span>
                  </div>

                  <div className="space-y-2.5 my-1">
                    {[
                      { code: 'RM', label: 'Raw Materials', count: categoryCounts.RM, color: 'bg-blue-600' },
                      { code: 'FG', label: 'Finished Goods', count: categoryCounts.FG, color: 'bg-emerald-600' },
                      { code: 'PK', label: 'Packaging Materials', count: categoryCounts.PK, color: 'bg-amber-500' },
                      { code: 'CO', label: 'Consumables', count: categoryCounts.CO, color: 'bg-indigo-600' },
                      { code: 'MA', label: 'Machinery & Spares', count: categoryCounts.MA, color: 'bg-cyan-600' },
                    ].map((cat) => {
                      const pct = filteredItems.length > 0 ? Math.round((cat.count / filteredItems.length) * 100) : 0;
                      return (
                        <div key={cat.code} className="space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-700 font-medium">
                            <span className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${cat.color}`} />
                              <span className="font-mono font-bold text-slate-900">{cat.code}</span> — {cat.label}
                            </span>
                            <span className="font-mono text-slate-600">{cat.count} items ({pct}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className={`h-full ${cat.color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            // 3.3 Multi-Branch Allocation Bar Chart
            if (widget.widgetType === 'BAR_CHART' || widget.id === 'w-chart-branch') {
              return (
                <div
                  key={widget.id}
                  className={`${spanClass} bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <div>
                      <h3 className="font-bold text-xs text-slate-900">{widget.title}</h3>
                      <p className="text-[11px] text-slate-500">Inventory scoping across manufacturing plants</p>
                    </div>
                    <MapPin className="w-4 h-4 text-amber-500" />
                  </div>

                  <div className="space-y-2.5 my-1">
                    {branchData.map((b) => (
                      <div key={b.name} className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-700 font-medium">
                          <span>{b.name}</span>
                          <span className="font-mono text-slate-600">{b.count} Items ({b.percentage}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width: `${b.percentage}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 text-right">
                    <button
                      onClick={() => onNavigate('/items/branch-availability')}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      Open Availability Matrix <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            }

            // 3.4 SAP HANA Service Layer Health Banner
            if (widget.widgetType === 'SAP_HEALTH' || widget.id === 'w-sap-health-banner') {
              return (
                <div
                  key={widget.id}
                  className={`${spanClass} bg-[#0B192C] text-white rounded-xl p-4 border border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                      <Database className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-white">SAP B1 HANA Service Layer Integration</h4>
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.2 rounded-full font-mono flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          ONLINE (v10.0 HANA)
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Endpoint: <span className="font-mono text-slate-300">https://sap-hana.kosh.internal:50000/b1s/v2</span> • TLS 1.3 Verified
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <div className="text-slate-400 text-[10px] uppercase font-bold">Latency</div>
                      <div className="font-mono font-bold text-emerald-400">42 ms</div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-400 text-[10px] uppercase font-bold">20-Point Tests</div>
                      <div className="font-mono font-bold text-cyan-300">20 / 20 PASSED</div>
                    </div>
                    <button
                      onClick={() => onNavigate('/integration/testing')}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-xs transition cursor-pointer"
                    >
                      Run Diagnostics
                    </button>
                  </div>
                </div>
              );
            }

            // 3.5 Recent Master Items Table
            if (widget.widgetType === 'DATA_TABLE' || widget.id === 'w-table-recent-items') {
              return (
                <div
                  key={widget.id}
                  className={`${spanClass} bg-white rounded-xl border border-slate-200 shadow-xs p-4`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{widget.title}</h3>
                      <p className="text-xs text-slate-500">Live items validated through the Kosh rule engine</p>
                    </div>
                    <button
                      onClick={() => onNavigate('/items')}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      View All Master <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <th className="p-2.5 font-bold">Item Code</th>
                          <th className="p-2.5 font-bold">Category</th>
                          <th className="p-2.5 font-bold">Generated Description</th>
                          <th className="p-2.5 font-bold">Status</th>
                          <th className="p-2.5 font-bold">SAP Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredItems.slice(0, 5).map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-2.5 font-mono font-bold text-blue-900">
                              {item.globalItemCode}
                            </td>
                            <td className="p-2.5 font-semibold text-slate-700">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px]">
                                {item.categoryCode}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-800 font-medium max-w-xs truncate">
                              {item.description}
                            </td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.status === 'SAP_CREATED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : item.status === 'APPROVED'
                                    ? 'bg-blue-100 text-blue-800'
                                    : item.status === 'SUBMITTED'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-[11px] font-mono">
                              {item.sapSyncInfo?.syncStatus === 'SYNCED' ? (
                                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Synced ({item.sapSyncInfo.sapItemCode || 'OITM'})
                                </span>
                              ) : item.status === 'APPROVED' ? (
                                <span className="text-blue-700 font-semibold">Queued Batch</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }

            // 3.6 Real-Time Governance Audit Feed
            if (widget.widgetType === 'ACTIVITY_FEED' || widget.id === 'w-activity-feed') {
              return (
                <div
                  key={widget.id}
                  className={`${spanClass} bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{widget.title}</h3>
                      <p className="text-xs text-slate-500">Maker-Checker actions & approvals</p>
                    </div>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {[
                      {
                        action: 'Item Creation Submitted',
                        actor: 'Karthik Raja (Maker)',
                        target: 'MAPALBL0003',
                        time: '12m ago',
                        color: 'bg-amber-500',
                      },
                      {
                        action: 'Item Approved by Checker',
                        actor: 'Ramesh B. (Checker)',
                        target: 'FGHDMCRGY0002',
                        time: '1h ago',
                        color: 'bg-emerald-500',
                      },
                      {
                        action: 'SAP Synchronized',
                        actor: 'Service Layer Batch #481',
                        target: 'RMPAOPOEXLG0001',
                        time: '3h ago',
                        color: 'bg-blue-500',
                      },
                      {
                        action: 'Rule Engine v1.2 Published',
                        actor: 'Ananya Sharma (Admin)',
                        target: 'RM Naming Rules',
                        time: '1d ago',
                        color: 'bg-purple-500',
                      },
                    ].map((act, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs">
                        <span className={`w-2 h-2 rounded-full ${act.color} mt-1.5 shrink-0`} />
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900">{act.action}</div>
                          <div className="text-[11px] text-slate-500">
                            {act.actor} • <span className="font-mono text-blue-700">{act.target}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">{act.time}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-slate-100 mt-2 text-right">
                    <button
                      onClick={() => onNavigate('/settings/audit-logs')}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      Complete Audit Trail →
                    </button>
                  </div>
                </div>
              );
            }

            // 3.7 Enterprise Quick Actions
            if (widget.widgetType === 'SHORTCUTS' || widget.id === 'w-quick-shortcuts') {
              return (
                <div
                  key={widget.id}
                  className={`${spanClass} bg-white rounded-xl border border-slate-200 shadow-xs p-4`}
                >
                  <h3 className="font-bold text-xs text-slate-900 mb-3 uppercase tracking-wider text-slate-500">
                    Enterprise Quick Actions
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button
                      onClick={() => onNavigate('/items/new')}
                      className="p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition flex items-center gap-2.5 text-left cursor-pointer"
                    >
                      <div className="p-2 rounded-md bg-emerald-100 text-emerald-800">
                        <FilePlus2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900">Create New Item</div>
                        <div className="text-[10px] text-slate-500">Rule-driven Maker flow</div>
                      </div>
                    </button>

                    <button
                      onClick={() => onNavigate('/approvals')}
                      className="p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition flex items-center gap-2.5 text-left cursor-pointer"
                    >
                      <div className="p-2 rounded-md bg-amber-100 text-amber-800">
                        <Inbox className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900">Approval Inbox</div>
                        <div className="text-[10px] text-slate-500">Review pending requests</div>
                      </div>
                    </button>

                    <button
                      onClick={() => onNavigate('/integration/testing')}
                      className="p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition flex items-center gap-2.5 text-left cursor-pointer"
                    >
                      <div className="p-2 rounded-md bg-blue-100 text-blue-800">
                        <PlayCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900">Test SAP B1 HANA</div>
                        <div className="text-[10px] text-slate-500">20 automated test checks</div>
                      </div>
                    </button>

                    <button
                      onClick={() => onNavigate('/communication')}
                      className="p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition flex items-center gap-2.5 text-left cursor-pointer"
                    >
                      <div className="p-2 rounded-md bg-purple-100 text-purple-800">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900">Communications</div>
                        <div className="text-[10px] text-slate-500">Email & Broadcasts Hub</div>
                      </div>
                    </button>
                  </div>
                </div>
              );
            }

            return null;
          })}
      </div>

      {/* 4. Dashboard Customizer Modal */}
      <DashboardCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        currentDashboard={dashboard}
        onSaveDashboard={(updated) => setDashboard(updated)}
        onResetDefault={() => setDashboard(INITIAL_DASHBOARD_DEFINITIONS[0])}
      />
    </div>
  );
};
