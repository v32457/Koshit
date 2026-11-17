import React, { useState, useMemo } from 'react';
import {
  Coins,
  PieChart,
  CheckCircle,
  Plus,
  Search,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Check,
  X,
} from 'lucide-react';
import { Company, Branch, User } from '../../types';
import { INITIAL_COMPANIES, INITIAL_BRANCHES, CLASSIFICATION_DIMENSIONS } from '../../data/seedData';
import { budgetControlService } from '../../services/budgetControlService';
import { financialYearService } from '../../services/financialYearService';
import { invoiceMatchingService } from '../../services/invoiceMatchingService';
import { FinancialYearSelector } from '../../components/FinancialYearSelector';
import {
  BudgetControlLedgerRecord,
  InvoiceMatchingMode,
  InvoiceMatchingPolicyConfig,
} from '../../types/procurementFinanceGovernance';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';

interface FinanceBudgetViewProps {
  companyId?: string;
  branchId?: string;
  currentUser?: User;
}

export const FinanceBudgetView: React.FC<FinanceBudgetViewProps> = ({
  companyId = 'co-kosh-01',
  branchId = 'ALL',
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'LEDGERS' | 'COMMITMENTS' | 'MATCHING_POLICY'>(
    'LEDGERS'
  );
  const [ledgers, setLedgers] = useState<BudgetControlLedgerRecord[]>(() =>
    budgetControlService.getLedgers()
  );
  const [commitments, setCommitments] = useState(() => budgetControlService.getCommitments());
  const [exceptions, setExceptions] = useState(() => budgetControlService.getExceptions());
  const [matchingPolicies, setMatchingPolicies] = useState<InvoiceMatchingPolicyConfig[]>(() =>
    invoiceMatchingService.getPolicies()
  );

  const [branches] = useState<Branch[]>(() => {
    try {
      const stored = localStorage.getItem('kosh_branches');
      return stored ? JSON.parse(stored) : INITIAL_BRANCHES;
    } catch {
      return INITIAL_BRANCHES;
    }
  });

  const [selectedFyId, setSelectedFyId] = useState<string>(
    () => financialYearService.getDefaultFinancialYearForCompany(companyId)?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Revise / Add Budget Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reviseTargetLedger, setReviseTargetLedger] = useState<BudgetControlLedgerRecord | null>(
    null
  );
  const [newDepartment, setNewDepartment] = useState('Quality & Regulatory Assurance');
  const [newCostCenter, setNewCostCenter] = useState('CC-QUAL-404');
  const [newBranchId, setNewBranchId] = useState('br-pond-01');
  const [newAllocatedAmount, setNewAllocatedAmount] = useState<number>(2000000);
  const [reviseReason, setReviseReason] = useState(
    'Approved quarterly budget revision by Finance Controller'
  );

  // Part O Matching Policy Version Form Modal
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [polBranchId, setPolBranchId] = useState('ALL');
  const [polMatchingMode, setPolMatchingMode] = useState<InvoiceMatchingMode>('THREE_WAY');
  const [polQtyTol, setPolQtyTol] = useState<number>(2);
  const [polPriceTol, setPolPriceTol] = useState<number>(2);
  const [polTaxTol, setPolTaxTol] = useState<number>(0);
  const [polFreightTol, setPolFreightTol] = useState<number>(500);
  const [polOverInvTol, setPolOverInvTol] = useState<number>(0);
  const [polRequireExApproval, setPolRequireExApproval] = useState<boolean>(true);

  const reload = () => {
    setLedgers(budgetControlService.getLedgers());
    setCommitments(budgetControlService.getCommitments());
    setExceptions(budgetControlService.getExceptions());
    setMatchingPolicies(invoiceMatchingService.getPolicies());
  };

  const selectedFyObj = useMemo(() => {
    const fies = financialYearService.getFinancialYears(companyId);
    return fies.find((y) => y.id === selectedFyId || y.financialYearCode === selectedFyId) || null;
  }, [companyId, selectedFyId]);

  const isHistoricalReadOnly = Boolean(
    selectedFyObj && (selectedFyObj.status === 'CLOSED' || selectedFyObj.status === 'ARCHIVED')
  );

  const filteredLedgers = useMemo(() => {
    return ledgers.filter((l) => {
      if (companyId && companyId !== 'ALL' && l.companyId !== companyId) return false;
      if (branchId && branchId !== 'ALL' && l.branchId !== branchId) return false;
      if (selectedFyId !== 'ALL' && selectedFyObj) {
        if (l.financialYear !== selectedFyObj.financialYearCode) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          l.department.toLowerCase().includes(q) ||
          l.costCenter.toLowerCase().includes(q) ||
          l.expenseCategory.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [ledgers, companyId, branchId, selectedFyId, selectedFyObj, searchQuery]);

  const ledgerGrid = useStandardDataGrid({
    data: filteredLedgers,
    gridId: 'finance-budget-ledgers',
    userId: currentUser?.id || 'usr-default',
    primarySortField: 'updatedAt',
    tieBreakerField: 'costCenter',
    filterSignature: `${companyId}|${branchId}|${selectedFyId}|${searchQuery}`,
  });

  const commitmentGrid = useStandardDataGrid({
    data: commitments,
    gridId: 'finance-budget-commitments',
    userId: currentUser?.id || 'usr-default',
    primarySortField: 'updatedAt',
    tieBreakerField: 'sourceChainId',
    filterSignature: `${companyId}|${branchId}`,
  });

  const policyGrid = useStandardDataGrid({
    data: matchingPolicies,
    gridId: 'finance-matching-policies',
    userId: currentUser?.id || 'usr-default',
    primarySortField: 'effectiveFrom',
    tieBreakerField: 'version',
    filterSignature: `${companyId}|${branchId}`,
  });

  const totalAllocated = useMemo(
    () => filteredLedgers.reduce((acc, b) => acc + b.revisedBudget, 0),
    [filteredLedgers]
  );
  const totalSpent = useMemo(
    () => filteredLedgers.reduce((acc, b) => acc + b.actualExpenditure, 0),
    [filteredLedgers]
  );
  const totalCommitted = useMemo(
    () => filteredLedgers.reduce((acc, b) => acc + b.committedAmount, 0),
    [filteredLedgers]
  );
  const totalAvailable = useMemo(
    () => filteredLedgers.reduce((acc, b) => acc + b.availableBudget, 0),
    [filteredLedgers]
  );

  const handleOpenCreate = () => {
    setErrorMsg(null);
    setReviseTargetLedger(null);
    setNewAllocatedAmount(2000000);
    setIsModalOpen(true);
  };

  const handleOpenRevise = (l: BudgetControlLedgerRecord) => {
    setErrorMsg(null);
    setReviseTargetLedger(l);
    setNewAllocatedAmount(l.revisedBudget);
    setIsModalOpen(true);
  };

  const handleSaveLedgerOrRevision = () => {
    setErrorMsg(null);
    try {
      if (reviseTargetLedger) {
        const updated = budgetControlService.reviseBudgetAllocation({
          companyId: reviseTargetLedger.companyId,
          branchId: reviseTargetLedger.branchId,
          costCenter: reviseTargetLedger.costCenter,
          newRevisedBudget: newAllocatedAmount,
          reason: reviseReason,
          approvedBy: currentUser?.fullName || 'Finance Controller',
        });
        setNotice(
          `Revised budget for ${updated.department} (${updated.costCenter}) to ₹${updated.revisedBudget.toLocaleString()}.`
        );
      } else {
        const created = budgetControlService.upsertLedger({
          companyId,
          branchId: newBranchId,
          department: newDepartment,
          costCenter: newCostCenter,
          financialYear: selectedFyObj?.financialYearCode || 'FY 2026-27',
          approvedBudget: newAllocatedAmount,
          revisedBudget: newAllocatedAmount,
        });
        setNotice(
          `Budget ledger initialized for ${created.department} (${created.costCenter}) — ₹${created.revisedBudget.toLocaleString()}.`
        );
      }
      reload();
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleApproveException = (excId: string, requestedById: string) => {
    setErrorMsg(null);
    try {
      const approverId =
        currentUser?.id && currentUser.id !== requestedById
          ? currentUser.id
          : 'usr-checker-03';
      const approverName =
        currentUser?.id && currentUser.id !== requestedById
          ? currentUser.fullName
          : 'Venkatesh Iyer (Finance Approver)';
      const updated = budgetControlService.approveBudgetException({
        exceptionId: excId,
        approvedById: approverId,
        approvedByName: approverName,
        approvalRemarks: 'Approved via Finance Budget Control Console (master budget unchanged).',
      });
      reload();
      setNotice(`Budget Exception ${updated.exceptionReference} APPROVED.`);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleSaveMatchingPolicy = () => {
    setErrorMsg(null);
    const comp = INITIAL_COMPANIES.find((c) => c.id === companyId);
    const br = branches.find((b) => b.id === polBranchId);
    try {
      const created = invoiceMatchingService.savePolicyConfig(
        {
          companyId,
          companyCode: comp?.code || 'KOSH-HQ',
          branchId: polBranchId,
          branchCode: br?.code || 'ALL',
          purchaseOrgId: 'ALL',
          supplierCategory: 'ALL',
          procurementCategory: 'ALL',
          transactionType: 'ALL',
          itemCategory: 'ALL',
          invoiceType: 'ALL',
          matchingMode: polMatchingMode,
          quantityTolerancePercent: polQtyTol,
          priceTolerancePercent: polPriceTol,
          valueToleranceAmount: 1000,
          taxTolerancePercent: polTaxTol,
          freightToleranceAmount: polFreightTol,
          overInvoiceTolerancePercent: polOverInvTol,
          underInvoiceTolerancePercent: 100,
          allowPartialInvoices: true,
          allowMultipleInvoices: true,
          requireExceptionApproval: polRequireExApproval,
          effectiveFrom: new Date().toISOString().split('T')[0],
          createdBy: currentUser?.fullName || 'Finance Controller',
        },
        currentUser?.fullName || 'Finance Controller'
      );
      reload();
      setShowPolicyModal(false);
      setNotice(
        `Invoice Matching Policy v${created.version} (${created.matchingMode}) activated. Historical matched invoices remain immutable.`
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="space-y-5 text-xs font-sans">
      {/* Page Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-600" />
            <span>Finance Budget Control & Invoice Matching Governance (Part L / O)</span>
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Unified Financial Year budget ledger (`budgetControlService`), PR→RFQ→PO commitment reconciliation, exception approvals, and 2-Way/3-Way AP matching policy configuration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isHistoricalReadOnly}
            onClick={() => {
              setActiveTab('MATCHING_POLICY');
              setShowPolicyModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>New Matching Policy Version</span>
          </button>

          <button
            type="button"
            disabled={isHistoricalReadOnly}
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> Add Department Budget
          </button>
        </div>
      </div>

      {/* Centralized Financial Year Selector */}
      <FinancialYearSelector
        companyId={companyId}
        selectedFyId={selectedFyId}
        onSelectFy={setSelectedFyId}
        currentUser={currentUser}
        entityLabel="Budgets & Policies"
      />

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('LEDGERS')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
            activeTab === 'LEDGERS'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Budget Ledgers ({filteredLedgers.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('COMMITMENTS')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
            activeTab === 'COMMITMENTS'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          PR→RFQ→PO Commitments & Exceptions ({commitments.length} / {exceptions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('MATCHING_POLICY')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
            activeTab === 'MATCHING_POLICY'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Part O — Invoice Matching Policy ({matchingPolicies.length})
        </button>
      </div>

      {activeTab === 'LEDGERS' && (
        <>
          {/* KPI Cards Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-slate-500 font-bold uppercase text-[10px]">
                Total Revised Budget
              </span>
              <div className="text-xl font-bold text-slate-900 font-mono">
                ₹{totalAllocated.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400">
                Across {filteredLedgers.length} cost centres
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Actual Spent</span>
              <div className="text-xl font-bold text-rose-600 font-mono">
                ₹{totalSpent.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400">Invoiced & settled PR/PO</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-slate-500 font-bold uppercase text-[10px]">
                Committed Outstanding
              </span>
              <div className="text-xl font-bold text-amber-600 font-mono">
                ₹{totalCommitted.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400">
                Unified PR→RFQ→PO commitments
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-slate-500 font-bold uppercase text-[10px]">
                Net Available Balance
              </span>
              <div className="text-xl font-bold text-emerald-600 font-mono">
                ₹{totalAvailable.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400">Ready for procurement requests</span>
            </div>
          </div>

          {/* Search */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search department, cost centre, OPEX/CAPEX..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
              />
            </div>
          </div>

          {/* Budget Records Data Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-bold uppercase text-[10px]">
                    <th className="p-3">Department & Cost Centre</th>
                    <th className="p-3">Type & FY</th>
                    <th className="p-3 text-right">Approved / Revised</th>
                    <th className="p-3 text-right">Actual Spent</th>
                    <th className="p-3 text-right">Committed</th>
                    <th className="p-3 text-right">Available Balance</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerGrid.pagedData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">
                        No budget ledgers match the selected Financial Year & filters.
                      </td>
                    </tr>
                  ) : (
                    ledgerGrid.pagedData.map((bgt) => {
                      const br = branches.find((b) => b.id === bgt.branchId);
                      const availablePct = Math.round(
                        (bgt.availableBudget / (bgt.revisedBudget || 1)) * 100
                      );

                      return (
                        <tr key={bgt.id} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-bold text-slate-900">
                            {bgt.department}
                            <span className="block font-mono text-[10px] text-slate-500">
                              {bgt.costCenter} • {br?.name || bgt.branchId}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                bgt.expenseCategory === 'CAPEX'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {bgt.expenseCategory}
                            </span>
                            <span className="block text-[10px] text-slate-500 font-mono">
                              {bgt.financialYear}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">
                            ₹{bgt.revisedBudget.toLocaleString()}
                            {bgt.revisedBudget !== bgt.approvedBudget && (
                              <span className="block text-[10px] text-slate-400">
                                Orig: ₹{bgt.approvedBudget.toLocaleString()}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-rose-600">
                            ₹{bgt.actualExpenditure.toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-amber-600">
                            ₹{bgt.committedAmount.toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-600">
                            ₹{bgt.availableBudget.toLocaleString()}
                            <span className="block text-[10px] text-slate-400 font-medium">
                              {availablePct}% Remaining
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              disabled={isHistoricalReadOnly}
                              onClick={() => handleOpenRevise(bgt)}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-600 border border-slate-300 rounded font-bold text-[11px] cursor-pointer transition shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Revise Allocation
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
              totalRecords={ledgerGrid.totalRecords}
              currentPage={ledgerGrid.currentPage}
              pageSize={ledgerGrid.pageSize}
              totalPages={ledgerGrid.totalPages}
              onPageChange={ledgerGrid.onPageChange}
              onPageSizeChange={ledgerGrid.onPageSizeChange}
              entityLabel="budget ledgers"
              sortNotice="Sorted newest updated first"
            />
          </div>
        </>
      )}

      {activeTab === 'COMMITMENTS' && (
        <div className="space-y-4">
          {/* Exception Approval Queue */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Budget Exception Approval Queue ({exceptions.length})
            </h3>
            {exceptions.length === 0 ? (
              <div className="text-slate-400">No budget exception requests queued.</div>
            ) : (
              <div className="space-y-2">
                {exceptions.map((exc) => (
                  <div
                    key={exc.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span className="font-mono text-indigo-700">{exc.exceptionReference}</span>
                        <span>• {exc.transactionNumber}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            exc.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {exc.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {exc.department} ({exc.costCenter}) • Shortfall: ₹
                        {exc.shortfallAmount.toLocaleString()} • {exc.justification}
                      </div>
                    </div>
                    {exc.status === 'PENDING_APPROVAL' && !isHistoricalReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleApproveException(exc.id, exc.requestedById)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve Exception</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Commitment Reconciliation Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              PR → RFQ → PO Single-Count Commitment Reconciliation Ledger ({commitments.length})
            </h3>
            {commitments.length === 0 ? (
              <div className="text-slate-400">No active commitments recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2">Source Chain</th>
                      <th className="p-2">Stage</th>
                      <th className="p-2">Linked Docs</th>
                      <th className="p-2 text-right">Active Committed (₹)</th>
                      <th className="p-2 text-right">History Transitions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {commitmentGrid.pagedData.map((c) => (
                      <tr key={c.id}>
                        <td className="p-2 font-mono font-bold text-indigo-700">
                          {c.sourceChainId}
                        </td>
                        <td className="p-2 font-bold">{c.currentStage}</td>
                        <td className="p-2 text-[11px] text-slate-600">
                          {[c.prNumber, c.rfqNumber, c.poNumber].filter(Boolean).join(' → ')}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-amber-700">
                          ₹{c.activeCommittedAmount.toLocaleString()}
                        </td>
                        <td className="p-2 text-right font-mono">{c.stageHistory.length} stage(s)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <DataGridFooter
              totalRecords={commitmentGrid.totalRecords}
              currentPage={commitmentGrid.currentPage}
              pageSize={commitmentGrid.pageSize}
              totalPages={commitmentGrid.totalPages}
              onPageChange={commitmentGrid.onPageChange}
              onPageSizeChange={commitmentGrid.onPageSizeChange}
              entityLabel="commitments"
              sortNotice="Sorted newest first"
            />
          </div>
        </div>
      )}

      {activeTab === 'MATCHING_POLICY' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Versioned 2-Way / 3-Way Invoice Matching Policies (Part O)</span>
            </h4>
            <span className="text-[10px] text-slate-500">
              Historical policy versions remain immutable for past matched invoices
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Scope & Version</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3 text-right">Qty Tol %</th>
                  <th className="p-3 text-right">Price Tol %</th>
                  <th className="p-3 text-right">Tax Tol %</th>
                  <th className="p-3 text-right">Freight Tol (₹)</th>
                  <th className="p-3">Exception Approval</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {policyGrid.pagedData.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">
                        {p.companyCode} / {p.branchCode || p.branchId} (v{p.version})
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Effective: {p.effectiveFrom}
                        {p.effectiveUntil ? ` → ${p.effectiveUntil}` : ' → Active'}
                      </div>
                    </td>
                    <td className="p-3 font-mono font-bold text-indigo-700">{p.matchingMode}</td>
                    <td className="p-3 text-right font-mono">±{p.quantityTolerancePercent}%</td>
                    <td className="p-3 text-right font-mono">±{p.priceTolerancePercent}%</td>
                    <td className="p-3 text-right font-mono">±{p.taxTolerancePercent}%</td>
                    <td className="p-3 text-right font-mono">₹{p.freightToleranceAmount}</td>
                    <td className="p-3 font-semibold">
                      {p.requireExceptionApproval ? 'Required on Variance' : 'Auto Block'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DataGridFooter
            totalRecords={policyGrid.totalRecords}
            currentPage={policyGrid.currentPage}
            pageSize={policyGrid.pageSize}
            totalPages={policyGrid.totalPages}
            onPageChange={policyGrid.onPageChange}
            onPageSizeChange={policyGrid.onPageSizeChange}
            entityLabel="matching policies"
            sortNotice="Sorted newest effective version first"
          />
        </div>
      )}

      {/* Revise / Add Budget Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">
                  {reviseTargetLedger
                    ? `Revise Budget: ${reviseTargetLedger.department}`
                    : 'Initialize Department Budget Ledger'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              {!reviseTargetLedger && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Branch</label>
                    <select
                      value={newBranchId}
                      onChange={(e) => setNewBranchId(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                    >
                      {branches
                        .filter((b) => (b.companyId || 'co-kosh-01') === companyId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Department Name *
                      </label>
                      <input
                        type="text"
                        value={newDepartment}
                        onChange={(e) => setNewDepartment(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Cost Center *</label>
                      <input
                        type="text"
                        value={newCostCenter}
                        onChange={(e) => setNewCostCenter(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {reviseTargetLedger ? 'New Revised Budget (₹) *' : 'Initial Budget Allocation (₹) *'}
                </label>
                <input
                  type="number"
                  value={newAllocatedAmount}
                  onChange={(e) => setNewAllocatedAmount(Number(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-emerald-700"
                />
              </div>

              {reviseTargetLedger && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Audit Reason for Revision *
                  </label>
                  <input
                    type="text"
                    value={reviseReason}
                    onChange={(e) => setReviseReason(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLedgerOrRevision}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              >
                {reviseTargetLedger ? 'Apply Budget Revision' : 'Create Budget Ledger'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Invoice Matching Policy Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                Publish New Invoice Matching Policy Version (Part O)
              </h3>
              <button onClick={() => setShowPolicyModal(false)}>
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Branch Scope</label>
                <select
                  value={polBranchId}
                  onChange={(e) => setPolBranchId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="ALL">All Branches (Company-Wide)</option>
                  {branches
                    .filter((b) => (b.companyId || 'co-kosh-01') === companyId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Matching Mode</label>
                <select
                  value={polMatchingMode}
                  onChange={(e) => setPolMatchingMode(e.target.value as InvoiceMatchingMode)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="THREE_WAY">3-Way Matching (PO + GRN + Invoice)</option>
                  <option value="TWO_WAY">2-Way Matching (PO + Invoice)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Qty Tolerance (%)
                </label>
                <input
                  type="number"
                  value={polQtyTol}
                  onChange={(e) => setPolQtyTol(Number(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Price Tolerance (%)
                </label>
                <input
                  type="number"
                  value={polPriceTol}
                  onChange={(e) => setPolPriceTol(Number(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tax Tolerance (%)
                </label>
                <input
                  type="number"
                  value={polTaxTol}
                  onChange={(e) => setPolTaxTol(Number(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Freight Tolerance (₹)
                </label>
                <input
                  type="number"
                  value={polFreightTol}
                  onChange={(e) => setPolFreightTol(Number(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Over-Invoice Tolerance (%)
                </label>
                <input
                  type="number"
                  value={polOverInvTol}
                  onChange={(e) => setPolOverInvTol(Number(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <label className="flex items-center gap-2 pt-4 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={polRequireExApproval}
                  onChange={(e) => setPolRequireExApproval(e.target.checked)}
                />
                <span>Allow Variance Exception Approval Workflow</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMatchingPolicy}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Publish Policy Version
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
