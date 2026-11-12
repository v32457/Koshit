/**
 * CIPPLATFORM - PURCHASE REQUISITION (PR) SERVICE
 * Manages Phase 1 PR workflow, applicability, MRP import, duplicate detection, budget validation, approval routing, branch-based cleanup policies, and advance notification generation.
 */

import {
  PurchaseRequisitionHeader,
  PurchaseRequisitionLine,
  PRType,
  PRStatus,
  PRPriority,
  PRApplicabilityConfig,
  PRCleanupConfig,
  BranchPRCleanupPolicy,
  PRArchiveLog,
  PRChangeHistory
} from '../types/purchaseRequisition';
import { User } from '../types';
import { marketBenchmarkService } from './marketBenchmarkService';

const STORAGE_KEY_PRS = 'cip_purchase_requisitions_v1';
const STORAGE_KEY_APPLICABILITY = 'cip_pr_applicability_v1';
const STORAGE_KEY_CLEANUP = 'cip_pr_cleanup_config_v1';
const STORAGE_KEY_BRANCH_POLICIES = 'cip_branch_pr_cleanup_policies_v1';
const STORAGE_KEY_ARCHIVES = 'cip_pr_archives_v1';

// Initial Seed PRs
const INITIAL_PRS: PurchaseRequisitionHeader[] = [
  {
    id: 'pr-001',
    prNumber: 'PR-2026-0001',
    prType: 'MANUAL',
    companyId: 'comp-1',
    companyCode: 'KOSH_INNOVATIONS',
    branchId: 'branch-001',
    branchCode: '001',
    branchName: 'Hosur Plant 1',
    department: 'Production',
    costCentre: 'CC-PROD-101',
    requesterId: 'emp-101',
    requesterName: 'Arun Kumar (Production Engineer)',
    creatorId: 'emp-101',
    creatorName: 'Arun Kumar',
    priority: 'URGENT',
    status: 'APPROVED_PENDING_BUYER',
    purchasePurpose: 'Machinery maintenance raw materials and alloy plates',
    businessJustification: 'Critical breakdown maintenance for CNC Milling Machine #4',
    deliveryLocation: 'Hosur Plant 1 Store, Bay 3',
    estimatedTotalValue: 145000,
    currency: 'INR',
    budgetValidationStatus: 'SUFFICIENT',
    budgetSourceRef: 'BUDGET-FY26-PROD-Q3',
    erpStockStatus: 'FRESH',
    erpStockTimestamp: new Date().toISOString(),
    equipmentId: 'EQ-CNC-04',
    breakdownRef: 'BRK-2026-892',
    lines: [
      {
        id: 'pr-line-001',
        prId: 'pr-001',
        itemCode: 'RM-ALLOY-316L',
        description: 'Stainless Steel 316L Alloy Plates 12mm',
        itemCategory: 'Raw Materials',
        inventoryUom: 'KG',
        requestedQuantity: 500,
        approximateUnitPrice: 290,
        currency: 'INR',
        estimatedTotalValue: 145000,
        specifications: 'ASTM A240 grade 316L, mill test certificate required',
        remarks: 'Urgent requirement for spindle repair',
        deliverySchedules: [
          { id: 'sch-1', lineId: 'pr-line-001', deliveryDate: '2026-11-15', quantity: 300 },
          { id: 'sch-2', lineId: 'pr-line-001', deliveryDate: '2026-11-25', quantity: 200 }
        ],
        assignedBuyer: 'Suresh Buyer (Hosur Procurement)',
        buyerStatus: 'PENDING_BUYER_ACTION',
        status: 'ACTIVE',
        approvedQuantity: 500,
        receivedQuantity: 0
      }
    ],
    changeHistory: [],
    attachments: [
      {
        id: 'att-1',
        fileName: 'Machine_Breakdown_Report_CNC4.pdf',
        fileSize: 1048576,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'Arun Kumar'
      }
    ],
    createdAt: new Date(Date.now() - 86400000 * 50).toISOString(), // 50 days old (triggers stale policy)
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    submittedAt: new Date(Date.now() - 86400000 * 50).toISOString(),
    approvedAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'pr-002',
    prNumber: 'PR-2026-0002',
    prType: 'MRP',
    companyId: 'comp-1',
    companyCode: 'KOSH_INNOVATIONS',
    branchId: 'branch-002',
    branchCode: '002',
    branchName: 'Chennai Hub',
    department: 'Assembly',
    costCentre: 'CC-ASM-202',
    requesterId: 'emp-102',
    requesterName: 'Priya Sharma (MRP Planner)',
    creatorId: 'emp-102',
    creatorName: 'Priya Sharma',
    priority: 'NORMAL',
    status: 'DRAFT',
    purchasePurpose: 'Scheduled monthly MRP component replenishment',
    businessJustification: 'Reorder point triggered for standard fastener kits',
    deliveryLocation: 'Chennai Warehouse Section B',
    estimatedTotalValue: 48000,
    currency: 'INR',
    budgetValidationStatus: 'SUFFICIENT',
    budgetSourceRef: 'BUDGET-FY26-ASM-Q3',
    erpStockStatus: 'FRESH',
    erpStockTimestamp: new Date().toISOString(),
    mrpRunRef: 'MRP-RUN-2026-11-01',
    lines: [
      {
        id: 'pr-line-002',
        prId: 'pr-002',
        itemCode: 'PKG-FASTENER-M8',
        description: 'Hex Socket Head Cap Screws M8 x 30mm',
        itemCategory: 'Hardware / Fasteners',
        inventoryUom: 'BOX',
        requestedQuantity: 120,
        approximateUnitPrice: 400,
        currency: 'INR',
        estimatedTotalValue: 48000,
        specifications: 'High tensile grade 12.9 blackodised',
        deliverySchedules: [
          { id: 'sch-3', lineId: 'pr-line-002', deliveryDate: '2026-11-20', quantity: 120 }
        ],
        assignedBuyer: 'Ramesh Procurement',
        buyerStatus: 'PENDING_CONFIGURATION',
        status: 'ACTIVE',
        receivedQuantity: 0
      }
    ],
    changeHistory: [],
    attachments: [],
    createdAt: new Date(Date.now() - 86400000 * 42).toISOString(), // 42 days old (nearing 45-day threshold, triggers advance warning)
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    submittedAt: new Date(Date.now() - 86400000 * 1).toISOString()
  }
];

const INITIAL_BRANCH_POLICIES: BranchPRCleanupPolicy[] = [
  {
    branchId: 'branch-001',
    branchCode: '001',
    branchName: 'Hosur Plant 1',
    ageThresholdDays: 45,
    advanceWarningDays: 5,
    isEnabled: true,
    notifyRequesters: true,
    notifyApprovers: true,
    notifyBuyers: true,
    channels: ['IN_PORTAL', 'EMAIL', 'WHATSAPP'],
    updatedAt: new Date().toISOString(),
    updatedBy: 'Suresh Kumar (Admin)'
  },
  {
    branchId: 'branch-002',
    branchCode: '002',
    branchName: 'Chennai Hub',
    ageThresholdDays: 30,
    advanceWarningDays: 4,
    isEnabled: true,
    notifyRequesters: true,
    notifyApprovers: true,
    notifyBuyers: false,
    channels: ['IN_PORTAL', 'EMAIL'],
    updatedAt: new Date().toISOString(),
    updatedBy: 'Suresh Kumar (Admin)'
  }
];

export const PurchaseRequisitionService = {
  getPurchaseRequisitions(): PurchaseRequisitionHeader[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PRS);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY_PRS, JSON.stringify(INITIAL_PRS));
        return INITIAL_PRS;
      }
      return JSON.parse(stored);
    } catch {
      return INITIAL_PRS;
    }
  },

  savePurchaseRequisitions(prs: PurchaseRequisitionHeader[]): void {
    localStorage.setItem(STORAGE_KEY_PRS, JSON.stringify(prs));
  },

  getApplicabilityConfigs(): PRApplicabilityConfig[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_APPLICABILITY);
      if (!stored) {
        const defaults: PRApplicabilityConfig[] = [
          {
            id: 'app-1',
            companyId: 'comp-1',
            branchId: 'ALL',
            groupId: 'ALL',
            prType: 'ALL',
            isEnabled: true,
            updatedAt: new Date().toISOString(),
            updatedBy: 'System Admin'
          }
        ];
        localStorage.setItem(STORAGE_KEY_APPLICABILITY, JSON.stringify(defaults));
        return defaults;
      }
      return JSON.parse(stored);
    } catch {
      return [];
    }
  },

  saveApplicabilityConfigs(configs: PRApplicabilityConfig[]): void {
    localStorage.setItem(STORAGE_KEY_APPLICABILITY, JSON.stringify(configs));
  },

  isPRApplicable(branchId: string, prType: PRType): boolean {
    const configs = this.getApplicabilityConfigs();
    const match = configs.find(c => 
      c.isEnabled && 
      (c.branchId === 'ALL' || c.branchId === branchId) &&
      (c.prType === 'ALL' || c.prType === prType)
    );
    return match ? match.isEnabled : false;
  },

  getBranchCleanupPolicies(): BranchPRCleanupPolicy[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_BRANCH_POLICIES);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY_BRANCH_POLICIES, JSON.stringify(INITIAL_BRANCH_POLICIES));
        return INITIAL_BRANCH_POLICIES;
      }
      return JSON.parse(stored);
    } catch {
      return INITIAL_BRANCH_POLICIES;
    }
  },

  saveBranchCleanupPolicies(policies: BranchPRCleanupPolicy[]): void {
    localStorage.setItem(STORAGE_KEY_BRANCH_POLICIES, JSON.stringify(policies));
  },

  getBranchCleanupPolicy(branchId: string): BranchPRCleanupPolicy {
    const policies = this.getBranchCleanupPolicies();
    const found = policies.find(p => p.branchId === branchId);
    if (found) return found;
    return {
      branchId,
      branchCode: '001',
      branchName: 'Default Branch',
      ageThresholdDays: 45,
      advanceWarningDays: 5,
      isEnabled: true,
      notifyRequesters: true,
      notifyApprovers: true,
      notifyBuyers: true,
      channels: ['IN_PORTAL'],
      updatedAt: new Date().toISOString(),
      updatedBy: 'System'
    };
  },

  saveBranchCleanupPolicy(policy: BranchPRCleanupPolicy): void {
    const policies = this.getBranchCleanupPolicies();
    const idx = policies.findIndex(p => p.branchId === policy.branchId);
    if (idx >= 0) {
      policies[idx] = policy;
    } else {
      policies.push(policy);
    }
    this.saveBranchCleanupPolicies(policies);
  },

  getCleanupConfig(): PRCleanupConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CLEANUP);
      if (!stored) {
        const defaultConfig: PRCleanupConfig = {
          isEnabled: true,
          ageThresholdDays: 45,
          calculationBasis: 'LINE_CREATION',
          eligibleStatuses: ['DRAFT', 'RETURNED_FOR_CORRECTION'],
          exemptUrgentCritical: true,
          executionMode: 'PREVIEW',
          advanceWarningDays: 5
        };
        localStorage.setItem(STORAGE_KEY_CLEANUP, JSON.stringify(defaultConfig));
        return defaultConfig;
      }
      return JSON.parse(stored);
    } catch {
      return {
        isEnabled: true,
        ageThresholdDays: 45,
        calculationBasis: 'LINE_CREATION',
        eligibleStatuses: ['DRAFT'],
        exemptUrgentCritical: true,
        executionMode: 'PREVIEW',
        advanceWarningDays: 5
      };
    }
  },

  saveCleanupConfig(config: PRCleanupConfig): void {
    localStorage.setItem(STORAGE_KEY_CLEANUP, JSON.stringify(config));
  },

  getArchives(): PRArchiveLog[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ARCHIVES);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  saveArchives(archives: PRArchiveLog[]): void {
    localStorage.setItem(STORAGE_KEY_ARCHIVES, JSON.stringify(archives));
  },

  evaluateAndTriggerBranchPrNotifications(branchId: string): { warningCount: number; archivedCount: number; message: string } {
    const policy = this.getBranchCleanupPolicy(branchId);
    if (!policy.isEnabled) {
      return { warningCount: 0, archivedCount: 0, message: `Branch policy for ${policy.branchName} is disabled.` };
    }

    const prs = this.getPurchaseRequisitions();
    const now = Date.now();
    let warningCount = 0;
    let archivedCount = 0;

    const thresholdMs = policy.ageThresholdDays * 86400000;
    const warningWindowMs = (policy.ageThresholdDays - policy.advanceWarningDays) * 86400000;

    prs.forEach(pr => {
      if (pr.branchId === branchId && (pr.status === 'DRAFT' || pr.status === 'RETURNED_FOR_CORRECTION')) {
        const createdTime = new Date(pr.createdAt).getTime();
        const ageMs = now - createdTime;
        const ageDays = Math.floor(ageMs / 86400000);

        if (ageMs >= thresholdMs) {
          // Trigger archive / cleanup recommendation
          archivedCount++;
        } else if (ageMs >= warningWindowMs) {
          // Trigger advance warning message generation to concerned users
          warningCount++;
        }
      }
    });

    return {
      warningCount,
      archivedCount,
      message: `Evaluated branch ${policy.branchName}: Generated ${warningCount} advance warning messages (within ${policy.advanceWarningDays}-day warning window) and identified ${archivedCount} lines exceeding ${policy.ageThresholdDays}-day threshold.`
    };
  },

  generatePRNumber(): string {
    const prs = this.getPurchaseRequisitions();
    const nextNum = prs.length + 1;
    return `PR-2026-${String(nextNum).padStart(4, '0')}`;
  },

  createPR(header: Omit<PurchaseRequisitionHeader, 'id' | 'prNumber' | 'createdAt' | 'updatedAt'>): PurchaseRequisitionHeader {
    const prs = this.getPurchaseRequisitions();
    const newPr: PurchaseRequisitionHeader = {
      ...header,
      id: `pr-${Date.now()}`,
      prNumber: this.generatePRNumber(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    prs.unshift(newPr);
    this.savePurchaseRequisitions(prs);
    return newPr;
  },

  updatePR(id: string, updates: Partial<PurchaseRequisitionHeader>): PurchaseRequisitionHeader | null {
    const prs = this.getPurchaseRequisitions();
    const idx = prs.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const updated: PurchaseRequisitionHeader = {
      ...prs[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    prs[idx] = updated;
    this.savePurchaseRequisitions(prs);
    return updated;
  },

  submitPR(id: string): { success: boolean; message: string; pr?: PurchaseRequisitionHeader } {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find(p => p.id === id);
    if (!pr) return { success: false, message: 'Purchase requisition not found.' };

    if (pr.budgetValidationStatus !== 'SUFFICIENT' && pr.budgetValidationStatus !== 'EXCEPTION_APPROVED') {
      return { success: false, message: 'Mandatory budget validation failed or is insufficient. Cannot submit.' };
    }

    pr.status = 'PENDING_MANAGER_APPROVAL';
    pr.submittedAt = new Date().toISOString();
    pr.updatedAt = new Date().toISOString();

    this.savePurchaseRequisitions(prs);
    return { success: true, message: 'PR submitted successfully to Reporting Manager Level 1.', pr };
  },

  approvePR(id: string, approverName: string, role: string, remarks: string): PurchaseRequisitionHeader | null {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find(p => p.id === id);
    if (!pr) return null;

    if (pr.status === 'PENDING_MANAGER_APPROVAL') {
      pr.status = 'PENDING_SUBSEQUENT_APPROVAL';
    } else if (pr.status === 'PENDING_SUBSEQUENT_APPROVAL') {
      pr.status = 'APPROVED_PENDING_BUYER';
      pr.approvedAt = new Date().toISOString();
      pr.lines.forEach(l => {
        l.buyerStatus = 'PENDING_BUYER_ACTION';
        l.approvedQuantity = l.requestedQuantity;
      });

      // Automatically trigger web-based market price discovery engine for all approved lines
      setTimeout(() => {
        marketBenchmarkService.autoDiscoverForApprovedPR(
          pr.prNumber,
          pr.lines.map(l => ({ itemCode: l.itemCode, description: l.description, specifications: (l as any).specifications }))
        );
      }, 0);
    } else if (pr.status === 'PENDING_REAPPROVAL') {
      pr.status = 'APPROVED_PENDING_BUYER';
      pr.approvedAt = new Date().toISOString();

      setTimeout(() => {
        marketBenchmarkService.autoDiscoverForApprovedPR(
          pr.prNumber,
          pr.lines.map(l => ({ itemCode: l.itemCode, description: l.description, specifications: (l as any).specifications }))
        );
      }, 0);
    }

    pr.updatedAt = new Date().toISOString();
    this.savePurchaseRequisitions(prs);
    return pr;
  },

  rejectPR(id: string, approverName: string, remarks: string): PurchaseRequisitionHeader | null {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find(p => p.id === id);
    if (!pr) return null;

    pr.status = 'REJECTED';
    pr.updatedAt = new Date().toISOString();
    this.savePurchaseRequisitions(prs);
    return pr;
  },

  returnForCorrection(id: string, remarks: string): PurchaseRequisitionHeader | null {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find(p => p.id === id);
    if (!pr) return null;

    pr.status = 'RETURNED_FOR_CORRECTION';
    pr.updatedAt = new Date().toISOString();
    this.savePurchaseRequisitions(prs);
    return pr;
  },

  initiateChangeRequest(id: string, changedBy: string, changedByName: string, reason: string, fieldDeltas: Array<{ field: string; oldValue: any; newValue: any }>): PurchaseRequisitionHeader | null {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find(p => p.id === id);
    if (!pr) return null;

    const changeRecord: PRChangeHistory = {
      id: `chg-${Date.now()}`,
      prId: id,
      changedBy,
      changedByName,
      timestamp: new Date().toISOString(),
      reason,
      fieldDeltas,
      status: 'PENDING_REAPPROVAL'
    };

    pr.changeHistory.unshift(changeRecord);
    pr.status = 'PENDING_REAPPROVAL';
    pr.updatedAt = new Date().toISOString();

    this.savePurchaseRequisitions(prs);
    return pr;
  },

  checkForDuplicates(itemCode: string, companyId: string, branchId: string): Array<{ prNumber: string; requesterName: string; requestedQuantity: number; status: string; date: string }> {
    const prs = this.getPurchaseRequisitions();
    const duplicates: Array<{ prNumber: string; requesterName: string; requestedQuantity: number; status: string; date: string }> = [];

    prs.forEach(p => {
      if (p.companyId === companyId && p.branchId === branchId && p.status !== 'CANCELLED' && p.status !== 'REJECTED' && p.status !== 'ARCHIVED') {
        p.lines.forEach(l => {
          if (l.itemCode === itemCode) {
            duplicates.push({
              prNumber: p.prNumber,
              requesterName: p.requesterName,
              requestedQuantity: l.requestedQuantity,
              status: p.status,
              date: p.createdAt.split('T')[0]
            });
          }
        });
      }
    });

    return duplicates;
  },

  // Draft Management
  saveDraft(draft: PurchaseRequisitionHeader): void {
      const drafts = this.getDrafts();
      const idx = drafts.findIndex(d => d.id === draft.id);
      if (idx >= 0) drafts[idx] = draft;
      else drafts.push(draft);
      localStorage.setItem('cip_pr_drafts_v1', JSON.stringify(drafts));
  },

  getDrafts(): PurchaseRequisitionHeader[] {
      try {
          const stored = localStorage.getItem('cip_pr_drafts_v1');
          return stored ? JSON.parse(stored) : [];
      } catch {
          return [];
      }
  },

  deleteDraft(id: string): void {
      const drafts = this.getDrafts();
      localStorage.setItem('cip_pr_drafts_v1', JSON.stringify(drafts.filter(d => d.id !== id)));
  },

  // Bulk Actions
  bulkAction(prIds: string[], action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'CANCEL', remarks: string = '', user: User): { successes: string[]; failures: string[] } {
      const prs = this.getPurchaseRequisitions();
      const successes: string[] = [];
      const failures: string[] = [];

      prIds.forEach(id => {
          const pr = prs.find(p => p.id === id);
          if (!pr) {
              failures.push(`${id}: Not found`);
              return;
          }

          try {
              switch(action) {
                  case 'SUBMIT': this.submitPR(id); break;
                  case 'APPROVE': this.approvePR(id, user.fullName, user.role, remarks); break;
                  case 'REJECT': this.rejectPR(id, user.fullName, remarks); break;
                  case 'RETURN': this.returnForCorrection(id, remarks); break;
                  case 'CANCEL': 
                    pr.status = 'CANCELLED';
                    this.savePurchaseRequisitions(prs);
                    break;
              }
              successes.push(pr.prNumber);
          } catch(e) {
              failures.push(`${pr.prNumber}: Failed`);
          }
      });
      return { successes, failures };
  }
};

