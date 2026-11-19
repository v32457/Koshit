import React, { useState, useEffect, useMemo } from 'react';
import {
  GlobalItem,
  Branch,
  Warehouse,
  BranchItemClassification,
  BranchItemAvailabilityRecord,
  BranchAlternativeItemRef,
  BranchItemAttachment,
  BranchBarcodeRecord,
  BranchRevisionInfo,
  BranchItemWorkflowStatus,
  UomMasterRecord,
  RuleAuditReport,
  BranchChangeHistoryEntry,
  User,
} from '../../types';
import {
  Layers,
  MapPin,
  Save,
  ShieldCheck,
  Warehouse as WarehouseIcon,
  Settings2,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  ShieldAlert,
  Barcode,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  History,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  Send,
  ArrowUpDown,
} from 'lucide-react';
import { INITIAL_BRANCH_ITEM_CLASSIFICATIONS } from '../../data/seedData';
import { isItemAvailableInBranch } from '../../utils/branchItemHelper';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';
import { uomConversionService } from '../../services/uomConversionService';
import { itemRuleAndAuditService } from '../../services/itemRuleAndAuditService';
import { changeHistoryService } from '../../services/changeHistoryService';
import {
  AdvancedFilterState,
  FilterFieldDefinition,
  DateRangeFilterValue,
  ActiveFilterChip,
  createInitialAdvancedFilterState,
  evaluateAdvancedFilters,
  matchesDateRange,
  buildAdvancedFilterChips,
  countActiveAdvancedConditions,
  matchesMultiSelectFilter,
  formatMultiSelectFilterLabel,
} from '../../services/advancedFilterEngine';
import {
  AdvancedFilterPanel,
  AdvancedFilterToggleButton,
  ActiveFilterChipsBar,
  DateRangeFilterControl,
  MultiSelectFilterDropdown,
} from '../../components/AdvancedFilterPanel';
import { CLASSIFICATION_DIMENSIONS } from '../../data/seedData';

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
  const attrs: Record<string, any> = item.attributes || {};
  return resolveDimensionLabel(
    'ITEM_TYPE',
    attrs.ITEM_TYPE || attrs.itemType || attrs.type || (item as any).itemType || 'RAW'
  );
}

function getMaterial(item: GlobalItem): string {
  const attrs: Record<string, any> = item.attributes || {};
  return resolveDimensionLabel('MATERIAL', attrs.MATERIAL || attrs.material || (item as any).material || 'STL');
}

function getMaterialForm(item: GlobalItem): string {
  const attrs: Record<string, any> = item.attributes || {};
  return resolveDimensionLabel(
    'FORM',
    attrs.FORM || attrs.MATERIAL_FORM || attrs.materialForm || (item as any).materialForm || 'SHT'
  );
}

interface BranchAvailabilityViewProps {
  items: GlobalItem[];
  allBranches: Branch[];
  currentUser?: User;
  onUpdateItems?: (updatedItems: GlobalItem[]) => void;
}

type ConfigTab =
  | 'ALL_14_SECTIONS'
  | 'C_UOM'
  | 'D_COMPLIANCE'
  | 'E_WAREHOUSE'
  | 'F_ALTERNATIVES'
  | 'G_ATTACHMENTS'
  | 'H_BARCODES'
  | 'IJ_APPROVAL'
  | 'K_AUDIT_HISTORY';

export const BranchAvailabilityView: React.FC<BranchAvailabilityViewProps> = ({
  items: initialItems,
  allBranches,
  currentUser,
  onUpdateItems,
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(allBranches[0]?.id || 'br-pond-01');
  const [items, setItems] = useState<GlobalItem[]>(initialItems);
  const [isSaved, setIsSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // List View Quick Filters & Date Range Controls (Phase 10)
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGlobalItem, setFilterGlobalItem] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterItemType, setFilterItemType] = useState('ALL');
  const [filterMaterial, setFilterMaterial] = useState('ALL');
  const [filterMaterialForm, setFilterMaterialForm] = useState('ALL');
  const [filterAvailabilityStatus, setFilterAvailabilityStatus] = useState('ALL');
  const [filterApprovalStatus, setFilterApprovalStatus] = useState('ALL');
  const [createdDateRange, setCreatedDateRange] = useState<DateRangeFilterValue>({ from: '', to: '' });
  const [modifiedDateRange, setModifiedDateRange] = useState<DateRangeFilterValue>({ from: '', to: '' });
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const [advancedFilterState, setAdvancedFilterState] = useState<AdvancedFilterState>(() =>
    createInitialAdvancedFilterState()
  );

  // Detailed Branch Item Availability Records (Sections C - J)
  const [branchRecords, setBranchRecords] = useState<Record<string, BranchItemAvailabilityRecord>>(() => {
    try {
      const saved = localStorage.getItem('kosh_branch_availability_records_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  // Active configuration modal state for 14 Sections
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ConfigTab>('ALL_14_SECTIONS');
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
    7: true,
    8: true,
    9: true,
    10: true,
    11: true,
    12: true,
    13: true,
    14: true,
  });
  const [configItem, setConfigItem] = useState<GlobalItem | null>(null);
  const [configForm, setConfigForm] = useState<Partial<BranchItemAvailabilityRecord>>({});
  const [configError, setConfigError] = useState<string>('');
  const [configSuccess, setConfigSuccess] = useState<string>('');

  // New Sub-Item Form States
  const [newAltItemId, setNewAltItemId] = useState<string>('');
  const [newAltRelType, setNewAltRelType] = useState<'ALTERNATIVE' | 'SUBSTITUTE' | 'EQUIVALENT'>('ALTERNATIVE');
  const [newAltReason, setNewAltReason] = useState<string>('');

  const [newAttType, setNewAttType] = useState<any>('TECHNICAL_DATASHEET');
  const [newAttFileName, setNewAttFileName] = useState<string>('');
  const [newAttFileRef, setNewAttFileRef] = useState<string>('');
  const [newAttDesc, setNewAttDesc] = useState<string>('');
  const [newAttVersion, setNewAttVersion] = useState<string>('v1.0');

  const [newBarcodeVal, setNewBarcodeVal] = useState<string>('');
  const [newBarcodeType, setNewBarcodeType] = useState<any>('EAN13');
  const [newBarcodeGtin, setNewBarcodeGtin] = useState<string>('');
  const [newBarcodeShared, setNewBarcodeShared] = useState<boolean>(false);
  const [newBarcodeSharedJust, setNewBarcodeSharedJust] = useState<string>('');

  const [newRevNumber, setNewRevNumber] = useState<string>('');
  const [newRevDesc, setNewRevDesc] = useState<string>('');
  const [newRevReason, setNewRevReason] = useState<string>('');
  const [newRevTechRef, setNewRevTechRef] = useState<string>('');

  // Audit and Change History States (Phase 8)
  const [auditReport, setAuditReport] = useState<RuleAuditReport | null>(null);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [changeHistoryEntries, setChangeHistoryEntries] = useState<BranchChangeHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyFilterField, setHistoryFilterField] = useState<string>('ALL');

  const toggleSection = (secNum: number) => {
    setExpandedSections((prev) => ({ ...prev, [secNum]: !prev[secNum] }));
  };

  const expandAllSections = () => {
    const next: Record<number, boolean> = {};
    for (let i = 1; i <= 14; i++) next[i] = true;
    setExpandedSections(next);
  };

  const collapseAllSections = () => {
    const next: Record<number, boolean> = {};
    for (let i = 1; i <= 14; i++) next[i] = false;
    setExpandedSections(next);
  };

  // Synchronize state when initialItems updates
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // Load from backend API if available
  const fetchBackendBranchItems = async () => {
    try {
      const res = await fetch(`/api/branch-items?branchId=${selectedBranchId}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data) && json.data.length > 0) {
          setBranchRecords((prev) => {
            const updated = { ...prev };
            for (const row of json.data) {
              const key = `${row.branchId}_${row.globalItemId}`;
              updated[key] = {
                ...updated[key],
                ...row,
              };
            }
            return updated;
          });
        }
      }
    } catch {
      // use local state
    }
  };

  useEffect(() => {
    fetchBackendBranchItems();
  }, [selectedBranchId]);

  // Authoritative Branch Item Classifications
  const [branchClassifications, setBranchClassifications] = useState<BranchItemClassification[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_branch_classifications');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_BRANCH_ITEM_CLASSIFICATIONS;
  });

  const selectedBranch = allBranches.find((b) => b.id === selectedBranchId) || allBranches[0];
  const branchWarehouses: Warehouse[] = selectedBranch?.warehouses || [];
  const uomList: UomMasterRecord[] = useMemo(() => uomConversionService.getUoms(false), []);

  // Unique dropdown values for list filters
  const uniqueItemTypes = useMemo(
    () => Array.from(new Set(items.map((i) => getItemType(i)).filter(Boolean))).sort(),
    [items]
  );
  const uniqueMaterials = useMemo(
    () => Array.from(new Set(items.map((i) => getMaterial(i)).filter(Boolean))).sort(),
    [items]
  );
  const uniqueMaterialForms = useMemo(
    () => Array.from(new Set(items.map((i) => getMaterialForm(i)).filter(Boolean))).sort(),
    [items]
  );

  // 10-Field Advanced Filter Engine Definitions for Branch Availability List
  const branchFilterFields = useMemo<FilterFieldDefinition<GlobalItem>[]>(() => {
    return [
      {
        key: 'branchName',
        label: 'Branch',
        type: 'DROPDOWN',
        options: allBranches.map((b) => ({ value: b.name, label: `${b.name} (${b.portalBranchCode})` })),
        accessor: (item) => {
          const permittedNames = allBranches
            .filter((b) => isItemAvailableInBranch(item, b))
            .map((b) => b.name);
          return Array.from(new Set([...permittedNames, selectedBranch?.name || ''])).filter(Boolean);
        },
      },
      {
        key: 'globalItemCode',
        label: 'Global Item Code',
        type: 'TEXT',
        accessor: (item) => item.globalItemCode,
      },
      {
        key: 'description',
        label: 'Item Description',
        type: 'TEXT',
        accessor: (item) => item.description,
      },
      {
        key: 'categoryCode',
        label: 'Branch Category',
        type: 'DROPDOWN',
        options: [
          { value: 'FG', label: 'FG (Finished Goods)' },
          { value: 'RM', label: 'RM (Raw Materials)' },
          { value: 'SF', label: 'SF (Semi-Finished)' },
          { value: 'PK', label: 'PK (Packaging)' },
          { value: 'CO', label: 'CO (Consumables)' },
          { value: 'MA', label: 'MA (Spares)' },
          { value: 'BO', label: 'BO (Bought-Out)' },
        ],
        accessor: (item) => {
          const bic = branchClassifications.find(
            (b) =>
              (b.branchId === selectedBranch.id || b.branchCode === selectedBranch.portalBranchCode) &&
              b.globalItemId === item.id
          );
          return bic?.categoryCode || (selectedBranch.portalBranchCode === '001' ? 'FG' : selectedBranch.portalBranchCode === '002' ? 'RM' : 'SF');
        },
      },
      {
        key: 'itemType',
        label: 'Item Type',
        type: 'DROPDOWN',
        options: uniqueItemTypes.map((v) => ({ value: v, label: v })),
        accessor: (item) => getItemType(item),
      },
      {
        key: 'material',
        label: 'Material',
        type: 'DROPDOWN',
        options: uniqueMaterials.map((v) => ({ value: v, label: v })),
        accessor: (item) => getMaterial(item),
      },
      {
        key: 'materialForm',
        label: 'Material Form',
        type: 'DROPDOWN',
        options: uniqueMaterialForms.map((v) => ({ value: v, label: v })),
        accessor: (item) => getMaterialForm(item),
      },
      {
        key: 'availabilityStatus',
        label: 'Availability Status',
        type: 'DROPDOWN',
        options: [
          { value: 'PERMITTED', label: 'Permitted in Branch' },
          { value: 'NOT_PERMITTED', label: 'Not Permitted' },
        ],
        accessor: (item) => (isItemAvailableInBranch(item, selectedBranch) ? 'PERMITTED' : 'NOT_PERMITTED'),
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
        ],
        accessor: (item) =>
          branchRecords[`${selectedBranch.id}_${item.id}`]?.branchStatus ||
          (item.status === 'SAP_CREATED' && isItemAvailableInBranch(item, selectedBranch) ? 'APPROVED' : 'DRAFT'),
      },
      {
        key: 'createdAt',
        label: 'Created Date',
        type: 'DATE',
        accessor: (item) => branchRecords[`${selectedBranch.id}_${item.id}`]?.createdAt || item.createdAt,
      },
    ];
  }, [allBranches, selectedBranch, branchClassifications, branchRecords, uniqueItemTypes, uniqueMaterials, uniqueMaterialForms]);

  const getEffectiveBranchStatus = (item: GlobalItem): BranchItemWorkflowStatus => {
    const key = `${selectedBranch.id}_${item.id}`;
    const branchRecord = branchRecords[key];
    if (branchRecord?.branchStatus) return branchRecord.branchStatus;
    return item.status === 'SAP_CREATED' && isItemAvailableInBranch(item, selectedBranch)
      ? 'APPROVED'
      : 'DRAFT';
  };

  // Filtered items combining Quick Filters + Date Ranges + Advanced Filter Engine
  const filteredItems = useMemo(() => {
    const quickMatched = items.filter((item) => {
      const key = `${selectedBranch.id}_${item.id}`;
      const branchRecord = branchRecords[key];
      const bic = branchClassifications.find(
        (b) =>
          (b.branchId === selectedBranch.id || b.branchCode === selectedBranch.portalBranchCode) &&
          b.globalItemId === item.id
      ) || {
        categoryCode: selectedBranch.portalBranchCode === '001' ? 'FG' : selectedBranch.portalBranchCode === '002' ? 'RM' : 'SF',
      };
      const isPermitted = isItemAvailableInBranch(item, selectedBranch);
      const status =
        branchRecord?.branchStatus ||
        (item.status === 'SAP_CREATED' && isPermitted ? 'APPROVED' : 'DRAFT');
      const itemTypeVal = getItemType(item);
      const materialVal = getMaterial(item);
      const materialFormVal = getMaterialForm(item);

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchSearch =
          item.globalItemCode?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          materialVal.toLowerCase().includes(q) ||
          itemTypeVal.toLowerCase().includes(q);
        if (!matchSearch) return false;
      }

      if (!matchesMultiSelectFilter(filterGlobalItem, item.globalItemCode)) return false;
      if (!matchesMultiSelectFilter(filterCategory, bic.categoryCode)) return false;
      if (!matchesMultiSelectFilter(filterItemType, itemTypeVal)) return false;
      if (!matchesMultiSelectFilter(filterMaterial, materialVal)) return false;
      if (!matchesMultiSelectFilter(filterMaterialForm, materialFormVal)) return false;

      const availVal = isPermitted ? 'PERMITTED' : 'NOT_PERMITTED';
      if (!matchesMultiSelectFilter(filterAvailabilityStatus, availVal)) return false;

      if (!matchesMultiSelectFilter(filterApprovalStatus, status)) return false;

      const createdDate = branchRecord?.createdAt || item.createdAt;
      if (!matchesDateRange(createdDate, createdDateRange)) return false;

      const modifiedDate = branchRecord?.updatedAt || (item as any).updatedAt || item.createdAt;
      if (!matchesDateRange(modifiedDate, modifiedDateRange)) return false;

      return true;
    });

    return evaluateAdvancedFilters(quickMatched, advancedFilterState, branchFilterFields);
  }, [
    items,
    selectedBranch,
    branchRecords,
    branchClassifications,
    searchTerm,
    filterGlobalItem,
    filterCategory,
    filterItemType,
    filterMaterial,
    filterMaterialForm,
    filterAvailabilityStatus,
    filterApprovalStatus,
    createdDateRange,
    modifiedDateRange,
    advancedFilterState,
    branchFilterFields,
  ]);

  const {
    paginatedItems,
    sortField,
    sortOrder,
    handleSort,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalRecords,
    totalPages,
    pageSizeOptions,
  } = useStandardDataGrid<GlobalItem>({
    gridId: 'branch-availability-v2',
    userId: currentUser?.id,
    items: filteredItems,
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc',
    getCreatedAt: (item) => item.createdAt,
    comparators: {
      globalItemCode: (a, b) => (a.globalItemCode || '').localeCompare(b.globalItemCode || ''),
      description: (a, b) => (a.description || '').localeCompare(b.description || ''),
      itemType: (a, b) => getItemType(a).localeCompare(getItemType(b)),
      material: (a, b) => getMaterial(a).localeCompare(getMaterial(b)),
      createdAt: (a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''),
    },
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedBranchId,
    searchTerm,
    filterGlobalItem,
    filterCategory,
    filterItemType,
    filterMaterial,
    filterMaterialForm,
    filterAvailabilityStatus,
    filterApprovalStatus,
    createdDateRange,
    modifiedDateRange,
    advancedFilterState,
    setCurrentPage,
  ]);

  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];

    if (searchTerm.trim()) {
      chips.push({
        id: 'quick_search',
        category: 'QUICK',
        fieldLabel: 'Search',
        operatorLabel: 'contains',
        valueLabel: searchTerm.trim(),
        onRemove: () => setSearchTerm(''),
      });
    }
    if (filterGlobalItem !== 'ALL') {
      chips.push({
        id: 'quick_globalItem',
        category: 'QUICK',
        fieldLabel: 'Global Item',
        operatorLabel: '=',
        valueLabel: formatMultiSelectFilterLabel(filterGlobalItem),
        onRemove: () => setFilterGlobalItem('ALL'),
      });
    }
    if (filterCategory !== 'ALL') {
      chips.push({
        id: 'quick_category',
        category: 'QUICK',
        fieldLabel: 'Branch Category',
        operatorLabel: '=',
        valueLabel: formatMultiSelectFilterLabel(filterCategory),
        onRemove: () => setFilterCategory('ALL'),
      });
    }
    if (filterItemType !== 'ALL') {
      chips.push({
        id: 'quick_itemType',
        category: 'QUICK',
        fieldLabel: 'Item Type',
        operatorLabel: '=',
        valueLabel: formatMultiSelectFilterLabel(filterItemType),
        onRemove: () => setFilterItemType('ALL'),
      });
    }
    if (filterMaterial !== 'ALL') {
      chips.push({
        id: 'quick_material',
        category: 'QUICK',
        fieldLabel: 'Material',
        operatorLabel: '=',
        valueLabel: formatMultiSelectFilterLabel(filterMaterial),
        onRemove: () => setFilterMaterial('ALL'),
      });
    }
    if (filterMaterialForm !== 'ALL') {
      chips.push({
        id: 'quick_materialForm',
        category: 'QUICK',
        fieldLabel: 'Material Form',
        operatorLabel: '=',
        valueLabel: formatMultiSelectFilterLabel(filterMaterialForm),
        onRemove: () => setFilterMaterialForm('ALL'),
      });
    }
    if (filterAvailabilityStatus !== 'ALL') {
      chips.push({
        id: 'quick_availStatus',
        category: 'QUICK',
        fieldLabel: 'Availability',
        operatorLabel: '=',
        valueLabel: formatMultiSelectFilterLabel(filterAvailabilityStatus),
        onRemove: () => setFilterAvailabilityStatus('ALL'),
      });
    }
    if (filterApprovalStatus !== 'ALL') {
      chips.push({
        id: 'quick_apprStatus',
        category: 'QUICK',
        fieldLabel: 'Approval Status',
        operatorLabel: '=',
        valueLabel: formatMultiSelectFilterLabel(filterApprovalStatus),
        onRemove: () => setFilterApprovalStatus('ALL'),
      });
    }
    if (createdDateRange.from || createdDateRange.to) {
      chips.push({
        id: 'date_created',
        category: 'DATE_RANGE',
        fieldLabel: 'Created Date',
        operatorLabel: 'between',
        valueLabel: `${createdDateRange.from || 'Any'} – ${createdDateRange.to || 'Any'}`,
        onRemove: () => setCreatedDateRange({ from: '', to: '' }),
      });
    }
    if (modifiedDateRange.from || modifiedDateRange.to) {
      chips.push({
        id: 'date_modified',
        category: 'DATE_RANGE',
        fieldLabel: 'Modified Date',
        operatorLabel: 'between',
        valueLabel: `${modifiedDateRange.from || 'Any'} – ${modifiedDateRange.to || 'Any'}`,
        onRemove: () => setModifiedDateRange({ from: '', to: '' }),
      });
    }

    const advChips = buildAdvancedFilterChips(
      advancedFilterState,
      branchFilterFields,
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

    return [...chips, ...advChips];
  }, [
    searchTerm,
    filterGlobalItem,
    filterCategory,
    filterItemType,
    filterMaterial,
    filterMaterialForm,
    filterAvailabilityStatus,
    filterApprovalStatus,
    createdDateRange,
    modifiedDateRange,
    advancedFilterState,
    branchFilterFields,
  ]);

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setFilterGlobalItem('ALL');
    setFilterCategory('ALL');
    setFilterItemType('ALL');
    setFilterMaterial('ALL');
    setFilterMaterialForm('ALL');
    setFilterAvailabilityStatus('ALL');
    setFilterApprovalStatus('ALL');
    setCreatedDateRange({ from: '', to: '' });
    setModifiedDateRange({ from: '', to: '' });
    setAdvancedFilterState(createInitialAdvancedFilterState());
  };

  const handleUpdateBranchCategory = (itemId: string, newCategoryCode: string) => {
    const targetItem = items.find((i) => i.id === itemId);
    if (targetItem && getEffectiveBranchStatus(targetItem) === 'APPROVED') {
      setSaveMessage('Immutable Record: Approved Branch Item Availability cannot be modified.');
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3500);
      return;
    }

    const existing = branchClassifications.find(
      (bc) => (bc.branchId === selectedBranch.id || bc.branchCode === selectedBranch.portalBranchCode) && bc.globalItemId === itemId
    );

    const updated = branchClassifications.filter(
      (bc) => !((bc.branchId === selectedBranch.id || bc.branchCode === selectedBranch.portalBranchCode) && bc.globalItemId === itemId)
    );

    const categoryNames: Record<string, string> = {
      FG: 'Finished Goods',
      RM: 'Raw Materials',
      SF: 'Semi-Finished Goods',
      PK: 'Packaging Materials',
      CO: 'Consumables',
      MA: 'Maintenance / Spares',
      BO: 'Bought-Out',
    };

    const roles: Record<string, any> = {
      FG: 'MANUFACTURE',
      RM: 'PURCHASE',
      SF: 'STOCK',
      PK: 'PURCHASE',
      CO: 'PURCHASE',
      MA: 'PURCHASE',
      BO: 'PURCHASE',
    };

    const newRecord: BranchItemClassification = existing
      ? {
          ...existing,
          categoryCode: newCategoryCode,
          categoryName: categoryNames[newCategoryCode] || 'Custom Category',
          itemRole: roles[newCategoryCode] || 'STOCK',
          updatedAt: new Date().toISOString(),
        }
      : {
          id: `bic-${itemId}-${selectedBranch.id}`,
          globalItemId: itemId,
          companyId: selectedBranch.companyId || 'co-kosh-01',
          companyCode: 'KOSH-HQ',
          companyName: 'Kosh Innovations Pvt Ltd',
          branchId: selectedBranch.id,
          branchCode: selectedBranch.portalBranchCode,
          branchName: selectedBranch.name,
          categoryCode: newCategoryCode,
          categoryName: categoryNames[newCategoryCode] || 'Custom Category',
          itemRole: roles[newCategoryCode] || 'STOCK',
          isStocked: true,
          isPurchased: newCategoryCode === 'RM',
          isManufactured: newCategoryCode === 'FG',
          isSalesPermitted: newCategoryCode === 'FG',
          status: 'ACTIVE',
          sapItemCode: `${newCategoryCode}-${itemId}-${selectedBranch.portalBranchCode}`,
          updatedAt: new Date().toISOString(),
        };

    const nextList = [...updated, newRecord];
    setBranchClassifications(nextList);
    localStorage.setItem('kosh_branch_classifications', JSON.stringify(nextList));
  };

  const handleToggleSetting = (
    itemId: string,
    field: 'isActive' | 'isStocked' | 'isPurchased' | 'isManufactured'
  ) => {
    const targetItem = items.find((i) => i.id === itemId);
    if (targetItem && getEffectiveBranchStatus(targetItem) === 'APPROVED') {
      setSaveMessage('Immutable Record: Approved Branch Item Availability cannot be modified.');
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3500);
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const isMatch = (b: any) =>
            b.branchId === selectedBranch.id ||
            b.branchId === selectedBranch.code ||
            b.branchId === selectedBranch.portalBranchCode;

          const existingAvail = (item.branchAvailability || []).find(isMatch);
          let newAvail = (item.branchAvailability || []).filter((b) => !isMatch(b));

          const updatedSetting = existingAvail
            ? { ...existingAvail, [field]: !existingAvail[field] }
            : {
                branchId: selectedBranch.id,
                isStocked: field === 'isStocked',
                isPurchased: field === 'isPurchased',
                isManufactured: field === 'isManufactured',
                isActive: true,
              };

          return {
            ...item,
            branchAvailability: [...newAvail, updatedSetting],
          };
        }
        return item;
      })
    );
  };

  const handleOpenConfigModal = (item: GlobalItem, defaultTab: ConfigTab = 'ALL_14_SECTIONS') => {
    setConfigItem(item);
    setActiveTab(defaultTab);
    const key = `${selectedBranch.id}_${item.id}`;
    const bic = branchClassifications.find(
      (b) =>
        (b.branchId === selectedBranch.id || b.branchCode === selectedBranch.portalBranchCode) &&
        b.globalItemId === item.id
    );
    const defaultStatus = getEffectiveBranchStatus(item);
    const existing = branchRecords[key] || {
      id: key,
      globalItemId: item.id,
      globalItemCode: item.globalItemCode,
      companyId: selectedBranch.companyId || 'co-kosh-01',
      companyCode: 'KOSH-HQ',
      companyName: 'Kosh Innovations Pvt Ltd',
      branchId: selectedBranch.id,
      branchCode: selectedBranch.portalBranchCode,
      branchName: selectedBranch.name,
      categoryCode: bic?.categoryCode || 'RM',
      categoryName: bic?.categoryName || 'Raw Materials',
      itemRole: bic?.itemRole || 'PURCHASE',
      effectivePurchaseUom: item.defaultPurchaseUom || 'KG',
      effectiveInventoryUom: item.defaultInventoryUom || 'KG',
      effectiveConversionFactor: 1,
      shelfLifeControlled: false,
      serialTrackingEnabled: false,
      warrantyApplicable: false,
      moq: 1,
      orderMultiple: 1,
      serviceControlEnabled: false,
      batchTrackingEnabled: true,
      lotTrackingEnabled: false,
      qualityInspectionRequired: true,
      inspectionType: 'RECEIVING',
      warehouseConfigs: branchWarehouses.map((w) => ({
        id: `whcfg-${w.id}`,
        warehouseId: w.id,
        warehouseCode: w.warehouseCode,
        warehouseName: w.warehouseName,
        isEligible: true,
        isPreferred: w.isDefault || false,
        storageLocation: 'BIN-01-A',
        safetyStock: 10,
        reorderLevel: 25,
        maximumStock: 100,
        replenishmentMethod: 'REORDER_POINT',
        procurementLeadTimeDays: 7,
      })),
      alternativeItems: [],
      attachments: [],
      barcodes: [],
      revisionHistory: [
        {
          id: 'rev-init',
          revisionNumber: 'REV-001',
          revisionDescription: 'Initial approved operational configuration',
          technicalChangeRef: 'ECN-2026-001',
          effectiveFrom: new Date().toISOString().split('T')[0],
          changeReason: 'Baseline release',
          approvedBy: 'Platform Lead',
          approvalStatus: 'APPROVED',
        },
      ],
      isPurchaseEnabled: true,
      isInventoryEnabled: true,
      isStocked: true,
      isManufactured: false,
      isSalesPermitted: false,
      isActive: true,
      effectiveFrom: new Date().toISOString().split('T')[0],
      activationReason: 'Initial branch availability setup',
      branchStatus: defaultStatus,
      approvalStatus: defaultStatus === 'APPROVED' ? 'APPROVED' : 'DRAFT',
      createdBy: 'Platform Admin',
      createdByName: 'Platform Admin',
      createdAt: new Date().toISOString(),
      updatedBy: 'Platform Admin',
      updatedByName: 'Platform Admin',
      updatedAt: new Date().toISOString(),
      approvalHistory:
        defaultStatus === 'APPROVED'
          ? [
              {
                id: 'appr-init',
                action: 'APPROVE',
                actorId: 'usr-admin-01',
                actorName: 'Platform Checker',
                actorRole: 'BRANCH_CHECKER',
                timestamp: new Date().toISOString(),
                remarks: 'Initial activation approved',
                previousStatus: 'SUBMITTED',
                newStatus: 'APPROVED',
              },
            ]
          : [],
    };
    setConfigForm(existing);
    setConfigError('');
    setConfigSuccess('');
    setIsConfigModalOpen(true);

    const initialReport = itemRuleAndAuditService.evaluateBranchItemActivation(
      existing,
      item,
      Object.values(branchRecords)
    );
    setAuditReport(initialReport);

    changeHistoryService
      .getBranchHistory({ entityId: key })
      .then((h) => {
        setChangeHistoryEntries(h);
      })
      .catch(() => {
        setChangeHistoryEntries([]);
      });
  };

  // Phase 8: Run 25-Checkpoint Conditional Branch Item Activation Audit
  const handleRunAudit = async () => {
    if (!configItem) return;
    setIsRunningAudit(true);
    setConfigError('');
    try {
      const key = `${selectedBranch.id}_${configItem.id}`;
      let report: RuleAuditReport | null = null;
      try {
        const res = await fetch(`/api/branch-items/${encodeURIComponent(key)}/audit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...configForm,
            globalItemId: configItem.id,
            globalItemCode: configItem.globalItemCode,
            companyId: selectedBranch.companyId || 'co-kosh-01',
            branchId: selectedBranch.id,
            actorName: 'Plant Checker Lead',
            actorUserId: 'usr-checker-01',
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            report = json.data;
          }
        }
      } catch {
        // local engine fallback
      }

      if (!report) {
        report = itemRuleAndAuditService.evaluateBranchItemActivation(
          configForm,
          configItem,
          Object.values(branchRecords),
          1,
          'Plant Checker Lead',
          'usr-checker-01'
        );
      }

      setAuditReport(report);
      setConfigForm((prev) => ({
        ...prev,
        lastAuditReportId: report?.auditId,
        lastAuditStatus: report?.overallResult,
      }));

      if (report.canSubmit) {
        setConfigSuccess(`25-Checkpoint Rule Validation Passed (${report.overallResult}). Ready for Maker-Checker submission.`);
      } else {
        setConfigError(
          `25-Checkpoint Rule Validation Failed (${report.overallResult}): ${report.errors.length} mandatory errors must be resolved before submission.`
        );
      }
    } catch (err: any) {
      setConfigError(err.message || 'Audit execution failed.');
    } finally {
      setIsRunningAudit(false);
    }
  };

  // Section F: Add Alternative Item
  const handleAddAlternative = () => {
    if (!newAltItemId) {
      setConfigError('Please select an alternative Global Item.');
      return;
    }
    if (configItem && newAltItemId === configItem.id) {
      setConfigError('Self-Reference Blocked: An item cannot be an alternative of itself.');
      return;
    }
    const targetItem = items.find((i) => i.id === newAltItemId);
    if (!targetItem) {
      setConfigError('Target item not found.');
      return;
    }

    const currentAlts = configForm.alternativeItems || [];
    if (currentAlts.some((a) => a.alternativeGlobalItemId === newAltItemId)) {
      setConfigError('This alternative item mapping already exists.');
      return;
    }

    const newAlt: BranchAlternativeItemRef = {
      id: `alt-${Date.now()}`,
      alternativeGlobalItemId: targetItem.id,
      alternativeGlobalItemCode: targetItem.globalItemCode,
      alternativeGlobalItemDescription: targetItem.description,
      relationshipType: newAltRelType,
      effectiveFrom: new Date().toISOString().split('T')[0],
      isActive: true,
      reason: newAltReason.trim() || 'Approved plant-level functional equivalent',
      approvalStatus: 'APPROVED',
    };

    setConfigForm({
      ...configForm,
      alternativeItems: [...currentAlts, newAlt],
    });
    setNewAltItemId('');
    setNewAltReason('');
    setConfigError('');
    setConfigSuccess('Alternative item reference added.');
  };

  const handleRemoveAlternative = (id: string) => {
    setConfigForm({
      ...configForm,
      alternativeItems: (configForm.alternativeItems || []).filter((a) => a.id !== id),
    });
  };

  // Section G: Add Attachment
  const handleAddAttachment = () => {
    if (!newAttFileName.trim() || !newAttFileRef.trim()) {
      setConfigError('Attachment File Name and Reference path are required.');
      return;
    }
    const refLower = newAttFileRef.toLowerCase().trim();
    if (refLower.startsWith('javascript:') || refLower.startsWith('vbscript:') || refLower.startsWith('data:text/html')) {
      setConfigError('Security Violation: Disallowed script or executable URL protocol.');
      return;
    }

    const newAtt: BranchItemAttachment = {
      id: `att-${Date.now()}`,
      documentType: newAttType,
      fileName: newAttFileName.trim(),
      fileReference: newAttFileRef.trim(),
      description: newAttDesc.trim() || 'Branch verified document',
      documentVersion: newAttVersion.trim() || 'v1.0',
      uploadedBy: 'Plant Quality Engineer',
      uploadedDate: new Date().toISOString(),
      effectiveDate: new Date().toISOString().split('T')[0],
      approvalStatus: 'APPROVED',
      isActive: true,
      fileSizeBytes: 1024 * 350,
      mimeType: newAttFileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
    };

    setConfigForm({
      ...configForm,
      attachments: [...(configForm.attachments || []), newAtt],
    });
    setNewAttFileName('');
    setNewAttFileRef('');
    setNewAttDesc('');
    setConfigError('');
    setConfigSuccess('Attachment added.');
  };

  const handleRemoveAttachment = (id: string) => {
    setConfigForm({
      ...configForm,
      attachments: (configForm.attachments || []).filter((a) => a.id !== id),
    });
  };

  // Section H: Add Barcode
  const handleAddBarcode = () => {
    if (!newBarcodeVal.trim()) {
      setConfigError('Barcode value is required.');
      return;
    }
    const currentBarcodes = configForm.barcodes || [];
    if (currentBarcodes.some((b) => b.barcodeValue === newBarcodeVal.trim() && b.status === 'ACTIVE')) {
      setConfigError(`Barcode "${newBarcodeVal}" is already registered in this configuration.`);
      return;
    }
    if (newBarcodeShared && !newBarcodeSharedJust.trim()) {
      setConfigError('Shared barcodes require an intentional business justification.');
      return;
    }

    const newBc: BranchBarcodeRecord = {
      id: `bc-${Date.now()}`,
      barcodeValue: newBarcodeVal.trim(),
      barcodeType: newBarcodeType,
      gtin: newBarcodeGtin.trim() || undefined,
      effectiveFrom: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
      isIntentionallyShared: newBarcodeShared,
      sharedJustification: newBarcodeShared ? newBarcodeSharedJust.trim() : undefined,
    };

    setConfigForm({
      ...configForm,
      barcodes: [...currentBarcodes, newBc],
    });
    setNewBarcodeVal('');
    setNewBarcodeGtin('');
    setNewBarcodeShared(false);
    setNewBarcodeSharedJust('');
    setConfigError('');
    setConfigSuccess('Barcode registered.');
  };

  const handleRemoveBarcode = (id: string) => {
    setConfigForm({
      ...configForm,
      barcodes: (configForm.barcodes || []).filter((b) => b.id !== id),
    });
  };

  // Section I: Add Revision
  const handleAddRevision = () => {
    if (!newRevNumber.trim() || !newRevDesc.trim()) {
      setConfigError('Revision Number and Description are required.');
      return;
    }

    const newRev: BranchRevisionInfo = {
      id: `rev-${Date.now()}`,
      revisionNumber: newRevNumber.trim(),
      revisionDescription: newRevDesc.trim(),
      technicalChangeRef: newRevTechRef.trim() || undefined,
      effectiveFrom: new Date().toISOString().split('T')[0],
      changeReason: newRevReason.trim() || 'Specification revision bump',
      approvedBy: 'Platform Lead',
      approvalStatus: 'APPROVED',
    };

    setConfigForm({
      ...configForm,
      currentRevision: newRev,
      revisionHistory: [newRev, ...(configForm.revisionHistory || [])],
    });
    setNewRevNumber('');
    setNewRevDesc('');
    setNewRevReason('');
    setNewRevTechRef('');
    setConfigError('');
    setConfigSuccess(`Revision ${newRev.revisionNumber} logged.`);
  };

  const isApprovedImmutable =
    configForm.branchStatus === 'APPROVED' || (configForm as any).approvalStatus === 'APPROVED';

  // Persist helper used by Save Draft & Submit for Checker Approval
  const persistConfigRecord = async (statusOverride?: BranchItemWorkflowStatus, remarksOverride?: string) => {
    if (!configItem) return false;
    const key = `${selectedBranch.id}_${configItem.id}`;
    const prevRecord = branchRecords[key];
    if (
      prevRecord?.branchStatus === 'APPROVED' ||
      prevRecord?.approvalStatus === 'APPROVED' ||
      (isApprovedImmutable && statusOverride !== 'APPROVED')
    ) {
      setConfigError(
        'Immutable Governance Lock: Once a Branch Item Availability record is APPROVED, it is permanently immutable and cannot be modified.'
      );
      return false;
    }

    const nextStatus = statusOverride || configForm.branchStatus || 'DRAFT';
    const nextApprovalStatus =
      nextStatus === 'APPROVED' ? 'APPROVED' : nextStatus === 'SUBMITTED' ? 'PENDING' : 'DRAFT';

    const approvalEntry = statusOverride
      ? {
          id: `act-${Date.now()}`,
          action: (statusOverride === 'SUBMITTED' ? 'SUBMIT' : statusOverride === 'APPROVED' ? 'APPROVE' : 'SAVE_DRAFT') as any,
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || (currentUser as any)?.name || 'Plant Operations Lead',
          actorRole: (currentUser?.role || 'BRANCH_MAKER') as any,
          timestamp: new Date().toISOString(),
          remarks: remarksOverride || (statusOverride === 'SUBMITTED' ? 'Submitted for Checker dual-authorization' : 'Saved working draft'),
          previousStatus: configForm.branchStatus || 'DRAFT',
          newStatus: nextStatus,
        }
      : null;

    const payload: BranchItemAvailabilityRecord = {
      ...(configForm as BranchItemAvailabilityRecord),
      id: key,
      globalItemId: configItem.id,
      globalItemCode: configItem.globalItemCode,
      branchId: selectedBranch.id,
      companyId: selectedBranch.companyId || 'co-kosh-01',
      branchStatus: nextStatus,
      approvalStatus: nextApprovalStatus as any,
      approvalHistory: approvalEntry
        ? [approvalEntry, ...(configForm.approvalHistory || [])]
        : configForm.approvalHistory || [],
      updatedAt: new Date().toISOString(),
    };

    try {
      await fetch('/api/branch-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // local fallback
    }

    const nextRecords = { ...branchRecords, [key]: payload };
    setBranchRecords(nextRecords);
    localStorage.setItem('kosh_branch_availability_records_v2', JSON.stringify(nextRecords));
    setConfigForm(payload);

    if (payload.categoryCode) {
      handleUpdateBranchCategory(configItem.id, payload.categoryCode);
    }

    try {
      await changeHistoryService.diffAndRecordBranchChanges(
        key,
        String(configItem.id),
        selectedBranch.companyId || 'co-kosh-01',
        selectedBranch.id,
        prevRecord,
        payload,
        {
          changedBy: currentUser?.fullName || (currentUser as any)?.name || 'Plant Operations Lead',
          changedByUserId: currentUser?.id || 'usr-admin-01',
          changeReason: remarksOverride || payload.activationReason || 'Branch operational record update',
          approvalReference: payload.approvalStatus === 'APPROVED' ? `APPR-${key}` : undefined,
          applicableRuleVersion: 1,
        }
      );
      const updatedHistory = await changeHistoryService.getBranchHistory({ entityId: key });
      setChangeHistoryEntries(updatedHistory);
    } catch {
      // ignore
    }

    return true;
  };

  // Dual Approval Workflow Action Handlers (Section J)
  const handleWorkflowAction = async (action: 'DRAFT' | 'SUBMIT' | 'APPROVE' | 'RETURN') => {
    if (action === 'SUBMIT' || action === 'APPROVE') {
      const currentAudit =
        auditReport ||
        itemRuleAndAuditService.evaluateBranchItemActivation(
          configForm,
          configItem || undefined,
          Object.values(branchRecords)
        );
      setAuditReport(currentAudit);

      if (!currentAudit.canSubmit) {
        setConfigError(
          `Cannot ${action === 'SUBMIT' ? 'Submit for Checker Approval' : 'Approve Activation'}: Mandatory 25-checkpoint audit failed with status [${currentAudit.overallResult}]. All mandatory checkpoint errors must be resolved.`
        );
        return;
      }
    }

    const statusMap: Record<typeof action, BranchItemWorkflowStatus> = {
      DRAFT: 'DRAFT',
      SUBMIT: 'SUBMITTED',
      APPROVE: 'APPROVED',
      RETURN: 'RETURNED_FOR_CORRECTION',
    };

    const remarksMap: Record<typeof action, string> = {
      DRAFT: 'Saved as working draft',
      SUBMIT: 'Submitted for Checker dual-authorization',
      APPROVE: 'Dual Checker approval granted. Item activated for plant operations.',
      RETURN: 'Returned for revision correction',
    };

    const nextStatus = statusMap[action];
    await persistConfigRecord(nextStatus, remarksMap[action]);
    setConfigSuccess(`Workflow updated: Branch status is now [${nextStatus}].`);
  };

  const handleSaveDraftAction = async () => {
    setConfigError('');
    const ok = await persistConfigRecord('DRAFT', 'Saved Branch Item Availability draft');
    if (ok && configItem) {
      setConfigSuccess(`Draft saved for [${configItem.globalItemCode}] at ${selectedBranch.name}.`);
      setSaveMessage(`Branch draft saved for [${configItem.globalItemCode}] at ${selectedBranch.name}.`);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 4000);
    }
  };

  const handleSubmitForCheckerApproval = async () => {
    if (!configItem) return;
    setConfigError('');
    const currentAudit = itemRuleAndAuditService.evaluateBranchItemActivation(
      configForm,
      configItem,
      Object.values(branchRecords)
    );
    setAuditReport(currentAudit);

    if (!currentAudit.canSubmit) {
      setConfigError(
        `Submission Blocked: 25-Checkpoint Rule Audit status is [${currentAudit.overallResult}] with ${currentAudit.errors.length} mandatory error(s). Please resolve errors before submitting.`
      );
      return;
    }

    const ok = await persistConfigRecord('SUBMITTED', 'Submitted for Branch Checker Approval');
    if (ok) {
      setIsConfigModalOpen(false);
      setSaveMessage(
        `Branch configuration [${configItem.globalItemCode}] submitted for Checker Approval at ${selectedBranch.name}.`
      );
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 4000);
    }
  };

  const handleSaveMatrix = () => {
    try {
      localStorage.setItem('kosh_global_items', JSON.stringify(items));
      localStorage.setItem('kosh_branch_availability_records_v2', JSON.stringify(branchRecords));
    } catch (e) {
      console.error('Failed to save items to localStorage:', e);
    }
    if (onUpdateItems) {
      onUpdateItems(items);
    }
    setSaveMessage(`Branch item availability matrix saved for ${selectedBranch.name}.`);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // KPI metrics for current branch
  const kpiStats = useMemo(() => {
    let permittedCount = 0;
    let pendingApprovalCount = 0;
    let approvedCount = 0;
    for (const item of items) {
      if (isItemAvailableInBranch(item, selectedBranch)) permittedCount++;
      const st = getEffectiveBranchStatus(item);
      if (st === 'SUBMITTED') pendingApprovalCount++;
      if (st === 'APPROVED') approvedCount++;
    }
    return {
      totalItems: items.length,
      permittedCount,
      pendingApprovalCount,
      approvedCount,
      warehousesCount: branchWarehouses.length,
    };
  }, [items, selectedBranch, branchRecords, branchWarehouses]);

  const showSection = (secNum: number, tabGroup: ConfigTab) => {
    if (activeTab === 'ALL_14_SECTIONS') return true;
    return activeTab === tabGroup;
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      {/* PR-Aligned Enterprise Header & Breadcrumbs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            <span>Item Master</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-indigo-600">Branch Item Availability & Operational Governance</span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Branch Item Availability & 14-Section Operational Configuration
          </h2>
          <p className="text-slate-500 mt-0.5 text-[11px]">
            Authoritative plant-level Category assignment, UOM overrides, compliance controls, multi-warehouse planning, alternatives, attachments, barcodes & dual maker-checker workflow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchBackendBranchItems}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            type="button"
            onClick={handleSaveMatrix}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save Branch Matrix
          </button>
        </div>
      </div>

      {isSaved && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveMessage || `Branch item availability & advanced governance saved for ${selectedBranch.name}.`}</span>
        </div>
      )}

      {/* Branch Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
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

        {/* KPI Strip */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-slate-400">Approved Global:</span>
            <span className="font-mono font-bold text-slate-900">{kpiStats.totalItems}</span>
          </div>
          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg shadow-2xs flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-emerald-700">Permitted in Plant:</span>
            <span className="font-mono font-bold text-emerald-900">{kpiStats.permittedCount}</span>
          </div>
          <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg shadow-2xs flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-amber-700">Pending Checker:</span>
            <span className="font-mono font-bold text-amber-900">{kpiStats.pendingApprovalCount}</span>
          </div>
          <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg shadow-2xs flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-indigo-700">Active Warehouses:</span>
            <span className="font-mono font-bold text-indigo-900">{kpiStats.warehousesCount}</span>
          </div>
        </div>
      </div>

      {/* Purchase Requisition-Aligned Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Global Item Code, Description, Material..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-indigo-600 outline-none"
            />
          </div>

          {/* Global Item Filter */}
          <MultiSelectFilterDropdown
            label="Global Item"
            allLabel="All Global Items"
            ariaLabel="Filter by Global Item"
            value={filterGlobalItem}
            onChange={setFilterGlobalItem}
            options={items.map((i) => ({
              value: i.globalItemCode,
              label: `${i.globalItemCode} — ${i.description}`,
            }))}
            className="w-full"
          />

          {/* Branch Category Filter */}
          <MultiSelectFilterDropdown
            label="Branch Category"
            allLabel="All Branch Categories"
            ariaLabel="Filter by Branch Category"
            value={filterCategory}
            onChange={setFilterCategory}
            options={[
              { value: 'FG', label: 'FG (Finished Goods)' },
              { value: 'RM', label: 'RM (Raw Materials)' },
              { value: 'SF', label: 'SF (Semi-Finished)' },
              { value: 'PK', label: 'PK (Packaging)' },
              { value: 'CO', label: 'CO (Consumables)' },
              { value: 'MA', label: 'MA (Spares)' },
              { value: 'BO', label: 'BO (Bought-Out)' },
            ]}
            className="w-full"
          />

          {/* Availability Status Filter */}
          <MultiSelectFilterDropdown
            label="Availability Status"
            allLabel="All Availability Statuses"
            ariaLabel="Filter by Availability Status"
            value={filterAvailabilityStatus}
            onChange={setFilterAvailabilityStatus}
            options={[
              { value: 'PERMITTED', label: 'Permitted in Branch' },
              { value: 'NOT_PERMITTED', label: 'Not Permitted' },
            ]}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Item Type */}
          <MultiSelectFilterDropdown
            label="Item Type"
            allLabel="All Item Types"
            ariaLabel="Filter by Item Type"
            value={filterItemType}
            onChange={setFilterItemType}
            options={uniqueItemTypes.map((t) => ({
              value: t,
              label: t,
            }))}
            className="w-full"
          />

          {/* Material */}
          <MultiSelectFilterDropdown
            label="Material"
            allLabel="All Materials"
            ariaLabel="Filter by Material"
            value={filterMaterial}
            onChange={setFilterMaterial}
            options={uniqueMaterials.map((m) => ({
              value: m,
              label: m,
            }))}
            className="w-full"
          />

          {/* Material Form */}
          <MultiSelectFilterDropdown
            label="Material Form"
            allLabel="All Material Forms"
            ariaLabel="Filter by Material Form"
            value={filterMaterialForm}
            onChange={setFilterMaterialForm}
            options={uniqueMaterialForms.map((mf) => ({
              value: mf,
              label: mf,
            }))}
            className="w-full"
          />

          {/* Approval Status */}
          <MultiSelectFilterDropdown
            label="Approval Status"
            allLabel="All Approval Statuses"
            ariaLabel="Filter by Approval Status"
            value={filterApprovalStatus}
            onChange={setFilterApprovalStatus}
            options={[
              { value: 'APPROVED', label: 'APPROVED' },
              { value: 'SUBMITTED', label: 'SUBMITTED' },
              { value: 'DRAFT', label: 'DRAFT' },
              { value: 'RETURNED_FOR_CORRECTION', label: 'RETURNED_FOR_CORRECTION' },
            ]}
            className="w-full"
          />
        </div>

        {/* Date Range Filters + Advanced Filter Toggle */}
        <div className="flex flex-wrap items-end justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <DateRangeFilterControl
              label="Created Date Range"
              range={createdDateRange}
              onChange={setCreatedDateRange}
            />
            <DateRangeFilterControl
              label="Modified Date Range"
              range={modifiedDateRange}
              onChange={setModifiedDateRange}
            />
          </div>

          <div className="flex items-center gap-2">
            <AdvancedFilterToggleButton
              isOpen={isAdvancedFilterOpen}
              onToggle={() => setIsAdvancedFilterOpen((prev) => !prev)}
              activeCount={countActiveAdvancedConditions(advancedFilterState, branchFilterFields)}
            />
            {activeChips.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Chips Bar */}
        <ActiveFilterChipsBar
          chips={activeChips}
          onClearAll={handleClearAllFilters}
          totalFilteredCount={totalRecords}
          totalUnfilteredCount={items.length}
          entityPluralLabel="branch items"
        />

        {/* Collapsible Advanced Filter Engine Panel */}
        <AdvancedFilterPanel
          moduleKey="branch_availability_v10"
          userId={currentUser?.id || 'default'}
          fields={branchFilterFields}
          filterState={advancedFilterState}
          onChangeFilterState={setAdvancedFilterState}
          onResetAllFilters={handleClearAllFilters}
          isOpen={isAdvancedFilterOpen}
          onToggleOpen={() => setIsAdvancedFilterOpen((prev) => !prev)}
        />
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Branch Scope: [{selectedBranch.portalBranchCode}] {selectedBranch.name}
            </h3>
            <p className="text-[11px] text-slate-500">
              {selectedBranch.city}, {selectedBranch.state} • GSTIN: {selectedBranch.gstinPan || 'N/A'} • Showing {paginatedItems.length} of {totalRecords} records
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] bg-indigo-100 text-indigo-800 font-bold px-2.5 py-1 rounded">
              Active Warehouses: {branchWarehouses.length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[11px]">
                <th
                  onClick={() => handleSort('globalItemCode')}
                  className="p-3.5 cursor-pointer hover:bg-slate-200/60 transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Global Item Code</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5">Branch Category Role</th>
                <th
                  onClick={() => handleSort('description')}
                  className="p-3.5 cursor-pointer hover:bg-slate-200/60 transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Item Description</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('itemType')}
                  className="p-3.5 cursor-pointer hover:bg-slate-200/60 transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Type / Material</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5 text-center">Permitted</th>
                <th className="p-3.5 text-center">Stocked</th>
                <th className="p-3.5 text-center">Purchased</th>
                <th className="p-3.5 text-center">Manufactured</th>
                <th className="p-3.5 text-center">Governance Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                    No branch item availability records match the active filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const isPermitted = isItemAvailableInBranch(item, selectedBranch);
                  const avail = (item.branchAvailability || []).find(
                    (b) =>
                      b.branchId === selectedBranch.id ||
                      b.branchId === selectedBranch.code ||
                      b.branchId === selectedBranch.portalBranchCode
                  );

                  const bic = branchClassifications.find(
                    (b) =>
                      (b.branchId === selectedBranch.id || b.branchCode === selectedBranch.portalBranchCode) &&
                      b.globalItemId === item.id
                  ) || {
                    categoryCode: selectedBranch.portalBranchCode === '001' ? 'FG' : selectedBranch.portalBranchCode === '002' ? 'RM' : 'SF',
                  };

                  const status = getEffectiveBranchStatus(item);
                  const isRowImmutable = status === 'APPROVED';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-mono font-bold text-indigo-700">{item.globalItemCode}</td>
                      <td className="p-3.5">
                        <select
                          value={bic.categoryCode}
                          disabled={isRowImmutable}
                          title={isRowImmutable ? 'Approved branch record is immutable' : 'Select Branch Category'}
                          onChange={(e) => handleUpdateBranchCategory(item.id, e.target.value)}
                          className="p-1 text-xs font-bold rounded border border-slate-300 bg-white text-indigo-900 shadow-2xs disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                        >
                          <option value="FG">FG (Finished Goods)</option>
                          <option value="RM">RM (Raw Materials)</option>
                          <option value="SF">SF (Semi-Finished)</option>
                          <option value="PK">PK (Packaging)</option>
                          <option value="CO">CO (Consumables)</option>
                          <option value="MA">MA (Spares)</option>
                          <option value="BO">BO (Bought-Out)</option>
                        </select>
                      </td>
                      <td className="p-3.5 text-slate-800 font-medium max-w-xs truncate">{item.description}</td>
                      <td className="p-3.5">
                        <div className="text-[11px] font-bold text-slate-800">{getItemType(item)}</div>
                        <div className="text-[10px] text-slate-500">
                          {getMaterial(item)} • {getMaterialForm(item)}
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          disabled={isRowImmutable}
                          title={isRowImmutable ? 'Approved branch record is immutable' : 'Toggle Branch Permission'}
                          onClick={() => handleToggleSetting(item.id, 'isActive')}
                          className={`w-6 h-6 rounded-full font-bold text-xs text-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                            isPermitted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {isPermitted ? '✓' : '—'}
                        </button>
                      </td>
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          disabled={isRowImmutable}
                          checked={avail?.isStocked ?? false}
                          onChange={() => handleToggleSetting(item.id, 'isStocked')}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          disabled={isRowImmutable}
                          checked={avail?.isPurchased ?? false}
                          onChange={() => handleToggleSetting(item.id, 'isPurchased')}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          disabled={isRowImmutable}
                          checked={avail?.isManufactured ?? false}
                          onChange={() => handleToggleSetting(item.id, 'isManufactured')}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                            status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : status === 'SUBMITTED'
                              ? 'bg-amber-100 text-amber-800'
                              : status === 'RETURNED_FOR_CORRECTION'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {status === 'APPROVED' ? 'APPROVED (IMMUTABLE)' : status}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenConfigModal(item, 'ALL_14_SECTIONS')}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                          >
                            <Settings2 className="w-3.5 h-3.5" /> Configure
                          </button>
                          <button
                            onClick={() => handleOpenConfigModal(item, 'K_AUDIT_HISTORY')}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer inline-flex items-center gap-1"
                            title="Open 25-Checkpoint Rule Audit"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Audit
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
      </div>

      <DataGridFooter
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalRecords={totalRecords}
        pageSizeOptions={pageSizeOptions}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        defaultSortNotice={`Sort: ${sortField} (${sortOrder.toUpperCase()})`}
      />

      {/* Advanced Branch Config Modal (14 Expandable/Collapsible Sections + PR-Aligned 4 Footer Actions) */}
      {isConfigModalOpen && configItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 bg-[#0B192C] text-white flex items-center justify-between shrink-0 shadow-xs">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-cyan-400" />
                  Branch Operational Governance (14 Sections): [{configItem.globalItemCode}] {configItem.description}
                </h3>
                <p className="text-[11px] text-slate-300">
                  Branch Scope: {selectedBranch.name} ({selectedBranch.portalBranchCode}) • Global Base UOM: {configItem.defaultInventoryUom || 'KG'} • Workflow Status: {configForm.branchStatus || 'DRAFT'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {activeTab === 'ALL_14_SECTIONS' && (
                  <div className="flex items-center gap-1.5 mr-2">
                    <button
                      type="button"
                      onClick={expandAllSections}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-bold cursor-pointer"
                    >
                      Expand All
                    </button>
                    <button
                      type="button"
                      onClick={collapseAllSections}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-bold cursor-pointer"
                    >
                      Collapse All
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setIsConfigModalOpen(false)}
                  className="text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-1 overflow-x-auto shrink-0 font-bold text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('ALL_14_SECTIONS')}
                className={`px-3 py-2 border-b-2 transition cursor-pointer ${
                  activeTab === 'ALL_14_SECTIONS'
                    ? 'border-indigo-600 text-indigo-700 bg-white rounded-t'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('C_UOM')}
                className={`px-3 py-2 border-b-2 transition cursor-pointer ${
                  activeTab === 'C_UOM' ? 'border-indigo-600 text-indigo-700 bg-white rounded-t' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Context, Category & UOM
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('D_COMPLIANCE')}
                className={`px-3 py-2 border-b-2 transition cursor-pointer ${
                  activeTab === 'D_COMPLIANCE' ? 'border-indigo-600 text-indigo-700 bg-white rounded-t' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Controls & Quality
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('E_WAREHOUSE')}
                className={`px-3 py-2 border-b-2 transition cursor-pointer ${
                  activeTab === 'E_WAREHOUSE' ? 'border-indigo-600 text-indigo-700 bg-white rounded-t' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Warehouses ({configForm.warehouseConfigs?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('F_ALTERNATIVES')}
                className={`px-3 py-2 border-b-2 transition cursor-pointer ${
                  activeTab === 'F_ALTERNATIVES' ? 'border-indigo-600 text-indigo-700 bg-white rounded-t' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Alternatives ({configForm.alternativeItems?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('G_ATTACHMENTS')}
                className={`px-3 py-2 border-b-2 transition cursor-pointer ${
                  activeTab === 'G_ATTACHMENTS' ? 'border-indigo-600 text-indigo-700 bg-white rounded-t' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Documents ({configForm.attachments?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('H_BARCODES')}
                className={`px-3 py-2 border-b-2 transition cursor-pointer ${
                  activeTab === 'H_BARCODES' ? 'border-indigo-600 text-indigo-700 bg-white rounded-t' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Barcodes & Revisions ({configForm.barcodes?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('K_AUDIT_HISTORY')}
                className={`px-3 py-2 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'K_AUDIT_HISTORY' ? 'border-indigo-600 text-indigo-700 bg-white rounded-t' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>25-Checkpoint Audit & Approval</span>
                {auditReport && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      auditReport.overallResult === 'PASS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : auditReport.overallResult === 'WARNING'
                        ? 'bg-amber-100 text-amber-800'
                        : auditReport.overallResult === 'ERROR'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-red-200 text-red-900'
                    }`}
                  >
                    {auditReport.overallResult}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/60">
              {isApprovedImmutable && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg font-bold text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>
                      Immutable Approved Record: This Branch Item Availability configuration is APPROVED and permanently locked against modification.
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-200 text-emerald-950 rounded text-[10px] font-mono uppercase shrink-0">
                    IMMUTABLE
                  </span>
                </div>
              )}
              {configError && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg font-bold text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{configError}</span>
                </div>
              )}
              {configSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{configSuccess}</span>
                </div>
              )}

              {/* SECTION 1: Company & Branch Operational Context */}
              {showSection(1, 'C_UOM') && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(1)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center">
                        1
                      </span>
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                        Company & Branch Operational Context
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                        [{selectedBranch.portalBranchCode}] {selectedBranch.name}
                      </span>
                      {expandedSections[1] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </button>
                  {expandedSections[1] && (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Company Entity</span>
                        <span className="font-bold text-slate-900">Kosh Innovations Pvt Ltd (KOSH-HQ)</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Branch / Plant</span>
                        <span className="font-bold text-indigo-700">[{selectedBranch.portalBranchCode}] {selectedBranch.name}</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Location & GSTIN</span>
                        <span className="font-bold text-slate-800">{selectedBranch.city}, {selectedBranch.state} ({selectedBranch.gstinPan || 'N/A'})</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Record ID</span>
                        <span className="font-mono font-bold text-slate-700">{selectedBranch.id}_{configItem.id}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 2: Read-Only Approved Global Item Identity & Reference */}
              {showSection(2, 'C_UOM') && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(2)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center">
                        2
                      </span>
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                        Read-Only Approved Global Item Identity & Reference
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded">
                        {configItem.globalItemCode}
                      </span>
                      {expandedSections[2] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </button>
                  {expandedSections[2] && (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Global Item Code</span>
                        <span className="font-mono font-bold text-indigo-700">{configItem.globalItemCode}</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 sm:col-span-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Global Technical Description</span>
                        <span className="font-bold text-slate-900">{configItem.description}</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Item Type / Material</span>
                        <span className="font-bold text-slate-800">{getItemType(configItem)} / {getMaterial(configItem)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 3: Mandatory Branch Category & Operational Role Governance */}
              {showSection(3, 'C_UOM') && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(3)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center">
                        3
                      </span>
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                        Mandatory Branch Category & Operational Role Governance
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                        Category: {configForm.categoryCode || 'RM'}
                      </span>
                      {expandedSections[3] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </button>
                  {expandedSections[3] && (
                    <fieldset disabled={isApprovedImmutable} className="m-0 p-0 border-0 min-w-0">
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Mandatory Branch Category *</label>
                          <select
                            value={configForm.categoryCode || 'RM'}
                            onChange={(e) => {
                              const code = e.target.value;
                              const names: Record<string, string> = {
                                FG: 'Finished Goods',
                                RM: 'Raw Materials',
                                SF: 'Semi-Finished Goods',
                                PK: 'Packaging Materials',
                                CO: 'Consumables',
                                MA: 'Maintenance / Spares',
                                BO: 'Bought-Out',
                              };
                              setConfigForm({
                                ...configForm,
                                categoryCode: code,
                                categoryName: names[code] || 'Raw Materials',
                              });
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-xs disabled:opacity-60 disabled:bg-slate-100"
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
                          <label className="block font-bold text-slate-700 mb-1">Operational Item Role</label>
                          <select
                            value={configForm.itemRole || 'PURCHASE'}
                            onChange={(e) => setConfigForm({ ...configForm, itemRole: e.target.value as any })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-xs disabled:opacity-60 disabled:bg-slate-100"
                          >
                            <option value="PURCHASE">PURCHASE</option>
                            <option value="MANUFACTURE">MANUFACTURE</option>
                            <option value="STOCK">STOCK</option>
                            <option value="BOTH">BOTH (Purchase & Manufacture)</option>
                          </select>
                        </div>
                        <div className="p-2.5 bg-indigo-50/70 rounded-lg border border-indigo-200 flex flex-col justify-center">
                          <span className="text-[10px] font-bold uppercase text-indigo-600">Unique Branch Category Rule</span>
                          <span className="text-[11px] text-slate-700">
                            One active Category per (Global Item, Company, Branch). Independent of other branches.
                          </span>
                        </div>
                      </div>
                    </fieldset>
                  )}
                </div>
              )}

              {/* SECTION 4: Branch Purchase & Inventory Enablement Controls */}
              {showSection(4, 'C_UOM') && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(4)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center">
                        4
                      </span>
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                        Branch Purchase & Inventory Enablement Controls
                      </span>
                    </div>
                    {expandedSections[4] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>
                  {expandedSections[4] && (
                    <fieldset disabled={isApprovedImmutable} className="m-0 p-0 border-0 min-w-0">
                      <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                        <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer font-bold text-slate-800">
                          <input
                            type="checkbox"
                            checked={configForm.isPurchaseEnabled ?? true}
                            onChange={(e) => setConfigForm({ ...configForm, isPurchaseEnabled: e.target.checked })}
                            className="w-4 h-4 rounded text-indigo-600"
                          />
                          <span>Purchase Enabled</span>
                        </label>
                        <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer font-bold text-slate-800">
                          <input
                            type="checkbox"
                            checked={configForm.isInventoryEnabled ?? true}
                            onChange={(e) => setConfigForm({ ...configForm, isInventoryEnabled: e.target.checked })}
                            className="w-4 h-4 rounded text-indigo-600"
                          />
                          <span>Inventory Enabled</span>
                        </label>
                        <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer font-bold text-slate-800">
                          <input
                            type="checkbox"
                            checked={configForm.isStocked ?? true}
                            onChange={(e) => setConfigForm({ ...configForm, isStocked: e.target.checked })}
                            className="w-4 h-4 rounded text-indigo-600"
                          />
                          <span>Stocked in Plant</span>
                        </label>
                        <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer font-bold text-slate-800">
                          <input
                            type="checkbox"
                            checked={configForm.isManufactured ?? false}
                            onChange={(e) => setConfigForm({ ...configForm, isManufactured: e.target.checked })}
                            className="w-4 h-4 rounded text-indigo-600"
                          />
                          <span>Manufactured</span>
                        </label>
                        <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer font-bold text-slate-800">
                          <input
                            type="checkbox"
                            checked={configForm.isActive ?? true}
                            onChange={(e) => setConfigForm({ ...configForm, isActive: e.target.checked })}
                            className="w-4 h-4 rounded text-indigo-600"
                          />
                          <span>Active in Branch</span>
                        </label>
                      </div>
                    </fieldset>
                  )}
                </div>
              )}

              {/* SECTION 5: Branch UOM Overrides & Conversion Validation */}
              {showSection(5, 'C_UOM') && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(5)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center">
                        5
                      </span>
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                        Branch UOM Overrides & Conversion Validation
                      </span>
                    </div>
                    {expandedSections[5] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>
                  {expandedSections[5] && (
                    <fieldset disabled={isApprovedImmutable} className="m-0 p-0 border-0 min-w-0">
                      <div className="p-4 space-y-3">
                        <p className="text-[11px] text-slate-500">
                          Overrides default Global Item UOM for this branch. Defaults to Global UOM ({configItem.defaultPurchaseUom} / {configItem.defaultInventoryUom}) when not overridden.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">Branch Purchase UOM</label>
                            <select
                              value={configForm.branchPurchaseUom || configItem.defaultPurchaseUom}
                              onChange={(e) => setConfigForm({ ...configForm, branchPurchaseUom: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-xs disabled:opacity-60 disabled:bg-slate-100"
                            >
                              {uomList.map((u) => (
                                <option key={u.code} value={u.code}>
                                  {u.code} - {u.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">Branch Inventory UOM</label>
                            <select
                              value={configForm.branchInventoryUom || configItem.defaultInventoryUom}
                              onChange={(e) => setConfigForm({ ...configForm, branchInventoryUom: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-xs disabled:opacity-60 disabled:bg-slate-100"
                            >
                              {uomList.map((u) => (
                                <option key={u.code} value={u.code}>
                                  {u.code} - {u.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">Conversion Factor</label>
                            <input
                              type="number"
                              step="0.0001"
                              value={configForm.effectiveConversionFactor ?? 1}
                              onChange={(e) =>
                                setConfigForm({ ...configForm, effectiveConversionFactor: parseFloat(e.target.value) || 1 })
                              }
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs disabled:opacity-60 disabled:bg-slate-100"
                            />
                          </div>
                        </div>
                      </div>
                    </fieldset>
                  )}
                </div>
              )}

              {/* SECTION 6: Branch Procurement Routing, Buyer, Supplier & Lead Time */}
              {showSection(6, 'C_UOM') && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(6)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center">
                        6
                      </span>
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                        Branch Procurement Routing, Buyer, Supplier & Lead Time
                      </span>
                    </div>
                    {expandedSections[6] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>
                  {expandedSections[6] && (
                    <fieldset disabled={isApprovedImmutable} className="m-0 p-0 border-0 min-w-0">
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Preferred Warehouse</label>
                          <select
                            value={configForm.preferredWarehouseId || ''}
                            onChange={(e) => setConfigForm({ ...configForm, preferredWarehouseId: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs disabled:opacity-60 disabled:bg-slate-100"
                          >
                            <option value="">Default Plant Warehouse</option>
                            {branchWarehouses.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.warehouseCode} ({w.warehouseName})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Preferred Buyer</label>
                          <input
                            type="text"
                            placeholder="e.g. Sourcing Lead - Polymers"
                            value={configForm.preferredBuyerId || ''}
                            onChange={(e) => setConfigForm({ ...configForm, preferredBuyerId: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs disabled:opacity-60 disabled:bg-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Preferred Supplier</label>
                          <input
                            type="text"
                            placeholder="e.g. Reliance Petrochemicals Ltd"
                            value={configForm.preferredSupplierId || ''}
                            onChange={(e) => setConfigForm({ ...configForm, preferredSupplierId: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs disabled:opacity-60 disabled:bg-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Procurement Lead Time (Days)</label>
                          <input
                            type="number"
                            placeholder="e.g. 14"
                            value={configForm.procurementLeadTimeDays || ''}
                            onChange={(e) =>
                              setConfigForm({ ...configForm, procurementLeadTimeDays: parseInt(e.target.value) || 0 })
                            }
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs disabled:opacity-60 disabled:bg-slate-100"
                          />
                        </div>
                      </div>
                    </fieldset>
                  )}
                </div>
              )}

              {/* SECTION 7: Conditional Shelf-Life, Serial Number & Warranty Controls */}
              {showSection(7, 'D_COMPLIANCE') && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(7)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center">
                        7
                      </span>
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                        Conditional Shelf-Life, Serial Number & Warranty Controls
                      </span>
                    </div>
                    {expandedSections[7] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>
                  {expandedSections[7] && (
                    <fieldset disabled={isApprovedImmutable} className="m-0 p-0 border-0 min-w-0">
                      <div className="p-4 space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={configForm.shelfLifeControlled || false}
                              onChange={(e) => setConfigForm({ ...configForm, shelfLifeControlled: e.target.checked })}
                              className="w-4 h-4 rounded text-indigo-600"
                            />
                            <span className="font-bold text-slate-800">Shelf-Life Controlled</span>
                          </label>

                          <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={configForm.serialTrackingEnabled || false}
                              onChange={(e) => setConfigForm({ ...configForm, serialTrackingEnabled: e.target.checked })}
                              className="w-4 h-4 rounded text-indigo-600"
                            />
                            <span className="font-bold text-slate-800">Serial Number Tracked</span>
                          </label>

                          <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={configForm.warrantyApplicable || false}
                              onChange={(e) => setConfigForm({ ...configForm, warrantyApplicable: e.target.checked })}
                              className="w-4 h-4 rounded text-indigo-600"
                            />
                            <span className="font-bold text-slate-800">Warranty Applicable</span>
                          </label>
                        </div>

                        {configForm.shelfLifeControlled && (
                          <div className="grid grid-cols-3 gap-3 p-3 bg-indigo-50/40 rounded-lg border border-indigo-200">
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Shelf-Life Duration *</label>
                              <input
                                type="number"
                                placeholder="e.g. 12"
                                value={configForm.shelfLifeDuration || ''}
                                onChange={(e) =>
                                  setConfigForm({ ...configForm, shelfLifeDuration: parseInt(e.target.value) || 0 })
                                }
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Shelf-Life Unit *</label>
                              <select
                                value={configForm.shelfLifeUnit || 'MONTHS'}
                                onChange={(e) => setConfigForm({ ...configForm, shelfLifeUnit: e.target.value as any })}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                              >
                                <option value="DAYS">Days</option>
                                <option value="MONTHS">Months</option>
                                <option value="YEARS">Years</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Min Remaining Shelf-Life (Days)</label>
                              <input
                                type="number"
                                placeholder="e.g. 60"
                                value={configForm.minRemainingShelfLifeDays || ''}
                                onChange={(e) =>
                                  setConfigForm({ ...configForm, minRemainingShelfLifeDays: parseInt(e.target.value) || 0 })
                                }
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                              />
                            </div>
                          </div>
                        )}

                        {configForm.serialTrackingEnabled && (
                          <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50/40 rounded-lg border border-indigo-200">
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Serial Number Prefix</label>
                              <input
                                type="text"
                                placeholder="e.g. SN-KOSH-"
                                value={configForm.serialPrefix || ''}
                                onChange={(e) => setConfigForm({ ...configForm, serialPrefix: e.target.value })}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Serial Number Format</label>
                              <input
                                type="text"
                                placeholder="e.g. {PREFIX}{YY}{MM}-{SEQ:6}"
                                value={configForm.serialFormat || ''}
                                onChange={(e) => setConfigForm({ ...configForm, serialFormat: e.target.value })}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                              />
                            </div>
                          </div>
                        )}

                        {configForm.warrantyApplicable && (
                          <div className="grid grid-cols-3 gap-3 p-3 bg-indigo-50/40 rounded-lg border border-indigo-200">
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Warranty Duration *</label>
                              <input
                                type="number"
                                placeholder="e.g. 24"
                                value={configForm.warrantyDuration || ''}
                                onChange={(e) =>
                                  setConfigForm({ ...configForm, warrantyDuration: parseInt(e.target.value) || 0 })
                                }
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Warranty Unit *</label>
                              <select
                                value={configForm.warrantyUnit || 'MONTHS'}
                                onChange={(e) => setConfigForm({ ...configForm, warrantyUnit: e.target.value as any })}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                              >
                                <option value="DAYS">Days</option>
                                <option value="MONTHS">Months</option>
                                <option value="YEARS">Years</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Warranty Terms</label>
                              <input
                                type="text"
                                placeholder="Standard comprehensive warranty"
                                value={configForm.warrantyTerms || ''}
                                onChange={(e) => setConfigForm({ ...configForm, warrantyTerms: e.target.value })}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </fieldset>
                  )}
                </div>
              )}

              {/* SECTION 8: Minimum Order Quantity (MOQ), Order Multiple & Service Control */}
              {showSection(8, 'D_COMPLIANCE') && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(8)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center">
                        8
                      </span>
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                        Minimum Order Quantity (MOQ), Order Multiple & Service Control
                      </span>
                    </div>
                    {expandedSections[8] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>
                  {expandedSections[8] && (
                    <fieldset disabled={isApprovedImmutable} className="m-0 p-0 border-0 min-w-0">
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Minimum Order Qty (MOQ)</label>
                          <input
                            type="number"
                            value={configForm.moq ?? 1}
                            onChange={(e) => setConfigForm({ ...configForm, moq: parseFloat(e.target.value) || 1 })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Order Multiple</label>
                          <input
                            type="number"
                            value={configForm.orderMultiple ?? 1}
                            onChange={(e) => setConfigForm({ ...configForm, orderMultiple: parseFloat(e.target.value) || 1 })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer w-full">
                            <input
                              type="checkbox"
                              checked={configForm.serviceControlEnabled || false}
                              onChange={(e) => setConfigForm({ ...configForm, serviceControlEnabled: e.target.checked })}
                              className="w-4 h-4 rounded text-indigo-600"
                            />
                            <span className="font-bold text-slate-800">Service / AMC Control Required</span>
                          </label>
                        </div>
                      </div>
                    </fieldset>
                  )}
                </div>
              )}

              {/* SECTION 9: Batch Tracking, Lot Tracking, Quality Inspection, Storage & Regulatory Compliance */}
              {showSection(9, 'D_COMPLIANCE') && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(9)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center">
                        9
                      </span>
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                        Batch Tracking, Lot Tracking, Quality Inspection, Storage & Regulatory Compliance
                      </span>
                    </div>
                    {expandedSections[9] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>
                  {expandedSections[9] && (
                    <fieldset disabled={isApprovedImmutable} className="m-0 p-0 border-0 min-w-0">
                      <div className="p-4 space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={configForm.batchTrackingEnabled ?? true}
                              onChange={(e) => setConfigForm({ ...configForm, batchTrackingEnabled: e.target.checked })}
                              className="w-4 h-4 rounded text-indigo-600"
                            />
                            <span className="font-bold text-slate-800">Batch Tracking Enabled</span>
                          </label>
                          <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={configForm.lotTrackingEnabled || false}
                              onChange={(e) => setConfigForm({ ...configForm, lotTrackingEnabled: e.target.checked })}
                              className="w-4 h-4 rounded text-indigo-600"
                            />
                            <span className="font-bold text-slate-800">Lot Tracking Enabled</span>
                          </label>
                          <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={configForm.qualityInspectionRequired ?? true}
                              onChange={(e) => setConfigForm({ ...configForm, qualityInspectionRequired: e.target.checked })}
                              className="w-4 h-4 rounded text-indigo-600"
                            />
                            <span className="font-bold text-slate-800">Quality Inspection Required</span>
                          </label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">Inspection Type</label>
                            <select
                              value={configForm.inspectionType || 'RECEIVING'}
                              onChange={(e) => setConfigForm({ ...configForm, inspectionType: e.target.value as any })}
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                            >
                              <option value="RECEIVING">Receiving Inspection</option>
                              <option value="IN_PROCESS">In-Process Inspection</option>
                              <option value="PRE_DISPATCH">Pre-Dispatch Inspection</option>
                              <option value="LAB_CERT">Lab Certificate Required</option>
                            </select>
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">Storage Conditions</label>
                            <input
                              type="text"
                              placeholder="Ambient / Dry / < 25°C"
                              value={configForm.storageConditions || ''}
                              onChange={(e) => setConfigForm({ ...configForm, storageConditions: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">Regulatory Compliance Notes</label>
                            <input
                              type="text"
                              placeholder="RoHS / REACH / BIS / UL94"
                              value={configForm.regulatoryCompliance || ''}
                              onChange={(e) => setConfigForm({ ...configForm, regulatoryCompliance: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </fieldset>
                  )}
                </div>
              )}

              {/* SECTION 10: Multi-Warehouse Eligibility & Inventory Planning */}
              {showSection(10, 'E_WAREHOUSE') && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(10)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center">
                        10
                      </span>
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                        Multi-Warehouse Eligibility & Inventory Planning ({configForm.warehouseConfigs?.length || 0} Warehouses)
                      </span>
                    </div>
                    {expandedSections[10] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>
                  {expandedSections[10] && (
                    <fieldset disabled={isApprovedImmutable} className="m-0 p-0 border-0 min-w-0">
                      <div className="p-4 space-y-2.5">
                        {(configForm.warehouseConfigs || []).map((whConf, idx) => (
                          <div key={whConf.warehouseId} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={whConf.isEligible}
                                  onChange={(e) => {
                                    const updated = [...(configForm.warehouseConfigs || [])];
                                    updated[idx].isEligible = e.target.checked;
                                    setConfigForm({ ...configForm, warehouseConfigs: updated });
                                  }}
                                  className="w-4 h-4 rounded text-indigo-600"
                                />
                                <span className="font-mono font-bold text-indigo-800">[{whConf.warehouseCode}]</span>
                                <span className="font-bold text-slate-900">{whConf.warehouseName}</span>
                                {whConf.isPreferred && (
                                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                                    ★ Preferred Warehouse
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  const updated = (configForm.warehouseConfigs || []).map((w, i) => ({
                                    ...w,
                                    isPreferred: i === idx,
                                  }));
                                  setConfigForm({ ...configForm, warehouseConfigs: updated });
                                }}
                                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer disabled:opacity-50"
                              >
                                Set as Preferred
                              </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                              <div>
                                <label className="block text-[11px] text-slate-500 font-medium mb-1">Bin / Location</label>
                                <input
                                  type="text"
                                  value={whConf.storageLocation || ''}
                                  onChange={(e) => {
                                    const updated = [...(configForm.warehouseConfigs || [])];
                                    updated[idx].storageLocation = e.target.value;
                                    setConfigForm({ ...configForm, warehouseConfigs: updated });
                                  }}
                                  placeholder="BIN-A1-01"
                                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-slate-500 font-medium mb-1">Safety Stock</label>
                                <input
                                  type="number"
                                  value={whConf.safetyStock || 0}
                                  onChange={(e) => {
                                    const updated = [...(configForm.warehouseConfigs || [])];
                                    updated[idx].safetyStock = parseFloat(e.target.value) || 0;
                                    setConfigForm({ ...configForm, warehouseConfigs: updated });
                                  }}
                                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-slate-500 font-medium mb-1">Reorder Level</label>
                                <input
                                  type="number"
                                  value={whConf.reorderLevel || 0}
                                  onChange={(e) => {
                                    const updated = [...(configForm.warehouseConfigs || [])];
                                    updated[idx].reorderLevel = parseFloat(e.target.value) || 0;
                                    setConfigForm({ ...configForm, warehouseConfigs: updated });
                                  }}
                                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-slate-500 font-medium mb-1">Maximum Stock</label>
                                <input
                                  type="number"
                                  value={whConf.maximumStock || 0}
                                  onChange={(e) => {
                                    const updated = [...(configForm.warehouseConfigs || [])];
                                    updated[idx].maximumStock = parseFloat(e.target.value) || 0;
                                    setConfigForm({ ...configForm, warehouseConfigs: updated });
                                  }}
                                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-slate-500 font-medium mb-1">Replenishment</label>
                                <select
                                  value={whConf.replenishmentMethod || 'REORDER_POINT'}
                                  onChange={(e) => {
                                    const updated = [...(configForm.warehouseConfigs || [])];
                                    updated[idx].replenishmentMethod = e.target.value as any;
                                    setConfigForm({ ...configForm, warehouseConfigs: updated });
                                  }}
                                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                                >
                                  <option value="MIN_MAX">Min / Max</option>
                                  <option value="REORDER_POINT">Reorder Point</option>
                                  <option value="MRP">MRP Driven</option>
                                  <option value="ON_DEMAND">On Demand</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </div>
              )}

              {/* SECTION 11: Approved Alternative / Substitute Item References */}
              {showSection(11, 'F_ALTERNATIVES') && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(11)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center">
                        11
                      </span>
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                        Approved Alternative / Substitute Item References ({configForm.alternativeItems?.length || 0})
                      </span>
                    </div>
                    {expandedSections[11] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>
                  {expandedSections[11] && (
                    <fieldset disabled={isApprovedImmutable} className="m-0 p-0 border-0 min-w-0">
                      <div className="p-4 space-y-3">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Target Alternative Item</label>
                              <select
                                value={newAltItemId}
                                onChange={(e) => setNewAltItemId(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                              >
                                <option value="">Select Approved Item...</option>
                                {items
                                  .filter((i) => i.id !== configItem.id)
                                  .map((i) => (
                                    <option key={i.id} value={i.id}>
                                      [{i.globalItemCode}] {i.description}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Relationship Type</label>
                              <select
                                value={newAltRelType}
                                onChange={(e) => setNewAltRelType(e.target.value as any)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                              >
                                <option value="ALTERNATIVE">Alternative (Form/Fit/Function Compatible)</option>
                                <option value="SUBSTITUTE">Substitute (Conditional Approval)</option>
                                <option value="EQUIVALENT">Equivalent (Exact Technical Match)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Justification Reason</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="e.g. Dual-source alternative supplier"
                                  value={newAltReason}
                                  onChange={(e) => setNewAltReason(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={handleAddAlternative}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer disabled:opacity-50"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left bg-white rounded-lg border border-slate-200">
                            <thead>
                              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                                <th className="p-2.5">Alt Item Code</th>
                                <th className="p-2.5">Description</th>
                                <th className="p-2.5">Relationship</th>
                                <th className="p-2.5">Reason</th>
                                <th className="p-2.5 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(configForm.alternativeItems || []).length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="p-4 text-center text-slate-400">
                                    No alternative items mapped yet.
                                  </td>
                                </tr>
                              ) : (
                                (configForm.alternativeItems || []).map((alt) => (
                                  <tr key={alt.id} className="hover:bg-slate-50">
                                    <td className="p-2.5 font-mono font-bold text-indigo-700">{alt.alternativeGlobalItemCode}</td>
                                    <td className="p-2.5 text-slate-700">{alt.alternativeGlobalItemDescription || '—'}</td>
                                    <td className="p-2.5">
                                      <span className="font-bold text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                                        {alt.relationshipType}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-slate-600">{alt.reason}</td>
                                    <td className="p-2.5 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveAlternative(alt.id)}
                                        className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer disabled:opacity-50"
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </fieldset>
                  )}
                </div>
              )}

              {/* SECTION 12: Branch Technical & Compliance Attachments */}
              {showSection(12, 'G_ATTACHMENTS') && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(12)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center">
                        12
                      </span>
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                        Branch Technical & Compliance Attachments ({configForm.attachments?.length || 0})
                      </span>
                    </div>
                    {expandedSections[12] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>
                  {expandedSections[12] && (
                    <fieldset disabled={isApprovedImmutable} className="m-0 p-0 border-0 min-w-0">
                      <div className="p-4 space-y-3">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Doc Type</label>
                              <select
                                value={newAttType}
                                onChange={(e) => setNewAttType(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                              >
                                <option value="TECHNICAL_DATASHEET">Technical Datasheet (TDS)</option>
                                <option value="ENGINEERING_DRAWING">Engineering Drawing (CAD)</option>
                                <option value="TECHNICAL_SPECIFICATION">Technical Specification</option>
                                <option value="TEST_CERTIFICATE">Test Certificate</option>
                                <option value="QUALITY_CERTIFICATE">Quality Certificate</option>
                                <option value="SAFETY_DATA_SHEET">Safety Data Sheet (MSDS)</option>
                                <option value="REGULATORY_CERTIFICATE">Regulatory Certificate</option>
                                <option value="OTHER">Other Compliance Document</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">File Name</label>
                              <input
                                type="text"
                                placeholder="e.g. TDS_PA_Injection_V0.pdf"
                                value={newAttFileName}
                                onChange={(e) => setNewAttFileName(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">File Reference / URL</label>
                              <input
                                type="text"
                                placeholder="/assets/docs/tds_spec_2026.pdf"
                                value={newAttFileRef}
                                onChange={(e) => setNewAttFileRef(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Version</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="v1.0"
                                  value={newAttVersion}
                                  onChange={(e) => setNewAttVersion(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={handleAddAttachment}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer disabled:opacity-50"
                                >
                                  Attach
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left bg-white rounded-lg border border-slate-200">
                            <thead>
                              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                                <th className="p-2.5">Document Type</th>
                                <th className="p-2.5">File Name</th>
                                <th className="p-2.5">Version</th>
                                <th className="p-2.5">Uploaded By</th>
                                <th className="p-2.5">Status</th>
                                <th className="p-2.5 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(configForm.attachments || []).length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="p-4 text-center text-slate-400">
                                    No attachments uploaded yet.
                                  </td>
                                </tr>
                              ) : (
                                (configForm.attachments || []).map((att) => (
                                  <tr key={att.id} className="hover:bg-slate-50">
                                    <td className="p-2.5 font-bold text-slate-800">{att.documentType}</td>
                                    <td className="p-2.5 font-mono text-indigo-700">{att.fileName}</td>
                                    <td className="p-2.5 font-mono text-slate-600">{att.documentVersion}</td>
                                    <td className="p-2.5 text-slate-600">{att.uploadedBy}</td>
                                    <td className="p-2.5">
                                      <span className="font-bold text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                                        {att.approvalStatus}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveAttachment(att.id)}
                                        className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer disabled:opacity-50"
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </fieldset>
                  )}
                </div>
              )}

              {/* SECTION 13: Barcode / GTIN Governance & Branch Revision Control */}
              {showSection(13, 'H_BARCODES') && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(13)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center">
                        13
                      </span>
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                        Barcode / GTIN Governance & Branch Revision Control
                      </span>
                    </div>
                    {expandedSections[13] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>
                  {expandedSections[13] && (
                    <fieldset disabled={isApprovedImmutable} className="m-0 p-0 border-0 min-w-0">
                      <div className="p-4 space-y-4">
                        {/* Barcodes */}
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                          <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <Barcode className="w-3.5 h-3.5 text-indigo-600" /> Register Barcode / GTIN
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Barcode Value</label>
                              <input
                                type="text"
                                placeholder="e.g. 8901234567890"
                                value={newBarcodeVal}
                                onChange={(e) => setNewBarcodeVal(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                              />
                            </div>
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Barcode Standard Type</label>
                              <select
                                value={newBarcodeType}
                                onChange={(e) => setNewBarcodeType(e.target.value as any)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                              >
                                <option value="EAN13">EAN-13 (Standard Retail)</option>
                                <option value="UPC">UPC-A</option>
                                <option value="CODE128">Code-128 (Logistics/Internal)</option>
                                <option value="QR">2D QR Code</option>
                                <option value="GTIN14">GTIN-14 (Carton Shipping)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">GTIN Number (Optional)</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="14-digit GTIN"
                                  value={newBarcodeGtin}
                                  onChange={(e) => setNewBarcodeGtin(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={handleAddBarcode}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer disabled:opacity-50"
                                >
                                  Register
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 pt-1">
                            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-xs">
                              <input
                                type="checkbox"
                                checked={newBarcodeShared}
                                onChange={(e) => setNewBarcodeShared(e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600"
                              />
                              <span>Intentionally Shared Barcode</span>
                            </label>
                            {newBarcodeShared && (
                              <input
                                type="text"
                                placeholder="Shared justification (required)..."
                                value={newBarcodeSharedJust}
                                onChange={(e) => setNewBarcodeSharedJust(e.target.value)}
                                className="flex-1 px-3 py-1 border border-amber-300 bg-amber-50 rounded text-xs"
                              />
                            )}
                          </div>

                          {(configForm.barcodes || []).length > 0 && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left bg-white rounded-lg border border-slate-200">
                                <thead>
                                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                                    <th className="p-2">Barcode Value</th>
                                    <th className="p-2">Type</th>
                                    <th className="p-2">GTIN</th>
                                    <th className="p-2">Shared Status</th>
                                    <th className="p-2 text-right">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {(configForm.barcodes || []).map((bc) => (
                                    <tr key={bc.id}>
                                      <td className="p-2 font-mono font-bold text-indigo-700">{bc.barcodeValue}</td>
                                      <td className="p-2 font-mono text-slate-800">{bc.barcodeType}</td>
                                      <td className="p-2 font-mono text-slate-600">{bc.gtin || '—'}</td>
                                      <td className="p-2 text-slate-600">
                                        {bc.isIntentionallyShared ? `Shared: ${bc.sharedJustification}` : 'Unique'}
                                      </td>
                                      <td className="p-2 text-right">
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveBarcode(bc.id)}
                                          className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer disabled:opacity-50"
                                        >
                                          Remove
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Revisions */}
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                          <h5 className="font-bold text-slate-800 text-xs">Branch Revision Control & ECN Log</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Revision Number</label>
                              <input
                                type="text"
                                placeholder="e.g. REV-002"
                                value={newRevNumber}
                                onChange={(e) => setNewRevNumber(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                              />
                            </div>
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Technical Change Ref</label>
                              <input
                                type="text"
                                placeholder="e.g. ECN-2026-089"
                                value={newRevTechRef}
                                onChange={(e) => setNewRevTechRef(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Revision Description</label>
                              <input
                                type="text"
                                placeholder="e.g. Added moisture barrier packaging"
                                value={newRevDesc}
                                onChange={(e) => setNewRevDesc(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">Change Reason</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="Quality upgrade"
                                  value={newRevReason}
                                  onChange={(e) => setNewRevReason(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={handleAddRevision}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer disabled:opacity-50"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            {(configForm.revisionHistory || []).map((rev) => (
                              <div
                                key={rev.id}
                                className="p-2 bg-white rounded border border-slate-200 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-mono font-bold text-indigo-700 mr-2">[{rev.revisionNumber}]</span>
                                  <span className="font-bold text-slate-800">{rev.revisionDescription}</span>
                                  <span className="text-slate-500 ml-2">({rev.changeReason})</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Effective: {rev.effectiveFrom} • Approved by: {rev.approvedBy || 'Plant Checker'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </fieldset>
                  )}
                </div>
              )}

              {/* SECTION 14: Effective Dates, 25-Checkpoint Rule Audit & Dual Maker-Checker Workflow History */}
              {showSection(14, 'K_AUDIT_HISTORY') && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(14)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center">
                        14
                      </span>
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                        Effective Dates, 25-Checkpoint Rule Audit & Dual Maker-Checker Workflow History
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {auditReport && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            auditReport.overallResult === 'PASS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : auditReport.overallResult === 'WARNING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          Audit: {auditReport.overallResult}
                        </span>
                      )}
                      {expandedSections[14] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </button>

                  {expandedSections[14] && (
                    <div className="p-4 space-y-5">
                      {/* Effective Date & Reason */}
                      <fieldset disabled={isApprovedImmutable} className="m-0 p-0 border-0 min-w-0">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">Effective From Date *</label>
                            <input
                              type="date"
                              value={configForm.effectiveFrom || ''}
                              onChange={(e) => setConfigForm({ ...configForm, effectiveFrom: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs disabled:opacity-60 disabled:bg-slate-100"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block font-bold text-slate-700 mb-1">Activation / Governance Reason *</label>
                            <input
                              type="text"
                              placeholder="e.g. Standard production requirement"
                              value={configForm.activationReason || ''}
                              onChange={(e) => setConfigForm({ ...configForm, activationReason: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs disabled:opacity-60 disabled:bg-slate-100"
                            />
                          </div>
                        </div>
                      </fieldset>

                      {/* 25-Checkpoint Audit Summary Card */}
                      {auditReport && (
                        <div
                          className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                            auditReport.overallResult === 'PASS'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                              : auditReport.overallResult === 'WARNING'
                              ? 'bg-amber-50 border-amber-200 text-amber-950'
                              : 'bg-rose-50 border-rose-200 text-rose-950'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {auditReport.overallResult === 'PASS' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                              {auditReport.overallResult === 'WARNING' && <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />}
                              {(auditReport.overallResult === 'ERROR' || auditReport.overallResult === 'BLOCKED') && (
                                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                              )}
                              <span className="font-bold text-sm">
                                25-Checkpoint Audit Status: [{auditReport.overallResult}] —{' '}
                                {auditReport.canSubmit
                                  ? 'Ready for Dual Maker-Checker Submission'
                                  : 'SUBMISSION BLOCKED: Mandatory Errors Unresolved'}
                              </span>
                            </div>
                            <p className="text-xs opacity-90">
                              Evaluated by {auditReport.evaluatedBy} on {new Date(auditReport.timestamp).toLocaleString()} • Audit ID:{' '}
                              <span className="font-mono font-bold">{auditReport.auditId}</span>
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                            <span className="px-2.5 py-1 bg-white/80 rounded border">
                              Total: {auditReport.checkpoints.length}
                            </span>
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded border border-emerald-200">
                              Pass: {auditReport.checkpoints.filter((c) => c.status === 'PASS').length}
                            </span>
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded border border-amber-200">
                              Warn: {auditReport.warnings.length}
                            </span>
                            <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded border border-rose-200">
                              Errors: {auditReport.errors.length}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* 25 Checkpoints List */}
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-indigo-600" />
                            <span>25-Checkpoint Evaluation Details</span>
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">Rule Version: v{auditReport?.ruleVersion || 1}</span>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[260px] overflow-y-auto">
                          {(auditReport?.checkpoints || []).map((cp, idx) => (
                            <div
                              key={cp.checkpointKey}
                              className={`p-2.5 text-xs flex items-start justify-between gap-3 ${
                                cp.status === 'ERROR' || cp.status === 'BLOCKED' ? 'bg-rose-50/40' : ''
                              }`}
                            >
                              <div className="space-y-0.5 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] text-slate-400 font-bold">
                                    #{String(idx + 1).padStart(2, '0')}
                                  </span>
                                  <span className="font-bold text-slate-900">{cp.checkpointLabel}</span>
                                </div>
                                <p className="text-slate-600 text-[11px]">{cp.message}</p>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
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

                      {/* Append-Only Branch Change History */}
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <History className="w-4 h-4 text-indigo-600" />
                            <span>Branch Field-Level Change History ({changeHistoryEntries.length} entries)</span>
                          </span>
                          <select
                            value={historyFilterField}
                            onChange={(e) => setHistoryFilterField(e.target.value)}
                            className="px-2 py-1 text-[11px] bg-white border border-slate-300 rounded font-medium"
                          >
                            <option value="ALL">All Attributes</option>
                            <option value="categoryCode">Category Code</option>
                            <option value="branchPurchaseUom">Purchase UOM</option>
                            <option value="branchInventoryUom">Inventory UOM</option>
                            <option value="moq">MOQ</option>
                            <option value="branchStatus">Workflow Status</option>
                          </select>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto">
                          {changeHistoryEntries.length === 0 ? (
                            <div className="p-4 text-center text-slate-400 text-xs">No field mutations recorded yet.</div>
                          ) : (
                            changeHistoryEntries
                              .filter((h) => historyFilterField === 'ALL' || h.fieldAttribute === historyFilterField)
                              .map((entry) => (
                                <div key={entry.id} className="p-2.5 text-xs space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-indigo-700 font-mono">{entry.fieldAttribute}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {new Date(entry.changedAt).toLocaleString()} by {entry.changedBy}
                                    </span>
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-600">
                                    <span className="text-rose-700">{entry.previousValue || '(empty)'}</span> →{' '}
                                    <span className="text-emerald-700 font-bold">{entry.newValue || '(empty)'}</span>
                                  </div>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Purchase Requisition-Aligned Sticky Modal Footer with Exact 4 Required Actions */}
            <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>
                  25-Checkpoint Status:{' '}
                  <strong className="text-slate-800">{auditReport?.overallResult || 'NOT_EVALUATED'}</strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isApprovedImmutable}
                  onClick={handleSaveDraftAction}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-xs shadow-2xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Draft</span>
                </button>
                <button
                  type="button"
                  onClick={handleRunAudit}
                  disabled={isRunningAudit}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <ShieldCheck className={`w-3.5 h-3.5 ${isRunningAudit ? 'animate-spin' : ''}`} />
                  <span>Validate Rules</span>
                </button>
                <button
                  type="button"
                  disabled={isApprovedImmutable}
                  onClick={handleSubmitForCheckerApproval}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit for Checker Approval</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
