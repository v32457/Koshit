import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, FileSpreadsheet, Loader2, ShieldAlert } from 'lucide-react';
import { executeExport, executeScopedExport, ExportTableData } from '../services/exportService';
import { getGlobalGridSettings } from '../services/dataGridService';

interface ExportDropdownProps {
  getData?: () => ExportTableData;
  getCurrentPageData?: () => ExportTableData;
  headers?: string[];
  rows?: (string | number)[][];
  currentPageRows?: (string | number)[][];
  filenamePrefix?: string;
  title?: string;
  subtitle?: string;
  allowAllFilteredExport?: boolean;
  label?: string;
  className?: string;
  onExportSuccess?: (format: string, filename: string) => void;
  onExportBlocked?: (message: string) => void;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  getData: propGetData,
  getCurrentPageData: propGetCurrentPageData,
  headers = [],
  rows = [],
  currentPageRows,
  filenamePrefix = 'export_data',
  title = 'Export Report',
  subtitle,
  allowAllFilteredExport = true,
  label = 'Export',
  className = '',
  onExportSuccess,
  onExportBlocked,
}) => {
  const getData = propGetData || (() => ({ title, subtitle, headers, rows, filenamePrefix }));
  const getCurrentPageData =
    propGetCurrentPageData ||
    (currentPageRows
      ? () => ({ title, subtitle, headers, rows: currentPageRows, filenamePrefix })
      : undefined);
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [exportScope, setExportScope] = useState<'CURRENT_PAGE' | 'ALL_FILTERED'>(
    getCurrentPageData ? 'CURRENT_PAGE' : 'ALL_FILTERED'
  );
  const [blockMessage, setBlockMessage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectFormat = async (format: 'pdf' | 'excel' | 'word' | 'csv') => {
    setBlockMessage(null);
    const effectiveScope =
      getCurrentPageData && exportScope === 'CURRENT_PAGE' ? 'CURRENT_PAGE' : 'ALL_FILTERED';

    if (effectiveScope === 'ALL_FILTERED' && !allowAllFilteredExport) {
      const msg = 'All-Filtered export requires EXPORT_ALL_FILTERED permission. Only Current Page export is permitted.';
      setBlockMessage(msg);
      onExportBlocked?.(msg);
      return;
    }

    try {
      setIsExporting(format);
      const data =
        effectiveScope === 'CURRENT_PAGE' && getCurrentPageData
          ? getCurrentPageData()
          : getData();
      const settings = getGlobalGridSettings();

      if (getCurrentPageData) {
        const res = await executeScopedExport({
          ...data,
          format,
          exportScope: effectiveScope,
          maxRecordsLimit: settings.maxExportRecords,
          maxSizeBytesLimit: settings.maxExportFileSizeBytes,
        });
        if (!res.success) {
          setBlockMessage(res.message);
          onExportBlocked?.(res.message);
          return;
        }
      } else {
        await executeExport(format, data);
      }

      setIsOpen(false);
      if (onExportSuccess) {
        onExportSuccess(format.toUpperCase(), data.filenamePrefix);
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={!!isExporting}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer shadow-xs disabled:opacity-50"
      >
        {isExporting ? (
          <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5 text-slate-500" />
        )}
        <span>{isExporting ? `Exporting...` : label}</span>
        <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 text-xs font-semibold animate-in fade-in slide-in-from-top-1 duration-150">
          {getCurrentPageData && (
            <div className="px-3 py-2 border-b border-slate-100 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Export Scope
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setExportScope('CURRENT_PAGE')}
                  className={`px-2 py-1 rounded text-[11px] font-bold border transition cursor-pointer ${
                    exportScope === 'CURRENT_PAGE'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Current Page
                </button>
                <button
                  type="button"
                  disabled={!allowAllFilteredExport}
                  onClick={() => setExportScope('ALL_FILTERED')}
                  className={`px-2 py-1 rounded text-[11px] font-bold border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    exportScope === 'ALL_FILTERED'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All Filtered
                </button>
              </div>
            </div>
          )}

          {blockMessage && (
            <div className="mx-2 my-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[10px] flex items-start gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{blockMessage}</span>
            </div>
          )}

          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
            Choose Export Format
          </div>

          <button
            type="button"
            onClick={() => handleSelectFormat('pdf')}
            className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center justify-between cursor-pointer group transition"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1 rounded bg-rose-50 text-rose-600 group-hover:bg-rose-100 transition">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-bold text-slate-800">PDF Document</div>
                <div className="text-[10px] text-slate-400 font-normal">Native PDF (.pdf)</div>
              </div>
            </div>
            {isExporting === 'pdf' && <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />}
          </button>

          <button
            type="button"
            onClick={() => handleSelectFormat('excel')}
            className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center justify-between cursor-pointer group transition"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1 rounded bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition">
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-bold text-slate-800">Excel Spreadsheet</div>
                <div className="text-[10px] text-slate-400 font-normal">Excel Workbook (.xlsx)</div>
              </div>
            </div>
            {isExporting === 'excel' && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />}
          </button>

          <button
            type="button"
            onClick={() => handleSelectFormat('word')}
            className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center justify-between cursor-pointer group transition"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1 rounded bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-bold text-slate-800">Word Document</div>
                <div className="text-[10px] text-slate-400 font-normal">Docx Document (.docx)</div>
              </div>
            </div>
            {isExporting === 'word' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
          </button>

          <div className="border-t border-slate-100 my-1"></div>

          <button
            type="button"
            onClick={() => handleSelectFormat('csv')}
            className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center justify-between cursor-pointer group transition"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1 rounded bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition">
                <Download className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-bold text-slate-800">CSV Spreadsheet</div>
                <div className="text-[10px] text-slate-400 font-normal">UTF-8 BOM (.csv)</div>
              </div>
            </div>
            {isExporting === 'csv' && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />}
          </button>
        </div>
      )}
    </div>
  );
};
