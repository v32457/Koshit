/**
 * CIPPLATFORM — STANDARD DATA GRID HOOK
 * Reusable React hook giving any record list/table instant compliance with:
 * - Standard Page Sizes [10, 20, 25, 50, 100, 200] (Default 20)
 * - Factory Default Descending (Newest First) Sort Order + ID Tie-Breaker
 * - Auto-reset to Page 1 on filter/search/pageSize change
 * - Automatic Page clamping when totalRecords shrinks (e.g. deletion)
 * - User + Device preference persistence (pageSize, sort)
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  executeDataGridQuery,
  getGlobalGridSettings,
  getUserGridPreference,
  saveUserGridPreference,
  resetUserGridPreference,
  normalizePageSize,
} from '../services/dataGridService';
import { GridSortRule, GridDeviceType } from '../types/dataGrid';

export interface UseStandardDataGridOptions<T extends Record<string, any>, K extends string = string> {
  gridId: string;
  userId?: string;
  deviceType?: GridDeviceType;
  data?: T[];
  items?: T[];
  defaultSortField?: K | string;
  primarySortField?: string;
  defaultSortDirection?: 'desc' | 'asc';
  defaultSortOrder?: 'desc' | 'asc';
  tieBreakerField?: string;
  defaultPageSize?: number;
  search?: string;
  searchQuery?: string;
  searchableFields?: string[];
  filterSignature?: string; // Pass serialized external filter state to auto-reset page to 1
  activeFilters?: Record<string, unknown>;
  getFieldValue?: (item: T, field: string) => unknown;
  getRowId?: (item: T) => string;
  getCreatedAt?: (item: T) => unknown;
  comparators?: Record<string, (a: T, b: T) => number>;
}

export function useStandardDataGrid<T extends Record<string, any>, K extends string = string>({
  gridId,
  userId = 'usr-default',
  deviceType = 'desktop',
  data: rawData,
  items,
  defaultSortField,
  primarySortField,
  defaultSortDirection = 'desc',
  defaultSortOrder,
  tieBreakerField = 'id',
  defaultPageSize,
  search = '',
  searchQuery = '',
  searchableFields,
  filterSignature = '',
  activeFilters,
  getFieldValue,
  getRowId,
  comparators,
}: UseStandardDataGridOptions<T, K>) {
  const data = rawData ?? items ?? [];
  const effectiveDefaultSortDirection = defaultSortOrder ?? defaultSortDirection;
  const effectiveDefaultSortField = (defaultSortField as string) ?? primarySortField;
  const effectiveSearch = search || searchQuery;
  const effectiveFilterSignature =
    filterSignature || (activeFilters ? JSON.stringify(activeFilters) : '');

  const settings = getGlobalGridSettings();
  const savedPref = useMemo(
    () => getUserGridPreference(gridId, userId, deviceType),
    [gridId, userId, deviceType]
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<number>(
    () => savedPref?.pageSize ?? defaultPageSize ?? settings.defaultPageSize ?? 20
  );
  const [sortRules, setSortRulesState] = useState<GridSortRule[]>(
    () => savedPref?.sortRules ?? []
  );

  // Sync user preference changes when userId or deviceType changes
  useEffect(() => {
    const pref = getUserGridPreference(gridId, userId, deviceType);
    if (pref) {
      setPageSizeState(normalizePageSize(pref.pageSize));
      setSortRulesState(pref.sortRules || []);
    } else {
      setPageSizeState(getGlobalGridSettings().defaultPageSize);
      setSortRulesState([]);
    }
    setCurrentPage(1);
  }, [gridId, userId, deviceType]);

  // Reset to page 1 when search or external filter signature changes
  useEffect(() => {
    setCurrentPage(1);
  }, [effectiveSearch, effectiveFilterSignature]);

  const setPageSize = useCallback(
    (nextSize: number) => {
      const normalized = normalizePageSize(nextSize);
      setPageSizeState(normalized);
      setCurrentPage(1);
      const existing = getUserGridPreference(gridId, userId, deviceType);
      saveUserGridPreference({
        gridId,
        userId,
        deviceType,
        pageSize: normalized,
        columnOrder: existing?.columnOrder || [],
        visibleColumns: existing?.visibleColumns || {},
        columnWidths: existing?.columnWidths || {},
        sortRules,
      });
    },
    [gridId, userId, deviceType, sortRules]
  );

  const toggleSort = useCallback(
    (field: K | string, dataType?: GridSortRule['dataType']) => {
      const fieldStr = String(field);
      setSortRulesState((prev) => {
        const current = prev[0];
        let next: GridSortRule[];
        if (current && current.field === fieldStr) {
          next =
            current.direction === 'desc'
              ? [{ field: fieldStr, direction: 'asc', dataType }]
              : []; // Third click returns to factory DESC default
        } else {
          next = [{ field: fieldStr, direction: 'desc', dataType }];
        }
        const existing = getUserGridPreference(gridId, userId, deviceType);
        saveUserGridPreference({
          gridId,
          userId,
          deviceType,
          pageSize,
          columnOrder: existing?.columnOrder || [],
          visibleColumns: existing?.visibleColumns || {},
          columnWidths: existing?.columnWidths || {},
          sortRules: next,
        });
        return next;
      });
      setCurrentPage(1);
    },
    [gridId, userId, deviceType, pageSize]
  );

  const resetToFactoryDefault = useCallback(() => {
    resetUserGridPreference(gridId, userId, deviceType);
    setPageSizeState(getGlobalGridSettings().defaultPageSize);
    setSortRulesState([]);
    setCurrentPage(1);
  }, [gridId, userId, deviceType]);

  // Full sorted dataset (all filtered records, sorted DESC newest-first by default)
  const fullSortedResponse = useMemo(() => {
    const activeField = sortRules[0]?.field || effectiveDefaultSortField;
    const activeDir = sortRules[0]?.direction || effectiveDefaultSortDirection;

    if (comparators && activeField && comparators[activeField]) {
      const cmp = comparators[activeField];
      const sorted = [...data].sort((a, b) => {
        const res = cmp(a, b);
        return activeDir === 'asc' ? res : -res;
      });
      return {
        data: sorted,
        pagination: {
          page: 1,
          pageSize: Math.max(sorted.length, 1),
          totalRecords: sorted.length,
          totalPages: 1,
        },
        sortApplied: [{ field: activeField, direction: activeDir }],
      };
    }

    return executeDataGridQuery(
      data,
      {
        page: 1,
        pageSize: Math.max(data.length, 1),
        search: effectiveSearch,
        searchableFields,
        sortRules,
        defaultSortField: effectiveDefaultSortField,
        defaultSortDirection: effectiveDefaultSortDirection,
        tieBreakerField,
      },
      { getFieldValue, getRowId }
    );
  }, [
    data,
    comparators,
    effectiveSearch,
    searchableFields,
    sortRules,
    effectiveDefaultSortField,
    effectiveDefaultSortDirection,
    tieBreakerField,
    getFieldValue,
    getRowId,
  ]);

  const totalRecords = fullSortedResponse.pagination.totalRecords;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const clampedPage = Math.min(Math.max(1, currentPage), totalPages);

  // Sync clamped page automatically when rows are deleted
  useEffect(() => {
    if (clampedPage !== currentPage) {
      setCurrentPage(clampedPage);
    }
  }, [clampedPage, currentPage]);

  const pagedData = useMemo(() => {
    const start = (clampedPage - 1) * pageSize;
    return fullSortedResponse.data.slice(start, start + pageSize);
  }, [fullSortedResponse.data, clampedPage, pageSize]);

  const activeSortField = (sortRules[0]?.field || effectiveDefaultSortField || 'createdAt') as K;
  const activeSortOrder = (sortRules[0]?.direction || effectiveDefaultSortDirection || 'desc') as 'asc' | 'desc';

  return {
    pagedData,
    paginatedData: pagedData,
    paginatedItems: pagedData,
    allSortedData: fullSortedResponse.data,
    sortedItems: fullSortedResponse.data,
    currentPage: clampedPage,
    page: clampedPage,
    setCurrentPage,
    setPage: setCurrentPage,
    onPageChange: setCurrentPage,
    pageSize,
    setPageSize,
    onPageSizeChange: setPageSize,
    totalRecords,
    totalPages,
    sortRules,
    sortApplied: fullSortedResponse.sortApplied,
    sortField: activeSortField,
    sortOrder: activeSortOrder,
    toggleSort,
    handleSort: toggleSort,
    resetToFactoryDefault,
    pageSizeOptions: settings.allowedPageSizeOptions,
  };
}
