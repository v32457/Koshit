import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  RefreshCw,
  ShieldCheck,
  History,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { AccessReviewItem } from '../../../types/userRoleAdmin';
import { userRoleAdminService } from '../../../services/userRoleAdminService';
import { EnterpriseAuditService } from '../../../services/enterpriseAuditService';
import { useStandardDataGrid } from '../../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../../components/DataGridFooter';
import { ModalShell, RiskTag, StatusTag, UserRoleAdminTabProps } from './shared';

export const AuditHistoryReviewsTab: React.FC<UserRoleAdminTabProps> = ({
  currentUser,
  onNotify,
  refreshTick,
  triggerRefresh,
}) => {
  const reviews = useMemo(() => userRoleAdminService.getAccessReviews(), [refreshTick]);
  const permHistory = useMemo(() => userRoleAdminService.getPermissionChangeHistory(), [refreshTick]);
  const assocHistory = useMemo(() => userRoleAdminService.getAssociationHistory(), [refreshTick]);
  const securityAudits = useMemo(
    () => EnterpriseAuditService.getAuditLogs({ entityType: 'SECURITY' }),
    [refreshTick]
  );

  const [decisionTarget, setDecisionTarget] = useState<{
    item: AccessReviewItem;
    decision: Exclude<AccessReviewItem['decision'], 'PENDING'>;
  } | null>(null);
  const [justification, setJustification] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [chainVerified, setChainVerified] = useState<{ valid: boolean; brokenAt?: string } | null>(null);

  const reviewsGrid = useStandardDataGrid({
    gridId: 'ura-access-reviews',
    userId: currentUser.id,
    data: reviews,
    defaultSortField: 'createdAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
  });

  const permGrid = useStandardDataGrid({
    gridId: 'ura-perm-history',
    userId: currentUser.id,
    data: permHistory,
    defaultSortField: 'timestamp',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
  });

  const auditGrid = useStandardDataGrid({
    gridId: 'ura-security-audit',
    userId: currentUser.id,
    data: securityAudits,
    defaultSortField: 'timestamp',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
  });

  const assocGrid = useStandardDataGrid({
    gridId: 'ura-association-history',
    userId: currentUser.id,
    data: assocHistory,
    defaultSortField: 'timestamp',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
  });

  const actor = { id: currentUser.id, name: currentUser.fullName };

  const handleGenerateCycle = () => {
    userRoleAdminService.generatePeriodicAccessReviews(actor);
    triggerRefresh();
    onNotify('Periodic Access Review cycle refreshed against active assignments.', 'success');
  };

  const handleSubmitDecision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionTarget) return;
    try {
      userRoleAdminService.submitAccessReviewDecision(
        decisionTarget.item.id,
        decisionTarget.decision,
        justification,
        evidenceRef,
        actor
      );
      setDecisionTarget(null);
      setJustification('');
      setEvidenceRef('');
      triggerRefresh();
      onNotify(
        `Access Review marked as ${decisionTarget.decision}.${
          decisionTarget.decision === 'REVOKED' ? ' Underlying assignment automatically revoked.' : ''
        }`,
        'success'
      );
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleVerifyIntegrity = async () => {
    const res = await EnterpriseAuditService.verifyAuditChainIntegrity();
    setChainVerified({ valid: res.isValid, brokenAt: res.tamperedRecordId });
    onNotify(
      res.isValid ? `Tamper-evident SHA-256 chain verified across ${res.totalRecords} audit event(s).` : res.message || `Integrity warning at ${res.tamperedRecordId}`,
      res.isValid ? 'success' : 'error'
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. Access Reviews & Certification */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-indigo-600" />
              Periodic Access Reviews & Certification
            </h3>
            <p className="text-[11px] text-slate-500">
              Confirm, revoke (auto-revokes live assignment), modify, or request clarification with mandatory justification & evidence references.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateCycle}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Generate Review Cycle
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-2.5">Review Type</th>
                <th className="p-2.5">User & Role</th>
                <th className="p-2.5">Summary</th>
                <th className="p-2.5">Risk</th>
                <th className="p-2.5">Decision & Evidence</th>
                <th className="p-2.5 text-right">Certify</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reviewsGrid.pagedData.map((r) => (
                <tr key={r.id}>
                  <td className="p-2.5 font-semibold text-slate-800">{r.reviewType.replace(/_/g, ' ')}</td>
                  <td className="p-2.5">
                    <div className="font-bold text-slate-900">{r.targetUserName}</div>
                    <div className="text-[11px] font-mono text-indigo-700">{r.targetRoleCode}</div>
                  </td>
                  <td className="p-2.5 text-slate-600">{r.summary}</td>
                  <td className="p-2.5"><RiskTag level={r.riskIndicator} /></td>
                  <td className="p-2.5">
                    <StatusTag status={r.decision} />
                    {r.reviewerName && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {r.reviewerName} • {r.evidenceRef}
                      </div>
                    )}
                  </td>
                  <td className="p-2.5 text-right">
                    {r.decision === 'PENDING' && (
                      <div className="inline-flex flex-wrap gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => setDecisionTarget({ item: r, decision: 'CONFIRMED' })}
                          className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-[11px] font-bold text-emerald-800 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3 inline mr-0.5" /> Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecisionTarget({ item: r, decision: 'REVOKED' })}
                          className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-700 cursor-pointer"
                        >
                          <XCircle className="w-3 h-3 inline mr-0.5" /> Revoke
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecisionTarget({ item: r, decision: 'CLARIFICATION_REQUESTED' })}
                          className="px-2 py-1 rounded border border-amber-200 bg-amber-50 text-[11px] font-bold text-amber-800 cursor-pointer"
                        >
                          Clarify
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DataGridFooter
          currentPage={reviewsGrid.currentPage}
          totalPages={reviewsGrid.totalPages}
          pageSize={reviewsGrid.pageSize}
          totalRecords={reviewsGrid.totalRecords}
          onPageChange={reviewsGrid.setCurrentPage}
          onPageSizeChange={reviewsGrid.setPageSize}
          pageSizeOptions={reviewsGrid.pageSizeOptions}
        />
      </div>

      {/* 2. Permission Change History */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
          <History className="w-4 h-4 text-indigo-600" />
          Permission Change History ({permHistory.length})
        </h4>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">Target</th>
                <th className="p-2.5">Action</th>
                <th className="p-2.5">Permissions</th>
                <th className="p-2.5">Actor & Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {permGrid.pagedData.map((h) => (
                <tr key={h.id}>
                  <td className="p-2.5 font-mono text-[10px] text-slate-500">{h.timestamp}</td>
                  <td className="p-2.5">
                    <div className="font-bold text-slate-900">{h.targetName}</div>
                    <div className="text-[10px] text-slate-500">{h.targetType}</div>
                  </td>
                  <td className="p-2.5 font-mono font-bold text-indigo-700">{h.action}</td>
                  <td className="p-2.5 font-mono text-[10px] text-slate-700">{h.permissionCodes.join(', ') || '-'}</td>
                  <td className="p-2.5 text-[11px]">
                    <div className="font-semibold text-slate-800">{h.actorName}</div>
                    <div className="text-slate-500">{h.reason}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DataGridFooter
          currentPage={permGrid.currentPage}
          totalPages={permGrid.totalPages}
          pageSize={permGrid.pageSize}
          totalRecords={permGrid.totalRecords}
          onPageChange={permGrid.setCurrentPage}
          onPageSizeChange={permGrid.setPageSize}
          pageSizeOptions={permGrid.pageSizeOptions}
        />
      </div>

      {/* 3. Tamper-Evident Security Audit Stream */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Tamper-Evident Security Audit Ledger ({securityAudits.length} events)
          </h4>
          <button
            type="button"
            onClick={handleVerifyIntegrity}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
          >
            Verify SHA-256 Chain Integrity
          </button>
        </div>
        {chainVerified && (
          <div className={`p-2.5 rounded-lg border text-xs font-bold ${chainVerified.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            {chainVerified.valid ? 'SHA-256 Hash Chain Verified: 0 tampered events.' : `Integrity Break Detected at Event ${chainVerified.brokenAt}`}
          </div>
        )}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">Event Type</th>
                <th className="p-2.5">Description</th>
                <th className="p-2.5">Actor</th>
                <th className="p-2.5">Hash Prefix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditGrid.pagedData.map((a) => (
                <tr key={a.id}>
                  <td className="p-2.5 font-mono text-[10px] text-slate-500">{a.timestamp}</td>
                  <td className="p-2.5 font-mono font-bold text-indigo-700">{a.eventType}</td>
                  <td className="p-2.5 text-slate-800">{a.eventDescription}</td>
                  <td className="p-2.5 font-semibold text-slate-700">{a.changedByName}</td>
                  <td className="p-2.5 font-mono text-[10px] text-slate-500">{a.hash.slice(0, 16)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DataGridFooter
          currentPage={auditGrid.currentPage}
          totalPages={auditGrid.totalPages}
          pageSize={auditGrid.pageSize}
          totalRecords={auditGrid.totalRecords}
          onPageChange={auditGrid.setCurrentPage}
          onPageSizeChange={auditGrid.setPageSize}
          pageSizeOptions={auditGrid.pageSizeOptions}
        />
      </div>

      {/* 4. Employee Association & Reassociation History */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div>
          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <History className="w-4 h-4 text-indigo-600" />
            Employee Association &amp; Reassociation History ({assocHistory.length})
          </h4>
          <p className="text-[11px] text-slate-500">
            Immutable record of Associated ↔ Not Associated transitions, offboarding revocations, and revalidated assignments.
          </p>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">Employee</th>
                <th className="p-2.5">Transition</th>
                <th className="p-2.5">Effective Date</th>
                <th className="p-2.5">Changed / Approved By</th>
                <th className="p-2.5">Approval Ref</th>
                <th className="p-2.5">Reason &amp; Policy Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assocGrid.pagedData.map((h) => (
                <tr key={h.id}>
                  <td className="p-2.5 font-mono text-[10px] text-slate-500 tabular-nums">{h.timestamp}</td>
                  <td className="p-2.5">
                    <div className="font-bold text-slate-900">{h.userName}</div>
                    <div className="text-[10px] font-mono text-slate-500">{h.employeeId || h.username}</div>
                  </td>
                  <td className="p-2.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      <StatusTag status={h.previousStatus} />
                      <span className="text-slate-400">→</span>
                      <StatusTag status={h.newStatus} />
                    </div>
                  </td>
                  <td className="p-2.5 font-mono text-[11px] tabular-nums">{h.effectiveDate}</td>
                  <td className="p-2.5 text-[11px]">
                    <div className="font-semibold text-slate-800">{h.changedByName}</div>
                    {h.approvedByName && <div className="text-slate-500">Approved: {h.approvedByName}</div>}
                  </td>
                  <td className="p-2.5 font-mono text-[11px] text-indigo-700">{h.approvalReference || '-'}</td>
                  <td className="p-2.5 text-[11px] text-slate-700">
                    <div>{h.reason}</div>
                    {h.offboardingActionsApplied && (
                      <div className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                        Revoked: {h.offboardingActionsApplied.sessionsRevokedCount} session(s), {h.offboardingActionsApplied.assignmentsRevokedCount} assignment(s), {h.offboardingActionsApplied.tempAccessRevokedCount} temp grant(s)
                      </div>
                    )}
                    {h.revalidatedOrgAssignments && h.revalidatedOrgAssignments.length > 0 && (
                      <div className="text-[10px] text-emerald-700 mt-0.5">
                        Revalidated: {h.revalidatedOrgAssignments.map((r) => `${r.roleCode} (${r.companyId})`).join(', ')}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {assocGrid.pagedData.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-5 text-center text-slate-400 font-semibold">
                    No association lifecycle transitions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <DataGridFooter
          currentPage={assocGrid.currentPage}
          totalPages={assocGrid.totalPages}
          pageSize={assocGrid.pageSize}
          totalRecords={assocGrid.totalRecords}
          onPageChange={assocGrid.setCurrentPage}
          onPageSizeChange={assocGrid.setPageSize}
          pageSizeOptions={assocGrid.pageSizeOptions}
        />
      </div>

      {decisionTarget && (
        <ModalShell
          title={`Certify Access Review — ${decisionTarget.decision}`}
          subtitle={`${decisionTarget.item.targetUserName} • ${decisionTarget.item.targetRoleCode}`}
          onClose={() => setDecisionTarget(null)}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleSubmitDecision} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Certification Evidence Reference</label>
              <input value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} placeholder="e.g. CERT-Q4-2026-014" className="w-full p-2 border border-slate-300 rounded-lg font-mono" />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mandatory Justification *</label>
              <textarea required value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Document business justification for review decision..." className="w-full p-2 border border-slate-300 rounded-lg h-20" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDecisionTarget(null)} className="px-3.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">Submit Certification</button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
};
