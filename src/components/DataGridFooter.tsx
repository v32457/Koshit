/**
 * CIPPLATFORM — STANDARDIZED DATA GRID PAGINATION FOOTER COMPONENT
 * Used by EnterpriseDataGrid and all custom enterprise record lists/tables
 * to enforce consistent Rows Per Page [10, 20, 25, 50, 100, 200] (Default 20),
 * accessible page navigation (First | Previous | 1 2 3 ... | Next | Last),
 * record range indicators, and mobile/tablet zero-overflow responsiveness.
 */

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import {
  buildPageNumberRange,
  getGlobalGridSettings,
} from '../services/dataGridService';

export interface DataGridFooterProps {
  currentPage?: number;
  page?: number;
  totalPages: number;
  pageSize: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  loading?: boolean;
  defaultSortNotice?: string;
  sortNotice?: string;
  entityLabel?: string;
}

export const DataGridFooter: React.FC<DataGridFooterProps> = ({
  currentPage,
  page,
  totalPages,
  pageSize,
  totalRecords,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  loading = false,
  defaultSortNotice,
  sortNotice,
}) => {
  const settings = getGlobalGridSettings();
  const options =
    pageSizeOptions && pageSizeOptions.length > 0
      ? pageSizeOptions
      : settings.allowedPageSizeOptions;
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage ?? page ?? 1), safeTotalPages);
  const effectiveSortNotice = defaultSortNotice ?? sortNotice;
  const rangeStart =
    totalRecords === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const rangeEnd =
    totalRecords === 0 ? 0 : Math.min(safeCurrentPage * pageSize, totalRecords);

  const pageNumbers = buildPageNumberRange(safeCurrentPage, safeTotalPages, 5);

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-600 min-w-0 max-w-full"
      role="navigation"
      aria-label="Data grid pagination"
    >
      {/* Left: Rows Per Page + Showing Range */}
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <label className="flex items-center gap-1.5 font-medium text-slate-600">
          <span className="whitespace-nowrap">Rows per page:</span>
          <select
            aria-label="Rows per page"
            value={pageSize}
            disabled={loading}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <span className="text-slate-300 hidden sm:inline">|</span>

        <span className="font-medium text-slate-700 whitespace-nowrap">
          Showing{' '}
          <span className="font-bold text-slate-900">
            {rangeStart}–{rangeEnd}
          </span>{' '}
          of <span className="font-bold text-slate-900">{totalRecords}</span>{' '}
          records
        </span>

        {effectiveSortNotice && (
          <span className="text-[10px] font-semibold text-slate-400 hidden lg:inline">
            • {effectiveSortNotice}
          </span>
        )}
      </div>

      {/* Right: First | Previous | Page Numbers | Next | Last */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={loading || safeCurrentPage <= 1}
          onClick={() => onPageChange(1)}
          aria-label="First page"
          title="First Page"
          className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
          <span className="hidden xl:inline ml-0.5 text-[11px] font-semibold">
            First
          </span>
        </button>

        <button
          type="button"
          disabled={loading || safeCurrentPage <= 1}
          onClick={() => onPageChange(safeCurrentPage - 1)}
          aria-label="Previous page"
          title="Previous Page"
          className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden xl:inline ml-0.5 text-[11px] font-semibold">
            Prev
          </span>
        </button>

        {/* Numeric Page Navigation (hidden on tiny <360px screens where compact label shows) */}
        <div className="hidden sm:flex items-center gap-1">
          {pageNumbers.map((item, idx) =>
            item === 'ellipsis' ? (
              <span
                key={`ell-${idx}`}
                className="px-1.5 text-slate-400 font-bold select-none"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                disabled={loading}
                onClick={() => onPageChange(item)}
                aria-label={`Page ${item}`}
                aria-current={item === safeCurrentPage ? 'page' : undefined}
                className={`min-w-[28px] h-7 px-2 rounded-md text-xs font-bold border transition cursor-pointer ${
                  item === safeCurrentPage
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {item}
              </button>
            )
          )}
        </div>

        <span className="sm:hidden px-2 font-bold text-slate-700 text-[11px] whitespace-nowrap">
          {safeCurrentPage} / {safeTotalPages}
        </span>

        <button
          type="button"
          disabled={loading || safeCurrentPage >= safeTotalPages}
          onClick={() => onPageChange(safeCurrentPage + 1)}
          aria-label="Next page"
          title="Next Page"
          className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition"
        >
          <span className="hidden xl:inline mr-0.5 text-[11px] font-semibold">
            Next
          </span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          disabled={loading || safeCurrentPage >= safeTotalPages}
          onClick={() => onPageChange(safeTotalPages)}
          aria-label="Last page"
          title="Last Page"
          className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition"
        >
          <span className="hidden xl:inline mr-0.5 text-[11px] font-semibold">
            Last
          </span>
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
