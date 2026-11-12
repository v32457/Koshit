import React, { useState, useMemo } from 'react';
import { GlobalItem, Branch, BranchItemClassification } from '../../types';
import { Layers, MapPin, Search, Filter, Box, Download, ChevronDown, FileText, FileSpreadsheet, ShieldCheck, Loader2 } from 'lucide-react';
import { executeExport, ExportTableData } from '../../services/exportService';
import { isItemAvailableInBranch } from '../../utils/branchItemHelper';

interface BranchCreatedItemsViewProps {
  items: GlobalItem[];
  allBranches: Branch[];
}

export const BranchCreatedItemsView: React.FC<BranchCreatedItemsViewProps> = ({
  items,
  allBranches,
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(allBranches[0]?.id || 'br-pond-01');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Load branch classifications
  const branchClassifications: BranchItemClassification[] = useMemo(() => {
    try {
      const saved = localStorage.getItem('kosh_branch_classifications');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  }, []);

  const selectedBranch = allBranches.find((b) => b.id === selectedBranchId) || allBranches[0] || {
    id: selectedBranchId || 'br-pond-01',
    orgId: 'org-kosh-01',
    portalBranchCode: '001',
    code: 'PDY',
    name: 'Puducherry Plant',
    city: 'Puducherry',
    state: 'Puducherry',
    lifecycleStatus: 'ACTIVE',
    plants: [],
    warehouses: [],
  };

  // Robust branch-based item filtering: strictly only include items where branch availability is active
  const branchItems = useMemo(() => {
    return items.filter((item) => {
      const isAvailable = isItemAvailableInBranch(item, selectedBranch);
      if (!isAvailable) return false;

      // Category check
      const bic = branchClassifications.find(
        (bc) => (bc.branchId === selectedBranch.id || bc.branchCode === selectedBranch.portalBranchCode) && bc.globalItemId === item.id
      );
      const catCode = bic?.categoryCode || item.categoryCode;

      if (categoryFilter !== 'ALL' && catCode !== categoryFilter) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesCode = item.globalItemCode.toLowerCase().includes(query);
        const matchesDesc = item.description.toLowerCase().includes(query);
        const matchesCat = catCode.toLowerCase().includes(query);
        if (!matchesCode && !matchesDesc && !matchesCat) return false;
      }

      return true;
    });
  }, [items, selectedBranch, branchClassifications, categoryFilter, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    let fg = 0;
    let rm = 0;
    let sf = 0;
    let other = 0;

    branchItems.forEach((item) => {
      const bic = branchClassifications.find(
        (bc) => (bc.branchId === selectedBranch.id || bc.branchCode === selectedBranch.portalBranchCode) && bc.globalItemId === item.id
      );
      const catCode = bic?.categoryCode || item.categoryCode;
      if (catCode === 'FG') fg++;
      else if (catCode === 'RM') rm++;
      else if (catCode === 'SF') sf++;
      else other++;
    });

    return { total: branchItems.length, fg, rm, sf, other };
  }, [branchItems, branchClassifications, selectedBranch]);

  // Production Multi-format Export Handler: PDF (binary via jsPDF), Excel (.xlsx via SheetJS), Word (.docx via docx), CSV (with UTF-8 BOM & sanitized characters)
  const handleExport = async (type: 'pdf' | 'excel' | 'word' | 'csv') => {
    setIsExportMenuOpen(false);
    setIsExporting(type);

    try {
      const branchCode = (selectedBranch?.portalBranchCode || selectedBranch?.code || 'branch').replace(/[^a-zA-Z0-9_-]/g, '_');
      const branchTitle = selectedBranch?.name || 'Branch Operations';
      const headers = ['Global Item Code', 'Branch SAP Item Code', 'Branch Category', 'Description', 'Stocking Status', 'Purchased', 'Manufactured', 'Branch Name'];
      const rows = branchItems.map((item) => {
        const bic = branchClassifications.find(
          (bc) => (bc.branchId === selectedBranch.id || bc.branchCode === selectedBranch.portalBranchCode) && bc.globalItemId === item.id
        );
        const catCode = bic?.categoryCode || item.categoryCode;
        const sapCode = bic?.sapItemCode || `${catCode}-${item.globalItemCode}-${branchCode}`;
        const avail = item.branchAvailability.find(
          (b) => b.branchId === selectedBranch.id || b.branchId === selectedBranch.code || b.branchId === selectedBranch.portalBranchCode
        );
        const rawDesc = bic?.branchSpecificDescription || item.description;
        return [
          item.globalItemCode,
          sapCode,
          catCode,
          rawDesc,
          'ACTIVE / STOCKED',
          avail?.isPurchased !== false ? 'Yes' : 'No',
          avail?.isManufactured ? 'Yes' : 'No',
          branchTitle,
        ];
      });

      const exportData: ExportTableData = {
        title: `Branch Item Catalog — ${branchTitle}`,
        subtitle: `Authoritative Branch-Created and Assigned Items Registry`,
        scopeLabel: `Branch: ${branchTitle} [${branchCode}]`,
        headers,
        rows,
        filenamePrefix: `branch_catalog_${branchCode}`,
      };

      await executeExport(type, exportData);
      setExportNotice(`Successfully exported ${branchItems.length} branch item(s) as ${type.toUpperCase()}.`);
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err) {
      console.error('Export failed:', err);
      setExportNotice('Export failed. Please check console for details.');
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-4 text-xs font-sans select-none">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Branch-Created & Assigned Item Catalog
          </h2>
          <p className="text-slate-500 mt-0.5">
            Dedicated view for branch personnel to review, track, and audit items created and stocked specifically for their branch operations.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          <span className="text-slate-500">Active Branch Scope:</span>
          <strong className="text-indigo-900">{selectedBranch.name} [{selectedBranch.portalBranchCode}]</strong>
        </div>
      </div>

      {exportNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Branch Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 font-semibold">
        {allBranches.map((br) => (
          <button
            key={br.id}
            onClick={() => setSelectedBranchId(br.id)}
            className={`px-3.5 py-2 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
              br.id === selectedBranchId
                ? 'bg-[#0B192C] text-white border-slate-800 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>{br.name}</span>
            <span className="text-[10px] font-mono text-cyan-300">[{br.portalBranchCode}]</span>
          </button>
        ))}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-slate-500 text-[11px] font-bold uppercase">Total Branch Items</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-xs">
          <div className="text-emerald-800 text-[11px] font-bold uppercase">Finished Goods (FG)</div>
          <div className="text-xl font-extrabold text-emerald-900 mt-1">{stats.fg}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 shadow-xs">
          <div className="text-amber-800 text-[11px] font-bold uppercase">Raw Materials (RM)</div>
          <div className="text-xl font-extrabold text-amber-900 mt-1">{stats.rm}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40 shadow-xs">
          <div className="text-indigo-800 text-[11px] font-bold uppercase">Semi-Finished (SF)</div>
          <div className="text-xl font-extrabold text-indigo-900 mt-1">{stats.sf}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-slate-600 text-[11px] font-bold uppercase">Other Materials</div>
          <div className="text-xl font-extrabold text-slate-800 mt-1">{stats.other}</div>
        </div>
      </div>

      {/* Filter Toolbar with Multi-Format Export Dropdown */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 ml-1" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Item Code, Description, or Category..."
            className="w-full p-1.5 bg-transparent border-none focus:outline-hidden text-xs text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 relative">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-bold text-xs"
          >
            <option value="ALL">All Categories</option>
            <option value="FG">FG — Finished Goods</option>
            <option value="RM">RM — Raw Materials</option>
            <option value="SF">SF — Semi-Finished</option>
            <option value="PK">PK — Packaging</option>
            <option value="CO">CO — Consumables</option>
          </select>

          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              disabled={!!isExporting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs cursor-pointer transition shadow-2xs disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 text-xs font-semibold">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Select Export Format
                </div>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-100 text-slate-700 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-3.5 h-3.5 text-rose-500" />
                    <span>PDF Document (.pdf)</span>
                  </div>
                  {isExporting === 'pdf' && <Loader2 className="w-3 h-3 animate-spin text-rose-500" />}
                </button>
                <button
                  onClick={() => handleExport('excel')}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-100 text-slate-700 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Excel Spreadsheet (.xlsx)</span>
                  </div>
                  {isExporting === 'excel' && <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />}
                </button>
                <button
                  onClick={() => handleExport('word')}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-100 text-slate-700 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>Word Document (.docx)</span>
                  </div>
                  {isExporting === 'word' && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-100 text-slate-700 flex items-center justify-between cursor-pointer border-t border-slate-100"
                >
                  <div className="flex items-center gap-2.5">
                    <Download className="w-3.5 h-3.5 text-indigo-600" />
                    <span>CSV Data (.csv)</span>
                  </div>
                  {isExporting === 'csv' && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Branch Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold text-slate-800">
            Assigned Catalog for {selectedBranch.name} ({branchItems.length} items)
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            Location: {selectedBranch.city}, State: {selectedBranch.state}
          </span>
        </div>

        {branchItems.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Box className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="font-bold text-slate-700">No Branch Items Found</h4>
            <p className="text-slate-500 text-[11px]">
              No items are currently active or created for {selectedBranch.name}. Check the Branch Availability Matrix to assign items.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                  <th className="p-3">Global Item Code</th>
                  <th className="p-3">Branch SAP Item Code</th>
                  <th className="p-3">Branch Category Role</th>
                  <th className="p-3">Item Description</th>
                  <th className="p-3 text-center">Stocking Status</th>
                  <th className="p-3 text-center">Purchased</th>
                  <th className="p-3 text-center">Manufactured</th>
                  <th className="p-3">Assigned Warehouse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branchItems.map((item) => {
                  const bic = branchClassifications.find(
                    (bc) => bc.branchId === selectedBranchId && bc.globalItemId === item.id
                  );
                  const catCode = bic?.categoryCode || item.categoryCode;
                  const catName = bic?.categoryName || 'Standard Item';
                  const sapCode = bic?.sapItemCode || `${catCode}-${item.globalItemCode}-${selectedBranch.portalBranchCode}`;
                  const avail = item.branchAvailability.find((b) => b.branchId === selectedBranchId);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono font-bold text-indigo-700">{item.globalItemCode}</td>
                      <td className="p-3 font-mono text-slate-800 font-bold">{sapCode}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          {catCode} • {catName}
                        </span>
                      </td>
                      <td className="p-3 text-slate-800 font-medium max-w-xs truncate" title={item.description}>
                        {bic?.branchSpecificDescription || item.description}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ACTIVE / STOCKED
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold text-slate-700">
                        {avail?.isPurchased !== false ? 'Yes' : 'No'}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-700">
                        {avail?.isManufactured ? 'Yes' : 'No'}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-600">
                        {selectedBranch.warehouses?.[0]?.warehouseName || 'Main Plant WH'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
