/**
 * CIPPLATFORM — GOVERNED INVENTORY, CROSS-BRANCH, DUAL AGING & AUDIT REPORTING SERVICE
 *
 * Implements all 14 mandatory governed reports with:
 * - Strict Company & Branch Isolation
 * - RBAC Permission Enforcement (View + Export)
 * - Dual Independent Aging Engines (Inventory Stock Aging vs. PR Aging)
 * - Default Descending (Newest First) Sorting
 */

import { User } from '../types';
import {
  InventoryTransferRecord,
  InventoryValidationSnapshot,
} from '../types/procurementFinanceGovernance';
import { PurchaseRequisitionHeader } from '../types/purchaseRequisition';
import { inventoryValidationService } from './inventoryValidationService';
import { inventoryAgingService } from './inventoryAgingService';
import { prAgingService } from './prAgingService';
import { PurchaseRequisitionService } from './purchaseRequisitionService';
import { normalizeCompanyId, normalizeBranchId } from './prGovernancePolicyService';
import { rbacPermissionService, EnterprisePermissionKey } from './rbacPermissionService';
import { EnterpriseAuditService } from './enterpriseAuditService';
import { compareGridValues } from './dataGridService';
import { executeScopedExport } from './exportService';

export type InventoryReportId =
  | 'PR_STOCK_AVAILABILITY_VALIDATION'
  | 'WAREHOUSE_STOCK_AVAILABILITY'
  | 'COMPANY_WIDE_STOCK_VISIBILITY'
  | 'CROSS_BRANCH_TRANSFER_TRACKING'
  | 'STOCK_SHORTAGE_EXCEPTION'
  | 'INVENTORY_STOCK_AGING'
  | 'NEAR_EXPIRY_EXPIRED_STOCK'
  | 'BATCH_WISE_INVENTORY_AGING_EXPIRY'
  | 'PR_AGING_REPORT'
  | 'STAGE_WISE_PR_PENDING_AGING'
  | 'DELAYED_ESCALATED_PR_AGING'
  | 'INVENTORY_POLICY_REVALIDATION_AUDIT'
  | 'INVENTORY_PR_AGING_IMPACT_SUMMARY'
  | 'HISTORICAL_VALIDATION_SNAPSHOT';

export interface GovernedReportCatalogItem {
  id: InventoryReportId;
  code: string;
  title: string;
  category: 'INVENTORY_VALIDATION' | 'CROSS_BRANCH' | 'STOCK_AGING' | 'PR_AGING' | 'AUDIT_GOVERNANCE';
  description: string;
  requiredViewPermission?: EnterprisePermissionKey;
  defaultSortField: string;
  defaultSortDirection: 'desc';
}

export const GOVERNED_REPORT_CATALOG: GovernedReportCatalogItem[] = [
  {
    id: 'PR_STOCK_AVAILABILITY_VALIDATION',
    code: 'RPT-INV-01',
    title: '1. PR Stock Availability Validation Report',
    category: 'INVENTORY_VALIDATION',
    description: 'Latest Part K validation breakdown across PR lines (Physical, Reserved, Allocated, Available, Incoming, Shortage).',
    defaultSortField: 'validatedDate',
    defaultSortDirection: 'desc',
  },
  {
    id: 'WAREHOUSE_STOCK_AVAILABILITY',
    code: 'RPT-INV-02',
    title: '2. Warehouse-Wise Stock Availability Report',
    category: 'INVENTORY_VALIDATION',
    description: 'Granular stock availability by active warehouse ordered by priority (QC, Blocked, Rejected, Expired, Available).',
    defaultSortField: 'lastUpdated',
    defaultSortDirection: 'desc',
  },
  {
    id: 'COMPANY_WIDE_STOCK_VISIBILITY',
    code: 'RPT-INV-03',
    title: '3. Company-Wide Stock Visibility Report',
    category: 'CROSS_BRANCH',
    description: 'Same-company multi-branch stock visibility separated strictly from locally usable stock (RBAC protected).',
    requiredViewPermission: 'INVENTORY_CROSS_BRANCH_STOCK_VIEW',
    defaultSortField: 'lastUpdated',
    defaultSortDirection: 'desc',
  },
  {
    id: 'CROSS_BRANCH_TRANSFER_TRACKING',
    code: 'RPT-INV-04',
    title: '4. Cross-Branch Transfer Recommendation & Tracking Report',
    category: 'CROSS_BRANCH',
    description: 'Formal inter-branch stock transfers (Requested, Approved, In-Transit, Received) and transfer candidates.',
    defaultSortField: 'requestedAt',
    defaultSortDirection: 'desc',
  },
  {
    id: 'STOCK_SHORTAGE_EXCEPTION',
    code: 'RPT-INV-05',
    title: '5. Stock Shortage Exception Report',
    category: 'INVENTORY_VALIDATION',
    description: 'PR shortage exceptions with requester, justification, Maker-Checker approver, and current approval status.',
    defaultSortField: 'requestedAt',
    defaultSortDirection: 'desc',
  },
  {
    id: 'INVENTORY_STOCK_AGING',
    code: 'RPT-AGE-06',
    title: '6. Inventory Stock Aging Report',
    category: 'STOCK_AGING',
    description: 'Warehouse balance aging buckets (Fresh, Normal, Aging, Old, Critical) with honest Data Unavailable tracking.',
    requiredViewPermission: 'INVENTORY_AGING_VIEW',
    defaultSortField: 'stockAgeDays',
    defaultSortDirection: 'desc',
  },
  {
    id: 'NEAR_EXPIRY_EXPIRED_STOCK',
    code: 'RPT-AGE-07',
    title: '7. Near-Expiry & Expired Stock Report',
    category: 'STOCK_AGING',
    description: 'Perishable items flagged as EXPIRED or NEAR_EXPIRY against configured threshold days.',
    requiredViewPermission: 'INVENTORY_AGING_VIEW',
    defaultSortField: 'expiryDateDisplay',
    defaultSortDirection: 'desc',
  },
  {
    id: 'BATCH_WISE_INVENTORY_AGING_EXPIRY',
    code: 'RPT-AGE-08',
    title: '8. Batch-Wise Inventory Aging & Expiry Report',
    category: 'STOCK_AGING',
    description: 'Lot/batch-level receipt date, FIFO/FEFO dispatch rank, expiry status, and usable quantity.',
    requiredViewPermission: 'INVENTORY_AGING_VIEW',
    defaultSortField: 'receiptDateDisplay',
    defaultSortDirection: 'desc',
  },
  {
    id: 'PR_AGING_REPORT',
    code: 'RPT-PRA-09',
    title: '9. Purchase Requisition Aging Report',
    category: 'PR_AGING',
    description: 'Separate PR cycle pending aging (Drafts excluded; terminal PRs excluded unless historical mode active).',
    requiredViewPermission: 'PR_AGING_VIEW',
    defaultSortField: 'submittedDateDisplay',
    defaultSortDirection: 'desc',
  },
  {
    id: 'STAGE_WISE_PR_PENDING_AGING',
    code: 'RPT-PRA-10',
    title: '10. Stage-Wise PR Pending Aging Report',
    category: 'PR_AGING',
    description: 'Aggregated count, total pending value, max stage age, and SLA breaches grouped by PR workflow stage.',
    requiredViewPermission: 'PR_AGING_VIEW',
    defaultSortField: 'maxStageAgeDays',
    defaultSortDirection: 'desc',
  },
  {
    id: 'DELAYED_ESCALATED_PR_AGING',
    code: 'RPT-PRA-11',
    title: '11. Delayed & Escalated PR Aging Report',
    category: 'PR_AGING',
    description: 'Active PRs breaching stage SLA or overall escalation threshold days requiring management intervention.',
    requiredViewPermission: 'PR_AGING_VIEW',
    defaultSortField: 'totalPendingAgeDays',
    defaultSortDirection: 'desc',
  },
  {
    id: 'INVENTORY_POLICY_REVALIDATION_AUDIT',
    code: 'RPT-AUD-12',
    title: '12. Inventory Policy & Revalidation Audit Report',
    category: 'AUDIT_GOVERNANCE',
    description: 'Hash-chained audit events for inventory validation, revalidation stages, transfers, and aging policies.',
    requiredViewPermission: 'INVENTORY_VALIDATION_CONFIG_VIEW',
    defaultSortField: 'timestamp',
    defaultSortDirection: 'desc',
  },
  {
    id: 'INVENTORY_PR_AGING_IMPACT_SUMMARY',
    code: 'RPT-AGE-13',
    title: '13. Inventory + PR Aging Impact Summary Report',
    category: 'AUDIT_GOVERNANCE',
    description: 'Correlates pending PR aging delays against local shortages, near-expiry stock, and cross-branch transfer options.',
    requiredViewPermission: 'PR_AGING_VIEW',
    defaultSortField: 'prDate',
    defaultSortDirection: 'desc',
  },
  {
    id: 'HISTORICAL_VALIDATION_SNAPSHOT',
    code: 'RPT-AUD-14',
    title: '14. Historical Validation Snapshot Report',
    category: 'AUDIT_GOVERNANCE',
    description: 'Immutable stage-by-stage Part K validation snapshots & stock deltas across PR lifecycles.',
    requiredViewPermission: 'INVENTORY_VALIDATION_CONFIG_VIEW',
    defaultSortField: 'validatedAt',
    defaultSortDirection: 'desc',
  },
];

export interface ReportColumnSpec {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
}

export interface GovernedReportResult {
  authorized: boolean;
  error?: string;
  meta: GovernedReportCatalogItem;
  columns: ReportColumnSpec[];
  rows: Record<string, any>[];
  summary: Array<{ label: string; value: string | number }>;
}

function matchesFy(pr: PurchaseRequisitionHeader, financialYearId?: string): boolean {
  if (!financialYearId || financialYearId === 'ALL') return true;
  if (pr.financialYearId) return pr.financialYearId === financialYearId;
  return true;
}

function sortRowsDesc(rows: Record<string, any>[], field: string, idField: string): Record<string, any>[] {
  return [...rows].sort((a, b) => {
    const primary = compareGridValues(a[field], b[field], 'desc');
    if (primary !== 0) return primary;
    return compareGridValues(a[idField], b[idField], 'desc');
  });
}

export const inventoryReportingService = {
  getCatalog(): GovernedReportCatalogItem[] {
    return GOVERNED_REPORT_CATALOG;
  },

  canUserViewReport(reportId: InventoryReportId, user?: User | null): { allowed: boolean; reason?: string } {
    const meta = GOVERNED_REPORT_CATALOG.find((r) => r.id === reportId);
    if (!meta) return { allowed: false, reason: `Unknown report ${reportId}` };
    if (!user) return { allowed: true };
    if (meta.requiredViewPermission && !rbacPermissionService.hasPermission(user, meta.requiredViewPermission)) {
      return {
        allowed: false,
        reason: `RBAC Authorization Denied: Viewing "${meta.title}" requires permission ${meta.requiredViewPermission}.`,
      };
    }
    return { allowed: true };
  },

  generateReport(params: {
    reportId: InventoryReportId;
    companyId: string;
    branchId?: string;
    financialYearId?: string;
    user?: User | null;
    asOfDate?: string;
    includeHistoricalClosed?: boolean;
  }): GovernedReportResult {
    const meta =
      GOVERNED_REPORT_CATALOG.find((r) => r.id === params.reportId) || GOVERNED_REPORT_CATALOG[0];

    const access = this.canUserViewReport(meta.id, params.user);
    if (!access.allowed) {
      return {
        authorized: false,
        error: access.reason,
        meta,
        columns: [],
        rows: [],
        summary: [],
      };
    }

    const normCo = normalizeCompanyId(params.companyId || 'co-kosh-01');
    const normBr = params.branchId && params.branchId !== 'ALL' ? normalizeBranchId(params.branchId) : 'ALL';
    const asOfDate = params.asOfDate || new Date().toISOString().slice(0, 10);

    const allBalances = inventoryValidationService
      .getBalances()
      .filter((b) => normalizeCompanyId(b.companyId) === normCo)
      .filter((b) => (normBr === 'ALL' ? true : normalizeBranchId(b.branchId) === normBr));

    const allPrs = PurchaseRequisitionService.getPurchaseRequisitions()
      .filter((p) => normalizeCompanyId(p.companyId) === normCo)
      .filter((p) => (normBr === 'ALL' ? true : normalizeBranchId(p.branchId) === normBr))
      .filter((p) => matchesFy(p, params.financialYearId));

    const transfers = inventoryValidationService
      .getTransfers()
      .filter((t) => normalizeCompanyId(t.companyId) === normCo)
      .filter((t) =>
        normBr === 'ALL'
          ? true
          : normalizeBranchId(t.sourceBranchId) === normBr ||
            normalizeBranchId(t.destinationBranchId) === normBr
      );

    const exceptions = inventoryValidationService
      .getExceptions()
      .filter((e) => normalizeCompanyId(e.companyId || normCo) === normCo)
      .filter((e) => (!e.branchId || normBr === 'ALL' ? true : normalizeBranchId(e.branchId) === normBr));

    // 1. PR Stock Availability Validation Report
    if (meta.id === 'PR_STOCK_AVAILABILITY_VALIDATION') {
      const rows: Record<string, any>[] = [];
      for (const pr of allPrs) {
        const snap =
          pr.inventoryValidationSnapshot ||
          inventoryValidationService.validateTransactionInventory({
            prId: pr.id,
            prNumber: pr.prNumber,
            companyId: pr.companyId,
            branchId: pr.branchId,
            stage: 'ON_PR_CREATION',
            validatedBy: pr.creatorName,
            user: params.user || undefined,
            lines: pr.lines.map((l) => ({
              id: l.id,
              itemCode: l.itemCode,
              description: l.description,
              itemCategory: l.itemCategory,
              inventoryUom: l.inventoryUom,
              requestedQuantity: l.requestedQuantity,
              defaultWarehouse: l.defaultWarehouse,
            })),
          });
        for (const lr of snap.lineResults) {
          rows.push({
            id: `${pr.id}-${lr.itemCode}`,
            prNumber: pr.prNumber,
            branchName: pr.branchName,
            itemCode: lr.itemCode,
            itemDescription: lr.itemDescription,
            stage: snap.stage,
            enforcementMode: snap.enforcementMode,
            physicalStock: lr.physicalStock,
            reservedStock: lr.reservedStock,
            allocatedStock: lr.allocatedStock,
            availableStock: lr.availableStock,
            incomingStock: lr.incomingStock,
            requiredQty: lr.requiredPrQuantity,
            shortageQuantity: lr.shortageQuantity,
            outcome: snap.overallOutcome,
            validatedDate: snap.validatedAt,
          });
        }
      }
      const sorted = sortRowsDesc(rows, 'validatedDate', 'prNumber');
      return {
        authorized: true,
        meta,
        columns: [
          { key: 'prNumber', label: 'PR Number' },
          { key: 'branchName', label: 'Branch' },
          { key: 'itemCode', label: 'Item Code' },
          { key: 'stage', label: 'Stage' },
          { key: 'physicalStock', label: 'Physical', align: 'right' },
          { key: 'reservedStock', label: 'Reserved', align: 'right' },
          { key: 'availableStock', label: 'Available', align: 'right' },
          { key: 'incomingStock', label: 'Incoming', align: 'right' },
          { key: 'requiredQty', label: 'PR Qty', align: 'right' },
          { key: 'shortageQuantity', label: 'Shortage', align: 'right' },
          { key: 'outcome', label: 'Outcome' },
          { key: 'validatedDate', label: 'Validated At' },
        ],
        rows: sorted,
        summary: [
          { label: 'Validated Lines', value: sorted.length },
          { label: 'Lines With Shortage', value: sorted.filter((r) => r.shortageQuantity > 0).length },
        ],
      };
    }

    // 2. Warehouse-Wise Stock Availability Report
    if (meta.id === 'WAREHOUSE_STOCK_AVAILABILITY') {
      const rows = allBalances.map((b) => {
        const br = inventoryValidationService.calculateLineAvailability({
          companyId: b.companyId,
          branchId: b.branchId,
          warehouseCode: b.warehouseCode,
          itemCode: b.itemCode,
          itemDescription: b.itemDescription,
          itemCategory: b.itemCategory,
          uom: b.uom,
          requiredPrQuantity: 0,
          user: params.user || undefined,
          asOfDate,
        });
        const whRow = (br.warehouseBreakdowns || [])[0];
        return {
          id: b.id,
          branchName: b.branchName,
          warehouseCode: b.warehouseCode,
          warehouseName: b.warehouseName,
          warehousePriority: whRow?.warehousePriority ?? 99,
          itemCode: b.itemCode,
          itemDescription: b.itemDescription,
          uom: b.uom,
          physicalStock: br.physicalStock,
          reservedStock: br.reservedStock,
          allocatedStock: br.allocatedStock,
          availableStock: br.availableStock,
          qualityInspectionStock: br.qualityInspectionStock,
          blockedStock: br.blockedStock,
          rejectedStock: br.rejectedStock,
          expiredStock: br.expiredStock,
          incomingStock: br.incomingStock,
          stockInTransit: br.stockInTransit,
          eligibleForValidation: whRow?.eligibleForLocalValidation ? 'YES' : 'NO',
          lastUpdated: b.lastUpdated,
        };
      });
      const sorted = sortRowsDesc(rows, 'lastUpdated', 'warehouseCode');
      return {
        authorized: true,
        meta,
        columns: [
          { key: 'branchName', label: 'Branch' },
          { key: 'warehouseCode', label: 'Warehouse' },
          { key: 'warehousePriority', label: 'Priority', align: 'right' },
          { key: 'itemCode', label: 'Item Code' },
          { key: 'physicalStock', label: 'Physical', align: 'right' },
          { key: 'reservedStock', label: 'Reserved', align: 'right' },
          { key: 'availableStock', label: 'Available', align: 'right' },
          { key: 'qualityInspectionStock', label: 'QC', align: 'right' },
          { key: 'blockedStock', label: 'Blocked', align: 'right' },
          { key: 'expiredStock', label: 'Expired', align: 'right' },
          { key: 'incomingStock', label: 'Incoming', align: 'right' },
          { key: 'stockInTransit', label: 'In-Transit', align: 'right' },
          { key: 'eligibleForValidation', label: 'Validation Eligible' },
          { key: 'lastUpdated', label: 'Last Updated' },
        ],
        rows: sorted,
        summary: [
          { label: 'Warehouse SKUs', value: sorted.length },
          {
            label: 'Total Local Available',
            value: sorted.reduce((s, r) => s + Number(r.availableStock || 0), 0),
          },
        ],
      };
    }

    // 3. Company-Wide Stock Visibility Report (RBAC guarded above)
    if (meta.id === 'COMPANY_WIDE_STOCK_VISIBILITY') {
      const uniqueItems = Array.from(new Set(allBalances.map((b) => b.itemCode)));
      const targetBranch = normBr === 'ALL' ? allBalances[0]?.branchId || 'br-pond-01' : normBr;
      const rows = uniqueItems.map((itemCode) => {
        const res = inventoryValidationService.calculateLineAvailability({
          companyId: normCo,
          branchId: targetBranch,
          itemCode,
          requiredPrQuantity: 0,
          user: params.user || undefined,
          asOfDate,
        });
        const itemLatest = allBalances
          .filter((b) => b.itemCode === itemCode)
          .sort((a, b) => compareGridValues(a.lastUpdated, b.lastUpdated, 'desc'))[0];
        const cw = res.companyWideSummary;
        return {
          id: `${normCo}-${itemCode}`,
          companyId: normCo,
          requestingBranchId: targetBranch,
          itemCode,
          itemDescription: res.itemDescription,
          uom: res.uom,
          localAvailableStock: res.availableStock,
          otherBranchVisibleStock: cw?.otherBranchVisibleStock ?? 0,
          transferEligibleStock: cw?.transferEligibleStock ?? 0,
          companyWidePhysicalStock: cw?.companyWideVisibleTotal ?? res.physicalStock,
          crossBranchMode: cw?.crossBranchPolicyMode || 'VISIBILITY_ONLY',
          otherBranchesCount: cw?.otherBranchRows.length || 0,
          lastUpdated: itemLatest?.lastUpdated || asOfDate,
        };
      });
      const sorted = sortRowsDesc(rows, 'lastUpdated', 'itemCode');
      return {
        authorized: true,
        meta,
        columns: [
          { key: 'itemCode', label: 'Item Code' },
          { key: 'itemDescription', label: 'Description' },
          { key: 'uom', label: 'UOM' },
          { key: 'localAvailableStock', label: 'Local Available', align: 'right' },
          { key: 'otherBranchVisibleStock', label: 'Other-Branch Visible', align: 'right' },
          { key: 'transferEligibleStock', label: 'Transfer Eligible', align: 'right' },
          { key: 'companyWidePhysicalStock', label: 'Company Physical', align: 'right' },
          { key: 'crossBranchMode', label: 'Policy Mode' },
          { key: 'otherBranchesCount', label: 'Other Warehouses', align: 'right' },
          { key: 'lastUpdated', label: 'Last Updated' },
        ],
        rows: sorted,
        summary: [
          { label: 'Company SKUs', value: sorted.length },
          {
            label: 'Other-Branch Visible Units',
            value: sorted.reduce((s, r) => s + Number(r.otherBranchVisibleStock || 0), 0),
          },
        ],
      };
    }

    // 4. Cross-Branch Transfer Recommendation & Tracking Report
    if (meta.id === 'CROSS_BRANCH_TRANSFER_TRACKING') {
      const rows = transfers.map((t: InventoryTransferRecord) => ({
        id: t.id,
        transferNumber: t.transferNumber,
        prNumber: t.prNumber || 'Manual / Ad-hoc',
        itemCode: t.itemCode,
        sourceBranch: `${t.sourceBranchName} (${t.sourceWarehouseCode})`,
        destinationBranch: `${t.destinationBranchName} (${t.destinationWarehouseCode})`,
        requestedQuantity: t.requestedQuantity,
        dispatchedQuantity: t.dispatchedQuantity ?? 0,
        receivedQuantity: t.receivedQuantity ?? 0,
        uom: t.uom,
        status: t.status,
        requestedByName: t.requestedByName,
        requestedAt: t.requestedAt,
      }));
      const sorted = sortRowsDesc(rows, 'requestedAt', 'transferNumber');
      return {
        authorized: true,
        meta,
        columns: [
          { key: 'transferNumber', label: 'Transfer No' },
          { key: 'prNumber', label: 'Linked PR' },
          { key: 'itemCode', label: 'Item' },
          { key: 'sourceBranch', label: 'Source Branch / WH' },
          { key: 'destinationBranch', label: 'Destination Branch / WH' },
          { key: 'requestedQuantity', label: 'Req Qty', align: 'right' },
          { key: 'dispatchedQuantity', label: 'Dispatched', align: 'right' },
          { key: 'receivedQuantity', label: 'Received', align: 'right' },
          { key: 'status', label: 'Status' },
          { key: 'requestedByName', label: 'Requested By' },
          { key: 'requestedAt', label: 'Requested At' },
        ],
        rows: sorted,
        summary: [
          { label: 'Total Transfers', value: sorted.length },
          { label: 'In-Transit', value: sorted.filter((r) => r.status === 'IN_TRANSIT').length },
        ],
      };
    }

    // 5. Stock Shortage Exception Report
    if (meta.id === 'STOCK_SHORTAGE_EXCEPTION') {
      const rows = exceptions.map((ex) => ({
        id: ex.id,
        prNumber: ex.prNumber,
        exceptionType: ex.exceptionType || 'SHORTAGE_OVERRIDE',
        shortageSummary: ex.shortageSummary,
        exceptionReason: ex.exceptionReason,
        requestedByName: ex.requestedByName,
        requestedAt: ex.requestedAt,
        status: ex.status,
        approvedByName: ex.approvedByName || 'Pending Approval',
        approvedAt: ex.approvedAt || 'Not Yet Approved',
      }));
      const sorted = sortRowsDesc(rows, 'requestedAt', 'prNumber');
      return {
        authorized: true,
        meta,
        columns: [
          { key: 'prNumber', label: 'PR Number' },
          { key: 'exceptionType', label: 'Exception Type' },
          { key: 'shortageSummary', label: 'Shortage Summary' },
          { key: 'exceptionReason', label: 'Justification' },
          { key: 'requestedByName', label: 'Requested By' },
          { key: 'status', label: 'Status' },
          { key: 'approvedByName', label: 'Approved By' },
          { key: 'requestedAt', label: 'Requested At' },
        ],
        rows: sorted,
        summary: [
          { label: 'Exception Requests', value: sorted.length },
          { label: 'Pending Review', value: sorted.filter((r) => r.status === 'PENDING').length },
        ],
      };
    }

    // 6, 7, 8: Inventory Stock Aging & Expiry Reports
    if (
      meta.id === 'INVENTORY_STOCK_AGING' ||
      meta.id === 'NEAR_EXPIRY_EXPIRED_STOCK' ||
      meta.id === 'BATCH_WISE_INVENTORY_AGING_EXPIRY'
    ) {
      const batchRows: Record<string, any>[] = [];
      const itemGroups = new Map<string, typeof allBalances>();
      for (const bal of allBalances) {
        const key = `${bal.branchId}::${bal.itemCode}`;
        const list = itemGroups.get(key) || [];
        list.push(bal);
        itemGroups.set(key, list);
      }

      for (const [, groupBalances] of itemGroups.entries()) {
        const evalRes = inventoryAgingService.evaluateBalances({
          balances: groupBalances,
          companyId: normCo,
          branchId: groupBalances[0]?.branchId,
          itemCode: groupBalances[0]?.itemCode,
          asOfDate,
        });
        for (const b of evalRes.batches) {
          batchRows.push({
            id: `${b.branchId}-${b.warehouseCode}-${b.itemCode}-${b.batchNo}`,
            branchId: b.branchId,
            warehouseCode: b.warehouseCode,
            binLocation: b.binLocation || 'UNASSIGNED',
            itemCode: b.itemCode,
            itemDescription: b.itemDescription,
            batchNo: b.batchNo,
            receiptDateDisplay: b.receiptDateDisplay,
            stockAgeDays: b.stockAgeDays,
            agingBucketLabel: b.agingBucketLabel,
            expiryDateDisplay: b.expiryDateDisplay,
            daysToExpiry: b.daysToExpiry,
            expiryStatus: b.expiryStatus,
            quantity: b.quantity,
            usableQuantity: b.usableQuantity,
            issueMethodApplied: b.issueMethodApplied,
            recommendedDispatchRank: b.recommendedDispatchRank || 'Excluded',
          });
        }
      }

      if (meta.id === 'NEAR_EXPIRY_EXPIRED_STOCK') {
        const filtered = batchRows.filter(
          (r) => r.expiryStatus === 'EXPIRED' || r.expiryStatus === 'NEAR_EXPIRY'
        );
        const sorted = sortRowsDesc(filtered, 'expiryDateDisplay', 'batchNo');
        return {
          authorized: true,
          meta,
          columns: [
            { key: 'warehouseCode', label: 'Warehouse' },
            { key: 'itemCode', label: 'Item Code' },
            { key: 'batchNo', label: 'Batch / Lot' },
            { key: 'expiryDateDisplay', label: 'Expiry Date' },
            { key: 'daysToExpiry', label: 'Days To Expiry', align: 'right' },
            { key: 'expiryStatus', label: 'Expiry Status' },
            { key: 'quantity', label: 'Batch Qty', align: 'right' },
            { key: 'usableQuantity', label: 'Usable Qty', align: 'right' },
          ],
          rows: sorted,
          summary: [
            { label: 'Expired Batches', value: sorted.filter((r) => r.expiryStatus === 'EXPIRED').length },
            { label: 'Near-Expiry Batches', value: sorted.filter((r) => r.expiryStatus === 'NEAR_EXPIRY').length },
          ],
        };
      }

      const sortField = meta.id === 'INVENTORY_STOCK_AGING' ? 'stockAgeDays' : 'receiptDateDisplay';
      const sorted = sortRowsDesc(batchRows, sortField, 'batchNo');
      return {
        authorized: true,
        meta,
        columns: [
          { key: 'warehouseCode', label: 'Warehouse' },
          { key: 'itemCode', label: 'Item Code' },
          { key: 'batchNo', label: 'Batch No' },
          { key: 'receiptDateDisplay', label: 'Receipt Date' },
          { key: 'stockAgeDays', label: 'Age (Days)', align: 'right' },
          { key: 'agingBucketLabel', label: 'Aging Bucket' },
          { key: 'expiryDateDisplay', label: 'Expiry Date' },
          { key: 'expiryStatus', label: 'Expiry Status' },
          { key: 'quantity', label: 'Qty', align: 'right' },
          { key: 'usableQuantity', label: 'Usable Qty', align: 'right' },
          { key: 'issueMethodApplied', label: 'Method' },
          { key: 'recommendedDispatchRank', label: 'Pick Rank', align: 'right' },
        ],
        rows: sorted,
        summary: [
          { label: 'Total Batches', value: sorted.length },
          {
            label: 'Data Unavailable Lots',
            value: sorted.filter((r) => r.receiptDateDisplay === 'Data Unavailable').length,
          },
        ],
      };
    }

    // 9, 10, 11: Purchase Requisition Aging Reports (Strict Separation)
    if (
      meta.id === 'PR_AGING_REPORT' ||
      meta.id === 'STAGE_WISE_PR_PENDING_AGING' ||
      meta.id === 'DELAYED_ESCALATED_PR_AGING'
    ) {
      const prEvals = prAgingService.evaluatePortfolio(allPrs, {
        asOfDate,
        includeHistoricalClosed: params.includeHistoricalClosed,
        includeDrafts: false,
      });

      if (meta.id === 'STAGE_WISE_PR_PENDING_AGING') {
        const stageMap = new Map<
          string,
          { stage: string; prCount: number; maxStageAgeDays: number; breachedCount: number; totalValue: number }
        >();
        for (const ev of prEvals) {
          const prObj = allPrs.find((p) => p.id === ev.prId);
          const entry = stageMap.get(ev.currentAgingStage) || {
            stage: ev.currentAgingStage,
            prCount: 0,
            maxStageAgeDays: 0,
            breachedCount: 0,
            totalValue: 0,
          };
          entry.prCount += 1;
          entry.maxStageAgeDays = Math.max(entry.maxStageAgeDays, ev.currentStageAgeDays ?? 0);
          if (ev.slaStatus === 'BREACHED') entry.breachedCount += 1;
          entry.totalValue += Number(prObj?.estimatedTotalValue || 0);
          stageMap.set(ev.currentAgingStage, entry);
        }
        const sorted = sortRowsDesc(
          Array.from(stageMap.values()).map((s) => ({ id: s.stage, ...s })),
          'maxStageAgeDays',
          'stage'
        );
        return {
          authorized: true,
          meta,
          columns: [
            { key: 'stage', label: 'Workflow Stage' },
            { key: 'prCount', label: 'Pending PRs', align: 'right' },
            { key: 'maxStageAgeDays', label: 'Max Stage Age (d)', align: 'right' },
            { key: 'breachedCount', label: 'SLA Breached', align: 'right' },
            { key: 'totalValue', label: 'Pending Value', align: 'right' },
          ],
          rows: sorted,
          summary: [
            { label: 'Active Stages', value: sorted.length },
            { label: 'Total Breached', value: sorted.reduce((s, r) => s + r.breachedCount, 0) },
          ],
        };
      }

      const filteredEvals =
        meta.id === 'DELAYED_ESCALATED_PR_AGING'
          ? prEvals.filter((e) => e.isEscalated || e.slaStatus === 'BREACHED')
          : prEvals;

      const sortField =
        meta.id === 'DELAYED_ESCALATED_PR_AGING' ? 'totalPendingAgeDays' : 'submittedDateDisplay';
      const sorted = sortRowsDesc(
        filteredEvals.map((e) => ({ id: e.prId, ...e })),
        sortField,
        'prNumber'
      );
      return {
        authorized: true,
        meta,
        columns: [
          { key: 'prNumber', label: 'PR Number' },
          { key: 'branchName', label: 'Branch' },
          { key: 'department', label: 'Department' },
          { key: 'priority', label: 'Priority' },
          { key: 'prStatus', label: 'Status' },
          { key: 'submittedDateDisplay', label: 'Submitted Date' },
          { key: 'totalPendingAgeDays', label: 'Pending Age (d)', align: 'right' },
          { key: 'agingBucketLabel', label: 'PR Aging Bucket' },
          { key: 'currentAgingStage', label: 'Current Stage' },
          { key: 'currentStageAgeDays', label: 'Stage Age (d)', align: 'right' },
          { key: 'slaDueDateDisplay', label: 'SLA Due Date' },
          { key: 'slaStatus', label: 'SLA Status' },
        ],
        rows: sorted,
        summary: [
          { label: 'Tracked PRs (Drafts Excluded)', value: sorted.length },
          { label: 'Escalated / SLA Breached', value: sorted.filter((r) => r.isEscalated).length },
        ],
      };
    }

    // 12. Inventory Policy & Revalidation Audit Report
    if (meta.id === 'INVENTORY_POLICY_REVALIDATION_AUDIT') {
      const logs = EnterpriseAuditService.getAuditLogs()
        .filter((l) => normalizeCompanyId(l.companyId) === normCo)
        .filter((l) =>
          ['INVENTORY_VALIDATION', 'INVENTORY_TRANSFER', 'STOCK_AGING', 'PR_AGING'].includes(
            l.entityType
          )
        )
        .filter((l) => (normBr === 'ALL' || !l.branchId ? true : normalizeBranchId(l.branchId) === normBr));

      const sorted = sortRowsDesc(logs, 'timestamp', 'id');
      return {
        authorized: true,
        meta,
        columns: [
          { key: 'timestamp', label: 'Timestamp' },
          { key: 'entityType', label: 'Module' },
          { key: 'eventType', label: 'Event Type' },
          { key: 'entityId', label: 'Entity ID' },
          { key: 'eventDescription', label: 'Description' },
          { key: 'changedByName', label: 'Actor' },
          { key: 'changeReason', label: 'Reason' },
        ],
        rows: sorted,
        summary: [{ label: 'Audit Entries', value: sorted.length }],
      };
    }

    // 13. Inventory + PR Aging Impact Summary Report
    if (meta.id === 'INVENTORY_PR_AGING_IMPACT_SUMMARY') {
      const rows = allPrs
        .filter((pr) => pr.status !== 'DRAFT')
        .map((pr) => {
          const prAge = prAgingService.evaluatePrAging(pr, {
            asOfDate,
            includeHistoricalClosed: true,
          });
          const invSnap =
            pr.inventoryValidationSnapshot ||
            inventoryValidationService.validateTransactionInventory({
              prId: pr.id,
              prNumber: pr.prNumber,
              companyId: pr.companyId,
              branchId: pr.branchId,
              stage: 'ON_PR_CREATION',
              validatedBy: pr.creatorName,
              user: params.user || undefined,
              lines: pr.lines.map((l) => ({
                id: l.id,
                itemCode: l.itemCode,
                description: l.description,
                itemCategory: l.itemCategory,
                inventoryUom: l.inventoryUom,
                requestedQuantity: l.requestedQuantity,
                defaultWarehouse: l.defaultWarehouse,
              })),
            });
          const totalShortage = invSnap.lineResults.reduce((s, r) => s + r.shortageQuantity, 0);
          const nearExpiryWarnings = invSnap.lineResults.filter(
            (r) => r.stockAgingSummary?.hasNearExpiryWarning || r.stockAgingSummary?.hasExpiredStock
          ).length;
          const xBranchQty = invSnap.lineResults.reduce(
            (s, r) => s + (r.companyWideSummary?.transferEligibleStock || 0),
            0
          );
          return {
            id: pr.id,
            prNumber: pr.prNumber,
            prDate: pr.documentDate || pr.createdAt,
            branchName: pr.branchName,
            prStatus: pr.status,
            prAgeDays: prAge.totalPendingAgeDays ?? 'Excluded',
            slaStatus: prAge.slaStatus,
            totalShortage,
            nearExpiryWarnings,
            transferEligibleStock: xBranchQty,
            inventoryOutcome: invSnap.overallOutcome,
          };
        });
      const sorted = sortRowsDesc(rows, 'prDate', 'prNumber');
      return {
        authorized: true,
        meta,
        columns: [
          { key: 'prNumber', label: 'PR Number' },
          { key: 'prDate', label: 'PR Date' },
          { key: 'branchName', label: 'Branch' },
          { key: 'prStatus', label: 'PR Status' },
          { key: 'prAgeDays', label: 'PR Pending Days', align: 'right' },
          { key: 'slaStatus', label: 'PR SLA' },
          { key: 'totalShortage', label: 'Shortage Qty', align: 'right' },
          { key: 'nearExpiryWarnings', label: 'Expiry Flags', align: 'right' },
          { key: 'transferEligibleStock', label: 'X-Branch Transferable', align: 'right' },
          { key: 'inventoryOutcome', label: 'Validation Outcome' },
        ],
        rows: sorted,
        summary: [
          { label: 'PRs Analyzed', value: sorted.length },
          { label: 'With Stock Shortage', value: sorted.filter((r) => r.totalShortage > 0).length },
        ],
      };
    }

    // 14. Historical Validation Snapshot Report
    const snapshotRows: Record<string, any>[] = [];
    for (const pr of allPrs) {
      const history: InventoryValidationSnapshot[] =
        pr.inventoryValidationHistory && pr.inventoryValidationHistory.length > 0
          ? pr.inventoryValidationHistory
          : pr.inventoryValidationSnapshot
          ? [pr.inventoryValidationSnapshot]
          : [];
      for (const snap of history) {
        snapshotRows.push({
          id: snap.snapshotId,
          snapshotId: snap.snapshotId,
          prNumber: pr.prNumber,
          stage: snap.stage,
          policyVersion: snap.policyVersion,
          enforcementMode: snap.enforcementMode,
          crossBranchMode: snap.crossBranchMode || 'VISIBILITY_ONLY',
          overallOutcome: snap.overallOutcome,
          lineCount: snap.lineResults.length,
          totalShortage: snap.lineResults.reduce((s, r) => s + r.shortageQuantity, 0),
          deltaSummary:
            snap.deltasFromPrevious?.map((d) => `${d.itemCode}: ${d.summary}`).join(' | ') ||
            'Initial Baseline',
          validatedBy: snap.validatedBy,
          validatedAt: snap.validatedAt,
        });
      }
    }
    const sortedSnaps = sortRowsDesc(snapshotRows, 'validatedAt', 'snapshotId');
    return {
      authorized: true,
      meta,
      columns: [
        { key: 'prNumber', label: 'PR Number' },
        { key: 'stage', label: 'Stage' },
        { key: 'policyVersion', label: 'Policy Ver' },
        { key: 'enforcementMode', label: 'Enforcement' },
        { key: 'overallOutcome', label: 'Outcome' },
        { key: 'totalShortage', label: 'Shortage', align: 'right' },
        { key: 'deltaSummary', label: 'Delta vs Prior Stage' },
        { key: 'validatedBy', label: 'Validated By' },
        { key: 'validatedAt', label: 'Validated At' },
      ],
      rows: sortedSnaps,
      summary: [{ label: 'Historical Snapshots', value: sortedSnaps.length }],
    };
  },

  exportReport(params: {
    reportId: InventoryReportId;
    companyId: string;
    branchId?: string;
    financialYearId?: string;
    user?: User | null;
    format: 'CSV' | 'EXCEL' | 'PDF';
    scope: 'CURRENT_PAGE' | 'ALL_FILTERED';
    currentPageRows?: Record<string, any>[];
    includeHistoricalClosed?: boolean;
  }) {
    if (params.user && !rbacPermissionService.hasPermission(params.user, 'INVENTORY_VALIDATION_REPORT_EXPORT')) {
      throw new Error(
        'RBAC Authorization Denied: Exporting Inventory & Aging reports requires INVENTORY_VALIDATION_REPORT_EXPORT.'
      );
    }

    const report = this.generateReport({
      reportId: params.reportId,
      companyId: params.companyId,
      branchId: params.branchId,
      financialYearId: params.financialYearId,
      user: params.user,
      includeHistoricalClosed: params.includeHistoricalClosed,
    });
    if (!report.authorized) {
      throw new Error(report.error || 'Unauthorized report access.');
    }

    const selectedRows =
      params.scope === 'CURRENT_PAGE'
        ? params.currentPageRows || report.rows.slice(0, 20)
        : report.rows;

    return executeScopedExport({
      title: `${report.meta.code} - ${report.meta.title}`,
      headers: report.columns.map((c) => c.label),
      rows: selectedRows.map((row) =>
        report.columns.map((c) => {
          const val = row[c.key];
          return typeof val === 'number' || typeof val === 'string' ? val : val ?? '';
        })
      ),
      filenamePrefix: report.meta.code.toLowerCase(),
      format: params.format.toLowerCase() as 'csv' | 'excel' | 'pdf',
      exportScope: params.scope,
    });
  },
};
