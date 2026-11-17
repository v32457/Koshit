/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PHASE 10 — PURCHASE REQUISITION-ALIGNED GLOBAL ITEM MASTER LIST VIEW
 * - Strictly enforces NO Category column (Category belongs exclusively to Branch Item Availability).
 * - Renders the exact 12 required columns in order:
 *   1. Global Item Code
 *   2. Description
 *   3. Item Type
 *   4. Material
 *   5. Material Form
 *   6. Purchase UOM
 *   7. Inventory UOM
 *   8. Global Status
 *   9. Branch Availability Count
 *   10. Approval Status
 *   11. Created Date
 *   12. Actions (View, Edit, Branch Availability, Audit, Rule, Approval)
 * - Integrates the reusable Advanced Filter Engine + Saved Filter Presets + Active Filter Chips.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { GlobalItem, Branch, BranchItemClassification, User } from '../../types';
import {
  Boxes,
  Search,
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
  AlertTriangle,
  X,
  FileText,
  Sparkles,
  SlidersHorizontal,
  MapPin,
  Save,
  RefreshCw,
  Edit3,
  ShieldCheck,
  Code2,
  CheckSquare,
  Layers,
} from 'lucide-react';
import {
  INITIAL_ITEM_CODE_RULES,
  INITIAL_DESCRIPTION_RULES,
  CLASSIFICATION_DIMENSIONS,
  INITIAL_BRANCH_ITEM_CLASSIFICATIONS,
} from '../../data/seedData';
import { generateItemCode } from '../../services/itemCodeEngine';
import { generateItemDescription } from '../../services/itemDescriptionEngine';
import { evaluateGlobalItemCreationAudit, GlobalAuditReport } from '../../services/itemRuleAndAuditService';
import { ContextIndicatorBar } from '../../components/ContextIndicatorBar';
import { OperatingContext } from '../../services/operatingContextService';
import { ExportDropdown } from '../../components/ExportDropdown';
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

interface ItemMasterListViewProps {
  items: GlobalItem[];
  allBranches: Branch[];
  currentUser?: User;
  operatingContext?: OperatingContext;
  onNavigateNew: () => void;
  onNavigateCustomSpecs?: () => void;
  onNavigate?: (route: string) => void;
  onUpdateItems?: (items: GlobalItem[]) => void;
  onImportItems?: (newItems: GlobalItem[]) => void;
}

type SortField =
  | 'globalItemCode'
  | 'description'
  | 'itemType'
  | 'material'
  | 'materialForm'
  | 'purchaseUom'
  | 'inventoryUom'
  | 'globalStatus'
  | 'branchCount'
  | 'approvalStatus'
  | 'createdAt';

// Helper functions to resolve Item Type, Material, Material Form, Purchase UOM, Inventory UOM from GlobalItem
function getItemDimensionLabel(
  dimKey: string,
  codeOrVal: unknown
): string {
  const raw = String(codeOrVal ?? '').trim();
  if (!raw) return '—';
  const dim = (CLASSIFICATION_DIMENSIONS as Record<string, any>)[dimKey] || Object.values(CLASSIFICATION_DIMENSIONS).find((d: any) => d.key === dimKey || d.id === dimKey);
  if (!dim) return raw;
  const found = (dim.values || []).find(
    (v: any) => v.code.toLowerCase() === raw.toLowerCase() || v.label.toLowerCase() === raw.toLowerCase()
  );
  return found ? `${found.code} (${found.label})` : raw;
}

function resolveItemType(item: GlobalItem): string {
  const attrs = item.attributes || {};
  const raw =
    attrs.ITEM_TYPE ||
    attrs.itemType ||
    attrs.type ||
    (item.globalItemCode.includes('-RAW-')
      ? 'RAW'
      : item.globalItemCode.includes('-FIN-')
        ? 'FIN'
        : item.globalItemCode.includes('-SEMI-')
          ? 'SEMI'
          : item.globalItemCode.includes('-CON-')
            ? 'CON'
            : 'RAW');
  return getItemDimensionLabel('ITEM_TYPE', raw);
}

function resolveMaterial(item: GlobalItem): string {
  const attrs = item.attributes || {};
  const raw =
    attrs.MATERIAL ||
    attrs.material ||
    (item.globalItemCode.startsWith('STL-')
      ? 'STL'
      : item.globalItemCode.startsWith('ALU-')
        ? 'ALU'
        : item.globalItemCode.startsWith('COP-')
          ? 'COP'
          : item.globalItemCode.startsWith('PLS-')
            ? 'PLS'
            : item.globalItemCode.startsWith('RUB-')
              ? 'RUB'
              : 'STL');
  return getItemDimensionLabel('MATERIAL', raw);
}

function resolveMaterialForm(item: GlobalItem): string {
  const attrs = item.attributes || {};
  const raw =
    attrs.FORM ||
    attrs.MATERIAL_FORM ||
    attrs.materialForm ||
    attrs.form ||
    (item.globalItemCode.includes('-SHT-')
      ? 'SHT'
      : item.globalItemCode.includes('-ROD-')
        ? 'ROD'
        : item.globalItemCode.includes('-TUB-')
          ? 'TUB'
          : item.globalItemCode.includes('-bar-') || item.globalItemCode.includes('-BAR-')
            ? 'BAR'
            : item.globalItemCode.includes('-WIR-')
              ? 'WIR'
              : 'SHT');
  return getItemDimensionLabel('FORM', raw);
}

function resolvePurchaseUom(item: GlobalItem): string {
  const attrs = item.attributes || {};
  return String(
    item.defaultPurchaseUom ||
      attrs.defaultPurchaseUom ||
      attrs.purchaseUom ||
      attrs.uom ||
      'KG'
  )
    .trim()
    .toUpperCase();
}

function resolveInventoryUom(item: GlobalItem): string {
  const attrs = item.attributes || {};
  return String(
    item.defaultInventoryUom ||
      attrs.defaultInventoryUom ||
      attrs.inventoryUom ||
      attrs.baseUom ||
      resolvePurchaseUom(item)
  )
    .trim()
    .toUpperCase();
}

function resolveGlobalStatus(item: GlobalItem): 'ACTIVE' | 'PROVISIONAL' | 'INACTIVE' {
  if (item.status === 'REJECTED') return 'INACTIVE';
  if (item.status === 'APPROVED' && !item.isProvisionalCode) return 'ACTIVE';
  return 'PROVISIONAL';
}

function resolveBranchAvailabilityCount(item: GlobalItem, allBranches: Branch[]): number {
  return allBranches.filter((b) => isItemAvailableInBranch(item, b)).length;
}

export const ItemMasterListView: React.FC<ItemMasterListViewProps> = ({
  items,
  allBranches,
  currentUser,
  operatingContext,
  onNavigateNew,
  onNavigateCustomSpecs,
  onNavigate,
  onUpdateItems,
  onImportItems,
}) => {
  const userId = currentUser?.id || 'usr-admin-01';

  // Search & Quick Filter State (NO Category filter)
  const [searchTerm, setSearchTerm] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState('ALL');
  const [materialFilter, setMaterialFilter] = useState('ALL');
  const [materialFormFilter, setMaterialFormFilter] = useState('ALL');
  const [globalStatusFilter, setGlobalStatusFilter] = useState('ALL');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState('ALL');
  const [createdDateRange, setCreatedDateRange] = useState<DateRangeFilterValue>({
    from: '',
    to: '',
  });

  // Advanced Filter Engine State
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [advancedFilterState, setAdvancedFilterState] = useState<AdvancedFilterState>(() =>
    createInitialAdvancedFilterState()
  );

  // Inspector & Action Modals State
  const [selectedItem, setSelectedItem] = useState<GlobalItem | null>(null);
  const [inspectorTab, setInspectorTab] = useState<
    'overview' | 'edit' | 'classifications' | 'audit' | 'rule' | 'approval'
  >('overview');
  const [editDescription, setEditDescription] = useState('');
  const [editPurchaseUom, setEditPurchaseUom] = useState('KG');
  const [editInventoryUom, setEditInventoryUom] = useState('KG');
  const [auditReport, setAuditReport] = useState<GlobalAuditReport | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const [branchClassifications, setBranchClassifications] = useState<BranchItemClassification[]>(
    () => {
      try {
        const saved = localStorage.getItem('kosh_branch_classifications');
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
      return INITIAL_BRANCH_ITEM_CLASSIFICATIONS;
    }
  );
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => {
      setActionToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Distinct dropdown options for quick filters and advanced filters
  const distinctOptions = useMemo(() => {
    const itemTypes = new Set<string>();
    const materials = new Set<string>();
    const materialForms = new Set<string>();
    const purchaseUoms = new Set<string>();
    const inventoryUoms = new Set<string>();

    items.forEach((item) => {
      itemTypes.add(resolveItemType(item));
      materials.add(resolveMaterial(item));
      materialForms.add(resolveMaterialForm(item));
      purchaseUoms.add(resolvePurchaseUom(item));
      inventoryUoms.add(resolveInventoryUom(item));
    });

    return {
      itemTypes: Array.from(itemTypes).sort(),
      materials: Array.from(materials).sort(),
      materialForms: Array.from(materialForms).sort(),
      purchaseUoms: Array.from(purchaseUoms).sort(),
      inventoryUoms: Array.from(inventoryUoms).sort(),
    };
  }, [items]);

  // 11-Field Global Item Master Advanced Filter Catalogue (NO Category field)
  const itemMasterFilterFields: FilterFieldDefinition<GlobalItem>[] = useMemo(
    () => [
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
        accessor: (item) => resolveItemType(item),
      },
      {
        key: 'material',
        label: 'Material',
        type: 'DROPDOWN',
        options: distinctOptions.materials.map((v) => ({ value: v, label: v })),
        accessor: (item) => resolveMaterial(item),
      },
      {
        key: 'materialForm',
        label: 'Material Form',
        type: 'DROPDOWN',
        options: distinctOptions.materialForms.map((v) => ({ value: v, label: v })),
        accessor: (item) => resolveMaterialForm(item),
      },
      {
        key: 'purchaseUom',
        label: 'Purchase UOM',
        type: 'DROPDOWN',
        options: distinctOptions.purchaseUoms.map((v) => ({ value: v, label: v })),
        accessor: (item) => resolvePurchaseUom(item),
      },
      {
        key: 'inventoryUom',
        label: 'Inventory UOM',
        type: 'DROPDOWN',
        options: distinctOptions.inventoryUoms.map((v) => ({ value: v, label: v })),
        accessor: (item) => resolveInventoryUom(item),
      },
      {
        key: 'globalStatus',
        label: 'Global Status',
        type: 'DROPDOWN',
        options: [
          { value: 'ACTIVE', label: 'ACTIVE' },
          { value: 'PROVISIONAL', label: 'PROVISIONAL' },
          { value: 'INACTIVE', label: 'INACTIVE' },
        ],
        accessor: (item) => resolveGlobalStatus(item),
      },
      {
        key: 'branchAvailabilityCount',
        label: 'Branch Availability Count',
        type: 'NUMBER',
        accessor: (item) => resolveBranchAvailabilityCount(item, allBranches),
      },
      {
        key: 'approvalStatus',
        label: 'Approval Status',
        type: 'DROPDOWN',
        options: [
          { value: 'APPROVED', label: 'APPROVED' },
          { value: 'SUBMITTED', label: 'SUBMITTED' },
          { value: 'DRAFT', label: 'DRAFT' },
          { value: 'RETURNED_FOR_CORRECTION', label: 'RETURNED_FOR_CORRECTION' },
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
    ],
    [distinctOptions, allBranches]
  );

  const activeAdvancedCount = useMemo(
    () => countActiveAdvancedConditions(advancedFilterState, itemMasterFilterFields),
    [advancedFilterState, itemMasterFilterFields]
  );

  const activeQuickFilterCount = useMemo(() => {
    let c = 0;
    if (itemTypeFilter !== 'ALL') c += 1;
    if (materialFilter !== 'ALL') c += 1;
    if (materialFormFilter !== 'ALL') c += 1;
    if (globalStatusFilter !== 'ALL') c += 1;
    if (approvalStatusFilter !== 'ALL') c += 1;
    if (createdDateRange.from || createdDateRange.to) c += 1;
    return c;
  }, [
    itemTypeFilter,
    materialFilter,
    materialFormFilter,
    globalStatusFilter,
    approvalStatusFilter,
    createdDateRange,
  ]);

  const totalActiveFilterCount = activeQuickFilterCount + activeAdvancedCount;

  const handleResetFilters = () => {
    setSearchTerm('');
    setItemTypeFilter('ALL');
    setMaterialFilter('ALL');
    setMaterialFormFilter('ALL');
    setGlobalStatusFilter('ALL');
    setApprovalStatusFilter('ALL');
    setCreatedDateRange({ from: '', to: '' });
    setAdvancedFilterState(createInitialAdvancedFilterState());
  };

  // Active Filter Chips
  const activeFilterChips: ActiveFilterChip[] = useMemo(() => {
    const chips: ActiveFilterChip[] = [];

    if (itemTypeFilter !== 'ALL') {
      chips.push({
        id: 'q-itemType',
        category: 'QUICK',
        fieldLabel: 'Item Type',
        operatorLabel: 'Equals',
        valueLabel: itemTypeFilter,
        onRemove: () => setItemTypeFilter('ALL'),
      });
    }
    if (materialFilter !== 'ALL') {
      chips.push({
        id: 'q-material',
        category: 'QUICK',
        fieldLabel: 'Material',
        operatorLabel: 'Equals',
        valueLabel: materialFilter,
        onRemove: () => setMaterialFilter('ALL'),
      });
    }
    if (materialFormFilter !== 'ALL') {
      chips.push({
        id: 'q-materialForm',
        category: 'QUICK',
        fieldLabel: 'Material Form',
        operatorLabel: 'Equals',
        valueLabel: materialFormFilter,
        onRemove: () => setMaterialFormFilter('ALL'),
      });
    }
    if (globalStatusFilter !== 'ALL') {
      chips.push({
        id: 'q-globalStatus',
        category: 'QUICK',
        fieldLabel: 'Global Status',
        operatorLabel: 'Equals',
        valueLabel: globalStatusFilter,
        onRemove: () => setGlobalStatusFilter('ALL'),
      });
    }
    if (approvalStatusFilter !== 'ALL') {
      chips.push({
        id: 'q-approvalStatus',
        category: 'QUICK',
        fieldLabel: 'Approval Status',
        operatorLabel: 'Equals',
        valueLabel: approvalStatusFilter,
        onRemove: () => setApprovalStatusFilter('ALL'),
      });
    }
    if (createdDateRange.from || createdDateRange.to) {
      chips.push({
        id: 'q-createdDateRange',
        category: 'DATE_RANGE',
        fieldLabel: 'Created Date',
        operatorLabel: 'Between',
        valueLabel: `${createdDateRange.from || 'Start'} → ${createdDateRange.to || 'End'}`,
        onRemove: () => setCreatedDateRange({ from: '', to: '' }),
      });
    }

    const adv = buildAdvancedFilterChips(
      advancedFilterState,
      itemMasterFilterFields,
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
    itemTypeFilter,
    materialFilter,
    materialFormFilter,
    globalStatusFilter,
    approvalStatusFilter,
    createdDateRange,
    advancedFilterState,
    itemMasterFilterFields,
  ]);

  // Filter & Search Logic
  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    const quickFiltered = items.filter((item) => {
      const iType = resolveItemType(item);
      const mat = resolveMaterial(item);
      const form = resolveMaterialForm(item);
      const pUom = resolvePurchaseUom(item);
      const invUom = resolveInventoryUom(item);
      const gStatus = resolveGlobalStatus(item);
      const createdDateStr = item.createdAt ? item.createdAt.slice(0, 10) : '';

      if (q) {
        const matchesCode = item.globalItemCode.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesType = iType.toLowerCase().includes(q);
        const matchesMat = mat.toLowerCase().includes(q);
        const matchesForm = form.toLowerCase().includes(q);
        const matchesUom =
          pUom.toLowerCase().includes(q) || invUom.toLowerCase().includes(q);
        const matchesAttr = Object.values(item.attributes || {}).some(
          (val) => typeof val === 'string' && val.toLowerCase().includes(q)
        );
        if (
          !matchesCode &&
          !matchesDesc &&
          !matchesType &&
          !matchesMat &&
          !matchesForm &&
          !matchesUom &&
          !matchesAttr
        ) {
          return false;
        }
      }

      if (itemTypeFilter !== 'ALL' && iType !== itemTypeFilter) return false;
      if (materialFilter !== 'ALL' && mat !== materialFilter) return false;
      if (materialFormFilter !== 'ALL' && form !== materialFormFilter) return false;
      if (globalStatusFilter !== 'ALL' && gStatus !== globalStatusFilter) return false;
      if (approvalStatusFilter !== 'ALL' && item.status !== approvalStatusFilter) return false;
      if (!matchesDateRange(createdDateStr, createdDateRange)) return false;

      return true;
    });

    return evaluateAdvancedFilters(quickFiltered, advancedFilterState, itemMasterFilterFields);
  }, [
    items,
    searchTerm,
    itemTypeFilter,
    materialFilter,
    materialFormFilter,
    globalStatusFilter,
    approvalStatusFilter,
    createdDateRange,
    advancedFilterState,
    itemMasterFilterFields,
  ]);

  const sortComparators = useMemo(
    () => ({
      globalItemCode: (a: GlobalItem, b: GlobalItem) =>
        a.globalItemCode.localeCompare(b.globalItemCode),
      description: (a: GlobalItem, b: GlobalItem) =>
        a.description.localeCompare(b.description),
      itemType: (a: GlobalItem, b: GlobalItem) =>
        resolveItemType(a).localeCompare(resolveItemType(b)),
      material: (a: GlobalItem, b: GlobalItem) =>
        resolveMaterial(a).localeCompare(resolveMaterial(b)),
      materialForm: (a: GlobalItem, b: GlobalItem) =>
        resolveMaterialForm(a).localeCompare(resolveMaterialForm(b)),
      purchaseUom: (a: GlobalItem, b: GlobalItem) =>
        resolvePurchaseUom(a).localeCompare(resolvePurchaseUom(b)),
      inventoryUom: (a: GlobalItem, b: GlobalItem) =>
        resolveInventoryUom(a).localeCompare(resolveInventoryUom(b)),
      globalStatus: (a: GlobalItem, b: GlobalItem) =>
        resolveGlobalStatus(a).localeCompare(resolveGlobalStatus(b)),
      branchCount: (a: GlobalItem, b: GlobalItem) =>
        resolveBranchAvailabilityCount(a, allBranches) -
        resolveBranchAvailabilityCount(b, allBranches),
      approvalStatus: (a: GlobalItem, b: GlobalItem) => a.status.localeCompare(b.status),
      createdAt: (a: GlobalItem, b: GlobalItem) => a.createdAt.localeCompare(b.createdAt),
    }),
    [allBranches]
  );

  const {
    paginatedItems,
    totalRecords,
    currentPage,
    pageSize,
    totalPages,
    sortField,
    sortOrder,
    handleSort,
    setCurrentPage,
    setPageSize,
    pageSizeOptions,
  } = useStandardDataGrid<GlobalItem, SortField>({
    gridId: 'global-item-master-list-v10',
    userId,
    items: filteredItems,
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc',
    comparators: sortComparators,
    getCreatedAt: (item) => item.createdAt,
  });

  // Reset pagination to Page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    itemTypeFilter,
    materialFilter,
    materialFormFilter,
    globalStatusFilter,
    approvalStatusFilter,
    createdDateRange,
    advancedFilterState,
    setCurrentPage,
  ]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-3 h-3 text-slate-400 inline ml-1" />;
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-600 inline ml-1" />
    );
  };

  // Row Actions Handler (View, Edit, Branch Availability, Audit, Rule, Approval)
  const handleRowAction = (
    item: GlobalItem,
    action: 'VIEW' | 'EDIT' | 'BRANCH_AVAILABILITY' | 'AUDIT' | 'RULE' | 'APPROVAL'
  ) => {
    setSelectedItem(item);
    setEditDescription(item.description);
    setEditPurchaseUom(resolvePurchaseUom(item));
    setEditInventoryUom(resolveInventoryUom(item));

    // Evaluate 14-checkpoint Global Item Creation Audit for this item
    const report = evaluateGlobalItemCreationAudit(
      {
        entityId: item.id,
        globalItemCode: item.globalItemCode,
        description: item.description,
        attributes: {
          ...item.attributes,
          MATERIAL: item.attributes?.MATERIAL || resolveMaterial(item).split(' ')[0],
          ITEM_TYPE: item.attributes?.ITEM_TYPE || resolveItemType(item).split(' ')[0],
          FORM: item.attributes?.FORM || resolveMaterialForm(item).split(' ')[0],
          SPECIFICATION: item.attributes?.SPECIFICATION || item.description,
          DIMENSIONS: item.attributes?.DIMENSIONS || 'STD',
        },
        defaultPurchaseUom: resolvePurchaseUom(item),
        defaultInventoryUom: resolveInventoryUom(item),
        conversionFactor: item.conversionFactor ?? 1,
        conversionNumerator: item.conversionNumerator ?? 1,
        conversionDenominator: item.conversionDenominator ?? 1,
        conversionPrecision: item.conversionPrecision ?? 4,
        roundingRule: item.roundingRule || 'HALF_UP',
        codeRuleVersion: item.codeRuleVersion || 1,
        descRuleVersion: item.descRuleVersion || 1,
      },
      items.filter((i) => i.id !== item.id),
      currentUser?.fullName || 'Global Auditor'
    );
    setAuditReport(report);

    switch (action) {
      case 'VIEW':
        setInspectorTab('overview');
        break;
      case 'EDIT':
        setInspectorTab('edit');
        break;
      case 'BRANCH_AVAILABILITY':
        setInspectorTab('classifications');
        break;
      case 'AUDIT':
        setInspectorTab('audit');
        break;
      case 'RULE':
        setInspectorTab('rule');
        break;
      case 'APPROVAL':
        setInspectorTab('approval');
        break;
    }
  };

  const handleSaveItemEdits = () => {
    if (!selectedItem) return;
    const updatedItem: GlobalItem = {
      ...selectedItem,
      description: editDescription.trim() || selectedItem.description,
      defaultPurchaseUom: editPurchaseUom,
      defaultInventoryUom: editInventoryUom,
      updatedAt: new Date().toISOString(),
    };
    setSelectedItem(updatedItem);
    const nextList = items.map((i) => (i.id === updatedItem.id ? updatedItem : i));
    if (onUpdateItems) {
      onUpdateItems(nextList);
    }
    try {
      localStorage.setItem('kosh_global_items', JSON.stringify(nextList));
    } catch {
      // ignore
    }
    triggerToast(`Updated Global Item [${updatedItem.globalItemCode}].`);
    setInspectorTab('overview');
  };

  // Export Headers & Rows (Matches Exact 11 Data Columns — No Category Column)
  const exportHeaders = [
    'Global Item Code',
    'Description',
    'Item Type',
    'Material',
    'Material Form',
    'Purchase UOM',
    'Inventory UOM',
    'Global Status',
    'Branch Availability Count',
    'Approval Status',
    'Created Date',
  ];

  const getExportRows = (dataset: GlobalItem[]) =>
    dataset.map((item) => [
      item.globalItemCode,
      item.description,
      resolveItemType(item),
      resolveMaterial(item),
      resolveMaterialForm(item),
      resolvePurchaseUom(item),
      resolveInventoryUom(item),
      resolveGlobalStatus(item),
      resolveBranchAvailabilityCount(item, allBranches),
      item.status,
      item.createdAt ? item.createdAt.slice(0, 10) : '—',
    ]);

  const exportRows = useMemo(() => getExportRows(filteredItems), [filteredItems, allBranches]);
  const currentPageExportRows = useMemo(
    () => getExportRows(paginatedItems),
    [paginatedItems, allBranches]
  );

  // Sample CSV Template Generator for Bulk Import (Global Attributes Only — No Category)
  const handleLoadSampleCsv = () => {
    const sample = `MATERIAL,ITEM_TYPE,FORM,PROCESS,COLOUR,SPECIFICATION,DIMENSIONS,PURCHASE_UOM,INVENTORY_UOM
STL,RAW,SHT,CNC,SLV,SS316L Surgical Grade Sheet,2000x1000x3mm,KG,KG
ALU,SEMI,EXT,ANO,BLK,6063-T5 Extruded Heatsink Profile,3000x120x45mm,MTR,MTR
COP,RAW,WIR,DRW,GLD,Electrolytic ETP Copper Winding Wire,SWG-18,KG,KG`;
    setBulkCsvText(sample);
  };

  const handleProcessBulkImport = () => {
    if (!bulkCsvText.trim()) return;
    const lines = bulkCsvText.trim().split('\n');
    if (lines.length < 2) {
      setImportNotice('Error: CSV must contain a header row and at least one item row.');
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toUpperCase());
    const newItems: GlobalItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      if (cols.length < 2) continue;

      const rowMap: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowMap[h] = cols[idx] || '';
      });

      const attributes: Record<string, string> = {
        MATERIAL: rowMap['MATERIAL'] || 'STL',
        ITEM_TYPE: rowMap['ITEM_TYPE'] || 'RAW',
        FORM: rowMap['FORM'] || 'SHT',
        PROCESS: rowMap['PROCESS'] || 'CNC',
        COLOUR: rowMap['COLOUR'] || 'SLV',
        SPECIFICATION: rowMap['SPECIFICATION'] || 'Standard Spec',
        DIMENSIONS: rowMap['DIMENSIONS'] || 'STD',
      };

      const rule = INITIAL_ITEM_CODE_RULES[0];
      const descRule = INITIAL_DESCRIPTION_RULES[0];

      const codeGen = generateItemCode(rule, attributes, false);
      const descGen = generateItemDescription(descRule, attributes);

      newItems.push({
        id: `item-bulk-${Date.now()}-${i}`,
        globalItemCode: codeGen.code,
        isProvisionalCode: true,
        categoryCode: 'RM',
        description: descGen.description,
        status: 'SUBMITTED',
        defaultPurchaseUom: rowMap['PURCHASE_UOM'] || 'KG',
        defaultInventoryUom: rowMap['INVENTORY_UOM'] || 'KG',
        attributes,
        createdBy: userId,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        codeRuleVersion: rule.version,
        descRuleVersion: descRule.version,
        approvalHistory: [
          {
            id: `appr-bulk-${Date.now()}-${i}`,
            action: 'SUBMIT',
            actorId: userId,
            actorName: currentUser?.fullName || 'Bulk Upload Engine',
            actorRole: (currentUser?.role || 'Creator') as any,
            timestamp: new Date().toISOString(),
            remarks: 'Created via Global Item Master Bulk CSV Import',
            previousStatus: 'DRAFT',
            newStatus: 'SUBMITTED',
          },
        ],
        branchAvailability: allBranches.map((b) => ({
          branchId: b.id,
          isStocked: true,
          isPurchased: true,
          isManufactured: false,
          isActive: true,
        })),
      });
    }

    if (onImportItems && newItems.length > 0) {
      onImportItems(newItems);
      setImportNotice(
        `Successfully imported ${newItems.length} Global Items into Maker-Checker queue.`
      );
      setTimeout(() => {
        setIsBulkImportOpen(false);
        setImportNotice(null);
        setBulkCsvText('');
      }, 1800);
    }
  };

  const renderGlobalStatusBadge = (gStatus: 'ACTIVE' | 'PROVISIONAL' | 'INACTIVE') => {
    switch (gStatus) {
      case 'ACTIVE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 whitespace-nowrap">
            Active
          </span>
        );
      case 'PROVISIONAL':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300 whitespace-nowrap">
            Provisional
          </span>
        );
      case 'INACTIVE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300 whitespace-nowrap">
            Inactive
          </span>
        );
    }
  };

  const renderApprovalBadge = (status: GlobalItem['status']) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Approved
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300 whitespace-nowrap">
            <Clock className="w-3 h-3 text-amber-600" /> Pending Checker
          </span>
        );
      case 'RETURNED_FOR_CORRECTION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-300 whitespace-nowrap">
            <RotateCcw className="w-3 h-3 text-orange-600" /> Returned
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300 whitespace-nowrap">
            <AlertTriangle className="w-3 h-3 text-rose-600" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap">
            Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-3 text-xs w-full min-w-0 max-w-full">
      {operatingContext && <ContextIndicatorBar context={operatingContext} compact />}

      {actionToast && (
        <div className="bg-emerald-950 text-white px-3.5 py-2 rounded-xl border border-emerald-700 shadow-md flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{actionToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionToast(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* PR-Aligned Enterprise Header */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold mb-0.5">
            <span>Item Master Governance</span>
            <span>/</span>
            <span className="text-indigo-600 font-bold">Global Item Master Register</span>
          </div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>Global Item Master</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Global Technical Identity Scope
            </span>
          </h2>
          <p className="text-slate-500 mt-0.5 text-[11px]">
            Centralized global engineering & material catalog. Category governance is strictly isolated to Branch Item Availability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateCustomSpecs && (
            <button
              type="button"
              onClick={onNavigateCustomSpecs}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg font-bold transition cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
              <span>Custom Specifications</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsBulkImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span>Bulk Import</span>
          </button>

          <ExportDropdown
            headers={exportHeaders}
            rows={exportRows}
            currentPageRows={currentPageExportRows}
            filenamePrefix="KOSH_Global_Item_Master"
            title="KOSH Global Item Master Directory"
            subtitle={`Active Records: ${filteredItems.length} of ${items.length}`}
          />

          <button
            type="button"
            onClick={onNavigateNew}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Global Item</span>
          </button>
        </div>
      </div>

      {/* PR-Aligned KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          onClick={handleResetFilters}
          className={`bg-white p-3.5 rounded-xl border shadow-xs cursor-pointer transition hover:shadow-md ${
            totalActiveFilterCount === 0
              ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/20'
              : 'border-slate-200 hover:border-indigo-300'
          }`}
        >
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Total Global Items</span>
            <span className="text-[10px] text-indigo-600 font-bold underline">Show All</span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">{items.length}</div>
          <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" /> Global Identity Master
          </div>
        </div>

        <div
          onClick={() => setApprovalStatusFilter('APPROVED')}
          className={`bg-white p-3.5 rounded-xl border shadow-xs cursor-pointer transition hover:shadow-md ${
            approvalStatusFilter === 'APPROVED'
              ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/20'
              : 'border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Approved Global Items</span>
            <span className="text-[10px] text-emerald-600 font-bold underline">Filter Approved</span>
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-1">
            {items.filter((i) => i.status === 'APPROVED').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Eligible for Branch Activation</div>
        </div>

        <div
          onClick={() => setApprovalStatusFilter('SUBMITTED')}
          className={`bg-white p-3.5 rounded-xl border shadow-xs cursor-pointer transition hover:shadow-md ${
            approvalStatusFilter === 'SUBMITTED'
              ? 'border-amber-500 ring-1 ring-amber-500 bg-amber-50/20'
              : 'border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Pending Global Checker</span>
            <span className="text-[10px] text-amber-600 font-bold underline">Filter Pending</span>
          </div>
          <div className="text-xl font-bold text-amber-600 mt-1">
            {items.filter((i) => i.status === 'SUBMITTED').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Stage 1 Dual Maker-Checker</div>
        </div>

        <div
          onClick={() => {
            if (onNavigate) onNavigate('/items/branch-availability');
          }}
          className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs cursor-pointer transition hover:border-indigo-300 hover:shadow-md"
        >
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Active Plant Branches</span>
            <span className="text-[10px] text-indigo-600 font-bold underline">Manage Matrix</span>
          </div>
          <div className="text-xl font-bold text-indigo-700 mt-1">{allBranches.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Branch-Specific Category Scope</div>
        </div>
      </div>

      {/* PR-Aligned Register Controls Toolbar & Advanced Filter Engine */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              aria-label="Search Global Item Master"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Global Item Code, Description, Item Type, Material, Material Form, UOM..."
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                  itemMasterFilterFields.length > 0
                ) {
                  setAdvancedFilterState({
                    groupLogicalOperator: 'AND',
                    groups: [createEmptyGroup(itemMasterFilterFields[0], 1)],
                  });
                }
                setAdvancedFilterOpen((prev) => !prev);
              }}
              activeCount={totalActiveFilterCount}
            />

            <button
              type="button"
              onClick={() => triggerToast('Global Item Master list refreshed.')}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>

            {totalActiveFilterCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Filters ({totalActiveFilterCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Inline Quick Filter Bar (Item Type, Material, Material Form, Global Status, Approval Status, Created Date Range) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by Item Type"
              value={itemTypeFilter}
              onChange={(e) => setItemTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Material Forms</option>
              {distinctOptions.materialForms.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Global Status"
              value={globalStatusFilter}
              onChange={(e) => setGlobalStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Global Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PROVISIONAL">Provisional</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <select
              aria-label="Filter by Approval Status"
              value={approvalStatusFilter}
              onChange={(e) => setApprovalStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Approval Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="SUBMITTED">Submitted (Pending Checker)</option>
              <option value="DRAFT">Draft</option>
              <option value="RETURNED_FOR_CORRECTION">Returned for Correction</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <DateRangeFilterControl
              label="Created Date"
              range={createdDateRange}
              onChange={setCreatedDateRange}
              fromAriaLabel="Created Date From"
              toAriaLabel="Created Date To"
              compact
            />
          </div>

          <div className="text-[11px] text-slate-500">
            Showing <strong className="text-slate-800">{filteredItems.length}</strong> of{' '}
            <strong className="text-slate-800">{items.length}</strong> Global Items
          </div>
        </div>

        {/* Expandable Advanced Filter Builder Panel */}
        <AdvancedFilterPanel
          moduleKey="GLOBAL_ITEM_MASTER_LIST"
          userId={userId}
          fields={itemMasterFilterFields}
          filterState={advancedFilterState}
          onChangeFilterState={setAdvancedFilterState}
          quickFiltersSnapshot={{
            itemTypeFilter,
            materialFilter,
            materialFormFilter,
            globalStatusFilter,
            approvalStatusFilter,
            createdDateRange,
          }}
          onApplyQuickFiltersSnapshot={(snap) => {
            if (snap.itemTypeFilter !== undefined) setItemTypeFilter(snap.itemTypeFilter);
            if (snap.materialFilter !== undefined) setMaterialFilter(snap.materialFilter);
            if (snap.materialFormFilter !== undefined)
              setMaterialFormFilter(snap.materialFormFilter);
            if (snap.globalStatusFilter !== undefined)
              setGlobalStatusFilter(snap.globalStatusFilter);
            if (snap.approvalStatusFilter !== undefined)
              setApprovalStatusFilter(snap.approvalStatusFilter);
            if (snap.createdDateRange !== undefined) setCreatedDateRange(snap.createdDateRange);
          }}
          onResetAllFilters={handleResetFilters}
          isOpen={advancedFilterOpen}
          onToggleOpen={() => setAdvancedFilterOpen((prev) => !prev)}
          extraActiveFilterCount={activeQuickFilterCount}
        />

        {/* Active Filter Chips Bar */}
        <ActiveFilterChipsBar
          chips={activeFilterChips}
          onClearAll={handleResetFilters}
          totalFilteredCount={filteredItems.length}
          totalUnfilteredCount={items.length}
          entityPluralLabel="Global Items"
        />
      </div>

      {/* Global Item Master Data Grid — Exact 12 Required Columns in Order (NO Category Column) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider select-none">
                <th
                  onClick={() => handleSort('globalItemCode')}
                  className="p-3 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  1. Global Item Code <SortIcon field="globalItemCode" />
                </th>
                <th
                  onClick={() => handleSort('description')}
                  className="p-3 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  2. Description <SortIcon field="description" />
                </th>
                <th
                  onClick={() => handleSort('itemType')}
                  className="p-3 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  3. Item Type <SortIcon field="itemType" />
                </th>
                <th
                  onClick={() => handleSort('material')}
                  className="p-3 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  4. Material <SortIcon field="material" />
                </th>
                <th
                  onClick={() => handleSort('materialForm')}
                  className="p-3 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  5. Material Form <SortIcon field="materialForm" />
                </th>
                <th
                  onClick={() => handleSort('purchaseUom')}
                  className="p-3 text-center cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  6. Purchase UOM <SortIcon field="purchaseUom" />
                </th>
                <th
                  onClick={() => handleSort('inventoryUom')}
                  className="p-3 text-center cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  7. Inventory UOM <SortIcon field="inventoryUom" />
                </th>
                <th
                  onClick={() => handleSort('globalStatus')}
                  className="p-3 text-center cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  8. Global Status <SortIcon field="globalStatus" />
                </th>
                <th
                  onClick={() => handleSort('branchCount')}
                  className="p-3 text-center cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  9. Branch Availability Count <SortIcon field="branchCount" />
                </th>
                <th
                  onClick={() => handleSort('approvalStatus')}
                  className="p-3 text-center cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  10. Approval Status <SortIcon field="approvalStatus" />
                </th>
                <th
                  onClick={() => handleSort('createdAt')}
                  className="p-3 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  11. Created Date <SortIcon field="createdAt" />
                </th>
                <th className="p-3 text-right whitespace-nowrap">12. Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-10 text-center text-slate-400">
                    <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-600 text-xs">
                      No Global Item Master records match your active filter criteria.
                    </p>
                    <p className="text-[11px] mt-1">
                      Adjust your search, date range, or advanced filter conditions, or click Clear Filters.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const iType = resolveItemType(item);
                  const mat = resolveMaterial(item);
                  const form = resolveMaterialForm(item);
                  const pUom = resolvePurchaseUom(item);
                  const invUom = resolveInventoryUom(item);
                  const gStatus = resolveGlobalStatus(item);
                  const branchCount = resolveBranchAvailabilityCount(item, allBranches);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      {/* 1. Global Item Code */}
                      <td className="p-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleRowAction(item, 'VIEW')}
                          className="hover:underline cursor-pointer text-left"
                        >
                          {item.globalItemCode}
                        </button>
                      </td>

                      {/* 2. Description */}
                      <td className="p-3 font-semibold text-slate-800 max-w-[260px] truncate" title={item.description}>
                        {item.description}
                      </td>

                      {/* 3. Item Type */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold text-[10px]">
                          {iType}
                        </span>
                      </td>

                      {/* 4. Material */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-semibold text-[10px]">
                          {mat}
                        </span>
                      </td>

                      {/* 5. Material Form */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 font-semibold text-[10px]">
                          {form}
                        </span>
                      </td>

                      {/* 6. Purchase UOM */}
                      <td className="p-3 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                        {pUom}
                      </td>

                      {/* 7. Inventory UOM */}
                      <td className="p-3 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                        {invUom}
                      </td>

                      {/* 8. Global Status */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {renderGlobalStatusBadge(gStatus)}
                      </td>

                      {/* 9. Branch Availability Count */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleRowAction(item, 'BRANCH_AVAILABILITY')}
                          className="px-2.5 py-0.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-[10px] cursor-pointer"
                          title="Inspect Branch Availability & Branch Category Governance"
                        >
                          {branchCount} / {allBranches.length} Branches
                        </button>
                      </td>

                      {/* 10. Approval Status */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {renderApprovalBadge(item.status)}
                      </td>

                      {/* 11. Created Date */}
                      <td className="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {item.createdAt ? item.createdAt.slice(0, 10) : '—'}
                      </td>

                      {/* 12. Actions (View, Edit, Branch Availability, Audit, Rule, Approval) */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRowAction(item, 'VIEW')}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-bold text-[10px] transition cursor-pointer inline-flex items-center gap-1"
                            title="View Global Item Details"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRowAction(item, 'EDIT')}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded font-bold text-[10px] transition cursor-pointer inline-flex items-center gap-1"
                            title="Edit Global Item"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRowAction(item, 'BRANCH_AVAILABILITY')}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded font-bold text-[10px] transition cursor-pointer inline-flex items-center gap-1"
                            title="Branch Availability"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Branch Availability</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRowAction(item, 'AUDIT')}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded font-bold text-[10px] transition cursor-pointer inline-flex items-center gap-1"
                            title="14-Checkpoint Global Audit"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>Audit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRowAction(item, 'RULE')}
                            className="px-2 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded font-bold text-[10px] transition cursor-pointer inline-flex items-center gap-1"
                            title="Global Code & Description Rule"
                          >
                            <Code2 className="w-3 h-3" />
                            <span>Rule</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRowAction(item, 'APPROVAL')}
                            className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded font-bold text-[10px] transition cursor-pointer inline-flex items-center gap-1"
                            title="Maker-Checker Approval Status & History"
                          >
                            <CheckSquare className="w-3 h-3" />
                            <span>Approval</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Standardized Pagination Footer */}
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

      {/* Item Inspector & Action Modal (View, Edit, Branch Availability, Audit, Rule, Approval) */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#0B192C] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm">
                    Global Item Governance Inspector — [{selectedItem.globalItemCode}]
                  </h3>
                  <p className="text-[11px] text-slate-300">{selectedItem.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Inspector Navigation Tabs */}
            <div className="flex flex-wrap border-b border-slate-200 bg-slate-50 px-6 pt-2 gap-1 font-bold text-xs">
              <button
                type="button"
                onClick={() => setInspectorTab('overview')}
                className={`px-3.5 py-2 border-b-2 transition cursor-pointer ${
                  inspectorTab === 'overview'
                    ? 'border-indigo-600 text-indigo-700 bg-white rounded-t'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                View Details
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('edit')}
                className={`px-3.5 py-2 border-b-2 transition cursor-pointer ${
                  inspectorTab === 'edit'
                    ? 'border-indigo-600 text-indigo-700 bg-white rounded-t'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Edit Attributes
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('classifications')}
                className={`px-3.5 py-2 border-b-2 transition cursor-pointer ${
                  inspectorTab === 'classifications'
                    ? 'border-indigo-600 text-indigo-700 bg-white rounded-t'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Branch Availability ({resolveBranchAvailabilityCount(selectedItem, allBranches)})
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('audit')}
                className={`px-3.5 py-2 border-b-2 transition cursor-pointer ${
                  inspectorTab === 'audit'
                    ? 'border-indigo-600 text-indigo-700 bg-white rounded-t'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                14-Checkpoint Audit
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('rule')}
                className={`px-3.5 py-2 border-b-2 transition cursor-pointer ${
                  inspectorTab === 'rule'
                    ? 'border-indigo-600 text-indigo-700 bg-white rounded-t'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Rule Governance
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('approval')}
                className={`px-3.5 py-2 border-b-2 transition cursor-pointer ${
                  inspectorTab === 'approval'
                    ? 'border-indigo-600 text-indigo-700 bg-white rounded-t'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Approval Workflow
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
              {inspectorTab === 'overview' && (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                        Global Technical Identity (No Global Category)
                      </span>
                      <div className="text-lg font-mono font-black text-slate-900 mt-0.5">
                        {selectedItem.globalItemCode}
                      </div>
                      <div className="text-sm font-semibold text-slate-700 mt-1">
                        {selectedItem.description}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {renderApprovalBadge(selectedItem.status)}
                      {renderGlobalStatusBadge(resolveGlobalStatus(selectedItem))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        Item Type
                      </span>
                      <span className="font-bold text-slate-900">
                        {resolveItemType(selectedItem)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        Material
                      </span>
                      <span className="font-bold text-slate-900">
                        {resolveMaterial(selectedItem)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        Material Form
                      </span>
                      <span className="font-bold text-slate-900">
                        {resolveMaterialForm(selectedItem)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        Default Purchase UOM
                      </span>
                      <span className="font-mono font-bold text-indigo-700">
                        {resolvePurchaseUom(selectedItem)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        Default Inventory UOM
                      </span>
                      <span className="font-mono font-bold text-indigo-700">
                        {resolveInventoryUom(selectedItem)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        Created Date
                      </span>
                      <span className="font-mono font-semibold text-slate-800">
                        {selectedItem.createdAt ? selectedItem.createdAt.slice(0, 10) : '—'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-800 mb-2">
                      Global Classification & Technical Attributes
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {Object.entries(selectedItem.attributes || {}).map(([key, val]) => (
                        <div
                          key={key}
                          className="p-2.5 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <div className="text-[10px] font-bold uppercase text-slate-400">
                            {key}
                          </div>
                          <div className="font-mono font-bold text-slate-800 mt-0.5">
                            {String(val)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {inspectorTab === 'edit' && (
                <div className="space-y-4">
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900">
                    <p className="font-bold">Edit Global Item Attributes</p>
                    <p className="text-[11px] text-indigo-700 mt-0.5">
                      Global Item Code [{selectedItem.globalItemCode}] is immutable once generated. You may update technical description and default UOM baseline.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">
                        Global Technical Description <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Default Purchase UOM <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editPurchaseUom}
                        onChange={(e) => setEditPurchaseUom(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Default Inventory UOM <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editInventoryUom}
                        onChange={(e) => setEditInventoryUom(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setInspectorTab('overview')}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveItemEdits}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </div>
              )}

              {inspectorTab === 'classifications' && (
                <div className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 flex items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-indigo-600" />
                        Branch Availability & Branch-Level Category Governance
                      </h4>
                      <p className="text-[11px] text-indigo-800 mt-0.5">
                        Category is strictly governed per branch. The same Global Item can be Finished Goods in one branch and Raw Material in another.
                      </p>
                    </div>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItem(null);
                          onNavigate('/items/branch-availability');
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer"
                      >
                        Open Branch Availability Matrix
                      </button>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-600">
                          <th className="p-2.5">Branch</th>
                          <th className="p-2.5">Branch Category Role</th>
                          <th className="p-2.5 text-center">Permitted</th>
                          <th className="p-2.5 text-center">Purchased</th>
                          <th className="p-2.5 text-center">Stocked</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allBranches.map((br) => {
                          const bic = branchClassifications.find(
                            (b) =>
                              (b.branchId === br.id || b.branchCode === br.portalBranchCode) &&
                              b.globalItemId === selectedItem.id
                          );
                          const permitted = isItemAvailableInBranch(selectedItem, br);
                          const avail = (selectedItem.branchAvailability || []).find(
                            (a) => a.branchId === br.id || a.branchId === br.portalBranchCode
                          );
                          return (
                            <tr key={br.id} className="hover:bg-slate-50">
                              <td className="p-2.5 font-semibold text-slate-800">
                                [{br.portalBranchCode}] {br.name}
                              </td>
                              <td className="p-2.5 font-mono font-bold text-indigo-700">
                                {bic?.categoryName || bic?.categoryCode || 'RM (Raw Materials)'}
                              </td>
                              <td className="p-2.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    permitted
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {permitted ? 'Permitted' : 'Not Activated'}
                                </span>
                              </td>
                              <td className="p-2.5 text-center">
                                {avail?.isPurchased ?? true ? 'Yes' : 'No'}
                              </td>
                              <td className="p-2.5 text-center">
                                {avail?.isStocked ?? true ? 'Yes' : 'No'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {inspectorTab === 'audit' && auditReport && (
                <div className="space-y-3">
                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-between ${
                      auditReport.overallResult === 'PASS'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs">
                        14-Checkpoint Global Item Creation Audit — [{auditReport.overallResult}]
                      </div>
                      <div className="text-[11px] opacity-80">
                        Audit ID: {auditReport.auditId} • Rule Version v{auditReport.ruleVersion}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-white rounded border font-bold text-xs">
                      {auditReport.checkpoints.filter((c) => c.status === 'PASS').length} /{' '}
                      {auditReport.checkpoints.length} Passed
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-72 overflow-y-auto">
                    {auditReport.checkpoints.map((cp, idx) => (
                      <div
                        key={cp.checkpointKey}
                        className="p-2.5 flex items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-slate-800">{cp.checkpointLabel}</span>
                          <p className="text-[11px] text-slate-500">{cp.message}</p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            cp.status === 'PASS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : cp.status === 'WARNING'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {cp.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inspectorTab === 'rule' && (
                <div className="space-y-3">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900">
                        Global Item Code & Description Rule Lineage
                      </h4>
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedItem(null);
                            onNavigate('/settings/item-code-rules');
                          }}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs cursor-pointer"
                        >
                          Open Rule Builder
                        </button>
                      )}
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      Generated under Global Monotonic Rule Version{' '}
                      <strong>v{selectedItem.codeRuleVersion}</strong> and Description Rule Version{' '}
                      <strong>v{selectedItem.descRuleVersion}</strong> (Zero Category dependency).
                    </p>
                    <div className="p-2.5 bg-white rounded border border-slate-200 font-mono text-xs">
                      <div>
                        <span className="text-slate-400">Code Structure: </span>
                        <strong className="text-indigo-700">
                          {'{MATERIAL}-{ITEM_TYPE}-{FORM}-{PROCESS}-{SEQ}'}
                        </strong>
                      </div>
                      <div className="mt-1">
                        <span className="text-slate-400">Evaluated Code: </span>
                        <strong className="text-slate-900">{selectedItem.globalItemCode}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {inspectorTab === 'approval' && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">
                        Stage 1: Global Item Creation Maker-Checker Status
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Current Status: <strong>{selectedItem.status}</strong>
                      </div>
                    </div>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItem(null);
                          onNavigate('/approvals');
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs cursor-pointer"
                      >
                        Open Dual Approval Inbox
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-bold text-slate-700">Approval Audit Trail</h5>
                    {(selectedItem.approvalHistory || []).map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{log.actorName}</span>{' '}
                          <span className="text-slate-500">({log.actorRole})</span> —{' '}
                          <span className="font-semibold text-indigo-700">{log.remarks}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {log.previousStatus} → {log.newStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal */}
      {isBulkImportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#0B192C] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm">
                    Bulk CSV Item Import & Rule Generation Engine
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Batch-create Global Items using global technical dimensions (No Category column)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkImportOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-slate-600">
                  <span className="font-bold text-slate-800">Expected CSV Columns:</span>{' '}
                  <code className="font-mono text-[11px] text-indigo-700">
                    MATERIAL, ITEM_TYPE, FORM, PROCESS, COLOUR, SPECIFICATION, DIMENSIONS, PURCHASE_UOM, INVENTORY_UOM
                  </code>
                </div>
                <button
                  type="button"
                  onClick={handleLoadSampleCsv}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded border border-indigo-200 shrink-0 cursor-pointer"
                >
                  Load Sample CSV
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Paste CSV Payload Below:
                </label>
                <textarea
                  rows={6}
                  value={bulkCsvText}
                  onChange={(e) => setBulkCsvText(e.target.value)}
                  placeholder="MATERIAL,ITEM_TYPE,FORM,PROCESS,COLOUR,SPECIFICATION,DIMENSIONS,PURCHASE_UOM,INVENTORY_UOM..."
                  className="w-full p-3 bg-slate-900 text-emerald-300 font-mono text-xs rounded-xl border border-slate-700 focus:outline-none"
                />
              </div>

              {importNotice && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{importNotice}</span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBulkImportOpen(false)}
                className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessBulkImport}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" /> Process & Generate Codes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
