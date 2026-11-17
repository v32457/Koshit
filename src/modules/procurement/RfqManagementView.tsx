import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Search,
  Filter,
  Calendar,
  Users,
  Eye,
  CheckCircle2,
  Clock,
  FileText,
  ShieldCheck,
  Award,
  AlertTriangle,
  Lock,
  ChevronRight,
  ChevronDown,
  X,
  FileCheck,
  Building,
  UserCheck,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Send,
  Package,
  History,
  CheckCircle,
  AlertCircle,
  BarChart2,
  Sliders,
  Divide,
  Scale,
  Sparkles,
  Info,
} from 'lucide-react';
import { User, Company, Branch } from '../../types';
import { rfqService } from '../../services/rfqService';
import { rfqExaminerService } from '../../services/rfqExaminerService';
import { rfqEvaluationService } from '../../services/rfqEvaluationService';
import { marketBenchmarkService } from '../../services/marketBenchmarkService';
import { prRfqConversionService, PrLineConversionSummary } from '../../services/prRfqConversionService';
import { financialYearService } from '../../services/financialYearService';
import { FinancialYearSelector } from '../../components/FinancialYearSelector';
import { INITIAL_BUSINESS_PARTNERS } from '../../data/seedData';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';
import {
  RfqHeader,
  RfqLineItem,
  RfqSupplierInvitation,
  SupplierQuotation,
  RfqExaminerRun,
  RfqStatus,
  MarketBenchmarkResult,
  SupplierPreferenceLevel,
  RfqComparativeStatementRow,
} from '../../types/rfqSourcing';

interface RfqManagementViewProps {
  currentUser: User;
  companies: Company[];
  branches: Branch[];
  onNavigate: (route: string) => void;
}

export const RfqManagementView: React.FC<RfqManagementViewProps> = ({
  currentUser,
  companies,
  branches,
  onNavigate,
}) => {
  const [rfqs, setRfqs] = useState<RfqHeader[]>(() => rfqService.getRfqs());
  const [quotations, setQuotations] = useState<SupplierQuotation[]>(() => rfqService.getQuotations());
  const [examinerRuns, setExaminerRuns] = useState<RfqExaminerRun[]>(() => rfqExaminerService.getExaminerRuns());

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [quotationFilter, setQuotationFilter] = useState<string>('ALL');
  const [evaluationFilter, setEvaluationFilter] = useState<string>('ALL');
  const [buyerFilter, setBuyerFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedFyId, setSelectedFyId] = useState<string>(
    () => financialYearService.getDefaultFinancialYearForCompany('co-kosh-01')?.id || ''
  );

  // Expanded rows state (array of rfq IDs)
  const [expandedRfqIds, setExpandedRfqIds] = useState<string[]>([]);

  // Selected RFQs for bulk actions
  const [selectedRfqIds, setSelectedRfqIds] = useState<string[]>([]);

  // Live Web Market Price Discovery Engine Panel Toggle
  const [showDiscoveryEngine, setShowDiscoveryEngine] = useState<boolean>(false);
  const [benchmarkSearchItemCode, setBenchmarkSearchItemCode] = useState<string>('RMPAOPOEXLG0001');
  const [activeBenchmarkResult, setActiveBenchmarkResult] = useState<MarketBenchmarkResult>(() =>
    marketBenchmarkService.getBenchmarkForItem('RMPAOPOEXLG0001', 'PC-ABS Polycarbonate Resins')
  );

  // Benchmark Inspection Modal
  const [benchmarkModalItemCode, setBenchmarkModalItemCode] = useState<string | null>(null);
  const [benchmarkModalResult, setBenchmarkModalResult] = useState<MarketBenchmarkResult | null>(null);

  // Invite Supplier Modal
  const [inviteModalRfq, setInviteModalRfq] = useState<RfqHeader | null>(null);
  const [inviteVendorId, setInviteVendorId] = useState<string>('');
  const [inviteCustomEmail, setInviteCustomEmail] = useState<string>('');

  // Submit / Record Quotation Modal
  const [quoteModalRfq, setQuoteModalRfq] = useState<RfqHeader | null>(null);
  const [quoteVendorId, setQuoteVendorId] = useState<string>('');
  const [quoteUnitPrice, setQuoteUnitPrice] = useState<number>(0);
  const [quoteGstPct, setQuoteGstPct] = useState<number>(18);
  const [quoteFreight, setQuoteFreight] = useState<number>(0);
  const [quoteLeadTime, setQuoteLeadTime] = useState<number>(7);
  const [quoteTechCompliance, setQuoteTechCompliance] = useState<'COMPLIANT' | 'DEVIATION' | 'NON_COMPLIANT'>('COMPLIANT');
  const [quotePaymentTerms, setQuotePaymentTerms] = useState<string>('NET 45 Days');

  // Extend Deadline Modal
  const [extendDeadlineRfq, setExtendDeadlineRfq] = useState<RfqHeader | null>(null);
  const [newDeadlineDate, setNewDeadlineDate] = useState<string>('');
  const [extendReason, setExtendReason] = useState<string>('');

  // Award RFQ Modal
  const [awardModalRfq, setAwardModalRfq] = useState<RfqHeader | null>(null);
  const [awardType, setAwardType] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [awardWinningVendor, setAwardWinningVendor] = useState<string>('');
  const [awardSecondaryVendor, setAwardSecondaryVendor] = useState<string>('');
  const [awardJustification, setAwardJustification] = useState<string>('');

  // Cancel RFQ Modal
  const [cancelModalRfq, setCancelModalRfq] = useState<RfqHeader | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  // Conversion History Modal
  const [historyModalRfq, setHistoryModalRfq] = useState<RfqHeader | null>(null);

  // Create Direct RFQ Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newRfqTitle, setNewRfqTitle] = useState('');
  const [newRfqCompanyId, setNewRfqCompanyId] = useState('co-kosh-01');
  const [newRfqBranchId, setNewRfqBranchId] = useState('br-pond-01');
  const [newRfqDeadline, setNewRfqDeadline] = useState('2026-12-15');
  const [newRfqDeliveryTerms, setNewRfqDeliveryTerms] = useState('FOR Destination - Plant Warehouse');
  const [newRfqPaymentTerms, setNewRfqPaymentTerms] = useState('NET 60 Days after Quality Inspection');

  // Notification Banner
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const reloadData = () => {
    setRfqs(rfqService.getRfqs());
    setQuotations(rfqService.getQuotations());
    setExaminerRuns(rfqExaminerService.getExaminerRuns());
  };

  const getExaminerRunForRfq = (rfqId: string): RfqExaminerRun | undefined => {
    return examinerRuns.find((run) => run.rfqId === rfqId);
  };

  const getQuotationsForRfq = (rfqId: string): SupplierQuotation[] => {
    return quotations.filter((q) => q.rfqId === rfqId || q.rfqNumber === rfqId);
  };

  // Centralized Financial Year & RBAC Filtering
  const fyFilterResult = useMemo(() => {
    return financialYearService.filterTransactionsByFinancialYear({
      records: rfqs,
      selectedFyId,
      companyId: companyFilter,
      branchId: branchFilter,
      currentUser,
      entityType: 'RFQ',
      getRecordId: (r) => r.id,
      getDocumentNumber: (r) => r.rfqNumber,
      getCompanyId: (r) => r.companyId,
      getBranchId: (r) => r.branchId,
      getPurchaseOrgId: (r) => r.purchaseOrgId,
      getFinancialYearId: (r) => r.financialYearId,
      getFinancialYearCode: (r) => r.financialYearCode,
      getDocumentDate: (r) => r.rfqDate,
    });
  }, [rfqs, selectedFyId, companyFilter, branchFilter, currentUser]);

  const fyScopedRfqs = fyFilterResult.filteredRecords;
  const isHistoricalReadOnly = fyFilterResult.isHistoricalReadOnly;

  // 13 KPI Metrics Dashboard Cards Calculation (Scoped to active FY filter)
  const kpiMetrics = useMemo(() => {
    const total = fyScopedRfqs.length;
    const draft = fyScopedRfqs.filter((r) => r.status === 'DRAFT').length;
    const pendingApproval = fyScopedRfqs.filter((r) => r.status === 'PENDING_RELEASE_APPROVAL').length;
    const approvedReady = fyScopedRfqs.filter(
      (r) => r.status === 'TECHNICAL_GATE_APPROVED' || (r as any).status === 'APPROVED_PENDING_RELEASE'
    ).length;
    const released = fyScopedRfqs.filter((r) => r.status === 'RELEASED').length;
    const awaitingQuotes = fyScopedRfqs.filter(
      (r) => r.status === 'RELEASED' && getQuotationsForRfq(r.id).length === 0
    ).length;
    const quotesReceived = fyScopedRfqs.filter((r) => getQuotationsForRfq(r.id).length > 0).length;
    const techEvalPending = fyScopedRfqs.filter((r) => r.status === 'UNDER_TECHNICAL_EVALUATION').length;
    const commEvalPending = fyScopedRfqs.filter(
      (r) => r.status === 'UNDER_COMMERCIAL_EVALUATION' || r.status === 'COMPARATIVE_STATEMENT_GENERATED'
    ).length;
    const underNegotiation = fyScopedRfqs.filter((r) => r.status === 'UNDER_NEGOTIATION').length;
    const awarded = fyScopedRfqs.filter((r) => r.status === 'AWARDED').length;
    const partiallyAwarded = fyScopedRfqs.filter((r) => r.status === 'PARTIALLY_AWARDED').length;
    const closedCancelled = fyScopedRfqs.filter((r) => r.status === 'CLOSED' || r.status === 'CANCELLED').length;

    return {
      total,
      draft,
      pendingApproval,
      approvedReady,
      released,
      awaitingQuotes,
      quotesReceived,
      techEvalPending,
      commEvalPending,
      underNegotiation,
      awarded,
      partiallyAwarded,
      closedCancelled,
    };
  }, [fyScopedRfqs, quotations]);

  // Unique filters
  const uniqueBuyers = useMemo(() => {
    const set = new Set<string>();
    rfqs.forEach((r) => {
      if (r.buyerName) set.add(r.buyerName);
    });
    return Array.from(set);
  }, [rfqs]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    rfqs.forEach((r) => {
      r.lines.forEach((l) => {
        if (l.category) set.add(l.category);
      });
    });
    return Array.from(set);
  }, [rfqs]);

  // Filtered RFQs
  const filteredRfqs = useMemo(() => {
    return fyScopedRfqs.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.rfqNumber.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.prReferences.some((pr) => pr.toLowerCase().includes(q)) ||
        r.lines.some((l) => l.itemCode.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)) ||
        r.invitations.some((inv) => inv.vendorName.toLowerCase().includes(q));

      const matchesCompany = companyFilter === 'ALL' || r.companyId === companyFilter;
      const matchesBranch = branchFilter === 'ALL' || r.branchId === branchFilter;
      const matchesBuyer = buyerFilter === 'ALL' || r.buyerName === buyerFilter;
      const matchesCategory =
        categoryFilter === 'ALL' || r.lines.some((l) => l.category === categoryFilter);

      let matchesStatus = true;
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'KPI_AWAITING_QUOTES') {
          matchesStatus = r.status === 'RELEASED' && getQuotationsForRfq(r.id).length === 0;
        } else if (statusFilter === 'KPI_QUOTES_RECEIVED') {
          matchesStatus = getQuotationsForRfq(r.id).length > 0;
        } else if (statusFilter === 'KPI_COMM_EVAL') {
          matchesStatus =
            r.status === 'UNDER_COMMERCIAL_EVALUATION' || r.status === 'COMPARATIVE_STATEMENT_GENERATED';
        } else if (statusFilter === 'KPI_CLOSED_CANCELLED') {
          matchesStatus = r.status === 'CLOSED' || r.status === 'CANCELLED';
        } else {
          matchesStatus = r.status === statusFilter;
        }
      }

      let matchesQuotation = true;
      const rfqQuotes = getQuotationsForRfq(r.id);
      if (quotationFilter === 'NO_QUOTES') matchesQuotation = rfqQuotes.length === 0;
      if (quotationFilter === 'HAS_QUOTES') matchesQuotation = rfqQuotes.length > 0;
      if (quotationFilter === 'QUOTES_CLOSED')
        matchesQuotation = [
          'UNDER_TECHNICAL_EVALUATION',
          'TECHNICAL_GATE_APPROVED',
          'UNDER_COMMERCIAL_EVALUATION',
          'COMPARATIVE_STATEMENT_GENERATED',
          'UNDER_NEGOTIATION',
          'AWARD_RECOMMENDED',
          'AWARDED',
          'PARTIALLY_AWARDED',
          'CLOSED',
        ].includes(r.status);

      let matchesEvaluation = true;
      if (evaluationFilter === 'TECH_PENDING') matchesEvaluation = r.status === 'UNDER_TECHNICAL_EVALUATION';
      if (evaluationFilter === 'TECH_APPROVED') matchesEvaluation = r.status === 'TECHNICAL_GATE_APPROVED';
      if (evaluationFilter === 'COMM_PENDING')
        matchesEvaluation =
          r.status === 'UNDER_COMMERCIAL_EVALUATION' || r.status === 'COMPARATIVE_STATEMENT_GENERATED';
      if (evaluationFilter === 'EVALUATED')
        matchesEvaluation = ['AWARD_RECOMMENDED', 'UNDER_NEGOTIATION', 'AWARDED', 'PARTIALLY_AWARDED'].includes(
          r.status
        );

      return (
        matchesSearch &&
        matchesCompany &&
        matchesBranch &&
        matchesBuyer &&
        matchesCategory &&
        matchesStatus &&
        matchesQuotation &&
        matchesEvaluation
      );
    });
  }, [
    fyScopedRfqs,
    searchQuery,
    companyFilter,
    branchFilter,
    buyerFilter,
    categoryFilter,
    statusFilter,
    quotationFilter,
    evaluationFilter,
    quotations,
  ]);

  const rfqGrid = useStandardDataGrid({
    gridId: 'rfq-management',
    userId: currentUser?.id,
    data: filteredRfqs,
    defaultSortField: 'rfqDate',
    defaultSortDirection: 'desc',
    tieBreakerField: 'rfqNumber',
    filterSignature: `${selectedFyId}|${searchQuery}|${companyFilter}|${branchFilter}|${buyerFilter}|${categoryFilter}|${statusFilter}|${quotationFilter}|${evaluationFilter}`,
  });

  // Expand / collapse handlers
  const toggleRfqExpand = (rfqId: string) => {
    setExpandedRfqIds((prev) =>
      prev.includes(rfqId) ? prev.filter((id) => id !== rfqId) : [...prev, rfqId]
    );
  };

  const handleExpandAll = () => {
    setExpandedRfqIds(rfqGrid.pagedData.map((r) => r.id));
  };

  const handleCollapseAll = () => {
    setExpandedRfqIds([]);
  };

  // Selection handlers
  const handleToggleSelectAll = () => {
    const pageIds = rfqGrid.pagedData.map((r) => r.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedRfqIds.includes(id));
    if (allPageSelected) {
      setSelectedRfqIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedRfqIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleToggleSelectRfq = (rfqId: string) => {
    setSelectedRfqIds((prev) =>
      prev.includes(rfqId) ? prev.filter((id) => id !== rfqId) : [...prev, rfqId]
    );
  };

  // Live Market Benchmark handler
  const handleOpenBenchmarkForItem = (itemCode: string, description?: string) => {
    setBenchmarkModalItemCode(itemCode);
    const res = marketBenchmarkService.getBenchmarkForItem(itemCode, description || 'Standard Requirement');
    setBenchmarkModalResult(res);
  };

  const handleRunLiveBenchmark = (itemCode: string) => {
    const res = marketBenchmarkService.generateBenchmarkForItem(itemCode, 'Standard Sourcing Requirement');
    setActiveBenchmarkResult(res);
  };

  // Run AI Examiner handler
  const handleRunExaminer = (rfqId: string) => {
    const run = rfqExaminerService.runExaminer(rfqId, currentUser.fullName);
    setExaminerRuns((prev) => [run, ...prev.filter((r) => r.rfqId !== rfqId)]);
    setActionSuccessMessage(`AI Examiner run completed for RFQ. Overall outcome: ${run.overallStatus}`);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  // Lifecycle Action Handlers
  const handleSubmitForApproval = (rfq: RfqHeader) => {
    rfqService.submitForApproval(rfq.id);
    reloadData();
    setActionSuccessMessage(`RFQ ${rfq.rfqNumber} submitted for management release approval.`);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  const handleApproveRfq = (rfq: RfqHeader) => {
    rfqService.approveRfq(rfq.id);
    reloadData();
    setActionSuccessMessage(`RFQ ${rfq.rfqNumber} approved and marked RELEASED.`);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  const handleReleaseToSuppliers = (rfq: RfqHeader) => {
    rfqService.releaseRfq(rfq.id);
    reloadData();
    setActionSuccessMessage(`RFQ ${rfq.rfqNumber} released to invited suppliers. Quotations open.`);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  const handleStartNegotiation = (rfq: RfqHeader) => {
    rfqService.startNegotiation(rfq.id);
    reloadData();
    setActionSuccessMessage(`RFQ ${rfq.rfqNumber} status shifted to UNDER NEGOTIATION.`);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  // Execute Supplier Invitation
  const handleExecuteInvite = () => {
    if (!inviteModalRfq) return;
    const partner = INITIAL_BUSINESS_PARTNERS.find((b) => b.id === inviteVendorId);
    const vendorCode = partner?.bpCode || 'VEND-EXT-01';
    const vendorName = partner?.bpName || 'Registered Vendor';
    const contactEmail = inviteCustomEmail || partner?.email || 'vendor@example.com';

    rfqService.inviteSupplier(inviteModalRfq.id, {
      vendorId: inviteVendorId || `vend-${Date.now()}`,
      vendorCode,
      vendorName,
      contactEmail,
    });
    reloadData();
    setActionSuccessMessage(`Supplier invitation sent to ${vendorName} for ${inviteModalRfq.rfqNumber}`);
    setInviteModalRfq(null);
    setInviteVendorId('');
    setInviteCustomEmail('');
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  // Execute Record Quotation
  const handleExecuteRecordQuote = () => {
    if (!quoteModalRfq) return;
    const partner = INITIAL_BUSINESS_PARTNERS.find((b) => b.id === quoteVendorId);
    const vendorName = partner?.bpName || 'Verified Supplier';
    const vendorCode = partner?.bpCode || 'VEND-QUOT-01';
    const line = quoteModalRfq.lines[0];
    const qty = line?.quantityPurchUom || 10;
    const gstAmt = (quoteUnitPrice * qty * quoteGstPct) / 100;
    const landedUnit = quoteUnitPrice * (1 + quoteGstPct / 100) + quoteFreight / qty;

    const newQuotation: SupplierQuotation = {
      id: `quot-${Date.now()}`,
      rfqId: quoteModalRfq.id,
      rfqNumber: quoteModalRfq.rfqNumber,
      vendorId: quoteVendorId || `vend-${Date.now()}`,
      vendorCode,
      vendorName,
      revisionNumber: 1,
      quotationNumber: `QT-${Date.now().toString().slice(-6)}`,
      quotationDate: new Date().toISOString().split('T')[0],
      validUntil: quoteModalRfq.responseDeadline,
      currency: quoteModalRfq.currency,
      paymentTerms: quotePaymentTerms,
      incoterms: quoteModalRfq.incoterms,
      totalQuotedValue: quoteUnitPrice * qty,
      totalLandedValue: landedUnit * qty,
      technicalComplianceStatus: quoteTechCompliance === 'COMPLIANT' ? 'PASS' : 'PASS_WITH_WARNINGS',
      lines: [
        {
          id: `ql-${Date.now()}`,
          quotationId: `quot-${Date.now()}`,
          rfqLineId: line?.id || 'line-01',
          itemCode: line?.itemCode || 'RMPAOPOEXLG0001',
          description: line?.description || 'Item Sourcing Line',
          quotedQuantityPurchUom: qty,
          purchaseUom: line?.purchaseUom || 'BAG',
          unitPricePurchUom: quoteUnitPrice,
          currency: 'INR',
          gstPercent: quoteGstPct,
          gstAmount: gstAmt,
          freightAmount: quoteFreight,
          insuranceAmount: 0,
          otherCharges: 0,
          discountPercent: 0,
          discountAmount: 0,
          netLineTotal: quoteUnitPrice * qty,
          landedUnitPricePurchUom: Math.round(landedUnit * 100) / 100,
          moq: Math.round(qty / 2),
          deliveryLeadTimeDays: quoteLeadTime,
          technicalCompliance: quoteTechCompliance,
        },
      ],
      attachments: [
        {
          id: `att-${Date.now()}`,
          fileName: `Commercial_Quotation_${vendorCode}.pdf`,
          fileSize: 420000,
          uploadedAt: new Date().toISOString(),
        },
      ],
      submittedAt: new Date().toISOString(),
      submittedBy: currentUser.fullName,
      isSealed: false,
    };

    rfqService.submitQuotation(newQuotation);
    reloadData();
    setActionSuccessMessage(`Quotation recorded from ${vendorName} for ${quoteModalRfq.rfqNumber}`);
    setQuoteModalRfq(null);
    setQuoteUnitPrice(0);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  // Execute Extend Deadline
  const handleExecuteExtendDeadline = () => {
    if (!extendDeadlineRfq || !newDeadlineDate) return;
    rfqService.extendDeadline(extendDeadlineRfq.id, newDeadlineDate);
    reloadData();
    setActionSuccessMessage(`Quotation deadline for ${extendDeadlineRfq.rfqNumber} extended to ${newDeadlineDate}`);
    setExtendDeadlineRfq(null);
    setNewDeadlineDate('');
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  // Execute Award RFQ
  const handleExecuteAward = () => {
    if (!awardModalRfq) return;
    rfqService.awardRfq(awardModalRfq.id, awardType);
    reloadData();
    setActionSuccessMessage(
      `RFQ ${awardModalRfq.rfqNumber} has been successfully ${
        awardType === 'FULL' ? 'AWARDED' : 'PARTIALLY AWARDED (Split Allocation)'
      }. PO generation queue unlocked.`
    );
    setAwardModalRfq(null);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  // Execute Cancel RFQ (with automatic PR conversion reversal)
  const handleExecuteCancel = () => {
    if (!cancelModalRfq) return;
    rfqService.updateRfqStatus(
      cancelModalRfq.id,
      'CANCELLED',
      currentUser.fullName,
      cancelReason || 'Cancelled by Buyer'
    );
    reloadData();
    setActionSuccessMessage(
      `RFQ ${cancelModalRfq.rfqNumber} has been CANCELLED. All contributing PR line converted balances have been automatically reversed back to the demand pipeline.`
    );
    setCancelModalRfq(null);
    setCancelReason('');
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  // Execute Create Direct RFQ
  const handleExecuteCreateDirectRfq = () => {
    if (!newRfqTitle.trim()) return;
    const comp = companies.find((c) => c.id === newRfqCompanyId);
    const branch = branches.find((b) => b.id === newRfqBranchId);

    rfqService.createRfq({
      companyId: newRfqCompanyId,
      companyCode: comp?.code || 'KOSH-HQ',
      branchId: newRfqBranchId,
      branchCode: branch?.code || '001',
      branchName: branch?.name || 'Main Plant',
      purchaseOrgId: 'po-kosh-01',
      title: newRfqTitle,
      description: 'Direct procurement sourcing floating generated via RFQ Directory master.',
      prReferences: [],
      responseDeadline: newRfqDeadline,
      quotationValidityDays: 60,
      buyerId: currentUser.id,
      buyerName: currentUser.fullName,
      purchasingManagerId: 'usr-checker-03',
      purchasingManagerName: 'Venkatesh Iyer',
      currency: 'INR',
      deliveryTerms: newRfqDeliveryTerms,
      paymentTerms: newRfqPaymentTerms,
      incoterms: 'DDP - Delivered Duty Paid',
      evaluationMethod: 'TWO_STAGE',
      sealedCommercialQuotations: true,
      lines: [
        {
          id: `line-direct-${Date.now()}`,
          rfqId: `rfq-direct-${Date.now()}`,
          prLineId: `pr-direct-${Date.now()}`,
          prNumber: 'PR-DIRECT-2026',
          itemCode: 'RMPAOPOEXLG0001',
          description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
          category: 'Raw Materials',
          specifications: 'Injection Grade V0 flame retardant, UL94 certified, MFI 18-22 g/10min',
          quantityPurchUom: 20,
          purchaseUom: 'BAG',
          inventoryUom: 'KG',
          conversionRatio: 25,
          requiredDeliveryDate: newRfqDeadline,
          targetWarehouse: 'WH-RM-01',
        },
      ],
      invitations: [
        {
          id: `inv-direct-${Date.now()}`,
          rfqId: `rfq-direct-${Date.now()}`,
          vendorId: 'bp-002',
          vendorCode: 'VEND-BASF-01',
          vendorName: 'BASF INDIA LIMITED',
          contactEmail: 'orders.india@basf.com',
          invitedAt: new Date().toISOString(),
          invitationStatus: 'INVITED',
          responseDeadline: newRfqDeadline,
        },
      ],
    });

    reloadData();
    setShowCreateModal(false);
    setNewRfqTitle('');
    setActionSuccessMessage('Direct RFQ Draft created successfully.');
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  const getStatusBadge = (status: RfqStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-300">
            DRAFT
          </span>
        );
      case 'PENDING_RELEASE_APPROVAL':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
            PENDING APPROVAL
          </span>
        );
      case 'RELEASED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
            RELEASED
          </span>
        );
      case 'QUOTATIONS_IN_PROGRESS':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-100 text-cyan-800 border border-cyan-300">
            QUOTATIONS IN PROGRESS
          </span>
        );
      case 'UNDER_TECHNICAL_EVALUATION':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-300">
            TECH EVALUATION
          </span>
        );
      case 'TECHNICAL_GATE_APPROVED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-300">
            TECH APPROVED
          </span>
        );
      case 'UNDER_COMMERCIAL_EVALUATION':
      case 'COMPARATIVE_STATEMENT_GENERATED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
            COMMERCIAL EVAL
          </span>
        );
      case 'UNDER_NEGOTIATION':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-100 text-orange-900 border border-orange-300">
            UNDER NEGOTIATION
          </span>
        );
      case 'AWARD_RECOMMENDED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
            AWARD RECOMMENDED
          </span>
        );
      case 'AWARDED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white shadow-xs">
            AWARDED (100%)
          </span>
        );
      case 'PARTIALLY_AWARDED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-600 text-white shadow-xs">
            SPLIT AWARDED (60/40)
          </span>
        );
      case 'CLOSED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-800">
            CLOSED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-300">
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Notification Banner */}
      {actionSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl shadow-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-800">
              Procurement & Sourcing → RFQ
            </span>
            <span className="text-xs text-slate-400 font-medium">Sourcing Demand & Quotation Governance</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" />
            <span>Sourcing</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Centralized governance console for RFQ floating, supplier quotation tracking, AI examiner runs, and comparative statement evaluations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
            onClick={() => setShowCreateModal(true)}
            disabled={isHistoricalReadOnly}
            title={isHistoricalReadOnly ? 'Historical closed FY view is read-only' : 'Create Direct RFQ'}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4 text-indigo-600" />
            <span>Create Direct RFQ</span>
          </button>

          <button
            onClick={() => onNavigate('/procurement/future-floating')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs shadow-indigo-200 transition cursor-pointer"
          >
            <Clock className="w-4 h-4" />
            <span>Float RFQ from PR Pipeline</span>
          </button>
        </div>
      </div>

      {/* Centralized Financial Year Selector */}
      <FinancialYearSelector
        companyId={companyFilter === 'ALL' ? 'co-kosh-01' : companyFilter}
        selectedFyId={selectedFyId}
        onSelectFy={setSelectedFyId}
        currentUser={currentUser}
        dataQualityGaps={fyFilterResult.dataQualityGaps}
        entityLabel="RFQs"
      />

      {/* 13 KPI Metrics Dashboard Grid */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            RFQ Sourcing Lifecycle Dashboard (Click any metric card to filter records)
          </span>
          {statusFilter !== 'ALL' && (
            <button
              onClick={() => setStatusFilter('ALL')}
              className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Clear status filter ({statusFilter})</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 xl:grid-cols-13 gap-2.5">
          {/* 1. Total RFQs */}
          <div
            onClick={() => setStatusFilter('ALL')}
            className={`p-3 border rounded-xl shadow-xs cursor-pointer transition ${
              statusFilter === 'ALL'
                ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-400'
                : 'bg-white border-slate-200 hover:border-indigo-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-500 uppercase truncate">Total RFQs</span>
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="text-base font-extrabold text-indigo-950 mt-1">{kpiMetrics.total}</div>
            <div className="text-[9px] text-slate-400 truncate mt-0.5">All Pipeline</div>
          </div>

          {/* 2. Draft */}
          <div
            onClick={() => setStatusFilter('DRAFT')}
            className={`p-3 border rounded-xl shadow-xs cursor-pointer transition ${
              statusFilter === 'DRAFT'
                ? 'bg-slate-100 border-slate-600 ring-2 ring-slate-400'
                : 'bg-white border-slate-200 hover:border-slate-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-500 uppercase truncate">Draft RFQs</span>
              <FileText className="w-3.5 h-3.5 text-slate-600" />
            </div>
            <div className="text-base font-extrabold text-slate-900 mt-1">{kpiMetrics.draft}</div>
            <div className="text-[9px] text-slate-400 truncate mt-0.5">Initial Setup</div>
          </div>

          {/* 3. Pending Approval */}
          <div
            onClick={() => setStatusFilter('PENDING_RELEASE_APPROVAL')}
            className={`p-3 border rounded-xl shadow-xs cursor-pointer transition ${
              statusFilter === 'PENDING_RELEASE_APPROVAL'
                ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400'
                : 'bg-white border-slate-200 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-amber-800 uppercase truncate">Pending Appr.</span>
              <Clock className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-base font-extrabold text-amber-950 mt-1">{kpiMetrics.pendingApproval}</div>
            <div className="text-[9px] text-amber-700/80 truncate mt-0.5">Manager Gate</div>
          </div>

          {/* 4. Approved Ready */}
          <div
            onClick={() => setStatusFilter('TECHNICAL_GATE_APPROVED')}
            className={`p-3 border rounded-xl shadow-xs cursor-pointer transition ${
              statusFilter === 'TECHNICAL_GATE_APPROVED'
                ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-400'
                : 'bg-white border-slate-200 hover:border-indigo-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-indigo-700 uppercase truncate">Ready Release</span>
              <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="text-base font-extrabold text-indigo-950 mt-1">{kpiMetrics.approvedReady}</div>
            <div className="text-[9px] text-indigo-700/80 truncate mt-0.5">Gate Passed</div>
          </div>

          {/* 5. Released */}
          <div
            onClick={() => setStatusFilter('RELEASED')}
            className={`p-3 border rounded-xl shadow-xs cursor-pointer transition ${
              statusFilter === 'RELEASED'
                ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-400'
                : 'bg-white border-slate-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-blue-700 uppercase truncate">Released</span>
              <Send className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-base font-extrabold text-blue-950 mt-1">{kpiMetrics.released}</div>
            <div className="text-[9px] text-blue-700/80 truncate mt-0.5">To Suppliers</div>
          </div>

          {/* 6. Awaiting Quotes */}
          <div
            onClick={() => setStatusFilter('KPI_AWAITING_QUOTES')}
            className={`p-3 border rounded-xl shadow-xs cursor-pointer transition ${
              statusFilter === 'KPI_AWAITING_QUOTES'
                ? 'bg-cyan-50 border-cyan-500 ring-2 ring-cyan-400'
                : 'bg-white border-slate-200 hover:border-cyan-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-cyan-800 uppercase truncate">Awaiting Qts</span>
              <Users className="w-3.5 h-3.5 text-cyan-600" />
            </div>
            <div className="text-base font-extrabold text-cyan-950 mt-1">{kpiMetrics.awaitingQuotes}</div>
            <div className="text-[9px] text-cyan-700/80 truncate mt-0.5">Zero Bids</div>
          </div>

          {/* 7. Quotes Received */}
          <div
            onClick={() => setStatusFilter('KPI_QUOTES_RECEIVED')}
            className={`p-3 border rounded-xl shadow-xs cursor-pointer transition ${
              statusFilter === 'KPI_QUOTES_RECEIVED'
                ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400'
                : 'bg-white border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-emerald-800 uppercase truncate">Quotes Recv.</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-base font-extrabold text-emerald-950 mt-1">{kpiMetrics.quotesReceived}</div>
            <div className="text-[9px] text-emerald-700/80 truncate mt-0.5">1+ Submissions</div>
          </div>

          {/* 8. Tech Eval Pending */}
          <div
            onClick={() => setStatusFilter('UNDER_TECHNICAL_EVALUATION')}
            className={`p-3 border rounded-xl shadow-xs cursor-pointer transition ${
              statusFilter === 'UNDER_TECHNICAL_EVALUATION'
                ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-400'
                : 'bg-white border-slate-200 hover:border-purple-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-purple-800 uppercase truncate">Tech Eval</span>
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div className="text-base font-extrabold text-purple-950 mt-1">{kpiMetrics.techEvalPending}</div>
            <div className="text-[9px] text-purple-700/80 truncate mt-0.5">Specs Audit</div>
          </div>

          {/* 9. Comm Eval Pending */}
          <div
            onClick={() => setStatusFilter('KPI_COMM_EVAL')}
            className={`p-3 border rounded-xl shadow-xs cursor-pointer transition ${
              statusFilter === 'KPI_COMM_EVAL'
                ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-500'
                : 'bg-white border-slate-200 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-amber-900 uppercase truncate">Comm Eval</span>
              <BarChart2 className="w-3.5 h-3.5 text-amber-700" />
            </div>
            <div className="text-base font-extrabold text-amber-950 mt-1">{kpiMetrics.commEvalPending}</div>
            <div className="text-[9px] text-amber-800/80 truncate mt-0.5">CS Matrix</div>
          </div>

          {/* 10. Under Negotiation */}
          <div
            onClick={() => setStatusFilter('UNDER_NEGOTIATION')}
            className={`p-3 border rounded-xl shadow-xs cursor-pointer transition ${
              statusFilter === 'UNDER_NEGOTIATION'
                ? 'bg-orange-50 border-orange-500 ring-2 ring-orange-400'
                : 'bg-white border-slate-200 hover:border-orange-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-orange-800 uppercase truncate">Negotiation</span>
              <Scale className="w-3.5 h-3.5 text-orange-600" />
            </div>
            <div className="text-base font-extrabold text-orange-950 mt-1">{kpiMetrics.underNegotiation}</div>
            <div className="text-[9px] text-orange-700/80 truncate mt-0.5">Price & Lead Time</div>
          </div>

          {/* 11. Awarded */}
          <div
            onClick={() => setStatusFilter('AWARDED')}
            className={`p-3 border rounded-xl shadow-xs cursor-pointer transition ${
              statusFilter === 'AWARDED'
                ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500'
                : 'bg-white border-slate-200 hover:border-emerald-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-emerald-800 uppercase truncate">Awarded</span>
              <Award className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-base font-extrabold text-emerald-950 mt-1">{kpiMetrics.awarded}</div>
            <div className="text-[9px] text-emerald-700/80 truncate mt-0.5">100% Volume</div>
          </div>

          {/* 12. Partially Awarded */}
          <div
            onClick={() => setStatusFilter('PARTIALLY_AWARDED')}
            className={`p-3 border rounded-xl shadow-xs cursor-pointer transition ${
              statusFilter === 'PARTIALLY_AWARDED'
                ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-400'
                : 'bg-white border-slate-200 hover:border-teal-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-teal-800 uppercase truncate">Split Award</span>
              <Divide className="w-3.5 h-3.5 text-teal-600" />
            </div>
            <div className="text-base font-extrabold text-teal-950 mt-1">{kpiMetrics.partiallyAwarded}</div>
            <div className="text-[9px] text-teal-700/80 truncate mt-0.5">60 / 40 Dual Sourced</div>
          </div>

          {/* 13. Closed & Cancelled */}
          <div
            onClick={() => setStatusFilter('KPI_CLOSED_CANCELLED')}
            className={`p-3 border rounded-xl shadow-xs cursor-pointer transition ${
              statusFilter === 'KPI_CLOSED_CANCELLED'
                ? 'bg-red-50 border-red-500 ring-2 ring-red-400'
                : 'bg-white border-slate-200 hover:border-red-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-700 uppercase truncate">Closed / Canc.</span>
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            </div>
            <div className="text-base font-extrabold text-slate-900 mt-1">{kpiMetrics.closedCancelled}</div>
            <div className="text-[9px] text-slate-400 truncate mt-0.5">Archived / Reversed</div>
          </div>
        </div>
      </div>

      {/* Collapsible Live Web Market Price Discovery Engine Panel */}
      {showDiscoveryEngine && (
        <div className="bg-white border border-amber-200 rounded-xl p-5 shadow-xs space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-amber-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Web-Based Market Price Discovery Engine (PR-to-RFQ Live Intelligence)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect genuine vendor market prices scraped and normalized to approved Purchase UOMs for RFQ benchmark gating.
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
                <option value="RMPAOPOEXLG0001">RMPAOPOEXLG0001 — PC-ABS Injection Grade V0 Light Grey Powder</option>
                <option value="PMMTSS304L0002">PMMTSS304L0002 — SS 304L Cold Rolled Sheets 2mm 2B Finish</option>
                <option value="PKG-CORR-BOX-01">PKG-CORR-BOX-01 — Heavy Duty 5-Ply Corrugated Shipping Box</option>
              </select>
            </div>

            <button
              onClick={() => handleRunLiveBenchmark(benchmarkSearchItemCode)}
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

      {/* Search, Filter & Bulk Actions Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search RFQ #, Title, PR #, Item Code, Supplier..."
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
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
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
              <option value="ALL">All RFQ Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_RELEASE_APPROVAL">Pending Release Approval</option>
              <option value="RELEASED">Released to Suppliers</option>
              <option value="QUOTATIONS_IN_PROGRESS">Quotations in Progress</option>
              <option value="UNDER_TECHNICAL_EVALUATION">Under Technical Evaluation</option>
              <option value="TECHNICAL_GATE_APPROVED">Technical Gate Approved</option>
              <option value="UNDER_COMMERCIAL_EVALUATION">Under Commercial Evaluation</option>
              <option value="COMPARATIVE_STATEMENT_GENERATED">Comparative Statement Generated</option>
              <option value="UNDER_NEGOTIATION">Under Negotiation</option>
              <option value="AWARD_RECOMMENDED">Award Recommended</option>
              <option value="AWARDED">Awarded (100%)</option>
              <option value="PARTIALLY_AWARDED">Partially Awarded (Split 60/40)</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <select
              value={quotationFilter}
              onChange={(e) => setQuotationFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
            >
              <option value="ALL">Quotation Submissions</option>
              <option value="NO_QUOTES">Awaiting Quotes (0 Bids)</option>
              <option value="HAS_QUOTES">Quotes Received (1+ Bids)</option>
              <option value="QUOTES_CLOSED">Bidding Window Closed</option>
            </select>
          </div>

          <div>
            <select
              value={evaluationFilter}
              onChange={(e) => setEvaluationFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
            >
              <option value="ALL">Evaluation Stage</option>
              <option value="TECH_PENDING">Tech Evaluation Pending</option>
              <option value="TECH_APPROVED">Tech Approved Gate</option>
              <option value="COMM_PENDING">Commercial Eval Pending</option>
              <option value="EVALUATED">Award & Negotiation</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExpandAll}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition cursor-pointer"
            >
              Expand All ({filteredRfqs.length})
            </button>
            <button
              onClick={handleCollapseAll}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition cursor-pointer"
            >
              Collapse All
            </button>
            <span className="text-[11px] text-slate-400">
              Showing <strong>{filteredRfqs.length}</strong> of <strong>{fyScopedRfqs.length}</strong> RFQs
            </span>
          </div>

          <div className="flex items-center gap-2">
            {(searchQuery ||
              companyFilter !== 'ALL' ||
              branchFilter !== 'ALL' ||
              statusFilter !== 'ALL' ||
              quotationFilter !== 'ALL' ||
              evaluationFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCompanyFilter('ALL');
                  setBranchFilter('ALL');
                  setStatusFilter('ALL');
                  setQuotationFilter('ALL');
                  setEvaluationFilter('ALL');
                }}
                className="text-[11px] font-bold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* UNIFIED EXPANDABLE RFQ DIRECTORY TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B192C] text-white font-bold tracking-wider">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    onChange={handleToggleSelectAll}
                    checked={
                      rfqGrid.pagedData.length > 0 &&
                      rfqGrid.pagedData.every((r) => selectedRfqIds.includes(r.id))
                    }
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="p-3 w-8"></th>
                <th className="p-3">RFQ Number & Title</th>
                <th className="p-3">Contributing PRs</th>
                <th className="p-3">Company & Branch</th>
                <th className="p-3">Item Code & Lines</th>
                <th className="p-3 text-right">RFQ Quantity</th>
                <th className="p-3 text-center">Invited / Quotes</th>
                <th className="p-3 text-left">Lowest Market Price</th>
                <th className="p-3">Supplier Preference</th>
                <th className="p-3 text-right">Price Variance</th>
                <th className="p-3 text-center">Tech & Comm</th>
                <th className="p-3 text-center">AI Examiner</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3">Deadline</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {rfqGrid.pagedData.length === 0 ? (
                <tr>
                  <td colSpan={16} className="p-8 text-center text-slate-400">
                    No RFQ records found matching the active search or filter criteria.
                  </td>
                </tr>
              ) : (
                rfqGrid.pagedData.map((rfq) => {
                  const isExpanded = expandedRfqIds.includes(rfq.id);
                  const rfqQuotations = getQuotationsForRfq(rfq.id);
                  const examinerRun = getExaminerRunForRfq(rfq.id);
                  const primaryLine = rfq.lines[0];
                  const primaryItemCode = primaryLine?.itemCode || 'RMPAOPOEXLG0001';
                  const benchmark = marketBenchmarkService.getBenchmarkForItem(
                    primaryItemCode,
                    primaryLine?.description
                  );
                  const bestMarketOffer = benchmark.l1Supplier || benchmark.offers[0];

                  // Calculate total quantities
                  const totalPurchQty = rfq.lines.reduce((acc, l) => acc + l.quantityPurchUom, 0);
                  const totalInvQty = rfq.lines.reduce(
                    (acc, l) => acc + l.quantityPurchUom * l.conversionRatio,
                    0
                  );

                  // Quoted price comparison calculation
                  let lowestQuotedPrice: number | null = null;
                  rfqQuotations.forEach((q) => {
                    q.lines.forEach((ql) => {
                      if (lowestQuotedPrice === null || ql.landedUnitPricePurchUom < lowestQuotedPrice) {
                        lowestQuotedPrice = ql.landedUnitPricePurchUom;
                      }
                    });
                  });

                  const priceVariancePct =
                    lowestQuotedPrice !== null && benchmark.lowestLandedPrice > 0
                      ? Math.round(
                          ((lowestQuotedPrice - benchmark.lowestLandedPrice) / benchmark.lowestLandedPrice) * 100
                        )
                      : null;

                  return (
                    <React.Fragment key={rfq.id}>
                      {/* MAIN CONSOLIDATED RFQ ROW */}
                      <tr
                        className={`hover:bg-indigo-50/30 transition ${
                          rfq.status === 'CANCELLED' ? 'bg-red-50/40 text-slate-400' : ''
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRfqIds.includes(rfq.id)}
                            onChange={() => handleToggleSelectRfq(rfq.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>

                        <td className="p-3 text-center">
                          <button
                            onClick={() => toggleRfqExpand(rfq.id)}
                            className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                            title={isExpanded ? 'Collapse Details' : 'Expand RFQ Sourcing Details'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* RFQ Number & Title */}
                        <td className="p-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="text-indigo-600 hover:underline cursor-pointer" onClick={() => toggleRfqExpand(rfq.id)}>
                              {rfq.rfqNumber}
                            </span>
                            {rfq.evaluationMethod === 'TWO_STAGE' && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                                2-Stage
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-xs" title={rfq.title}>
                            {rfq.title}
                          </div>
                        </td>

                        {/* Contributing PR References */}
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1 max-w-[140px]">
                            {rfq.prReferences.length > 0 ? (
                              rfq.prReferences.map((pr) => (
                                <span
                                  key={pr}
                                  className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200"
                                >
                                  {pr}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Direct Floating</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {rfq.lines.length} Line Allocation{rfq.lines.length > 1 ? 's' : ''}
                          </div>
                        </td>

                        {/* Company & Branch */}
                        <td className="p-3">
                          <div className="font-semibold text-slate-800">{rfq.companyCode}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                            {rfq.branchName}
                          </div>
                        </td>

                        {/* Item Code & Lines */}
                        <td className="p-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1">
                            <span>{primaryItemCode}</span>
                            {rfq.lines.length > 1 && (
                              <span className="px-1 bg-slate-100 text-slate-600 rounded text-[9px] font-bold">
                                +{rfq.lines.length - 1} more
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[160px]">
                            {primaryLine?.description || 'Item Description'}
                          </div>
                        </td>

                        {/* RFQ Quantity */}
                        <td className="p-3 text-right">
                          <div className="font-bold text-indigo-900">
                            {totalPurchQty.toLocaleString()} {primaryLine?.purchaseUom || 'BAG'}
                          </div>
                          <div className="text-[10px] text-emerald-700">
                            ({totalInvQty.toLocaleString()} {primaryLine?.inventoryUom || 'KG'})
                          </div>
                        </td>

                        {/* Invited vs Quotes Received */}
                        <td className="p-3 text-center">
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                            <Users className="w-3 h-3 text-indigo-600" />
                            <span>
                              {rfqQuotations.length} / {rfq.invitations.length} Bids
                            </span>
                          </div>
                        </td>

                        {/* Lowest Market Benchmark Price */}
                        <td className="p-3">
                          <button
                            onClick={() => handleOpenBenchmarkForItem(primaryItemCode, primaryLine?.description)}
                            className="text-left group/price cursor-pointer"
                            title="Inspect live web market benchmark & verified vendor offers"
                          >
                            <div className="font-bold text-emerald-700 group-hover/price:text-indigo-600 transition flex items-center gap-1.5">
                              <span>
                                ₹{benchmark.lowestLandedPrice.toLocaleString()} / {primaryLine?.purchaseUom || 'BAG'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                              {bestMarketOffer?.vendorName.split('(')[0] || 'Market Verified'}
                            </div>
                          </button>
                        </td>

                        {/* Supplier Preference Tiers (L1/L2/L3) */}
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300"
                              title={`L1: ${benchmark.l1Supplier?.vendorName || 'BASF India'}`}
                            >
                              L1
                            </span>
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-100 text-blue-900"
                              title={`L2: ${benchmark.l2Supplier?.vendorName || 'Polymer Solutions'}`}
                            >
                              L2
                            </span>
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-slate-100 text-slate-700"
                              title={`L3: ${benchmark.l3Supplier?.vendorName || 'National Polymers'}`}
                            >
                              L3
                            </span>
                          </div>
                        </td>

                        {/* Quoted Price Comparison */}
                        <td className="p-3 text-right">
                          {lowestQuotedPrice !== null ? (
                            <div>
                              <div className="font-bold text-slate-900">
                                ₹{Number(lowestQuotedPrice).toLocaleString()}
                              </div>
                              <div
                                className={`text-[10px] font-bold ${
                                  priceVariancePct !== null && priceVariancePct <= 0
                                    ? 'text-emerald-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {priceVariancePct !== null
                                  ? `${priceVariancePct > 0 ? '+' : ''}${priceVariancePct}% vs Bmk`
                                  : 'On Target'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No Quotes Yet</span>
                          )}
                        </td>

                        {/* Technical & Commercial Gate Status */}
                        <td className="p-3 text-center">
                          <div className="space-y-0.5">
                            <span
                              className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                                rfq.status === 'UNDER_TECHNICAL_EVALUATION'
                                  ? 'bg-purple-100 text-purple-800'
                                  : ['TECHNICAL_GATE_APPROVED', 'UNDER_COMMERCIAL_EVALUATION', 'AWARDED', 'PARTIALLY_AWARDED'].includes(
                                      rfq.status
                                    )
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              Tech:{' '}
                              {rfq.status === 'UNDER_TECHNICAL_EVALUATION'
                                ? 'Review'
                                : ['TECHNICAL_GATE_APPROVED', 'UNDER_COMMERCIAL_EVALUATION', 'AWARDED', 'PARTIALLY_AWARDED'].includes(
                                    rfq.status
                                  )
                                ? 'Pass'
                                : 'Pending'}
                            </span>
                            <br />
                            <span
                              className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                                ['AWARDED', 'PARTIALLY_AWARDED', 'AWARD_RECOMMENDED'].includes(rfq.status)
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ['UNDER_COMMERCIAL_EVALUATION', 'COMPARATIVE_STATEMENT_GENERATED'].includes(
                                      rfq.status
                                    )
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              Comm:{' '}
                              {['AWARDED', 'PARTIALLY_AWARDED', 'AWARD_RECOMMENDED'].includes(rfq.status)
                                ? 'Evaluated'
                                : ['UNDER_COMMERCIAL_EVALUATION', 'COMPARATIVE_STATEMENT_GENERATED'].includes(
                                    rfq.status
                                  )
                                ? 'Active'
                                : 'Sealed'}
                            </span>
                          </div>
                        </td>

                        {/* AI Examiner Status */}
                        <td className="p-3 text-center">
                          {examinerRun ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                examinerRun.overallStatus === 'PASS'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : examinerRun.overallStatus === 'PASS_WITH_WARNINGS'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-red-100 text-red-800 border border-red-300'
                              }`}
                              title={`AI Examiner Findings: ${examinerRun.findings.length}`}
                            >
                              {examinerRun.overallStatus === 'PASS'
                                ? 'AUDIT PASS'
                                : examinerRun.overallStatus === 'PASS_WITH_WARNINGS'
                                ? 'WARNINGS'
                                : 'FLAGGED'}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleRunExaminer(rfq.id)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 transition cursor-pointer"
                              title="Click to run instant AI Examiner audit"
                            >
                              Run Audit
                            </button>
                          )}
                        </td>

                        {/* Status */}
                        <td className="p-3 text-center">{getStatusBadge(rfq.status)}</td>

                        {/* Deadline */}
                        <td className="p-3">
                          <div className="font-semibold text-slate-800 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{rfq.responseDeadline}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Validity: {rfq.quotationValidityDays} Days
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => toggleRfqExpand(rfq.id)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded transition cursor-pointer"
                            >
                              {isExpanded ? 'Hide' : 'Details'}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* EXPANDED DETAILED RFQ SOURCING CONSOLE */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={16} className="p-0 bg-slate-50/80 border-b border-indigo-100">
                            <div className="p-4 pl-10 space-y-4">
                              {/* Quick Action Ribbon */}
                              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-700">RFQ Lifecycle Actions:</span>
                                  <span className="text-xs text-slate-400">({rfq.rfqNumber})</span>
                                  {rfq.financialYearCode && (
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                                      {rfq.financialYearCode}
                                    </span>
                                  )}
                                </div>

                                {(() => {
                                  const rfqMutGuard = financialYearService.evaluateHistoricalRecordMutationGuard({
                                    companyId: rfq.companyId,
                                    documentDate: rfq.rfqDate,
                                    financialYearId: rfq.financialYearId,
                                    actionLabel: 'MUTATE_RFQ',
                                  });
                                  const lockMutations = isHistoricalReadOnly || !rfqMutGuard.allowed;
                                  return (
                                    <div className="flex flex-wrap items-center gap-2">
                                      {lockMutations && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold">
                                          <Lock className="w-3 h-3 text-amber-700" />
                                          Closed FY Read-Only
                                        </span>
                                      )}
                                      {rfq.status === 'DRAFT' && (
                                        <button
                                          disabled={lockMutations}
                                          onClick={() => handleSubmitForApproval(rfq)}
                                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          <Send className="w-3.5 h-3.5" />
                                          <span>Submit for Approval</span>
                                        </button>
                                      )}

                                      {rfq.status === 'PENDING_RELEASE_APPROVAL' && (
                                        <>
                                          <button
                                            disabled={lockMutations}
                                            onClick={() => handleApproveRfq(rfq)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                          >
                                            <CheckCircle className="w-3.5 h-3.5" />
                                            <span>Approve RFQ</span>
                                          </button>
                                          <button
                                            disabled={lockMutations}
                                            onClick={() => {
                                              rfqService.returnRfq(rfq.id);
                                              reloadData();
                                            }}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                          >
                                            <span>Return to Draft</span>
                                          </button>
                                        </>
                                      )}

                                      {rfq.status === 'RELEASED' && (
                                        <button
                                          disabled={lockMutations}
                                          onClick={() => handleReleaseToSuppliers(rfq)}
                                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          <Send className="w-3.5 h-3.5" />
                                          <span>Open Quotation Submission Window</span>
                                        </button>
                                      )}

                                      {/* Invite Supplier Action */}
                                      <button
                                        disabled={lockMutations}
                                        onClick={() => setInviteModalRfq(rfq)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>+ Invite Supplier</span>
                                      </button>

                                      {/* Record Quotation Action */}
                                      <button
                                        disabled={lockMutations}
                                        onClick={() => setQuoteModalRfq(rfq)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>+ Record Supplier Quotation</span>
                                      </button>

                                      {/* Extend Deadline */}
                                      <button
                                        disabled={lockMutations}
                                        onClick={() => {
                                          setExtendDeadlineRfq(rfq);
                                          setNewDeadlineDate(rfq.responseDeadline);
                                        }}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                                        <span>Extend Deadline</span>
                                      </button>

                                      {/* Run AI Examiner */}
                                      <button
                                        onClick={() => handleRunExaminer(rfq.id)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-lg text-xs font-bold transition cursor-pointer"
                                      >
                                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                        <span>Run AI Examiner</span>
                                      </button>

                                      {/* Start Negotiation */}
                                      {['TECHNICAL_GATE_APPROVED', 'UNDER_COMMERCIAL_EVALUATION', 'COMPARATIVE_STATEMENT_GENERATED'].includes(
                                        rfq.status
                                      ) && (
                                        <button
                                          disabled={lockMutations}
                                          onClick={() => handleStartNegotiation(rfq)}
                                          className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          <Scale className="w-3.5 h-3.5 text-orange-600" />
                                          <span>Start Negotiation</span>
                                        </button>
                                      )}

                                      {/* Award RFQ */}
                                      {['UNDER_COMMERCIAL_EVALUATION', 'COMPARATIVE_STATEMENT_GENERATED', 'UNDER_NEGOTIATION', 'AWARD_RECOMMENDED'].includes(
                                        rfq.status
                                      ) && (
                                        <button
                                          disabled={lockMutations}
                                          onClick={() => {
                                            setAwardModalRfq(rfq);
                                            setAwardWinningVendor(
                                              rfqQuotations[0]?.vendorName || 'BASF INDIA LIMITED'
                                            );
                                          }}
                                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          <Award className="w-3.5 h-3.5" />
                                          <span>Award RFQ (Full / Split)</span>
                                        </button>
                                      )}

                                      {/* View Conversion History */}
                                      <button
                                        onClick={() => setHistoryModalRfq(rfq)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                                      >
                                        <History className="w-3.5 h-3.5 text-slate-500" />
                                        <span>PR Audit History</span>
                                      </button>

                                      {/* Cancel RFQ */}
                                      {rfq.status !== 'CANCELLED' && rfq.status !== 'CLOSED' && (
                                        <button
                                          disabled={lockMutations}
                                          onClick={() => setCancelModalRfq(rfq)}
                                          className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                                          <span>Cancel RFQ</span>
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* SECTION 1: Market Intelligence & Preference Tiers Card */}
                              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                  <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-amber-600" />
                                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                      Market Intelligence & Price Benchmark ({primaryItemCode})
                                    </h4>
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-3">
                                    <span>
                                      Last Discovery: <strong>{new Date(benchmark.searchedAt).toLocaleDateString()}</strong>
                                    </span>
                                    <span>
                                      Comparable Offers: <strong className="text-indigo-600">{benchmark.sampleSize}</strong>
                                    </span>
                                    <button
                                      onClick={() => handleOpenBenchmarkForItem(primaryItemCode, primaryLine?.description)}
                                      className="text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                      <span>Inspect Full Benchmark</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5">
                                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                                      Lowest Landed Price
                                    </span>
                                    <strong className="text-emerald-950 font-extrabold text-sm">
                                      ₹{benchmark.lowestLandedPrice.toLocaleString()}
                                    </strong>
                                    <span className="text-[10px] text-emerald-700 block">
                                      / {primaryLine?.purchaseUom || 'BAG'}
                                    </span>
                                  </div>

                                  <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-2.5">
                                    <span className="text-[10px] font-bold text-indigo-800 uppercase block">
                                      Recommended Median
                                    </span>
                                    <strong className="text-indigo-950 font-extrabold text-sm">
                                      ₹{benchmark.medianPrice.toLocaleString()}
                                    </strong>
                                    <span className="text-[10px] text-indigo-700 block">Negotiation Baseline</span>
                                  </div>

                                  <div className="bg-amber-50/80 border border-amber-300 rounded-lg p-2.5">
                                    <span className="text-[10px] font-bold text-amber-900 uppercase flex items-center gap-1">
                                      <span className="px-1 bg-amber-200 text-amber-950 rounded font-black text-[9px]">L1</span>
                                      <span>Preferred Vendor</span>
                                    </span>
                                    <strong
                                      className="text-amber-950 font-bold block truncate mt-0.5"
                                      title={benchmark.l1Supplier?.vendorName}
                                    >
                                      {benchmark.l1Supplier?.vendorName.split('(')[0] || 'BASF India'}
                                    </strong>
                                    <span className="text-[10px] text-amber-800">
                                      ₹{benchmark.l1Supplier?.normalizedPricePurchUom.toLocaleString()} / {primaryLine?.purchaseUom}
                                    </span>
                                  </div>

                                  <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2.5">
                                    <span className="text-[10px] font-bold text-blue-900 uppercase flex items-center gap-1">
                                      <span className="px-1 bg-blue-200 text-blue-950 rounded font-black text-[9px]">L2</span>
                                      <span>Secondary Vendor</span>
                                    </span>
                                    <strong
                                      className="text-blue-950 font-bold block truncate mt-0.5"
                                      title={benchmark.l2Supplier?.vendorName}
                                    >
                                      {benchmark.l2Supplier?.vendorName.split('(')[0] || 'Polymer Solutions'}
                                    </strong>
                                    <span className="text-[10px] text-blue-800">
                                      ₹{benchmark.l2Supplier?.normalizedPricePurchUom.toLocaleString()} / {primaryLine?.purchaseUom}
                                    </span>
                                  </div>

                                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                                    <span className="text-[10px] font-bold text-slate-700 uppercase flex items-center gap-1">
                                      <span className="px-1 bg-slate-200 text-slate-800 rounded font-black text-[9px]">L3</span>
                                      <span>Tertiary Vendor</span>
                                    </span>
                                    <strong
                                      className="text-slate-900 font-bold block truncate mt-0.5"
                                      title={benchmark.l3Supplier?.vendorName}
                                    >
                                      {benchmark.l3Supplier?.vendorName.split('(')[0] || 'National Polymers'}
                                    </strong>
                                    <span className="text-[10px] text-slate-600">
                                      ₹{benchmark.l3Supplier?.normalizedPricePurchUom.toLocaleString()} / {primaryLine?.purchaseUom}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* SECTION 2: Contributing Purchase Requisitions & Allocated Quantities Matrix */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Contributing Purchase Requisition Lines ({rfq.lines.length} Line References)</span>
                                  </h4>
                                  <span className="text-[11px] text-slate-400">
                                    Traceable PR-to-RFQ allocation balances
                                  </span>
                                </div>

                                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 text-slate-700 font-bold">
                                      <tr>
                                        <th className="p-2">PR Number</th>
                                        <th className="p-2">PR Line ID</th>
                                        <th className="p-2">Item Code</th>
                                        <th className="p-2">Specifications & Requirement</th>
                                        <th className="p-2 text-right">Allocated Qty (Purch UOM)</th>
                                        <th className="p-2 text-right">Allocated Qty (Inv UOM)</th>
                                        <th className="p-2">Required Delivery</th>
                                        <th className="p-2">Target Warehouse</th>
                                        <th className="p-2 text-center">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                      {rfq.lines.map((l) => (
                                        <tr key={l.id} className="hover:bg-slate-50">
                                          <td className="p-2 font-bold text-indigo-700">{l.prNumber}</td>
                                          <td className="p-2 text-slate-500 font-mono text-[11px]">{l.prLineId}</td>
                                          <td className="p-2 font-bold text-slate-900">{l.itemCode}</td>
                                          <td className="p-2 text-[11px] text-slate-600 max-w-sm truncate">
                                            {l.specifications || l.description}
                                          </td>
                                          <td className="p-2 text-right font-bold text-indigo-950">
                                            {l.quantityPurchUom} {l.purchaseUom}
                                          </td>
                                          <td className="p-2 text-right text-emerald-700 font-semibold">
                                            {(l.quantityPurchUom * l.conversionRatio).toLocaleString()} {l.inventoryUom}
                                          </td>
                                          <td className="p-2 text-slate-600">{l.requiredDeliveryDate}</td>
                                          <td className="p-2 text-slate-600">{l.targetWarehouse}</td>
                                          <td className="p-2 text-center">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                              ALLOCATED
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* SECTION 3: Supplier Invitations & Quotations Submissions */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>
                                      Supplier Invitations & Submitted Quotations ({rfq.invitations.length} Invited,{' '}
                                      {rfqQuotations.length} Received)
                                    </span>
                                  </h4>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => setInviteModalRfq(rfq)}
                                      className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Invite Another Supplier</span>
                                    </button>
                                  </div>
                                </div>

                                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 text-slate-700 font-bold">
                                      <tr>
                                        <th className="p-2">Supplier / Vendor</th>
                                        <th className="p-2">Contact Email</th>
                                        <th className="p-2">Invitation Status</th>
                                        <th className="p-2">Quotation #</th>
                                        <th className="p-2 text-right">Quoted Unit Price</th>
                                        <th className="p-2 text-right">Landed Unit Price</th>
                                        <th className="p-2 text-right">Total Net Quoted</th>
                                        <th className="p-2 text-center">Lead Time</th>
                                        <th className="p-2 text-center">Tech Compliance</th>
                                        <th className="p-2 text-center">Commercial Seal</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                      {rfq.invitations.map((inv) => {
                                        const quot = rfqQuotations.find((q) => q.vendorId === inv.vendorId);
                                        const qLine = quot?.lines[0];

                                        return (
                                          <tr key={inv.id} className="hover:bg-slate-50">
                                            <td className="p-2">
                                              <div className="font-bold text-slate-900">{inv.vendorName}</div>
                                              <div className="text-[10px] text-slate-400 font-mono">{inv.vendorCode}</div>
                                            </td>
                                            <td className="p-2 text-slate-600">{inv.contactEmail}</td>
                                            <td className="p-2">
                                              <span
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                  quot
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : inv.invitationStatus === 'INVITED'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-slate-100 text-slate-700'
                                                }`}
                                              >
                                                {quot ? 'SUBMITTED' : inv.invitationStatus}
                                              </span>
                                            </td>
                                            <td className="p-2 text-slate-700 font-mono">
                                              {quot ? quot.quotationNumber : '—'}
                                            </td>
                                            <td className="p-2 text-right font-bold text-slate-900">
                                              {qLine ? `₹${qLine.unitPricePurchUom.toLocaleString()}` : '—'}
                                            </td>
                                            <td className="p-2 text-right font-bold text-emerald-700">
                                              {qLine ? `₹${qLine.landedUnitPricePurchUom.toLocaleString()}` : '—'}
                                            </td>
                                            <td className="p-2 text-right font-bold text-indigo-950">
                                              {quot ? `₹${quot.totalQuotedValue.toLocaleString()}` : '—'}
                                            </td>
                                            <td className="p-2 text-center">
                                              {qLine ? `${qLine.deliveryLeadTimeDays} Days` : '—'}
                                            </td>
                                            <td className="p-2 text-center">
                                              {qLine ? (
                                                <span
                                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    qLine.technicalCompliance === 'COMPLIANT'
                                                      ? 'bg-emerald-100 text-emerald-800'
                                                      : 'bg-amber-100 text-amber-800'
                                                  }`}
                                                >
                                                  {qLine.technicalCompliance}
                                                </span>
                                              ) : (
                                                '—'
                                              )}
                                            </td>
                                            <td className="p-2 text-center">
                                              {quot?.isSealed ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                  <Lock className="w-3 h-3 text-amber-600" />
                                                  <span>SEALED</span>
                                                </span>
                                              ) : (
                                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                  UNSEALED
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* SECTION 4: AI RFQ Examiner Findings & Risk Verification */}
                              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-purple-600" />
                                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                      AI Examiner Audit Findings & Risk Verification
                                    </h4>
                                  </div>
                                  <button
                                    onClick={() => handleRunExaminer(rfq.id)}
                                    className="flex items-center gap-1 text-xs font-bold text-purple-700 hover:underline cursor-pointer"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Rerun AI Audit</span>
                                  </button>
                                </div>

                                {examinerRun ? (
                                  <div className="space-y-3">
                                    <div className="flex flex-wrap items-center gap-4 text-xs">
                                      <span>
                                        Executed: <strong>{new Date(examinerRun.executedAt).toLocaleString()}</strong>
                                      </span>
                                      <span>
                                        Audited By: <strong>{examinerRun.executedBy}</strong>
                                      </span>
                                      <span>
                                        Model: <strong>{examinerRun.modelUsed}</strong>
                                      </span>
                                      <span>
                                        Total Findings:{' '}
                                        <strong className="text-purple-700">{examinerRun.findings.length}</strong>
                                      </span>
                                    </div>

                                    {examinerRun.findings.length > 0 ? (
                                      <div className="space-y-2">
                                        {examinerRun.findings.map((f) => (
                                          <div
                                            key={f.id}
                                            className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                                              f.severity === 'CRITICAL'
                                                ? 'bg-red-50 border-red-200 text-red-900'
                                                : f.severity === 'HIGH'
                                                ? 'bg-orange-50 border-orange-200 text-orange-900'
                                                : 'bg-amber-50 border-amber-200 text-amber-900'
                                            }`}
                                          >
                                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                            <div className="space-y-1">
                                              <div className="font-bold flex items-center gap-2">
                                                <span>[{f.ruleCategory}]</span>
                                                <span>{f.supplierName}</span>
                                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-white/70">
                                                  {f.severity}
                                                </span>
                                              </div>
                                              <p className="text-[11px] leading-relaxed">{f.explanation}</p>
                                              <div className="text-[10px] text-slate-500">
                                                <strong>Evidence:</strong> {f.evidence} • <strong>Action:</strong>{' '}
                                                {f.recommendedAction}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <span>
                                          All supplier quotations, commercial calculations, delivery lead times, and specifications passed the AI Examiner audit cleanly with zero compliance flags.
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-center py-4 text-slate-400 text-xs">
                                    No examiner audit has been run for this RFQ yet.{' '}
                                    <button
                                      onClick={() => handleRunExaminer(rfq.id)}
                                      className="text-purple-600 font-bold hover:underline ml-1 cursor-pointer"
                                    >
                                      Run AI Audit Now
                                    </button>
                                  </div>
                                )}
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
        currentPage={rfqGrid.currentPage}
        totalPages={rfqGrid.totalPages}
        pageSize={rfqGrid.pageSize}
        totalRecords={rfqGrid.totalRecords}
        onPageChange={rfqGrid.setCurrentPage}
        onPageSizeChange={rfqGrid.setPageSize}
        pageSizeOptions={rfqGrid.pageSizeOptions}
        defaultSortNotice="Sorted newest first (RFQ Date DESC)"
      />

      {/* QUICK BENCHMARK INSPECTION MODAL */}
      {benchmarkModalResult && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-xl p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                    Automated Web-Based Market Price Discovery
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                  Market Benchmark: {benchmarkModalResult.itemCode}
                </h2>
                <p className="text-xs text-slate-500">{benchmarkModalResult.description}</p>
              </div>

              <button
                onClick={() => setBenchmarkModalResult(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Benchmark Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-emerald-800 uppercase block">Lowest Landed Price</span>
                <strong className="text-emerald-950 font-extrabold text-base">
                  ₹{benchmarkModalResult.lowestLandedPrice.toLocaleString()} / {benchmarkModalResult.purchaseUom}
                </strong>
                <span className="text-[10px] text-emerald-700 block mt-0.5">L1 Negotiation Floor</span>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-indigo-800 uppercase block">Recommended Median</span>
                <strong className="text-indigo-950 font-extrabold text-base">
                  ₹{benchmarkModalResult.medianPrice.toLocaleString()} / {benchmarkModalResult.purchaseUom}
                </strong>
                <span className="text-[10px] text-indigo-700 block mt-0.5">Statistical Benchmark</span>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-amber-900 uppercase block">L1 Preferred Vendor</span>
                <strong className="text-amber-950 font-extrabold text-sm block truncate">
                  {benchmarkModalResult.l1Supplier?.vendorName || 'BASF India'}
                </strong>
                <span className="text-[10px] text-amber-800 block mt-0.5">Exact Specification</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-slate-700 uppercase block">Verification Depth</span>
                <strong className="text-slate-900 font-extrabold text-base">
                  {benchmarkModalResult.sampleSize} Vendor Offers
                </strong>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {benchmarkModalResult.exactMatchCount} Exact, {benchmarkModalResult.equivalentMatchCount} Equivalent
                </span>
              </div>
            </div>

            {/* Indicative Disclaimer Notice */}
            <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                DISCLAIMER: These figures represent indicative web discovery benchmarks to guide RFQ budget gating, not formal supplier offers. Formal quotation submissions govern final procurement commitments.
              </span>
            </div>

            {/* Offers Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold">
                  <tr>
                    <th className="p-2.5">Supplier / Vendor</th>
                    <th className="p-2.5">Manufacturer & Model</th>
                    <th className="p-2.5 text-center">Match</th>
                    <th className="p-2.5 text-right">Published Price</th>
                    <th className="p-2.5 text-right">Landed Price (Purch UOM)</th>
                    <th className="p-2.5 text-center">Lead Time</th>
                    <th className="p-2.5 text-center">Preference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {benchmarkModalResult.offers.map((offer) => (
                    <tr key={offer.id} className="hover:bg-slate-50">
                      <td className="p-2.5">
                        <div className="font-bold text-slate-900">{offer.vendorName}</div>
                        <a
                          href={offer.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <span>{offer.websiteUrl.replace('https://', '')}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </td>
                      <td className="p-2.5">
                        <div className="font-semibold text-slate-800">{offer.manufacturer}</div>
                        <div className="text-[10px] text-slate-400">{offer.model}</div>
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            offer.matchClassification === 'EXACT_MATCH'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {offer.matchClassification.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-semibold text-slate-700">
                        ₹{offer.publishedPrice.toLocaleString()} / {offer.quotedUom}
                      </td>
                      <td className="p-2.5 text-right font-bold text-emerald-700">
                        ₹{offer.normalizedPricePurchUom.toLocaleString()} / {benchmarkModalResult.purchaseUom}
                      </td>
                      <td className="p-2.5 text-center">{offer.deliveryLeadTimeDays} Days</td>
                      <td className="p-2.5 text-center">
                        {offer.preferenceLevel && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              offer.preferenceLevel === 'L1'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : offer.preferenceLevel === 'L2'
                                ? 'bg-blue-100 text-blue-900'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {offer.preferenceLevel}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setBenchmarkModalResult(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Close Benchmark
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVITE SUPPLIER MODAL */}
      {inviteModalRfq && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Send Supplier RFQ Invitation</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Invite a registered or approved vendor to submit formal quotations for {inviteModalRfq.rfqNumber}.
                </p>
              </div>
              <button
                onClick={() => setInviteModalRfq(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Registered Business Partner</label>
                <select
                  value={inviteVendorId}
                  onChange={(e) => {
                    setInviteVendorId(e.target.value);
                    const bp = INITIAL_BUSINESS_PARTNERS.find((b) => b.id === e.target.value);
                    if (bp?.email) setInviteCustomEmail(bp.email);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800"
                >
                  <option value="">Select Vendor...</option>
                  {INITIAL_BUSINESS_PARTNERS.map((bp) => (
                    <option key={bp.id} value={bp.id}>
                      {bp.bpName} ({bp.bpCode}) — {bp.city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Vendor Contact Email</label>
                <input
                  type="email"
                  placeholder="vendor.contact@company.com"
                  value={inviteCustomEmail}
                  onChange={(e) => setInviteCustomEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div>
                  <strong>RFQ Deadline:</strong> {inviteModalRfq.responseDeadline}
                </div>
                <div>
                  <strong>Items:</strong> {inviteModalRfq.lines.map((l) => l.itemCode).join(', ')}
                </div>
                <div>
                  <strong>Incoterms:</strong> {inviteModalRfq.incoterms}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setInviteModalRfq(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteInvite}
                disabled={!inviteVendorId && !inviteCustomEmail}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-xs transition cursor-pointer"
              >
                Send RFQ Invitation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMIT / RECORD SUPPLIER QUOTATION MODAL */}
      {quoteModalRfq && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Record Supplier Quotation Submission</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record commercial prices and technical specifications for {quoteModalRfq.rfqNumber}.
                </p>
              </div>
              <button onClick={() => setQuoteModalRfq(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Quoting Vendor</label>
                <select
                  value={quoteVendorId}
                  onChange={(e) => setQuoteVendorId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800"
                >
                  <option value="">Select Vendor...</option>
                  {quoteModalRfq.invitations.map((inv) => (
                    <option key={inv.vendorId} value={inv.vendorId}>
                      {inv.vendorName} ({inv.vendorCode})
                    </option>
                  ))}
                  {INITIAL_BUSINESS_PARTNERS.map((bp) => (
                    <option key={bp.id} value={bp.id}>
                      {bp.bpName} ({bp.bpCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Quoted Unit Price (Ex-Works / Base)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      placeholder="e.g. 215.00"
                      value={quoteUnitPrice || ''}
                      onChange={(e) => setQuoteUnitPrice(Number(e.target.value))}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">GST / Tax Percent (%)</label>
                  <input
                    type="number"
                    value={quoteGstPct}
                    onChange={(e) => setQuoteGstPct(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Total Estimated Freight (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 2500"
                    value={quoteFreight || ''}
                    onChange={(e) => setQuoteFreight(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Delivery Lead Time (Days)</label>
                  <input
                    type="number"
                    value={quoteLeadTime}
                    onChange={(e) => setQuoteLeadTime(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Technical Compliance</label>
                  <select
                    value={quoteTechCompliance}
                    onChange={(e) => setQuoteTechCompliance(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
                  >
                    <option value="COMPLIANT">Fully Compliant (No Deviations)</option>
                    <option value="DEVIATION">Minor Technical Deviation</option>
                    <option value="NON_COMPLIANT">Non-Compliant</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Payment Terms</label>
                  <input
                    type="text"
                    value={quotePaymentTerms}
                    onChange={(e) => setQuotePaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Calculated Landed Unit Price Preview */}
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center justify-between">
                <span className="font-bold text-emerald-900">Estimated Landed Unit Price:</span>
                <strong className="text-emerald-950 font-extrabold text-sm">
                  ₹
                  {(
                    quoteUnitPrice * (1 + quoteGstPct / 100) +
                    (quoteFreight / (quoteModalRfq.lines[0]?.quantityPurchUom || 1))
                  ).toFixed(2)}{' '}
                  / {quoteModalRfq.lines[0]?.purchaseUom || 'BAG'}
                </strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setQuoteModalRfq(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRecordQuote}
                disabled={!quoteVendorId || quoteUnitPrice <= 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-xs transition cursor-pointer"
              >
                Save Supplier Quotation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXTEND DEADLINE MODAL */}
      {extendDeadlineRfq && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>Extend RFQ Quotation Deadline</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update response window for {extendDeadlineRfq.rfqNumber}.
                </p>
              </div>
              <button onClick={() => setExtendDeadlineRfq(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">New Quotation Response Deadline</label>
                <input
                  type="date"
                  value={newDeadlineDate}
                  onChange={(e) => setNewDeadlineDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Justification / Buyer Remark</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Extended upon request from multiple bidders for technical specification alignment."
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setExtendDeadlineRfq(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteExtendDeadline}
                disabled={!newDeadlineDate}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-xs transition cursor-pointer"
              >
                Update Deadline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AWARD RFQ MODAL (Single Award or 60/40 Split Award) */}
      {awardModalRfq && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-600" />
                  <span>Award RFQ & Authorize Purchase Order</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authorize procurement allocation for {awardModalRfq.rfqNumber}.
                </p>
              </div>
              <button onClick={() => setAwardModalRfq(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Award Allocation Strategy</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAwardType('FULL')}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition ${
                      awardType === 'FULL'
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400 text-emerald-950'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="font-bold">100% Single Award</div>
                    <div className="text-[10px] text-slate-500">Sole source to L1 winning bidder</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAwardType('PARTIAL')}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition ${
                      awardType === 'PARTIAL'
                        ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-400 text-teal-950'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="font-bold">Split Award (60 / 40)</div>
                    <div className="text-[10px] text-slate-500">Dual source to L1 (60%) & L2 (40%)</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Primary Winning Supplier (L1 - 60% or 100%)</label>
                <input
                  type="text"
                  value={awardWinningVendor}
                  onChange={(e) => setAwardWinningVendor(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                />
              </div>

              {awardType === 'PARTIAL' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Secondary Supplier (L2 - 40% Volume)</label>
                  <input
                    type="text"
                    placeholder="e.g. Polymer Solutions Pvt Ltd"
                    value={awardSecondaryVendor}
                    onChange={(e) => setAwardSecondaryVendor(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Award Committee Justification Note</label>
                <textarea
                  rows={2}
                  placeholder="e.g. L1 quoted lowest landed cost and achieved 94.5% technical evaluation score. Split award selected to mitigate single-vendor supply chain bottleneck."
                  value={awardJustification}
                  onChange={(e) => setAwardJustification(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setAwardModalRfq(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAward}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs transition cursor-pointer"
              >
                Confirm Award Allocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL RFQ MODAL */}
      {cancelModalRfq && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-red-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span>Cancel RFQ & Reverse PR Allocation</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{cancelModalRfq.rfqNumber}</p>
              </div>
              <button onClick={() => setCancelModalRfq(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs">
                <strong>CRITICAL AUDIT NOTICE:</strong>
                <p className="mt-1 leading-relaxed">
                  Cancelling this RFQ will permanently terminate the sourcing process. All contributing Purchase Requisition quantities ({cancelModalRfq.lines.reduce((acc, l) => acc + l.quantityPurchUom, 0)} {cancelModalRfq.lines[0]?.purchaseUom}) will be automatically reversed and restored to the Future RFQ Floating Demand Pipeline for re-floating.
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Mandatory Cancellation Reason</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Budget cut, PR requirement withdrawn by engineering team."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setCancelModalRfq(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
              >
                Abandon
              </button>
              <button
                onClick={handleExecuteCancel}
                disabled={!cancelReason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-xs transition cursor-pointer"
              >
                Confirm Cancellation & Reverse PRs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PR CONVERSION AUDIT TRAIL MODAL */}
      {historyModalRfq && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  <span>PR-to-RFQ Conversion & Allocation Audit Trail</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Audit records for {historyModalRfq.rfqNumber} ({historyModalRfq.title})
                </p>
              </div>
              <button onClick={() => setHistoryModalRfq(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2.5">PR Reference</th>
                      <th className="p-2.5">PR Line ID</th>
                      <th className="p-2.5">Item Code</th>
                      <th className="p-2.5 text-right">Allocated Qty</th>
                      <th className="p-2.5">Converted By</th>
                      <th className="p-2.5">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {historyModalRfq.lines.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-indigo-700">{l.prNumber}</td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-500">{l.prLineId}</td>
                        <td className="p-2.5 font-bold text-slate-900">{l.itemCode}</td>
                        <td className="p-2.5 text-right font-bold text-indigo-950">
                          {l.quantityPurchUom} {l.purchaseUom}
                        </td>
                        <td className="p-2.5 text-slate-700">{historyModalRfq.buyerName}</td>
                        <td className="p-2.5 text-slate-500">{new Date(historyModalRfq.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setHistoryModalRfq(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE DIRECT RFQ MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-600" />
                  <span>Create Direct RFQ Draft</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Initiate a procurement sourcing enquiry directly in the RFQ Directory.
                </p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">RFQ Title / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Sourcing of Specialty Engineering Resins for Export Moulding"
                  value={newRfqTitle}
                  onChange={(e) => setNewRfqTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Company</label>
                  <select
                    value={newRfqCompanyId}
                    onChange={(e) => setNewRfqCompanyId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Branch Plant</label>
                  <select
                    value={newRfqBranchId}
                    onChange={(e) => setNewRfqBranchId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Quotation Submission Deadline</label>
                  <input
                    type="date"
                    value={newRfqDeadline}
                    onChange={(e) => setNewRfqDeadline(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Delivery Terms</label>
                  <input
                    type="text"
                    value={newRfqDeliveryTerms}
                    onChange={(e) => setNewRfqDeliveryTerms(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={newRfqPaymentTerms}
                  onChange={(e) => setNewRfqPaymentTerms(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteCreateDirectRfq}
                disabled={!newRfqTitle.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-xs transition cursor-pointer"
              >
                Create Direct Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
