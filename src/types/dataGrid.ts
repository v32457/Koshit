/**
 * CIPPLATFORM — GLOBAL DATA GRID STANDARD TYPES
 * Shared types for standardized rows-per-page, pagination, multi-column sorting
 * (with mandatory factory default Descending / Newest-First order), exports,
 * user + device layout preferences, and application-wide audit registry.
 */

export const STANDARD_PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100, 200] as const;
export type StandardPageSize = (typeof STANDARD_PAGE_SIZE_OPTIONS)[number];

export type GridDeviceType = 'desktop' | 'tablet' | 'mobile';
export type GridSortDirection = 'asc' | 'desc';

export interface GridSortRule {
  field: string;
  direction: GridSortDirection;
  dataType?: 'text' | 'number' | 'date' | 'status';
}

export interface GridFilterRule {
  field: string;
  operator:
    | 'EQUALS'
    | 'NOT_EQUALS'
    | 'CONTAINS'
    | 'STARTS_WITH'
    | 'ENDS_WITH'
    | 'GREATER_THAN'
    | 'LESS_THAN'
    | 'IS_EMPTY'
    | 'IS_NOT_EMPTY';
  value: string;
}

export interface GlobalDataGridSettings {
  allowedPageSizeOptions: number[];
  defaultPageSize: number;
  maxPageSize: number;
  defaultSortDirection: GridSortDirection;
  dateDisplayFormat: 'YYYY-MM-DD' | 'DD-MMM-YYYY';
  maxExportRecords: number;
  maxExportFileSizeBytes: number;
  updatedAt: string;
  updatedBy: string;
}

export interface GridQueryRequest {
  page: number;
  pageSize: number;
  search?: string;
  searchableFields?: string[];
  filters?: GridFilterRule[];
  sortRules?: GridSortRule[];
  defaultSortField?: string;
  defaultSortDirection?: GridSortDirection; // Defaults to 'desc' (Newest First)
  tieBreakerField?: string; // Deterministic ID / document number tie-breaker
  companyId?: string;
  branchId?: string;
  financialYearId?: string;
}

export interface GridQueryResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
    rangeStart: number;
    rangeEnd: number;
  };
  sortApplied: GridSortRule[];
}

export interface UserGridPreference {
  gridId: string;
  userId: string;
  deviceType: GridDeviceType;
  pageSize: number;
  columnOrder: string[];
  visibleColumns: Record<string, boolean>;
  columnWidths: Record<string, number>;
  sortRules: GridSortRule[];
  updatedAt: string;
}

export type GridComplianceStatus =
  | 'Fully Compliant'
  | 'Partially Compliant'
  | 'Missing Pagination'
  | 'Missing Rows Per Page'
  | 'Client-Side Only'
  | 'Performance Risk'
  | 'Approved Exception';

export interface GridAuditMatrixEntry {
  gridId: string;
  moduleGroup:
    | 'Master Data'
    | 'Procurement'
    | 'Finance'
    | 'Sales'
    | 'Inventory'
    | 'Administration & Governance'
    | 'Communication';
  screenName: string;
  filePath: string;
  complianceStatus: GridComplianceStatus;
  defaultSortField: string;
  defaultSortDirection: 'DESC';
  tieBreakerField: string;
  supportsServerContract: boolean;
  supportsPageAndAllExport: boolean;
  notes: string;
}

export type ExportScopeMode = 'CURRENT_PAGE' | 'ALL_FILTERED';
