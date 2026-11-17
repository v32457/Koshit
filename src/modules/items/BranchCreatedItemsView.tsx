/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PHASE 10 — PURCHASE REQUISITION-ALIGNED BRANCH CREATED ITEMS CATALOG VIEW
 * Features:
 * - PR-aligned header, KPI summary cards, and controls toolbar
 * - Filters: Search, Branch, Global Item, Item Type, Material, Material Form,
 *   Availability Status, Approval Status, Created Date Range (From/To), Modified Date Range (From/To)
 * - Reusable Advanced Filter Engine + Saved Filter Presets + Active Filter Chips
 * - Column sorting, pagination, page-size selection, row actions, clear filters, refresh, and export
 */

import React, { useState, useMemo, useEffect } from 'react';
import { GlobalItem, Branch, BranchItemClassification } from '../../types';
import {
  Layers,
  MapPin,
  Search,
  Box,
  Download,
  ChevronDown,
  FileText,
  FileSpreadsheet,
  ShieldCheck,
  Loader2,
  RotateCcw,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  X,
  CheckCircle2,
} from 'lucide-react';
import { CLASSIFICATION_DIMENSIONS, INITIAL_BRANCH_ITEM_CLASSIFICATIONS } from '../../data/seedData';
import { executeScopedExport, ExportTableData } from '../../services/exportService';
import { isItemAvailableInBranch } from '../../utils/branchItemHelper';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';
import {
  AdvancedFilterState,
  FilterFieldDefinition,
  DateRangeFilterValue,
  ActiveFilterChip,
  createInitialAdvancedFilterState,
  createEmptyGroup,
  evaluateAdvancedFilters,
  matchesDateRange,
  buildAdvancedFilterChips,
  countActiveAdvancedConditions,
} from '../../services/advancedFilterEngine';
import {
  AdvancedFilterPanel,
  DateRangeFilterControl,
  ActiveFilterChipsBar,
  AdvancedFilterToggleButton,
} from '../../components/AdvancedFilterPanel';

interface BranchCreatedItemsViewProps {
  items: GlobalItem[];
  allBranches: Branch[];
  currentUser?: any;
  onNavigate?: (route: string) => void;
}

type BranchCatalogSortField =
  | 'globalItemCode'
  | 'sapItemCode'
  | 'categoryCode'
  | 'description'
  | 'itemType'
  | 'material'
  | 'materialForm'
  | 'availabilityStatus'
  | 'approvalStatus'
  | 'createdAt'
  | 'updatedAt';

function resolveDimensionLabel(dimKey: string, rawVal: unknown): string {
  const raw = String(rawVal ?? '').trim();
  if (!raw) return '—';
  const dim = (CLASSIFICATION_DIMENSIONS as Record<string, any>)[dimKey] || Object.values(CLASSIFICATION_DIMENSIONS).find((d: any) => d.key === dimKey || d.id === dimKey);
  if (!dim) return raw;
  const found = (dim.values || []).find(
    (v: any) => v.code.toLowerCase() === raw.toLowerCase() || v.label.toLowerCase() === raw.toLowerCase()
  );
  return found ? `${found.code} (${found.label})` : raw;
}

function getItemType(item: GlobalItem): string {
  const attrs = item.attributes || {};
  return resolveDimensionLabel(
    'ITEM_TYPE',
    attrs.ITEM_TYPE || attrs.itemType || attrs.type || 'RAW'
  );
}

function getMaterial(item: GlobalItem): string {
  const attrs = item.attributes || {};
  return resolveDimensionLabel('MATERIAL', attrs.MATERIAL || attrs.material || 'STL');
}

function getMaterialForm(item: GlobalItem): string {
  const attrs = item.attributes || {};
  return resolveDimensionLabel(
    'FORM',
    attrs.FORM || attrs.MATERIAL_FORM || attrs.materialForm || 'SHT'
  );
}

export const BranchCreatedItemsView: React.FC<BranchCreatedItemsViewProps> = ({
  items,
  allBranches,
  onNavigate,
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    allBranches[0]?.id || 'br-pond-01'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [globalItemFilter, setGlobalItemFilter] = useState('ALL');
  const [itemTypeFilter, setItemTypeFilter] = useState('ALL');
  const [materialFilter, setMaterialFilter] = useState('ALL');
  const [materialFormFilter, setMaterialFormFilter] = useState('ALL');
  const [availabilityStatusFilter, setAvailabilityStatusFilter] = useState('ALL');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState('ALL');
  const [createdDateRange, setCreatedDateRange] = useState<DateRangeFilterValue>({
    from: '',
    to: '',
  });
  const [modifiedDateRange, setModifiedDateRange] = useState<DateRangeFilterValue>({
    from: '',
    to: '',
  });

  // Advanced Filter Engine State
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [advancedFilterState, setAdvancedFilterState] = useState<AdvancedFilterState>(() =>
    createInitialAdvancedFilterState()
  );

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportScope, setExportScope] = useState<'CURRENT_PAGE' | 'ALL_FILTERED'>('CURRENT_PAGE');
  const [viewMode, setViewMode] = useState<'HEADER' | 'LINE'>('HEADER');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [inspectedItem, setInspectedItem] = useState<GlobalItem | null>(null);

  // Load branch classifications
  const branchClassifications: BranchItemClassification[] = useMemo(() => {
    try {
      const saved = localStorage.getItem('kosh_branch_classifications');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_BRANCH_ITEM_CLASSIFICATIONS;
  }, []);

  const selectedBranch =
    allBranches.find((b) => b.id === selectedBranchId) ||
    allBranches[0] || {
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

  const getBranchCategoryCode = (item: GlobalItem): string => {
    const bic = branchClassifications.find(
      (bc) =>
        (bc.branchId === selectedBranch.id ||
          bc.branchCode === selectedBranch.portalBranchCode) &&
        bc.globalItemId === item.id
    );
    return (
      bic?.categoryCode ||
      (selectedBranch.portalBranchCode === '001'
        ? 'FG'
        : selectedBranch.portalBranchCode === '002'
          ? 'RM'
          : 'SF')
    );
  };

  const getAvailabilityStatus = (item: GlobalItem): 'ACTIVE' | 'INACTIVE' => {
    return isItemAvailableInBranch(item, selectedBranch) ? 'ACTIVE' : 'INACTIVE';
  };

  // Distinct dropdown options
  const distinctOptions = useMemo(() => {
    const itemTypes = new Set<string>();
    const materials = new Set<string>();
    const materialForms = new Set<string>();

    items.forEach((item) => {
      itemTypes.add(getItemType(item));
      materials.add(getMaterial(item));
      materialForms.add(getMaterialForm(item));
    });

    return {
      itemTypes: Array.from(itemTypes).sort(),
      materials: Array.from(materials).sort(),
      materialForms: Array.from(materialForms).sort(),
    };
  }, [items]);

  // 10-Field Advanced Filter Engine Catalogue for Branch Created Items
  const branchCatalogFilterFields: FilterFieldDefinition<GlobalItem>[] = useMemo(
    () => [
      {
        key: 'branch',
        label: 'Branch',
        type: 'DROPDOWN',
        options: allBranches.map((b) => ({ value: b.name, label: b.name })),
        accessor: () => selectedBranch.name,
      },
      {
        key: 'globalItemCode',
        label: 'Global Item Code',
        type: 'TEXT',
        accessor: (item) => item.globalItemCode,
      },
      {
        key: 'description',
        label: 'Description',
        type: 'TEXT',
        accessor: (item) => item.description,
      },
      {
        key: 'itemType',
        label: 'Item Type',
        type: 'DROPDOWN',
        options: distinctOptions.itemTypes.map((v) => ({ value: v, label: v })),
        accessor: (item) => getItemType(item),
      },
      {
        key: 'material',
        label: 'Material',
        type: 'DROPDOWN',
        options: distinctOptions.materials.map((v) => ({ value: v, label: v })),
        accessor: (item) => getMaterial(item),
      },
      {
        key: 'materialForm',
        label: 'Material Form',
        type: 'DROPDOWN',
        options: distinctOptions.materialForms.map((v) => ({ value: v, label: v })),
        accessor: (item) => getMaterialForm(item),
      },
      {
        key: 'availabilityStatus',
        label: 'Availability Status',
        type: 'DROPDOWN',
        options: [
          { value: 'ACTIVE', label: 'ACTIVE' },
          { value: 'INACTIVE', label: 'INACTIVE' },
        ],
        accessor: (item) => getAvailabilityStatus(item),
      },
      {
        key: 'approvalStatus',
        label: 'Approval Status',
        type: 'DROPDOWN',
        options: [
          { value: 'APPROVED', label: 'APPROVED' },
          { value: 'SUBMITTED', label: 'SUBMITTED' },
          { value: 'DRAFT', label: 'DRAFT' },
          { value: 'REJECTED', label: 'REJECTED' },
        ],
        accessor: (item) => item.status,
      },
      {
        key: 'createdDate',
        label: 'Created Date',
        type: 'DATE',
        accessor: (item) => (item.createdAt ? item.createdAt.slice(0, 10) : ''),
      },
      {
        key: 'modifiedDate',
        label: 'Modified Date',
        type: 'DATE',
        accessor: (item) =>
          item.updatedAt
            ? item.updatedAt.slice(0, 10)
            : item.createdAt
              ? item.createdAt.slice(0, 10)
              : '',
      },
    ],
    [allBranches, selectedBranch, distinctOptions, branchClassifications]
  );

  const activeAdvancedCount = useMemo(
    () => countActiveAdvancedConditions(advancedFilterState, branchCatalogFilterFields),
    [advancedFilterState, branchCatalogFilterFields]
  );

  const activeQuickFilterCount = useMemo(() => {
    let c = 0;
    if (categoryFilter !== 'ALL') c += 1;
    if (globalItemFilter !== 'ALL') c += 1;
    if (itemTypeFilter !== 'ALL') c += 1;
    if (materialFilter !== 'ALL') c += 1;
    if (materialFormFilter !== 'ALL') c += 1;
    if (availabilityStatusFilter !== 'ALL') c += 1;
    if (approvalStatusFilter !== 'ALL') c += 1;
    if (createdDateRange.from || createdDateRange.to) c += 1;
    if (modifiedDateRange.from || modifiedDateRange.to) c += 1;
    return c;
  }, [
    categoryFilter,
    globalItemFilter,
    itemTypeFilter,
    materialFilter,
    materialFormFilter,
    availabilityStatusFilter,
    approvalStatusFilter,
    createdDateRange,
    modifiedDateRange,
  ]);

  const totalActiveFilterCount = activeQuickFilterCount + activeAdvancedCount;

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setCategoryFilter('ALL');
    setGlobalItemFilter('ALL');
    setItemTypeFilter('ALL');
    setMaterialFilter('ALL');
    setMaterialFormFilter('ALL');
    setAvailabilityStatusFilter('ALL');
    setApprovalStatusFilter('ALL');
    setCreatedDateRange({ from: '', to: '' });
    setModifiedDateRange({ from: '', to: '' });
    setAdvancedFilterState(createInitialAdvancedFilterState());
  };

  // Active Filter Chips
  const activeFilterChips: ActiveFilterChip[] = useMemo(() => {
    const chips: ActiveFilterChip[] = [];

    if (categoryFilter !== 'ALL') {
      chips.push({
        id: 'bc-cat',
        category: 'QUICK',
        fieldLabel: 'Branch Category',
        operatorLabel: 'Equals',
        valueLabel: categoryFilter,
        onRemove: () => setCategoryFilter('ALL'),
      });
    }
    if (globalItemFilter !== 'ALL') {
      chips.push({
        id: 'bc-gitem',
        category: 'QUICK',
        fieldLabel: 'Global Item',
        operatorLabel: 'Equals',
        valueLabel: globalItemFilter,
        onRemove: () => setGlobalItemFilter('ALL'),
      });
    }
    if (itemTypeFilter !== 'ALL') {
      chips.push({
        id: 'bc-itype',
        category: 'QUICK',
        fieldLabel: 'Item Type',
        operatorLabel: 'Equals',
        valueLabel: itemTypeFilter,
        onRemove: () => setItemTypeFilter('ALL'),
      });
    }
    if (materialFilter !== 'ALL') {
      chips.push({
        id: 'bc-mat',
        category: 'QUICK',
        fieldLabel: 'Material',
        operatorLabel: 'Equals',
        valueLabel: materialFilter,
        onRemove: () => setMaterialFilter('ALL'),
      });
    }
    if (materialFormFilter !== 'ALL') {
      chips.push({
        id: 'bc-mform',
        category: 'QUICK',
        fieldLabel: 'Material Form',
        operatorLabel: 'Equals',
        valueLabel: materialFormFilter,
        onRemove: () => setMaterialFormFilter('ALL'),
      });
    }
    if (availabilityStatusFilter !== 'ALL') {
      chips.push({
        id: 'bc-avail',
        category: 'QUICK',
        fieldLabel: 'Availability Status',
        operatorLabel: 'Equals',
        valueLabel: availabilityStatusFilter,
        onRemove: () => setAvailabilityStatusFilter('ALL'),
      });
    }
    if (approvalStatusFilter !== 'ALL') {
      chips.push({
        id: 'bc-appr',
        category: 'QUICK',
        fieldLabel: 'Approval Status',
        operatorLabel: 'Equals',
        valueLabel: approvalStatusFilter,
        onRemove: () => setApprovalStatusFilter('ALL'),
      });
    }
    if (createdDateRange.from || createdDateRange.to) {
      chips.push({
        id: 'bc-created',
        category: 'DATE_RANGE',
        fieldLabel: 'Created Date',
        operatorLabel: 'Between',
        valueLabel: `${createdDateRange.from || 'Start'} → ${createdDateRange.to || 'End'}`,
        onRemove: () => setCreatedDateRange({ from: '', to: '' }),
      });
    }
    if (modifiedDateRange.from || modifiedDateRange.to) {
      chips.push({
        id: 'bc-modified',
        category: 'DATE_RANGE',
        fieldLabel: 'Modified Date',
        operatorLabel: 'Between',
        valueLabel: `${modifiedDateRange.from || 'Start'} → ${modifiedDateRange.to || 'End'}`,
        onRemove: () => setModifiedDateRange({ from: '', to: '' }),
      });
    }

    const adv = buildAdvancedFilterChips(
      advancedFilterState,
      branchCatalogFilterFields,
      (groupId, conditionId) => {
        setAdvancedFilterState((prev) => ({
          ...prev,
          groups: prev.groups
            .map((g) =>
              g.id === groupId
                ? { ...g, conditions: g.conditions.filter((c) => c.id !== conditionId) }
                : g
            )
            .filter((g) => g.conditions.length > 0),
        }));
      }
    );

    return [...chips, ...adv];
  }, [
    categoryFilter,
    globalItemFilter,
    itemTypeFilter,
    materialFilter,
    materialFormFilter,
    availabilityStatusFilter,
    approvalStatusFilter,
    createdDateRange,
    modifiedDateRange,
    advancedFilterState,
    branchCatalogFilterFields,
  ]);

  // Filter Branch Items
  const branchItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    const quickFiltered = items.filter((item) => {
      const availStatus = getAvailabilityStatus(item);
      if (availabilityStatusFilter === 'ALL') {
        if (availStatus !== 'ACTIVE') return false;
      } else if (availStatus !== availabilityStatusFilter) {
        return false;
      }

      const catCode = getBranchCategoryCode(item);
      const iType = getItemType(item);
      const mat = getMaterial(item);
      const form = getMaterialForm(item);
      const createdStr = item.createdAt ? item.createdAt.slice(0, 10) : '';
      const modifiedStr = item.updatedAt
        ? item.updatedAt.slice(0, 10)
        : createdStr;

      if (categoryFilter !== 'ALL' && catCode !== categoryFilter) return false;
      if (globalItemFilter !== 'ALL' && item.globalItemCode !== globalItemFilter) return false;
      if (itemTypeFilter !== 'ALL' && iType !== itemTypeFilter) return false;
      if (materialFilter !== 'ALL' && mat !== materialFilter) return false;
      if (materialFormFilter !== 'ALL' && form !== materialFormFilter) return false;
      if (approvalStatusFilter !== 'ALL' && item.status !== approvalStatusFilter) return false;
      if (!matchesDateRange(createdStr, createdDateRange)) return false;
      if (!matchesDateRange(modifiedStr, modifiedDateRange)) return false;

      if (q) {
        const matchesCode = item.globalItemCode.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesCat = catCode.toLowerCase().includes(q);
        const matchesType = iType.toLowerCase().includes(q);
        const matchesMat = mat.toLowerCase().includes(q);
        if (!matchesCode && !matchesDesc && !matchesCat && !matchesType && !matchesMat) {
          return false;
        }
      }

      return true;
    });

    return evaluateAdvancedFilters(quickFiltered, advancedFilterState, branchCatalogFilterFields);
  }, [
    items,
    selectedBranch,
    branchClassifications,
    categoryFilter,
    globalItemFilter,
    itemTypeFilter,
    materialFilter,
    materialFormFilter,
    availabilityStatusFilter,
    approvalStatusFilter,
    createdDateRange,
    modifiedDateRange,
    searchTerm,
    advancedFilterState,
    branchCatalogFilterFields,
  ]);

  // Statistics
  const stats = useMemo(() => {
    let fg = 0;
    let rm = 0;
    let sf = 0;
    let other = 0;

    branchItems.forEach((item) => {
      const catCode = getBranchCategoryCode(item);
      if (catCode === 'FG') fg++;
      else if (catCode === 'RM') rm++;
      else if (catCode === 'SF') sf++;
      else other++;
    });

    return { total: branchItems.length, fg, rm, sf, other };
  }, [branchItems, branchClassifications, selectedBranch]);

  const sortComparators = useMemo(
    () => ({
      globalItemCode: (a: GlobalItem, b: GlobalItem) =>
        a.globalItemCode.localeCompare(b.globalItemCode),
      sapItemCode: (a: GlobalItem, b: GlobalItem) =>
        a.globalItemCode.localeCompare(b.globalItemCode),
      categoryCode: (a: GlobalItem, b: GlobalItem) =>
        getBranchCategoryCode(a).localeCompare(getBranchCategoryCode(b)),
      description: (a: GlobalItem, b: GlobalItem) =>
        a.description.localeCompare(b.description),
      itemType: (a: GlobalItem, b: GlobalItem) =>
        getItemType(a).localeCompare(getItemType(b)),
      material: (a: GlobalItem, b: GlobalItem) =>
        getMaterial(a).localeCompare(getMaterial(b)),
      materialForm: (a: GlobalItem, b: GlobalItem) =>
        getMaterialForm(a).localeCompare(getMaterialForm(b)),
      availabilityStatus: (a: GlobalItem, b: GlobalItem) =>
        getAvailabilityStatus(a).localeCompare(getAvailabilityStatus(b)),
      approvalStatus: (a: GlobalItem, b: GlobalItem) => a.status.localeCompare(b.status),
      createdAt: (a: GlobalItem, b: GlobalItem) => a.createdAt.localeCompare(b.createdAt),
      updatedAt: (a: GlobalItem, b: GlobalItem) =>
        (a.updatedAt || a.createdAt).localeCompare(b.updatedAt || b.createdAt),
    }),
    [selectedBranch, branchClassifications]
  );

  const {
    paginatedItems: paginatedBranchItems,
    sortedItems: sortedBranchItems,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalRecords,
    totalPages,
    pageSizeOptions,
    sortField,
    sortOrder,
    handleSort,
  } = useStandardDataGrid<GlobalItem, BranchCatalogSortField>({
    gridId: 'branch-catalog-v10',
    items: branchItems,
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc',
    comparators: sortComparators,
    getCreatedAt: (item) => item.createdAt,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedBranchId,
    searchTerm,
    categoryFilter,
    globalItemFilter,
    itemTypeFilter,
    materialFilter,
    materialFormFilter,
    availabilityStatusFilter,
    approvalStatusFilter,
    createdDateRange,
    modifiedDateRange,
    advancedFilterState,
    setCurrentPage,
  ]);

  const SortIcon = ({ field }: { field: BranchCatalogSortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-3 h-3 text-slate-400 inline ml-1" />;
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-600 inline ml-1" />
    );
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setExportNotice('Branch Created Items Catalog refreshed.');
      setTimeout(() => setExportNotice(null), 3000);
    }, 300);
  };

  // Multi-format Export Handler
  const handleExport = async (type: 'pdf' | 'excel' | 'word' | 'csv') => {
    setIsExportMenuOpen(false);
    setIsExporting(type);

    try {
      const targetItems =
        exportScope === 'CURRENT_PAGE' ? paginatedBranchItems : sortedBranchItems;
      const branchCode = (
        selectedBranch?.portalBranchCode ||
        selectedBranch?.code ||
        'branch'
      ).replace(/[^a-zA-Z0-9_-]/g, '_');
      const branchTitle = selectedBranch?.name || 'Branch Operations';
      const headers = [
        'Global Item Code',
        'Branch SAP Item Code',
        'Branch Category',
        'Description',
        'Item Type',
        'Material',
        'Material Form',
        'Availability Status',
        'Approval Status',
        'Created Date',
        'Modified Date',
      ];
      const rows = targetItems.map((item) => {
        const catCode = getBranchCategoryCode(item);
        const sapCode = `${catCode}-${item.globalItemCode}-${branchCode}`;
        return [
          item.globalItemCode,
          sapCode,
          catCode,
          item.description,
          getItemType(item),
          getMaterial(item),
          getMaterialForm(item),
          getAvailabilityStatus(item),
          item.status,
          item.createdAt ? item.createdAt.slice(0, 10) : '—',
          item.updatedAt ? item.updatedAt.slice(0, 10) : item.createdAt.slice(0, 10),
        ];
      });

      const res = await executeScopedExport({
        title: `Branch Created Items Catalog — ${branchTitle} [${branchCode}]`,
        subtitle: `Exported on ${new Date().toLocaleDateString()} • Total Records: ${targetItems.length}`,
        headers,
        rows,
        filenamePrefix: `KOSH_Branch_Items_${branchCode}`,
        format: type,
        exportScope,
      });
      setExportNotice(res.message);
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err: any) {
      setExportNotice(`Export Failed: ${err?.message || 'Unexpected error'}`);
      setTimeout(() => setExportNotice(null), 5000);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-3 text-xs w-full min-w-0 max-w-full">
      {/* PR-Aligned Page Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold mb-0.5">
            <span>Item Master Governance</span>
            <span>/</span>
            <span className="text-indigo-600 font-bold">Branch Created Items Catalog</span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Box className="w-5 h-5 text-indigo-600" />
            <span>Branch Created Items Catalog</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              [{selectedBranch.portalBranchCode}] {selectedBranch.name}
            </span>
          </h2>
          <p className="text-slate-500 mt-0.5 text-[11px]">
            Branch-scoped catalog of activated Global Items with branch-specific operational Categories, SAP codes, and availability controls.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('HEADER')}
              className={`px-3 py-1 rounded-md font-bold text-xs transition cursor-pointer ${
                viewMode === 'HEADER'
                  ? 'bg-white text-indigo-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Header View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LINE')}
              className={`px-3 py-1 rounded-md font-bold text-xs transition cursor-pointer ${
                viewMode === 'LINE'
                  ? 'bg-white text-indigo-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Line / Live View
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <div className="relative">
            <button
              type="button"
              disabled={isExporting !== null}
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Export</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50">
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Export Scope
                  </div>
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setExportScope('CURRENT_PAGE')}
                      className={`py-1 rounded text-[10px] font-bold cursor-pointer ${
                        exportScope === 'CURRENT_PAGE'
                          ? 'bg-white text-indigo-900 shadow-2xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Current Page ({paginatedBranchItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportScope('ALL_FILTERED')}
                      className={`py-1 rounded text-[10px] font-bold cursor-pointer ${
                        exportScope === 'ALL_FILTERED'
                          ? 'bg-white text-indigo-900 shadow-2xs'
                          : 'text-slate-600'
                      }`}
                    >
                      All Filtered ({sortedBranchItems.length})
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleExport('pdf')}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-700 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-500" /> Export PDF Report
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('excel')}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-700 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-700 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-600" /> Export CSV (.csv)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {exportNotice && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>{exportNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="text-indigo-600 hover:text-indigo-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Branch Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 font-semibold">
        {allBranches.map((br) => (
          <button
            key={br.id}
            type="button"
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

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-slate-500 font-medium">Total Branch Items</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 shadow-xs">
          <div className="text-emerald-800 font-medium">Finished Goods (FG)</div>
          <div className="text-xl font-bold text-emerald-900 mt-1">{stats.fg}</div>
        </div>
        <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 shadow-xs">
          <div className="text-blue-800 font-medium">Raw Materials (RM)</div>
          <div className="text-xl font-bold text-blue-900 mt-1">{stats.rm}</div>
        </div>
        <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 shadow-xs">
          <div className="text-amber-800 font-medium">Semi-Finished (SF)</div>
          <div className="text-xl font-bold text-amber-900 mt-1">{stats.sf}</div>
        </div>
        <div className="bg-purple-50/60 p-3.5 rounded-xl border border-purple-200 shadow-xs">
          <div className="text-purple-800 font-medium">Spares / Packaging</div>
          <div className="text-xl font-bold text-purple-900 mt-1">{stats.other}</div>
        </div>
      </div>

      {/* Register Controls & Advanced Filter Engine Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              aria-label="Search Branch Created Items"
              placeholder="Search Global Item Code, SAP Code, Description, Material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <AdvancedFilterToggleButton
              isOpen={advancedFilterOpen}
              onToggle={() => {
                if (
                  !advancedFilterOpen &&
                  advancedFilterState.groups.length === 0 &&
                  branchCatalogFilterFields.length > 0
                ) {
                  setAdvancedFilterState({
                    groupLogicalOperator: 'AND',
                    groups: [createEmptyGroup(branchCatalogFilterFields[0], 1)],
                  });
                }
                setAdvancedFilterOpen((prev) => !prev);
              }}
              activeCount={totalActiveFilterCount}
            />

            {totalActiveFilterCount > 0 && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Filters ({totalActiveFilterCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Filters Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <select
            aria-label="Filter by Branch"
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
          >
            {allBranches.map((b) => (
              <option key={b.id} value={b.id}>
                [{b.portalBranchCode}] {b.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Global Item"
            value={globalItemFilter}
            onChange={(e) => setGlobalItemFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
          >
            <option value="ALL">All Global Items</option>
            {items.map((i) => (
              <option key={i.id} value={i.globalItemCode}>
                {i.globalItemCode}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Branch Category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
          >
            <option value="ALL">All Branch Categories</option>
            <option value="FG">FG — Finished Goods</option>
            <option value="RM">RM — Raw Materials</option>
            <option value="SF">SF — Semi-Finished</option>
            <option value="PK">PK — Packaging</option>
            <option value="CO">CO — Consumables</option>
            <option value="MA">MA — Spares</option>
          </select>

          <select
            aria-label="Filter by Item Type"
            value={itemTypeFilter}
            onChange={(e) => setItemTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
          >
            <option value="ALL">All Item Types</option>
            {distinctOptions.itemTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Material"
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
          >
            <option value="ALL">All Materials</option>
            {distinctOptions.materials.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Material Form"
            value={materialFormFilter}
            onChange={(e) => setMaterialFormFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
          >
            <option value="ALL">All Material Forms</option>
            {distinctOptions.materialForms.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Availability Status"
            value={availabilityStatusFilter}
            onChange={(e) => setAvailabilityStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
          >
            <option value="ALL">Active in Branch</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          <select
            aria-label="Filter by Approval Status"
            value={approvalStatusFilter}
            onChange={(e) => setApprovalStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
          >
            <option value="ALL">All Approval Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="DRAFT">Draft</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        {/* Date Ranges Row: Created Date Range & Modified Date Range */}
        <div className="flex flex-wrap items-start gap-2.5 pt-1">
          <DateRangeFilterControl
            label="Created Date"
            range={createdDateRange}
            onChange={setCreatedDateRange}
            compact
          />
          <DateRangeFilterControl
            label="Modified Date"
            range={modifiedDateRange}
            onChange={setModifiedDateRange}
            compact
          />
        </div>

        {/* Expandable Advanced Filter Engine Panel */}
        <AdvancedFilterPanel
          moduleKey="BRANCH_CREATED_ITEMS_LIST"
          userId="usr-admin-01"
          fields={branchCatalogFilterFields}
          filterState={advancedFilterState}
          onChangeFilterState={setAdvancedFilterState}
          quickFiltersSnapshot={{
            selectedBranchId,
            categoryFilter,
            globalItemFilter,
            itemTypeFilter,
            materialFilter,
            materialFormFilter,
            availabilityStatusFilter,
            approvalStatusFilter,
            createdDateRange,
            modifiedDateRange,
          }}
          onApplyQuickFiltersSnapshot={(snap) => {
            if (snap.selectedBranchId !== undefined) setSelectedBranchId(snap.selectedBranchId);
            if (snap.categoryFilter !== undefined) setCategoryFilter(snap.categoryFilter);
            if (snap.globalItemFilter !== undefined) setGlobalItemFilter(snap.globalItemFilter);
            if (snap.itemTypeFilter !== undefined) setItemTypeFilter(snap.itemTypeFilter);
            if (snap.materialFilter !== undefined) setMaterialFilter(snap.materialFilter);
            if (snap.materialFormFilter !== undefined)
              setMaterialFormFilter(snap.materialFormFilter);
            if (snap.availabilityStatusFilter !== undefined)
              setAvailabilityStatusFilter(snap.availabilityStatusFilter);
            if (snap.approvalStatusFilter !== undefined)
              setApprovalStatusFilter(snap.approvalStatusFilter);
            if (snap.createdDateRange !== undefined) setCreatedDateRange(snap.createdDateRange);
            if (snap.modifiedDateRange !== undefined)
              setModifiedDateRange(snap.modifiedDateRange);
          }}
          onResetAllFilters={handleClearAllFilters}
          isOpen={advancedFilterOpen}
          onToggleOpen={() => setAdvancedFilterOpen((prev) => !prev)}
          extraActiveFilterCount={activeQuickFilterCount}
        />

        {/* Active Filter Chips Bar */}
        <ActiveFilterChipsBar
          chips={activeFilterChips}
          onClearAll={handleClearAllFilters}
          totalFilteredCount={branchItems.length}
          totalUnfilteredCount={items.length}
          entityPluralLabel="Branch Items"
        />
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider select-none">
                <th
                  onClick={() => handleSort('globalItemCode')}
                  className="p-3 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Global Item Code <SortIcon field="globalItemCode" />
                </th>
                <th
                  onClick={() => handleSort('sapItemCode')}
                  className="p-3 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Branch SAP Code <SortIcon field="sapItemCode" />
                </th>
                <th
                  onClick={() => handleSort('categoryCode')}
                  className="p-3 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Branch Category <SortIcon field="categoryCode" />
                </th>
                <th
                  onClick={() => handleSort('description')}
                  className="p-3 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Description <SortIcon field="description" />
                </th>
                <th
                  onClick={() => handleSort('itemType')}
                  className="p-3 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Item Type <SortIcon field="itemType" />
                </th>
                <th
                  onClick={() => handleSort('material')}
                  className="p-3 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Material <SortIcon field="material" />
                </th>
                <th
                  onClick={() => handleSort('materialForm')}
                  className="p-3 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Material Form <SortIcon field="materialForm" />
                </th>
                <th
                  onClick={() => handleSort('availabilityStatus')}
                  className="p-3 text-center cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Availability <SortIcon field="availabilityStatus" />
                </th>
                <th
                  onClick={() => handleSort('approvalStatus')}
                  className="p-3 text-center cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Approval Status <SortIcon field="approvalStatus" />
                </th>
                <th
                  onClick={() => handleSort('createdAt')}
                  className="p-3 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                >
                  Created Date <SortIcon field="createdAt" />
                </th>
                <th className="p-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedBranchItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    No active items found for {selectedBranch.name} matching your filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedBranchItems.map((item) => {
                  const catCode = getBranchCategoryCode(item);
                  const sapCode = `${catCode}-${item.globalItemCode}-${selectedBranch.portalBranchCode}`;
                  const availStatus = getAvailabilityStatus(item);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                        {item.globalItemCode}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                        {sapCode}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-200">
                          {catCode}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-800 max-w-xs truncate">
                        {item.description}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-semibold">
                          {getItemType(item)}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-semibold">
                          {getMaterial(item)}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 text-[10px] font-semibold">
                          {getMaterialForm(item)}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            availStatus === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {availStatus}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'SUBMITTED'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {item.createdAt ? item.createdAt.slice(0, 10) : '—'}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setInspectedItem(item)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <DataGridFooter
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalRecords={totalRecords}
          pageSizeOptions={pageSizeOptions}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          defaultSortNotice="Default Sort: Created Date (Newest First)"
        />
      </div>

      {/* Quick Branch Item Inspector Modal */}
      {inspectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#0B192C] text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  Branch Catalog Item — [{inspectedItem.globalItemCode}]
                </h3>
                <p className="text-[11px] text-slate-300">
                  Branch: [{selectedBranch.portalBranchCode}] {selectedBranch.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedItem(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-[10px] font-bold uppercase text-slate-400">Description</div>
                <div className="font-bold text-slate-900">{inspectedItem.description}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    Branch Category
                  </div>
                  <div className="font-bold text-indigo-700 mt-0.5">
                    {getBranchCategoryCode(inspectedItem)}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    Approval Status
                  </div>
                  <div className="font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {inspectedItem.status}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    setInspectedItem(null);
                    onNavigate('/items/branch-availability');
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs cursor-pointer"
                >
                  Configure in Branch Availability
                </button>
              )}
              <button
                type="button"
                onClick={() => setInspectedItem(null)}
                className="px-3 py-1.5 bg-slate-800 text-white rounded-lg font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
