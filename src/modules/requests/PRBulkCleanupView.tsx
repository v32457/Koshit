/**
 * CIPPLATFORM - STALE UNAPPROVED PR LINE BULK CLEANUP VIEW
 * Phase 1 PR Module (Feature 16 / Addendum A2): Supports preview, administrator-configured XX days threshold, soft archive, and audit restoration.
 */

import React, { useState } from 'react';
import { User } from '../../types';
import { PRCleanupConfig, PRArchiveLog } from '../../types/purchaseRequisition';
import { PurchaseRequisitionService } from '../../services/purchaseRequisitionService';
import { Trash2, ShieldAlert, RefreshCw, CheckCircle2, ArrowLeft, Archive, Search } from 'lucide-react';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';

interface PRBulkCleanupViewProps {
  currentUser: User;
  onBack: () => void;
}

export const PRBulkCleanupView: React.FC<PRBulkCleanupViewProps> = ({ currentUser, onBack }) => {
  const [config, setConfig] = useState<PRCleanupConfig>(() => PurchaseRequisitionService.getCleanupConfig());
  const [archives, setArchives] = useState<PRArchiveLog[]>(() => PurchaseRequisitionService.getArchives());
  const [previewDays, setPreviewDays] = useState(config.ageThresholdDays);
  const [successMessage, setSuccessMessage] = useState('');

  const prs = PurchaseRequisitionService.getPurchaseRequisitions();

  // Calculate candidates older than previewDays with eligible statuses (e.g., DRAFT)
  const now = Date.now();
  const thresholdMs = previewDays * 86400000;

  const candidates: Array<{ prId: string; prNumber: string; lineId: string; itemCode: string; requesterName: string; status: string; ageDays: number }> = [];

  prs.forEach((pr) => {
    if (config.eligibleStatuses.includes(pr.status)) {
      const createdTime = new Date(pr.createdAt).getTime();
      const ageDays = Math.floor((now - createdTime) / 86400000);
      if (ageDays >= previewDays) {
        pr.lines.forEach((l) => {
          candidates.push({
            prId: pr.id,
            prNumber: pr.prNumber,
            lineId: l.id,
            itemCode: l.itemCode,
            requesterName: pr.requesterName,
            status: pr.status,
            ageDays
          });
        });
      }
    }
  });

  const candidatesGrid = useStandardDataGrid({
    data: candidates,
    gridId: 'pr-bulk-cleanup-candidates',
    userId: currentUser?.id || 'usr-default',
    primarySortField: 'prNumber',
    tieBreakerField: 'lineId',
    filterSignature: `${previewDays}`,
  });

  const archivesGrid = useStandardDataGrid({
    data: archives,
    gridId: 'pr-bulk-cleanup-archives',
    userId: currentUser?.id || 'usr-default',
    primarySortField: 'archivedAt',
    tieBreakerField: 'id',
    filterSignature: `${archives.length}`,
  });

  const handleRunCleanup = () => {
    const newArchives: PRArchiveLog[] = [...archives];
    candidates.forEach((c) => {
      newArchives.push({
        id: `arch-${Date.now()}-${Math.random()}`,
        prId: c.prId,
        lineId: c.lineId,
        prNumber: c.prNumber,
        itemCode: c.itemCode,
        archivedAt: new Date().toISOString(),
        archivedBy: currentUser.fullName,
        reason: `Exceeded configurable threshold of ${previewDays} days in unapproved status (${c.status})`,
        ageInDays: c.ageDays,
        originalStatus: c.status as any
      });
    });

    PurchaseRequisitionService.saveArchives(newArchives);
    setArchives(newArchives);
    setSuccessMessage(`Successfully archived ${candidates.length} stale unapproved PR line(s) using soft archive rule.`);
  };

  const handleUpdateConfig = () => {
    const updated: PRCleanupConfig = {
      ...config,
      ageThresholdDays: previewDays
    };
    PurchaseRequisitionService.saveCleanupConfig(updated);
    setConfig(updated);
    setSuccessMessage('Cleanup configuration updated successfully.');
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Archive className="w-5 h-5 text-amber-600" />
              Stale Unapproved PR Line Bulk Cleanup (XX Days)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure age threshold, preview eligible unapproved lines, and perform soft archive with full audit retention.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-700">Age Threshold (Days):</label>
          <input
            type="number"
            value={previewDays}
            onChange={(e) => setPreviewDays(parseInt(e.target.value) || 30)}
            className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center"
          />
          <button
            onClick={handleUpdateConfig}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition"
          >
            Save Config
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl flex items-center gap-2 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {successMessage}
        </div>
      )}

      {/* Candidates Preview Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Eligible Cleanup Candidates ({candidates.length})
            </h3>
            <p className="text-[11px] text-slate-500">Unapproved lines older than {previewDays} days. Approved lines are never removed.</p>
          </div>

          <button
            onClick={handleRunCleanup}
            disabled={candidates.length === 0}
            className={`px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs shadow-xs transition ${
              candidates.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            Execute Bulk Soft Archive
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-3">PR Number</th>
                <th className="p-3">Item Code</th>
                <th className="p-3">Requester</th>
                <th className="p-3">Current Status</th>
                <th className="p-3">Age (Days)</th>
                <th className="p-3">Action Proposed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidatesGrid.pagedData.map((c, i) => (
                <tr key={`${c.prId}-${c.lineId}-${i}`} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-indigo-700">{c.prNumber}</td>
                  <td className="p-3 font-mono text-slate-800">{c.itemCode}</td>
                  <td className="p-3 font-medium text-slate-800">{c.requesterName}</td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">{c.status}</span></td>
                  <td className="p-3 font-mono font-bold text-rose-600">{c.ageDays} days</td>
                  <td className="p-3 text-slate-600 font-medium">Soft Archive (Retain Audit)</td>
                </tr>
              ))}
              {candidatesGrid.pagedData.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                    No stale unapproved lines found exceeding {previewDays} days threshold.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <DataGridFooter
          totalRecords={candidatesGrid.totalRecords}
          currentPage={candidatesGrid.currentPage}
          pageSize={candidatesGrid.pageSize}
          totalPages={candidatesGrid.totalPages}
          onPageChange={candidatesGrid.onPageChange}
          onPageSizeChange={candidatesGrid.onPageSizeChange}
          entityLabel="cleanup candidates"
          sortNotice="Sorted newest PR first"
        />
      </div>

      {/* Archive Logs Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Archived Lines Audit Trail ({archives.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-3">PR Number</th>
                <th className="p-3">Item Code</th>
                <th className="p-3">Archived At</th>
                <th className="p-3">Archived By</th>
                <th className="p-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {archivesGrid.pagedData.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-slate-800">{a.prNumber}</td>
                  <td className="p-3 font-mono text-indigo-700">{a.itemCode}</td>
                  <td className="p-3 font-mono text-slate-500">{a.archivedAt.split('T')[0]}</td>
                  <td className="p-3 text-slate-800 font-medium">{a.archivedBy}</td>
                  <td className="p-3 text-slate-600">{a.reason}</td>
                </tr>
              ))}
              {archivesGrid.pagedData.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                    No archived records in audit log.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <DataGridFooter
          totalRecords={archivesGrid.totalRecords}
          currentPage={archivesGrid.currentPage}
          pageSize={archivesGrid.pageSize}
          totalPages={archivesGrid.totalPages}
          onPageChange={archivesGrid.onPageChange}
          onPageSizeChange={archivesGrid.onPageSizeChange}
          entityLabel="archive logs"
          sortNotice="Sorted newest archived first"
        />
      </div>
    </div>
  );
};
