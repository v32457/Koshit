import React, { useMemo, useState } from 'react';
import {
  Layers,
  Plus,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import type { PermissionActionType, PermissionSyncReport } from '../../../types/userRoleAdmin';
import { userRoleAdminService } from '../../../services/userRoleAdminService';
import { useStandardDataGrid } from '../../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../../components/DataGridFooter';
import { ModalShell, RiskTag, StatusTag, UserRoleAdminTabProps } from './shared';

const ALL_ACTIONS: PermissionActionType[] = [
  'VIEW',
  'CREATE',
  'EDIT',
  'DELETE',
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'CANCEL',
  'RELEASE',
  'POST',
  'EXPORT',
  'IMPORT',
  'PRINT',
  'CONFIGURE',
  'ASSIGN',
  'DELEGATE',
  'CLOSE',
  'REOPEN',
  'ADMIN_OVERRIDE',
];

export const ModuleFeatureRegistryTab: React.FC<UserRoleAdminTabProps> = ({
  currentUser,
  onNotify,
  refreshTick,
  triggerRefresh,
}) => {
  const modules = useMemo(() => userRoleAdminService.getModules(), [refreshTick]);
  const features = useMemo(() => userRoleAdminService.getFeatures(), [refreshTick]);
  const permissions = useMemo(() => userRoleAdminService.getPermissions(), [refreshTick]);
  const roles = useMemo(() => userRoleAdminService.getRoles(), [refreshTick]);

  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [syncReport, setSyncReport] = useState<PermissionSyncReport | null>(() =>
    userRoleAdminService.synchronizePermissionRegistry({ id: currentUser.id, name: currentUser.fullName })
  );

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regForm, setRegForm] = useState({
    moduleCode: 'SUPPLIER_PORTAL',
    moduleName: 'Supplier Governance & Risk Portal',
    routeReference: '/procurement/supplier-risk',
    apiNamespace: '/api/supplier-risk',
    submoduleCode: 'RISK_COMPLIANCE',
    submoduleName: 'Vendor Risk & Compliance',
    featureCode: 'VENDOR_SCORECARD',
    featureName: 'Supplier Scorecard & Risk Rating',
    relatedApi: '/api/supplier-risk/scorecards',
    actions: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT'] as PermissionActionType[],
  });

  const [selectedRoleIdsByPerm, setSelectedRoleIdsByPerm] = useState<Record<string, string[]>>({});

  const filteredPermissions = useMemo(() => {
    const q = search.toLowerCase().trim();
    return permissions.filter((p) => {
      if (moduleFilter !== 'ALL' && p.moduleCode !== moduleFilter) return false;
      if (q) {
        const hay = `${p.permissionCode} ${p.label} ${p.featureCode} ${p.apiEndpoint || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [permissions, moduleFilter, search]);

  const grid = useStandardDataGrid({
    gridId: 'ura-permission-registry',
    userId: currentUser.id,
    data: filteredPermissions,
    defaultSortField: 'registeredAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
    filterSignature: `${moduleFilter}|${search}`,
  });

  const actor = { id: currentUser.id, name: currentUser.fullName };

  const handleRunSync = () => {
    const report = userRoleAdminService.synchronizePermissionRegistry(actor);
    setSyncReport(report);
    triggerRefresh();
    onNotify(report.summaryMessage, report.ciGatePassed ? 'success' : 'info');
  };

  const handleRegisterFeature = (e: React.FormEvent) => {
    e.preventDefault();
    if (regForm.actions.length === 0) {
      onNotify('Select at least one permission action.', 'error');
      return;
    }
    try {
      const res = userRoleAdminService.registerModuleFeaturePermissions(regForm, actor);
      const report = userRoleAdminService.synchronizePermissionRegistry(actor);
      setSyncReport(report);
      setShowRegisterModal(false);
      triggerRefresh();
      onNotify(
        `Registered ${res.registeredPermissions.length} new permission(s) for ${res.feature.featureCode}. Deny-by-default enforced; review Role-Impact Proposals below before granting.`,
        'success'
      );
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleToggleProposalRole = (permCode: string, roleId: string) => {
    const current = selectedRoleIdsByPerm[permCode] || [];
    const next = current.includes(roleId) ? current.filter((x) => x !== roleId) : [...current, roleId];
    setSelectedRoleIdsByPerm({ ...selectedRoleIdsByPerm, [permCode]: next });
  };

  const handleApproveProposalGrant = (permCode: string) => {
    const targetRoleIds = selectedRoleIdsByPerm[permCode] || [];
    if (targetRoleIds.length === 0) {
      onNotify('Select at least one role to grant this permission.', 'error');
      return;
    }
    try {
      const res = userRoleAdminService.approveRoleImpactGrant(
        {
          permissionCode: permCode,
          targetRoleIds,
          reason: 'Explicit Role-Impact Approval from Module & Feature Permission Registry',
        },
        actor
      );
      const report = userRoleAdminService.synchronizePermissionRegistry(actor);
      setSyncReport(report);
      triggerRefresh();
      onNotify(`Approved and granted '${permCode}' to: ${res.grantedRoles.join(', ')}.`, 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Registry Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              Module, Submodule, Feature & Permission Registry (Deny-by-Default)
            </h3>
            <p className="text-[11px] text-slate-500">
              Automatically registers permissions for new modules & features without auto-granting them to existing operational roles.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRunSync}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Run Registry Sync & CI Gate
            </button>
            <button
              type="button"
              onClick={() => setShowRegisterModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Register New Module / Feature
            </button>
          </div>
        </div>

        {/* CI Gate Integrity Summary */}
        {syncReport && (
          <div
            className={`p-3 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
              syncReport.ciGatePassed ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {syncReport.ciGatePassed ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <div>
                <div className="font-bold">{syncReport.summaryMessage}</div>
                <div className="text-[11px] opacity-85 mt-0.5">
                  Modules: {syncReport.totalModules} • Submodules: {syncReport.totalSubmodules} • Features: {syncReport.totalFeatures} • Permissions: {syncReport.totalPermissions} • Duplicates: {syncReport.duplicatePermissionCodes.length} • Orphans: {syncReport.orphanedPermissions.length}
                </div>
              </div>
            </div>
            <span className="font-mono text-[10px] font-bold">
              {syncReport.ciGatePassed ? 'CI GATE: PASS' : 'CI GATE: REVIEW'}
            </span>
          </div>
        )}
      </div>

      {/* Role-Impact Proposal Report (Pending Explicit Admin Grant Approval) */}
      {syncReport && syncReport.roleImpactProposals.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-amber-100 pb-2">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Role-Impact Proposal Report — Unassigned New Permissions ({syncReport.roleImpactProposals.length})
              </h4>
              <p className="text-[11px] text-slate-500">
                New permissions remain strictly DENIED to operational roles until explicitly approved below.
              </p>
            </div>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {syncReport.roleImpactProposals.map((prop) => {
              const selected = selectedRoleIdsByPerm[prop.permissionCode] || [];
              return (
                <div key={prop.permissionCode} className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-indigo-700">{prop.permissionCode}</span>
                      <span className="text-slate-500 ml-2">({prop.label})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApproveProposalGrant(prop.permissionCode)}
                      className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Approve & Grant Selected ({selected.length})
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {roles
                      .filter((r) => !r.isSuperAdmin && r.status === 'ACTIVE')
                      .map((r) => (
                        <label
                          key={r.id}
                          className={`px-2 py-1 rounded border text-[11px] font-semibold cursor-pointer flex items-center gap-1 ${
                            selected.includes(r.id) ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected.includes(r.id)}
                            onChange={() => handleToggleProposalRole(prop.permissionCode, r.id)}
                          />
                          {r.roleCode}
                        </label>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Registered Permissions Catalog Grid */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
          >
            <option value="ALL">All Modules ({modules.length})</option>
            {modules.map((m) => (
              <option key={m.id} value={m.moduleCode}>
                {m.moduleCode} — {m.moduleName}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search permission code, feature, API endpoint..."
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          />
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-2.5">Permission Code</th>
                <th className="p-2.5">Hierarchy (Module / Submodule / Feature)</th>
                <th className="p-2.5">Action</th>
                <th className="p-2.5">API & UI Binding</th>
                <th className="p-2.5">Sensitivity</th>
                <th className="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grid.pagedData.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className="p-2.5">
                    <div className="font-mono font-bold text-indigo-700">{p.permissionCode}</div>
                    <div className="text-[11px] text-slate-500">{p.label}</div>
                    {p.legacyAliasKey && (
                      <div className="text-[10px] font-mono text-slate-400">Alias: {p.legacyAliasKey}</div>
                    )}
                  </td>
                  <td className="p-2.5">
                    <div className="font-bold text-slate-800">{p.moduleCode}</div>
                    <div className="text-[11px] text-slate-500">
                      {p.submoduleCode || '-'} → {p.featureCode}
                    </div>
                  </td>
                  <td className="p-2.5 font-mono font-bold text-slate-800">{p.action}</td>
                  <td className="p-2.5 text-[11px] font-mono text-slate-600">
                    <div>{p.apiEndpoint || '-'}</div>
                    <div className="text-slate-400">{p.uiControlKey || '-'}</div>
                  </td>
                  <td className="p-2.5">
                    <RiskTag level={p.sensitivity} />
                  </td>
                  <td className="p-2.5">
                    <StatusTag status={p.status} />
                  </td>
                </tr>
              ))}
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

      {showRegisterModal && (
        <ModalShell
          title="Register New Module / Feature & Auto-Register Permissions"
          subtitle="Permissions are registered as Deny-by-Default and emit a Role-Impact Proposal without auto-granting to operational roles."
          onClose={() => setShowRegisterModal(false)}
          maxWidth="max-w-3xl"
        >
          <form onSubmit={handleRegisterFeature} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Module Code *</label>
                <input required value={regForm.moduleCode} onChange={(e) => setRegForm({ ...regForm, moduleCode: e.target.value.toUpperCase() })} className="w-full p-2 border border-slate-300 rounded-lg font-mono uppercase" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Module Display Name *</label>
                <input required value={regForm.moduleName} onChange={(e) => setRegForm({ ...regForm, moduleName: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Submodule Code</label>
                <input value={regForm.submoduleCode} onChange={(e) => setRegForm({ ...regForm, submoduleCode: e.target.value.toUpperCase() })} className="w-full p-2 border border-slate-300 rounded-lg font-mono uppercase" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Submodule Name</label>
                <input value={regForm.submoduleName} onChange={(e) => setRegForm({ ...regForm, submoduleName: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Feature Code *</label>
                <input required value={regForm.featureCode} onChange={(e) => setRegForm({ ...regForm, featureCode: e.target.value.toUpperCase() })} className="w-full p-2 border border-slate-300 rounded-lg font-mono uppercase" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Feature Name *</label>
                <input required value={regForm.featureName} onChange={(e) => setRegForm({ ...regForm, featureName: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">UI Route Reference *</label>
                <input required value={regForm.routeReference} onChange={(e) => setRegForm({ ...regForm, routeReference: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Related API Endpoint *</label>
                <input required value={regForm.relatedApi} onChange={(e) => setRegForm({ ...regForm, relatedApi: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg font-mono" />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Actions to Auto-Register (Deny-by-Default) *</label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_ACTIONS.map((act) => {
                  const checked = regForm.actions.includes(act);
                  return (
                    <label
                      key={act}
                      className={`px-2 py-1 rounded border text-[11px] font-bold cursor-pointer flex items-center gap-1 ${
                        checked ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setRegForm({
                            ...regForm,
                            actions: checked ? regForm.actions.filter((a) => a !== act) : [...regForm.actions, act],
                          })
                        }
                      />
                      {act}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowRegisterModal(false)} className="px-3.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">
                Register Permissions (Deny-by-Default)
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
};
