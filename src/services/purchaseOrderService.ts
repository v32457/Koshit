/**
 * KOSH INNOVATIONS — PURCHASE ORDER & VENDOR ALLOCATION SERVICE
 * Automatically retrieves approved prices (RFQ Award vs Price Book),
 * calculates multi-vendor split allocations, manages buyer/approver overrides,
 * and tracks PO release & approval history.
 */

import {
  PurchaseOrderHeader,
  PurchaseOrderLine,
  PoVendorAllocationProposal,
} from '../types/rfqSourcing';
import {
  DirectPoReasonCode,
  RfqRequirementStatusOnPo,
  RfqExemptionApprovalRecord,
  BlockedDirectPoAttemptLog,
} from '../types/procurementFinanceGovernance';
import { INITIAL_BUSINESS_PARTNERS } from '../data/seedData';
import { rfqPolicyService } from './rfqPolicyService';
import { vendorPriceRegisterService } from './vendorPriceRegisterService';
import { purchasePriceBookService } from './purchasePriceBookService';
import { uomConversionService } from './uomConversionService';
import { inventoryValidationService } from './inventoryValidationService';
import { budgetControlService } from './budgetControlService';
import { financialYearService } from './financialYearService';
import { EnterpriseAuditService } from './enterpriseAuditService';
import { PurchaseRequisitionService } from './purchaseRequisitionService';

const STORAGE_KEY_POS = 'kosh_purchase_orders_v1';
const STORAGE_KEY_RFQ_EXEMPTIONS = 'kosh_rfq_exemption_approvals_v1';
const STORAGE_KEY_BLOCKED_DIRECT_POS = 'kosh_blocked_direct_po_attempts_v1';

export const DIRECT_PO_REASON_OPTIONS: Array<{
  code: DirectPoReasonCode;
  label: string;
  requiresMandatoryJustification: boolean;
}> = [
  { code: 'APPROVED_SINGLE_SOURCE', label: 'Approved Single-Source Supplier', requiresMandatoryJustification: true },
  { code: 'EMERGENCY_PROCUREMENT', label: 'Emergency Breakdown / Critical Procurement', requiresMandatoryJustification: true },
  { code: 'PROPRIETARY_ITEM', label: 'Proprietary / OEM Exclusive Item', requiresMandatoryJustification: true },
  { code: 'EXISTING_CONTRACT', label: 'Existing Active Master Supply Contract', requiresMandatoryJustification: true },
  { code: 'RATE_CONTRACT', label: 'Approved Rate Contract / Price Book', requiresMandatoryJustification: true },
  { code: 'APPROVED_BLANKET_PO', label: 'Approved Blanket PO Call-Off', requiresMandatoryJustification: true },
  { code: 'REGULATORY_REQUIREMENT', label: 'Statutory / Regulatory Compliance Mandate', requiresMandatoryJustification: true },
  { code: 'APPROVED_EXCEPTION', label: 'Authorized Management Exception', requiresMandatoryJustification: true },
  { code: 'OTHER_AUTHORIZED_REASON', label: 'Other Authorized Reason (Justification Required)', requiresMandatoryJustification: true },
];

export const INITIAL_POS: PurchaseOrderHeader[] = [
  {
    id: 'po-001',
    poNumber: 'PO-2026-0001',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Main Plant & HQ',
    purchaseOrgId: 'po-kosh-01',
    department: 'Production',
    costCentre: 'CC-PROD-101',
    vendorId: 'bp-002',
    vendorCode: 'VEND-BASF-01',
    vendorName: 'BASF INDIA LIMITED',
    poDate: '2026-11-10',
    paymentTerms: 'NET 60 Days',
    incoterms: 'DDP Puducherry Plant',
    deliveryAddress: 'CS-46&47, PIPDIC Industrial Estate, Mettupalayam, Puducherry - 605009',
    buyerId: 'usr-buyer-01',
    buyerName: 'Vikram Singh',
    purchasingManagerId: 'usr-checker-03',
    purchasingManagerName: 'Venkatesh Iyer',
    totalNetValue: 81600,
    totalTaxValue: 14688,
    totalGrossValue: 96288,
    currency: 'INR',
    priceSourceMode: 'RFQ_AWARD',
    status: 'PENDING_APPROVAL',
    hasOverride: true,
    overrideJustification: 'Adjusted allocation from 50/50 to 60/40 in favor of BASF due to urgent production delivery requirement at Puducherry Plant.',
    isDirectPo: false,
    procurementPolicyRef: 'pol-co-01 (RFQ_ENABLED)',
    rfqRequirementStatus: 'RFQ_MANDATORY_COMPLETED',
    supplierEligibilityVerified: true,
    allocationProposals: [
      {
        itemCode: 'RMPAOPOEXLG0001',
        purchaseUom: 'BAG',
        totalRequiredQtyPurchUom: 20,
        priceSource: 'APPROVED_RFQ_AWARD',
        vendorAllocations: [
          {
            vendorId: 'bp-002',
            vendorCode: 'VEND-BASF-01',
            vendorName: 'BASF INDIA LIMITED',
            originalAllocationPercent: 50,
            originalQtyPurchUom: 10,
            proposedAllocationPercent: 60,
            proposedQtyPurchUom: 12,
            unitPricePurchUom: 6800,
            lineTotalValue: 81600,
            priceAgreementRef: 'VPA-2026-0001',
          },
          {
            vendorId: 'bp-003',
            vendorCode: 'VEND-POLY-02',
            vendorName: 'POLYMER SOLUTIONS INDIA LTD',
            originalAllocationPercent: 50,
            originalQtyPurchUom: 10,
            proposedAllocationPercent: 40,
            proposedQtyPurchUom: 8,
            unitPricePurchUom: 7000,
            lineTotalValue: 56000,
            priceAgreementRef: 'VPA-2026-0002',
          },
        ],
        overrideApplied: true,
        overrideJustification: 'Adjusted allocation from 50/50 to 60/40 in favor of BASF due to urgent production delivery requirement at Puducherry Plant.',
        overrideProposedBy: 'Vikram Singh (Senior Procurement Officer)',
      },
    ],
    lines: [
      {
        id: 'pol-001',
        poId: 'po-001',
        itemCode: 'RMPAOPOEXLG0001',
        description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
        itemCategory: 'Raw Materials',
        purchaseUom: 'BAG',
        inventoryUom: 'KG',
        conversionRatio: 25,
        orderQtyPurchUom: 12, // 12 BAGS (300 KG)
        orderQtyInvUom: 300,
        unitPricePurchUom: 6800,
        currency: 'INR',
        netAmount: 81600,
        gstPercent: 18,
        gstAmount: 14688,
        totalAmount: 96288,
        prNumberRef: 'PR-2026-0001',
        rfqNumberRef: 'RFQ-2026-0001',
        priceAgreementRef: 'VPA-2026-0001',
        deliveryDate: '2026-11-25',
        receivedQtyPurchUom: 0,
        receivedQtyInvUom: 0,
        status: 'OPEN',
      },
    ],
    createdAt: '2026-11-10T11:00:00Z',
    updatedAt: '2026-11-10T11:00:00Z',
  },
];

export const HISTORICAL_SEED_POS: PurchaseOrderHeader[] = [
  {
    id: 'po-fy25-001',
    poNumber: 'PO-2025-0074',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Main Plant & HQ',
    purchaseOrgId: 'po-kosh-01',
    department: 'Production',
    costCentre: 'CC-PROD-101',
    vendorId: 'bp-002',
    vendorCode: 'VEND-BASF-01',
    vendorName: 'BASF INDIA LIMITED',
    poDate: '2026-01-18',
    accountingPostingDate: '2026-01-18',
    financialYearId: 'fy-co-kosh-01-2025-26',
    financialYearCode: 'FY 2025-26',
    accountingPeriodCode: '2026-01',
    paymentTerms: 'NET 60 Days',
    incoterms: 'DDP Puducherry Plant',
    deliveryAddress: 'CS-46&47, PIPDIC Industrial Estate, Mettupalayam, Puducherry - 605009',
    buyerId: 'usr-buyer-01',
    buyerName: 'Vikram Singh',
    purchasingManagerId: 'usr-checker-03',
    purchasingManagerName: 'Venkatesh Iyer',
    totalNetValue: 204000,
    totalTaxValue: 36720,
    totalGrossValue: 240720,
    currency: 'INR',
    priceSourceMode: 'RFQ_AWARD',
    status: 'RELEASED',
    allocationProposals: [],
    hasOverride: false,
    isDirectPo: false,
    procurementPolicyRef: 'pol-co-01 (RFQ_ENABLED)',
    rfqRequirementStatus: 'RFQ_MANDATORY_COMPLETED',
    supplierEligibilityVerified: true,
    lines: [
      {
        id: 'pol-fy25-001',
        poId: 'po-fy25-001',
        itemCode: 'RMPAOPOEXLG0001',
        description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
        itemCategory: 'Raw Materials',
        purchaseUom: 'BAG',
        inventoryUom: 'KG',
        conversionRatio: 25,
        orderQtyPurchUom: 30,
        orderQtyInvUom: 750,
        unitPricePurchUom: 6800,
        currency: 'INR',
        netAmount: 204000,
        gstPercent: 18,
        gstAmount: 36720,
        totalAmount: 240720,
        prNumberRef: 'PR-2025-0142',
        rfqNumberRef: 'RFQ-2025-0089',
        priceAgreementRef: 'VPA-2025-0089',
        deliveryDate: '2026-01-25',
        receivedQtyPurchUom: 30,
        receivedQtyInvUom: 750,
        status: 'FULLY_RECEIVED',
      },
    ],
    createdAt: '2026-01-18T10:00:00Z',
    updatedAt: '2026-01-25T15:00:00Z',
    approvedAt: '2026-01-18T14:00:00Z',
    approvedBy: 'Venkatesh Iyer',
  },
  {
    id: 'po-fy25-002',
    poNumber: 'PO-2025-0099',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-hosur-02',
    branchCode: '002',
    branchName: 'Hosur Manufacturing Facility',
    purchaseOrgId: 'po-kosh-01',
    department: 'Tool Room & Maintenance',
    costCentre: 'CC-MAINT-104',
    vendorId: 'bp-004',
    vendorCode: 'VEND-FESTO-01',
    vendorName: 'FESTO CONTROLS INDIA PVT LTD',
    poDate: '2026-03-22', // Document Date in FY 2025-26
    accountingPostingDate: '2026-04-12', // Open PO carried forward & posted in FY 2026-27
    financialYearId: 'fy-co-kosh-01-2026-27',
    financialYearCode: 'FY 2026-27',
    accountingPeriodCode: '2026-04',
    paymentTerms: 'NET 45 Days',
    incoterms: 'DDP Hosur Plant',
    deliveryAddress: 'Hosur Manufacturing Facility',
    buyerId: 'usr-buyer-01',
    buyerName: 'Vikram Singh',
    purchasingManagerId: 'usr-checker-03',
    purchasingManagerName: 'Venkatesh Iyer',
    totalNetValue: 64000,
    totalTaxValue: 11520,
    totalGrossValue: 75520,
    currency: 'INR',
    priceSourceMode: 'DIRECT_PO',
    status: 'APPROVED',
    allocationProposals: [],
    hasOverride: false,
    isDirectPo: true,
    directPoReason: 'PROPRIETARY_ITEM',
    directPoJustification: 'Cross-FY open PO placed on 22 Mar 2026 and received/posted in FY 2026-27.',
    rfqRequirementStatus: 'RFQ_MANDATORY_EXEMPTED',
    supplierEligibilityVerified: true,
    lines: [
      {
        id: 'pol-fy25-002',
        poId: 'po-fy25-002',
        itemCode: 'MAPALBL0003',
        description: 'Pneumatic Solenoid Valve – 5/2 Way Single Solenoid – 24V DC G1/4"',
        itemCategory: 'Maintenance & Spares',
        purchaseUom: 'SET',
        inventoryUom: 'EA',
        conversionRatio: 1,
        orderQtyPurchUom: 20,
        orderQtyInvUom: 20,
        unitPricePurchUom: 3200,
        currency: 'INR',
        netAmount: 64000,
        gstPercent: 18,
        gstAmount: 11520,
        totalAmount: 75520,
        prNumberRef: 'PR-2025-0143',
        priceAgreementRef: 'EXM-RFQ-2025-0019',
        deliveryDate: '2026-04-15',
        receivedQtyPurchUom: 0,
        receivedQtyInvUom: 0,
        status: 'OPEN',
      },
    ],
    createdAt: '2026-03-22T11:00:00Z',
    updatedAt: '2026-04-12T09:00:00Z',
    approvedAt: '2026-03-22T14:00:00Z',
    approvedBy: 'Venkatesh Iyer',
  },
];

let memoryPos: PurchaseOrderHeader[] | null = null;
let memoryExemptions: RfqExemptionApprovalRecord[] | null = null;
let memoryBlockedAttempts: BlockedDirectPoAttemptLog[] | null = null;

export const purchaseOrderService = {
  resetForTesting(): void {
    memoryPos = JSON.parse(JSON.stringify(INITIAL_POS));
    memoryExemptions = [];
    memoryBlockedAttempts = [];
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_POS);
      localStorage.removeItem(STORAGE_KEY_RFQ_EXEMPTIONS);
      localStorage.removeItem(STORAGE_KEY_BLOCKED_DIRECT_POS);
    }
  },

  getPOs(): PurchaseOrderHeader[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_POS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (err) {
        console.error('Error loading POs:', err);
      }
    }
    if (!memoryPos) {
      memoryPos = JSON.parse(JSON.stringify([...INITIAL_POS, ...HISTORICAL_SEED_POS]));
    }
    return memoryPos!;
  },

  savePOs(pos: PurchaseOrderHeader[]) {
    memoryPos = JSON.parse(JSON.stringify(pos));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(pos));
      } catch (err) {
        console.error('Error saving POs:', err);
      }
    }
  },

  getRfqExemptions(): RfqExemptionApprovalRecord[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_RFQ_EXEMPTIONS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    if (!memoryExemptions) {
      memoryExemptions = [];
    }
    return memoryExemptions!;
  },

  saveRfqExemptions(exemptions: RfqExemptionApprovalRecord[]): void {
    memoryExemptions = JSON.parse(JSON.stringify(exemptions));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_RFQ_EXEMPTIONS, JSON.stringify(exemptions));
      } catch {}
    }
  },

  getBlockedAttempts(): BlockedDirectPoAttemptLog[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_BLOCKED_DIRECT_POS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    if (!memoryBlockedAttempts) {
      memoryBlockedAttempts = [];
    }
    return memoryBlockedAttempts!;
  },

  saveBlockedAttempts(attempts: BlockedDirectPoAttemptLog[]): void {
    memoryBlockedAttempts = JSON.parse(JSON.stringify(attempts));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_BLOCKED_DIRECT_POS, JSON.stringify(attempts));
      } catch {}
    }
  },

  getPoById(id: string): PurchaseOrderHeader | undefined {
    return this.getPOs().find(p => p.id === id || p.poNumber === id);
  },

  /**
   * N4. Validates Supplier Eligibility from Business Partner Master.
   */
  validateSupplierEligibility(vendorId: string): {
    eligible: boolean;
    vendorCode?: string;
    vendorName?: string;
    reason?: string;
  } {
    let partners = INITIAL_BUSINESS_PARTNERS;
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('kosh_business_partners');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) partners = parsed;
        }
      } catch {}
    }

    const bp = partners.find((p) => p.id === vendorId || p.bpCode === vendorId);
    if (!bp) {
      return {
        eligible: false,
        reason: `Supplier '${vendorId}' is not registered in the Approved Business Partner Master.`,
      };
    }
    if (bp.bpType === 'CUSTOMER') {
      return {
        eligible: false,
        vendorCode: bp.bpCode,
        vendorName: bp.bpName,
        reason: `Business Partner '${bp.bpName}' (${bp.bpCode}) is classified as CUSTOMER only, not an eligible Vendor.`,
      };
    }
    if (bp.status !== 'ACTIVE') {
      return {
        eligible: false,
        vendorCode: bp.bpCode,
        vendorName: bp.bpName,
        reason: `Supplier '${bp.bpName}' (${bp.bpCode}) has status '${bp.status}' and is not eligible for PO placement.`,
      };
    }

    return {
      eligible: true,
      vendorCode: bp.bpCode,
      vendorName: bp.bpName,
    };
  },

  /**
   * N2. Requests and Approves an Authorized RFQ Exemption when RFQ Policy is Mandatory (RFQ_ENABLED).
   */
  requestRfqExemption(params: {
    companyId: string;
    branchId: string;
    prNumber?: string;
    vendorId: string;
    vendorName: string;
    itemCode: string;
    estimatedValue: number;
    reasonCode: DirectPoReasonCode;
    justification: string;
    requestedBy: string;
  }): RfqExemptionApprovalRecord {
    if (!params.justification || !params.justification.trim()) {
      throw new Error('Mandatory justification is required to request an RFQ exemption.');
    }
    const exemptions = this.getRfqExemptions();
    const count = exemptions.length + 1;
    const rec: RfqExemptionApprovalRecord = {
      id: `exm-rfq-${Date.now()}`,
      exemptionReference: `EXM-RFQ-2026-${String(count).padStart(4, '0')}`,
      companyId: params.companyId,
      branchId: params.branchId,
      prNumber: params.prNumber,
      vendorId: params.vendorId,
      vendorName: params.vendorName,
      itemCode: params.itemCode,
      estimatedValue: params.estimatedValue,
      reasonCode: params.reasonCode,
      justification: params.justification.trim(),
      requestedBy: params.requestedBy,
      requestedAt: new Date().toISOString(),
      status: 'PENDING',
    };
    exemptions.unshift(rec);
    this.saveRfqExemptions(exemptions);
    return rec;
  },

  approveRfqExemption(params: {
    exemptionId?: string;
    exemptionReference?: string;
    approvedBy: string;
    approvalRemarks: string;
  }): RfqExemptionApprovalRecord {
    const exemptions = this.getRfqExemptions();
    const target = exemptions.find(
      (e) =>
        (params.exemptionId && e.id === params.exemptionId) ||
        (params.exemptionReference && e.exemptionReference === params.exemptionReference)
    );
    if (!target) {
      throw new Error('RFQ Exemption request not found.');
    }
    if (target.requestedBy === params.approvedBy) {
      throw new Error('Maker-Checker Violation: Exemption requester cannot approve their own RFQ exemption.');
    }
    target.status = 'APPROVED';
    target.approvedBy = params.approvedBy;
    target.approvedAt = new Date().toISOString();
    target.approvalRemarks = params.approvalRemarks || 'Authorized RFQ exemption granted.';
    this.saveRfqExemptions(exemptions);
    return target;
  },

  /**
   * N2 & N4. Evaluates Direct PO Eligibility against Effective RFQ Policy.
   */
  evaluateDirectPoEligibility(params: {
    companyId: string;
    branchId: string;
    exemptionApprovalRef?: string;
  }): {
    allowed: boolean;
    policyMode: string;
    rfqRequirementStatus?: RfqRequirementStatusOnPo;
    policySnapshot: Record<string, any>;
    exemptionRecord?: RfqExemptionApprovalRecord;
    reason: string;
  } {
    const effectivePolicy = rfqPolicyService.getEffectivePolicy(params.companyId, params.branchId);
    const policySnapshot = JSON.parse(JSON.stringify(effectivePolicy));

    if (effectivePolicy.policyMode === 'RFQ_DISABLED') {
      return {
        allowed: true,
        policyMode: 'RFQ_DISABLED',
        rfqRequirementStatus: 'RFQ_DISABLED_DIRECT',
        policySnapshot,
        reason: 'RFQ is disabled by branch/company policy; Direct PO is the standard procurement route.',
      };
    }

    if (effectivePolicy.policyMode === 'RFQ_OPTIONAL') {
      return {
        allowed: true,
        policyMode: 'RFQ_OPTIONAL',
        rfqRequirementStatus: 'RFQ_OPTIONAL_DIRECT',
        policySnapshot,
        reason: 'RFQ is optional under active policy; Direct PO is permitted with valid reason and justification.',
      };
    }

    // RFQ_ENABLED (Mandatory)
    if (params.exemptionApprovalRef) {
      const approvedExemption = this.getRfqExemptions().find(
        (e) =>
          (e.exemptionReference === params.exemptionApprovalRef ||
            e.id === params.exemptionApprovalRef) &&
          e.status === 'APPROVED'
      );
      if (approvedExemption) {
        return {
          allowed: true,
          policyMode: 'RFQ_ENABLED',
          rfqRequirementStatus: 'RFQ_MANDATORY_EXEMPTED',
          policySnapshot,
          exemptionRecord: approvedExemption,
          reason: `RFQ is mandatory, but authorized RFQ Exemption (${approvedExemption.exemptionReference}) approved by ${approvedExemption.approvedBy} permits Direct PO.`,
        };
      }
    }

    return {
      allowed: false,
      policyMode: 'RFQ_ENABLED',
      policySnapshot,
      reason: `Direct PO Blocked: RFQ is MANDATORY (RFQ_ENABLED) for ${effectivePolicy.branchName || params.branchId}. Direct PO creation without an approved RFQ Exemption is prohibited.`,
    };
  },

  /**
   * N1–N5. Creates a Direct Purchase Order Without RFQ when permitted by policy,
   * performing:
   * 1. RFQ Policy & Exemption Eligibility Check (logging blocked attempts if unauthorized)
   * 2. Direct Procurement Reason & Mandatory Justification Validation
   * 3. Supplier Eligibility Check
   * 4. Inventory Availability Validation (Part K)
   * 5. Budget Validation & Stage Commitment Reconciliation without double-counting (Part L)
   */
  createDirectPurchaseOrder(params: {
    companyId: string;
    companyCode?: string;
    branchId: string;
    branchCode?: string;
    branchName?: string;
    purchaseOrgId?: string;
    department: string;
    costCentre: string;
    vendorId: string;
    directPoReason: DirectPoReasonCode;
    directPoJustification: string;
    exemptionApprovalRef?: string;
    buyerId: string;
    buyerName: string;
    purchasingManagerId?: string;
    purchasingManagerName?: string;
    paymentTerms?: string;
    incoterms?: string;
    deliveryAddress?: string;
    currency?: string;
    prNumberRef?: string;
    sourceChainId?: string;
    poDate?: string;
    accountingPostingDate?: string;
    supportingDocuments?: Array<{ id: string; fileName: string; uploadedAt: string }>;
    lines: Array<{
      itemCode: string;
      description: string;
      itemCategory?: string;
      purchaseUom: string;
      inventoryUom?: string;
      conversionRatio?: number;
      orderQtyPurchUom: number;
      unitPricePurchUom: number;
      gstPercent: number;
      deliveryDate?: string;
      defaultWarehouse?: string;
    }>;
  }): PurchaseOrderHeader {
    const todayDate = new Date().toISOString().split('T')[0];
    const poDocDate = params.poDate || todayDate;
    const poPostDate = params.accountingPostingDate || poDocDate;
    const fyCheck = financialYearService.validateAndCapturePostingSnapshot({
      companyId: params.companyId,
      branchId: params.branchId,
      documentDate: poDocDate,
      accountingPostingDate: poPostDate,
    });
    if (!fyCheck.allowed) {
      throw new Error(fyCheck.rejectionReason || `PO creation blocked for posting date ${poPostDate}.`);
    }
    const netTotal = params.lines.reduce(
      (sum, l) => sum + l.orderQtyPurchUom * l.unitPricePurchUom,
      0
    );
    const taxTotal = params.lines.reduce(
      (sum, l) =>
        sum + (l.orderQtyPurchUom * l.unitPricePurchUom * (l.gstPercent || 0)) / 100,
      0
    );
    const grossTotal = Number((netTotal + taxTotal).toFixed(2));

    // 1. Direct PO Eligibility Check against Effective RFQ Policy
    const eligibility = this.evaluateDirectPoEligibility({
      companyId: params.companyId,
      branchId: params.branchId,
      exemptionApprovalRef: params.exemptionApprovalRef,
    });

    if (!eligibility.allowed) {
      const blockedLogs = this.getBlockedAttempts();
      const attemptLog: BlockedDirectPoAttemptLog = {
        id: `blk-dpo-${Date.now()}`,
        companyId: params.companyId,
        branchId: params.branchId,
        attemptedByUserId: params.buyerId,
        attemptedByName: params.buyerName,
        vendorId: params.vendorId,
        vendorName: params.vendorId,
        itemCode: params.lines[0]?.itemCode || 'UNKNOWN',
        attemptedValue: grossTotal,
        effectiveRfqPolicyMode: eligibility.policyMode,
        directPoReason: params.directPoReason,
        blockReason: eligibility.reason,
        timestamp: new Date().toISOString(),
      };
      blockedLogs.unshift(attemptLog);
      this.saveBlockedAttempts(blockedLogs);

      throw new Error(eligibility.reason);
    }

    // 2. Reason Code & Mandatory Justification Validation
    if (!params.directPoReason) {
      throw new Error('Direct Procurement Reason code is mandatory for Direct PO creation.');
    }
    if (!params.directPoJustification || !params.directPoJustification.trim()) {
      throw new Error('Mandatory justification is required for Direct PO creation.');
    }

    // 3. Supplier Eligibility Check
    const supplierCheck = this.validateSupplierEligibility(params.vendorId);
    if (!supplierCheck.eligible) {
      throw new Error(`Supplier Eligibility Check Failed: ${supplierCheck.reason}`);
    }

    // 4. Inventory Validation (Part K)
    const invSnapshot = inventoryValidationService.validateTransactionInventory({
      companyId: params.companyId,
      branchId: params.branchId,
      stage: 'ON_PO_CREATION',
      validatedBy: params.buyerName,
      lines: params.lines.map((l) => ({
        itemCode: l.itemCode,
        description: l.description,
        itemCategory: l.itemCategory,
        inventoryUom: l.inventoryUom || l.purchaseUom,
        requestedQuantity: l.orderQtyPurchUom * (l.conversionRatio || 1),
        defaultWarehouse: l.defaultWarehouse,
      })),
    });

    // 5. Budget Validation (Part L)
    const pos = this.getPOs();
    const count = pos.length + 1;
    const poNumber = `PO-2026-${String(count).padStart(4, '0')}`;
    const poId = `po-dir-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const chainId = params.sourceChainId || params.prNumberRef || poNumber;

    const budgetSnapshot = budgetControlService.validateBudgetAtStage({
      transactionId: poId,
      transactionNumber: poNumber,
      sourceChainId: chainId,
      stage: 'PO_CREATION',
      companyId: params.companyId,
      branchId: params.branchId,
      department: params.department,
      costCenter: params.costCentre,
      proposedAmount: netTotal,
      validatedBy: params.buyerName,
    });

    if (!budgetSnapshot.canProceed) {
      throw new Error(
        `Direct PO Blocked by Budget Control: Insufficient available budget (Available: ₹${budgetSnapshot.availableBudget.toLocaleString()}, Proposed: ₹${netTotal.toLocaleString()}, Shortfall: ₹${budgetSnapshot.budgetShortfall.toLocaleString()}).`
      );
    }

    // Reconcile commitment on chain (preventing double counting if linked to an existing PR)
    budgetControlService.recordOrReconcileCommitment({
      sourceChainId: chainId,
      companyId: params.companyId,
      branchId: params.branchId,
      costCenter: params.costCentre,
      stage: 'PO_CREATION',
      documentNumber: poNumber,
      newCommitmentAmount: netTotal,
      actorName: params.buyerName,
      prNumber: params.prNumberRef,
      poId,
      poNumber,
    });

    const formattedLines: PurchaseOrderLine[] = params.lines.map((l, idx) => {
      const ratio = l.conversionRatio || 1;
      const lineNet = Number((l.orderQtyPurchUom * l.unitPricePurchUom).toFixed(2));
      const lineTax = Number(((lineNet * (l.gstPercent || 0)) / 100).toFixed(2));
      return {
        id: `pol-dir-${Date.now()}-${idx}`,
        poId,
        itemCode: l.itemCode,
        description: l.description,
        itemCategory: l.itemCategory || 'Raw Materials',
        purchaseUom: l.purchaseUom,
        inventoryUom: l.inventoryUom || l.purchaseUom,
        conversionRatio: ratio,
        orderQtyPurchUom: l.orderQtyPurchUom,
        orderQtyInvUom: l.orderQtyPurchUom * ratio,
        unitPricePurchUom: l.unitPricePurchUom,
        currency: params.currency || 'INR',
        netAmount: lineNet,
        gstPercent: l.gstPercent,
        gstAmount: lineTax,
        totalAmount: Number((lineNet + lineTax).toFixed(2)),
        prNumberRef: params.prNumberRef || 'DIRECT-PR-EXEMPT',
        rfqNumberRef: undefined,
        priceAgreementRef: eligibility.exemptionRecord?.exemptionReference || 'DIRECT-RATE',
        deliveryDate: l.deliveryDate || '2026-12-15',
        receivedQtyPurchUom: 0,
        receivedQtyInvUom: 0,
        status: 'OPEN',
      };
    });

    const nowIso = new Date().toISOString();
    const createdPo: PurchaseOrderHeader = {
      id: poId,
      poNumber,
      companyId: params.companyId,
      companyCode: params.companyCode || 'KOSH-HQ',
      branchId: params.branchId,
      branchCode: params.branchCode || '001',
      branchName: params.branchName || 'Plant Branch',
      purchaseOrgId: params.purchaseOrgId || 'po-kosh-01',
      department: params.department,
      costCentre: params.costCentre,
      vendorId: params.vendorId,
      vendorCode: supplierCheck.vendorCode!,
      vendorName: supplierCheck.vendorName!,
      poDate: poDocDate,
      accountingPostingDate: poPostDate,
      financialYearId: fyCheck.snapshot.financialYearId,
      financialYearCode: fyCheck.snapshot.financialYearCode,
      accountingPeriodId: fyCheck.snapshot.accountingPeriodId,
      accountingPeriodCode: fyCheck.snapshot.accountingPeriodCode,
      fySnapshot: fyCheck.snapshot,
      paymentTerms: params.paymentTerms || 'NET 45 Days',
      incoterms: params.incoterms || 'DDP Plant',
      deliveryAddress: params.deliveryAddress || 'Central Receiving Store',
      buyerId: params.buyerId,
      buyerName: params.buyerName,
      purchasingManagerId: params.purchasingManagerId || 'usr-checker-03',
      purchasingManagerName: params.purchasingManagerName || 'Venkatesh Iyer',
      totalNetValue: Number(netTotal.toFixed(2)),
      totalTaxValue: Number(taxTotal.toFixed(2)),
      totalGrossValue: grossTotal,
      currency: params.currency || 'INR',
      priceSourceMode: 'DIRECT_PO',
      status: 'PENDING_APPROVAL',
      allocationProposals: [],
      hasOverride: false,
      lines: formattedLines,
      isDirectPo: true,
      procurementPolicyRef: `${eligibility.policySnapshot.id} (${eligibility.policyMode})`,
      rfqPolicyVersionSnapshot: eligibility.policySnapshot,
      rfqRequirementStatus: eligibility.rfqRequirementStatus,
      directPoReason: params.directPoReason,
      directPoJustification: params.directPoJustification.trim(),
      exemptionApprovalRef: eligibility.exemptionRecord?.exemptionReference,
      exemptionApprovedBy: eligibility.exemptionRecord?.approvedBy,
      supplierEligibilityVerified: true,
      inventoryValidationSnapshot: invSnapshot,
      budgetValidationSnapshot: budgetSnapshot,
      supportingDocuments: params.supportingDocuments || [],
      amendmentVersion: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    pos.unshift(createdPo);
    this.savePOs(pos);

    EnterpriseAuditService.logEvent({
      companyId: createdPo.companyId,
      branchId: createdPo.branchId,
      entityType: 'APPROVAL_MAPPING',
      entityId: createdPo.poNumber,
      eventType: 'CREATE_DIRECT_PURCHASE_ORDER',
      eventDescription: `Created Direct PO ${createdPo.poNumber} without RFQ (${createdPo.rfqRequirementStatus} | Reason: ${createdPo.directPoReason})`,
      changedByUserId: createdPo.buyerId,
      changedByName: createdPo.buyerName,
      changeReason: createdPo.directPoJustification || 'Direct PO Created',
      newValue: {
        poNumber: createdPo.poNumber,
        vendorName: createdPo.vendorName,
        totalGrossValue: createdPo.totalGrossValue,
        rfqRequirementStatus: createdPo.rfqRequirementStatus,
        directPoReason: createdPo.directPoReason,
        exemptionApprovalRef: createdPo.exemptionApprovalRef,
      },
    });

    if (params.prNumberRef) {
      const prs = PurchaseRequisitionService.getPurchaseRequisitions();
      const linkedPr = prs.find((p) => p.prNumber === params.prNumberRef || p.id === params.prNumberRef);
      if (linkedPr) {
        const effInv = inventoryValidationService.getEffectivePolicy({
          companyId: linkedPr.companyId,
          branchId: linkedPr.branchId,
          warehouseCode: linkedPr.lines[0]?.defaultWarehouse,
          itemCategory: linkedPr.lines[0]?.itemCategory,
        });
        if (effInv.isEnabled && effInv.revalidationStages?.includes('ON_PO_CREATION')) {
          inventoryValidationService.revalidatePrAndAttachSnapshot(
            linkedPr,
            'ON_PO_CREATION',
            params.buyerName
          );
          PurchaseRequisitionService.savePurchaseRequisitions(prs);
        }
      }
    }

    return createdPo;
  },

  /**
   * L6. Amends an existing Purchase Order and revalidates/reconciles Budget Commitment
   * without double-counting the original PO commitment!
   */
  amendPurchaseOrder(params: {
    poId: string;
    amendedBy: string;
    amendmentJustification: string;
    updatedLines: Array<{
      lineId?: string;
      itemCode: string;
      orderQtyPurchUom: number;
      unitPricePurchUom: number;
      gstPercent?: number;
    }>;
  }): PurchaseOrderHeader {
    const pos = this.getPOs();
    const po = pos.find((p) => p.id === params.poId || p.poNumber === params.poId);
    if (!po) {
      throw new Error(`Purchase Order ${params.poId} not found.`);
    }

    const fyMutGuard = financialYearService.evaluateHistoricalRecordMutationGuard({
      companyId: po.companyId,
      accountingPostingDate: po.accountingPostingDate,
      documentDate: po.poDate,
      financialYearId: po.financialYearId,
      actionLabel: 'AMEND_PO',
    });
    if (!fyMutGuard.allowed) {
      throw new Error(fyMutGuard.reason || `PO ${po.poNumber} cannot be amended in a closed financial year or locked period.`);
    }

    let newNetTotal = 0;
    let newTaxTotal = 0;

    po.lines = po.lines.map((line) => {
      const upd = params.updatedLines.find(
        (u) => u.lineId === line.id || u.itemCode === line.itemCode
      );
      if (upd) {
        line.orderQtyPurchUom = upd.orderQtyPurchUom;
        line.orderQtyInvUom = upd.orderQtyPurchUom * (line.conversionRatio || 1);
        line.unitPricePurchUom = upd.unitPricePurchUom;
        if (upd.gstPercent !== undefined) line.gstPercent = upd.gstPercent;
        line.netAmount = Number((line.orderQtyPurchUom * line.unitPricePurchUom).toFixed(2));
        line.gstAmount = Number(((line.netAmount * line.gstPercent) / 100).toFixed(2));
        line.totalAmount = Number((line.netAmount + line.gstAmount).toFixed(2));
      }
      newNetTotal += line.netAmount;
      newTaxTotal += line.gstAmount;
      return line;
    });

    const chainId = po.lines[0]?.prNumberRef || po.poNumber;
    const costCentre = po.costCentre || 'CC-PROD-101';
    const department = po.department || 'Production';

    const budgetSnapshot = budgetControlService.validateBudgetAtStage({
      transactionId: po.id,
      transactionNumber: po.poNumber,
      sourceChainId: chainId,
      stage: 'PO_AMENDMENT',
      companyId: po.companyId,
      branchId: po.branchId,
      department,
      costCenter: costCentre,
      proposedAmount: newNetTotal,
      validatedBy: params.amendedBy,
    });

    if (!budgetSnapshot.canProceed) {
      throw new Error(
        `PO Amendment Blocked by Budget Control: Shortfall of ₹${budgetSnapshot.budgetShortfall.toLocaleString()}.`
      );
    }

    budgetControlService.recordOrReconcileCommitment({
      sourceChainId: chainId,
      companyId: po.companyId,
      branchId: po.branchId,
      costCenter: costCentre,
      stage: 'PO_AMENDMENT',
      documentNumber: po.poNumber,
      newCommitmentAmount: newNetTotal,
      actorName: params.amendedBy,
      poId: po.id,
      poNumber: po.poNumber,
    });

    po.totalNetValue = Number(newNetTotal.toFixed(2));
    po.totalTaxValue = Number(newTaxTotal.toFixed(2));
    po.totalGrossValue = Number((newNetTotal + newTaxTotal).toFixed(2));
    po.budgetValidationSnapshot = budgetSnapshot;
    po.amendmentVersion = (po.amendmentVersion || 1) + 1;
    po.updatedAt = new Date().toISOString();

    this.savePOs(pos);
    return po;
  },

  /**
   * N5. Direct PO Tracking and Compliance Reporting.
   * Separates RFQ-based POs, Direct POs, Approved Exceptions, and Unauthorized/Blocked attempts.
   */
  getDirectPoComplianceReport(companyId?: string, branchId?: string): {
    rfqBasedPos: PurchaseOrderHeader[];
    directPos: PurchaseOrderHeader[];
    approvedExemptionPos: PurchaseOrderHeader[];
    blockedBypassAttempts: BlockedDirectPoAttemptLog[];
  } {
    const allPos = this.getPOs().filter((p) => {
      if (companyId && p.companyId !== companyId) return false;
      if (branchId && branchId !== 'ALL' && p.branchId !== branchId) return false;
      return true;
    });

    const blocked = this.getBlockedAttempts().filter((b) => {
      if (companyId && b.companyId !== companyId) return false;
      if (branchId && branchId !== 'ALL' && b.branchId !== branchId) return false;
      return true;
    });

    return {
      rfqBasedPos: allPos.filter((p) => !p.isDirectPo),
      directPos: allPos.filter((p) => Boolean(p.isDirectPo)),
      approvedExemptionPos: allPos.filter(
        (p) => p.isDirectPo && p.rfqRequirementStatus === 'RFQ_MANDATORY_EXEMPTED'
      ),
      blockedBypassAttempts: blocked,
    };
  },

  // Calculate proposed multi-vendor allocation split for a requested item
  calculateVendorAllocation(companyId: string, itemCode: string, totalQtyPurchUom: number, branchId?: string): PoVendorAllocationProposal {
    const isRfqEnabled = rfqPolicyService.isRfqEnabled(companyId, branchId);

    if (isRfqEnabled) {
      const agreements = vendorPriceRegisterService.getActiveAgreementsForItem(companyId, itemCode, branchId);

      if (agreements.length > 0) {
        let totalAssignedPercent = 0;
        const vendorAllocations = agreements.map((agr) => {
          const origPct = agr.allocationPercent || Math.round(100 / agreements.length);
          totalAssignedPercent += origPct;
          const origQty = Math.round((totalQtyPurchUom * origPct) / 100);
          return {
            vendorId: agr.vendorId,
            vendorCode: agr.vendorCode,
            vendorName: agr.vendorName,
            originalAllocationPercent: origPct,
            originalQtyPurchUom: origQty,
            proposedAllocationPercent: origPct,
            proposedQtyPurchUom: origQty,
            unitPricePurchUom: agr.approvedUnitPricePurchUom,
            lineTotalValue: origQty * agr.approvedUnitPricePurchUom,
            priceAgreementRef: agr.agreementNumber,
          };
        });

        const currentSumQty = vendorAllocations.reduce((acc, v) => acc + v.proposedQtyPurchUom, 0);
        if (currentSumQty !== totalQtyPurchUom && vendorAllocations.length > 0) {
          vendorAllocations[0].proposedQtyPurchUom += (totalQtyPurchUom - currentSumQty);
          vendorAllocations[0].lineTotalValue = vendorAllocations[0].proposedQtyPurchUom * vendorAllocations[0].unitPricePurchUom;
        }

        return {
          itemCode,
          purchaseUom: agreements[0].purchaseUom,
          totalRequiredQtyPurchUom: totalQtyPurchUom,
          priceSource: 'APPROVED_RFQ_AWARD',
          vendorAllocations,
          overrideApplied: false,
        };
      }
    }

    // RFQ Disabled or no active RFQ agreement -> Use Price Book
    const priceBookInfo = purchasePriceBookService.getPriceBookLineForItem(companyId, itemCode, totalQtyPurchUom, branchId);
    const unitPrice = priceBookInfo ? priceBookInfo.unitPrice : 7500;
    const refNum = priceBookInfo ? priceBookInfo.priceBookNumber : 'PB-DEFAULT';

    return {
      itemCode,
      purchaseUom: priceBookInfo?.line.purchaseUom || 'BAG',
      totalRequiredQtyPurchUom: totalQtyPurchUom,
      priceSource: 'APPROVED_PRICE_BOOK',
      vendorAllocations: [
        {
          vendorId: 'bp-002',
          vendorCode: 'VEND-BASF-01',
          vendorName: 'BASF INDIA LIMITED',
          originalAllocationPercent: 100,
          originalQtyPurchUom: totalQtyPurchUom,
          proposedAllocationPercent: 100,
          proposedQtyPurchUom: totalQtyPurchUom,
          unitPricePurchUom: unitPrice,
          lineTotalValue: totalQtyPurchUom * unitPrice,
          priceAgreementRef: refNum,
        },
      ],
      overrideApplied: false,
    };
  },

  approvePo(poId: string, approvedBy: string): PurchaseOrderHeader | null {
    const pos = this.getPOs();
    const po = pos.find(p => p.id === poId || p.poNumber === poId);
    if (po) {
      const fyMutGuard = financialYearService.evaluateHistoricalRecordMutationGuard({
        companyId: po.companyId,
        accountingPostingDate: po.accountingPostingDate,
        documentDate: po.poDate,
        financialYearId: po.financialYearId,
        actionLabel: 'APPROVE_PO',
      });
      if (!fyMutGuard.allowed) {
        throw new Error(fyMutGuard.reason || `PO ${po.poNumber} cannot be approved in a closed financial year or locked period.`);
      }
      po.status = 'APPROVED';
      po.approvedBy = approvedBy;
      po.approvedAt = new Date().toISOString();
      po.updatedAt = new Date().toISOString();
      this.savePOs(pos);

      EnterpriseAuditService.logEvent({
        companyId: po.companyId,
        branchId: po.branchId,
        entityType: 'APPROVAL_MAPPING',
        entityId: po.poNumber,
        eventType: 'APPROVE_PURCHASE_ORDER',
        eventDescription: `Approved Purchase Order ${po.poNumber} (${po.vendorName})`,
        changedByUserId: 'usr-checker-03',
        changedByName: approvedBy,
        changeReason: 'PO Approval granted',
        newValue: {
          poNumber: po.poNumber,
          vendorName: po.vendorName,
          totalGrossValue: po.totalGrossValue,
          isDirectPo: po.isDirectPo,
          hasOverride: po.hasOverride,
          overrideJustification: po.overrideJustification,
        },
      });

      // Part K: Revalidate Inventory at ON_PO_RELEASE for PO and linked PRs
      const poInvSnap = inventoryValidationService.validateTransactionInventory({
        companyId: po.companyId,
        branchId: po.branchId,
        stage: 'ON_PO_RELEASE',
        validatedBy: approvedBy,
        lines: po.lines.map((l) => ({
          itemCode: l.itemCode,
          description: l.description,
          itemCategory: l.itemCategory,
          inventoryUom: l.inventoryUom || l.purchaseUom,
          requestedQuantity: l.orderQtyInvUom || l.orderQtyPurchUom * (l.conversionRatio || 1),
        })),
      });
      po.inventoryValidationSnapshot = poInvSnap;
      this.savePOs(pos);

      const prRefs = Array.from(
        new Set(po.lines.map((l) => l.prNumberRef).filter((x): x is string => Boolean(x && x !== 'DIRECT-PR-EXEMPT')))
      );
      if (prRefs.length > 0) {
        const prs = PurchaseRequisitionService.getPurchaseRequisitions();
        let mutated = false;
        for (const pr of prs) {
          if (prRefs.includes(pr.prNumber) || prRefs.includes(pr.id)) {
            const effInv = inventoryValidationService.getEffectivePolicy({
              companyId: pr.companyId,
              branchId: pr.branchId,
              warehouseCode: pr.lines[0]?.defaultWarehouse,
              itemCategory: pr.lines[0]?.itemCategory,
            });
            if (effInv.isEnabled && effInv.revalidationStages?.includes('ON_PO_RELEASE')) {
              inventoryValidationService.revalidatePrAndAttachSnapshot(
                pr,
                'ON_PO_RELEASE',
                approvedBy
              );
              mutated = true;
            }
          }
        }
        if (mutated) {
          PurchaseRequisitionService.savePurchaseRequisitions(prs);
        }
      }

      return po;
    }
    return null;
  },

  rejectPo(poId: string, rejectedBy: string, reason: string): PurchaseOrderHeader | null {
    const pos = this.getPOs();
    const po = pos.find(p => p.id === poId || p.poNumber === poId);
    if (po) {
      po.status = 'CANCELLED';
      po.updatedAt = new Date().toISOString();
      this.savePOs(pos);

      EnterpriseAuditService.logEvent({
        companyId: po.companyId,
        branchId: po.branchId,
        entityType: 'APPROVAL_MAPPING',
        entityId: po.poNumber,
        eventType: 'REJECT_PURCHASE_ORDER',
        eventDescription: `Rejected Purchase Order ${po.poNumber}: ${reason}`,
        changedByUserId: 'usr-checker-03',
        changedByName: rejectedBy,
        changeReason: reason,
        newValue: {
          poNumber: po.poNumber,
          reason,
        },
      });

      return po;
    }
    return null;
  }
};

