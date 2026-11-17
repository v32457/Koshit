/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * KOSH INNOVATIONS — MY KOSH INNOVATIONS GLOBAL IT SYSTEM
 * Item Master & Global Governance System (Module 00 - 05.05)
 */

import React, { useState } from 'react';
import {
  OperatingContext,
  restoreOperatingContext,
  switchCompanyContext,
  switchBranchContext,
} from './services/operatingContextService';
import { AppHeader } from './components/AppHeader';
import { NavigationSidebar } from './components/NavigationSidebar';
import { PageAcceptanceBar } from './components/PageAcceptanceBar';
import { Stage0ReviewModal } from './components/Stage0ReviewModal';
import { PageAcceptanceRegisterModal } from './components/PageAcceptanceRegisterModal';
import { ZeroTrustWorkspaceRuntime } from './components/security/ZeroTrustWorkspaceRuntime';

import {
  INITIAL_ORGANIZATION,
  INITIAL_BRANCHES,
  INITIAL_USERS,
  INITIAL_GLOBAL_ITEMS,
  INITIAL_PAGE_ACCEPTANCE_RECORDS,
  INITIAL_MODULE_REGISTRY,
  INITIAL_COMPANIES,
} from './data/seedData';
import { GlobalItem, User, Branch, PageAcceptanceRecord, InPortalNotification, ModuleRegistryItem, Company } from './types';

import { DashboardView } from './modules/dashboard/DashboardView';
import { ItemMasterListView } from './modules/items/ItemMasterListView';
import { ItemCreationView } from './modules/items/ItemCreationView';
import { CustomSpecificationsView } from './modules/items/CustomSpecificationsView';
import { BranchAvailabilityView } from './modules/items/BranchAvailabilityView';
import { BranchCreatedItemsView } from './modules/items/BranchCreatedItemsView';
import { ModuleManagementView } from './modules/settings/ModuleManagementView';
import { UserRoleAdministrationView } from './modules/settings/UserRoleAdministrationView';
import { MyContactConsentView } from './modules/settings/userRoleAdmin/MyContactConsentView';
import { WorkflowManagementView } from './modules/settings/WorkflowManagementView';
import { userRoleAdminService } from './services/userRoleAdminService';
import { BusinessPartnerMasterView } from './modules/businessPartners/BusinessPartnerMasterView';
import { ApprovalInboxView } from './modules/approvals/ApprovalInboxView';
import { MyRequestsView } from './modules/requests/MyRequestsView';
import { PurchaseRequisitionListView } from './modules/requests/PurchaseRequisitionListView';
import { PurchaseCreationModal } from './modules/requests/PurchaseCreationModal';
import { PurchaseRequisitionDetailsModal } from './modules/requests/PurchaseRequisitionDetailsModal';
import { PRBulkCleanupView } from './modules/requests/PRBulkCleanupView';
import { PurchaseRequisitionHeader } from './types/purchaseRequisition';
import { SapIntegrationView } from './modules/integration/SapIntegrationView';
import { RuleBuilderView } from './modules/settings/RuleBuilderView';
import { GeneralSettingsView } from './modules/settings/GeneralSettingsView';
import { ApiProvidersView } from './modules/settings/ApiProvidersView';
import { AgingParameterMasterView } from './modules/settings/AgingParameterMasterView';
import { ClassificationsView } from './modules/settings/ClassificationsView';
import { OrganizationsView } from './modules/settings/OrganizationsView';
import { WarehouseSetupView } from './modules/settings/WarehouseSetupView';
import { FieldConfigurationsView } from './modules/settings/FieldConfigurationsView';
import { PrTypeMasterPanel } from './modules/settings/PrTypeMasterPanel';
import { FinanceBudgetView } from './modules/finance/FinanceBudgetView';
import { WorkdayCalendarSuiteView } from './modules/calendar/WorkdayCalendarSuiteView';
import { AssetEquipmentView } from './modules/assets/AssetEquipmentView';
import { BuyerManagementView } from './modules/procurement/BuyerManagementView';
import { ProcurementDashboardView } from './modules/procurement/ProcurementDashboardView';
import { RfqPolicyView } from './modules/procurement/RfqPolicyView';
import { FutureRfqFloatingView } from './modules/procurement/FutureRfqFloatingView';
import { RfqManagementView } from './modules/procurement/RfqManagementView';
import { SupplierQuotationsView } from './modules/procurement/SupplierQuotationsView';
import { ComparativeStatementView } from './modules/procurement/ComparativeStatementView';
import { VendorPriceRegisterView } from './modules/procurement/VendorPriceRegisterView';
import { PurchasePriceBookView } from './modules/procurement/PurchasePriceBookView';
import { PurchaseOrderManagementView } from './modules/procurement/PurchaseOrderManagementView';
import { GoodsReceiptView } from './modules/procurement/GoodsReceiptView';
import { ChargeManagementView } from './modules/procurement/ChargeManagementView';
import { ProcurementReportsView } from './modules/procurement/ProcurementReportsView';
import { LocalLlmManagementView } from './modules/llm/LocalLlmManagementView';
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
  const [users, setUsers] = useState<User[]>(() => userRoleAdminService.getUsers());
  const [currentUser, setCurrentUser] = useState<User>(() => userRoleAdminService.getUsers()[0] || INITIAL_USERS[0]);
  const [activeSessionTokenId, setActiveSessionTokenId] = useState<string | undefined>(undefined);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true); // Logged in by default
  const [redirectRoute, setRedirectRoute] = useState<string>('');

  const handleLoginSuccess = (user: User, sessionTokenId?: string) => {
    setCurrentUser(user);
    setActiveSessionTokenId(sessionTokenId);
    setIsAuthenticated(true);
    const target = redirectRoute && redirectRoute !== '/login' ? redirectRoute : '/dashboard';
    setCurrentRoute(target);
    setRedirectRoute('');
  };

  const handleLogout = () => {
    if (activeSessionTokenId) {
      try {
        userRoleAdminService.forceLogoutSession(
          activeSessionTokenId,
          'User signed out',
          { id: currentUser.id, name: currentUser.fullName }
        );
      } catch (err) {
        console.error('Session revocation on logout:', err);
      }
    }
    setActiveSessionTokenId(undefined);
    setIsAuthenticated(false);
    setCurrentRoute('/');
    setRedirectRoute('');
  };

  const [activeOrg] = useState(INITIAL_ORGANIZATION);
  const [companies, setCompanies] = useState<Company[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_companies');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c: Company) => {
            const ref = INITIAL_COMPANIES.find((ic) => ic.id === c.id || ic.code === c.code);
            return {
              ...c,
              cinNumber: c.cinNumber || ref?.cinNumber,
              msmeInfo: c.msmeInfo || ref?.msmeInfo,
            };
          });
        }
      }
    } catch (err) {
      console.error('Error loading companies from localStorage:', err);
    }
    return INITIAL_COMPANIES;
  });

  const [branches, setBranches] = useState<Branch[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_branches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((b: Branch) => {
            if (b.companyId) return b;
            const ref = INITIAL_BRANCHES.find((ib) => ib.id === b.id || ib.portalBranchCode === b.portalBranchCode);
            return {
              ...b,
              companyId: ref?.companyId || (b.state === 'Tamil Nadu' ? 'co-kosh-02' : b.state === 'Gujarat' ? 'co-kosh-03' : b.state === 'Uttarakhand' ? 'co-kosh-04' : 'co-kosh-01'),
            };
          });
        }
      }
    } catch (err) {
      console.error('Error loading branches from localStorage:', err);
    }
    return INITIAL_BRANCHES;
  });

  const [operatingContext, setOperatingContext] = useState<OperatingContext>(() =>
    restoreOperatingContext(currentUser, companies, branches)
  );

  const activeCompany = operatingContext.activeCompany;
  const activeBranch = operatingContext.activeBranch;

  React.useEffect(() => {
    try {
      localStorage.setItem('kosh_companies', JSON.stringify(companies));
    } catch (err) {
      console.error('Error saving companies to localStorage:', err);
    }
  }, [companies]);

  React.useEffect(() => {
    try {
      localStorage.setItem('kosh_branches', JSON.stringify(branches));
    } catch (err) {
      console.error('Error saving branches to localStorage:', err);
    }
  }, [branches]);

  const handleSwitchCompany = (companyId: string) => {
    try {
      const updatedCtx = switchCompanyContext(companyId, currentUser, companies, branches);
      setOperatingContext(updatedCtx);
    } catch (err: any) {
      alert(`Company Context Switch Error: ${err.message}`);
    }
  };

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
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingKeys = new Set(parsed.map((m: any) => m.moduleKey));
          const missing = INITIAL_MODULE_REGISTRY.filter((m) => !existingKeys.has(m.moduleKey));
          return [...parsed, ...missing];
        }
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
  const isPrModuleEnabled = moduleRegistry.find((m) => m.moduleKey === 'PURCHASE_REQUISITION')?.isEnabled ?? true;

  // Navigation State (Initializes from URL pathname if a deep route is opened, otherwise defaults to '/purchasing/requisitions' or '/')
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryRoute = params.get('route');
      if (queryRoute) return queryRoute;
      const path = window.location.pathname;
      if (path && path !== '/' && path !== '/index.html') return path;
    }
    return '/purchasing/requisitions';
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768 && window.innerWidth < 1024;
    }
    return false;
  });

  // Automatically adapt sidebar collapse when rotating between tablet portrait, tablet landscape, and desktop
  React.useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w >= 768) {
        setMobileSidebarOpen(false);
      }
      if (w >= 768 && w < 960) {
        setSidebarCollapsed(true);
      } else if (w >= 1280) {
        setSidebarCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Page Acceptance Register State
  const [acceptanceRecords, setAcceptanceRecords] = useState<PageAcceptanceRecord[]>(INITIAL_PAGE_ACCEPTANCE_RECORDS);
  const [stage0Status, setStage0Status] = useState<'PENDING_APPROVAL' | 'APPROVED' | 'CHANGES_REQUESTED'>('APPROVED');

  // Modals & Drawers
  const [isStage0ModalOpen, setIsStage0ModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState<InPortalNotification[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_in_portal_notifications_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fall through
    }
    return INITIAL_IN_PORTAL_NOTIFICATIONS;
  });

  React.useEffect(() => {
    const syncUsers = () => {
      const latest = userRoleAdminService.getUsers();
      setUsers(latest);
      setCurrentUser((prev) => latest.find((u) => u.id === prev.id) || prev);
    };
    const syncNotifs = () => {
      try {
        const raw = localStorage.getItem('kosh_in_portal_notifications_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setNotifications(parsed);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('cip:users-updated', syncUsers);
    window.addEventListener('cip:notifications-updated', syncNotifs);
    return () => {
      window.removeEventListener('cip:users-updated', syncUsers);
      window.removeEventListener('cip:notifications-updated', syncNotifs);
    };
  }, []);
  const [activePrSessions, setActivePrSessions] = useState<string[]>([]);
  const [selectedPrDetails, setSelectedPrDetails] = useState<PurchaseRequisitionHeader | null>(null);

  const openNewPrSession = () => setActivePrSessions(prev => [...prev, `session-${Date.now()}`]);
  const closePrSession = (sessionId: string) => setActivePrSessions(prev => prev.filter(s => s !== sessionId));

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
    try {
      const updatedCtx = switchBranchContext(
        branchId,
        operatingContext.activeCompanyId,
        currentUser,
        companies,
        branches
      );
      setOperatingContext(updatedCtx);
    } catch (err: any) {
      alert(`Branch Context Switch Error: ${err.message}`);
    }
  };

  // Switch User (for multi-role testing)
  const handleSwitchUser = (userId: string) => {
    const found = users.find((u) => u.id === userId) || userRoleAdminService.getUserById(userId);
    if (found) {
      setCurrentUser(found);
      const updatedCtx = restoreOperatingContext(found, companies, branches);
      setOperatingContext(updatedCtx);
    }
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
      branchAvailability: branches.map((b: Branch) => ({
        branchId: b.id,
        isStocked: true,
        isPurchased: true,
        isManufactured: draftItem.categoryCode === 'FG',
        isActive: true,
      })),
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
      branchAvailability: branches.map((b: Branch) => ({
        branchId: b.id,
        isStocked: true,
        isPurchased: true,
        isManufactured: subItem.categoryCode === 'FG',
        isActive: true,
      })),
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
    currentRoute.startsWith('/purchasing') ||
    currentRoute.startsWith('/procurement') ||
    currentRoute === '/assets-equipment' ||
    currentRoute === '/approvals' ||
    currentRoute.startsWith('/settings') ||
    currentRoute.startsWith('/calendar') ||
    currentRoute.startsWith('/communication') ||
    currentRoute.startsWith('/integration');

  return (
    <div className="min-h-screen w-full max-w-full bg-[#F8FAFC] text-slate-800 flex flex-col font-sans antialiased overflow-x-hidden">
      {/* Corporate Header with Logout & Responsive Navigation Controls */}
      <AppHeader
        currentUser={currentUser}
        activeOrg={activeOrg}
        activeCompany={activeCompany}
        allCompanies={companies}
        activeBranch={activeBranch}
        allBranches={branches}
        allUsers={users}
        onSwitchCompany={handleSwitchCompany}
        onSwitchBranch={handleSwitchBranch}
        onSwitchUser={handleSwitchUser}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        isSidebarCollapsed={sidebarCollapsed}
        onToggleSidebarCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        notificationCount={notifications.filter((n) => !n.isRead).length}
        onOpenNotifications={() => setIsNotifDrawerOpen(true)}
      />

      {/* Main Portal Shell Layout — Full-Width Enterprise Workspace */}
      <div className="app-layout flex-1 flex overflow-hidden relative w-full max-w-full">
        {/* Mobile Sidebar Drawer Backdrop (< 768px) */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Navigation Sidebar: Mobile Drawer (< 768px) | Collapsible Sidebar on Tablet & Desktop (>= 768px) */}
        <div
          className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 md:relative md:translate-x-0 ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <NavigationSidebar
            currentRoute={currentRoute}
            onNavigate={handleNavigate}
            userRole={currentUser.role}
            moduleRegistry={moduleRegistry}
            isCollapsed={!mobileSidebarOpen && sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            onCloseMobile={mobileSidebarOpen ? () => setMobileSidebarOpen(false) : undefined}
          />
        </div>

        {/* Dynamic Full-Width Workspace Container wrapped by Zero-Trust Visual & Session Runtime */}
        <ZeroTrustWorkspaceRuntime
          currentUser={currentUser}
          activeCompany={activeCompany}
          activeBranch={activeBranch}
          users={users}
          companies={companies}
          branches={branches}
          moduleRegistry={moduleRegistry}
          currentRoute={currentRoute}
          onLogout={handleLogout}
        >
        <div className="main-workspace flex-1 flex flex-col overflow-y-auto overflow-x-hidden w-full min-w-0 max-w-none">
          {/* Main View Area — 100% Full Width with Consistent 12-20px Gutter */}
          <main className="page-container p-3 sm:p-4 lg:p-5 w-full max-w-none min-w-0 m-0 flex-1">
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
                    currentUser={currentUser}
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
                    onNavigate={(route) => setCurrentRoute(route)}
                  />
                )}

                {/* Centralized User & Role Administration */}
                {currentRoute === '/settings/users-roles' && (
                  <UserRoleAdministrationView
                    currentUser={currentUser}
                    activeCompany={activeCompany}
                    activeBranch={activeBranch}
                    companies={companies}
                    branches={branches}
                    onNavigate={handleNavigate}
                  />
                )}

                {currentRoute === '/settings/my-contact-consent' && (
                  <MyContactConsentView
                    currentUser={currentUser}
                    onUserUpdated={() => {
                      const latest = userRoleAdminService.getUsers();
                      setUsers(latest);
                      setCurrentUser((prev) => latest.find((u) => u.id === prev.id) || prev);
                    }}
                  />
                )}

                {/* Workflow Management Area */}
                {currentRoute === '/settings/approval-workflows' && (
                  <WorkflowManagementView currentUser={currentUser} />
                )}

                {/* Business Partner Master Route */}
                {currentRoute === '/business-partners' && (
                  isBpMasterEnabled ? (
                    <BusinessPartnerMasterView currentUser={currentUser} operatingContext={operatingContext} />
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
                        allBranches={branches}
                        currentUser={currentUser}
                        onNavigateNew={() => setCurrentRoute('/items/new')}
                        onNavigateCustomSpecs={() => setCurrentRoute('/items/custom-specifications')}
                        onNavigate={(route) => setCurrentRoute(route)}
                        onUpdateItems={setItems}
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
                        operatingContext={operatingContext}
                        globalItems={items}
                        onSaveDraft={handleSaveDraft}
                        onSubmitForApproval={handleSubmitForApproval}
                        onCancel={() => setCurrentRoute('/items')}
                      />
                    )}

                    {currentRoute === '/items/branch-availability' && (
                      <BranchAvailabilityView
                        items={items}
                        allBranches={branches}
                        currentUser={currentUser}
                        onUpdateItems={setItems}
                      />
                    )}

                    {currentRoute === '/items/branch-catalog' && (
                      <BranchCreatedItemsView
                        items={items}
                        allBranches={branches}
                        currentUser={currentUser}
                        onNavigate={(route) => setCurrentRoute(route)}
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

                {currentRoute.startsWith('/purchasing') && (
                  isPrModuleEnabled ? (
                    currentRoute === '/purchasing/requisitions' || currentRoute === '/procurement/sourcing/purchase-requests' ? (
                      <PurchaseRequisitionListView
                        currentUser={currentUser}
                        onOpenCreateModal={openNewPrSession}
                        onOpenDetailsModal={(pr) => setSelectedPrDetails(pr)}
                        onOpenCleanupView={() => setCurrentRoute('/purchasing/requisitions/cleanup')}
                      />
                    ) : currentRoute === '/purchasing/buyer-management' ? (
                      <BuyerManagementView currentUser={currentUser} />
                    ) : (
                      <PRBulkCleanupView
                        currentUser={currentUser}
                        onBack={() => setCurrentRoute('/purchasing/requisitions')}
                      />
                    )
                  ) : (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-900 space-y-2 text-xs">
                      <h3 className="font-bold text-sm text-rose-800 flex items-center gap-2">
                        <span>⚠️ Purchase Requisition Module is Currently Disabled</span>
                      </h3>
                      <p>Access to Purchase Requisitions, MRP imports, budget checks, and approval workflows has been disabled by a system administrator in Module Management.</p>
                    </div>
                  )
                )}

                {currentRoute.startsWith('/procurement') && (
                  currentRoute === '/procurement/sourcing/purchase-requests' ? (
                    <PurchaseRequisitionListView
                      currentUser={currentUser}
                      onOpenCreateModal={openNewPrSession}
                      onOpenDetailsModal={(pr) => setSelectedPrDetails(pr)}
                      onOpenCleanupView={() => setCurrentRoute('/purchasing/requisitions/cleanup')}
                    />
                  ) : currentRoute === '/procurement/dashboard' ? (
                    <ProcurementDashboardView currentUser={currentUser} onNavigate={(r) => setCurrentRoute(r)} />
                  ) : currentRoute === '/procurement/rfq-policy' ? (
                    <GeneralSettingsView initialTab="rfq-module" view="full" onNavigate={handleNavigate} currentUser={currentUser} />
                  ) : (currentRoute === '/procurement/future-floating' || currentRoute === '/procurement/market-benchmark') ? (
                    <FutureRfqFloatingView currentUser={currentUser} companies={companies} branches={branches} onNavigate={(r) => setCurrentRoute(r)} />
                  ) : (currentRoute === '/procurement/rfq' || currentRoute === '/procurement/rfqs') ? (
                    <RfqManagementView currentUser={currentUser} companies={companies} branches={branches} onNavigate={(r) => setCurrentRoute(r)} />
                  ) : currentRoute === '/procurement/quotations' ? (
                    <SupplierQuotationsView currentUser={currentUser} />
                  ) : currentRoute === '/procurement/comparative-statement' ? (
                    <ComparativeStatementView currentUser={currentUser} onNavigate={(r) => setCurrentRoute(r)} />
                  ) : currentRoute === '/procurement/price-register' ? (
                    <VendorPriceRegisterView />
                  ) : currentRoute === '/procurement/price-book' ? (
                    <PurchasePriceBookView />
                  ) : currentRoute === '/procurement/purchase-orders' ? (
                    <PurchaseOrderManagementView currentUser={currentUser} companies={companies} branches={branches} />
                  ) : currentRoute === '/procurement/goods-receipt' ? (
                    <GoodsReceiptView currentUser={currentUser} companies={companies} branches={branches} />
                  ) : currentRoute === '/procurement/charges' ? (
                    <ChargeManagementView currentUser={currentUser} onNavigate={handleNavigate} />
                  ) : (
                    <ProcurementReportsView currentUser={currentUser} />
                  )
                )}

                {currentRoute === '/settings/local-llm' && (
                  <LocalLlmManagementView currentUser={currentUser} />
                )}

                {currentRoute === '/assets-equipment' && (
                  <AssetEquipmentView />
                )}

                {currentRoute === '/settings/general' && (
                  <GeneralSettingsView onNavigate={handleNavigate} currentUser={currentUser} />
                )}

                {currentRoute === '/settings/general/pr' && (
                  <GeneralSettingsView initialTab="pr-module" view="full" onNavigate={handleNavigate} currentUser={currentUser} />
                )}
                {currentRoute === '/settings/general/pr-type-master' && (
                  <GeneralSettingsView initialTab="pr-type-master" view="full" onNavigate={handleNavigate} currentUser={currentUser} />
                )}
                {currentRoute === '/settings/pr-type-master' && (
                  <PrTypeMasterPanel currentUser={currentUser} companies={companies} branches={branches} />
                )}
                {currentRoute === '/settings/general/items' && (
                  <GeneralSettingsView initialTab="item-module" view="full" onNavigate={handleNavigate} currentUser={currentUser} />
                )}
                {currentRoute === '/settings/general/aging' && (
                  <GeneralSettingsView initialTab="aging-module" view="full" onNavigate={handleNavigate} currentUser={currentUser} />
                )}
                {currentRoute === '/settings/general/budget' && (
                  <GeneralSettingsView initialTab="finance-module" view="full" onNavigate={handleNavigate} currentUser={currentUser} />
                )}
                {currentRoute === '/settings/general/financial-year' && (
                  <GeneralSettingsView initialTab="fy-module" view="full" onNavigate={handleNavigate} currentUser={currentUser} />
                )}

                {(currentRoute === '/settings/general/security' || currentRoute.startsWith('/settings/security')) && (
                  <GeneralSettingsView initialTab="security-module" view="full" onNavigate={handleNavigate} currentUser={currentUser} />
                )}
                {currentRoute === '/settings/general/supplier' && (
                  <GeneralSettingsView initialTab="supplier-module" view="full" onNavigate={handleNavigate} currentUser={currentUser} />
                )}
                {currentRoute === '/settings/general/customer' && (
                  <GeneralSettingsView initialTab="customer-module" view="full" onNavigate={handleNavigate} currentUser={currentUser} />
                )}
                {currentRoute === '/settings/general/warehouse' && (
                  <GeneralSettingsView initialTab="warehouse-module" view="full" onNavigate={handleNavigate} currentUser={currentUser} />
                )}
                {currentRoute === '/settings/general/rfq' && (
                  <GeneralSettingsView initialTab="rfq-module" view="full" onNavigate={handleNavigate} currentUser={currentUser} />
                )}
                {(currentRoute === '/settings/general/charge-master' || currentRoute === '/settings/charge-master') && (
                  <GeneralSettingsView initialTab="charge-master-module" view="full" onNavigate={handleNavigate} currentUser={currentUser} />
                )}
                {(currentRoute === '/settings/general/pr-charge-mapping' || currentRoute === '/settings/pr-charge-mapping') && (
                  <GeneralSettingsView initialTab="pr-charge-mapping-module" view="full" onNavigate={handleNavigate} currentUser={currentUser} />
                )}
                {currentRoute === '/settings/general/holiday-calendar' && (
                  <GeneralSettingsView initialTab="holiday-module" view="full" onNavigate={handleNavigate} currentUser={currentUser} />
                )}

                {currentRoute.startsWith('/calendar') && (
                  <WorkdayCalendarSuiteView currentUser={currentUser} />
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

                {currentRoute === '/settings/api-providers' && (
                  <ApiProvidersView />
                )}

                {currentRoute === '/settings/aging-parameters' && (
                  <AgingParameterMasterView />
                )}

                {(currentRoute === '/settings/item-code-rules' || currentRoute === '/settings/item-description-rules') && (
                  <RuleBuilderView />
                )}

                {currentRoute === '/settings/classifications' && <ClassificationsView />}

                {currentRoute === '/settings/organizations' && (
                  <OrganizationsView
                    initialTab="companies"
                    companies={companies}
                    setCompanies={setCompanies}
                    branches={branches}
                    setBranches={setBranches}
                  />
                )}

                {currentRoute === '/settings/warehouses' && (
                  <OrganizationsView
                    initialTab="warehouse"
                    companies={companies}
                    setCompanies={setCompanies}
                    branches={branches}
                    setBranches={setBranches}
                  />
                )}

                {currentRoute === '/settings/purchase-org' && (
                  <OrganizationsView
                    initialTab="purchase_org"
                    companies={companies}
                    setCompanies={setCompanies}
                    branches={branches}
                    setBranches={setBranches}
                  />
                )}

                {currentRoute === '/settings/field-configurations' && <FieldConfigurationsView />}

                {currentRoute === '/settings/audit-logs' && <AuditLogsView currentUser={currentUser} />}

                {currentRoute === '/settings/dashboard-config' && (
                  <DashboardView
                    items={items}
                    activeBranch={activeBranch}
                    currentUser={currentUser}
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
                  <WhatsAppConfigView currentUser={currentUser} />
                )}

                {currentRoute === '/communication/whatsapp-templates' && (
                  <WhatsAppTemplatesView />
                )}

                {currentRoute === '/communication/broadcasts' && (
                  <BroadcastCampaignsView currentUser={currentUser} />
                )}

                {currentRoute === '/communication/rules' && (
                  <NotificationRulesView currentUser={currentUser} />
                )}

                {currentRoute === '/communication/queue' && (
                  <DeliveryQueuesView />
                )}

                {currentRoute === '/communication/webhooks' && (
                  <WebhooksHealthView />
                )}

                {currentRoute === '/communication/consent' && (
                  <ConsentGovernanceView currentUser={currentUser} />
                )}

                {currentRoute === '/communication/reports' && (
                  <CommunicationReportsView />
                )}

                {currentRoute.startsWith('/integration') && (
                  <SapIntegrationView
                    currentUser={currentUser}
                    operatingContext={operatingContext}
                    activeTab={
                      currentRoute === '/integration/companies'
                        ? 'companies'
                        : currentRoute === '/integration/requests'
                        ? 'requests'
                        : currentRoute === '/integration/sync'
                        ? 'sync'
                        : currentRoute === '/integration/mapping'
                        ? 'mapping'
                        : currentRoute === '/integration/fetch'
                        ? 'fetch'
                        : currentRoute === '/integration/history'
                        ? 'history'
                        : currentRoute === '/integration/testing'
                        ? 'testing'
                        : currentRoute === '/integration/activate'
                        ? 'activate'
                        : currentRoute === '/integration/monitor'
                        ? 'monitor'
                        : currentRoute === '/integration/profiles'
                        ? 'profiles'
                        : 'companies'
                    }
                  />
                )}
              </>
            )}
          </main>
        </div>
        </ZeroTrustWorkspaceRuntime>
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

      {activePrSessions.map(sessionId => (
        <PurchaseCreationModal
          key={sessionId}
          currentUser={currentUser}
          onClose={() => closePrSession(sessionId)}
          onSuccess={() => closePrSession(sessionId)}
        />
      ))}

      {selectedPrDetails && (
        <PurchaseRequisitionDetailsModal
          pr={selectedPrDetails}
          currentUser={currentUser}
          onClose={() => setSelectedPrDetails(null)}
          onUpdated={() => {}}
        />
      )}
    </div>
  );
}
