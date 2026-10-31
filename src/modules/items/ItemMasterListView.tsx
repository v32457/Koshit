import React, { useState, useMemo } from 'react';
import { GlobalItem, Branch, BranchItemClassification } from '../../types';
import {
  Boxes,
  Search,
  Filter,
  Download,
  Upload,
  CheckCircle2,
  Clock,
  RotateCcw,
  Plus,
  Eye,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle,
  X,
  FileText,
  Sparkles,
  SlidersHorizontal,
  MapPin,
  Save,
} from 'lucide-react';
import {
  INITIAL_ITEM_CODE_RULES,
  INITIAL_DESCRIPTION_RULES,
  CLASSIFICATION_DIMENSIONS,
  INITIAL_BRANCH_ITEM_CLASSIFICATIONS,
} from '../../data/seedData';
import { generateItemCode } from '../../services/itemCodeEngine';
import { generateItemDescription } from '../../services/itemDescriptionEngine';
import { ContextIndicatorBar } from '../../components/ContextIndicatorBar';
import { OperatingContext } from '../../services/operatingContextService';

interface ItemMasterListViewProps {
  items: GlobalItem[];
  allBranches: Branch[];
  operatingContext?: OperatingContext;
  onNavigateNew: () => void;
  onNavigateCustomSpecs?: () => void;
  onImportItems?: (newItems: GlobalItem[]) => void;
}

type SortField =
  | 'globalItemCode'
  | 'categoryCode'
  | 'description'
  | 'branchCount'
  | 'status'
  | 'sapStatus';

type SortDirection = 'asc' | 'desc';

export const ItemMasterListView: React.FC<ItemMasterListViewProps> = ({
  items,
  allBranches,
  operatingContext,
  onNavigateNew,
  onNavigateCustomSpecs,
  onImportItems,
}) => {
  // Search & Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [governanceFilter, setGovernanceFilter] = useState('ALL');
  const [sapFilter, setSapFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('globalItemCode');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Inspector & Modals
  const [selectedItem, setSelectedItem] = useState<GlobalItem | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'overview' | 'classifications' | 'audit'>('overview');
  const [branchClassifications, setBranchClassifications] = useState<BranchItemClassification[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_branch_classifications');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_BRANCH_ITEM_CLASSIFICATIONS;
  });
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Filter & Search Logic
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search term
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesCode = item.globalItemCode.toLowerCase().includes(query);
        const matchesDesc = item.description.toLowerCase().includes(query);
        const matchesCat = item.categoryCode.toLowerCase().includes(query);
        const matchesAttr = Object.values(item.attributes).some(
          (val) => typeof val === 'string' && val.toLowerCase().includes(query)
        );
        if (!matchesCode && !matchesDesc && !matchesCat && !matchesAttr) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== 'ALL' && item.categoryCode !== categoryFilter) {
        return false;
      }

      // Governance status filter
      if (governanceFilter !== 'ALL' && item.status !== governanceFilter) {
        return false;
      }

      // SAP status filter
      if (sapFilter !== 'ALL') {
        const isSynced = item.sapSyncInfo?.syncStatus === 'SYNCED';
        if (sapFilter === 'SYNCED' && !isSynced) return false;
        if (sapFilter === 'NOT_SYNCED' && isSynced) return false;
        if (sapFilter === 'PENDING' && item.sapSyncInfo?.syncStatus !== 'PENDING') return false;
      }

      // Branch filter
      if (branchFilter !== 'ALL') {
        const hasBranch = item.branchAvailability.some((b) => b.branchId === branchFilter && b.isActive);
        if (!hasBranch) return false;
      }

      return true;
    });
  }, [items, searchTerm, categoryFilter, governanceFilter, sapFilter, branchFilter]);

  // Sort Logic
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'globalItemCode':
          comparison = a.globalItemCode.localeCompare(b.globalItemCode);
          break;
        case 'categoryCode':
          comparison = a.categoryCode.localeCompare(b.categoryCode);
          break;
        case 'description':
          comparison = a.description.localeCompare(b.description);
          break;
        case 'branchCount':
          comparison = a.branchAvailability.length - b.branchAvailability.length;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'sapStatus': {
          const aSap = a.sapSyncInfo?.syncStatus || 'NOT_SYNCED';
          const bSap = b.sapSyncInfo?.syncStatus || 'NOT_SYNCED';
          comparison = aSap.localeCompare(bSap);
          break;
        }
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [filteredItems, sortField, sortDirection]);

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  // Sort toggle handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 ml-1 inline" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600 ml-1 inline" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600 ml-1 inline" />
    );
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('ALL');
    setGovernanceFilter('ALL');
    setSapFilter('ALL');
    setBranchFilter('ALL');
    setCurrentPage(1);
  };

  const isFiltersActive =
    searchTerm !== '' ||
    categoryFilter !== 'ALL' ||
    governanceFilter !== 'ALL' ||
    sapFilter !== 'ALL' ||
    branchFilter !== 'ALL';

  // Export CSV
  const exportToCsv = () => {
    const headers = [
      'GlobalItemCode',
      'Category',
      'GeneratedDescription',
      'GovernanceStatus',
      'SAPStatus',
      'SAPItemCode',
      'BranchCount',
      'CreatedAt',
    ];
    const rows = sortedItems.map((i) => [
      i.globalItemCode,
      i.categoryCode,
      `"${i.description.replace(/"/g, '""')}"`,
      i.status,
      i.sapSyncInfo?.syncStatus || 'NOT_SYNCED',
      i.sapSyncInfo?.sapItemCode || '',
      i.branchAvailability.length,
      i.createdAt,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kosh_global_items_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk Import Parser & Validator
  const parsedImportRows = useMemo(() => {
    if (!bulkCsvText.trim()) return [];
    const lines = bulkCsvText.trim().split('\n');
    const result: Array<{
      raw: string;
      categoryCode: string;
      specification: string;
      partModelNumber?: string;
      dimensions?: string;
      materialCode?: string;
      processCode?: string;
      colourCode?: string;
      manufacturerCode?: string;
      isValid: boolean;
      errorMessage?: string;
    }> = [];

    lines.forEach((line, index) => {
      // skip header if first line looks like header
      if (index === 0 && (line.toLowerCase().includes('category') || line.toLowerCase().includes('itemcode'))) {
        return;
      }
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length === 0 || !parts[0]) return;

      const categoryCode = parts[0]?.toUpperCase() || '';
      const specification = parts[1] || '';
      const partModelNumber = parts[2] || '';
      const dimensions = parts[3] || '';
      const materialCode = parts[4] || '';
      const processCode = parts[5] || '';
      const colourCode = parts[6] || '';
      const manufacturerCode = parts[7] || '';

      const isValid = categoryCode.length >= 2 && specification.length >= 2;
      const errorMessage = !isValid
        ? 'Category code and Specification must be provided'
        : undefined;

      result.push({
        raw: line,
        categoryCode,
        specification,
        partModelNumber,
        dimensions,
        materialCode,
        processCode,
        colourCode,
        manufacturerCode,
        isValid,
        errorMessage,
      });
    });

    return result;
  }, [bulkCsvText]);

  // Load sample CSV data
  const handleLoadSampleCsv = () => {
    const sample = `Category,Specification,PartModelNumber,Dimensions,Material,Process,Colour,Manufacturer
RM,Polypropylene Virgin Resin Grade A,PP-701,25 Kg Bag,PO,EX,NA,RELIANCE
FG,High Density Motor Casing Shell,DIX-002,120 x 85 mm,AL,MC,BL,KOSH
MA,Air Filter Regulator Assembly,AFR-100,1/4 Inch Port,SS,NA,SL,FESTO
PK,Double Wall Corrugated Master Box,BOX-880,450 x 300 x 250 mm,CB,NA,BR,KOSH
CO,Synthetic Industrial Lubricant ISO 68,OIL-68,20 Litre Drum,CH,NA,AM,CASTROL`;
    setBulkCsvText(sample);
  };

  // Download CSV Import Template
  const handleDownloadCsvTemplate = () => {
    const templateHeader = 'Category,Specification,PartModelNumber,Dimensions,Material,Process,Colour,Manufacturer';
    const sampleRows = [
      'RM,Polypropylene Virgin Resin Grade A,PP-701,25 Kg Bag,PO,EX,NA,RELIANCE',
      'FG,High Density Motor Casing Shell,DIX-002,120 x 85 mm,AL,MC,BL,KOSH',
      'MA,Air Filter Regulator Assembly,AFR-100,1/4 Inch Port,SS,NA,SL,FESTO',
      'PK,Double Wall Corrugated Master Box,BOX-880,450 x 300 x 250 mm,CB,NA,BR,KOSH',
      'CO,Synthetic Industrial Lubricant ISO 68,OIL-68,20 Litre Drum,CH,NA,AM,CASTROL',
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + [templateHeader, ...sampleRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'kosh_item_master_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Upload CSV File Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setBulkCsvText(text);
      }
    };
    reader.readAsText(file);
  };

  // Confirm Bulk Import & Create Multiple Draft Items
  const handleConfirmImport = () => {
    const validRows = parsedImportRows.filter((r) => r.isValid);
    if (validRows.length === 0) return;

    const newGlobalItems: GlobalItem[] = validRows.map((row, idx) => {
      // Get category classification rules
      const codeRule =
        INITIAL_ITEM_CODE_RULES.find((r) => r.categoryCode === row.categoryCode) ||
        INITIAL_ITEM_CODE_RULES[0];
      const descRule =
        INITIAL_DESCRIPTION_RULES.find((r) => r.categoryCode === row.categoryCode) ||
        INITIAL_DESCRIPTION_RULES[0];

      const seq = 100 + idx + items.length;
      const genCodeResult = generateItemCode(codeRule, {
        categoryCode: row.categoryCode,
        materialCode: row.materialCode,
        processCode: row.processCode,
        colourCode: row.colourCode,
        manufacturerCode: row.manufacturerCode,
        sequenceNumber: seq,
      });

      const genDesc = generateItemDescription(descRule, {
        categoryCode: row.categoryCode,
        specification: row.specification,
        dimensions: row.dimensions,
        ratingSize: row.dimensions,
        partModelNumber: row.partModelNumber,
        materialName: CLASSIFICATION_DIMENSIONS.material.values.find((m) => m.code === row.materialCode)?.name,
        colourName: CLASSIFICATION_DIMENSIONS.colour.values.find((c) => c.code === row.colourCode)?.name,
        materialFormName: CLASSIFICATION_DIMENSIONS.materialForm.values.find((f) => f.code === row.materialCode)?.name,
        manufacturerName: CLASSIFICATION_DIMENSIONS.manufacturer.values.find((m) => m.code === row.manufacturerCode)?.name,
      });

      return {
        id: `draft-imported-${Date.now()}-${idx}`,
        globalItemCode: genCodeResult.code || `${row.categoryCode}DRAFT${seq}`,
        isProvisionalCode: true,
        categoryCode: row.categoryCode,
        description: genDesc.description,
        status: 'DRAFT' as const, // Creates multiple draft items at once
        codeRuleVersion: codeRule.version,
        descRuleVersion: descRule.version,
        createdBy: 'usr-admin-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attributes: {
          specification: row.specification,
          partModelNumber: row.partModelNumber || '',
          dimensions: row.dimensions || '',
          material: row.materialCode || '',
          process: row.processCode || '',
          colour: row.colourCode || '',
          manufacturer: row.manufacturerCode || '',
        },
        approvalHistory: [
          {
            id: `appr-bulk-${Date.now()}-${idx}`,
            action: 'SUBMIT',
            actorId: 'usr-admin-01',
            actorName: 'Bulk CSV Import Engine',
            actorRole: 'ITEM_MAKER',
            timestamp: new Date().toISOString(),
            remarks: 'Draft item created via Bulk CSV Import mapped to category and classification rules.',
            previousStatus: 'DRAFT',
            newStatus: 'DRAFT',
          },
        ],
        branchAvailability: allBranches.map((b) => ({
          branchId: b.id,
          isStocked: true,
          isPurchased: true,
          isManufactured: row.categoryCode === 'FG',
          isActive: true,
        })),
      };
    });

    if (onImportItems) {
      onImportItems(newGlobalItems);
    }
    setImportNotice(`Successfully imported ${newGlobalItems.length} draft item(s) mapped to active classification rules.`);
    setIsBulkImportOpen(false);
    setBulkCsvText('');
    setTimeout(() => setImportNotice(null), 4000);
  };

  return (
    <div className="space-y-4 select-none">
      {/* Operating Context Badge Indicator */}
      {operatingContext && <ContextIndicatorBar context={operatingContext} className="mb-1" />}

      {/* Top Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600" />
            Global Item Master
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Authoritative, centralized item registry across all Kosh Innovations manufacturing plants.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateCustomSpecs && (
            <button
              onClick={onNavigateCustomSpecs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition cursor-pointer shadow-xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
              <span>Custom Specifications</span>
            </button>
          )}

          <button
            onClick={exportToCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleDownloadCsvTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer shadow-xs"
            title="Download blank template CSV with required columns"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Download CSV Template</span>
          </button>

          <button
            onClick={() => setIsBulkImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-600 bg-blue-50 text-blue-800 hover:bg-blue-100 text-xs font-bold transition cursor-pointer shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>Bulk Import</span>
          </button>

          <button
            onClick={onNavigateNew}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Item</span>
          </button>
        </div>
      </div>

      {importNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{importNotice}</span>
        </div>
      )}

      {/* Multi-Facet Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-xs">
          {/* Full Search Bar */}
          <div className="md:col-span-3 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Code, Category, Description..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
            />
          </div>

          {/* Company Scope Filter */}
          <div className="md:col-span-3">
            <select
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-bold focus:outline-none text-xs"
            >
              <option value="ALL">All Authorized Companies</option>
              <option value="co-kosh-01">KOSH-HQ — Kosh Innovations Pvt Ltd</option>
              <option value="co-kosh-02">KOSH-SOUTH — Kosh South Logistics India Pvt Ltd</option>
              <option value="co-kosh-03">KOSH-WEST — Kosh West Manufacturing Components Pvt Ltd</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="md:col-span-2">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-medium focus:outline-none text-xs"
            >
              <option value="ALL">All Categories</option>
              <option value="FG">Finished Goods (FG)</option>
              <option value="RM">Raw Materials (RM)</option>
              <option value="MA">Maintenance / Spares (MA)</option>
              <option value="PK">Packaging Materials (PK)</option>
              <option value="CO">Consumables (CO)</option>
              <option value="SF">Semi-Finished (SF)</option>
              <option value="BO">Bought-Out (BO)</option>
            </select>
          </div>

          {/* Governance Status Filter */}
          <div className="md:col-span-2">
            <select
              value={governanceFilter}
              onChange={(e) => {
                setGovernanceFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-medium focus:outline-none text-xs"
            >
              <option value="ALL">Governance Status (All)</option>
              <option value="APPROVED">APPROVED</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="DRAFT">DRAFT</option>
              <option value="SAP_CREATED">SAP_CREATED</option>
              <option value="RETURNED_FOR_CORRECTION">RETURNED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          {/* Branch Availability Filter */}
          <div className="md:col-span-2">
            <select
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-medium focus:outline-none text-xs"
            >
              <option value="ALL">All Branches</option>
              {allBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  [{b.portalBranchCode}] {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Summary & Reset Bar */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong>{filteredItems.length}</strong> matching item(s) of <strong>{items.length}</strong> total
            </span>
            {isFiltersActive && (
              <button
                onClick={handleResetFilters}
                className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer ml-2"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Page size selector */}
          <div className="flex items-center gap-1.5">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-slate-300 rounded px-2 py-0.5 bg-slate-50 text-xs font-medium cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Sortable Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 font-bold select-none">
                {/* 1. Global Item Code */}
                <th
                  onClick={() => handleSort('globalItemCode')}
                  className="p-3.5 cursor-pointer hover:bg-slate-200/70 transition"
                  title="Sort by Global Item Code"
                >
                  <div className="flex items-center">
                    <span>Global Item Code</span>
                    {renderSortIcon('globalItemCode')}
                  </div>
                </th>

                {/* 2. Category */}
                <th
                  onClick={() => handleSort('categoryCode')}
                  className="p-3.5 cursor-pointer hover:bg-slate-200/70 transition"
                  title="Sort by Category"
                >
                  <div className="flex items-center">
                    <span>Category</span>
                    {renderSortIcon('categoryCode')}
                  </div>
                </th>

                {/* 3. Generated Description */}
                <th
                  onClick={() => handleSort('description')}
                  className="p-3.5 cursor-pointer hover:bg-slate-200/70 transition"
                  title="Sort by Generated Description"
                >
                  <div className="flex items-center">
                    <span>Generated Description</span>
                    {renderSortIcon('description')}
                  </div>
                </th>

                {/* 4. Branch Availability */}
                <th
                  onClick={() => handleSort('branchCount')}
                  className="p-3.5 cursor-pointer hover:bg-slate-200/70 transition"
                  title="Sort by Branch Availability"
                >
                  <div className="flex items-center">
                    <span>Branch Availability</span>
                    {renderSortIcon('branchCount')}
                  </div>
                </th>

                {/* 5. Governance Status */}
                <th
                  onClick={() => handleSort('status')}
                  className="p-3.5 cursor-pointer hover:bg-slate-200/70 transition"
                  title="Sort by Governance Status"
                >
                  <div className="flex items-center">
                    <span>Governance Status</span>
                    {renderSortIcon('status')}
                  </div>
                </th>

                {/* 6. SAP Status */}
                <th
                  onClick={() => handleSort('sapStatus')}
                  className="p-3.5 cursor-pointer hover:bg-slate-200/70 transition"
                  title="Sort by SAP Status"
                >
                  <div className="flex items-center">
                    <span>SAP Status</span>
                    {renderSortIcon('sapStatus')}
                  </div>
                </th>

                {/* 7. Action */}
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No items match the search or filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono font-bold text-cyan-800">
                      {item.globalItemCode}
                      {item.isProvisionalCode && (
                        <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-sans font-semibold">
                          Provisional
                        </span>
                      )}
                    </td>

                    <td className="p-3.5">
                      <span className="font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                        {item.categoryCode}
                      </span>
                    </td>

                    <td className="p-3.5 text-slate-800 font-medium max-w-md truncate" title={item.description}>
                      {item.description}
                    </td>

                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-1">
                        {item.branchAvailability.map((ba) => {
                          const br = allBranches.find((b) => b.id === ba.branchId);
                          return (
                            <span
                              key={ba.branchId}
                              className="bg-blue-50 border border-blue-200 text-blue-800 text-[10px] px-1.5 py-0.2 rounded font-semibold"
                              title={`${br?.name || 'Branch'} • Stocked: ${ba.isStocked} • Mfg: ${ba.isManufactured}`}
                            >
                              {br?.code || 'BR'}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          item.status === 'SAP_CREATED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : item.status === 'APPROVED'
                            ? 'bg-blue-50 text-blue-700 border-blue-300'
                            : item.status === 'SUBMITTED'
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td className="p-3.5">
                      {item.sapSyncInfo?.syncStatus === 'SYNCED' ? (
                        <span className="text-emerald-700 font-mono text-[11px] font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {item.sapSyncInfo.sapItemCode}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px] italic">Not Synced</span>
                      )}
                    </td>

                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                      >
                        Inspect Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong>{Math.min(currentPage * pageSize, sortedItems.length)}</strong> of{' '}
            <strong>{sortedItems.length}</strong> items (Page {currentPage} of {totalPages})
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Page number buttons */}
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((pageNum, idx, arr) => {
                  const prev = arr[idx - 1];
                  const hasGap = prev && pageNum - prev > 1;
                  return (
                    <React.Fragment key={pageNum}>
                      {hasGap && <span className="px-1 text-slate-400">...</span>}
                      <button
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-md font-semibold text-xs cursor-pointer ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Import Modal */}
      {isBulkImportOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-sm">Bulk Item Master CSV Import</h3>
                  <p className="text-xs text-slate-300">Parse, validate, and import multiple items simultaneously.</p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkImportOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-900">
                <div>
                  <span className="font-bold">Required CSV Columns:</span>
                  <div className="text-[11px] font-mono text-blue-800 mt-0.5">
                    Category, Specification, PartModelNumber, Dimensions, Material, Process, Colour, Manufacturer
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="px-2.5 py-1 bg-white border border-blue-300 text-blue-800 hover:bg-blue-100 rounded font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    <span>Download Template (.csv)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadSampleCsv}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs shadow-xs cursor-pointer"
                  >
                    Load Sample Batch
                  </button>
                </div>
              </div>

              {/* Upload CSV File or Paste Data */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Upload Template CSV File or Paste CSV Data:
                  </label>
                  <label className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-semibold text-xs cursor-pointer flex items-center gap-1.5 transition">
                    <Upload className="w-3.5 h-3.5 text-slate-600" />
                    <span>Choose CSV File</span>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <textarea
                  rows={6}
                  value={bulkCsvText}
                  onChange={(e) => setBulkCsvText(e.target.value)}
                  placeholder={`Category,Specification,PartModelNumber,Dimensions,Material,Process,Colour,Manufacturer\nRM,Polypropylene Virgin Resin,PP-701,25 Kg Bag,PO,EX,NA,RELIANCE\nFG,Motor Casing Shell,DIX-002,120x85mm,AL,MC,BL,KOSH`}
                  className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Live Validation & Preview Table */}
              {parsedImportRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      Parsed Batch Validation ({parsedImportRows.filter((r) => r.isValid).length} valid / {parsedImportRows.length} total)
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2">Cat</th>
                          <th className="p-2">Specification</th>
                          <th className="p-2">Part #</th>
                          <th className="p-2">Dimensions</th>
                          <th className="p-2 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedImportRows.map((row, idx) => (
                          <tr key={idx} className={row.isValid ? 'bg-white' : 'bg-red-50/50'}>
                            <td className="p-2 font-mono font-bold text-slate-800">{row.categoryCode}</td>
                            <td className="p-2 truncate max-w-xs">{row.specification}</td>
                            <td className="p-2 font-mono text-slate-500">{row.partModelNumber || '—'}</td>
                            <td className="p-2 text-slate-500">{row.dimensions || '—'}</td>
                            <td className="p-2 text-right">
                              {row.isValid ? (
                                <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-1.5 py-0.5 rounded">
                                  VALID ✓
                                </span>
                              ) : (
                                <span className="bg-red-100 text-red-800 font-bold text-[10px] px-1.5 py-0.5 rounded">
                                  ERROR
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {parsedImportRows.filter((r) => r.isValid).length} records ready for atomic rule compilation.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsBulkImportOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={parsedImportRows.filter((r) => r.isValid).length === 0}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-40 cursor-pointer shadow-xs"
                >
                  Confirm & Import Records
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Detail Drawer / Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-cyan-300 font-mono">{selectedItem.globalItemCode}</h3>
                <p className="text-xs text-slate-300">{selectedItem.description}</p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Sub-tabs in Inspector */}
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center gap-2">
              <button
                onClick={() => setInspectorTab('overview')}
                className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                  inspectorTab === 'overview' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Overview & Attributes
              </button>
              <button
                onClick={() => setInspectorTab('classifications')}
                className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  inspectorTab === 'classifications' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                <span>Branch Classifications & Roles</span>
                <span className="text-[10px] font-mono bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-extrabold">
                  {branchClassifications.filter((b) => b.globalItemId === selectedItem.id).length || 3}
                </span>
              </button>
              <button
                onClick={() => setInspectorTab('audit')}
                className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                  inspectorTab === 'audit' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Audit Trail ({selectedItem.approvalHistory.length})
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              {inspectorTab === 'overview' && (
                <>
                  <div className="grid grid-cols-2 gap-3 border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <div>
                      <span className="text-slate-500 block">Global Master Category:</span>
                      <span className="font-bold text-slate-900">{selectedItem.categoryCode}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Status:</span>
                      <span className="font-bold text-blue-700">{selectedItem.status}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Rule Versions:</span>
                      <span className="font-mono text-slate-800">
                        Code v{selectedItem.codeRuleVersion} • Desc v{selectedItem.descRuleVersion}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Created Timestamp:</span>
                      <span className="font-mono text-slate-700">{selectedItem.createdAt}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-800 mb-2">Configured Attributes:</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.entries(selectedItem.attributes).map(([k, v]) => (
                        <div key={k} className="p-2 border border-slate-200 rounded bg-white">
                          <span className="text-slate-400 text-[10px] uppercase block font-semibold">
                            {k === 'partModelNumber' ? 'Customer / Part / Model Number' : k}
                          </span>
                          <span className="font-bold text-slate-800">{v || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {inspectorTab === 'classifications' && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg">
                    <span className="font-bold">Authoritative Branch Classification Model:</span>
                    <p className="mt-0.5 text-[11px] text-amber-800">
                      The exact same Global Item <strong className="font-mono text-indigo-900">{selectedItem.globalItemCode}</strong> maintains independent operating categories across branches (e.g. Puducherry = Finished Goods FG, Chennai = Raw Materials RM, Hosur = Semi-Finished SF).
                    </p>
                  </div>

                  <div className="space-y-2">
                    {allBranches.map((br) => {
                      const existing = branchClassifications.find(
                        (bc) => bc.branchId === br.id && bc.globalItemId === selectedItem.id
                      ) || {
                        id: `bic-${selectedItem.id}-${br.id}`,
                        globalItemId: selectedItem.id,
                        companyId: br.companyId || 'co-kosh-01',
                        companyCode: 'KOSH-HQ',
                        companyName: 'Kosh Innovations Pvt Ltd',
                        branchId: br.id,
                        branchCode: br.portalBranchCode,
                        branchName: br.name,
                        categoryCode: br.portalBranchCode === '001' ? 'FG' : br.portalBranchCode === '002' ? 'RM' : 'SF',
                        categoryName: br.portalBranchCode === '001' ? 'Finished Goods' : br.portalBranchCode === '002' ? 'Raw Materials' : 'Semi-Finished Goods',
                        itemRole: (br.portalBranchCode === '001' ? 'MANUFACTURE' : br.portalBranchCode === '002' ? 'PURCHASE' : 'STOCK') as any,
                        isStocked: true,
                        isPurchased: br.portalBranchCode === '002',
                        isManufactured: br.portalBranchCode === '001',
                        isSalesPermitted: br.portalBranchCode === '001',
                        status: 'ACTIVE' as any,
                        sapItemCode: `${br.portalBranchCode === '001' ? 'FG' : br.portalBranchCode === '002' ? 'RM' : 'SF'}-${selectedItem.globalItemCode}-${br.portalBranchCode}`,
                        branchSpecificDescription: `${selectedItem.description} (${br.name})`,
                      };

                      return (
                        <div key={br.id} className="p-3 bg-white border border-slate-200 rounded-lg space-y-2 shadow-2xs">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                                <span>{br.name}</span>
                                <span className="font-mono text-[10px] text-indigo-700 font-extrabold bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                                  [{br.portalBranchCode}]
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                                SAP Branch Code: {existing.sapItemCode}
                              </div>
                            </div>

                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              {existing.itemRole}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <label className="text-slate-500 block font-semibold mb-0.5">Branch Category Role:</label>
                              <select
                                value={existing.categoryCode}
                                onChange={(e) => {
                                  const newCat = e.target.value;
                                  const updated = branchClassifications.filter(
                                    (b) => !(b.branchId === br.id && b.globalItemId === selectedItem.id)
                                  );
                                  const newEntry: BranchItemClassification = {
                                    ...existing,
                                    categoryCode: newCat,
                                    categoryName: newCat === 'FG' ? 'Finished Goods' : newCat === 'RM' ? 'Raw Materials' : newCat === 'SF' ? 'Semi-Finished' : 'Consumables',
                                    itemRole: (newCat === 'FG' ? 'MANUFACTURE' : newCat === 'RM' ? 'PURCHASE' : 'STOCK') as any,
                                    updatedAt: new Date().toISOString(),
                                  };
                                  const combined = [...updated, newEntry];
                                  setBranchClassifications(combined);
                                  localStorage.setItem('kosh_branch_classifications', JSON.stringify(combined));
                                }}
                                className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded font-bold text-slate-800"
                              >
                                <option value="FG">FG — Finished Goods</option>
                                <option value="RM">RM — Raw Materials</option>
                                <option value="SF">SF — Semi-Finished Goods</option>
                                <option value="PK">PK — Packaging Materials</option>
                                <option value="CO">CO — Consumables</option>
                                <option value="MA">MA — Maintenance / Spares</option>
                                <option value="BO">BO — Bought-Out</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-slate-500 block font-semibold mb-0.5">Permissions:</label>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${existing.isStocked ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>
                                  Stocked
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${existing.isPurchased ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-500'}`}>
                                  Purchased
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${existing.isManufactured ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                                  Manufactured
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {inspectorTab === 'audit' && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-2">Audit & Approval Decision Trail:</h4>
                  <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                    {selectedItem.approvalHistory.map((h) => (
                      <div key={h.id} className="text-[11px] pb-2 border-b border-slate-200 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-slate-900">{h.action} by {h.actorName} ({h.actorRole})</span>
                          <span className="text-slate-400 font-mono text-[10px]">{h.timestamp}</span>
                        </div>
                        <div className="text-slate-600 mt-0.5">Remarks: "{h.remarks}"</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded text-xs font-semibold hover:bg-slate-700"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
