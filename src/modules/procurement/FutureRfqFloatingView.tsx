import React, { useState, useMemo } from 'react';
import {
  Clock,
  Filter,
  Plus,
  Shield,
  Search,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  Calendar,
  X,
  History,
  Lock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Layers,
  FileText,
  Package,
  Send,
  Building2,
  UserCheck,
  Sparkles,
  TrendingUp,
  BarChart2,
  ExternalLink,
  ShieldAlert,
  RefreshCw,
  Eye,
  Info,
} from 'lucide-react';
import { User, Company, Branch } from '../../types';
import { futureRfqFloatingService } from '../../services/futureRfqFloatingService';
import { rfqService } from '../../services/rfqService';
import { prRfqConversionService, PrLineConversionSummary } from '../../services/prRfqConversionService';
import { marketBenchmarkService } from '../../services/marketBenchmarkService';
import { FutureRfqDemandItem, ConsolidatedDemandGroup, MarketBenchmarkResult } from '../../types/rfqSourcing';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';

interface FutureRfqFloatingViewProps {
  currentUser: User;
  companies: Company[];
  branches: Branch[];
  onNavigate: (route: string) => void;
}

export const FutureRfqFloatingView: React.FC<FutureRfqFloatingViewProps> = ({
  currentUser,
  companies,
  branches,
  onNavigate,
}) => {
  const [demandItems, setDemandItems] = useState<FutureRfqDemandItem[]>(() =>
    futureRfqFloatingService.getDemandItems()
  );

  // Unified Selection State: array of selected PR demand item IDs for RFQ floating
  const [selectedDemandIds, setSelectedDemandIds] = useState<string[]>([]);

  // Expanded Consolidated Rows (Group IDs)
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);

  // Expanded Individual PR Line Rows (Demand Item IDs) to view Corresponding Consolidated Item & RFQ references
  const [expandedPrLineIds, setExpandedPrLineIds] = useState<string[]>([]);

  // Live Web Market Price Discovery Engine Panel Toggle on unified screen
  const [showDiscoveryEngine, setShowDiscoveryEngine] = useState<boolean>(false);
  const [benchmarkSearchItemCode, setBenchmarkSearchItemCode] = useState<string>('RMPAOPOEXLG0001');
  const [activeBenchmarkResult, setActiveBenchmarkResult] = useState<MarketBenchmarkResult>(() =>
    marketBenchmarkService.getBenchmarkForItem('RMPAOPOEXLG0001', 'PC-ABS Polycarbonate Resins')
  );

  // Quick-view Modal State for Benchmark Inspection from any row
  const [benchmarkModalItemCode, setBenchmarkModalItemCode] = useState<string | null>(null);
  const [benchmarkModalResult, setBenchmarkModalResult] = useState<MarketBenchmarkResult | null>(null);

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Custom conversion quantity overrides map: item.id -> convertQtyPurchUom
  const [customConvertQuantitiesPurchUom, setCustomConvertQuantitiesPurchUom] = useState<Record<string, number>>({});

  // Pre-Conversion Confirmation Modal State
  const [showPreConversionModal, setShowPreConversionModal] = useState(false);
  const [rfqTitle, setRfqTitle] = useState('');
  const [responseDeadline, setResponseDeadline] = useState('2026-12-15');
  const [deliveryTerms, setDeliveryTerms] = useState('FOR Destination - Plant Warehouse');
  const [paymentTerms, setPaymentTerms] = useState('NET 60 Days after Receipt & Quality Inspection');

  // Exemption Modal State
  const [exemptModalItem, setExemptModalItem] = useState<FutureRfqDemandItem | null>(null);
  const [exemptionReason, setExemptionReason] = useState('');

  // Conversion History Modal State
  const [historySummaryItem, setHistorySummaryItem] = useState<PrLineConversionSummary | null>(null);

  // Error Alert Banner State
  const [conversionError, setConversionError] = useState<string | null>(null);

  // Refresh data helper
  const handleRefreshData = () => {
    setDemandItems(futureRfqFloatingService.getDemandItems());
  };

  // Consolidated Groups Memo
  const consolidatedGroups = useMemo(() => {
    return futureRfqFloatingService.getConsolidatedDemandItems();
  }, [demandItems]);

  // Unique Categories List
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    demandItems.forEach((i) => cats.add(i.itemCategory));
    return Array.from(cats);
  }, [demandItems]);

  // Filtered Consolidated Groups with PR Line search match integration
  const filteredConsolidatedGroups = useMemo(() => {
    return consolidatedGroups.filter((group) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesGroup =
        !q ||
        group.itemCode.toLowerCase().includes(q) ||
        group.description.toLowerCase().includes(q);

      const matchesAnyPrLine = group.contributingDemandItems.some(
        (i) =>
          !q ||
          i.prNumber.toLowerCase().includes(q) ||
          i.requesterName.toLowerCase().includes(q) ||
          i.department.toLowerCase().includes(q) ||
          i.branchName.toLowerCase().includes(q) ||
          i.companyCode.toLowerCase().includes(q)
      );

      const matchesCompany =
        companyFilter === 'ALL' ||
        group.contributingDemandItems.some((i) => i.companyId === companyFilter);
      const matchesBranch =
        branchFilter === 'ALL' ||
        group.contributingDemandItems.some((i) => i.branchId === branchFilter);
      const matchesCategory =
        categoryFilter === 'ALL' || group.itemCategory === categoryFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'FULLY_SOURCED' && group.totalAvailableQtyInvUom <= 0.0001) ||
        (statusFilter === 'APPROVED_PR' && group.totalAvailableQtyInvUom > 0) ||
        group.contributingDemandItems.some((i) => i.sourcingStatus === statusFilter);

      return (matchesGroup || matchesAnyPrLine) && matchesCompany && matchesBranch && matchesCategory && matchesStatus;
    });
  }, [consolidatedGroups, searchQuery, companyFilter, branchFilter, categoryFilter, statusFilter]);

  const demandGrid = useStandardDataGrid({
    gridId: 'future-rfq-floating',
    userId: currentUser?.id,
    data: filteredConsolidatedGroups,
    defaultSortField: 'latestPrDate',
    defaultSortDirection: 'desc',
    tieBreakerField: 'groupId',
    filterSignature: `${searchQuery}|${companyFilter}|${branchFilter}|${categoryFilter}|${statusFilter}`,
    getRowId: (g) => g.groupId,
    getFieldValue: (g, field) => {
      if (field === 'latestPrDate') {
        const timestamps = g.contributingDemandItems
          .map((item) => Date.parse(item.createdAt || item.requiredDeliveryDate || ''))
          .filter((n) => !Number.isNaN(n));
        return timestamps.length > 0 ? Math.max(...timestamps) : null;
      }
      return (g as any)[field];
    },
  });

  // Total Available Demand Items across all active groups
  const allAvailableDemandItems = useMemo(() => {
    return demandItems.filter((i) => i.remainingQuantityInvUom > 0.0001);
  }, [demandItems]);

  // Dashboard Aggregated Metrics
  const metrics = useMemo(() => {
    const awaitingSourcing = demandItems.filter(
      (i) => i.sourcingStatus === 'APPROVED_PR' || i.sourcingStatus === 'PARTIALLY_SOURCED'
    ).length;

    const uniqueItems = new Set(demandItems.map((i) => i.itemCode)).size;

    const totalRequestedQty = demandItems.reduce((acc, i) => acc + i.requiredQuantityInvUom, 0);
    const availableQtyForConversion = demandItems.reduce((acc, i) => acc + i.remainingQuantityInvUom, 0);

    const partiallyConverted = demandItems.filter((i) => i.sourcingStatus === 'PARTIALLY_SOURCED').length;
    const fullyConverted = demandItems.filter(
      (i) => i.remainingQuantityInvUom <= 0.0001 || i.sourcingStatus === 'FULLY_SOURCED'
    ).length;

    const approvedReady = demandItems.filter((i) => i.sourcingStatus === 'APPROVED_PR').length;
    const rfqsCreated = rfqService.getRfqs().length;

    return {
      awaitingSourcing,
      uniqueItems,
      totalRequestedQty,
      availableQtyForConversion,
      partiallyConverted,
      fullyConverted,
      approvedReady,
      rfqsCreated,
    };
  }, [demandItems]);

  // Group Expand / Collapse Handlers
  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const togglePrLineExpand = (prLineId: string) => {
    setExpandedPrLineIds((prev) =>
      prev.includes(prLineId) ? prev.filter((id) => id !== prLineId) : [...prev, prLineId]
    );
  };

  const handleExpandAll = () => {
    setExpandedGroupIds(demandGrid.pagedData.map((g) => g.groupId));
  };

  const handleCollapseAll = () => {
    setExpandedGroupIds([]);
    setExpandedPrLineIds([]);
  };

  // Group Selection Handlers
  const handleToggleGroupSelect = (group: ConsolidatedDemandGroup) => {
    const availableIds = group.contributingDemandItems
      .filter((i) => i.remainingQuantityInvUom > 0.0001)
      .map((i) => i.id);

    const allGroupSelected =
      availableIds.length > 0 && availableIds.every((id) => selectedDemandIds.includes(id));

    if (allGroupSelected) {
      setSelectedDemandIds((prev) => prev.filter((id) => !availableIds.includes(id)));
    } else {
      setSelectedDemandIds((prev) => Array.from(new Set([...prev, ...availableIds])));
    }
  };

  const handleTogglePrLineSelect = (prLineId: string) => {
    setSelectedDemandIds((prev) =>
      prev.includes(prLineId) ? prev.filter((id) => id !== prLineId) : [...prev, prLineId]
    );
  };

  const isAllSelectableChecked =
    allAvailableDemandItems.length > 0 &&
    allAvailableDemandItems.every((item) => selectedDemandIds.includes(item.id));

  const handleToggleSelectAll = () => {
    if (isAllSelectableChecked) {
      setSelectedDemandIds([]);
    } else {
      setSelectedDemandIds(allAvailableDemandItems.map((i) => i.id));
    }
  };

  const handleQtyChange = (itemId: string, val: number, maxAllowedPurchUom: number) => {
    const safeVal = Math.max(0, Math.min(val, maxAllowedPurchUom));
    setCustomConvertQuantitiesPurchUom((prev) => ({
      ...prev,
      [itemId]: safeVal,
    }));
  };

  // Trigger Pre-Conversion Summary Confirmation Modal
  const handleInitiateConversionModal = () => {
    setConversionError(null);

    if (selectedDemandIds.length === 0) {
      setConversionError('Please select at least one PR line or consolidated item group to convert into an RFQ.');
      return;
    }

    const selectedItemsToConvert = demandItems.filter(
      (d) => selectedDemandIds.includes(d.id) && d.remainingQuantityInvUom > 0.0001
    );

    if (selectedItemsToConvert.length === 0) {
      setConversionError('None of the selected lines have available unconverted quantity.');
      return;
    }

    // Pre-validate over-conversion
    for (const item of selectedItemsToConvert) {
      const summary = prRfqConversionService.getSummaryForPrLine(
        item.prLineId,
        item.requiredQuantityInvUom,
        item.inventoryUom,
        item.prNumber,
        item.itemCode
      );

      if (summary.conversionStatus === 'FULLY_CONVERTED' || summary.remainingQtyInvUom <= 0.0001) {
        setConversionError(
          `PR Line (${item.prNumber} / ${item.itemCode}) is already fully converted. Deselect or refresh demand items.`
        );
        return;
      }
    }

    const uniqueItemCodes = Array.from(new Set(selectedItemsToConvert.map((i) => i.itemCode))).join(', ');
    setRfqTitle(`Consolidated RFQ Floating — ${uniqueItemCodes}`);
    setShowPreConversionModal(true);
  };

  // Final Execution of RFQ Creation from Confirmation Modal
  const handleConfirmAndFloatRfq = () => {
    setConversionError(null);

    const itemsToProcess = demandItems.filter(
      (d) => selectedDemandIds.includes(d.id) && d.remainingQuantityInvUom > 0.0001
    );

    if (itemsToProcess.length === 0) {
      setConversionError('No active items available to process.');
      setShowPreConversionModal(false);
      return;
    }

    const first = itemsToProcess[0];

    try {
      const newRfq = rfqService.createRfq({
        companyId: first.companyId,
        companyCode: first.companyCode,
        branchId: first.branchId,
        branchCode: first.branchCode,
        branchName: first.branchName,
        title: rfqTitle || `Consolidated Sourcing RFQ`,
        description: `Consolidated Sourcing RFQ generated from PRs: ${Array.from(
          new Set(itemsToProcess.map((i) => i.prNumber))
        ).join(', ')}`,
        prReferences: Array.from(new Set(itemsToProcess.map((i) => i.prNumber))),
        buyerId: currentUser.id || 'usr-buyer-01',
        buyerName: currentUser.fullName || 'Vikram Singh',
        purchasingManagerId: 'usr-checker-03',
        purchasingManagerName: 'Venkatesh Iyer',
        responseDeadline,
        deliveryTerms,
        paymentTerms,
        lines: itemsToProcess.map((item, index) => {
          const customPurchQty = customConvertQuantitiesPurchUom[item.id];
          const actualPurchQtyToConvert =
            customPurchQty !== undefined && customPurchQty > 0
              ? customPurchQty
              : item.remainingQuantityPurchUom;

          return {
            id: `rfq-line-${Date.now()}-${index}`,
            rfqId: '',
            prLineId: item.prLineId,
            prNumber: item.prNumber,
            itemCode: item.itemCode,
            description: item.description,
            category: item.itemCategory,
            specifications: `Approved Specs for ${item.itemCode}`,
            quantityPurchUom: actualPurchQtyToConvert,
            purchaseUom: item.purchaseUom,
            inventoryUom: item.inventoryUom,
            conversionRatio: item.inventoryToPurchaseConversion,
            requiredDeliveryDate: item.requiredDeliveryDate,
            targetWarehouse: `${item.branchCode || 'HQ'}-WAREHOUSE`,
          };
        }),
        invitations: [],
      });

      // Reset state and redirect
      handleRefreshData();
      setSelectedDemandIds([]);
      setShowPreConversionModal(false);
      alert(`RFQ ${newRfq.rfqNumber} successfully created and floated! Redirecting to RFQ Directory...`);
      onNavigate('/procurement/rfq');
    } catch (err: any) {
      setConversionError(err.message || 'An error occurred during PR-to-RFQ line conversion.');
      setShowPreConversionModal(false);
    }
  };

  const handleShowHistory = (item: FutureRfqDemandItem) => {
    const summary = prRfqConversionService.getSummaryForPrLine(
      item.prLineId,
      item.requiredQuantityInvUom,
      item.inventoryUom,
      item.prNumber,
      item.itemCode
    );
    setHistorySummaryItem(summary);
  };

  const handleOpenBenchmarkForItem = (itemCode: string, description?: string) => {
    setBenchmarkModalItemCode(itemCode);
    const res = marketBenchmarkService.getBenchmarkForItem(itemCode, description || 'Sourcing Requirement');
    setBenchmarkModalResult(res);
  };

  const handleRunBenchmarkSearch = (itemCode: string) => {
    const res = marketBenchmarkService.generateBenchmarkForItem(itemCode, 'Standard Sourcing Requirement');
    setActiveBenchmarkResult(res);
  };

  const handleExemptSubmit = () => {
    if (!exemptModalItem || !exemptionReason.trim()) return;
    futureRfqFloatingService.exemptDemandItem(exemptModalItem.id, exemptionReason, currentUser.fullName);
    handleRefreshData();
    setExemptModalItem(null);
    setExemptionReason('');
  };

  // Selected items to summarize in modal
  const modalSelectedItems = useMemo(() => {
    return demandItems.filter(
      (d) => selectedDemandIds.includes(d.id) && d.remainingQuantityInvUom > 0.0001
    );
  }, [selectedDemandIds, demandItems]);

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-800">
              Procurement & Sourcing → RFQ
            </span>
            <span className="text-xs text-slate-400 font-medium">Unified Demand Queue & Market Benchmark</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-600" />
            <span>Future RFQ</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Unified sourcing queue: Consolidate identical PR requirements across branches, track line-level conversion balances, and benchmark live supplier pricing.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowDiscoveryEngine(!showDiscoveryEngine)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition cursor-pointer ${
              showDiscoveryEngine
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <span>{showDiscoveryEngine ? 'Hide Discovery Tool' : 'Live Market Discovery'}</span>
          </button>

          <button
            onClick={handleInitiateConversionModal}
            disabled={selectedDemandIds.length === 0}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg shadow-xs transition ${
              selectedDemandIds.length > 0
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-indigo-200'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Float RFQ ({selectedDemandIds.length} Selected)</span>
          </button>
        </div>
      </div>

      {/* Sourcing Metrics Dashboard Cards (8 Cards Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Awaiting Sourcing</span>
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-lg font-bold text-indigo-900 mt-1">{metrics.awaitingSourcing}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Approved PR Lines</div>
        </div>

        <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Unique Items</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg font-bold text-blue-900 mt-1">{metrics.uniqueItems}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Consolidated Codes</div>
        </div>

        <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Requested Qty</span>
            <Package className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-lg font-bold text-purple-900 mt-1">{metrics.totalRequestedQty.toLocaleString()}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Total Demand (Inv)</div>
        </div>

        <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Available Qty</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-emerald-900 mt-1">{metrics.availableQtyForConversion.toLocaleString()}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Ready for RFQ</div>
        </div>

        <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Partial Sourced</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg font-bold text-amber-900 mt-1">{metrics.partiallyConverted}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Split Allocation</div>
        </div>

        <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fully Sourced</span>
            <Lock className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 mt-1">{metrics.fullyConverted}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">100% Converted</div>
        </div>

        <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ready PRs</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-emerald-900 mt-1">{metrics.approvedReady}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Pending Buyer</div>
        </div>

        <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">RFQs Floated</span>
            <Send className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-lg font-bold text-cyan-900 mt-1">{metrics.rfqsCreated}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Active Directory</div>
        </div>
      </div>

      {/* Conversion Error Alert Banner */}
      {conversionError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-rose-900 text-xs shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">
            <strong className="block font-bold text-rose-950 mb-0.5">RFQ Conversion Validation Alert</strong>
            {conversionError}
          </div>
          <button onClick={() => setConversionError(null)} className="text-rose-500 hover:text-rose-700 font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* OPTIONAL LIVE MARKET DISCOVERY ENGINE TOOL (Integrated directly into unified screen) */}
      {showDiscoveryEngine && (
        <div className="bg-white border border-amber-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-amber-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-600" />
                <span>Web-Based Market Price Discovery Engine</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Benchmark PR requirements against B2B marketplace indices, external suppliers, and manufacturer catalogs before floating RFQs.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-lg text-amber-900 text-xs font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>INDICATIVE MARKET PRICES, NOT FORMAL SUPPLIER QUOTATIONS</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full">
              <select
                value={benchmarkSearchItemCode}
                onChange={(e) => {
                  setBenchmarkSearchItemCode(e.target.value);
                  const res = marketBenchmarkService.getBenchmarkForItem(e.target.value);
                  setActiveBenchmarkResult(res);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Array.from(new Set(demandItems.map((i) => i.itemCode))).map((code) => {
                  const match = demandItems.find((d) => d.itemCode === code);
                  return (
                    <option key={code} value={code}>
                      {code} — {match?.description || 'Item Requirement'}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              onClick={() => handleRunBenchmarkSearch(benchmarkSearchItemCode)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Run Live Web Discovery</span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">Lowest Landed Price</span>
              <strong className="text-emerald-950 font-extrabold text-sm">
                ₹{activeBenchmarkResult.lowestLandedPrice.toLocaleString()} / {activeBenchmarkResult.purchaseUom}
              </strong>
            </div>
            <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2.5">
              <span className="text-[10px] font-bold text-amber-800 uppercase block">Recommended Median</span>
              <strong className="text-amber-950 font-extrabold text-sm">
                ₹{activeBenchmarkResult.medianPrice.toLocaleString()} / {activeBenchmarkResult.purchaseUom}
              </strong>
            </div>
            <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2.5">
              <span className="text-[10px] font-bold text-blue-900 uppercase block">L1 Preferred Supplier</span>
              <strong className="text-blue-950 font-bold block truncate">
                {activeBenchmarkResult.l1Supplier?.vendorName.split('(')[0] || 'BASF India'}
              </strong>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              <span className="text-[10px] font-bold text-slate-700 uppercase block">Sample Offers Found</span>
              <strong className="text-slate-900 font-extrabold text-sm">
                {activeBenchmarkResult.sampleSize} Verified Sources
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Unified Search, Filters & Bulk Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Item Code, PR #, Description, Requester..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
            >
              <option value="ALL">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
            >
              <option value="ALL">All Item Categories</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
            >
              <option value="ALL">All Sourcing Statuses</option>
              <option value="APPROVED_PR">Approved PR (Ready for RFQ)</option>
              <option value="PARTIALLY_SOURCED">Partially Sourced</option>
              <option value="FULLY_SOURCED">Fully Sourced</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExpandAll}
              className="flex-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
            >
              Expand All
            </button>
            <button
              onClick={handleCollapseAll}
              className="flex-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
            >
              Collapse
            </button>
          </div>
        </div>
      </div>

      {/* UNIFIED SOURCING DEMAND MATRIX TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B192C] text-white font-bold tracking-wider">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    onChange={handleToggleSelectAll}
                    checked={isAllSelectableChecked}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="p-3 w-8"></th>
                <th className="p-3">Consolidated Item & Description</th>
                <th className="p-3">Contributing PR References</th>
                <th className="p-3 text-right">Total Requested Qty</th>
                <th className="p-3 text-right">Previously Converted</th>
                <th className="p-3 text-right">Available for RFQ</th>
                <th className="p-3 text-left">Lowest Market Price</th>
                <th className="p-3">Supplier Preference Tiers</th>
                <th className="p-3">Sourcing Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {demandGrid.pagedData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    No sourcing demand items found matching search or filter criteria.
                  </td>
                </tr>
              ) : (
                demandGrid.pagedData.map((group) => {
                  const isExpanded = expandedGroupIds.includes(group.groupId);
                  const isFullyConverted = group.totalAvailableQtyInvUom <= 0.0001;

                  const groupAvailableItems = group.contributingDemandItems.filter(
                    (i) => i.remainingQuantityInvUom > 0.0001
                  );
                  const isGroupFullyChecked =
                    groupAvailableItems.length > 0 &&
                    groupAvailableItems.every((i) => selectedDemandIds.includes(i.id));

                  const bmk =
                    group.marketBenchmark ||
                    marketBenchmarkService.getBenchmarkForItem(group.itemCode, group.description);
                  const bestOffer =
                    bmk.offers.find((o) => o.isEligibleForComparison !== false) || bmk.offers[0];

                  return (
                    <React.Fragment key={group.groupId}>
                      {/* CONSOLIDATED ITEM ROW */}
                      <tr
                        className={`hover:bg-indigo-50/30 transition ${
                          isFullyConverted ? 'bg-slate-50/60 text-slate-400' : ''
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            disabled={isFullyConverted}
                            checked={isGroupFullyChecked}
                            onChange={() => handleToggleGroupSelect(group)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-30"
                          />
                        </td>

                        <td className="p-3 text-center">
                          <button
                            onClick={() => toggleGroupExpand(group.groupId)}
                            className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                            title={isExpanded ? 'Collapse Contributing Lines' : 'Expand Contributing Lines'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        <td className="p-3">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{group.itemCode}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 font-semibold text-slate-600">
                              1 {group.purchaseUom} = {group.conversionRatio} {group.inventoryUom}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-sm">{group.description}</div>
                        </td>

                        {/* CONTRIBUTING PR NUMBERS & REFERENCES */}
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {group.contributingDemandItems.map((prLine) => (
                              <span
                                key={prLine.id}
                                className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200"
                              >
                                {prLine.prNumber}
                              </span>
                            ))}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {group.contributingDemandItems.length} Contributing PR Lines
                          </div>
                        </td>

                        <td className="p-3 text-right font-semibold">
                          {group.totalRequiredQtyInvUom.toLocaleString()} {group.inventoryUom}
                        </td>

                        <td className="p-3 text-right font-semibold text-amber-700">
                          {group.totalConvertedQtyInvUom.toLocaleString()} {group.inventoryUom}
                        </td>

                        <td className="p-3 text-right">
                          <div className="font-bold text-indigo-900">
                            {group.totalAvailableQtyPurchUom.toLocaleString()} {group.purchaseUom}
                          </div>
                          <div className="text-[10px] text-emerald-700 font-normal">
                            ({group.totalAvailableQtyInvUom.toLocaleString()} {group.inventoryUom})
                          </div>
                        </td>

                        {/* LOWEST MARKET PRICE COLUMN */}
                        <td className="p-3">
                          {bestOffer ? (
                            <button
                              onClick={() => handleOpenBenchmarkForItem(group.itemCode, group.description)}
                              className="text-left group/price cursor-pointer"
                              title="Click to inspect detailed market benchmark & vendor offers"
                            >
                              <div className="font-bold text-emerald-700 group-hover/price:text-indigo-600 transition flex items-center gap-1.5">
                                <span>
                                  ₹{bestOffer.normalizedPricePurchUom.toLocaleString()} / {group.purchaseUom}
                                </span>
                                {bestOffer.preferenceLevel && (
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                                      bestOffer.preferenceLevel === 'L1'
                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                        : bestOffer.preferenceLevel === 'L2'
                                        ? 'bg-blue-100 text-blue-900'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {bestOffer.preferenceLevel}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[190px]">
                                {bestOffer.vendorName.split('(')[0]} • {bestOffer.matchClassification.replace(/_/g, ' ')}
                              </div>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Market Research Pending</span>
                          )}
                        </td>

                        {/* SUPPLIER PREFERENCE LEVELS L1, L2, L3 BADGES */}
                        <td className="p-3">
                          <div className="flex flex-col gap-0.5 text-[10px]">
                            <div className="flex items-center gap-1">
                              <span className="px-1 py-0.2 rounded bg-amber-200 text-amber-950 font-black text-[9px]">L1</span>
                              <span className="truncate max-w-[110px] font-bold text-slate-800" title={bmk.l1Supplier?.vendorName}>
                                {bmk.l1Supplier?.vendorName.split('(')[0] || 'BASF India'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="px-1 py-0.2 rounded bg-blue-100 text-blue-900 font-bold text-[9px]">L2</span>
                              <span className="truncate max-w-[110px] text-slate-600" title={bmk.l2Supplier?.vendorName}>
                                {bmk.l2Supplier?.vendorName.split('(')[0] || 'Polymer Sol.'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* SOURCING STATUS */}
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isFullyConverted
                                ? 'bg-slate-200 text-slate-700'
                                : group.totalConvertedQtyInvUom > 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isFullyConverted && <Lock className="w-3 h-3 text-slate-500" />}
                            <span>
                              {isFullyConverted
                                ? 'FULLY CONVERTED'
                                : group.totalConvertedQtyInvUom > 0
                                ? 'PARTIALLY CONVERTED'
                                : 'READY FOR RFQ'}
                            </span>
                          </span>
                        </td>

                        {/* ACTIONS */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenBenchmarkForItem(group.itemCode, group.description)}
                              className="flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[11px] rounded transition cursor-pointer"
                              title="Inspect Market Price Discovery"
                            >
                              <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                              <span>Benchmark</span>
                            </button>

                            <button
                              onClick={() => toggleGroupExpand(group.groupId)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] rounded transition cursor-pointer"
                            >
                              {isExpanded ? 'Hide Lines' : 'View Lines'}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* EXPANDED DRILL-DOWN: CONTRIBUTING PR LINES DETAILED MATRIX */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={11} className="p-0 bg-slate-50/80 border-b border-indigo-100">
                            <div className="p-4 pl-10 space-y-4">
                              {/* Consolidated Market Intelligence Card */}
                              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                  <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-amber-600" />
                                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                      Market Intelligence & Supplier Preference ({group.itemCode})
                                    </h4>
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-3">
                                    <span>Last Discovery: <strong>{new Date(bmk.searchedAt).toLocaleDateString()}</strong></span>
                                    <span>Comparable Offers: <strong className="text-indigo-600">{bmk.sampleSize}</strong></span>
                                    <span>Exact Matches: <strong className="text-emerald-700">{bmk.exactMatchCount}</strong></span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5">
                                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">Lowest Market Price</span>
                                    <strong className="text-emerald-950 font-extrabold text-sm">
                                      ₹{bmk.lowestLandedPrice.toLocaleString()}
                                    </strong>
                                    <span className="text-[10px] text-emerald-700 block">Landed / {group.purchaseUom}</span>
                                  </div>

                                  <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-2.5">
                                    <span className="text-[10px] font-bold text-indigo-800 uppercase block">Recommended Median</span>
                                    <strong className="text-indigo-950 font-extrabold text-sm">
                                      ₹{bmk.medianPrice.toLocaleString()}
                                    </strong>
                                    <span className="text-[10px] text-indigo-700 block">Negotiation Target</span>
                                  </div>

                                  <div className="bg-amber-50/80 border border-amber-300 rounded-lg p-2.5">
                                    <span className="text-[10px] font-bold text-amber-900 uppercase flex items-center gap-1">
                                      <span className="px-1 bg-amber-200 text-amber-950 rounded font-black text-[9px]">L1</span>
                                      <span>Preferred Supplier</span>
                                    </span>
                                    <strong className="text-amber-950 font-bold block truncate mt-0.5" title={bmk.l1Supplier?.vendorName}>
                                      {bmk.l1Supplier?.vendorName.split('(')[0] || 'BASF India'}
                                    </strong>
                                    <span className="text-[10px] text-amber-800">
                                      ₹{bmk.l1Supplier?.normalizedPricePurchUom.toLocaleString()} / {group.purchaseUom}
                                    </span>
                                  </div>

                                  <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2.5">
                                    <span className="text-[10px] font-bold text-blue-900 uppercase flex items-center gap-1">
                                      <span className="px-1 bg-blue-200 text-blue-950 rounded font-black text-[9px]">L2</span>
                                      <span>Secondary Supplier</span>
                                    </span>
                                    <strong className="text-blue-950 font-bold block truncate mt-0.5" title={bmk.l2Supplier?.vendorName}>
                                      {bmk.l2Supplier?.vendorName.split('(')[0] || 'Polymer Solutions'}
                                    </strong>
                                    <span className="text-[10px] text-blue-800">
                                      ₹{bmk.l2Supplier?.normalizedPricePurchUom.toLocaleString()} / {group.purchaseUom}
                                    </span>
                                  </div>

                                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                                    <span className="text-[10px] font-bold text-slate-700 uppercase flex items-center gap-1">
                                      <span className="px-1 bg-slate-200 text-slate-800 rounded font-black text-[9px]">L3</span>
                                      <span>Tertiary Supplier</span>
                                    </span>
                                    <strong className="text-slate-900 font-bold block truncate mt-0.5" title={bmk.l3Supplier?.vendorName}>
                                      {bmk.l3Supplier?.vendorName.split('(')[0] || 'National Polymers'}
                                    </strong>
                                    <span className="text-[10px] text-slate-600">
                                      ₹{bmk.l3Supplier?.normalizedPricePurchUom.toLocaleString()} / {group.purchaseUom}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Contributing PR Lines Matrix */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Contributing Purchase Requisition Lines ({group.contributingDemandItems.length} Lines)</span>
                                  </h4>
                                  <span className="text-[11px] text-slate-400 font-medium">
                                    Click chevron to view corresponding consolidated group & RFQ conversion references
                                  </span>
                                </div>

                                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 text-slate-700 font-bold">
                                      <tr>
                                        <th className="p-2 w-8 text-center">
                                          <input
                                            type="checkbox"
                                            disabled={isFullyConverted}
                                            checked={isGroupFullyChecked}
                                            onChange={() => handleToggleGroupSelect(group)}
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-30"
                                          />
                                        </th>
                                        <th className="p-2 w-8"></th>
                                        <th className="p-2">PR Reference</th>
                                        <th className="p-2">Company & Branch</th>
                                        <th className="p-2">Requester / Dept</th>
                                        <th className="p-2 text-right">Original PR Qty</th>
                                        <th className="p-2 text-right">Converted Qty</th>
                                        <th className="p-2 text-right">Available Qty</th>
                                        <th className="p-2 text-center">Convert Qty (Purch UOM)</th>
                                        <th className="p-2 text-left">Lowest Market Price</th>
                                        <th className="p-2">Status</th>
                                        <th className="p-2 text-center">Actions</th>
                                      </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100 font-medium">
                                      {group.contributingDemandItems.map((prLine) => {
                                        const isPrLineExpanded = expandedPrLineIds.includes(prLine.id);
                                        const prLineConvertedInv =
                                          prLine.requiredQuantityInvUom - prLine.remainingQuantityInvUom;
                                        const isPrLineFull = prLine.remainingQuantityInvUom <= 0.0001;
                                        const customPurchVal =
                                          customConvertQuantitiesPurchUom[prLine.id] ?? prLine.remainingQuantityPurchUom;

                                        const prBmk =
                                          prLine.marketBenchmark ||
                                          marketBenchmarkService.getBenchmarkForItem(prLine.itemCode, prLine.description);
                                        const prBestOffer =
                                          prBmk.offers.find((o) => o.isEligibleForComparison !== false) ||
                                          prBmk.offers[0];

                                        const conversionSummary = prRfqConversionService.getSummaryForPrLine(
                                          prLine.prLineId,
                                          prLine.requiredQuantityInvUom,
                                          prLine.inventoryUom,
                                          prLine.prNumber,
                                          prLine.itemCode
                                        );

                                        return (
                                          <React.Fragment key={prLine.id}>
                                            <tr
                                              className={`hover:bg-slate-50 transition ${
                                                isPrLineFull ? 'bg-slate-50/60 text-slate-400' : ''
                                              }`}
                                            >
                                              <td className="p-2 text-center">
                                                <input
                                                  type="checkbox"
                                                  disabled={isPrLineFull}
                                                  checked={selectedDemandIds.includes(prLine.id)}
                                                  onChange={() => handleTogglePrLineSelect(prLine.id)}
                                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-30"
                                                />
                                              </td>

                                              <td className="p-2 text-center">
                                                <button
                                                  onClick={() => togglePrLineExpand(prLine.id)}
                                                  className="p-0.5 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                                                  title={
                                                    isPrLineExpanded
                                                      ? 'Hide Consolidated & RFQ Details'
                                                      : 'View Consolidated & RFQ Details'
                                                  }
                                                >
                                                  {isPrLineExpanded ? (
                                                    <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                                                  ) : (
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                  )}
                                                </button>
                                              </td>

                                              <td className="p-2">
                                                <div className="font-bold text-indigo-600">{prLine.prNumber}</div>
                                                <div className="text-[10px] text-slate-400">Req Date: {prLine.requiredDeliveryDate}</div>
                                              </td>

                                              <td className="p-2">
                                                <span className="font-semibold text-slate-800">{prLine.companyCode}</span> -{' '}
                                                <span className="text-slate-500">{prLine.branchName}</span>
                                              </td>

                                              <td className="p-2">
                                                <div>{prLine.requesterName}</div>
                                                <div className="text-[10px] text-slate-400">{prLine.department}</div>
                                              </td>

                                              <td className="p-2 text-right font-semibold">
                                                {prLine.requiredQuantityInvUom} {prLine.inventoryUom}
                                              </td>

                                              <td className="p-2 text-right font-semibold text-amber-700">
                                                {prLineConvertedInv} {prLine.inventoryUom}
                                              </td>

                                              <td className="p-2 text-right font-bold text-emerald-700">
                                                {prLine.remainingQuantityInvUom} {prLine.inventoryUom}
                                                <div className="text-[10px] text-slate-400 font-normal">
                                                  ({prLine.remainingQuantityPurchUom} {prLine.purchaseUom})
                                                </div>
                                              </td>

                                              {/* CONVERT QUANTITY INPUT (PURCHASE UOM) */}
                                              <td className="p-2 text-center">
                                                {isPrLineFull ? (
                                                  <span className="text-[10px] text-slate-400 font-semibold italic">Line Full</span>
                                                ) : (
                                                  <div className="flex items-center justify-center gap-1">
                                                    <input
                                                      type="number"
                                                      min={0.1}
                                                      max={prLine.remainingQuantityPurchUom}
                                                      step={1}
                                                      value={customPurchVal}
                                                      onChange={(e) =>
                                                        handleQtyChange(
                                                          prLine.id,
                                                          parseFloat(e.target.value) || 0,
                                                          prLine.remainingQuantityPurchUom
                                                        )
                                                      }
                                                      className="w-16 px-1.5 py-0.5 text-center bg-slate-50 border border-slate-300 rounded text-xs font-bold text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-[10px] text-slate-500 font-semibold">
                                                      {prLine.purchaseUom}
                                                    </span>
                                                  </div>
                                                )}
                                              </td>

                                              {/* LOWEST MARKET PRICE COLUMN */}
                                              <td className="p-2">
                                                {prBestOffer ? (
                                                  <button
                                                    onClick={() => handleOpenBenchmarkForItem(prLine.itemCode, prLine.description)}
                                                    className="text-left group/price cursor-pointer"
                                                    title="Inspect Market Price Discovery"
                                                  >
                                                    <div className="font-bold text-emerald-700 group-hover/price:text-indigo-600 transition flex items-center gap-1">
                                                      <span>₹{prBestOffer.normalizedPricePurchUom.toLocaleString()}</span>
                                                      {prBestOffer.preferenceLevel && (
                                                        <span
                                                          className={`px-1 py-0.2 rounded text-[9px] font-black ${
                                                            prBestOffer.preferenceLevel === 'L1'
                                                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                                              : 'bg-blue-100 text-blue-900'
                                                          }`}
                                                        >
                                                          {prBestOffer.preferenceLevel}
                                                        </span>
                                                      )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                                                      {prBestOffer.vendorName.split('(')[0]}
                                                    </div>
                                                  </button>
                                                ) : (
                                                  <span className="text-[10px] text-slate-400 italic">Pending</span>
                                                )}
                                              </td>

                                              <td className="p-2">
                                                <span
                                                  className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                    isPrLineFull
                                                      ? 'bg-slate-200 text-slate-700'
                                                      : prLine.sourcingStatus === 'PARTIALLY_SOURCED'
                                                      ? 'bg-amber-100 text-amber-800'
                                                      : 'bg-emerald-100 text-emerald-800'
                                                  }`}
                                                >
                                                  {isPrLineFull
                                                    ? 'CONVERTED'
                                                    : prLine.sourcingStatus === 'PARTIALLY_SOURCED'
                                                    ? 'PARTIAL'
                                                    : 'READY'}
                                                </span>
                                              </td>

                                              <td className="p-2 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                  <button
                                                    onClick={() => handleShowHistory(prLine)}
                                                    className="p-1 text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer"
                                                    title="View Conversion Ledger"
                                                  >
                                                    <History className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button
                                                    onClick={() => handleOpenBenchmarkForItem(prLine.itemCode, prLine.description)}
                                                    className="p-1 text-amber-700 hover:bg-amber-50 rounded cursor-pointer"
                                                    title="Inspect Market Benchmark"
                                                  >
                                                    <TrendingUp className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button
                                                    onClick={() => setExemptModalItem(prLine)}
                                                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold rounded"
                                                    title="Authorized Direct Procurement Exemption"
                                                  >
                                                    Exempt
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>

                                            {/* PR LINE SUB-EXPANDED DETAILS (Corresponding Consolidated Group & RFQ References) */}
                                            {isPrLineExpanded && (
                                              <tr className="bg-indigo-50/30 border-b border-indigo-100">
                                                <td colSpan={12} className="p-3 pl-8">
                                                  <div className="space-y-3 bg-white border border-indigo-200 rounded-lg p-3.5 shadow-2xs">
                                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                      <div className="flex items-center gap-2">
                                                        <Info className="w-4 h-4 text-indigo-600" />
                                                        <strong className="text-xs text-slate-900">
                                                          Corresponding Consolidated Sourcing Group & RFQ Floating Traceability
                                                        </strong>
                                                      </div>
                                                      <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded">
                                                        PR Line ID: {prLine.prLineId}
                                                      </span>
                                                    </div>

                                                    {/* Summary Grid */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                                      <div>
                                                        <span className="text-slate-500 font-medium block">Consolidated Item Group:</span>
                                                        <strong className="text-slate-900 font-bold">{group.groupId}</strong>
                                                        <div className="text-[10px] text-slate-500">
                                                          Total Group Volume: {group.totalRequiredQtyInvUom} {group.inventoryUom} (Pooled from {group.contributingDemandItems.length} lines)
                                                        </div>
                                                      </div>

                                                      <div>
                                                        <span className="text-slate-500 font-medium block">UOM Conversion Formula:</span>
                                                        <strong className="text-slate-900 font-bold">
                                                          1 {prLine.purchaseUom} = {prLine.inventoryToPurchaseConversion} {prLine.inventoryUom}
                                                        </strong>
                                                        <div className="text-[10px] text-slate-500">
                                                          Delivery Target: {prLine.requiredDeliveryDate} ({prLine.branchName})
                                                        </div>
                                                      </div>

                                                      <div>
                                                        <span className="text-slate-500 font-medium block">Technical Specifications:</span>
                                                        <div className="text-[11px] text-slate-700 truncate" title={prLine.technicalSpecifications}>
                                                          {prLine.technicalSpecifications || `${prLine.description} - Standard Specifications`}
                                                        </div>
                                                      </div>
                                                    </div>

                                                    {/* Associated RFQs Table */}
                                                    <div>
                                                      <h5 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                                        <Send className="w-3 h-3 text-cyan-600" />
                                                        <span>Associated RFQ Floating References</span>
                                                      </h5>

                                                      {conversionSummary.records.length === 0 ? (
                                                        <div className="p-3 text-center text-slate-400 bg-slate-50 rounded border border-dashed border-slate-200 text-xs">
                                                          No RFQ has been floated from this PR line yet. Line quantity is 100% available for conversion.
                                                        </div>
                                                      ) : (
                                                        <div className="border border-slate-200 rounded overflow-hidden text-xs">
                                                          <table className="w-full text-left">
                                                            <thead className="bg-slate-100 text-slate-700 font-bold text-[10px]">
                                                              <tr>
                                                                <th className="p-2">RFQ Number</th>
                                                                <th className="p-2 text-right">Converted (Inv UOM)</th>
                                                                <th className="p-2 text-right">Converted (Purch UOM)</th>
                                                                <th className="p-2">Converted By</th>
                                                                <th className="p-2">Timestamp (UTC)</th>
                                                                <th className="p-2">Status</th>
                                                              </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                                                              {conversionSummary.records.map((r) => (
                                                                <tr key={r.id}>
                                                                  <td className="p-2 font-bold text-indigo-600">
                                                                    <button
                                                                      onClick={() => onNavigate('/procurement/rfq')}
                                                                      className="hover:underline flex items-center gap-1"
                                                                    >
                                                                      <span>{r.rfqNumber}</span>
                                                                      <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                                                                    </button>
                                                                  </td>
                                                                  <td className="p-2 text-right font-bold text-amber-700">
                                                                    {r.convertedQtyInvUom} {r.prInvUom}
                                                                  </td>
                                                                  <td className="p-2 text-right font-bold text-indigo-900">
                                                                    {r.convertedQtyPurchUom} {r.rfqPurchUom}
                                                                  </td>
                                                                  <td className="p-2">{r.convertedByName}</td>
                                                                  <td className="p-2">{new Date(r.convertedAt).toLocaleString()}</td>
                                                                  <td className="p-2">
                                                                    <span
                                                                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                                                        r.status === 'ACTIVE'
                                                                          ? 'bg-emerald-100 text-emerald-800'
                                                                          : 'bg-rose-100 text-rose-800'
                                                                      }`}
                                                                    >
                                                                      {r.status}
                                                                    </span>
                                                                  </td>
                                                                </tr>
                                                              ))}
                                                            </tbody>
                                                          </table>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                </td>
                                              </tr>
                                            )}
                                          </React.Fragment>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DataGridFooter
        currentPage={demandGrid.currentPage}
        totalPages={demandGrid.totalPages}
        pageSize={demandGrid.pageSize}
        totalRecords={demandGrid.totalRecords}
        onPageChange={demandGrid.setCurrentPage}
        onPageSizeChange={demandGrid.setPageSize}
        pageSizeOptions={demandGrid.pageSizeOptions}
        defaultSortNotice="Sorted newest first (Demand Date DESC)"
      />

      {/* Pre-Conversion Summary Confirmation Modal */}
      {showPreConversionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded uppercase">
                  Pre-Conversion Verification Step
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  Float RFQ — Consolidated Sourcing Allocation Summary
                </h3>
              </div>
              <button
                onClick={() => setShowPreConversionModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* RFQ Header Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">RFQ Title *</label>
                <input
                  type="text"
                  value={rfqTitle}
                  onChange={(e) => setRfqTitle(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Response Deadline *</label>
                <input
                  type="date"
                  value={responseDeadline}
                  onChange={(e) => setResponseDeadline(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Terms *</label>
                <input
                  type="text"
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                />
              </div>
            </div>

            {/* Line Allocation Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                PR-to-RFQ Line Allocation Ledger Matrix ({modalSelectedItems.length} lines)
              </h4>

              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-[#0B192C] text-white font-bold">
                    <tr>
                      <th className="p-2.5">PR Line</th>
                      <th className="p-2.5">Item Code & Specs</th>
                      <th className="p-2.5 text-right">Original PR Qty</th>
                      <th className="p-2.5 text-right">Already Converted</th>
                      <th className="p-2.5 text-right font-extrabold text-amber-300">Convert Now (Purch UOM)</th>
                      <th className="p-2.5 text-right font-extrabold text-emerald-300">Convert Now (Inv UOM)</th>
                      <th className="p-2.5 text-right font-bold text-slate-300">Remaining Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {modalSelectedItems.map((item) => {
                      const customPurch = customConvertQuantitiesPurchUom[item.id];
                      const convertPurch =
                        customPurch !== undefined && customPurch > 0
                          ? customPurch
                          : item.remainingQuantityPurchUom;

                      const convertInv = convertPurch * item.inventoryToPurchaseConversion;
                      const alreadyConvertedInv = item.requiredQuantityInvUom - item.remainingQuantityInvUom;
                      const remainingInv = Math.max(0, item.remainingQuantityInvUom - convertInv);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-2.5">
                            <div className="font-bold text-indigo-600">{item.prNumber}</div>
                            <div className="text-[10px] text-slate-400">{item.branchName}</div>
                          </td>
                          <td className="p-2.5">
                            <div className="font-bold text-slate-900">{item.itemCode}</div>
                            <div className="text-[10px] text-slate-500 truncate max-w-xs">{item.description}</div>
                          </td>
                          <td className="p-2.5 text-right font-semibold">
                            {item.requiredQuantityInvUom} {item.inventoryUom}
                          </td>
                          <td className="p-2.5 text-right font-semibold text-amber-700">
                            {alreadyConvertedInv} {item.inventoryUom}
                          </td>
                          <td className="p-2.5 text-right font-extrabold text-indigo-900 bg-indigo-50/50">
                            {convertPurch} {item.purchaseUom}
                          </td>
                          <td className="p-2.5 text-right font-extrabold text-emerald-900 bg-emerald-50/50">
                            {convertInv} {item.inventoryUom}
                          </td>
                          <td className="p-2.5 text-right font-bold text-slate-700">
                            {remainingInv} {item.inventoryUom}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowPreConversionModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAndFloatRfq}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-md transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Confirm & Float Competitive RFQ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conversion History Audit Modal */}
      {historySummaryItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-indigo-600">{historySummaryItem.prNumber}</span>
                <h3 className="text-base font-bold text-slate-900">
                  Line-Level RFQ Conversion Ledger ({historySummaryItem.itemCode})
                </h3>
              </div>
              <button
                onClick={() => setHistorySummaryItem(null)}
                className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl text-xs border border-slate-200">
              <div>
                <span className="text-slate-500 font-medium block">Original PR Qty:</span>
                <strong className="text-slate-900 font-bold">
                  {historySummaryItem.originalPrQtyInvUom} {historySummaryItem.prInvUom}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Converted Qty:</span>
                <strong className="text-amber-700 font-bold">
                  {historySummaryItem.convertedQtyInvUom} {historySummaryItem.prInvUom}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Remaining Unconverted:</span>
                <strong className="text-emerald-700 font-bold">
                  {historySummaryItem.remainingQtyInvUom} {historySummaryItem.prInvUom}
                </strong>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Conversion Transaction History</h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2">RFQ Number</th>
                      <th className="p-2 text-right">Converted (Inv UOM)</th>
                      <th className="p-2 text-right">Converted (Purch UOM)</th>
                      <th className="p-2">Converted By</th>
                      <th className="p-2">Timestamp (UTC)</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {historySummaryItem.records.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-400">
                          No conversion records found for this PR line.
                        </td>
                      </tr>
                    ) : (
                      historySummaryItem.records.map((r) => (
                        <tr key={r.id}>
                          <td className="p-2 font-bold text-indigo-600">{r.rfqNumber}</td>
                          <td className="p-2 text-right font-bold text-amber-700">
                            {r.convertedQtyInvUom} {r.prInvUom}
                          </td>
                          <td className="p-2 text-right font-bold text-indigo-900">
                            {r.convertedQtyPurchUom} {r.rfqPurchUom}
                          </td>
                          <td className="p-2">{r.convertedByName}</td>
                          <td className="p-2">{new Date(r.convertedAt).toLocaleString()}</td>
                          <td className="p-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                r.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exemption Modal */}
      {exemptModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600" />
                <span>Authorized Direct Procurement Exemption</span>
              </h3>
              <button onClick={() => setExemptModalItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Exempting PR line <strong className="text-slate-800">{exemptModalItem.prNumber} ({exemptModalItem.itemCode})</strong> from competitive RFQ floating requires a recorded business justification.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Exemption Reason *</label>
              <textarea
                value={exemptionReason}
                onChange={(e) => setExemptionReason(e.target.value)}
                placeholder="State valid operational reason (e.g. Single-source OEM proprietary spare)..."
                rows={3}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setExemptModalItem(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExemptSubmit}
                disabled={!exemptionReason.trim()}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
              >
                Confirm Authorized Exemption
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Market Price Benchmark Inspection Modal (Quick-view from any PR row) */}
      {benchmarkModalItemCode && benchmarkModalResult && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded uppercase">
                  Market Price Benchmark Inspector
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                  <span>Verified Web Benchmark for {benchmarkModalItemCode}</span>
                </h3>
              </div>
              <button
                onClick={() => {
                  setBenchmarkModalItemCode(null);
                  setBenchmarkModalResult(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Disclaimer */}
            <div className="bg-amber-50 border border-amber-300 px-3.5 py-2.5 rounded-xl text-amber-900 text-xs font-bold flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>INDICATIVE MARKET PRICES, NOT FORMAL SUPPLIER QUOTATIONS</span>
              </div>
              <span className="text-[10px] text-amber-700 font-semibold hidden sm:inline">
                Normalized to Purchase UOM: {benchmarkModalResult.purchaseUom}
              </span>
            </div>

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                <div className="text-[10px] font-bold text-emerald-800 uppercase">Lowest Landed Price</div>
                <div className="text-lg font-black text-emerald-950 mt-0.5">
                  ₹{benchmarkModalResult.lowestLandedPrice.toLocaleString()}{' '}
                  <span className="text-[10px] text-emerald-700 font-normal">/ {benchmarkModalResult.purchaseUom}</span>
                </div>
                <div className="text-[10px] text-emerald-600">Tax & freight inclusive</div>
              </div>

              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                <div className="text-[10px] font-bold text-amber-800 uppercase">Recommended Median Benchmark</div>
                <div className="text-lg font-black text-amber-950 mt-0.5">
                  ₹{benchmarkModalResult.medianPrice.toLocaleString()}{' '}
                  <span className="text-[10px] text-amber-700 font-normal">/ {benchmarkModalResult.purchaseUom}</span>
                </div>
                <div className="text-[10px] text-amber-700 font-medium">Standard negotiation ceiling</div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] font-bold text-slate-600 uppercase">Highest Market Listing</div>
                <div className="text-lg font-bold text-slate-800 mt-0.5">
                  ₹{benchmarkModalResult.highestPrice.toLocaleString()}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">/ {benchmarkModalResult.purchaseUom}</span>
                </div>
                <div className="text-[10px] text-slate-400">Spot emergency price</div>
              </div>

              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3">
                <div className="text-[10px] font-bold text-indigo-800 uppercase">Verified Sample Size</div>
                <div className="text-lg font-black text-indigo-950 mt-0.5">
                  {benchmarkModalResult.sampleSize} Offers
                </div>
                <div className="text-[10px] text-indigo-700">
                  {benchmarkModalResult.exactMatchCount} Exact • {benchmarkModalResult.equivalentMatchCount} Equivalent
                </div>
              </div>
            </div>

            {/* Supplier Preference Levels (L1, L2, L3) Governance Cards */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                <span>Supplier Preference Levels (Vendor Master Governance)</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* L1 Card */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-300 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-400">
                      L1 PREFERRED SUPPLIER
                    </span>
                    {benchmarkModalResult.l1Supplier?.historicalPerformanceScore && (
                      <span className="text-[10px] font-bold text-amber-800">
                        {benchmarkModalResult.l1Supplier.historicalPerformanceScore}% QA Score
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-slate-900 mt-2 truncate">
                    {benchmarkModalResult.l1Supplier?.vendorName || 'BASF India Limited'}
                  </div>
                  <div className="text-xs font-black text-amber-950 mt-0.5">
                    ₹{benchmarkModalResult.l1Supplier?.estimatedLandedPrice.toLocaleString()} / {benchmarkModalResult.purchaseUom}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                    {benchmarkModalResult.l1Supplier?.preferenceReason || 'Highest tier approved partner with audited QA certification.'}
                  </div>
                </div>

                {/* L2 Card */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50/40 border border-blue-200 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-300">
                      L2 SECONDARY SUPPLIER
                    </span>
                    {benchmarkModalResult.l2Supplier?.historicalPerformanceScore && (
                      <span className="text-[10px] font-bold text-blue-800">
                        {benchmarkModalResult.l2Supplier.historicalPerformanceScore}% QA Score
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-slate-900 mt-2 truncate">
                    {benchmarkModalResult.l2Supplier?.vendorName || 'Polymer Solutions India'}
                  </div>
                  <div className="text-xs font-black text-blue-950 mt-0.5">
                    ₹{benchmarkModalResult.l2Supplier?.estimatedLandedPrice.toLocaleString()} / {benchmarkModalResult.purchaseUom}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                    {benchmarkModalResult.l2Supplier?.preferenceReason || 'Secondary qualified supplier for dual-sourcing contingency.'}
                  </div>
                </div>

                {/* L3 Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-200 text-slate-800 border border-slate-300">
                      L3 TERTIARY SUPPLIER
                    </span>
                    {benchmarkModalResult.l3Supplier?.historicalPerformanceScore && (
                      <span className="text-[10px] font-bold text-slate-600">
                        {benchmarkModalResult.l3Supplier.historicalPerformanceScore}% QA Score
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-slate-900 mt-2 truncate">
                    {benchmarkModalResult.l3Supplier?.vendorName || 'National Polymers Corporation'}
                  </div>
                  <div className="text-xs font-black text-slate-950 mt-0.5">
                    ₹{benchmarkModalResult.l3Supplier?.estimatedLandedPrice.toLocaleString()} / {benchmarkModalResult.purchaseUom}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                    {benchmarkModalResult.l3Supplier?.preferenceReason || 'Tertiary certified partner for buffer capacity.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Vendor Offers Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Discovered Vendor Listings ({benchmarkModalResult.offers.length} verified sources)
                </h4>
                <button
                  onClick={() => {
                    const refreshed = marketBenchmarkService.generateBenchmarkForItem(benchmarkModalItemCode, 'Demand PR Item');
                    setBenchmarkModalResult(refreshed);
                  }}
                  className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Offers</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-[#0B192C] text-white font-bold">
                    <tr>
                      <th className="p-2.5">Tier</th>
                      <th className="p-2.5">Vendor & Location</th>
                      <th className="p-2.5">Manufacturer</th>
                      <th className="p-2.5">Match Type</th>
                      <th className="p-2.5 text-right">Published Price</th>
                      <th className="p-2.5 text-right">GST / Freight</th>
                      <th className="p-2.5 text-right font-extrabold text-amber-300">Landed Price (₹)</th>
                      <th className="p-2.5 text-center">MOQ / Lead Time</th>
                      <th className="p-2.5 text-center">Source Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {benchmarkModalResult.offers.map((offer) => (
                      <tr key={offer.id} className="hover:bg-slate-50">
                        <td className="p-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                              offer.preferenceLevel === 'L1'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : offer.preferenceLevel === 'L2'
                                ? 'bg-blue-100 text-blue-900'
                                : offer.preferenceLevel === 'L3'
                                ? 'bg-purple-100 text-purple-900'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {offer.preferenceLevel || 'MARKET'}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">
                          <div>{offer.vendorName}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{offer.vendorLocation}</div>
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-700">{offer.manufacturer}</div>
                          <div className="text-[10px] text-slate-400">{offer.model}</div>
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              offer.matchClassification === 'EXACT_MATCH'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {offer.matchClassification === 'EXACT_MATCH' ? 'Exact Match' : 'Equivalent'}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-semibold">
                          ₹{offer.publishedPrice.toLocaleString()} / {offer.quotedUom}
                        </td>
                        <td className="p-2.5 text-right text-[11px] text-slate-500">
                          +{offer.gstPercent || 18}% GST
                          <div className="text-[10px] text-slate-400">+₹{offer.estimatedFreight || 0} frt</div>
                        </td>
                        <td className="p-2.5 text-right font-bold text-indigo-900 bg-indigo-50/30">
                          ₹{offer.estimatedLandedPrice.toLocaleString()} / {benchmarkModalResult.purchaseUom}
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="font-semibold">{offer.moq} {offer.quotedUom}</div>
                          <div className="text-[10px] text-slate-400">{offer.deliveryLeadTimeDays} Days</div>
                        </td>
                        <td className="p-2.5 text-center">
                          <a
                            href={offer.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold"
                          >
                            <span>Inspect</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Excluded Non-Comparable Offers */}
            {benchmarkModalResult.excludedOffers && benchmarkModalResult.excludedOffers.length > 0 && (
              <div className="space-y-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Excluded Market Listings ({benchmarkModalResult.excludedOffers.length} Non-Comparable Offers)</span>
                </div>
                <div className="text-[10px] text-slate-500 mb-2">
                  The following offers were discovered online but strictly excluded from benchmark calculation due to procurement governance rules:
                </div>
                <div className="divide-y divide-slate-200 text-xs">
                  {benchmarkModalResult.excludedOffers.map((ex) => (
                    <div key={ex.id || ex.supplierName} className="py-2 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-800">{ex.vendorName || ex.supplierName} — ₹{ex.publishedPrice?.toLocaleString() || '0'}</div>
                        <div className="text-[10px] text-rose-700 font-medium">Exclusion Reason: {ex.exclusionReason || ex.reason}</div>
                      </div>
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[9px] font-bold rounded">
                        EXCLUDED FROM BENCHMARK
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setBenchmarkModalItemCode(null);
                  setBenchmarkModalResult(null);
                }}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
              >
                Close Benchmark Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
