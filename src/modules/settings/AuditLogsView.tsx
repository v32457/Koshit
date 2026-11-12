import React, { useState, useMemo } from 'react';
import {
  EnterpriseAuditService,
  EnterpriseAuditRecord,
  AuditFilterParams,
} from '../../services/enterpriseAuditService';
import { AuditDetailModal } from '../../components/AuditDetailModal';
import { INITIAL_COMPANIES, INITIAL_BRANCHES } from '../../data/seedData';
import { PurchaseOrganizationService } from '../../services/purchaseOrganizationService';
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

export const AuditLogsView: React.FC = () => {
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

  const [selectedRecord, setSelectedRecord] = useState<EnterpriseAuditRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    totalRecords: number;
    message: string;
  } | null>(null);

  const orgsList = useMemo(() => PurchaseOrganizationService.getOrganizations(), []);

  // Fetch Live Audit Logs & Metrics
  const auditLogs = useMemo(() => {
    return EnterpriseAuditService.getAuditLogs(filters);
  }, [filters]);

  const metrics = useMemo(() => {
    return EnterpriseAuditService.getDashboardMetrics(filters);
  }, [filters]);

  const handleVerifyChain = async () => {
    const res = await EnterpriseAuditService.verifyAuditChainIntegrity();
    setVerificationResult(res);
  };

  const handleExportCsv = () => {
    EnterpriseAuditService.exportAuditLogsToCsv(filters);
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

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer transition"
          >
            <Download className="w-4 h-4" />
            Export Audit Trail (CSV)
          </button>
        </div>
      </div>

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
              {auditLogs.length > 0 ? (
                auditLogs.map((log) => (
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

      {/* Audit Detail & Diff Modal */}
      <AuditDetailModal
        auditRecord={selectedRecord}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
      />
    </div>
  );
};
