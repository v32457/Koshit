import React, { useState, useMemo } from 'react';
import {
  PurchaseOrganization,
  BuyerManagerAssignmentRule,
  PurchasingModel,
  AssignmentRole,
  EffectiveRoleAssignment,
  TemporaryDelegation,
  AssignmentHistoryRecord,
} from '../../types/purchaseOrganization';
import { PurchaseOrganizationService, CompanyPurchasingModelConfig } from '../../services/purchaseOrganizationService';
import { EnterpriseAuditService, EnterpriseAuditRecord } from '../../services/enterpriseAuditService';
import { AuditDetailModal } from '../../components/AuditDetailModal';
import { INITIAL_COMPANIES, INITIAL_BRANCHES, INITIAL_USERS } from '../../data/seedData';
import { CLASSIFICATION_DIMENSIONS } from '../../data/seedData';
import { EnterpriseModal } from '../../components/EnterpriseModal';
import { SearchableUserSelect } from '../../components/SearchableUserSelect';
import {
  Plus,
  Building2,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Edit2,
  Users,
  Check,
  AlertTriangle,
  Search,
  Sliders,
  X,
  Play,
  FileText,
  MapPin,
  HelpCircle,
  Calendar,
  Clock,
  History,
  UserPlus,
  ShieldAlert,
  UserCheck,
  ArrowRight,
  Filter,
  RefreshCw,
  Download,
  Eye,
  Lock,
} from 'lucide-react';

interface PurchaseOrganizationViewProps {
  companies?: any[];
  branches?: any[];
}

export const PurchaseOrganizationView: React.FC<PurchaseOrganizationViewProps> = ({
  companies: parentCompanies,
  branches: parentBranches,
}) => {
  const companiesList = parentCompanies || INITIAL_COMPANIES;
  const branchesList = parentBranches || INITIAL_BRANCHES;

  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'models' | 'branches' | 'rules' | 'history'>('dashboard');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('ALL');

  // Master Data & History States
  const [organizations, setOrganizations] = useState<PurchaseOrganization[]>(() => PurchaseOrganizationService.getOrganizations());
  const [companyModels, setCompanyModels] = useState<CompanyPurchasingModelConfig[]>(() => PurchaseOrganizationService.getCompanyModels());
  const [rules, setRules] = useState<BuyerManagerAssignmentRule[]>(() => PurchaseOrganizationService.getAssignmentRules());
  const [historyLogs, setHistoryLogs] = useState<AssignmentHistoryRecord[]>(() => PurchaseOrganizationService.getAssignmentHistory());
  const [effectiveAssignments, setEffectiveAssignments] = useState<EffectiveRoleAssignment[]>(() => PurchaseOrganizationService.getEffectiveRoleAssignments());

  // Branch Assignments State: Map<OrgId, BranchId[]>
  const [orgBranchMap, setOrgBranchMap] = useState<Record<string, string[]>>({
    'po-kosh-01': ['br-pond-01', 'br-pune-04', 'br-far-006'],
    'po-kosh-02': ['br-chen-02', 'br-hosr-03'],
    'po-kosh-03': ['br-snd-007', 'br-hll-008'],
  });

  // Modal State for Add/Edit PO
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<PurchaseOrganization | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // Form State with Validity Dates
  const [formData, setFormData] = useState<{
    companyId: string;
    code: string;
    name: string;
    model: PurchasingModel;
    parentPoId: string;
    description: string;
    effectiveFrom: string;
    effectiveTo: string;
    status: 'ACTIVE' | 'INACTIVE';
    assignedBranches: string[];

    // 4 Role User Selections & Dates
    primaryBuyerId: string;
    primaryBuyerName: string;
    primaryBuyerValidFrom: string;
    primaryBuyerValidTo: string;

    secondaryBuyerId: string;
    secondaryBuyerName: string;
    secondaryBuyerValidFrom: string;
    secondaryBuyerValidTo: string;

    primaryManagerId: string;
    primaryManagerName: string;
    primaryManagerValidFrom: string;
    primaryManagerValidTo: string;

    secondaryManagerId: string;
    secondaryManagerName: string;
    secondaryManagerValidFrom: string;
    secondaryManagerValidTo: string;
  }>({
    companyId: companiesList[0]?.id || 'co-kosh-01',
    code: '',
    name: '',
    model: 'CENTRALIZED',
    parentPoId: '',
    description: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
    status: 'ACTIVE',
    assignedBranches: [],

    primaryBuyerId: 'usr-buyer-01',
    primaryBuyerName: 'Vikram Singh',
    primaryBuyerValidFrom: '2026-01-01',
    primaryBuyerValidTo: '',

    secondaryBuyerId: 'usr-maker-02',
    secondaryBuyerName: 'Ananya Deshmukh',
    secondaryBuyerValidFrom: '2026-01-01',
    secondaryBuyerValidTo: '',

    primaryManagerId: 'usr-checker-03',
    primaryManagerName: 'Venkatesh Iyer',
    primaryManagerValidFrom: '2026-01-01',
    primaryManagerValidTo: '',

    secondaryManagerId: 'usr-mgr-02',
    secondaryManagerName: 'Priya Ramachandran',
    secondaryManagerValidFrom: '2026-01-01',
    secondaryManagerValidTo: '',
  });

  // Scheduling Future Assignment Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState<{
    poId: string;
    companyId: string;
    role: AssignmentRole;
    userId: string;
    userName: string;
    employeeId?: string;
    validFrom: string;
    validTo: string;
    reason: string;
  }>({
    poId: 'po-kosh-01',
    companyId: 'co-kosh-01',
    role: 'PRIMARY_BUYER',
    userId: '',
    userName: '',
    validFrom: new Date().toISOString().split('T')[0],
    validTo: '',
    reason: '',
  });

  // Temporary Replacement (Delegation) Modal State
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
  const [delegateData, setDelegateData] = useState<{
    assignmentId: string;
    poId: string;
    role: AssignmentRole;
    originalUserName: string;
    replacementUserId: string;
    replacementUserName: string;
    replacementEmployeeId?: string;
    replacementDesignation?: string;
    replacementEmail?: string;
    validFrom: string;
    validTo: string;
    reason: string;
    authorizedBy: string;
  }>({
    assignmentId: '',
    poId: '',
    role: 'PRIMARY_BUYER',
    originalUserName: '',
    replacementUserId: '',
    replacementUserName: '',
    validFrom: new Date().toISOString().split('T')[0],
    validTo: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0], // 14 days default
    reason: 'Medical leave coverage',
    authorizedBy: 'Rajesh Sharma (Platform Admin)',
  });

  // History Filter & Audit Log State
  const [histPoFilter, setHistPoFilter] = useState<string>('ALL');
  const [histRoleFilter, setHistRoleFilter] = useState<string>('ALL');
  const [histUserFilter, setHistUserFilter] = useState<string>('');
  const [auditEntityTypeFilter, setAuditEntityTypeFilter] = useState<string>('ALL');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');

  const [selectedAuditRecord, setSelectedAuditRecord] = useState<EnterpriseAuditRecord | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditVerificationResult, setAuditVerificationResult] = useState<{
    isValid: boolean;
    totalRecords: number;
    message: string;
  } | null>(null);

  // Rule Form State & Modal
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BuyerManagerAssignmentRule | null>(null);
  const [ruleFormData, setRuleFormData] = useState({
    companyId: companiesList[0]?.id || 'co-kosh-01',
    branchId: 'ALL',
    itemCategoryId: 'ALL',
    materialId: 'ALL',
    purchaseOrganizationId: '',
    primaryBuyerId: 'usr-buyer-01',
    secondaryBuyerId: '',
    backupBuyerId: '',
    primaryManagerId: 'usr-checker-03',
    alternateManagerId: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    remarks: '',
  });

  // Simulator State
  const [simCompanyId, setSimCompanyId] = useState(companiesList[0]?.id || 'co-kosh-01');
  const [simBranchId, setSimBranchId] = useState('br-pond-01');
  const [simCategory, setSimCategory] = useState('RM');
  const [simMaterial, setSimMaterial] = useState('RMPAOPOEXLG0001');
  const [simPoId, setSimPoId] = useState('po-kosh-01');
  const [simTargetDate, setSimTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [simResult, setSimResult] = useState<any>(null);

  // Filtered Orgs
  const filteredOrgs = useMemo(() => {
    if (selectedCompanyFilter === 'ALL') return organizations;
    return organizations.filter(o => o.companyId === selectedCompanyFilter);
  }, [organizations, selectedCompanyFilter]);

  // Model Config Handler
  const handleModelChange = (coId: string, model: PurchasingModel) => {
    PurchaseOrganizationService.saveCompanyModel(coId, model);
    setCompanyModels(PurchaseOrganizationService.getCompanyModels());
  };

  // Save Rule Handler
  const handleSaveRule = () => {
    if (!ruleFormData.primaryBuyerId || !ruleFormData.primaryManagerId) {
      alert('Primary Buyer and Primary Purchasing Manager are required.');
      return;
    }

    const ruleToSave: BuyerManagerAssignmentRule = {
      id: editingRule ? editingRule.id : `rule-${Date.now()}`,
      companyId: ruleFormData.companyId,
      branchId: ruleFormData.branchId,
      itemCategoryId: ruleFormData.itemCategoryId,
      materialId: ruleFormData.materialId,
      purchaseOrganizationId: ruleFormData.purchaseOrganizationId || undefined,
      primaryBuyerId: ruleFormData.primaryBuyerId,
      secondaryBuyerId: ruleFormData.secondaryBuyerId || undefined,
      backupBuyerId: ruleFormData.backupBuyerId || undefined,
      primaryManagerId: ruleFormData.primaryManagerId,
      alternateManagerId: ruleFormData.alternateManagerId || undefined,
      effectiveFrom: ruleFormData.effectiveFrom,
      priority: 1,
      status: ruleFormData.status,
      remarks: ruleFormData.remarks,
    };

    PurchaseOrganizationService.saveAssignmentRule(ruleToSave);
    setRules(PurchaseOrganizationService.getAssignmentRules());
    setIsRuleModalOpen(false);
  };

  // Open Create/Edit PO Modal
  const handleOpenModal = (org?: PurchaseOrganization) => {
    if (org) {
      setEditingOrg(org);
      const pbRes = PurchaseOrganizationService.resolveEffectiveUserForDate(org.id, 'PRIMARY_BUYER');
      const sbRes = PurchaseOrganizationService.resolveEffectiveUserForDate(org.id, 'SECONDARY_BUYER');
      const pmRes = PurchaseOrganizationService.resolveEffectiveUserForDate(org.id, 'PRIMARY_MANAGER');
      const smRes = PurchaseOrganizationService.resolveEffectiveUserForDate(org.id, 'SECONDARY_MANAGER');

      setFormData({
        companyId: org.companyId,
        code: org.code,
        name: org.name,
        model: org.model,
        parentPoId: '',
        description: org.description || '',
        effectiveFrom: org.effectiveFrom || new Date().toISOString().split('T')[0],
        effectiveTo: org.effectiveTo || '',
        status: org.status,
        assignedBranches: orgBranchMap[org.id] || [],

        primaryBuyerId: pbRes.userId !== 'UNASSIGNED' ? pbRes.userId : (org.primaryBuyerId || 'usr-buyer-01'),
        primaryBuyerName: pbRes.userName !== 'Unassigned User' ? pbRes.userName : (org.primaryBuyerName || 'Vikram Singh'),
        primaryBuyerValidFrom: pbRes.assignmentRecord?.validFrom || '2026-01-01',
        primaryBuyerValidTo: pbRes.assignmentRecord?.validTo || '',

        secondaryBuyerId: sbRes.userId !== 'UNASSIGNED' ? sbRes.userId : (org.secondaryBuyerId || ''),
        secondaryBuyerName: sbRes.userName !== 'Unassigned User' ? sbRes.userName : (org.secondaryBuyerName || ''),
        secondaryBuyerValidFrom: sbRes.assignmentRecord?.validFrom || '2026-01-01',
        secondaryBuyerValidTo: sbRes.assignmentRecord?.validTo || '',

        primaryManagerId: pmRes.userId !== 'UNASSIGNED' ? pmRes.userId : (org.primaryManagerId || 'usr-checker-03'),
        primaryManagerName: pmRes.userName !== 'Unassigned User' ? pmRes.userName : (org.primaryManagerName || 'Venkatesh Iyer'),
        primaryManagerValidFrom: pmRes.assignmentRecord?.validFrom || '2026-01-01',
        primaryManagerValidTo: pmRes.assignmentRecord?.validTo || '',

        secondaryManagerId: smRes.userId !== 'UNASSIGNED' ? smRes.userId : (org.secondaryManagerId || ''),
        secondaryManagerName: smRes.userName !== 'Unassigned User' ? smRes.userName : (org.secondaryManagerName || ''),
        secondaryManagerValidFrom: smRes.assignmentRecord?.validFrom || '2026-01-01',
        secondaryManagerValidTo: smRes.assignmentRecord?.validTo || '',
      });
    } else {
      setEditingOrg(null);
      const coId = selectedCompanyFilter === 'ALL' ? (companiesList[0]?.id || 'co-kosh-01') : selectedCompanyFilter;
      const count = organizations.filter(o => o.companyId === coId).length + 1;
      const today = new Date().toISOString().split('T')[0];

      setFormData({
        companyId: coId,
        code: `PO-${coId.replace('co-kosh-', 'KOSH-').toUpperCase()}-0${count}`,
        name: `Procurement Org ${count}`,
        model: 'CENTRALIZED',
        parentPoId: '',
        description: '',
        effectiveFrom: today,
        effectiveTo: '',
        status: 'ACTIVE',
        assignedBranches: branchesList.filter(b => b.companyId === coId).map(b => b.id),

        primaryBuyerId: 'usr-buyer-01',
        primaryBuyerName: 'Vikram Singh',
        primaryBuyerValidFrom: today,
        primaryBuyerValidTo: '',

        secondaryBuyerId: 'usr-maker-02',
        secondaryBuyerName: 'Ananya Deshmukh',
        secondaryBuyerValidFrom: today,
        secondaryBuyerValidTo: '',

        primaryManagerId: 'usr-checker-03',
        primaryManagerName: 'Venkatesh Iyer',
        primaryManagerValidFrom: today,
        primaryManagerValidTo: '',

        secondaryManagerId: 'usr-mgr-02',
        secondaryManagerName: 'Priya Ramachandran',
        secondaryManagerValidFrom: today,
        secondaryManagerValidTo: '',
      });
    }
    setIsMinimized(false);
    setIsMaximized(false);
    setIsModalOpen(true);
  };

  const handleSavePO = () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      alert('Organization Code and Organization Name are required.');
      return;
    }

    if (!formData.primaryBuyerId) {
      alert('Primary Buyer Assignment is required.');
      return;
    }

    if (!formData.primaryManagerId) {
      alert('Primary Purchasing Manager Assignment is required.');
      return;
    }

    const targetPoId = editingOrg ? editingOrg.id : `po-${Date.now()}`;

    const orgToSave: PurchaseOrganization = {
      id: targetPoId,
      companyId: formData.companyId,
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      model: formData.model,
      description: formData.description,
      effectiveFrom: formData.effectiveFrom,
      effectiveTo: formData.effectiveTo || undefined,
      status: formData.status,
      primaryBuyerId: formData.primaryBuyerId,
      primaryBuyerName: formData.primaryBuyerName,
      secondaryBuyerId: formData.secondaryBuyerId || undefined,
      secondaryBuyerName: formData.secondaryBuyerName || undefined,
      primaryManagerId: formData.primaryManagerId,
      primaryManagerName: formData.primaryManagerName,
      secondaryManagerId: formData.secondaryManagerId || undefined,
      secondaryManagerName: formData.secondaryManagerName || undefined,
      createdAt: editingOrg ? editingOrg.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    PurchaseOrganizationService.saveOrganization(orgToSave);

    // Save Effective-Dated Role Assignments for all 4 roles
    const currentAdmin = 'Rajesh Sharma (Platform Admin)';

    // Primary Buyer
    PurchaseOrganizationService.saveEffectiveRoleAssignment({
      purchaseOrganizationId: targetPoId,
      companyId: formData.companyId,
      role: 'PRIMARY_BUYER',
      userId: formData.primaryBuyerId,
      userName: formData.primaryBuyerName,
      validFrom: formData.primaryBuyerValidFrom || formData.effectiveFrom,
      validTo: formData.primaryBuyerValidTo || undefined,
      changeReason: editingOrg ? 'Updated Primary Buyer assignment' : 'Initial Primary Buyer setup',
      changedBy: currentAdmin,
    });

    // Secondary Buyer
    if (formData.secondaryBuyerId) {
      PurchaseOrganizationService.saveEffectiveRoleAssignment({
        purchaseOrganizationId: targetPoId,
        companyId: formData.companyId,
        role: 'SECONDARY_BUYER',
        userId: formData.secondaryBuyerId,
        userName: formData.secondaryBuyerName,
        validFrom: formData.secondaryBuyerValidFrom || formData.effectiveFrom,
        validTo: formData.secondaryBuyerValidTo || undefined,
        changeReason: editingOrg ? 'Updated Secondary Buyer assignment' : 'Initial Secondary Buyer setup',
        changedBy: currentAdmin,
      });
    }

    // Primary Manager
    PurchaseOrganizationService.saveEffectiveRoleAssignment({
      purchaseOrganizationId: targetPoId,
      companyId: formData.companyId,
      role: 'PRIMARY_MANAGER',
      userId: formData.primaryManagerId,
      userName: formData.primaryManagerName,
      validFrom: formData.primaryManagerValidFrom || formData.effectiveFrom,
      validTo: formData.primaryManagerValidTo || undefined,
      changeReason: editingOrg ? 'Updated Primary Manager assignment' : 'Initial Primary Manager setup',
      changedBy: currentAdmin,
    });

    // Secondary Manager
    if (formData.secondaryManagerId) {
      PurchaseOrganizationService.saveEffectiveRoleAssignment({
        purchaseOrganizationId: targetPoId,
        companyId: formData.companyId,
        role: 'SECONDARY_MANAGER',
        userId: formData.secondaryManagerId,
        userName: formData.secondaryManagerName,
        validFrom: formData.secondaryManagerValidFrom || formData.effectiveFrom,
        validTo: formData.secondaryManagerValidTo || undefined,
        changeReason: editingOrg ? 'Updated Secondary Manager assignment' : 'Initial Secondary Manager setup',
        changedBy: currentAdmin,
      });
    }

    // Refresh state
    setOrganizations(PurchaseOrganizationService.getOrganizations());
    setEffectiveAssignments(PurchaseOrganizationService.getEffectiveRoleAssignments());
    setHistoryLogs(PurchaseOrganizationService.getAssignmentHistory());

    // Save branch assignments
    setOrgBranchMap(prev => ({
      ...prev,
      [targetPoId]: formData.assignedBranches,
    }));

    setIsModalOpen(false);
  };

  const handleDeletePO = (id: string) => {
    if (confirm('Are you sure you want to delete this Purchase Organization?')) {
      PurchaseOrganizationService.deleteOrganization(id);
      setOrganizations(PurchaseOrganizationService.getOrganizations());
      setEffectiveAssignments(PurchaseOrganizationService.getEffectiveRoleAssignments());
      setHistoryLogs(PurchaseOrganizationService.getAssignmentHistory());
    }
  };

  // Open Schedule Future Assignment Modal
  const openScheduleModal = (poId: string, role: AssignmentRole) => {
    const targetPoId = poId || editingOrg?.id || organizations[0]?.id || 'po-kosh-01';
    const poObj = organizations.find(o => o.id === targetPoId) || organizations[0];
    setScheduleData({
      poId: poObj?.id || targetPoId,
      companyId: poObj?.companyId || formData.companyId || 'co-kosh-01',
      role,
      userId: '',
      userName: '',
      validFrom: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
      validTo: '',
      reason: 'Scheduled future assignment transition',
    });
    setIsScheduleModalOpen(true);
  };

  const handleSaveScheduledAssignment = () => {
    if (!scheduleData.userId || !scheduleData.validFrom) {
      alert('Selected User and Valid From date are required.');
      return;
    }

    const res = PurchaseOrganizationService.saveEffectiveRoleAssignment({
      purchaseOrganizationId: scheduleData.poId,
      companyId: scheduleData.companyId,
      role: scheduleData.role,
      userId: scheduleData.userId,
      userName: scheduleData.userName,
      employeeId: scheduleData.employeeId,
      validFrom: scheduleData.validFrom,
      validTo: scheduleData.validTo || undefined,
      changeReason: scheduleData.reason || 'Future assignment schedule',
      changedBy: 'Rajesh Sharma (Platform Admin)',
    });

    if (!res.success) {
      alert(res.message);
      return;
    }

    alert(res.message);
    setEffectiveAssignments(PurchaseOrganizationService.getEffectiveRoleAssignments());
    setHistoryLogs(PurchaseOrganizationService.getAssignmentHistory());
    setOrganizations(PurchaseOrganizationService.getOrganizations());
    setIsScheduleModalOpen(false);
  };

  // Open Temporary Delegation Modal
  const openDelegateModal = (poId: string, role: AssignmentRole) => {
    const targetPoId = poId || editingOrg?.id || organizations[0]?.id || 'po-kosh-01';
    const activeRes = PurchaseOrganizationService.resolveEffectiveUserForDate(targetPoId, role);
    const poObj = organizations.find(o => o.id === targetPoId) || organizations[0];
    const assignmentId = activeRes.assignmentRecord?.id || `eff-${targetPoId}-${role}`;

    let activeName = activeRes.userName;
    if (!activeName || activeName === 'Unassigned User') {
      if (role === 'PRIMARY_BUYER') activeName = formData.primaryBuyerName || 'Vikram Singh';
      else if (role === 'SECONDARY_BUYER') activeName = formData.secondaryBuyerName || 'Ananya Deshmukh';
      else if (role === 'PRIMARY_MANAGER') activeName = formData.primaryManagerName || 'Venkatesh Iyer';
      else if (role === 'SECONDARY_MANAGER') activeName = formData.secondaryManagerName || 'Priya Ramachandran';
    }

    setDelegateData({
      assignmentId,
      poId: targetPoId,
      role,
      originalUserName: activeName || 'Current Assigned User',
      replacementUserId: '',
      replacementUserName: '',
      validFrom: new Date().toISOString().split('T')[0],
      validTo: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      reason: 'Short-term leave coverage / delegation',
      authorizedBy: 'Rajesh Sharma (Platform Admin)',
    });
    setIsDelegateModalOpen(true);
  };

  const handleSaveDelegation = () => {
    if (!delegateData.replacementUserId || !delegateData.validFrom || !delegateData.validTo) {
      alert('Replacement User, Valid From, and Valid To dates are required.');
      return;
    }

    const res = PurchaseOrganizationService.addTemporaryDelegation({
      assignmentId: delegateData.assignmentId,
      replacementUserId: delegateData.replacementUserId,
      replacementUserName: delegateData.replacementUserName,
      replacementEmployeeId: delegateData.replacementEmployeeId,
      replacementDesignation: delegateData.replacementDesignation,
      replacementEmail: delegateData.replacementEmail,
      delegationValidFrom: delegateData.validFrom,
      delegationValidTo: delegateData.validTo,
      reason: delegateData.reason,
      authorizedBy: delegateData.authorizedBy,
    });

    if (!res.success) {
      alert(res.message);
      return;
    }

    alert(res.message);
    setEffectiveAssignments(PurchaseOrganizationService.getEffectiveRoleAssignments());
    setHistoryLogs(PurchaseOrganizationService.getAssignmentHistory());
    setIsDelegateModalOpen(false);
  };

  const handleRevokeDelegation = (assignmentId: string) => {
    if (confirm('Are you sure you want to revoke this temporary replacement delegation?')) {
      const res = PurchaseOrganizationService.revokeTemporaryDelegation(assignmentId, 'Manual admin revocation', 'Rajesh Sharma');
      alert(res.message);
      setEffectiveAssignments(PurchaseOrganizationService.getEffectiveRoleAssignments());
      setHistoryLogs(PurchaseOrganizationService.getAssignmentHistory());
    }
  };

  // Run Simulator with Effective Dates
  const handleRunSimulator = () => {
    const res = PurchaseOrganizationService.resolveAssignmentRule({
      companyId: simCompanyId,
      branchId: simBranchId,
      itemCategory: simCategory,
      materialCode: simMaterial,
      purchaseOrganizationId: simPoId,
      targetDate: simTargetDate,
    });
    setSimResult(res);
  };

  // Branch list for current company in modal
  const availableBranchesForCompany = useMemo(() => {
    return branchesList.filter(b => b.companyId === formData.companyId);
  }, [branchesList, formData.companyId]);

  // Filtered History Logs
  const filteredHistoryLogs = useMemo(() => {
    return PurchaseOrganizationService.getAssignmentHistory({
      companyId: selectedCompanyFilter,
      purchaseOrganizationId: histPoFilter,
      role: histRoleFilter as any,
      userId: histUserFilter,
    });
  }, [selectedCompanyFilter, histPoFilter, histRoleFilter, histUserFilter, historyLogs]);

  // Live Enterprise Audit Logs & Metrics
  const auditLogsList = useMemo(() => {
    return EnterpriseAuditService.getAuditLogs({
      companyId: selectedCompanyFilter,
      purchaseOrganizationId: histPoFilter,
      entityType: auditEntityTypeFilter,
      employeeUserId: histUserFilter,
      searchQuery: auditSearchQuery,
    });
  }, [selectedCompanyFilter, histPoFilter, auditEntityTypeFilter, histUserFilter, auditSearchQuery, historyLogs, effectiveAssignments, organizations]);

  const auditMetrics = useMemo(() => {
    return EnterpriseAuditService.getDashboardMetrics({
      companyId: selectedCompanyFilter,
      purchaseOrganizationId: histPoFilter,
    });
  }, [selectedCompanyFilter, histPoFilter, historyLogs, effectiveAssignments, organizations]);

  const handleVerifyAuditChain = async () => {
    const res = await EnterpriseAuditService.verifyAuditChainIntegrity();
    setAuditVerificationResult(res);
  };

  const handleExportAuditCsv = () => {
    EnterpriseAuditService.exportAuditLogsToCsv({
      companyId: selectedCompanyFilter,
      purchaseOrganizationId: histPoFilter,
      entityType: auditEntityTypeFilter,
      employeeUserId: histUserFilter,
      searchQuery: auditSearchQuery,
    });
  };

  const handleExportOrgsCsv = () => {
    const headers = [
      'Org ID',
      'Org Code',
      'Organization Name',
      'Company ID',
      'Company Name',
      'Purchasing Model',
      'Primary Buyer Name',
      'Secondary Buyer Name',
      'Primary Manager Name',
      'Secondary Manager Name',
      'Assigned Branches',
      'Effective From',
      'Status',
    ];

    const rows = filteredOrgs.map((org) => {
      const companyObj = companiesList.find(c => c.id === org.companyId);
      const assignedBranchIds = orgBranchMap[org.id] || [];
      const branchNames = branchesList
        .filter(b => assignedBranchIds.includes(b.id))
        .map(b => b.name)
        .join('; ');

      const pb = PurchaseOrganizationService.resolveEffectiveUserForDate(org.id, 'PRIMARY_BUYER');
      const sb = PurchaseOrganizationService.resolveEffectiveUserForDate(org.id, 'SECONDARY_BUYER');
      const pm = PurchaseOrganizationService.resolveEffectiveUserForDate(org.id, 'PRIMARY_MANAGER');
      const sm = PurchaseOrganizationService.resolveEffectiveUserForDate(org.id, 'SECONDARY_MANAGER');

      return [
        org.id,
        org.code,
        `"${org.name.replace(/"/g, '""')}"`,
        org.companyId,
        `"${(companyObj?.name || '').replace(/"/g, '""')}"`,
        org.model,
        `"${pb.userName.replace(/"/g, '""')}"`,
        `"${sb.userName.replace(/"/g, '""')}"`,
        `"${pm.userName.replace(/"/g, '""')}"`,
        `"${sm.userName.replace(/"/g, '""')}"`,
        `"${branchNames.replace(/"/g, '""')}"`,
        org.effectiveFrom || 'N/A',
        org.status,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kosh_purchase_organizations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportRulesCsv = () => {
    const headers = [
      'Rule ID',
      'Company Name',
      'Branch Scope',
      'Item Category',
      'Material Scope',
      'Primary Buyer',
      'Secondary Buyer',
      'Backup Buyer',
      'Primary Purchasing Manager',
      'Alternate Manager',
      'Priority',
      'Effective From',
      'Status',
      'Remarks',
    ];

    const rows = rules.map((r) => {
      const companyObj = companiesList.find(c => c.id === r.companyId);
      const branchObj = branchesList.find(b => b.id === r.branchId);

      return [
        r.id,
        `"${(companyObj?.name || r.companyId).replace(/"/g, '""')}"`,
        `"${(branchObj?.name || r.branchId || 'ALL Branches').replace(/"/g, '""')}"`,
        r.itemCategoryId || 'ALL',
        r.materialId || 'ALL',
        `"${(r.primaryBuyerId || '').replace(/"/g, '""')}"`,
        `"${(r.secondaryBuyerId || '').replace(/"/g, '""')}"`,
        `"${(r.backupBuyerId || '').replace(/"/g, '""')}"`,
        `"${(r.primaryManagerId || '').replace(/"/g, '""')}"`,
        `"${(r.alternateManagerId || '').replace(/"/g, '""')}"`,
        r.priority || 1,
        r.effectiveFrom || 'N/A',
        r.status,
        `"${(r.remarks || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kosh_buyer_manager_assignment_rules_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportMatrixCsv = () => {
    const headers = [
      'Branch Code',
      'Branch Name',
      'Company Name',
      'Assigned Purchase Org Code',
      'Assigned Purchase Org Name',
      'Coverage Status',
    ];

    const rows = branchesList.map((branch) => {
      const companyObj = companiesList.find(c => c.id === branch.companyId);
      const assignedPo = organizations.find(o => (orgBranchMap[o.id] || []).includes(branch.id));

      return [
        branch.portalBranchCode || branch.code,
        `"${branch.name.replace(/"/g, '""')}"`,
        `"${(companyObj?.name || branch.companyId).replace(/"/g, '""')}"`,
        assignedPo ? assignedPo.code : 'UNASSIGNED',
        `"${(assignedPo ? assignedPo.name : 'Unassigned').replace(/"/g, '""')}"`,
        assignedPo ? 'Mapped' : 'Pending Assignment',
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kosh_branch_assignment_matrix_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Top Banner & Company Filter */}
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-xs border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
            Enterprise Purchasing Structure & Effective-Dated Buyer Governance Engine
          </div>
          <div className="text-lg font-black text-white mt-1 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            Purchase Organization & Buyer Governance
          </div>
        </div>

        {/* Company Selector Filter */}
        <div className="flex items-center gap-3">
          <label className="font-bold text-slate-300 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-cyan-400" />
            Select Company Context:
          </label>
          <select
            value={selectedCompanyFilter}
            onChange={(e) => setSelectedCompanyFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold text-xs focus:ring-1 focus:ring-cyan-500 cursor-pointer"
          >
            <option value="ALL">All Registered Companies ({companiesList.length})</option>
            {companiesList.map(c => (
              <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 font-bold border border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('dashboard')}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'dashboard' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4 text-indigo-600" />
          Dashboard & Master ({filteredOrgs.length})
        </button>
        <button
          onClick={() => setActiveSubTab('models')}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'models' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4 text-cyan-600" />
          Company Purchasing Models
        </button>
        <button
          onClick={() => setActiveSubTab('branches')}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'branches' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapPin className="w-4 h-4 text-emerald-600" />
          Branch Assignment Matrix
        </button>
        <button
          onClick={() => setActiveSubTab('rules')}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'rules' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-amber-600" />
          Effective Rule Simulator
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'history' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4 text-purple-600" />
          Assignment Audit & History ({filteredHistoryLogs.length})
        </button>
      </div>

      {/* SUB-TAB 1: DASHBOARD & MASTER LIST */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Dashboard Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500">Total Purchase Orgs</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{filteredOrgs.length}</div>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500">Centralized Models</div>
              <div className="text-xl font-bold text-indigo-600 mt-1">
                {filteredOrgs.filter(o => o.model === 'CENTRALIZED').length}
              </div>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500">Decentralized Models</div>
              <div className="text-xl font-bold text-emerald-600 mt-1">
                {filteredOrgs.filter(o => o.model === 'DECENTRALIZED').length}
              </div>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500">Effective Schedules</div>
              <div className="text-xl font-bold text-purple-600 mt-1">
                {effectiveAssignments.length} Schedules
              </div>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500">Active Delegations</div>
              <div className="text-xl font-bold text-amber-600 mt-1">
                {effectiveAssignments.filter(a => a.delegation && a.delegation.status === 'ACTIVE').length} Active
              </div>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500">Audit History Logs</div>
              <div className="text-xl font-bold text-cyan-600 mt-1">{historyLogs.length} Records</div>
            </div>
          </div>

          {/* Action Bar & Master Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Purchase Organization Master Directory</h4>
                <p className="text-slate-500 text-xs">Configured purchasing entities with 4 independent effective-dated user assignments.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportOrgsCsv}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer text-xs"
                >
                  <Download className="w-4 h-4" /> Export Master (CSV)
                </button>
                <button
                  onClick={() => handleOpenModal()}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Purchase Organization
                </button>
              </div>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3">Org Code</th>
                  <th className="p-3">Organization Name</th>
                  <th className="p-3">Company</th>
                  <th className="p-3">Purchasing Model</th>
                  <th className="p-3">Effective Buyers (1° & 2°)</th>
                  <th className="p-3">Effective Managers (1° & 2°)</th>
                  <th className="p-3">Assigned Branches</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrgs.map((org) => {
                  const companyObj = companiesList.find(c => c.id === org.companyId);
                  const assignedBranchIds = orgBranchMap[org.id] || [];
                  const branchNames = branchesList
                    .filter(b => assignedBranchIds.includes(b.id))
                    .map(b => b.shortName || b.name);

                  // Resolve active effective users for current date
                  const pb = PurchaseOrganizationService.resolveEffectiveUserForDate(org.id, 'PRIMARY_BUYER');
                  const sb = PurchaseOrganizationService.resolveEffectiveUserForDate(org.id, 'SECONDARY_BUYER');
                  const pm = PurchaseOrganizationService.resolveEffectiveUserForDate(org.id, 'PRIMARY_MANAGER');
                  const sm = PurchaseOrganizationService.resolveEffectiveUserForDate(org.id, 'SECONDARY_MANAGER');

                  return (
                    <tr key={org.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono font-bold text-indigo-700">{org.code}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{org.name}</div>
                        <div className="text-[10px] text-slate-500">{org.description || 'No description'}</div>
                      </td>
                      <td className="p-3 font-semibold text-slate-700">
                        {companyObj?.name || org.companyId}
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          org.model === 'CENTRALIZED' ? 'bg-indigo-100 text-indigo-800' :
                          org.model === 'DECENTRALIZED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {org.model}
                        </span>
                      </td>

                      {/* Buyers Column */}
                      <td className="p-3 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1 rounded border border-indigo-200">1°</span>
                          <span>{pb.userName}</span>
                          {pb.isDelegated && (
                            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[9px] font-bold" title={pb.message}>
                              Delegated
                            </span>
                          )}
                        </div>
                        {sb.userName && sb.userName !== 'Unassigned User' && (
                          <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                            <span className="text-[9px] text-slate-500 font-bold bg-slate-100 px-1 rounded border border-slate-200">2°</span>
                            <span>{sb.userName}</span>
                          </div>
                        )}
                      </td>

                      {/* Managers Column */}
                      <td className="p-3 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                          <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1 rounded border border-indigo-200">1°</span>
                          <span>{pm.userName}</span>
                          {pm.isDelegated && (
                            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[9px] font-bold" title={pm.message}>
                              Delegated
                            </span>
                          )}
                        </div>
                        {sm.userName && sm.userName !== 'Unassigned User' && (
                          <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                            <span className="text-[9px] text-slate-500 font-bold bg-slate-100 px-1 rounded border border-slate-200">2°</span>
                            <span>{sm.userName}</span>
                          </div>
                        )}
                      </td>

                      {/* Branches Column */}
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {branchNames.length > 0 ? (
                            branchNames.map((bn, idx) => (
                              <span key={idx} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium border border-slate-200">
                                {bn}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-amber-600 italic">No Branches Assigned</span>
                          )}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          org.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {org.status}
                        </span>
                      </td>

                      <td className="p-3 text-right space-x-1">
                        <button
                          onClick={() => openScheduleModal(org.id, 'PRIMARY_BUYER')}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 rounded hover:bg-slate-100 cursor-pointer"
                          title="Schedule Future User Assignment"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDelegateModal(org.id, 'PRIMARY_BUYER')}
                          className="p-1.5 text-slate-600 hover:text-amber-600 rounded hover:bg-slate-100 cursor-pointer"
                          title="Assign Temporary Replacement (Delegation)"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenModal(org)}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 rounded hover:bg-slate-100 cursor-pointer"
                          title="Edit Purchase Organization & Assignments"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePO(org.id)}
                          className="p-1.5 text-slate-600 hover:text-rose-600 rounded hover:bg-slate-100 cursor-pointer"
                          title="Delete Organization"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: COMPANY PURCHASING MODELS */}
      {activeSubTab === 'models' && (
        <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Company-Wise Independent Purchasing Models</h4>
            <p className="text-slate-500 text-xs">
              Every registered company independently configures its purchasing governance model without affecting other group companies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {companiesList.map((company) => {
              const cfg = companyModels.find(m => m.companyId === company.id) || {
                companyId: company.id,
                model: 'CENTRALIZED',
                effectiveFrom: '2026-01-01',
                status: 'ACTIVE',
                updatedAt: new Date().toISOString(),
              };

              const companyBranchesList = branchesList.filter(b => b.companyId === company.id);

              return (
                <div key={company.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        {company.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">Code: {company.code} • DB: {company.sapCompanyDb}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {companyBranchesList.length} Branch(es)
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                    <label className="block font-bold text-slate-700 text-xs">Active Purchasing Governance Model *</label>
                    <select
                      value={cfg.model}
                      onChange={(e) => handleModelChange(company.id, e.target.value as PurchasingModel)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-bold text-indigo-900 text-xs cursor-pointer focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="CENTRALIZED">Centralized (Single Procurement Org for all branches)</option>
                      <option value="DECENTRALIZED">Decentralized (Independent Procurement Org per branch)</option>
                      <option value="HYBRID">Hybrid (Shared regional orgs & standalone branch orgs)</option>
                    </select>

                    <div className="text-[10px] text-slate-500 leading-normal pt-1">
                      {cfg.model === 'CENTRALIZED' && '👉 Centralized: All branches in this company route PRs through one designated Purchase Organization.'}
                      {cfg.model === 'DECENTRALIZED' && '👉 Decentralized: Every branch operates its own independent purchasing organization and buyers.'}
                      {cfg.model === 'HYBRID' && '👉 Hybrid: Flexible allocation; multiple branches share regional orgs while specific branches maintain dedicated orgs.'}
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center justify-between font-mono pt-1">
                    <span>Effective From: {cfg.effectiveFrom}</span>
                    <span>Status: {cfg.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: BRANCH ASSIGNMENT MATRIX */}
      {activeSubTab === 'branches' && (
        <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Purchase Organization Branch Assignment Matrix</h4>
              <p className="text-slate-500 text-xs">
                Map branches to their designated Purchase Organizations according to company governance rules.
              </p>
            </div>
            <button
              onClick={handleExportMatrixCsv}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer text-xs"
            >
              <Download className="w-4 h-4" /> Export Matrix (CSV)
            </button>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-3">Branch Code & Name</th>
                <th className="p-3">Company</th>
                <th className="p-3">Assigned Purchase Organization</th>
                <th className="p-3">Coverage Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branchesList.map((branch) => {
                const companyObj = companiesList.find(c => c.id === branch.companyId);
                const assignedPo = organizations.find(o => (orgBranchMap[o.id] || []).includes(branch.id));

                return (
                  <tr key={branch.id} className="hover:bg-slate-50 transition">
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{branch.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">[{branch.portalBranchCode}] {branch.shortName}</div>
                    </td>
                    <td className="p-3 font-semibold text-slate-700">{companyObj?.name || branch.companyId}</td>
                    <td className="p-3">
                      {assignedPo ? (
                        <div className="flex items-center gap-1.5 font-bold text-indigo-700">
                          <Layers className="w-3.5 h-3.5 text-indigo-500" />
                          <span>[{assignedPo.code}] {assignedPo.name}</span>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Unassigned (Default Fallback)
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {assignedPo ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Mapped</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">Pending Assignment</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* SUB-TAB 4: BUYER & MANAGER RULE SIMULATOR */}
      {activeSubTab === 'rules' && (
        <div className="space-y-6">
          {/* Simulator Panel */}
          <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-cyan-400 flex items-center gap-2">
                  <Play className="w-4 h-4 text-cyan-400" />
                  Effective-Dated Buyer & Manager Resolution Simulator
                </h4>
                <p className="text-slate-400 text-xs mt-0.5">
                  Simulate resolution priority and effective date user determination for any PR transaction date.
                </p>
              </div>
              <button
                onClick={handleRunSimulator}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer text-xs"
              >
                <Play className="w-3.5 h-3.5" /> Run Effective Simulation
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-slate-800 p-3.5 rounded-xl border border-slate-700">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Company Context *</label>
                <select
                  value={simCompanyId}
                  onChange={(e) => setSimCompanyId(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white text-xs font-bold"
                >
                  {companiesList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Branch *</label>
                <select
                  value={simBranchId}
                  onChange={(e) => setSimBranchId(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white text-xs font-bold"
                >
                  {branchesList.map(b => <option key={b.id} value={b.id}>[{b.portalBranchCode}] {b.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Item Category *</label>
                <select
                  value={simCategory}
                  onChange={(e) => setSimCategory(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white text-xs font-bold"
                >
                  {CLASSIFICATION_DIMENSIONS.category.values.map(v => <option key={v.code} value={v.code}>{v.display}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Purchase Organization</label>
                <select
                  value={simPoId}
                  onChange={(e) => setSimPoId(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white text-xs font-bold"
                >
                  {organizations.map(o => <option key={o.id} value={o.id}>[{o.code}] {o.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">PR Creation Target Date *</label>
                <input
                  type="date"
                  value={simTargetDate}
                  onChange={(e) => setSimTargetDate(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-cyan-400 font-mono text-xs font-bold"
                />
              </div>
            </div>

            {/* Simulation Result Box */}
            {simResult && (
              <div className={`p-4 rounded-xl border ${
                simResult.conflict ? 'bg-amber-950/40 border-amber-600/50 text-amber-200' :
                simResult.rule ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-200' : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}>
                <div className="flex items-center justify-between font-bold text-xs">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    Specificity Resolution: {simResult.specificityLabel}
                  </span>
                  <span className="font-mono text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                    {simResult.message}
                  </span>
                </div>

                {simResult.resolvedAssignments && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-700/50 text-xs">
                    <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700">
                      <div className="text-[10px] text-slate-400 font-bold flex items-center justify-between">
                        <span>Primary Buyer</span>
                        <span className="px-1.5 bg-indigo-900 text-indigo-300 rounded text-[9px]">{simResult.resolvedAssignments.primaryBuyer.status}</span>
                      </div>
                      <div className="font-bold text-white mt-1">{simResult.resolvedAssignments.primaryBuyer.userName}</div>
                      {simResult.resolvedAssignments.primaryBuyer.isDelegated && (
                        <div className="text-[10px] text-amber-400 mt-0.5 italic">⚡ {simResult.resolvedAssignments.primaryBuyer.message}</div>
                      )}
                    </div>

                    <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700">
                      <div className="text-[10px] text-slate-400 font-bold flex items-center justify-between">
                        <span>Secondary Buyer</span>
                        <span className="px-1.5 bg-indigo-900 text-indigo-300 rounded text-[9px]">{simResult.resolvedAssignments.secondaryBuyer.status}</span>
                      </div>
                      <div className="font-bold text-white mt-1">{simResult.resolvedAssignments.secondaryBuyer.userName}</div>
                    </div>

                    <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700">
                      <div className="text-[10px] text-slate-400 font-bold flex items-center justify-between">
                        <span>Primary Manager</span>
                        <span className="px-1.5 bg-indigo-900 text-indigo-300 rounded text-[9px]">{simResult.resolvedAssignments.primaryManager.status}</span>
                      </div>
                      <div className="font-bold text-cyan-300 mt-1">{simResult.resolvedAssignments.primaryManager.userName}</div>
                    </div>

                    <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700">
                      <div className="text-[10px] text-slate-400 font-bold flex items-center justify-between">
                        <span>Secondary Manager</span>
                        <span className="px-1.5 bg-indigo-900 text-indigo-300 rounded text-[9px]">{simResult.resolvedAssignments.secondaryManager.status}</span>
                      </div>
                      <div className="font-bold text-white mt-1">{simResult.resolvedAssignments.secondaryManager.userName}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rules Directory Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Configured Assignment Rules Directory</h4>
                <p className="text-slate-500 text-xs">Active rules governing buyer and purchasing manager resolution.</p>
              </div>
              <button
                onClick={() => {
                  setEditingRule(null);
                  setRuleFormData({
                    companyId: companiesList[0]?.id || 'co-kosh-01',
                    branchId: 'ALL',
                    itemCategoryId: 'ALL',
                    materialId: 'ALL',
                    purchaseOrganizationId: '',
                    primaryBuyerId: 'usr-buyer-01',
                    secondaryBuyerId: '',
                    backupBuyerId: '',
                    primaryManagerId: 'usr-checker-03',
                    alternateManagerId: '',
                    effectiveFrom: new Date().toISOString().split('T')[0],
                    status: 'ACTIVE',
                    remarks: '',
                  });
                  setIsRuleModalOpen(true);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Assignment Rule
              </button>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3">Company</th>
                  <th className="p-3">Branch Scope</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Primary Buyer</th>
                  <th className="p-3">Primary Purchasing Manager</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((rule) => {
                  const companyObj = companiesList.find(c => c.id === rule.companyId);
                  const branchObj = branchesList.find(b => b.id === rule.branchId);

                  return (
                    <tr key={rule.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-semibold text-slate-800">{companyObj?.name || rule.companyId}</td>
                      <td className="p-3">{branchObj?.name || rule.branchId || 'ALL Branches'}</td>
                      <td className="p-3 font-mono font-bold text-indigo-700">{rule.itemCategoryId || 'ALL'}</td>
                      <td className="p-3 font-bold text-slate-800">{rule.primaryBuyerId}</td>
                      <td className="p-3 font-bold text-indigo-700">{rule.primaryManagerId}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {rule.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <button
                          onClick={() => {
                            setEditingRule(rule);
                            setRuleFormData({
                              companyId: rule.companyId,
                              branchId: rule.branchId || 'ALL',
                              itemCategoryId: rule.itemCategoryId || 'ALL',
                              materialId: rule.materialId || 'ALL',
                              purchaseOrganizationId: rule.purchaseOrganizationId || '',
                              primaryBuyerId: rule.primaryBuyerId,
                              secondaryBuyerId: rule.secondaryBuyerId || '',
                              backupBuyerId: rule.backupBuyerId || '',
                              primaryManagerId: rule.primaryManagerId,
                              alternateManagerId: rule.alternateManagerId || '',
                              effectiveFrom: rule.effectiveFrom || new Date().toISOString().split('T')[0],
                              status: rule.status,
                              remarks: rule.remarks || '',
                            });
                            setIsRuleModalOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 rounded hover:bg-slate-100 cursor-pointer"
                          title="Edit Assignment Rule"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            PurchaseOrganizationService.deleteAssignmentRule(rule.id);
                            setRules(PurchaseOrganizationService.getAssignmentRules());
                          }}
                          className="p-1.5 text-slate-600 hover:text-rose-600 rounded hover:bg-slate-100 cursor-pointer"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: ASSIGNMENT AUDIT & HISTORY LOGS */}
      {activeSubTab === 'history' && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="bg-slate-900 text-white p-4 rounded-xl shadow-xs border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                Enterprise Immutable Audit Engine & Cryptographic Integrity Ledger
              </div>
              <h4 className="text-base font-black text-white mt-0.5 flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                Purchase Organization Audit Trail & Change History
              </h4>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleVerifyAuditChain}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold rounded-lg border border-cyan-800/60 flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                Verify SHA-256 Chain Integrity
              </button>
              <button
                onClick={handleExportAuditCsv}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Export Audit Trail (CSV)
              </button>
            </div>
          </div>

          {/* Verification Banner */}
          {auditVerificationResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                auditVerificationResult.isValid
                  ? 'bg-emerald-950/50 border-emerald-600 text-emerald-200'
                  : 'bg-rose-950/50 border-rose-600 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {auditVerificationResult.isValid ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <div>
                  <div className="font-bold">
                    {auditVerificationResult.isValid
                      ? 'Cryptographic Audit Ledger Validated'
                      : 'TAMPER DETECTED IN AUDIT LEDGER'}
                  </div>
                  <div className="text-[11px] opacity-90 mt-0.5 font-mono">
                    {auditVerificationResult.message}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setAuditVerificationResult(null)}
                className="font-bold underline opacity-80 hover:opacity-100 cursor-pointer text-xs"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Total Events</div>
              <div className="text-lg font-black text-slate-900 mt-0.5">{auditMetrics.totalEvents}</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase">PO Changes</div>
              <div className="text-lg font-black text-indigo-600 mt-0.5">{auditMetrics.poChanges}</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Buyer Changes</div>
              <div className="text-lg font-black text-blue-600 mt-0.5">{auditMetrics.buyerChanges}</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Manager Changes</div>
              <div className="text-lg font-black text-purple-600 mt-0.5">{auditMetrics.managerChanges}</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Validity Changes</div>
              <div className="text-lg font-black text-emerald-600 mt-0.5">{auditMetrics.validityChanges}</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Delegations</div>
              <div className="text-lg font-black text-amber-600 mt-0.5">{auditMetrics.delegationEvents}</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Security Violations</div>
              <div className="text-lg font-black text-rose-600 mt-0.5">{auditMetrics.unauthorizedAttempts}</div>
            </div>
          </div>

          {/* History Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-purple-600" />
                Audit Trail Search & Filters
              </span>
              <button
                onClick={() => {
                  setHistPoFilter('ALL');
                  setHistRoleFilter('ALL');
                  setHistUserFilter('');
                  setAuditEntityTypeFilter('ALL');
                  setAuditSearchQuery('');
                }}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Purchase Organization</label>
                <select
                  value={histPoFilter}
                  onChange={(e) => setHistPoFilter(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800"
                >
                  <option value="ALL">All Purchase Organizations</option>
                  {organizations.map(o => (
                    <option key={o.id} value={o.id}>[{o.code}] {o.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Entity Category</label>
                <select
                  value={auditEntityTypeFilter}
                  onChange={(e) => setAuditEntityTypeFilter(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800"
                >
                  <option value="ALL">All Entities</option>
                  <option value="PURCHASE_ORGANIZATION">Purchase Organization</option>
                  <option value="BUYER_ASSIGNMENT">Buyer Assignment</option>
                  <option value="MANAGER_ASSIGNMENT">Manager Assignment</option>
                  <option value="DELEGATION">Delegation</option>
                  <option value="ASSIGNMENT_RULE">Assignment Rule</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Employee / User</label>
                <input
                  type="text"
                  placeholder="Search by User Name or ID..."
                  value={histUserFilter}
                  onChange={(e) => setHistUserFilter(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Search Keywords</label>
                <input
                  type="text"
                  placeholder="Search description, reason..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded text-xs"
                />
              </div>

              <div className="flex items-end">
                <div className="text-[11px] text-slate-600 font-semibold p-2 bg-purple-50 border border-purple-200 rounded w-full text-center">
                  Showing {auditLogsList.length} Audited Events
                </div>
              </div>
            </div>
          </div>

          {/* Audit Log Directory Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3">Timestamp & Correlation</th>
                  <th className="p-3">Actor & Channel</th>
                  <th className="p-3">Org & Scope</th>
                  <th className="p-3">Entity & Event</th>
                  <th className="p-3">Event Summary</th>
                  <th className="p-3">Validity Period</th>
                  <th className="p-3">Hash Integrity</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogsList.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="p-3">
                      <div className="font-mono font-bold text-slate-800">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-cyan-700 font-mono font-semibold truncate max-w-[130px]">
                        {log.correlationId}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{log.changedByName}</div>
                      <div className="text-[10px] text-amber-700 font-mono">Channel: {log.source}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-indigo-700">
                        {log.purchaseOrganizationCode ? `[${log.purchaseOrganizationCode}]` : 'N/A'}
                      </div>
                      <div className="text-[10px] text-slate-500">{log.companyName || log.companyId}</div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold block w-max ${
                        log.entityType === 'PURCHASE_ORGANIZATION' ? 'bg-indigo-100 text-indigo-800' :
                        log.entityType === 'BUYER_ASSIGNMENT' ? 'bg-blue-100 text-blue-800' :
                        log.entityType === 'MANAGER_ASSIGNMENT' ? 'bg-purple-100 text-purple-800' :
                        log.entityType === 'DELEGATION' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {log.eventType}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{log.eventDescription}</div>
                      <div className="text-[10px] text-slate-500 italic mt-0.5">Reason: {log.changeReason}</div>
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      {log.effectiveFrom ? (
                        <span>
                          <span className="font-bold text-slate-800">{log.effectiveFrom}</span>
                          <span className="text-slate-400"> to </span>
                          <span className="font-bold text-slate-800">{log.effectiveTo || 'Open'}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">Immediate</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[10px] font-bold flex items-center gap-1 w-max">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        SHA-256 Valid
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedAuditRecord(log);
                          setIsAuditModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded flex items-center gap-1 ml-auto cursor-pointer transition text-[11px]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Diff Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD / EDIT PURCHASE ORGANIZATION MODAL (3 WINDOW CONTROLS: MINIMIZE, MAXIMIZE/RESTORE, CLOSE) */}
      {isModalOpen && (
        <EnterpriseModal
          title={editingOrg ? `Edit Purchase Organization [${editingOrg.code}]` : 'Add Purchase Organization'}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          isMinimized={isMinimized}
          onToggleMinimize={() => setIsMinimized(!isMinimized)}
          isMaximized={isMaximized}
          onToggleMaximize={() => setIsMaximized(!isMaximized)}
        >
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Company *</label>
                <select
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  value={formData.companyId}
                  onChange={e => setFormData({ ...formData, companyId: e.target.value })}
                >
                  {companiesList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Purchase Organization Code *</label>
                <input
                  type="text"
                  placeholder="e.g. PO-HQ-01"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-indigo-700"
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Organization Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Kosh Central Procurement Org"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Purchasing Model *</label>
                <select
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  value={formData.model}
                  onChange={e => setFormData({ ...formData, model: e.target.value as PurchasingModel })}
                >
                  <option value="CENTRALIZED">Centralized Purchasing</option>
                  <option value="DECENTRALIZED">Decentralized Purchasing</option>
                  <option value="HYBRID">Hybrid Purchasing</option>
                </select>
              </div>
            </div>

            {/* Branch Multi-Select Assignment */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Assigned Branches for this Organization ({availableBranchesForCompany.length} Available in Company)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-36 overflow-y-auto">
                {availableBranchesForCompany.map(b => (
                  <label key={b.id} className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer p-1 bg-white rounded border border-slate-200">
                    <input
                      type="checkbox"
                      checked={formData.assignedBranches.includes(b.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setFormData({ ...formData, assignedBranches: [...formData.assignedBranches, b.id] });
                        } else {
                          setFormData({ ...formData, assignedBranches: formData.assignedBranches.filter(id => id !== b.id) });
                        }
                      }}
                    />
                    <span>[{b.portalBranchCode}] {b.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Purchasing Responsibilities: 2-Column Effective-Dated User Mapping */}
            <div className="pt-3 border-t border-slate-200">
              <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Buyer & Purchasing Manager User Mapping with Effective-Dated Validity
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">4 Independent User Schedules</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                {/* Left Column: Buyer Assignments */}
                <div className="space-y-4">
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider pb-1 border-b border-slate-200 flex items-center justify-between">
                    <span>Buyer Allocation</span>
                    <span className="text-[10px] text-indigo-600 font-semibold">Left Column</span>
                  </div>

                  {/* Primary Buyer */}
                  <SearchableUserSelect
                    label="Primary Buyer"
                    value={formData.primaryBuyerId}
                    users={INITIAL_USERS}
                    required
                    validFrom={formData.primaryBuyerValidFrom}
                    validTo={formData.primaryBuyerValidTo}
                    onValidFromChange={(d) => setFormData(prev => ({ ...prev, primaryBuyerValidFrom: d }))}
                    onValidToChange={(d) => setFormData(prev => ({ ...prev, primaryBuyerValidTo: d }))}
                    placeholder="Search Primary Buyer by Name, ID, or Email..."
                    onScheduleClick={() => openScheduleModal(editingOrg?.id || '', 'PRIMARY_BUYER')}
                    onDelegateClick={() => openDelegateModal(editingOrg?.id || '', 'PRIMARY_BUYER')}
                    onChange={(user) => {
                      setFormData(prev => ({
                        ...prev,
                        primaryBuyerId: user ? user.id : '',
                        primaryBuyerName: user ? user.fullName : '',
                      }));
                    }}
                  />

                  {/* Secondary Buyer */}
                  <SearchableUserSelect
                    label="Secondary Buyer"
                    value={formData.secondaryBuyerId}
                    users={INITIAL_USERS}
                    required
                    validFrom={formData.secondaryBuyerValidFrom}
                    validTo={formData.secondaryBuyerValidTo}
                    onValidFromChange={(d) => setFormData(prev => ({ ...prev, secondaryBuyerValidFrom: d }))}
                    onValidToChange={(d) => setFormData(prev => ({ ...prev, secondaryBuyerValidTo: d }))}
                    disabledUserIds={formData.primaryBuyerId ? [formData.primaryBuyerId] : []}
                    disabledNotice="Already Primary Buyer"
                    placeholder="Search Secondary Buyer mapped to Primary..."
                    onScheduleClick={() => openScheduleModal(editingOrg?.id || '', 'SECONDARY_BUYER')}
                    onDelegateClick={() => openDelegateModal(editingOrg?.id || '', 'SECONDARY_BUYER')}
                    onChange={(user) => {
                      setFormData(prev => ({
                        ...prev,
                        secondaryBuyerId: user ? user.id : '',
                        secondaryBuyerName: user ? user.fullName : '',
                      }));
                    }}
                  />
                </div>

                {/* Right Column: Purchasing Manager Assignments */}
                <div className="space-y-4">
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider pb-1 border-b border-slate-200 flex items-center justify-between">
                    <span>Purchasing Manager Allocation</span>
                    <span className="text-[10px] text-indigo-600 font-semibold">Right Column</span>
                  </div>

                  {/* Primary Purchasing Manager */}
                  <SearchableUserSelect
                    label="Primary Purchasing Manager"
                    value={formData.primaryManagerId}
                    users={INITIAL_USERS}
                    required
                    validFrom={formData.primaryManagerValidFrom}
                    validTo={formData.primaryManagerValidTo}
                    onValidFromChange={(d) => setFormData(prev => ({ ...prev, primaryManagerValidFrom: d }))}
                    onValidToChange={(d) => setFormData(prev => ({ ...prev, primaryManagerValidTo: d }))}
                    placeholder="Search Primary Manager by Name, ID, or Email..."
                    onScheduleClick={() => openScheduleModal(editingOrg?.id || '', 'PRIMARY_MANAGER')}
                    onDelegateClick={() => openDelegateModal(editingOrg?.id || '', 'PRIMARY_MANAGER')}
                    onChange={(user) => {
                      setFormData(prev => ({
                        ...prev,
                        primaryManagerId: user ? user.id : '',
                        primaryManagerName: user ? user.fullName : '',
                      }));
                    }}
                  />

                  {/* Secondary Purchasing Manager */}
                  <SearchableUserSelect
                    label="Secondary Purchasing Manager"
                    value={formData.secondaryManagerId}
                    users={INITIAL_USERS}
                    required
                    validFrom={formData.secondaryManagerValidFrom}
                    validTo={formData.secondaryManagerValidTo}
                    onValidFromChange={(d) => setFormData(prev => ({ ...prev, secondaryManagerValidFrom: d }))}
                    onValidToChange={(d) => setFormData(prev => ({ ...prev, secondaryManagerValidTo: d }))}
                    disabledUserIds={formData.primaryManagerId ? [formData.primaryManagerId] : []}
                    disabledNotice="Already Primary Manager"
                    placeholder="Search Secondary Manager mapped to Primary..."
                    onScheduleClick={() => openScheduleModal(editingOrg?.id || '', 'SECONDARY_MANAGER')}
                    onDelegateClick={() => openDelegateModal(editingOrg?.id || '', 'SECONDARY_MANAGER')}
                    onChange={(user) => {
                      setFormData(prev => ({
                        ...prev,
                        secondaryManagerId: user ? user.id : '',
                        secondaryManagerName: user ? user.fullName : '',
                      }));
                    }}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Description / Notes</label>
              <textarea
                rows={2}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                placeholder="Operational notes or scope..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                onClick={handleSavePO}
              >
                Save Purchase Organization & Assignments
              </button>
            </div>
          </div>
        </EnterpriseModal>
      )}

      {/* SCHEDULE FUTURE ASSIGNMENT MODAL */}
      {isScheduleModalOpen && (
        <EnterpriseModal
          title={`Schedule Future Assignment: ${scheduleData.role.replace('_', ' ')}`}
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          zIndexClass="z-[60]"
        >
          <div className="p-5 space-y-4 text-xs">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900">
              <div className="font-bold flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                Schedule Future Effective Assignment
              </div>
              <p className="text-[11px] text-indigo-700 mt-1">
                Schedule a new user for this role starting on a future Valid From date. Previous active assignment will be updated sequentially without overlap.
              </p>
            </div>

            <div className="space-y-3">
              <SearchableUserSelect
                label="New Assigned User *"
                value={scheduleData.userId}
                users={INITIAL_USERS}
                required
                placeholder="Search User Master by Name, Employee ID or Email..."
                onChange={(user) => {
                  setScheduleData(prev => ({
                    ...prev,
                    userId: user ? user.id : '',
                    userName: user ? user.fullName : '',
                    employeeId: user ? user.employeeId : '',
                  }));
                }}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Valid From Date *
                  </label>
                  <input
                    type="date"
                    value={scheduleData.validFrom}
                    onChange={(e) => setScheduleData(prev => ({ ...prev, validFrom: e.target.value }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-indigo-900 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Valid To Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={scheduleData.validTo}
                    onChange={(e) => setScheduleData(prev => ({ ...prev, validTo: e.target.value }))}
                    placeholder="Open-ended"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-800 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Reassignment *</label>
                <textarea
                  rows={2}
                  value={scheduleData.reason}
                  onChange={(e) => setScheduleData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Business justification for scheduling new user..."
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveScheduledAssignment}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs cursor-pointer"
              >
                Confirm & Save Scheduled Assignment
              </button>
            </div>
          </div>
        </EnterpriseModal>
      )}

      {/* TEMPORARY REPLACEMENT / DELEGATION MODAL */}
      {isDelegateModalOpen && (
        <EnterpriseModal
          title={`Assign Temporary Replacement (Delegation): ${delegateData.role.replace('_', ' ')}`}
          isOpen={isDelegateModalOpen}
          onClose={() => setIsDelegateModalOpen(false)}
          zIndexClass="z-[60]"
        >
          <div className="p-5 space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
              <div className="font-bold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                Temporary Replacement Delegation
              </div>
              <p className="text-[11px] text-amber-800 mt-1">
                Assign a temporary delegate user during leave or absence. The original assignment record remains intact and automatically resumes after the delegation period expires.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-2.5 bg-slate-100 rounded-lg font-medium text-slate-700">
                Originally Assigned User: <span className="font-bold text-slate-900">{delegateData.originalUserName}</span>
              </div>

              <SearchableUserSelect
                label="Temporary Replacement User *"
                value={delegateData.replacementUserId}
                users={INITIAL_USERS}
                required
                placeholder="Search User Master for Delegate..."
                onChange={(user) => {
                  setDelegateData(prev => ({
                    ...prev,
                    replacementUserId: user ? user.id : '',
                    replacementUserName: user ? user.fullName : '',
                    replacementEmployeeId: user ? user.employeeId : '',
                    replacementDesignation: user ? user.designation : '',
                    replacementEmail: user ? user.email : '',
                  }));
                }}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" /> Delegation Valid From *
                  </label>
                  <input
                    type="date"
                    value={delegateData.validFrom}
                    onChange={(e) => setDelegateData(prev => ({ ...prev, validFrom: e.target.value }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-amber-900 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" /> Delegation Valid To *
                  </label>
                  <input
                    type="date"
                    value={delegateData.validTo}
                    onChange={(e) => setDelegateData(prev => ({ ...prev, validTo: e.target.value }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-amber-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Delegation *</label>
                <textarea
                  rows={2}
                  value={delegateData.reason}
                  onChange={(e) => setDelegateData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Annual leave coverage..."
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Authorized By *</label>
                <input
                  type="text"
                  value={delegateData.authorizedBy}
                  onChange={(e) => setDelegateData(prev => ({ ...prev, authorizedBy: e.target.value }))}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsDelegateModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDelegation}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold shadow-xs cursor-pointer"
              >
                Confirm & Delegate Replacement
              </button>
            </div>
          </div>
        </EnterpriseModal>
      )}

      {/* ADD / EDIT ASSIGNMENT RULE MODAL */}
      {isRuleModalOpen && (
        <EnterpriseModal
          title="Add Buyer & Manager Assignment Rule"
          isOpen={isRuleModalOpen}
          onClose={() => setIsRuleModalOpen(false)}
        >
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company Context *</label>
                <select
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  value={ruleFormData.companyId}
                  onChange={e => setRuleFormData({ ...ruleFormData, companyId: e.target.value })}
                >
                  {companiesList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Branch Scope</label>
                <select
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  value={ruleFormData.branchId}
                  onChange={e => setRuleFormData({ ...ruleFormData, branchId: e.target.value })}
                >
                  <option value="ALL">ALL Branches (Company-Wide)</option>
                  {branchesList.map(b => <option key={b.id} value={b.id}>[{b.portalBranchCode}] {b.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Item Category Scope</label>
                <select
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  value={ruleFormData.itemCategoryId}
                  onChange={e => setRuleFormData({ ...ruleFormData, itemCategoryId: e.target.value })}
                >
                  <option value="ALL">ALL Item Categories</option>
                  {CLASSIFICATION_DIMENSIONS.category.values.map(v => <option key={v.code} value={v.code}>{v.display}</option>)}
                </select>
              </div>

              {/* Primary Buyer Searchable Dropdown */}
              <div className="col-span-1">
                <SearchableUserSelect
                  label="Primary Buyer"
                  value={ruleFormData.primaryBuyerId}
                  users={INITIAL_USERS}
                  required
                  placeholder="Search Primary Buyer from User Master..."
                  onChange={(user) => {
                    setRuleFormData(prev => ({
                      ...prev,
                      primaryBuyerId: user ? `${user.fullName}${user.designation ? ` (${user.designation})` : ''}` : '',
                    }));
                  }}
                />
              </div>

              {/* Primary Purchasing Manager Searchable Dropdown */}
              <div className="col-span-1">
                <SearchableUserSelect
                  label="Primary Purchasing Manager"
                  value={ruleFormData.primaryManagerId}
                  users={INITIAL_USERS}
                  required
                  placeholder="Search Primary Manager from User Master..."
                  onChange={(user) => {
                    setRuleFormData(prev => ({
                      ...prev,
                      primaryManagerId: user ? `${user.fullName}${user.designation ? ` (${user.designation})` : ''}` : '',
                    }));
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  placeholder="Operational notes..."
                  value={ruleFormData.remarks}
                  onChange={e => setRuleFormData({ ...ruleFormData, remarks: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                onClick={() => setIsRuleModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                onClick={handleSaveRule}
              >
                Save Assignment Rule
              </button>
            </div>
          </div>
        </EnterpriseModal>
      )}

      {/* AUDIT LOG DETAIL & CHANGE DIFF MODAL */}
      <AuditDetailModal
        auditRecord={selectedAuditRecord}
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
      />
    </div>
  );
};
