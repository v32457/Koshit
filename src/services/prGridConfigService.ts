/**
 * CIPPLATFORM - PURCHASE REQUISITIONS (PR) CONFIGURABLE DATA GRID SERVICE
 * Manages column metadata, per-user layout persistence, column resizing/clamping,
 * auto-fit width calculation, drag-and-drop column reordering, multi-column sorting,
 * currency-appropriate numerical formatting (without currency symbol), and Expected Delivery Date resolution.
 */

import { PurchaseRequisitionHeader, PRStatus } from '../types/purchaseRequisition';

export type PRColumnKey =
  | 'prNumber'
  | 'prType'
  | 'branchName'
  | 'department'
  | 'requesterName'
  | 'purposeAndItems'
  | 'currency'
  | 'estimatedTotalValue'
  | 'expectedDeliveryDate'
  | 'prDate'
  | 'budgetValidationStatus'
  | 'approvalStatus'
  | 'buyerStatus'
  | 'assignedBuyer'
  | 'priority'
  | 'requiredBy'
  | 'creatorName'
  | 'createdAt'
  | 'modifiedBy'
  | 'updatedAt';

export type PRColumnDataType = 'text' | 'number' | 'date' | 'status';

export interface PRColumnDefinition {
  key: PRColumnKey;
  label: string;
  description: string;
  defaultVisible: boolean;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  sortable: boolean;
  dataType: PRColumnDataType;
  align: 'left' | 'center' | 'right';
  mandatory?: boolean;
}

export type PRViewType = 'HEADER' | 'LINE';

export type PRLineColumnKey =
  | 'prNumber'
  | 'lineNumber'
  | 'itemCode'
  | 'description'
  | 'itemCategory'
  | 'inventoryUom'
  | 'requestedQuantity'
  | 'receivedQuantity'
  | 'pendingQuantity'
  | 'currency'
  | 'approximateUnitPrice'
  | 'estimatedTotalValue'
  | 'expectedDeliveryDate'
  | 'prDate'
  | 'lineStatus'
  | 'prType'
  | 'branchName'
  | 'department'
  | 'requesterName'
  | 'budgetValidationStatus'
  | 'buyerStatus'
  | 'assignedBuyer'
  | 'createdAt'
  | 'updatedAt';

export interface PRLineColumnDefinition {
  key: PRLineColumnKey;
  label: string;
  description: string;
  defaultVisible: boolean;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  sortable: boolean;
  dataType: PRColumnDataType;
  align: 'left' | 'center' | 'right';
  mandatory?: boolean;
}

export interface PRLineGridRow {
  rowId: string;
  prId: string;
  lineId: string;
  prNumber: string;
  lineNumber: number;
  prType: PurchaseRequisitionHeader['prType'];
  companyId: string;
  companyCode: string;
  branchId: string;
  branchName: string;
  department: string;
  requesterName: string;
  itemCode: string;
  description: string;
  itemCategory: string;
  inventoryUom: string;
  requestedQuantity: number;
  receivedQuantity: number;
  pendingQuantity: number;
  currency: string;
  approximateUnitPrice: number;
  estimatedTotalValue: number;
  expectedDeliveryDate: string;
  prDate: string;
  effectiveStatus: PRStatus;
  budgetValidationStatus: PurchaseRequisitionHeader['budgetValidationStatus'];
  buyerStatus: string;
  assignedBuyer: string;
  createdAt: string;
  updatedAt: string;
  pr: PurchaseRequisitionHeader;
  line: PurchaseRequisitionHeader['lines'][number];
}

export interface PRUserColumnState<K extends string = PRColumnKey> {
  key: K;
  visible: boolean;
  width: number;
  order: number;
}

export interface PRSortRule<K extends string = PRColumnKey> {
  key: K;
  direction: 'asc' | 'desc';
}

export interface PRUserGridLayout<K extends string = PRColumnKey> {
  userId: string;
  layoutName: string;
  columns: PRUserColumnState<K>[];
  sortRules: PRSortRule<K>[];
  updatedAt: string;
}

export interface PRSavedLayoutFilterPrefs {
  selectedCompany?: string;
  selectedBranch?: string;
  selectedType?: string;
  selectedDepartment?: string;
  selectedStatus?: string;
  selectedCurrency?: string;
  selectedBudgetStatus?: string;
  deliveryDateFilter?: string;
  minEstimatedValue?: string;
}

export interface PRNamedGridLayout<K extends string = string> {
  id: string;
  layoutName: string;
  viewType: PRViewType;
  moduleId: 'PURCHASE_REQUISITION';
  userId: string;
  companyId: string;
  isDefault: boolean;
  columns: PRUserColumnState<K>[];
  sortRules: PRSortRule<K>[];
  pageSize: number;
  filters?: PRSavedLayoutFilterPrefs;
  createdAt: string;
  updatedAt: string;
}

export const AVAILABLE_PR_COLUMNS: PRColumnDefinition[] = [
  {
    key: 'prNumber',
    label: 'PR Number',
    description: 'Unique PR reference',
    defaultVisible: true,
    defaultWidth: 125,
    minWidth: 105,
    maxWidth: 260,
    sortable: true,
    dataType: 'text',
    align: 'left',
    mandatory: true,
  },
  {
    key: 'prType',
    label: 'PR Type',
    description: 'Manual, MRP, Repair, Maintenance',
    defaultVisible: true,
    defaultWidth: 98,
    minWidth: 88,
    maxWidth: 200,
    sortable: true,
    dataType: 'text',
    align: 'left',
  },
  {
    key: 'branchName',
    label: 'Branch',
    description: 'Requesting branch',
    defaultVisible: true,
    defaultWidth: 122,
    minWidth: 100,
    maxWidth: 280,
    sortable: true,
    dataType: 'text',
    align: 'left',
  },
  {
    key: 'department',
    label: 'Department',
    description: 'Requesting department',
    defaultVisible: true,
    defaultWidth: 120,
    minWidth: 95,
    maxWidth: 260,
    sortable: true,
    dataType: 'text',
    align: 'left',
  },
  {
    key: 'requesterName',
    label: 'Requester',
    description: 'PR creator',
    defaultVisible: true,
    defaultWidth: 140,
    minWidth: 110,
    maxWidth: 320,
    sortable: true,
    dataType: 'text',
    align: 'left',
  },
  {
    key: 'purposeAndItems',
    label: 'Purpose & Items',
    description: 'PR purpose and item summary',
    defaultVisible: true,
    defaultWidth: 185,
    minWidth: 150,
    maxWidth: 460,
    sortable: true,
    dataType: 'text',
    align: 'left',
  },
  {
    key: 'currency',
    label: 'Currency',
    description: 'Transaction currency',
    defaultVisible: true,
    defaultWidth: 105,
    minWidth: 92,
    maxWidth: 160,
    sortable: true,
    dataType: 'text',
    align: 'center',
  },
  {
    key: 'estimatedTotalValue',
    label: 'Estimated Value',
    description: 'PR estimated amount',
    defaultVisible: true,
    defaultWidth: 135,
    minWidth: 110,
    maxWidth: 240,
    sortable: true,
    dataType: 'number',
    align: 'right',
  },
  {
    key: 'expectedDeliveryDate',
    label: 'Expected Delivery Date',
    description: 'Required delivery date',
    defaultVisible: true,
    defaultWidth: 165,
    minWidth: 130,
    maxWidth: 240,
    sortable: true,
    dataType: 'date',
    align: 'left',
  },
  {
    key: 'prDate',
    label: 'PR Date',
    description: 'Creation date',
    defaultVisible: true,
    defaultWidth: 115,
    minWidth: 95,
    maxWidth: 200,
    sortable: true,
    dataType: 'date',
    align: 'left',
  },
  {
    key: 'budgetValidationStatus',
    label: 'Budget Status',
    description: 'Budget validation result',
    defaultVisible: true,
    defaultWidth: 135,
    minWidth: 105,
    maxWidth: 220,
    sortable: true,
    dataType: 'status',
    align: 'left',
  },
  {
    key: 'approvalStatus',
    label: 'Approval Status',
    description: 'Approval workflow status',
    defaultVisible: true,
    defaultWidth: 175,
    minWidth: 125,
    maxWidth: 280,
    sortable: true,
    dataType: 'status',
    align: 'left',
  },
  {
    key: 'buyerStatus',
    label: 'Buyer Status',
    description: 'Buyer assignment status',
    defaultVisible: true,
    defaultWidth: 155,
    minWidth: 115,
    maxWidth: 250,
    sortable: true,
    dataType: 'status',
    align: 'left',
  },
  {
    key: 'assignedBuyer',
    label: 'Assigned Buyer',
    description: 'Responsible buyer',
    defaultVisible: true,
    defaultWidth: 170,
    minWidth: 120,
    maxWidth: 280,
    sortable: true,
    dataType: 'text',
    align: 'left',
  },
  {
    key: 'priority',
    label: 'Priority',
    description: 'PR priority',
    defaultVisible: false,
    defaultWidth: 110,
    minWidth: 85,
    maxWidth: 180,
    sortable: true,
    dataType: 'text',
    align: 'left',
  },
  {
    key: 'requiredBy',
    label: 'Required By',
    description: 'Required date, if separately maintained',
    defaultVisible: false,
    defaultWidth: 125,
    minWidth: 95,
    maxWidth: 200,
    sortable: true,
    dataType: 'date',
    align: 'left',
  },
  {
    key: 'creatorName',
    label: 'Created By',
    description: 'Record creator',
    defaultVisible: false,
    defaultWidth: 145,
    minWidth: 105,
    maxWidth: 260,
    sortable: true,
    dataType: 'text',
    align: 'left',
  },
  {
    key: 'createdAt',
    label: 'Created On',
    description: 'Creation timestamp',
    defaultVisible: false,
    defaultWidth: 165,
    minWidth: 125,
    maxWidth: 260,
    sortable: true,
    dataType: 'date',
    align: 'left',
  },
  {
    key: 'modifiedBy',
    label: 'Modified By',
    description: 'Last modified user',
    defaultVisible: false,
    defaultWidth: 145,
    minWidth: 105,
    maxWidth: 260,
    sortable: true,
    dataType: 'text',
    align: 'left',
  },
  {
    key: 'updatedAt',
    label: 'Modified On',
    description: 'Last modification timestamp',
    defaultVisible: false,
    defaultWidth: 165,
    minWidth: 125,
    maxWidth: 260,
    sortable: true,
    dataType: 'date',
    align: 'left',
  },
];

export const AVAILABLE_PR_LINE_COLUMNS: PRLineColumnDefinition[] = [
  {
    key: 'prNumber',
    label: 'PR Number',
    description: 'Parent Purchase Requisition number',
    defaultVisible: true,
    defaultWidth: 125,
    minWidth: 105,
    maxWidth: 240,
    sortable: true,
    dataType: 'text',
    align: 'left',
    mandatory: true,
  },
  {
    key: 'lineNumber',
    label: 'Line',
    description: 'Sequential line number within PR',
    defaultVisible: true,
    defaultWidth: 68,
    minWidth: 56,
    maxWidth: 120,
    sortable: true,
    dataType: 'number',
    align: 'center',
    mandatory: true,
  },
  {
    key: 'itemCode',
    label: 'Item Code',
    description: 'Authoritative item master code',
    defaultVisible: true,
    defaultWidth: 145,
    minWidth: 110,
    maxWidth: 260,
    sortable: true,
    dataType: 'text',
    align: 'left',
    mandatory: true,
  },
  {
    key: 'description',
    label: 'Item Description',
    description: 'Line item description & specification summary',
    defaultVisible: true,
    defaultWidth: 215,
    minWidth: 150,
    maxWidth: 460,
    sortable: true,
    dataType: 'text',
    align: 'left',
  },
  {
    key: 'inventoryUom',
    label: 'UOM',
    description: 'Authoritative inventory unit of measure',
    defaultVisible: true,
    defaultWidth: 78,
    minWidth: 64,
    maxWidth: 140,
    sortable: true,
    dataType: 'text',
    align: 'center',
  },
  {
    key: 'requestedQuantity',
    label: 'Req Qty',
    description: 'Requested line quantity',
    defaultVisible: true,
    defaultWidth: 96,
    minWidth: 80,
    maxWidth: 180,
    sortable: true,
    dataType: 'number',
    align: 'right',
  },
  {
    key: 'receivedQuantity',
    label: 'Rec Qty',
    description: 'Received line quantity',
    defaultVisible: true,
    defaultWidth: 96,
    minWidth: 80,
    maxWidth: 180,
    sortable: true,
    dataType: 'number',
    align: 'right',
  },
  {
    key: 'pendingQuantity',
    label: 'Pending',
    description: 'Remaining pending quantity',
    defaultVisible: true,
    defaultWidth: 98,
    minWidth: 80,
    maxWidth: 180,
    sortable: true,
    dataType: 'number',
    align: 'right',
  },
  {
    key: 'currency',
    label: 'Currency',
    description: 'Line transaction currency',
    defaultVisible: true,
    defaultWidth: 96,
    minWidth: 82,
    maxWidth: 150,
    sortable: true,
    dataType: 'text',
    align: 'center',
  },
  {
    key: 'approximateUnitPrice',
    label: 'Unit Price',
    description: 'Estimated unit price',
    defaultVisible: true,
    defaultWidth: 116,
    minWidth: 95,
    maxWidth: 220,
    sortable: true,
    dataType: 'number',
    align: 'right',
  },
  {
    key: 'estimatedTotalValue',
    label: 'Estimated Value',
    description: 'Line estimated total amount',
    defaultVisible: true,
    defaultWidth: 135,
    minWidth: 110,
    maxWidth: 240,
    sortable: true,
    dataType: 'number',
    align: 'right',
  },
  {
    key: 'expectedDeliveryDate',
    label: 'Expected Delivery',
    description: 'Line schedule or header expected delivery date',
    defaultVisible: true,
    defaultWidth: 150,
    minWidth: 120,
    maxWidth: 230,
    sortable: true,
    dataType: 'date',
    align: 'left',
  },
  {
    key: 'prDate',
    label: 'PR Date',
    description: 'Parent PR creation date',
    defaultVisible: true,
    defaultWidth: 112,
    minWidth: 95,
    maxWidth: 180,
    sortable: true,
    dataType: 'date',
    align: 'left',
  },
  {
    key: 'lineStatus',
    label: 'Status',
    description: 'Effective line & approval status',
    defaultVisible: true,
    defaultWidth: 170,
    minWidth: 125,
    maxWidth: 260,
    sortable: true,
    dataType: 'status',
    align: 'left',
  },
  {
    key: 'itemCategory',
    label: 'Item Category',
    description: 'Item classification category',
    defaultVisible: false,
    defaultWidth: 135,
    minWidth: 100,
    maxWidth: 260,
    sortable: true,
    dataType: 'text',
    align: 'left',
  },
  {
    key: 'prType',
    label: 'PR Type',
    description: 'Manual, MRP, Repair, Maintenance',
    defaultVisible: false,
    defaultWidth: 100,
    minWidth: 88,
    maxWidth: 180,
    sortable: true,
    dataType: 'text',
    align: 'left',
  },
  {
    key: 'branchName',
    label: 'Branch',
    description: 'Requesting branch',
    defaultVisible: false,
    defaultWidth: 140,
    minWidth: 100,
    maxWidth: 280,
    sortable: true,
    dataType: 'text',
    align: 'left',
  },
  {
    key: 'department',
    label: 'Department',
    description: 'Requesting department',
    defaultVisible: false,
    defaultWidth: 125,
    minWidth: 95,
    maxWidth: 240,
    sortable: true,
    dataType: 'text',
    align: 'left',
  },
  {
    key: 'requesterName',
    label: 'Requester',
    description: 'PR requester name',
    defaultVisible: false,
    defaultWidth: 150,
    minWidth: 110,
    maxWidth: 280,
    sortable: true,
    dataType: 'text',
    align: 'left',
  },
  {
    key: 'budgetValidationStatus',
    label: 'Budget Status',
    description: 'Parent PR budget validation status',
    defaultVisible: false,
    defaultWidth: 130,
    minWidth: 105,
    maxWidth: 220,
    sortable: true,
    dataType: 'status',
    align: 'left',
  },
  {
    key: 'buyerStatus',
    label: 'Buyer Status',
    description: 'Line buyer assignment status',
    defaultVisible: false,
    defaultWidth: 155,
    minWidth: 115,
    maxWidth: 250,
    sortable: true,
    dataType: 'status',
    align: 'left',
  },
  {
    key: 'assignedBuyer',
    label: 'Assigned Buyer',
    description: 'Responsible buyer for line',
    defaultVisible: false,
    defaultWidth: 165,
    minWidth: 120,
    maxWidth: 280,
    sortable: true,
    dataType: 'text',
    align: 'left',
  },
  {
    key: 'createdAt',
    label: 'Created On',
    description: 'Parent PR creation timestamp',
    defaultVisible: false,
    defaultWidth: 165,
    minWidth: 125,
    maxWidth: 260,
    sortable: true,
    dataType: 'date',
    align: 'left',
  },
  {
    key: 'updatedAt',
    label: 'Modified On',
    description: 'Parent PR last modification timestamp',
    defaultVisible: false,
    defaultWidth: 165,
    minWidth: 125,
    maxWidth: 260,
    sortable: true,
    dataType: 'date',
    align: 'left',
  },
];

const LAYOUT_STORAGE_PREFIX = 'cip_pr_grid_layout_v1_';
const NAMED_LAYOUTS_STORAGE_PREFIX = 'cip_pr_named_layouts_v1_';
const ACTIVE_LAYOUT_ID_PREFIX = 'cip_pr_active_layout_id_v1_';
const memoryLayoutStore = new Map<string, string>();

export function getColumnDefinition(key: PRColumnKey): PRColumnDefinition {
  const found = AVAILABLE_PR_COLUMNS.find((c) => c.key === key);
  if (!found) {
    throw new Error(`Unknown PR column key: ${key}`);
  }
  return found;
}

export function getLineColumnDefinition(key: PRLineColumnKey): PRLineColumnDefinition {
  const found = AVAILABLE_PR_LINE_COLUMNS.find((c) => c.key === key);
  if (!found) {
    throw new Error(`Unknown PR line column key: ${key}`);
  }
  return found;
}

export function getDefaultColumnStates(): PRUserColumnState[] {
  return AVAILABLE_PR_COLUMNS.map((col, index) => ({
    key: col.key,
    visible: col.defaultVisible,
    width: col.defaultWidth,
    order: index,
  }));
}

export function getDefaultLineColumnStates(): PRUserColumnState<PRLineColumnKey>[] {
  return AVAILABLE_PR_LINE_COLUMNS.map((col, index) => ({
    key: col.key,
    visible: col.defaultVisible,
    width: col.defaultWidth,
    order: index,
  }));
}

export function getDefaultGridLayout(userId: string): PRUserGridLayout {
  return {
    userId: userId || 'anonymous',
    layoutName: 'Default Layout',
    columns: getDefaultColumnStates(),
    sortRules: [],
    updatedAt: new Date().toISOString(),
  };
}

export function getDefaultLineGridLayout(userId: string): PRUserGridLayout<PRLineColumnKey> {
  return {
    userId: userId || 'anonymous',
    layoutName: 'Default Line Layout',
    columns: getDefaultLineColumnStates(),
    sortRules: [],
    updatedAt: new Date().toISOString(),
  };
}

export function clampColumnWidth(key: PRColumnKey, requestedWidth: number): number {
  const def = AVAILABLE_PR_COLUMNS.find((c) => c.key === key);
  if (!def) return Math.max(80, Math.min(400, Math.round(requestedWidth)));
  const numeric = Number.isFinite(requestedWidth) ? Math.round(requestedWidth) : def.defaultWidth;
  return Math.max(def.minWidth, Math.min(def.maxWidth, numeric));
}

export function clampLineColumnWidth(key: PRLineColumnKey, requestedWidth: number): number {
  const def = AVAILABLE_PR_LINE_COLUMNS.find((c) => c.key === key);
  if (!def) return Math.max(56, Math.min(460, Math.round(requestedWidth)));
  const numeric = Number.isFinite(requestedWidth) ? Math.round(requestedWidth) : def.defaultWidth;
  return Math.max(def.minWidth, Math.min(def.maxWidth, numeric));
}

export function getPrCurrency(pr: PurchaseRequisitionHeader): string {
  const raw = pr.currency || pr.lines?.[0]?.currency || 'INR';
  return raw.trim().toUpperCase();
}

/**
 * Formats ONLY the numerical amount using currency-appropriate number grouping,
 * without combining any currency code or symbol into the output string.
 */
export function formatEstimatedValue(amount: number, currency: string): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const code = (currency || 'INR').trim().toUpperCase();
  const locale = code === 'INR' ? 'en-IN' : 'en-US';
  const hasDecimals = safeAmount % 1 !== 0;
  return new Intl.NumberFormat(locale, {
    style: 'decimal',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

export function isValidIsoDate(dateStr?: string | null): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().startsWith(trimmed);
}

/**
 * Resolves the Expected Delivery Date for a PR header.
 * Uses explicit expectedDeliveryDate when set, or falls back to the earliest
 * line delivery schedule date so existing PR records continue to work seamlessly.
 */
export function getExpectedDeliveryDate(pr: PurchaseRequisitionHeader): string {
  if (pr.prType === 'EXPENSE' && pr.expectedServiceDate && pr.expectedServiceDate.trim()) {
    return pr.expectedServiceDate.trim();
  }
  if (pr.expectedDeliveryDate && pr.expectedDeliveryDate.trim()) {
    return pr.expectedDeliveryDate.trim();
  }
  if (pr.prType === 'EXPENSE' && pr.expenseLines && pr.expenseLines.length > 0) {
    const expDates = pr.expenseLines
      .map((el) => el.expectedServiceDate)
      .filter((d): d is string => Boolean(d && d.trim()))
      .sort();
    return expDates[0] || '';
  }
  const scheduleDates = (pr.lines || [])
    .flatMap((line) => line.deliverySchedules || [])
    .map((s) => s.deliveryDate)
    .filter((d): d is string => Boolean(d && d.trim()))
    .sort();
  return scheduleDates[0] || '';
}

export function getRequiredByDate(pr: PurchaseRequisitionHeader): string {
  if (pr.requiredBy && pr.requiredBy.trim()) {
    return pr.requiredBy.trim();
  }
  return getExpectedDeliveryDate(pr);
}

export function getEffectivePRStatus(pr: PurchaseRequisitionHeader): PRStatus {
  const isCompleted =
    pr.lines &&
    pr.lines.length > 0 &&
    pr.lines.every((line) => (line.receivedQuantity || 0) >= line.requestedQuantity);
  return isCompleted ? 'COMPLETED' : pr.status;
}

export function getBuyerStatus(pr: PurchaseRequisitionHeader): string {
  const statuses = Array.from(
    new Set((pr.lines || []).map((l) => l.buyerStatus).filter(Boolean))
  );
  if (statuses.length === 0) return 'PENDING_CONFIGURATION';
  return statuses.join(', ');
}

export function getAssignedBuyer(pr: PurchaseRequisitionHeader): string {
  const buyers = Array.from(
    new Set((pr.lines || []).map((l) => l.assignedBuyer).filter(Boolean))
  );
  if (buyers.length === 0) return 'Unassigned';
  return buyers.join(', ');
}

export function getModifiedBy(pr: PurchaseRequisitionHeader): string {
  if (pr.modifiedBy && pr.modifiedBy.trim()) return pr.modifiedBy.trim();
  if (pr.changeHistory && pr.changeHistory.length > 0) {
    const latest = pr.changeHistory[pr.changeHistory.length - 1];
    if (latest.changedByName) return latest.changedByName;
  }
  return pr.creatorName || pr.requesterName || 'System';
}

export function getColumnDisplayText(pr: PurchaseRequisitionHeader, key: PRColumnKey): string {
  switch (key) {
    case 'prNumber':
      return pr.prNumber || '';
    case 'prType':
      return pr.prType || '';
    case 'branchName':
      return pr.branchName || '';
    case 'department':
      return pr.department || '';
    case 'requesterName':
      return pr.requesterName || '';
    case 'purposeAndItems':
      return pr.prType === 'EXPENSE'
        ? `${pr.purchasePurpose || ''} (${(pr.expenseLines || []).length} expense line(s))`
        : `${pr.purchasePurpose || ''} (${(pr.lines || []).length} line(s))`;
    case 'currency':
      return getPrCurrency(pr);
    case 'estimatedTotalValue':
      return formatEstimatedValue(pr.estimatedTotalValue, getPrCurrency(pr));
    case 'expectedDeliveryDate':
      return getExpectedDeliveryDate(pr) || '—';
    case 'prDate':
      return pr.createdAt ? new Date(pr.createdAt).toISOString().slice(0, 10) : '—';
    case 'budgetValidationStatus':
      return pr.budgetValidationStatus || '';
    case 'approvalStatus':
      return getEffectivePRStatus(pr);
    case 'buyerStatus':
      return getBuyerStatus(pr);
    case 'assignedBuyer':
      return getAssignedBuyer(pr);
    case 'priority':
      return pr.priority || 'NORMAL';
    case 'requiredBy':
      return getRequiredByDate(pr) || '—';
    case 'creatorName':
      return pr.creatorName || pr.requesterName || '';
    case 'createdAt':
      return pr.createdAt ? new Date(pr.createdAt).toLocaleString() : '—';
    case 'modifiedBy':
      return getModifiedBy(pr);
    case 'updatedAt':
      return pr.updatedAt ? new Date(pr.updatedAt).toLocaleString() : '—';
  }
}

export function getColumnSortValue(pr: PurchaseRequisitionHeader, key: PRColumnKey): string | number {
  switch (key) {
    case 'estimatedTotalValue':
      return Number.isFinite(pr.estimatedTotalValue) ? pr.estimatedTotalValue : 0;
    case 'expectedDeliveryDate': {
      const d = getExpectedDeliveryDate(pr);
      return d ? new Date(`${d}T00:00:00Z`).getTime() : 0;
    }
    case 'requiredBy': {
      const d = getRequiredByDate(pr);
      return d ? new Date(`${d}T00:00:00Z`).getTime() : 0;
    }
    case 'prDate':
    case 'createdAt':
      return pr.createdAt ? new Date(pr.createdAt).getTime() : 0;
    case 'updatedAt':
      return pr.updatedAt ? new Date(pr.updatedAt).getTime() : 0;
    default:
      return getColumnDisplayText(pr, key).toLowerCase();
  }
}

export function flattenPrLines(prs: PurchaseRequisitionHeader[]): PRLineGridRow[] {
  const rows: PRLineGridRow[] = [];
  for (const pr of prs) {
    const headerCurr = getPrCurrency(pr);
    const headerExpDate = getExpectedDeliveryDate(pr);
    const headerEffectiveStatus = getEffectivePRStatus(pr);
    const prDate = pr.createdAt ? new Date(pr.createdAt).toISOString().slice(0, 10) : '';

    if (pr.prType === 'EXPENSE' && pr.expenseLines && pr.expenseLines.length > 0) {
      pr.expenseLines.forEach((el, idx) => {
        const synthesizedLine = {
          id: el.id,
          prId: pr.id,
          itemCode: el.expenseCategoryCode,
          description: el.expenseDescription || el.description || '',
          itemCategory: `${el.expenseCategoryName} (GL ${el.sapGlAccountCode})`,
          inventoryUom: 'SERVICE',
          requestedQuantity: 1,
          approximateUnitPrice: Number(el.baseAmount || el.amount || 0),
          currency: headerCurr,
          estimatedTotalValue: Number(el.totalAmountWithTax || el.amount || 0),
          deliverySchedules: [],
          status: 'ACTIVE' as const,
        };
        rows.push({
          rowId: `${pr.id}::${el.id}`,
          prId: pr.id,
          lineId: el.id,
          prNumber: pr.prNumber || '',
          lineNumber: idx + 1,
          prType: pr.prType,
          companyId: pr.companyId,
          companyCode: pr.companyCode,
          branchId: pr.branchId,
          branchName: pr.branchName || '',
          department: pr.department || '',
          requesterName: pr.requesterName || '',
          itemCode: el.expenseCategoryCode,
          description: el.expenseDescription || el.description || '',
          itemCategory: `${el.expenseCategoryName} (GL ${el.sapGlAccountCode})`,
          inventoryUom: 'SERVICE',
          requestedQuantity: 1,
          receivedQuantity: 0,
          pendingQuantity: 1,
          currency: headerCurr,
          approximateUnitPrice: Number(el.baseAmount || el.amount || 0),
          estimatedTotalValue: Number(el.totalAmountWithTax || el.amount || 0),
          expectedDeliveryDate: el.expectedServiceDate || headerExpDate || '',
          prDate,
          effectiveStatus: headerEffectiveStatus,
          budgetValidationStatus: pr.budgetValidationStatus,
          buyerStatus: 'EXPENSE_SERVICE_LINE',
          assignedBuyer: el.vendorSuggestion || 'Service Procurement',
          createdAt: pr.createdAt || '',
          updatedAt: pr.updatedAt || '',
          pr,
          line: synthesizedLine,
        });
      });
      continue;
    }

    const lines = pr.lines || [];
    lines.forEach((line, idx) => {
      const lineCurr = (line.currency || headerCurr || 'INR').trim().toUpperCase();
      const lineExpDate =
        line.deliverySchedules?.[0]?.deliveryDate || headerExpDate || '';
      const received = Number(line.receivedQuantity || 0);
      const requested = Number(line.requestedQuantity || 0);
      const pending = Math.max(0, requested - received);
      const effectiveStatus =
        line.status === 'ACTIVE'
          ? headerEffectiveStatus
          : (line.status as unknown as PRStatus);

      rows.push({
        rowId: `${pr.id}::${line.id}`,
        prId: pr.id,
        lineId: line.id,
        prNumber: pr.prNumber || '',
        lineNumber: idx + 1,
        prType: pr.prType,
        companyId: pr.companyId,
        companyCode: pr.companyCode,
        branchId: pr.branchId,
        branchName: pr.branchName || '',
        department: pr.department || '',
        requesterName: pr.requesterName || '',
        itemCode: line.itemCode || '',
        description: line.description || '',
        itemCategory: line.itemCategory || '',
        inventoryUom: line.inventoryUom || '',
        requestedQuantity: requested,
        receivedQuantity: received,
        pendingQuantity: pending,
        currency: lineCurr,
        approximateUnitPrice: Number(line.approximateUnitPrice || 0),
        estimatedTotalValue: Number(line.estimatedTotalValue || 0),
        expectedDeliveryDate: lineExpDate,
        prDate,
        effectiveStatus,
        budgetValidationStatus: pr.budgetValidationStatus,
        buyerStatus: line.buyerStatus || 'PENDING_CONFIGURATION',
        assignedBuyer: line.assignedBuyer || 'Unassigned',
        createdAt: pr.createdAt || '',
        updatedAt: pr.updatedAt || '',
        pr,
        line,
      });
    });
  }
  return rows;
}

export function getLineColumnDisplayText(row: PRLineGridRow, key: PRLineColumnKey): string {
  switch (key) {
    case 'prNumber':
      return row.prNumber;
    case 'lineNumber':
      return String(row.lineNumber);
    case 'itemCode':
      return row.itemCode;
    case 'description':
      return row.description;
    case 'itemCategory':
      return row.itemCategory || '—';
    case 'inventoryUom':
      return row.inventoryUom || '—';
    case 'requestedQuantity':
      return String(row.requestedQuantity);
    case 'receivedQuantity':
      return String(row.receivedQuantity);
    case 'pendingQuantity':
      return String(row.pendingQuantity);
    case 'currency':
      return row.currency;
    case 'approximateUnitPrice':
      return formatEstimatedValue(row.approximateUnitPrice, row.currency);
    case 'estimatedTotalValue':
      return formatEstimatedValue(row.estimatedTotalValue, row.currency);
    case 'expectedDeliveryDate':
      return row.expectedDeliveryDate || '—';
    case 'prDate':
      return row.prDate || '—';
    case 'lineStatus':
      return row.effectiveStatus || '';
    case 'prType':
      return row.prType || '';
    case 'branchName':
      return row.branchName || '';
    case 'department':
      return row.department || '';
    case 'requesterName':
      return row.requesterName || '';
    case 'budgetValidationStatus':
      return row.budgetValidationStatus || '';
    case 'buyerStatus':
      return row.buyerStatus || '';
    case 'assignedBuyer':
      return row.assignedBuyer || 'Unassigned';
    case 'createdAt':
      return row.createdAt ? new Date(row.createdAt).toLocaleString() : '—';
    case 'updatedAt':
      return row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—';
  }
}

export function getLineColumnSortValue(row: PRLineGridRow, key: PRLineColumnKey): string | number {
  switch (key) {
    case 'lineNumber':
      return row.lineNumber;
    case 'requestedQuantity':
      return row.requestedQuantity;
    case 'receivedQuantity':
      return row.receivedQuantity;
    case 'pendingQuantity':
      return row.pendingQuantity;
    case 'approximateUnitPrice':
      return Number.isFinite(row.approximateUnitPrice) ? row.approximateUnitPrice : 0;
    case 'estimatedTotalValue':
      return Number.isFinite(row.estimatedTotalValue) ? row.estimatedTotalValue : 0;
    case 'expectedDeliveryDate':
      return row.expectedDeliveryDate
        ? new Date(`${row.expectedDeliveryDate}T00:00:00Z`).getTime()
        : 0;
    case 'prDate':
    case 'createdAt':
      return row.createdAt ? new Date(row.createdAt).getTime() : 0;
    case 'updatedAt':
      return row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
    default:
      return getLineColumnDisplayText(row, key).toLowerCase();
  }
}

export function calculateAutoFitWidth(
  key: PRColumnKey,
  prs: PurchaseRequisitionHeader[]
): number {
  const def = getColumnDefinition(key);
  const headerEstimatedPx = def.label.length * 8 + 48;
  const maxCellChars = prs.reduce((maxLen, pr) => {
    const text = getColumnDisplayText(pr, key);
    return Math.max(maxLen, text.length);
  }, 0);
  const cellEstimatedPx = maxCellChars * 7.2 + 34;
  return clampColumnWidth(key, Math.max(headerEstimatedPx, cellEstimatedPx));
}

export function calculateLineAutoFitWidth(
  key: PRLineColumnKey,
  rows: PRLineGridRow[]
): number {
  const def = getLineColumnDefinition(key);
  const headerEstimatedPx = def.label.length * 8 + 48;
  const maxCellChars = rows.reduce((maxLen, row) => {
    const text = getLineColumnDisplayText(row, key);
    return Math.max(maxLen, text.length);
  }, 0);
  const cellEstimatedPx = maxCellChars * 7.2 + 34;
  return clampLineColumnWidth(key, Math.max(headerEstimatedPx, cellEstimatedPx));
}

export function reorderColumns<K extends string = PRColumnKey>(
  columns: PRUserColumnState<K>[],
  fromKey: K,
  toKey: K
): PRUserColumnState<K>[] {
  if (fromKey === toKey) return columns;
  const sorted = [...columns].sort((a, b) => a.order - b.order);
  const fromIdx = sorted.findIndex((c) => c.key === fromKey);
  const toIdx = sorted.findIndex((c) => c.key === toKey);
  if (fromIdx === -1 || toIdx === -1) return columns;

  const [moved] = sorted.splice(fromIdx, 1);
  sorted.splice(toIdx, 0, moved);
  return sorted.map((col, idx) => ({
    ...col,
    order: idx,
  }));
}

export function toggleSortRule<K extends string = PRColumnKey>(
  currentRules: PRSortRule<K>[],
  key: K,
  multiSort = false
): PRSortRule<K>[] {
  const existingIdx = currentRules.findIndex((r) => r.key === key);

  if (!multiSort) {
    if (existingIdx === 0 && currentRules.length === 1) {
      const current = currentRules[0];
      if (current.direction === 'asc') {
        return [{ key, direction: 'desc' }];
      }
      return [];
    }
    return [{ key, direction: 'asc' }];
  }

  // Multi-sort mode (e.g. Shift+Click)
  const next = [...currentRules];
  if (existingIdx === -1) {
    next.push({ key, direction: 'asc' });
  } else if (next[existingIdx].direction === 'asc') {
    next[existingIdx] = { key, direction: 'desc' };
  } else {
    next.splice(existingIdx, 1);
  }
  return next;
}

export function sortPrRecords(
  prs: PurchaseRequisitionHeader[],
  sortRules: PRSortRule[]
): PurchaseRequisitionHeader[] {
  const effectiveRules: PRSortRule[] =
    sortRules && sortRules.length > 0
      ? sortRules
      : [{ key: 'prDate', direction: 'desc' }];

  return [...prs].sort((a, b) => {
    for (const rule of effectiveRules) {
      const aVal = getColumnSortValue(a, rule.key);
      const bVal = getColumnSortValue(b, rule.key);
      if (aVal < bVal) return rule.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return rule.direction === 'asc' ? 1 : -1;
    }
    // Deterministic descending PR Number / ID tie-breaker
    const prA = String(a.prNumber || a.id || '');
    const prB = String(b.prNumber || b.id || '');
    return prB.localeCompare(prA, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export function sortPrLineRecords(
  rows: PRLineGridRow[],
  sortRules: PRSortRule<PRLineColumnKey>[]
): PRLineGridRow[] {
  const validRules = (sortRules || []).filter((r) =>
    AVAILABLE_PR_LINE_COLUMNS.some((def) => def.key === r.key)
  );
  const effectiveRules: PRSortRule<PRLineColumnKey>[] =
    validRules.length > 0
      ? validRules
      : [{ key: 'prDate', direction: 'desc' }];

  return [...rows].sort((a, b) => {
    for (const rule of effectiveRules) {
      const aVal = getLineColumnSortValue(a, rule.key);
      const bVal = getLineColumnSortValue(b, rule.key);
      if (aVal < bVal) return rule.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return rule.direction === 'asc' ? 1 : -1;
    }
    // Deterministic tie-breakers: PR Number DESC, then Line Number ASC, then Row ID
    const prCmp = b.prNumber.localeCompare(a.prNumber, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    if (prCmp !== 0) return prCmp;
    if (a.lineNumber !== b.lineNumber) return a.lineNumber - b.lineNumber;
    return b.rowId.localeCompare(a.rowId, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function readRawStore(key: string): string | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return memoryLayoutStore.get(key) || null;
}

function writeRawStore(key: string, serialized: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, serialized);
  }
  memoryLayoutStore.set(key, serialized);
}

function removeRawStore(key: string): void {
  memoryLayoutStore.delete(key);
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
  }
}

function normalizeHeaderColumns(
  columns: Array<Partial<PRUserColumnState<string>>> | undefined
): PRUserColumnState<PRColumnKey>[] {
  const savedMap = new Map<PRColumnKey, PRUserColumnState<PRColumnKey>>();
  (columns || []).forEach((col) => {
    if (!col || !col.key) return;
    const def = AVAILABLE_PR_COLUMNS.find((d) => d.key === col.key);
    if (!def) return;
    savedMap.set(def.key, {
      key: def.key,
      visible: def.mandatory
        ? true
        : typeof col.visible === 'boolean'
        ? col.visible
        : def.defaultVisible,
      width: clampColumnWidth(def.key, Number(col.width ?? def.defaultWidth)),
      order: typeof col.order === 'number' ? col.order : 999,
    });
  });

  return AVAILABLE_PR_COLUMNS.map((def, idx) => {
    const existing = savedMap.get(def.key);
    if (existing) return existing;
    return {
      key: def.key,
      visible: def.mandatory ? true : def.defaultVisible,
      width: def.defaultWidth,
      order: 1000 + idx,
    };
  })
    .sort((a, b) => a.order - b.order)
    .map((c, idx) => ({ ...c, order: idx }));
}

function normalizeLineColumns(
  columns: Array<Partial<PRUserColumnState<string>>> | undefined
): PRUserColumnState<PRLineColumnKey>[] {
  const savedMap = new Map<PRLineColumnKey, PRUserColumnState<PRLineColumnKey>>();
  (columns || []).forEach((col) => {
    if (!col || !col.key) return;
    const def = AVAILABLE_PR_LINE_COLUMNS.find((d) => d.key === col.key);
    if (!def) return;
    savedMap.set(def.key, {
      key: def.key,
      visible: def.mandatory
        ? true
        : typeof col.visible === 'boolean'
        ? col.visible
        : def.defaultVisible,
      width: clampLineColumnWidth(def.key, Number(col.width ?? def.defaultWidth)),
      order: typeof col.order === 'number' ? col.order : 999,
    });
  });

  return AVAILABLE_PR_LINE_COLUMNS.map((def, idx) => {
    const existing = savedMap.get(def.key);
    if (existing) return existing;
    return {
      key: def.key,
      visible: def.mandatory ? true : def.defaultVisible,
      width: def.defaultWidth,
      order: 1000 + idx,
    };
  })
    .sort((a, b) => a.order - b.order)
    .map((c, idx) => ({ ...c, order: idx }));
}

function normalizeViewColumns<K extends string>(
  viewType: PRViewType,
  columns: Array<Partial<PRUserColumnState<string>>> | undefined
): PRUserColumnState<K>[] {
  return (viewType === 'HEADER'
    ? normalizeHeaderColumns(columns)
    : normalizeLineColumns(columns)) as unknown as PRUserColumnState<K>[];
}

function normalizeViewSortRules<K extends string>(
  viewType: PRViewType,
  sortRules: Array<{ key: string; direction: string }> | undefined
): PRSortRule<K>[] {
  const allowedKeys = new Set<string>(
    viewType === 'HEADER'
      ? AVAILABLE_PR_COLUMNS.map((c) => c.key)
      : AVAILABLE_PR_LINE_COLUMNS.map((c) => c.key)
  );
  return (sortRules || [])
    .filter(
      (r) =>
        r &&
        allowedKeys.has(r.key) &&
        (r.direction === 'asc' || r.direction === 'desc')
    )
    .map((r) => ({ key: r.key as K, direction: r.direction as 'asc' | 'desc' }));
}

function namedLayoutsKey(userId: string, viewType: PRViewType, companyId: string): string {
  const safeUser = (userId || 'anonymous').trim();
  const safeCompany = (companyId || 'ALL').trim();
  return `${NAMED_LAYOUTS_STORAGE_PREFIX}${safeUser}__${safeCompany}__${viewType}`;
}

function activeLayoutIdKey(userId: string, viewType: PRViewType, companyId: string): string {
  const safeUser = (userId || 'anonymous').trim();
  const safeCompany = (companyId || 'ALL').trim();
  return `${ACTIVE_LAYOUT_ID_PREFIX}${safeUser}__${safeCompany}__${viewType}`;
}

export function listSavedViewLayouts<K extends string = string>(
  userId: string,
  viewType: PRViewType,
  companyId: string = 'ALL'
): PRNamedGridLayout<K>[] {
  const safeUser = (userId || 'anonymous').trim();
  const safeCompany = (companyId || 'ALL').trim();
  const key = namedLayoutsKey(safeUser, viewType, safeCompany);
  try {
    const raw = readRawStore(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (l) =>
          l &&
          typeof l.id === 'string' &&
          l.userId === safeUser &&
          l.viewType === viewType &&
          l.companyId === safeCompany
      )
      .map((l) => ({
        ...l,
        columns: normalizeViewColumns<K>(viewType, l.columns),
        sortRules: normalizeViewSortRules<K>(viewType, l.sortRules),
        pageSize: Number.isFinite(Number(l.pageSize)) ? Number(l.pageSize) : 20,
      }));
  } catch {
    return [];
  }
}

const FACTORY_DEFAULT_SENTINEL = '__FACTORY_DEFAULT__';

export function getActiveSavedViewLayout<K extends string = string>(
  userId: string,
  viewType: PRViewType,
  companyId: string = 'ALL'
): PRNamedGridLayout<K> | null {
  const layouts = listSavedViewLayouts<K>(userId, viewType, companyId);
  if (layouts.length === 0) return null;
  const activeId = readRawStore(activeLayoutIdKey(userId, viewType, companyId));
  if (activeId === FACTORY_DEFAULT_SENTINEL) {
    return null;
  }
  if (activeId) {
    const found = layouts.find((l) => l.id === activeId);
    if (found) return found;
  }
  return layouts.find((l) => l.isDefault) || null;
}

export function saveNamedViewLayout<K extends string = string>(params: {
  userId: string;
  viewType: PRViewType;
  companyId?: string;
  layoutId?: string;
  layoutName: string;
  columns: PRUserColumnState<K>[];
  sortRules: PRSortRule<K>[];
  pageSize: number;
  filters?: PRSavedLayoutFilterPrefs;
  isDefault?: boolean;
}): PRNamedGridLayout<K> {
  const safeUser = (params.userId || 'anonymous').trim();
  const safeCompany = (params.companyId || 'ALL').trim();
  const trimmedName = (params.layoutName || '').trim();
  if (!trimmedName) {
    throw new Error('Layout name is required.');
  }

  const existingList = listSavedViewLayouts<K>(safeUser, params.viewType, safeCompany);
  const targetExisting = params.layoutId
    ? existingList.find((l) => l.id === params.layoutId)
    : undefined;

  if (params.layoutId && !targetExisting) {
    throw new Error('Cannot update layout: layout not found for your user and company scope.');
  }

  const now = new Date().toISOString();
  const normalizedCols = normalizeViewColumns<K>(params.viewType, params.columns);
  const normalizedSorts = normalizeViewSortRules<K>(params.viewType, params.sortRules);
  const makeDefault = params.isDefault ?? (targetExisting ? targetExisting.isDefault : existingList.length === 0);

  const savedRecord: PRNamedGridLayout<K> = {
    id: targetExisting?.id || `pr-layout-${params.viewType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    layoutName: trimmedName,
    viewType: params.viewType,
    moduleId: 'PURCHASE_REQUISITION',
    userId: safeUser,
    companyId: safeCompany,
    isDefault: makeDefault,
    columns: normalizedCols,
    sortRules: normalizedSorts,
    pageSize: Number.isFinite(params.pageSize) ? params.pageSize : 20,
    filters: params.filters ? { ...params.filters } : undefined,
    createdAt: targetExisting?.createdAt || now,
    updatedAt: now,
  };

  let nextList: PRNamedGridLayout<K>[];
  if (targetExisting) {
    nextList = existingList.map((l) => (l.id === savedRecord.id ? savedRecord : l));
  } else {
    nextList = [...existingList, savedRecord];
  }

  if (makeDefault) {
    nextList = nextList.map((l) => ({
      ...l,
      isDefault: l.id === savedRecord.id,
    }));
  }

  try {
    writeRawStore(
      namedLayoutsKey(safeUser, params.viewType, safeCompany),
      JSON.stringify(nextList)
    );
    writeRawStore(activeLayoutIdKey(safeUser, params.viewType, safeCompany), savedRecord.id);
    if (params.viewType === 'HEADER') {
      saveUserGridLayout(safeUser, {
        columns: normalizedCols as unknown as PRUserColumnState[],
        sortRules: normalizedSorts as unknown as PRSortRule[],
        layoutName: savedRecord.layoutName,
      });
    }
  } catch (err: any) {
    throw new Error(
      `Failed to persist saved layout (${err?.message || 'Storage error'}).`
    );
  }

  return savedRecord;
}

export function loadSavedViewLayoutById<K extends string = string>(
  userId: string,
  viewType: PRViewType,
  companyId: string = 'ALL',
  layoutId: string
): PRNamedGridLayout<K> {
  const layouts = listSavedViewLayouts<K>(userId, viewType, companyId);
  const found = layouts.find((l) => l.id === layoutId);
  if (!found) {
    throw new Error('Selected layout was not found in your scope.');
  }
  try {
    writeRawStore(activeLayoutIdKey(userId, viewType, companyId), found.id);
    if (viewType === 'HEADER') {
      saveUserGridLayout(userId, {
        columns: found.columns as unknown as PRUserColumnState[],
        sortRules: found.sortRules as unknown as PRSortRule[],
        layoutName: found.layoutName,
      });
    }
  } catch (err: any) {
    throw new Error(`Failed to activate saved layout (${err?.message || 'Storage error'}).`);
  }
  return found;
}

export function setDefaultSavedViewLayout<K extends string = string>(
  userId: string,
  viewType: PRViewType,
  companyId: string = 'ALL',
  layoutId: string
): PRNamedGridLayout<K>[] {
  const layouts = listSavedViewLayouts<K>(userId, viewType, companyId);
  const target = layouts.find((l) => l.id === layoutId);
  if (!target) {
    throw new Error('Layout not found for your user and company scope.');
  }
  const now = new Date().toISOString();
  const next = layouts.map((l) => ({
    ...l,
    isDefault: l.id === layoutId,
    updatedAt: l.id === layoutId ? now : l.updatedAt,
  }));
  try {
    writeRawStore(namedLayoutsKey(userId, viewType, companyId), JSON.stringify(next));
    writeRawStore(activeLayoutIdKey(userId, viewType, companyId), layoutId);
  } catch (err: any) {
    throw new Error(`Failed to set default layout (${err?.message || 'Storage error'}).`);
  }
  return next;
}

export function deleteSavedViewLayout<K extends string = string>(
  userId: string,
  viewType: PRViewType,
  companyId: string = 'ALL',
  layoutId: string
): PRNamedGridLayout<K>[] {
  const layouts = listSavedViewLayouts<K>(userId, viewType, companyId);
  const target = layouts.find((l) => l.id === layoutId);
  if (!target) {
    throw new Error('Cannot delete layout: layout not found or owned by another user.');
  }
  const next = layouts.filter((l) => l.id !== layoutId);
  try {
    writeRawStore(namedLayoutsKey(userId, viewType, companyId), JSON.stringify(next));
    const currentActiveId = readRawStore(activeLayoutIdKey(userId, viewType, companyId));
    if (currentActiveId === layoutId) {
      removeRawStore(activeLayoutIdKey(userId, viewType, companyId));
    }
  } catch (err: any) {
    throw new Error(`Failed to delete saved layout (${err?.message || 'Storage error'}).`);
  }
  return next;
}

export function resetViewGridLayout<K extends string = string>(
  userId: string,
  viewType: PRViewType,
  companyId: string = 'ALL'
): {
  columns: PRUserColumnState<K>[];
  sortRules: PRSortRule<K>[];
  pageSize: number;
} {
  writeRawStore(activeLayoutIdKey(userId, viewType, companyId), FACTORY_DEFAULT_SENTINEL);
  if (viewType === 'HEADER') {
    resetUserGridLayout(userId);
    return {
      columns: getDefaultColumnStates() as unknown as PRUserColumnState<K>[],
      sortRules: [],
      pageSize: 20,
    };
  }
  return {
    columns: getDefaultLineColumnStates() as unknown as PRUserColumnState<K>[],
    sortRules: [],
    pageSize: 20,
  };
}

export function getUserGridLayout(userId: string): PRUserGridLayout {
  const safeUserId = userId || 'anonymous';
  const storageKey = `${LAYOUT_STORAGE_PREFIX}${safeUserId}`;
  try {
    const raw = readRawStore(storageKey);
    if (!raw) {
      return getDefaultGridLayout(safeUserId);
    }
    const parsed = JSON.parse(raw) as Partial<PRUserGridLayout>;
    const merged = normalizeHeaderColumns(parsed.columns);
    const validSortRules = normalizeViewSortRules<PRColumnKey>('HEADER', parsed.sortRules);

    return {
      userId: safeUserId,
      layoutName: parsed.layoutName || 'Saved User Layout',
      columns: merged,
      sortRules: validSortRules,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return getDefaultGridLayout(safeUserId);
  }
}

export function saveUserGridLayout(
  userId: string,
  layout: Pick<PRUserGridLayout, 'columns' | 'sortRules'> & { layoutName?: string }
): PRUserGridLayout {
  const safeUserId = userId || 'anonymous';
  const storageKey = `${LAYOUT_STORAGE_PREFIX}${safeUserId}`;
  const normalizedColumns = normalizeHeaderColumns(layout.columns);

  const payload: PRUserGridLayout = {
    userId: safeUserId,
    layoutName: layout.layoutName || 'Saved User Layout',
    columns: normalizedColumns,
    sortRules: normalizeViewSortRules<PRColumnKey>('HEADER', layout.sortRules),
    updatedAt: new Date().toISOString(),
  };

  const serialized = JSON.stringify(payload);
  writeRawStore(storageKey, serialized);
  return payload;
}

export function resetUserGridLayout(userId: string): PRUserGridLayout {
  const safeUserId = userId || 'anonymous';
  const storageKey = `${LAYOUT_STORAGE_PREFIX}${safeUserId}`;
  removeRawStore(storageKey);
  return getDefaultGridLayout(safeUserId);
}

export function hasSavedUserGridLayout(userId: string): boolean {
  const safeUserId = userId || 'anonymous';
  const storageKey = `${LAYOUT_STORAGE_PREFIX}${safeUserId}`;
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(storageKey) !== null;
  }
  return memoryLayoutStore.has(storageKey);
}

