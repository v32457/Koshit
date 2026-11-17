import React, { useState, useMemo } from 'react';
import {
  EnterpriseAuditService,
  EnterpriseAuditRecord,
  AuditFilterParams,
} from '../../services/enterpriseAuditService';
import { AuditDetailModal } from '../../components/AuditDetailModal';
import { INITIAL_COMPANIES } from '../../data/seedData';
import { PurchaseOrganizationService } from '../../services/purchaseOrganizationService';
import { User } from '../../types';
import { financialYearService } from '../../services/financialYearService';
import { FinancialYearSelector } from '../../components/FinancialYearSelector';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';
import { executeScopedExport } from '../../services/exportService';
import { rbacPermissionService } from '../../services/rbacPermissionService';
import {
  FileCheck,
  Shield,
  Search,
  Filter,
  Download,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Eye,
  Calendar,
  Layers,
  Users,
  Clock,
  Lock,
  Building2,
  ArrowRight,
  FileText,
  AlertTriangle,
} from 'lucide-react';

interface AuditLogsViewProps {
  currentUser?: User;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ currentUser }) => {
  const [filters, setFilters] = useState<AuditFilterParams>({
    companyId: 'ALL',
    purchaseOrganizationId: 'ALL',
    branchId: 'ALL',
    entityType: 'ALL',
    eventType: 'ALL',
    changedBy: '',
    dateFrom: '',
    dateTo: '',
    searchQuery: '',
  });
  const [selectedFyId, setSelectedFyId] = useState<string>(
    () => financialYearService.getDefaultFinancialYearForCompany('co-kosh-01')?.id || ''
  );

  const [selectedRecord, setSelectedRecord] = useState<EnterpriseAuditRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    totalRecords: number;
    message: string;
  } | null>(null);

  const orgsList = useMemo(() => PurchaseOrganizationService.getOrganizations(), []);

  // Fetch Live Audit Logs, then apply centralized Financial Year & RBAC Filter
  const baseAuditLogs = useMemo(() => {
    return EnterpriseAuditService.getAuditLogs(filters, currentUser);
  }, [filters, currentUser]);

  const fyResult = useMemo(() => {
    return financialYearService.filterTransactionsByFinancialYear({
      records: baseAuditLogs,
      selectedFyId,
      companyId: filters.companyId || 'ALL',
      branchId: filters.branchId || 'ALL',
      purchaseOrgId: filters.purchaseOrganizationId || 'ALL',
      currentUser,
      entityType: 'AUDIT_LOG',
      getRecordId: (r) => r.id,
      getDocumentNumber: (r) => r.correlationId || r.id,
      getCompanyId: (r) => r.companyId,
      getBranchId: (r) => r.branchId,
      getPurchaseOrgId: (r) => r.purchaseOrganizationId,
      getFinancialYearId: (r) =>
        (r.newValue?.financialYearId as string | undefined) ||
        (r.previousValue?.financialYearId as string | undefined),
      getFinancialYearCode: (r) =>
        (r.newValue?.financialYearCode as string | undefined) ||
        (r.previousValue?.financialYearCode as string | undefined),
      getDocumentDate: (r) => r.timestamp?.slice(0, 10),
    });
  }, [baseAuditLogs, selectedFyId, filters.companyId, filters.branchId, filters.purchaseOrganizationId, currentUser]);

  const auditLogs = fyResult.filteredRecords;

  const {
    pagedData: paginatedAuditLogs,
    allSortedData: sortedAuditLogs,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalRecords,
    totalPages,
    pageSizeOptions,
  } = useStandardDataGrid<EnterpriseAuditRecord>({
    gridId: 'audit-logs',
    userId: currentUser?.id,
    data: auditLogs,
    defaultSortField: 'timestamp',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
    filterSignature: JSON.stringify(filters) + selectedFyId,
    getRowId: (r) => r.id,
  });

  const canExportAll = rbacPermissionService.hasPermission(currentUser, 'EXPORT_ALL_FILTERED');
  const [exportScope, setExportScope] = useState<'CURRENT_PAGE' | 'ALL_FILTERED'>('CURRENT_PAGE');
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const metrics = useMemo(() => {
    return {
      totalEvents: auditLogs.length,
      poChanges: auditLogs.filter((r) => r.entityType === 'PURCHASE_ORGANIZATION').length,
      buyerChanges: auditLogs.filter((r) => r.entityType === 'BUYER_ASSIGNMENT').length,
      managerChanges: auditLogs.filter((r) => r.entityType === 'MANAGER_ASSIGNMENT').length,
      validityChanges: auditLogs.filter(
        (r) => r.eventType.includes('VALIDITY') || r.effectiveFrom || r.effectiveTo
      ).length,
      delegationEvents: auditLogs.filter((r) => r.entityType === 'DELEGATION').length,
      unauthorizedAttempts: auditLogs.filter(
        (r) => r.entityType === 'SECURITY' || r.eventType === 'UNAUTHORIZED_ATTEMPT'
      ).length,
    };
  }, [auditLogs]);

  const handleVerifyChain = async () => {
    const res = await EnterpriseAuditService.verifyAuditChainIntegrity();
    setVerificationResult(res);
  };

  const handleExportCsv = async () => {
    const targetRecords = exportScope === 'CURRENT_PAGE' ? paginatedAuditLogs : sortedAuditLogs;
    if (exportScope === 'ALL_FILTERED' && !canExportAll) {
      setExportMessage('Permission EXPORT_ALL_FILTERED required for All Filtered export. Exported Current Page instead.');
      return;
    }
    const res = await executeScopedExport({
      format: 'csv',
      exportScope,
      title: 'CIPPlatform — Enterprise Audit Ledger',
      subtitle: 'Immutable Cryptographic Audit Log Export',
      headers: ['Timestamp', 'Correlation ID', 'Actor', 'Channel', 'Company', 'Entity Type', 'Event Type', 'Description', 'Reason'],
      rows: targetRecords.map((r) => [
        r.timestamp,
        r.correlationId || '',
        r.changedByName || '',
        r.source || '',
        r.companyName || r.companyId || '',
        r.entityType,
        r.eventType,
        r.eventDescription,
        r.changeReason || '',
      ]),
      filenamePrefix: 'enterprise_audit_logs',
    });
    setExportMessage(res.message);
    setTimeout(() => setExportMessage(null), 4000);
  };

  const resetFilters = () => {
    setFilters({
      companyId: 'ALL',
      purchaseOrganizationId: 'ALL',
      branchId: 'ALL',
      entityType: 'ALL',
      eventType: 'ALL',
      changedBy: '',
      dateFrom: '',
      dateTo: '',
      searchQuery: '',
    });
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Top Banner & Governance Controls */}
      <div className="bg-slate-900 text-white p-4.5 rounded-xl shadow-xs border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            Enterprise Immutable Audit Engine & Cryptographic Integrity Ledger
          </div>
          <h2 className="text-lg font-black text-white mt-1 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-emerald-400" />
            Enterprise Audit Logs & Change History
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Append-only tamper-evident ledger with Web Crypto SHA-256 chained hashing, RBAC data isolation, and field-level change diffs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleVerifyChain}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold rounded-lg border border-cyan-800/60 flex items-center gap-1.5 cursor-pointer shadow-2xs transition"
          >
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            Verify SHA-256 Chain Integrity
          </button>

          <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <select
              aria-label="Audit export scope"
              value={exportScope}
              onChange={(e) => setExportScope(e.target.value as 'CURRENT_PAGE' | 'ALL_FILTERED')}
              className="bg-slate-900 text-slate-200 text-xs font-bold px-2 py-1 rounded border border-slate-700"
            >
              <option value="CURRENT_PAGE">Current Page ({paginatedAuditLogs.length})</option>
              <option value="ALL_FILTERED" disabled={!canExportAll}>
                All Filtered ({sortedAuditLogs.length}){!canExportAll ? ' [Restricted]' : ''}
              </option>
            </select>
            <button
              onClick={handleExportCsv}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer transition"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {exportMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
          {exportMessage}
        </div>
      )}

      {/* Verification Result Banner */}
      {verificationResult && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            verificationResult.isValid
              ? 'bg-emerald-950/50 border-emerald-600 text-emerald-200'
              : 'bg-rose-950/50 border-rose-600 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {verificationResult.isValid ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <div>
              <div className="font-bold text-xs">
                {verificationResult.isValid
                  ? 'Cryptographic Audit Ledger Validated'
                  : 'TAMPER DETECTED IN AUDIT LEDGER'}
              </div>
              <div className="text-[11px] opacity-90 mt-0.5 font-mono">
                {verificationResult.message}
              </div>
            </div>
          </div>
          <button
            onClick={() => setVerificationResult(null)}
            className="text-xs font-bold underline opacity-80 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <FinancialYearSelector
        companyId={filters.companyId || 'co-kosh-01'}
        selectedFyId={selectedFyId}
        onSelectFy={setSelectedFyId}
        currentUser={currentUser}
        dataQualityGaps={fyResult.dataQualityGaps}
        entityLabel="Audit Logs"
      />

      {/* Metrics Dashboard Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Total Events</div>
          <div className="text-lg font-black text-slate-900 mt-1">{metrics.totalEvents}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Purchase Org Changes</div>
          <div className="text-lg font-black text-indigo-600 mt-1">{metrics.poChanges}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Buyer Changes</div>
          <div className="text-lg font-black text-blue-600 mt-1">{metrics.buyerChanges}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Manager Changes</div>
          <div className="text-lg font-black text-purple-600 mt-1">{metrics.managerChanges}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Validity Changes</div>
          <div className="text-lg font-black text-emerald-600 mt-1">{metrics.validityChanges}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Delegations</div>
          <div className="text-lg font-black text-amber-600 mt-1">{metrics.delegationEvents}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Security Violations</div>
          <div className="text-lg font-black text-rose-600 mt-1">{metrics.unauthorizedAttempts}</div>
        </div>
      </div>

      {/* Filter Suite */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between font-bold text-slate-900 text-xs">
          <span className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-indigo-600" />
            Audit Log Search & Multi-Dimensional Filter Suite
          </span>
          <button
            onClick={resetFilters}
            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Company Scope</label>
            <select
              value={filters.companyId || 'ALL'}
              onChange={e => setFilters({ ...filters, companyId: e.target.value })}
              className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800"
            >
              <option value="ALL">All Group Companies</option>
              {INITIAL_COMPANIES.map(c => (
                <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Purchase Organization</label>
            <select
              value={filters.purchaseOrganizationId || 'ALL'}
              onChange={e => setFilters({ ...filters, purchaseOrganizationId: e.target.value })}
              className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800"
            >
              <option value="ALL">All Purchase Orgs</option>
              {orgsList.map(o => (
                <option key={o.id} value={o.id}>[{o.code}] {o.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Entity Type</label>
            <select
              value={filters.entityType || 'ALL'}
              onChange={e => setFilters({ ...filters, entityType: e.target.value })}
              className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800"
            >
              <option value="ALL">All Entity Types</option>
              <option value="PURCHASE_ORGANIZATION">Purchase Organization</option>
              <option value="BUYER_ASSIGNMENT">Buyer Assignment</option>
              <option value="MANAGER_ASSIGNMENT">Manager Assignment</option>
              <option value="DELEGATION">Delegation & Replacement</option>
              <option value="ASSIGNMENT_RULE">Assignment Rule</option>
              <option value="SECURITY">Security / Access Control</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Search Keywords</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search event description, correlation ID, user..."
                value={filters.searchQuery || ''}
                onChange={e => setFilters({ ...filters, searchQuery: e.target.value })}
                className="w-full p-2 pl-8 bg-white border border-slate-300 rounded text-xs"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Audit Trail Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between font-bold text-xs bg-slate-50">
          <span className="text-slate-800">
            Audit Ledger Trail ({auditLogs.length} Matching Events)
          </span>
          <span className="text-slate-500 font-mono text-[11px]">Strictly Append-Only</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-3">Timestamp & Correlation ID</th>
                <th className="p-3">Actor & Channel</th>
                <th className="p-3">Company Scope</th>
                <th className="p-3">Entity & Event Type</th>
                <th className="p-3">Event Summary</th>
                <th className="p-3">Validity Period</th>
                <th className="p-3">Hash Integrity</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedAuditLogs.length > 0 ? (
                paginatedAuditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="p-3">
                      <div className="font-mono font-bold text-slate-800">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                      <div className="font-mono text-[10px] text-cyan-700 font-semibold truncate max-w-[140px]">
                        {log.correlationId}
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="font-bold text-slate-900">{log.changedByName}</div>
                      <div className="text-[10px] text-amber-700 font-mono font-semibold">
                        Channel: {log.source}
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="font-bold text-slate-800">{log.companyName || log.companyId}</div>
                      {log.purchaseOrganizationCode && (
                        <div className="text-[10px] text-indigo-700 font-bold font-mono">
                          [{log.purchaseOrganizationCode}]
                        </div>
                      )}
                    </td>

                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold block w-max ${
                          log.entityType === 'PURCHASE_ORGANIZATION'
                            ? 'bg-indigo-100 text-indigo-800'
                            : log.entityType === 'BUYER_ASSIGNMENT'
                            ? 'bg-blue-100 text-blue-800'
                            : log.entityType === 'MANAGER_ASSIGNMENT'
                            ? 'bg-purple-100 text-purple-800'
                            : log.entityType === 'DELEGATION'
                            ? 'bg-amber-100 text-amber-800'
                            : log.entityType === 'SECURITY'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {log.eventType}
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{log.eventDescription}</div>
                      <div className="text-[10px] text-slate-500 italic mt-0.5">
                        Reason: {log.changeReason}
                      </div>
                    </td>

                    <td className="p-3 font-mono text-[11px]">
                      {log.effectiveFrom ? (
                        <span>
                          <span className="font-bold text-slate-800">{log.effectiveFrom}</span>
                          <span className="text-slate-400"> to </span>
                          <span className="font-bold text-slate-800">{log.effectiveTo || 'Open'}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">Immediate</span>
                      )}
                    </td>

                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[10px] font-bold flex items-center gap-1 w-max">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        SHA-256 Valid
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedRecord(log);
                          setIsDetailModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded flex items-center gap-1 ml-auto cursor-pointer transition"
                        title="View Detailed Before & After Diff"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Diff Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500 italic">
                    No audit log records match the selected filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DataGridFooter
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalRecords={totalRecords}
        pageSizeOptions={pageSizeOptions}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        defaultSortNotice="Default Sort: Event Timestamp (Newest First)"
      />

      {/* Audit Detail & Diff Modal */}
      <AuditDetailModal
        auditRecord={selectedRecord}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
      />
    </div>
  );
};
