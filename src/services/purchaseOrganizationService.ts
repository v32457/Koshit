import {
  PurchaseOrganization,
  BuyerManagerAssignmentRule,
  PurchasingModel,
  EffectiveRoleAssignment,
  AssignmentRole,
  TemporaryDelegation,
  AssignmentHistoryRecord,
} from '../types/purchaseOrganization';
import { INITIAL_COMPANIES, INITIAL_BRANCHES, INITIAL_USERS } from '../data/seedData';
import { EnterpriseAuditService } from './enterpriseAuditService';

const STORAGE_KEY_ORGS = 'kosh_purchase_orgs_v2';
const STORAGE_KEY_RULES = 'kosh_buyer_manager_rules_v2';
const STORAGE_KEY_COMPANY_MODELS = 'kosh_company_purchasing_models_v2';
const STORAGE_KEY_EFFECTIVE_ASSIGNMENTS = 'kosh_effective_role_assignments_v3';
const STORAGE_KEY_ASSIGNMENT_HISTORY = 'kosh_assignment_history_v3';

export interface CompanyPurchasingModelConfig {
  companyId: string;
  model: PurchasingModel;
  effectiveFrom: string;
  effectiveTo?: string;
  status: 'ACTIVE' | 'INACTIVE';
  remarks?: string;
  updatedAt: string;
}

export type ResolvedEffectiveUser = {
  userId: string;
  userName: string;
  employeeId?: string;
  designation?: string;
  email?: string;
  status: 'CURRENT' | 'UPCOMING' | 'EXPIRED' | 'TEMPORARILY_REPLACED' | 'UNMAPPED';
  isDelegated: boolean;
  originalUser?: { userId: string; userName: string };
  assignmentRecord?: EffectiveRoleAssignment;
  message: string;
};

const INITIAL_PURCHASE_ORGS: PurchaseOrganization[] = [
  {
    id: 'po-kosh-01',
    companyId: 'co-kosh-01',
    code: 'PO-HQ-01',
    name: 'Kosh Central Procurement Organization',
    model: 'CENTRALIZED',
    description: 'Centralized purchasing organization for Kosh HQ & Puducherry/Pune manufacturing plants.',
    effectiveFrom: '2026-01-01',
    status: 'ACTIVE',
    primaryBuyerId: 'usr-buyer-01',
    primaryBuyerName: 'Vikram Singh',
    secondaryBuyerId: 'usr-maker-02',
    secondaryBuyerName: 'Ananya Deshmukh',
    primaryManagerId: 'usr-checker-03',
    primaryManagerName: 'Venkatesh Iyer',
    secondaryManagerId: 'usr-mgr-02',
    secondaryManagerName: 'Priya Ramachandran',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'po-kosh-02',
    companyId: 'co-kosh-02',
    code: 'PO-SOU-01',
    name: 'Kosh South Hub Procurement Org',
    model: 'HYBRID',
    description: 'Shared regional procurement organization for Chennai and Hosur plants.',
    effectiveFrom: '2026-02-01',
    status: 'ACTIVE',
    primaryBuyerId: 'usr-buyer-03',
    primaryBuyerName: 'Karthik Subramanian',
    secondaryBuyerId: 'usr-buyer-04',
    secondaryBuyerName: 'Suresh Kumar',
    primaryManagerId: 'usr-mgr-03',
    primaryManagerName: 'K. Deepa',
    secondaryManagerId: 'usr-mgr-02',
    secondaryManagerName: 'Priya Ramachandran',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'po-kosh-03',
    companyId: 'co-kosh-03',
    code: 'PO-EXP-01',
    name: 'Kosh Global SEZ Procurement Unit',
    model: 'DECENTRALIZED',
    description: 'Dedicated procurement unit for Sanand & Halol export SEZ operations.',
    effectiveFrom: '2026-03-01',
    status: 'ACTIVE',
    primaryBuyerId: 'usr-buyer-01',
    primaryBuyerName: 'Vikram Singh',
    secondaryBuyerId: 'usr-buyer-03',
    secondaryBuyerName: 'Karthik Subramanian',
    primaryManagerId: 'usr-checker-03',
    primaryManagerName: 'Venkatesh Iyer',
    secondaryManagerId: 'usr-mgr-03',
    secondaryManagerName: 'K. Deepa',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
];

const INITIAL_COMPANY_MODELS: CompanyPurchasingModelConfig[] = [
  { companyId: 'co-kosh-01', model: 'CENTRALIZED', effectiveFrom: '2026-01-01', status: 'ACTIVE', remarks: 'Corporate default model', updatedAt: '2026-01-01T00:00:00Z' },
  { companyId: 'co-kosh-02', model: 'HYBRID', effectiveFrom: '2026-02-01', status: 'ACTIVE', remarks: 'Regional hub shared setup', updatedAt: '2026-02-01T00:00:00Z' },
  { companyId: 'co-kosh-03', model: 'DECENTRALIZED', effectiveFrom: '2026-03-01', status: 'ACTIVE', remarks: 'SEZ independent procurement', updatedAt: '2026-03-01T00:00:00Z' },
  { companyId: 'co-kosh-04', model: 'DECENTRALIZED', effectiveFrom: '2026-04-01', status: 'ACTIVE', remarks: 'North division plant model', updatedAt: '2026-04-01T00:00:00Z' },
];

const INITIAL_EFFECTIVE_ASSIGNMENTS: EffectiveRoleAssignment[] = [
  // po-kosh-01 Primary Buyer
  {
    id: 'eff-po-01-pb-1',
    purchaseOrganizationId: 'po-kosh-01',
    companyId: 'co-kosh-01',
    role: 'PRIMARY_BUYER',
    userId: 'usr-buyer-01',
    userName: 'Vikram Singh',
    employeeId: 'EMP-2001',
    designation: 'Senior Procurement Officer',
    department: 'Central Purchasing Division',
    email: 'vikram.singh@koshinnovations.com',
    validFrom: '2026-01-01',
    validTo: undefined,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'Rajesh Sharma',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  // po-kosh-01 Secondary Buyer
  {
    id: 'eff-po-01-sb-1',
    purchaseOrganizationId: 'po-kosh-01',
    companyId: 'co-kosh-01',
    role: 'SECONDARY_BUYER',
    userId: 'usr-maker-02',
    userName: 'Ananya Deshmukh',
    employeeId: 'EMP-2002',
    designation: 'Purchase Executive (Polymers)',
    department: 'Production & Stores',
    email: 'maker.pnd@koshinnovations.com',
    validFrom: '2026-01-01',
    validTo: undefined,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'Rajesh Sharma',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  // po-kosh-01 Primary Manager
  {
    id: 'eff-po-01-pm-1',
    purchaseOrganizationId: 'po-kosh-01',
    companyId: 'co-kosh-01',
    role: 'PRIMARY_MANAGER',
    userId: 'usr-checker-03',
    userName: 'Venkatesh Iyer',
    employeeId: 'EMP-3001',
    designation: 'Chief Purchasing Manager',
    department: 'Global Sourcing & Contracts',
    email: 'checker.master@koshinnovations.com',
    validFrom: '2026-01-01',
    validTo: undefined,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'Rajesh Sharma',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  // po-kosh-01 Secondary Manager
  {
    id: 'eff-po-01-sm-1',
    purchaseOrganizationId: 'po-kosh-01',
    companyId: 'co-kosh-01',
    role: 'SECONDARY_MANAGER',
    userId: 'usr-mgr-02',
    userName: 'Priya Ramachandran',
    employeeId: 'EMP-3002',
    designation: 'Deputy Purchasing Manager',
    department: 'Supply Chain Governance',
    email: 'priya.r@koshinnovations.com',
    validFrom: '2026-01-01',
    validTo: undefined,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'Rajesh Sharma',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  // po-kosh-02 Assignments
  {
    id: 'eff-po-02-pb-1',
    purchaseOrganizationId: 'po-kosh-02',
    companyId: 'co-kosh-02',
    role: 'PRIMARY_BUYER',
    userId: 'usr-buyer-03',
    userName: 'Karthik Subramanian',
    employeeId: 'EMP-2003',
    designation: 'Junior Sourcing Buyer',
    department: 'Raw Material Procurement',
    email: 'karthik.s@koshinnovations.com',
    validFrom: '2026-02-01',
    validTo: undefined,
    status: 'ACTIVE',
    createdAt: '2026-02-01T00:00:00Z',
    createdBy: 'Rajesh Sharma',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'eff-po-02-sb-1',
    purchaseOrganizationId: 'po-kosh-02',
    companyId: 'co-kosh-02',
    role: 'SECONDARY_BUYER',
    userId: 'usr-buyer-04',
    userName: 'Suresh Kumar',
    employeeId: 'EMP-2004',
    designation: 'IT Sourcing Buyer',
    department: 'Corporate IT & Spares',
    email: 'suresh.k@koshinnovations.com',
    validFrom: '2026-02-01',
    validTo: undefined,
    status: 'ACTIVE',
    createdAt: '2026-02-01T00:00:00Z',
    createdBy: 'Rajesh Sharma',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'eff-po-02-pm-1',
    purchaseOrganizationId: 'po-kosh-02',
    companyId: 'co-kosh-02',
    role: 'PRIMARY_MANAGER',
    userId: 'usr-mgr-03',
    userName: 'K. Deepa',
    employeeId: 'EMP-3003',
    designation: 'Logistics & Purchasing Manager',
    department: 'Logistics & Dispatch Ops',
    email: 'deepa.k@koshinnovations.com',
    validFrom: '2026-02-01',
    validTo: undefined,
    status: 'ACTIVE',
    createdAt: '2026-02-01T00:00:00Z',
    createdBy: 'Rajesh Sharma',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'eff-po-02-sm-1',
    purchaseOrganizationId: 'po-kosh-02',
    companyId: 'co-kosh-02',
    role: 'SECONDARY_MANAGER',
    userId: 'usr-mgr-02',
    userName: 'Priya Ramachandran',
    employeeId: 'EMP-3002',
    designation: 'Deputy Purchasing Manager',
    department: 'Supply Chain Governance',
    email: 'priya.r@koshinnovations.com',
    validFrom: '2026-02-01',
    validTo: undefined,
    status: 'ACTIVE',
    createdAt: '2026-02-01T00:00:00Z',
    createdBy: 'Rajesh Sharma',
    updatedAt: '2026-02-01T00:00:00Z',
  },
];

const INITIAL_ASSIGNMENT_HISTORY: AssignmentHistoryRecord[] = [
  {
    id: 'hist-init-01',
    companyId: 'co-kosh-01',
    companyName: 'Kosh Innovations Pvt Ltd',
    purchaseOrganizationId: 'po-kosh-01',
    purchaseOrganizationCode: 'PO-HQ-01',
    purchaseOrganizationName: 'Kosh Central Procurement Organization',
    role: 'PRIMARY_BUYER',
    newUserId: 'usr-buyer-01',
    newUserName: 'Vikram Singh',
    validFrom: '2026-01-01',
    changedBy: 'Rajesh Sharma (Platform Admin)',
    changedTimestamp: '2026-01-01T00:00:00Z',
    changeReason: 'Initial setup of central primary buyer assignment',
    actionType: 'CREATED',
  },
  {
    id: 'hist-init-02',
    companyId: 'co-kosh-01',
    companyName: 'Kosh Innovations Pvt Ltd',
    purchaseOrganizationId: 'po-kosh-01',
    purchaseOrganizationCode: 'PO-HQ-01',
    purchaseOrganizationName: 'Kosh Central Procurement Organization',
    role: 'PRIMARY_MANAGER',
    newUserId: 'usr-checker-03',
    newUserName: 'Venkatesh Iyer',
    validFrom: '2026-01-01',
    changedBy: 'Rajesh Sharma (Platform Admin)',
    changedTimestamp: '2026-01-01T00:00:00Z',
    changeReason: 'Initial setup of central chief purchasing manager assignment',
    actionType: 'CREATED',
  },
];

const INITIAL_ASSIGNMENT_RULES: BuyerManagerAssignmentRule[] = [
  {
    id: 'rule-01',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    itemCategoryId: 'RM',
    primaryBuyerId: 'Vikram Singh (Senior Procurement Officer)',
    secondaryBuyerId: 'Ananya Deshmukh',
    backupBuyerId: 'Rajesh Sharma',
    primaryManagerId: 'Venkatesh Iyer (Chief Purchasing Manager)',
    alternateManagerId: 'Karthik Raman',
    effectiveFrom: '2026-01-01',
    priority: 1,
    status: 'ACTIVE',
    remarks: 'Raw Material Pondicherry HQ Primary Sourcing Rule',
  },
  {
    id: 'rule-02',
    companyId: 'co-kosh-01',
    itemCategoryId: 'MA',
    primaryBuyerId: 'Ananya Roy (Maintenance Buyer)',
    secondaryBuyerId: 'Vikram Singh',
    primaryManagerId: 'Venkatesh Iyer (Chief Purchasing Manager)',
    effectiveFrom: '2026-01-01',
    priority: 6,
    status: 'ACTIVE',
    remarks: 'Maintenance & Spares Company-wide Default Sourcing Rule',
  },
  {
    id: 'rule-03',
    companyId: 'co-kosh-02',
    branchId: 'br-chen-02',
    itemCategoryId: 'CO',
    primaryBuyerId: 'Suresh Kumar (IT Sourcing Buyer)',
    backupBuyerId: 'Ananya Roy',
    primaryManagerId: 'K. Deepa (Logistics & Purchasing Manager)',
    effectiveFrom: '2026-02-01',
    priority: 4,
    status: 'ACTIVE',
    remarks: 'Chennai IT & Consumable Buyer Assignment',
  },
];

export const PurchaseOrganizationService = {
  getOrganizations(): PurchaseOrganization[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ORGS);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY_ORGS, JSON.stringify(INITIAL_PURCHASE_ORGS));
        return INITIAL_PURCHASE_ORGS;
      }
      return JSON.parse(stored);
    } catch {
      return INITIAL_PURCHASE_ORGS;
    }
  },

  saveOrganization(
    org: PurchaseOrganization,
    changedBy: string = 'Rajesh Sharma (Platform Admin)',
    skipSyncSchedule: boolean = false
  ): void {
    const list = this.getOrganizations();
    const idx = list.findIndex(o => o.id === org.id);
    const prev = idx >= 0 ? list[idx] : undefined;
    if (idx >= 0) {
      list[idx] = org;
    } else {
      list.push(org);
    }
    localStorage.setItem(STORAGE_KEY_ORGS, JSON.stringify(list));

    if (!skipSyncSchedule) {
      const coObj = INITIAL_COMPANIES.find(c => c.id === org.companyId);
      EnterpriseAuditService.logEvent({
        companyId: org.companyId,
        companyName: coObj?.name,
        purchaseOrganizationId: org.id,
        purchaseOrganizationCode: org.code,
        entityType: 'PURCHASE_ORGANIZATION',
        entityId: org.id,
        eventType: prev ? 'PURCHASE_ORG_UPDATED' : 'PURCHASE_ORG_CREATED',
        eventDescription: `${prev ? 'Updated' : 'Created'} Purchase Organization [${org.code}] ${org.name}`,
        previousValue: prev ? (prev as any) : undefined,
        newValue: org as any,
        changedByUserId: 'usr-admin-01',
        changedByName: changedBy,
        effectiveFrom: org.effectiveFrom,
        effectiveTo: org.effectiveTo,
        changeReason: prev ? 'Purchase Organization configuration update' : 'Initial Purchase Organization creation',
        source: 'UI',
      });

      // Synchronize current role assignments into Effective Role Schedule
      this.syncOrgAssignmentsToSchedule(org, changedBy);
    }
  },

  deleteOrganization(id: string): void {
    const prev = this.getOrganizations().find(o => o.id === id);
    const list = this.getOrganizations().filter(o => o.id !== id);
    localStorage.setItem(STORAGE_KEY_ORGS, JSON.stringify(list));

    if (prev) {
      EnterpriseAuditService.logEvent({
        companyId: prev.companyId,
        purchaseOrganizationId: prev.id,
        purchaseOrganizationCode: prev.code,
        entityType: 'PURCHASE_ORGANIZATION',
        entityId: prev.id,
        eventType: 'PURCHASE_ORG_DEACTIVATED',
        eventDescription: `Deleted Purchase Organization [${prev.code}] ${prev.name}`,
        previousValue: prev as any,
        newValue: undefined,
        changedByUserId: 'usr-admin-01',
        changedByName: 'Rajesh Sharma (Platform Admin)',
        changeReason: 'Deleted Purchase Organization from Master Directory',
        source: 'UI',
      });
    }
  },

  getCompanyModels(): CompanyPurchasingModelConfig[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_COMPANY_MODELS);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY_COMPANY_MODELS, JSON.stringify(INITIAL_COMPANY_MODELS));
        return INITIAL_COMPANY_MODELS;
      }
      return JSON.parse(stored);
    } catch {
      return INITIAL_COMPANY_MODELS;
    }
  },

  saveCompanyModel(companyId: string, model: PurchasingModel, remarks?: string): void {
    const models = this.getCompanyModels();
    const idx = models.findIndex(m => m.companyId === companyId);
    const prev = idx >= 0 ? models[idx] : undefined;
    const updatedRecord: CompanyPurchasingModelConfig = {
      companyId,
      model,
      effectiveFrom: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
      remarks: remarks || 'Model updated by Administrator',
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) {
      models[idx] = updatedRecord;
    } else {
      models.push(updatedRecord);
    }
    localStorage.setItem(STORAGE_KEY_COMPANY_MODELS, JSON.stringify(models));

    const coObj = INITIAL_COMPANIES.find(c => c.id === companyId);
    EnterpriseAuditService.logEvent({
      companyId,
      companyName: coObj?.name,
      entityType: 'PURCHASE_ORGANIZATION',
      entityId: `model-${companyId}`,
      eventType: 'PURCHASING_MODEL_CHANGED',
      eventDescription: `Updated Purchasing Governance Model for ${coObj?.name || companyId} to ${model}`,
      previousValue: prev ? (prev as any) : undefined,
      newValue: updatedRecord as any,
      changedByUserId: 'usr-admin-01',
      changedByName: 'Rajesh Sharma (Platform Admin)',
      effectiveFrom: updatedRecord.effectiveFrom,
      changeReason: remarks || 'Company Purchasing Model reconfigured',
      source: 'UI',
    });
  },

  getAssignmentRules(): BuyerManagerAssignmentRule[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_RULES);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(INITIAL_ASSIGNMENT_RULES));
        return INITIAL_ASSIGNMENT_RULES;
      }
      return JSON.parse(stored);
    } catch {
      return INITIAL_ASSIGNMENT_RULES;
    }
  },

  saveAssignmentRule(rule: BuyerManagerAssignmentRule): void {
    const list = this.getAssignmentRules();
    const idx = list.findIndex(r => r.id === rule.id);
    const prev = idx >= 0 ? list[idx] : undefined;
    if (idx >= 0) {
      list[idx] = rule;
    } else {
      list.push(rule);
    }
    localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(list));

    const coObj = INITIAL_COMPANIES.find(c => c.id === rule.companyId);
    EnterpriseAuditService.logEvent({
      companyId: rule.companyId,
      companyName: coObj?.name,
      branchId: rule.branchId !== 'ALL' ? rule.branchId : undefined,
      purchaseOrganizationId: rule.purchaseOrganizationId,
      entityType: 'ASSIGNMENT_RULE',
      entityId: rule.id,
      eventType: prev ? 'ASSIGNMENT_RULE_UPDATED' : 'ASSIGNMENT_RULE_CREATED',
      eventDescription: `${prev ? 'Updated' : 'Created'} Buyer/Manager Assignment Rule (Category: ${rule.itemCategoryId || 'ALL'})`,
      previousValue: prev ? (prev as any) : undefined,
      newValue: rule as any,
      changedByUserId: 'usr-admin-01',
      changedByName: 'Rajesh Sharma (Platform Admin)',
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      changeReason: rule.remarks || 'Assignment Rule saved',
      source: 'UI',
    });
  },

  deleteAssignmentRule(id: string): void {
    const prev = this.getAssignmentRules().find(r => r.id === id);
    const list = this.getAssignmentRules().filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(list));

    if (prev) {
      EnterpriseAuditService.logEvent({
        companyId: prev.companyId,
        entityType: 'ASSIGNMENT_RULE',
        entityId: prev.id,
        eventType: 'ASSIGNMENT_RULE_DELETED',
        eventDescription: `Deleted Assignment Rule ID ${prev.id} (Category: ${prev.itemCategoryId || 'ALL'})`,
        previousValue: prev as any,
        newValue: undefined,
        changedByUserId: 'usr-admin-01',
        changedByName: 'Rajesh Sharma (Platform Admin)',
        changeReason: 'Deleted assignment rule from rules directory',
        source: 'UI',
      });
    }
  },

  // ==========================================
  // EFFECTIVE-DATED ROLE ASSIGNMENTS & DELEGATION
  // ==========================================

  getEffectiveRoleAssignments(poId?: string, role?: AssignmentRole): EffectiveRoleAssignment[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_EFFECTIVE_ASSIGNMENTS);
      let list: EffectiveRoleAssignment[];
      if (!stored) {
        localStorage.setItem(STORAGE_KEY_EFFECTIVE_ASSIGNMENTS, JSON.stringify(INITIAL_EFFECTIVE_ASSIGNMENTS));
        list = INITIAL_EFFECTIVE_ASSIGNMENTS;
      } else {
        list = JSON.parse(stored);
      }

      if (poId) {
        list = list.filter(a => a.purchaseOrganizationId === poId);
      }
      if (role) {
        list = list.filter(a => a.role === role);
      }
      return list;
    } catch {
      return INITIAL_EFFECTIVE_ASSIGNMENTS;
    }
  },

  saveEffectiveRoleAssignment(params: {
    purchaseOrganizationId: string;
    companyId: string;
    role: AssignmentRole;
    userId: string;
    userName: string;
    employeeId?: string;
    designation?: string;
    department?: string;
    email?: string;
    validFrom: string;
    validTo?: string;
    changeReason: string;
    changedBy: string;
  }): { success: boolean; message: string; assignment?: EffectiveRoleAssignment } {
    if (!params.validFrom) {
      return { success: false, message: 'Valid From date is required.' };
    }
    if (params.validTo && params.validTo < params.validFrom) {
      return { success: false, message: 'Valid To date cannot be earlier than Valid From date.' };
    }

    const allAssignments = this.getEffectiveRoleAssignments();
    const poList = this.getOrganizations();
    const poObj = poList.find(p => p.id === params.purchaseOrganizationId);
    const coObj = INITIAL_COMPANIES.find(c => c.id === params.companyId);

    // Check existing active assignments for this PO & Role
    const existingRoleAssignments = allAssignments.filter(
      a => a.purchaseOrganizationId === params.purchaseOrganizationId && a.role === params.role && a.status === 'ACTIVE'
    );

    // Overlap validation & Auto-adjustment for continuous coverage
    for (const existing of existingRoleAssignments) {
      const exStart = existing.validFrom;
      const exEnd = existing.validTo || '9999-12-31';
      const newStart = params.validFrom;
      const newEnd = params.validTo || '9999-12-31';

      // Check if dates overlap
      if (newStart <= exEnd && newEnd >= exStart) {
        // If the existing assignment started BEFORE the new one, cap its validTo date to day before newStart
        if (exStart < newStart) {
          const dayBefore = new Date(new Date(newStart).getTime() - 86400000).toISOString().split('T')[0];
          existing.validTo = dayBefore;
          existing.updatedAt = new Date().toISOString();
        } else if (exStart === newStart) {
          // Same start date: supersede previous
          existing.status = 'SUPERSEDED';
          existing.validTo = dayBeforeString(newStart);
          existing.updatedAt = new Date().toISOString();
        } else {
          return {
            success: false,
            message: `Conflict: An existing assignment for ${params.role} already exists starting from ${exStart} to ${existing.validTo || 'Open-ended'}. Please resolve date overlap.`,
          };
        }
      }
    }

    // Find previous active user for audit history
    const activePrev = existingRoleAssignments.find(a => a.status === 'ACTIVE');

    const newAssignment: EffectiveRoleAssignment = {
      id: `eff-role-${Date.now()}`,
      purchaseOrganizationId: params.purchaseOrganizationId,
      companyId: params.companyId,
      role: params.role,
      userId: params.userId,
      userName: params.userName,
      employeeId: params.employeeId,
      designation: params.designation,
      department: params.department,
      email: params.email,
      validFrom: params.validFrom,
      validTo: params.validTo || undefined,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      createdBy: params.changedBy,
      updatedAt: new Date().toISOString(),
    };

    allAssignments.push(newAssignment);
    localStorage.setItem(STORAGE_KEY_EFFECTIVE_ASSIGNMENTS, JSON.stringify(allAssignments));

    // Save History Log
    this.saveAssignmentHistoryRecord({
      companyId: params.companyId,
      companyName: coObj?.name,
      purchaseOrganizationId: params.purchaseOrganizationId,
      purchaseOrganizationCode: poObj?.code,
      purchaseOrganizationName: poObj?.name,
      role: params.role,
      previousUserId: activePrev?.userId,
      previousUserName: activePrev?.userName,
      newUserId: params.userId,
      newUserName: params.userName,
      validFrom: params.validFrom,
      validTo: params.validTo,
      changedBy: params.changedBy,
      changedTimestamp: new Date().toISOString(),
      changeReason: params.changeReason || 'Effective-dated assignment update',
      actionType: new Date(params.validFrom) > new Date() ? 'SCHEDULED' : 'CREATED',
    });

    const auditEntityType: any = params.role.includes('BUYER') ? 'BUYER_ASSIGNMENT' : 'MANAGER_ASSIGNMENT';
    EnterpriseAuditService.logEvent({
      companyId: params.companyId,
      companyName: coObj?.name,
      purchaseOrganizationId: params.purchaseOrganizationId,
      purchaseOrganizationCode: poObj?.code,
      entityType: auditEntityType,
      entityId: newAssignment.id,
      eventType: `${params.role}_ASSIGNED`,
      eventDescription: `Assigned ${params.role.replace('_', ' ')} (${params.userName}) for ${poObj?.code || params.purchaseOrganizationId}`,
      previousValue: activePrev ? (activePrev as any) : undefined,
      newValue: newAssignment as any,
      changedByUserId: 'usr-admin-01',
      changedByName: params.changedBy,
      effectiveFrom: params.validFrom,
      effectiveTo: params.validTo,
      changeReason: params.changeReason || 'Effective-dated role assignment saved',
      source: 'UI',
    });

    // Sync snapshot on PO object if effective today
    const todayStr = new Date().toISOString().split('T')[0];
    if (params.validFrom <= todayStr && (!params.validTo || params.validTo >= todayStr)) {
      if (poObj) {
        if (params.role === 'PRIMARY_BUYER') {
          poObj.primaryBuyerId = params.userId;
          poObj.primaryBuyerName = params.userName;
        } else if (params.role === 'SECONDARY_BUYER') {
          poObj.secondaryBuyerId = params.userId;
          poObj.secondaryBuyerName = params.userName;
        } else if (params.role === 'PRIMARY_MANAGER') {
          poObj.primaryManagerId = params.userId;
          poObj.primaryManagerName = params.userName;
        } else if (params.role === 'SECONDARY_MANAGER') {
          poObj.secondaryManagerId = params.userId;
          poObj.secondaryManagerName = params.userName;
        }
        this.saveOrganization(poObj, params.changedBy, true);
      }
    }

    return { success: true, message: `Successfully assigned ${params.role} (${params.userName}) effective from ${params.validFrom}`, assignment: newAssignment };
  },

  deactivateEffectiveRoleAssignment(assignmentId: string, reason: string, changedBy: string): { success: boolean; message: string } {
    const list = this.getEffectiveRoleAssignments();
    const item = list.find(a => a.id === assignmentId);
    if (!item) return { success: false, message: 'Assignment record not found.' };

    item.status = 'INACTIVE';
    item.validTo = new Date().toISOString().split('T')[0];
    item.updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY_EFFECTIVE_ASSIGNMENTS, JSON.stringify(list));

    const poObj = this.getOrganizations().find(p => p.id === item.purchaseOrganizationId);

    this.saveAssignmentHistoryRecord({
      companyId: item.companyId,
      purchaseOrganizationId: item.purchaseOrganizationId,
      purchaseOrganizationCode: poObj?.code,
      purchaseOrganizationName: poObj?.name,
      role: item.role,
      previousUserId: item.userId,
      previousUserName: item.userName,
      newUserId: 'DEACTIVATED',
      newUserName: 'Unassigned',
      validFrom: item.validFrom,
      validTo: item.validTo,
      changedBy,
      changedTimestamp: new Date().toISOString(),
      changeReason: reason || 'Deactivated assignment',
      actionType: 'DEACTIVATED',
    });

    EnterpriseAuditService.logEvent({
      companyId: item.companyId,
      purchaseOrganizationId: item.purchaseOrganizationId,
      purchaseOrganizationCode: poObj?.code,
      entityType: item.role.includes('BUYER') ? 'BUYER_ASSIGNMENT' : 'MANAGER_ASSIGNMENT',
      entityId: item.id,
      eventType: `${item.role}_DEACTIVATED`,
      eventDescription: `Deactivated ${item.role.replace('_', ' ')} assignment (${item.userName}) for ${poObj?.code || item.purchaseOrganizationId}`,
      previousValue: item as any,
      newValue: { ...item, status: 'INACTIVE' },
      changedByUserId: 'usr-admin-01',
      changedByName: changedBy,
      changeReason: reason || 'Deactivated role assignment',
      source: 'UI',
    });

    return { success: true, message: 'Assignment successfully deactivated.' };
  },

  addTemporaryDelegation(params: {
    assignmentId: string;
    replacementUserId: string;
    replacementUserName: string;
    replacementEmployeeId?: string;
    replacementDesignation?: string;
    replacementEmail?: string;
    delegationValidFrom: string;
    delegationValidTo: string;
    reason: string;
    authorizedBy: string;
  }): { success: boolean; message: string } {
    if (!params.delegationValidFrom || !params.delegationValidTo) {
      return { success: false, message: 'Delegation start and end dates are required.' };
    }
    if (params.delegationValidTo < params.delegationValidFrom) {
      return { success: false, message: 'Delegation Valid To cannot be earlier than Valid From date.' };
    }

    const list = this.getEffectiveRoleAssignments();
    const item = list.find(a => a.id === params.assignmentId);
    if (!item) return { success: false, message: 'Role assignment not found.' };

    const delegation: TemporaryDelegation = {
      id: `del-${Date.now()}`,
      originalUserId: item.userId,
      originalUserName: item.userName,
      replacementUserId: params.replacementUserId,
      replacementUserName: params.replacementUserName,
      replacementEmployeeId: params.replacementEmployeeId,
      replacementDesignation: params.replacementDesignation,
      replacementEmail: params.replacementEmail,
      delegationValidFrom: params.delegationValidFrom,
      delegationValidTo: params.delegationValidTo,
      reason: params.reason,
      authorizedBy: params.authorizedBy,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    item.delegation = delegation;
    item.updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY_EFFECTIVE_ASSIGNMENTS, JSON.stringify(list));

    const poObj = this.getOrganizations().find(p => p.id === item.purchaseOrganizationId);

    this.saveAssignmentHistoryRecord({
      companyId: item.companyId,
      purchaseOrganizationId: item.purchaseOrganizationId,
      purchaseOrganizationCode: poObj?.code,
      purchaseOrganizationName: poObj?.name,
      role: item.role,
      previousUserId: item.userId,
      previousUserName: item.userName,
      newUserId: params.replacementUserId,
      newUserName: `${params.replacementUserName} (Temp Delegate)`,
      validFrom: params.delegationValidFrom,
      validTo: params.delegationValidTo,
      changedBy: params.authorizedBy,
      changedTimestamp: new Date().toISOString(),
      changeReason: `Temporary Replacement Delegation: ${params.reason}`,
      actionType: 'DELEGATED',
    });

    EnterpriseAuditService.logEvent({
      companyId: item.companyId,
      purchaseOrganizationId: item.purchaseOrganizationId,
      purchaseOrganizationCode: poObj?.code,
      entityType: 'DELEGATION',
      entityId: delegation.id,
      eventType: 'TEMPORARY_DELEGATION_ADDED',
      eventDescription: `Delegated ${item.role.replace('_', ' ')} replacement user (${params.replacementUserName}) for ${item.userName} from ${params.delegationValidFrom} to ${params.delegationValidTo}`,
      previousValue: { originalUserId: item.userId, originalUserName: item.userName },
      newValue: delegation as any,
      changedByUserId: 'usr-admin-01',
      changedByName: params.authorizedBy,
      effectiveFrom: params.delegationValidFrom,
      effectiveTo: params.delegationValidTo,
      changeReason: params.reason,
      source: 'UI',
    });

    return {
      success: true,
      message: `Temporary replacement (${params.replacementUserName}) delegated for ${item.role} from ${params.delegationValidFrom} to ${params.delegationValidTo}.`,
    };
  },

  revokeTemporaryDelegation(assignmentId: string, reason: string, changedBy: string): { success: boolean; message: string } {
    const list = this.getEffectiveRoleAssignments();
    const item = list.find(a => a.id === assignmentId);
    if (!item || !item.delegation) return { success: false, message: 'No active delegation found.' };

    const originalDelegateName = item.delegation.replacementUserName;
    item.delegation.status = 'REVOKED';

    localStorage.setItem(STORAGE_KEY_EFFECTIVE_ASSIGNMENTS, JSON.stringify(list));

    const poObj = this.getOrganizations().find(p => p.id === item.purchaseOrganizationId);

    this.saveAssignmentHistoryRecord({
      companyId: item.companyId,
      purchaseOrganizationId: item.purchaseOrganizationId,
      purchaseOrganizationCode: poObj?.code,
      purchaseOrganizationName: poObj?.name,
      role: item.role,
      previousUserId: item.delegation.replacementUserId,
      previousUserName: `${originalDelegateName} (Delegate)`,
      newUserId: item.userId,
      newUserName: item.userName,
      validFrom: new Date().toISOString().split('T')[0],
      changedBy,
      changedTimestamp: new Date().toISOString(),
      changeReason: reason || 'Revoked temporary delegation',
      actionType: 'REVOKED_DELEGATION',
    });

    EnterpriseAuditService.logEvent({
      companyId: item.companyId,
      purchaseOrganizationId: item.purchaseOrganizationId,
      purchaseOrganizationCode: poObj?.code,
      entityType: 'DELEGATION',
      entityId: `del-rev-${Date.now()}`,
      eventType: 'TEMPORARY_DELEGATION_REVOKED',
      eventDescription: `Revoked temporary delegation of ${item.role.replace('_', ' ')} for ${originalDelegateName}, restored original user ${item.userName}`,
      previousValue: item.delegation as any,
      newValue: { ...item.delegation, status: 'REVOKED' },
      changedByUserId: 'usr-admin-01',
      changedByName: changedBy,
      changeReason: reason || 'Revoked temporary replacement delegation',
      source: 'UI',
    });

    return { success: true, message: 'Temporary delegation revoked. Original user resumed.' };
  },

  // Deterministic User Determination Engine based on target date
  resolveEffectiveUserForDate(
    poId: string,
    role: AssignmentRole,
    targetDate: string = new Date().toISOString().split('T')[0]
  ): {
    userId: string;
    userName: string;
    employeeId?: string;
    designation?: string;
    email?: string;
    status: 'CURRENT' | 'UPCOMING' | 'EXPIRED' | 'TEMPORARILY_REPLACED' | 'UNMAPPED';
    isDelegated: boolean;
    originalUser?: { userId: string; userName: string };
    assignmentRecord?: EffectiveRoleAssignment;
    message: string;
  } {
    const assignments = this.getEffectiveRoleAssignments(poId, role);

    // Find active assignment matching date range
    const validMatches = assignments.filter(a => {
      if (a.status !== 'ACTIVE') return false;
      const vFrom = a.validFrom;
      const vTo = a.validTo || '9999-12-31';
      return targetDate >= vFrom && targetDate <= vTo;
    });

    if (validMatches.length === 0) {
      // Check upcoming or expired for informative status
      const upcoming = assignments.find(a => a.status === 'ACTIVE' && a.validFrom > targetDate);
      if (upcoming) {
        return {
          userId: upcoming.userId,
          userName: upcoming.userName,
          employeeId: upcoming.employeeId,
          designation: upcoming.designation,
          email: upcoming.email,
          status: 'UPCOMING',
          isDelegated: false,
          assignmentRecord: upcoming,
          message: `Scheduled assignment starting ${upcoming.validFrom}`,
        };
      }

      const po = this.getOrganizations().find(p => p.id === poId);
      // Fallback to PO snapshot
      let fallbackId = '';
      let fallbackName = '';
      if (role === 'PRIMARY_BUYER') { fallbackId = po?.primaryBuyerId || ''; fallbackName = po?.primaryBuyerName || ''; }
      else if (role === 'SECONDARY_BUYER') { fallbackId = po?.secondaryBuyerId || ''; fallbackName = po?.secondaryBuyerName || ''; }
      else if (role === 'PRIMARY_MANAGER') { fallbackId = po?.primaryManagerId || ''; fallbackName = po?.primaryManagerName || ''; }
      else if (role === 'SECONDARY_MANAGER') { fallbackId = po?.secondaryManagerId || ''; fallbackName = po?.secondaryManagerName || ''; }

      return {
        userId: fallbackId || 'UNASSIGNED',
        userName: fallbackName || 'Unassigned User',
        status: fallbackId ? 'CURRENT' : 'UNMAPPED',
        isDelegated: false,
        message: fallbackId ? 'Resolved from Organization master snapshot' : 'No valid effective assignment found.',
      };
    }

    if (validMatches.length > 1) {
      return {
        userId: validMatches[0].userId,
        userName: validMatches[0].userName,
        status: 'CURRENT',
        isDelegated: false,
        assignmentRecord: validMatches[0],
        message: `Conflict Warning: ${validMatches.length} overlapping valid assignments found for date ${targetDate}. Resolving primary.`,
      };
    }

    const match = validMatches[0];

    // Check if temporary delegation is active on targetDate
    if (
      match.delegation &&
      match.delegation.status === 'ACTIVE' &&
      targetDate >= match.delegation.delegationValidFrom &&
      targetDate <= match.delegation.delegationValidTo
    ) {
      return {
        userId: match.delegation.replacementUserId,
        userName: match.delegation.replacementUserName,
        employeeId: match.delegation.replacementEmployeeId,
        designation: match.delegation.replacementDesignation,
        email: match.delegation.replacementEmail,
        status: 'TEMPORARILY_REPLACED',
        isDelegated: true,
        originalUser: { userId: match.userId, userName: match.userName },
        assignmentRecord: match,
        message: `Active Temporary Replacement (${match.delegation.replacementUserName}) in effect until ${match.delegation.delegationValidTo} (Original: ${match.userName})`,
      };
    }

    return {
      userId: match.userId,
      userName: match.userName,
      employeeId: match.employeeId,
      designation: match.designation,
      email: match.email,
      status: 'CURRENT',
      isDelegated: false,
      assignmentRecord: match,
      message: 'Active current assignment resolved.',
    };
  },

  // AUDIT HISTORY LOGGING & QUERYING
  getAssignmentHistory(filters?: {
    companyId?: string;
    purchaseOrganizationId?: string;
    role?: AssignmentRole;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): AssignmentHistoryRecord[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ASSIGNMENT_HISTORY);
      let list: AssignmentHistoryRecord[];
      if (!stored) {
        localStorage.setItem(STORAGE_KEY_ASSIGNMENT_HISTORY, JSON.stringify(INITIAL_ASSIGNMENT_HISTORY));
        list = INITIAL_ASSIGNMENT_HISTORY;
      } else {
        list = JSON.parse(stored);
      }

      if (filters) {
        if (filters.companyId && filters.companyId !== 'ALL') {
          list = list.filter(h => h.companyId === filters.companyId);
        }
        if (filters.purchaseOrganizationId && filters.purchaseOrganizationId !== 'ALL') {
          list = list.filter(h => h.purchaseOrganizationId === filters.purchaseOrganizationId);
        }
        if (filters.role && filters.role !== ('ALL' as any)) {
          list = list.filter(h => h.role === filters.role);
        }
        if (filters.userId) {
          list = list.filter(h => h.newUserId === filters.userId || h.previousUserId === filters.userId);
        }
        if (filters.dateFrom) {
          list = list.filter(h => h.changedTimestamp >= filters.dateFrom!);
        }
        if (filters.dateTo) {
          list = list.filter(h => h.changedTimestamp <= filters.dateTo!);
        }
      }

      return list.sort((a, b) => new Date(b.changedTimestamp).getTime() - new Date(a.changedTimestamp).getTime());
    } catch {
      return INITIAL_ASSIGNMENT_HISTORY;
    }
  },

  saveAssignmentHistoryRecord(record: Omit<AssignmentHistoryRecord, 'id'>): void {
    const list = this.getAssignmentHistory();
    const newRecord: AssignmentHistoryRecord = {
      ...record,
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    list.unshift(newRecord);
    localStorage.setItem(STORAGE_KEY_ASSIGNMENT_HISTORY, JSON.stringify(list));
  },

  // Helper method to keep PO object active snapshot in sync
  syncOrgAssignmentsToSchedule(org: PurchaseOrganization, changedBy: string = 'System Admin'): void {
    const today = new Date().toISOString().split('T')[0];
    const roles: Array<{ role: AssignmentRole; id?: string; name?: string }> = [
      { role: 'PRIMARY_BUYER', id: org.primaryBuyerId, name: org.primaryBuyerName },
      { role: 'SECONDARY_BUYER', id: org.secondaryBuyerId, name: org.secondaryBuyerName },
      { role: 'PRIMARY_MANAGER', id: org.primaryManagerId, name: org.primaryManagerName },
      { role: 'SECONDARY_MANAGER', id: org.secondaryManagerId, name: org.secondaryManagerName },
    ];

    roles.forEach(({ role, id, name }) => {
      if (id && name) {
        const userObj = INITIAL_USERS.find(u => u.id === id || u.fullName === name);
        this.saveEffectiveRoleAssignment({
          purchaseOrganizationId: org.id,
          companyId: org.companyId,
          role,
          userId: id,
          userName: name,
          employeeId: userObj?.employeeId,
          designation: userObj?.designation,
          department: userObj?.department,
          email: userObj?.email,
          validFrom: org.effectiveFrom || today,
          changeReason: 'Updated Purchase Organization Master',
          changedBy,
        });
      }
    });
  },

  /**
   * Deterministic Priority Rule Resolution Engine:
   * 1. Company + Branch + Item Category + Material (Priority 1)
   * 2. Company + Branch + Material (Priority 2)
   * 3. Company + Item Category + Material (Priority 3)
   * 4. Company + Branch + Item Category (Priority 4)
   * 5. Company + Material (Priority 5)
   * 6. Company + Item Category (Priority 6)
   * 7. Company + Branch (Priority 7)
   * 8. Company-wide default (Priority 8)
   */
  resolveAssignmentRule(params: {
    companyId: string;
    branchId?: string;
    itemCategory?: string;
    materialCode?: string;
    purchaseOrganizationId?: string;
    targetDate?: string;
  }): {
    rule: BuyerManagerAssignmentRule | null;
    specificityLevel: number;
    specificityLabel: string;
    conflict: boolean;
    conflictRules?: BuyerManagerAssignmentRule[];
    message: string;
    resolvedAssignments?: {
      primaryBuyer: ResolvedEffectiveUser;
      secondaryBuyer: ResolvedEffectiveUser;
      primaryManager: ResolvedEffectiveUser;
      secondaryManager: ResolvedEffectiveUser;
    };
  } {
    const targetDate = params.targetDate || new Date().toISOString().split('T')[0];
    const rules = this.getAssignmentRules().filter(
      r => r.status === 'ACTIVE' && r.companyId === params.companyId
    );

    let resolvedAssignments: any = undefined;
    if (params.purchaseOrganizationId) {
      resolvedAssignments = {
        primaryBuyer: this.resolveEffectiveUserForDate(params.purchaseOrganizationId, 'PRIMARY_BUYER', targetDate),
        secondaryBuyer: this.resolveEffectiveUserForDate(params.purchaseOrganizationId, 'SECONDARY_BUYER', targetDate),
        primaryManager: this.resolveEffectiveUserForDate(params.purchaseOrganizationId, 'PRIMARY_MANAGER', targetDate),
        secondaryManager: this.resolveEffectiveUserForDate(params.purchaseOrganizationId, 'SECONDARY_MANAGER', targetDate),
      };
    }

    if (rules.length === 0) {
      return {
        rule: null,
        specificityLevel: 99,
        specificityLabel: 'None',
        conflict: false,
        message: 'No active rules found for the selected company.',
        resolvedAssignments,
      };
    }

    const calculateSpecificity = (r: BuyerManagerAssignmentRule): number => {
      const hasBranch = r.branchId && r.branchId !== 'ALL' && r.branchId === params.branchId;
      const hasCategory = r.itemCategoryId && r.itemCategoryId !== 'ALL' && r.itemCategoryId === params.itemCategory;
      const hasMaterial = r.materialId && r.materialId !== 'ALL' && r.materialId === params.materialCode;

      if (hasBranch && hasCategory && hasMaterial) return 1;
      if (hasBranch && hasMaterial) return 2;
      if (hasCategory && hasMaterial) return 3;
      if (hasBranch && hasCategory) return 4;
      if (hasMaterial) return 5;
      if (hasCategory) return 6;
      if (hasBranch) return 7;
      return 8;
    };

    const matchingRules = rules.filter(r => {
      if (r.branchId && r.branchId !== 'ALL' && params.branchId && r.branchId !== params.branchId) return false;
      if (r.itemCategoryId && r.itemCategoryId !== 'ALL' && params.itemCategory && r.itemCategoryId !== params.itemCategory) return false;
      if (r.materialId && r.materialId !== 'ALL' && params.materialCode && r.materialId !== params.materialCode) return false;
      if (r.purchaseOrganizationId && params.purchaseOrganizationId && r.purchaseOrganizationId !== params.purchaseOrganizationId) return false;
      if (r.effectiveFrom && r.effectiveFrom > targetDate) return false;
      if (r.effectiveTo && r.effectiveTo < targetDate) return false;
      return true;
    });

    if (matchingRules.length === 0) {
      return {
        rule: null,
        specificityLevel: 99,
        specificityLabel: 'No Match',
        conflict: false,
        message: 'No matching buyer rule for this branch/category/material combination.',
        resolvedAssignments,
      };
    }

    const scoredRules = matchingRules.map(r => ({
      rule: r,
      specificity: calculateSpecificity(r),
    })).sort((a, b) => a.specificity - b.specificity);

    const bestScore = scoredRules[0].specificity;
    const topMatches = scoredRules.filter(sr => sr.specificity === bestScore);

    if (topMatches.length > 1) {
      return {
        rule: topMatches[0].rule,
        specificityLevel: bestScore,
        specificityLabel: `Level ${bestScore} (Conflict Detected)`,
        conflict: true,
        conflictRules: topMatches.map(t => t.rule),
        message: `Conflict: ${topMatches.length} rules found with equal specificity score ${bestScore}.`,
        resolvedAssignments,
      };
    }

    const labels: Record<number, string> = {
      1: 'Level 1: Company + Branch + Category + Material',
      2: 'Level 2: Company + Branch + Material',
      3: 'Level 3: Company + Category + Material',
      4: 'Level 4: Company + Branch + Category',
      5: 'Level 5: Company + Material',
      6: 'Level 6: Company + Category',
      7: 'Level 7: Company + Branch',
      8: 'Level 8: Company-Wide Default',
    };

    return {
      rule: topMatches[0].rule,
      specificityLevel: bestScore,
      specificityLabel: labels[bestScore] || `Level ${bestScore}`,
      conflict: false,
      message: 'Rule successfully resolved with effective dates.',
      resolvedAssignments,
    };
  },
};

function dayBeforeString(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}
