import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { User, Branch, Organization, Company } from '../types';
import { Building2, ShieldCheck, Bell, ChevronDown, UserCheck, ShieldAlert, LogOut, Check } from 'lucide-react';

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
  onLogout?: () => void;
  onToggleMobileSidebar?: () => void;
  notificationCount?: number;
  onOpenNotifications?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentUser,
  activeOrg,
  activeCompany,
  allCompanies = [],
  activeBranch,
  allBranches,
  allUsers,
  onSwitchCompany,
  onSwitchBranch,
  onSwitchUser,
  onLogout,
  onToggleMobileSidebar,
  notificationCount = 3,
  onOpenNotifications,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="bg-[#0B192C] text-white border-b border-slate-800 shadow-md sticky top-0 z-30 select-none">
      <div className="px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Brand Identity & Single Official Heading */}
        <div className="flex items-center gap-3">
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              title="Toggle Menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          <BrandLogo size="md" showWordmark={true} />
        </div>

        {/* Right: Context Selectors & User Session */}
        <div className="flex items-center gap-3">
          {/* Enterprise Organization Governance Scope Badge */}
          <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs text-slate-200 font-mono shadow-xs">
            <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 block leading-none font-sans uppercase font-bold">Enterprise Organization Scope</span>
              <span className="font-bold text-white block leading-tight font-sans">
                {activeOrg.name || 'Kosh Innovations Pvt Ltd'}
              </span>
            </div>
          </div>

          {/* 2FA Security Badge */}
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
            onClick={() => {
              if (onOpenNotifications) onOpenNotifications();
              setShowUserMenu(false);
            }}
            className="relative p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
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
              onClick={() => {
                setShowUserMenu(!showUserMenu);
              }}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
              title="User Profile & Quick Role Switch"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                {currentUser.fullName.charAt(0)}
              </div>
              <div className="text-left hidden md:block">
                <span className="font-bold text-white block leading-tight">{currentUser.fullName}</span>
                <span className="text-[10px] text-cyan-300 block leading-none font-semibold">
                  {currentUser.role.replace('_', ' ')}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 text-slate-800 text-xs">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="font-bold text-slate-900">{currentUser.fullName}</div>
                  <div className="text-[11px] text-slate-500">{currentUser.email}</div>
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

                <div className="p-2 border-t border-slate-100 mt-1">
                  <button
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
    </header>
  );
};
