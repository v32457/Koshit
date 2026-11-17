import React, { useMemo, useState } from 'react';
import {
  KeyRound,
  Save,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Play,
  Database,
} from 'lucide-react';
import type { AuthorizationCheckResult, DataScopeLevel } from '../../../types/userRoleAdmin';
import { userRoleAdminService } from '../../../services/userRoleAdminService';
import { rbacPermissionService, EnterprisePermissionKey } from '../../../services/rbacPermissionService';
import { UserRoleAdminTabProps } from './shared';

const DATA_SCOPES: DataScopeLevel[] = [
  'OWN_RECORDS',
  'ASSIGNED_RECORDS',
  'DEPARTMENT_RECORDS',
  'BRANCH_RECORDS',
  'PURCHASE_ORG_RECORDS',
  'COMPANY_RECORDS',
  'ALL_AUTHORIZED_RECORDS',
  'READ_ONLY_RECORDS',
];

export const PermissionMatrixTab: React.FC<UserRoleAdminTabProps> = ({
  currentUser,
  companies,
  branches,
  onNotify,
  refreshTick,
  triggerRefresh,
}) => {
  const roles = useMemo(() => userRoleAdminService.getRoles(), [refreshTick]);
  const modules = useMemo(() => userRoleAdminService.getModules(), [refreshTick]);
  const features = useMemo(() => userRoleAdminService.getFeatures(), [refreshTick]);
  const permissions = useMemo(() => userRoleAdminService.getPermissions(), [refreshTick]);
  const users = useMemo(() => userRoleAdminService.getUsers(), [refreshTick]);

  const [selectedRoleId, setSelectedRoleId] = useState<string>(() => roles[1]?.id || roles[0]?.id || '');
  const [selectedModuleCode, setSelectedModuleCode] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Draft permission edits for the selected role
  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) || roles[0],
    [roles, selectedRoleId]
  );

  const [draftExplicit, setDraftExplicit] = useState<string[] | null>(null);
  const [draftRestricted, setDraftRestricted] = useState<string[] | null>(null);
  const [draftScopes, setDraftScopes] = useState<Record<string, DataScopeLevel> | null>(null);

  const effectiveExplicit = draftExplicit ?? selectedRole?.explicitPermissionCodes ?? [];
  const effectiveRestricted = draftRestricted ?? selectedRole?.restrictedPermissionCodes ?? [];
  const effectiveScopes = draftScopes ?? selectedRole?.permissionScopes ?? {};

  const roleInherited = useMemo(
    () => (selectedRole ? userRoleAdminService.getEffectiveRolePermissions(selectedRole.id).inheritedPermissions : []),
    [selectedRole, refreshTick]
  );

  // User-Level Override controls
  const [overrideUserId, setOverrideUserId] = useState<string>(() => users[1]?.id || users[0]?.id || '');
  const [overridePermCode, setOverridePermCode] = useState<string>(() => permissions[0]?.permissionCode || '');
  const [overrideMode, setOverrideMode] = useState<'GRANT' | 'REVOKE' | 'CLEAR'>('GRANT');

  // 10-Step Authorization Simulator
  const [simUserId, setSimUserId] = useState<string>(() => users[1]?.id || users[0]?.id || '');
  const [simPermCode, setSimPermCode] = useState<string>(() => permissions[0]?.permissionCode || '');
  const [simCompanyId, setSimCompanyId] = useState<string>(companies[0]?.id || 'co-kosh-01');
  const [simBranchId, setSimBranchId] = useState<string>(branches[0]?.id || 'br-pond-01');
  const [simActionType, setSimActionType] = useState<'VIEW' | 'CREATE' | 'EDIT' | 'APPROVE' | 'ADMIN'>('VIEW');
  const [simCreatorId, setSimCreatorId] = useState<string>('');
  const [simResult, setSimResult] = useState<AuthorizationCheckResult | null>(null);

  const cacheStats = useMemo(() => userRoleAdminService.getAuthCacheStats(), [refreshTick, simResult]);

  const filteredPermissions = useMemo(() => {
    const q = search.toLowerCase().trim();
    return permissions.filter((p) => {
      if (selectedModuleCode !== 'ALL' && p.moduleCode !== selectedModuleCode) return false;
      if (q) {
        const hay = `${p.permissionCode} ${p.label} ${p.featureCode} ${p.action} ${p.moduleCode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [permissions, selectedModuleCode, search]);

  const handleTogglePerm = (code: string) => {
    const nextExplicit = [...effectiveExplicit];
    const nextRestricted = effectiveRestricted.filter((c) => c !== code);
    if (nextExplicit.includes(code)) {
      setDraftExplicit(nextExplicit.filter((c) => c !== code));
      // If inherited from parent, explicitly add to restricted list so toggle denies cleanly
      if (roleInherited.includes(code)) {
        setDraftRestricted([...nextRestricted, code]);
      } else {
        setDraftRestricted(nextRestricted);
      }
    } else {
      setDraftExplicit([...nextExplicit, code]);
      setDraftRestricted(nextRestricted);
    }
  };

  const handleSaveRolePermissions = () => {
    if (!selectedRole) return;
    try {
      userRoleAdminService.setRolePermissions(
        selectedRole.id,
        effectiveExplicit,
        effectiveRestricted,
        effectiveScopes,
        'Permission Matrix explicit save',
        { id: currentUser.id, name: currentUser.fullName }
      );
      setDraftExplicit(null);
      setDraftRestricted(null);
      setDraftScopes(null);
      triggerRefresh();
      onNotify(`Saved permission matrix for '${selectedRole.roleCode}' and invalidated RBAC cache.`, 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleApplyUserOverride = () => {
    if (!overrideUserId || !overridePermCode) return;
    rbacPermissionService.setUserPermissionOverride(
      overrideUserId,
      overridePermCode as EnterprisePermissionKey,
      overrideMode,
      { id: currentUser.id, name: currentUser.fullName }
    );
    triggerRefresh();
    onNotify(`Applied ${overrideMode} override for ${overridePermCode}.`, 'success');
  };

  const handleRunSimulation = () => {
    const res = userRoleAdminService.evaluateAuthorization({
      userId: simUserId,
      permissionCode: simPermCode,
      companyId: simCompanyId || undefined,
      branchId: simBranchId || undefined,
      actionType: simActionType,
      transactionCreatorUserId: simCreatorId || undefined,
    });
    setSimResult(res);
  };

  const overrideMap = useMemo(() => rbacPermissionService.getUserOverridesMap(), [refreshTick]);
  const selectedUserOverrides = overrideMap[overrideUserId] || { granted: [], revoked: [] };

  return (
    <div className="space-y-4">
      {/* Role Permission Matrix Editor */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-indigo-600" />
              Granular Role Permission & Data Scope Matrix
            </h3>
            <p className="text-[11px] text-slate-500">
              Module → Submodule → Feature → Action → Data Scope configuration with explicit inheritance & restriction support.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedRole?.id || ''}
              onChange={(e) => {
                setSelectedRoleId(e.target.value);
                setDraftExplicit(null);
                setDraftRestricted(null);
                setDraftScopes(null);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roleCode} — {r.roleName}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleSaveRolePermissions}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5" /> Save Role Matrix
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <select
            value={selectedModuleCode}
            onChange={(e) => setSelectedModuleCode(e.target.value)}
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
            placeholder="Filter by permission code, feature, or action..."
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          />
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-96 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-2.5">Allow</th>
                <th className="p-2.5">Module / Feature</th>
                <th className="p-2.5">Permission Code</th>
                <th className="p-2.5">Action</th>
                <th className="p-2.5">Source</th>
                <th className="p-2.5">Data Scope</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPermissions.map((perm) => {
                const isExplicit = effectiveExplicit.includes(perm.permissionCode);
                const isInherited = roleInherited.includes(perm.permissionCode);
                const isRestricted = effectiveRestricted.includes(perm.permissionCode);
                const isAllowed = (isExplicit || isInherited) && !isRestricted;
                const feat = features.find((f) => f.featureCode === perm.featureCode);

                return (
                  <tr key={perm.id} className={isAllowed ? 'bg-emerald-50/30' : 'hover:bg-slate-50'}>
                    <td className="p-2.5">
                      <input
                        type="checkbox"
                        checked={isAllowed}
                        onChange={() => handleTogglePerm(perm.permissionCode)}
                        className="w-4 h-4 cursor-pointer accent-indigo-600"
                      />
                    </td>
                    <td className="p-2.5">
                      <div className="font-bold text-slate-800">{perm.moduleCode}</div>
                      <div className="text-[11px] text-slate-500">{feat?.featureName || perm.featureCode}</div>
                    </td>
                    <td className="p-2.5">
                      <div className="font-mono font-semibold text-indigo-700">{perm.permissionCode}</div>
                      <div className="text-[11px] text-slate-500">{perm.label}</div>
                    </td>
                    <td className="p-2.5 font-mono font-bold text-slate-700">{perm.action}</td>
                    <td className="p-2.5 text-[11px] font-semibold">
                      {isRestricted ? (
                        <span className="text-rose-700">Explicitly Restricted</span>
                      ) : isExplicit ? (
                        <span className="text-emerald-700">Explicit Grant</span>
                      ) : isInherited ? (
                        <span className="text-indigo-700">Inherited</span>
                      ) : (
                        <span className="text-slate-400">Denied (Default)</span>
                      )}
                    </td>
                    <td className="p-2.5">
                      <select
                        value={effectiveScopes[perm.permissionCode] || perm.allowedDataScopes[0] || 'BRANCH_RECORDS'}
                        onChange={(e) =>
                          setDraftScopes({
                            ...effectiveScopes,
                            [perm.permissionCode]: e.target.value as DataScopeLevel,
                          })
                        }
                        className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-semibold"
                      >
                        {DATA_SCOPES.map((ds) => (
                          <option key={ds} value={ds}>
                            {ds.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid: User Overrides + 10-Step Auth Simulator + Cache Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* User-Level Permission Overrides */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold text-slate-900">User-Level Direct Permission Overrides</h4>
            <p className="text-[11px] text-slate-500">
              Explicit REVOKE always overrides role grants. Changes automatically invalidate permission cache and record audit logs.
            </p>
          </div>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={overrideUserId}
                onChange={(e) => setOverrideUserId(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.role})
                  </option>
                ))}
              </select>
              <select
                value={overridePermCode}
                onChange={(e) => setOverridePermCode(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px]"
              >
                {permissions.map((p) => (
                  <option key={p.id} value={p.permissionCode}>
                    {p.permissionCode}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={overrideMode}
                onChange={(e) => setOverrideMode(e.target.value as any)}
                className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold flex-1 sm:flex-initial sm:w-36"
              >
                <option value="GRANT">GRANT</option>
                <option value="REVOKE">REVOKE</option>
                <option value="CLEAR">CLEAR</option>
              </select>
              <button
                type="button"
                onClick={handleApplyUserOverride}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold cursor-pointer shrink-0"
              >
                Apply Override
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="font-bold text-emerald-800">Granted Overrides ({selectedUserOverrides.granted.length})</div>
              <div className="font-mono text-emerald-700 mt-1 space-y-0.5">
                {selectedUserOverrides.granted.length === 0 ? 'None' : selectedUserOverrides.granted.map((g) => <div key={g}>{g}</div>)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200">
              <div className="font-bold text-rose-800">Revoked Overrides ({selectedUserOverrides.revoked.length})</div>
              <div className="font-mono text-rose-700 mt-1 space-y-0.5">
                {selectedUserOverrides.revoked.length === 0 ? 'None' : selectedUserOverrides.revoked.map((r) => <div key={r}>{r}</div>)}
              </div>
            </div>
          </div>

          {/* Cache Health & Manual Invalidation */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              <div>
                <div className="font-bold text-slate-800">
                  Auth Cache v{cacheStats.version} • {cacheStats.entries} entries • Hits {cacheStats.cacheHits} / Misses {cacheStats.cacheMisses}
                </div>
                <div className="text-slate-500">Last invalidation: {cacheStats.lastInvalidationReason}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                userRoleAdminService.invalidatePermissionCache('Manual Admin Cache Flush');
                triggerRefresh();
                onNotify('Permission evaluation cache flushed cleanly.', 'info');
              }}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Invalidate Cache
            </button>
          </div>
        </div>

        {/* Centralized 10-Step Deny-by-Default Authorization Simulator */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold text-slate-900">10-Step Authorization Policy Simulator</h4>
            <p className="text-[11px] text-slate-500">
              Test effective permission evaluation across identity, active dates, registry, org scope, maker-checker, and preventive SoD.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <select value={simUserId} onChange={(e) => setSimUserId(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold">
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  User: {u.fullName} ({u.status})
                </option>
              ))}
            </select>
            <select value={simPermCode} onChange={(e) => setSimPermCode(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px]">
              {permissions.map((p) => (
                <option key={p.id} value={p.permissionCode}>
                  {p.permissionCode}
                </option>
              ))}
              <option value="UNREGISTERED.FAKE.ACTION">UNREGISTERED.FAKE.ACTION (Negative Test)</option>
            </select>
            <select value={simCompanyId} onChange={(e) => setSimCompanyId(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <option value="">Any Company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <select value={simBranchId} onChange={(e) => setSimBranchId(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <option value="">Any Branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
            <select value={simActionType} onChange={(e) => setSimActionType(e.target.value as any)} className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold">
              <option value="VIEW">Action: VIEW</option>
              <option value="CREATE">Action: CREATE</option>
              <option value="EDIT">Action: EDIT</option>
              <option value="APPROVE">Action: APPROVE (Checks Maker-Checker)</option>
              <option value="ADMIN">Action: ADMIN</option>
            </select>
            <select value={simCreatorId} onChange={(e) => setSimCreatorId(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <option value="">Creator: None (No Self-Approval Test)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  Tx Creator: {u.fullName}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleRunSimulation}
            className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" /> Evaluate 10-Step Authorization
          </button>

          {simResult && (
            <div
              className={`p-3 rounded-lg border text-xs space-y-1 ${
                simResult.allowed ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5">
                {simResult.allowed ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-rose-600" />}
                <span>{simResult.allowed ? 'AUTHORIZED (ALLOW)' : `DENIED (${simResult.denialCode})`}</span>
              </div>
              <div>{simResult.reason}</div>
              <div className="text-[10px] opacity-80">
                Source: {simResult.matchedSource || 'N/A'} • Data Scope: {simResult.effectiveDataScope || 'N/A'} • Cache Hit: {simResult.cacheHit ? 'Yes' : 'No'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
