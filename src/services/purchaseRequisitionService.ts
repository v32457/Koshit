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
  PRChangeHistory,
  PRApprovalDecisionRecord,
  PRBudgetReleaseEntry,
  PRAmendmentRecord,
  PRAttachmentRecord
} from '../types/purchaseRequisition';
import { User } from '../types';
import { marketBenchmarkService } from './marketBenchmarkService';
import {
  prGovernancePolicyService,
  normalizeCompanyId,
  normalizeBranchId
} from './prGovernancePolicyService';
import { inventoryValidationService } from './inventoryValidationService';
import { budgetControlService } from './budgetControlService';
import { financialYearService } from './financialYearService';
import { EnterpriseAuditService } from './enterpriseAuditService';
import { prTypeMasterService } from './prTypeMasterService';
import { prChargeItemService } from './prChargeItemService';
import { archiveApprovedPrPdf, isPrStatusApproved } from './prPdfExportService';
import { prDuplicateGovernanceService } from './prDuplicateGovernanceService';
import { expenseCategoryService } from './expenseCategoryService';
import {
  calculateInventoryPrFinancials,
  calculateExpensePrFinancials,
} from './prFinancialCalculator';

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
    modifiedBy: 'Venkatesh Iyer',
    priority: 'URGENT',
    status: 'APPROVED_PENDING_BUYER',
    purchasePurpose: 'Machinery maintenance raw materials and alloy plates',
    businessJustification: 'Critical breakdown maintenance for CNC Milling Machine #4',
    deliveryLocation: 'Hosur Plant 1 Store, Bay 3',
    estimatedTotalValue: 145000,
    currency: 'INR',
    expectedDeliveryDate: '2026-11-15',
    requiredBy: '2026-11-15',
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
    modifiedBy: 'Priya Sharma',
    priority: 'NORMAL',
    status: 'DRAFT',
    purchasePurpose: 'Scheduled monthly MRP component replenishment',
    businessJustification: 'Reorder point triggered for standard fastener kits',
    deliveryLocation: 'Chennai Warehouse Section B',
    estimatedTotalValue: 48000,
    currency: 'INR',
    expectedDeliveryDate: '2026-11-20',
    requiredBy: '2026-11-20',
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
  },
  {
    id: 'pr-003',
    prNumber: 'PR-2026-0003',
    prType: 'REPAIR',
    companyId: 'comp-1',
    companyCode: 'KOSH_INNOVATIONS',
    branchId: 'branch-001',
    branchCode: '001',
    branchName: 'Hosur Plant 1',
    department: 'Tool Room & Maintenance',
    costCentre: 'CC-MAINT-104',
    requesterId: 'emp-103',
    requesterName: 'Karthik Rajan (Lead Maintenance Eng)',
    creatorId: 'emp-103',
    creatorName: 'Karthik Rajan',
    modifiedBy: 'Karthik Rajan',
    priority: 'CRITICAL',
    status: 'PENDING_MANAGER_APPROVAL',
    purchasePurpose: 'Imported high-precision servo drive module for 5-axis VMC',
    businessJustification: 'OEM servo controller replacement from overseas distributor',
    deliveryLocation: 'Hosur Plant 1 Electronics Maintenance Lab',
    estimatedTotalValue: 2500,
    currency: 'USD',
    expectedDeliveryDate: '2026-12-05',
    requiredBy: '2026-12-05',
    budgetValidationStatus: 'SUFFICIENT',
    budgetSourceRef: 'BUDGET-FY26-MAINT-CAPEX',
    erpStockStatus: 'FRESH',
    erpStockTimestamp: new Date().toISOString(),
    equipmentId: 'EQ-VMC-09',
    breakdownRef: 'BRK-2026-914',
    lines: [
      {
        id: 'pr-line-003',
        prId: 'pr-003',
        itemCode: 'SPARE-SERVO-DRV05',
        description: 'Digital Servo Amplifier Unit 400V 15kW',
        itemCategory: 'Spares',
        inventoryUom: 'NOS',
        requestedQuantity: 1,
        approximateUnitPrice: 2500,
        currency: 'USD',
        estimatedTotalValue: 2500,
        specifications: 'CE / UL Certified OEM Servo Module',
        deliverySchedules: [
          { id: 'sch-4', lineId: 'pr-line-003', deliveryDate: '2026-12-05', quantity: 1 }
        ],
        assignedBuyer: 'Global Sourcing Desk',
        buyerStatus: 'PENDING_CONFIGURATION',
        status: 'ACTIVE',
        receivedQuantity: 0
      }
    ],
    changeHistory: [],
    attachments: [],
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    submittedAt: new Date(Date.now() - 86400000 * 4).toISOString()
  },
  {
    id: 'pr-004',
    prNumber: 'PR-2026-0004',
    prType: 'MAINTENANCE',
    companyId: 'comp-1',
    companyCode: 'KOSH_INNOVATIONS',
    branchId: 'branch-002',
    branchCode: '002',
    branchName: 'Chennai Hub',
    department: 'Quality Assurance',
    costCentre: 'CC-QA-301',
    requesterId: 'emp-104',
    requesterName: 'Deepa Nair (QA Manager)',
    creatorId: 'emp-104',
    creatorName: 'Deepa Nair',
    modifiedBy: 'Deepa Nair',
    priority: 'NORMAL',
    status: 'PENDING_SUBSEQUENT_APPROVAL',
    purchasePurpose: 'Annual optical CMM calibration gauge blocks kit',
    businessJustification: 'ISO/IEC 17025 lab accreditation calibration schedule',
    deliveryLocation: 'Chennai Hub Metrology Lab',
    estimatedTotalValue: 1800,
    currency: 'EUR',
    expectedDeliveryDate: '2026-12-12',
    requiredBy: '2026-12-12',
    budgetValidationStatus: 'SUFFICIENT',
    budgetSourceRef: 'BUDGET-FY26-QA-Q3',
    erpStockStatus: 'FRESH',
    erpStockTimestamp: new Date().toISOString(),
    maintenanceScheduleRef: 'PM-CAL-2026-Q4',
    lines: [
      {
        id: 'pr-line-004',
        prId: 'pr-004',
        itemCode: 'QA-CMM-GAUGE-01',
        description: 'Ceramic Calibration Master Gauge Block Set Grade 0',
        itemCategory: 'Quality Instruments',
        inventoryUom: 'SET',
        requestedQuantity: 1,
        approximateUnitPrice: 1800,
        currency: 'EUR',
        estimatedTotalValue: 1800,
        specifications: 'DIN EN ISO 3650 Grade 0 with DAkkS certificate',
        deliverySchedules: [
          { id: 'sch-5', lineId: 'pr-line-004', deliveryDate: '2026-12-12', quantity: 1 }
        ],
        assignedBuyer: 'Precision Imports Buyer',
        buyerStatus: 'PENDING_CONFIGURATION',
        status: 'ACTIVE',
        receivedQuantity: 0
      }
    ],
    changeHistory: [],
    attachments: [],
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    submittedAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'pr-fy25-001',
    prNumber: 'PR-2025-0142',
    prType: 'MANUAL',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Main Plant & HQ',
    department: 'Production',
    costCentre: 'CC-PROD-101',
    requesterId: 'emp-101',
    requesterName: 'Arun Kumar (Production Engineer)',
    creatorId: 'emp-101',
    creatorName: 'Arun Kumar',
    modifiedBy: 'Venkatesh Iyer',
    priority: 'NORMAL',
    status: 'COMPLETED',
    purchasePurpose: 'Historical FY 2025-26 Q4 Virgin PC-ABS Polymer Stock',
    businessJustification: 'Q4 FY25-26 scheduled production run polymer replenishment',
    deliveryLocation: 'Puducherry Central Raw Material Store',
    estimatedTotalValue: 204000,
    currency: 'INR',
    expectedDeliveryDate: '2026-01-20',
    requiredBy: '2026-01-20',
    financialPeriod: '2025-26',
    financialYearId: 'fy-co-kosh-01-2025-26',
    financialYearCode: 'FY 2025-26',
    accountingPeriodCode: '2026-01',
    policyVersion: 'POL-KOSH-2025-v1',
    policyEffectiveFrom: '2025-04-01',
    budgetValidationStatus: 'SUFFICIENT',
    budgetSourceRef: 'BUDGET-FY25-PROD-Q4',
    erpStockStatus: 'FRESH',
    erpStockTimestamp: '2026-01-10T09:00:00Z',
    lines: [
      {
        id: 'pr-line-fy25-001',
        prId: 'pr-fy25-001',
        itemCode: 'RMPAOPOEXLG0001',
        description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
        itemCategory: 'Raw Materials',
        inventoryUom: 'KG',
        requestedQuantity: 750,
        approximateUnitPrice: 272,
        currency: 'INR',
        estimatedTotalValue: 204000,
        deliverySchedules: [{ id: 'sch-fy25-1', lineId: 'pr-line-fy25-001', deliveryDate: '2026-01-20', quantity: 750 }],
        assignedBuyer: 'Vikram Singh',
        buyerStatus: 'ACKNOWLEDGED',
        status: 'ACTIVE',
        approvedQuantity: 750,
        receivedQuantity: 750,
        convertedPoQuantity: 750,
        poReferences: ['PO-2025-0074'],
      }
    ],
    approvalHistory: [
      {
        id: 'dec-fy25-1',
        cycleNumber: 1,
        level: 'Submission',
        decision: 'SUBMITTED',
        actorId: 'emp-101',
        actorName: 'Arun Kumar',
        actorRole: 'ITEM_MAKER',
        remarks: 'Q4 FY25-26 polymer replenishment',
        timestamp: '2026-01-10T09:15:00Z',
      },
      {
        id: 'dec-fy25-2',
        cycleNumber: 1,
        level: 'Final Approval',
        decision: 'APPROVED',
        actorId: 'usr-checker-03',
        actorName: 'Venkatesh Iyer',
        actorRole: 'ITEM_CHECKER',
        remarks: 'Approved against FY 2025-26 production budget',
        timestamp: '2026-01-11T11:30:00Z',
      }
    ],
    changeHistory: [],
    attachments: [],
    createdAt: '2026-01-10T09:00:00Z',
    updatedAt: '2026-01-25T16:00:00Z',
    submittedAt: '2026-01-10T09:15:00Z',
    approvedAt: '2026-01-11T11:30:00Z',
  },
  {
    id: 'pr-fy25-002',
    prNumber: 'PR-2025-0143',
    prType: 'MAINTENANCE',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-hosur-02',
    branchCode: '002',
    branchName: 'Hosur Manufacturing Facility',
    department: 'Tool Room & Maintenance',
    costCentre: 'CC-MAINT-104',
    requesterId: 'emp-103',
    requesterName: 'Karthik Rajan',
    creatorId: 'emp-103',
    creatorName: 'Karthik Rajan',
    modifiedBy: 'Venkatesh Iyer',
    priority: 'URGENT',
    status: 'COMPLETED',
    purchasePurpose: 'Historical FY 2025-26 Cross-FY Year-End Chiller Spare Kit',
    businessJustification: 'Pre-summer cooling tower preventive overhaul',
    deliveryLocation: 'Hosur Main Store',
    estimatedTotalValue: 64000,
    currency: 'INR',
    expectedDeliveryDate: '2026-03-28',
    requiredBy: '2026-03-28',
    financialPeriod: '2025-26',
    financialYearId: 'fy-co-kosh-01-2025-26',
    financialYearCode: 'FY 2025-26',
    accountingPeriodCode: '2026-03',
    policyVersion: 'POL-KOSH-2025-v1',
    policyEffectiveFrom: '2025-04-01',
    budgetValidationStatus: 'SUFFICIENT',
    erpStockStatus: 'FRESH',
    lines: [
      {
        id: 'pr-line-fy25-002',
        prId: 'pr-fy25-002',
        itemCode: 'MAPALBL0003',
        description: 'Pneumatic Solenoid Valve – 5/2 Way Single Solenoid – 24V DC G1/4"',
        itemCategory: 'Maintenance & Spares',
        inventoryUom: 'EA',
        requestedQuantity: 20,
        approximateUnitPrice: 3200,
        currency: 'INR',
        estimatedTotalValue: 64000,
        deliverySchedules: [{ id: 'sch-fy25-2', lineId: 'pr-line-fy25-002', deliveryDate: '2026-03-28', quantity: 20 }],
        assignedBuyer: 'Vikram Singh',
        buyerStatus: 'ACKNOWLEDGED',
        status: 'ACTIVE',
        approvedQuantity: 20,
        receivedQuantity: 0,
        convertedPoQuantity: 20,
        poReferences: ['PO-2025-0099'],
      }
    ],
    approvalHistory: [],
    changeHistory: [],
    attachments: [],
    createdAt: '2026-03-19T10:00:00Z',
    updatedAt: '2026-03-22T15:00:00Z',
    submittedAt: '2026-03-19T10:15:00Z',
    approvedAt: '2026-03-20T12:00:00Z',
  },
  {
    id: 'pr-dqg-001',
    prNumber: 'PR-LEGACY-0009',
    prType: 'MANUAL',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Main Plant & HQ',
    department: 'Production',
    costCentre: 'CC-PROD-101',
    requesterId: 'emp-101',
    requesterName: 'Arun Kumar',
    creatorId: 'emp-101',
    creatorName: 'Arun Kumar',
    modifiedBy: 'System Migration',
    priority: 'NORMAL',
    status: 'ARCHIVED',
    purchasePurpose: 'Legacy Pre-ERP Archived Requisition (Unassigned Fiscal Year Data-Quality Gap)',
    businessJustification: 'Imported pre-2025 legacy record predating configured FY master',
    deliveryLocation: 'Puducherry Plant',
    estimatedTotalValue: 18500,
    currency: 'INR',
    expectedDeliveryDate: '2024-02-20',
    requiredBy: '2024-02-20',
    isDataQualityGap: true,
    budgetValidationStatus: 'NOT_VALIDATED',
    erpStockStatus: 'UNAVAILABLE',
    lines: [],
    changeHistory: [],
    attachments: [],
    createdAt: '2024-02-10T09:00:00Z',
    updatedAt: '2024-02-12T11:00:00Z',
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

let memoryPrFallback: PurchaseRequisitionHeader[] | null = null;

export const PurchaseRequisitionService = {
  getPurchaseRequisitions(): PurchaseRequisitionHeader[] {
    try {
      if (typeof localStorage === 'undefined') {
        if (!memoryPrFallback) memoryPrFallback = JSON.parse(JSON.stringify(INITIAL_PRS));
        return memoryPrFallback!;
      }
      const stored = localStorage.getItem(STORAGE_KEY_PRS);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY_PRS, JSON.stringify(INITIAL_PRS));
        return INITIAL_PRS;
      }
      const parsed: PurchaseRequisitionHeader[] = JSON.parse(stored);
      // Ensure new multi-currency seed PRs exist if upgrading from 2-item seed
      let updated = false;
      for (const seedPr of INITIAL_PRS) {
        if (!parsed.some(p => p.id === seedPr.id)) {
          parsed.push(seedPr);
          updated = true;
        }
      }
      if (updated) {
        localStorage.setItem(STORAGE_KEY_PRS, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return INITIAL_PRS;
    }
  },

  savePurchaseRequisitions(prs: PurchaseRequisitionHeader[]): void {
    memoryPrFallback = prs;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PRS, JSON.stringify(prs));
    }
    void prDuplicateGovernanceService.syncPrsWithBackend(prs);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cip-prs-updated'));
    }
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

  isPRApplicable(
    branchId: string,
    prType: PRType,
    companyId: string = 'co-kosh-01',
    options?: {
      purchaseOrgId?: string;
      itemCategoryCode?: string;
      evaluationDate?: string;
      userRole?: string;
    }
  ): boolean {
    const eff = prGovernancePolicyService.getEffectivePolicy(companyId, branchId);
    if (!eff.activation.prModuleEnabled) return false;
    if (prType === 'MANUAL' && !eff.activation.manualPrCreationEnabled) return false;
    if (prType === 'MRP' && !eff.activation.mrpPrCreationEnabled) return false;
    if (prType === 'REPAIR' && !eff.activation.repairPrEnabled) return false;
    if (prType === 'MAINTENANCE' && !eff.activation.maintenancePrEnabled) return false;
    if (prType === 'CAPEX_ASSET' && !eff.activation.capexAssetPrEnabled) return false;

    const masterEval = prTypeMasterService.evaluatePrTypeEligibility({
      companyId,
      branchId,
      purchaseOrgId: options?.purchaseOrgId,
      itemCategoryCode: options?.itemCategoryCode,
      prTypeCode: prType,
      evaluationDate: options?.evaluationDate,
      userRole: options?.userRole,
    });
    if (!masterEval.eligible) return false;

    const configs = this.getApplicabilityConfigs();
    if (configs.length === 0) return true;
    const match = configs.find(c =>
      c.isEnabled &&
      (c.branchId === 'ALL' || c.branchId === branchId) &&
      (c.prType === 'ALL' || c.prType === prType)
    );
    return match ? match.isEnabled : prType !== 'CAPEX_ASSET';
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

  generatePRNumber(companyId: string = 'co-kosh-01', branchId: string = 'br-pond-01'): string {
    const prs = this.getPurchaseRequisitions();
    const existingNums = prs.map((p) => p.prNumber);
    return prGovernancePolicyService.generateGovernedPrNumber(companyId, branchId, existingNums);
  },

  createPR(
    header: Omit<PurchaseRequisitionHeader, 'id' | 'prNumber' | 'createdAt' | 'updatedAt'>,
    actorUser?: User
  ): PurchaseRequisitionHeader {
    // 1. Requirement C.1–C.3: Multi-Company & Multi-Branch Ownership Validation
    const ownershipCheck = prGovernancePolicyService.validateCompanyAndBranchOwnership(
      header.companyId,
      header.branchId
    );
    if (!ownershipCheck.valid) {
      throw new Error(ownershipCheck.reason || 'Invalid company or branch ownership.');
    }

    // 2. Requirement C.6 & D: User Company/Branch Access Validation
    if (actorUser) {
      const accessCheck = prGovernancePolicyService.validateUserCompanyBranchAccess(
        actorUser,
        header.companyId,
        header.branchId
      );
      if (!accessCheck.allowed) {
        throw new Error(accessCheck.reason || 'Unauthorized company or branch access.');
      }
    }

    // 3. Requirement N & Financial Year Master Gate
    const txDocDate = ((header as any).transactionDate || new Date().toISOString()).slice(0, 10);
    const periodCheck = prGovernancePolicyService.validateFinancialPeriodAndDate(
      header.companyId,
      header.branchId,
      (header as any).transactionDate,
      header.financialPeriod
    );
    if (!periodCheck.valid) {
      throw new Error(periodCheck.reason || 'Financial period validation failed.');
    }

    const fyValidation = financialYearService.validateAndCapturePostingSnapshot({
      companyId: header.companyId,
      branchId: header.branchId,
      documentDate: txDocDate,
      accountingPostingDate: header.accountingPostingDate || txDocDate,
      allowFuturePeriodForPlanning: header.status === 'DRAFT',
    });
    if (!fyValidation.allowed && (header as any).transactionDate) {
      throw new Error(fyValidation.rejectionReason || 'Financial Year posting-date gate rejected transaction.');
    }

    const eff = prGovernancePolicyService.getEffectivePolicy(header.companyId, header.branchId);
    const isExpensePr = header.prType === 'EXPENSE';
    const typeActionMap: Record<
      PRType,
      | 'CREATE_MANUAL_PR'
      | 'CREATE_MRP_PR'
      | 'CREATE_REPAIR_PR'
      | 'CREATE_MAINTENANCE_PR'
      | 'CREATE_CAPEX_PR'
      | 'CREATE_EXPENSE_PR'
    > = {
      MANUAL: 'CREATE_MANUAL_PR',
      MRP: 'CREATE_MRP_PR',
      REPAIR: 'CREATE_REPAIR_PR',
      MAINTENANCE: 'CREATE_MAINTENANCE_PR',
      CAPEX_ASSET: 'CREATE_CAPEX_PR',
      EXPENSE: 'CREATE_EXPENSE_PR',
    };
    const check = prGovernancePolicyService.evaluatePrAction({
      action: typeActionMap[header.prType] || 'CREATE_PR',
      companyId: header.companyId,
      branchId: header.branchId,
      user: actorUser,
      prType: header.prType,
    });
    if (!check.allowed) {
      throw new Error(check.reason || `Cannot create ${header.prType} PR under active governance policy.`);
    }

    // 3a. Mandatory Classification Rule & Cross-Level Charge Duplicate Check
    const conflictCheck = expenseCategoryService.detectClassificationConflict({
      prType: header.prType,
      lines: header.lines,
      expenseLines: header.expenseLines,
      chargeItems: header.chargeItems,
    });
    if (conflictCheck.hasConflict) {
      throw new Error(conflictCheck.conflicts[0]);
    }

    if (!isExpensePr) {
      const chargeDupCheck = prChargeItemService.validateHeaderAndLineChargeDuplicates(
        header.chargeItems,
        header.lines,
        Boolean(eff.activation.allowSameChargeAtHeaderAndLine)
      );
      if (!chargeDupCheck.valid) {
        throw new Error(chargeDupCheck.conflicts[0]);
      }
    }

    // 3b. Genuine PR Type Master & Centralized Company/Branch/PurchaseOrg/ItemCategory Eligibility Gate
    const purchaseOrgId = header.purchaseOrganizationId || header.purchaseOrgId;
    if (isExpensePr) {
      const eligibility = prTypeMasterService.evaluatePrTypeEligibility({
        companyId: header.companyId,
        branchId: header.branchId,
        purchaseOrgId,
        itemCategoryCode: 'ALL',
        prTypeCode: 'EXPENSE',
        evaluationDate: txDocDate,
        userRole: actorUser?.role,
      });
      if (!eligibility.eligible) {
        throw new Error(eligibility.reason);
      }

      const expLinesValidation = expenseCategoryService.validateExpenseLinesForPr({
        companyId: header.companyId,
        branchId: header.branchId,
        department: header.department,
        userId: actorUser?.id || header.requesterId,
        expenseLines: header.expenseLines || [],
        headerCostCentre: header.costCentre,
        headerExpectedServiceDate: header.expectedServiceDate || header.expectedDeliveryDate || header.requiredBy,
        headerBusinessJustification: header.businessJustification,
        asOfDate: txDocDate,
      });
      if (!expLinesValidation.valid) {
        throw new Error(expLinesValidation.errors[0]);
      }
    } else if ((header.lines || []).length > 0) {
      const catValidation = prTypeMasterService.validateLinesCategoriesForPrType({
        companyId: header.companyId,
        branchId: header.branchId,
        purchaseOrgId,
        prTypeCode: header.prType,
        lines: header.lines,
        evaluationDate: txDocDate,
        userRole: actorUser?.role,
      });
      if (!catValidation.valid) {
        throw new Error(
          catValidation.prTypeReason ||
            catValidation.invalidLines[0]?.reason ||
            'One or more PR lines contain item categories not eligible for the selected PR Type.'
        );
      }
    } else {
      const eligibility = prTypeMasterService.evaluatePrTypeEligibility({
        companyId: header.companyId,
        branchId: header.branchId,
        purchaseOrgId,
        itemCategoryCode: 'ALL',
        prTypeCode: header.prType,
        evaluationDate: txDocDate,
        userRole: actorUser?.role,
      });
      if (!eligibility.eligible) {
        throw new Error(eligibility.reason);
      }
    }

    // 3c. Expected Delivery / Service Date Policy Enforcement (Section 5)
    const candidateHeaderDate = isExpensePr
      ? header.expectedServiceDate || header.expectedDeliveryDate || header.requiredBy
      : header.expectedDeliveryDate || header.requiredBy;
    const delDateCheck = prGovernancePolicyService.validateExpectedDeliveryDate(
      candidateHeaderDate,
      eff,
      false
    );
    if (!delDateCheck.valid) {
      throw new Error(delDateCheck.reason);
    }
    const sanitizedDeliveryDate = delDateCheck.sanitizedDate;

    // 4. Requirement G: Unified Duplicate PR Governance Enforcement
    const dupDraftKey =
      header.duplicateGovernanceKey || `draft-create-${header.creatorId || 'usr'}-${Date.now()}`;
    const existingPrs = this.getPurchaseRequisitions();
    const dupLinesInput = (header.lines || []).map((l) => ({
      id: l.id,
      itemCode: l.itemCode,
      description: l.description,
      requestedQuantity: l.requestedQuantity,
      inventoryUom: l.inventoryUom,
      purchasePurpose: l.purchasePurpose,
    }));
    const dupActor: User = actorUser || {
      id: header.creatorId || 'usr-requester',
      fullName: header.creatorName || header.requesterName || 'Requester',
      email: 'requester@kosh.local',
      role: 'ITEM_MAKER',
      orgId: header.companyId || 'co-kosh-01',
      allowedBranchIds: header.branchId ? [header.branchId] : [],
      isGlobalScope: false,
      twoFactorEnabled: false,
      department: header.department || 'Procurement',
    };

    let dupSnapshot = prDuplicateGovernanceService.evaluateDuplicateConditions({
      draftKey: dupDraftKey,
      companyId: header.companyId,
      branchId: header.branchId,
      requesterId: header.requesterId,
      purchasePurpose: header.purchasePurpose,
      expectedDeliveryDate: sanitizedDeliveryDate,
      lines: dupLinesInput,
      actorUser: dupActor,
      existingPrs,
      persistedSnapshot: header.duplicateGovernance,
    });

    if (dupSnapshot.hasDuplicates) {
      if (header.status === 'DRAFT') {
        // Draft creation: enforce HARD_BLOCK prohibition or mandatory acknowledgement/justification without auto-authorising override
        const prohibitedCond = dupSnapshot.conditions.find((c) => !c.policyAllowsOverride);
        if (prohibitedCond && prohibitedCond.warningLevel === 'HARD_BLOCK') {
          throw new Error(
            `Duplicate PR Blocked by Policy: Matching open PR (${prohibitedCond.matchingPrs[0]?.prNumber}) exists for item ${prohibitedCond.itemCode}.`
          );
        }

        const inlineJustif = (header.duplicateOverrideJustification || '').trim();
        for (const cond of dupSnapshot.conditions) {
          if (!cond.acknowledgement) {
            if (inlineJustif) {
              const ackRes = prDuplicateGovernanceService.acknowledgeCondition({
                draftKey: dupDraftKey,
                conditionKey: cond.conditionKey,
                justification: inlineJustif,
                companyId: header.companyId,
                branchId: header.branchId,
                requesterId: header.requesterId,
                purchasePurpose: header.purchasePurpose,
                expectedDeliveryDate: sanitizedDeliveryDate,
                lines: dupLinesInput,
                actorUser: dupActor,
                existingPrs,
              });
              dupSnapshot = ackRes.snapshot;
            } else if (
              eff.duplicatePrevention?.warningLevel === 'WARNING_WITH_JUSTIFICATION' &&
              eff.duplicatePrevention?.requireJustificationToProceed
            ) {
              const prNums = dupSnapshot.conditions
                .flatMap((c) => c.matchingPrs.map((m) => m.prNumber))
                .join(', ');
              throw new Error(
                `Potential Duplicate PR Identified (${prNums}): A mandatory duplicate override justification is required to proceed.`
              );
            }
          }
        }
      } else {
        // Direct non-draft submission: must pass full State C validation (OVERRIDE_AUTHORISED + not STALE)
        const subCheck = prDuplicateGovernanceService.validateForSubmission({
          draftKey: dupDraftKey,
          companyId: header.companyId,
          branchId: header.branchId,
          requesterId: header.requesterId,
          purchasePurpose: header.purchasePurpose,
          expectedDeliveryDate: sanitizedDeliveryDate,
          lines: dupLinesInput,
          actorUser: dupActor,
          existingPrs,
          persistedSnapshot: header.duplicateGovernance,
        });
        dupSnapshot = subCheck.snapshot;
        if (!subCheck.allowed) {
          throw new Error(subCheck.message);
        }
      }
    }

    const budgetValidationEnabled = prGovernancePolicyService.isBudgetValidationEnabled(
      header.companyId,
      header.branchId,
      txDocDate
    );
    if (
      budgetValidationEnabled &&
      eff.budget.mandatoryBudgetCheck &&
      header.status !== 'DRAFT' &&
      header.budgetValidationStatus !== 'SUFFICIENT' &&
      header.budgetValidationStatus !== 'EXCEPTION_APPROVED'
    ) {
      throw new Error('Mandatory budget check failed: PR cannot be submitted without sufficient budget.');
    }

    const prs = existingPrs;
    const nowIso = new Date().toISOString();
    const prNumber = this.generatePRNumber(header.companyId, header.branchId);

    const initialHistory: PRApprovalDecisionRecord[] =
      header.status !== 'DRAFT'
        ? [
            {
              id: `dec-${Date.now()}`,
              cycleNumber: 1,
              level: 'Submission',
              decision: 'SUBMITTED',
              actorId: header.creatorId,
              actorName: header.creatorName,
              actorRole: 'REQUESTER',
              remarks: header.purchasePurpose || 'Initial PR submission',
              timestamp: nowIso,
            },
          ]
        : [];

    // 5. Requirement F: Currency & Exchange Rate Governance + Decimal-Safe Financial Breakdown
    const txCurrency = (header.currency || 'INR').toUpperCase();
    const repCurrency = eff.budget.companyReportingCurrency || 'INR';
    const fxInfo = prGovernancePolicyService.getExchangeRate(txCurrency, repCurrency);

    const expenseCalc = isExpensePr
      ? calculateExpensePrFinancials(header.expenseLines || [])
      : undefined;

    const rawNormalizedLines = isExpensePr
      ? []
      : prChargeItemService.recalculateLinesCharges(header.lines || [], txCurrency);
    const normalizedLines =
      !isExpensePr && header.status !== 'DRAFT'
        ? prChargeItemService.lockLineChargeSnapshots(rawNormalizedLines, nowIso)
        : rawNormalizedLines;

    const invItemsSubtotal = isExpensePr
      ? 0
      : rawNormalizedLines.length > 0
      ? calculateInventoryPrFinancials({ lines: rawNormalizedLines }).inventorySubtotal
      : Number(header.estimatedTotalValue || 0);

    const rawNormalizedCharges =
      !isExpensePr && header.chargeItems && header.chargeItems.length > 0
        ? prChargeItemService.recalculateAllCharges(header.chargeItems, invItemsSubtotal, txCurrency)
        : undefined;
    const normalizedChargeItems =
      rawNormalizedCharges && header.status !== 'DRAFT'
        ? prChargeItemService.lockChargeSnapshots(rawNormalizedCharges, nowIso)
        : rawNormalizedCharges;

    const invCalc = !isExpensePr
      ? calculateInventoryPrFinancials({
          lines: normalizedLines,
          headerCharges: normalizedChargeItems,
          itemsSubtotalOverride: normalizedLines.length === 0 ? invItemsSubtotal : undefined,
        })
      : undefined;

    const estTotal = isExpensePr
      ? expenseCalc!.expenseSubtotal
      : invCalc!.inventorySubtotal;
    const authoritativeGrandTotal = isExpensePr
      ? expenseCalc!.totalExpensePrValue
      : invCalc!.totalLandedPrValue;

    // 6. Requirement B: Immutable Policy Snapshot on Transaction
    const policySnapshot =
      header.policySnapshot ||
      prGovernancePolicyService.createTransactionPolicySnapshot(header.companyId, header.branchId);

    const newPrId = `pr-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

    // 7. Part K: Inventory Availability Validation Snapshot on Creation (Skipped for EXPENSE PRs)
    const invSnapshot = isExpensePr
      ? undefined
      : header.inventoryValidationSnapshot ||
        inventoryValidationService.validateTransactionInventory({
          prId: newPrId,
          prNumber,
          companyId: header.companyId,
          branchId: header.branchId,
          stage: header.status === 'DRAFT' ? 'ON_PR_CREATION' : 'ON_PR_SUBMISSION',
          validatedBy: header.creatorName,
          lines: normalizedLines.map((l) => ({
            id: l.id,
            itemCode: l.itemCode,
            description: l.description,
            itemCategory: l.itemCategory,
            inventoryUom: l.inventoryUom,
            requestedQuantity: l.requestedQuantity,
            originalRequestedQuantity: l.requestedQuantity,
            defaultWarehouse: l.defaultWarehouse,
          })),
        });

    // 8. Part L: Conditional Budget Control Validation Snapshot on Creation/Submission
    const valuation = prGovernancePolicyService.resolvePrValuationAmount(
      {
        estimatedTotalValue: estTotal,
        grandTotalWithCharges: authoritativeGrandTotal,
        currency: txCurrency,
        companyId: header.companyId,
        branchId: header.branchId,
        budgetGovernance: header.budgetGovernance,
      },
      eff
    );
    const bgtSnapshot = budgetValidationEnabled
      ? header.budgetValidationSnapshot ||
        budgetControlService.validateBudgetAtStage({
          transactionId: newPrId,
          transactionNumber: prNumber,
          sourceChainId: prNumber,
          stage: 'PR_SUBMISSION',
          companyId: header.companyId,
          branchId: header.branchId,
          department: header.department,
          costCenter: header.costCentre,
          projectCode: header.projectCode,
          financialYear: header.financialPeriod,
          proposedAmount: valuation.reportingAmount,
          validatedBy: header.creatorName,
        })
      : undefined;

    const normalizedExpenseLines = isExpensePr
      ? expenseCategoryService
          .validateExpenseLinesForPr({
            companyId: header.companyId,
            branchId: header.branchId,
            department: header.department,
            userId: actorUser?.id || header.requesterId,
            expenseLines: header.expenseLines || [],
            headerCostCentre: header.costCentre,
            headerExpectedServiceDate: sanitizedDeliveryDate,
            headerBusinessJustification: header.businessJustification,
            asOfDate: txDocDate,
          })
          .normalizedLines.map((el) => ({ ...el, prId: newPrId }))
      : undefined;

    const newPr: PurchaseRequisitionHeader = {
      ...header,
      id: newPrId,
      prNumber,
      procurementMechanism: isExpensePr ? 'EXPENSE' : 'INVENTORY',
      costCentre: isExpensePr
        ? normalizedExpenseLines?.[0]?.costCentre || header.costCentre
        : header.costCentre,
      lines: normalizedLines,
      expenseLines: normalizedExpenseLines,
      chargeItems: isExpensePr ? undefined : normalizedChargeItems,
      inventorySubtotal: isExpensePr ? 0 : invCalc!.inventorySubtotal,
      inventoryTaxTotal: isExpensePr ? 0 : invCalc!.inventoryTaxTotal,
      headerChargesBaseTotal: isExpensePr ? 0 : invCalc!.headerChargesBaseTotal,
      lineChargesBaseTotal: isExpensePr ? 0 : invCalc!.lineChargesBaseTotal,
      applicableChargesTaxTotal: isExpensePr ? 0 : invCalc!.applicableChargesTaxTotal,
      expenseSubtotal: isExpensePr ? expenseCalc!.expenseSubtotal : undefined,
      expenseTaxTotal: isExpensePr ? expenseCalc!.expenseTaxTotal : undefined,
      estimatedTotalValue: estTotal,
      chargesTotalValue: isExpensePr ? 0 : invCalc!.applicableChargesBaseTotal,
      grandTotalWithCharges: authoritativeGrandTotal,
      expectedDeliveryDate: sanitizedDeliveryDate,
      expectedServiceDate: isExpensePr
        ? normalizedExpenseLines?.[0]?.serviceToDate ||
          normalizedExpenseLines?.[0]?.serviceFromDate ||
          header.expectedServiceDate ||
          sanitizedDeliveryDate
        : header.expectedServiceDate,
      requiredBy: sanitizedDeliveryDate,
      sapIntegration: header.sapIntegration || {
        status: 'NOT_STARTED',
        sapObjectType: 'PurchaseRequests',
        sapDocType: isExpensePr ? 'dDocument_Service' : 'dDocument_Items',
        retryCount: 0,
        reconciliationRequired: false,
        history: [],
      },
      financialPeriod: header.financialPeriod || fyValidation.snapshot.financialYearCode.replace(/^FY\s*/i, ''),
      financialYearId: header.financialYearId || fyValidation.snapshot.financialYearId,
      financialYearCode: header.financialYearCode || fyValidation.snapshot.financialYearCode,
      accountingPeriodId: header.accountingPeriodId || fyValidation.snapshot.accountingPeriodId,
      accountingPeriodCode: header.accountingPeriodCode || fyValidation.snapshot.accountingPeriodCode,
      accountingPostingDate: header.accountingPostingDate || fyValidation.snapshot.accountingPostingDate,
      fySnapshot: header.fySnapshot || fyValidation.snapshot,
      policyVersion: header.policyVersion || eff.policyVersion,
      policyEffectiveFrom: header.policyEffectiveFrom || eff.effectiveFrom,
      policySnapshot,
      inventoryValidationSnapshot: invSnapshot,
      inventoryValidationHistory: isExpensePr
        ? []
        : header.inventoryValidationHistory || (invSnapshot ? [invSnapshot] : []),
      budgetValidationStatus: budgetValidationEnabled
        ? header.budgetValidationStatus
        : 'NOT_VALIDATED',
      budgetSourceRef: budgetValidationEnabled ? header.budgetSourceRef : undefined,
      budgetValidationSnapshot: bgtSnapshot,
      budgetValidationHistory: budgetValidationEnabled
        ? header.budgetValidationHistory || (bgtSnapshot ? [bgtSnapshot] : [])
        : [],
      approvalCycleCount: header.status !== 'DRAFT' ? 1 : 0,
      approvalHistory: header.approvalHistory || initialHistory,
      amendmentHistory: header.amendmentHistory || [],
      duplicateGovernanceKey: newPrId,
      duplicateGovernance: dupSnapshot,
      duplicateOverrideJustification:
        header.duplicateOverrideJustification ||
        dupSnapshot.conditions.find((c) => c.acknowledgement)?.acknowledgement?.justification,
      optimisticVersion: 1,
      budgetGovernance: budgetValidationEnabled
        ? header.budgetGovernance || {
            originalReservationAmount: valuation.transactionAmount || estTotal,
            outstandingCommittedAmount: 0,
            previouslyReleasedAmount: 0,
            transactionCurrency: txCurrency,
            companyReportingCurrency: repCurrency,
            exchangeRateUsed: fxInfo.rate,
            exchangeRateRef: fxInfo.ref,
            exchangeRateDate: fxInfo.effectiveDate,
            originalReservationReportingCurrency: valuation.reportingAmount,
            outstandingCommittedReportingCurrency: 0,
            previouslyReleasedReportingCurrency: 0,
            reservationIdempotencyKey: `res-${prNumber}-init`,
            releaseIdempotencyKeys: [],
            releaseHistory: [],
          }
        : undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    prDuplicateGovernanceService.bindDraftSessionToPr(dupDraftKey, newPrId, prNumber);
    newPr.duplicateGovernance = prDuplicateGovernanceService.evaluateDuplicateConditions({
      draftKey: newPrId,
      prId: newPrId,
      prNumber,
      companyId: newPr.companyId,
      branchId: newPr.branchId,
      requesterId: newPr.requesterId,
      purchasePurpose: newPr.purchasePurpose,
      expectedDeliveryDate: newPr.expectedDeliveryDate || newPr.requiredBy,
      lines: (newPr.lines || []).map((l) => ({
        id: l.id,
        itemCode: l.itemCode,
        description: l.description,
        requestedQuantity: l.requestedQuantity,
        inventoryUom: l.inventoryUom,
        purchasePurpose: l.purchasePurpose,
      })),
      actorUser: dupActor,
      existingPrs: prs,
      persistedSnapshot: dupSnapshot,
    });

    prs.unshift(newPr);
    this.savePurchaseRequisitions(prs);

    EnterpriseAuditService.logEvent({
      companyId: newPr.companyId,
      branchId: newPr.branchId,
      branchName: newPr.branchName,
      entityType: 'PURCHASE_REQUISITION',
      entityId: newPr.id,
      eventType: 'PR_CREATED',
      eventDescription: `Created ${newPr.prType} Purchase Requisition ${newPr.prNumber} (${newPr.currency} ${newPr.estimatedTotalValue}) under policy ${newPr.policyVersion}`,
      newValue: {
        prNumber: newPr.prNumber,
        status: newPr.status,
        policyVersion: newPr.policyVersion,
        estimatedTotalValue: newPr.estimatedTotalValue,
        duplicateOverrideJustification: newPr.duplicateOverrideJustification,
      },
      changedByUserId: newPr.creatorId,
      changedByName: newPr.creatorName,
      changeReason:
        newPr.duplicateOverrideJustification ||
        newPr.purchasePurpose ||
        'New Purchase Requisition created',
      relatedPrId: newPr.id,
    });

    return newPr;
  },

  updatePR(id: string, updates: Partial<PurchaseRequisitionHeader>, user?: User): PurchaseRequisitionHeader | null {
    const prs = this.getPurchaseRequisitions();
    const idx = prs.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const existing = prs[idx];
    const eff = prGovernancePolicyService.getEffectivePolicy(existing.companyId, existing.branchId);

    const fyMutGuard = financialYearService.evaluateHistoricalRecordMutationGuard({
      companyId: existing.companyId,
      accountingPostingDate: existing.accountingPostingDate,
      documentDate: existing.createdAt?.slice(0, 10),
      financialYearId: existing.financialYearId,
      actionLabel: 'UPDATE_PR',
    });
    if (!fyMutGuard.allowed) {
      throw new Error(fyMutGuard.reason || `Cannot edit PR ${existing.prNumber} in a closed financial year or locked period.`);
    }

    // Mandatory Business Rule #9: Terminal records cannot be edited or reopened
    if (['SHORT_CLOSED', 'CANCELLED', 'REJECTED', 'WITHDRAWN', 'ARCHIVED'].includes(existing.status)) {
      throw new Error(`PR ${existing.prNumber} is in terminal status ${existing.status} and is permanently locked.`);
    }

    // Mandatory Business Rule #2: Pending Approval PRs are not editable
    if (
      ['SUBMITTED', 'PENDING_MANAGER_APPROVAL', 'PENDING_SUBSEQUENT_APPROVAL', 'RESUBMITTED'].includes(existing.status)
    ) {
      throw new Error(`PR ${existing.prNumber} is Pending Approval and locked against editing.`);
    }

    // Mandatory Business Rule #4 & #5: Approved PR headers are immutable & converted lines are locked
    if (['APPROVED_PENDING_BUYER', 'PENDING_BUYER_CONFIGURATION', 'COMPLETED'].includes(existing.status)) {
      // Check if caller is attempting to mutate header fields other than unconverted line amendment
      const illegalHeaderAttempt =
        (updates.priority && updates.priority !== existing.priority) ||
        (updates.department && updates.department !== existing.department) ||
        (updates.currency && updates.currency !== existing.currency) ||
        (updates.costCentre && updates.costCentre !== existing.costCentre);

      if (illegalHeaderAttempt) {
        throw new Error(`Approved PR Header (${existing.prNumber}) is permanently immutable.`);
      }

      if (updates.lines) {
        // Ensure converted lines are never modified
        for (const origLine of existing.lines) {
          const lockInfo = prGovernancePolicyService.getLineLockStatus(origLine);
          if (lockInfo.convertedQty > 0) {
            const candidate = updates.lines.find(l => l.id === origLine.id);
            if (
              !candidate ||
              Number(candidate.requestedQuantity) < lockInfo.convertedQty ||
              candidate.itemCode !== origLine.itemCode
            ) {
              throw new Error(
                `Line ${origLine.itemCode} on ${existing.prNumber} has ${lockInfo.convertedQty} ${origLine.inventoryUom} converted and is permanently locked.`
              );
            }
          }
        }
      }
    } else {
      // DRAFT or RETURNED_FOR_CORRECTION
      const headerCheck = prGovernancePolicyService.evaluatePrAction({
        action: 'EDIT_PR_HEADER',
        companyId: existing.companyId,
        branchId: existing.branchId,
        user,
        pr: existing,
      });
      if (!headerCheck.allowed) {
        throw new Error(headerCheck.reason || `Editing PR ${existing.prNumber} is prohibited by policy.`);
      }
    }

    let sanitizedDeliveryDate = existing.expectedDeliveryDate;
    if (updates.expectedDeliveryDate !== undefined || updates.requiredBy !== undefined) {
      const candidateDate =
        updates.expectedDeliveryDate !== undefined
          ? updates.expectedDeliveryDate
          : updates.requiredBy;
      const isHistorical = Boolean(existing.submittedAt || existing.approvedAt);
      const delCheck = prGovernancePolicyService.validateExpectedDeliveryDate(
        candidateDate,
        eff,
        isHistorical
      );
      if (!delCheck.valid) {
        throw new Error(delCheck.reason);
      }
      sanitizedDeliveryDate = delCheck.sanitizedDate;
    }

    const nextPrType = updates.prType || existing.prType;
    const isNextExpensePr = nextPrType === 'EXPENSE';
    const nextCurrency = (updates.currency || existing.currency || 'INR').toUpperCase();
    const nextLines = updates.lines ?? existing.lines;
    const nextExpenseLines = updates.expenseLines ?? existing.expenseLines;
    const nextItemsSubtotal =
      updates.estimatedTotalValue !== undefined
        ? Number(updates.estimatedTotalValue)
        : Array.isArray(nextLines) && nextLines.length > 0
        ? nextLines.reduce(
            (sum, l) =>
              sum +
              (l.estimatedTotalValue !== undefined
                ? Number(l.estimatedTotalValue)
                : (Number(l.requestedQuantity) || 0) * (Number(l.approximateUnitPrice) || 0)),
            0
          )
        : existing.estimatedTotalValue;

    const isHistoricalLockedPr = Boolean(existing.submittedAt || existing.approvedAt);
    const candidateCharges =
      updates.chargeItems !== undefined ? updates.chargeItems : existing.chargeItems;
    const normalizedUpdatedCharges = isHistoricalLockedPr
      ? existing.chargeItems
      : candidateCharges && candidateCharges.length > 0
      ? prChargeItemService.recalculateAllCharges(candidateCharges, nextItemsSubtotal, nextCurrency)
      : candidateCharges;
    const normalizedUpdatedLines = isHistoricalLockedPr
      ? nextLines
      : prChargeItemService.recalculateLinesCharges(nextLines, nextCurrency);
    const hasUpdatedLineCharges = normalizedUpdatedLines.some(
      (l) => l.lineCharges && l.lineCharges.length > 0
    );
    const updatedChargesSummary =
      !isNextExpensePr &&
      ((normalizedUpdatedCharges && normalizedUpdatedCharges.length > 0) || hasUpdatedLineCharges)
        ? prChargeItemService.calculateFullRequisitionSummary(
            normalizedUpdatedCharges,
            normalizedUpdatedLines,
            nextItemsSubtotal
          )
        : undefined;

    const updatedExpenseSummary =
      isNextExpensePr && nextExpenseLines && nextExpenseLines.length > 0
        ? calculateExpensePrFinancials(nextExpenseLines)
        : undefined;

    const updated: PurchaseRequisitionHeader = {
      ...existing,
      ...updates,
      procurementMechanism: isNextExpensePr ? 'EXPENSE' : 'INVENTORY',
      lines: normalizedUpdatedLines,
      expenseLines: nextExpenseLines,
      chargeItems: normalizedUpdatedCharges,
      expenseSubtotal: updatedExpenseSummary
        ? updatedExpenseSummary.expenseSubtotal
        : updates.expenseSubtotal ?? existing.expenseSubtotal,
      expenseTaxTotal: updatedExpenseSummary
        ? updatedExpenseSummary.expenseTaxTotal
        : updates.expenseTaxTotal ?? existing.expenseTaxTotal,
      estimatedTotalValue: updatedExpenseSummary
        ? updatedExpenseSummary.expenseSubtotal
        : updates.estimatedTotalValue !== undefined
        ? Number(updates.estimatedTotalValue)
        : nextItemsSubtotal,
      chargesTotalValue: updatedChargesSummary
        ? updatedChargesSummary.applicableChargesBaseTotal
        : updates.chargesTotalValue ?? existing.chargesTotalValue,
      grandTotalWithCharges: updatedExpenseSummary
        ? updatedExpenseSummary.totalExpensePrValue
        : updatedChargesSummary
        ? updatedChargesSummary.grandTotalWithCharges
        : updates.grandTotalWithCharges ?? existing.grandTotalWithCharges,
      expectedDeliveryDate: sanitizedDeliveryDate,
      requiredBy: sanitizedDeliveryDate,
      policyVersion: existing.policyVersion || eff.policyVersion,
      updatedAt: new Date().toISOString(),
    };

    if (!isHistoricalLockedPr) {
      if (isNextExpensePr) {
        if (updates.expenseLines !== undefined && (updated.expenseLines || []).length > 0) {
          const expVal = expenseCategoryService.validateExpenseLinesForPr({
            companyId: updated.companyId,
            branchId: updated.branchId,
            department: updated.department,
            userId: user?.id || updated.requesterId,
            expenseLines: updated.expenseLines || [],
            headerCostCentre: updated.costCentre,
            headerExpectedServiceDate:
              updated.expectedServiceDate || updated.expectedDeliveryDate || updated.requiredBy,
            headerBusinessJustification: updated.businessJustification,
            asOfDate: updated.createdAt?.slice(0, 10),
          });
          if (!expVal.valid) {
            throw new Error(expVal.errors[0]);
          }
          updated.expenseLines = expVal.normalizedLines;
          if (updated.expenseLines[0]?.costCentre) {
            updated.costCentre = updated.expenseLines[0].costCentre;
          }
        }
      } else if (
        (updates.prType !== undefined || updates.lines !== undefined) &&
        (updated.lines || []).length > 0
      ) {
        const catVal = prTypeMasterService.validateLinesCategoriesForPrType({
          companyId: updated.companyId,
          branchId: updated.branchId,
          purchaseOrgId: updated.purchaseOrganizationId || updated.purchaseOrgId,
          prTypeCode: updated.prType,
          lines: updated.lines,
          evaluationDate: updated.createdAt?.slice(0, 10),
          userRole: user?.role,
        });
        if (!catVal.valid) {
          throw new Error(
            catVal.prTypeReason ||
              catVal.invalidLines[0]?.reason ||
              'Updated PR lines contain categories not mapped to the selected PR Type.'
          );
        }
      }
      if (!prGovernancePolicyService.isBudgetValidationEnabled(updated.companyId, updated.branchId)) {
        updated.budgetValidationStatus = 'NOT_VALIDATED';
        updated.budgetSourceRef = undefined;
        updated.budgetValidationSnapshot = undefined;
        updated.budgetValidationHistory = [];
        updated.budgetGovernance = undefined;
      }
      updated.duplicateGovernanceKey = updated.duplicateGovernanceKey || updated.id;
      updated.duplicateGovernance = prDuplicateGovernanceService.evaluateDuplicateConditions({
        draftKey: updated.duplicateGovernanceKey,
        prId: updated.id,
        prNumber: updated.prNumber,
        companyId: updated.companyId,
        branchId: updated.branchId,
        requesterId: updated.requesterId,
        purchasePurpose: updated.purchasePurpose,
        expectedDeliveryDate: updated.expectedDeliveryDate || updated.requiredBy,
        lines: (updated.lines || []).map((l) => ({
          id: l.id,
          itemCode: l.itemCode,
          description: l.description,
          requestedQuantity: l.requestedQuantity,
          inventoryUom: l.inventoryUom,
          purchasePurpose: l.purchasePurpose,
        })),
        actorUser: user,
        existingPrs: prs,
        persistedSnapshot: existing.duplicateGovernance,
      });
    }

    prs[idx] = updated;
    this.savePurchaseRequisitions(prs);

    EnterpriseAuditService.logEvent({
      companyId: updated.companyId,
      branchId: updated.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: updated.id,
      eventType: 'PR_UPDATED',
      eventDescription: `Updated PR ${updated.prNumber} (Status: ${updated.status})`,
      previousValue: {
        status: existing.status,
        estimatedTotalValue: existing.estimatedTotalValue,
        expectedDeliveryDate: existing.expectedDeliveryDate,
      },
      newValue: {
        status: updated.status,
        estimatedTotalValue: updated.estimatedTotalValue,
        expectedDeliveryDate: updated.expectedDeliveryDate,
      },
      changedByUserId: user?.id || updated.creatorId,
      changedByName: updates.modifiedBy || user?.fullName || updated.creatorName,
      changeReason: 'PR record updated',
      relatedPrId: updated.id,
    });

    return updated;
  },

  submitPR(id: string, user?: User): { success: boolean; message: string; pr?: PurchaseRequisitionHeader } {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find(p => p.id === id);
    if (!pr) return { success: false, message: 'Purchase requisition not found.' };

    const fyMutGuard = financialYearService.evaluateHistoricalRecordMutationGuard({
      companyId: pr.companyId,
      accountingPostingDate: pr.accountingPostingDate,
      documentDate: pr.createdAt?.slice(0, 10),
      financialYearId: pr.financialYearId,
      actionLabel: 'SUBMIT_PR',
    });
    if (!fyMutGuard.allowed) {
      return { success: false, message: fyMutGuard.reason || 'Closed financial year/period prohibits PR submission.' };
    }

    const eff = prGovernancePolicyService.getEffectivePolicy(pr.companyId, pr.branchId);
    const check = prGovernancePolicyService.evaluatePrAction({
      action: 'SUBMIT_PR',
      companyId: pr.companyId,
      branchId: pr.branchId,
      user,
      pr,
    });
    if (!check.allowed) {
      return { success: false, message: check.reason || 'PR Submission is disabled by policy.' };
    }

    // Mandatory PR Type, Classification Rule & Line-Level Category Mapping Check
    const txDocDate = (pr.createdAt || new Date().toISOString()).slice(0, 10);
    const conflictCheck = expenseCategoryService.detectClassificationConflict({
      prType: pr.prType,
      lines: pr.lines,
      expenseLines: pr.expenseLines,
      chargeItems: pr.chargeItems,
    });
    if (conflictCheck.hasConflict) {
      return { success: false, message: conflictCheck.conflicts[0], pr };
    }

    if (pr.prType === 'EXPENSE') {
      const expCheck = expenseCategoryService.validateExpenseLinesForPr({
        companyId: pr.companyId,
        branchId: pr.branchId,
        department: pr.department,
        userId: user?.id || pr.requesterId,
        expenseLines: pr.expenseLines || [],
        headerCostCentre: pr.costCentre,
        headerExpectedServiceDate: pr.expectedServiceDate || pr.expectedDeliveryDate || pr.requiredBy,
        headerBusinessJustification: pr.businessJustification,
        asOfDate: txDocDate,
      });
      if (!expCheck.valid) {
        return { success: false, message: expCheck.errors[0], pr };
      }
      pr.expenseLines = expCheck.normalizedLines;
      if (pr.expenseLines[0]?.costCentre) {
        pr.costCentre = pr.expenseLines[0].costCentre;
      }
      const expFin = calculateExpensePrFinancials(pr.expenseLines);
      pr.expenseSubtotal = expFin.expenseSubtotal;
      pr.expenseTaxTotal = expFin.expenseTaxTotal;
      pr.estimatedTotalValue = expFin.expenseSubtotal;
      pr.grandTotalWithCharges = expFin.totalExpensePrValue;
    } else {
      const chargeDup = prChargeItemService.validateHeaderAndLineChargeDuplicates(
        pr.chargeItems,
        pr.lines,
        Boolean(eff.activation.allowSameChargeAtHeaderAndLine)
      );
      if (!chargeDup.valid) {
        return { success: false, message: chargeDup.conflicts[0], pr };
      }
      if ((pr.lines || []).length > 0) {
        const catValidation = prTypeMasterService.validateLinesCategoriesForPrType({
          companyId: pr.companyId,
          branchId: pr.branchId,
          purchaseOrgId: pr.purchaseOrganizationId || pr.purchaseOrgId,
          prTypeCode: pr.prType,
          lines: pr.lines,
          evaluationDate: txDocDate,
          userRole: user?.role,
        });
        if (!catValidation.valid) {
          return {
            success: false,
            message:
              catValidation.prTypeReason ||
              catValidation.invalidLines[0]?.reason ||
              'One or more PR lines contain item categories not eligible for the selected PR Type.',
            pr,
          };
        }
      }
    }

    // Expected Delivery Date policy check on submission
    const delDateCheck = prGovernancePolicyService.validateExpectedDeliveryDate(
      pr.expectedDeliveryDate || pr.requiredBy,
      eff,
      true
    );
    if (!delDateCheck.valid) {
      return { success: false, message: delDateCheck.reason || 'Invalid Expected Delivery Date for submission.' };
    }

    // Conditional Budget Validation (ON vs OFF)
    const budgetValidationEnabled = prGovernancePolicyService.isBudgetValidationEnabled(
      pr.companyId,
      pr.branchId,
      txDocDate
    );
    if (budgetValidationEnabled) {
      const valuation = prGovernancePolicyService.resolvePrValuationAmount(pr, eff);
      const bgtSubmitSnap = budgetControlService.validateBudgetAtStage({
        transactionId: pr.id,
        transactionNumber: pr.prNumber,
        sourceChainId: pr.prNumber,
        stage: 'PR_SUBMISSION',
        companyId: pr.companyId,
        branchId: pr.branchId,
        department: pr.department,
        costCenter: pr.costCentre || 'CC-PROD-101',
        projectCode: pr.projectCode,
        financialYear: pr.financialPeriod,
        proposedAmount: valuation.reportingAmount,
        validatedBy: user?.fullName || pr.requesterName,
      });
      pr.budgetValidationSnapshot = bgtSubmitSnap;
      pr.budgetValidationHistory = [...(pr.budgetValidationHistory || []), bgtSubmitSnap];
      if (bgtSubmitSnap.overallOutcome === 'SUFFICIENT') {
        if (pr.budgetValidationStatus === 'NOT_VALIDATED') {
          pr.budgetValidationStatus = 'SUFFICIENT';
        }
      } else if (bgtSubmitSnap.overallOutcome === 'EXCEPTION_APPROVED') {
        pr.budgetValidationStatus = 'EXCEPTION_APPROVED';
      }

      if (
        eff.budget.mandatoryBudgetCheck &&
        ((pr.budgetValidationStatus !== 'SUFFICIENT' &&
          pr.budgetValidationStatus !== 'EXCEPTION_APPROVED') ||
          (!bgtSubmitSnap.canProceed && pr.budgetValidationStatus !== 'EXCEPTION_APPROVED'))
      ) {
        return {
          success: false,
          message:
            bgtSubmitSnap.budgetShortfall > 0
              ? `Mandatory budget validation failed: Shortfall of ₹${bgtSubmitSnap.budgetShortfall.toLocaleString('en-IN')} exceeds available budget.`
              : 'Mandatory budget validation failed or is insufficient. Cannot submit.',
          pr,
        };
      }
    } else {
      pr.budgetValidationStatus = 'NOT_VALIDATED';
      pr.budgetSourceRef = undefined;
      pr.budgetValidationSnapshot = undefined;
      pr.budgetValidationHistory = [];
      pr.budgetGovernance = undefined;
    }

    // Unified Duplicate PR Governance submission revalidation (acknowledgement + override/checker + status drift check)
    const dupSubmitValidation = prDuplicateGovernanceService.validateForSubmission({
      draftKey: pr.duplicateGovernanceKey || pr.id,
      prId: pr.id,
      prNumber: pr.prNumber,
      companyId: pr.companyId,
      branchId: pr.branchId,
      requesterId: pr.requesterId,
      purchasePurpose: pr.purchasePurpose,
      expectedDeliveryDate: pr.expectedDeliveryDate || pr.requiredBy,
      lines: (pr.lines || []).map((l) => ({
        id: l.id,
        itemCode: l.itemCode,
        description: l.description,
        requestedQuantity: l.requestedQuantity,
        inventoryUom: l.inventoryUom,
        purchasePurpose: l.purchasePurpose,
      })),
      actorUser: user,
      existingPrs: prs,
      persistedSnapshot: pr.duplicateGovernance,
    });
    pr.duplicateGovernanceKey = pr.id;
    pr.duplicateGovernance = dupSubmitValidation.snapshot;
    if (!dupSubmitValidation.allowed) {
      this.savePurchaseRequisitions(prs);
      return { success: false, message: dupSubmitValidation.message, pr };
    }

    const prevStatus = pr.status;
    pr.status = 'PENDING_MANAGER_APPROVAL';
    pr.policyVersion = pr.policyVersion || eff.policyVersion;
    pr.submittedAt = new Date().toISOString();
    pr.updatedAt = new Date().toISOString();
    pr.approvalCycleCount = (pr.approvalCycleCount || 0) + 1;
    if (pr.chargeItems && pr.chargeItems.length > 0) {
      pr.chargeItems = prChargeItemService.lockChargeSnapshots(pr.chargeItems, pr.submittedAt);
    }
    if (pr.lines && pr.lines.length > 0) {
      pr.lines = prChargeItemService.lockLineChargeSnapshots(pr.lines, pr.submittedAt);
    }

    // Part K: Stage-gated Inventory Revalidation at PR Submission (Inventory PRs only)
    if (pr.prType !== 'EXPENSE') {
      inventoryValidationService.revalidatePrAndAttachSnapshot(
        pr,
        'ON_PR_SUBMISSION',
        user?.fullName || pr.requesterName,
        user
      );
    }

    pr.approvalHistory = [
      ...(pr.approvalHistory || []),
      {
        id: `dec-${Date.now()}`,
        cycleNumber: pr.approvalCycleCount,
        level: 'L1 Submission',
        decision: 'SUBMITTED',
        actorId: user?.id || pr.requesterId,
        actorName: user?.fullName || pr.requesterName,
        actorRole: user?.role || 'REQUESTER',
        remarks: 'Submitted for Manager L1 Approval',
        timestamp: pr.updatedAt,
      },
    ];

    this.savePurchaseRequisitions(prs);

    EnterpriseAuditService.logEvent({
      companyId: pr.companyId,
      branchId: pr.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: pr.id,
      eventType: 'PR_SUBMITTED',
      eventDescription: `Submitted PR ${pr.prNumber} for approval (Cycle #${pr.approvalCycleCount})`,
      previousValue: { status: prevStatus },
      newValue: { status: pr.status, policyVersion: pr.policyVersion },
      changedByUserId: user?.id || pr.requesterId,
      changedByName: user?.fullName || pr.requesterName,
      changeReason: 'Submitted for approval',
      relatedPrId: pr.id,
    });

    return { success: true, message: 'PR submitted successfully to Reporting Manager Level 1.', pr };
  },

  /**
   * Resubmits a PR that was previously RETURNED_FOR_CORRECTION.
   * Retains the same PR number, preserves previous approval history, and creates a new approval cycle.
   */
  resubmitPR(
    id: string,
    actorName: string,
    remarks: string,
    user?: User
  ): { success: boolean; message: string; pr?: PurchaseRequisitionHeader } {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find(p => p.id === id);
    if (!pr) return { success: false, message: 'Purchase requisition not found.' };

    const fyMutGuard = financialYearService.evaluateHistoricalRecordMutationGuard({
      companyId: pr.companyId,
      accountingPostingDate: pr.accountingPostingDate,
      documentDate: pr.createdAt?.slice(0, 10),
      financialYearId: pr.financialYearId,
      actionLabel: 'RESUBMIT_PR',
    });
    if (!fyMutGuard.allowed) {
      return { success: false, message: fyMutGuard.reason || 'Closed financial year/period prohibits PR resubmission.' };
    }

    const eff = prGovernancePolicyService.getEffectivePolicy(pr.companyId, pr.branchId);
    const check = prGovernancePolicyService.evaluatePrAction({
      action: 'RESUBMIT_PR',
      companyId: pr.companyId,
      branchId: pr.branchId,
      user,
      pr,
    });
    if (!check.allowed) {
      return { success: false, message: check.reason || 'PR Resubmission is not permitted.' };
    }

    const txDocDate = (pr.createdAt || new Date().toISOString()).slice(0, 10);
    const conflictCheck = expenseCategoryService.detectClassificationConflict({
      prType: pr.prType,
      lines: pr.lines,
      expenseLines: pr.expenseLines,
      chargeItems: pr.chargeItems,
    });
    if (conflictCheck.hasConflict) {
      return { success: false, message: conflictCheck.conflicts[0], pr };
    }
    if (pr.prType === 'EXPENSE') {
      const expCheck = expenseCategoryService.validateExpenseLinesForPr({
        companyId: pr.companyId,
        branchId: pr.branchId,
        department: pr.department,
        userId: user?.id || pr.requesterId,
        expenseLines: pr.expenseLines || [],
        headerCostCentre: pr.costCentre,
        headerExpectedServiceDate: pr.expectedServiceDate || pr.expectedDeliveryDate || pr.requiredBy,
        headerBusinessJustification: pr.businessJustification,
        asOfDate: txDocDate,
      });
      if (!expCheck.valid) {
        return { success: false, message: expCheck.errors[0], pr };
      }
      pr.expenseLines = expCheck.normalizedLines;
      if (pr.expenseLines[0]?.costCentre) {
        pr.costCentre = pr.expenseLines[0].costCentre;
      }
    } else if ((pr.lines || []).length > 0) {
      const catValidation = prTypeMasterService.validateLinesCategoriesForPrType({
        companyId: pr.companyId,
        branchId: pr.branchId,
        purchaseOrgId: pr.purchaseOrganizationId || pr.purchaseOrgId,
        prTypeCode: pr.prType,
        lines: pr.lines,
        evaluationDate: txDocDate,
        userRole: user?.role,
      });
      if (!catValidation.valid) {
        return {
          success: false,
          message:
            catValidation.prTypeReason ||
            catValidation.invalidLines[0]?.reason ||
            'One or more PR lines contain item categories not eligible for the selected PR Type.',
          pr,
        };
      }
    }

    const budgetValidationEnabled = prGovernancePolicyService.isBudgetValidationEnabled(
      pr.companyId,
      pr.branchId,
      txDocDate
    );
    if (budgetValidationEnabled) {
      const valuation = prGovernancePolicyService.resolvePrValuationAmount(pr, eff);
      const bgtResubSnap = budgetControlService.validateBudgetAtStage({
        transactionId: pr.id,
        transactionNumber: pr.prNumber,
        sourceChainId: pr.prNumber,
        stage: 'PR_SUBMISSION',
        companyId: pr.companyId,
        branchId: pr.branchId,
        department: pr.department,
        costCenter: pr.costCentre || 'CC-PROD-101',
        projectCode: pr.projectCode,
        financialYear: pr.financialPeriod,
        proposedAmount: valuation.reportingAmount,
        validatedBy: actorName,
      });
      pr.budgetValidationSnapshot = bgtResubSnap;
      pr.budgetValidationHistory = [...(pr.budgetValidationHistory || []), bgtResubSnap];
      if (
        eff.budget.mandatoryBudgetCheck &&
        !bgtResubSnap.canProceed &&
        pr.budgetValidationStatus !== 'EXCEPTION_APPROVED'
      ) {
        return {
          success: false,
          message: 'Mandatory budget validation failed or is insufficient. Cannot resubmit.',
          pr,
        };
      }
    } else {
      pr.budgetValidationStatus = 'NOT_VALIDATED';
      pr.budgetSourceRef = undefined;
      pr.budgetValidationSnapshot = undefined;
      pr.budgetValidationHistory = [];
      pr.budgetGovernance = undefined;
    }

    // Revalidate Duplicate PR Governance on resubmission
    const dupResubmitValidation = prDuplicateGovernanceService.validateForSubmission({
      draftKey: pr.duplicateGovernanceKey || pr.id,
      prId: pr.id,
      prNumber: pr.prNumber,
      companyId: pr.companyId,
      branchId: pr.branchId,
      requesterId: pr.requesterId,
      purchasePurpose: pr.purchasePurpose,
      expectedDeliveryDate: pr.expectedDeliveryDate || pr.requiredBy,
      lines: (pr.lines || []).map((l) => ({
        id: l.id,
        itemCode: l.itemCode,
        description: l.description,
        requestedQuantity: l.requestedQuantity,
        inventoryUom: l.inventoryUom,
        purchasePurpose: l.purchasePurpose,
      })),
      actorUser: user,
      existingPrs: prs,
      persistedSnapshot: pr.duplicateGovernance,
    });
    pr.duplicateGovernanceKey = pr.id;
    pr.duplicateGovernance = dupResubmitValidation.snapshot;
    if (!dupResubmitValidation.allowed) {
      this.savePurchaseRequisitions(prs);
      return { success: false, message: dupResubmitValidation.message, pr };
    }

    const nowIso = new Date().toISOString();
    const nextCycle = (pr.approvalCycleCount || 1) + 1;
    const prevStatus = pr.status;

    pr.status = 'PENDING_MANAGER_APPROVAL';
    pr.approvalCycleCount = nextCycle;
    pr.modifiedBy = actorName;
    pr.submittedAt = nowIso;
    pr.updatedAt = nowIso;

    inventoryValidationService.revalidatePrAndAttachSnapshot(
      pr,
      'ON_PR_SUBMISSION',
      actorName,
      user
    );

    pr.approvalHistory = [
      ...(pr.approvalHistory || []),
      {
        id: `dec-${Date.now()}`,
        cycleNumber: nextCycle,
        level: `Resubmission (Cycle #${nextCycle})`,
        decision: 'RESUBMITTED',
        actorId: user?.id || pr.requesterId,
        actorName,
        actorRole: user?.role || 'REQUESTER',
        remarks: remarks || 'Corrected and resubmitted under same PR number.',
        timestamp: nowIso,
      },
    ];

    this.savePurchaseRequisitions(prs);

    EnterpriseAuditService.logEvent({
      companyId: pr.companyId,
      branchId: pr.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: pr.id,
      eventType: 'PR_RESUBMITTED',
      eventDescription: `Resubmitted PR ${pr.prNumber} under same PR number (Approval Cycle #${nextCycle})`,
      previousValue: { status: prevStatus },
      newValue: { status: pr.status, approvalCycleCount: nextCycle },
      changedByUserId: user?.id || pr.requesterId,
      changedByName: actorName,
      changeReason: remarks || 'Corrected and resubmitted PR',
      relatedPrId: pr.id,
    });

    return {
      success: true,
      message: `PR ${pr.prNumber} resubmitted for new approval cycle (#${nextCycle}).`,
      pr,
    };
  },

  /**
   * Withdraws a Pending Approval PR back to WITHDRAWN status before final approval.
   */
  withdrawPR(
    id: string,
    actorName: string,
    reason: string,
    user?: User
  ): { success: boolean; message: string; pr?: PurchaseRequisitionHeader } {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find(p => p.id === id);
    if (!pr) return { success: false, message: 'Purchase requisition not found.' };

    const check = prGovernancePolicyService.evaluatePrAction({
      action: 'WITHDRAW_PR',
      companyId: pr.companyId,
      branchId: pr.branchId,
      user,
      pr,
    });
    if (!check.allowed) {
      return { success: false, message: check.reason || 'PR Withdrawal is disabled by policy.' };
    }

    const nowIso = new Date().toISOString();
    const prevStatus = pr.status;
    pr.status = 'WITHDRAWN';
    pr.withdrawnBy = actorName;
    pr.withdrawnAt = nowIso;
    pr.withdrawnReason = reason || 'Withdrawn by requester prior to approval';
    pr.modifiedBy = actorName;
    pr.updatedAt = nowIso;
    pr.approvalHistory = [
      ...(pr.approvalHistory || []),
      {
        id: `dec-${Date.now()}`,
        cycleNumber: pr.approvalCycleCount || 1,
        level: 'Withdrawal',
        decision: 'WITHDRAWN',
        actorId: user?.id || pr.requesterId,
        actorName,
        actorRole: user?.role || 'REQUESTER',
        remarks: pr.withdrawnReason,
        timestamp: nowIso,
      },
    ];

    this.savePurchaseRequisitions(prs);

    EnterpriseAuditService.logEvent({
      companyId: pr.companyId,
      branchId: pr.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: pr.id,
      eventType: 'PR_WITHDRAWN',
      eventDescription: `Withdrew PR ${pr.prNumber} prior to approval`,
      previousValue: { status: prevStatus },
      newValue: { status: 'WITHDRAWN', reason: pr.withdrawnReason },
      changedByUserId: user?.id || pr.requesterId,
      changedByName: actorName,
      changeReason: pr.withdrawnReason,
      relatedPrId: pr.id,
    });

    return { success: true, message: `PR ${pr.prNumber} has been withdrawn.`, pr };
  },

  approvePR(
    id: string,
    approverName: string,
    role: string,
    remarks: string,
    options?: {
      actorUser?: User;
      isDelegatedApproval?: boolean;
      delegateeUserId?: string;
      evaluationDate?: string;
      reservationIdempotencyKey?: string;
    }
  ): PurchaseRequisitionHeader | null {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find(p => p.id === id);
    if (!pr) return null;

    const fyMutGuard = financialYearService.evaluateHistoricalRecordMutationGuard({
      companyId: pr.companyId,
      accountingPostingDate: pr.accountingPostingDate,
      documentDate: pr.createdAt?.slice(0, 10),
      financialYearId: pr.financialYearId,
      actionLabel: 'APPROVE_PR',
    });
    if (!fyMutGuard.allowed) {
      throw new Error(fyMutGuard.reason || `Cannot approve PR ${pr.prNumber} in a closed financial year or locked accounting period.`);
    }

    if (options?.actorUser) {
      const accessCheck = prGovernancePolicyService.validateUserCompanyBranchAccess(
        options.actorUser,
        pr.companyId,
        pr.branchId
      );
      if (!accessCheck.allowed) {
        throw new Error(accessCheck.reason || 'Unauthorized company or branch access.');
      }
    }

    // Requirement I: Validate Delegated Approval if acting under delegation
    let delegatedOnBehalfOf: string | undefined;
    if (options?.isDelegatedApproval && options?.delegateeUserId) {
      const delCheck = prGovernancePolicyService.validateDelegatedApproval({
        delegateeUserId: options.delegateeUserId,
        pr,
        evaluationDate: options.evaluationDate,
      });
      if (!delCheck.valid) {
        throw new Error(delCheck.reason || 'Delegated approval validation failed.');
      }
      delegatedOnBehalfOf = delCheck.delegation?.delegatorName;
    }

    const eff = prGovernancePolicyService.getEffectivePolicy(pr.companyId, pr.branchId);
    const workflowPlan = prGovernancePolicyService.resolveApprovalWorkflowPlan(pr, eff);
    if (!workflowPlan.enabled) {
      throw new Error('PR Approval workflow is disabled for this company/branch.');
    }

    if (workflowPlan.mandatoryApprovalRemarks && (!remarks || !remarks.trim())) {
      throw new Error('Approval remarks are mandatory under active governance policy.');
    }

    const actorRole = options?.actorUser?.role || role;
    if (!options?.isDelegatedApproval && actorRole && actorRole !== 'ADMIN') {
      if (!workflowPlan.authorizedRoles.includes(actorRole)) {
        throw new Error(
          `Role '${actorRole}' is not authorized for ${
            workflowPlan.currentTier?.levelName || `Level ${workflowPlan.currentStepIndex}`
          }. Authorized roles: ${workflowPlan.authorizedRoles.join(', ')}.`
        );
      }
    }

    if (workflowPlan.makerCheckerRequired) {
      const actorId = options?.actorUser?.id || approverName;
      if (actorId === pr.creatorId || approverName === pr.creatorName) {
        throw new Error(
          `Maker-Checker Control: Creator (${pr.creatorName}) cannot approve their own Purchase Requisition ${pr.prNumber}.`
        );
      }
    }

    // Ensure PR lines / expense lines remain eligible for PR Type before approving
    if (pr.prType === 'EXPENSE') {
      const expVal = expenseCategoryService.validateExpenseLinesForPr({
        companyId: pr.companyId,
        branchId: pr.branchId,
        department: pr.department,
        userId: pr.requesterId,
        expenseLines: pr.expenseLines || [],
        headerCostCentre: pr.costCentre,
        headerExpectedServiceDate: pr.expectedServiceDate || pr.expectedDeliveryDate || pr.requiredBy,
        headerBusinessJustification: pr.businessJustification,
        asOfDate: (pr.createdAt || new Date().toISOString()).slice(0, 10),
      });
      if (!expVal.valid) {
        throw new Error(`PR Approval blocked: ${expVal.errors[0]}`);
      }
    } else if ((pr.lines || []).length > 0) {
      const catVal = prTypeMasterService.validateLinesCategoriesForPrType({
        companyId: pr.companyId,
        branchId: pr.branchId,
        purchaseOrgId: pr.purchaseOrganizationId || pr.purchaseOrgId,
        prTypeCode: pr.prType,
        lines: pr.lines,
        evaluationDate: (pr.createdAt || new Date().toISOString()).slice(0, 10),
        userRole: actorRole,
      });
      if (!catVal.valid) {
        throw new Error(
          catVal.prTypeReason ||
            catVal.invalidLines[0]?.reason ||
            'PR Approval blocked: line item category is not mapped to PR Type.'
        );
      }
    }

    // Part K: Revalidate Inventory Availability at Approval Stage (Inventory PRs only)
    if (pr.prType !== 'EXPENSE') {
      const invReval = inventoryValidationService.revalidatePrAndAttachSnapshot(
        pr,
        'ON_PR_APPROVAL',
        approverName,
        options?.actorUser
      );
      if (!invReval.snapshot.canProceedApproval) {
        throw new Error(
          `PR Approval Blocked by Inventory Validation Policy (${invReval.snapshot.enforcementMode}): ${
            invReval.snapshot.lineResults.find((r) => r.isShortage)?.message ||
            'Required stock condition not met or pending authorized inventory exception approval.'
          }`
        );
      }
    }

    const txDocDate = (pr.createdAt || new Date().toISOString()).slice(0, 10);
    const budgetValidationEnabled = prGovernancePolicyService.isBudgetValidationEnabled(
      pr.companyId,
      pr.branchId,
      txDocDate
    );
    const valuation = prGovernancePolicyService.resolvePrValuationAmount(pr, eff);

    // Part L: Conditional Budget Control Revalidation at Approval Stage
    if (budgetValidationEnabled) {
      const bgtReval = budgetControlService.validateBudgetAtStage({
        transactionId: pr.id,
        transactionNumber: pr.prNumber,
        sourceChainId: pr.prNumber,
        stage: 'PR_APPROVAL',
        companyId: pr.companyId,
        branchId: pr.branchId,
        department: pr.department,
        costCenter: pr.costCentre,
        projectCode: pr.projectCode,
        financialYear: pr.financialPeriod,
        proposedAmount:
          pr.budgetGovernance?.originalReservationReportingCurrency ?? valuation.reportingAmount,
        validatedBy: approverName,
      });
      pr.budgetValidationSnapshot = bgtReval;
      pr.budgetValidationHistory = [...(pr.budgetValidationHistory || []), bgtReval];
      if (
        eff.budget.mandatoryBudgetCheck &&
        !bgtReval.canProceed &&
        pr.budgetValidationStatus !== 'EXCEPTION_APPROVED'
      ) {
        throw new Error(
          `PR Approval Blocked by Budget Control: Shortfall of ₹${bgtReval.budgetShortfall.toLocaleString('en-IN')}.`
        );
      }
    } else {
      pr.budgetValidationStatus = 'NOT_VALIDATED';
      pr.budgetSourceRef = undefined;
      pr.budgetValidationSnapshot = undefined;
      pr.budgetValidationHistory = [];
      pr.budgetGovernance = undefined;
    }

    const prevStatus = pr.status;
    const nowIso = new Date().toISOString();

    if (pr.status === 'PENDING_MANAGER_APPROVAL' || pr.status === 'RESUBMITTED') {
      if (workflowPlan.requiredLevels <= 1 || workflowPlan.currentStepIndex >= workflowPlan.requiredLevels) {
        pr.status = 'APPROVED_PENDING_BUYER';
        pr.approvedAt = nowIso;
        pr.lines.forEach(l => {
          l.buyerStatus = 'PENDING_BUYER_ACTION';
          l.approvedQuantity = l.requestedQuantity;
          l.originalApprovedQuantity = l.originalApprovedQuantity ?? l.requestedQuantity;
          l.originalApprovedUnitPrice = l.originalApprovedUnitPrice ?? l.approximateUnitPrice;
          l.originalApprovedItemCode = l.originalApprovedItemCode ?? l.itemCode;
        });
      } else {
        pr.status = 'PENDING_SUBSEQUENT_APPROVAL';
      }
    } else if (pr.status === 'PENDING_SUBSEQUENT_APPROVAL' || pr.status === 'PENDING_REAPPROVAL') {
      if (
        pr.status === 'PENDING_SUBSEQUENT_APPROVAL' &&
        workflowPlan.requiredLevels > 2 &&
        workflowPlan.currentStepIndex < workflowPlan.requiredLevels
      ) {
        pr.status = 'PENDING_SUBSEQUENT_APPROVAL';
      } else {
        pr.status = 'APPROVED_PENDING_BUYER';
        pr.approvedAt = nowIso;
        pr.lines.forEach(l => {
          l.buyerStatus = 'PENDING_BUYER_ACTION';
          l.approvedQuantity = l.requestedQuantity;
          l.originalApprovedQuantity = l.originalApprovedQuantity ?? l.requestedQuantity;
          l.originalApprovedUnitPrice = l.originalApprovedUnitPrice ?? l.approximateUnitPrice;
          l.originalApprovedItemCode = l.originalApprovedItemCode ?? l.itemCode;
        });
      }
    }

    if (pr.status === 'APPROVED_PENDING_BUYER') {
      if (pr.chargeItems && pr.chargeItems.length > 0) {
        pr.chargeItems = prChargeItemService.lockChargeSnapshots(pr.chargeItems, nowIso);
      }
      if (pr.lines && pr.lines.length > 0) {
        pr.lines = prChargeItemService.lockLineChargeSnapshots(pr.lines, nowIso);
      }
      // Requirement F.8: Reserve budget on PR approval ONLY when Budget Validation is enabled
      if (budgetValidationEnabled && eff.budget.budgetReservationOnApproval) {
        if (
          options?.reservationIdempotencyKey &&
          pr.budgetGovernance?.reservationIdempotencyKey === options.reservationIdempotencyKey
        ) {
          throw new Error(
            `Duplicate Budget Reservation Prevented: Idempotency key '${options.reservationIdempotencyKey}' has already reserved budget for ${pr.prNumber}.`
          );
        }
        const txCurr = (pr.currency || 'INR').toUpperCase();
        const repCurr = eff.budget.companyReportingCurrency || 'INR';
        const fxInfo = prGovernancePolicyService.getExchangeRate(txCurr, repCurr);
        const origRes =
          pr.budgetGovernance?.originalReservationAmount ?? valuation.transactionAmount;
        const rateUsed = pr.budgetGovernance?.exchangeRateUsed ?? fxInfo.rate;

        pr.budgetGovernance = {
          ...pr.budgetGovernance,
          originalReservationAmount: origRes,
          outstandingCommittedAmount: pr.budgetGovernance?.outstandingCommittedAmount ?? 0,
          previouslyReleasedAmount: pr.budgetGovernance?.previouslyReleasedAmount ?? 0,
          transactionCurrency: txCurr,
          companyReportingCurrency: repCurr,
          exchangeRateUsed: rateUsed,
          exchangeRateRef: pr.budgetGovernance?.exchangeRateRef ?? fxInfo.ref,
          exchangeRateDate: pr.budgetGovernance?.exchangeRateDate ?? fxInfo.effectiveDate,
          originalReservationReportingCurrency: Number((origRes * rateUsed).toFixed(2)),
          reservationIdempotencyKey:
            options?.reservationIdempotencyKey ||
            pr.budgetGovernance?.reservationIdempotencyKey ||
            `res-${pr.id}`,
          releaseIdempotencyKeys: pr.budgetGovernance?.releaseIdempotencyKeys || [],
          releaseHistory: pr.budgetGovernance?.releaseHistory ?? [],
        };
      } else if (!budgetValidationEnabled) {
        pr.budgetGovernance = undefined;
      }

      // Automatically trigger web-based market price discovery engine for all approved lines
      setTimeout(() => {
        marketBenchmarkService.autoDiscoverForApprovedPR(
          pr.prNumber,
          pr.lines.map(l => ({ itemCode: l.itemCode, description: l.description, specifications: (l as any).specifications }))
        );
      }, 0);
    }

    pr.modifiedBy = approverName;
    pr.updatedAt = nowIso;
    pr.approvalHistory = [
      ...(pr.approvalHistory || []),
      {
        id: `dec-${Date.now()}`,
        cycleNumber: pr.approvalCycleCount || 1,
        level: prevStatus === 'PENDING_MANAGER_APPROVAL' ? 'Level 1 Approval' : 'Final Approval',
        decision: delegatedOnBehalfOf ? 'DELEGATED_APPROVAL' : 'APPROVED',
        actorId: approverName,
        actorName: approverName,
        actorRole: role,
        delegatedOnBehalfOf,
        remarks: remarks || 'Approved per governance matrix',
        timestamp: nowIso,
      },
    ];

    if (isPrStatusApproved(pr.status)) {
      try {
        const archivedPdf = archiveApprovedPrPdf(pr, {
          printedBy: approverName,
          autoPrinted: true,
        });
        pr.immutablePdfRecordId = archivedPdf.id;
        const existingAttachments = pr.attachments || [];
        if (!existingAttachments.some((a) => a.immutablePdfId === archivedPdf.id)) {
          existingAttachments.push({
            id: `att-imm-pdf-${archivedPdf.id}`,
            fileName: archivedPdf.fileName,
            fileSize: archivedPdf.fileSizeBytes,
            fileType: 'PDF',
            category: 'SUPPORTING_APPROVAL',
            versionNumber: archivedPdf.version,
            isHistoricalApprovedVersion: true,
            lockedForConvertedTransaction: true,
            uploadedAt: archivedPdf.archivedAt,
            uploadedBy: approverName,
            url: archivedPdf.pdfDataUri,
            immutablePdfId: archivedPdf.id,
            immutablePdfHash: archivedPdf.sha256Hash,
            auditHistory: [
              {
                id: `aud-pdf-${Date.now()}`,
                action: 'UPLOADED',
                actorId: options?.actorUser?.id || approverName,
                actorName: approverName,
                timestamp: archivedPdf.archivedAt,
                remarks: `Official Approved PR PDF sealed in Immutable Repository (SHA-256: ${archivedPdf.sha256Hash.slice(0, 16)}...)`,
              },
            ],
          });
          pr.attachments = existingAttachments;
        }

        EnterpriseAuditService.logEvent({
          companyId: pr.companyId,
          branchId: pr.branchId,
          entityType: 'PURCHASE_REQUISITION',
          entityId: pr.id,
          eventType: 'PR_APPROVED_PDF_ARCHIVED',
          eventDescription: `Official Approved PDF (${archivedPdf.fileName}) generated and sealed into Immutable PR Document Repository`,
          newValue: {
            immutablePdfId: archivedPdf.id,
            version: archivedPdf.version,
            sha256Hash: archivedPdf.sha256Hash,
            fileName: archivedPdf.fileName,
            autoPrinted: true,
          },
          changedByUserId: options?.actorUser?.id || approverName,
          changedByName: approverName,
          changeReason: 'Automatic immutable approval PDF sealing',
          relatedPrId: pr.id,
        });
      } catch (archiveErr) {
        console.error('Immutable PR PDF archival warning:', archiveErr);
      }
    }

    this.savePurchaseRequisitions(prs);

    EnterpriseAuditService.logEvent({
      companyId: pr.companyId,
      branchId: pr.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: pr.id,
      eventType: 'PR_APPROVED',
      eventDescription: `Approved PR ${pr.prNumber} (${prevStatus} → ${pr.status}) by ${approverName}${
        delegatedOnBehalfOf ? ` (Delegated for ${delegatedOnBehalfOf})` : ''
      }`,
      previousValue: { status: prevStatus },
      newValue: { status: pr.status, delegatedOnBehalfOf },
      changedByUserId: approverName,
      changedByName: approverName,
      changeReason: remarks || 'Approved PR',
      relatedPrId: pr.id,
    });

    return pr;
  },

  /**
   * Assigns a buyer to PR lines and triggers ON_BUYER_ASSIGNMENT stage-gated inventory revalidation if enabled in policy.
   */
  assignBuyerToPrLines(params: {
    prId: string;
    buyerName: string;
    lineIds?: string[];
    actorName: string;
    user?: User;
  }): PurchaseRequisitionHeader | null {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find((p) => p.id === params.prId || p.prNumber === params.prId);
    if (!pr) return null;

    pr.lines.forEach((l) => {
      if (!params.lineIds || params.lineIds.length === 0 || params.lineIds.includes(l.id)) {
        l.assignedBuyer = params.buyerName;
      }
    });
    pr.modifiedBy = params.actorName;
    pr.updatedAt = new Date().toISOString();

    const effInv = inventoryValidationService.getEffectivePolicy({
      companyId: pr.companyId,
      branchId: pr.branchId,
      warehouseCode: pr.lines[0]?.defaultWarehouse,
      itemCategory: pr.lines[0]?.itemCategory,
    });
    if (
      effInv.isEnabled &&
      effInv.revalidationStages?.includes('ON_BUYER_ASSIGNMENT')
    ) {
      inventoryValidationService.revalidatePrAndAttachSnapshot(
        pr,
        'ON_BUYER_ASSIGNMENT',
        params.actorName,
        params.user
      );
    }

    this.savePurchaseRequisitions(prs);
    return pr;
  },

  rejectPR(id: string, approverName: string, remarks: string): PurchaseRequisitionHeader | null {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find(p => p.id === id);
    if (!pr) return null;

    const nowIso = new Date().toISOString();
    const prevStatus = pr.status;
    pr.status = 'REJECTED';
    pr.modifiedBy = approverName;
    pr.updatedAt = nowIso;
    pr.approvalHistory = [
      ...(pr.approvalHistory || []),
      {
        id: `dec-${Date.now()}`,
        cycleNumber: pr.approvalCycleCount || 1,
        level: 'Rejection',
        decision: 'REJECTED',
        actorId: approverName,
        actorName: approverName,
        actorRole: 'APPROVER',
        remarks,
        timestamp: nowIso,
      },
    ];
    this.savePurchaseRequisitions(prs);

    EnterpriseAuditService.logEvent({
      companyId: pr.companyId,
      branchId: pr.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: pr.id,
      eventType: 'PR_REJECTED',
      eventDescription: `Rejected PR ${pr.prNumber} by ${approverName}`,
      previousValue: { status: prevStatus },
      newValue: { status: 'REJECTED' },
      changedByUserId: approverName,
      changedByName: approverName,
      changeReason: remarks,
      relatedPrId: pr.id,
    });

    return pr;
  },

  returnForCorrection(id: string, remarks: string, actorName: string = 'Approver'): PurchaseRequisitionHeader | null {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find(p => p.id === id);
    if (!pr) return null;

    const eff = prGovernancePolicyService.getEffectivePolicy(pr.companyId, pr.branchId);
    if (!eff.activation.prReturnForCorrectionEnabled || !eff.approval.returnForCorrection) {
      throw new Error('Return for Correction is disabled by active governance policy.');
    }
    if (eff.approval.mandatoryReturnReason && (!remarks || !remarks.trim())) {
      throw new Error('A mandatory return reason is required to return a PR for correction.');
    }

    const nowIso = new Date().toISOString();
    const prevStatus = pr.status;
    pr.status = 'RETURNED_FOR_CORRECTION';
    pr.modifiedBy = actorName;
    pr.updatedAt = nowIso;
    pr.approvalHistory = [
      ...(pr.approvalHistory || []),
      {
        id: `dec-${Date.now()}`,
        cycleNumber: pr.approvalCycleCount || 1,
        level: 'Return for Correction',
        decision: 'RETURNED_FOR_CORRECTION',
        actorId: actorName,
        actorName,
        actorRole: 'APPROVER',
        remarks,
        timestamp: nowIso,
      },
    ];
    this.savePurchaseRequisitions(prs);

    EnterpriseAuditService.logEvent({
      companyId: pr.companyId,
      branchId: pr.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: pr.id,
      eventType: 'PR_RETURNED_FOR_CORRECTION',
      eventDescription: `Returned PR ${pr.prNumber} for correction to requester (${pr.requesterName})`,
      previousValue: { status: prevStatus },
      newValue: { status: 'RETURNED_FOR_CORRECTION', returnReason: remarks },
      changedByUserId: actorName,
      changedByName: actorName,
      changeReason: remarks,
      relatedPrId: pr.id,
    });

    return pr;
  },

  /**
   * Executes Policy-Governed Short Close on a PR (or selected unconverted PR lines).
   * - Closes only eligible unconverted quantities.
   * - Preserves converted quantities and downstream RFQ/PO commitments.
   * - Automatically releases eligible uncommitted budget reservations:
   *   Eligible Release = Original PR Reservation − Valid Outstanding Commitments − Previously Released Amount.
   */
  shortClosePR(params: {
    prId: string;
    lineIds?: string[]; // If omitted or empty, short-closes all lines with remaining unconverted qty
    reason: string;
    remarks: string;
    user: User;
    convertedQtyByLineId?: Record<string, number>;
    idempotencyKey?: string;
    simulateBudgetReleaseFailure?: boolean;
  }): {
    success: boolean;
    message: string;
    releasedBudgetAmount: number;
    releasedBudgetReportingCurrency?: number;
    reconciliationQueueItemId?: string;
    pr?: PurchaseRequisitionHeader;
  } {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find(p => p.id === params.prId);
    if (!pr) {
      return { success: false, message: 'Purchase Requisition not found.', releasedBudgetAmount: 0 };
    }

    const fyMutGuard = financialYearService.evaluateHistoricalRecordMutationGuard({
      companyId: pr.companyId,
      accountingPostingDate: pr.accountingPostingDate,
      documentDate: pr.createdAt?.slice(0, 10),
      financialYearId: pr.financialYearId,
      actionLabel: 'SHORT_CLOSE_PR',
    });
    if (!fyMutGuard.allowed) {
      return {
        success: false,
        message: fyMutGuard.reason || `Closed period/FY prevents short-closing PR ${pr.prNumber}.`,
        releasedBudgetAmount: 0,
      };
    }

    // Requirement M.2 & F.9: Prevent duplicate budget release via idempotency key
    if (
      params.idempotencyKey &&
      (prGovernancePolicyService.hasProcessedIdempotencyKey(params.idempotencyKey) ||
        pr.budgetGovernance?.releaseIdempotencyKeys?.includes(params.idempotencyKey))
    ) {
      return {
        success: false,
        message: `Duplicate Short Close / Budget Release Prevented: Idempotency key '${params.idempotencyKey}' has already been processed.`,
        releasedBudgetAmount: 0,
      };
    }

    // Requirement M: Simulated or caught Budget Release Failure Recovery
    if (params.simulateBudgetReleaseFailure) {
      const queueItem = prGovernancePolicyService.enqueueFailureRecoveryItem({
        idempotencyKey: params.idempotencyKey,
        operationType: 'FAILED_BUDGET_RELEASE',
        prId: pr.id,
        prNumber: pr.prNumber,
        companyId: pr.companyId,
        branchId: pr.branchId,
        errorMessage: 'Simulated downstream ERP budget release service timeout during Short Close.',
        lastValidStateSnapshot: pr,
        attemptedPayload: { reason: params.reason, remarks: params.remarks, lineIds: params.lineIds },
      });
      return {
        success: false,
        message: `Budget release service failed. Document state preserved and enqueued for reconciliation (${queueItem.id}).`,
        releasedBudgetAmount: 0,
        reconciliationQueueItemId: queueItem.id,
      };
    }

    const eff = prGovernancePolicyService.getEffectivePolicy(pr.companyId, pr.branchId);
    const check = prGovernancePolicyService.evaluatePrAction({
      action: 'SHORT_CLOSE_PR',
      companyId: pr.companyId,
      branchId: pr.branchId,
      user: params.user,
      pr,
    });
    if (!check.allowed) {
      return {
        success: false,
        message: check.reason || 'Short Close is disabled or unauthorized under active policy.',
        releasedBudgetAmount: 0,
      };
    }

    if (eff.shortClose.mandatoryReason && !params.reason?.trim()) {
      return {
        success: false,
        message: 'Short Close Reason is mandatory under active governance policy.',
        releasedBudgetAmount: 0,
      };
    }
    if (eff.shortClose.mandatoryRemarks && !params.remarks?.trim()) {
      return {
        success: false,
        message: 'Short Close Remarks are mandatory under active governance policy.',
        releasedBudgetAmount: 0,
      };
    }

    const targetIds =
      params.lineIds && params.lineIds.length > 0
        ? params.lineIds
        : pr.lines.map(l => l.id);

    const nowIso = new Date().toISOString();
    let closedLineCount = 0;
    let newlyShortClosedValue = 0;

    for (const line of pr.lines) {
      if (!targetIds.includes(line.id)) continue;
      const convertedQty =
        params.convertedQtyByLineId?.[line.id] ??
        Number(line.convertedRfqQuantity || 0) + Number(line.convertedPoQuantity || 0);
      const lockInfo = prGovernancePolicyService.getLineLockStatus(line, convertedQty);

      if (lockInfo.remainingQty <= 0) {
        continue; // Already fully converted, short-closed, or cancelled
      }

      const qtyToShortClose = lockInfo.remainingQty;
      line.convertedRfqQuantity = convertedQty;
      line.shortClosedQuantity = Number(line.shortClosedQuantity || 0) + qtyToShortClose;
      line.lineLockStatus = 'SHORT_CLOSED';
      if (convertedQty === 0) {
        line.status = 'SHORT_CLOSED';
      }
      line.shortCloseReason = params.reason.trim();
      line.shortCloseRemarks = params.remarks.trim();
      line.shortClosedBy = params.user.fullName;
      line.shortClosedAt = nowIso;

      newlyShortClosedValue += qtyToShortClose * (Number(line.approximateUnitPrice) || 0);
      closedLineCount++;
    }

    if (closedLineCount === 0) {
      return {
        success: false,
        message: 'No eligible unconverted PR line quantities available for Short Close.',
        releasedBudgetAmount: 0,
      };
    }

    const allLinesClosedOrConverted = pr.lines.every(l => {
      const cQty =
        params.convertedQtyByLineId?.[l.id] ??
        Number(l.convertedRfqQuantity || 0) + Number(l.convertedPoQuantity || 0);
      return prGovernancePolicyService.getLineLockStatus(l, cQty).remainingQty <= 0.0001;
    });

    const prevStatus = pr.status;
    if (allLinesClosedOrConverted) {
      pr.status = 'SHORT_CLOSED';
      pr.shortCloseReason = params.reason.trim();
      pr.shortCloseRemarks = params.remarks.trim();
      pr.shortClosedBy = params.user.fullName;
      pr.shortClosedAt = nowIso;
    }

    // Budget Reconciliation & Automatic Uncommitted Budget Release ONLY when Budget Validation is ON
    const budgetValidationEnabled = prGovernancePolicyService.isBudgetValidationEnabled(
      pr.companyId,
      pr.branchId
    );
    let releasedAmount = 0;
    let releasedAmountReportingCurrency = 0;
    let reconSummary = {
      previouslyReleasedAmount: 0,
      exchangeRateUsed: 1,
      validOutstandingCommitments: 0,
    };

    if (budgetValidationEnabled) {
      const recon = prGovernancePolicyService.calculateBudgetReconciliation(
        pr,
        params.convertedQtyByLineId
      );
      reconSummary = recon;
      releasedAmount =
        eff.budget.autoUncommittedBudgetRelease && eff.budget.budgetReleaseOnShortClose
          ? Math.min(recon.eligibleReleaseAmount, newlyShortClosedValue || recon.eligibleReleaseAmount)
          : 0;
      releasedAmountReportingCurrency = Number(
        (releasedAmount * recon.exchangeRateUsed).toFixed(2)
      );

      const releaseEntry: PRBudgetReleaseEntry = {
        id: `rel-${Date.now()}`,
        idempotencyKey: params.idempotencyKey,
        actionType: 'SHORT_CLOSE',
        originalReservation: recon.originalReservation,
        validCommitments: recon.validOutstandingCommitments,
        previouslyReleased: recon.previouslyReleasedAmount,
        releasedAmount,
        currency: recon.transactionCurrency,
        exchangeRateUsed: recon.exchangeRateUsed,
        exchangeRateRef: recon.exchangeRateRef,
        exchangeRateDate: recon.exchangeRateDate,
        reportingCurrency: recon.companyReportingCurrency,
        releasedAmountReportingCurrency,
        reason: params.reason.trim(),
        remarks: params.remarks.trim(),
        releasedBy: params.user.fullName,
        timestamp: nowIso,
      };

      const existingKeys = pr.budgetGovernance?.releaseIdempotencyKeys || [];
      if (params.idempotencyKey) {
        existingKeys.push(params.idempotencyKey);
        prGovernancePolicyService.markIdempotencyKeyProcessed(params.idempotencyKey);
      }

      pr.budgetGovernance = {
        ...pr.budgetGovernance,
        originalReservationAmount: recon.originalReservation,
        outstandingCommittedAmount: recon.validOutstandingCommitments,
        previouslyReleasedAmount: recon.previouslyReleasedAmount + releasedAmount,
        transactionCurrency: recon.transactionCurrency,
        companyReportingCurrency: recon.companyReportingCurrency,
        exchangeRateUsed: recon.exchangeRateUsed,
        exchangeRateRef: recon.exchangeRateRef,
        exchangeRateDate: recon.exchangeRateDate,
        originalReservationReportingCurrency: recon.originalReservationReportingCurrency,
        outstandingCommittedReportingCurrency: recon.validCommitmentsReportingCurrency,
        previouslyReleasedReportingCurrency: Number(
          ((recon.previouslyReleasedAmount + releasedAmount) * recon.exchangeRateUsed).toFixed(2)
        ),
        releaseIdempotencyKeys: existingKeys,
        releaseHistory: [releaseEntry, ...(pr.budgetGovernance?.releaseHistory || [])],
      };
    }

    pr.modifiedBy = params.user.fullName;
    pr.updatedAt = nowIso;
    this.savePurchaseRequisitions(prs);

    EnterpriseAuditService.logEvent({
      companyId: pr.companyId,
      branchId: pr.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: pr.id,
      eventType: 'PR_SHORT_CLOSED',
      eventDescription: budgetValidationEnabled
        ? `Short closed ${closedLineCount} line(s) on PR ${pr.prNumber}. Uncommitted budget released: ${pr.currency} ${releasedAmount.toLocaleString('en-IN')}`
        : `Short closed ${closedLineCount} line(s) on PR ${pr.prNumber}.`,
      previousValue: {
        status: prevStatus,
        previouslyReleasedAmount: reconSummary.previouslyReleasedAmount,
      },
      newValue: {
        status: pr.status,
        closedLineCount,
        releasedBudgetAmount: releasedAmount,
        releasedBudgetReportingCurrency: releasedAmountReportingCurrency,
        exchangeRateUsed: reconSummary.exchangeRateUsed,
        validCommitmentsPreserved: reconSummary.validOutstandingCommitments,
        reason: params.reason.trim(),
      },
      changedByUserId: params.user.id,
      changedByName: params.user.fullName,
      changeReason: `${params.reason.trim()} — ${params.remarks.trim()}`,
      relatedPrId: pr.id,
    });

    return {
      success: true,
      message: budgetValidationEnabled
        ? `Short closed ${closedLineCount} line(s) on ${pr.prNumber}. Released uncommitted budget: ${pr.currency} ${releasedAmount.toLocaleString('en-IN')}.`
        : `Short closed ${closedLineCount} line(s) on ${pr.prNumber}.`,
      releasedBudgetAmount: releasedAmount,
      releasedBudgetReportingCurrency: releasedAmountReportingCurrency,
      pr,
    };
  },

  /**
   * Executes Policy-Governed PR Cancellation (separate from Short Close).
   * - Only eligible unconverted lines (convertedQty === 0) may be cancelled.
   * - Preserves all converted lines and downstream RFQ/PO transactions.
   * - Releases eligible uncommitted budget reservations and permanently locks cancelled records.
   */
  cancelPR(params: {
    prId: string;
    lineIds?: string[];
    reason: string;
    remarks: string;
    user: User;
    convertedQtyByLineId?: Record<string, number>;
  }): {
    success: boolean;
    message: string;
    releasedBudgetAmount: number;
    pr?: PurchaseRequisitionHeader;
  } {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find(p => p.id === params.prId);
    if (!pr) {
      return { success: false, message: 'Purchase Requisition not found.', releasedBudgetAmount: 0 };
    }

    const fyMutGuard = financialYearService.evaluateHistoricalRecordMutationGuard({
      companyId: pr.companyId,
      accountingPostingDate: pr.accountingPostingDate,
      documentDate: pr.createdAt?.slice(0, 10),
      financialYearId: pr.financialYearId,
      actionLabel: 'CANCEL_PR',
    });
    if (!fyMutGuard.allowed) {
      return {
        success: false,
        message: fyMutGuard.reason || `Closed period/FY prevents cancelling PR ${pr.prNumber}.`,
        releasedBudgetAmount: 0,
      };
    }

    const eff = prGovernancePolicyService.getEffectivePolicy(pr.companyId, pr.branchId);
    const check = prGovernancePolicyService.evaluatePrAction({
      action: 'CANCEL_PR',
      companyId: pr.companyId,
      branchId: pr.branchId,
      user: params.user,
      pr,
    });
    if (!check.allowed) {
      return {
        success: false,
        message: check.reason || 'PR Cancellation is disabled or unauthorized under active policy.',
        releasedBudgetAmount: 0,
      };
    }

    if (eff.cancellation.mandatoryCancellationReason && !params.reason?.trim()) {
      return {
        success: false,
        message: 'Cancellation Reason is mandatory under active governance policy.',
        releasedBudgetAmount: 0,
      };
    }
    if (eff.cancellation.mandatoryCancellationRemarks && !params.remarks?.trim()) {
      return {
        success: false,
        message: 'Cancellation Remarks are mandatory under active governance policy.',
        releasedBudgetAmount: 0,
      };
    }

    const targetIds =
      params.lineIds && params.lineIds.length > 0
        ? params.lineIds
        : pr.lines.map(l => l.id);

    const nowIso = new Date().toISOString();
    let cancelledLineCount = 0;
    let newlyCancelledValue = 0;

    for (const line of pr.lines) {
      if (!targetIds.includes(line.id)) continue;
      const convertedQty =
        params.convertedQtyByLineId?.[line.id] ??
        Number(line.convertedRfqQuantity || 0) + Number(line.convertedPoQuantity || 0);

      // Section 8 rule: Only eligible unconverted lines may be cancelled; preserve converted lines
      if (convertedQty > 0) {
        continue;
      }
      if (line.status === 'CANCELLED' || line.status === 'SHORT_CLOSED') {
        continue;
      }

      line.status = 'CANCELLED';
      line.cancelledQuantity = line.requestedQuantity;
      line.lineLockStatus = 'CANCELLED';
      line.cancelReason = params.reason.trim();
      line.cancelRemarks = params.remarks.trim();
      line.cancelledBy = params.user.fullName;
      line.cancelledAt = nowIso;

      newlyCancelledValue += Number(line.requestedQuantity || 0) * Number(line.approximateUnitPrice || 0);
      cancelledLineCount++;
    }

    if (cancelledLineCount === 0) {
      return {
        success: false,
        message:
          'No eligible unconverted lines can be cancelled (converted lines are preserved; use Short Close for partially converted lines).',
        releasedBudgetAmount: 0,
      };
    }

    const prevStatus = pr.status;
    const allLinesCancelled = pr.lines.every(l => l.status === 'CANCELLED');
    if (allLinesCancelled) {
      pr.status = 'CANCELLED';
      pr.cancelReason = params.reason.trim();
      pr.cancelRemarks = params.remarks.trim();
      pr.cancelledBy = params.user.fullName;
      pr.cancelledAt = nowIso;
    }

    // Conditional Budget Reconciliation & Release ONLY when Budget Validation is ON
    const budgetValidationEnabled = prGovernancePolicyService.isBudgetValidationEnabled(
      pr.companyId,
      pr.branchId
    );
    let releasedAmount = 0;

    if (budgetValidationEnabled) {
      const recon = prGovernancePolicyService.calculateBudgetReconciliation(
        pr,
        params.convertedQtyByLineId
      );
      releasedAmount =
        eff.budget.autoUncommittedBudgetRelease && eff.budget.budgetReleaseOnCancellation
          ? Math.min(recon.eligibleReleaseAmount, newlyCancelledValue || recon.eligibleReleaseAmount)
          : 0;

      const releaseEntry: PRBudgetReleaseEntry = {
        id: `rel-${Date.now()}`,
        actionType: 'CANCELLATION',
        originalReservation: recon.originalReservation,
        validCommitments: recon.validOutstandingCommitments,
        previouslyReleased: recon.previouslyReleasedAmount,
        releasedAmount,
        currency: pr.currency || 'INR',
        reason: params.reason.trim(),
        remarks: params.remarks.trim(),
        releasedBy: params.user.fullName,
        timestamp: nowIso,
      };

      pr.budgetGovernance = {
        originalReservationAmount: recon.originalReservation,
        outstandingCommittedAmount: recon.validOutstandingCommitments,
        previouslyReleasedAmount: recon.previouslyReleasedAmount + releasedAmount,
        releaseHistory: [releaseEntry, ...(pr.budgetGovernance?.releaseHistory || [])],
      };
    }

    pr.modifiedBy = params.user.fullName;
    pr.updatedAt = nowIso;
    this.savePurchaseRequisitions(prs);

    EnterpriseAuditService.logEvent({
      companyId: pr.companyId,
      branchId: pr.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: pr.id,
      eventType: 'PR_CANCELLED',
      eventDescription: budgetValidationEnabled
        ? `Cancelled ${cancelledLineCount} unconverted line(s) on PR ${pr.prNumber}. Released budget: ${pr.currency} ${releasedAmount.toLocaleString('en-IN')}`
        : `Cancelled ${cancelledLineCount} unconverted line(s) on PR ${pr.prNumber}.`,
      previousValue: { status: prevStatus },
      newValue: {
        status: pr.status,
        cancelledLineCount,
        releasedBudgetAmount: releasedAmount,
        reason: params.reason.trim(),
      },
      changedByUserId: params.user.id,
      changedByName: params.user.fullName,
      changeReason: `${params.reason.trim()} — ${params.remarks.trim()}`,
      relatedPrId: pr.id,
    });

    return {
      success: true,
      message: budgetValidationEnabled
        ? `Cancelled ${cancelledLineCount} unconverted line(s) on ${pr.prNumber}. Released uncommitted budget: ${pr.currency} ${releasedAmount.toLocaleString('en-IN')}.`
        : `Cancelled ${cancelledLineCount} unconverted line(s) on ${pr.prNumber}.`,
      releasedBudgetAmount: releasedAmount,
      pr,
    };
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
    const snap = prDuplicateGovernanceService.evaluateDuplicateConditions({
      draftKey: `check-${normalizeCompanyId(companyId)}-${normalizeBranchId(branchId)}-${itemCode}`,
      companyId,
      branchId,
      lines: [{ itemCode, requestedQuantity: 0 }],
      existingPrs: prs,
    });

    const matches = snap.conditions.flatMap((c) => c.matchingPrs);
    return matches.map((m) => ({
      prNumber: m.prNumber,
      requesterName: m.requesterName || 'Requester',
      requestedQuantity: m.existingQty,
      status: m.status,
      date: m.createdAt,
    }));
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
                  case 'SUBMIT': {
                    const res = this.submitPR(id, user);
                    if (!res.success) throw new Error(res.message);
                    break;
                  }
                  case 'APPROVE': this.approvePR(id, user.fullName, user.role, remarks); break;
                  case 'REJECT': this.rejectPR(id, user.fullName, remarks); break;
                  case 'RETURN': this.returnForCorrection(id, remarks, user.fullName); break;
                  case 'CANCEL': {
                    const res = this.cancelPR({
                      prId: id,
                      reason: remarks || 'Bulk Cancellation',
                      remarks: remarks || 'Bulk Cancelled via PR Register',
                      user,
                    });
                    if (!res.success) throw new Error(res.message);
                    break;
                  }
              }
              successes.push(pr.prNumber);
          } catch(e: any) {
              failures.push(`${pr.prNumber}: ${e?.message || 'Failed'}`);
          }
      });
      return { successes, failures };
  },

  /**
   * Requirement C.6, D & O: Returns Purchase Requisitions filtered strictly by the user's authorized Company and Branch scope.
   */
  getAuthorizedPurchaseRequisitions(
    user?: User,
    isCentralBuyerView: boolean = false
  ): PurchaseRequisitionHeader[] {
    const all = this.getPurchaseRequisitions();
    if (!user) return all;
    return all.filter(
      (pr) =>
        prGovernancePolicyService.validateUserCompanyBranchAccess(
          user,
          pr.companyId,
          pr.branchId,
          isCentralBuyerView
        ).allowed
    );
  },

  /**
   * Requirement G: Configurable Duplicate PR Prevention Evaluator
   */
  evaluateDuplicatePRRisk(params: {
    companyId: string;
    branchId: string;
    requesterId?: string;
    purchasePurpose?: string;
    expectedDeliveryDate?: string;
    lines: Array<{ itemCode: string; requestedQuantity: number }>;
    excludePrId?: string;
  }): {
    hasDuplicates: boolean;
    warningLevel: 'WARNING_WITH_JUSTIFICATION' | 'HARD_BLOCK' | 'ADVISORY_ONLY';
    requiresJustification: boolean;
    matches: Array<{
      prId: string;
      prNumber: string;
      itemCode: string;
      requesterName: string;
      existingQty: number;
      proposedQty: number;
      status: string;
      createdAt: string;
    }>;
  } {
    const eff = prGovernancePolicyService.getEffectivePolicy(params.companyId, params.branchId);
    const dupCfg = eff.duplicatePrevention;
    if (!dupCfg || !dupCfg.enableDuplicateDetection) {
      return {
        hasDuplicates: false,
        warningLevel: 'ADVISORY_ONLY',
        requiresJustification: false,
        matches: [],
      };
    }

    const prs = this.getPurchaseRequisitions();
    const snap = prDuplicateGovernanceService.evaluateDuplicateConditions({
      draftKey: `risk-eval-${params.excludePrId || 'new'}`,
      prId: params.excludePrId,
      companyId: params.companyId,
      branchId: params.branchId,
      requesterId: params.requesterId,
      purchasePurpose: params.purchasePurpose,
      expectedDeliveryDate: params.expectedDeliveryDate,
      lines: params.lines.map((l, idx) => ({
        id: `eval-line-${idx}`,
        itemCode: l.itemCode,
        requestedQuantity: l.requestedQuantity,
      })),
      existingPrs: prs,
    });

    const matches = snap.conditions.flatMap((c) =>
      c.matchingPrs.map((m) => ({
        prId: m.prId,
        prNumber: m.prNumber,
        itemCode: m.itemCode,
        requesterName: m.requesterName || 'Requester',
        existingQty: m.existingQty,
        proposedQty: m.proposedQty,
        status: m.status,
        createdAt: m.createdAt,
      }))
    );

    return {
      hasDuplicates: snap.hasDuplicates,
      warningLevel: dupCfg.warningLevel,
      requiresJustification: dupCfg.requireJustificationToProceed,
      matches,
    };
  },

  /**
   * Requirement E: Controlled Approved PR Line Amendment Process
   * - Never modifies converted lines!
   * - Never modifies approved PR headers through ordinary edit!
   * - Captures original and proposed line values, mandatory amendment reason, and routes for reapproval when required.
   */
  submitApprovedLineAmendment(params: {
    prId: string;
    lineId: string;
    amendmentReason: string;
    proposedValues: {
      itemCode?: string;
      description?: string;
      requestedQuantity?: number;
      approximateUnitPrice?: number;
      expectedDeliveryDate?: string;
      specifications?: string;
    };
    user: User;
    convertedQtyByLineId?: Record<string, number>;
  }): {
    success: boolean;
    message: string;
    requiresReapproval: boolean;
    amendment?: PRAmendmentRecord;
    pr?: PurchaseRequisitionHeader;
  } {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find((p) => p.id === params.prId);
    if (!pr) {
      throw new Error('Purchase Requisition not found.');
    }

    if (!params.amendmentReason || !params.amendmentReason.trim()) {
      throw new Error('Amendment Reason is mandatory for Approved PR Line Amendments.');
    }

    const eff = prGovernancePolicyService.getEffectivePolicy(pr.companyId, pr.branchId);
    const check = prGovernancePolicyService.evaluatePrAction({
      action: 'AMEND_APPROVED_PR_LINE',
      companyId: pr.companyId,
      branchId: pr.branchId,
      user: params.user,
      pr,
    });
    if (!check.allowed) {
      throw new Error(check.reason || 'Approved PR Line Amendment is not permitted.');
    }

    const line = pr.lines.find((l) => l.id === params.lineId);
    if (!line) {
      throw new Error(`Line ${params.lineId} not found on PR ${pr.prNumber}.`);
    }

    const convertedQty =
      params.convertedQtyByLineId?.[line.id] ??
      Number(line.convertedRfqQuantity || 0) + Number(line.convertedPoQuantity || 0);

    // Requirement E.9: Never modify converted lines!
    if (convertedQty > 0) {
      throw new Error(
        `Amendment Blocked: Line ${line.itemCode} has ${convertedQty} ${line.inventoryUom} converted into RFQ/PO and is permanently locked against amendment.`
      );
    }

    // Preserve original approved values on the line if not already snapshotted (Requirement E.7)
    line.originalApprovedQuantity = line.originalApprovedQuantity ?? line.requestedQuantity;
    line.originalApprovedUnitPrice = line.originalApprovedUnitPrice ?? line.approximateUnitPrice;
    line.originalApprovedItemCode = line.originalApprovedItemCode ?? line.itemCode;
    line.originalApprovedDeliveryDate =
      line.originalApprovedDeliveryDate ??
      line.deliverySchedules?.[0]?.deliveryDate ??
      pr.expectedDeliveryDate;

    const newItemCode = params.proposedValues.itemCode ?? line.itemCode;
    const newDescription = params.proposedValues.description ?? line.description;
    const newQty = Number(params.proposedValues.requestedQuantity ?? line.requestedQuantity);
    const newPrice = Number(
      params.proposedValues.approximateUnitPrice ?? line.approximateUnitPrice
    );
    const newTotal = newQty * newPrice;
    const newDelDate =
      params.proposedValues.expectedDeliveryDate ??
      line.deliverySchedules?.[0]?.deliveryDate ??
      pr.expectedDeliveryDate;
    const newSpecs = params.proposedValues.specifications ?? line.specifications;

    const oldTotal = Number(line.requestedQuantity) * Number(line.approximateUnitPrice);
    const tolPct = eff.editingAndLocking.amendmentPriceIncreaseTolerancePercent ?? 5;
    const pctIncrease = oldTotal > 0 ? ((newTotal - oldTotal) / oldTotal) * 100 : 100;

    // Requirement E.5: Determine whether amendment requires reapproval
    const requiresReapproval =
      eff.editingAndLocking.requireReapprovalOnApprovedLineEdit ||
      newItemCode !== line.itemCode ||
      pctIncrease > tolPct;

    const nowIso = new Date().toISOString();
    const amendmentNumber = (pr.amendmentHistory?.length || 0) + 1;

    const amendmentRecord: PRAmendmentRecord = {
      id: `amd-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      prId: pr.id,
      prNumber: pr.prNumber,
      lineId: line.id,
      itemCode: line.itemCode,
      amendmentNumber,
      amendmentReason: params.amendmentReason.trim(),
      requestedById: params.user.id,
      requestedByName: params.user.fullName,
      requestedAt: nowIso,
      requiresReapproval,
      status: requiresReapproval ? 'PENDING_REAPPROVAL' : 'APPROVED',
      approvedById: requiresReapproval ? undefined : params.user.id,
      approvedByName: requiresReapproval ? undefined : 'Auto-Approved (Within Policy Tolerance)',
      approvedAt: requiresReapproval ? undefined : nowIso,
      originalValues: {
        itemCode: line.itemCode,
        description: line.description,
        requestedQuantity: line.requestedQuantity,
        approximateUnitPrice: line.approximateUnitPrice,
        estimatedTotalValue: oldTotal,
        expectedDeliveryDate: line.originalApprovedDeliveryDate,
        specifications: line.specifications,
      },
      proposedValues: {
        itemCode: newItemCode,
        description: newDescription,
        requestedQuantity: newQty,
        approximateUnitPrice: newPrice,
        estimatedTotalValue: newTotal,
        expectedDeliveryDate: newDelDate,
        specifications: newSpecs,
      },
    };

    pr.amendmentHistory = [amendmentRecord, ...(pr.amendmentHistory || [])];

    if (requiresReapproval) {
      pr.status = 'PENDING_REAPPROVAL';
    } else {
      line.itemCode = newItemCode;
      line.description = newDescription;
      line.requestedQuantity = newQty;
      line.approvedQuantity = newQty;
      line.approximateUnitPrice = newPrice;
      line.estimatedTotalValue = newTotal;
      line.specifications = newSpecs;
      if (newDelDate && line.deliverySchedules?.length > 0) {
        line.deliverySchedules[0].deliveryDate = newDelDate;
      }
      pr.estimatedTotalValue = pr.lines.reduce(
        (sum, l) => sum + Number(l.requestedQuantity || 0) * Number(l.approximateUnitPrice || 0),
        0
      );
    }

    pr.modifiedBy = params.user.fullName;
    pr.updatedAt = nowIso;
    this.savePurchaseRequisitions(prs);

    EnterpriseAuditService.logEvent({
      companyId: pr.companyId,
      branchId: pr.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: pr.id,
      eventType: 'PR_LINE_AMENDMENT_SUBMITTED',
      eventDescription: `Submitted Amendment #${amendmentNumber} for unconverted line ${line.itemCode} on ${pr.prNumber} (Requires Reapproval: ${requiresReapproval})`,
      previousValue: amendmentRecord.originalValues,
      newValue: amendmentRecord.proposedValues,
      changedByUserId: params.user.id,
      changedByName: params.user.fullName,
      changeReason: params.amendmentReason.trim(),
      relatedPrId: pr.id,
    });

    return {
      success: true,
      message: requiresReapproval
        ? `Amendment #${amendmentNumber} recorded and routed to PENDING_REAPPROVAL.`
        : `Amendment #${amendmentNumber} applied while preserving original approved values.`,
      requiresReapproval,
      amendment: amendmentRecord,
      pr,
    };
  },

  approveLineAmendment(params: {
    prId: string;
    amendmentId: string;
    approver: User;
    remarks?: string;
  }): PurchaseRequisitionHeader {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find((p) => p.id === params.prId);
    if (!pr) throw new Error('Purchase Requisition not found.');

    const amd = pr.amendmentHistory?.find((a) => a.id === params.amendmentId);
    if (!amd) throw new Error('Amendment record not found.');
    if (amd.status !== 'PENDING_REAPPROVAL') {
      throw new Error(`Amendment is already in status ${amd.status}.`);
    }

    const line = pr.lines.find((l) => l.id === amd.lineId);
    if (!line) throw new Error('Target PR line not found.');

    const nowIso = new Date().toISOString();
    amd.status = 'APPROVED';
    amd.approvedById = params.approver.id;
    amd.approvedByName = params.approver.fullName;
    amd.approvedAt = nowIso;
    amd.approvalRemarks = params.remarks || 'Amendment approved';

    // Apply proposed values while keeping originalApproved* fields intact
    line.itemCode = amd.proposedValues.itemCode;
    line.description = amd.proposedValues.description;
    line.requestedQuantity = amd.proposedValues.requestedQuantity;
    line.approvedQuantity = amd.proposedValues.requestedQuantity;
    line.approximateUnitPrice = amd.proposedValues.approximateUnitPrice;
    line.estimatedTotalValue = amd.proposedValues.estimatedTotalValue;
    line.specifications = amd.proposedValues.specifications;

    pr.estimatedTotalValue = pr.lines.reduce(
      (sum, l) => sum + Number(l.requestedQuantity || 0) * Number(l.approximateUnitPrice || 0),
      0
    );

    const anyPendingAmendments = (pr.amendmentHistory || []).some(
      (a) => a.status === 'PENDING_REAPPROVAL'
    );
    if (!anyPendingAmendments) {
      pr.status = 'APPROVED_PENDING_BUYER';
    }

    pr.modifiedBy = params.approver.fullName;
    pr.updatedAt = nowIso;
    this.savePurchaseRequisitions(prs);

    EnterpriseAuditService.logEvent({
      companyId: pr.companyId,
      branchId: pr.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: pr.id,
      eventType: 'PR_LINE_AMENDMENT_APPROVED',
      eventDescription: `Approved Amendment #${amd.amendmentNumber} for line ${amd.itemCode} on ${pr.prNumber}`,
      previousValue: amd.originalValues,
      newValue: amd.proposedValues,
      changedByUserId: params.approver.id,
      changedByName: params.approver.fullName,
      changeReason: params.remarks || 'Amendment approved',
      relatedPrId: pr.id,
    });

    return pr;
  },

  /**
   * Requirement H: Supporting Documents & Versioned Attachment Governance
   */
  uploadPRAttachment(params: {
    prId: string;
    lineId?: string; // If provided, attaches to specific line; otherwise header attachment
    fileName: string;
    fileSizeBytes: number;
    fileType: string;
    category?: PRAttachmentRecord['category'];
    user: User;
  }): PRAttachmentRecord {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find((p) => p.id === params.prId);
    if (!pr) throw new Error('Purchase Requisition not found.');

    const eff = prGovernancePolicyService.getEffectivePolicy(pr.companyId, pr.branchId);
    const attCfg = eff.attachmentGovernance;

    const ext = (
      params.fileType ||
      params.fileName.split('.').pop() ||
      ''
    )
      .replace('.', '')
      .toUpperCase();

    if (
      attCfg?.allowedFileTypes &&
      attCfg.allowedFileTypes.length > 0 &&
      !attCfg.allowedFileTypes.includes(ext)
    ) {
      throw new Error(
        `Attachment File Type Rejected: '${ext}' is not in allowed types [${attCfg.allowedFileTypes.join(', ')}].`
      );
    }

    const maxBytes = (attCfg?.maxFileSizeMb || 25) * 1024 * 1024;
    if (params.fileSizeBytes > maxBytes) {
      throw new Error(
        `Attachment File Size Rejected: File exceeds maximum permitted size of ${attCfg?.maxFileSizeMb || 25} MB.`
      );
    }

    const nowIso = new Date().toISOString();
    const isApprovedState = [
      'APPROVED_PENDING_BUYER',
      'PENDING_BUYER_CONFIGURATION',
      'COMPLETED',
    ].includes(pr.status);

    let targetList: PRAttachmentRecord[];
    if (params.lineId) {
      const line = pr.lines.find((l) => l.id === params.lineId);
      if (!line) throw new Error('PR Line not found for attachment.');
      if (!line.lineAttachments) line.lineAttachments = [];
      targetList = line.lineAttachments;
    } else {
      if (!pr.attachments) pr.attachments = [];
      targetList = pr.attachments;
    }

    // Requirement H.4: Retain historical attachment versions for approved transactions
    const sameNameAttachments = targetList.filter((a) => a.fileName === params.fileName);
    if (sameNameAttachments.length > 0 && isApprovedState) {
      sameNameAttachments.forEach((a) => {
        a.isHistoricalApprovedVersion = true;
      });
    }
    const nextVersion = sameNameAttachments.length + 1;

    const newAtt: PRAttachmentRecord = {
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      fileName: params.fileName,
      fileSize: params.fileSizeBytes,
      fileType: ext,
      category: params.category || 'GENERAL',
      versionNumber: nextVersion,
      isHistoricalApprovedVersion: false,
      lockedForConvertedTransaction: false,
      uploadedAt: nowIso,
      uploadedBy: params.user.fullName,
      auditHistory: [
        {
          id: `aud-att-${Date.now()}`,
          action: nextVersion > 1 ? 'NEW_VERSION_ADDED' : 'UPLOADED',
          actorId: params.user.id,
          actorName: params.user.fullName,
          timestamp: nowIso,
          remarks: `Uploaded ${params.fileName} (v${nextVersion})`,
        },
      ],
    };

    targetList.push(newAtt);
    this.savePurchaseRequisitions(prs);
    return newAtt;
  },

  downloadPRAttachment(params: {
    prId: string;
    attachmentId: string;
    lineId?: string;
    user: User;
  }): PRAttachmentRecord {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find((p) => p.id === params.prId);
    if (!pr) throw new Error('Purchase Requisition not found.');

    const list = params.lineId
      ? pr.lines.find((l) => l.id === params.lineId)?.lineAttachments || []
      : pr.attachments || [];

    const att = list.find((a) => a.id === params.attachmentId);
    if (!att) throw new Error('Attachment not found.');

    const nowIso = new Date().toISOString();
    att.auditHistory = [
      ...(att.auditHistory || []),
      {
        id: `aud-dl-${Date.now()}`,
        action: 'DOWNLOADED',
        actorId: params.user.id,
        actorName: params.user.fullName,
        timestamp: nowIso,
        remarks: `Downloaded by ${params.user.fullName}`,
      },
    ];
    this.savePurchaseRequisitions(prs);
    return att;
  },

  deletePRAttachment(params: {
    prId: string;
    attachmentId: string;
    lineId?: string;
    user: User;
  }): { deleted: boolean; message: string } {
    const prs = this.getPurchaseRequisitions();
    const pr = prs.find((p) => p.id === params.prId);
    if (!pr) throw new Error('Purchase Requisition not found.');

    // Requirement H.5: Prevent unauthorized deletion of attachments linked to converted or approved transactions!
    const hasConvertedLines = pr.lines.some(
      (l) => Number(l.convertedRfqQuantity || 0) + Number(l.convertedPoQuantity || 0) > 0
    );
    const isApprovedOrConverted =
      hasConvertedLines ||
      ['APPROVED_PENDING_BUYER', 'PENDING_BUYER_CONFIGURATION', 'COMPLETED'].includes(pr.status);

    const targetList = params.lineId
      ? pr.lines.find((l) => l.id === params.lineId)?.lineAttachments || []
      : pr.attachments || [];
    const targetAtt = targetList.find((a) => a.id === params.attachmentId);

    if (
      isApprovedOrConverted ||
      targetAtt?.isHistoricalApprovedVersion ||
      targetAtt?.lockedForConvertedTransaction ||
      Boolean(targetAtt?.immutablePdfId)
    ) {
      throw new Error(
        `Attachment Deletion Blocked: Attachments linked to Approved, Converted, or Immutable Repository PR transactions (${pr.prNumber}) are permanently retained for audit integrity.`
      );
    }

    if (params.lineId) {
      const line = pr.lines.find((l) => l.id === params.lineId);
      if (line && line.lineAttachments) {
        line.lineAttachments = line.lineAttachments.filter((a) => a.id !== params.attachmentId);
      }
    } else {
      pr.attachments = (pr.attachments || []).filter((a) => a.id !== params.attachmentId);
    }

    this.savePurchaseRequisitions(prs);
    return { deleted: true, message: 'Attachment removed from draft/unapproved PR.' };
  },

  /**
   * Requirement J: Controlled Bulk Processing (Pre-Validation & Per-Record Execution)
   */
  previewBulkPrAction(params: {
    prIds: string[];
    action: 'SUBMIT' | 'APPROVE' | 'RETURN' | 'SHORT_CLOSE' | 'CANCEL';
    user: User;
  }): {
    eligibleRecords: Array<{ prId: string; prNumber: string; companyCode: string; branchName: string; status: PRStatus }>;
    ineligibleRecords: Array<{ prId: string; prNumber: string; status?: PRStatus; reason: string }>;
  } {
    const prs = this.getPurchaseRequisitions();
    const eligibleRecords: Array<{
      prId: string;
      prNumber: string;
      companyCode: string;
      branchName: string;
      status: PRStatus;
    }> = [];
    const ineligibleRecords: Array<{
      prId: string;
      prNumber: string;
      status?: PRStatus;
      reason: string;
    }> = [];

    const actionMap: Record<
      typeof params.action,
      'SUBMIT_PR' | 'APPROVE_PR' | 'RETURN_FOR_CORRECTION' | 'SHORT_CLOSE_PR' | 'CANCEL_PR'
    > = {
      SUBMIT: 'SUBMIT_PR',
      APPROVE: 'APPROVE_PR',
      RETURN: 'RETURN_FOR_CORRECTION',
      SHORT_CLOSE: 'SHORT_CLOSE_PR',
      CANCEL: 'CANCEL_PR',
    };

    for (const id of params.prIds) {
      const pr = prs.find((p) => p.id === id);
      if (!pr) {
        ineligibleRecords.push({
          prId: id,
          prNumber: id,
          reason: 'Purchase Requisition record not found.',
        });
        continue;
      }

      const check = prGovernancePolicyService.evaluatePrAction({
        action: actionMap[params.action],
        companyId: pr.companyId,
        branchId: pr.branchId,
        user: params.user,
        pr,
      });

      if (!check.allowed) {
        ineligibleRecords.push({
          prId: pr.id,
          prNumber: pr.prNumber,
          status: pr.status,
          reason: check.reason || `Not eligible for ${params.action}.`,
        });
        continue;
      }

      // Check line-level conversion restrictions for CANCEL or SHORT_CLOSE
      if (params.action === 'CANCEL') {
        const hasUnconvertedLine = pr.lines.some(
          (l) =>
            Number(l.convertedRfqQuantity || 0) + Number(l.convertedPoQuantity || 0) === 0 &&
            l.status !== 'CANCELLED' &&
            l.status !== 'SHORT_CLOSED'
        );
        if (!hasUnconvertedLine) {
          ineligibleRecords.push({
            prId: pr.id,
            prNumber: pr.prNumber,
            status: pr.status,
            reason: 'All lines are converted or already closed; converted lines cannot be cancelled.',
          });
          continue;
        }
      }

      eligibleRecords.push({
        prId: pr.id,
        prNumber: pr.prNumber,
        companyCode: pr.companyCode,
        branchName: pr.branchName,
        status: pr.status,
      });
    }

    return { eligibleRecords, ineligibleRecords };
  },

  executeBulkPrAction(params: {
    prIds: string[];
    action: 'SUBMIT' | 'APPROVE' | 'RETURN' | 'SHORT_CLOSE' | 'CANCEL';
    reason: string;
    remarks: string;
    user: User;
  }): {
    overallOutcome: 'COMPLETE_SUCCESS' | 'PARTIAL_FAILURE' | 'ALL_FAILED';
    succeeded: Array<{ prId: string; prNumber: string; message: string }>;
    failed: Array<{ prId: string; prNumber: string; reason: string }>;
    skipped: Array<{ prId: string; prNumber: string; reason: string }>;
  } {
    const preview = this.previewBulkPrAction({
      prIds: params.prIds,
      action: params.action,
      user: params.user,
    });

    const succeeded: Array<{ prId: string; prNumber: string; message: string }> = [];
    const failed: Array<{ prId: string; prNumber: string; reason: string }> = [];
    const skipped = preview.ineligibleRecords.map((r) => ({
      prId: r.prId,
      prNumber: r.prNumber,
      reason: r.reason,
    }));

    for (const elig of preview.eligibleRecords) {
      try {
        if (params.action === 'SUBMIT') {
          const res = this.submitPR(elig.prId, params.user);
          if (!res.success) throw new Error(res.message);
          succeeded.push({ prId: elig.prId, prNumber: elig.prNumber, message: res.message });
        } else if (params.action === 'APPROVE') {
          const pr = this.approvePR(
            elig.prId,
            params.user.fullName,
            params.user.role,
            params.remarks || params.reason || 'Bulk Approved',
            { actorUser: params.user }
          );
          if (!pr) throw new Error('Approval failed.');
          succeeded.push({
            prId: elig.prId,
            prNumber: elig.prNumber,
            message: `Approved (${pr.status})`,
          });
        } else if (params.action === 'RETURN') {
          const pr = this.returnForCorrection(
            elig.prId,
            params.reason || params.remarks || 'Returned for correction',
            params.user.fullName
          );
          if (!pr) throw new Error('Return for correction failed.');
          succeeded.push({
            prId: elig.prId,
            prNumber: elig.prNumber,
            message: 'Returned for Correction',
          });
        } else if (params.action === 'SHORT_CLOSE') {
          const res = this.shortClosePR({
            prId: elig.prId,
            reason: params.reason || 'Bulk Short Close',
            remarks: params.remarks || 'Bulk Short Close executed by authorized user',
            user: params.user,
          });
          if (!res.success) throw new Error(res.message);
          succeeded.push({ prId: elig.prId, prNumber: elig.prNumber, message: res.message });
        } else if (params.action === 'CANCEL') {
          const res = this.cancelPR({
            prId: elig.prId,
            reason: params.reason || 'Bulk Cancellation',
            remarks: params.remarks || 'Bulk Cancellation executed by authorized user',
            user: params.user,
          });
          if (!res.success) throw new Error(res.message);
          succeeded.push({ prId: elig.prId, prNumber: elig.prNumber, message: res.message });
        }
      } catch (err: any) {
        failed.push({
          prId: elig.prId,
          prNumber: elig.prNumber,
          reason: err?.message || 'Execution error',
        });
      }
    }

    const totalFailuresOrSkips = failed.length + skipped.length;
    const overallOutcome =
      succeeded.length > 0 && totalFailuresOrSkips === 0
        ? 'COMPLETE_SUCCESS'
        : succeeded.length > 0 && totalFailuresOrSkips > 0
        ? 'PARTIAL_FAILURE'
        : 'ALL_FAILED';

    return {
      overallOutcome,
      succeeded,
      failed,
      skipped,
    };
  },

  /**
   * Requirement O: Consolidated Security-Scoped PR Governance & Financial Report
   */
  generateConsolidatedPrReport(params?: {
    user?: User;
    companyId?: string;
    branchId?: string;
    department?: string;
    prType?: PRType | 'ALL';
    status?: PRStatus | 'ALL';
    currency?: string;
    financialPeriod?: string;
  }): {
    totalPrCount: number;
    metricsByCurrency: Array<{
      currency: string;
      prCount: number;
      originalPrValue: number;
      approvedValue: number;
      rfqConvertedValue: number;
      poConvertedValue: number;
      outstandingRequirementValue: number;
      shortClosedValue: number;
      cancelledValue: number;
      reservedBudget: number;
      releasedBudget: number;
      outstandingCommitments: number;
    }>;
    companyReportingSummary: {
      reportingCurrency: string;
      totalOriginalValueReporting: number;
      totalReservedBudgetReporting: number;
      totalReleasedBudgetReporting: number;
      totalOutstandingCommitmentsReporting: number;
    };
    averageApprovalAgeingDays: number;
    buyerWorkload: Array<{ buyerName: string; assignedLineCount: number; pendingValueInr: number }>;
    records: PurchaseRequisitionHeader[];
  } {
    let prs = this.getAuthorizedPurchaseRequisitions(params?.user);

    if (params?.companyId && params.companyId !== 'ALL') {
      const normComp = normalizeCompanyId(params.companyId);
      prs = prs.filter((p) => normalizeCompanyId(p.companyId) === normComp);
    }
    if (params?.branchId && params.branchId !== 'ALL') {
      const normBr = normalizeBranchId(params.branchId);
      prs = prs.filter((p) => normalizeBranchId(p.branchId) === normBr);
    }
    if (params?.department && params.department !== 'ALL') {
      prs = prs.filter((p) => p.department === params.department);
    }
    if (params?.prType && params.prType !== 'ALL') {
      prs = prs.filter((p) => p.prType === params.prType);
    }
    if (params?.status && params.status !== 'ALL') {
      prs = prs.filter((p) => p.status === params.status);
    }
    if (params?.currency && params.currency !== 'ALL') {
      prs = prs.filter((p) => (p.currency || 'INR').toUpperCase() === params.currency!.toUpperCase());
    }
    if (params?.financialPeriod && params.financialPeriod !== 'ALL') {
      prs = prs.filter((p) => (p.financialPeriod || '2026') === params.financialPeriod);
    }

    const currencyMap = new Map<
      string,
      {
        currency: string;
        prCount: number;
        originalPrValue: number;
        approvedValue: number;
        rfqConvertedValue: number;
        poConvertedValue: number;
        outstandingRequirementValue: number;
        shortClosedValue: number;
        cancelledValue: number;
        reservedBudget: number;
        releasedBudget: number;
        outstandingCommitments: number;
      }
    >();

    let totalOriginalValueReporting = 0;
    let totalReservedBudgetReporting = 0;
    let totalReleasedBudgetReporting = 0;
    let totalOutstandingCommitmentsReporting = 0;
    let totalAgeingDays = 0;
    let pendingCount = 0;
    const buyerMap = new Map<string, { assignedLineCount: number; pendingValueInr: number }>();

    for (const pr of prs) {
      const curr = (pr.currency || 'INR').toUpperCase();
      if (!currencyMap.has(curr)) {
        currencyMap.set(curr, {
          currency: curr,
          prCount: 0,
          originalPrValue: 0,
          approvedValue: 0,
          rfqConvertedValue: 0,
          poConvertedValue: 0,
          outstandingRequirementValue: 0,
          shortClosedValue: 0,
          cancelledValue: 0,
          reservedBudget: 0,
          releasedBudget: 0,
          outstandingCommitments: 0,
        });
      }
      const bucket = currencyMap.get(curr)!;
      bucket.prCount += 1;
      bucket.originalPrValue += Number(pr.estimatedTotalValue || 0);

      const isApproved = [
        'APPROVED_PENDING_BUYER',
        'PENDING_BUYER_CONFIGURATION',
        'COMPLETED',
        'SHORT_CLOSED',
      ].includes(pr.status);
      if (isApproved) {
        bucket.approvedValue += Number(pr.estimatedTotalValue || 0);
      }

      const recon = prGovernancePolicyService.calculateBudgetReconciliation(pr);
      bucket.reservedBudget += recon.originalReservation;
      bucket.releasedBudget += recon.previouslyReleasedAmount;
      bucket.outstandingCommitments += recon.validOutstandingCommitments;

      totalOriginalValueReporting += recon.originalReservationReportingCurrency;
      totalReservedBudgetReporting += recon.originalReservationReportingCurrency;
      totalReleasedBudgetReporting += recon.previouslyReleasedReportingCurrency;
      totalOutstandingCommitmentsReporting += recon.validCommitmentsReportingCurrency;

      if (
        ['PENDING_MANAGER_APPROVAL', 'PENDING_SUBSEQUENT_APPROVAL', 'PENDING_REAPPROVAL'].includes(
          pr.status
        )
      ) {
        const ageDays = Math.max(
          0,
          Math.floor((Date.now() - new Date(pr.createdAt).getTime()) / 86400000)
        );
        totalAgeingDays += ageDays;
        pendingCount += 1;
      }

      for (const line of pr.lines) {
        const unitPrice = Number(line.approximateUnitPrice) || 0;
        const rfqQty = Number(line.convertedRfqQuantity) || 0;
        const poQty = Number(line.convertedPoQuantity) || 0;
        const scQty = Number(line.shortClosedQuantity) || 0;
        const canQty =
          line.status === 'CANCELLED'
            ? Number(line.requestedQuantity) - rfqQty - poQty
            : Number(line.cancelledQuantity) || 0;
        const remQty = Math.max(0, Number(line.requestedQuantity) - rfqQty - poQty - scQty - canQty);

        bucket.rfqConvertedValue += rfqQty * unitPrice;
        bucket.poConvertedValue += poQty * unitPrice;
        bucket.shortClosedValue += scQty * unitPrice;
        bucket.cancelledValue += canQty * unitPrice;
        bucket.outstandingRequirementValue += remQty * unitPrice;

        const buyer = line.assignedBuyer || 'Unassigned Pool';
        const bEntry = buyerMap.get(buyer) || { assignedLineCount: 0, pendingValueInr: 0 };
        bEntry.assignedLineCount += 1;
        bEntry.pendingValueInr += remQty * unitPrice * recon.exchangeRateUsed;
        buyerMap.set(buyer, bEntry);
      }
    }

    return {
      totalPrCount: prs.length,
      metricsByCurrency: Array.from(currencyMap.values()),
      companyReportingSummary: {
        reportingCurrency: 'INR',
        totalOriginalValueReporting: Number(totalOriginalValueReporting.toFixed(2)),
        totalReservedBudgetReporting: Number(totalReservedBudgetReporting.toFixed(2)),
        totalReleasedBudgetReporting: Number(totalReleasedBudgetReporting.toFixed(2)),
        totalOutstandingCommitmentsReporting: Number(
          totalOutstandingCommitmentsReporting.toFixed(2)
        ),
      },
      averageApprovalAgeingDays:
        pendingCount > 0 ? Number((totalAgeingDays / pendingCount).toFixed(1)) : 0,
      buyerWorkload: Array.from(buyerMap.entries()).map(([buyerName, stats]) => ({
        buyerName,
        assignedLineCount: stats.assignedLineCount,
        pendingValueInr: Number(stats.pendingValueInr.toFixed(2)),
      })),
      records: prs,
    };
  },

  /**
   * SAP B1 HANA / Downstream Transaction Creation Gate:
   * Blocks SAP PR/RFQ/PO transaction creation unless all mandatory governance,
   * PR Type category mappings, configured multi-level approvals, duplicate overrides,
   * and (when ON) budget checks are satisfied.
   */
  validateSapB1TransactionReadiness(prOrId: string | PurchaseRequisitionHeader): {
    ready: boolean;
    blockingReasons: string[];
    pr?: PurchaseRequisitionHeader;
  } {
    const pr =
      typeof prOrId === 'string'
        ? this.getPurchaseRequisitions().find((p) => p.id === prOrId || p.prNumber === prOrId)
        : prOrId;

    if (!pr) {
      return { ready: false, blockingReasons: ['Purchase Requisition not found.'] };
    }

    const blockingReasons: string[] = [];
    const eff = prGovernancePolicyService.getEffectivePolicy(pr.companyId, pr.branchId);
    const workflowPlan = prGovernancePolicyService.resolveApprovalWorkflowPlan(pr, eff);
    const txDocDate = (pr.createdAt || new Date().toISOString()).slice(0, 10);

    if (!isPrStatusApproved(pr.status)) {
      blockingReasons.push(
        `PR ${pr.prNumber} is in status '${pr.status}' and has not completed mandatory approval workflow.`
      );
    }

    if (workflowPlan.enabled) {
      const currentCycle = pr.approvalCycleCount || 1;
      const approvalCount = (pr.approvalHistory || []).filter(
        (h) =>
          (h.cycleNumber || 1) === currentCycle &&
          (h.decision === 'APPROVED' || h.decision === 'DELEGATED_APPROVAL')
      ).length;
      if (approvalCount < workflowPlan.requiredLevels && !isPrStatusApproved(pr.status)) {
        blockingReasons.push(
          `Approval matrix requires ${workflowPlan.requiredLevels} level(s) for reporting value ${workflowPlan.reportingCurrency} ${workflowPlan.valuationReportingAmount}; only ${approvalCount} completed.`
        );
      }
    }

    const conflictCheck = expenseCategoryService.detectClassificationConflict({
      prType: pr.prType,
      lines: pr.lines,
      expenseLines: pr.expenseLines,
      chargeItems: pr.chargeItems,
    });
    if (conflictCheck.hasConflict) {
      blockingReasons.push(...conflictCheck.conflicts);
    }

    if (pr.prType === 'EXPENSE') {
      const expVal = expenseCategoryService.validateExpenseLinesForPr({
        companyId: pr.companyId,
        branchId: pr.branchId,
        department: pr.department,
        userId: pr.requesterId,
        expenseLines: pr.expenseLines || [],
        headerCostCentre: pr.costCentre,
        headerExpectedServiceDate: pr.expectedServiceDate || pr.expectedDeliveryDate || pr.requiredBy,
        headerBusinessJustification: pr.businessJustification,
        asOfDate: txDocDate,
      });
      if (!expVal.valid) {
        blockingReasons.push(...expVal.errors);
      }
    } else {
      const chargeDup = prChargeItemService.validateHeaderAndLineChargeDuplicates(
        pr.chargeItems,
        pr.lines,
        Boolean(eff.activation.allowSameChargeAtHeaderAndLine)
      );
      if (!chargeDup.valid) {
        blockingReasons.push(...chargeDup.conflicts);
      }
      if ((pr.lines || []).length > 0) {
        const catVal = prTypeMasterService.validateLinesCategoriesForPrType({
          companyId: pr.companyId,
          branchId: pr.branchId,
          purchaseOrgId: pr.purchaseOrganizationId || pr.purchaseOrgId,
          prTypeCode: pr.prType,
          lines: pr.lines,
          evaluationDate: txDocDate,
        });
        if (!catVal.valid) {
          blockingReasons.push(
            catVal.prTypeReason ||
              catVal.invalidLines[0]?.reason ||
              'PR contains line categories incompatible with selected PR Type.'
          );
        }
      }
    }

    if (prGovernancePolicyService.isBudgetValidationEnabled(pr.companyId, pr.branchId, txDocDate)) {
      if (
        eff.budget.mandatoryBudgetCheck &&
        pr.budgetValidationStatus !== 'SUFFICIENT' &&
        pr.budgetValidationStatus !== 'EXCEPTION_APPROVED'
      ) {
        blockingReasons.push(
          `Budget validation is enabled and mandatory, but status is '${pr.budgetValidationStatus}'.`
        );
      }
    }

    if (pr.duplicateGovernance && !pr.duplicateGovernance.submissionEligible) {
      blockingReasons.push(
        'Duplicate PR governance override authorization is still pending or blocked.'
      );
    }

    return {
      ready: blockingReasons.length === 0,
      blockingReasons,
      pr,
    };
  },
};




