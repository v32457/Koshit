import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  SlidersHorizontal,
  Download,
  Printer,
  CheckSquare,
  Square,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  RotateCcw,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useViewportAndOrientation, MobileRecordCard } from './ResponsiveWorkspace';
import { DataGridFooter } from './DataGridFooter';
import {
  executeDataGridQuery,
  getGlobalGridSettings,
  getUserGridPreference,
  saveUserGridPreference,
  resetUserGridPreference,
  normalizePageSize,
} from '../services/dataGridService';
import { executeScopedExport } from '../services/exportService';
import { GridDeviceType, GridSortRule } from '../types/dataGrid';

export type FilterOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'IS_EMPTY'
  | 'IS_NOT_EMPTY';

export interface AdvancedFilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

export interface GridColumn<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  exportValue?: (item: T) => string | number;
  sortable?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  mandatory?: boolean;
  defaultVisible?: boolean;
  dataType?: 'text' | 'number' | 'date' | 'status';
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface ServerSideGridConfig<T> {
  totalRecords: number;
  currentPage: number;
  pageSize: number;
  loading?: boolean;
  error?: string | null;
  onQueryChange: (params: {
    page: number;
    pageSize: number;
    search: string;
    filters: AdvancedFilterCondition[];
    sortRules: GridSortRule[];
  }) => void;
  onFetchAllFilteredForExport?: () => Promise<T[]> | T[];
  onRetry?: () => void;
}

export interface EnterpriseDataGridProps<T> {
  gridId?: string;
  userId?: string;
  moduleTitle: string;
  moduleSubtitle?: string;
  data: T[];
  columns: GridColumn<T>[];
  rowKey: (item: T) => string;
  companyContextName?: string;
  branchContextName?: string;
  financialYearLabel?: string;
  enableSelection?: boolean;
  enableMultiSelect?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onRowClick?: (item: T) => void;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  defaultSortField?: string;
  defaultSortDirection?: 'desc' | 'asc';
  tieBreakerField?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  customActions?: React.ReactNode;
  exportFileName?: string;
  canExport?: boolean;
  serverSide?: ServerSideGridConfig<T>;
}

export function EnterpriseDataGrid<T extends Record<string, any>>({
  gridId,
  userId = 'usr-default',
  moduleTitle,
  moduleSubtitle,
  data,
  columns: initialColumns,
  rowKey,
  companyContextName,
  branchContextName,
  financialYearLabel,
  enableSelection = true,
  enableMultiSelect = true,
  selectedIds = [],
  onSelectionChange,
  onRowClick,
  pageSizeOptions,
  defaultPageSize,
  defaultSortField,
  defaultSortDirection = 'desc',
  tieBreakerField = 'id',
  loading = false,
  error = null,
  onRetry,
  emptyTitle = 'No matching records found',
  emptyDescription = 'Try adjusting search keywords, clearing filters, or switching Financial Year / Company scope.',
  customActions,
  exportFileName = 'export',
  canExport = true,
  serverSide,
}: EnterpriseDataGridProps<T>) {
  const { isMobile, isTablet, isMobileLandscape } = useViewportAndOrientation();
  const deviceType: GridDeviceType = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
  const resolvedGridId = gridId || exportFileName || moduleTitle.toLowerCase().replace(/\s+/g, '-');
  const globalSettings = useMemo(() => getGlobalGridSettings(), []);
  const resolvedPageSizeOptions =
    pageSizeOptions && pageSizeOptions.length > 0
      ? pageSizeOptions
      : globalSettings.allowedPageSizeOptions;
  const resolvedDefaultPageSize = normalizePageSize(
    defaultPageSize ?? globalSettings.defaultPageSize,
    globalSettings
  );

  // Load saved user + device preferences when available
  const savedPref = useMemo(
    () => getUserGridPreference(resolvedGridId, userId, deviceType),
    [resolvedGridId, userId, deviceType]
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [columnsOrder, setColumnsOrder] = useState<string[]>(() => {
    if (savedPref?.columnOrder && savedPref.columnOrder.length > 0) {
      const valid = savedPref.columnOrder.filter((k) => initialColumns.some((c) => c.key === k));
      const missing = initialColumns.map((c) => c.key).filter((k) => !valid.includes(k));
      return [...valid, ...missing];
    }
    return initialColumns.map((c) => c.key);
  });
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    initialColumns.forEach((col) => {
      init[col.key] =
        savedPref?.visibleColumns && col.key in savedPref.visibleColumns
          ? savedPref.visibleColumns[col.key]
          : col.defaultVisible !== false;
    });
    return init;
  });

  const [isColumnConfigOpen, setIsColumnConfigOpen] = useState(false);
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterCondition[]>([]);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Sorting: defaults to empty array which triggers Factory Default DESC sort via executeDataGridQuery
  const [sortRules, setSortRules] = useState<GridSortRule[]>(() => savedPref?.sortRules || []);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(
    () => savedPref?.pageSize ?? resolvedDefaultPageSize
  );

  // Sync preferences when userId or deviceType changes
  useEffect(() => {
    const pref = getUserGridPreference(resolvedGridId, userId, deviceType);
    if (pref) {
      setPageSize(normalizePageSize(pref.pageSize));
      setSortRules(pref.sortRules || []);
      if (pref.columnOrder?.length > 0) {
        const valid = pref.columnOrder.filter((k) => initialColumns.some((c) => c.key === k));
        const missing = initialColumns.map((c) => c.key).filter((k) => !valid.includes(k));
        setColumnsOrder([...valid, ...missing]);
      }
      if (pref.visibleColumns) {
        const nextVis: Record<string, boolean> = {};
        initialColumns.forEach((c) => {
          nextVis[c.key] =
            c.key in pref.visibleColumns ? pref.visibleColumns[c.key] : c.defaultVisible !== false;
        });
        setVisibleColumns(nextVis);
      }
    } else {
      setPageSize(resolvedDefaultPageSize);
      setSortRules([]);
    }
    setCurrentPage(1);
  }, [resolvedGridId, userId, deviceType, resolvedDefaultPageSize]);

  const persistPreferences = useCallback(
    (overrides?: Partial<{ pageSize: number; columnOrder: string[]; visibleColumns: Record<string, boolean>; sortRules: GridSortRule[] }>) => {
      saveUserGridPreference({
        gridId: resolvedGridId,
        userId,
        deviceType,
        pageSize: overrides?.pageSize ?? pageSize,
        columnOrder: overrides?.columnOrder ?? columnsOrder,
        visibleColumns: overrides?.visibleColumns ?? visibleColumns,
        columnWidths: {},
        sortRules: overrides?.sortRules ?? sortRules,
      });
    },
    [resolvedGridId, userId, deviceType, pageSize, columnsOrder, visibleColumns, sortRules]
  );

  const columnMap = useMemo(() => {
    const map = new Map<string, GridColumn<T>>();
    initialColumns.forEach((c) => map.set(c.key, c));
    return map;
  }, [initialColumns]);

  const activeColumns = useMemo(() => {
    return columnsOrder
      .map((k) => columnMap.get(k))
      .filter((c): c is GridColumn<T> => !!c && visibleColumns[c.key] !== false);
  }, [columnsOrder, columnMap, visibleColumns]);

  const searchableKeys = useMemo(() => {
    return initialColumns.filter((c) => c.searchable !== false && c.key !== 'actions').map((c) => c.key);
  }, [initialColumns]);

  const effectiveDefaultSortField = useMemo(() => {
    if (defaultSortField) return defaultSortField;
    const dateCol = initialColumns.find(
      (c) =>
        c.dataType === 'date' ||
        /date|created|updated|timestamp|submitted|modified/i.test(c.key)
    );
    return dateCol?.key;
  }, [defaultSortField, initialColumns]);

  // Execute unified query engine (Filter -> Search -> Sort DESC default -> Paginate + Clamp)
  const queryResult = useMemo(() => {
    if (serverSide) {
      const total = serverSide.totalRecords;
      const totalPages = Math.max(1, Math.ceil(total / serverSide.pageSize));
      return {
        data,
        allFilteredData: data,
        pagination: {
          currentPage: serverSide.currentPage,
          pageSize: serverSide.pageSize,
          totalRecords: total,
          totalPages,
          rangeStart: total === 0 ? 0 : (serverSide.currentPage - 1) * serverSide.pageSize + 1,
          rangeEnd: Math.min(serverSide.currentPage * serverSide.pageSize, total),
        },
        sortApplied: sortRules,
      };
    }

    const allResult = executeDataGridQuery(
      data,
      {
        page: 1,
        pageSize: Math.max(data.length, 1),
        search: searchTerm,
        searchableFields: searchableKeys,
        filters: advancedFilters,
        sortRules,
        defaultSortField: effectiveDefaultSortField,
        defaultSortDirection,
        tieBreakerField,
      },
      { getRowId: rowKey }
    );

    const totalRecords = allResult.pagination.totalRecords;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const startIdx = (safePage - 1) * pageSize;

    return {
      data: allResult.data.slice(startIdx, startIdx + pageSize),
      allFilteredData: allResult.data,
      pagination: {
        currentPage: safePage,
        pageSize,
        totalRecords,
        totalPages,
        rangeStart: totalRecords === 0 ? 0 : startIdx + 1,
        rangeEnd: totalRecords === 0 ? 0 : Math.min(startIdx + pageSize, totalRecords),
      },
      sortApplied: allResult.sortApplied,
    };
  }, [
    serverSide,
    data,
    searchTerm,
    searchableKeys,
    advancedFilters,
    sortRules,
    effectiveDefaultSortField,
    defaultSortDirection,
    tieBreakerField,
    rowKey,
    pageSize,
    currentPage,
  ]);

  // Clamp page state automatically if rows were deleted
  useEffect(() => {
    if (!serverSide && queryResult.pagination.currentPage !== currentPage) {
      setCurrentPage(queryResult.pagination.currentPage);
    }
  }, [serverSide, queryResult.pagination.currentPage, currentPage]);

  const currentPageData = queryResult.data;
  const activeSort = queryResult.sortApplied[0];

  const triggerServerQuery = (next: {
    page?: number;
    pageSize?: number;
    search?: string;
    filters?: AdvancedFilterCondition[];
    sortRules?: GridSortRule[];
  }) => {
    if (!serverSide) return;
    serverSide.onQueryChange({
      page: next.page ?? currentPage,
      pageSize: next.pageSize ?? pageSize,
      search: next.search ?? searchTerm,
      filters: next.filters ?? advancedFilters,
      sortRules: next.sortRules ?? sortRules,
    });
  };

  // Selection Logic
  const isAllCurrentPageSelected =
    currentPageData.length > 0 &&
    currentPageData.every((item) => selectedIds.includes(rowKey(item)));

  const handleToggleSelectAll = () => {
    if (!onSelectionChange) return;
    if (isAllCurrentPageSelected) {
      const pageKeys = new Set(currentPageData.map(rowKey));
      onSelectionChange(selectedIds.filter((id) => !pageKeys.has(id)));
    } else {
      const newKeys = new Set([...selectedIds, ...currentPageData.map(rowKey)]);
      onSelectionChange(Array.from(newKeys));
    }
  };

  const handleToggleRowSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((item) => item !== id));
    } else if (enableMultiSelect) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange([id]);
    }
  };

  // Sorting Handler (cycles DESC -> ASC -> Factory Default DESC, Shift+Click for multi-sort)
  const handleSort = (key: string, e?: React.MouseEvent) => {
    const col = columnMap.get(key);
    const isMulti = Boolean(e?.shiftKey);
    let nextRules: GridSortRule[];

    if (isMulti) {
      const idx = sortRules.findIndex((r) => r.field === key);
      const copy = [...sortRules];
      if (idx === -1) {
        copy.push({ field: key, direction: 'desc', dataType: col?.dataType });
      } else if (copy[idx].direction === 'desc') {
        copy[idx] = { ...copy[idx], direction: 'asc' };
      } else {
        copy.splice(idx, 1);
      }
      nextRules = copy;
    } else {
      const current = sortRules[0];
      if (current && current.field === key) {
        nextRules =
          current.direction === 'desc'
            ? [{ field: key, direction: 'asc', dataType: col?.dataType }]
            : [];
      } else {
        nextRules = [{ field: key, direction: 'desc', dataType: col?.dataType }];
      }
    }

    setSortRules(nextRules);
    setCurrentPage(1);
    persistPreferences({ sortRules: nextRules });
    triggerServerQuery({ page: 1, sortRules: nextRules });
  };

  const handlePageChange = (page: number) => {
    const safe = Math.min(Math.max(1, page), queryResult.pagination.totalPages);
    setCurrentPage(safe);
    triggerServerQuery({ page: safe });
  };

  const handlePageSizeChange = (nextSize: number) => {
    const normalized = normalizePageSize(nextSize, globalSettings);
    setPageSize(normalized);
    setCurrentPage(1);
    persistPreferences({ pageSize: normalized });
    triggerServerQuery({ page: 1, pageSize: normalized });
  };

  const handleScopedExport = async (
    format: 'csv' | 'excel' | 'pdf',
    exportScope: 'CURRENT_PAGE' | 'ALL_FILTERED'
  ) => {
    setIsExportMenuOpen(false);
    const exportCols = activeColumns.filter((c) => c.key !== 'actions');
    const sourceRows =
      exportScope === 'CURRENT_PAGE'
        ? currentPageData
        : serverSide?.onFetchAllFilteredForExport
        ? await serverSide.onFetchAllFilteredForExport()
        : queryResult.allFilteredData;

    const headers = exportCols.map((c) => c.header);
    const rows = sourceRows.map((item) =>
      exportCols.map((c) => {
        if (c.exportValue) return c.exportValue(item);
        const val = item[c.key];
        return val !== null && val !== undefined ? String(val) : '';
      })
    );

    const scopeParts = [
      companyContextName ? `Company: ${companyContextName}` : null,
      branchContextName ? `Branch: ${branchContextName}` : null,
      financialYearLabel ? `FY: ${financialYearLabel}` : null,
    ].filter(Boolean);

    const res = await executeScopedExport({
      format,
      exportScope,
      title: moduleTitle,
      subtitle: moduleSubtitle,
      headers,
      rows,
      filenamePrefix: exportFileName || resolvedGridId,
      scopeLabel: scopeParts.join(' | ') || undefined,
      maxRecordsLimit: globalSettings.maxExportRecords,
      maxSizeBytesLimit: globalSettings.maxExportFileSizeBytes,
    });

    setExportNotice(res.message);
    setTimeout(() => setExportNotice(null), 4000);
  };

  const handleResetToFactoryDefault = () => {
    resetUserGridPreference(resolvedGridId, userId, deviceType);
    const defaultOrder = initialColumns.map((c) => c.key);
    const defaultVis: Record<string, boolean> = {};
    initialColumns.forEach((col) => {
      defaultVis[col.key] = col.defaultVisible !== false;
    });
    setColumnsOrder(defaultOrder);
    setVisibleColumns(defaultVis);
    setSortRules([]);
    setPageSize(resolvedDefaultPageSize);
    setCurrentPage(1);
    setSearchTerm('');
    setAdvancedFilters([]);
    triggerServerQuery({
      page: 1,
      pageSize: resolvedDefaultPageSize,
      search: '',
      filters: [],
      sortRules: [],
    });
  };

  const handleMoveColumn = (key: string, dir: 'up' | 'down') => {
    const idx = columnsOrder.indexOf(key);
    if (idx < 0) return;
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= columnsOrder.length) return;
    const next = [...columnsOrder];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    setColumnsOrder(next);
    persistPreferences({ columnOrder: next });
  };

  const handleAddFilterCondition = () => {
    const firstField =
      initialColumns.find((c) => c.filterable !== false && c.key !== 'actions')?.key ||
      initialColumns[0]?.key ||
      '';
    const next = [
      ...advancedFilters,
      {
        id: `flt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        field: firstField,
        operator: 'CONTAINS' as FilterOperator,
        value: '',
      },
    ];
    setAdvancedFilters(next);
    setCurrentPage(1);
  };

  const handleRemoveFilterCondition = (id: string) => {
    const next = advancedFilters.filter((f) => f.id !== id);
    setAdvancedFilters(next);
    setCurrentPage(1);
    triggerServerQuery({ page: 1, filters: next });
  };

  const handleUpdateFilterCondition = (id: string, updates: Partial<AdvancedFilterCondition>) => {
    const next = advancedFilters.map((f) => (f.id === id ? { ...f, ...updates } : f));
    setAdvancedFilters(next);
    setCurrentPage(1);
  };

  const [expandedTabletRows, setExpandedTabletRows] = useState<Set<string>>(new Set());
  const toggleTabletRowExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedTabletRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedTabletRows(next);
  };

  const isLoadingState = loading || serverSide?.loading;
  const errorMessage = error || serverSide?.error;

  return (
    <div className="space-y-3 font-sans text-xs w-full min-w-0 max-w-full">
      {/* Top Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 min-w-0">
        {/* Left: Search & Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 min-w-[180px] sm:max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              aria-label={`Search in ${moduleTitle}`}
              placeholder={`Search in ${moduleTitle}...`}
              value={searchTerm}
              onChange={(e) => {
                const val = e.target.value;
                setSearchTerm(val);
                setCurrentPage(1);
                triggerServerQuery({ page: 1, search: val });
              }}
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                  triggerServerQuery({ page: 1, search: '' });
                }}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsAdvancedFilterOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold transition cursor-pointer text-xs ${
              advancedFilters.length > 0
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
            {advancedFilters.length > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {advancedFilters.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsColumnConfigOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold transition cursor-pointer text-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Columns ({activeColumns.length})</span>
          </button>

          <button
            type="button"
            onClick={handleResetToFactoryDefault}
            title="Reset columns, filters, rows per page (20) and restore Factory Default Descending Sort"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold transition cursor-pointer text-[11px]"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden md:inline">Factory Default</span>
          </button>
        </div>

        {/* Right: Actions (Selection, Scoped Export, Print, Custom) */}
        <div className="flex flex-wrap items-center gap-2 relative">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg font-bold text-xs">
              <span>{selectedIds.length} Selected</span>
              <button
                type="button"
                onClick={() => onSelectionChange && onSelectionChange([])}
                className="text-indigo-600 hover:text-indigo-900 ml-1 underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          {canExport && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExportMenuOpen((prev) => !prev)}
                aria-expanded={isExportMenuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold shadow-xs cursor-pointer text-xs"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>Export</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isExportMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl border border-slate-200 shadow-xl z-40 p-2 space-y-1.5"
                >
                  <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
                    Current Page ({currentPageData.length} rows)
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => handleScopedExport('csv', 'CURRENT_PAGE')}
                      className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3 h-3" /> CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScopedExport('excel', 'CURRENT_PAGE')}
                      className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3 h-3" /> Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScopedExport('pdf', 'CURRENT_PAGE')}
                      className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3 h-3" /> PDF
                    </button>
                  </div>

                  <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100 pt-1.5">
                    All Filtered Records ({queryResult.pagination.totalRecords} rows)
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => handleScopedExport('csv', 'ALL_FILTERED')}
                      className="px-2 py-1.5 rounded-lg bg-indigo-50/70 hover:bg-indigo-100 text-indigo-800 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3 h-3" /> CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScopedExport('excel', 'ALL_FILTERED')}
                      className="px-2 py-1.5 rounded-lg bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3 h-3" /> Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScopedExport('pdf', 'ALL_FILTERED')}
                      className="px-2 py-1.5 rounded-lg bg-rose-50/70 hover:bg-rose-100 text-rose-800 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3 h-3" /> PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold shadow-xs cursor-pointer text-xs"
            title="Print Data View"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Print</span>
          </button>

          {customActions}
        </div>
      </div>

      {exportNotice && (
        <div className="px-3.5 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold text-xs flex items-center justify-between">
          <span>{exportNotice}</span>
          <button type="button" onClick={() => setExportNotice(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error State */}
      {errorMessage ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center space-y-2">
          <AlertTriangle className="w-6 h-6 text-rose-600 mx-auto" />
          <p className="font-bold text-rose-900">Unable to load grid records</p>
          <p className="text-xs text-rose-700">{errorMessage}</p>
          {(onRetry || serverSide?.onRetry) && (
            <button
              type="button"
              onClick={onRetry || serverSide?.onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          )}
        </div>
      ) : isLoadingState ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 space-y-2">
          <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin mx-auto" />
          <p className="font-bold text-slate-700">Loading {moduleTitle}...</p>
        </div>
      ) : isMobile ? (
        <div className="space-y-2.5 min-w-0">
          {currentPageData.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 space-y-2">
              <p className="font-bold text-slate-700">{emptyTitle}</p>
              <p className="text-[11px] text-slate-400">{emptyDescription}</p>
            </div>
          ) : (
            <div className={`grid gap-3 ${isMobileLandscape ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {currentPageData.map((item, index) => {
                const keyVal = rowKey(item);
                const isSelected = selectedIds.includes(keyVal);
                const nonActionCols = activeColumns.filter((c) => c.key !== 'actions');
                const actionCol = activeColumns.find((c) => c.key === 'actions');
                const primaryCol = nonActionCols[0];
                const subtitleCol = nonActionCols[1];
                const primaryFields = nonActionCols.slice(2, 6).map((c) => ({
                  label: c.header,
                  value: c.render ? c.render(item, index) : item[c.key] ?? '—',
                }));
                const secondaryFields = nonActionCols.slice(6).map((c) => ({
                  label: c.header,
                  value: c.render ? c.render(item, index) : item[c.key] ?? '—',
                }));

                return (
                  <MobileRecordCard
                    key={keyVal}
                    id={keyVal}
                    primaryTitle={
                      primaryCol
                        ? primaryCol.render
                          ? primaryCol.render(item, index)
                          : item[primaryCol.key] ?? keyVal
                        : keyVal
                    }
                    subtitle={
                      subtitleCol
                        ? subtitleCol.render
                          ? subtitleCol.render(item, index)
                          : item[subtitleCol.key]
                        : undefined
                    }
                    selected={isSelected}
                    onToggleSelect={
                      enableSelection ? () => handleToggleRowSelection(keyVal) : undefined
                    }
                    onClick={onRowClick ? () => onRowClick(item) : undefined}
                    primaryFields={primaryFields}
                    secondaryFields={secondaryFields}
                    actions={actionCol && actionCol.render ? actionCol.render(item, index) : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden min-w-0">
          <div className={isTablet ? 'overflow-x-hidden' : 'overflow-x-auto'}>
            <table className="w-full text-left border-collapse text-xs compact-mobile-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  {enableSelection && (
                    <th className="p-3 w-10 text-center">
                      {enableMultiSelect ? (
                        <button
                          type="button"
                          aria-label="Select all on current page"
                          onClick={handleToggleSelectAll}
                          className="text-slate-500 hover:text-indigo-600 cursor-pointer"
                        >
                          {isAllCurrentPageSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      ) : null}
                    </th>
                  )}
                  {(isTablet ? activeColumns.slice(0, 5) : activeColumns).map((col) => {
                    const isSorted = activeSort?.field === col.key;
                    const sortDir = activeSort?.direction;
                    return (
                      <th
                        key={col.key}
                        onClick={(e) => col.sortable !== false && handleSort(col.key, e)}
                        className={`p-3 select-none ${
                          col.sortable !== false
                            ? 'cursor-pointer hover:bg-slate-100/80 transition'
                            : ''
                        } ${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        }`}
                        style={!isTablet && col.width ? { width: col.width } : undefined}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <span>{col.header}</span>
                          {col.sortable !== false && (
                            <span className="text-slate-400">
                              {isSorted ? (
                                sortDir === 'asc' ? (
                                  <ArrowUp className="w-3 h-3 text-indigo-600" />
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-indigo-600" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-40" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  {isTablet && activeColumns.length > 5 && (
                    <th className="p-3 text-right w-24">Details</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentPageData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={
                        (isTablet ? Math.min(5, activeColumns.length) + 1 : activeColumns.length) +
                        (enableSelection ? 1 : 0)
                      }
                      className="p-8 text-center text-slate-500"
                    >
                      <div className="max-w-xs mx-auto space-y-2">
                        <p className="font-bold text-slate-700">{emptyTitle}</p>
                        <p className="text-[11px] text-slate-400">{emptyDescription}</p>
                        {(searchTerm || advancedFilters.length > 0) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchTerm('');
                              setAdvancedFilters([]);
                              setCurrentPage(1);
                              triggerServerQuery({ page: 1, search: '', filters: [] });
                            }}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer text-xs mt-1"
                          >
                            Clear Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentPageData.map((item, index) => {
                    const keyVal = rowKey(item);
                    const isSelected = selectedIds.includes(keyVal);
                    const isExpanded = expandedTabletRows.has(keyVal);
                    const displayedCols = isTablet ? activeColumns.slice(0, 5) : activeColumns;
                    const extraCols = isTablet ? activeColumns.slice(5) : [];

                    return (
                      <React.Fragment key={keyVal}>
                        <tr
                          onClick={() => onRowClick && onRowClick(item)}
                          className={`hover:bg-indigo-50/40 transition ${
                            isSelected ? 'bg-indigo-50/60 font-medium' : ''
                          } ${onRowClick ? 'cursor-pointer' : ''}`}
                        >
                          {enableSelection && (
                            <td
                              className="p-3 text-center"
                              onClick={(e) => handleToggleRowSelection(keyVal, e)}
                            >
                              <button
                                type="button"
                                aria-label={`Select row ${keyVal}`}
                                className="text-slate-400 hover:text-indigo-600 cursor-pointer"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                          )}
                          {displayedCols.map((col) => (
                            <td
                              key={col.key}
                              className={`p-3 text-slate-800 ${
                                col.align === 'right'
                                  ? 'text-right'
                                  : col.align === 'center'
                                  ? 'text-center'
                                  : 'text-left'
                              }`}
                            >
                              {col.render ? col.render(item, index) : item[col.key] ?? '—'}
                            </td>
                          ))}
                          {isTablet && extraCols.length > 0 && (
                            <td
                              className="p-3 text-right"
                              onClick={(e) => toggleTabletRowExpand(keyVal, e)}
                            >
                              <button
                                type="button"
                                className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 text-indigo-700 rounded font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-3 h-3" /> Hide
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3 h-3" /> +{extraCols.length}
                                  </>
                                )}
                              </button>
                            </td>
                          )}
                        </tr>
                        {isTablet && isExpanded && extraCols.length > 0 && (
                          <tr className="bg-slate-50/80">
                            <td
                              colSpan={displayedCols.length + (enableSelection ? 1 : 0) + 1}
                              className="p-3"
                            >
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                {extraCols.map((col) => (
                                  <div key={col.key}>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                      {col.header}
                                    </span>
                                    <div className="text-slate-800 font-medium mt-0.5">
                                      {col.render ? col.render(item, index) : item[col.key] ?? '—'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Standardized Global Pagination Footer */}
      <DataGridFooter
        currentPage={queryResult.pagination.currentPage}
        totalPages={queryResult.pagination.totalPages}
        pageSize={queryResult.pagination.pageSize}
        totalRecords={queryResult.pagination.totalRecords}
        pageSizeOptions={resolvedPageSizeOptions}
        loading={Boolean(isLoadingState)}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        defaultSortNotice={
          activeSort
            ? `Sorted: ${columnMap.get(activeSort.field)?.header || activeSort.field} (${activeSort.direction.toUpperCase()})`
            : 'Default: Newest First (DESC)'
        }
      />

      {/* Advanced Filters Modal */}
      {isAdvancedFilterOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Filter className="w-4 h-4 text-indigo-600" />
                Advanced Filters — {moduleTitle}
              </h3>
              <button
                type="button"
                onClick={() => setIsAdvancedFilterOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
              {advancedFilters.length === 0 ? (
                <div className="p-6 text-center text-slate-400 border border-dashed rounded-lg">
                  No advanced filter conditions added yet. Click &ldquo;Add Condition&rdquo; to build criteria.
                </div>
              ) : (
                advancedFilters.map((cond, idx) => (
                  <div
                    key={cond.id}
                    className="flex flex-wrap items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200"
                  >
                    <span className="font-bold text-slate-400 w-5">{idx + 1}.</span>
                    <select
                      value={cond.field}
                      onChange={(e) => handleUpdateFilterCondition(cond.id, { field: e.target.value })}
                      className="p-1.5 border border-slate-300 rounded bg-white text-xs font-bold w-40"
                    >
                      {initialColumns
                        .filter((c) => c.filterable !== false && c.key !== 'actions')
                        .map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.header}
                          </option>
                        ))}
                    </select>

                    <select
                      value={cond.operator}
                      onChange={(e) =>
                        handleUpdateFilterCondition(cond.id, {
                          operator: e.target.value as FilterOperator,
                        })
                      }
                      className="p-1.5 border border-slate-300 rounded bg-white text-xs font-medium w-32"
                    >
                      <option value="CONTAINS">Contains</option>
                      <option value="EQUALS">Equals</option>
                      <option value="NOT_EQUALS">Not Equals</option>
                      <option value="STARTS_WITH">Starts With</option>
                      <option value="ENDS_WITH">Ends With</option>
                      <option value="GREATER_THAN">Greater Than</option>
                      <option value="LESS_THAN">Less Than</option>
                      <option value="IS_EMPTY">Is Empty</option>
                      <option value="IS_NOT_EMPTY">Is Not Empty</option>
                    </select>

                    {!['IS_EMPTY', 'IS_NOT_EMPTY'].includes(cond.operator) && (
                      <input
                        type="text"
                        placeholder="Value..."
                        value={cond.value}
                        onChange={(e) => handleUpdateFilterCondition(cond.id, { value: e.target.value })}
                        className="flex-1 min-w-[120px] p-1.5 border border-slate-300 rounded bg-white text-xs font-medium"
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveFilterCondition(cond.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      title="Remove condition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}

              <button
                type="button"
                onClick={handleAddFilterCondition}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer pt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Condition</span>
              </button>
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <button
                type="button"
                onClick={() => {
                  setAdvancedFilters([]);
                  setCurrentPage(1);
                  triggerServerQuery({ page: 1, filters: [] });
                }}
                className="text-xs font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
              >
                Clear All
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAdvancedFilterOpen(false);
                  setCurrentPage(1);
                  triggerServerQuery({ page: 1, filters: advancedFilters });
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configure Columns Modal */}
      {isColumnConfigOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                Configure Table Columns ({deviceType})
              </h3>
              <button
                type="button"
                onClick={() => setIsColumnConfigOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Show, hide, and reorder columns for your {deviceType} workspace. Mandatory organizational fields stay visible.
            </p>

            <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
              {columnsOrder.map((key, idx) => {
                const col = columnMap.get(key);
                if (!col) return null;
                const isVis = visibleColumns[key] !== false;
                const isMandatory = col.mandatory === true;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200"
                  >
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                      <input
                        type="checkbox"
                        disabled={isMandatory}
                        checked={isVis}
                        onChange={(e) => {
                          const nextVis = { ...visibleColumns, [key]: e.target.checked };
                          setVisibleColumns(nextVis);
                        }}
                        className="rounded text-indigo-600"
                      />
                      <span>{col.header}</span>
                      {isMandatory && (
                        <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                          Mandatory
                        </span>
                      )}
                    </label>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveColumn(key, 'up')}
                        aria-label={`Move ${col.header} up`}
                        className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === columnsOrder.length - 1}
                        onClick={() => handleMoveColumn(key, 'down')}
                        aria-label={`Move ${col.header} down`}
                        className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <button
                type="button"
                onClick={() => {
                  handleResetToFactoryDefault();
                  setIsColumnConfigOpen(false);
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Factory Default</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  persistPreferences({ columnOrder: columnsOrder, visibleColumns });
                  setIsColumnConfigOpen(false);
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg cursor-pointer text-xs"
              >
                Save Layout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
