import React, { useState } from 'react';
import { UserRole, ModuleRegistryItem } from '../types';
import {
  Search,
  Box,
  FilePlus2,
  Boxes,
  FileText,
  Inbox,
  Settings,
  Shield,
  Clock,
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
  Warehouse,
  LayoutGrid,
  Building2,
  RefreshCw,
  Wrench,
  Coins,
  UserCheck,
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
  const [searchQuery, setSearchQuery] = useState('');

  // Module Enabled Gates
  const isItemMasterEnabled = moduleRegistry
    ? moduleRegistry.find((m) => m.moduleKey === 'ITEM_MASTER')?.isEnabled ?? true
    : true;
  const isBpMasterEnabled = moduleRegistry
    ? moduleRegistry.find((m) => m.moduleKey === 'BUSINESS_PARTNER_MASTER')?.isEnabled ?? true
    : true;
  const isPrModuleEnabled = moduleRegistry
    ? moduleRegistry.find((m) => m.moduleKey === 'PURCHASE_REQUISITION')?.isEnabled ?? true
    : true;
  const isRfqModuleEnabled = moduleRegistry
    ? moduleRegistry.find((m) => m.moduleKey === 'RFQ_SOURCING')?.isEnabled ?? true
    : true;

  // Section Expansion States
  const [itemsExpanded, setItemsExpanded] = useState(true);
  const [rfqExpanded, setRfqExpanded] = useState(true);
  const [commHubExpanded, setCommHubExpanded] = useState(true);
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const [settingsItemExpanded, setSettingsItemExpanded] = useState(true);
  const [userMgmtExpanded, setUserMgmtExpanded] = useState(true);
  const [logsExpanded, setLogsExpanded] = useState(true);

  const isCurrent = (route: string) => currentRoute === route;

  const itemClass = (route: string, isNested = false) => `
    flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer select-none
    ${isNested ? 'ml-5 text-[11px]' : ''}
    ${
      isCurrent(route)
        ? 'bg-indigo-600 text-white font-semibold shadow-xs'
        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
    }
  `;

  // Search filter predicate
  const matchesSearch = (label: string) => {
    if (!searchQuery.trim()) return true;
    return label.toLowerCase().includes(searchQuery.toLowerCase().trim());
  };

  return (
    <aside
      className={`bg-[#0B192C] border-r border-slate-800 text-slate-300 flex flex-col shrink-0 select-none transition-all duration-200 overflow-y-auto ${
        isCollapsed ? 'w-16' : 'w-72'
      }`}
      style={{ height: 'calc(100vh - 54px)' }}
    >
      {/* Prominent Menu Search Field */}
      {!isCollapsed && (
        <div className="p-3 border-b border-slate-800/80 sticky top-0 bg-[#0B192C] z-10">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search authorized menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
            />
          </div>
        </div>
      )}

      <div className="p-3 space-y-1">
        {/* Item Section (Gated by ITEM_MASTER Module State) */}
        {isItemMasterEnabled && (
          <div>
            <button
              onClick={() => setItemsExpanded(!itemsExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Box className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Item Master & Governance</span>
              </div>
              {itemsExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
            </button>

            {itemsExpanded && (
              <div className="space-y-0.5 mt-0.5">
                {matchesSearch('Global Item Master') && (
                  <button onClick={() => onNavigate('/items')} className={`w-full ${itemClass('/items', true)}`}>
                    <Boxes className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">Global Item Master</span>
                  </button>
                )}

                {matchesSearch('Create Item') && (
                  <button onClick={() => onNavigate('/items/new')} className={`w-full ${itemClass('/items/new', true)}`}>
                    <FilePlus2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">Create Item</span>
                  </button>
                )}

                {matchesSearch('Custom Specifications') && (
                  <button onClick={() => onNavigate('/items/custom-specifications')} className={`w-full ${itemClass('/items/custom-specifications', true)}`}>
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">Custom Specifications</span>
                  </button>
                )}

                {matchesSearch('Item Code & Description') && (
                  <button onClick={() => onNavigate('/settings/item-code-rules')} className={`w-full ${itemClass('/settings/item-code-rules', true)}`}>
                    <Code2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">Item Code & Description</span>
                  </button>
                )}

                {matchesSearch('Branch Item Availability') && (
                  <button onClick={() => onNavigate('/items/branch-availability')} className={`w-full ${itemClass('/items/branch-availability', true)}`}>
                    <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate">Branch Item Availability</span>
                  </button>
                )}

                {matchesSearch('Branch-Created Items') && (
                  <button onClick={() => onNavigate('/items/branch-catalog')} className={`w-full ${itemClass('/items/branch-catalog', true)}`}>
                    <Box className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">Branch-Created Items</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Business Partner Master Section */}
        {isBpMasterEnabled && matchesSearch('Business Partner Master') && (
          <div>
            <button onClick={() => onNavigate('/business-partners')} className={`w-full ${itemClass('/business-partners')}`}>
              <Users2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="truncate">Business Partner Master</span>
            </button>
          </div>
        )}

        {/* My Requests */}
        {matchesSearch('My Requests') && (
          <button onClick={() => onNavigate('/requests')} className={`w-full ${itemClass('/requests')}`}>
            <FileText className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="truncate">My Requests</span>
          </button>
        )}

        {/* Purchase Requisitions & Buyer Management (Phase 1) */}
        {isPrModuleEnabled && (
          <div className="space-y-0.5">
            {matchesSearch('Purchase Requisitions') && (
              <button onClick={() => onNavigate('/purchasing/requisitions')} className={`w-full ${itemClass('/purchasing/requisitions')}`}>
                <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="truncate">Purchase Requisitions</span>
              </button>
            )}

            {matchesSearch('Buyer & Procurement Queue') && (
              <button onClick={() => onNavigate('/purchasing/buyer-management')} className={`w-full ${itemClass('/purchasing/buyer-management')}`}>
                <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">Buyer Workload & Queue</span>
              </button>
            )}
          </div>
        )}

        {/* Procurement & RFQ Sourcing Subsystem */}
        {isRfqModuleEnabled && (
          <div className="pt-2 border-t border-slate-800/80">
            <button
              onClick={() => setRfqExpanded(!rfqExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="truncate font-bold text-indigo-300">Procurement & Sourcing</span>
              </div>
              {rfqExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
            </button>

            {rfqExpanded && (
              <div className="space-y-0.5 mt-0.5">
                {/* 1. SOURCING SUBGROUP */}
                <div className="ml-2 pt-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-indigo-400" />
                    <span>Sourcing</span>
                  </div>

                  {matchesSearch('Purchase Request') && (
                    <button
                      onClick={() => onNavigate('/procurement/sourcing/purchase-requests')}
                      className={`w-full ${itemClass('/procurement/sourcing/purchase-requests', true)}`}
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">Purchase Request</span>
                    </button>
                  )}

                  {(matchesSearch('Future RFQ Floating') || matchesSearch('Sourcing Demand Pipeline')) && (
                    <button
                      onClick={() => onNavigate('/procurement/future-floating')}
                      className={`w-full ${itemClass('/procurement/future-floating', true)}`}
                    >
                      <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">Future RFQ Floating – Sourcing Demand Pipeline</span>
                    </button>
                  )}

                  {matchesSearch('RFQ') && (
                    <button
                      onClick={() => onNavigate('/procurement/rfq')}
                      className={`w-full ${itemClass('/procurement/rfq', true)}`}
                    >
                      <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="truncate">RFQ</span>
                    </button>
                  )}

                  {/* Accessible secondary actions if searched */}
                  {searchQuery.trim() && matchesSearch('Supplier Quotations') && (
                    <button onClick={() => onNavigate('/procurement/quotations')} className={`w-full ${itemClass('/procurement/quotations', true)}`}>
                      <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">Supplier Quotations</span>
                    </button>
                  )}

                  {searchQuery.trim() && matchesSearch('Comparative Statement') && (
                    <button onClick={() => onNavigate('/procurement/comparative-statement')} className={`w-full ${itemClass('/procurement/comparative-statement', true)}`}>
                      <BarChart3 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">Comparative Statement & Award</span>
                    </button>
                  )}
                </div>

                {/* 2. PRICE BOOKS SUBGROUP */}
                <div className="ml-2 pt-1 border-t border-slate-800/40">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                    <Warehouse className="w-3 h-3 text-teal-400" />
                    <span>Price Books</span>
                  </div>

                  {(matchesSearch('Approved Vendor Item Price Register') || matchesSearch('Price Register')) && (
                    <button
                      onClick={() => onNavigate('/procurement/price-register')}
                      className={`w-full ${itemClass('/procurement/price-register', true)}`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span className="truncate">Approved Vendor Item Price Register</span>
                    </button>
                  )}

                  {matchesSearch('Purchase Price Book') && (
                    <button
                      onClick={() => onNavigate('/procurement/price-book')}
                      className={`w-full ${itemClass('/procurement/price-book', true)}`}
                    >
                      <Warehouse className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">Purchase Price Book</span>
                    </button>
                  )}
                </div>

                {/* 3. ORDERS & GOVERNANCE SUBGROUP */}
                <div className="ml-2 pt-1 border-t border-slate-800/40">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                    <Box className="w-3 h-3 text-rose-400" />
                    <span>Orders & Governance</span>
                  </div>

                  {matchesSearch('Purchase Orders') && (
                    <button
                      onClick={() => onNavigate('/procurement/purchase-orders')}
                      className={`w-full ${itemClass('/procurement/purchase-orders', true)}`}
                    >
                      <Box className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="truncate">Purchase Orders & Allocations</span>
                    </button>
                  )}

                  {matchesSearch('Goods Receipt') && (
                    <button
                      onClick={() => onNavigate('/procurement/goods-receipt')}
                      className={`w-full ${itemClass('/procurement/goods-receipt', true)}`}
                    >
                      <FileCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">Goods Receipt & UOM</span>
                    </button>
                  )}

                  {matchesSearch('Procurement Dashboard') && (
                    <button
                      onClick={() => onNavigate('/procurement/dashboard')}
                      className={`w-full ${itemClass('/procurement/dashboard', true)}`}
                    >
                      <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">Procurement Dashboard</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Asset, Equipment & Maintenance Master */}
        {matchesSearch('Asset & Equipment Master') && (
          <button onClick={() => onNavigate('/assets-equipment')} className={`w-full ${itemClass('/assets-equipment')}`}>
            <Wrench className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">Asset & Equipment Master</span>
          </button>
        )}

        {/* Approval Inbox */}
        {matchesSearch('Approval Inbox') && (
          <button onClick={() => onNavigate('/approvals')} className={`w-full ${itemClass('/approvals')}`}>
            <Inbox className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate flex-1 text-left">Approval Inbox</span>
            <span className="bg-[#E85C0D] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              1
            </span>
          </button>
        )}

        {/* Primary Communication & Notification Hub */}
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
              {matchesSearch('Hub Overview') && (
                <button onClick={() => onNavigate('/communication/overview')} className={`w-full ${itemClass('/communication/overview', true)}`}>
                  <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">Hub Overview</span>
                </button>
              )}

              {matchesSearch('Notification Centre') && (
                <button onClick={() => onNavigate('/communication/centre')} className={`w-full ${itemClass('/communication/centre', true)}`}>
                  <Bell className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">Notification Centre</span>
                </button>
              )}

              {matchesSearch('Email Configuration') && (
                <button onClick={() => onNavigate('/communication/email-config')} className={`w-full ${itemClass('/communication/email-config', true)}`}>
                  <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">Email Configuration</span>
                </button>
              )}

              {matchesSearch('Email Templates') && (
                <button onClick={() => onNavigate('/communication/email-templates')} className={`w-full ${itemClass('/communication/email-templates', true)}`}>
                  <FileCode2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">Email Templates</span>
                </button>
              )}

              {matchesSearch('WhatsApp Configuration') && (
                <button onClick={() => onNavigate('/communication/whatsapp-config')} className={`w-full ${itemClass('/communication/whatsapp-config', true)}`}>
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">WhatsApp Configuration</span>
                </button>
              )}

              {matchesSearch('WhatsApp Templates') && (
                <button onClick={() => onNavigate('/communication/whatsapp-templates')} className={`w-full ${itemClass('/communication/whatsapp-templates', true)}`}>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">WhatsApp Templates</span>
                </button>
              )}

              {matchesSearch('Broadcast Campaigns') && (
                <button onClick={() => onNavigate('/communication/broadcasts')} className={`w-full ${itemClass('/communication/broadcasts', true)}`}>
                  <Megaphone className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">Broadcast Campaigns</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Governance & Settings Hierarchical Section */}
        <div className="pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setSettingsExpanded(!settingsExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Governance & System Settings</span>
            </div>
            {settingsExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
          </button>

          {settingsExpanded && (
            <div className="space-y-1 mt-0.5">
              {matchesSearch('General Settings') && (
                <button onClick={() => onNavigate('/settings/general')} className={`w-full ${itemClass('/settings/general', true)}`}>
                  <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">General Settings</span>
                </button>
              )}

              {(matchesSearch('API Providers') || matchesSearch('API Providers & Usage') || matchesSearch('Verification')) && (
                <button onClick={() => onNavigate('/settings/api-providers')} className={`w-full ${itemClass('/settings/api-providers', true)}`}>
                  <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">API Providers & Usage</span>
                </button>
              )}

              {matchesSearch('Module Management') && (
                <button onClick={() => onNavigate('/settings/module-management')} className={`w-full ${itemClass('/settings/module-management', true)}`}>
                  <Settings2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Module Management</span>
                </button>
              )}

              {matchesSearch('Approval Workflows') && (
                <button onClick={() => onNavigate('/settings/approval-workflows')} className={`w-full ${itemClass('/settings/approval-workflows', true)}`}>
                  <GitFork className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Approval Workflows</span>
                </button>
              )}



              {/* Organization Governance */}
              <div>
                <button
                  onClick={() => setUserMgmtExpanded(!userMgmtExpanded)}
                  className="w-full flex items-center justify-between ml-5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-800/40 cursor-pointer"
                >
                  <span className="truncate text-amber-300 font-semibold">Organization Governance</span>
                  {userMgmtExpanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                </button>

                {userMgmtExpanded && (
                  <div className="ml-4 space-y-0.5">
                    {matchesSearch('Organization & Branch') && (
                      <button onClick={() => onNavigate('/settings/organizations')} className={`w-full ${itemClass('/settings/organizations', true)}`}>
                        <Building className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="truncate">Organization & Branch</span>
                      </button>
                    )}

                    {matchesSearch('Purchase Organization') && (
                      <button onClick={() => onNavigate('/settings/purchase-org')} className={`w-full ${itemClass('/settings/purchase-org', true)}`}>
                        <Layers className="w-3 h-3 text-indigo-400 shrink-0" />
                        <span className="truncate">Purchase Organization</span>
                      </button>
                    )}

                    {matchesSearch('Field Configuration Rules') && (
                      <button onClick={() => onNavigate('/settings/field-configurations')} className={`w-full ${itemClass('/settings/field-configurations', true)}`}>
                        <Sliders className="w-3 h-3 text-purple-400 shrink-0" />
                        <span className="truncate">Field & Rule Configurations</span>
                      </button>
                    )}

                    {matchesSearch('User & Role Administration') && (
                      <button onClick={() => onNavigate('/settings/users-roles')} className={`w-full ${itemClass('/settings/users-roles', true)}`}>
                        <Users2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">User & Role Administration</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Logs */}
              <div>
                <button
                  onClick={() => setLogsExpanded(!logsExpanded)}
                  className="w-full flex items-center justify-between ml-5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-800/40 cursor-pointer"
                >
                  <span className="truncate">Logs & Audit</span>
                  {logsExpanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                </button>

                {logsExpanded && (
                  <div className="ml-4 space-y-0.5">
                    {matchesSearch('Rule Version History') && (
                      <button onClick={() => onNavigate('/settings/rule-history')} className={`w-full ${itemClass('/settings/rule-history', true)}`}>
                        <History className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">Rule Version History</span>
                      </button>
                    )}

                    {matchesSearch('Audit Logs') && (
                      <button onClick={() => onNavigate('/settings/audit-logs')} className={`w-full ${itemClass('/settings/audit-logs', true)}`}>
                        <FileCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate">Audit Logs</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
