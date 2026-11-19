/**
 * CIPPLATFORM - PURCHASE REQUISITION LIST & ADVANCED CONFIGURABLE DATA GRID VIEW
 * Master Enterprise Responsive UI/UX Transformation + PR Governance Suite:
 * - Full-width Desktop Configurable Data Grid (100% workspace width, column resize/reorder/sort/persist)
 * - Tablet Compact Expandable Data Table (768px–1023px, zero horizontal scroll)
 * - Mobile Record Card List (< 768px & Mobile Landscape: 1-col portrait, 2-col landscape, zero horizontal scroll)
 * - Responsive Search & Filter Drawer (Desktop inline, Tablet wrapped, Mobile slide-up filter drawer)
 * - Controlled Bulk Processing Preview & Execution Modal (Submit, Approve, Return, Short Close, Cancel)
 * - Consolidated Multi-Currency & INR Reporting Analytics Panel
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User } from '../../types';
import { PurchaseRequisitionHeader, PRType, PRStatus } from '../../types/purchaseRequisition';
import { PurchaseRequisitionService } from '../../services/purchaseRequisitionService';
import {
  prGovernancePolicyService,
  canViewPrGovernancePolicyStrip,
} from '../../services/prGovernancePolicyService';
import { prDuplicateGovernanceService } from '../../services/prDuplicateGovernanceService';
import { financialYearService } from '../../services/financialYearService';
import { FinancialYearSelector } from '../../components/FinancialYearSelector';
import {
  useViewportAndOrientation,
  ResponsiveKPIGrid,
  MobileRecordCard,
  ResponsiveFilterPanel,
} from '../../components/ResponsiveWorkspace';
import { DataGridFooter } from '../../components/DataGridFooter';
import { dataGridService } from '../../services/dataGridService';
import { executeScopedExport } from '../../services/exportService';
import { rbacPermissionService } from '../../services/rbacPermissionService';
import {
  AVAILABLE_PR_COLUMNS,
  AVAILABLE_PR_LINE_COLUMNS,
  PRColumnKey,
  PRLineColumnKey,
  PRLineGridRow,
  PRNamedGridLayout,
  PRUserColumnState,
  PRSortRule,
  PRViewType,
  getColumnDefinition,
  getLineColumnDefinition,
  getDefaultColumnStates,
  getDefaultLineColumnStates,
  getUserGridLayout,
  saveUserGridLayout,
  clampColumnWidth,
  clampLineColumnWidth,
  calculateAutoFitWidth,
  calculateLineAutoFitWidth,
  reorderColumns,
  toggleSortRule,
  sortPrRecords,
  sortPrLineRecords,
  flattenPrLines,
  listSavedViewLayouts,
  getActiveSavedViewLayout,
  saveNamedViewLayout,
  loadSavedViewLayoutById,
  setDefaultSavedViewLayout,
  deleteSavedViewLayout,
  resetViewGridLayout,
  formatEstimatedValue,
  getPrCurrency,
  getExpectedDeliveryDate,
  getRequiredByDate,
  getEffectivePRStatus,
  getBuyerStatus,
  getAssignedBuyer,
  getModifiedBy,
  getColumnDisplayText,
  getLineColumnDisplayText,
} from '../../services/prGridConfigService';
import { PrColumnSettingsModal } from './PrColumnSettingsModal';
import { PrSavedLayoutsModal } from './PrSavedLayoutsModal';
import { printPurchaseRequisitionPdf, isPrStatusApproved } from '../../services/prPdfExportService';
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
  parseMultiSelectFilter,
  matchesMultiSelectFilter,
  formatMultiSelectFilterLabel,
} from '../../services/advancedFilterEngine';
import {
  AdvancedFilterPanel,
  DateRangeFilterControl,
  ActiveFilterChipsBar,
  AdvancedFilterToggleButton,
  MultiSelectFilterDropdown,
} from '../../components/AdvancedFilterPanel';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  ShieldAlert,
  Trash2,
  RefreshCw,
  Download,
  SlidersHorizontal,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RotateCcw,
  BookmarkCheck,
  X,
  Calendar,
  ChevronUp,
  ChevronDown,
  Filter,
  Layers,
  BarChart3,
} from 'lucide-react';

interface PurchaseRequisitionListViewProps {
  currentUser: User;
  onOpenCreateModal: () => void;
  onOpenDetailsModal: (pr: PurchaseRequisitionHeader) => void;
  onOpenCleanupView: () => void;
}

export const PurchaseRequisitionListView: React.FC<PurchaseRequisitionListViewProps> = ({
  currentUser,
  onOpenCreateModal,
  onOpenDetailsModal,
  onOpenCleanupView,
}) => {
  const userId = currentUser?.id || 'usr-default';
  const viewport = useViewportAndOrientation();
  const { isDesktop, isTablet, isMobile, isMobileLandscape } = viewport;

  const [prs, setPrs] = useState<PurchaseRequisitionHeader[]>(() =>
    PurchaseRequisitionService.getPurchaseRequisitions()
  );
  const [selectedFyId, setSelectedFyId] = useState<string>(() =>
    financialYearService.getDefaultFinancialYearForCompany(currentUser?.orgId || 'co-kosh-01')?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedBudgetStatus, setSelectedBudgetStatus] = useState<string>('ALL');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('ALL');
  const [deliveryDateFilter, setDeliveryDateFilter] = useState<string>('');
  const [prDateRange, setPrDateRange] = useState<DateRangeFilterValue>({ from: '', to: '' });
  const [expectedDeliveryDateRange, setExpectedDeliveryDateRange] = useState<DateRangeFilterValue>({
    from: '',
    to: '',
  });
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState<boolean>(false);
  const [advancedFilterState, setAdvancedFilterState] = useState<AdvancedFilterState>(() =>
    createInitialAdvancedFilterState()
  );
  const [minEstimatedValue, setMinEstimatedValue] = useState<string>('');
  const [viewMode, setViewMode] = useState<PRViewType>('HEADER');
  const [selectedHeaderIds, setSelectedHeaderIds] = useState<Set<string>>(new Set());
  const [selectedLineRowIds, setSelectedLineRowIds] = useState<Set<string>>(new Set());

  // Mobile Filter Drawer state
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Tablet expanded row state
  const [expandedTabletRows, setExpandedTabletRows] = useState<Set<string>>(new Set());

  // Controlled Bulk Processing Modal state (Requirement J)
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<
    'SUBMIT' | 'APPROVE' | 'RETURN' | 'SHORT_CLOSE' | 'CANCEL'
  >('APPROVE');
  const [bulkReason, setBulkReason] = useState('Standard Batch Governance Processing');
  const [bulkRemarks, setBulkRemarks] = useState('');
  const [bulkOutcomeReport, setBulkOutcomeReport] = useState<{
    overallOutcome: 'COMPLETE_SUCCESS' | 'PARTIAL_FAILURE' | 'ALL_FAILED';
    succeeded: Array<{ prId: string; prNumber: string; message: string }>;
    failed: Array<{ prId: string; prNumber: string; reason: string }>;
    skipped: Array<{ prId: string; prNumber: string; reason: string }>;
  } | null>(null);

  // Consolidated Governance & Financial Report Modal state (Requirement O)
  const [showConsolidatedReport, setShowConsolidatedReport] = useState(false);

  const deviceType: 'desktop' | 'tablet' | 'mobile' = isMobile
    ? 'mobile'
    : isTablet
    ? 'tablet'
    : 'desktop';

  const currentCompanyId = currentUser?.orgId || 'co-kosh-01';
  const currentBranchId = currentUser?.allowedBranchIds?.[0] || 'br-pond-01';
  const layoutCompanyScope = selectedCompany !== 'ALL' ? selectedCompany : currentCompanyId;

  // Separate, view-isolated layout states so switching Header <-> Line never loses unsaved edits or crosses schemas
  const initialHeaderNamed = useMemo(
    () => getActiveSavedViewLayout<PRColumnKey>(userId, 'HEADER', layoutCompanyScope),
    [userId, layoutCompanyScope]
  );
  const initialHeaderLegacy = useMemo(() => getUserGridLayout(userId), [userId]);
  const initialLineNamed = useMemo(
    () => getActiveSavedViewLayout<PRLineColumnKey>(userId, 'LINE', layoutCompanyScope),
    [userId, layoutCompanyScope]
  );

  const [headerColumnStates, setHeaderColumnStates] = useState<PRUserColumnState<PRColumnKey>[]>(
    () => initialHeaderNamed?.columns || initialHeaderLegacy.columns
  );
  const [headerSortRules, setHeaderSortRules] = useState<PRSortRule<PRColumnKey>[]>(
    () => initialHeaderNamed?.sortRules || initialHeaderLegacy.sortRules
  );
  const [activeHeaderLayoutId, setActiveHeaderLayoutId] = useState<string | null>(
    () => initialHeaderNamed?.id || null
  );

  const [lineColumnStates, setLineColumnStates] = useState<PRUserColumnState<PRLineColumnKey>[]>(
    () => initialLineNamed?.columns || getDefaultLineColumnStates()
  );
  const [lineSortRules, setLineSortRules] = useState<PRSortRule<PRLineColumnKey>[]>(
    () => initialLineNamed?.sortRules || []
  );
  const [activeLineLayoutId, setActiveLineLayoutId] = useState<string | null>(
    () => initialLineNamed?.id || null
  );

  const [layoutToast, setLayoutToast] = useState<{ type: 'info' | 'error'; message: string } | null>(
    null
  );
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [headerPageSize, setHeaderPageSize] = useState<number>(() => {
    if (initialHeaderNamed?.pageSize) {
      return dataGridService.normalizePageSize(initialHeaderNamed.pageSize);
    }
    const saved = dataGridService.getUserGridPreference('purchase-requisition-list', userId, deviceType);
    return saved?.pageSize ?? dataGridService.getGlobalGridSettings().defaultPageSize ?? 20;
  });
  const [linePageSize, setLinePageSize] = useState<number>(() => {
    if (initialLineNamed?.pageSize) {
      return dataGridService.normalizePageSize(initialLineNamed.pageSize);
    }
    const saved = dataGridService.getUserGridPreference('purchase-requisition-line-list', userId, deviceType);
    return saved?.pageSize ?? dataGridService.getGlobalGridSettings().defaultPageSize ?? 20;
  });

  // Column Settings & Saved Layouts Modal State
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showSavedLayoutsModal, setShowSavedLayoutsModal] = useState(false);
  const [layoutPersistError, setLayoutPersistError] = useState<string | null>(null);
  const [savedLayoutsTick, setSavedLayoutsTick] = useState(0);

  // Drag-and-drop column reordering state
  const [draggedColKey, setDraggedColKey] = useState<string | null>(null);
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null);

  // Column resizing ref state
  const resizingRef = useRef<{
    view: PRViewType;
    key: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  // Reload user view-specific layouts when userId or company scope changes
  useEffect(() => {
    const hNamed = getActiveSavedViewLayout<PRColumnKey>(userId, 'HEADER', layoutCompanyScope);
    const hLegacy = getUserGridLayout(userId);
    setHeaderColumnStates(hNamed?.columns || hLegacy.columns);
    setHeaderSortRules(hNamed?.sortRules || hLegacy.sortRules);
    setActiveHeaderLayoutId(hNamed?.id || null);

    const lNamed = getActiveSavedViewLayout<PRLineColumnKey>(userId, 'LINE', layoutCompanyScope);
    setLineColumnStates(lNamed?.columns || getDefaultLineColumnStates());
    setLineSortRules(lNamed?.sortRules || []);
    setActiveLineLayoutId(lNamed?.id || null);

    setCurrentPage(1);
  }, [userId, layoutCompanyScope]);

  // Synchronize device-scoped rows-per-page preference without resetting unsaved column/sort state
  useEffect(() => {
    const hNamed = getActiveSavedViewLayout<PRColumnKey>(userId, 'HEADER', layoutCompanyScope);
    const hPref = dataGridService.getUserGridPreference('purchase-requisition-list', userId, deviceType);
    setHeaderPageSize(
      hNamed?.pageSize
        ? dataGridService.normalizePageSize(hNamed.pageSize)
        : hPref?.pageSize ?? dataGridService.getGlobalGridSettings().defaultPageSize ?? 20
    );

    const lNamed = getActiveSavedViewLayout<PRLineColumnKey>(userId, 'LINE', layoutCompanyScope);
    const lPref = dataGridService.getUserGridPreference('purchase-requisition-line-list', userId, deviceType);
    setLinePageSize(
      lNamed?.pageSize
        ? dataGridService.normalizePageSize(lNamed.pageSize)
        : lPref?.pageSize ?? dataGridService.getGlobalGridSettings().defaultPageSize ?? 20
    );
  }, [userId, deviceType, layoutCompanyScope]);

  const [governanceTick, setGovernanceTick] = useState(0);

  // Listen for PR updates and PR Governance policy updates
  useEffect(() => {
    const handlePrsUpdated = () => {
      setPrs(PurchaseRequisitionService.getPurchaseRequisitions());
    };
    const handleGovernanceUpdated = () => {
      setGovernanceTick((t) => t + 1);
    };
    window.addEventListener('cip-prs-updated', handlePrsUpdated);
    window.addEventListener('cip-pr-governance-updated', handleGovernanceUpdated);
    void prDuplicateGovernanceService.syncPrsWithBackend(PurchaseRequisitionService.getPurchaseRequisitions());
    void prDuplicateGovernanceService.hydrateFromBackend();
    return () => {
      window.removeEventListener('cip-prs-updated', handlePrsUpdated);
      window.removeEventListener('cip-pr-governance-updated', handleGovernanceUpdated);
    };
  }, []);

  const showFeedbackToast = (message: string, type: 'info' | 'error' = 'info') => {
    setLayoutToast({ type, message });
    setTimeout(() => {
      setLayoutToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  const handleRefresh = () => {
    setPrs(PurchaseRequisitionService.getPurchaseRequisitions());
    showFeedbackToast(
      viewMode === 'HEADER'
        ? 'Purchase Requisition Header View refreshed.'
        : 'Purchase Requisition Line / Live View refreshed.'
    );
  };

  // Ordered columns for Header View & Line View
  const orderedHeaderColumns = useMemo(
    () => [...headerColumnStates].sort((a, b) => a.order - b.order),
    [headerColumnStates]
  );
  const visibleHeaderColumns = useMemo(
    () => orderedHeaderColumns.filter((c) => c.visible),
    [orderedHeaderColumns]
  );

  const orderedLineColumns = useMemo(
    () => [...lineColumnStates].sort((a, b) => a.order - b.order),
    [lineColumnStates]
  );
  const visibleLineColumns = useMemo(
    () => orderedLineColumns.filter((c) => c.visible),
    [orderedLineColumns]
  );

  const activeVisibleColumnCount =
    viewMode === 'HEADER' ? visibleHeaderColumns.length : visibleLineColumns.length;
  const activeTotalColumnCount =
    viewMode === 'HEADER' ? AVAILABLE_PR_COLUMNS.length : AVAILABLE_PR_LINE_COLUMNS.length;

  const savedLayoutsForActiveView = useMemo(
    () => listSavedViewLayouts(userId, viewMode, layoutCompanyScope),
    [userId, viewMode, layoutCompanyScope, savedLayoutsTick]
  );
  const activeLayoutId = viewMode === 'HEADER' ? activeHeaderLayoutId : activeLineLayoutId;
  const hasSavedLayout = savedLayoutsForActiveView.length > 0;

  // Check branch applicability & authoritative PR Governance Policy
  const effectivePolicy = useMemo(
    () => prGovernancePolicyService.getEffectivePolicy(currentCompanyId, currentBranchId),
    [currentCompanyId, currentBranchId, governanceTick]
  );
  const canCreatePrCheck = prGovernancePolicyService.evaluatePrAction({
    action: 'CREATE_PR',
    companyId: currentCompanyId,
    branchId: currentBranchId,
    user: currentUser,
  });
  const isApplicable =
    canCreatePrCheck.allowed &&
    PurchaseRequisitionService.isPRApplicable(currentBranchId, 'MANUAL', currentCompanyId);

  // Centralized Financial Year & RBAC Filter (preserves original dates & surfaces Data-Quality Gaps)
  const fyFilterResult = useMemo(
    () =>
      financialYearService.filterTransactionsByFinancialYear({
        records: prs,
        selectedFyId,
        companyId: 'ALL',
        currentUser,
        entityType: 'PURCHASE_REQUISITION',
        getRecordId: (pr) => pr.id,
        getDocumentNumber: (pr) => pr.prNumber,
        getCompanyId: (pr) => pr.companyId,
        getBranchId: (pr) => pr.branchId,
        getPurchaseOrgId: (pr) => pr.purchaseOrganizationId,
        getFinancialYearId: (pr) => pr.financialYearId,
        getFinancialYearCode: (pr) => pr.financialYearCode || pr.financialPeriod,
        getAccountingPostingDate: (pr) => pr.accountingPostingDate,
        getDocumentDate: (pr) => (pr.createdAt ? pr.createdAt.slice(0, 10) : undefined),
      }),
    [prs, selectedFyId, currentUser]
  );

  const fyScopedPrs = fyFilterResult.filteredRecords;
  const isHistoricalReadOnly = fyFilterResult.isHistoricalReadOnly;

  // Dynamic Filter Options derived from FY & RBAC-scoped PRs
  const filterOptions = useMemo(() => {
    const companiesMap = new Map<string, string>();
    const branchesMap = new Map<string, string>();
    const departments = new Set<string>();
    const currencies = new Set<string>(['INR', 'USD', 'EUR', 'GBP']);

    fyScopedPrs.forEach((pr) => {
      if (pr.companyId) {
        companiesMap.set(pr.companyId, pr.companyCode || pr.companyId);
      }
      if (pr.branchName) {
        branchesMap.set(pr.branchId || pr.branchName, pr.branchName);
      }
      if (pr.department) {
        departments.add(pr.department);
      }
      currencies.add(getPrCurrency(pr));
      (pr.lines || []).forEach((l) => {
        if (l.currency) currencies.add(l.currency.trim().toUpperCase());
      });
    });

    return {
      companies: Array.from(companiesMap.entries()).map(([id, label]) => ({ id, label })),
      branches: Array.from(branchesMap.entries()).map(([id, label]) => ({ id, label })),
      departments: Array.from(departments).sort(),
      currencies: Array.from(currencies).sort(),
    };
  }, [fyScopedPrs]);

  // 22-Field Purchase Requisition Advanced Filter Catalogue (Header View)
  const prHeaderFilterFields: FilterFieldDefinition<PurchaseRequisitionHeader>[] = useMemo(
    () => [
      { key: 'prNumber', label: 'PR Number', type: 'TEXT', accessor: (pr) => pr.prNumber },
      {
        key: 'prDate',
        label: 'PR Date',
        type: 'DATE',
        accessor: (pr) => (pr.createdAt ? pr.createdAt.slice(0, 10) : ''),
      },
      {
        key: 'expectedDeliveryDate',
        label: 'Expected Delivery Date',
        type: 'DATE',
        accessor: (pr) => getExpectedDeliveryDate(pr),
      },
      {
        key: 'branch',
        label: 'Branch',
        type: 'DROPDOWN',
        options: filterOptions.branches.map((b) => ({ value: b.label, label: b.label })),
        accessor: (pr) => pr.branchName,
      },
      {
        key: 'department',
        label: 'Department',
        type: 'DROPDOWN',
        options: filterOptions.departments.map((d) => ({ value: d, label: d })),
        accessor: (pr) => pr.department,
      },
      { key: 'requester', label: 'Requester', type: 'TEXT', accessor: (pr) => pr.requesterName },
      { key: 'buyer', label: 'Buyer', type: 'TEXT', accessor: (pr) => getAssignedBuyer(pr) },
      {
        key: 'supplier',
        label: 'Supplier',
        type: 'TEXT',
        accessor: (pr) =>
          (pr.lines || [])
            .map((l: any) => l.preferredVendorName || l.vendorName || l.supplierName || '')
            .filter(Boolean),
      },
      {
        key: 'itemCode',
        label: 'Item Code',
        type: 'TEXT',
        accessor: (pr) => (pr.lines || []).map((l) => l.itemCode || ''),
      },
      {
        key: 'itemDescription',
        label: 'Item Description',
        type: 'TEXT',
        accessor: (pr) => (pr.lines || []).map((l) => l.description || ''),
      },
      {
        key: 'itemType',
        label: 'Item Type',
        type: 'TEXT',
        accessor: (pr) =>
          (pr.lines || []).map((l: any) => l.itemType || l.itemCategory || ''),
      },
      {
        key: 'material',
        label: 'Material',
        type: 'TEXT',
        accessor: (pr) =>
          (pr.lines || []).map(
            (l: any) => l.material || l.customSpecsSummary || l.description || ''
          ),
      },
      {
        key: 'materialForm',
        label: 'Material Form',
        type: 'TEXT',
        accessor: (pr) =>
          (pr.lines || []).map((l: any) => l.materialForm || l.description || ''),
      },
      {
        key: 'quantity',
        label: 'Quantity',
        type: 'NUMBER',
        accessor: (pr) => (pr.lines || []).map((l) => l.requestedQuantity ?? 0),
      },
      {
        key: 'uom',
        label: 'UOM',
        type: 'TEXT',
        accessor: (pr) => (pr.lines || []).map((l) => l.inventoryUom || ''),
      },
      {
        key: 'estimatedValue',
        label: 'Estimated Value',
        type: 'NUMBER',
        accessor: (pr) => pr.estimatedTotalValue ?? 0,
      },
      {
        key: 'currency',
        label: 'Currency',
        type: 'DROPDOWN',
        options: filterOptions.currencies.map((c) => ({ value: c, label: c })),
        accessor: (pr) => getPrCurrency(pr),
      },
      {
        key: 'prType',
        label: 'PR Type',
        type: 'DROPDOWN',
        options: [
          { value: 'MRP', label: 'MRP' },
          { value: 'MANUAL', label: 'Manual' },
          { value: 'REPAIR', label: 'Repair' },
          { value: 'MAINTENANCE', label: 'Maintenance' },
          { value: 'CAPEX_ASSET', label: 'Capex / Asset' },
        ],
        accessor: (pr) => pr.prType,
      },
      {
        key: 'prStatus',
        label: 'PR Status',
        type: 'DROPDOWN',
        options: [
          { value: 'DRAFT', label: 'Draft' },
          { value: 'PENDING_MANAGER_APPROVAL', label: 'Pending Manager L1' },
          { value: 'PENDING_SUBSEQUENT_APPROVAL', label: 'Pending Category Approval' },
          { value: 'APPROVED_PENDING_BUYER', label: 'Approved - Pending Buyer' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'REJECTED', label: 'Rejected' },
          { value: 'RETURNED_FOR_CORRECTION', label: 'Returned for Correction' },
          { value: 'SHORT_CLOSED', label: 'Short Closed' },
          { value: 'CANCELLED', label: 'Cancelled' },
        ],
        accessor: (pr) => getEffectivePRStatus(pr),
      },
      {
        key: 'approvalStatus',
        label: 'Approval Status',
        type: 'DROPDOWN',
        options: [
          { value: 'DRAFT', label: 'Draft' },
          { value: 'PENDING_MANAGER_APPROVAL', label: 'Pending Manager L1' },
          { value: 'PENDING_SUBSEQUENT_APPROVAL', label: 'Pending Category Approval' },
          { value: 'APPROVED_PENDING_BUYER', label: 'Approved - Pending Buyer' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'REJECTED', label: 'Rejected' },
        ],
        accessor: (pr) => pr.status,
      },
      {
        key: 'checker',
        label: 'Checker',
        type: 'TEXT',
        accessor: (pr) =>
          (pr.approvalHistory || []).map((h) => h.actorName || ''),
      },
      {
        key: 'approver',
        label: 'Approver',
        type: 'TEXT',
        accessor: (pr) =>
          (pr.approvalHistory || [])
            .filter((h: any) => h.action === 'APPROVE' || h.decision === 'APPROVED')
            .map((h) => h.actorName || ''),
      },
    ],
    [filterOptions]
  );

  // 22-Field Purchase Requisition Advanced Filter Catalogue (Line View)
  const prLineFilterFields: FilterFieldDefinition<PRLineGridRow>[] = useMemo(
    () => [
      { key: 'prNumber', label: 'PR Number', type: 'TEXT', accessor: (r) => r.prNumber },
      {
        key: 'prDate',
        label: 'PR Date',
        type: 'DATE',
        accessor: (r) => (r.pr.createdAt ? r.pr.createdAt.slice(0, 10) : ''),
      },
      {
        key: 'expectedDeliveryDate',
        label: 'Expected Delivery Date',
        type: 'DATE',
        accessor: (r) => r.expectedDeliveryDate,
      },
      {
        key: 'branch',
        label: 'Branch',
        type: 'DROPDOWN',
        options: filterOptions.branches.map((b) => ({ value: b.label, label: b.label })),
        accessor: (r) => r.branchName,
      },
      {
        key: 'department',
        label: 'Department',
        type: 'DROPDOWN',
        options: filterOptions.departments.map((d) => ({ value: d, label: d })),
        accessor: (r) => r.department,
      },
      { key: 'requester', label: 'Requester', type: 'TEXT', accessor: (r) => r.requesterName },
      { key: 'buyer', label: 'Buyer', type: 'TEXT', accessor: (r) => r.assignedBuyer },
      {
        key: 'supplier',
        label: 'Supplier',
        type: 'TEXT',
        accessor: (r) => (r.line as any)?.preferredVendorName || '',
      },
      { key: 'itemCode', label: 'Item Code', type: 'TEXT', accessor: (r) => r.itemCode },
      {
        key: 'itemDescription',
        label: 'Item Description',
        type: 'TEXT',
        accessor: (r) => r.description,
      },
      {
        key: 'itemType',
        label: 'Item Type',
        type: 'TEXT',
        accessor: (r) => (r.line as any)?.itemType || r.itemCategory || '',
      },
      {
        key: 'material',
        label: 'Material',
        type: 'TEXT',
        accessor: (r) => (r.line as any)?.material || r.description || '',
      },
      {
        key: 'materialForm',
        label: 'Material Form',
        type: 'TEXT',
        accessor: (r) => (r.line as any)?.materialForm || r.description || '',
      },
      {
        key: 'quantity',
        label: 'Quantity',
        type: 'NUMBER',
        accessor: (r) => r.requestedQuantity,
      },
      { key: 'uom', label: 'UOM', type: 'TEXT', accessor: (r) => r.inventoryUom },
      {
        key: 'estimatedValue',
        label: 'Estimated Value',
        type: 'NUMBER',
        accessor: (r) => r.estimatedTotalValue,
      },
      {
        key: 'currency',
        label: 'Currency',
        type: 'DROPDOWN',
        options: filterOptions.currencies.map((c) => ({ value: c, label: c })),
        accessor: (r) => r.currency,
      },
      {
        key: 'prType',
        label: 'PR Type',
        type: 'DROPDOWN',
        options: [
          { value: 'MRP', label: 'MRP' },
          { value: 'MANUAL', label: 'Manual' },
          { value: 'REPAIR', label: 'Repair' },
          { value: 'MAINTENANCE', label: 'Maintenance' },
          { value: 'CAPEX_ASSET', label: 'Capex / Asset' },
        ],
        accessor: (r) => r.prType,
      },
      {
        key: 'prStatus',
        label: 'PR Status',
        type: 'DROPDOWN',
        options: [
          { value: 'DRAFT', label: 'Draft' },
          { value: 'PENDING_MANAGER_APPROVAL', label: 'Pending Manager L1' },
          { value: 'PENDING_SUBSEQUENT_APPROVAL', label: 'Pending Category Approval' },
          { value: 'APPROVED_PENDING_BUYER', label: 'Approved - Pending Buyer' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'REJECTED', label: 'Rejected' },
          { value: 'RETURNED_FOR_CORRECTION', label: 'Returned for Correction' },
          { value: 'SHORT_CLOSED', label: 'Short Closed' },
          { value: 'CANCELLED', label: 'Cancelled' },
        ],
        accessor: (r) => r.effectiveStatus,
      },
      {
        key: 'approvalStatus',
        label: 'Approval Status',
        type: 'DROPDOWN',
        options: [
          { value: 'DRAFT', label: 'Draft' },
          { value: 'PENDING_MANAGER_APPROVAL', label: 'Pending Manager L1' },
          { value: 'PENDING_SUBSEQUENT_APPROVAL', label: 'Pending Category Approval' },
          { value: 'APPROVED_PENDING_BUYER', label: 'Approved - Pending Buyer' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'REJECTED', label: 'Rejected' },
        ],
        accessor: (r) => r.pr.status,
      },
      {
        key: 'checker',
        label: 'Checker',
        type: 'TEXT',
        accessor: (r) =>
          (r.pr.approvalHistory || []).map((h) => h.actorName || ''),
      },
      {
        key: 'approver',
        label: 'Approver',
        type: 'TEXT',
        accessor: (r) =>
          (r.pr.approvalHistory || [])
            .filter((h: any) => h.action === 'APPROVE' || h.decision === 'APPROVED')
            .map((h) => h.actorName || ''),
      },
    ],
    [filterOptions]
  );

  const activeAdvancedCount = useMemo(
    () => countActiveAdvancedConditions(advancedFilterState, prHeaderFilterFields),
    [advancedFilterState, prHeaderFilterFields]
  );

  // Active Filter Count for Filter Badge
  const activeFilterCount = useMemo(() => {
    let count = activeAdvancedCount;
    if (selectedCompany !== 'ALL') count += 1;
    if (selectedBranch !== 'ALL') count += 1;
    if (selectedDepartment !== 'ALL') count += 1;
    if (selectedType !== 'ALL') count += 1;
    if (selectedStatus !== 'ALL') count += 1;
    if (selectedBudgetStatus !== 'ALL') count += 1;
    if (selectedCurrency !== 'ALL') count += 1;
    if (deliveryDateFilter) count += 1;
    if (prDateRange.from || prDateRange.to) count += 1;
    if (expectedDeliveryDateRange.from || expectedDeliveryDateRange.to) count += 1;
    if (minEstimatedValue) count += 1;
    return count;
  }, [
    activeAdvancedCount,
    selectedCompany,
    selectedBranch,
    selectedDepartment,
    selectedType,
    selectedStatus,
    selectedBudgetStatus,
    selectedCurrency,
    deliveryDateFilter,
    prDateRange,
    expectedDeliveryDateRange,
    minEstimatedValue,
  ]);

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setSelectedCompany('ALL');
    setSelectedBranch('ALL');
    setSelectedDepartment('ALL');
    setSelectedType('ALL');
    setSelectedStatus('ALL');
    setSelectedBudgetStatus('ALL');
    setSelectedCurrency('ALL');
    setDeliveryDateFilter('');
    setPrDateRange({ from: '', to: '' });
    setExpectedDeliveryDateRange({ from: '', to: '' });
    setAdvancedFilterState(createInitialAdvancedFilterState());
    setMinEstimatedValue('');
  };

  // Active Filter Chips combining Date Ranges, Quick Filters, and Advanced Conditions
  const activeFilterChips: ActiveFilterChip[] = useMemo(() => {
    const chips: ActiveFilterChip[] = [];

    if (prDateRange.from || prDateRange.to) {
      chips.push({
        id: 'chip-pr-date-range',
        category: 'DATE_RANGE',
        fieldLabel: 'PR Date',
        operatorLabel: 'Between',
        valueLabel: `${prDateRange.from || 'Start'} → ${prDateRange.to || 'End'}`,
        onRemove: () => setPrDateRange({ from: '', to: '' }),
      });
    }

    if (expectedDeliveryDateRange.from || expectedDeliveryDateRange.to) {
      chips.push({
        id: 'chip-exp-delivery-range',
        category: 'DATE_RANGE',
        fieldLabel: 'Expected Delivery Date',
        operatorLabel: 'Between',
        valueLabel: `${expectedDeliveryDateRange.from || 'Start'} → ${expectedDeliveryDateRange.to || 'End'}`,
        onRemove: () => setExpectedDeliveryDateRange({ from: '', to: '' }),
      });
    }

    if (selectedCompany !== 'ALL') {
      chips.push({
        id: 'chip-company',
        category: 'QUICK',
        fieldLabel: 'Company',
        operatorLabel: parseMultiSelectFilter(selectedCompany).length > 1 ? 'Is Any Of' : 'Equals',
        valueLabel: formatMultiSelectFilterLabel(
          selectedCompany,
          filterOptions.companies.map((c) => ({ value: c.id, label: c.label }))
        ),
        onRemove: () => setSelectedCompany('ALL'),
      });
    }

    if (selectedBranch !== 'ALL') {
      chips.push({
        id: 'chip-branch',
        category: 'QUICK',
        fieldLabel: 'Branch',
        operatorLabel: parseMultiSelectFilter(selectedBranch).length > 1 ? 'Is Any Of' : 'Equals',
        valueLabel: formatMultiSelectFilterLabel(
          selectedBranch,
          filterOptions.branches.map((b) => ({ value: b.id, label: b.label }))
        ),
        onRemove: () => setSelectedBranch('ALL'),
      });
    }

    if (selectedDepartment !== 'ALL') {
      chips.push({
        id: 'chip-dept',
        category: 'QUICK',
        fieldLabel: 'Department',
        operatorLabel: parseMultiSelectFilter(selectedDepartment).length > 1 ? 'Is Any Of' : 'Equals',
        valueLabel: formatMultiSelectFilterLabel(selectedDepartment),
        onRemove: () => setSelectedDepartment('ALL'),
      });
    }

    if (selectedType !== 'ALL') {
      chips.push({
        id: 'chip-pr-type',
        category: 'QUICK',
        fieldLabel: 'PR Type',
        operatorLabel: parseMultiSelectFilter(selectedType).length > 1 ? 'Is Any Of' : 'Equals',
        valueLabel: formatMultiSelectFilterLabel(selectedType),
        onRemove: () => setSelectedType('ALL'),
      });
    }

    if (selectedStatus !== 'ALL') {
      chips.push({
        id: 'chip-status',
        category: 'QUICK',
        fieldLabel: 'Status',
        operatorLabel: parseMultiSelectFilter(selectedStatus).length > 1 ? 'Is Any Of' : 'Equals',
        valueLabel: formatMultiSelectFilterLabel(selectedStatus),
        onRemove: () => setSelectedStatus('ALL'),
      });
    }

    if (selectedBudgetStatus !== 'ALL') {
      chips.push({
        id: 'chip-budget',
        category: 'QUICK',
        fieldLabel: 'Budget',
        operatorLabel: parseMultiSelectFilter(selectedBudgetStatus).length > 1 ? 'Is Any Of' : 'Equals',
        valueLabel: formatMultiSelectFilterLabel(selectedBudgetStatus),
        onRemove: () => setSelectedBudgetStatus('ALL'),
      });
    }

    if (selectedCurrency !== 'ALL') {
      chips.push({
        id: 'chip-currency',
        category: 'QUICK',
        fieldLabel: 'Currency',
        operatorLabel: parseMultiSelectFilter(selectedCurrency).length > 1 ? 'Is Any Of' : 'Equals',
        valueLabel: formatMultiSelectFilterLabel(selectedCurrency),
        onRemove: () => setSelectedCurrency('ALL'),
      });
    }

    if (minEstimatedValue) {
      chips.push({
        id: 'chip-min-val',
        category: 'QUICK',
        fieldLabel: 'Estimated Value',
        operatorLabel: '>=',
        valueLabel: minEstimatedValue,
        onRemove: () => setMinEstimatedValue(''),
      });
    }

    const advChips = buildAdvancedFilterChips(
      advancedFilterState,
      prHeaderFilterFields,
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
    prDateRange,
    expectedDeliveryDateRange,
    selectedCompany,
    selectedBranch,
    selectedDepartment,
    selectedType,
    selectedStatus,
    selectedBudgetStatus,
    selectedCurrency,
    minEstimatedValue,
    advancedFilterState,
    prHeaderFilterFields,
    filterOptions,
  ]);

  // Filter PRs (Header View) — searches both PR header fields, independent Date Ranges, and 22-field Advanced Filters
  const filteredPrs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const minVal = parseFloat(minEstimatedValue);

    const quickFiltered = fyScopedPrs.filter((pr) => {
      const prCurrency = getPrCurrency(pr);
      const prCreatedDate = pr.createdAt ? pr.createdAt.slice(0, 10) : '';
      const expDate = getExpectedDeliveryDate(pr);
      const assignedBuyer = getAssignedBuyer(pr);

      const matchesLineSearch = (pr.lines || []).some(
        (l) =>
          (l.itemCode || '').toLowerCase().includes(q) ||
          (l.description || '').toLowerCase().includes(q) ||
          (l.itemCategory || '').toLowerCase().includes(q)
      );

      const matchesSearch =
        !q ||
        pr.prNumber.toLowerCase().includes(q) ||
        pr.purchasePurpose.toLowerCase().includes(q) ||
        pr.requesterName.toLowerCase().includes(q) ||
        pr.branchName.toLowerCase().includes(q) ||
        pr.department.toLowerCase().includes(q) ||
        prCurrency.toLowerCase().includes(q) ||
        assignedBuyer.toLowerCase().includes(q) ||
        expDate.toLowerCase().includes(q) ||
        matchesLineSearch;

      const matchesCompany = matchesMultiSelectFilter(selectedCompany, pr.companyId);
      const matchesBranch =
        matchesMultiSelectFilter(selectedBranch, pr.branchId) ||
        matchesMultiSelectFilter(selectedBranch, pr.branchName);
      const matchesDept = matchesMultiSelectFilter(selectedDepartment, pr.department);
      const matchesType = matchesMultiSelectFilter(selectedType, pr.prType);
      const effectiveStatus = getEffectivePRStatus(pr);
      const matchesStatus =
        matchesMultiSelectFilter(selectedStatus, pr.status) ||
        matchesMultiSelectFilter(selectedStatus, effectiveStatus);
      const matchesBudget = matchesMultiSelectFilter(
        selectedBudgetStatus,
        pr.budgetValidationStatus
      );
      const matchesCurrency = matchesMultiSelectFilter(selectedCurrency, prCurrency);
      const matchesLegacyDeliveryDate =
        !deliveryDateFilter || expDate === deliveryDateFilter;
      const matchesPrDateRange = matchesDateRange(prCreatedDate, prDateRange);
      const matchesExpectedDeliveryRange = matchesDateRange(expDate, expectedDeliveryDateRange);
      const matchesMinAmount =
        Number.isNaN(minVal) || pr.estimatedTotalValue >= minVal;

      return (
        matchesSearch &&
        matchesCompany &&
        matchesBranch &&
        matchesDept &&
        matchesType &&
        matchesStatus &&
        matchesBudget &&
        matchesCurrency &&
        matchesLegacyDeliveryDate &&
        matchesPrDateRange &&
        matchesExpectedDeliveryRange &&
        matchesMinAmount
      );
    });

    return evaluateAdvancedFilters(quickFiltered, advancedFilterState, prHeaderFilterFields);
  }, [
    fyScopedPrs,
    searchQuery,
    selectedCompany,
    selectedBranch,
    selectedDepartment,
    selectedType,
    selectedStatus,
    selectedBudgetStatus,
    selectedCurrency,
    deliveryDateFilter,
    prDateRange,
    expectedDeliveryDateRange,
    minEstimatedValue,
    advancedFilterState,
    prHeaderFilterFields,
  ]);

  // All FY-scoped flattened line rows (for accurate line totals & filtering in Line View)
  const fyScopedLineRows = useMemo(() => flattenPrLines(fyScopedPrs), [fyScopedPrs]);

  // Filter Line rows directly on line-level & parent-level attributes + independent Date Ranges + Advanced Filters
  const filteredLineRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const minVal = parseFloat(minEstimatedValue);

    const quickFiltered = fyScopedLineRows.filter((row) => {
      const prCreatedDate = row.pr.createdAt ? row.pr.createdAt.slice(0, 10) : '';
      const matchesSearch =
        !q ||
        row.prNumber.toLowerCase().includes(q) ||
        row.itemCode.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.itemCategory.toLowerCase().includes(q) ||
        row.requesterName.toLowerCase().includes(q) ||
        row.branchName.toLowerCase().includes(q) ||
        row.department.toLowerCase().includes(q) ||
        row.assignedBuyer.toLowerCase().includes(q) ||
        row.currency.toLowerCase().includes(q) ||
        row.expectedDeliveryDate.toLowerCase().includes(q);

      const matchesCompany = matchesMultiSelectFilter(selectedCompany, row.companyId);
      const matchesBranch =
        matchesMultiSelectFilter(selectedBranch, row.branchId) ||
        matchesMultiSelectFilter(selectedBranch, row.branchName);
      const matchesDept = matchesMultiSelectFilter(selectedDepartment, row.department);
      const matchesType = matchesMultiSelectFilter(selectedType, row.prType);
      const matchesStatus =
        matchesMultiSelectFilter(selectedStatus, row.effectiveStatus) ||
        matchesMultiSelectFilter(selectedStatus, row.pr.status);
      const matchesBudget = matchesMultiSelectFilter(
        selectedBudgetStatus,
        row.budgetValidationStatus
      );
      const matchesCurrency = matchesMultiSelectFilter(selectedCurrency, row.currency);
      const matchesLegacyDeliveryDate =
        !deliveryDateFilter || row.expectedDeliveryDate === deliveryDateFilter;
      const matchesPrDateRange = matchesDateRange(prCreatedDate, prDateRange);
      const matchesExpectedDeliveryRange = matchesDateRange(
        row.expectedDeliveryDate,
        expectedDeliveryDateRange
      );
      const matchesMinAmount =
        Number.isNaN(minVal) || row.estimatedTotalValue >= minVal;

      return (
        matchesSearch &&
        matchesCompany &&
        matchesBranch &&
        matchesDept &&
        matchesType &&
        matchesStatus &&
        matchesBudget &&
        matchesCurrency &&
        matchesLegacyDeliveryDate &&
        matchesPrDateRange &&
        matchesExpectedDeliveryRange &&
        matchesMinAmount
      );
    });

    return evaluateAdvancedFilters(quickFiltered, advancedFilterState, prLineFilterFields);
  }, [
    fyScopedLineRows,
    searchQuery,
    selectedCompany,
    selectedBranch,
    selectedDepartment,
    selectedType,
    selectedStatus,
    selectedBudgetStatus,
    selectedCurrency,
    deliveryDateFilter,
    prDateRange,
    expectedDeliveryDateRange,
    minEstimatedValue,
    advancedFilterState,
    prLineFilterFields,
  ]);

  // Sort Header PRs & Line Rows independently using shared sort engines (Factory default: prDate DESC)
  const sortedPrs = useMemo(
    () => sortPrRecords(filteredPrs, headerSortRules),
    [filteredPrs, headerSortRules]
  );

  const sortedLineRows = useMemo(
    () => sortPrLineRecords(filteredLineRows, lineSortRules),
    [filteredLineRows, lineSortRules]
  );

  const activePageSize = viewMode === 'HEADER' ? headerPageSize : linePageSize;
  const activeSortRules = viewMode === 'HEADER' ? headerSortRules : lineSortRules;
  const activeTotalRecords = viewMode === 'HEADER' ? sortedPrs.length : sortedLineRows.length;
  const activeUnfilteredRecords =
    viewMode === 'HEADER' ? fyScopedPrs.length : fyScopedLineRows.length;

  // Reset to Page 1 whenever search, filters, date ranges, advanced filters, FY selection, or view mode change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedFyId,
    searchQuery,
    selectedCompany,
    selectedBranch,
    selectedDepartment,
    selectedType,
    selectedStatus,
    selectedBudgetStatus,
    selectedCurrency,
    deliveryDateFilter,
    prDateRange,
    expectedDeliveryDateRange,
    advancedFilterState,
    minEstimatedValue,
    viewMode,
  ]);

  const totalPages = Math.max(1, Math.ceil(activeTotalRecords / activePageSize));
  const safePage = dataGridService.clampPageNumber(currentPage, activeTotalRecords, activePageSize);

  useEffect(() => {
    if (safePage !== currentPage) {
      setCurrentPage(safePage);
    }
  }, [safePage, currentPage]);

  const paginatedPrs = useMemo(() => {
    const start = (safePage - 1) * headerPageSize;
    return sortedPrs.slice(start, start + headerPageSize);
  }, [sortedPrs, safePage, headerPageSize]);

  const paginatedLineRows = useMemo(() => {
    const start = (safePage - 1) * linePageSize;
    return sortedLineRows.slice(start, start + linePageSize);
  }, [sortedLineRows, safePage, linePageSize]);

  const activeCurrentPageCount =
    viewMode === 'HEADER' ? paginatedPrs.length : paginatedLineRows.length;

  const handlePageSizeChange = (nextSize: number) => {
    const normalized = dataGridService.normalizePageSize(nextSize);
    const targetGridId =
      viewMode === 'HEADER' ? 'purchase-requisition-list' : 'purchase-requisition-line-list';
    if (viewMode === 'HEADER') {
      setHeaderPageSize(normalized);
    } else {
      setLinePageSize(normalized);
    }
    setCurrentPage(1);
    const existing = dataGridService.getUserGridPreference(targetGridId, userId, deviceType);
    dataGridService.saveUserGridPreference({
      gridId: targetGridId,
      userId,
      deviceType,
      pageSize: normalized,
      columnOrder: existing?.columnOrder || [],
      visibleColumns: existing?.visibleColumns || {},
      columnWidths: existing?.columnWidths || {},
      sortRules: existing?.sortRules || [],
    });
  };

  // Currency breakdown for KPI summary card
  const currencyBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    filteredPrs.forEach((pr) => {
      const curr = getPrCurrency(pr);
      totals.set(curr, (totals.get(curr) || 0) + (pr.estimatedTotalValue || 0));
    });
    return Array.from(totals.entries());
  }, [filteredPrs]);

  // Unique PR IDs selected for Bulk Actions (works seamlessly in both Header and Line views)
  const selectedPrIdsForBulk = useMemo(() => {
    if (viewMode === 'HEADER') {
      return Array.from(selectedHeaderIds);
    }
    const prSet = new Set<string>();
    filteredLineRows.forEach((row) => {
      if (selectedLineRowIds.has(row.rowId)) {
        prSet.add(row.prId);
      }
    });
    return Array.from(prSet);
  }, [viewMode, selectedHeaderIds, selectedLineRowIds, filteredLineRows]);

  const activeSelectionCount =
    viewMode === 'HEADER' ? selectedHeaderIds.size : selectedLineRowIds.size;

  // Bulk preview calculation when modal is open
  const bulkPreview = useMemo(() => {
    if (!showBulkModal || selectedPrIdsForBulk.length === 0) return null;
    return PurchaseRequisitionService.previewBulkPrAction({
      prIds: selectedPrIdsForBulk,
      action: bulkActionType,
      user: currentUser,
    });
  }, [showBulkModal, selectedPrIdsForBulk, bulkActionType, currentUser, prs]);

  // Consolidated report data when modal is open
  const consolidatedReport = useMemo(() => {
    if (!showConsolidatedReport) return null;
    return PurchaseRequisitionService.generateConsolidatedPrReport({
      user: currentUser,
      prType: selectedType as any,
      status: selectedStatus as any,
      currency: selectedCurrency,
    });
  }, [showConsolidatedReport, currentUser, selectedType, selectedStatus, selectedCurrency, prs]);

  const toggleSelectAll = () => {
    if (viewMode === 'HEADER') {
      if (selectedHeaderIds.size === sortedPrs.length && sortedPrs.length > 0) {
        setSelectedHeaderIds(new Set());
      } else {
        setSelectedHeaderIds(new Set(sortedPrs.map((pr) => pr.id)));
      }
    } else {
      if (selectedLineRowIds.size === sortedLineRows.length && sortedLineRows.length > 0) {
        setSelectedLineRowIds(new Set());
      } else {
        setSelectedLineRowIds(new Set(sortedLineRows.map((row) => row.rowId)));
      }
    }
  };

  const toggleSelectHeader = (id: string) => {
    const next = new Set(selectedHeaderIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedHeaderIds(next);
  };

  const toggleSelectLine = (rowId: string) => {
    const next = new Set(selectedLineRowIds);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    setSelectedLineRowIds(next);
  };

  const toggleTabletRowExpand = (id: string) => {
    const next = new Set(expandedTabletRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedTabletRows(next);
  };

  // Column Sorting Handlers (Click = single sort, Shift+Click = multi-column sort)
  const handleHeaderColumnSort = (key: PRColumnKey, e: React.MouseEvent) => {
    const def = getColumnDefinition(key);
    if (!def.sortable) return;
    const isMulti = e.shiftKey;
    setHeaderSortRules((prev) => toggleSortRule(prev, key, isMulti));
    setCurrentPage(1);
  };

  const handleLineColumnSort = (key: PRLineColumnKey, e: React.MouseEvent) => {
    const def = getLineColumnDefinition(key);
    if (!def.sortable) return;
    const isMulti = e.shiftKey;
    setLineSortRules((prev) => toggleSortRule(prev, key, isMulti));
    setCurrentPage(1);
  };

  // Column Resize Mouse Handlers (Shared across Header View and Line View)
  const handleStartResize = (
    e: React.MouseEvent,
    key: string,
    currentWidth: number,
    targetView: PRViewType = viewMode
  ) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { view: targetView, key, startX: e.clientX, startWidth: currentWidth };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const deltaX = moveEvent.clientX - resizingRef.current.startX;
      if (resizingRef.current.view === 'HEADER') {
        const colKey = resizingRef.current.key as PRColumnKey;
        const newWidth = clampColumnWidth(colKey, resizingRef.current.startWidth + deltaX);
        setHeaderColumnStates((prev) =>
          prev.map((col) => (col.key === colKey ? { ...col, width: newWidth } : col))
        );
      } else {
        const colKey = resizingRef.current.key as PRLineColumnKey;
        const newWidth = clampLineColumnWidth(colKey, resizingRef.current.startWidth + deltaX);
        setLineColumnStates((prev) =>
          prev.map((col) => (col.key === colKey ? { ...col, width: newWidth } : col))
        );
      }
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Double-click column boundary to auto-fit its content
  const handleAutoFitColumn = (
    e: React.MouseEvent,
    key: string,
    targetView: PRViewType = viewMode
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (targetView === 'HEADER') {
      const colKey = key as PRColumnKey;
      const fittedWidth = calculateAutoFitWidth(colKey, sortedPrs);
      setHeaderColumnStates((prev) =>
        prev.map((col) => (col.key === colKey ? { ...col, width: fittedWidth } : col))
      );
      showFeedbackToast(
        `Auto-fitted "${getColumnDefinition(colKey).label}" column (${fittedWidth}px).`
      );
    } else {
      const colKey = key as PRLineColumnKey;
      const fittedWidth = calculateLineAutoFitWidth(colKey, sortedLineRows);
      setLineColumnStates((prev) =>
        prev.map((col) => (col.key === colKey ? { ...col, width: fittedWidth } : col))
      );
      showFeedbackToast(
        `Auto-fitted "${getLineColumnDefinition(colKey).label}" column (${fittedWidth}px).`
      );
    }
  };

  // Drag-and-Drop Column Reordering Handlers (View-aware)
  const handleDragStartColumn = (e: React.DragEvent, key: string) => {
    setDraggedColKey(key);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
  };

  const handleDragOverColumn = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColKey !== key) {
      setDragOverColKey(key);
    }
  };

  const handleDropColumn = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    const sourceKey = draggedColKey || e.dataTransfer.getData('text/plain');
    setDraggedColKey(null);
    setDragOverColKey(null);
    if (!sourceKey || sourceKey === targetKey) return;
    if (viewMode === 'HEADER') {
      setHeaderColumnStates((prev) =>
        reorderColumns(prev, sourceKey as PRColumnKey, targetKey as PRColumnKey)
      );
    } else {
      setLineColumnStates((prev) =>
        reorderColumns(prev, sourceKey as PRLineColumnKey, targetKey as PRLineColumnKey)
      );
    }
  };

  const handleMoveColumnStep = (key: string, direction: 'up' | 'down') => {
    if (viewMode === 'HEADER') {
      const idx = orderedHeaderColumns.findIndex((c) => c.key === key);
      if (idx === -1) return;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= orderedHeaderColumns.length) return;
      const targetKey = orderedHeaderColumns[targetIdx].key;
      setHeaderColumnStates((prev) => reorderColumns(prev, key as PRColumnKey, targetKey));
    } else {
      const idx = orderedLineColumns.findIndex((c) => c.key === key);
      if (idx === -1) return;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= orderedLineColumns.length) return;
      const targetKey = orderedLineColumns[targetIdx].key;
      setLineColumnStates((prev) => reorderColumns(prev, key as PRLineColumnKey, targetKey));
    }
  };

  // Toggle visibility of an individual column (protecting mandatory columns)
  const handleToggleColumnVisibility = (key: string) => {
    if (viewMode === 'HEADER') {
      const def = getColumnDefinition(key as PRColumnKey);
      if (def.mandatory) return;
      setHeaderColumnStates((prev) => {
        const target = prev.find((c) => c.key === key);
        if (!target) return prev;
        const visibleCount = prev.filter((c) => c.visible).length;
        if (target.visible && visibleCount <= 1) return prev;
        return prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c));
      });
    } else {
      const def = getLineColumnDefinition(key as PRLineColumnKey);
      if (def.mandatory) return;
      setLineColumnStates((prev) => {
        const target = prev.find((c) => c.key === key);
        if (!target) return prev;
        const visibleCount = prev.filter((c) => c.visible).length;
        if (target.visible && visibleCount <= 1) return prev;
        return prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c));
      });
    }
  };

  const handleSelectAllColumns = () => {
    if (viewMode === 'HEADER') {
      setHeaderColumnStates((prev) => prev.map((c) => ({ ...c, visible: true })));
    } else {
      setLineColumnStates((prev) => prev.map((c) => ({ ...c, visible: true })));
    }
  };

  const handleDeselectAllColumns = () => {
    if (viewMode === 'HEADER') {
      setHeaderColumnStates((prev) =>
        prev.map((c) => ({ ...c, visible: Boolean(getColumnDefinition(c.key).mandatory) }))
      );
    } else {
      setLineColumnStates((prev) =>
        prev.map((c) => ({ ...c, visible: Boolean(getLineColumnDefinition(c.key).mandatory) }))
      );
    }
  };

  const handleRestoreDefaultWidths = () => {
    if (viewMode === 'HEADER') {
      setHeaderColumnStates((prev) =>
        prev.map((c) => ({ ...c, width: getColumnDefinition(c.key).defaultWidth }))
      );
    } else {
      setLineColumnStates((prev) =>
        prev.map((c) => ({ ...c, width: getLineColumnDefinition(c.key).defaultWidth }))
      );
    }
    showFeedbackToast(`Restored default column widths for ${viewMode === 'HEADER' ? 'Header View' : 'Line View'}.`);
  };

  const handleRestoreDefaultOrder = () => {
    if (viewMode === 'HEADER') {
      const defOrder = AVAILABLE_PR_COLUMNS.map((c) => c.key);
      setHeaderColumnStates((prev) =>
        prev
          .map((c) => ({ ...c, order: defOrder.indexOf(c.key) }))
          .sort((a, b) => a.order - b.order)
      );
    } else {
      const defOrder = AVAILABLE_PR_LINE_COLUMNS.map((c) => c.key);
      setLineColumnStates((prev) =>
        prev
          .map((c) => ({ ...c, order: defOrder.indexOf(c.key) }))
          .sort((a, b) => a.order - b.order)
      );
    }
    showFeedbackToast(`Restored default column order for ${viewMode === 'HEADER' ? 'Header View' : 'Line View'}.`);
  };

  const currentFilterSnapshot = () => ({
    selectedCompany,
    selectedBranch,
    selectedType,
    selectedDepartment,
    selectedStatus,
    selectedCurrency,
    selectedBudgetStatus,
    deliveryDateFilter,
    minEstimatedValue,
  });

  const applySavedFilterSnapshot = (filters?: PRNamedGridLayout['filters']) => {
    if (!filters) return;
    if (filters.selectedCompany !== undefined) setSelectedCompany(filters.selectedCompany);
    if (filters.selectedBranch !== undefined) setSelectedBranch(filters.selectedBranch);
    if (filters.selectedType !== undefined) setSelectedType(filters.selectedType as any);
    if (filters.selectedDepartment !== undefined) setSelectedDepartment(filters.selectedDepartment);
    if (filters.selectedStatus !== undefined) setSelectedStatus(filters.selectedStatus as any);
    if (filters.selectedCurrency !== undefined) setSelectedCurrency(filters.selectedCurrency);
    if (filters.selectedBudgetStatus !== undefined)
      setSelectedBudgetStatus(filters.selectedBudgetStatus);
    if (filters.deliveryDateFilter !== undefined) setDeliveryDateFilter(filters.deliveryDateFilter);
    if (filters.minEstimatedValue !== undefined) setMinEstimatedValue(filters.minEstimatedValue);
  };

  const handleQuickSaveCurrentViewLayout = () => {
    try {
      setLayoutPersistError(null);
      const saved = saveNamedViewLayout({
        userId,
        viewType: viewMode,
        companyId: layoutCompanyScope,
        layoutId: activeLayoutId || undefined,
        layoutName:
          savedLayoutsForActiveView.find((l) => l.id === activeLayoutId)?.layoutName ||
          `${currentUser.fullName}'s ${viewMode === 'HEADER' ? 'Header' : 'Line'} Layout`,
        columns: (viewMode === 'HEADER' ? headerColumnStates : lineColumnStates) as any,
        sortRules: (viewMode === 'HEADER' ? headerSortRules : lineSortRules) as any,
        pageSize: activePageSize,
        filters: currentFilterSnapshot(),
      });
      if (viewMode === 'HEADER') {
        setActiveHeaderLayoutId(saved.id);
        saveUserGridLayout(userId, {
          columns: headerColumnStates,
          sortRules: headerSortRules,
          layoutName: saved.layoutName,
        });
      } else {
        setActiveLineLayoutId(saved.id);
      }
      setSavedLayoutsTick((t) => t + 1);
      showFeedbackToast(
        `Saved ${viewMode === 'HEADER' ? 'Header View' : 'Line View'} layout "${saved.layoutName}" for ${currentUser.fullName}.`
      );
    } catch (err: any) {
      const msg = err?.message || 'Unable to save layout preferences.';
      setLayoutPersistError(msg);
      showFeedbackToast(msg, 'error');
    }
  };

  const handleSaveNewNamedLayout = (layoutName: string, setAsDefault: boolean) => {
    try {
      setLayoutPersistError(null);
      const saved = saveNamedViewLayout({
        userId,
        viewType: viewMode,
        companyId: layoutCompanyScope,
        layoutName,
        columns: (viewMode === 'HEADER' ? headerColumnStates : lineColumnStates) as any,
        sortRules: (viewMode === 'HEADER' ? headerSortRules : lineSortRules) as any,
        pageSize: activePageSize,
        filters: currentFilterSnapshot(),
        isDefault: setAsDefault,
      });
      if (viewMode === 'HEADER') {
        setActiveHeaderLayoutId(saved.id);
      } else {
        setActiveLineLayoutId(saved.id);
      }
      setSavedLayoutsTick((t) => t + 1);
      showFeedbackToast(`Saved new layout "${saved.layoutName}" for ${viewMode} View.`);
    } catch (err: any) {
      const msg = err?.message || 'Failed to save new layout.';
      setLayoutPersistError(msg);
      showFeedbackToast(msg, 'error');
    }
  };

  const handleUpdateNamedLayout = (layoutId: string, layoutName: string) => {
    try {
      setLayoutPersistError(null);
      const updated = saveNamedViewLayout({
        userId,
        viewType: viewMode,
        companyId: layoutCompanyScope,
        layoutId,
        layoutName,
        columns: (viewMode === 'HEADER' ? headerColumnStates : lineColumnStates) as any,
        sortRules: (viewMode === 'HEADER' ? headerSortRules : lineSortRules) as any,
        pageSize: activePageSize,
        filters: currentFilterSnapshot(),
      });
      if (viewMode === 'HEADER') {
        setActiveHeaderLayoutId(updated.id);
      } else {
        setActiveLineLayoutId(updated.id);
      }
      setSavedLayoutsTick((t) => t + 1);
      showFeedbackToast(`Updated layout "${updated.layoutName}".`);
    } catch (err: any) {
      const msg = err?.message || 'Failed to update layout.';
      setLayoutPersistError(msg);
      showFeedbackToast(msg, 'error');
    }
  };

  const handleLoadNamedLayout = (layoutId: string) => {
    try {
      setLayoutPersistError(null);
      const loaded = loadSavedViewLayoutById(userId, viewMode, layoutCompanyScope, layoutId);
      const normalizedPageSize = dataGridService.normalizePageSize(loaded.pageSize);
      if (viewMode === 'HEADER') {
        setHeaderColumnStates(loaded.columns as PRUserColumnState<PRColumnKey>[]);
        setHeaderSortRules(loaded.sortRules as PRSortRule<PRColumnKey>[]);
        setHeaderPageSize(normalizedPageSize);
        setActiveHeaderLayoutId(loaded.id);
      } else {
        setLineColumnStates(loaded.columns as PRUserColumnState<PRLineColumnKey>[]);
        setLineSortRules(loaded.sortRules as PRSortRule<PRLineColumnKey>[]);
        setLinePageSize(normalizedPageSize);
        setActiveLineLayoutId(loaded.id);
      }
      applySavedFilterSnapshot(loaded.filters);
      setCurrentPage(1);
      setSavedLayoutsTick((t) => t + 1);
      showFeedbackToast(`Loaded layout "${loaded.layoutName}".`);
    } catch (err: any) {
      const msg = err?.message || 'Failed to load layout.';
      setLayoutPersistError(msg);
      showFeedbackToast(msg, 'error');
    }
  };

  const handleSetDefaultNamedLayout = (layoutId: string) => {
    try {
      setLayoutPersistError(null);
      setDefaultSavedViewLayout(userId, viewMode, layoutCompanyScope, layoutId);
      if (viewMode === 'HEADER') setActiveHeaderLayoutId(layoutId);
      else setActiveLineLayoutId(layoutId);
      setSavedLayoutsTick((t) => t + 1);
      showFeedbackToast('Default layout updated.');
    } catch (err: any) {
      const msg = err?.message || 'Failed to set default layout.';
      setLayoutPersistError(msg);
      showFeedbackToast(msg, 'error');
    }
  };

  const handleDeleteNamedLayout = (layoutId: string) => {
    try {
      setLayoutPersistError(null);
      deleteSavedViewLayout(userId, viewMode, layoutCompanyScope, layoutId);
      if (viewMode === 'HEADER' && activeHeaderLayoutId === layoutId) {
        setActiveHeaderLayoutId(null);
      }
      if (viewMode === 'LINE' && activeLineLayoutId === layoutId) {
        setActiveLineLayoutId(null);
      }
      setSavedLayoutsTick((t) => t + 1);
      showFeedbackToast('Saved layout deleted.');
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete saved layout.';
      setLayoutPersistError(msg);
      showFeedbackToast(msg, 'error');
    }
  };

  const handleResetLayout = () => {
    const reset = resetViewGridLayout(userId, viewMode, layoutCompanyScope);
    const targetGridId =
      viewMode === 'HEADER' ? 'purchase-requisition-list' : 'purchase-requisition-line-list';
    dataGridService.resetUserGridPreference(targetGridId, userId, deviceType);
    const defaultSize = dataGridService.getGlobalGridSettings().defaultPageSize ?? 20;

    if (viewMode === 'HEADER') {
      setHeaderColumnStates(reset.columns as PRUserColumnState<PRColumnKey>[]);
      setHeaderSortRules([]);
      setHeaderPageSize(defaultSize);
      setActiveHeaderLayoutId(null);
    } else {
      setLineColumnStates(reset.columns as PRUserColumnState<PRLineColumnKey>[]);
      setLineSortRules([]);
      setLinePageSize(defaultSize);
      setActiveLineLayoutId(null);
    }
    setCurrentPage(1);
    setSavedLayoutsTick((t) => t + 1);
    showFeedbackToast(
      `Restored ${viewMode === 'HEADER' ? 'Header View' : 'Line View'} Factory Default layout, 20 rows/page, and Newest-First (DESC) sort.`
    );
  };

  const handleExecuteBulkAction = () => {
    if (selectedPrIdsForBulk.length === 0) return;
    const result = PurchaseRequisitionService.executeBulkPrAction({
      prIds: selectedPrIdsForBulk,
      action: bulkActionType,
      reason: bulkReason,
      remarks: bulkRemarks,
      user: currentUser,
    });
    const updatedPrs = PurchaseRequisitionService.getPurchaseRequisitions();
    setBulkOutcomeReport(result);
    setPrs(updatedPrs);

    if (bulkActionType === 'APPROVE' && result.succeeded.length > 0) {
      const approvedIds = new Set(result.succeeded.map((s) => s.prId));
      const approvedList = updatedPrs.filter(
        (p) => approvedIds.has(p.id) && isPrStatusApproved(p.status)
      );
      approvedList.forEach((ap) => {
        printPurchaseRequisitionPdf(ap, { printedBy: currentUser.fullName });
      });
    }

    showFeedbackToast(
      `Bulk ${bulkActionType}: ${result.succeeded.length} succeeded, ${result.failed.length} failed, ${result.skipped.length} skipped.`
    );
  };

  // Governed Scoped Export (Current Page vs All Filtered) in CSV / Excel / PDF
  const exportData = async (
    format: 'csv' | 'excel' | 'pdf',
    exportScope: 'CURRENT_PAGE' | 'ALL_FILTERED' = 'CURRENT_PAGE'
  ) => {
    if (
      exportScope === 'ALL_FILTERED' &&
      !rbacPermissionService.hasPermission(currentUser, 'EXPORT_ALL_FILTERED')
    ) {
      showFeedbackToast(
        'RBAC Denied: EXPORT_ALL_FILTERED permission is required to export all filtered records.',
        'error'
      );
      return;
    }

    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (viewMode === 'HEADER') {
      const baseDataset = exportScope === 'CURRENT_PAGE' ? paginatedPrs : sortedPrs;
      const dataToExport =
        selectedHeaderIds.size > 0
          ? baseDataset.filter((pr) => selectedHeaderIds.has(pr.id))
          : baseDataset;
      const activeDefs = visibleHeaderColumns.map((c) => getColumnDefinition(c.key));
      headers = activeDefs.map((d) => d.label);
      rows = dataToExport.map((pr) =>
        activeDefs.map((d) => getColumnDisplayText(pr, d.key))
      );
    } else {
      const baseLineDataset =
        exportScope === 'CURRENT_PAGE' ? paginatedLineRows : sortedLineRows;
      const linesToExport =
        selectedLineRowIds.size > 0
          ? baseLineDataset.filter((row) => selectedLineRowIds.has(row.rowId))
          : baseLineDataset;
      const activeLineDefs = visibleLineColumns.map((c) => getLineColumnDefinition(c.key));
      headers = activeLineDefs.map((d) => d.label);
      rows = linesToExport.map((row) =>
        activeLineDefs.map((d) => getLineColumnDisplayText(row, d.key))
      );
    }

    const settings = dataGridService.getGlobalGridSettings();
    const res = await executeScopedExport({
      title: `Purchase Requisitions (${viewMode === 'HEADER' ? 'Header View' : 'Line / Live View'})`,
      subtitle: `Financial Year: ${fyFilterResult.selectedFy?.financialYearCode || 'All Years'} | Default Sort: Newest First (DESC)`,
      headers,
      rows,
      filenamePrefix: `PurchaseRequisitions_${viewMode}`,
      scopeLabel: `User: ${currentUser.fullName}`,
      format,
      exportScope,
      maxRecordsLimit: settings.maxExportRecords,
      maxSizeBytesLimit: settings.maxExportFileSizeBytes,
    });
    showFeedbackToast(res.message);
  };

  const getStatusBadge = (status: PRStatus) => {
    switch (status) {
      case 'APPROVED_PENDING_BUYER':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 whitespace-nowrap">
            Approved - Pending Buyer
          </span>
        );
      case 'PENDING_MANAGER_APPROVAL':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300 whitespace-nowrap">
            Pending Manager L1
          </span>
        );
      case 'PENDING_SUBSEQUENT_APPROVAL':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-300 whitespace-nowrap">
            Pending Category Approval
          </span>
        );
      case 'PENDING_REAPPROVAL':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-300 whitespace-nowrap">
            Pending Reapproval
          </span>
        );
      case 'DRAFT':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap">
            Draft
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300 whitespace-nowrap">
            Rejected
          </span>
        );
      case 'RETURNED_FOR_CORRECTION':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-300 whitespace-nowrap">
            Returned for Correction
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap">
            Cancelled
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
            Completed
          </span>
        );
      case 'SHORT_CLOSED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 whitespace-nowrap">
            Short Closed
          </span>
        );
      case 'WITHDRAWN':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800 border border-slate-400 whitespace-nowrap">
            Withdrawn
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap">
            {status}
          </span>
        );
    }
  };

  const getTypeBadge = (type: PRType) => {
    switch (type) {
      case 'MRP':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            MRP
          </span>
        );
      case 'MANUAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Manual
          </span>
        );
      case 'REPAIR':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Repair
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
            Maintenance
          </span>
        );
      case 'CAPEX_ASSET':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
            Capex / Asset
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: PurchaseRequisitionHeader['priority']) => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            CRITICAL
          </span>
        );
      case 'URGENT':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            URGENT
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            NORMAL
          </span>
        );
    }
  };

  const renderCellContent = (pr: PurchaseRequisitionHeader, key: PRColumnKey) => {
    const fullText = getColumnDisplayText(pr, key);
    switch (key) {
      case 'prNumber':
        return (
          <div className="font-mono font-bold text-indigo-700 truncate" title={fullText}>
            {pr.prNumber}
          </div>
        );
      case 'prType':
        return <div title={fullText}>{getTypeBadge(pr.prType)}</div>;
      case 'branchName':
        return (
          <div className="font-bold text-slate-800 truncate" title={fullText}>
            {pr.branchName}
          </div>
        );
      case 'department':
        return (
          <div className="text-slate-700 font-medium truncate" title={fullText}>
            {pr.department}
          </div>
        );
      case 'requesterName':
        return (
          <div className="font-medium text-slate-800 truncate" title={fullText}>
            {pr.requesterName}
          </div>
        );
      case 'purposeAndItems':
        return (
          <div title={`${pr.purchasePurpose} (${pr.lines.length} item line(s))`}>
            <div className="font-semibold text-slate-800 truncate">{pr.purchasePurpose}</div>
            <div className="text-[11px] text-slate-500">{pr.lines.length} item line(s)</div>
          </div>
        );
      case 'currency': {
        const curr = getPrCurrency(pr);
        return (
          <div className="text-center" title={`Transaction Currency: ${curr}`}>
            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono font-bold text-slate-800 text-[11px]">
              {curr}
            </span>
          </div>
        );
      }
      case 'estimatedTotalValue': {
        const formatted = formatEstimatedValue(pr.estimatedTotalValue, getPrCurrency(pr));
        return (
          <div
            className="text-right font-mono font-bold text-slate-900 truncate"
            title={formatted}
          >
            {formatted}
          </div>
        );
      }
      case 'expectedDeliveryDate': {
        const expDate = getExpectedDeliveryDate(pr);
        return (
          <div
            className="font-mono font-medium text-slate-800 flex items-center gap-1.5 truncate"
            title={expDate ? `Expected Delivery Date: ${expDate}` : 'Not specified'}
          >
            <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>{expDate || '—'}</span>
          </div>
        );
      }
      case 'prDate': {
        const dateStr = pr.createdAt
          ? new Date(pr.createdAt).toISOString().slice(0, 10)
          : '—';
        return (
          <div className="font-mono text-slate-600 truncate" title={dateStr}>
            {dateStr}
          </div>
        );
      }
      case 'budgetValidationStatus': {
        const bgtOn = prGovernancePolicyService.isBudgetValidationEnabled(
          pr.companyId,
          pr.branchId
        );
        if (!bgtOn) {
          return (
            <div title="Budget Validation is OFF under active policy">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap bg-slate-100 text-slate-500 border border-slate-200">
                Disabled
              </span>
            </div>
          );
        }
        return (
          <div title={pr.budgetValidationStatus}>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                pr.budgetValidationStatus === 'SUFFICIENT'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {pr.budgetValidationStatus}
            </span>
          </div>
        );
      }
      case 'approvalStatus':
        return <div title={fullText}>{getStatusBadge(getEffectivePRStatus(pr))}</div>;
      case 'buyerStatus': {
        const bStatus = getBuyerStatus(pr);
        return (
          <div title={bStatus} className="truncate">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                bStatus.includes('ACTION')
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {bStatus}
            </span>
          </div>
        );
      }
      case 'assignedBuyer': {
        const buyer = getAssignedBuyer(pr);
        return (
          <div className="font-medium text-slate-700 truncate" title={buyer}>
            {buyer}
          </div>
        );
      }
      case 'priority':
        return <div title={pr.priority}>{getPriorityBadge(pr.priority)}</div>;
      case 'requiredBy': {
        const reqDate = getRequiredByDate(pr);
        return (
          <div className="font-mono text-slate-700 truncate" title={reqDate || '—'}>
            {reqDate || '—'}
          </div>
        );
      }
      case 'creatorName':
        return (
          <div
            className="text-slate-700 truncate"
            title={pr.creatorName || pr.requesterName}
          >
            {pr.creatorName || pr.requesterName}
          </div>
        );
      case 'createdAt':
        return (
          <div className="text-[11px] font-mono text-slate-600 truncate" title={fullText}>
            {fullText}
          </div>
        );
      case 'modifiedBy':
        return (
          <div className="text-slate-700 truncate" title={getModifiedBy(pr)}>
            {getModifiedBy(pr)}
          </div>
        );
      case 'updatedAt':
        return (
          <div className="text-[11px] font-mono text-slate-600 truncate" title={fullText}>
            {fullText}
          </div>
        );
    }
  };

  const renderLineCellContent = (row: PRLineGridRow, key: PRLineColumnKey) => {
    const fullText = getLineColumnDisplayText(row, key);
    switch (key) {
      case 'prNumber':
        return (
          <div className="font-mono font-bold text-indigo-700 truncate" title={fullText}>
            {row.prNumber}
          </div>
        );
      case 'lineNumber':
        return (
          <div className="text-center font-mono font-semibold text-slate-600" title={`Line ${row.lineNumber}`}>
            {row.lineNumber}
          </div>
        );
      case 'itemCode':
        return (
          <div className="font-mono font-semibold text-slate-800 truncate" title={row.itemCode}>
            {row.itemCode}
          </div>
        );
      case 'description':
        return (
          <div className="text-slate-800 truncate" title={row.description}>
            {row.description}
          </div>
        );
      case 'itemCategory':
        return (
          <div className="text-slate-600 truncate" title={row.itemCategory}>
            {row.itemCategory || '—'}
          </div>
        );
      case 'inventoryUom':
        return (
          <div className="text-center font-mono text-slate-700" title={row.inventoryUom}>
            {row.inventoryUom || '—'}
          </div>
        );
      case 'requestedQuantity':
        return <div className="text-right font-mono text-slate-800">{row.requestedQuantity}</div>;
      case 'receivedQuantity':
        return <div className="text-right font-mono text-slate-600">{row.receivedQuantity}</div>;
      case 'pendingQuantity':
        return (
          <div className="text-right font-mono font-bold text-amber-700">
            {row.pendingQuantity}
          </div>
        );
      case 'currency':
        return (
          <div className="text-center" title={`Currency: ${row.currency}`}>
            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono font-bold text-slate-800 text-[11px]">
              {row.currency}
            </span>
          </div>
        );
      case 'approximateUnitPrice': {
        const formatted = formatEstimatedValue(row.approximateUnitPrice, row.currency);
        return (
          <div className="text-right font-mono text-slate-800 truncate" title={formatted}>
            {formatted}
          </div>
        );
      }
      case 'estimatedTotalValue': {
        const formatted = formatEstimatedValue(row.estimatedTotalValue, row.currency);
        return (
          <div className="text-right font-mono font-bold text-slate-900 truncate" title={formatted}>
            {formatted}
          </div>
        );
      }
      case 'expectedDeliveryDate':
        return (
          <div className="font-mono text-slate-800 flex items-center gap-1.5 truncate" title={fullText}>
            <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>{row.expectedDeliveryDate || '—'}</span>
          </div>
        );
      case 'prDate':
        return (
          <div className="font-mono text-slate-600 truncate" title={fullText}>
            {row.prDate || '—'}
          </div>
        );
      case 'lineStatus':
        return <div title={fullText}>{getStatusBadge(row.effectiveStatus)}</div>;
      case 'prType':
        return <div title={fullText}>{getTypeBadge(row.prType)}</div>;
      case 'branchName':
        return (
          <div className="font-semibold text-slate-800 truncate" title={fullText}>
            {row.branchName}
          </div>
        );
      case 'department':
        return (
          <div className="text-slate-700 truncate" title={fullText}>
            {row.department}
          </div>
        );
      case 'requesterName':
        return (
          <div className="text-slate-800 truncate" title={fullText}>
            {row.requesterName}
          </div>
        );
      case 'budgetValidationStatus': {
        const bgtOn = prGovernancePolicyService.isBudgetValidationEnabled(
          row.pr.companyId,
          row.pr.branchId
        );
        if (!bgtOn) {
          return (
            <div title="Budget Validation is OFF under active policy">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap bg-slate-100 text-slate-500 border border-slate-200">
                Disabled
              </span>
            </div>
          );
        }
        return (
          <div title={row.budgetValidationStatus}>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                row.budgetValidationStatus === 'SUFFICIENT'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {row.budgetValidationStatus}
            </span>
          </div>
        );
      }
      case 'buyerStatus':
        return (
          <div title={row.buyerStatus} className="truncate">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                row.buyerStatus.includes('ACTION')
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {row.buyerStatus}
            </span>
          </div>
        );
      case 'assignedBuyer':
        return (
          <div className="font-medium text-slate-700 truncate" title={fullText}>
            {row.assignedBuyer}
          </div>
        );
      case 'createdAt':
      case 'updatedAt':
        return (
          <div className="text-[11px] font-mono text-slate-600 truncate" title={fullText}>
            {fullText}
          </div>
        );
    }
  };

  // Total table width in Desktop HEADER & LINE views based on visible column widths + checkbox (44px) + actions (116px)
  const totalHeaderTableWidth = useMemo(() => {
    const colsSum = visibleHeaderColumns.reduce((sum, col) => sum + col.width, 0);
    return colsSum + 44 + 116;
  }, [visibleHeaderColumns]);

  const totalLineTableWidth = useMemo(() => {
    const colsSum = visibleLineColumns.reduce((sum, col) => sum + col.width, 0);
    return colsSum + 44 + 116;
  }, [visibleLineColumns]);

  return (
    <div className="w-full max-w-none min-w-0 space-y-3.5 sm:space-y-4">
      {/* Applicability Warning Banner if disabled */}
      {!isApplicable && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 p-3 rounded-xl flex items-center gap-3 text-xs font-medium min-w-0">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="min-w-0 break-words">
            <span className="font-bold">Governance Policy Notice:</span>{' '}
            {canCreatePrCheck.reason ||
              `Purchase Requisitions are currently restricted or disabled for your branch (${currentBranchId}) under General Settings → Purchase Requisition.`}
          </div>
        </div>
      )}

      {/* Active PR Governance Policy Summary Strip — Restricted to Admins Only */}
      {canViewPrGovernancePolicyStrip(currentUser) && (
        <div
          data-testid="pr-governance-policy-strip"
          className="bg-indigo-950 text-white px-3.5 py-2.5 rounded-xl border border-indigo-800 flex flex-wrap items-center justify-between gap-2 text-xs min-w-0"
        >
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="font-bold text-indigo-300 uppercase tracking-wider text-[10px]">
              Active PR Governance Policy:
            </span>
            <span className="font-bold truncate">
              {effectivePolicy.companyCode} / {effectivePolicy.branchName}
            </span>
            <span className="px-2 py-0.5 rounded bg-indigo-800 text-indigo-100 font-mono font-bold text-[10px]">
              {effectivePolicy.policyVersion} ({effectivePolicy.resolutionSource})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
            <span
              className={`px-2 py-0.5 rounded ${
                effectivePolicy.activation.manualPrCreationEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              Manual PR: {effectivePolicy.activation.manualPrCreationEnabled ? 'ON' : 'OFF'}
            </span>
            <span
              className={`px-2 py-0.5 rounded ${
                effectivePolicy.activation.partialConversionEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              Partial Conv: {effectivePolicy.activation.partialConversionEnabled ? 'ON' : 'OFF'}
            </span>
            <span
              className={`px-2 py-0.5 rounded ${
                effectivePolicy.activation.prShortCloseEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              Short Close: {effectivePolicy.activation.prShortCloseEnabled ? 'ON' : 'OFF'}
            </span>
            <span
              className={`px-2 py-0.5 rounded ${
                effectivePolicy.activation.prCancellationEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              Cancel: {effectivePolicy.activation.prCancellationEnabled ? 'ON' : 'OFF'}
            </span>
            {effectivePolicy.activation.budgetValidationEnabled &&
              effectivePolicy.budget?.enableBudgetValidation && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Budget Recon: ON
                </span>
              )}
          </div>
        </div>
      )}

      {/* Layout Toast Notification */}
      {layoutToast && (
        <div
          className={`px-4 py-2.5 rounded-xl shadow-md border flex items-center justify-between text-xs font-medium min-w-0 ${
            layoutToast.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-indigo-950 text-white border-indigo-700'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                layoutToast.type === 'error' ? 'text-rose-300' : 'text-emerald-400'
              }`}
            />
            <span className="truncate">{layoutToast.message}</span>
          </div>
          <button
            onClick={() => setLayoutToast(null)}
            className="text-slate-300 hover:text-white p-0.5 cursor-pointer shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
            <span className="truncate">Purchase Requisitions</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Manage MRP, Manual, Repair, and Maintenance PRs with configurable columns, multi-currency tracking, expected delivery scheduling, and Manager L1 approval.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowConsolidatedReport(true)}
            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Governance Analytics</span>
          </button>

          <button
            type="button"
            onClick={onOpenCleanupView}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Stale Cleanup</span>
          </button>

          <button
            type="button"
            onClick={onOpenCreateModal}
            disabled={!isApplicable || isHistoricalReadOnly}
            title={
              isHistoricalReadOnly
                ? 'Disabled while viewing a CLOSED historical Financial Year'
                : 'Create a new Purchase Requisition'
            }
            className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer ${
              !isApplicable || isHistoricalReadOnly ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Create PR</span>
          </button>
        </div>
      </div>

      {/* Centralized Financial Year Selector & Historical Governance Filter */}
      <FinancialYearSelector
        companyId={currentCompanyId}
        selectedFyId={selectedFyId}
        onSelectFy={(fyId) => {
          setSelectedFyId(fyId);
          setSelectedHeaderIds(new Set());
          setSelectedLineRowIds(new Set());
        }}
        currentUser={currentUser}
        dataQualityGaps={fyFilterResult.dataQualityGaps}
        entityLabel="Purchase Requisitions"
      />

      {/* KPI Summary Cards — Responsive across Desktop, Tablet, Mobile Portrait & Landscape */}
      <ResponsiveKPIGrid>
        <div
          onClick={() => {
            setSelectedStatus('ALL');
            setSelectedType('ALL');
            setSelectedCurrency('ALL');
            setDeliveryDateFilter('');
          }}
          className={`bg-white p-3.5 rounded-xl border shadow-xs cursor-pointer transition hover:shadow-md min-w-0 ${
            selectedStatus === 'ALL' && selectedType === 'ALL'
              ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/20'
              : 'border-slate-200 hover:border-indigo-300'
          }`}
        >
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between gap-1">
            <span className="truncate">Total Active PRs</span>
            <span className="text-[10px] text-indigo-600 font-bold underline shrink-0">Show All</span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">{fyScopedPrs.length}</div>
          <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium truncate">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            {fyFilterResult.selectedFy ? fyFilterResult.selectedFy.financialYearCode : 'All FYs'}
          </div>
        </div>

        <div
          onClick={() => setSelectedStatus('PENDING_MANAGER_APPROVAL')}
          className={`bg-white p-3.5 rounded-xl border shadow-xs cursor-pointer transition hover:shadow-md min-w-0 ${
            selectedStatus === 'PENDING_MANAGER_APPROVAL'
              ? 'border-amber-500 ring-1 ring-amber-500 bg-amber-50/20'
              : 'border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between gap-1">
            <span className="truncate">Pending Approvals</span>
            <span className="text-[10px] text-amber-600 font-bold underline shrink-0">Filter Pending</span>
          </div>
          <div className="text-xl font-bold text-amber-600 mt-1">
            {fyScopedPrs.filter((p) => p.status.includes('PENDING')).length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">Manager L1 & Matrix</div>
        </div>

        <div
          onClick={() => setSelectedStatus('APPROVED_PENDING_BUYER')}
          className={`bg-white p-3.5 rounded-xl border shadow-xs cursor-pointer transition hover:shadow-md min-w-0 ${
            selectedStatus === 'APPROVED_PENDING_BUYER'
              ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/20'
              : 'border-slate-200 hover:border-indigo-300'
          }`}
        >
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between gap-1">
            <span className="truncate">Approved - Pending Buyer</span>
            <span className="text-[10px] text-indigo-600 font-bold underline shrink-0">Filter Approved</span>
          </div>
          <div className="text-xl font-bold text-indigo-600 mt-1">
            {fyScopedPrs.filter((p) => p.status === 'APPROVED_PENDING_BUYER').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">Ready for buyer assignment</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs min-w-0">
          <div className="text-xs text-slate-500 font-medium truncate">
            Estimated Value by Currency
          </div>
          <div className="mt-1 space-y-0.5">
            {currencyBreakdown.length > 0 ? (
              currencyBreakdown.map(([curr, amt]) => (
                <div
                  key={curr}
                  className="flex items-center justify-between gap-2 text-xs font-mono font-bold text-slate-900"
                >
                  <span className="px-1.5 py-0.2 bg-slate-100 rounded border border-slate-200 text-[10px] text-slate-700 shrink-0">
                    {curr}
                  </span>
                  <span className="truncate">{formatEstimatedValue(amt, curr)}</span>
                </div>
              ))
            ) : (
              <div className="text-sm font-bold text-slate-400">0</div>
            )}
          </div>
        </div>
      </ResponsiveKPIGrid>

      {/* Controlled Bulk Governance Action Bar (Requirement J) */}
      {activeSelectionCount > 0 && !isHistoricalReadOnly && (
        <div className="bg-indigo-950 text-white p-3 rounded-xl border border-indigo-700 shadow-md flex flex-wrap items-center justify-between gap-2.5 text-xs min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="font-bold">
              {activeSelectionCount}{' '}
              {viewMode === 'HEADER'
                ? 'PR(s)'
                : `Line(s) across ${selectedPrIdsForBulk.length} PR(s)`}{' '}
              Selected for Controlled Bulk Action
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setBulkActionType('APPROVE');
                setBulkOutcomeReport(null);
                setShowBulkModal(true);
              }}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] cursor-pointer"
            >
              Bulk Approve
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkActionType('SUBMIT');
                setBulkOutcomeReport(null);
                setShowBulkModal(true);
              }}
              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-[11px] cursor-pointer"
            >
              Bulk Submit
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkActionType('RETURN');
                setBulkOutcomeReport(null);
                setShowBulkModal(true);
              }}
              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-[11px] cursor-pointer"
            >
              Bulk Return
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkActionType('SHORT_CLOSE');
                setBulkOutcomeReport(null);
                setShowBulkModal(true);
              }}
              className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-[11px] cursor-pointer"
            >
              Bulk Short Close
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkActionType('CANCEL');
                setBulkOutcomeReport(null);
                setShowBulkModal(true);
              }}
              className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-[11px] cursor-pointer"
            >
              Bulk Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedHeaderIds(new Set());
                setSelectedLineRowIds(new Set());
              }}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold text-[11px] cursor-pointer"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Register Controls Toolbar (Search, Filters, Header/Line View, Column Settings, Saved Layouts, Refresh, Export) */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2.5 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
          {/* Search Input — Responsive min-width so it never overflows 360px mobile */}
          <div className="relative flex-1 min-w-[180px] sm:min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              aria-label="Search Purchase Requisitions"
              placeholder="Search PR Number, Item Code, Description, Requester, Branch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Filter Drawer Trigger Button */}
          {isMobile && (
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[10px]">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}

          {/* Primary Register Action Controls */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Header / Line (Live) View Toggle */}
            <div
              className="flex bg-slate-100 p-1 rounded-lg border border-slate-200"
              role="tablist"
              aria-label="Purchase Requisition view mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'HEADER'}
                onClick={() => setViewMode('HEADER')}
                className={`px-2.5 sm:px-3 py-1 rounded font-bold text-xs transition cursor-pointer ${
                  viewMode === 'HEADER'
                    ? 'bg-white text-indigo-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Header
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'LINE'}
                onClick={() => setViewMode('LINE')}
                className={`px-2.5 sm:px-3 py-1 rounded font-bold text-xs transition cursor-pointer ${
                  viewMode === 'LINE'
                    ? 'bg-white text-indigo-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Line
              </button>
            </div>

            {/* Advanced Filters Toggle Button */}
            <AdvancedFilterToggleButton
              isOpen={advancedFilterOpen}
              onToggle={() => {
                if (
                  !advancedFilterOpen &&
                  advancedFilterState.groups.length === 0 &&
                  prHeaderFilterFields.length > 0
                ) {
                  setAdvancedFilterState({
                    groupLogicalOperator: 'AND',
                    groups: [createEmptyGroup(prHeaderFilterFields[0], 1)],
                  });
                }
                setAdvancedFilterOpen((prev) => !prev);
              }}
              activeCount={activeFilterCount}
            />

            {/* Column Settings Button (Active View Scoped) */}
            <button
              type="button"
              onClick={() => setShowColumnSettings(true)}
              className="px-2.5 sm:px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title={`Configure ${viewMode === 'HEADER' ? 'Header View' : 'Line / Live View'} columns, visibility, and order`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span>Column Settings</span>
              <span className="px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[10px]">
                {activeVisibleColumnCount}/{activeTotalColumnCount}
              </span>
            </button>

            {/* Saved Layouts Manager Button (Desktop, Tablet & Mobile) */}
            <button
              type="button"
              onClick={() => {
                setLayoutPersistError(null);
                setShowSavedLayoutsModal(true);
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                hasSavedLayout
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title={`Manage Saved Layouts for ${viewMode === 'HEADER' ? 'Header View' : 'Line / Live View'}`}
            >
              <BookmarkCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Saved Layout</span>
              {savedLayoutsForActiveView.length > 0 && (
                <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-[10px]">
                  {savedLayoutsForActiveView.length}
                </span>
              )}
            </button>

            {/* Reset Layout Button */}
            <button
              type="button"
              onClick={handleResetLayout}
              className="px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title={`Restore Factory Default layout, 20 rows/page, and DESC sort for ${viewMode === 'HEADER' ? 'Header View' : 'Line View'}`}
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Reset Layout</span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              className="px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Refresh Purchase Requisition list"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Scoped Export Dropdown (Current Page vs All Filtered) */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => exportData('csv', 'CURRENT_PAGE')}
                className="px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
              <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 w-52 hidden group-hover:block z-30">
                <div className="px-3 py-1 text-[10px] font-bold uppercase text-slate-400">
                  Current Page ({activeCurrentPageCount})
                </div>
                <button
                  type="button"
                  onClick={() => exportData('csv', 'CURRENT_PAGE')}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Page CSV (.csv)
                </button>
                <button
                  type="button"
                  onClick={() => exportData('excel', 'CURRENT_PAGE')}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Page Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => exportData('pdf', 'CURRENT_PAGE')}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Page PDF (.pdf)
                </button>
                <div className="my-1 border-t border-slate-100" />
                <div className="px-3 py-1 text-[10px] font-bold uppercase text-indigo-600">
                  All Filtered ({activeTotalRecords})
                </div>
                <button
                  type="button"
                  onClick={() => exportData('csv', 'ALL_FILTERED')}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 font-semibold text-indigo-800 cursor-pointer"
                >
                  All Filtered CSV
                </button>
                <button
                  type="button"
                  onClick={() => exportData('excel', 'ALL_FILTERED')}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 font-semibold text-indigo-800 cursor-pointer"
                >
                  All Filtered Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => exportData('pdf', 'ALL_FILTERED')}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 font-semibold text-indigo-800 cursor-pointer"
                >
                  All Filtered PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop & Tablet Inline Filter Bar (Hidden on Mobile where Filter Drawer is used) */}
        {!isMobile && (
          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <MultiSelectFilterDropdown
                  label="Company"
                  allLabel="All Companies"
                  ariaLabel="Filter by Company"
                  value={selectedCompany}
                  onChange={setSelectedCompany}
                  options={filterOptions.companies.map((c) => ({
                    value: c.id,
                    label: c.label,
                  }))}
                />

                <MultiSelectFilterDropdown
                  label="Branch"
                  allLabel="All Branches"
                  ariaLabel="Filter by Branch"
                  value={selectedBranch}
                  onChange={setSelectedBranch}
                  options={filterOptions.branches.map((b) => ({
                    value: b.id,
                    label: b.label,
                  }))}
                />

                <MultiSelectFilterDropdown
                  label="Department"
                  allLabel="All Departments"
                  ariaLabel="Filter by Department"
                  value={selectedDepartment}
                  onChange={setSelectedDepartment}
                  options={filterOptions.departments.map((d) => ({
                    value: d,
                    label: d,
                  }))}
                />

                <MultiSelectFilterDropdown
                  label="PR Type"
                  allLabel="All PR Types"
                  ariaLabel="Filter by PR Type"
                  value={selectedType}
                  onChange={setSelectedType}
                  options={[
                    { value: 'MRP', label: 'MRP' },
                    { value: 'MANUAL', label: 'Manual' },
                    { value: 'REPAIR', label: 'Repair' },
                    { value: 'MAINTENANCE', label: 'Maintenance' },
                    { value: 'CAPEX_ASSET', label: 'Capex / Asset' },
                  ]}
                />

                <MultiSelectFilterDropdown
                  label="Approval Status"
                  allLabel="All Statuses"
                  ariaLabel="Filter by Approval Status"
                  value={selectedStatus}
                  onChange={setSelectedStatus}
                  options={[
                    { value: 'DRAFT', label: 'Draft' },
                    { value: 'PENDING_MANAGER_APPROVAL', label: 'Pending Manager L1' },
                    { value: 'PENDING_SUBSEQUENT_APPROVAL', label: 'Pending Category Approval' },
                    { value: 'APPROVED_PENDING_BUYER', label: 'Approved - Pending Buyer' },
                    { value: 'COMPLETED', label: 'Completed' },
                    { value: 'REJECTED', label: 'Rejected' },
                    { value: 'RETURNED_FOR_CORRECTION', label: 'Returned for Correction' },
                    { value: 'SHORT_CLOSED', label: 'Short Closed' },
                    { value: 'CANCELLED', label: 'Cancelled' },
                  ]}
                />

                {effectivePolicy.activation.budgetValidationEnabled &&
                  effectivePolicy.budget?.enableBudgetValidation && (
                    <MultiSelectFilterDropdown
                      label="Budget Status"
                      allLabel="All Budget Statuses"
                      ariaLabel="Filter by Budget Status"
                      value={selectedBudgetStatus}
                      onChange={setSelectedBudgetStatus}
                      options={[
                        { value: 'SUFFICIENT', label: 'Sufficient' },
                        { value: 'INSUFFICIENT', label: 'Insufficient' },
                        { value: 'EXCEPTION_APPROVED', label: 'Exception Approved' },
                        { value: 'MISSING_ASSIGNMENT', label: 'Missing Assignment' },
                        { value: 'NOT_VALIDATED', label: 'Not Validated' },
                      ]}
                    />
                  )}

                <MultiSelectFilterDropdown
                  label="Currency"
                  allLabel="All Currencies"
                  ariaLabel="Filter by Currency"
                  value={selectedCurrency}
                  onChange={setSelectedCurrency}
                  options={filterOptions.currencies.map((curr) => ({
                    value: curr,
                    label: curr,
                  }))}
                />

                <input
                  type="number"
                  aria-label="Minimum Estimated Value"
                  placeholder="Min Est. Value..."
                  value={minEstimatedValue}
                  onChange={(e) => setMinEstimatedValue(e.target.value)}
                  className="w-32 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="text-[11px] text-slate-500 flex items-center gap-3">
                <span>
                  Showing <strong className="text-slate-800">{activeTotalRecords}</strong> of{' '}
                  <strong className="text-slate-800">{activeUnfilteredRecords}</strong>{' '}
                  {viewMode === 'HEADER' ? 'PRs' : 'PR Lines'}
                </span>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllFilters}
                    className="text-slate-600 hover:text-slate-900 font-bold underline cursor-pointer"
                  >
                    Clear Filters ({activeFilterCount})
                  </button>
                )}
                {activeSortRules.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      viewMode === 'HEADER' ? setHeaderSortRules([]) : setLineSortRules([])
                    }
                    className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                  >
                    Clear Sort ({activeSortRules.length})
                  </button>
                )}
              </div>
            </div>

            {/* Independent Date-Range Filters Row: PR Date Range & Expected Delivery Date Range */}
            <div className="flex flex-wrap items-start gap-2.5 pt-1">
              <DateRangeFilterControl
                label="PR Date"
                range={prDateRange}
                onChange={setPrDateRange}
                fromAriaLabel="PR Date From"
                toAriaLabel="PR Date To"
              />
              <DateRangeFilterControl
                label="Expected Delivery Date"
                range={expectedDeliveryDateRange}
                onChange={setExpectedDeliveryDateRange}
                fromAriaLabel="Expected Delivery Date From"
                toAriaLabel="Expected Delivery Date To"
              />
            </div>
          </div>
        )}

        {/* Expandable 22-Field Advanced Filter Engine Panel */}
        <AdvancedFilterPanel
          moduleKey="PURCHASE_REQUISITION_LIST"
          userId={userId}
          fields={(viewMode === 'HEADER' ? prHeaderFilterFields : prLineFilterFields) as any}
          filterState={advancedFilterState}
          onChangeFilterState={setAdvancedFilterState}
          quickFiltersSnapshot={{
            selectedCompany,
            selectedBranch,
            selectedDepartment,
            selectedType,
            selectedStatus,
            selectedBudgetStatus,
            selectedCurrency,
            prDateRange,
            expectedDeliveryDateRange,
            minEstimatedValue,
          }}
          onApplyQuickFiltersSnapshot={(snap) => {
            if (snap.selectedCompany !== undefined) setSelectedCompany(snap.selectedCompany);
            if (snap.selectedBranch !== undefined) setSelectedBranch(snap.selectedBranch);
            if (snap.selectedDepartment !== undefined)
              setSelectedDepartment(snap.selectedDepartment);
            if (snap.selectedType !== undefined) setSelectedType(snap.selectedType);
            if (snap.selectedStatus !== undefined) setSelectedStatus(snap.selectedStatus);
            if (snap.selectedBudgetStatus !== undefined)
              setSelectedBudgetStatus(snap.selectedBudgetStatus);
            if (snap.selectedCurrency !== undefined) setSelectedCurrency(snap.selectedCurrency);
            if (snap.prDateRange !== undefined) setPrDateRange(snap.prDateRange);
            if (snap.expectedDeliveryDateRange !== undefined)
              setExpectedDeliveryDateRange(snap.expectedDeliveryDateRange);
            if (snap.minEstimatedValue !== undefined)
              setMinEstimatedValue(snap.minEstimatedValue);
          }}
          onResetAllFilters={handleClearAllFilters}
          isOpen={advancedFilterOpen}
          onToggleOpen={() => setAdvancedFilterOpen((prev) => !prev)}
          extraActiveFilterCount={activeFilterCount - activeAdvancedCount}
        />

        {/* Active Filter Chips Bar */}
        <ActiveFilterChipsBar
          chips={activeFilterChips}
          onClearAll={handleClearAllFilters}
          totalFilteredCount={activeTotalRecords}
          totalUnfilteredCount={activeUnfilteredRecords}
          entityPluralLabel={viewMode === 'HEADER' ? 'PRs' : 'PR Lines'}
        />

        {/* Mobile Record Summary Strip */}
        {isMobile && (
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
            <span>
              Showing <strong className="text-slate-800">{activeTotalRecords}</strong> of{' '}
              <strong className="text-slate-800">{activeUnfilteredRecords}</strong>{' '}
              {viewMode === 'HEADER' ? 'PRs' : 'PR Lines'}
            </span>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="text-indigo-600 font-bold underline cursor-pointer"
              >
                Reset Filters ({activeFilterCount})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mobile Slide-Up Filter Drawer */}
      <ResponsiveFilterPanel
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        onClearAll={handleClearAllFilters}
        activeFilterCount={activeFilterCount}
        title="Filter Purchase Requisitions"
      >
        <div className="space-y-3">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Company</label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All Companies</option>
              {filterOptions.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Branch</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All Branches</option>
              {filterOptions.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All Departments</option>
              {filterOptions.departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">PR Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All PR Types</option>
              <option value="MRP">MRP</option>
              <option value="MANUAL">Manual</option>
              <option value="REPAIR">Repair</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="CAPEX_ASSET">Capex / Asset</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Approval Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_MANAGER_APPROVAL">Pending Manager L1</option>
              <option value="PENDING_SUBSEQUENT_APPROVAL">Pending Category Approval</option>
              <option value="APPROVED_PENDING_BUYER">Approved - Pending Buyer</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
              <option value="RETURNED_FOR_CORRECTION">Returned for Correction</option>
              <option value="SHORT_CLOSED">Short Closed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {effectivePolicy.activation.budgetValidationEnabled &&
            effectivePolicy.budget?.enableBudgetValidation && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Budget Status</label>
                <select
                  value={selectedBudgetStatus}
                  onChange={(e) => setSelectedBudgetStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                >
                  <option value="ALL">All Budget Statuses</option>
                  <option value="SUFFICIENT">Sufficient</option>
                  <option value="INSUFFICIENT">Insufficient</option>
                  <option value="EXCEPTION_APPROVED">Exception Approved</option>
                  <option value="MISSING_ASSIGNMENT">Missing Assignment</option>
                  <option value="NOT_VALIDATED">Not Validated</option>
                </select>
              </div>
            )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">Transaction Currency</label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All Currencies</option>
              {filterOptions.currencies.map((curr) => (
                <option key={curr} value={curr}>
                  {curr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <DateRangeFilterControl
              label="PR Date"
              range={prDateRange}
              onChange={setPrDateRange}
              compact
            />
          </div>

          <div>
            <DateRangeFilterControl
              label="Expected Delivery Date"
              range={expectedDeliveryDateRange}
              onChange={setExpectedDeliveryDateRange}
              compact
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Minimum Estimated Value</label>
            <input
              type="number"
              placeholder="Enter minimum amount..."
              value={minEstimatedValue}
              onChange={(e) => setMinEstimatedValue(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            />
          </div>
        </div>
      </ResponsiveFilterPanel>

      {/* =====================================================================
          RESPONSIVE PRESENTATION LAYER:
          1. MOBILE (< 768px & Mobile Landscape): Vertical Record Cards
          2. TABLET (768px–1023px): Compact Expandable Table (No Horizontal Scroll)
          3. DESKTOP (1024px+): Full Configurable Enterprise Data Grid
         ===================================================================== */}
      {isMobile ? (
        <div
          className={`grid ${
            isMobileLandscape ? 'grid-cols-2' : 'grid-cols-1'
          } gap-3 w-full min-w-0`}
        >
          {viewMode === 'HEADER'
            ? paginatedPrs.map((pr) => {
                const curr = getPrCurrency(pr);
                const expDate = getExpectedDeliveryDate(pr) || '—';
                const effStatus = getEffectivePRStatus(pr);
                return (
                  <MobileRecordCard
                    key={pr.id}
                    id={pr.id}
                    primaryTitle={pr.prNumber}
                    subtitle={pr.purchasePurpose}
                    statusBadge={getStatusBadge(effStatus)}
                    selected={selectedHeaderIds.has(pr.id)}
                    onToggleSelect={() => toggleSelectHeader(pr.id)}
                    onClick={() => onOpenDetailsModal(pr)}
                    primaryFields={[
                      { label: 'Branch', value: pr.branchName },
                      { label: 'Department', value: pr.department },
                      { label: 'Requester', value: pr.requesterName },
                      { label: 'Currency', value: curr },
                      {
                        label: 'Estimated Value',
                        value: formatEstimatedValue(pr.estimatedTotalValue, curr),
                        highlight: true,
                      },
                      { label: 'Expected Delivery', value: expDate },
                    ]}
                    secondaryFields={[
                      { label: 'PR Type', value: pr.prType },
                      { label: 'Priority', value: pr.priority },
                      { label: 'Assigned Buyer', value: getAssignedBuyer(pr) },
                      {
                        label: 'Budget Check',
                        value: prGovernancePolicyService.isBudgetValidationEnabled(
                          pr.companyId,
                          pr.branchId
                        )
                          ? pr.budgetValidationStatus
                          : 'Disabled',
                      },
                      { label: 'Policy Version', value: pr.policyVersion || 'v2.4' },
                      { label: 'Lines Count', value: `${pr.lines.length} Line(s)` },
                    ]}
                    actions={
                      <button
                        type="button"
                        onClick={() => onOpenDetailsModal(pr)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        View Details
                      </button>
                    }
                  />
                );
              })
            : paginatedLineRows.map((row) => (
                <MobileRecordCard
                  key={row.rowId}
                  id={row.rowId}
                  primaryTitle={`${row.prNumber} • Line #${row.lineNumber}`}
                  subtitle={`${row.itemCode} — ${row.description}`}
                  statusBadge={getStatusBadge(row.effectiveStatus)}
                  selected={selectedLineRowIds.has(row.rowId)}
                  onToggleSelect={() => toggleSelectLine(row.rowId)}
                  onClick={() => onOpenDetailsModal(row.pr)}
                  primaryFields={[
                    { label: 'Req Qty', value: `${row.requestedQuantity} ${row.inventoryUom}` },
                    { label: 'Currency', value: row.currency },
                    {
                      label: 'Unit Price',
                      value: formatEstimatedValue(row.approximateUnitPrice, row.currency),
                    },
                    {
                      label: 'Line Value',
                      value: formatEstimatedValue(row.estimatedTotalValue, row.currency),
                      highlight: true,
                    },
                    { label: 'Expected Delivery', value: row.expectedDeliveryDate || '—' },
                    { label: 'Branch', value: row.branchName },
                  ]}
                  secondaryFields={[
                    { label: 'Item Category', value: row.itemCategory || '—' },
                    { label: 'Pending Qty', value: String(row.pendingQuantity) },
                    { label: 'Assigned Buyer', value: row.assignedBuyer },
                    { label: 'Department', value: row.department },
                  ]}
                  actions={
                    <button
                      type="button"
                      onClick={() => onOpenDetailsModal(row.pr)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      View PR
                    </button>
                  }
                />
              ))}
          {activeTotalRecords === 0 && (
            <div className="col-span-full bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 italic text-xs">
              {viewMode === 'HEADER'
                ? 'No purchase requisitions found matching the current filter criteria.'
                : 'No purchase requisition lines found matching the current filter criteria.'}
            </div>
          )}
        </div>
      ) : isTablet ? (
        /* TABLET COMPACT RESPONSIVE TABLE (768px–1023px — Zero Horizontal Overflow & Full Header/Line Parity) */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden w-full min-w-0">
          {viewMode === 'HEADER' ? (
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2.5 w-[5%] text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all purchase requisitions"
                      onChange={toggleSelectAll}
                      checked={selectedHeaderIds.size === sortedPrs.length && sortedPrs.length > 0}
                    />
                  </th>
                  <th
                    className="p-2.5 w-[18%] cursor-pointer hover:text-indigo-700"
                    onClick={(e) => handleHeaderColumnSort('prNumber', e)}
                  >
                    PR Number
                  </th>
                  <th
                    className="p-2.5 w-[31%] cursor-pointer hover:text-indigo-700"
                    onClick={(e) => handleHeaderColumnSort('purposeAndItems', e)}
                  >
                    Purpose & Branch
                  </th>
                  <th
                    className="p-2.5 w-[9%] text-center cursor-pointer hover:text-indigo-700"
                    onClick={(e) => handleHeaderColumnSort('currency', e)}
                  >
                    Curr
                  </th>
                  <th
                    className="p-2.5 w-[14%] text-right cursor-pointer hover:text-indigo-700"
                    onClick={(e) => handleHeaderColumnSort('estimatedTotalValue', e)}
                  >
                    Est. Value
                  </th>
                  <th
                    className="p-2.5 w-[13%] cursor-pointer hover:text-indigo-700"
                    onClick={(e) => handleHeaderColumnSort('approvalStatus', e)}
                  >
                    Status
                  </th>
                  <th className="p-2.5 w-[10%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedPrs.map((pr) => {
                  const curr = getPrCurrency(pr);
                  const expDate = getExpectedDeliveryDate(pr) || '—';
                  const isExpanded = expandedTabletRows.has(pr.id);
                  return (
                    <React.Fragment key={pr.id}>
                      <tr
                        onClick={() => onOpenDetailsModal(pr)}
                        className="hover:bg-indigo-50/40 transition cursor-pointer"
                      >
                        <td
                          className="p-2.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedHeaderIds.has(pr.id)}
                            onChange={() => toggleSelectHeader(pr.id)}
                          />
                        </td>
                        <td className="p-2.5 font-mono font-bold text-indigo-700 truncate">
                          <div className="truncate">{pr.prNumber}</div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            {getTypeBadge(pr.prType)}
                          </div>
                        </td>
                        <td className="p-2.5 min-w-0">
                          <div className="font-semibold text-slate-800 truncate">
                            {pr.purchasePurpose}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {pr.branchName} • {pr.department} • Deliv: {expDate}
                          </div>
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono font-bold text-slate-800 text-[10px]">
                            {curr}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 truncate">
                          {formatEstimatedValue(pr.estimatedTotalValue, curr)}
                        </td>
                        <td className="p-2.5 truncate">{getStatusBadge(getEffectivePRStatus(pr))}</td>
                        <td
                          className="p-2.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => toggleTabletRowExpand(pr.id)}
                              className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
                              title="Expand secondary details"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenDetailsModal(pr)}
                              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-bold cursor-pointer"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/90">
                          <td colSpan={7} className="p-3 border-t border-dashed border-slate-200">
                            <div className="grid grid-cols-4 gap-3 text-xs">
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                  Requester & Buyer
                                </span>
                                <span className="font-semibold text-slate-800">
                                  {pr.requesterName} / {getAssignedBuyer(pr)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                  Expected Delivery
                                </span>
                                <span className="font-mono font-semibold text-slate-800">
                                  {expDate}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                  Budget & Priority
                                </span>
                                <span className="font-semibold text-slate-800">
                                  {prGovernancePolicyService.isBudgetValidationEnabled(
                                    pr.companyId,
                                    pr.branchId
                                  )
                                    ? pr.budgetValidationStatus
                                    : 'Disabled'}{' '}
                                  • {pr.priority}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                  Policy Version
                                </span>
                                <span className="font-mono font-semibold text-indigo-700">
                                  {pr.policyVersion || effectivePolicy.policyVersion}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {sortedPrs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                      No purchase requisitions found matching the current filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2.5 w-[5%] text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all PR lines"
                      onChange={toggleSelectAll}
                      checked={
                        selectedLineRowIds.size === sortedLineRows.length &&
                        sortedLineRows.length > 0
                      }
                    />
                  </th>
                  <th
                    className="p-2.5 w-[18%] cursor-pointer hover:text-indigo-700"
                    onClick={(e) => handleLineColumnSort('prNumber', e)}
                  >
                    PR & Line
                  </th>
                  <th
                    className="p-2.5 w-[31%] cursor-pointer hover:text-indigo-700"
                    onClick={(e) => handleLineColumnSort('itemCode', e)}
                  >
                    Item & Qty
                  </th>
                  <th
                    className="p-2.5 w-[9%] text-center cursor-pointer hover:text-indigo-700"
                    onClick={(e) => handleLineColumnSort('currency', e)}
                  >
                    Curr
                  </th>
                  <th
                    className="p-2.5 w-[14%] text-right cursor-pointer hover:text-indigo-700"
                    onClick={(e) => handleLineColumnSort('estimatedTotalValue', e)}
                  >
                    Est. Value
                  </th>
                  <th
                    className="p-2.5 w-[13%] cursor-pointer hover:text-indigo-700"
                    onClick={(e) => handleLineColumnSort('lineStatus', e)}
                  >
                    Status
                  </th>
                  <th className="p-2.5 w-[10%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLineRows.map((row) => {
                  const isExpanded = expandedTabletRows.has(row.rowId);
                  return (
                    <React.Fragment key={row.rowId}>
                      <tr
                        onClick={() => onOpenDetailsModal(row.pr)}
                        className="hover:bg-indigo-50/40 transition cursor-pointer"
                      >
                        <td
                          className="p-2.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedLineRowIds.has(row.rowId)}
                            onChange={() => toggleSelectLine(row.rowId)}
                          />
                        </td>
                        <td className="p-2.5 font-mono font-bold text-indigo-700 truncate">
                          <div className="truncate">{row.prNumber}</div>
                          <div className="text-[11px] text-slate-500">Line #{row.lineNumber}</div>
                        </td>
                        <td className="p-2.5 min-w-0">
                          <div className="font-mono font-semibold text-slate-900 truncate">
                            {row.itemCode}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {row.description} • {row.requestedQuantity} {row.inventoryUom}
                          </div>
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono font-bold text-slate-800 text-[10px]">
                            {row.currency}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 truncate">
                          {formatEstimatedValue(row.estimatedTotalValue, row.currency)}
                        </td>
                        <td className="p-2.5 truncate">{getStatusBadge(row.effectiveStatus)}</td>
                        <td
                          className="p-2.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => toggleTabletRowExpand(row.rowId)}
                              className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
                              title="Expand secondary line details"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenDetailsModal(row.pr)}
                              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-bold cursor-pointer"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/90">
                          <td colSpan={7} className="p-3 border-t border-dashed border-slate-200">
                            <div className="grid grid-cols-4 gap-3 text-xs">
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                  Qty Breakdown
                                </span>
                                <span className="font-mono font-semibold text-slate-800">
                                  Req: {row.requestedQuantity} • Rec: {row.receivedQuantity} • Pend:{' '}
                                  {row.pendingQuantity}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                  Expected Delivery
                                </span>
                                <span className="font-mono font-semibold text-slate-800">
                                  {row.expectedDeliveryDate || '—'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                  Branch & Dept
                                </span>
                                <span className="font-semibold text-slate-800">
                                  {row.branchName} • {row.department}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                  Assigned Buyer
                                </span>
                                <span className="font-semibold text-indigo-700">
                                  {row.assignedBuyer}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {sortedLineRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                      No purchase requisition lines found matching the current filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* DESKTOP (1024px+): FULL-WIDTH CONFIGURABLE PR DATA GRID (HEADER & LINE PARITY) */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden w-full min-w-0">
          <div className="overflow-x-auto max-h-[68vh] w-full">
            {viewMode === 'HEADER' ? (
              <table
                className="text-left text-xs border-collapse table-fixed"
                style={{ width: `${totalHeaderTableWidth}px`, minWidth: '100%' }}
              >
                <colgroup>
                  <col style={{ width: '44px' }} />
                  {visibleHeaderColumns.map((col) => (
                    <col key={col.key} style={{ width: `${col.width}px` }} />
                  ))}
                  <col style={{ width: '116px' }} />
                </colgroup>
                <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 font-bold border-b-2 border-slate-300 shadow-2xs select-none">
                  <tr>
                    <th className="p-3 text-center border-r border-slate-200 bg-slate-100">
                      <input
                        type="checkbox"
                        aria-label="Select all purchase requisitions"
                        onChange={toggleSelectAll}
                        checked={selectedHeaderIds.size === sortedPrs.length && sortedPrs.length > 0}
                      />
                    </th>
                    {visibleHeaderColumns.map((col) => {
                      const def = getColumnDefinition(col.key);
                      const sortIdx = headerSortRules.findIndex((r) => r.key === col.key);
                      const activeSort = sortIdx !== -1 ? headerSortRules[sortIdx] : null;
                      const isDragOver = dragOverColKey === col.key;

                      return (
                        <th
                          key={col.key}
                          draggable
                          onDragStart={(e) => handleDragStartColumn(e, col.key)}
                          onDragOver={(e) => handleDragOverColumn(e, col.key)}
                          onDrop={(e) => handleDropColumn(e, col.key)}
                          onDragEnd={() => {
                            setDraggedColKey(null);
                            setDragOverColKey(null);
                          }}
                          title={`${def.label} — ${def.description}\nClick to sort (Shift+Click for multi-sort) • Drag header to reorder • Drag right edge to resize (Double-click edge to auto-fit)`}
                          className={`relative p-2.5 border-r border-slate-200 bg-slate-100 hover:bg-slate-200/75 transition group ${
                            isDragOver ? 'bg-indigo-100 ring-2 ring-indigo-500 ring-inset' : ''
                          }`}
                        >
                          <div
                            onClick={(e) => handleHeaderColumnSort(col.key, e)}
                            className={`flex items-center gap-1 pr-1.5 cursor-pointer ${
                              def.align === 'right'
                                ? 'justify-end'
                                : def.align === 'center'
                                ? 'justify-center'
                                : 'justify-start'
                            }`}
                          >
                            <GripVertical className="w-3 h-3 text-slate-400 hidden group-hover:inline-block shrink-0 cursor-grab" />
                            <span className="truncate font-bold text-slate-800">{def.label}</span>
                            {activeSort ? (
                              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-indigo-100 text-indigo-700 rounded text-[10px] font-extrabold shrink-0">
                                {activeSort.direction === 'asc' ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )}
                                {headerSortRules.length > 1 && <span>{sortIdx + 1}</span>}
                              </span>
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-400 hidden group-hover:inline-block shrink-0" />
                            )}
                          </div>

                          {/* Draggable & Double-Click Auto-Fit Column Boundary Resizer */}
                          <div
                            role="separator"
                            aria-label={`Resize ${def.label} column`}
                            onMouseDown={(e) => handleStartResize(e, col.key, col.width, 'HEADER')}
                            onDoubleClick={(e) => handleAutoFitColumn(e, col.key, 'HEADER')}
                            onClick={(e) => e.stopPropagation()}
                            title="Drag to resize column • Double-click to auto-fit content"
                            className="absolute top-0 right-0 h-full w-2 cursor-col-resize hover:bg-indigo-500/60 active:bg-indigo-600 z-30"
                          />
                        </th>
                      );
                    })}
                    <th className="p-3 text-right bg-slate-100 font-bold text-slate-800">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedPrs.map((pr) => (
                    <tr
                      key={pr.id}
                      className="hover:bg-indigo-50/50 transition cursor-pointer"
                      onClick={() => onOpenDetailsModal(pr)}
                    >
                      <td
                        className="p-3 text-center border-r border-slate-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select ${pr.prNumber}`}
                          checked={selectedHeaderIds.has(pr.id)}
                          onChange={() => toggleSelectHeader(pr.id)}
                        />
                      </td>
                      {visibleHeaderColumns.map((col) => {
                        const def = getColumnDefinition(col.key);
                        return (
                          <td
                            key={col.key}
                            className={`p-2.5 border-r border-slate-100 overflow-hidden ${
                              def.align === 'right'
                                ? 'text-right'
                                : def.align === 'center'
                                ? 'text-center'
                                : 'text-left'
                            }`}
                          >
                            {renderCellContent(pr, col.key)}
                          </td>
                        );
                      })}
                      <td
                        className="p-2.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onOpenDetailsModal(pr)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 rounded text-xs font-bold transition cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sortedPrs.length === 0 && (
                    <tr>
                      <td
                        colSpan={visibleHeaderColumns.length + 2}
                        className="p-8 text-center text-slate-400 italic"
                      >
                        No purchase requisitions found matching the current filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              /* LINE / LIVE VIEW — Full Shared Data Grid Parity (Columns, Resize, DnD Reorder, Multi-Sort, Pagination) */
              <table
                className="text-left text-xs border-collapse table-fixed"
                style={{ width: `${totalLineTableWidth}px`, minWidth: '100%' }}
              >
                <colgroup>
                  <col style={{ width: '44px' }} />
                  {visibleLineColumns.map((col) => (
                    <col key={col.key} style={{ width: `${col.width}px` }} />
                  ))}
                  <col style={{ width: '116px' }} />
                </colgroup>
                <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 font-bold border-b-2 border-slate-300 shadow-2xs select-none">
                  <tr>
                    <th className="p-3 text-center border-r border-slate-200 bg-slate-100">
                      <input
                        type="checkbox"
                        aria-label="Select all lines"
                        onChange={toggleSelectAll}
                        checked={
                          selectedLineRowIds.size === sortedLineRows.length &&
                          sortedLineRows.length > 0
                        }
                      />
                    </th>
                    {visibleLineColumns.map((col) => {
                      const def = getLineColumnDefinition(col.key);
                      const sortIdx = lineSortRules.findIndex((r) => r.key === col.key);
                      const activeSort = sortIdx !== -1 ? lineSortRules[sortIdx] : null;
                      const isDragOver = dragOverColKey === col.key;

                      return (
                        <th
                          key={col.key}
                          draggable
                          onDragStart={(e) => handleDragStartColumn(e, col.key)}
                          onDragOver={(e) => handleDragOverColumn(e, col.key)}
                          onDrop={(e) => handleDropColumn(e, col.key)}
                          onDragEnd={() => {
                            setDraggedColKey(null);
                            setDragOverColKey(null);
                          }}
                          title={`${def.label} — ${def.description}\nClick to sort (Shift+Click for multi-sort) • Drag header to reorder • Drag right edge to resize (Double-click edge to auto-fit)`}
                          className={`relative p-2.5 border-r border-slate-200 bg-slate-100 hover:bg-slate-200/75 transition group ${
                            isDragOver ? 'bg-indigo-100 ring-2 ring-indigo-500 ring-inset' : ''
                          }`}
                        >
                          <div
                            onClick={(e) => handleLineColumnSort(col.key, e)}
                            className={`flex items-center gap-1 pr-1.5 cursor-pointer ${
                              def.align === 'right'
                                ? 'justify-end'
                                : def.align === 'center'
                                ? 'justify-center'
                                : 'justify-start'
                            }`}
                          >
                            <GripVertical className="w-3 h-3 text-slate-400 hidden group-hover:inline-block shrink-0 cursor-grab" />
                            <span className="truncate font-bold text-slate-800">{def.label}</span>
                            {activeSort ? (
                              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-indigo-100 text-indigo-700 rounded text-[10px] font-extrabold shrink-0">
                                {activeSort.direction === 'asc' ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )}
                                {lineSortRules.length > 1 && <span>{sortIdx + 1}</span>}
                              </span>
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-400 hidden group-hover:inline-block shrink-0" />
                            )}
                          </div>

                          {/* Draggable & Double-Click Auto-Fit Column Boundary Resizer */}
                          <div
                            role="separator"
                            aria-label={`Resize ${def.label} column`}
                            onMouseDown={(e) => handleStartResize(e, col.key, col.width, 'LINE')}
                            onDoubleClick={(e) => handleAutoFitColumn(e, col.key, 'LINE')}
                            onClick={(e) => e.stopPropagation()}
                            title="Drag to resize column • Double-click to auto-fit content"
                            className="absolute top-0 right-0 h-full w-2 cursor-col-resize hover:bg-indigo-500/60 active:bg-indigo-600 z-30"
                          />
                        </th>
                      );
                    })}
                    <th className="p-3 text-right bg-slate-100 font-bold text-slate-800">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLineRows.map((row) => (
                    <tr
                      key={row.rowId}
                      className="hover:bg-indigo-50/50 transition cursor-pointer"
                      onClick={() => onOpenDetailsModal(row.pr)}
                    >
                      <td
                        className="p-3 text-center border-r border-slate-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.prNumber} line ${row.lineNumber}`}
                          checked={selectedLineRowIds.has(row.rowId)}
                          onChange={() => toggleSelectLine(row.rowId)}
                        />
                      </td>
                      {visibleLineColumns.map((col) => {
                        const def = getLineColumnDefinition(col.key);
                        return (
                          <td
                            key={col.key}
                            className={`p-2.5 border-r border-slate-100 overflow-hidden ${
                              def.align === 'right'
                                ? 'text-right'
                                : def.align === 'center'
                                ? 'text-center'
                                : 'text-left'
                            }`}
                          >
                            {renderLineCellContent(row, col.key)}
                          </td>
                        );
                      })}
                      <td
                        className="p-2.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onOpenDetailsModal(row.pr)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 rounded text-xs font-bold transition cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sortedLineRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={visibleLineColumns.length + 2}
                        className="p-8 text-center text-slate-400 italic"
                      >
                        No purchase requisition lines found matching the current filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Standardized Global Data Grid Pagination Footer */}
      <DataGridFooter
        currentPage={safePage}
        totalPages={totalPages}
        pageSize={activePageSize}
        totalRecords={activeTotalRecords}
        onPageChange={setCurrentPage}
        onPageSizeChange={handlePageSizeChange}
        defaultSortNotice={
          activeSortRules.length > 0
            ? `Custom Sort (${activeSortRules[0].key} ${activeSortRules[0].direction.toUpperCase()})`
            : 'Default Sort: Newest First (PR Date DESC)'
        }
      />

      {/* CONTROLLED BULK PROCESSING PREVIEW & EXECUTION MODAL (Requirement J) */}
      {showBulkModal && (
        <div
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-3xl sm:rounded-2xl border border-slate-200 shadow-2xl sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-[#0B192C] text-white flex items-center justify-between border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Controlled Bulk PR Processing — {bulkActionType}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Per-record governance eligibility validation, self-approval protection, and budget impact preview.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
              {bulkPreview && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="text-[10px] font-bold uppercase text-emerald-700">
                        Eligible Records
                      </div>
                      <div className="text-lg font-extrabold text-emerald-900 mt-0.5">
                        {bulkPreview.eligibleRecords.length}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="text-[10px] font-bold uppercase text-amber-700">
                        Ineligible / Blocked
                      </div>
                      <div className="text-lg font-extrabold text-amber-900 mt-0.5">
                        {bulkPreview.ineligibleRecords.length}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                      <div className="text-[10px] font-bold uppercase text-indigo-700">
                        Total Selected Batch
                      </div>
                      <div className="text-lg font-mono font-extrabold text-indigo-900 mt-0.5">
                        {selectedPrIdsForBulk.length} PR(s)
                      </div>
                    </div>
                  </div>

                  {bulkPreview.ineligibleRecords.length > 0 && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-1.5">
                      <div className="font-bold text-rose-900">
                        Ineligible Records (Will Be Skipped Safely):
                      </div>
                      {bulkPreview.ineligibleRecords.map((item) => (
                        <div
                          key={item.prId}
                          className="flex items-center justify-between gap-2 text-[11px] bg-white p-2 rounded border border-rose-200"
                        >
                          <span className="font-mono font-bold text-rose-700">{item.prNumber}</span>
                          <span className="text-slate-600">{item.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Standard Governance Reason *
                      </label>
                      <input
                        type="text"
                        value={bulkReason}
                        onChange={(e) => setBulkReason(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Audit Remarks
                      </label>
                      <input
                        type="text"
                        placeholder="Optional batch remarks..."
                        value={bulkRemarks}
                        onChange={(e) => setBulkRemarks(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </>
              )}

              {bulkOutcomeReport && (
                <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300 space-y-2">
                  <div className="font-bold text-slate-900">
                    Execution Outcome: {bulkOutcomeReport.overallOutcome}
                  </div>
                  <div className="text-[11px] text-slate-700">
                    Succeeded: <strong>{bulkOutcomeReport.succeeded.length}</strong> • Failed:{' '}
                    <strong>{bulkOutcomeReport.failed.length}</strong> • Skipped:{' '}
                    <strong>{bulkOutcomeReport.skipped.length}</strong>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!bulkPreview || bulkPreview.eligibleRecords.length === 0}
                onClick={handleExecuteBulkAction}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Execute Bulk {bulkActionType} ({bulkPreview?.eligibleRecords.length || 0} Eligible)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONSOLIDATED MULTI-CURRENCY & GOVERNANCE REPORT MODAL (Requirement O) */}
      {showConsolidatedReport && consolidatedReport && (
        <div
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-4xl sm:rounded-2xl border border-slate-200 shadow-2xl sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-[#0B192C] text-white flex items-center justify-between border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  <span>Consolidated PR Governance & Dual-Currency Financial Report</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Security-scoped metrics separated by transaction currency and reconciled to Company Reporting Currency (INR).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConsolidatedReport(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    Total Reserved Budget (INR)
                  </div>
                  <div className="text-base font-mono font-extrabold text-slate-900 mt-1">
                    ₹
                    {consolidatedReport.companyReportingSummary.totalReservedBudgetReporting.toLocaleString(
                      'en-IN'
                    )}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[10px] font-bold uppercase text-emerald-700">
                    Released Budget (INR)
                  </div>
                  <div className="text-base font-mono font-extrabold text-emerald-900 mt-1">
                    ₹
                    {consolidatedReport.companyReportingSummary.totalReleasedBudgetReporting.toLocaleString(
                      'en-IN'
                    )}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                  <div className="text-[10px] font-bold uppercase text-indigo-700">
                    Valid Commitments (INR)
                  </div>
                  <div className="text-base font-mono font-extrabold text-indigo-900 mt-1">
                    ₹
                    {consolidatedReport.companyReportingSummary.totalOutstandingCommitmentsReporting.toLocaleString(
                      'en-IN'
                    )}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-[10px] font-bold uppercase text-amber-700">
                    Avg Approval Ageing
                  </div>
                  <div className="text-base font-extrabold text-amber-900 mt-1">
                    {consolidatedReport.averageApprovalAgeingDays} Days
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-slate-800">Metrics by Transaction Currency</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {consolidatedReport.metricsByCurrency.map((m) => (
                    <div
                      key={m.currency}
                      className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-bold text-slate-900">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono">
                          {m.currency} ({m.prCount} PRs)
                        </span>
                        <span className="font-mono">
                          Orig: {formatEstimatedValue(m.originalPrValue, m.currency)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                        <div>
                          Approved:{' '}
                          <strong className="font-mono text-slate-800">
                            {formatEstimatedValue(m.approvedValue, m.currency)}
                          </strong>
                        </div>
                        <div>
                          RFQ Converted:{' '}
                          <strong className="font-mono text-slate-800">
                            {formatEstimatedValue(m.rfqConvertedValue, m.currency)}
                          </strong>
                        </div>
                        <div>
                          Short Closed:{' '}
                          <strong className="font-mono text-purple-700">
                            {formatEstimatedValue(m.shortClosedValue, m.currency)}
                          </strong>
                        </div>
                        <div>
                          Cancelled:{' '}
                          <strong className="font-mono text-rose-700">
                            {formatEstimatedValue(m.cancelledValue, m.currency)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowConsolidatedReport(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHARED COLUMN SETTINGS PANEL MODAL (Supports both Header View and Line / Live View) */}
      <PrColumnSettingsModal
        isOpen={showColumnSettings}
        viewMode={viewMode}
        orderedColumns={
          (viewMode === 'HEADER' ? orderedHeaderColumns : orderedLineColumns) as PRUserColumnState<string>[]
        }
        getColumnDef={(key) =>
          viewMode === 'HEADER'
            ? getColumnDefinition(key as PRColumnKey)
            : getLineColumnDefinition(key as PRLineColumnKey)
        }
        onToggleVisibility={handleToggleColumnVisibility}
        onSelectAll={handleSelectAllColumns}
        onDeselectAll={handleDeselectAllColumns}
        onMoveStep={handleMoveColumnStep}
        onDragStartColumn={handleDragStartColumn}
        onDragOverColumn={handleDragOverColumn}
        onDropColumn={handleDropColumn}
        onRestoreDefaultWidths={handleRestoreDefaultWidths}
        onRestoreDefaultOrder={handleRestoreDefaultOrder}
        onResetToFactoryDefault={() => {
          handleResetLayout();
          setShowColumnSettings(false);
        }}
        onSaveLayout={handleQuickSaveCurrentViewLayout}
        onClose={() => setShowColumnSettings(false)}
      />

      {/* VIEW-ISOLATED, USER & COMPANY SCOPED SAVED LAYOUTS MODAL */}
      <PrSavedLayoutsModal
        isOpen={showSavedLayoutsModal}
        viewMode={viewMode}
        userName={currentUser.fullName}
        companyScopeLabel={layoutCompanyScope}
        layouts={savedLayoutsForActiveView}
        activeLayoutId={activeLayoutId}
        onSaveNewLayout={handleSaveNewNamedLayout}
        onUpdateExistingLayout={handleUpdateNamedLayout}
        onLoadLayout={handleLoadNamedLayout}
        onSetDefaultLayout={handleSetDefaultNamedLayout}
        onDeleteLayout={handleDeleteNamedLayout}
        onResetFactoryDefault={handleResetLayout}
        onClose={() => setShowSavedLayoutsModal(false)}
        errorMsg={layoutPersistError}
      />
    </div>
  );
};
