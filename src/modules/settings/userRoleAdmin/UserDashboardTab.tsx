import React, { useMemo, useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Shield,
  KeyRound,
  ClipboardList,
  Clock,
  Monitor,
  AlertTriangle,
  ShieldAlert,
  Lock,
  UserCog,
  UserMinus,
  Layers,
  History,
  CheckCircle2,
  ArrowRight,
  BellRing,
} from 'lucide-react';
import { userRoleAdminService, DashboardFilterState } from '../../../services/userRoleAdminService';
import { PurchaseOrganizationService } from '../../../services/purchaseOrganizationService';
import { RiskTag, UserRoleAdminTabProps } from './shared';

interface UserDashboardTabProps extends UserRoleAdminTabProps {
  onSelectSection: (tab: string) => void;
}

export const UserDashboardTab: React.FC<UserDashboardTabProps> = ({
  currentUser,
  companies,
  branches,
  onNotify,
  refreshTick,
  triggerRefresh,
  onSelectSection,
}) => {
  const [filters, setFilters] = useState<DashboardFilterState>({
    companyId: 'ALL',
    branchId: 'ALL',
    department: 'ALL',
    purchaseOrgId: 'ALL',
    roleCode: 'ALL',
    userStatus: 'ALL',
    associationStatus: 'ALL',
    dateFrom: '',
    dateTo: '',
  });

  const purchaseOrgs = useMemo(() => PurchaseOrganizationService.getOrganizations(), [refreshTick]);
  const roles = useMemo(() => userRoleAdminService.getRoles(), [refreshTick]);
  const allUsers = useMemo(() => userRoleAdminService.getUsers(), [refreshTick]);
  const departments = useMemo(
    () => Array.from(new Set(allUsers.map((u) => u.department).filter(Boolean))) as string[],
    [allUsers]
  );

  const normalizedFilters: DashboardFilterState = useMemo(
    () => ({
      companyId: filters.companyId === 'ALL' ? undefined : filters.companyId,
      branchId: filters.branchId === 'ALL' ? undefined : filters.branchId,
      department: filters.department === 'ALL' ? undefined : filters.department,
      purchaseOrgId: filters.purchaseOrgId === 'ALL' ? undefined : filters.purchaseOrgId,
      roleCode: filters.roleCode === 'ALL' ? undefined : filters.roleCode,
      userStatus: filters.userStatus === 'ALL' ? undefined : filters.userStatus,
      associationStatus: filters.associationStatus === 'ALL' ? undefined : filters.associationStatus,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    }),
    [filters]
  );

  const kpis = useMemo(
    () => userRoleAdminService.getDashboardKpis(normalizedFilters),
    [normalizedFilters, refreshTick]
  );

  const alerts = useMemo(
    () => userRoleAdminService.getSecurityAlerts().filter((a) => a.status !== 'RESOLVED'),
    [refreshTick]
  );

  const kpiCards = [
    { label: 'Total Users', value: kpis.totalUsers, tab: 'users', icon: Users, accent: 'text-slate-800' },
    { label: 'Active Accounts', value: kpis.activeUsers, tab: 'users', icon: UserCheck, accent: 'text-emerald-700' },
    { label: 'Deactivated / Locked', value: kpis.inactiveLockedUsers, tab: 'users', icon: UserX, accent: 'text-rose-700' },
    { label: 'Not Associated', value: kpis.notAssociatedUsers, tab: 'users', icon: UserMinus, accent: 'text-rose-800' },
    { label: 'Pending Personal Consent', value: kpis.pendingPersonalConsentUsers, tab: 'users', icon: BellRing, accent: 'text-amber-700' },
    { label: 'Total Roles', value: kpis.totalRoles, tab: 'roles', icon: Shield, accent: 'text-indigo-700' },
    { label: 'Registered Permissions', value: kpis.totalPermissions, tab: 'registry', icon: KeyRound, accent: 'text-indigo-700' },
    { label: 'Pending Access Requests', value: kpis.pendingAccessRequests, tab: 'requests', icon: ClipboardList, accent: 'text-amber-700' },
    { label: 'Expiring Temp Access', value: kpis.expiringTempAccess, tab: 'temp', icon: Clock, accent: 'text-amber-700' },
    { label: 'Active Sessions', value: kpis.activeSessions, tab: 'security', icon: Monitor, accent: 'text-emerald-700' },
    { label: 'Failed Logins (Recent)', value: kpis.failedLoginsRecent, tab: 'security', icon: AlertTriangle, accent: 'text-rose-700' },
    { label: 'SoD Conflicts Detected', value: kpis.sodConflicts, tab: 'sod', icon: ShieldAlert, accent: 'text-orange-700' },
    { label: 'MFA Adoption', value: `${kpis.mfaAdoptionPct}% (${kpis.mfaAdoptionCount})`, tab: 'security', icon: Lock, accent: 'text-emerald-700' },
    { label: 'Privileged Users', value: kpis.privilegedUsersCount, tab: 'users', icon: UserCog, accent: 'text-indigo-700' },
    { label: 'Security Audit Events', value: kpis.recentPermissionChanges, tab: 'audit', icon: History, accent: 'text-slate-800' },
  ];

  const handleAcknowledgeAlert = (alertId: string) => {
    userRoleAdminService.acknowledgeAlert(alertId, { id: currentUser.id, name: currentUser.fullName });
    triggerRefresh();
    onNotify('Security alert acknowledged.', 'info');
  };

  return (
    <div className="space-y-4">
      {/* 7 Enterprise Dashboard Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Identity & Access Governance Overview</h3>
            <p className="text-[11px] text-slate-500">
              Live organizational RBAC telemetry filtered by Company, Branch, Department, Purchase Org, Role, Status, and Date Window.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setFilters({
                companyId: 'ALL',
                branchId: 'ALL',
                department: 'ALL',
                purchaseOrgId: 'ALL',
                roleCode: 'ALL',
                userStatus: 'ALL',
                associationStatus: 'ALL',
                dateFrom: '',
                dateTo: '',
              })
            }
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-2.5">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">1. Company</label>
            <select
              value={filters.companyId}
              onChange={(e) => setFilters({ ...filters, companyId: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">2. Branch</label>
            <select
              value={filters.branchId}
              onChange={(e) => setFilters({ ...filters, branchId: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">3. Department</label>
            <select
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">4. Purchase Org</label>
            <select
              value={filters.purchaseOrgId}
              onChange={(e) => setFilters({ ...filters, purchaseOrgId: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All Purchase Orgs</option>
              {purchaseOrgs.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.code} — {po.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">5. Role</label>
            <select
              value={filters.roleCode}
              onChange={(e) => setFilters({ ...filters, roleCode: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.roleCode}>
                  {r.roleCode}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">6. Association</label>
            <select
              value={filters.associationStatus}
              onChange={(e) => setFilters({ ...filters, associationStatus: e.target.value as any })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All Associations</option>
              <option value="ASSOCIATED">Associated</option>
              <option value="NOT_ASSOCIATED">Not Associated</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">7. Account Status</label>
            <select
              value={filters.userStatus}
              onChange={(e) => setFilters({ ...filters, userStatus: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All Account Statuses</option>
              <option value="PENDING_ACTIVATION">Pending Activation</option>
              <option value="ACTIVE">Active</option>
              <option value="LOCKED">Locked</option>
              <option value="DEACTIVATED">Deactivated</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">8. Effective Date</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* 15 Live DB-Driven KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              type="button"
              onClick={() => onSelectSection(kpi.tab)}
              className="bg-white rounded-xl border border-slate-200 p-3.5 text-left hover:border-indigo-300 hover:shadow-xs transition cursor-pointer flex items-start justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-500 leading-snug">{kpi.label}</div>
                <div className={`text-xl font-bold tabular-nums mt-1 ${kpi.accent}`}>{kpi.value}</div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                <Icon className={`w-4 h-4 ${kpi.accent}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Security Alerts & Quick Actions Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <BellRing className="w-4 h-4 text-amber-600" />
              Active Security & Governance Alerts ({alerts.length})
            </h4>
            <button
              type="button"
              onClick={() => onSelectSection('security')}
              className="text-[11px] font-bold text-indigo-700 hover:underline cursor-pointer"
            >
              Open Security & Sessions
            </button>
          </div>
          {alerts.length === 0 ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              No open security alerts. All governance policies are nominal.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {alerts.map((al) => (
                <div
                  key={al.id}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <RiskTag level={al.severity} />
                      <span className="font-bold text-xs text-slate-900">{al.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-600">{al.description}</p>
                  </div>
                  {al.status === 'OPEN' && (
                    <button
                      type="button"
                      onClick={() => handleAcknowledgeAlert(al.id)}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
          <h4 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">Quick Governance Workflows</h4>
          {[
            { label: 'Onboard / Invite User or Bulk Import', tab: 'users' },
            { label: 'Role Hierarchy & Permission Matrix', tab: 'permissions' },
            { label: 'Module & Feature Registry Sync Audit', tab: 'registry' },
            { label: 'Review Pending Access Requests', tab: 'requests' },
            { label: 'SoD Conflict Scan & Exception Governance', tab: 'sod' },
            { label: 'Run 25 Enterprise Access Reports', tab: 'reports' },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onSelectSection(item.tab)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-left text-xs font-semibold text-slate-800 flex items-center justify-between cursor-pointer transition"
            >
              <span>{item.label}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
