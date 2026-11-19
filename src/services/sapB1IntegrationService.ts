/**
 * KOSH INNOVATIONS — SAP BUSINESS ONE 10.0 HANA SERVICE LAYER INTEGRATION & TRACEABILITY SERVICE
 *
 * Governs:
 * 1. SAP Business One 10.0 HANA Service Layer payload construction:
 *    - Inventory PR (`PurchaseRequests`, `DocType: 'dDocument_Items'`)
 *    - Expense PR (`PurchaseRequests`, `DocType: 'dDocument_Service'` — never creates dummy inventory items)
 *    - Purchase Order conversion (`PurchaseOrders` with `DocumentAdditionalExpenses` mapped from approved Charge Items)
 * 2. Pre-posting governance & SAP Expense Code / GL Account / Tax Code validation.
 * 3. Integration status state machine:
 *    `NOT_STARTED` -> `PENDING` -> `INTEGRATED` | `FAILED` | `REQUIRES_RECONCILIATION`
 * 4. Idempotency protection & mandatory Reconcile-Before-Retry safeguard (never creating duplicate SAP documents).
 * 5. Full honesty boundary: clearly distinguishes simulated Service Layer verification vs live SAP B1 HANA endpoint execution.
 */

import {
  PurchaseRequisitionHeader,
  SapIntegrationTraceRecord,
  SapIntegrationStatus,
  SapIntegrationHistoryEntry,
  PRChargeItem,
} from '../types/purchaseRequisition';
import { PurchaseRequisitionService as purchaseRequisitionService } from './purchaseRequisitionService';
import { expenseCategoryService } from './expenseCategoryService';
import { chargeMappingService } from './chargeMappingService';
import { EnterpriseAuditService } from './enterpriseAuditService';

export interface SapPurchaseRequestItemLinePayload {
  LineNum: number;
  ItemCode: string;
  ItemDescription: string;
  Quantity: number;
  MeasureUnit: string;
  UnitPrice: number;
  LineTotal: number;
  WarehouseCode?: string;
  CostingCode?: string;
  TaxCode?: string;
  RequiredDate?: string;
  U_KoshPrLineId?: string;
}

export interface SapPurchaseRequestServiceLinePayload {
  LineNum: number;
  AccountCode: string;
  ItemDescription: string;
  LineTotal: number;
  TaxCode: string;
  CostingCode: string;
  RequiredDate: string;
  U_KoshServiceFromDate: string;
  U_KoshServiceToDate: string;
  U_KoshExpenseCat: string;
  U_KoshBusinessJustif: string;
  U_KoshVendorSuggestion?: string;
  U_KoshPrLineId?: string;
}

export interface SapAdditionalExpensePayload {
  ExpenseCode: string | number;
  ExpenseName: string;
  AccountCode: string;
  LineTotal: number;
  TaxCode: string;
  DistributionMethod: 'aedm_RowTotal' | 'aedm_Quantity' | 'aedm_Weight' | 'aedm_Volume' | 'aedm_Equally';
  Remarks?: string;
  U_KoshChargeCode: string;
  U_KoshChargeLevel: 'HEADER' | 'LINE';
  U_KoshPrLineId?: string;
}

export interface SapServiceLayerPrPayload {
  endpoint: '/b1s/v2/PurchaseRequests';
  DocType: 'dDocument_Items' | 'dDocument_Service';
  DocDate: string;
  DocDueDate: string;
  RequriedDate: string;
  DocCurrency: string;
  BPL_IDAssignedToInvoice: number;
  Requester: string;
  RequesterName: string;
  RequesterDepartment: string;
  Comments: string;
  U_KoshPrId: string;
  U_KoshPrNumber: string;
  U_KoshPrType: string;
  U_KoshCompanyCode: string;
  U_KoshBranchCode: string;
  U_KoshIdempotencyKey: string;
  DocumentLines: Array<SapPurchaseRequestItemLinePayload | SapPurchaseRequestServiceLinePayload | any>;
  DocumentAdditionalExpensesPreview?: SapAdditionalExpensePayload[];
  valid?: boolean;
  errors?: string[];
  payload?: SapServiceLayerPrPayload;
}

export interface SapServiceLayerPoPayload {
  endpoint: '/b1s/v2/PurchaseOrders';
  DocType: 'dDocument_Items' | 'dDocument_Service';
  CardCode: string;
  DocDate: string;
  DocDueDate: string;
  DocCurrency: string;
  BPL_IDAssignedToInvoice: number;
  Comments: string;
  U_KoshSourcePrNumber: string;
  U_KoshPoNumber: string;
  DocumentLines: Array<Record<string, unknown>>;
  DocumentAdditionalExpenses: SapAdditionalExpensePayload[];
}

function resolveSapBranchBplId(branchId: string): number {
  const map: Record<string, number> = {
    'br-pond-01': 1,
    'branch-001': 1,
    'BR-001': 1,
    'br-chen-02': 2,
    'branch-002': 2,
    'BR-002': 2,
    'br-coim-03': 3,
    'br-hosur-04': 4,
    'br-bglr-05': 5,
    'br-pune-06': 6,
  };
  return map[branchId] || 1;
}

function mapAllocationToSapDistMethod(
  allocationBasis?: string
): SapAdditionalExpensePayload['DistributionMethod'] {
  switch (allocationBasis) {
    case 'PROPORTIONAL_QUANTITY':
      return 'aedm_Quantity';
    case 'PROPORTIONAL_WEIGHT':
      return 'aedm_Weight';
    case 'PROPORTIONAL_VOLUME':
      return 'aedm_Volume';
    case 'EQUAL_DISTRIBUTION':
      return 'aedm_Equally';
    default:
      return 'aedm_RowTotal';
  }
}

let deterministicSapDocEntryCounter = 910400;
const inMemoryTraceStore: Record<string, SapIntegrationTraceRecord> = {};

export const sapB1IntegrationService = {
  resetForTesting(): void {
    deterministicSapDocEntryCounter = 910400;
    for (const k of Object.keys(inMemoryTraceStore)) {
      delete inMemoryTraceStore[k];
    }
  },

  resetTraces(): void {
    this.resetForTesting();
  },

  getTraceForPr(prIdOrNumber: string): SapIntegrationTraceRecord | undefined {
    if (inMemoryTraceStore[prIdOrNumber]) {
      return inMemoryTraceStore[prIdOrNumber];
    }
    const prs = purchaseRequisitionService.getPurchaseRequisitions();
    const found = prs.find((p) => p.id === prIdOrNumber || p.prNumber === prIdOrNumber);
    return found?.sapIntegration || found?.sapIntegrationTrace;
  },

  /**
   * Builds SAP AdditionalExpenses rows from approved PR Header and Line Charge Items.
   */
  buildSapAdditionalExpensesFromPr(pr: PurchaseRequisitionHeader): {
    valid: boolean;
    errors: string[];
    expenses: SapAdditionalExpensePayload[];
  } {
    const errors: string[] = [];
    const expenses: SapAdditionalExpensePayload[] = [];
    if (pr.prType === 'EXPENSE') {
      return { valid: true, errors: [], expenses: [] };
    }

    const effectiveOptions = chargeMappingService.resolveEffectiveMappingsForScope(
      pr.companyId,
      pr.branchId,
      (pr.createdAt || new Date().toISOString()).slice(0, 10)
    );

    const resolveChargeSapMeta = (c: PRChargeItem, level: 'HEADER' | 'LINE', prLineId?: string) => {
      if (c.applicability === 'NOT_APPLICABLE' || Number(c.estimatedAmount || 0) <= 0) {
        return;
      }
      const mappedOpt = effectiveOptions.find(
        (o) =>
          o.chargeCode.toUpperCase() === c.chargeCode.toUpperCase() ||
          (c.chargeMasterId && o.chargeMasterId === c.chargeMasterId)
      );
      const sapExpenseCode = c.sapExpenseCode ?? mappedOpt?.sapExpenseCode;
      const sapGlAccountCode = c.sapGlAccountCode || mappedOpt?.sapGlAccountCode;
      const taxCode =
        c.taxCode ||
        mappedOpt?.taxCode ||
        (c.gstRatePercent ? `DOM-GST-${c.gstRatePercent}` : 'DOM-EXEMPT-0');

      if (sapExpenseCode === undefined || sapExpenseCode === null || sapExpenseCode === '') {
        errors.push(`Charge "${c.chargeCode}" (${c.chargeName}) is missing a mapped SAP Expense Code.`);
        return;
      }
      if (!sapGlAccountCode) {
        errors.push(`Charge "${c.chargeCode}" (${c.chargeName}) is missing a mapped SAP GL Account Code.`);
        return;
      }

      expenses.push({
        ExpenseCode: sapExpenseCode,
        ExpenseName: c.sapExpenseName || mappedOpt?.sapExpenseName || c.chargeName,
        AccountCode: sapGlAccountCode,
        LineTotal: Number(Number(c.estimatedAmount || 0).toFixed(2)),
        TaxCode: taxCode,
        DistributionMethod: mapAllocationToSapDistMethod(c.allocationBasis || mappedOpt?.allocationBasis),
        Remarks: c.remarks || `${level} Charge on ${pr.prNumber}`,
        U_KoshChargeCode: c.chargeCode,
        U_KoshChargeLevel: level,
        U_KoshPrLineId: prLineId,
      });
    };

    for (const hc of pr.chargeItems || []) {
      resolveChargeSapMeta(hc, 'HEADER');
    }
    for (const line of pr.lines || []) {
      for (const lc of line.lineCharges || []) {
        resolveChargeSapMeta(lc, 'LINE', line.id);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      expenses,
    };
  },

  /**
   * Validates and builds the SAP Business One 10.0 HANA Service Layer PurchaseRequests payload.
   * - Inventory PR -> `dDocument_Items`
   * - Expense PR -> `dDocument_Service` (never creates dummy inventory items)
   */
  buildSapPurchaseRequestPayload(
    pr: PurchaseRequisitionHeader,
    idempotencyKey?: string
  ): SapServiceLayerPrPayload & {
    valid: boolean;
    errors: string[];
    payload?: SapServiceLayerPrPayload;
  } {
    const readiness = purchaseRequisitionService.validateSapB1TransactionReadiness(pr);
    const errors: string[] = [...readiness.blockingReasons];

    const docDate = (pr.createdAt || new Date().toISOString()).slice(0, 10);
    const dueDate =
      pr.expectedServiceDate ||
      pr.expectedDeliveryDate ||
      pr.requiredBy ||
      docDate;
    const bplId = resolveSapBranchBplId(pr.branchId);
    const idemKey =
      idempotencyKey ||
      pr.sapIntegration?.idempotencyKey ||
      pr.sapIntegrationTrace?.idempotencyKey ||
      `sap-pr-${pr.companyId}-${pr.prNumber}-v${pr.optimisticVersion || 1}`;

    if (pr.prType === 'EXPENSE') {
      const expVal = expenseCategoryService.validateExpenseLinesForPr({
        companyId: pr.companyId,
        branchId: pr.branchId,
        department: pr.department,
        userId: pr.requesterId,
        expenseLines: pr.expenseLines || [],
        headerCostCentre: pr.costCentre,
        headerExpectedServiceDate: dueDate,
        headerBusinessJustification: pr.businessJustification,
        asOfDate: docDate,
      });
      if (!expVal.valid) {
        errors.push(...expVal.errors);
      }

      const serviceLines: SapPurchaseRequestServiceLinePayload[] = expVal.normalizedLines.map(
        (el, idx) => ({
          LineNum: idx,
          AccountCode: el.sapGlAccountCode,
          ItemDescription: el.expenseDescription || el.description,
          LineTotal: el.baseAmount,
          TaxCode: el.taxCode,
          CostingCode: el.costCentre || el.costCenter,
          RequiredDate: el.serviceToDate || el.serviceFromDate || el.expectedServiceDate || dueDate,
          U_KoshServiceFromDate: el.serviceFromDate || el.expectedServiceDate || dueDate,
          U_KoshServiceToDate: el.serviceToDate || el.expectedServiceDate || dueDate,
          U_KoshExpenseCat: el.expenseCategoryCode,
          U_KoshBusinessJustif: el.businessJustification || pr.businessJustification,
          U_KoshVendorSuggestion: el.vendorSuggestion || el.vendorOrPayee,
          U_KoshPrLineId: el.id,
        })
      );

      const corePayload: SapServiceLayerPrPayload = {
        endpoint: '/b1s/v2/PurchaseRequests',
        DocType: 'dDocument_Service',
        DocDate: docDate,
        DocDueDate: dueDate,
        RequriedDate: dueDate,
        DocCurrency: (pr.currency || 'INR').toUpperCase(),
        BPL_IDAssignedToInvoice: bplId,
        Requester: pr.requesterId,
        RequesterName: pr.requesterName,
        RequesterDepartment: pr.department,
        Comments: `${pr.purchasePurpose} | Justification: ${pr.businessJustification}`,
        U_KoshPrId: pr.id,
        U_KoshPrNumber: pr.prNumber,
        U_KoshPrType: pr.prType,
        U_KoshCompanyCode: pr.companyCode,
        U_KoshBranchCode: pr.branchCode,
        U_KoshIdempotencyKey: idemKey,
        DocumentLines: serviceLines,
      };

      const uniqueErrs = Array.from(new Set(errors));
      return {
        ...corePayload,
        valid: uniqueErrs.length === 0,
        errors: uniqueErrs,
        payload: uniqueErrs.length === 0 ? corePayload : undefined,
      };
    }

    // Inventory PR (`dDocument_Items`)
    if (!pr.lines || pr.lines.length === 0) {
      errors.push('Inventory PR must contain at least one valid inventory item line.');
    }

    const itemLines: SapPurchaseRequestItemLinePayload[] = (pr.lines || []).map((line, idx) => {
      if (!line.itemCode || !line.itemCode.trim()) {
        errors.push(`Line #${idx + 1} is missing a valid SAP ItemCode.`);
      }
      if ((Number(line.requestedQuantity) || 0) <= 0) {
        errors.push(`Line #${idx + 1} (${line.itemCode}) must have a positive requested quantity.`);
      }
      const qty = Number(line.requestedQuantity) || 0;
      const unitPrice = Number(line.approximateUnitPrice) || 0;
      return {
        LineNum: idx,
        ItemCode: line.itemCode,
        ItemDescription: line.description,
        Quantity: qty,
        MeasureUnit: line.inventoryUom || 'EA',
        UnitPrice: unitPrice,
        LineTotal: Number((qty * unitPrice).toFixed(2)),
        WarehouseCode: line.defaultWarehouse || 'WH-MAIN-01',
        CostingCode: pr.costCentre,
        TaxCode: line.taxCode || 'DOM-GST-18',
        RequiredDate: line.deliverySchedules?.[0]?.deliveryDate || dueDate,
        U_KoshPrLineId: line.id,
      };
    });

    const addExpResult = this.buildSapAdditionalExpensesFromPr(pr);
    if (!addExpResult.valid) {
      errors.push(...addExpResult.errors);
    }

    const corePayload: SapServiceLayerPrPayload = {
      endpoint: '/b1s/v2/PurchaseRequests',
      DocType: 'dDocument_Items',
      DocDate: docDate,
      DocDueDate: dueDate,
      RequriedDate: dueDate,
      DocCurrency: (pr.currency || 'INR').toUpperCase(),
      BPL_IDAssignedToInvoice: bplId,
      Requester: pr.requesterId,
      RequesterName: pr.requesterName,
      RequesterDepartment: pr.department,
      Comments: pr.purchasePurpose,
      U_KoshPrId: pr.id,
      U_KoshPrNumber: pr.prNumber,
      U_KoshPrType: pr.prType,
      U_KoshCompanyCode: pr.companyCode,
      U_KoshBranchCode: pr.branchCode,
      U_KoshIdempotencyKey: idemKey,
      DocumentLines: itemLines,
      DocumentAdditionalExpensesPreview: addExpResult.expenses,
    };

    const uniqueErrs = Array.from(new Set(errors));
    return {
      ...corePayload,
      valid: uniqueErrs.length === 0,
      errors: uniqueErrs,
      payload: uniqueErrs.length === 0 ? corePayload : undefined,
    };
  },

  /**
   * Builds SAP Business One 10.0 HANA Service Layer PurchaseOrders payload during PR -> PO conversion,
   * carrying both inventory/service lines and AdditionalExpenses mapped from approved PR Charge Items.
   */
  buildSapPurchaseOrderPayloadFromPr(
    pr: PurchaseRequisitionHeader,
    poNumber: string,
    vendorCardCode: string
  ): {
    valid: boolean;
    errors: string[];
    payload?: SapServiceLayerPoPayload;
  } {
    const prPayloadRes = this.buildSapPurchaseRequestPayload(pr);
    if (!prPayloadRes.valid || !prPayloadRes.payload) {
      return { valid: false, errors: prPayloadRes.errors };
    }
    const addExpRes = this.buildSapAdditionalExpensesFromPr(pr);
    if (!addExpRes.valid) {
      return { valid: false, errors: addExpRes.errors };
    }

    const baseDocEntry = pr.sapIntegration?.sapDocEntry || pr.sapIntegrationTrace?.sapPrDocEntry;
    const poLines = prPayloadRes.payload.DocumentLines.map((line, idx) => ({
      ...line,
      BaseType: baseDocEntry ? 1470000113 : -1, // 1470000113 = SAP B1 PurchaseRequest object type
      BaseEntry: baseDocEntry,
      BaseLine: idx,
    }));

    return {
      valid: true,
      errors: [],
      payload: {
        endpoint: '/b1s/v2/PurchaseOrders',
        DocType: prPayloadRes.payload.DocType,
        CardCode: vendorCardCode || 'V-DEFAULT-01',
        DocDate: new Date().toISOString().slice(0, 10),
        DocDueDate: prPayloadRes.payload.DocDueDate,
        DocCurrency: prPayloadRes.payload.DocCurrency,
        BPL_IDAssignedToInvoice: prPayloadRes.payload.BPL_IDAssignedToInvoice,
        Comments: `Created from Approved PR ${pr.prNumber}`,
        U_KoshSourcePrNumber: pr.prNumber,
        U_KoshPoNumber: poNumber,
        DocumentLines: poLines,
        DocumentAdditionalExpenses: addExpRes.expenses,
      },
    };
  },

  /**
   * Posts an approved PR to SAP Business One 10.0 HANA Service Layer (or simulated adapter in test/preview environments)
   * with full state machine transitions, idempotency protection, and mandatory Reconcile-Before-Retry guard.
   */
  postPrToSapServiceLayer(
    prOrId: string | PurchaseRequisitionHeader,
    options?: {
      actorName?: string;
      idempotencyKey?: string;
      simulateFailureMode?: 'NONE' | 'VALIDATION_ERROR' | 'TIMEOUT_UNCERTAIN' | 'TRANSIENT_ERROR';
      simulateMode?: 'NONE' | 'VALIDATION_ERROR' | 'TIMEOUT_AMBIGUOUS' | 'TIMEOUT_UNCERTAIN' | 'TRANSIENT_ERROR';
    }
  ): {
    success: boolean;
    duplicateBlocked?: boolean;
    blockedByReconciliationGuard?: boolean;
    status: SapIntegrationStatus;
    message: string;
    trace: SapIntegrationTraceRecord;
    payload?: SapServiceLayerPrPayload;
    executionMode: 'SIMULATED_SERVICE_LAYER' | 'LIVE_SERVICE_LAYER';
  } {
    const prs = purchaseRequisitionService.getPurchaseRequisitions();
    const targetId = typeof prOrId === 'string' ? prOrId : prOrId.id;
    const idx = prs.findIndex((p) => p.id === targetId || p.prNumber === targetId);
    const pr = idx >= 0 ? prs[idx] : typeof prOrId === 'object' ? prOrId : undefined;

    if (!pr) {
      throw new Error(`Purchase Requisition "${targetId}" not found.`);
    }

    const actor = options?.actorName || 'SAP Integration Service';
    const nowIso = new Date().toISOString();
    const existingTrace: SapIntegrationTraceRecord =
      inMemoryTraceStore[pr.id] ||
      pr.sapIntegration ||
      pr.sapIntegrationTrace || {
        status: 'NOT_STARTED',
        targetEntity: 'PurchaseRequests',
        sapObjectType: 'PurchaseRequests',
        sapDocType: pr.prType === 'EXPENSE' ? 'dDocument_Service' : 'dDocument_Items',
        retryCount: 0,
        attemptCount: 0,
        reconciliationRequired: false,
        history: [],
      };

    const persistTrace = (trace: SapIntegrationTraceRecord) => {
      inMemoryTraceStore[pr.id] = trace;
      inMemoryTraceStore[pr.prNumber] = trace;
      pr.sapIntegration = trace;
      pr.sapIntegrationTrace = trace;
      if (typeof prOrId === 'object') {
        prOrId.sapIntegration = trace;
        prOrId.sapIntegrationTrace = trace;
      }
      if (idx >= 0) {
        prs[idx] = pr;
        purchaseRequisitionService.savePurchaseRequisitions(prs);
      }
    };

    // 1. Idempotency Guard: If already INTEGRATED, never create a duplicate SAP PR
    if (existingTrace.status === 'INTEGRATED' && (existingTrace.sapDocEntry || existingTrace.sapPrDocEntry)) {
      return {
        success: true,
        duplicateBlocked: true,
        status: 'INTEGRATED',
        message: `Idempotency Guard: PR ${pr.prNumber} is already integrated with SAP Business One (DocEntry ${existingTrace.sapDocEntry || existingTrace.sapPrDocEntry}, DocNum ${existingTrace.sapDocNum || existingTrace.sapPrDocNum}). Duplicate posting blocked.`,
        trace: existingTrace,
        executionMode: 'SIMULATED_SERVICE_LAYER',
      };
    }

    // 2. Mandatory Reconcile-Before-Retry Guard: If REQUIRES_RECONCILIATION, block blind retries
    if (existingTrace.status === 'REQUIRES_RECONCILIATION' || existingTrace.reconciliationRequired) {
      const blockedHistory: SapIntegrationHistoryEntry = {
        id: `saph-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        timestamp: nowIso,
        status: 'REQUIRES_RECONCILIATION',
        action: 'RETRY_BLOCKED',
        actorName: actor,
        errorMessage:
          'Retry blocked: Previous SAP Service Layer call timed out or returned an uncertain state. Reconcile against SAP before retrying to prevent duplicate SAP documents.',
      };
      const updatedTrace: SapIntegrationTraceRecord = {
        ...existingTrace,
        status: 'REQUIRES_RECONCILIATION',
        reconciliationRequired: true,
        history: [...existingTrace.history, blockedHistory],
      };
      persistTrace(updatedTrace);
      return {
        success: false,
        blockedByReconciliationGuard: true,
        status: 'REQUIRES_RECONCILIATION',
        message: blockedHistory.errorMessage!,
        trace: updatedTrace,
        executionMode: 'SIMULATED_SERVICE_LAYER',
      };
    }

    const simMode = options?.simulateFailureMode || options?.simulateMode || 'NONE';

    // 3. Build & Validate SAP Service Layer Payload
    const idemKey =
      options?.idempotencyKey ||
      existingTrace.idempotencyKey ||
      `sap-pr-${pr.companyId}-${pr.prNumber}-v${pr.optimisticVersion || 1}`;
    const buildRes = this.buildSapPurchaseRequestPayload(pr, idemKey);

    if (!buildRes.valid || !buildRes.payload || simMode === 'VALIDATION_ERROR') {
      const errMsg =
        simMode === 'VALIDATION_ERROR'
          ? 'Simulated SAP Service Layer mapping validation error.'
          : buildRes.errors.join(' | ');
      const failEntry: SapIntegrationHistoryEntry = {
        id: `saph-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        timestamp: nowIso,
        status: 'FAILED',
        action: (existingTrace.retryCount || 0) > 0 ? 'RETRIED' : 'POST_INITIATED',
        actorName: actor,
        errorCode: 'SAP_PRECHECK_FAILED',
        errorMessage: errMsg,
      };
      const failedTrace: SapIntegrationTraceRecord = {
        ...existingTrace,
        status: 'FAILED',
        idempotencyKey: idemKey,
        lastAttemptAt: nowIso,
        retryCount: (existingTrace.retryCount || 0) + 1,
        attemptCount: (existingTrace.attemptCount || 0) + 1,
        errorCode: 'SAP_PRECHECK_FAILED',
        errorMessage: errMsg,
        reconciliationRequired: false,
        history: [...existingTrace.history, failEntry],
      };
      persistTrace(failedTrace);
      return {
        success: false,
        status: 'FAILED',
        message: `SAP B1 Integration Pre-Check Failed: ${errMsg}`,
        trace: failedTrace,
        executionMode: 'SIMULATED_SERVICE_LAYER',
      };
    }

    // 4. Handle Simulated Timeout / Uncertain State -> REQUIRES_RECONCILIATION
    if (simMode === 'TIMEOUT_UNCERTAIN' || simMode === 'TIMEOUT_AMBIGUOUS') {
      const uncertainMsg =
        'SAP Service Layer HTTP 504 Gateway Timeout after payload dispatch; transaction commit state in SAP HANA is uncertain. Marked REQUIRES_RECONCILIATION.';
      const reconEntry: SapIntegrationHistoryEntry = {
        id: `saph-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        timestamp: nowIso,
        status: 'REQUIRES_RECONCILIATION',
        action: 'MARKED_RECONCILIATION',
        actorName: actor,
        errorCode: 'SAP_SL_TIMEOUT_504',
        errorMessage: uncertainMsg,
        payloadSummary: `${buildRes.payload.endpoint} (${buildRes.payload.DocType})`,
      };
      const reconTrace: SapIntegrationTraceRecord = {
        ...existingTrace,
        status: 'REQUIRES_RECONCILIATION',
        idempotencyKey: idemKey,
        lastAttemptAt: nowIso,
        retryCount: (existingTrace.retryCount || 0) + 1,
        attemptCount: (existingTrace.attemptCount || 0) + 1,
        errorCode: 'SAP_SL_TIMEOUT_504',
        errorMessage: uncertainMsg,
        reconciliationRequired: true,
        payloadSnapshot: buildRes.payload as unknown as Record<string, unknown>,
        history: [...existingTrace.history, reconEntry],
      };
      persistTrace(reconTrace);
      return {
        success: false,
        status: 'REQUIRES_RECONCILIATION',
        message: uncertainMsg,
        trace: reconTrace,
        payload: buildRes.payload,
        executionMode: 'SIMULATED_SERVICE_LAYER',
      };
    }

    // 5. Handle Simulated Transient Connection Error -> FAILED (safe to retry)
    if (simMode === 'TRANSIENT_ERROR') {
      const transMsg = 'SAP Service Layer connection refused before payload dispatch (HTTP 503). Safe to retry.';
      const transEntry: SapIntegrationHistoryEntry = {
        id: `saph-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        timestamp: nowIso,
        status: 'FAILED',
        action: 'FAILED',
        actorName: actor,
        errorCode: 'SAP_SL_UNAVAILABLE_503',
        errorMessage: transMsg,
      };
      const transTrace: SapIntegrationTraceRecord = {
        ...existingTrace,
        status: 'FAILED',
        idempotencyKey: idemKey,
        lastAttemptAt: nowIso,
        retryCount: (existingTrace.retryCount || 0) + 1,
        attemptCount: (existingTrace.attemptCount || 0) + 1,
        errorCode: 'SAP_SL_UNAVAILABLE_503',
        errorMessage: transMsg,
        reconciliationRequired: false,
        payloadSnapshot: buildRes.payload as unknown as Record<string, unknown>,
        history: [...existingTrace.history, transEntry],
      };
      persistTrace(transTrace);
      return {
        success: false,
        status: 'FAILED',
        message: transMsg,
        trace: transTrace,
        payload: buildRes.payload,
        executionMode: 'SIMULATED_SERVICE_LAYER',
      };
    }

    // 6. Successful Service Layer Dispatch (Simulated Service Layer Verification)
    deterministicSapDocEntryCounter += 1;
    const sapDocEntry = deterministicSapDocEntryCounter;
    const sapDocNum = `SAP-PR-${sapDocEntry}`;

    const pendingEntry: SapIntegrationHistoryEntry = {
      id: `saph-${Date.now()}-p`,
      timestamp: nowIso,
      status: 'PENDING',
      action: (existingTrace.retryCount || 0) > 0 ? 'RETRIED' : 'POST_INITIATED',
      actorName: actor,
      payloadSummary: `${buildRes.payload.endpoint} (${buildRes.payload.DocType}, ${buildRes.payload.DocumentLines.length} line(s))`,
    };
    const integratedEntry: SapIntegrationHistoryEntry = {
      id: `saph-${Date.now()}-i`,
      timestamp: nowIso,
      status: 'INTEGRATED',
      action: 'INTEGRATED',
      actorName: actor,
      sapDocEntry,
      sapDocNum,
      payloadSummary: `Simulated SAP B1 10.0 HANA Service Layer response: DocEntry=${sapDocEntry}, DocNum=${sapDocNum}`,
    };

    const successTrace: SapIntegrationTraceRecord = {
      status: 'INTEGRATED',
      targetEntity: 'PurchaseRequests',
      sapObjectType: 'PurchaseRequests',
      sapDocType: buildRes.payload.DocType,
      sapDocEntry,
      sapDocNum,
      sapPrDocEntry: sapDocEntry,
      sapPrDocNum: sapDocNum,
      postingTimestamp: nowIso,
      lastAttemptAt: nowIso,
      lastSuccessAt: nowIso,
      retryCount: (existingTrace.retryCount || 0) + 1,
      attemptCount: (existingTrace.attemptCount || 0) + 1,
      idempotencyKey: idemKey,
      reconciliationRequired: false,
      payloadSnapshot: buildRes.payload as unknown as Record<string, unknown>,
      transportMode: 'SIMULATED_SERVICE_LAYER',
      history: [...existingTrace.history, pendingEntry, integratedEntry],
    };

    persistTrace(successTrace);

    EnterpriseAuditService.logEvent({
      companyId: pr.companyId,
      branchId: pr.branchId,
      entityType: 'PURCHASE_REQUISITION',
      entityId: pr.id,
      eventType: 'SAP_B1_PR_INTEGRATED',
      eventDescription: `Posted ${pr.prType} PR ${pr.prNumber} to SAP B1 Service Layer (${buildRes.payload.DocType}) -> DocEntry ${sapDocEntry} (${sapDocNum})`,
      newValue: {
        sapDocEntry,
        sapDocNum,
        sapDocType: buildRes.payload.DocType,
        idempotencyKey: idemKey,
      },
      changedByUserId: pr.creatorId,
      changedByName: actor,
      changeReason: 'SAP Business One 10.0 HANA Service Layer integration',
      relatedPrId: pr.id,
    });

    return {
      success: true,
      status: 'INTEGRATED',
      message: `PR ${pr.prNumber} integrated via SAP B1 Service Layer (${buildRes.payload.DocType}): DocEntry ${sapDocEntry}, DocNum ${sapDocNum}.`,
      trace: successTrace,
      payload: buildRes.payload,
      executionMode: 'SIMULATED_SERVICE_LAYER',
    };
  },

  /**
   * Reconciles a PR stuck in `REQUIRES_RECONCILIATION` after verifying with SAP Business One Service Layer
   * whether the document was committed or not.
   */
  reconcileSapIntegrationState(
    prOrIdOrParams:
      | string
      | PurchaseRequisitionHeader
      | {
          prId: string;
          prNumber?: string;
          resolution?: 'CONFIRM_NOT_POSTED_ALLOW_RETRY' | 'FOUND_IN_SAP' | 'NOT_FOUND_IN_SAP';
          outcome?: 'FOUND_IN_SAP' | 'NOT_FOUND_IN_SAP';
          sapDocEntry?: number;
          sapDocNum?: string;
          actorName: string;
          remarks: string;
        },
    resolutionArg?: {
      outcome: 'FOUND_IN_SAP' | 'NOT_FOUND_IN_SAP';
      sapDocEntry?: number;
      sapDocNum?: string;
      actorName: string;
      remarks: string;
    }
  ): SapIntegrationTraceRecord & {
    success: boolean;
    message: string;
    trace: SapIntegrationTraceRecord;
  } {
    let targetId: string;
    let outcome: 'FOUND_IN_SAP' | 'NOT_FOUND_IN_SAP';
    let sapDocEntry: number | undefined;
    let sapDocNum: string | undefined;
    let actorName: string;
    let remarks: string;

    if (
      typeof prOrIdOrParams === 'object' &&
      'prId' in prOrIdOrParams &&
      !('prType' in prOrIdOrParams)
    ) {
      targetId = prOrIdOrParams.prId;
      outcome =
        prOrIdOrParams.outcome === 'FOUND_IN_SAP' || prOrIdOrParams.resolution === 'FOUND_IN_SAP'
          ? 'FOUND_IN_SAP'
          : 'NOT_FOUND_IN_SAP';
      sapDocEntry = prOrIdOrParams.sapDocEntry;
      sapDocNum = prOrIdOrParams.sapDocNum;
      actorName = prOrIdOrParams.actorName;
      remarks = prOrIdOrParams.remarks;
    } else {
      targetId = typeof prOrIdOrParams === 'string' ? prOrIdOrParams : (prOrIdOrParams as PurchaseRequisitionHeader).id;
      outcome = resolutionArg?.outcome || 'NOT_FOUND_IN_SAP';
      sapDocEntry = resolutionArg?.sapDocEntry;
      sapDocNum = resolutionArg?.sapDocNum;
      actorName = resolutionArg?.actorName || 'SAP Integration Admin';
      remarks = resolutionArg?.remarks || '';
    }

    if (!remarks || !remarks.trim()) {
      throw new Error('Mandatory reconciliation remarks are required.');
    }

    const prs = purchaseRequisitionService.getPurchaseRequisitions();
    const idx = prs.findIndex((p) => p.id === targetId || p.prNumber === targetId);
    const pr =
      idx >= 0
        ? prs[idx]
        : typeof prOrIdOrParams === 'object' && 'prType' in prOrIdOrParams
        ? (prOrIdOrParams as PurchaseRequisitionHeader)
        : undefined;
    const current =
      inMemoryTraceStore[targetId] || pr?.sapIntegration || pr?.sapIntegrationTrace;

    if (!current) {
      throw new Error(`PR "${targetId}" or its SAP integration trace was not found.`);
    }

    const nowIso = new Date().toISOString();
    const saveTrace = (nextTrace: SapIntegrationTraceRecord) => {
      inMemoryTraceStore[targetId] = nextTrace;
      if (pr) {
        inMemoryTraceStore[pr.id] = nextTrace;
        inMemoryTraceStore[pr.prNumber] = nextTrace;
        pr.sapIntegration = nextTrace;
        pr.sapIntegrationTrace = nextTrace;
      }
      if (idx >= 0 && pr) {
        prs[idx] = pr;
        purchaseRequisitionService.savePurchaseRequisitions(prs);
      }
    };

    if (outcome === 'FOUND_IN_SAP') {
      if (!sapDocEntry || !sapDocNum) {
        throw new Error('sapDocEntry and sapDocNum are required when reconciliation outcome is FOUND_IN_SAP.');
      }
      const entry: SapIntegrationHistoryEntry = {
        id: `saph-${Date.now()}-rec`,
        timestamp: nowIso,
        status: 'INTEGRATED',
        action: 'RECONCILED',
        actorName,
        sapDocEntry,
        sapDocNum,
        payloadSummary: `Reconciled against existing SAP document: ${remarks.trim()}`,
      };
      const nextTrace: SapIntegrationTraceRecord = {
        ...current,
        status: 'INTEGRATED',
        sapDocEntry,
        sapDocNum,
        sapPrDocEntry: sapDocEntry,
        sapPrDocNum: sapDocNum,
        postingTimestamp: current.postingTimestamp || nowIso,
        reconciliationRequired: false,
        reconciledBy: actorName,
        reconciledAt: nowIso,
        reconciliationNotes: remarks.trim(),
        errorCode: undefined,
        errorMessage: undefined,
        history: [...current.history, entry],
      };
      saveTrace(nextTrace);
      return {
        ...nextTrace,
        success: true,
        message: `Reconciled PR against existing SAP document DocEntry ${sapDocEntry} (${sapDocNum}).`,
        trace: nextTrace,
      };
    }

    // NOT_FOUND_IN_SAP -> Transition to FAILED with reconciliationRequired = false so retry is now permitted
    const entry: SapIntegrationHistoryEntry = {
      id: `saph-${Date.now()}-rec`,
      timestamp: nowIso,
      status: 'FAILED',
      action: 'RECONCILED',
      actorName,
      payloadSummary: `Verified no SAP document was created (${remarks.trim()}). Cleared for safe retry.`,
    };
    const nextTrace: SapIntegrationTraceRecord = {
      ...current,
      status: 'FAILED',
      reconciliationRequired: false,
      reconciledBy: actorName,
      reconciledAt: nowIso,
      reconciliationNotes: remarks.trim(),
      history: [...current.history, entry],
    };
    saveTrace(nextTrace);
    return {
      ...nextTrace,
      success: true,
      message: `SAP state reconciled by ${actorName}: verified no orphan SAP document exists. Cleared for retry.`,
      trace: nextTrace,
    };
  },
};
