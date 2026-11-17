import React, { useMemo, useState } from 'react';
import { Clock, Plus, RefreshCw, Ban, UserCheck } from 'lucide-react';
import type { TemporaryAccessRecord } from '../../../types/userRoleAdmin';
import { userRoleAdminService } from '../../../services/userRoleAdminService';
import { useStandardDataGrid } from '../../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../../components/DataGridFooter';
import { ModalShell, StatusTag, UserRoleAdminTabProps } from './shared';

export const TempAccessDelegationTab: React.FC<UserRoleAdminTabProps> = ({
  currentUser,
  companies,
  branches,
  onNotify,
  refreshTick,
  triggerRefresh,
}) => {
  const users = useMemo(() => userRoleAdminService.getUsers(), [refreshTick]);
  const roles = useMemo(() => userRoleAdminService.getRoles({ status: 'ACTIVE' }), [refreshTick]);
  const permissions = useMemo(() => userRoleAdminService.getPermissions(), [refreshTick]);
  const tempGrants = useMemo(() => userRoleAdminService.getTemporaryAccess(), [refreshTick]);
  const delegations = useMemo(() => userRoleAdminService.getDelegations(), [refreshTick]);

  const [showTempModal, setShowTempModal] = useState(false);
  const [showDelModal, setShowDelModal] = useState(false);

  const [tempForm, setTempForm] = useState({
    userId: users[1]?.id || currentUser.id,
    grantType: 'TEMPORARY_PERMISSION' as TemporaryAccessRecord['grantType'],
    roleId: '',
    permissionCodes: 'PROCUREMENT.PURCHASE_REQUISITION.APPROVE',
    companyId: companies[0]?.id || 'co-kosh-01',
    branchId: branches[0]?.id || 'br-pond-01',
    validFrom: new Date().toISOString().slice(0, 10),
    validTo: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    reason: 'Month-end procurement coverage',
  });

  const [delForm, setDelForm] = useState({
    delegationType: 'APPROVAL_DELEGATION' as 'APPROVAL_DELEGATION' | 'ABSENCE_DELEGATION',
    delegatorUserId: users[0]?.id || currentUser.id,
    delegateUserId: users[1]?.id || '',
    companyId: companies[0]?.id || 'co-kosh-01',
    branchId: branches[0]?.id || 'br-pond-01',
    delegatedPermissionCodes: 'PROCUREMENT.PURCHASE_REQUISITION.APPROVE',
    validFrom: new Date().toISOString().slice(0, 10),
    validTo: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    reason: 'Planned annual leave approval delegation',
  });

  const tempGrid = useStandardDataGrid({
    gridId: 'ura-temp-access',
    userId: currentUser.id,
    data: tempGrants,
    defaultSortField: 'createdAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
  });

  const delGrid = useStandardDataGrid({
    gridId: 'ura-delegations',
    userId: currentUser.id,
    data: delegations,
    defaultSortField: 'createdAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
  });

  const actor = { id: currentUser.id, name: currentUser.fullName };

  const handleSweep = () => {
    const res = userRoleAdminService.sweepExpiredAccess();
    triggerRefresh();
    onNotify(
      `Expiry Sweep Complete: ${res.expiredTempCount} temp grant(s) expired, ${res.expiredDelegationCount} delegation(s) expired, ${res.remindersSent} reminder(s) emitted.`,
      'info'
    );
  };

  const handleGrantTemp = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      userRoleAdminService.grantTemporaryAccess(
        {
          userId: tempForm.userId,
          grantType: tempForm.grantType,
          roleId: tempForm.roleId || undefined,
          permissionCodes: tempForm.permissionCodes
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          scope: {
            companyIds: [tempForm.companyId],
            branchIds: tempForm.branchId ? [tempForm.branchId] : [],
            businessUnitIds: [],
            departmentIds: [],
            purchaseOrgIds: [],
            purchaseGroupIds: [],
            salesOrgIds: [],
            warehouseIds: [],
            locationCodes: [],
            costCentreIds: [],
            projectIds: [],
            dataScopeLevel: 'BRANCH_RECORDS',
          },
          validFrom: tempForm.validFrom,
          validTo: tempForm.validTo,
          reason: tempForm.reason,
        },
        actor
      );
      setShowTempModal(false);
      triggerRefresh();
      onNotify('Time-bounded temporary access granted.', 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleCreateDelegation = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      userRoleAdminService.createDelegation(
        {
          delegationType: delForm.delegationType,
          delegatorUserId: delForm.delegatorUserId,
          delegateUserId: delForm.delegateUserId,
          companyId: delForm.companyId,
          branchId: delForm.branchId || undefined,
          delegatedPermissionCodes: delForm.delegatedPermissionCodes
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          validFrom: delForm.validFrom,
          validTo: delForm.validTo,
          reason: delForm.reason,
        },
        actor
      );
      setShowDelModal(false);
      triggerRefresh();
      onNotify('Authorized delegation created within delegator scope ceiling.', 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Temporary Access Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" />
              Temporary & Time-Bounded Access Grants
            </h3>
            <p className="text-[11px] text-slate-500">
              Automatically expires on end date/time, issues 48h expiry reminders, and supports immediate revocation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSweep}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Run Auto-Expiry & Reminder Sweep
            </button>
            <button
              type="button"
              onClick={() => setShowTempModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Grant Temporary Access
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-2.5">User & Type</th>
                <th className="p-2.5">Granted Role / Permissions</th>
                <th className="p-2.5">Validity Window</th>
                <th className="p-2.5">Reason</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tempGrid.pagedData.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/70">
                  <td className="p-2.5">
                    <div className="font-bold text-slate-900">{t.userName}</div>
                    <div className="text-[11px] text-slate-500">{t.grantType.replace(/_/g, ' ')}</div>
                  </td>
                  <td className="p-2.5 font-mono text-[11px] text-indigo-700">
                    {t.roleCode || t.permissionCodes.join(', ') || '-'}
                  </td>
                  <td className="p-2.5 font-mono text-[11px]">
                    {t.validFrom.slice(0, 10)} → {t.validTo.slice(0, 16)}
                  </td>
                  <td className="p-2.5 text-slate-600">{t.reason}</td>
                  <td className="p-2.5">
                    <StatusTag status={t.status} />
                  </td>
                  <td className="p-2.5 text-right">
                    {(t.status === 'ACTIVE' || t.status === 'EXPIRING_SOON') && (
                      <button
                        type="button"
                        onClick={() => {
                          userRoleAdminService.revokeTemporaryAccess(t.id, 'Early administrator revocation', actor);
                          triggerRefresh();
                          onNotify(`Revoked temporary access for ${t.userName}.`, 'info');
                        }}
                        className="px-2.5 py-1 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-[11px] font-bold text-rose-700 cursor-pointer"
                      >
                        <Ban className="w-3 h-3 inline mr-0.5" /> Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DataGridFooter
          currentPage={tempGrid.currentPage}
          totalPages={tempGrid.totalPages}
          pageSize={tempGrid.pageSize}
          totalRecords={tempGrid.totalRecords}
          onPageChange={tempGrid.setCurrentPage}
          onPageSizeChange={tempGrid.setPageSize}
          pageSizeOptions={tempGrid.pageSizeOptions}
        />
      </div>

      {/* Delegation Management Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              Delegation Management (Scope-Bounded)
            </h3>
            <p className="text-[11px] text-slate-500">
              Approval and absence delegation strictly bounded by the delegator's active authorized permissions and organizational scope.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDelModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Create Delegation
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-2.5">Delegator → Delegate</th>
                <th className="p-2.5">Type & Scope</th>
                <th className="p-2.5">Delegated Permissions</th>
                <th className="p-2.5">Validity Window</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {delGrid.pagedData.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/70">
                  <td className="p-2.5">
                    <div className="font-bold text-slate-900">
                      {d.delegatorName} → {d.delegateName}
                    </div>
                    <div className="text-[11px] text-slate-500">{d.reason}</div>
                  </td>
                  <td className="p-2.5">
                    <div className="font-semibold text-slate-800">{d.delegationType.replace(/_/g, ' ')}</div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {d.companyId} / {d.branchId || 'ALL'}
                    </div>
                  </td>
                  <td className="p-2.5 font-mono text-[11px] text-indigo-700">
                    {d.delegatedPermissionCodes.join(', ')}
                  </td>
                  <td className="p-2.5 font-mono text-[11px]">
                    {d.validFrom} → {d.validTo}
                  </td>
                  <td className="p-2.5">
                    <StatusTag status={d.status} />
                  </td>
                  <td className="p-2.5 text-right">
                    {d.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => {
                          userRoleAdminService.revokeDelegation(d.id, 'Delegation ended early', actor);
                          triggerRefresh();
                          onNotify('Delegation revoked cleanly.', 'info');
                        }}
                        className="px-2.5 py-1 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-[11px] font-bold text-rose-700 cursor-pointer"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DataGridFooter
          currentPage={delGrid.currentPage}
          totalPages={delGrid.totalPages}
          pageSize={delGrid.pageSize}
          totalRecords={delGrid.totalRecords}
          onPageChange={delGrid.setCurrentPage}
          onPageSizeChange={delGrid.setPageSize}
          pageSizeOptions={delGrid.pageSizeOptions}
        />
      </div>

      {/* GRANT TEMP ACCESS MODAL */}
      {showTempModal && (
        <ModalShell title="Grant Temporary Time-Bounded Access" subtitle="Expiration date is strictly mandatory." onClose={() => setShowTempModal(false)}>
          <form onSubmit={handleGrantTemp} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">User *</label>
                <select value={tempForm.userId} onChange={(e) => setTempForm({ ...tempForm, userId: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Grant Type</label>
                <select value={tempForm.grantType} onChange={(e) => setTempForm({ ...tempForm, grantType: e.target.value as any })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  <option value="TEMPORARY_PERMISSION">TEMPORARY_PERMISSION</option>
                  <option value="TEMPORARY_ROLE">TEMPORARY_ROLE</option>
                  <option value="TEMPORARY_ORG_ACCESS">TEMPORARY_ORG_ACCESS</option>
                  <option value="ELEVATED_PRIVILEGE">ELEVATED_PRIVILEGE</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Valid From *</label>
                <input required type="date" value={tempForm.validFrom} onChange={(e) => setTempForm({ ...tempForm, validFrom: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Valid To (Auto-Expire) *</label>
                <input required type="date" value={tempForm.validTo} onChange={(e) => setTempForm({ ...tempForm, validTo: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Permission Codes (CSV)</label>
              <input value={tempForm.permissionCodes} onChange={(e) => setTempForm({ ...tempForm, permissionCodes: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg font-mono" />
              <div className="text-[10px] text-slate-400 mt-0.5">Sample: {permissions.slice(0, 3).map((p) => p.permissionCode).join(', ')}</div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Optional Role Override</label>
              <select value={tempForm.roleId} onChange={(e) => setTempForm({ ...tempForm, roleId: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                <option value="">None</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.roleCode}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Reason *</label>
              <input required value={tempForm.reason} onChange={(e) => setTempForm({ ...tempForm, reason: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowTempModal(false)} className="px-3.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">Grant Access</button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* CREATE DELEGATION MODAL */}
      {showDelModal && (
        <ModalShell title="Create Approval / Absence Delegation" subtitle="Delegated permissions cannot exceed what the delegator currently holds in the selected scope." onClose={() => setShowDelModal(false)}>
          <form onSubmit={handleCreateDelegation} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Delegation Type</label>
                <select value={delForm.delegationType} onChange={(e) => setDelForm({ ...delForm, delegationType: e.target.value as any })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  <option value="APPROVAL_DELEGATION">Approval Delegation</option>
                  <option value="ABSENCE_DELEGATION">Absence / Leave Delegation</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Company</label>
                <select value={delForm.companyId} onChange={(e) => setDelForm({ ...delForm, companyId: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Delegator *</label>
                <select value={delForm.delegatorUserId} onChange={(e) => setDelForm({ ...delForm, delegatorUserId: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Delegate Recipient *</label>
                <select value={delForm.delegateUserId} onChange={(e) => setDelForm({ ...delForm, delegateUserId: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Valid From *</label>
                <input required type="date" value={delForm.validFrom} onChange={(e) => setDelForm({ ...delForm, validFrom: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Valid To *</label>
                <input required type="date" value={delForm.validTo} onChange={(e) => setDelForm({ ...delForm, validTo: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Delegated Permission Codes (CSV) *</label>
              <input required value={delForm.delegatedPermissionCodes} onChange={(e) => setDelForm({ ...delForm, delegatedPermissionCodes: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg font-mono" />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Reason *</label>
              <input required value={delForm.reason} onChange={(e) => setDelForm({ ...delForm, reason: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowDelModal(false)} className="px-3.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer">Activate Delegation</button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
};
