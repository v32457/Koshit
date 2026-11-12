import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, FileSpreadsheet, Check, Loader2 } from 'lucide-react';
import { executeExport, ExportTableData } from '../services/exportService';

interface ExportDropdownProps {
  getData: () => ExportTableData;
  label?: string;
  className?: string;
  onExportSuccess?: (format: string, filename: string) => void;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  getData,
  label = 'Export',
  className = '',
  onExportSuccess,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
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
    try {
      setIsExporting(format);
      const data = getData();
      await executeExport(format, data);
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
        <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 text-xs font-semibold animate-in fade-in slide-in-from-top-1 duration-150">
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
