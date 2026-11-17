import React, { useMemo, useState } from 'react';
import {
  ClipboardList,
  Plus,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import type { AccessRequestRecord, AccessRequestType, DataScopeLevel } from '../../../types/userRoleAdmin';
import { userRoleAdminService } from '../../../services/userRoleAdminService';
import { useStandardDataGrid } from '../../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../../components/DataGridFooter';
import { ModalShell, StatusTag, UserRoleAdminTabProps } from './shared';

export const AccessRequestsTab: React.FC<UserRoleAdminTabProps> = ({
  currentUser,
  companies,
  branches,
  onNotify,
  refreshTick,
  triggerRefresh,
}) => {
  const users = useMemo(() => userRoleAdminService.getUsers(), [refreshTick]);
  const roles = useMemo(() => userRoleAdminService.getRoles({ status: 'ACTIVE' }), [refreshTick]);
  const requests = useMemo(() => userRoleAdminService.getAccessRequests(), [refreshTick]);

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<AccessRequestRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [form, setForm] = useState({
    targetUserId: users[1]?.id || currentUser.id,
    requestType: 'ADDITIONAL_PERMISSION' as AccessRequestType,
    requestedRoleId: roles[1]?.id || '',
    requestedPermissionCodes: 'PROCUREMENT.PURCHASE_REQUISITION.APPROVE',
    companyId: companies[0]?.id || 'co-kosh-01',
    branchId: branches[0]?.id || 'br-pond-01',
    dataScopeLevel: 'BRANCH_RECORDS' as DataScopeLevel,
    isTemporary: false,
    validFrom: new Date().toISOString().slice(0, 10),
    validTo: '',
    justification: '',
  });

  const grid = useStandardDataGrid({
    gridId: 'ura-access-requests',
    userId: currentUser.id,
    data: requests,
    defaultSortField: 'createdAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
  });

  const actor = { id: currentUser.id, name: currentUser.fullName };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const perms = form.requestedPermissionCodes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const created = userRoleAdminService.submitAccessRequest({
        requesterUserId: currentUser.id,
        targetUserId: form.targetUserId,
        requestType: form.requestType,
        requestedRoleId: form.requestedRoleId || undefined,
        requestedPermissionCodes: perms,
        requestedScope: {
          companyIds: [form.companyId],
          branchIds: form.branchId ? [form.branchId] : [],
          businessUnitIds: [],
          departmentIds: [],
          purchaseOrgIds: [],
          purchaseGroupIds: [],
          salesOrgIds: [],
          warehouseIds: [],
          locationCodes: [],
          costCentreIds: [],
          projectIds: [],
          dataScopeLevel: form.dataScopeLevel,
        },
        isTemporary: form.isTemporary,
        validFrom: form.validFrom,
        validTo: form.validTo || undefined,
        justification: form.justification,
      });
      setShowSubmitModal(false);
      setForm({ ...form, justification: '' });
      triggerRefresh();
      onNotify(
        `Access Request ${created.requestNumber} submitted.${
          created.sodWarnings.length > 0 ? ` SoD Warnings detected: ${created.sodWarnings.length}.` : ''
        }`,
        'success'
      );
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleAction = (req: AccessRequestRecord, action: 'APPROVE' | 'ESCALATE' | 'RESUBMIT') => {
    try {
      const updated = userRoleAdminService.actOnAccessRequest(
        req.id,
        action,
        { comments: `${action} by ${currentUser.fullName}` },
        actor
      );
      triggerRefresh();
      onNotify(`Request ${updated.requestNumber} updated -> ${updated.status}.`, 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    try {
      const updated = userRoleAdminService.actOnAccessRequest(
        rejectTarget.id,
        'REJECT',
        { rejectionReason },
        actor
      );
      setRejectTarget(null);
      setRejectionReason('');
      triggerRefresh();
      onNotify(`Rejected ${updated.requestNumber}.`, 'info');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-indigo-600" />
            Access Request & Multi-Stage Approval Workflow
          </h3>
          <p className="text-[11px] text-slate-500">
            3-stage workflow (Manager → Data Owner → Security Admin) with self-approval prohibition, SoD warning preview, escalation, and resubmission.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSubmitModal(true)}
          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" /> Submit Access Request
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-3">Request # & Type</th>
                <th className="p-3">Target User & Requester</th>
                <th className="p-3">Requested Access</th>
                <th className="p-3">Workflow Stages</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grid.pagedData.map((r) => {
                const isPending = r.status.startsWith('PENDING') || r.status === 'ESCALATED';
                return (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="p-3">
                      <div className="font-mono font-bold text-indigo-700">{r.requestNumber}</div>
                      <div className="text-[11px] text-slate-600">{r.requestType.replace(/_/g, ' ')}</div>
                      {r.isTemporary && (
                        <div className="text-[10px] text-amber-700 font-semibold">Temp until {r.validTo}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{r.targetUserName}</div>
                      <div className="text-[11px] text-slate-500">By: {r.requesterName}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono text-[11px] text-slate-800">
                        {r.requestedRoleCode || r.requestedPermissionCodes.join(', ') || 'Scope Expansion'}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{r.justification}</div>
                      {r.sodWarnings.length > 0 && (
                        <div className="mt-1 text-[10px] font-bold text-orange-700 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" /> {r.sodWarnings[0]}
                        </div>
                      )}
                      {r.rejectionReason && (
                        <div className="mt-1 text-[10px] font-bold text-rose-700">Rejected: {r.rejectionReason}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="space-y-1 text-[10px]">
                        {r.approvals.map((st) => (
                          <div key={st.id} className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-500">{st.stageOrder}.</span>
                            <span className="text-slate-700">{st.stageName}:</span>
                            <span
                              className={`font-bold ${
                                st.decision === 'APPROVED'
                                  ? 'text-emerald-700'
                                  : st.decision === 'REJECTED'
                                  ? 'text-rose-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {st.decision}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <StatusTag status={r.status} />
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAction(r, 'APPROVE')}
                              className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-[11px] font-bold text-emerald-800 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3 inline mr-0.5" /> Approve Stage
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectTarget(r);
                                setRejectionReason('');
                              }}
                              className="px-2 py-1 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-[11px] font-bold text-rose-700 cursor-pointer"
                            >
                              <XCircle className="w-3 h-3 inline mr-0.5" /> Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAction(r, 'ESCALATE')}
                              className="px-2 py-1 rounded border border-amber-200 bg-amber-50 hover:bg-amber-100 text-[11px] font-bold text-amber-800 cursor-pointer"
                            >
                              <ArrowUpRight className="w-3 h-3 inline mr-0.5" /> Escalate
                            </button>
                          </>
                        )}
                        {r.status === 'REJECTED' && (
                          <button
                            type="button"
                            onClick={() => handleAction(r, 'RESUBMIT')}
                            className="px-2 py-1 rounded border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-[11px] font-bold text-indigo-800 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3 inline mr-0.5" /> Resubmit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <DataGridFooter
        currentPage={grid.currentPage}
        totalPages={grid.totalPages}
        pageSize={grid.pageSize}
        totalRecords={grid.totalRecords}
        onPageChange={grid.setCurrentPage}
        onPageSizeChange={grid.setPageSize}
        pageSizeOptions={grid.pageSizeOptions}
        defaultSortNotice="Sorted Newest First"
      />

      {showSubmitModal && (
        <ModalShell title="Submit Access Request" subtitle="Triggers SoD risk evaluation and multi-stage approval routing." onClose={() => setShowSubmitModal(false)}>
          <form onSubmit={handleSubmitRequest} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target User *</label>
                <select value={form.targetUserId} onChange={(e) => setForm({ ...form, targetUserId: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} (@{u.username})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Request Type *</label>
                <select value={form.requestType} onChange={(e) => setForm({ ...form, requestType: e.target.value as AccessRequestType })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  <option value="NEW_ROLE">New Role</option>
                  <option value="ADDITIONAL_PERMISSION">Additional Permission</option>
                  <option value="COMPANY_ACCESS">Company Access</option>
                  <option value="BRANCH_ACCESS">Branch Access</option>
                  <option value="PURCHASE_ORG_ACCESS">Purchase Org Access</option>
                  <option value="TEMPORARY_ACCESS">Temporary Access</option>
                  <option value="ELEVATED_ACCESS">Elevated Access</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Requested Role (Optional)</label>
                <select value={form.requestedRoleId} onChange={(e) => setForm({ ...form, requestedRoleId: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  <option value="">None (Permission Only)</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roleCode} — {r.roleName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Company</label>
                <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Valid From</label>
                <input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Valid To (Mandatory if Temporary)</label>
                <input type="date" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Permission Codes (CSV, Optional)</label>
              <input value={form.requestedPermissionCodes} onChange={(e) => setForm({ ...form, requestedPermissionCodes: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg font-mono" />
            </div>
            <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={form.isTemporary} onChange={(e) => setForm({ ...form, isTemporary: e.target.checked })} />
              Temporary Time-Bounded Request
            </label>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Business Justification *</label>
              <textarea required value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} placeholder="Explain business need and approval scope..." className="w-full p-2 border border-slate-300 rounded-lg h-18" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowSubmitModal(false)} className="px-3.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">
                Submit Request
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {rejectTarget && (
        <ModalShell title={`Reject Request ${rejectTarget.requestNumber}`} subtitle="Rejection reason is mandatory for audit compliance." onClose={() => setRejectTarget(null)} maxWidth="max-w-lg">
          <form onSubmit={handleConfirmReject} className="space-y-3 text-xs">
            <textarea required value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Provide detailed rejection reason..." className="w-full p-2 border border-slate-300 rounded-lg h-20" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRejectTarget(null)} className="px-3.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer">
                Confirm Rejection
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
};
