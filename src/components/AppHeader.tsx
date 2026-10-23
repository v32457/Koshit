import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { User, Branch, Organization } from '../types';
import { Building2, MapPin, ShieldCheck, Bell, ChevronDown, UserCheck, ShieldAlert, LogOut, Check } from 'lucide-react';

interface AppHeaderProps {
  currentUser: User;
  activeOrg: Organization;
  activeBranch: Branch;
  allBranches: Branch[];
  allUsers: User[];
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
  activeBranch,
  allBranches,
  allUsers,
  onSwitchBranch,
  onSwitchUser,
  onLogout,
  onToggleMobileSidebar,
  notificationCount = 3,
  onOpenNotifications,
}) => {
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="bg-[#0B192C] text-white border-b border-slate-800 shadow-md sticky top-0 z-30 select-none">
      <div className="px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Brand Identity & Portal Titles */}
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

          <div className="hidden lg:block h-8 w-px bg-slate-700/80" />

          <div className="hidden sm:flex flex-col">
            <h1 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              My Kosh Innovations Global IT System
              <span className="text-[10px] bg-blue-900/60 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded font-mono font-normal">
                v1.0.0
              </span>
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
              <span className="text-amber-400 font-semibold">• Item Master Module</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Enterprise Multi-Branch Governance</span>
            </div>
          </div>
        </div>

        {/* Right: Context Selectors & User Session */}
        <div className="flex items-center gap-3">
          {/* Organization Badge */}
          <div className="hidden md:flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 px-2.5 py-1 rounded-lg text-xs">
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Org:</span>
            <span className="font-semibold text-slate-200">{activeOrg.name}</span>
          </div>

          {/* Plant / Branch Switcher */}
          <div className="relative">
            <button
              onClick={() => {
                setShowBranchMenu(!showBranchMenu);
                setShowUserMenu(false);
                setShowNotifications(false);
              }}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 px-3 py-1.5 rounded-lg text-xs text-slate-200 transition cursor-pointer"
              title="Switch Active Branch/Plant Scope"
            >
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <div className="text-left hidden sm:block">
                <span className="text-[10px] text-slate-400 block leading-none">Active Branch</span>
                <span className="font-bold text-white truncate max-w-[140px] block leading-tight">
                  {activeBranch.name}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>

            {showBranchMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 text-slate-800 text-xs">
                <div className="px-3 py-1.5 border-b border-slate-100 font-bold text-slate-500 uppercase text-[10px]">
                  Select Operating Branch / Plant
                </div>
                {allBranches.map((br) => (
                  <button
                    key={br.id}
                    onClick={() => {
                      onSwitchBranch(br.id);
                      setShowBranchMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-start justify-between gap-2 hover:bg-slate-50 transition cursor-pointer ${
                      br.id === activeBranch.id ? 'bg-blue-50 text-blue-900 font-semibold' : ''
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{br.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {br.city}, {br.state} • {br.plants.length} Units
                      </div>
                    </div>
                    {br.id === activeBranch.id && <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2FA Security Status */}
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
          <div className="relative">
            <button
              onClick={() => {
                if (onOpenNotifications) {
                  onOpenNotifications();
                }
                setShowBranchMenu(false);
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

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 z-50 text-slate-800 text-xs">
                <div className="font-bold text-slate-900 border-b border-slate-100 pb-2 mb-2 flex items-center justify-between">
                  <span>Audit & Master Notifications</span>
                  <span className="text-[10px] font-normal text-slate-500">Real-time</span>
                </div>
                <div className="space-y-2">
                  <div className="p-2 rounded bg-amber-50 border border-amber-100">
                    <div className="font-semibold text-amber-900">1 Item Pending Approval</div>
                    <div className="text-[11px] text-amber-700">MAPALBL0003 submitted by Pondicherry Plant</div>
                  </div>
                  <div className="p-2 rounded bg-blue-50 border border-blue-100">
                    <div className="font-semibold text-blue-900">SAP Sync Queued</div>
                    <div className="text-[11px] text-blue-700">FGHDMCRGY0002 approved and awaiting Service Layer batch</div>
                  </div>
                  <div className="p-2 rounded bg-emerald-50 border border-emerald-100">
                    <div className="font-semibold text-emerald-900">SAP Integration Success</div>
                    <div className="text-[11px] text-emerald-700">RMPAOPOEXLG0001 synchronized to HANA Database</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active User & Role Switcher */}
          <div className="relative">
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowBranchMenu(false);
                setShowNotifications(false);
              }}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
              title="User Profile & Quick Role Switch"
            >
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
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
