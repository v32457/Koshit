/**
 * CIPPLATFORM — CENTRALIZED GLOBAL DATA GRID & PAGINATION SERVICE
 * Enforces:
 * - Standard Rows Per Page Options: [10, 20, 25, 50, 100, 200] with Default = 20
 * - Global Default Descending (Newest First) Sort Order + Deterministic ID Tie-Breaker
 * - Page clamping after deletion, reset-to-page-1 on search/filter/pageSize change
 * - User + Device scoped layout, sort, and page-size preferences with Reset Layout
 * - Standardized Server/Client Pagination Contract and Page Range Builder
 * - Application-Wide Data Grid Audit & Compliance Matrix
 */

import {
  STANDARD_PAGE_SIZE_OPTIONS,
  GlobalDataGridSettings,
  GridDeviceType,
  GridQueryRequest,
  GridQueryResponse,
  GridSortRule,
  GridFilterRule,
  UserGridPreference,
  GridAuditMatrixEntry,
} from '../types/dataGrid';

const STORAGE_KEY_GRID_SETTINGS = 'cip_global_grid_settings_v1';
const STORAGE_KEY_USER_GRID_PREF_PREFIX = 'cip_grid_pref_v1';

const DEFAULT_SETTINGS: GlobalDataGridSettings = {
  allowedPageSizeOptions: [...STANDARD_PAGE_SIZE_OPTIONS],
  defaultPageSize: 20,
  maxPageSize: 200,
  defaultSortDirection: 'desc',
  dateDisplayFormat: 'YYYY-MM-DD',
  maxExportRecords: 50000,
  maxExportFileSizeBytes: 15 * 1024 * 1024,
  updatedAt: '2026-11-13T00:00:00Z',
  updatedBy: 'Platform Governance Default',
};

let memorySettings: GlobalDataGridSettings | null = null;
const memoryUserPrefs = new Map<string, UserGridPreference>();

function parseDateTimestamp(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) {
    const t = val.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val;
  }
  const str = String(val).trim();
  if (!str) return null;
  // Detect ISO date or date-time strings
  if (/^\d{4}-\d{2}-\d{2}/.test(str) || !Number.isNaN(Date.parse(str))) {
    const parsed = Date.parse(str);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function isDateLikeField(fieldName: string): boolean {
  const lower = fieldName.toLowerCase();
  return (
    lower.includes('date') ||
    lower.endsWith('at') ||
    lower.includes('timestamp') ||
    lower.includes('created') ||
    lower.includes('updated') ||
    lower.includes('modified') ||
    lower.includes('submitted') ||
    lower.includes('deadline')
  );
}

/**
 * Deterministic comparison handling nulls/missing values cleanly:
 * Null/undefined/empty values always sink to the bottom in BOTH ascending & descending sorts
 * so missing dates never hijack page 1!
 */
export function compareGridValues(
  aVal: unknown,
  bVal: unknown,
  direction: 'asc' | 'desc',
  dataType?: 'text' | 'number' | 'date' | 'status',
  fieldName = ''
): number {
  const aEmpty = aVal === null || aVal === undefined || aVal === '';
  const bEmpty = bVal === null || bVal === undefined || bVal === '';

  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1; // Always push missing/null dates/values after populated records
  if (bEmpty) return -1;

  let cmp = 0;

  if (dataType === 'number' || (typeof aVal === 'number' && typeof bVal === 'number')) {
    cmp = Number(aVal) - Number(bVal);
  } else if (dataType === 'date' || isDateLikeField(fieldName)) {
    const tA = parseDateTimestamp(aVal);
    const tB = parseDateTimestamp(bVal);
    if (tA !== null && tB !== null) {
      cmp = tA - tB;
    } else if (tA === null && tB === null) {
      cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
    } else {
      return tA === null ? 1 : -1;
    }
  } else {
    cmp = String(aVal).localeCompare(String(bVal), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }

  return direction === 'asc' ? cmp : -cmp;
}

export function getGlobalGridSettings(): GlobalDataGridSettings {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_GRID_SETTINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            ...DEFAULT_SETTINGS,
            ...parsed,
            allowedPageSizeOptions: normalizeAllowedPageSizeOptions(parsed.allowedPageSizeOptions),
            defaultPageSize: normalizePageSize(parsed.defaultPageSize, {
              ...DEFAULT_SETTINGS,
              ...parsed,
            }),
            maxPageSize: Math.min(200, Math.max(20, Number(parsed.maxPageSize) || 200)),
            defaultSortDirection: 'desc', // Factory mandate
          };
        }
      }
    } catch {
      // ignore storage errors
    }
  }
  return memorySettings ? { ...memorySettings } : { ...DEFAULT_SETTINGS };
}

export function saveGlobalGridSettings(
  updates: Partial<GlobalDataGridSettings>,
  actorName: string
): GlobalDataGridSettings {
  const current = getGlobalGridSettings();
  const allowedOptions = normalizeAllowedPageSizeOptions(
    updates.allowedPageSizeOptions ?? current.allowedPageSizeOptions
  );
  const maxPageSize = Math.min(200, Math.max(10, Number(updates.maxPageSize ?? current.maxPageSize) || 200));
  const candidateDefault = Number(updates.defaultPageSize ?? current.defaultPageSize) || 20;
  const defaultPageSize = allowedOptions.includes(candidateDefault)
    ? candidateDefault
    : allowedOptions.includes(20)
    ? 20
    : allowedOptions[0];

  const next: GlobalDataGridSettings = {
    ...current,
    ...updates,
    allowedPageSizeOptions: allowedOptions,
    defaultPageSize,
    maxPageSize,
    defaultSortDirection: 'desc',
    maxExportRecords: Math.min(100000, Math.max(100, Number(updates.maxExportRecords ?? current.maxExportRecords) || 50000)),
    maxExportFileSizeBytes: Math.min(
      50 * 1024 * 1024,
      Math.max(1024 * 1024, Number(updates.maxExportFileSizeBytes ?? current.maxExportFileSizeBytes) || 15 * 1024 * 1024)
    ),
    updatedAt: new Date().toISOString(),
    updatedBy: actorName || 'Platform Admin',
  };

  memorySettings = { ...next };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_GRID_SETTINGS, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('cip-grid-settings-updated', { detail: next }));
    } catch {
      // ignore
    }
  }
  return next;
}

export function normalizeAllowedPageSizeOptions(input?: unknown): number[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [...STANDARD_PAGE_SIZE_OPTIONS];
  }
  const filtered = Array.from(
    new Set(
      input
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 10 && n <= 200)
    )
  ).sort((a, b) => a - b);
  return filtered.length > 0 ? filtered : [...STANDARD_PAGE_SIZE_OPTIONS];
}

export function normalizePageSize(
  requestedSize: unknown,
  settings: GlobalDataGridSettings = getGlobalGridSettings()
): number {
  const num = Number(requestedSize);
  const allowed = settings.allowedPageSizeOptions;
  if (!Number.isFinite(num) || !Number.isInteger(num) || num <= 0) {
    return settings.defaultPageSize || 20;
  }
  if (num > settings.maxPageSize) {
    return settings.maxPageSize;
  }
  if (allowed.includes(num)) {
    return num;
  }
  return settings.defaultPageSize || 20;
}

export function clampPageNumber(
  requestedPage: number,
  totalRecords: number,
  pageSize: number
): number {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalRecords) / Math.max(1, pageSize)));
  if (!Number.isFinite(requestedPage) || requestedPage < 1) return 1;
  if (requestedPage > totalPages) return totalPages;
  return Math.floor(requestedPage);
}

/**
 * Resolves the active sort rules, ensuring Factory Default DESC (Newest First)
 * when the user has not explicitly chosen an alternative sort.
 */
export function resolveEffectiveSortRules<T extends Record<string, any>>(
  requestedSortRules: GridSortRule[] | undefined,
  defaultSortField: string | undefined,
  defaultSortDirection: 'asc' | 'desc' = 'desc',
  sampleData: T[] = []
): GridSortRule[] {
  if (requestedSortRules && requestedSortRules.length > 0) {
    return requestedSortRules;
  }

  let field = defaultSortField;
  if (!field && sampleData.length > 0) {
    const candidateDates = [
      'updatedAt',
      'createdAt',
      'timestamp',
      'prDate',
      'poDate',
      'rfqDate',
      'receiptDate',
      'invoiceDate',
      'submittedAt',
      'documentDate',
      'effectiveFrom',
      'holidayDate',
      'date',
    ];
    const first = sampleData[0];
    field = candidateDates.find((k) => first && k in first) || 'id';
  }

  if (!field) return [];
  return [{ field, direction: defaultSortDirection || 'desc' }];
}

/**
 * Shared Pure Execution Engine for Data Grids:
 * Filters -> Searches -> Sorts (DESC default + deterministic ID tie-breaker) -> Paginates -> Clamps page.
 */
export function executeDataGridQuery<T extends Record<string, any>>(
  records: T[],
  request: GridQueryRequest,
  options?: {
    getFieldValue?: (item: T, field: string) => unknown;
    getRowId?: (item: T) => string;
  }
): GridQueryResponse<T> {
  const settings = getGlobalGridSettings();
  const pageSize = normalizePageSize(request.pageSize ?? settings.defaultPageSize, settings);
  const getVal = options?.getFieldValue || ((item: T, field: string) => item[field]);
  const getRowId =
    options?.getRowId ||
    ((item: T) =>
      String(
        item.id ??
          item.prNumber ??
          item.poNumber ??
          item.rfqNumber ??
          item.globalItemCode ??
          item.code ??
          ''
      ));

  const query = (request.search || '').trim().toLowerCase();
  const searchableFields =
    request.searchableFields && request.searchableFields.length > 0
      ? request.searchableFields
      : records.length > 0
      ? Object.keys(records[0]).filter((k) => k !== 'lines' && k !== 'attachments')
      : [];

  const filtered = records.filter((item) => {
    if (query) {
      const matched = searchableFields.some((field) => {
        const val = getVal(item, field);
        if (val === null || val === undefined) return false;
        if (typeof val === 'object') return false;
        return String(val).toLowerCase().includes(query);
      });
      if (!matched) return false;
    }

    if (request.filters && request.filters.length > 0) {
      for (const flt of request.filters) {
        if (!flt.field) continue;
        const raw = getVal(item, flt.field);
        const str = raw !== null && raw !== undefined ? String(raw).toLowerCase() : '';
        const target = (flt.value || '').toLowerCase().trim();
        if (!evaluateFilterCondition(raw, str, flt.operator, target)) {
          return false;
        }
      }
    }

    return true;
  });

  const effectiveSortRules = resolveEffectiveSortRules(
    request.sortRules,
    request.defaultSortField,
    request.defaultSortDirection || 'desc',
    filtered.length > 0 ? filtered : records
  );

  const tieField = request.tieBreakerField || 'id';
  const sorted = [...filtered].sort((a, b) => {
    for (const rule of effectiveSortRules) {
      const valA = getVal(a, rule.field);
      const valB = getVal(b, rule.field);
      const cmp = compareGridValues(valA, valB, rule.direction, rule.dataType, rule.field);
      if (cmp !== 0) return cmp;
    }
    // Deterministic descending ID / document tie-breaker
    const tieA = tieField ? getVal(a, tieField) ?? getRowId(a) : getRowId(a);
    const tieB = tieField ? getVal(b, tieField) ?? getRowId(b) : getRowId(b);
    return compareGridValues(tieA, tieB, 'desc', 'text', tieField);
  });

  const totalRecords = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const currentPage = clampPageNumber(request.page, totalRecords, pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const pagedData = sorted.slice(startIdx, startIdx + pageSize);

  return {
    data: pagedData,
    pagination: {
      currentPage,
      pageSize,
      totalRecords,
      totalPages,
      rangeStart: totalRecords === 0 ? 0 : startIdx + 1,
      rangeEnd: totalRecords === 0 ? 0 : Math.min(startIdx + pageSize, totalRecords),
    },
    sortApplied: effectiveSortRules,
  };
}

function evaluateFilterCondition(
  rawVal: unknown,
  strVal: string,
  operator: GridFilterRule['operator'],
  targetVal: string
): boolean {
  switch (operator) {
    case 'EQUALS':
      return strVal === targetVal;
    case 'NOT_EQUALS':
      return strVal !== targetVal;
    case 'CONTAINS':
      return strVal.includes(targetVal);
    case 'STARTS_WITH':
      return strVal.startsWith(targetVal);
    case 'ENDS_WITH':
      return strVal.endsWith(targetVal);
    case 'GREATER_THAN':
      return Number(rawVal) > Number(targetVal);
    case 'LESS_THAN':
      return Number(rawVal) < Number(targetVal);
    case 'IS_EMPTY':
      return strVal === '';
    case 'IS_NOT_EMPTY':
      return strVal !== '';
    default:
      return true;
  }
}

/**
 * Generates compact accessible page numbers with ellipsis, e.g. [1, '...', 4, 5, 6, '...', 12]
 */
export function buildPageNumberRange(
  currentPage: number,
  totalPages: number,
  maxVisible = 5
): Array<number | 'ellipsis'> {
  if (totalPages <= maxVisible + 2) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: Array<number | 'ellipsis'> = [1];
  const half = Math.floor(maxVisible / 2);
  let start = Math.max(2, currentPage - half);
  let end = Math.min(totalPages - 1, currentPage + half);

  if (currentPage <= half + 2) {
    end = Math.min(totalPages - 1, maxVisible);
  } else if (currentPage >= totalPages - (half + 1)) {
    start = Math.max(2, totalPages - maxVisible + 1);
  }

  if (start > 2) items.push('ellipsis');
  for (let p = start; p <= end; p++) items.push(p);
  if (end < totalPages - 1) items.push('ellipsis');
  items.push(totalPages);

  return items;
}

// ============================================================================
// USER + DEVICE-SCOPED PREFERENCE PERSISTENCE
// ============================================================================

function prefStorageKey(gridId: string, userId: string, deviceType: GridDeviceType): string {
  return `${STORAGE_KEY_USER_GRID_PREF_PREFIX}_${userId}_${deviceType}_${gridId}`;
}

export function getUserGridPreference(
  gridId: string,
  userId: string = 'usr-default',
  deviceType: GridDeviceType = 'desktop'
): UserGridPreference | null {
  const key = prefStorageKey(gridId, userId, deviceType);
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as UserGridPreference;
        if (parsed && parsed.gridId === gridId && parsed.userId === userId) {
          return {
            ...parsed,
            pageSize: normalizePageSize(parsed.pageSize),
          };
        }
      }
    } catch {
      // ignore
    }
  }
  return memoryUserPrefs.get(key) || null;
}

export function saveUserGridPreference(pref: Omit<UserGridPreference, 'updatedAt'>): UserGridPreference {
  const key = prefStorageKey(pref.gridId, pref.userId, pref.deviceType);
  const normalized: UserGridPreference = {
    ...pref,
    pageSize: normalizePageSize(pref.pageSize),
    updatedAt: new Date().toISOString(),
  };
  memoryUserPrefs.set(key, normalized);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(normalized));
    } catch {
      // ignore
    }
  }
  return normalized;
}

export function resetUserGridPreference(
  gridId: string,
  userId: string = 'usr-default',
  deviceType: GridDeviceType = 'desktop'
): void {
  const key = prefStorageKey(gridId, userId, deviceType);
  memoryUserPrefs.delete(key);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export function resetForTesting(): void {
  memorySettings = null;
  memoryUserPrefs.clear();
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY_GRID_SETTINGS);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_KEY_USER_GRID_PREF_PREFIX)) {
          localStorage.removeItem(k);
        }
      }
    } catch {
      // ignore
    }
  }
}

// ============================================================================
// APPLICATION-WIDE DATA GRID COMPLIANCE AUDIT MATRIX
// ============================================================================

export const GLOBAL_GRID_AUDIT_MATRIX: GridAuditMatrixEntry[] = [
  // Master Data
  {
    gridId: 'item-master-list',
    moduleGroup: 'Master Data',
    screenName: 'Global Item Master',
    filePath: 'src/modules/items/ItemMasterListView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'createdAt',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'globalItemCode',
    supportsServerContract: true,
    supportsPageAndAllExport: true,
    notes: 'Default 20 rows/page, [10,20,25,50,100,200], default DESC sort, aligned with /api/items contract.',
  },
  {
    gridId: 'branch-availability',
    moduleGroup: 'Master Data',
    screenName: 'Branch Item Availability',
    filePath: 'src/modules/items/BranchAvailabilityView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'createdAt',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'globalItemCode',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Standardized pagination footer, rows-per-page=20, DESC default.',
  },
  {
    gridId: 'branch-catalog',
    moduleGroup: 'Master Data',
    screenName: 'Branch Created Items Catalog',
    filePath: 'src/modules/items/BranchCreatedItemsView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'createdAt',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'globalItemCode',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Standardized pagination footer, rows-per-page=20, DESC default.',
  },
  {
    gridId: 'custom-specifications',
    moduleGroup: 'Master Data',
    screenName: 'Custom Specifications Register',
    filePath: 'src/modules/items/CustomSpecificationsView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'updatedAt',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'id',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Standardized pagination footer, rows-per-page=20, DESC default.',
  },
  {
    gridId: 'business-partner-master',
    moduleGroup: 'Master Data',
    screenName: 'Business Partner Master (Suppliers & Customers)',
    filePath: 'src/modules/businessPartners/BusinessPartnerMasterView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'createdAt',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'bpCode',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Paginated via shared DataGridFooter with DESC newest-first default.',
  },
  {
    gridId: 'company-branch-master',
    moduleGroup: 'Master Data',
    screenName: 'Company & Branch Master',
    filePath: 'src/modules/settings/OrganizationsView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'createdAt',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'code',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Company and Branch grids standardized with pagination & DESC default.',
  },
  {
    gridId: 'warehouse-master',
    moduleGroup: 'Inventory',
    screenName: 'Warehouse Master Setup',
    filePath: 'src/modules/settings/WarehouseSetupView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'warehousePriority',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'warehouseCode',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Extended with Part K Warehouse Type, Priority, Cross-Branch & Category Restrictions + pagination.',
  },
  {
    gridId: 'asset-equipment-master',
    moduleGroup: 'Master Data',
    screenName: 'Asset & Equipment Master',
    filePath: 'src/modules/assets/AssetEquipmentView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'purchaseDate',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'assetCode',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Standardized pagination footer, rows-per-page=20, DESC default.',
  },
  // Procurement
  {
    gridId: 'purchase-requisition-list',
    moduleGroup: 'Procurement',
    screenName: 'Purchase Requisitions (Header View)',
    filePath: 'src/modules/requests/PurchaseRequisitionListView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'prDate',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'prNumber',
    supportsServerContract: true,
    supportsPageAndAllExport: true,
    notes: 'Configurable Grid + standardized [10,20,25,50,100,200] pagination (20 default), prDate DESC factory default, Page & All exports, named view-scoped layouts.',
  },
  {
    gridId: 'purchase-requisition-line-list',
    moduleGroup: 'Procurement',
    screenName: 'Purchase Requisitions (Line / Live View)',
    filePath: 'src/modules/requests/PurchaseRequisitionListView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'prDate',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'lineId',
    supportsServerContract: true,
    supportsPageAndAllExport: true,
    notes: 'Full parity with Header View: line-level column settings, resize, drag-and-drop reorder, multi-sort, view-scoped named layouts, true line-level [10,20,25,50,100,200] pagination, and scoped export.',
  },
  {
    gridId: 'future-rfq-floating',
    moduleGroup: 'Procurement',
    screenName: 'Future RFQ Demand Pipeline',
    filePath: 'src/modules/procurement/FutureRfqFloatingView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'createdAt',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'prNumber',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Paginated via shared DataGridFooter with DESC newest-first default.',
  },
  {
    gridId: 'rfq-management',
    moduleGroup: 'Procurement',
    screenName: 'RFQ Management',
    filePath: 'src/modules/procurement/RfqManagementView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'rfqDate',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'rfqNumber',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Paginated via shared DataGridFooter with DESC rfqDate default.',
  },
  {
    gridId: 'supplier-quotations',
    moduleGroup: 'Procurement',
    screenName: 'Supplier Quotations',
    filePath: 'src/modules/procurement/SupplierQuotationsView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'submittedAt',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'quoteNumber',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Paginated via shared DataGridFooter with DESC submittedAt default.',
  },
  {
    gridId: 'purchase-orders',
    moduleGroup: 'Procurement',
    screenName: 'Purchase Orders',
    filePath: 'src/modules/procurement/PurchaseOrderManagementView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'poDate',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'poNumber',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Paginated via shared DataGridFooter with DESC poDate default.',
  },
  {
    gridId: 'goods-receipt',
    moduleGroup: 'Procurement',
    screenName: 'Goods Receipt & Invoice Matching',
    filePath: 'src/modules/procurement/GoodsReceiptView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'receiptDate',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'grnNumber',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'GRN and Supplier Invoices paginated via shared DataGridFooter with DESC date default.',
  },
  {
    gridId: 'vendor-price-register',
    moduleGroup: 'Procurement',
    screenName: 'Vendor Item Price Register',
    filePath: 'src/modules/procurement/VendorPriceRegisterView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'validFrom',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'agreementNumber',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Paginated via shared DataGridFooter with DESC default.',
  },
  {
    gridId: 'purchase-price-book',
    moduleGroup: 'Procurement',
    screenName: 'Purchase Price Book',
    filePath: 'src/modules/procurement/PurchasePriceBookView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'effectiveFrom',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'id',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Paginated via shared DataGridFooter with DESC default.',
  },
  {
    gridId: 'procurement-reports-inventory-aging',
    moduleGroup: 'Procurement',
    screenName: 'Procurement, Inventory Availability & Aging Reports (14 Governed Reports)',
    filePath: 'src/modules/procurement/ProcurementReportsView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'reportDate',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'recordRef',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'All 14 Inventory, Cross-Branch, Stock Aging & PR Aging reports rendered via EnterpriseDataGrid.',
  },
  // Finance
  {
    gridId: 'finance-budget-control',
    moduleGroup: 'Finance',
    screenName: 'Budget Management & Financial Control Ledger',
    filePath: 'src/modules/finance/FinanceBudgetView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'updatedAt',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'id',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Budget Ledger & Commitments paginated via DataGridFooter with DESC default.',
  },
  {
    gridId: 'financial-year-management',
    moduleGroup: 'Finance',
    screenName: 'Financial Year, Periods & Numbering Series',
    filePath: 'src/modules/finance/FinancialYearManagementView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'startDate',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'financialYearCode',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'FY list, Accounting Periods & Numbering Series paginated with DESC default.',
  },
  // Approvals & Governance
  {
    gridId: 'approval-inbox',
    moduleGroup: 'Administration & Governance',
    screenName: 'Approval Inbox',
    filePath: 'src/modules/approvals/ApprovalInboxView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'submittedAt',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'id',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Paginated via shared DataGridFooter with DESC submittedAt default.',
  },
  {
    gridId: 'audit-logs',
    moduleGroup: 'Administration & Governance',
    screenName: 'Cryptographic Audit Logs',
    filePath: 'src/modules/settings/AuditLogsView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'timestamp',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'id',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Migrated to shared DataGridFooter with timestamp DESC default & Page/All export.',
  },
  {
    gridId: 'aging-parameter-master',
    moduleGroup: 'Administration & Governance',
    screenName: 'Aging Parameter Master (Finance, Stock & PR Aging)',
    filePath: 'src/modules/settings/AgingParameterMasterView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'updatedAt',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'code',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Paginated via shared DataGridFooter with DESC updatedAt default.',
  },
  {
    gridId: 'workday-calendar-suite',
    moduleGroup: 'Administration & Governance',
    screenName: 'Holiday, Weekly Off & Workday Calendar Management',
    filePath: 'src/modules/calendar/WorkdayCalendarSuiteView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'date',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'id',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Holidays, Weekly Offs, Exceptions & Effective Calendar paginated with DESC default.',
  },
  {
    gridId: 'communication-hub-queues',
    moduleGroup: 'Communication',
    screenName: 'Notification Centre, Queues & Campaigns',
    filePath: 'src/modules/communication/NotificationCentreView.tsx',
    complianceStatus: 'Fully Compliant',
    defaultSortField: 'createdAt',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'id',
    supportsServerContract: false,
    supportsPageAndAllExport: true,
    notes: 'Standardized pagination & DESC createdAt sort across notification & queue views.',
  },
  {
    gridId: 'pr-line-items-modal-subtable',
    moduleGroup: 'Procurement',
    screenName: 'PR Modal Line Items Table',
    filePath: 'src/modules/requests/PurchaseRequisitionDetailsModal.tsx',
    complianceStatus: 'Approved Exception',
    defaultSortField: 'id',
    defaultSortDirection: 'DESC',
    tieBreakerField: 'id',
    supportsServerContract: false,
    supportsPageAndAllExport: false,
    notes: 'Approved Exception: Embedded single-document line-item subtable inside modal inspector preserves line sequence.',
  },
];

export const dataGridService = {
  getGlobalGridSettings,
  saveGlobalGridSettings,
  normalizeAllowedPageSizeOptions,
  normalizePageSize,
  clampPageNumber,
  compareGridValues,
  resolveEffectiveSortRules,
  executeDataGridQuery,
  buildPageNumberRange,
  getUserGridPreference,
  saveUserGridPreference,
  resetUserGridPreference,
  resetForTesting,
  GLOBAL_GRID_AUDIT_MATRIX,
};
