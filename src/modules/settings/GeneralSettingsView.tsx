import React, { useState, useMemo } from 'react';
import { CertificateConfig } from '../../types';
import { CertificateConfigModal } from '../../components/CertificateConfigModal';
import {
  Shield,
  Lock,
  Key,
  Mail,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Zap,
  RefreshCw,
  Server,
  Globe,
  Sliders,
  Check,
  Eye,
  EyeOff,
  Radio,
  FileCheck,
  Layers,
  Coins,
  Cpu,
  Plus,
  Trash2,
  Edit,
  Download,
  Filter,
  Search,
  Activity,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
  Database,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Building2,
  Package,
  Table,
  Calendar,
  ArrowLeft,
  UserIcon,
} from 'lucide-react';
import { WorkdayCalendarSuiteView } from '../calendar/WorkdayCalendarSuiteView';
import {
  getGstVerificationMode,
  setGstVerificationMode,
} from '../../services/gstService';
import {
  getGstProviders,
  saveGstProviders,
  getMsmeProviders,
  saveMsmeProviders,
  getAllProviders,
  saveOrUpdateProvider,
  deleteProvider,
  toggleProviderActive,
  testProviderHealth,
  getApiUsageLogs,
  appendApiUsageLog,
  clearApiUsageLogs,
  computeApiUsageMetrics,
} from '../../services/apiProviderService';
import { GSTVerificationMode, ApiProviderConfig, ApiUsageLogRecord, Company, Branch, User, ComplianceGovernanceSettings } from '../../types';
import { complianceGovernanceService } from '../../services/complianceGovernanceService';
import { INITIAL_COMPANIES, INITIAL_BRANCHES, INITIAL_MODULE_REGISTRY, INITIAL_USERS } from '../../data/seedData';
import { userRoleAdminService } from '../../services/userRoleAdminService';
import { SecurityGovernanceCenter } from './security/SecurityGovernanceCenter';
import { PurchaseRequisitionService } from '../../services/purchaseRequisitionService';
import { BranchPRCleanupPolicy } from '../../types/purchaseRequisition';
import { AgingParameterMasterView } from './AgingParameterMasterView';
import { FinanceBudgetView } from '../finance/FinanceBudgetView';
import { BusinessPartnerMasterView } from '../businessPartners/BusinessPartnerMasterView';
import { WarehouseSetupView } from './WarehouseSetupView';
import { OperatingContext } from '../../services/operatingContextService';
import { BuyerManagementView } from './BuyerManagementView';
import { RfqPolicyView } from '../procurement/RfqPolicyView';
import { PrGovernanceConfigView } from './PrGovernanceConfigView';
import { PrTypeMasterPanel } from './PrTypeMasterPanel';
import { ChargeMasterConfigView } from './ChargeMasterConfigView';
import { ChargeItemMappingView } from './ChargeItemMappingView';
import { FinancialYearManagementView } from '../finance/FinancialYearManagementView';
import { dataGridService } from '../../services/dataGridService';
import {
  rbacPermissionService,
  ENTERPRISE_PERMISSION_CATALOG,
  EnterprisePermissionKey,
} from '../../services/rbacPermissionService';
import { STANDARD_PAGE_SIZE_OPTIONS } from '../../types/dataGrid';
import { UserRole } from '../../types';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';

export interface BranchItemPolicy {
  branchId: string;
  branchCode: string;
  branchName: string;
  categoryEnforcement: boolean;
  rmPrefix: string;
  fgPrefix: string;
  spPrefix: string;
  allowedCategories: string[];
  defaultRmWarehouse: string;
  defaultFgWarehouse: string;
  updatedAt: string;
  updatedBy: string;
  shelfLifeEnabled: boolean;
  serialTraceEnabled: boolean;
  warrantyEnabled: boolean;
  qualityCertEnabled: boolean;
  budgetValidationEnabled: boolean;
  moqValidationEnabled: boolean;
  approvedSupplierEnabled: boolean;
  certificateConfigs: CertificateConfig[];
}

export const MASTER_ITEM_CATEGORIES = [
  { id: 'cat-rm-01', code: 'RM-PA', name: 'Polyamide 6/66 Granules & Resins', type: 'Raw Material' },
  { id: 'cat-rm-02', code: 'RM-COR', name: 'Kraft Paper Reels & Fluting Medium', type: 'Raw Material' },
  { id: 'cat-pkg-01', code: 'PKG-BOX', name: 'Heavy-Duty Corrugated Outer Cartons', type: 'Packaging' },
  { id: 'cat-fg-01', code: 'FG-TUB', name: 'Flexible Slotted & Split Corrugated Tubing', type: 'Finished Goods' },
  { id: 'cat-fg-02', code: 'FG-MOULD', name: 'Precision Moulded Plastic Components', type: 'Finished Goods' },
  { id: 'cat-chem-01', code: 'CHEM-MB', name: 'Flame Retardant & UV Masterbatch Additives', type: 'Chemicals' },
  { id: 'cat-spares-01', code: 'SPR-TOOL', name: 'Mould Dies & Extruder Heaters', type: 'Maintenance Spares' },
  { id: 'cat-elec-01', code: 'ELEC-PLC', name: 'Siemens PLC Controllers & Proximity Sensors', type: 'Electrical Spares' },
];

interface GeneralSettingsViewProps {
  initialTab?:
    | 'pr-module'
    | 'item-module'
    | 'aging-module'
    | 'finance-module'
    | 'security-module'
    | 'buyer-module'
    | 'supplier-module'
    | 'customer-module'
    | 'warehouse-module'
    | 'rfq-module'
    | 'fy-module'
    | 'pr-type-master'
    | 'charge-master-module'
    | 'pr-charge-mapping-module'
    | 'holiday-module';
  view?: 'dashboard' | 'full';
  onNavigate?: (route: string) => void;
  hideHeader?: boolean;
  currentUser?: User;
}

export const GeneralSettingsView: React.FC<GeneralSettingsViewProps> = ({
  initialTab,
  view = 'dashboard',
  onNavigate,
  hideHeader = false,
  currentUser,
}) => {
  const BackButton = () => (
    <button 
      onClick={() => onNavigate && onNavigate('/settings/general')}
      className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-bold text-xs cursor-pointer mb-4"
    >
      <ArrowLeft className="w-4 h-4" /> Back to General Settings
    </button>
  );

  const [selectedModuleId, setSelectedModuleId] = useState<any>(initialTab || 'pr-module');
  const [isDashboardView, setIsDashboardView] = useState(view === 'dashboard');

  const [gridSettings, setGridSettings] = useState(() => dataGridService.getGlobalGridSettings());
  const [gridSettingsSavedMsg, setGridSettingsSavedMsg] = useState<string | null>(null);
  const [rolePermsMap, setRolePermsMap] = useState(() =>
    rbacPermissionService.getRolePermissionsMap()
  );
  const [selectedRbacRole, setSelectedRbacRole] = useState<UserRole>('PLATFORM_ADMIN');
  const [rbacNotice, setRbacNotice] = useState<string | null>(null);
  const [securitySubTab, setSecuritySubTab] = useState<'zero-trust' | 'legacy-rbac'>('zero-trust');

  React.useEffect(() => {
    if (initialTab) setSelectedModuleId(initialTab);
    setIsDashboardView(view === 'dashboard');
  }, [initialTab, view]);
  
  const SETTINGS_MODULES = [
    { id: 'pr-module', name: 'Purchase Requisition', icon: Clock },
    { id: 'item-module', name: 'Item Master', icon: Package },
    { id: 'aging-module', name: 'Aging Parameter', icon: Calendar },
    { id: 'finance-module', name: 'Budget', icon: Coins },
    { id: 'security-module', name: 'Security', icon: Shield },
    { id: 'supplier-module', name: 'Statutory Compliance & Supplier Master', icon: Building2 },
    { id: 'customer-module', name: 'Customer Management', icon: Building2 },
    { id: 'warehouse-module', name: 'Warehouse', icon: Database },
    { id: 'buyer-module', name: 'Buyer Management', icon: UserIcon },
    { id: 'rfq-module', name: 'RFQ', icon: Sliders },
    { id: 'fy-module', name: 'Financial Year Management', icon: Calendar },
    { id: 'pr-type-master', name: 'PR Type Master & Mapping', icon: Layers },
    { id: 'charge-master-module', name: 'Procurement Configuration — Charge Master', icon: Coins },
    { id: 'pr-charge-mapping-module', name: 'Purchase Requisition — Charge Item Mapping', icon: Layers },
    { id: 'holiday-module', name: 'Holiday & Workday Calendar', icon: Calendar },
  ] as const;

  // Company and Branch loading from Master
  const [companies] = useState<Company[]>(() => {
    try {
      const stored = localStorage.getItem('kosh_companies');
      return stored ? JSON.parse(stored) : INITIAL_COMPANIES;
    } catch {
      return INITIAL_COMPANIES;
    }
  });

  const [branches] = useState<Branch[]>(() => {
    try {
      const stored = localStorage.getItem('kosh_branches');
      return stored ? JSON.parse(stored) : INITIAL_BRANCHES;
    } catch {
      return INITIAL_BRANCHES;
    }
  });

  const activeCompanies = useMemo(() => companies.filter(c => c.isEnabled), [companies]);
  const [selectedPolicyCompanyId, setSelectedPolicyCompanyId] = useState<string>(activeCompanies[0]?.id || 'co-kosh-01');

  // Filter active branches belonging to selected company (excluding INACTIVE)
  const companyActiveBranches = useMemo(() => {
    return branches.filter(b => {
      const bCompId = b.companyId || 'co-kosh-01';
      return bCompId === selectedPolicyCompanyId && b.lifecycleStatus !== 'INACTIVE';
    });
  }, [branches, selectedPolicyCompanyId]);

  const branchItemPolicyGrid = useStandardDataGrid({
    gridId: 'settings-branch-item-policies',
    userId: currentUser?.id,
    data: companyActiveBranches,
    defaultSortField: 'portalBranchCode',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
    filterSignature: selectedPolicyCompanyId,
  });

  const [selectedPolicyBranchId, setSelectedPolicyBranchId] = useState<string>(companyActiveBranches[0]?.id || 'br-pond-01');

  // Reset selected branch when company changes
  React.useEffect(() => {
    if (companyActiveBranches.length > 0 && !companyActiveBranches.some(b => b.id === selectedPolicyBranchId)) {
      setSelectedPolicyBranchId(companyActiveBranches[0].id);
    }
  }, [selectedPolicyCompanyId, companyActiveBranches]);

  const [branchPolicies, setBranchPolicies] = useState<BranchPRCleanupPolicy[]>(() => PurchaseRequisitionService.getBranchCleanupPolicies());
  const [prViewMode, setPrViewMode] = useState<'single' | 'table'>('single');
  const [evalResult, setEvalResult] = useState<string | null>(null);

  // Get active branch object
  const currentBranch = companyActiveBranches.find(b => b.id === selectedPolicyBranchId) || companyActiveBranches[0];

  // Editable policy state for the selected branch
  const [editingPolicy, setEditingPolicy] = useState<BranchPRCleanupPolicy>(() => {
    if (companyActiveBranches[0]) {
      const existing = branchPolicies.find(p => p.branchId === companyActiveBranches[0].id);
      if (existing) return { ...existing };
      return {
        branchId: companyActiveBranches[0].id,
        branchCode: companyActiveBranches[0].portalBranchCode || companyActiveBranches[0].code,
        branchName: companyActiveBranches[0].name,
        ageThresholdDays: 45,
        advanceWarningDays: 5,
        isEnabled: true,
        notifyRequesters: true,
        notifyApprovers: true,
        notifyBuyers: true,
        channels: ['IN_PORTAL', 'EMAIL'],
        updatedAt: new Date().toISOString(),
        updatedBy: 'System Admin'
      };
    }
    return {
      branchId: 'branch-001',
      branchCode: '001',
      branchName: 'Hosur Plant 1',
      ageThresholdDays: 45,
      advanceWarningDays: 5,
      isEnabled: true,
      notifyRequesters: true,
      notifyApprovers: true,
      notifyBuyers: true,
      channels: ['IN_PORTAL'],
      updatedAt: new Date().toISOString(),
      updatedBy: 'System Admin'
    };
  });

  // Sync editingPolicy when selectedPolicyBranchId changes
  React.useEffect(() => {
    if (currentBranch) {
      const existing = branchPolicies.find(p => p.branchId === currentBranch.id);
      if (existing) {
        setEditingPolicy({ ...existing });
      } else {
        setEditingPolicy({
          branchId: currentBranch.id,
          branchCode: currentBranch.portalBranchCode || currentBranch.code,
          branchName: currentBranch.name,
          ageThresholdDays: 45,
          advanceWarningDays: 5,
          isEnabled: true,
          notifyRequesters: true,
          notifyApprovers: true,
          notifyBuyers: true,
          channels: ['IN_PORTAL', 'EMAIL'],
          updatedAt: new Date().toISOString(),
          updatedBy: 'System Admin'
        });
      }
    }
  }, [selectedPolicyBranchId, branchPolicies, currentBranch]);

  const handleSaveBranchPolicy = () => {
    if (!currentBranch) return;
    const policyToSave: BranchPRCleanupPolicy = {
      ...editingPolicy,
      branchId: currentBranch.id,
      branchCode: currentBranch.portalBranchCode || currentBranch.code,
      branchName: currentBranch.name,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Platform Admin'
    };
    PurchaseRequisitionService.saveBranchCleanupPolicy(policyToSave);
    setBranchPolicies(PurchaseRequisitionService.getBranchCleanupPolicies());
    setEvalResult(`Branch PR age threshold & message policy for ${currentBranch.name} saved successfully.`);
    setTimeout(() => setEvalResult(null), 3500);
  };

  const handleToggleBranchPolicyEnable = (branchId: string, currentEnabled: boolean) => {
    const br = branches.find(b => b.id === branchId);
    if (!br) return;
    const existing = branchPolicies.find(p => p.branchId === branchId) || {
      branchId: br.id,
      branchCode: br.portalBranchCode || br.code,
      branchName: br.name,
      ageThresholdDays: 45,
      advanceWarningDays: 5,
      isEnabled: true,
      notifyRequesters: true,
      notifyApprovers: true,
      notifyBuyers: true,
      channels: ['IN_PORTAL'],
      updatedAt: new Date().toISOString(),
      updatedBy: 'System Admin'
    };
    const updated: BranchPRCleanupPolicy = {
      ...existing,
      isEnabled: !currentEnabled,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Platform Admin'
    };
    PurchaseRequisitionService.saveBranchCleanupPolicy(updated);
    setBranchPolicies(PurchaseRequisitionService.getBranchCleanupPolicies());
  };

  const handleRunEvaluation = () => {
    if (!currentBranch) return;
    const res = PurchaseRequisitionService.evaluateAndTriggerBranchPrNotifications(currentBranch.id);
    setEvalResult(res.message);
  };

  // Item Master & Classification Branch Settings State (Branch-wise)
  const [branchItemPolicies, setBranchItemPolicies] = useState<BranchItemPolicy[]>(() => {
    try {
      const stored = localStorage.getItem('kosh_branch_item_policies');
      if (stored) return JSON.parse(stored);
    } catch {}

    return INITIAL_BRANCHES.map(b => {
      const bCode = b.portalBranchCode || b.code || '001';
      const prefix = b.code || 'KOSH';
      const defaultWh = b.warehouses?.[0]?.warehouseName || 'Central Main Store';
      const defaultFgWh = b.warehouses?.[1]?.warehouseName || defaultWh;
      return {
        branchId: b.id,
        branchCode: bCode,
        branchName: b.name,
        categoryEnforcement: true,
        rmPrefix: `${prefix}-RM-`,
        fgPrefix: `${prefix}-FG-`,
        spPrefix: `${prefix}-SP-`,
        allowedCategories: MASTER_ITEM_CATEGORIES.map(c => c.id),
        defaultRmWarehouse: defaultWh,
        defaultFgWarehouse: defaultFgWh,
        updatedAt: new Date().toISOString(),
        updatedBy: 'System Admin',
        shelfLifeEnabled: true,
        serialTraceEnabled: true,
        warrantyEnabled: true,
        qualityCertEnabled: true,
        budgetValidationEnabled: true,
        moqValidationEnabled: true,
        approvedSupplierEnabled: true,
        certificateConfigs: [],
      };
    });
  });

  const [itemViewMode, setItemViewMode] = useState<'single' | 'table'>('single');
  const [itemPolicySavedNotice, setItemPolicySavedNotice] = useState<string | null>(null);

  // Editable Item Policy for selected branch
  const [editingItemPolicy, setEditingItemPolicy] = useState<BranchItemPolicy>(() => {
    const activeBr = currentBranch || companyActiveBranches[0] || INITIAL_BRANCHES[0];
    const existing = branchItemPolicies.find(p => p.branchId === activeBr?.id);
    if (existing) return { ...existing };
    const bCode = activeBr?.portalBranchCode || activeBr?.code || '001';
    const prefix = activeBr?.code || 'KOSH';
    return {
      branchId: activeBr?.id || 'br-pond-01',
      branchCode: bCode,
      branchName: activeBr?.name || 'Puducherry Main Plant & HQ',
      categoryEnforcement: true,
      rmPrefix: `${prefix}-RM-`,
      fgPrefix: `${prefix}-FG-`,
      spPrefix: `${prefix}-SP-`,
      allowedCategories: MASTER_ITEM_CATEGORIES.map(c => c.id),
      defaultRmWarehouse: activeBr?.warehouses?.[0]?.warehouseName || 'Central Main Store',
      defaultFgWarehouse: activeBr?.warehouses?.[1]?.warehouseName || 'Finished Goods Yard',
      updatedAt: new Date().toISOString(),
      updatedBy: 'System Admin',
      shelfLifeEnabled: true,
      serialTraceEnabled: true,
      warrantyEnabled: true,
      qualityCertEnabled: true,
      budgetValidationEnabled: true,
      moqValidationEnabled: true,
      approvedSupplierEnabled: true,
      certificateConfigs: [],
    };
  });

  // Sync editingItemPolicy when selectedPolicyBranchId or currentBranch changes
  React.useEffect(() => {
    if (currentBranch) {
      const existing = branchItemPolicies.find(p => p.branchId === currentBranch.id);
      if (existing) {
        setEditingItemPolicy({ ...existing });
      } else {
        const bCode = currentBranch.portalBranchCode || currentBranch.code || '001';
        const prefix = currentBranch.code || 'KOSH';
        setEditingItemPolicy({
          branchId: currentBranch.id,
          branchCode: bCode,
          branchName: currentBranch.name,
          categoryEnforcement: true,
          rmPrefix: `${prefix}-RM-`,
          fgPrefix: `${prefix}-FG-`,
          spPrefix: `${prefix}-SP-`,
          allowedCategories: MASTER_ITEM_CATEGORIES.map(c => c.id),
          defaultRmWarehouse: currentBranch.warehouses?.[0]?.warehouseName || 'Central Main Store',
          defaultFgWarehouse: currentBranch.warehouses?.[1]?.warehouseName || 'Finished Goods Yard',
          updatedAt: new Date().toISOString(),
          updatedBy: 'System Admin',
          shelfLifeEnabled: true,
          serialTraceEnabled: true,
          warrantyEnabled: true,
          qualityCertEnabled: true,
          budgetValidationEnabled: true,
          moqValidationEnabled: true,
          approvedSupplierEnabled: true,
          certificateConfigs: [],
        });
      }
    }
  }, [selectedPolicyBranchId, branchItemPolicies, currentBranch]);

  const handleSaveItemBranchPolicy = () => {
    if (!currentBranch) return;
    const policyToSave: BranchItemPolicy = {
      ...editingItemPolicy,
      branchId: currentBranch.id,
      branchCode: currentBranch.portalBranchCode || currentBranch.code,
      branchName: currentBranch.name,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Platform Admin'
    };
    const updatedPolicies = branchItemPolicies.map(p => p.branchId === policyToSave.branchId ? policyToSave : p);
    if (!updatedPolicies.some(p => p.branchId === policyToSave.branchId)) {
      updatedPolicies.push(policyToSave);
    }
    setBranchItemPolicies(updatedPolicies);
    try {
      localStorage.setItem('kosh_branch_item_policies', JSON.stringify(updatedPolicies));
    } catch {}
    setItemPolicySavedNotice(`Branch Item Master & Category Classification Policy for ${currentBranch.name} (${currentBranch.portalBranchCode || currentBranch.code}) saved successfully.`);
    setTimeout(() => setItemPolicySavedNotice(null), 3500);
  };

  const handleToggleBranchItemEnforcement = (branchId: string, currentEnforced: boolean) => {
    const br = branches.find(b => b.id === branchId);
    if (!br) return;
    const existing = branchItemPolicies.find(p => p.branchId === branchId) || {
      branchId: branchId,
      branchCode: br.portalBranchCode || br.code,
      branchName: br.name,
      categoryEnforcement: true,
      rmPrefix: `${br.code || 'KOSH'}-RM-`,
      fgPrefix: `${br.code || 'KOSH'}-FG-`,
      spPrefix: `${br.code || 'KOSH'}-SP-`,
      allowedCategories: MASTER_ITEM_CATEGORIES.map(c => c.id),
      defaultRmWarehouse: br.warehouses?.[0]?.warehouseName || 'Main Store',
      defaultFgWarehouse: br.warehouses?.[1]?.warehouseName || 'FG Yard',
      updatedAt: new Date().toISOString(),
      updatedBy: 'System Admin',
      shelfLifeEnabled: true,
      serialTraceEnabled: true,
      warrantyEnabled: true,
      qualityCertEnabled: true,
      budgetValidationEnabled: true,
      moqValidationEnabled: true,
      approvedSupplierEnabled: true,
      certificateConfigs: [],
    };
    const updated: BranchItemPolicy = {
      ...existing,
      categoryEnforcement: !currentEnforced,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Platform Admin'
    };
    const updatedList = branchItemPolicies.map(p => p.branchId === branchId ? updated : p);
    if (!updatedList.some(p => p.branchId === branchId)) {
      updatedList.push(updated);
    }
    setBranchItemPolicies(updatedList);
    try {
      localStorage.setItem('kosh_branch_item_policies', JSON.stringify(updatedList));
    } catch {}
  };

  // Certificate Modal State
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  const handleSaveCertificates = (configs: CertificateConfig[]) => {
    setEditingItemPolicy({ ...editingItemPolicy, certificateConfigs: configs });
  };

  // Security settings state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(30);
  const [maxFailedLogins, setMaxFailedLogins] = useState(5);
  const [isSaved, setIsSaved] = useState(false);

  // Statutory Compliance & Verification Governance state
  const [complianceSettings, setComplianceSettings] = useState<ComplianceGovernanceSettings>(() =>
    complianceGovernanceService.getComplianceSettings()
  );
  const [complianceNotice, setComplianceNotice] = useState<string | null>(null);

  React.useEffect(() => {
    const handleSync = (e: any) => {
      setComplianceSettings(e.detail || complianceGovernanceService.getComplianceSettings());
    };
    window.addEventListener('cip-compliance-settings-updated', handleSync);
    return () => window.removeEventListener('cip-compliance-settings-updated', handleSync);
  }, []);

  // Verification modes state
  const [gstMode, setGstModeState] = useState<GSTVerificationMode>(() => getGstVerificationMode());
  const [msmeMode, setMsmeMode] = useState<'AUTOMATIC' | 'MANUAL'>('AUTOMATIC');
  const [modeSaveNotice, setModeSaveNotice] = useState<string | null>(null);

  // Provider configuration state
  const [serviceFilter, setServiceFilter] = useState<'ALL' | 'GST' | 'MSME'>('ALL');
  const [providerSearch, setProviderSearch] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Providers list
  const providers = useMemo(() => {
    return getAllProviders(serviceFilter);
  }, [serviceFilter, refreshTrigger]);

  const filteredProviders = useMemo(() => {
    if (!providerSearch.trim()) return providers;
    const q = providerSearch.toLowerCase().trim();
    return providers.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        p.providerName.toLowerCase().includes(q) ||
        p.endpointUrl.toLowerCase().includes(q)
    );
  }, [providers, providerSearch]);

  // Modal State for Add / Edit Provider
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ApiProviderConfig | null>(null);
  const [showModalApiKey, setShowModalApiKey] = useState(false);
  const [modalTestStatus, setModalTestStatus] = useState<{ success: boolean; msg: string; latency?: number } | null>(null);
  const [isModalTesting, setIsModalTesting] = useState(false);

  // Inline testing state
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; msg: string; latency?: number }>>({});

  // Usage logs & analytics state
  const [logSearch, setLogSearch] = useState('');
  const [logServiceFilter, setLogServiceFilter] = useState<'ALL' | 'GST' | 'MSME'>('ALL');
  const [logStatusFilter, setLogStatusFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED' | 'TIMEOUT'>('ALL');

  const usageLogs = useMemo(() => {
    return getApiUsageLogs();
  }, [refreshTrigger]);

  const filteredLogs = useMemo(() => {
    return usageLogs.filter((log) => {
      if (logServiceFilter !== 'ALL' && log.serviceType !== logServiceFilter) return false;
      if (logStatusFilter !== 'ALL' && log.status !== logStatusFilter) return false;
      if (logSearch.trim()) {
        const q = logSearch.toLowerCase().trim();
        const matchesTarget = log.targetIdentifier.toLowerCase().includes(q);
        const matchesProvider = log.providerName.toLowerCase().includes(q);
        const matchesUser = log.requestedBy.toLowerCase().includes(q);
        if (!matchesTarget && !matchesProvider && !matchesUser) return false;
      }
      return true;
    });
  }, [usageLogs, logServiceFilter, logStatusFilter, logSearch]);

  const metrics = useMemo(() => {
    return computeApiUsageMetrics();
  }, [refreshTrigger]);

  // Handlers
  const handleSaveSecurity = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleSaveVerificationModes = () => {
    setGstVerificationMode(gstMode);
    setModeSaveNotice('Verification modes and failover policies saved successfully.');
    setTimeout(() => setModeSaveNotice(null), 3500);
  };

  const handleToggleActive = (provider: ApiProviderConfig) => {
    toggleProviderActive(provider.id, provider.serviceType);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleDeleteProvider = (provider: ApiProviderConfig) => {
    if (confirm(`Are you sure you want to remove ${provider.displayName} from the active provider pool?`)) {
      deleteProvider(provider.id, provider.serviceType);
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  const handleTestProvider = async (provider: ApiProviderConfig) => {
    setTestingProviderId(provider.id);
    try {
      const res = await testProviderHealth(provider);
      setTestResults((prev) => ({
        ...prev,
        [provider.id]: { success: res.success, msg: res.message, latency: res.latencyMs },
      }));
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [provider.id]: { success: false, msg: err.message || 'Connection test failed.' },
      }));
    } finally {
      setTestingProviderId(null);
    }
  };

  const handleOpenAddModal = (serviceType: 'GST' | 'MSME' = 'GST') => {
    setEditingProvider({
      id: `prov-${serviceType.toLowerCase()}-${Date.now().toString().slice(-4)}`,
      serviceType,
      providerName: serviceType === 'GST' ? 'CLEAR_TAX' : 'UDYAM_GOVT_SANDBOX',
      displayName: serviceType === 'GST' ? 'New GST API Provider Gateway' : 'New MSME / Udyam API Provider Gateway',
      endpointUrl: serviceType === 'GST' ? 'https://api.cleartax.in/v2/gstin/search' : 'https://udyamregistration.gov.in/api/v1/enterprise/verify',
      apiKey: '',
      clientId: '',
      clientSecret: '',
      isActive: true,
      priority: serviceType === 'GST' ? getGstProviders().length + 1 : getMsmeProviders().length + 1,
      selectionStrategy: 'HIGHEST_BALANCE',
      totalCredits: 10000,
      remainingCredits: 10000,
      dailyLimit: 1000,
      dailyUsed: 0,
      monthlyLimit: 25000,
      monthlyUsed: 0,
      resetTimezone: 'Asia/Kolkata',
      healthStatus: 'HEALTHY',
      timeoutSeconds: 15,
      costPerRequest: 1.0,
    });
    setModalTestStatus(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (provider: ApiProviderConfig) => {
    setEditingProvider({ ...provider });
    setModalTestStatus(null);
    setIsModalOpen(true);
  };

  const handleSaveModalProvider = () => {
    if (!editingProvider) return;
    if (!editingProvider.displayName.trim() || !editingProvider.endpointUrl.trim()) {
      alert('Display Name and Endpoint URL are required.');
      return;
    }
    saveOrUpdateProvider(editingProvider);
    setIsModalOpen(false);
    setEditingProvider(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleModalTest = async () => {
    if (!editingProvider) return;
    setIsModalTesting(true);
    setModalTestStatus(null);
    try {
      const res = await testProviderHealth(editingProvider);
      setModalTestStatus({ success: res.success, msg: res.message, latency: res.latencyMs });
    } catch (err: any) {
      setModalTestStatus({ success: false, msg: err.message || 'Connection test failed.' });
    } finally {
      setIsModalTesting(false);
    }
  };

  const handleClearLogs = () => {
    if (confirm('Clear all API provider usage logs? This action cannot be undone.')) {
      clearApiUsageLogs();
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  const handleExportLogsCsv = () => {
    const headers = ['Timestamp', 'Service', 'Provider ID', 'Provider Name', 'Target Identifier', 'Status', 'Latency (ms)', 'Credits Consumed', 'Requested By', 'Details'];
    const rows = filteredLogs.map((l) => [
      l.timestamp,
      l.serviceType,
      l.providerId,
      l.providerName,
      l.targetIdentifier,
      l.status,
      l.latencyMs,
      l.creditsConsumed,
      `"${(l.requestedBy || '').replace(/"/g, '""')}"`,
      `"${(l.responseSummary || l.errorMessage || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `api_provider_usage_logs_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getTemplateConfig = (templateKey: string, serviceType: 'GST' | 'MSME') => {
    if (serviceType === 'GST') {
      switch (templateKey) {
        case 'CLEAR_TAX':
          return {
            providerName: 'CLEAR_TAX',
            displayName: 'ClearTax GST Enterprise Gateway',
            endpointUrl: 'https://api.cleartax.in/v2/gstin/search',
            costPerRequest: 1.0,
            timeoutSeconds: 15,
          };
        case 'IRIS_GST':
          return {
            providerName: 'IRIS_GST',
            displayName: 'IRIS GST Peridot Enterprise',
            endpointUrl: 'https://api.irisgst.com/v2/search',
            costPerRequest: 1.2,
            timeoutSeconds: 12,
          };
        case 'MASTERS_INDIA':
          return {
            providerName: 'MASTERS_INDIA',
            displayName: 'Masters India GST API Gateway',
            endpointUrl: 'https://api.mastersindia.co/v1/gstin/verify',
            costPerRequest: 0.9,
            timeoutSeconds: 15,
          };
        case 'GOVT_DIRECT_SANDBOX':
          return {
            providerName: 'GOVT_DIRECT_SANDBOX',
            displayName: 'Official Govt GSTN Developer Sandbox',
            endpointUrl: 'https://sandbox.gst.gov.in/taxpayerapi/v1.0/search',
            costPerRequest: 0.5,
            timeoutSeconds: 20,
          };
        default:
          return {
            providerName: 'CUSTOM_REST',
            displayName: 'Custom Enterprise REST Gateway',
            endpointUrl: 'https://api.custom-gst-gateway.internal/v1/lookup',
            costPerRequest: 1.0,
            timeoutSeconds: 15,
          };
      }
    } else {
      switch (templateKey) {
        case 'UDYAM_GOVT_SANDBOX':
          return {
            providerName: 'UDYAM_GOVT_SANDBOX',
            displayName: 'Official Udyam Govt Developer Sandbox',
            endpointUrl: 'https://udyamregistration.gov.in/api/v1/enterprise/verify',
            costPerRequest: 1.0,
            timeoutSeconds: 15,
          };
        case 'CLEARTAX_MSME':
          return {
            providerName: 'CLEARTAX_MSME',
            displayName: 'ClearTax MSME & Udyam Gateway',
            endpointUrl: 'https://api.cleartax.in/v2/msme/verify',
            costPerRequest: 1.5,
            timeoutSeconds: 12,
          };
        case 'MASTERS_INDIA_MSME':
          return {
            providerName: 'MASTERS_INDIA_MSME',
            displayName: 'Masters India Udyam Verification API',
            endpointUrl: 'https://api.mastersindia.co/v1/msme/verify',
            costPerRequest: 1.1,
            timeoutSeconds: 15,
          };
        default:
          return {
            providerName: 'CUSTOM_REST',
            displayName: 'Custom Enterprise MSME Gateway',
            endpointUrl: 'https://enterprise-api.kosh.internal/msme/verify',
            costPerRequest: 1.0,
            timeoutSeconds: 10,
          };
      }
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-6 text-xs w-full max-w-none font-sans select-none">
      {!hideHeader && (
        <div className="border-b border-slate-100 pb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600" />
              Module-Wise & Branch-Wise Enterprise Settings Console
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage enterprise module configurations, branch-specific policies, verification gateways, and security thresholds from a unified control panel.
            </p>
          </div>
        </div>
      )}

      {/* Global Enterprise Scope Toolbar: Active Company & Branch Context */}
      <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto min-w-0">
          {/* Company Selection Badge & Dropdown */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-lg shadow-2xs w-full sm:w-auto min-w-0 max-w-full">
            <div className="flex items-center gap-1.5 shrink-0">
              <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-bold text-slate-300 text-xs whitespace-nowrap">Enterprise Company:</span>
            </div>
            <select
              value={selectedPolicyCompanyId}
              onChange={(e) => setSelectedPolicyCompanyId(e.target.value)}
              className="bg-transparent font-extrabold text-white cursor-pointer focus:outline-hidden text-xs min-w-0 flex-1 sm:flex-initial max-w-full truncate"
            >
              {activeCompanies.map((co) => (
                <option key={co.id} value={co.id} className="bg-slate-900 text-white">
                  {co.name} ({co.code})
                </option>
              ))}
            </select>
          </div>

          {/* Branch Selection Badge & Dropdown */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-lg shadow-2xs w-full sm:w-auto min-w-0 max-w-full">
            <div className="flex items-center gap-1.5 shrink-0">
              <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bold text-slate-300 text-xs whitespace-nowrap">Active Branch Scope:</span>
            </div>
            <select
              value={selectedPolicyBranchId}
              onChange={(e) => setSelectedPolicyBranchId(e.target.value)}
              className="bg-transparent font-extrabold text-amber-300 cursor-pointer focus:outline-hidden text-xs min-w-0 flex-1 sm:flex-initial max-w-full truncate"
            >
              {companyActiveBranches.length === 0 ? (
                <option value="" className="bg-slate-900 text-white">No active branches found</option>
              ) : (
                companyActiveBranches.map((br) => (
                  <option key={br.id} value={br.id} className="bg-slate-900 text-white">
                    {br.name} ({br.portalBranchCode || br.code})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold rounded-lg text-[11px] font-mono">
            {currentBranch ? `${currentBranch.city}, ${currentBranch.state}` : 'Active Scope'}
          </span>
          <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-bold rounded-lg text-[11px]">
            {companyActiveBranches.length} Active Branch(es)
          </span>
        </div>
      </div>

      {/* Dashboard Module Navigation */}
      {isDashboardView && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SETTINGS_MODULES.map((m) => (
            <button
              type="button"
              key={m.id}
              onClick={() => {
              const routeMap: Record<string, string> = {
                'pr-module': 'pr',
                'item-module': 'items',
                'aging-module': 'aging',
                'finance-module': 'budget',
                'security-module': 'security',
                'supplier-module': 'supplier',
                'customer-module': 'customer',
                'warehouse-module': 'warehouse',
                'buyer-module': 'buyer',
                'rfq-module': 'rfq',
                'fy-module': 'financial-year',
                'pr-type-master': 'pr-type-master',
                'charge-master-module': 'charge-master',
                'pr-charge-mapping-module': 'pr-charge-mapping',
                'holiday-module': 'holiday-calendar',
              };
              onNavigate && onNavigate(`/settings/general/${routeMap[m.id]}`);
            }}
              className={`text-left w-full bg-white rounded-xl border p-5 shadow-xs cursor-pointer transition ${
                selectedModuleId === m.id 
                  ? 'border-indigo-300 ring-1 ring-indigo-300 bg-indigo-50/50' 
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="flex flex-col gap-3">
                <m.icon className="w-6 h-6 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{m.name}</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Configure →</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 1: PURCHASE REQUISITION (PR) MASTER GOVERNANCE CONFIGURATION   */}
      {/* ------------------------------------------------------------------ */}
      {!isDashboardView && selectedModuleId === 'pr-module' && (
        <div className="space-y-5">
          <BackButton />
          <PrGovernanceConfigView
            currentUser={currentUser}
            companies={companies}
            branches={branches}
          />
        </div>
      )}

      {!isDashboardView && selectedModuleId === 'pr-type-master' && (
        <div className="space-y-5">
          <BackButton />
          <PrTypeMasterPanel
            currentUser={currentUser}
            companies={companies}
            branches={branches}
          />
        </div>
      )}

      {!isDashboardView && selectedModuleId === 'charge-master-module' && (
        <div className="space-y-5">
          <BackButton />
          <ChargeMasterConfigView currentUser={currentUser} />
        </div>
      )}

      {!isDashboardView && selectedModuleId === 'pr-charge-mapping-module' && (
        <div className="space-y-5">
          <BackButton />
          <ChargeItemMappingView
            currentUser={currentUser}
            companies={companies}
            branches={branches}
            initialCompanyId={selectedPolicyCompanyId}
            initialBranchId={selectedPolicyBranchId}
          />
        </div>
      )}

      {!isDashboardView && selectedModuleId === 'holiday-module' && (
        <div className="space-y-5">
          <BackButton />
          <WorkdayCalendarSuiteView currentUser={currentUser} />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 2: ITEM MASTER & BRANCH CATEGORY SETTINGS                     */}
      {/* ------------------------------------------------------------------ */}
      {!isDashboardView && selectedModuleId === 'item-module' && (
        <div className="space-y-5">
          <BackButton />
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                Item Master Policies
              </h3>
              <p className="text-slate-500 mt-0.5">
                Configure branch-specific category assignment rules, item code prefixes, category authorization matrices, and default warehouse mappings per active branch.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setItemViewMode('single')}
                  className={`px-3 py-1 rounded font-bold text-xs transition cursor-pointer ${
                    itemViewMode === 'single' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Branch Item Editor
                </button>
                <button
                  onClick={() => setItemViewMode('table')}
                  className={`px-3 py-1 rounded font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                    itemViewMode === 'table' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Table className="w-3 h-3" />
                  <span>All Active Branches</span>
                </button>
              </div>

              {itemViewMode === 'single' && (
                <button
                  onClick={handleSaveItemBranchPolicy}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Save Branch Item Policy
                </button>
              )}
            </div>
          </div>

          {itemPolicySavedNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl font-bold flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{itemPolicySavedNotice}</span>
            </div>
          )}

          {/* VIEW MODE 1: SINGLE BRANCH ITEM EDITOR */}
          {itemViewMode === 'single' && currentBranch && (
            <div className="space-y-4">
              {/* Branch Context Info Header */}
              <div className="bg-indigo-900 text-white p-4 rounded-xl border border-indigo-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-800/80 rounded-xl border border-indigo-700/60">
                    <Building2 className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-white">
                        {currentBranch.name} ({currentBranch.portalBranchCode || currentBranch.code})
                      </h4>
                      <span className="px-2 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-mono font-bold text-[10px] rounded">
                        Branch ID: {currentBranch.id}
                      </span>
                    </div>
                    <p className="text-[11px] text-indigo-200 mt-0.5">
                      City: {currentBranch.city}, State: {currentBranch.state} • GSTIN: {currentBranch.gstinPan || '34AAACK4603M1ZP'} • Plants: {currentBranch.plants?.length || 1} Unit(s)
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSaveItemBranchPolicy}
                  className="px-3.5 py-1.5 bg-white text-indigo-900 hover:bg-indigo-50 rounded-lg font-extrabold text-xs cursor-pointer shadow-xs transition flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 text-indigo-700" /> Save Policy for {currentBranch.portalBranchCode || currentBranch.code}
                </button>
              </div>

              {/* Policy Controls Matrix Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: Branch Category Enforcement Policy */}
                <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      Global Item Master Decoupling & Branch Enforcement
                    </h4>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded">
                      Level 2 Branch Rule
                    </span>
                  </div>
                  
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Global Item Master holds common identity attributes only. Category classification (`GlobalItemID + BranchID + CategoryID`) is strictly managed at the branch level.
                  </p>

                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {editingItemPolicy.categoryEnforcement ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-400" />
                        )}
                        <span className="font-bold text-slate-900 text-xs">Mandatory Branch Category Enforcement</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingItemPolicy.categoryEnforcement}
                          onChange={(e) => setEditingItemPolicy({ ...editingItemPolicy, categoryEnforcement: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                        <span className="ml-1.5 font-bold text-xs text-slate-700">{editingItemPolicy.categoryEnforcement ? 'Enabled' : 'Disabled'}</span>
                      </label>
                    </div>

                    <p className="text-[10px] text-slate-500">
                      {editingItemPolicy.categoryEnforcement
                        ? 'Mandatory: Branch users must assign an authorized branch category when activating item master records for branch operations.'
                        : 'Optional: Category classification is unconstrained for this branch.'}
                    </p>
                  </div>
                </div>

                {/* Card 2: Branch Item Code Generation Rules */}
                <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-indigo-600" />
                      Branch Auto Item Code Generation Rules
                    </h4>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded font-mono">
                      {editingItemPolicy.branchCode} Prefixes
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Define branch-specific item code prefixes automatically assigned during item creation at {currentBranch.name}.
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 text-[10px] mb-1">Raw Material Prefix</label>
                      <input
                        type="text"
                        value={editingItemPolicy.rmPrefix}
                        onChange={(e) => setEditingItemPolicy({ ...editingItemPolicy, rmPrefix: e.target.value.toUpperCase() })}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs"
                      />
                      <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">{editingItemPolicy.rmPrefix}0001</span>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 text-[10px] mb-1">Finished Goods Prefix</label>
                      <input
                        type="text"
                        value={editingItemPolicy.fgPrefix}
                        onChange={(e) => setEditingItemPolicy({ ...editingItemPolicy, fgPrefix: e.target.value.toUpperCase() })}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs"
                      />
                      <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">{editingItemPolicy.fgPrefix}0001</span>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 text-[10px] mb-1">Maintenance Spares Prefix</label>
                      <input
                        type="text"
                        value={editingItemPolicy.spPrefix}
                        onChange={(e) => setEditingItemPolicy({ ...editingItemPolicy, spPrefix: e.target.value.toUpperCase() })}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs"
                      />
                      <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">{editingItemPolicy.spPrefix}0001</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card X: Item Master Governance Policies */}
              <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  Item Master Governance Policy Enforcements
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: 'shelfLifeEnabled', label: 'Shelf-Life & Expiry Management' },
                    { key: 'serialTraceEnabled', label: 'Serial-Number Traceability' },
                    { key: 'warrantyEnabled', label: 'Warranty Policy Tracking' },
                    { key: 'budgetValidationEnabled', label: 'Budget Validation & Routing' },
                    { key: 'moqValidationEnabled', label: 'MOQ & Pack-Size Validation' },
                    { key: 'approvedSupplierEnabled', label: 'Approved Supplier Restrictions' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 cursor-pointer shadow-2xs">
                      <span className="font-bold text-slate-800 text-[11px]">{item.label}</span>
                      <input
                        type="checkbox"
                        checked={editingItemPolicy[item.key as keyof BranchItemPolicy] as boolean}
                        onChange={(e) => setEditingItemPolicy({ ...editingItemPolicy, [item.key]: e.target.checked })}
                        className="rounded text-indigo-600 w-4 h-4 cursor-pointer"
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsCertModalOpen(true)}
                    className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-200 cursor-pointer shadow-2xs"
                  >
                    <span className="font-bold text-indigo-900 text-[11px]">Quality Inspection & Certificates</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-indigo-700">Configure</span>
                      <Edit className="w-3.5 h-3.5 text-indigo-700" />
                    </div>
                  </button>
                  <CertificateConfigModal
                    isOpen={isCertModalOpen}
                    onClose={() => setIsCertModalOpen(false)}
                    configs={editingItemPolicy.certificateConfigs}
                    onSave={handleSaveCertificates}
                  />
                </div>
              </div>

              {/* Card 3: Branch Category Authorization Matrix */}
              <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                      <Package className="w-4 h-4 text-indigo-600" />
                      Branch Category Authorization Matrix for {currentBranch.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Authorize or restrict specific item categories for inventory procurement and stock posting at this location.
                    </p>
                  </div>

                  <span className="text-slate-600 font-bold text-xs font-mono">
                    {editingItemPolicy.allowedCategories.length} / {MASTER_ITEM_CATEGORIES.length} Categories Authorized
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {MASTER_ITEM_CATEGORIES.map((cat) => {
                    const isChecked = editingItemPolicy.allowedCategories.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                          isChecked
                            ? 'bg-white border-indigo-300 shadow-2xs'
                            : 'bg-white/60 border-slate-200 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const newCats = e.target.checked
                              ? [...editingItemPolicy.allowedCategories, cat.id]
                              : editingItemPolicy.allowedCategories.filter(id => id !== cat.id);
                            setEditingItemPolicy({ ...editingItemPolicy, allowedCategories: newCats });
                          }}
                          className="mt-0.5 rounded text-indigo-600 w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-xs">{cat.code}</span>
                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[9px] font-mono font-bold rounded">
                              {cat.type}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-0.5 leading-tight">{cat.name}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Card 4: Branch Default Warehouse Mapping */}
              <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  Branch Default Warehouse Mapping for Item Movements ({currentBranch.name})
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Default Raw Material Storage Warehouse *</label>
                    <select
                      value={editingItemPolicy.defaultRmWarehouse}
                      onChange={(e) => setEditingItemPolicy({ ...editingItemPolicy, defaultRmWarehouse: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-bold text-xs"
                    >
                      {currentBranch.warehouses && currentBranch.warehouses.length > 0 ? (
                        currentBranch.warehouses.map(w => (
                          <option key={w.id} value={w.warehouseName}>
                            {w.warehouseName} ({w.warehouseCode})
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Central Raw Material Store">Central Raw Material Store</option>
                          <option value="Inward Receiving Bay 1">Inward Receiving Bay 1</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Default Finished Goods Dispatch Warehouse *</label>
                    <select
                      value={editingItemPolicy.defaultFgWarehouse}
                      onChange={(e) => setEditingItemPolicy({ ...editingItemPolicy, defaultFgWarehouse: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-bold text-xs"
                    >
                      {currentBranch.warehouses && currentBranch.warehouses.length > 0 ? (
                        currentBranch.warehouses.map(w => (
                          <option key={w.id} value={w.warehouseName}>
                            {w.warehouseName} ({w.warehouseCode})
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Finished Goods Dispatch Yard">Finished Goods Dispatch Yard</option>
                          <option value="OEM Transit Store">OEM Transit Store</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: ALL ACTIVE BRANCHES TABLE VIEW */}
          {itemViewMode === 'table' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <Table className="w-4 h-4 text-indigo-600" />
                  All Active Branches Item Master Matrix ({companyActiveBranches.length} Branches)
                </h4>
                <span className="text-[10px] text-slate-500">Toggle enforcement switch or click Edit to modify branch item policy</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-bold uppercase text-[10px]">
                      <th className="p-3">Branch Name & Code</th>
                      <th className="p-3 text-center">Category Enforcement</th>
                      <th className="p-3 text-center font-mono">RM Prefix</th>
                      <th className="p-3 text-center font-mono">FG Prefix</th>
                      <th className="p-3 text-center">Authorized Categories</th>
                      <th className="p-3">Default Storage Warehouse</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {branchItemPolicyGrid.pagedData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400">
                          No active branches found for the selected company.
                        </td>
                      </tr>
                    ) : (
                      branchItemPolicyGrid.pagedData.map((br) => {
                        const pol = branchItemPolicies.find(p => p.branchId === br.id) || {
                          branchId: br.id,
                          branchCode: br.portalBranchCode || br.code,
                          branchName: br.name,
                          categoryEnforcement: true,
                          rmPrefix: `${br.code || 'KOSH'}-RM-`,
                          fgPrefix: `${br.code || 'KOSH'}-FG-`,
                          spPrefix: `${br.code || 'KOSH'}-SP-`,
                          allowedCategories: MASTER_ITEM_CATEGORIES.map(c => c.id),
                          defaultRmWarehouse: br.warehouses?.[0]?.warehouseName || 'Main Store',
                          defaultFgWarehouse: br.warehouses?.[1]?.warehouseName || 'FG Yard',
                          updatedAt: new Date().toISOString(),
                          updatedBy: 'Default Policy'
                        };

                        return (
                          <tr key={br.id} className="hover:bg-slate-50 transition">
                            <td className="p-3 font-bold text-slate-900">
                              {br.name}
                              <span className="block font-mono text-[10px] text-slate-500">
                                Code: {br.portalBranchCode || br.code} • {br.city}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleToggleBranchItemEnforcement(br.id, pol.categoryEnforcement)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition ${
                                  pol.categoryEnforcement
                                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-300 hover:bg-indigo-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
                                }`}
                                title="Click to toggle Category Enforcement"
                              >
                                {pol.categoryEnforcement ? (
                                  <>
                                    <CheckCircle className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Enforced</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Optional</span>
                                  </>
                                )}
                              </button>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-indigo-700">
                              {pol.rmPrefix}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-purple-700">
                              {pol.fgPrefix}
                            </td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-bold text-[10px]">
                                {pol.allowedCategories.length} / {MASTER_ITEM_CATEGORIES.length} Authorized
                              </span>
                            </td>
                            <td className="p-3 text-slate-700 font-medium">
                              {pol.defaultRmWarehouse}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => {
                                  setSelectedPolicyBranchId(br.id);
                                  setItemViewMode('single');
                                }}
                                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-600 border border-slate-300 rounded font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
                              >
                                <Edit className="w-3 h-3" />
                                <span>Edit Policy</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-slate-50 border-t border-slate-200">
                <DataGridFooter
                  currentPage={branchItemPolicyGrid.currentPage}
                  totalPages={branchItemPolicyGrid.totalPages}
                  pageSize={branchItemPolicyGrid.pageSize}
                  totalRecords={branchItemPolicyGrid.totalRecords}
                  onPageChange={branchItemPolicyGrid.setCurrentPage}
                  onPageSizeChange={branchItemPolicyGrid.setPageSize}
                  pageSizeOptions={branchItemPolicyGrid.pageSizeOptions}
                  defaultSortNotice="Sorted Newest / Highest Code First"
                />
              </div>
            </div>
          )}
        </div>
      )}



      {/* ------------------------------------------------------------------ */}
      {/* TAB: AGING PARAMETER MASTER                                        */}
      {/* ------------------------------------------------------------------ */}
      {!isDashboardView && selectedModuleId === 'aging-module' && (
        <div className="space-y-5">
          <BackButton />
          <AgingParameterMasterView embedded={true} currentUser={currentUser} />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB: FINANCE & BUDGET GOVERNANCE                                   */}
      {/* ------------------------------------------------------------------ */}
      {!isDashboardView && selectedModuleId === 'finance-module' && (
        <div className="space-y-5">
          <BackButton />
          <FinanceBudgetView companyId={selectedPolicyCompanyId} branchId={selectedPolicyBranchId} currentUser={currentUser} />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 4: SECURITY & ACCESS GOVERNANCE MODULE                         */}
      {/* ------------------------------------------------------------------ */}
      {!isDashboardView && selectedModuleId === 'security-module' && (
        <div className="space-y-5">
          <BackButton />
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 p-2 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="security-tab-zero-trust"
                onClick={() => setSecuritySubTab('zero-trust')}
                className={`px-3.5 py-2 rounded-lg font-bold cursor-pointer transition-colors ${
                  securitySubTab === 'zero-trust'
                    ? 'bg-[#0B192C] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Zero-Trust Visual &amp; Data Protection Governance
              </button>
              <button
                type="button"
                data-testid="security-tab-legacy-rbac"
                onClick={() => setSecuritySubTab('legacy-rbac')}
                className={`px-3.5 py-2 rounded-lg font-bold cursor-pointer transition-colors ${
                  securitySubTab === 'legacy-rbac'
                    ? 'bg-[#0B192C] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Session Lockout, Data Grid &amp; RBAC Matrix
              </button>
            </div>
            <span className="text-[11px] text-slate-500 px-2">
              Governance &amp; System Settings → Security Governance
            </span>
          </div>

          {securitySubTab === 'zero-trust' ? (
            <SecurityGovernanceCenter
              currentUser={currentUser || INITIAL_USERS[0]}
              companies={companies}
              branches={branches}
              users={userRoleAdminService.getUsers()}
              modules={(() => {
                try {
                  const saved = localStorage.getItem('kosh_module_registry');
                  return saved ? JSON.parse(saved) : INITIAL_MODULE_REGISTRY;
                } catch {
                  return INITIAL_MODULE_REGISTRY;
                }
              })()}
            />
          ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  Security
                </h3>
                <p className="text-slate-500 mt-0.5">Configure two-factor authentication, inactivity timeouts, and account lockout thresholds.</p>
              </div>

              <button
                onClick={handleSaveSecurity}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Security Settings</span>
              </button>
            </div>

            {isSaved && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl font-bold flex items-center gap-2 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Security settings updated successfully.</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Session Inactivity Timeout (Minutes)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={sessionTimeoutMinutes}
                    onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value) || 30)}
                    className="w-28 p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs"
                  />
                  <span className="text-slate-500 font-bold">Minutes</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Automatically invalidates session tokens after inactivity.</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Lockout Threshold (Failed Attempts)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={3}
                    max={10}
                    value={maxFailedLogins}
                    onChange={(e) => setMaxFailedLogins(Number(e.target.value) || 5)}
                    className="w-28 p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs"
                  />
                  <span className="text-slate-500 font-bold">Attempts</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Locks user access after consecutive failed password or 2FA attempts.</p>
              </div>
            </div>

            {/* GLOBAL DATA GRID & EXPORT STANDARD GOVERNANCE */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                    <Table className="w-4 h-4 text-indigo-600" />
                    <span>Global Data Grid & Export Standard (Application-Wide)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Standard Page Sizes [10, 20, 25, 50, 100, 200] • Default 20 • Hard Cap 200 • Default Sort DESC (Newest First).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      currentUser &&
                      !rbacPermissionService.hasPermission(currentUser, 'GRID_SETTINGS_MANAGE')
                    ) {
                      setGridSettingsSavedMsg('RBAC Denied: GRID_SETTINGS_MANAGE permission required.');
                      return;
                    }
                    const saved = dataGridService.saveGlobalGridSettings(
                      gridSettings,
                      currentUser?.fullName || 'Platform Admin'
                    );
                    setGridSettings(saved);
                    setGridSettingsSavedMsg(
                      `Saved Global Data Grid settings (Default ${saved.defaultPageSize}/page, Max Cap ${saved.maxPageSize}, Export Cap ${saved.maxExportRecords.toLocaleString()}).`
                    );
                  }}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Save Grid Settings
                </button>
              </div>

              {gridSettingsSavedMsg && (
                <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold text-[11px]">
                  {gridSettingsSavedMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Default Rows Per Page</label>
                  <select
                    value={gridSettings.defaultPageSize}
                    onChange={(e) =>
                      setGridSettings({ ...gridSettings, defaultPageSize: Number(e.target.value) || 20 })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs"
                  >
                    {STANDARD_PAGE_SIZE_OPTIONS.map((sz) => (
                      <option key={sz} value={sz}>
                        {sz} rows {sz === 20 ? '(Standard Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max Page Size Hard Cap</label>
                  <input
                    type="number"
                    min={20}
                    max={200}
                    value={gridSettings.maxPageSize}
                    onChange={(e) =>
                      setGridSettings({
                        ...gridSettings,
                        maxPageSize: Math.min(200, Math.max(20, Number(e.target.value) || 200)),
                      })
                    }
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max Export Records Cap</label>
                  <input
                    type="number"
                    min={100}
                    max={100000}
                    value={gridSettings.maxExportRecords}
                    onChange={(e) =>
                      setGridSettings({
                        ...gridSettings,
                        maxExportRecords: Number(e.target.value) || 50000,
                      })
                    }
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max Export File Size (MB)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={Math.round(gridSettings.maxExportFileSizeBytes / (1024 * 1024))}
                    onChange={(e) =>
                      setGridSettings({
                        ...gridSettings,
                        maxExportFileSizeBytes: (Number(e.target.value) || 15) * 1024 * 1024,
                      })
                    }
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs"
                  />
                </div>
              </div>
            </div>

            {/* RBAC INVENTORY, AGING & GRID PERMISSIONS MATRIX */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-600" />
                    <span>RBAC Inventory, Cross-Branch, Dual Aging & Grid Permissions Matrix (13 Permissions)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Non-admin roles are never auto-granted sensitive inventory, cross-branch, override, or full-dataset export rights.
                  </p>
                </div>
                <select
                  value={selectedRbacRole}
                  onChange={(e) => setSelectedRbacRole(e.target.value as UserRole)}
                  className="p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs"
                >
                  {(Object.keys(rolePermsMap) as UserRole[]).map((r) => (
                    <option key={r} value={r}>
                      Role: {r}
                    </option>
                  ))}
                </select>
              </div>

              {rbacNotice && (
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-[11px]">
                  {rbacNotice}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {ENTERPRISE_PERMISSION_CATALOG.map((perm) => {
                  const granted = (rolePermsMap[selectedRbacRole] || []).includes(perm.key);
                  return (
                    <label
                      key={perm.key}
                      className={`p-2.5 rounded-lg border flex items-start justify-between gap-2 cursor-pointer ${
                        granted ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono font-bold text-[11px] text-slate-900">{perm.key}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              perm.sensitivity === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-800'
                                : perm.sensitivity === 'HIGH'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {perm.sensitivity}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{perm.description}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={granted}
                        onChange={(e) => {
                          const actor = {
                            id: currentUser?.id || 'usr-admin',
                            name: currentUser?.fullName || 'Platform Admin',
                          };
                          if (e.target.checked) {
                            rbacPermissionService.grantRolePermission(
                              selectedRbacRole,
                              perm.key as EnterprisePermissionKey,
                              actor
                            );
                            setRbacNotice(`Granted ${perm.key} to ${selectedRbacRole}.`);
                          } else {
                            rbacPermissionService.revokeRolePermission(
                              selectedRbacRole,
                              perm.key as EnterprisePermissionKey,
                              actor
                            );
                            setRbacNotice(`Revoked ${perm.key} from ${selectedRbacRole}.`);
                          }
                          setRolePermsMap(rbacPermissionService.getRolePermissionsMap());
                        }}
                        className="w-4 h-4 accent-emerald-600 mt-0.5 shrink-0"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          )}
        </div>
      )}

      {!isDashboardView && selectedModuleId === 'supplier-module' && (
        <div className="space-y-5">
          <BackButton />
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <span>Statutory Compliance & Verification Governance (GST & MSME)</span>
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  Configure whether GST and MSME/Udyam validations require mandatory online gateway verification or manual entry with certificate document uploads and manual validation during Business Partner and Enterprise Company onboarding.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const reset = complianceGovernanceService.resetComplianceSettings(currentUser?.fullName);
                    setComplianceSettings(reset);
                    setComplianceNotice('Statutory compliance settings reset to enterprise defaults (Validation: Enabled).');
                    setTimeout(() => setComplianceNotice(null), 4000);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs cursor-pointer"
                >
                  Reset Defaults
                </button>
                <button
                  type="button"
                  onClick={() => {
                    complianceGovernanceService.saveComplianceSettings(
                      complianceSettings,
                      currentUser?.fullName
                    );
                    setComplianceNotice('Statutory compliance settings successfully saved.');
                    setTimeout(() => setComplianceNotice(null), 4000);
                  }}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" /> Save Settings
                </button>
              </div>
            </div>

            {complianceNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl font-bold text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{complianceNotice}</span>
              </div>
            )}

            {/* 1. GST VALIDATION GOVERNANCE CARD */}
            <div className={`p-4 rounded-xl border transition ${
              complianceSettings.gstValidationEnabled
                ? 'bg-indigo-50/40 border-indigo-200'
                : 'bg-amber-50/40 border-amber-200'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${
                    complianceSettings.gstValidationEnabled
                      ? 'bg-indigo-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}>
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">GST Validation Governance</h4>
                    <p className="text-[11px] text-slate-500">
                      Governs GSTIN validation during Business Partner creation and Enterprise Company creation.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold font-mono border ${
                    complianceSettings.gstValidationEnabled
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {complianceSettings.gstValidationEnabled ? '● ONLINE VERIFICATION ENABLED' : '● MANUAL ENTRY & FILE UPLOAD'}
                  </span>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      aria-label="Toggle GST Validation Policy"
                      checked={complianceSettings.gstValidationEnabled}
                      onChange={(e) => {
                        const updated = complianceGovernanceService.saveComplianceSettings(
                          { gstValidationEnabled: e.target.checked },
                          currentUser?.fullName
                        );
                        setComplianceSettings(updated);
                        setComplianceNotice(
                          `GST Validation is now ${e.target.checked ? 'ENABLED (Online Verification required)' : 'DISABLED (Manual entry with file upload & manual validation)'}.`
                        );
                        setTimeout(() => setComplianceNotice(null), 4000);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>

              {/* GST Explanatory Banner */}
              {complianceSettings.gstValidationEnabled ? (
                <div className="p-3 bg-white rounded-lg border border-indigo-200 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Online Verification Policy Enforced:</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    When GST Validation is <strong>Enabled</strong>, live verification against official tax gateways (ClearTax API or Govt GSTN CAPTCHA) is strictly enforced during Business Partner creation and Company creation. Legal Name and Trade Name are locked to official taxpayer registry records, and only ACTIVE GST registrations can be saved.
                  </p>
                  <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px]">
                    <span className="text-slate-500">Active Verification Mode:</span>
                    <label className="flex items-center gap-1.5 font-bold text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="gstVerificationMode"
                        checked={gstMode === 'PAID_API'}
                        onChange={() => {
                          setGstModeState('PAID_API');
                          setGstVerificationMode('PAID_API');
                        }}
                        className="text-indigo-600"
                      />
                      <span>Paid B2B API Gateway</span>
                    </label>
                    <label className="flex items-center gap-1.5 font-bold text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="gstVerificationMode"
                        checked={gstMode === 'MANUAL_CAPTCHA'}
                        onChange={() => {
                          setGstModeState('MANUAL_CAPTCHA');
                          setGstVerificationMode('MANUAL_CAPTCHA');
                        }}
                        className="text-indigo-600"
                      />
                      <span>Official Portal CAPTCHA Challenge</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-white rounded-lg border border-amber-200 space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 text-amber-900 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Manual Entry & Document Upload Policy Active:</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    When GST Validation is <strong>Disabled</strong>, live gateway verification is bypassed. Users type the GSTIN number directly. Supporting documentation (official GST Registration Certificate) is uploaded as a file, and compliance officers manually validate the registration before or after onboarding.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100 text-[11px]">
                    <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={complianceSettings.gstRequireDocumentUpload}
                        onChange={(e) => {
                          const updated = complianceGovernanceService.saveComplianceSettings(
                            { gstRequireDocumentUpload: e.target.checked },
                            currentUser?.fullName
                          );
                          setComplianceSettings(updated);
                        }}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <span>Require GST Certificate File Upload on Creation</span>
                    </label>
                    <div>
                      <span className="text-slate-500 block mb-0.5">Initial Compliance Status:</span>
                      <select
                        value={complianceSettings.gstDefaultStatusOnUpload}
                        onChange={(e) => {
                          const updated = complianceGovernanceService.saveComplianceSettings(
                            { gstDefaultStatusOnUpload: e.target.value as any },
                            currentUser?.fullName
                          );
                          setComplianceSettings(updated);
                        }}
                        className="p-1.5 bg-slate-50 border border-slate-300 rounded font-bold text-xs"
                      >
                        <option value="PENDING_MANUAL_VALIDATION">Pending Manual Verification (Recommended)</option>
                        <option value="MANUALLY_VERIFIED">Pre-Approved / Self-Attested</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. MSME / UDYAM VALIDATION GOVERNANCE CARD */}
            <div className={`p-4 rounded-xl border transition ${
              complianceSettings.msmeValidationEnabled
                ? 'bg-indigo-50/40 border-indigo-200'
                : 'bg-amber-50/40 border-amber-200'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${
                    complianceSettings.msmeValidationEnabled
                      ? 'bg-indigo-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">MSME / Udyam Validation Governance</h4>
                    <p className="text-[11px] text-slate-500">
                      Governs Udyam registration number verification during Business Partner and Company creation.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold font-mono border ${
                    complianceSettings.msmeValidationEnabled
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {complianceSettings.msmeValidationEnabled ? '● ONLINE REGISTRY LOOKUP ENABLED' : '● MANUAL ENTRY & FILE UPLOAD'}
                  </span>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      aria-label="Toggle MSME Validation Policy"
                      checked={complianceSettings.msmeValidationEnabled}
                      onChange={(e) => {
                        const updated = complianceGovernanceService.saveComplianceSettings(
                          { msmeValidationEnabled: e.target.checked },
                          currentUser?.fullName
                        );
                        setComplianceSettings(updated);
                        setComplianceNotice(
                          `MSME Validation is now ${e.target.checked ? 'ENABLED (Official Udyam lookup required)' : 'DISABLED (Manual entry with file upload & manual validation)'}.`
                        );
                        setTimeout(() => setComplianceNotice(null), 4000);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>

              {/* MSME Explanatory Banner */}
              {complianceSettings.msmeValidationEnabled ? (
                <div className="p-3 bg-white rounded-lg border border-indigo-200 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Online Udyam Verification Policy Enforced:</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    When MSME Validation is <strong>Enabled</strong>, Udyam registration is validated against official Udyam registries. Enterprise classification (Micro, Small, Medium), major activity type (Manufacturing, Services, Both), and registered unit locations are automatically fetched and verified.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-white rounded-lg border border-amber-200 space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 text-amber-900 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Manual Entry & Document Upload Policy Active:</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    When MSME Validation is <strong>Disabled</strong>, users type the Udyam Registration Number directly and select their classification and activity type. Users upload the official Udyam Registration Certificate file, which is then manually reviewed and validated by compliance officers.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100 text-[11px]">
                    <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={complianceSettings.msmeRequireDocumentUpload}
                        onChange={(e) => {
                          const updated = complianceGovernanceService.saveComplianceSettings(
                            { msmeRequireDocumentUpload: e.target.checked },
                            currentUser?.fullName
                          );
                          setComplianceSettings(updated);
                        }}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <span>Require Udyam Certificate File Upload on Creation</span>
                    </label>
                    <div>
                      <span className="text-slate-500 block mb-0.5">Initial Compliance Status:</span>
                      <select
                        value={complianceSettings.msmeDefaultStatusOnUpload}
                        onChange={(e) => {
                          const updated = complianceGovernanceService.saveComplianceSettings(
                            { msmeDefaultStatusOnUpload: e.target.value as any },
                            currentUser?.fullName
                          );
                          setComplianceSettings(updated);
                        }}
                        className="p-1.5 bg-slate-50 border border-slate-300 rounded font-bold text-xs"
                      >
                        <option value="PENDING_MANUAL_VALIDATION">Pending Manual Verification (Recommended)</option>
                        <option value="MANUALLY_VERIFIED">Pre-Approved / Self-Attested</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. CROSS-MODULE ENFORCEMENT SUMMARY MATRIX */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <Table className="w-4 h-4 text-indigo-600" />
                <span>Active Policy Enforcement Across System Creation Modules</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>Business Partner Creation</span>
                    <span className="text-[10px] text-indigo-600 font-mono">/business-partners</span>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div>
                      • GST Verification:{' '}
                      <strong className={complianceSettings.gstValidationEnabled ? 'text-indigo-700' : 'text-amber-700'}>
                        {complianceSettings.gstValidationEnabled
                          ? 'Online Gateway (Paid API / CAPTCHA)'
                          : 'Manual Entry + File Upload + Manual Validation'}
                      </strong>
                    </div>
                    <div>
                      • MSME Verification:{' '}
                      <strong className={complianceSettings.msmeValidationEnabled ? 'text-indigo-700' : 'text-amber-700'}>
                        {complianceSettings.msmeValidationEnabled
                          ? 'Online Udyam API Lookup'
                          : 'Manual Entry + Certificate Upload + Manual Validation'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>Enterprise Company Creation</span>
                    <span className="text-[10px] text-indigo-600 font-mono">/organizations</span>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div>
                      • GST Verification:{' '}
                      <strong className={complianceSettings.gstValidationEnabled ? 'text-indigo-700' : 'text-amber-700'}>
                        {complianceSettings.gstValidationEnabled
                          ? 'Online Gateway (Paid API / CAPTCHA)'
                          : 'Manual Entry + File Upload + Manual Validation'}
                      </strong>
                    </div>
                    <div>
                      • MSME Verification:{' '}
                      <strong className={complianceSettings.msmeValidationEnabled ? 'text-indigo-700' : 'text-amber-700'}>
                        {complianceSettings.msmeValidationEnabled
                          ? 'Online Udyam API Lookup'
                          : 'Manual Entry + Certificate Upload + Manual Validation'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isDashboardView && selectedModuleId === 'customer-module' && (
        <div className="space-y-5">
          <BackButton />
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h3 className="font-bold text-lg text-slate-900">Customer Management Configuration</h3>
            <p className="text-slate-500 mt-2">Customer management module configuration is currently being initialized for the selected enterprise scope.</p>
          </div>
        </div>
      )}

      {!isDashboardView && selectedModuleId === 'warehouse-module' && (
        <div className="space-y-5">
          <BackButton />
          <WarehouseSetupView />
        </div>
      )}

      {!isDashboardView && selectedModuleId === 'buyer-module' && (
        <div className="space-y-5">
          <BackButton />
          <BuyerManagementView />
        </div>
      )}

      {!isDashboardView && selectedModuleId === 'rfq-module' && (
        <div className="space-y-5">
          <BackButton />
          <RfqPolicyView
            currentUser={currentUser}
            companies={companies}
            branches={branches}
            onNavigate={onNavigate}
            hideHeader={false}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB: FINANCIAL YEAR & ACCOUNTING PERIOD MANAGEMENT                 */}
      {/* ------------------------------------------------------------------ */}
      {!isDashboardView && selectedModuleId === 'fy-module' && (
        <div className="space-y-5">
          <BackButton />
          <FinancialYearManagementView
            companyId={selectedPolicyCompanyId}
            currentUser={currentUser}
          />
        </div>
      )}

      {/* ADD / EDIT PROVIDER MODAL                                         */}
      {/* ------------------------------------------------------------------ */}
      {isModalOpen && editingProvider && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-sm">
                    {editingProvider.id.includes('new') ? 'Configure New API Gateway' : `Edit ${editingProvider.displayName}`}
                  </h3>
                  <p className="text-xs text-slate-300">Set up credentials, quota balance, daily limit, and rotation strategy.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Service Type *</label>
                  <select
                    value={editingProvider.serviceType}
                    onChange={(e) => {
                      const st = e.target.value as 'GST' | 'MSME';
                      const tpl = getTemplateConfig(st === 'GST' ? 'CLEAR_TAX' : 'UDYAM_GOVT_SANDBOX', st);
                      setEditingProvider({ ...editingProvider, serviceType: st, ...tpl });
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="GST">GST Verification Service</option>
                    <option value="MSME">MSME / Udyam Verification Service</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Preset Provider Template</label>
                  <select
                    value={editingProvider.providerName}
                    onChange={(e) => {
                      const tpl = getTemplateConfig(e.target.value, editingProvider.serviceType);
                      setEditingProvider({ ...editingProvider, ...tpl });
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  >
                    {editingProvider.serviceType === 'GST' ? (
                      <>
                        <option value="CLEAR_TAX">ClearTax GST API (Recommended)</option>
                        <option value="IRIS_GST">IRIS GST Peridot Enterprise</option>
                        <option value="MASTERS_INDIA">Masters India GST Gateway</option>
                        <option value="GOVT_DIRECT_SANDBOX">Official Govt GSTN Developer Sandbox</option>
                        <option value="CUSTOM_REST">Custom Enterprise REST Endpoint</option>
                      </>
                    ) : (
                      <>
                        <option value="UDYAM_GOVT_SANDBOX">Official Udyam Govt Sandbox (Recommended)</option>
                        <option value="CLEARTAX_MSME">ClearTax MSME & Udyam Gateway</option>
                        <option value="MASTERS_INDIA_MSME">Masters India Udyam Verification API</option>
                        <option value="CUSTOM_REST">Custom Enterprise MSME Gateway</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Display Name *</label>
                  <input
                    type="text"
                    value={editingProvider.displayName}
                    onChange={(e) => setEditingProvider({ ...editingProvider, displayName: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Endpoint URL *</label>
                  <input
                    type="text"
                    value={editingProvider.endpointUrl}
                    onChange={(e) => setEditingProvider({ ...editingProvider, endpointUrl: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total Credits</label>
                  <input
                    type="number"
                    value={editingProvider.totalCredits}
                    onChange={(e) => setEditingProvider({ ...editingProvider, totalCredits: Number(e.target.value) || 0 })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Remaining Balance</label>
                  <input
                    type="number"
                    value={editingProvider.remainingCredits}
                    onChange={(e) => setEditingProvider({ ...editingProvider, remainingCredits: Number(e.target.value) || 0 })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Daily Limit</label>
                  <input
                    type="number"
                    value={editingProvider.dailyLimit}
                    onChange={(e) => setEditingProvider({ ...editingProvider, dailyLimit: Number(e.target.value) || 0 })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Priority</label>
                  <input
                    type="number"
                    value={editingProvider.priority}
                    onChange={(e) => setEditingProvider({ ...editingProvider, priority: Number(e.target.value) || 1 })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              {modalTestStatus && (
                <div
                  className={`p-3 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                    modalTestStatus.success ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'
                  }`}
                >
                  {modalTestStatus.success ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{modalTestStatus.msg}</span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={handleModalTest}
                disabled={isModalTesting}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                {isModalTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
                <span>Test Connection</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalProvider}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Save Provider
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
