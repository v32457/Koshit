import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Shield,
  KeyRound,
  Layers,
  Building2,
  ClipboardList,
  Clock,
  ShieldAlert,
  Lock,
  History,
  FileBarChart2,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';
import type { Branch, Company, User } from '../../types';
import { UserDashboardTab } from './userRoleAdmin/UserDashboardTab';
import { UserManagementTab } from './userRoleAdmin/UserManagementTab';
import { RoleManagementTab } from './userRoleAdmin/RoleManagementTab';
import { PermissionMatrixTab } from './userRoleAdmin/PermissionMatrixTab';
import { ModuleFeatureRegistryTab } from './userRoleAdmin/ModuleFeatureRegistryTab';
import { OrgAccessAndAssignmentsTab } from './userRoleAdmin/OrgAccessAndAssignmentsTab';
import { AccessRequestsTab } from './userRoleAdmin/AccessRequestsTab';
import { TempAccessDelegationTab } from './userRoleAdmin/TempAccessDelegationTab';
import { SodGovernanceTab } from './userRoleAdmin/SodGovernanceTab';
import { SecurityPoliciesSessionsTab } from './userRoleAdmin/SecurityPoliciesSessionsTab';
import { AuditHistoryReviewsTab } from './userRoleAdmin/AuditHistoryReviewsTab';
import { AccessReportsTab } from './userRoleAdmin/AccessReportsTab';

export type UraTabKey =
  | 'dashboard'
  | 'users'
  | 'roles'
  | 'permissions'
  | 'registry'
  | 'org-assignments'
  | 'requests'
  | 'temp'
  | 'sod'
  | 'security'
  | 'audit'
  | 'reports';

interface UserRoleAdministrationViewProps {
  currentUser: User;
  activeCompany: Company;
  activeBranch: Branch;
  companies: Company[];
  branches: Branch[];
  onNavigate?: (route: string) => void;
}

const TABS: Array<{ key: UraTabKey; label: string; group: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'dashboard', label: '1. User Dashboard', group: 'Identity', icon: LayoutDashboard },
  { key: 'users', label: '2. Users', group: 'Identity', icon: Users },
  { key: 'roles', label: '3. Roles', group: 'RBAC', icon: Shield },
  { key: 'permissions', label: '4. Permissions & Auth Sim', group: 'RBAC', icon: KeyRound },
  { key: 'registry', label: '5. Module & Feature Registry', group: 'RBAC', icon: Layers },
  { key: 'org-assignments', label: '6–7. Org Scope & Assignments', group: 'Governance', icon: Building2 },
  { key: 'requests', label: '8. Access Requests', group: 'Governance', icon: ClipboardList },
  { key: 'temp', label: '9–10. Temp Access & Delegations', group: 'Governance', icon: Clock },
  { key: 'sod', label: 'SoD Matrix', group: 'Governance', icon: ShieldAlert },
  { key: 'security', label: '11–12,17. Policies, Sessions & Break-Glass', group: 'Security', icon: Lock },
  { key: 'audit', label: '13–15. Reviews, History & Audit', group: 'Audit', icon: History },
  { key: 'reports', label: '16. 25 Reports & Export', group: 'Audit', icon: FileBarChart2 },
];

export const UserRoleAdministrationView: React.FC<UserRoleAdministrationViewProps> = ({
  currentUser,
  activeCompany,
  activeBranch,
  companies,
  branches,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<UraTabKey>('dashboard');
  const [refreshTick, setRefreshTick] = useState(0);
  const [banner, setBanner] = useState<{ msg: string; tone: 'success' | 'error' | 'info' } | null>(null);

  const triggerRefresh = () => setRefreshTick((t) => t + 1);

  const onNotify = (msg: string, tone: 'success' | 'error' | 'info' = 'info') => {
    setBanner({ msg, tone });
  };

  const sharedProps = {
    currentUser,
    activeCompany,
    activeBranch,
    companies,
    branches,
    onNavigate,
    onNotify,
    refreshTick,
    triggerRefresh,
  };

  return (
    <div className="space-y-4 text-xs min-w-0 max-w-full">
      {/* Module Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600 shrink-0" />
              <span>User & Role Administration</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Centralized identity governance, role hierarchy, granular permission registry (Deny-by-Default), organizational scoping, SoD, session control, and compliance reporting.
            </p>
          </div>
          <div className="text-right text-[11px] text-slate-600">
            <div className="font-bold text-slate-800">{currentUser.fullName} ({currentUser.role})</div>
            <div>
              Context: {activeCompany.code} • {activeBranch.code}
            </div>
          </div>
        </div>

        {/* Navigation Tabs (wraps cleanly on desktop, scrollable fallback on mobile) */}
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Inline Feedback Banner */}
      {banner && (
        <div
          className={`px-4 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold ${
            banner.tone === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : banner.tone === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-sky-50 border-sky-200 text-sky-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.tone === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : banner.tone === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-sky-600 shrink-0" />
            )}
            <span>{banner.msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-[11px] font-bold underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Section View */}
      {activeTab === 'dashboard' && (
        <UserDashboardTab
          {...sharedProps}
          onSelectSection={(tab) => setActiveTab(tab as UraTabKey)}
        />
      )}
      {activeTab === 'users' && <UserManagementTab {...sharedProps} />}
      {activeTab === 'roles' && <RoleManagementTab {...sharedProps} />}
      {activeTab === 'permissions' && <PermissionMatrixTab {...sharedProps} />}
      {activeTab === 'registry' && <ModuleFeatureRegistryTab {...sharedProps} />}
      {activeTab === 'org-assignments' && <OrgAccessAndAssignmentsTab {...sharedProps} />}
      {activeTab === 'requests' && <AccessRequestsTab {...sharedProps} />}
      {activeTab === 'temp' && <TempAccessDelegationTab {...sharedProps} />}
      {activeTab === 'sod' && <SodGovernanceTab {...sharedProps} />}
      {activeTab === 'security' && <SecurityPoliciesSessionsTab {...sharedProps} />}
      {activeTab === 'audit' && <AuditHistoryReviewsTab {...sharedProps} />}
      {activeTab === 'reports' && <AccessReportsTab {...sharedProps} />}
    </div>
  );
};
