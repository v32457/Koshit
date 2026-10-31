import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  SlidersHorizontal,
  Download,
  Printer,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  RotateCcw,
  Check,
  Plus,
  Trash2,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';

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
  sortable?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  mandatory?: boolean;
  defaultVisible?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface EnterpriseDataGridProps<T> {
  moduleTitle: string;
  moduleSubtitle?: string;
  data: T[];
  columns: GridColumn<T>[];
  rowKey: (item: T) => string;
  companyContextName?: string;
  branchContextName?: string;
  enableSelection?: boolean;
  enableMultiSelect?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onRowClick?: (item: T) => void;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  customActions?: React.ReactNode;
  exportFileName?: string;
}

export function EnterpriseDataGrid<T extends Record<string, any>>({
  moduleTitle,
  moduleSubtitle,
  data,
  columns: initialColumns,
  rowKey,
  companyContextName,
  branchContextName,
  enableSelection = true,
  enableMultiSelect = true,
  selectedIds = [],
  onSelectionChange,
  onRowClick,
  pageSizeOptions = [10, 25, 50, 100],
  defaultPageSize = 10,
  customActions,
  exportFileName = 'export',
}: EnterpriseDataGridProps<T>) {
  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // Column Configuration State
  const [columnsOrder, setColumnsOrder] = useState<string[]>(() =>
    initialColumns.map((c) => c.key)
  );
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    initialColumns.forEach((col) => {
      init[col.key] = col.defaultVisible !== false;
    });
    return init;
  });
  const [isColumnConfigOpen, setIsColumnConfigOpen] = useState(false);

  // Advanced Filters State
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterCondition[]>([]);

  // Sorting
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Column map for easy access
  const columnMap = useMemo(() => {
    const map = new Map<string, GridColumn<T>>();
    initialColumns.forEach((c) => map.set(c.key, c));
    return map;
  }, [initialColumns]);

  // Active ordered visible columns
  const activeColumns = useMemo(() => {
    return columnsOrder
      .map((k) => columnMap.get(k))
      .filter((c): c is GridColumn<T> => !!c && visibleColumns[c.key] !== false);
  }, [columnsOrder, columnMap, visibleColumns]);

  // Searchable column keys
  const searchableKeys = useMemo(() => {
    return initialColumns.filter((c) => c.searchable !== false).map((c) => c.key);
  }, [initialColumns]);

  // Filtered & Searched Data
  const processedData = useMemo(() => {
    return data.filter((item) => {
      // 1. Text Search across searchable keys
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matches = searchableKeys.some((k) => {
          const val = item[k];
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(query);
        });
        if (!matches) return false;
      }

      // 2. Advanced Filters
      for (const filter of advancedFilters) {
        if (!filter.field) continue;
        const rawVal = item[filter.field];
        const strVal = rawVal !== null && rawVal !== undefined ? String(rawVal).toLowerCase() : '';
        const targetVal = filter.value.toLowerCase().trim();

        switch (filter.operator) {
          case 'EQUALS':
            if (strVal !== targetVal) return false;
            break;
          case 'NOT_EQUALS':
            if (strVal === targetVal) return false;
            break;
          case 'CONTAINS':
            if (!strVal.includes(targetVal)) return false;
            break;
          case 'STARTS_WITH':
            if (!strVal.startsWith(targetVal)) return false;
            break;
          case 'ENDS_WITH':
            if (!strVal.endsWith(targetVal)) return false;
            break;
          case 'GREATER_THAN':
            if (Number(rawVal) <= Number(targetVal)) return false;
            break;
          case 'LESS_THAN':
            if (Number(rawVal) >= Number(targetVal)) return false;
            break;
          case 'IS_EMPTY':
            if (strVal !== '') return false;
            break;
          case 'IS_NOT_EMPTY':
            if (strVal === '') return false;
            break;
        }
      }

      return true;
    });
  }, [data, searchTerm, searchableKeys, advancedFilters]);

  // Sorted Data
  const sortedData = useMemo(() => {
    if (!sortKey) return processedData;
    const sorted = [...processedData];
    sorted.sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      let cmp = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        cmp = valA - valB;
      } else {
        cmp = String(valA).localeCompare(String(valB));
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [processedData, sortKey, sortDirection]);

  // Paged Data
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const currentPageData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Selection Logic
  const isAllCurrentPageSelected =
    currentPageData.length > 0 &&
    currentPageData.every((item) => selectedIds.includes(rowKey(item)));

  const handleToggleSelectAll = () => {
    if (!onSelectionChange) return;
    if (isAllCurrentPageSelected) {
      // Unselect current page
      const pageKeys = new Set(currentPageData.map(rowKey));
      onSelectionChange(selectedIds.filter((id) => !pageKeys.has(id)));
    } else {
      // Add current page keys
      const newKeys = new Set([...selectedIds, ...currentPageData.map(rowKey)]);
      onSelectionChange(Array.from(newKeys));
    }
  };

  const handleToggleRowSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((item) => item !== id));
    } else {
      if (enableMultiSelect) {
        onSelectionChange([...selectedIds, id]);
      } else {
        onSelectionChange([id]);
      }
    }
  };

  // Sorting Handler
  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey('');
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const exportColumns = activeColumns.filter((c) => c.key !== 'actions');
    const headerRow = exportColumns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(',');

    const rows = sortedData.map((item) => {
      return exportColumns
        .map((c) => {
          const val = item[c.key];
          const str = val !== null && val !== undefined ? String(val) : '';
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(',');
    });

    const csvContent = '\uFEFF' + [headerRow, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${exportFileName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Action
  const handlePrint = () => {
    window.print();
  };

  // Advanced Filter Helpers
  const handleAddFilterCondition = () => {
    const firstField = initialColumns.find((c) => c.filterable !== false)?.key || initialColumns[0]?.key || '';
    setAdvancedFilters([
      ...advancedFilters,
      {
        id: `flt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        field: firstField,
        operator: 'CONTAINS',
        value: '',
      },
    ]);
  };

  const handleRemoveFilterCondition = (id: string) => {
    setAdvancedFilters(advancedFilters.filter((f) => f.id !== id));
  };

  const handleUpdateFilterCondition = (id: string, updates: Partial<AdvancedFilterCondition>) => {
    setAdvancedFilters(
      advancedFilters.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const handleResetColumns = () => {
    setColumnsOrder(initialColumns.map((c) => c.key));
    const init: Record<string, boolean> = {};
    initialColumns.forEach((col) => {
      init[col.key] = col.defaultVisible !== false;
    });
    setVisibleColumns(init);
  };

  return (
    <div className="space-y-3 font-sans text-xs">
      {/* Top Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Search & Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder={`Search in ${moduleTitle}...`}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setIsAdvancedFilterOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold transition cursor-pointer text-xs ${
              advancedFilters.length > 0
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Advanced Filters</span>
            {advancedFilters.length > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {advancedFilters.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsColumnConfigOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold transition cursor-pointer text-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Columns ({activeColumns.length})</span>
          </button>
        </div>

        {/* Right: Actions (Selection, Export, Print, Custom) */}
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg font-bold text-xs">
              <span>{selectedIds.length} Selected</span>
              <button
                onClick={() => onSelectionChange && onSelectionChange([])}
                className="text-indigo-600 hover:text-indigo-900 ml-1 underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold shadow-xs cursor-pointer text-xs"
            title="Export CSV / Excel format"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold shadow-xs cursor-pointer text-xs"
            title="Print Data View"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Print</span>
          </button>

          {customActions}
        </div>
      </div>

      {/* Grid Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                {enableSelection && (
                  <th className="p-3 w-10 text-center">
                    {enableMultiSelect ? (
                      <button
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
                {activeColumns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                    className={`p-3 select-none ${col.sortable !== false ? 'cursor-pointer hover:bg-slate-100/80 transition' : ''} ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {col.sortable !== false && (
                        <span className="text-slate-400">
                          {sortKey === col.key ? (
                            sortDirection === 'asc' ? (
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
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentPageData.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeColumns.length + (enableSelection ? 1 : 0)}
                    className="p-8 text-center text-slate-500"
                  >
                    <div className="max-w-xs mx-auto space-y-2">
                      <p className="font-bold text-slate-700">No matching records found</p>
                      <p className="text-[11px] text-slate-400">
                        Try adjusting search keywords, clearing advanced filters, or selecting another authorized company/branch.
                      </p>
                      {(searchTerm || advancedFilters.length > 0) && (
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setAdvancedFilters([]);
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
                  return (
                    <tr
                      key={keyVal}
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
                          <button className="text-slate-400 hover:text-indigo-600 cursor-pointer">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      )}
                      {activeColumns.map((col) => (
                        <td
                          key={col.key}
                          className={`p-3 text-slate-800 ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          }`}
                        >
                          {col.render ? col.render(item, index) : item[col.key] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="bg-slate-50 p-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="p-1 border border-slate-300 rounded bg-white text-xs font-bold"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span className="text-slate-400">|</span>
            <span>
              Showing {sortedData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} records
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="px-2 font-bold text-slate-700">
              Page {currentPage} of {totalPages}
            </span>

            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

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
                  <div key={cond.id} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
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
                      onChange={(e) => handleUpdateFilterCondition(cond.id, { operator: e.target.value as FilterOperator })}
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
                        className="flex-1 p-1.5 border border-slate-300 rounded bg-white text-xs font-medium"
                      />
                    )}

                    <button
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
                onClick={handleAddFilterCondition}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer pt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Condition</span>
              </button>
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <button
                onClick={() => setAdvancedFilters([])}
                className="text-xs font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
              >
                Clear All
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAdvancedFilterOpen(false)}
                  className="px-4 py-1.5 border border-slate-200 rounded-lg text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Apply Filters
                </button>
              </div>
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
                Configure Table Columns
              </h3>
              <button
                onClick={() => setIsColumnConfigOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Toggle column visibility and order. Mandatory organizational identification fields cannot be hidden.
            </p>

            <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
              {columnsOrder.map((key) => {
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
                        onChange={(e) =>
                          setVisibleColumns({ ...visibleColumns, [key]: e.target.checked })
                        }
                        className="rounded text-indigo-600"
                      />
                      <span>{col.header}</span>
                      {isMandatory && (
                        <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                          Mandatory
                        </span>
                      )}
                    </label>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <button
                onClick={handleResetColumns}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Default Layout</span>
              </button>

              <button
                onClick={() => setIsColumnConfigOpen(false)}
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
