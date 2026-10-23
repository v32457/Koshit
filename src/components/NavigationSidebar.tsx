import React, { useState } from 'react';
import { UserRole, ModuleRegistryItem } from '../types';
import {
  LayoutDashboard,
  Box,
  FilePlus2,
  Boxes,
  FileText,
  Inbox,
  Settings,
  Shield,
  Layers,
  Code2,
  FileCode2,
  Building,
  Users2,
  History,
  FileCheck,
  Cpu,
  PlayCircle,
  Power,
  ChevronDown,
  ChevronRight,
  Mail,
  MessageSquare,
  LayoutGrid,
  Activity,
  Megaphone,
  Bell,
  Sparkles,
  SlidersHorizontal,
  Sliders,
  BarChart3,
  Server,
  ShieldCheck,
  Settings2,
  GitFork,
} from 'lucide-react';

interface NavigationSidebarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  userRole: UserRole;
  moduleRegistry?: ModuleRegistryItem[];
  isCollapsed?: boolean;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  currentRoute,
  onNavigate,
  userRole,
  moduleRegistry,
  isCollapsed = false,
}) => {
  // Module Enabled Gates
  const isItemMasterEnabled = moduleRegistry
    ? moduleRegistry.find((m) => m.moduleKey === 'ITEM_MASTER')?.isEnabled ?? true
    : true;
  const isBpMasterEnabled = moduleRegistry
    ? moduleRegistry.find((m) => m.moduleKey === 'BUSINESS_PARTNER_MASTER')?.isEnabled ?? true
    : true;

  // Expansion states for hierarchical sections
  const [itemsExpanded, setItemsExpanded] = useState(true);
  const [commHubExpanded, setCommHubExpanded] = useState(true);
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const [settingsItemExpanded, setSettingsItemExpanded] = useState(true);
  const [userMgmtExpanded, setUserMgmtExpanded] = useState(true);
  const [logsExpanded, setLogsExpanded] = useState(true);
  const [integrationExpanded, setIntegrationExpanded] = useState(true);
  const [commExpanded, setCommExpanded] = useState(true);

  // Permission checks
  const canApprove = userRole === 'ITEM_CHECKER' || userRole === 'PLATFORM_ADMIN' || userRole === 'ORG_ADMIN';
  const canCreate = userRole === 'ITEM_MAKER' || userRole === 'PLATFORM_ADMIN' || userRole === 'ORG_ADMIN' || userRole === 'GLOBAL_ITEM_ADMIN';
  const canManageRules = userRole === 'GLOBAL_ITEM_ADMIN' || userRole === 'PLATFORM_ADMIN' || userRole === 'ORG_ADMIN';
  const canManageUsers = userRole === 'PLATFORM_ADMIN' || userRole === 'ORG_ADMIN';
  const canManageIntegration = userRole === 'PLATFORM_ADMIN' || userRole === 'GLOBAL_ITEM_ADMIN';

  const isCurrent = (route: string) => currentRoute === route;

  const itemClass = (route: string, isNested = false) => `
    flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer select-none
    ${isNested ? 'ml-5 text-[11px]' : ''}
    ${
      isCurrent(route)
        ? 'bg-blue-600 text-white font-semibold shadow-xs'
        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
    }
  `;

  return (
    <aside
      className={`bg-[#0B192C] border-r border-slate-800 text-slate-300 flex flex-col shrink-0 select-none transition-all duration-200 overflow-y-auto ${
        isCollapsed ? 'w-16' : 'w-72'
      }`}
      style={{ height: 'calc(100vh - 54px)' }}
    >
      <div className="p-3 space-y-1">
        {/* Dashboard */}
        <button
          onClick={() => onNavigate('/')}
          className={`w-full ${itemClass('/')}`}
          title="Corporate Operational Dashboard"
        >
          <LayoutDashboard className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="truncate">Dashboard</span>
        </button>

        {/* Item Section (Gated by ITEM_MASTER Module State) */}
        {isItemMasterEnabled && (
          <div>
            <button
              onClick={() => setItemsExpanded(!itemsExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Box className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Item</span>
              </div>
              {itemsExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
            </button>

            {itemsExpanded && (
              <div className="space-y-0.5 mt-0.5">
                <button
                  onClick={() => onNavigate('/items')}
                  className={`w-full ${itemClass('/items', true)}`}
                  title="Global Item Master"
                >
                  <Boxes className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">Global Item Master</span>
                </button>

                <button
                  onClick={() => onNavigate('/items/new')}
                  className={`w-full ${itemClass('/items/new', true)}`}
                  title="Create Item"
                >
                  <FilePlus2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Create Item</span>
                </button>

                <button
                  onClick={() => onNavigate('/items/custom-specifications')}
                  className={`w-full ${itemClass('/items/custom-specifications', true)}`}
                  title="Custom Specifications"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">Custom Specifications</span>
                </button>

                <button
                  onClick={() => onNavigate('/settings/item-code-rules')}
                  className={`w-full ${itemClass('/settings/item-code-rules', true)}`}
                  title="Item Code & Description"
                >
                  <Code2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Item Code & Description</span>
                </button>

                <button
                  onClick={() => onNavigate('/items/branch-availability')}
                  className={`w-full ${itemClass('/items/branch-availability', true)}`}
                  title="Branch Item Availability Matrix"
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">Branch Item Availability</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Business Partner Master Section (Gated by BUSINESS_PARTNER_MASTER Module State) */}
        {isBpMasterEnabled && (
          <div>
            <button
              onClick={() => onNavigate('/business-partners')}
              className={`w-full ${itemClass('/business-partners')}`}
              title="Business Partner Master"
            >
              <Users2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="truncate">Business Partner Master</span>
            </button>
          </div>
        )}

        {/* My Requests */}
        <button
          onClick={() => onNavigate('/requests')}
          className={`w-full ${itemClass('/requests')}`}
          title="My Requests & Draft Tracker"
        >
          <FileText className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="truncate">My Requests</span>
        </button>

        {/* Approval Inbox */}
        <button
          onClick={() => onNavigate('/approvals')}
          className={`w-full ${itemClass('/approvals')}`}
          title="Approval Inbox (Checker Review Queue)"
        >
          <Inbox className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate flex-1 text-left">Approval Inbox</span>
          <span className="bg-[#E85C0D] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
            1
          </span>
        </button>

        {/* Primary Communication & Notification Hub Section */}
        <div className="pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setCommHubExpanded(!commHubExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Megaphone className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="truncate text-purple-300 font-bold">Communication & Notification Hub</span>
            </div>
            {commHubExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
          </button>

          {commHubExpanded && (
            <div className="space-y-0.5 mt-0.5">
              <button
                onClick={() => onNavigate('/communication/overview')}
                className={`w-full ${itemClass('/communication/overview', true)}`}
              >
                <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">Hub Overview</span>
              </button>

              <button
                onClick={() => onNavigate('/communication/centre')}
                className={`w-full ${itemClass('/communication/centre', true)}`}
              >
                <Bell className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">Notification Centre / Inbox</span>
              </button>

              <button
                onClick={() => onNavigate('/communication/email-config')}
                className={`w-full ${itemClass('/communication/email-config', true)}`}
              >
                <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">Email Configuration</span>
              </button>

              <button
                onClick={() => onNavigate('/communication/email-templates')}
                className={`w-full ${itemClass('/communication/email-templates', true)}`}
              >
                <FileCode2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">Email Templates</span>
              </button>

              <button
                onClick={() => onNavigate('/communication/whatsapp-config')}
                className={`w-full ${itemClass('/communication/whatsapp-config', true)}`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">WhatsApp Configuration</span>
              </button>

              <button
                onClick={() => onNavigate('/communication/whatsapp-templates')}
                className={`w-full ${itemClass('/communication/whatsapp-templates', true)}`}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">WhatsApp Templates</span>
              </button>

              <button
                onClick={() => onNavigate('/communication/broadcasts')}
                className={`w-full ${itemClass('/communication/broadcasts', true)}`}
              >
                <Megaphone className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="truncate">Broadcast Campaigns</span>
              </button>

              <button
                onClick={() => onNavigate('/communication/rules')}
                className={`w-full ${itemClass('/communication/rules', true)}`}
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Notification Rules</span>
              </button>

              <button
                onClick={() => onNavigate('/communication/queue')}
                className={`w-full ${itemClass('/communication/queue', true)}`}
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">Delivery Queues</span>
              </button>

              <button
                onClick={() => onNavigate('/communication/webhooks')}
                className={`w-full ${itemClass('/communication/webhooks', true)}`}
              >
                <Server className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Webhooks & Provider Health</span>
              </button>

              <button
                onClick={() => onNavigate('/communication/consent')}
                className={`w-full ${itemClass('/communication/consent', true)}`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">Preferences & Consent</span>
              </button>

              <button
                onClick={() => onNavigate('/communication/reports')}
                className={`w-full ${itemClass('/communication/reports', true)}`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">Delivery Reports</span>
              </button>
            </div>
          )}
        </div>

        {/* Settings Hierarchical Section */}
        <div className="pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setSettingsExpanded(!settingsExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Settings</span>
            </div>
            {settingsExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
          </button>

          {settingsExpanded && (
            <div className="space-y-1 mt-0.5">
              {/* General Settings */}
              <button
                onClick={() => onNavigate('/settings/general')}
                className={`w-full ${itemClass('/settings/general', true)}`}
                title="Email-Based 2FA, System Security & Enterprise Configuration"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">General Settings</span>
              </button>

              {/* Module Management & Registry */}
              <button
                onClick={() => onNavigate('/settings/module-management')}
                className={`w-full ${itemClass('/settings/module-management', true)}`}
                title="Global Module Enable / Disable Management & Module Registry"
              >
                <Settings2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Module Management</span>
              </button>

              {/* Multi-Level Workflow Management */}
              <button
                onClick={() => onNavigate('/settings/approval-workflows')}
                className={`w-full ${itemClass('/settings/approval-workflows', true)}`}
                title="Multi-Level Approval Workflow Designer & Scope Rules"
              >
                <GitFork className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Approval Workflows</span>
              </button>

              {/* Item Configuration (Rules & Masters) */}
              <div>
                <button
                  onClick={() => setSettingsItemExpanded(!settingsItemExpanded)}
                  className="w-full flex items-center justify-between ml-5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-800/40 cursor-pointer"
                >
                  <span className="truncate">Item Configuration</span>
                  {settingsItemExpanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                </button>

                {settingsItemExpanded && (
                  <div className="ml-4 space-y-0.5">
                    <button
                      onClick={() => onNavigate('/settings/classifications')}
                      className={`w-full ${itemClass('/settings/classifications', true)}`}
                    >
                      <Layers className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">Classification Masters</span>
                    </button>
                    <button
                      onClick={() => onNavigate('/settings/item-code-rules')}
                      className={`w-full ${itemClass('/settings/item-code-rules', true)}`}
                    >
                      <Code2 className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">Item Code & Description</span>
                    </button>
                  </div>
                )}
              </div>

              {/* User Management */}
              <div>
                <button
                  onClick={() => setUserMgmtExpanded(!userMgmtExpanded)}
                  className="w-full flex items-center justify-between ml-5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-800/40 cursor-pointer"
                >
                  <span className="truncate">User Management</span>
                  {userMgmtExpanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                </button>

                {userMgmtExpanded && (
                  <div className="ml-4 space-y-0.5">
                    <button
                      onClick={() => onNavigate('/settings/organizations')}
                      className={`w-full ${itemClass('/settings/organizations', true)}`}
                    >
                      <Building className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">Organization & Branch Management</span>
                    </button>
                    <button
                      onClick={() => onNavigate('/settings/users-roles')}
                      className={`w-full ${itemClass('/settings/users-roles', true)}`}
                    >
                      <Users2 className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">User & Role Administration</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Logs */}
              <div>
                <button
                  onClick={() => setLogsExpanded(!logsExpanded)}
                  className="w-full flex items-center justify-between ml-5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-800/40 cursor-pointer"
                >
                  <span className="truncate">Logs & Governance</span>
                  {logsExpanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                </button>

                {logsExpanded && (
                  <div className="ml-4 space-y-0.5">
                    <button
                      onClick={() => onNavigate('/settings/rule-history')}
                      className={`w-full ${itemClass('/settings/rule-history', true)}`}
                    >
                      <History className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">Rule Version History</span>
                    </button>
                    <button
                      onClick={() => onNavigate('/settings/audit-logs')}
                      className={`w-full ${itemClass('/settings/audit-logs', true)}`}
                    >
                      <FileCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="truncate">Audit Logs</span>
                    </button>
                  </div>
                )}
              </div>

              {/* SAP Integration */}
              <div>
                <button
                  onClick={() => setIntegrationExpanded(!integrationExpanded)}
                  className="w-full flex items-center justify-between ml-5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-800/40 cursor-pointer"
                >
                  <span className="truncate text-amber-300 font-semibold">SAP Integration Management</span>
                  {integrationExpanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                </button>

                {integrationExpanded && (
                  <div className="ml-4 space-y-0.5">
                    <button
                      onClick={() => onNavigate('/integration/profiles')}
                      className={`w-full ${itemClass('/integration/profiles', true)}`}
                    >
                      <Cpu className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">Creation & Scheduling</span>
                    </button>
                    <button
                      onClick={() => onNavigate('/integration/testing')}
                      className={`w-full ${itemClass('/integration/testing', true)}`}
                    >
                      <PlayCircle className="w-3 h-3 text-blue-400 shrink-0" />
                      <span className="truncate">Integration Testing (20 Checks)</span>
                    </button>
                    <button
                      onClick={() => onNavigate('/integration/activate')}
                      className={`w-full ${itemClass('/integration/activate', true)}`}
                    >
                      <Power className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="truncate">Activate Integration</span>
                    </button>
                    <button
                      onClick={() => onNavigate('/integration/monitor')}
                      className={`w-full ${itemClass('/integration/monitor', true)}`}
                    >
                      <LayoutDashboard className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="truncate">Monitor & Recovery Queue</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Dashboard Layout Configuration */}
              <button
                onClick={() => onNavigate('/settings/dashboard-config')}
                className={`w-full ${itemClass('/settings/dashboard-config', true)}`}
                title="Config-Driven Dynamic Widgets, Chart Visualizers & Metric Governance"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">Dashboard Configuration</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
