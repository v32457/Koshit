/**
 * CIPPLATFORM — PART O: CONFIGURABLE INVOICE MATCHING SERVICE (TWO-WAY & THREE-WAY)
 * Supports:
 * - Multi-Company / Multi-Branch / Purchase Org / Category / Invoice Type policy configuration
 * - Two-Way Matching (PO <-> Supplier Invoice)
 * - Three-Way Matching (PO <-> Goods Receipt Note (GRN) <-> Supplier Invoice)
 * - Partial & Multiple GRNs and Partial & Multiple Supplier Invoices per PO
 * - All 11 Matching Outcomes: MATCHED, MATCHED_WITHIN_TOLERANCE, QUANTITY_MISMATCH, PRICE_MISMATCH,
 *   TAX_MISMATCH, MISSING_GRN, MISSING_PO, DUPLICATE_INVOICE, PENDING_EXCEPTION_APPROVAL,
 *   BLOCKED, APPROVED_FOR_POSTING
 * - Variance Exception Workflow & Immutable Historical Matching Snapshots
 */

import {
  InvoiceMatchingPolicyConfig,
  InvoiceMatchingOutcome,
  InvoiceVarianceDetail,
  SupplierInvoiceRecord,
  SupplierInvoiceLine,
  InvoiceMatchingSnapshot,
  InvoiceExceptionApprovalRecord,
} from '../types/procurementFinanceGovernance';
import { purchaseOrderService } from './purchaseOrderService';
import { goodsReceiptService } from './goodsReceiptService';
import { normalizeCompanyId, normalizeBranchId } from './prGovernancePolicyService';
import { financialYearService } from './financialYearService';
import { EnterpriseAuditService } from './enterpriseAuditService';

const STORAGE_KEY_INV_MATCH_POLICIES = 'cip_invoice_matching_policies_v1';
const STORAGE_KEY_SUPPLIER_INVOICES = 'cip_supplier_invoices_v1';

export const INITIAL_INVOICE_MATCHING_POLICIES: InvoiceMatchingPolicyConfig[] = [
  {
    id: 'im-pol-co1-default-3way',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'ALL',
    branchCode: 'ALL',
    purchaseOrgId: 'ALL',
    supplierCategory: 'ALL',
    procurementCategory: 'ALL',
    transactionType: 'ALL',
    itemCategory: 'ALL',
    invoiceType: 'ALL',
    matchingMode: 'THREE_WAY',
    quantityTolerancePercent: 2, // 2% quantity tolerance
    priceTolerancePercent: 1, // 1% unit price tolerance
    valueToleranceAmount: 1000, // ₹1,000 total value tolerance
    taxTolerancePercent: 0, // 0% tax rate tolerance (strict GST compliance)
    freightToleranceAmount: 1500, // ₹1,500 freight tolerance
    overInvoiceTolerancePercent: 2,
    underInvoiceTolerancePercent: 100,
    allowPartialInvoices: true,
    allowMultipleInvoices: true,
    requireExceptionApproval: true,
    version: 1,
    effectiveFrom: '2026-04-01',
    status: 'ACTIVE',
    createdBy: 'Accounts Payable Governance Lead',
    approvedBy: 'Chief Financial Officer',
    updatedAt: '2026-04-01T08:00:00Z',
  },
];

export const HISTORICAL_SUPPLIER_INVOICES: SupplierInvoiceRecord[] = [
  {
    id: 'sinv-fy25-001',
    internalInvoiceNumber: 'INV-REG-2025-0088',
    supplierInvoiceNumber: 'BASF/25/INV-0419',
    invoiceDate: '2026-01-29',
    accountingPostingDate: '2026-02-02',
    financialYearId: 'fy-co-kosh-01-2025-26',
    financialYearCode: 'FY 2025-26',
    accountingPeriodCode: '2026-02',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Main Plant & HQ',
    purchaseOrgId: 'po-kosh-01',
    vendorId: 'bp-002',
    vendorCode: 'VEND-BASF-01',
    vendorName: 'BASF INDIA LIMITED',
    poId: 'po-fy25-001',
    poNumber: 'PO-2025-0074',
    grnIds: ['grn-fy25-001'],
    grnNumbers: ['GRN-2025-0061'],
    transactionType: 'MATERIAL',
    invoiceType: 'FINAL',
    isFinalInvoice: true,
    isFinalDelivery: true,
    currency: 'INR',
    totalNetAmount: 204000,
    totalTaxAmount: 36720,
    totalFreightAmount: 0,
    totalGrossAmount: 240720,
    lines: [
      {
        id: 'sinv-l-fy25-001',
        invoiceId: 'sinv-fy25-001',
        poLineId: 'pol-fy25-001',
        grnLineIds: ['grn-line-fy25-001'],
        itemCode: 'RMPAOPOEXLG0001',
        description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
        uom: 'BAG',
        invoicedQuantity: 30,
        unitPrice: 6800,
        netAmount: 204000,
        taxPercent: 18,
        taxAmount: 36720,
        freightAmount: 0,
        totalLineAmount: 240720,
        poOrderedQty: 30,
        poUnitPrice: 6800,
        poTaxPercent: 18,
        grnAcceptedQty: 30,
        grnRejectedQty: 0,
        previouslyInvoicedQty: 0,
        remainingOpenQtyAfterInvoice: 0,
      },
    ],
    matchingOutcome: 'MATCHED',
    postingStatus: 'POSTED',
    matchingSnapshot: {
      snapshotId: 'im-snap-fy25-001',
      matchedAt: '2026-02-02T11:00:00Z',
      matchedBy: 'AP Executive',
      policyId: 'im-pol-co1-default-3way',
      policyVersion: 1,
      policyEffectiveFrom: '2025-04-01',
      matchingModeUsed: 'THREE_WAY',
      tolerancesUsed: {
        quantityTolerancePercent: 2,
        priceTolerancePercent: 1,
        valueToleranceAmount: 1000,
        taxTolerancePercent: 0,
        freightToleranceAmount: 1500,
        overInvoiceTolerancePercent: 2,
        allowPartialInvoices: true,
        allowMultipleInvoices: true,
      },
      poSnapshot: {
        poId: 'po-fy25-001',
        poNumber: 'PO-2025-0074',
        vendorId: 'bp-002',
        totalOrderedQty: 30,
        totalNetValue: 204000,
      },
      grnSnapshots: [
        {
          grnId: 'grn-fy25-001',
          grnNumber: 'GRN-2025-0061',
          receiptDate: '2026-01-25',
          acceptedQtyPurchUom: 30,
          rejectedQtyPurchUom: 0,
        },
      ],
      cumulativePreviouslyInvoicedQty: 0,
      currentInvoiceQty: 30,
      remainingOpenPoQty: 0,
      remainingOpenGrnQty: 0,
      variances: [],
      outcome: 'MATCHED',
      canPostToAccounting: true,
    },
    matchingHistory: [],
    supportingAttachments: [],
    createdBy: 'AP Executive',
    createdAt: '2026-02-02T11:00:00Z',
    updatedAt: '2026-02-02T12:00:00Z',
    postedAt: '2026-02-02T12:00:00Z',
    postedBy: 'Finance Controller',
  },
];

let memoryPolicies: InvoiceMatchingPolicyConfig[] | null = null;
let memoryInvoices: SupplierInvoiceRecord[] | null = null;

export const invoiceMatchingService = {
  resetForTesting(): void {
    memoryPolicies = JSON.parse(JSON.stringify(INITIAL_INVOICE_MATCHING_POLICIES));
    memoryInvoices = [];
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_INV_MATCH_POLICIES);
      localStorage.removeItem(STORAGE_KEY_SUPPLIER_INVOICES);
    }
  },

  getPolicies(): InvoiceMatchingPolicyConfig[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_INV_MATCH_POLICIES);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    if (!memoryPolicies) {
      memoryPolicies = JSON.parse(JSON.stringify(INITIAL_INVOICE_MATCHING_POLICIES));
    }
    return memoryPolicies!;
  },

  savePolicies(policies: InvoiceMatchingPolicyConfig[]): void {
    memoryPolicies = JSON.parse(JSON.stringify(policies));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_INV_MATCH_POLICIES, JSON.stringify(policies));
      } catch {}
    }
  },

  getInvoices(): SupplierInvoiceRecord[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_SUPPLIER_INVOICES);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    if (!memoryInvoices) {
      memoryInvoices = JSON.parse(JSON.stringify(HISTORICAL_SUPPLIER_INVOICES));
    }
    return memoryInvoices!;
  },

  saveInvoices(invoices: SupplierInvoiceRecord[]): void {
    memoryInvoices = JSON.parse(JSON.stringify(invoices));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_SUPPLIER_INVOICES, JSON.stringify(invoices));
      } catch {}
    }
  },

  /**
   * Resolves effective Invoice Matching Policy for Company, Branch, Purchase Org, Transaction Type, Item Category, and Invoice Type.
   * Part P: Preserves historical configuration immutability via version & effectiveFrom.
   */
  getEffectivePolicy(params: {
    companyId: string;
    branchId?: string;
    purchaseOrgId?: string;
    transactionType?: string;
    itemCategory?: string;
    invoiceType?: string;
    transactionDate?: string;
  }): InvoiceMatchingPolicyConfig {
    const normCo = normalizeCompanyId(params.companyId);
    const normBr = params.branchId && params.branchId !== 'ALL' ? normalizeBranchId(params.branchId) : 'ALL';
    const txDate = params.transactionDate || new Date().toISOString().split('T')[0];

    const candidates = this.getPolicies()
      .filter((p) => {
        if (p.status !== 'ACTIVE') return false;
        if (normalizeCompanyId(p.companyId) !== normCo) return false;
        if (p.effectiveFrom && p.effectiveFrom > txDate) return false;
        if (p.effectiveUntil && p.effectiveUntil < txDate) return false;

        const brOk = p.branchId === 'ALL' || normalizeBranchId(p.branchId) === normBr;
        const poOrgOk = !params.purchaseOrgId || p.purchaseOrgId === 'ALL' || p.purchaseOrgId === params.purchaseOrgId;
        const txTypeOk = !params.transactionType || p.transactionType === 'ALL' || p.transactionType === params.transactionType;
        const itemCatOk = !params.itemCategory || p.itemCategory === 'ALL' || p.itemCategory.toLowerCase() === params.itemCategory.toLowerCase();
        const invTypeOk = !params.invoiceType || p.invoiceType === 'ALL' || p.invoiceType === params.invoiceType;

        return brOk && poOrgOk && txTypeOk && itemCatOk && invTypeOk;
      })
      .sort((a, b) => {
        const scoreA =
          (a.branchId !== 'ALL' ? 8 : 0) +
          (a.transactionType !== 'ALL' ? 4 : 0) +
          (a.itemCategory !== 'ALL' ? 2 : 0) +
          (a.invoiceType !== 'ALL' ? 1 : 0);
        const scoreB =
          (b.branchId !== 'ALL' ? 8 : 0) +
          (b.transactionType !== 'ALL' ? 4 : 0) +
          (b.itemCategory !== 'ALL' ? 2 : 0) +
          (b.invoiceType !== 'ALL' ? 1 : 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.version - a.version;
      });

    if (candidates.length > 0) {
      return JSON.parse(JSON.stringify(candidates[0]));
    }

    return JSON.parse(JSON.stringify(INITIAL_INVOICE_MATCHING_POLICIES[0]));
  },

  /**
   * Creates a new version of an Invoice Matching Policy without altering historical versions or matched invoices.
   */
  savePolicyConfig(
    config: Omit<InvoiceMatchingPolicyConfig, 'id' | 'version' | 'status' | 'updatedAt'>,
    actorName: string = 'AP Governance Admin'
  ): InvoiceMatchingPolicyConfig {
    const policies = this.getPolicies();
    const normCo = normalizeCompanyId(config.companyId);
    const normBr = config.branchId === 'ALL' ? 'ALL' : normalizeBranchId(config.branchId);

    const existingIdx = policies.findIndex(
      (p) =>
        p.status === 'ACTIVE' &&
        normalizeCompanyId(p.companyId) === normCo &&
        (p.branchId === 'ALL' ? 'ALL' : normalizeBranchId(p.branchId)) === normBr &&
        p.transactionType === (config.transactionType || 'ALL') &&
        p.itemCategory === (config.itemCategory || 'ALL')
    );

    let nextVersion = 1;
    if (existingIdx >= 0) {
      nextVersion = policies[existingIdx].version + 1;
      policies[existingIdx] = {
        ...policies[existingIdx],
        status: 'SUPERSEDED',
        effectiveUntil: config.effectiveFrom || new Date().toISOString().split('T')[0],
      };
    }

    const created: InvoiceMatchingPolicyConfig = {
      ...config,
      id: `im-pol-${normCo}-${normBr}-v${nextVersion}-${Date.now()}`,
      companyId: normCo,
      branchId: normBr,
      version: nextVersion,
      status: 'ACTIVE',
      createdBy: config.createdBy || actorName,
      updatedAt: new Date().toISOString(),
    };

    policies.unshift(created);
    this.savePolicies(policies);
    return created;
  },

  /**
   * O6. Calculates cumulative PO ordered, GRN accepted/rejected, and previously invoiced quantities for a PO & item.
   */
  getPoLineDeliveryAndInvoiceSummary(
    poNumberOrId: string,
    itemCode: string,
    excludeInvoiceId?: string
  ): {
    poOrderedQty: number;
    poUnitPrice: number;
    poTaxPercent: number;
    grnCount: number;
    totalAcceptedGrnQty: number;
    totalRejectedGrnQty: number;
    previouslyInvoicedQty: number;
    remainingOpenPoQty: number;
    remainingOpenGrnQty: number;
    previousInvoiceCount: number;
  } {
    const po = purchaseOrderService.getPoById(poNumberOrId);
    const poLine = po?.lines.find((l) => l.itemCode === itemCode) || po?.lines[0];

    const poOrderedQty = poLine ? Number(poLine.orderQtyPurchUom) : 0;
    const poUnitPrice = poLine ? Number(poLine.unitPricePurchUom) : 0;
    const poTaxPercent = poLine ? Number(poLine.gstPercent) : 18;

    const grns = po ? goodsReceiptService.getReceiptsForPo(po.poNumber) : [];
    let totalAcceptedGrnQty = 0;
    let totalRejectedGrnQty = 0;

    for (const grn of grns) {
      for (const gLine of grn.lines) {
        if (gLine.itemCode === itemCode || !itemCode) {
          const ratio = gLine.conversionRatio || 1;
          const accPurch =
            gLine.acceptedQtyPurchUom !== undefined
              ? gLine.acceptedQtyPurchUom
              : gLine.acceptedQtyInvUom / ratio;
          const rejPurch =
            gLine.rejectedQtyPurchUom !== undefined
              ? gLine.rejectedQtyPurchUom
              : gLine.rejectedQtyInvUom / ratio;
          totalAcceptedGrnQty += Number(accPurch);
          totalRejectedGrnQty += Number(rejPurch);
        }
      }
    }

    // Sum previously invoiced quantities from valid matched/approved invoices for the same PO
    // (Blocked/rejected invoices such as MISSING_GRN, MISSING_PO, DUPLICATE_INVOICE, or unapproved mismatches do not consume open quantity)
    const existingInvoices = this.getInvoices().filter(
      (inv) =>
        inv.id !== excludeInvoiceId &&
        (inv.poId === po?.id || inv.poNumber === po?.poNumber || inv.poNumber === poNumberOrId) &&
        (inv.matchingOutcome === 'MATCHED' ||
          inv.matchingOutcome === 'MATCHED_WITHIN_TOLERANCE' ||
          inv.matchingOutcome === 'APPROVED_FOR_POSTING' ||
          inv.postingStatus === 'READY_FOR_POSTING' ||
          inv.postingStatus === 'POSTED')
    );

    let previouslyInvoicedQty = 0;
    for (const inv of existingInvoices) {
      for (const iLine of inv.lines) {
        if (iLine.itemCode === itemCode) {
          previouslyInvoicedQty += Number(iLine.invoicedQuantity);
        }
      }
    }

    return {
      poOrderedQty,
      poUnitPrice,
      poTaxPercent,
      grnCount: grns.length,
      totalAcceptedGrnQty: Number(totalAcceptedGrnQty.toFixed(4)),
      totalRejectedGrnQty: Number(totalRejectedGrnQty.toFixed(4)),
      previouslyInvoicedQty: Number(previouslyInvoicedQty.toFixed(4)),
      remainingOpenPoQty: Math.max(0, Number((poOrderedQty - previouslyInvoicedQty).toFixed(4))),
      remainingOpenGrnQty: Math.max(
        0,
        Number((totalAcceptedGrnQty - previouslyInvoicedQty).toFixed(4))
      ),
      previousInvoiceCount: existingInvoices.length,
    };
  },

  /**
   * O3, O4, O5, O6, O8. Submits and matches a Supplier Invoice under the active 2-Way or 3-Way Matching Policy,
   * creating an immutable Historical Matching Snapshot.
   */
  submitAndMatchSupplierInvoice(params: {
    supplierInvoiceNumber: string;
    invoiceDate?: string;
    accountingPostingDate?: string;
    companyId: string;
    companyCode?: string;
    branchId: string;
    branchCode?: string;
    branchName?: string;
    purchaseOrgId?: string;
    vendorId: string;
    vendorCode?: string;
    vendorName?: string;
    poNumber?: string;
    transactionType?: 'MATERIAL' | 'SERVICE' | 'CAPEX' | 'DIRECT';
    invoiceType?: 'STANDARD' | 'PARTIAL' | 'FINAL' | 'CREDIT_MEMO';
    isFinalInvoice?: boolean;
    currency?: string;
    freightAmount?: number;
    createdBy: string;
    lines: Array<{
      itemCode: string;
      description?: string;
      uom: string;
      invoicedQuantity: number;
      unitPrice: number;
      taxPercent: number;
      freightAmount?: number;
    }>;
  }): SupplierInvoiceRecord {
    const normCo = normalizeCompanyId(params.companyId);
    const normBr = normalizeBranchId(params.branchId);
    const nowIso = new Date().toISOString();
    const invoiceDate = params.invoiceDate || nowIso.split('T')[0];
    const accountingPostingDate = params.accountingPostingDate || invoiceDate;

    // GAP-005: Distinct Document Date vs Accounting Posting Date validation against Company FY & Accounting Period
    const fyValidation = financialYearService.validateAndCapturePostingSnapshot({
      companyId: normCo,
      branchId: normBr,
      documentDate: invoiceDate,
      accountingPostingDate,
    });
    if (!fyValidation.allowed) {
      throw new Error(
        fyValidation.rejectionReason ||
          `Invoice Posting Blocked: Accounting Posting Date ${accountingPostingDate} is in a closed or locked period.`
      );
    }

    const invoices = this.getInvoices();
    const policy = this.getEffectivePolicy({
      companyId: normCo,
      branchId: normBr,
      purchaseOrgId: params.purchaseOrgId,
      transactionType: params.transactionType,
      invoiceType: params.invoiceType,
      transactionDate: invoiceDate,
    });

    const invoiceId = `sinv-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const allocNum = financialYearService.allocateDocumentNumber({
      companyId: normCo,
      branchId: normBr,
      documentType: 'SUPPLIER_INVOICE',
      postingDate: accountingPostingDate,
    });
    const internalInvoiceNumber =
      allocNum.documentNumber || `INV-REG-2026-${String(invoices.length + 1).padStart(4, '0')}`;

    // 1. Check Duplicate Supplier Invoice Number for the same Supplier
    const isDuplicate = invoices.some(
      (existing) =>
        existing.vendorId === params.vendorId &&
        existing.supplierInvoiceNumber.trim().toUpperCase() ===
          params.supplierInvoiceNumber.trim().toUpperCase()
    );

    const po = params.poNumber ? purchaseOrderService.getPoById(params.poNumber) : undefined;
    const grns = po ? goodsReceiptService.getReceiptsForPo(po.poNumber) : [];

    const variances: InvoiceVarianceDetail[] = [];
    let totalNetAmount = 0;
    let totalTaxAmount = 0;
    let totalFreightAmount = Number(params.freightAmount || 0);
    let cumulativePrevInvoiced = 0;
    let currentTotalInvoiceQty = 0;
    let remainingOpenPoQtyTotal = 0;
    let remainingOpenGrnQtyTotal = 0;

    let hasQuantityMismatchBeyondTolerance = false;
    let hasPriceMismatchBeyondTolerance = false;
    let hasTaxMismatchBeyondTolerance = false;
    let hasAnyVarianceWithinTolerance = false;
    let hasOtherBlockVariance = false;

    const formattedLines: SupplierInvoiceLine[] = params.lines.map((l, idx) => {
      const lineId = `sinv-l-${Date.now()}-${idx}`;
      const lineNet = Number((l.invoicedQuantity * l.unitPrice).toFixed(2));
      const lineTax = Number(((lineNet * (l.taxPercent || 0)) / 100).toFixed(2));
      const lineFreight = Number(l.freightAmount || 0);
      const lineTotal = Number((lineNet + lineTax + lineFreight).toFixed(2));

      totalNetAmount += lineNet;
      totalTaxAmount += lineTax;
      totalFreightAmount += lineFreight;
      currentTotalInvoiceQty += l.invoicedQuantity;

      const summary = po
        ? this.getPoLineDeliveryAndInvoiceSummary(po.poNumber, l.itemCode, invoiceId)
        : {
            poOrderedQty: 0,
            poUnitPrice: l.unitPrice,
            poTaxPercent: l.taxPercent,
            grnCount: 0,
            totalAcceptedGrnQty: 0,
            totalRejectedGrnQty: 0,
            previouslyInvoicedQty: 0,
            remainingOpenPoQty: 0,
            remainingOpenGrnQty: 0,
            previousInvoiceCount: 0,
          };

      cumulativePrevInvoiced += summary.previouslyInvoicedQty;

      if (po && !isDuplicate && policy.matchingMode !== 'NO_MATCHING') {
        // Check Multiple Invoices permission
        if (summary.previousInvoiceCount > 0 && !policy.allowMultipleInvoices) {
          hasOtherBlockVariance = true;
          variances.push({
            lineId,
            itemCode: l.itemCode,
            varianceType: 'MULTIPLE_INVOICE_NOT_ALLOWED',
            expectedValue: 1,
            invoicedValue: summary.previousInvoiceCount + 1,
            varianceAmount: summary.previousInvoiceCount,
            variancePercent: 100,
            allowedTolerancePercent: 0,
            allowedToleranceAmount: 0,
            withinTolerance: false,
            description: `Multiple invoices against PO ${po.poNumber} are prohibited by active matching policy.`,
          });
        }

        // Reference quantity depends on TWO_WAY vs THREE_WAY
        const referenceOpenQty =
          policy.matchingMode === 'THREE_WAY'
            ? summary.remainingOpenGrnQty
            : summary.remainingOpenPoQty;

        // Check Partial Invoice permission
        if (l.invoicedQuantity < referenceOpenQty && !policy.allowPartialInvoices) {
          hasOtherBlockVariance = true;
          variances.push({
            lineId,
            itemCode: l.itemCode,
            varianceType: 'PARTIAL_INVOICE_NOT_ALLOWED',
            expectedValue: referenceOpenQty,
            invoicedValue: l.invoicedQuantity,
            varianceAmount: l.invoicedQuantity - referenceOpenQty,
            variancePercent:
              referenceOpenQty > 0
                ? Number((((referenceOpenQty - l.invoicedQuantity) / referenceOpenQty) * 100).toFixed(2))
                : 0,
            allowedTolerancePercent: 0,
            allowedToleranceAmount: 0,
            withinTolerance: false,
            description: `Partial invoicing (${l.invoicedQuantity} < ${referenceOpenQty}) is prohibited by active matching policy.`,
          });
        }

        // Check Quantity Variance (invoicedQuantity > referenceOpenQty)
        if (
          !(policy.matchingMode === 'THREE_WAY' && grns.length === 0) &&
          l.invoicedQuantity > referenceOpenQty
        ) {
          const qtyDiff = Number((l.invoicedQuantity - referenceOpenQty).toFixed(4));
          const baseRef = referenceOpenQty > 0 ? referenceOpenQty : Math.max(1, summary.poOrderedQty);
          const qtyVarPct = Number(((qtyDiff / baseRef) * 100).toFixed(2));
          const allowedQtyTolPct = Math.max(
            policy.quantityTolerancePercent,
            policy.overInvoiceTolerancePercent
          );
          const withinTol = referenceOpenQty > 0 && qtyVarPct <= allowedQtyTolPct;

          if (withinTol) {
            hasAnyVarianceWithinTolerance = true;
          } else {
            hasQuantityMismatchBeyondTolerance = true;
          }

          variances.push({
            lineId,
            itemCode: l.itemCode,
            varianceType:
              policy.matchingMode === 'THREE_WAY'
                ? 'QUANTITY_EXCEEDS_GRN'
                : 'QUANTITY_EXCEEDS_PO',
            expectedValue: referenceOpenQty,
            invoicedValue: l.invoicedQuantity,
            varianceAmount: qtyDiff,
            variancePercent: qtyVarPct,
            allowedTolerancePercent: allowedQtyTolPct,
            allowedToleranceAmount: Number(((baseRef * allowedQtyTolPct) / 100).toFixed(2)),
            withinTolerance: withinTol,
            description:
              policy.matchingMode === 'THREE_WAY'
                ? `Invoiced quantity (${l.invoicedQuantity}) exceeds open accepted GRN quantity (${referenceOpenQty}) by ${qtyDiff} (${qtyVarPct}%).`
                : `Invoiced quantity (${l.invoicedQuantity}) exceeds open PO quantity (${referenceOpenQty}) by ${qtyDiff} (${qtyVarPct}%).`,
          });
        }

        // Check Unit Price Variance
        if (Math.abs(l.unitPrice - summary.poUnitPrice) > 0.0001) {
          const priceDiff = Number((l.unitPrice - summary.poUnitPrice).toFixed(2));
          const totalPriceImpact = Number((priceDiff * l.invoicedQuantity).toFixed(2));
          const priceVarPct =
            summary.poUnitPrice > 0
              ? Number(((Math.abs(priceDiff) / summary.poUnitPrice) * 100).toFixed(2))
              : 100;

          const withinTol =
            priceDiff <= 0 ||
            (priceVarPct <= policy.priceTolerancePercent &&
              totalPriceImpact <= policy.valueToleranceAmount);

          if (withinTol) {
            hasAnyVarianceWithinTolerance = true;
          } else {
            hasPriceMismatchBeyondTolerance = true;
          }

          variances.push({
            lineId,
            itemCode: l.itemCode,
            varianceType: 'UNIT_PRICE_VARIANCE',
            expectedValue: summary.poUnitPrice,
            invoicedValue: l.unitPrice,
            varianceAmount: totalPriceImpact,
            variancePercent: priceVarPct,
            allowedTolerancePercent: policy.priceTolerancePercent,
            allowedToleranceAmount: policy.valueToleranceAmount,
            withinTolerance: withinTol,
            description: `Invoiced unit price (₹${l.unitPrice}) differs from PO unit price (₹${summary.poUnitPrice}) by ${priceVarPct}% (Impact: ₹${totalPriceImpact}).`,
          });
        }

        // Check Tax Rate Variance
        if (Math.abs(l.taxPercent - summary.poTaxPercent) > 0.0001) {
          const taxDiff = Number((l.taxPercent - summary.poTaxPercent).toFixed(2));
          const withinTol = Math.abs(taxDiff) <= policy.taxTolerancePercent;

          if (withinTol) {
            hasAnyVarianceWithinTolerance = true;
          } else {
            hasTaxMismatchBeyondTolerance = true;
          }

          variances.push({
            lineId,
            itemCode: l.itemCode,
            varianceType: 'TAX_RATE_VARIANCE',
            expectedValue: summary.poTaxPercent,
            invoicedValue: l.taxPercent,
            varianceAmount: taxDiff,
            variancePercent: Math.abs(taxDiff),
            allowedTolerancePercent: policy.taxTolerancePercent,
            allowedToleranceAmount: 0,
            withinTolerance: withinTol,
            description: `Invoiced GST/Tax rate (${l.taxPercent}%) differs from PO tax rate (${summary.poTaxPercent}%).`,
          });
        }
      }

      const openPoAfter = Math.max(0, summary.remainingOpenPoQty - l.invoicedQuantity);
      const openGrnAfter = Math.max(0, summary.remainingOpenGrnQty - l.invoicedQuantity);
      remainingOpenPoQtyTotal += openPoAfter;
      remainingOpenGrnQtyTotal += openGrnAfter;

      return {
        id: lineId,
        invoiceId,
        poLineId: po?.lines.find((pl) => pl.itemCode === l.itemCode)?.id,
        grnLineIds: grns.flatMap((g) => g.lines.filter((gl) => gl.itemCode === l.itemCode).map((gl) => gl.id)),
        itemCode: l.itemCode,
        description: l.description || l.itemCode,
        uom: l.uom,
        invoicedQuantity: l.invoicedQuantity,
        unitPrice: l.unitPrice,
        netAmount: lineNet,
        taxPercent: l.taxPercent,
        taxAmount: lineTax,
        freightAmount: lineFreight,
        totalLineAmount: lineTotal,
        poOrderedQty: summary.poOrderedQty,
        poUnitPrice: summary.poUnitPrice,
        poTaxPercent: summary.poTaxPercent,
        grnAcceptedQty: summary.totalAcceptedGrnQty,
        grnRejectedQty: summary.totalRejectedGrnQty,
        previouslyInvoicedQty: summary.previouslyInvoicedQty,
        remainingOpenQtyAfterInvoice:
          policy.matchingMode === 'THREE_WAY' ? openGrnAfter : openPoAfter,
      };
    });

    // Check Header Freight Tolerance
    if (totalFreightAmount > policy.freightToleranceAmount && policy.matchingMode !== 'NO_MATCHING') {
      hasPriceMismatchBeyondTolerance = true;
      variances.push({
        lineId: 'HEADER-FREIGHT',
        itemCode: 'FREIGHT',
        varianceType: 'FREIGHT_VARIANCE',
        expectedValue: policy.freightToleranceAmount,
        invoicedValue: totalFreightAmount,
        varianceAmount: totalFreightAmount - policy.freightToleranceAmount,
        variancePercent: 100,
        allowedTolerancePercent: 0,
        allowedToleranceAmount: policy.freightToleranceAmount,
        withinTolerance: false,
        description: `Freight charge (₹${totalFreightAmount}) exceeds allowed freight tolerance (₹${policy.freightToleranceAmount}).`,
      });
    }

    // Determine Authoritative Matching Outcome (All 11 Outcomes supported)
    let outcome: InvoiceMatchingOutcome = 'MATCHED';
    let canPostToAccounting = false;
    let postingStatus: SupplierInvoiceRecord['postingStatus'] = 'ON_HOLD';

    if (isDuplicate) {
      outcome = 'DUPLICATE_INVOICE';
      canPostToAccounting = false;
      postingStatus = 'BLOCKED';
    } else if (policy.matchingMode !== 'NO_MATCHING' && !po) {
      outcome = 'MISSING_PO';
      canPostToAccounting = false;
      postingStatus = 'BLOCKED';
      variances.push({
        lineId: 'HEADER-PO',
        itemCode: 'PO-REF',
        varianceType: 'MISSING_PO_REFERENCE',
        expectedValue: 1,
        invoicedValue: 0,
        varianceAmount: 1,
        variancePercent: 100,
        allowedTolerancePercent: 0,
        allowedToleranceAmount: 0,
        withinTolerance: false,
        description: `Purchase Order reference '${params.poNumber || 'NONE'}' not found for ${policy.matchingMode} matching.`,
      });
    } else if (policy.matchingMode === 'THREE_WAY' && grns.length === 0) {
      outcome = 'MISSING_GRN';
      canPostToAccounting = false;
      postingStatus = 'BLOCKED';
      variances.push({
        lineId: 'HEADER-GRN',
        itemCode: 'GRN-REF',
        varianceType: 'MISSING_GRN_FOR_3WAY',
        expectedValue: 1,
        invoicedValue: 0,
        varianceAmount: 1,
        variancePercent: 100,
        allowedTolerancePercent: 0,
        allowedToleranceAmount: 0,
        withinTolerance: false,
        description: `Three-Way Matching Failed: No posted Goods Receipt Note (GRN) exists for PO ${po?.poNumber}.`,
      });
    } else if (hasQuantityMismatchBeyondTolerance) {
      outcome = 'QUANTITY_MISMATCH';
      canPostToAccounting = false;
      postingStatus = policy.requireExceptionApproval ? 'ON_HOLD' : 'BLOCKED';
    } else if (hasPriceMismatchBeyondTolerance) {
      outcome = 'PRICE_MISMATCH';
      canPostToAccounting = false;
      postingStatus = policy.requireExceptionApproval ? 'ON_HOLD' : 'BLOCKED';
    } else if (hasTaxMismatchBeyondTolerance) {
      outcome = 'TAX_MISMATCH';
      canPostToAccounting = false;
      postingStatus = policy.requireExceptionApproval ? 'ON_HOLD' : 'BLOCKED';
    } else if (hasOtherBlockVariance) {
      outcome = 'BLOCKED';
      canPostToAccounting = false;
      postingStatus = 'BLOCKED';
    } else if (hasAnyVarianceWithinTolerance) {
      outcome = 'MATCHED_WITHIN_TOLERANCE';
      canPostToAccounting = true;
      postingStatus = 'READY_FOR_POSTING';
    } else {
      outcome = 'MATCHED';
      canPostToAccounting = true;
      postingStatus = 'READY_FOR_POSTING';
    }

    const snapshot: InvoiceMatchingSnapshot = {
      snapshotId: `im-snap-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      matchedAt: nowIso,
      matchedBy: params.createdBy,
      policyId: policy.id,
      policyVersion: policy.version,
      policyEffectiveFrom: policy.effectiveFrom,
      matchingModeUsed: policy.matchingMode,
      tolerancesUsed: {
        quantityTolerancePercent: policy.quantityTolerancePercent,
        priceTolerancePercent: policy.priceTolerancePercent,
        valueToleranceAmount: policy.valueToleranceAmount,
        taxTolerancePercent: policy.taxTolerancePercent,
        freightToleranceAmount: policy.freightToleranceAmount,
        overInvoiceTolerancePercent: policy.overInvoiceTolerancePercent,
        allowPartialInvoices: policy.allowPartialInvoices,
        allowMultipleInvoices: policy.allowMultipleInvoices,
      },
      poSnapshot: po
        ? {
            poId: po.id,
            poNumber: po.poNumber,
            vendorId: po.vendorId,
            totalOrderedQty: po.lines.reduce((s, l) => s + l.orderQtyPurchUom, 0),
            totalNetValue: po.totalNetValue,
          }
        : undefined,
      grnSnapshots: grns.map((g) => ({
        grnId: g.id,
        grnNumber: g.grnNumber,
        receiptDate: g.receiptDate,
        acceptedQtyPurchUom: g.lines.reduce(
          (s, gl) => s + (gl.acceptedQtyPurchUom ?? gl.acceptedQtyInvUom / (gl.conversionRatio || 1)),
          0
        ),
        rejectedQtyPurchUom: g.lines.reduce(
          (s, gl) => s + (gl.rejectedQtyPurchUom ?? gl.rejectedQtyInvUom / (gl.conversionRatio || 1)),
          0
        ),
      })),
      cumulativePreviouslyInvoicedQty: cumulativePrevInvoiced,
      currentInvoiceQty: currentTotalInvoiceQty,
      remainingOpenPoQty: remainingOpenPoQtyTotal,
      remainingOpenGrnQty: remainingOpenGrnQtyTotal,
      variances,
      outcome,
      canPostToAccounting,
    };

    const totalGrossAmount = Number(
      (totalNetAmount + totalTaxAmount + totalFreightAmount).toFixed(2)
    );

    const record: SupplierInvoiceRecord = {
      id: invoiceId,
      internalInvoiceNumber,
      supplierInvoiceNumber: params.supplierInvoiceNumber.trim(),
      invoiceDate,
      companyId: normCo,
      companyCode: params.companyCode || po?.companyCode || 'KOSH-HQ',
      branchId: normBr,
      branchCode: params.branchCode || po?.branchCode || '001',
      branchName: params.branchName || po?.branchName || 'Puducherry Plant',
      purchaseOrgId: params.purchaseOrgId || po?.purchaseOrgId || 'po-kosh-01',
      vendorId: params.vendorId,
      vendorCode: params.vendorCode || po?.vendorCode || 'VEND-BASF-01',
      vendorName: params.vendorName || po?.vendorName || 'BASF INDIA LIMITED',
      poId: po?.id,
      poNumber: po?.poNumber || params.poNumber,
      grnIds: grns.map((g) => g.id),
      grnNumbers: grns.map((g) => g.grnNumber),
      transactionType: params.transactionType || 'MATERIAL',
      invoiceType: params.invoiceType || 'STANDARD',
      isFinalInvoice: params.isFinalInvoice ?? remainingOpenPoQtyTotal === 0,
      isFinalDelivery: grns.some((g) => g.isFinalDelivery),
      currency: params.currency || po?.currency || 'INR',
      totalNetAmount: Number(totalNetAmount.toFixed(2)),
      totalTaxAmount: Number(totalTaxAmount.toFixed(2)),
      totalFreightAmount: Number(totalFreightAmount.toFixed(2)),
      totalGrossAmount,
      lines: formattedLines,
      matchingOutcome: outcome,
      postingStatus,
      matchingSnapshot: snapshot,
      matchingHistory: [snapshot],
      supportingAttachments: [],
      financialYearId: fyValidation.snapshot.financialYearId,
      financialYearCode: fyValidation.snapshot.financialYearCode,
      accountingPeriodId: fyValidation.snapshot.accountingPeriodId,
      accountingPeriodCode: fyValidation.snapshot.accountingPeriodCode,
      accountingPostingDate,
      fySnapshot: fyValidation.snapshot,
      createdBy: params.createdBy,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    invoices.unshift(record);
    this.saveInvoices(invoices);
    return record;
  },

  /**
   * O7. Places an invoice with variance into PENDING_EXCEPTION_APPROVAL and routes it for review.
   */
  requestInvoiceExceptionApproval(params: {
    invoiceId: string;
    requestedBy: string;
    varianceJustification: string;
  }): SupplierInvoiceRecord {
    if (!params.varianceJustification || !params.varianceJustification.trim()) {
      throw new Error('Mandatory variance justification is required to request invoice exception approval.');
    }
    const invoices = this.getInvoices();
    const inv = invoices.find(
      (i) => i.id === params.invoiceId || i.internalInvoiceNumber === params.invoiceId
    );
    if (!inv) {
      throw new Error(`Invoice ${params.invoiceId} not found.`);
    }
    if (inv.matchingOutcome === 'DUPLICATE_INVOICE') {
      throw new Error('Duplicate invoices cannot be overridden via variance exception approval.');
    }

    const exceptionRecord: InvoiceExceptionApprovalRecord = {
      id: `im-exc-${Date.now()}`,
      invoiceId: inv.id,
      supplierInvoiceNumber: inv.supplierInvoiceNumber,
      requestedBy: params.requestedBy,
      requestedAt: new Date().toISOString(),
      varianceJustification: params.varianceJustification.trim(),
      status: 'PENDING',
    };

    inv.matchingOutcome = 'PENDING_EXCEPTION_APPROVAL';
    inv.postingStatus = 'PENDING_EXCEPTION_APPROVAL';
    inv.matchingSnapshot.exceptionRecord = exceptionRecord;
    inv.updatedAt = new Date().toISOString();

    this.saveInvoices(invoices);
    return inv;
  },

  /**
   * O7. Approves or Rejects an Invoice Matching Exception.
   * When approved, transitions outcome to APPROVED_FOR_POSTING and releases invoice for accounting posting.
   */
  resolveInvoiceExceptionApproval(params: {
    invoiceId: string;
    approvedBy: string;
    decision: 'APPROVE' | 'REJECT';
    approverRemarks: string;
  }): SupplierInvoiceRecord {
    const invoices = this.getInvoices();
    const inv = invoices.find(
      (i) => i.id === params.invoiceId || i.internalInvoiceNumber === params.invoiceId
    );
    if (!inv) {
      throw new Error(`Invoice ${params.invoiceId} not found.`);
    }

    const exc = inv.matchingSnapshot.exceptionRecord;
    if (exc && exc.requestedBy === params.approvedBy) {
      throw new Error('Maker-Checker Violation: Exception requester cannot approve their own invoice variance exception.');
    }

    const nowIso = new Date().toISOString();
    if (params.decision === 'APPROVE') {
      inv.matchingOutcome = 'APPROVED_FOR_POSTING';
      inv.postingStatus = 'READY_FOR_POSTING';
      inv.matchingSnapshot.outcome = 'APPROVED_FOR_POSTING';
      inv.matchingSnapshot.canPostToAccounting = true;
      if (exc) {
        exc.status = 'APPROVED';
        exc.approvedBy = params.approvedBy;
        exc.approvedAt = nowIso;
        exc.approverRemarks = params.approverRemarks || 'Authorized variance exception approved for posting.';
      }
    } else {
      inv.matchingOutcome = 'BLOCKED';
      inv.postingStatus = 'BLOCKED';
      inv.matchingSnapshot.outcome = 'BLOCKED';
      inv.matchingSnapshot.canPostToAccounting = false;
      if (exc) {
        exc.status = 'REJECTED';
        exc.approvedBy = params.approvedBy;
        exc.approvedAt = nowIso;
        exc.approverRemarks = params.approverRemarks || 'Variance exception rejected; invoice blocked.';
      }
    }

    inv.updatedAt = nowIso;
    this.saveInvoices(invoices);

    EnterpriseAuditService.logEvent({
      companyId: inv.companyId,
      branchId: inv.branchId,
      entityType: 'APPROVAL_MAPPING',
      entityId: inv.internalInvoiceNumber,
      eventType: `INVOICE_EXCEPTION_${params.decision}`,
      eventDescription: `${params.decision === 'APPROVE' ? 'Approved' : 'Rejected'} Invoice Variance Exception for ${inv.supplierInvoiceNumber} (${inv.internalInvoiceNumber})`,
      changedByUserId: 'usr-checker-03',
      changedByName: params.approvedBy,
      changeReason: params.approverRemarks,
      newValue: {
        internalInvoiceNumber: inv.internalInvoiceNumber,
        supplierInvoiceNumber: inv.supplierInvoiceNumber,
        matchingOutcome: inv.matchingOutcome,
        postingStatus: inv.postingStatus,
      },
    });

    return inv;
  },
};
