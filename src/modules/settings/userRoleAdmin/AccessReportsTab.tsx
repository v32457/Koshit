import React, { useMemo, useState } from 'react';
import { FileBarChart2, Download } from 'lucide-react';
import {
  ACCESS_REPORT_CATALOG,
  AccessReportKey,
  userRoleAdminService,
} from '../../../services/userRoleAdminService';
import { exportService } from '../../../services/exportService';
import { useStandardDataGrid } from '../../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../../components/DataGridFooter';
import { UserRoleAdminTabProps } from './shared';

export const AccessReportsTab: React.FC<UserRoleAdminTabProps> = ({
  currentUser,
  companies,
  onNotify,
  refreshTick,
}) => {
  const [selectedReport, setSelectedReport] = useState<AccessReportKey>('USER_MASTER');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const reportData = useMemo(
    () =>
      userRoleAdminService.getAccessReport(
        selectedReport,
        {
          companyId: companyFilter === 'ALL' ? undefined : companyFilter,
        },
        currentUser
      ),
    [selectedReport, companyFilter, refreshTick, currentUser]
  );

  // Convert tabular rows into objects for useStandardDataGrid sorting/pagination/searching
  const rowObjects = useMemo(() => {
    const q = search.toLowerCase().trim();
    return reportData.rows
      .map((cells, idx) => ({ id: `row-${idx}`, cells }))
      .filter((item) => {
        if (!q) return true;
        return item.cells.some((c) => String(c).toLowerCase().includes(q));
      });
  }, [reportData, search]);

  const grid = useStandardDataGrid({
    gridId: `ura-report-${selectedReport.toLowerCase()}`,
    userId: currentUser.id,
    data: rowObjects,
    defaultSortField: 'id',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
    filterSignature: `${selectedReport}|${companyFilter}|${search}`,
  });

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    exportService.executeExport(format, {
      title: reportData.title,
      subtitle: reportData.subtitle,
      filenamePrefix: `ura_report_${selectedReport.toLowerCase()}`,
      headers: reportData.headers,
      rows: grid.allSortedData.map((r) => r.cells),
    });
    onNotify(`Exported '${reportData.title}' (${grid.allSortedData.length} rows) as ${format.toUpperCase()}.`, 'info');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <FileBarChart2 className="w-4 h-4 text-indigo-600" />
              Enterprise Access & Compliance Reports (25 Live Reports)
            </h3>
            <p className="text-[11px] text-slate-500">
              Select any of the 25 governance, association lifecycle, personal mobile consent, SoD, session, or registry audit reports and export to CSV, Excel, or PDF.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={() => handleExport('excel')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <select
            value={selectedReport}
            onChange={(e) => setSelectedReport(e.target.value as AccessReportKey)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
          >
            {ACCESS_REPORT_CATALOG.map((r) => (
              <option key={r.key} value={r.key}>
                {r.number}. {r.title} ({r.category})
              </option>
            ))}
          </select>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
          >
            <option value="ALL">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter report rows..."
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Report Preview Grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-slate-900">{reportData.title}</div>
            <div className="text-[11px] text-slate-500">{reportData.subtitle}</div>
          </div>
          <span className="text-[11px] font-bold text-indigo-700 tabular-nums">
            {grid.totalRecords} record(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                {reportData.headers.map((h) => (
                  <th key={h} className="p-2.5 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grid.pagedData.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  {row.cells.map((cell, idx) => (
                    <td key={idx} className="p-2.5 text-slate-800 whitespace-nowrap">
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
              {grid.pagedData.length === 0 && (
                <tr>
                  <td colSpan={reportData.headers.length} className="p-6 text-center text-slate-400 font-semibold">
                    No records matched for this report under current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DataGridFooter
        currentPage={grid.currentPage}
        totalPages={grid.totalPages}
        pageSize={grid.pageSize}
        totalRecords={grid.totalRecords}
        onPageChange={grid.setCurrentPage}
        onPageSizeChange={grid.setPageSize}
        pageSizeOptions={grid.pageSizeOptions}
      />
    </div>
  );
};
