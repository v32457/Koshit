import React, { useMemo, useState } from 'react';
import { Building2, Plus, Trash2 } from 'lucide-react';
import type { DataScopeLevel, OrganizationalScope } from '../../../types/userRoleAdmin';
import { userRoleAdminService } from '../../../services/userRoleAdminService';
import { PurchaseOrganizationService } from '../../../services/purchaseOrganizationService';
import { useStandardDataGrid } from '../../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../../components/DataGridFooter';
import { ModalShell, StatusTag, UserRoleAdminTabProps } from './shared';

export const OrgAccessAndAssignmentsTab: React.FC<UserRoleAdminTabProps> = ({
  currentUser,
  companies,
  branches,
  onNotify,
  refreshTick,
  triggerRefresh,
}) => {
  const users = useMemo(() => userRoleAdminService.getUsers(), [refreshTick]);
  const roles = useMemo(() => userRoleAdminService.getRoles({ status: 'ACTIVE' }), [refreshTick]);
  const purchaseOrgs = useMemo(() => PurchaseOrganizationService.getOrganizations(), [refreshTick]);
  const assignments = useMemo(() => userRoleAdminService.getAssignments(), [refreshTick]);

  const [selectedUserId, setSelectedUserId] = useState<string>('ALL');
  const [showAssignModal, setShowAssignModal] = useState(false);

  const [form, setForm] = useState({
    userId: users[1]?.id || users[0]?.id || '',
    roleId: roles[1]?.id || roles[0]?.id || '',
    companyId: companies[0]?.id || 'co-kosh-01',
    branchId: branches[0]?.id || 'br-pond-01',
    businessUnitIdsText: 'BU-MFG',
    departmentIdsText: 'Procurement',
    purchaseOrgIdsText: purchaseOrgs[0]?.id || '',
    purchaseGroupIdsText: 'PG-RAW',
    salesOrgIdsText: 'SO-DOM',
    warehouseIdsText: 'WH-PONDY-01',
    locationCodesText: 'LOC-01',
    costCentreIdsText: 'CC-PROC-100',
    projectIdsText: 'PRJ-2026-CAPEX',
    dataScopeLevel: 'BRANCH_RECORDS' as DataScopeLevel,
    isDefaultContext: false,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
    reason: 'Authorized organizational scope role assignment',
  });

  const filteredAssignments = useMemo(
    () => (selectedUserId === 'ALL' ? assignments : assignments.filter((a) => a.userId === selectedUserId)),
    [assignments, selectedUserId]
  );

  const grid = useStandardDataGrid({
    gridId: 'ura-assignments',
    userId: currentUser.id,
    data: filteredAssignments,
    defaultSortField: 'createdAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
    filterSignature: selectedUserId,
  });

  const previewUserId = selectedUserId !== 'ALL' ? selectedUserId : users[0]?.id || '';
  const orgMatrix = useMemo(
    () => (previewUserId ? userRoleAdminService.getUserOrganizationalMatrix(previewUserId) : null),
    [previewUserId, refreshTick]
  );

  const splitCsv = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const scope: OrganizationalScope = {
        companyIds: [form.companyId],
        branchIds: form.branchId ? [form.branchId] : [],
        businessUnitIds: splitCsv(form.businessUnitIdsText),
        departmentIds: splitCsv(form.departmentIdsText),
        purchaseOrgIds: splitCsv(form.purchaseOrgIdsText),
        purchaseGroupIds: splitCsv(form.purchaseGroupIdsText),
        salesOrgIds: splitCsv(form.salesOrgIdsText),
        warehouseIds: splitCsv(form.warehouseIdsText),
        locationCodes: splitCsv(form.locationCodesText),
        costCentreIds: splitCsv(form.costCentreIdsText),
        projectIds: splitCsv(form.projectIdsText),
        dataScopeLevel: form.dataScopeLevel,
      };
      userRoleAdminService.assignUserRole(
        {
          userId: form.userId,
          roleId: form.roleId,
          companyId: form.companyId,
          branchId: form.branchId || undefined,
          scope,
          isDefaultContext: form.isDefaultContext,
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo || undefined,
          reason: form.reason,
        },
        { id: currentUser.id, name: currentUser.fullName }
      );
      setShowAssignModal(false);
      triggerRefresh();
      onNotify('Scoped User-Role assignment saved cleanly.', 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleRevoke = (assignmentId: string) => {
    try {
      userRoleAdminService.revokeAssignment(assignmentId, 'Administrator revoked role assignment', {
        id: currentUser.id,
        name: currentUser.fullName,
      });
      triggerRefresh();
      onNotify('Role assignment revoked and cache invalidated.', 'info');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Matrix Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Organizational Access Isolation & User-Role Assignments
            </h3>
            <p className="text-[11px] text-slate-500">
              Assign multiple roles per user with independent Company, Branch, Department, Purchase Org, Warehouse, Cost Centre, and Project scopes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
            >
              <option value="ALL">All Users ({assignments.length} assignments)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.role})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowAssignModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Assign Role & Scope
            </button>
          </div>
        </div>

        {/* User Consolidated Organizational Matrix Preview */}
        {orgMatrix && (
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400 font-semibold block">Companies</span>
              <span className="font-mono font-bold text-slate-800">{orgMatrix.companyIds.join(', ') || 'None'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block">Branches</span>
              <span className="font-mono font-bold text-slate-800">{orgMatrix.branchIds.join(', ') || 'All in Company'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block">Departments</span>
              <span className="font-mono font-bold text-slate-800">{orgMatrix.departmentIds.join(', ') || 'All'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block">Purchase Orgs</span>
              <span className="font-mono font-bold text-slate-800">{orgMatrix.purchaseOrgIds.join(', ') || 'Unrestricted'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block">Warehouses / Locs</span>
              <span className="font-mono font-bold text-slate-800">{orgMatrix.warehouseIds.join(', ') || 'All'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block">Max Data Scope</span>
              <span className="font-bold text-indigo-700">{orgMatrix.dataScopeLevel.replace(/_/g, ' ')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Assignments Grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-3">User</th>
                <th className="p-3">Role</th>
                <th className="p-3">Company & Branch Scope</th>
                <th className="p-3">Functional Dimensions (Dept / PO / WH / CC)</th>
                <th className="p-3">Data Scope & Validity</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grid.pagedData.map((a) => {
                const u = users.find((x) => x.id === a.userId);
                return (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{u?.fullName || a.userId}</div>
                      <div className="text-[11px] text-slate-500">{a.isDefaultContext ? 'Default Login Context' : 'Additional Scope'}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono font-bold text-indigo-700">{a.roleCode}</div>
                      <div className="text-[11px] text-slate-500">{a.roleName}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{a.scope.companyIds.join(', ')}</div>
                      <div className="text-[11px] text-slate-500">Branches: {a.scope.branchIds.join(', ') || 'ALL IN COMPANY'}</div>
                    </td>
                    <td className="p-3 text-[11px] text-slate-600 space-y-0.5">
                      <div>Dept: {a.scope.departmentIds.join(', ') || 'ALL'} • BU: {a.scope.businessUnitIds.join(', ') || 'ALL'}</div>
                      <div>PO: {a.scope.purchaseOrgIds.join(', ') || 'ALL'} • WH: {a.scope.warehouseIds.join(', ') || 'ALL'} • CC: {a.scope.costCentreIds.join(', ') || 'ALL'}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{a.scope.dataScopeLevel.replace(/_/g, ' ')}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {a.effectiveFrom} → {a.effectiveTo || 'Open'}
                      </div>
                    </td>
                    <td className="p-3">
                      <StatusTag status={a.status} />
                    </td>
                    <td className="p-3 text-right">
                      {a.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(a.id)}
                          className="px-2.5 py-1 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-[11px] font-bold text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3 inline mr-0.5" /> Revoke
                        </button>
                      )}
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

      {showAssignModal && (
        <ModalShell
          title="Assign Scoped Role to User"
          subtitle="Enforces Preventive SoD conflict checks, duplicate assignment rejection, and Last-Super-Admin safeguards."
          onClose={() => setShowAssignModal(false)}
          maxWidth="max-w-3xl"
        >
          <form onSubmit={handleAssign} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target User *</label>
                <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} (@{u.username})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Role *</label>
                <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roleCode} — {r.roleName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Company *</label>
                <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Branch (Optional = All in Company)</label>
                <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  <option value="">All Branches in Company</option>
                  {branches
                    .filter((b) => !b.companyId || b.companyId === form.companyId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Data Scope Level *</label>
                <select value={form.dataScopeLevel} onChange={(e) => setForm({ ...form, dataScopeLevel: e.target.value as DataScopeLevel })} className="w-full p-2 border border-slate-300 rounded-lg bg-white font-semibold">
                  <option value="OWN_RECORDS">OWN_RECORDS</option>
                  <option value="ASSIGNED_RECORDS">ASSIGNED_RECORDS</option>
                  <option value="DEPARTMENT_RECORDS">DEPARTMENT_RECORDS</option>
                  <option value="BRANCH_RECORDS">BRANCH_RECORDS</option>
                  <option value="PURCHASE_ORG_RECORDS">PURCHASE_ORG_RECORDS</option>
                  <option value="COMPANY_RECORDS">COMPANY_RECORDS</option>
                  <option value="ALL_AUTHORIZED_RECORDS">ALL_AUTHORIZED_RECORDS</option>
                  <option value="READ_ONLY_RECORDS">READ_ONLY_RECORDS</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Purchase Org IDs (CSV)</label>
                <input value={form.purchaseOrgIdsText} onChange={(e) => setForm({ ...form, purchaseOrgIdsText: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Departments (CSV)</label>
                <input value={form.departmentIdsText} onChange={(e) => setForm({ ...form, departmentIdsText: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Warehouses (CSV)</label>
                <input value={form.warehouseIdsText} onChange={(e) => setForm({ ...form, warehouseIdsText: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Cost Centres (CSV)</label>
                <input value={form.costCentreIdsText} onChange={(e) => setForm({ ...form, costCentreIdsText: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Projects (CSV)</label>
                <input value={form.projectIdsText} onChange={(e) => setForm({ ...form, projectIdsText: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Effective From *</label>
                <input required type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Effective To (Optional)</label>
                <input type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Assignment Reason *</label>
              <input required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
            </div>
            <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={form.isDefaultContext} onChange={(e) => setForm({ ...form, isDefaultContext: e.target.checked })} />
              Set as User Default Login Context
            </label>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowAssignModal(false)} className="px-3.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">
                Assign Scoped Role
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
};
