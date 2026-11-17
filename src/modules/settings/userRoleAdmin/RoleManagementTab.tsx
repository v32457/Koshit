import React, { useMemo, useState } from 'react';
import {
  ShieldPlus,
  Copy,
  GitBranch,
  History,
  Trash2,
  Download,
  Eye,
  GitCompare,
  Lock,
} from 'lucide-react';
import type { RoleCategory, RoleDefinition, RoleLifecycleStatus } from '../../../types/userRoleAdmin';
import { userRoleAdminService } from '../../../services/userRoleAdminService';
import { exportService } from '../../../services/exportService';
import { useStandardDataGrid } from '../../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../../components/DataGridFooter';
import { ModalShell, StatusTag, UserRoleAdminTabProps } from './shared';

export const RoleManagementTab: React.FC<UserRoleAdminTabProps> = ({
  currentUser,
  onNotify,
  refreshTick,
  triggerRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [effectiveRole, setEffectiveRole] = useState<RoleDefinition | null>(null);
  const [historyRole, setHistoryRole] = useState<RoleDefinition | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);

  const [createForm, setCreateForm] = useState({
    roleCode: '',
    roleName: '',
    description: '',
    category: 'CUSTOM_ROLE' as RoleCategory,
    parentRoleId: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
  });

  const [editForm, setEditForm] = useState({
    roleName: '',
    description: '',
    category: 'CUSTOM_ROLE' as RoleCategory,
    parentRoleId: '',
    status: 'ACTIVE' as RoleLifecycleStatus,
    effectiveFrom: '',
    effectiveTo: '',
    reason: 'Role metadata governance update',
  });

  const [compareIds, setCompareIds] = useState<{ a: string; b: string }>({ a: '', b: '' });

  const allRoles = useMemo(() => userRoleAdminService.getRoles(), [refreshTick]);
  const filteredRoles = useMemo(
    () =>
      userRoleAdminService.getRoles({
        search,
        category: categoryFilter,
        status: statusFilter,
      }),
    [search, categoryFilter, statusFilter, refreshTick]
  );

  const grid = useStandardDataGrid({
    gridId: 'ura-role-master',
    userId: currentUser.id,
    data: filteredRoles,
    defaultSortField: 'updatedAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
    filterSignature: `${search}|${categoryFilter}|${statusFilter}`,
  });

  const actor = { id: currentUser.id, name: currentUser.fullName };

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = userRoleAdminService.createRole(
        {
          roleCode: createForm.roleCode,
          roleName: createForm.roleName,
          description: createForm.description,
          category: createForm.category,
          parentRoleId: createForm.parentRoleId || null,
          effectiveFrom: createForm.effectiveFrom,
          effectiveTo: createForm.effectiveTo || undefined,
        },
        actor
      );
      onNotify(`Created custom role '${created.roleCode}' cleanly.`, 'success');
      setShowCreateModal(false);
      setCreateForm({
        roleCode: '',
        roleName: '',
        description: '',
        category: 'CUSTOM_ROLE',
        parentRoleId: '',
        effectiveFrom: new Date().toISOString().slice(0, 10),
        effectiveTo: '',
      });
      triggerRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const openEditRole = (role: RoleDefinition) => {
    setEditingRole(role);
    setEditForm({
      roleName: role.roleName,
      description: role.description,
      category: role.category,
      parentRoleId: role.parentRoleId || '',
      status: role.status,
      effectiveFrom: role.effectiveFrom,
      effectiveTo: role.effectiveTo || '',
      reason: 'Role hierarchy/status update',
    });
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    try {
      userRoleAdminService.updateRole(
        editingRole.id,
        {
          roleName: editForm.roleName,
          description: editForm.description,
          category: editForm.category,
          parentRoleId: editForm.parentRoleId || null,
          status: editForm.status,
          effectiveFrom: editForm.effectiveFrom,
          effectiveTo: editForm.effectiveTo || undefined,
        },
        editForm.reason,
        actor
      );
      onNotify(`Updated role '${editingRole.roleCode}'.`, 'success');
      setEditingRole(null);
      triggerRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleClone = (role: RoleDefinition) => {
    try {
      const suffix = Math.floor(100 + Math.random() * 899);
      const cloned = userRoleAdminService.cloneRole(
        role.id,
        `${role.roleCode}_COPY_${suffix}`,
        `${role.roleName} (Copy ${suffix})`,
        actor
      );
      onNotify(`Cloned '${role.roleCode}' into '${cloned.roleCode}'.`, 'success');
      triggerRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleDelete = (role: RoleDefinition) => {
    try {
      userRoleAdminService.deleteRole(role.id, 'Administrative retirement of custom role', actor);
      onNotify(`Deleted custom role '${role.roleCode}'.`, 'info');
      triggerRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const compareResult = useMemo(() => {
    if (!compareIds.a || !compareIds.b) return null;
    return userRoleAdminService.compareRoles(compareIds.a, compareIds.b);
  }, [compareIds, refreshTick]);

  const handleExport = () => {
    exportService.executeExport('excel', {
      title: 'Role Master & Inheritance Hierarchy',
      subtitle: 'CIPPlatform RBAC Role Catalog',
      filenamePrefix: 'role_master',
      headers: ['Role Code', 'Role Name', 'Category', 'Type', 'Parent Role', 'Explicit Perms', 'Effective Perms', 'Version', 'Status'],
      rows: grid.allSortedData.map((r) => {
        const eff = userRoleAdminService.getEffectiveRolePermissions(r.id);
        const parent = allRoles.find((p) => p.id === r.parentRoleId);
        return [
          r.roleCode,
          r.roleName,
          r.category,
          r.roleType,
          parent?.roleCode || 'None',
          r.explicitPermissionCodes.length,
          eff.effectivePermissions.length,
          `v${r.version}`,
          r.status,
        ];
      }),
    });
    onNotify('Exported Role Master to XLSX.', 'info');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Role Master, Hierarchy & Versioning</h3>
            <p className="text-[11px] text-slate-500">
              Manage system & custom roles, single-parent inheritance with cycle protection, role cloning, comparison, and version history.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCompareIds({ a: allRoles[0]?.id || '', b: allRoles[1]?.id || '' });
                setShowCompareModal(true);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <GitCompare className="w-3.5 h-3.5" /> Compare Roles
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ShieldPlus className="w-3.5 h-3.5" /> Create Role
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search role code, name, description..."
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
          >
            <option value="ALL">All Categories</option>
            <option value="SYSTEM_ROLE">SYSTEM_ROLE</option>
            <option value="ADMINISTRATOR_ROLE">ADMINISTRATOR_ROLE</option>
            <option value="FUNCTIONAL_ROLE">FUNCTIONAL_ROLE</option>
            <option value="OPERATIONAL_ROLE">OPERATIONAL_ROLE</option>
            <option value="APPROVAL_ROLE">APPROVAL_ROLE</option>
            <option value="READ_ONLY_ROLE">READ_ONLY_ROLE</option>
            <option value="CUSTOM_ROLE">CUSTOM_ROLE</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="DRAFT">DRAFT</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-3">Role Definition</th>
                <th className="p-3">Category & Type</th>
                <th className="p-3">Inherits From</th>
                <th className="p-3 text-right">Explicit / Effective Perms</th>
                <th className="p-3 text-center">Version</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grid.pagedData.map((r) => {
                const eff = userRoleAdminService.getEffectiveRolePermissions(r.id);
                const parent = allRoles.find((p) => p.id === r.parentRoleId);
                return (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="p-3">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{r.roleName}</span>
                        {r.isSystemProtected && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                            <Lock className="w-2.5 h-2.5" /> Protected
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-indigo-700 font-semibold">{r.roleCode}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{r.description}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{r.category.replace(/_/g, ' ')}</div>
                      <div className="text-[11px] text-slate-500">{r.roleType}</div>
                    </td>
                    <td className="p-3">
                      {parent ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-700">
                          <GitBranch className="w-3 h-3 text-indigo-600" /> {parent.roleCode}
                        </span>
                      ) : (
                        <span className="text-slate-400">Root Role</span>
                      )}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      <span className="font-bold text-slate-900">{eff.explicitPermissions.length}</span>
                      <span className="text-slate-400"> / </span>
                      <span className="font-bold text-indigo-700">{eff.effectivePermissions.length}</span>
                      {eff.restrictedPermissions.length > 0 && (
                        <div className="text-[10px] text-rose-600">-{eff.restrictedPermissions.length} restricted</div>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700">v{r.version}</td>
                    <td className="p-3">
                      <StatusTag status={r.status} />
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEffectiveRole(r)}
                          className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          <Eye className="w-3 h-3 inline mr-0.5" /> Effective
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditRole(r)}
                          className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClone(r)}
                          className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          <Copy className="w-3 h-3 inline mr-0.5" /> Clone
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryRole(r)}
                          className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          <History className="w-3 h-3 inline mr-0.5" /> History
                        </button>
                        {!r.isSystemProtected && (
                          <button
                            type="button"
                            onClick={() => handleDelete(r)}
                            className="px-2 py-1 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-[11px] font-semibold text-rose-700 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 inline mr-0.5" /> Delete
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

      {/* CREATE ROLE */}
      {showCreateModal && (
        <ModalShell title="Create Custom Role" subtitle="Validates unique code/name and enforces acyclic role hierarchy." onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreateRole} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Role Code *</label>
                <input
                  required
                  value={createForm.roleCode}
                  onChange={(e) => setCreateForm({ ...createForm, roleCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. REGIONAL_BUYER_LEAD"
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Role Name *</label>
                <input
                  required
                  value={createForm.roleName}
                  onChange={(e) => setCreateForm({ ...createForm, roleName: e.target.value })}
                  placeholder="Regional Buyer Lead"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm({ ...createForm, category: e.target.value as RoleCategory })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="CUSTOM_ROLE">Custom Role</option>
                  <option value="FUNCTIONAL_ROLE">Functional Role</option>
                  <option value="DEPARTMENT_ROLE">Department Role</option>
                  <option value="OPERATIONAL_ROLE">Operational Role</option>
                  <option value="APPROVAL_ROLE">Approval Role</option>
                  <option value="READ_ONLY_ROLE">Read-Only Role</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Parent Role (Optional Inheritance)</label>
                <select
                  value={createForm.parentRoleId}
                  onChange={(e) => setCreateForm({ ...createForm, parentRoleId: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">None (Standalone Role)</option>
                  {allRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roleCode} — {r.roleName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Effective From</label>
                <input
                  type="date"
                  value={createForm.effectiveFrom}
                  onChange={(e) => setCreateForm({ ...createForm, effectiveFrom: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Effective To (Optional Expiration)</label>
                <input
                  type="date"
                  value={createForm.effectiveTo}
                  onChange={(e) => setCreateForm({ ...createForm, effectiveTo: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Description</label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg h-16"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-3.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">
                Create Role
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* EDIT ROLE */}
      {editingRole && (
        <ModalShell title={`Edit Role — ${editingRole.roleCode}`} subtitle="Circular inheritance & Super Admin deactivation protections enforced." onClose={() => setEditingRole(null)}>
          <form onSubmit={handleSaveRole} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Role Name *</label>
                <input required value={editForm.roleName} onChange={(e) => setEditForm({ ...editForm, roleName: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Lifecycle Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as RoleLifecycleStatus })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="EXPIRED">EXPIRED</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Parent Role</label>
                <select value={editForm.parentRoleId} onChange={(e) => setEditForm({ ...editForm, parentRoleId: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  <option value="">None (Root)</option>
                  {allRoles
                    .filter((x) => x.id !== editingRole.id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.roleCode} — {r.roleName}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Change Reason *</label>
                <input required value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Description</label>
              <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg h-16" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setEditingRole(null)} className="px-3.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">
                Save Version v{editingRole.version + 1}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* EFFECTIVE PERMISSIONS MODAL */}
      {effectiveRole && (() => {
        const eff = userRoleAdminService.getEffectiveRolePermissions(effectiveRole.id);
        return (
          <ModalShell title={`Effective Permissions — ${effectiveRole.roleCode}`} subtitle={`Inheritance Chain: ${eff.inheritanceChain.join(' -> ')}`} onClose={() => setEffectiveRole(null)}>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-slate-500">Explicit Grants</div>
                <div className="text-lg font-bold text-slate-900 tabular-nums">{eff.explicitPermissions.length}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200">
                <div className="text-indigo-700">Inherited Grants</div>
                <div className="text-lg font-bold text-indigo-800 tabular-nums">{eff.inheritedPermissions.length}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="text-emerald-700">Effective Total</div>
                <div className="text-lg font-bold text-emerald-800 tabular-nums">{eff.effectivePermissions.length}</div>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
              {eff.effectivePermissions.map((code) => (
                <div key={code} className="px-3 py-2 flex items-center justify-between">
                  <span className="font-mono font-semibold text-slate-800">{code}</span>
                  <span className="text-[10px] font-bold text-slate-500">
                    {eff.explicitPermissions.includes(code) ? 'EXPLICIT' : 'INHERITED'}
                  </span>
                </div>
              ))}
            </div>
          </ModalShell>
        );
      })()}

      {/* VERSION HISTORY MODAL */}
      {historyRole && (() => {
        const versions = userRoleAdminService.getRoleVersionHistory(historyRole.id);
        return (
          <ModalShell title={`Version History — ${historyRole.roleCode}`} subtitle={`Current version: v${historyRole.version}`} onClose={() => setHistoryRole(null)}>
            {versions.length === 0 ? (
              <div className="p-4 text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                Seeded baseline role v{historyRole.version}. Subsequent edits record immutable version snapshots here.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto text-xs">
                {versions.map((v) => (
                  <div key={v.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>Version v{v.version} — {v.snapshot.roleName}</span>
                      <span className="font-mono text-slate-500">{v.changedAt}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1">By {v.changedBy} • Reason: {v.changeReason}</div>
                  </div>
                ))}
              </div>
            )}
          </ModalShell>
        );
      })()}

      {/* COMPARE ROLES MODAL */}
      {showCompareModal && (
        <ModalShell title="Compare Role Permissions" subtitle="Side-by-side difference analysis of effective permissions." onClose={() => setShowCompareModal(false)} maxWidth="max-w-3xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <select value={compareIds.a} onChange={(e) => setCompareIds({ ...compareIds, a: e.target.value })} className="p-2 border border-slate-300 rounded-lg bg-white font-semibold">
              {allRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  Role A: {r.roleCode} ({r.roleName})
                </option>
              ))}
            </select>
            <select value={compareIds.b} onChange={(e) => setCompareIds({ ...compareIds, b: e.target.value })} className="p-2 border border-slate-300 rounded-lg bg-white font-semibold">
              {allRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  Role B: {r.roleCode} ({r.roleName})
                </option>
              ))}
            </select>
          </div>
          {compareResult && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="border border-slate-200 rounded-lg p-3 space-y-1.5">
                <div className="font-bold text-indigo-700">Only in Role A ({compareResult.onlyInA.length})</div>
                <div className="max-h-56 overflow-y-auto space-y-1 font-mono text-[10px]">
                  {compareResult.onlyInA.map((p) => (
                    <div key={p} className="truncate text-slate-700">{p}</div>
                  ))}
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3 space-y-1.5">
                <div className="font-bold text-emerald-700">Common Permissions ({compareResult.common.length})</div>
                <div className="max-h-56 overflow-y-auto space-y-1 font-mono text-[10px]">
                  {compareResult.common.map((p) => (
                    <div key={p} className="truncate text-slate-700">{p}</div>
                  ))}
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3 space-y-1.5">
                <div className="font-bold text-amber-700">Only in Role B ({compareResult.onlyInB.length})</div>
                <div className="max-h-56 overflow-y-auto space-y-1 font-mono text-[10px]">
                  {compareResult.onlyInB.map((p) => (
                    <div key={p} className="truncate text-slate-700">{p}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </ModalShell>
      )}
    </div>
  );
};
