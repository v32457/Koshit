/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * KOSH INNOVATIONS — MY KOSH INNOVATIONS GLOBAL IT SYSTEM
 * Item Master & Global Governance System (Module 00 - 05.05)
 */

import React, { useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { NavigationSidebar } from './components/NavigationSidebar';
import { PageAcceptanceBar } from './components/PageAcceptanceBar';
import { Stage0ReviewModal } from './components/Stage0ReviewModal';
import { PageAcceptanceRegisterModal } from './components/PageAcceptanceRegisterModal';

import {
  INITIAL_ORGANIZATION,
  INITIAL_BRANCHES,
  INITIAL_USERS,
  INITIAL_GLOBAL_ITEMS,
  INITIAL_PAGE_ACCEPTANCE_RECORDS,
  INITIAL_MODULE_REGISTRY,
} from './data/seedData';
import { GlobalItem, User, Branch, PageAcceptanceRecord, InPortalNotification, ModuleRegistryItem } from './types';

import { DashboardView } from './modules/dashboard/DashboardView';
import { ItemMasterListView } from './modules/items/ItemMasterListView';
import { ItemCreationView } from './modules/items/ItemCreationView';
import { CustomSpecificationsView } from './modules/items/CustomSpecificationsView';
import { BranchAvailabilityView } from './modules/items/BranchAvailabilityView';
import { ModuleManagementView } from './modules/settings/ModuleManagementView';
import { WorkflowManagementView } from './modules/settings/WorkflowManagementView';
import { BusinessPartnerMasterView } from './modules/businessPartners/BusinessPartnerMasterView';
import { ApprovalInboxView } from './modules/approvals/ApprovalInboxView';
import { MyRequestsView } from './modules/requests/MyRequestsView';
import { SapIntegrationView } from './modules/integration/SapIntegrationView';
import { RuleBuilderView } from './modules/settings/RuleBuilderView';
import { GeneralSettingsView } from './modules/settings/GeneralSettingsView';
import { ClassificationsView } from './modules/settings/ClassificationsView';
import { OrganizationsView } from './modules/settings/OrganizationsView';
import { AuditLogsView } from './modules/settings/AuditLogsView';
import { CommunicationHubView } from './modules/communication/CommunicationHubView';
import { WhatsAppHubView } from './modules/communication/WhatsAppHubView';
import { CommunicationOverviewView } from './modules/communication/CommunicationOverviewView';
import { NotificationCentreView } from './modules/communication/NotificationCentreView';
import { EmailConfigView } from './modules/communication/EmailConfigView';
import { EmailTemplatesView } from './modules/communication/EmailTemplatesView';
import { WhatsAppConfigView } from './modules/communication/WhatsAppConfigView';
import { WhatsAppTemplatesView } from './modules/communication/WhatsAppTemplatesView';
import { BroadcastCampaignsView } from './modules/communication/BroadcastCampaignsView';
import { NotificationRulesView } from './modules/communication/NotificationRulesView';
import { DeliveryQueuesView } from './modules/communication/DeliveryQueuesView';
import { WebhooksHealthView } from './modules/communication/WebhooksHealthView';
import { ConsentGovernanceView } from './modules/communication/ConsentGovernanceView';
import { CommunicationReportsView } from './modules/communication/CommunicationReportsView';
import { NotificationDrawer } from './components/NotificationDrawer';
import { INITIAL_IN_PORTAL_NOTIFICATIONS } from './data/communicationSeed';
import { LandingPageView } from './modules/public/LandingPageView';
import { LoginPageView } from './modules/public/LoginPageView';
import { PrivacyPolicyView, TermsOfServiceView } from './modules/public/PublicLegalViews';
import { NotFoundView } from './modules/public/NotFoundView';

export default function App() {
  // Authentication & Branch Context
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USERS[0]); // Platform Admin by default
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true); // Logged in by default
  const [redirectRoute, setRedirectRoute] = useState<string>('');

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    const target = redirectRoute && redirectRoute !== '/login' ? redirectRoute : '/dashboard';
    setCurrentRoute(target);
    setRedirectRoute('');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentRoute('/');
    setRedirectRoute('');
  };

  const [activeOrg] = useState(INITIAL_ORGANIZATION);
  const [activeBranch, setActiveBranch] = useState<Branch>(INITIAL_BRANCHES[0]); // Pondicherry HQ

  // Persistent Global Items State (Synchronizes to localStorage so created items survive page refresh)
  const [items, setItems] = useState<GlobalItem[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_global_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading items from localStorage:', err);
    }
    return INITIAL_GLOBAL_ITEMS;
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('kosh_global_items', JSON.stringify(items));
    } catch (err) {
      console.error('Error saving items to localStorage:', err);
    }
  }, [items]);

  // Persistent Module Registry State
  const [moduleRegistry, setModuleRegistry] = useState<ModuleRegistryItem[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_module_registry');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading module registry from localStorage:', err);
    }
    return INITIAL_MODULE_REGISTRY;
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('kosh_module_registry', JSON.stringify(moduleRegistry));
    } catch (err) {
      console.error('Error saving module registry to localStorage:', err);
    }
  }, [moduleRegistry]);

  const handleToggleModule = (moduleKey: string, isEnabled: boolean, reason: string) => {
    setModuleRegistry((prev) =>
      prev.map((m) =>
        m.moduleKey === moduleKey
          ? {
              ...m,
              isEnabled,
              changedAt: new Date().toISOString(),
              changedBy: currentUser.fullName,
              changeReason: reason,
              lifecycleStatus: isEnabled ? 'ENABLED' : 'DISABLED',
            }
          : m
      )
    );
  };

  const handleAddModule = (newModule: ModuleRegistryItem) => {
    setModuleRegistry((prev) => [...prev, newModule]);
  };

  const isItemMasterEnabled = moduleRegistry.find((m) => m.moduleKey === 'ITEM_MASTER')?.isEnabled ?? true;
  const isBpMasterEnabled = moduleRegistry.find((m) => m.moduleKey === 'BUSINESS_PARTNER_MASTER')?.isEnabled ?? true;

  // Navigation State
  const [currentRoute, setCurrentRoute] = useState<string>('/');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // Page Acceptance Register State
  const [acceptanceRecords, setAcceptanceRecords] = useState<PageAcceptanceRecord[]>(INITIAL_PAGE_ACCEPTANCE_RECORDS);
  const [stage0Status, setStage0Status] = useState<'PENDING_APPROVAL' | 'APPROVED' | 'CHANGES_REQUESTED'>('APPROVED');

  // Modals & Drawers
  const [isStage0ModalOpen, setIsStage0ModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState<InPortalNotification[]>(INITIAL_IN_PORTAL_NOTIFICATIONS);

  // Find active page record
  const currentRecord = acceptanceRecords.find((r) => r.route === currentRoute) || {
    key: 'P-01',
    route: '/',
    displayName: 'Corporate Dashboard',
    status: 'Pending Review',
  };

  const handleNavigate = (route: string) => {
    setCurrentRoute(route);
    setMobileSidebarOpen(false);
  };

  // Switch Branch
  const handleSwitchBranch = (branchId: string) => {
    const found = INITIAL_BRANCHES.find((b) => b.id === branchId);
    if (found) setActiveBranch(found);
  };

  // Switch User (for multi-role testing)
  const handleSwitchUser = (userId: string) => {
    const found = INITIAL_USERS.find((u) => u.id === userId);
    if (found) setCurrentUser(found);
  };

  // Page Acceptance actions
  const handleAcceptPage = (key: string) => {
    setAcceptanceRecords((prev) =>
      prev.map((r) =>
        r.key === key
          ? {
              ...r,
              status: 'Accepted',
              userDecision: 'Accept',
              decisionDate: new Date().toISOString(),
              acceptedVersion: 'v1.0.0',
            }
          : r
      )
    );
  };

  const handleRejectPage = (key: string, reason: string) => {
    setAcceptanceRecords((prev) =>
      prev.map((r) =>
        r.key === key
          ? {
              ...r,
              status: 'Changes Requested',
              userDecision: 'Reject',
              rejectionReason: reason,
              decisionDate: new Date().toISOString(),
            }
          : r
      )
    );
  };

  // Stage 0 approval actions
  const handleApproveStage0 = () => {
    setStage0Status('APPROVED');
    // Also mark Dashboard as in progress
    setAcceptanceRecords((prev) =>
      prev.map((r) => (r.key === 'P-01' ? { ...r, status: 'In Progress' } : r))
    );
  };

  const handleRequestStage0Changes = (feedback: string) => {
    setStage0Status('CHANGES_REQUESTED');
    alert(`Stage 0 Feedback recorded in audit register: "${feedback}". Gemini will adjust architecture specification.`);
  };

  // Item Actions
  const handleSaveDraft = (draftItem: Partial<GlobalItem>) => {
    const newItem: GlobalItem = {
      id: `item-${Date.now()}`,
      globalItemCode: draftItem.globalItemCode || `DRAFT-${Date.now()}`,
      isProvisionalCode: true,
      categoryCode: draftItem.categoryCode || 'RM',
      description: draftItem.description || 'Draft Description',
      status: 'DRAFT',
      attributes: draftItem.attributes || {},
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      codeRuleVersion: draftItem.codeRuleVersion || 1,
      descRuleVersion: draftItem.descRuleVersion || 1,
      approvalHistory: [
        {
          id: `appr-${Date.now()}`,
          action: 'SUBMIT',
          actorId: currentUser.id,
          actorName: currentUser.fullName,
          actorRole: currentUser.role,
          timestamp: new Date().toISOString(),
          remarks: 'Draft saved by creator',
          previousStatus: 'DRAFT',
          newStatus: 'DRAFT',
        },
      ],
      branchAvailability: [
        { branchId: activeBranch.id, isStocked: true, isPurchased: true, isManufactured: false, isActive: true },
      ],
    };

    setItems([newItem, ...items]);
    setCurrentRoute('/requests');
  };

  const handleSubmitForApproval = (subItem: Partial<GlobalItem>) => {
    const newItem: GlobalItem = {
      id: `item-${Date.now()}`,
      globalItemCode: subItem.globalItemCode || `KOSH-${Date.now()}`,
      isProvisionalCode: false,
      categoryCode: subItem.categoryCode || 'RM',
      description: subItem.description || 'Submitted Item Description',
      status: 'SUBMITTED',
      attributes: subItem.attributes || {},
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      codeRuleVersion: subItem.codeRuleVersion || 1,
      descRuleVersion: subItem.descRuleVersion || 1,
      approvalHistory: [
        {
          id: `appr-${Date.now()}`,
          action: 'SUBMIT',
          actorId: currentUser.id,
          actorName: currentUser.fullName,
          actorRole: currentUser.role,
          timestamp: new Date().toISOString(),
          remarks: 'Submitted for checker review and atomic sequence lock',
          previousStatus: 'DRAFT',
          newStatus: 'SUBMITTED',
        },
      ],
      branchAvailability: [
        { branchId: activeBranch.id, isStocked: true, isPurchased: true, isManufactured: false, isActive: true },
      ],
    };

    setItems([newItem, ...items]);
    setCurrentRoute('/items');
  };

  const handleApproveItem = (itemId: string, remarks: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          return {
            ...i,
            status: 'APPROVED',
            isProvisionalCode: false,
            updatedAt: new Date().toISOString(),
            approvalHistory: [
              ...i.approvalHistory,
              {
                id: `appr-${Date.now()}`,
                action: 'APPROVE',
                actorId: currentUser.id,
                actorName: currentUser.fullName,
                actorRole: currentUser.role,
                timestamp: new Date().toISOString(),
                remarks,
                previousStatus: i.status,
                newStatus: 'APPROVED',
              },
            ],
            sapSyncInfo: {
              companyDb: 'KOSH_PROD_HANA',
              syncStatus: 'PENDING',
            },
          };
        }
        return i;
      })
    );
  };

  const handleRejectItem = (itemId: string, remarks: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          return {
            ...i,
            status: 'REJECTED',
            updatedAt: new Date().toISOString(),
            approvalHistory: [
              ...i.approvalHistory,
              {
                id: `appr-${Date.now()}`,
                action: 'REJECT',
                actorId: currentUser.id,
                actorName: currentUser.fullName,
                actorRole: currentUser.role,
                timestamp: new Date().toISOString(),
                remarks,
                previousStatus: i.status,
                newStatus: 'REJECTED',
              },
            ],
          };
        }
        return i;
      })
    );
  };

  const handleReturnItem = (itemId: string, remarks: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          return {
            ...i,
            status: 'RETURNED_FOR_CORRECTION',
            updatedAt: new Date().toISOString(),
            approvalHistory: [
              ...i.approvalHistory,
              {
                id: `appr-${Date.now()}`,
                action: 'RETURN',
                actorId: currentUser.id,
                actorName: currentUser.fullName,
                actorRole: currentUser.role,
                timestamp: new Date().toISOString(),
                remarks,
                previousStatus: i.status,
                newStatus: 'RETURNED_FOR_CORRECTION',
              },
            ],
          };
        }
        return i;
      })
    );
  };

  // 1. Handle Public Standalone Routes
  if (currentRoute === '/login') {
    return (
      <LoginPageView
        onLoginSuccess={handleLoginSuccess}
        onNavigateHome={() => setCurrentRoute('/')}
        redirectRoute={redirectRoute}
      />
    );
  }

  if (currentRoute === '/privacy') {
    return (
      <PrivacyPolicyView
        onNavigateHome={() => setCurrentRoute('/')}
        onNavigateLogin={() => setCurrentRoute('/login')}
      />
    );
  }

  if (currentRoute === '/terms') {
    return (
      <TermsOfServiceView
        onNavigateHome={() => setCurrentRoute('/')}
        onNavigateLogin={() => setCurrentRoute('/login')}
      />
    );
  }

  if (currentRoute === '/' || currentRoute === '/landing' || currentRoute === '/support') {
    return (
      <LandingPageView
        isAuthenticated={isAuthenticated}
        onNavigateLogin={() => setCurrentRoute('/login')}
        onNavigateDashboard={() => setCurrentRoute('/dashboard')}
        onNavigateRoute={(r) => setCurrentRoute(r)}
      />
    );
  }

  // 2. Guard Protected Routes for Unauthenticated Users
  if (!isAuthenticated) {
    return (
      <LoginPageView
        onLoginSuccess={handleLoginSuccess}
        onNavigateHome={() => setCurrentRoute('/')}
        redirectRoute={currentRoute}
      />
    );
  }

  // 3. Authenticated Portal Shell & Workspace
  const isKnownRoute =
    currentRoute === '/dashboard' ||
    currentRoute.startsWith('/items') ||
    currentRoute === '/business-partners' ||
    currentRoute === '/requests' ||
    currentRoute === '/approvals' ||
    currentRoute.startsWith('/settings') ||
    currentRoute.startsWith('/communication') ||
    currentRoute.startsWith('/integration');

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans antialiased">
      {/* Corporate Header with Logout capability */}
      <AppHeader
        currentUser={currentUser}
        activeOrg={activeOrg}
        activeBranch={activeBranch}
        allBranches={INITIAL_BRANCHES}
        allUsers={INITIAL_USERS}
        onSwitchBranch={handleSwitchBranch}
        onSwitchUser={handleSwitchUser}
        onLogout={handleLogout}
        onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        notificationCount={notifications.filter((n) => !n.isRead).length}
        onOpenNotifications={() => setIsNotifDrawerOpen(true)}
      />

      {/* Main Portal Shell Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Navigation Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 lg:relative lg:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}>
          <NavigationSidebar
            currentRoute={currentRoute}
            onNavigate={handleNavigate}
            userRole={currentUser.role}
            moduleRegistry={moduleRegistry}
          />
        </div>

        {/* Dynamic Workspace Container */}
        <div className="flex-1 flex flex-col overflow-y-auto w-full">
          {/* Main View Area */}
          <main className="p-4 md:p-6 max-w-7xl w-full mx-auto flex-1">
            {!isKnownRoute ? (
              <NotFoundView
                onNavigateHome={() => setCurrentRoute('/')}
                onNavigateDashboard={() => setCurrentRoute('/dashboard')}
                isAuthenticated={isAuthenticated}
              />
            ) : (
              <>
                {currentRoute === '/dashboard' && (
                  <DashboardView
                    items={items}
                    activeBranch={activeBranch}
                    onNavigate={(route) => setCurrentRoute(route)}
                    onOpenStage0Modal={() => setIsStage0ModalOpen(true)}
                  />
                )}

                {/* Module Management & Registry Page */}
                {currentRoute === '/settings/module-management' && (
                  <ModuleManagementView
                    currentUser={currentUser}
                    moduleRegistry={moduleRegistry}
                    onToggleModule={handleToggleModule}
                    onAddModule={handleAddModule}
                  />
                )}

                {/* Workflow Management Area */}
                {currentRoute === '/settings/approval-workflows' && (
                  <WorkflowManagementView currentUser={currentUser} />
                )}

                {/* Business Partner Master Route */}
                {currentRoute === '/business-partners' && (
                  isBpMasterEnabled ? (
                    <BusinessPartnerMasterView currentUser={currentUser} />
                  ) : (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-900 space-y-2 text-xs">
                      <h3 className="font-bold text-sm text-rose-800 flex items-center gap-2">
                        <span>⚠️ Business Partner Master Module is Currently Disabled</span>
                      </h3>
                      <p>Access to Business Partner Master features, APIs, and SAP synchronization has been disabled by a system administrator in Module Management.</p>
                    </div>
                  )
                )}

                {/* Item Master Routes (Gated by ITEM_MASTER Module State) */}
                {currentRoute.startsWith('/items') && (!isItemMasterEnabled ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-900 space-y-2 text-xs">
                    <h3 className="font-bold text-sm text-rose-800 flex items-center gap-2">
                      <span>⚠️ Item Master Module is Currently Disabled</span>
                    </h3>
                    <p>Access to Global Item Master, Create Item, Custom Specifications, and Item Code Rules has been disabled by a system administrator in Module Management.</p>
                  </div>
                ) : (
                  <>
                    {currentRoute === '/items' && (
                      <ItemMasterListView
                        items={items}
                        allBranches={INITIAL_BRANCHES}
                        onNavigateNew={() => setCurrentRoute('/items/new')}
                        onNavigateCustomSpecs={() => setCurrentRoute('/items/custom-specifications')}
                        onImportItems={(newItems) => setItems((prev) => [...newItems, ...prev])}
                      />
                    )}

                    {currentRoute === '/items/custom-specifications' && (
                      <CustomSpecificationsView
                        currentUser={currentUser}
                        globalItems={items}
                      />
                    )}

                    {currentRoute === '/items/new' && (
                      <ItemCreationView
                        currentUser={currentUser}
                        globalItems={items}
                        onSaveDraft={handleSaveDraft}
                        onSubmitForApproval={handleSubmitForApproval}
                        onCancel={() => setCurrentRoute('/items')}
                      />
                    )}

                    {currentRoute === '/items/branch-availability' && (
                      <BranchAvailabilityView
                        items={items}
                        allBranches={INITIAL_BRANCHES}
                      />
                    )}
                  </>
                ))}

                {currentRoute === '/requests' && (
                  <MyRequestsView
                    items={items}
                    currentUser={currentUser}
                    onNavigateNew={() => setCurrentRoute('/items/new')}
                  />
                )}

                {currentRoute === '/approvals' && (
                  <ApprovalInboxView
                    items={items}
                    currentUser={currentUser}
                    onApproveItem={handleApproveItem}
                    onRejectItem={handleRejectItem}
                    onReturnItem={handleReturnItem}
                  />
                )}

                {currentRoute === '/settings/general' && <GeneralSettingsView />}

                {(currentRoute === '/settings/item-code-rules' || currentRoute === '/settings/item-description-rules') && (
                  <RuleBuilderView />
                )}

                {currentRoute === '/settings/classifications' && <ClassificationsView />}

                {currentRoute === '/settings/organizations' && <OrganizationsView />}

                {currentRoute === '/settings/audit-logs' && <AuditLogsView />}

                {currentRoute === '/settings/dashboard-config' && (
                  <DashboardView
                    items={items}
                    activeBranch={activeBranch}
                    onNavigate={(route) => setCurrentRoute(route)}
                    onOpenStage0Modal={() => setIsStage0ModalOpen(true)}
                  />
                )}

                {/* Communication & Notification Hub Routes */}
                {(currentRoute === '/communication' || currentRoute === '/communication/overview') && (
                  <CommunicationOverviewView onNavigate={(route) => setCurrentRoute(route)} />
                )}

                {currentRoute === '/communication/hub' && (
                  <CommunicationHubView
                    currentUser={currentUser}
                    onNavigateWhatsApp={() => setCurrentRoute('/communication/whatsapp')}
                  />
                )}

                {currentRoute === '/communication/centre' && (
                  <NotificationCentreView
                    currentUser={currentUser}
                    onNavigate={(route) => setCurrentRoute(route)}
                  />
                )}

                {currentRoute === '/communication/email-config' && (
                  <EmailConfigView />
                )}

                {currentRoute === '/communication/email-templates' && (
                  <EmailTemplatesView />
                )}

                {currentRoute === '/communication/whatsapp' && (
                  <WhatsAppHubView currentUser={currentUser} />
                )}

                {currentRoute === '/communication/whatsapp-config' && (
                  <WhatsAppConfigView />
                )}

                {currentRoute === '/communication/whatsapp-templates' && (
                  <WhatsAppTemplatesView />
                )}

                {currentRoute === '/communication/broadcasts' && (
                  <BroadcastCampaignsView />
                )}

                {currentRoute === '/communication/rules' && (
                  <NotificationRulesView />
                )}

                {currentRoute === '/communication/queue' && (
                  <DeliveryQueuesView />
                )}

                {currentRoute === '/communication/webhooks' && (
                  <WebhooksHealthView />
                )}

                {currentRoute === '/communication/consent' && (
                  <ConsentGovernanceView />
                )}

                {currentRoute === '/communication/reports' && (
                  <CommunicationReportsView />
                )}

                {currentRoute.startsWith('/integration') && (
                  <SapIntegrationView
                    currentUser={currentUser}
                    activeTab={
                      currentRoute === '/integration/testing'
                        ? 'testing'
                        : currentRoute === '/integration/activate'
                        ? 'activate'
                        : currentRoute === '/integration/monitor'
                        ? 'monitor'
                        : 'profiles'
                    }
                  />
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Interactive In-Portal Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotifDrawerOpen}
        onClose={() => setIsNotifDrawerOpen(false)}
        notifications={notifications}
        onMarkAsRead={(id) =>
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
          )
        }
        onMarkAllAsRead={() =>
          setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
        }
        onNavigate={(route) => setCurrentRoute(route)}
      />
    </div>
  );
}
