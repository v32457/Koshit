import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { User, Branch, Organization, Company } from '../types';
import {
  Building2,
  ShieldCheck,
  Bell,
  ChevronDown,
  UserCheck,
  ShieldAlert,
  LogOut,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Phone,
} from 'lucide-react';

interface AppHeaderProps {
  currentUser: User;
  activeOrg: Organization;
  activeCompany?: Company;
  allCompanies?: Company[];
  activeBranch: Branch;
  allBranches: Branch[];
  allUsers: User[];
  onSwitchCompany?: (companyId: string) => void;
  onSwitchBranch: (branchId: string) => void;
  onSwitchUser: (userId: string) => void;
  onNavigate?: (route: string) => void;
  onLogout?: () => void;
  onToggleMobileSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
  notificationCount?: number;
  onOpenNotifications?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentUser,
  activeOrg,
  activeCompany,
  activeBranch,
  allUsers,
  onSwitchUser,
  onNavigate,
  onLogout,
  onToggleMobileSidebar,
  isSidebarCollapsed = false,
  onToggleSidebarCollapse,
  notificationCount = 3,
  onOpenNotifications,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileOrgInfo, setShowMobileOrgInfo] = useState(false);

  return (
    <header className="bg-[#0B192C] text-white border-b border-slate-800 shadow-md sticky top-0 z-30 select-none w-full max-w-full">
      <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        {/* Left: Hamburger (Mobile), Sidebar Collapse Toggle (Tablet/Desktop) & Brand Identity */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onToggleMobileSidebar && (
            <button
              type="button"
              onClick={onToggleMobileSidebar}
              aria-label="Open Navigation Menu"
              className="md:hidden p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer shrink-0"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {onToggleSidebarCollapse && (
            <button
              type="button"
              onClick={onToggleSidebarCollapse}
              aria-label={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              className="hidden md:inline-flex p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer shrink-0 transition"
              title={isSidebarCollapsed ? 'Expand Sidebar Navigation' : 'Collapse Sidebar to Release Workspace'}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-cyan-400" />
              ) : (
                <PanelLeftClose className="w-4 h-4 text-slate-300" />
              )}
            </button>
          )}

          <BrandLogo size="sm" showWordmark={true} />
        </div>

        {/* Right: Context Selectors & User Session */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Desktop & Tablet Landscape Enterprise Organization Scope Badge */}
          <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs text-slate-200 font-mono shadow-xs">
            <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 block leading-none font-sans uppercase font-bold">
                Enterprise Organization Scope
              </span>
              <span className="font-bold text-white block leading-tight font-sans">
                {activeOrg.name || 'Kosh Innovations Pvt Ltd'}
              </span>
            </div>
          </div>

          {/* Compact Organization Info Toggle for Mobile & Tablet Portrait */}
          <button
            type="button"
            onClick={() => setShowMobileOrgInfo(!showMobileOrgInfo)}
            aria-label="Toggle Organization Information"
            className="lg:hidden p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition cursor-pointer"
            title="Organization & Branch Scope"
          >
            <Building2 className="w-4 h-4" />
          </button>

          {/* 2FA Security Badge (Large Desktop) */}
          <div
            className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${
              currentUser.twoFactorEnabled
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                : 'bg-amber-950/40 border-amber-800/80 text-amber-300'
            }`}
          >
            {currentUser.twoFactorEnabled ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-semibold">Email 2FA Active</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-semibold">2FA Disabled</span>
              </>
            )}
          </div>

          {/* Notifications Trigger */}
          <button
            type="button"
            aria-label="Governance Notifications"
            onClick={() => {
              if (onOpenNotifications) onOpenNotifications();
              setShowUserMenu(false);
            }}
            className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Governance Notifications"
          >
            <Bell className="w-4 h-4" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#E85C0D] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                {notificationCount}
              </span>
            )}
          </button>

          {/* Active User & Role Switcher */}
          <div className="relative">
            <button
              type="button"
              aria-label="User Profile and Quick Role Switch"
              onClick={() => {
                setShowUserMenu(!showUserMenu);
              }}
              className="flex items-center gap-1.5 sm:gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 sm:px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
              title="User Profile & Quick Role Switch"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                {currentUser.fullName.charAt(0)}
              </div>
              <div className="text-left hidden md:block">
                <span className="font-bold text-white block leading-tight truncate max-w-[140px]">
                  {currentUser.fullName}
                </span>
                <span className="text-[10px] text-cyan-300 block leading-none font-semibold">
                  {currentUser.role.replace('_', ' ')}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-24px)] bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 text-slate-800 text-xs">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="font-bold text-slate-900">{currentUser.fullName}</div>
                  <div className="text-[11px] text-slate-500 truncate">{currentUser.email}</div>
                  <div className="mt-1 inline-block bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    Role: {currentUser.role}
                  </div>
                </div>

                <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-100 flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-cyan-600" />
                  Quick-Switch Role for RBAC Testing
                </div>

                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {allUsers.map((u) => (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => {
                        onSwitchUser(u.id);
                        setShowUserMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-xs transition cursor-pointer ${
                        u.id === currentUser.id ? 'bg-blue-50/70 font-semibold text-blue-900' : ''
                      }`}
                    >
                      <div>
                        <div className="font-medium text-slate-900">{u.fullName}</div>
                        <div className="text-[10px] text-slate-500">{u.role}</div>
                      </div>
                      {u.id === currentUser.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                  ))}
                </div>

                <div className="p-2 border-t border-slate-100 mt-1 space-y-1">
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onNavigate('/settings/my-contact-consent');
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs text-slate-800 hover:bg-indigo-50 rounded flex items-center justify-between gap-2 font-semibold transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-indigo-600" />
                        My Contact &amp; Personal Consent
                      </span>
                      {currentUser.mobileNumberType === 'PERSONAL' &&
                        currentUser.mobileConsentStatus === 'PENDING_EMPLOYEE_CONSENT' && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Action Req
                          </span>
                        )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      if (onLogout) onLogout();
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded flex items-center gap-2 font-medium transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out & Revoke Session
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Secondary Organization Info Panel for Mobile / Tablet */}
      {showMobileOrgInfo && (
        <div className="lg:hidden px-3 py-2 bg-slate-900 border-t border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              Organization & Active Branch
            </span>
            <span className="font-bold text-white">
              {activeCompany?.name || activeOrg.name} — {activeBranch?.name}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[10px] font-semibold">
            {currentUser.role}
          </span>
        </div>
      )}
    </header>
  );
};
