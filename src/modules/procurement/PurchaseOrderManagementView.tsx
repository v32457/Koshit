import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Plus,
  Lock,
  ShieldAlert,
  FileWarning,
  X,
  Check,
  Calendar,
} from 'lucide-react';
import { User, Company, Branch } from '../../types';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { financialYearService } from '../../services/financialYearService';
import { FinancialYearSelector } from '../../components/FinancialYearSelector';
import { PurchaseOrderHeader } from '../../types/rfqSourcing';
import {
  DirectPoReasonCode,
  RfqExemptionApprovalRecord,
} from '../../types/procurementFinanceGovernance';
import { INITIAL_BUSINESS_PARTNERS } from '../../data/seedData';
import { PoApprovalDetailModal } from './PoApprovalDetailModal';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';

interface PurchaseOrderManagementViewProps {
  currentUser: User;
  companies: Company[];
  branches: Branch[];
}

export const PurchaseOrderManagementView: React.FC<PurchaseOrderManagementViewProps> = ({
  currentUser,
  companies,
  branches,
}) => {
  const [pos, setPos] = useState<PurchaseOrderHeader[]>(() => purchaseOrderService.getPOs());
  const [exemptions, setExemptions] = useState<RfqExemptionApprovalRecord[]>(() =>
    purchaseOrderService.getRfqExemptions()
  );
  const [activeTab, setActiveTab] = useState<'POS' | 'COMPLIANCE'>('POS');
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [selectedFyId, setSelectedFyId] = useState<string>(
    () => financialYearService.getDefaultFinancialYearForCompany('co-kosh-01')?.id || ''
  );

  const [selectedPo, setSelectedPo] = useState<PurchaseOrderHeader | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Part N: Direct PO & Exemption Modal State
  const [showDirectPoModal, setShowDirectPoModal] = useState(false);
  const [directCompanyId, setDirectCompanyId] = useState('co-kosh-01');
  const [directBranchId, setDirectBranchId] = useState('br-pond-01');
  const [directVendorId, setDirectVendorId] = useState('bp-002');
  const [directItemCode, setDirectItemCode] = useState('RMPAOPOEXLG0001');
  const [directQty, setDirectQty] = useState<number>(10);
  const [directUnitPrice, setDirectUnitPrice] = useState<number>(7500);
  const [directPoDate, setDirectPoDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [directPostingDate, setDirectPostingDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [directReason, setDirectReason] = useState<DirectPoReasonCode>('EMERGENCY_PROCUREMENT');
  const [directJustification, setDirectJustification] = useState<string>('');
  const [directExemptionRef, setDirectExemptionRef] = useState<string>('');

  // Exemption request inputs
  const [showExemptionModal, setShowExemptionModal] = useState(false);
  const [exPrNumber, setExPrNumber] = useState('PR-2026-0001');
  const [exReason, setExReason] = useState<DirectPoReasonCode>('EMERGENCY_PROCUREMENT');
  const [exJustification, setExJustification] = useState('');

  const reload = () => {
    setPos(purchaseOrderService.getPOs());
    setExemptions(purchaseOrderService.getRfqExemptions());
  };

  // Centralized Financial Year & RBAC Filtering
  const fyResult = useMemo(() => {
    return financialYearService.filterTransactionsByFinancialYear({
      records: pos,
      selectedFyId,
      companyId: companyFilter,
      branchId: branchFilter,
      currentUser,
      entityType: 'PURCHASE_ORDER',
      getRecordId: (p) => p.id,
      getDocumentNumber: (p) => p.poNumber,
      getCompanyId: (p) => p.companyId,
      getBranchId: (p) => p.branchId,
      getPurchaseOrgId: (p) => p.purchaseOrgId,
      getFinancialYearId: (p) => p.financialYearId,
      getFinancialYearCode: (p) => p.financialYearCode,
      getAccountingPostingDate: (p) => p.accountingPostingDate,
      getDocumentDate: (p) => p.poDate,
    });
  }, [pos, selectedFyId, companyFilter, branchFilter, currentUser]);

  const isHistoricalReadOnly = fyResult.isHistoricalReadOnly;

  const filteredPos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return fyResult.filteredRecords.filter(
      (p) =>
        !q ||
        p.poNumber.toLowerCase().includes(q) ||
        p.vendorName.toLowerCase().includes(q) ||
        (p.directPoReason || '').toLowerCase().includes(q)
    );
  }, [fyResult.filteredRecords, searchQuery]);

  const complianceReport = useMemo(() => {
    return purchaseOrderService.getDirectPoComplianceReport(
      companyFilter === 'ALL' ? undefined : companyFilter,
      branchFilter === 'ALL' ? undefined : branchFilter
    );
  }, [pos, companyFilter, branchFilter, exemptions]);

  const poGrid = useStandardDataGrid({
    gridId: 'purchase-orders',
    userId: currentUser?.id,
    data: filteredPos,
    defaultSortField: 'poDate',
    defaultSortDirection: 'desc',
    tieBreakerField: 'poNumber',
    filterSignature: `${selectedFyId}|${companyFilter}|${branchFilter}|${searchQuery}`,
  });

  const exemptionGrid = useStandardDataGrid({
    gridId: 'po-rfq-exemptions',
    userId: currentUser?.id,
    data: exemptions,
    defaultSortField: 'requestedAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'exemptionReference',
  });

  const bypassGrid = useStandardDataGrid({
    gridId: 'po-bypass-attempts',
    userId: currentUser?.id,
    data: complianceReport.blockedBypassAttempts,
    defaultSortField: 'timestamp',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
  });

  const directEligibility = useMemo(() => {
    return purchaseOrderService.evaluateDirectPoEligibility({
      companyId: directCompanyId,
      branchId: directBranchId,
      exemptionApprovalRef: directExemptionRef || undefined,
    });
  }, [
    directCompanyId,
    directBranchId,
    directQty,
    directUnitPrice,
    directReason,
    directExemptionRef,
    currentUser,
    exemptions,
  ]);

  const handleApprove = (poId: string) => {
    setErrorMsg(null);
    try {
      purchaseOrderService.approvePo(poId, currentUser.fullName);
      reload();
      setSelectedPo(null);
      setNotice('Purchase Order Authorized & Released successfully.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleReject = (poId: string, reason: string) => {
    setErrorMsg(null);
    try {
      purchaseOrderService.rejectPo(poId, currentUser.fullName, reason);
      reload();
      setSelectedPo(null);
      setNotice('Purchase Order Rejected.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateDirectPo = () => {
    setErrorMsg(null);
    const partner = INITIAL_BUSINESS_PARTNERS.find((b) => b.id === directVendorId);
    const branch = branches.find((b) => b.id === directBranchId);
    const comp = companies.find((c) => c.id === directCompanyId);

    try {
      const created = purchaseOrderService.createDirectPurchaseOrder({
        companyId: directCompanyId,
        companyCode: comp?.code || 'KOSH-HQ',
        branchId: directBranchId,
        branchCode: branch?.code || '001',
        branchName: branch?.name || 'Puducherry Plant',
        department: currentUser.department || 'Production',
        costCentre: 'CC-PROD-101',
        vendorId: directVendorId,
        buyerId: currentUser.id,
        buyerName: currentUser.fullName,
        poDate: directPoDate,
        accountingPostingDate: directPostingDate,
        directPoReason: directReason,
        directPoJustification: directJustification,
        exemptionApprovalRef: directExemptionRef || undefined,
        lines: [
          {
            itemCode: directItemCode,
            description: 'Direct Emergency / Exempted Material Requirement',
            purchaseUom: 'BAG',
            inventoryUom: 'KG',
            conversionRatio: 25,
            orderQtyPurchUom: directQty,
            unitPricePurchUom: directUnitPrice,
            gstPercent: 18,
          },
        ],
      });
      reload();
      setShowDirectPoModal(false);
      setDirectJustification('');
      setNotice(
        `Direct Purchase Order ${created.poNumber} created (${created.rfqRequirementStatus}) for FY ${created.financialYearCode}.`
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRequestExemption = () => {
    setErrorMsg(null);
    const partner = INITIAL_BUSINESS_PARTNERS.find((b) => b.id === directVendorId);
    try {
      const rec = purchaseOrderService.requestRfqExemption({
        companyId: directCompanyId,
        branchId: directBranchId,
        prNumber: exPrNumber,
        vendorId: directVendorId,
        vendorName: partner?.bpName || 'BASF INDIA LIMITED',
        itemCode: directItemCode,
        estimatedValue: directQty * directUnitPrice,
        reasonCode: exReason,
        justification: exJustification,
        requestedBy: currentUser.fullName,
      });
      reload();
      setDirectExemptionRef(rec.exemptionReference);
      setShowExemptionModal(false);
      setExJustification('');
      setNotice(`RFQ Exemption Request ${rec.exemptionReference} submitted for Purchasing Manager authorization.`);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleApproveExemption = (exId: string) => {
    setErrorMsg(null);
    try {
      const updated = purchaseOrderService.approveRfqExemption({
        exemptionId: exId,
        approvedBy:
          currentUser.id === 'usr-checker-03'
            ? currentUser.fullName
            : 'Venkatesh Iyer (Purchasing Manager)',
        approvalRemarks: 'Approved urgent RFQ exemption per governance exception authority.',
      });
      reload();
      setDirectExemptionRef(updated.exemptionReference);
      setNotice(`RFQ Exemption ${updated.exemptionReference} APPROVED. Ready for Direct PO linking.`);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const selectedPoGuard = selectedPo
    ? financialYearService.evaluateHistoricalRecordMutationGuard({
        companyId: selectedPo.companyId,
        accountingPostingDate: selectedPo.accountingPostingDate,
        documentDate: selectedPo.poDate,
        financialYearId: selectedPo.financialYearId,
        actionLabel: 'AUTHORIZE_PO',
      })
    : { allowed: true };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-600" />
            <span>Purchase Order Management, Direct PO & RFQ Governance (Part N)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Multi-vendor split allocations, mandatory RFQ policy enforcement, Direct PO with exempted approvals, and cross-FY posting date control.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isHistoricalReadOnly}
            onClick={() => {
              setErrorMsg(null);
              setShowExemptionModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileWarning className="w-3.5 h-3.5 text-amber-600" />
            <span>RFQ Exemption Request</span>
          </button>

          <button
            type="button"
            disabled={isHistoricalReadOnly}
            onClick={() => {
              setErrorMsg(null);
              setShowDirectPoModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Direct PO (Without RFQ)</span>
          </button>
        </div>
      </div>

      {/* Centralized Financial Year Selector */}
      <FinancialYearSelector
        companyId={companyFilter === 'ALL' ? 'co-kosh-01' : companyFilter}
        selectedFyId={selectedFyId}
        onSelectFy={setSelectedFyId}
        currentUser={currentUser}
        dataQualityGaps={fyResult.dataQualityGaps}
        entityLabel="Purchase Orders"
      />

      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-700 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('POS')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
            activeTab === 'POS'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Purchase Orders ({filteredPos.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('COMPLIANCE')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
            activeTab === 'COMPLIANCE'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Direct PO Compliance & Blocked Bypass Attempts ({complianceReport.blockedBypassAttempts.length} Blocked)
        </button>
      </div>

      {activeTab === 'POS' ? (
        <>
          {/* Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by PO #, Vendor Name, Direct Reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
            >
              <option value="ALL">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>

            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* PO List Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">PO Number & Dates</th>
                    <th className="p-3">Vendor / Supplier</th>
                    <th className="p-3">Company / Branch</th>
                    <th className="p-3">Price Source / Type</th>
                    <th className="p-3 text-right">Gross Value (₹)</th>
                    <th className="p-3">Governance / Override</th>
                    <th className="p-3">Approval Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {poGrid.pagedData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400">
                        No Purchase Orders match the active Financial Year and filters.
                      </td>
                    </tr>
                  ) : (
                    poGrid.pagedData.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50 transition">
                        <td className="p-3">
                          <div className="font-bold text-indigo-600">{po.poNumber}</div>
                          <div className="text-[11px] text-slate-500 font-semibold">
                            Doc: {po.poDate}
                            {po.accountingPostingDate && po.accountingPostingDate !== po.poDate && (
                              <span className="block text-[10px] text-indigo-700 font-mono">
                                Posting: {po.accountingPostingDate} ({po.financialYearCode})
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-3">
                          <div className="font-bold text-slate-900">{po.vendorName}</div>
                          <div className="text-[11px] text-slate-500">{po.vendorCode}</div>
                        </td>

                        <td className="p-3">
                          <div className="font-semibold text-slate-800">{po.companyCode}</div>
                          <div className="text-[11px] text-slate-500">{po.branchName}</div>
                        </td>

                        <td className="p-3 space-y-1">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              po.priceSourceMode === 'RFQ_AWARD'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {po.priceSourceMode.replace(/_/g, ' ')}
                          </span>
                          {po.isDirectPo && (
                            <div className="text-[10px] font-bold text-amber-800">
                              DIRECT PO ({po.rfqRequirementStatus?.replace(/_/g, ' ')})
                            </div>
                          )}
                        </td>

                        <td className="p-3 text-right font-bold text-slate-900">
                          ₹{po.totalGrossValue.toLocaleString()}
                        </td>

                        <td className="p-3">
                          {po.hasOverride ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>OVERRIDE APPLIED</span>
                            </span>
                          ) : po.isDirectPo && po.directPoReason ? (
                            <span className="text-[10px] font-semibold text-slate-700">
                              {po.directPoReason.replace(/_/g, ' ')}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-semibold">Standard Split</span>
                          )}
                        </td>

                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              po.status === 'APPROVED' || po.status === 'RELEASED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : po.status === 'PENDING_APPROVAL'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {po.status.replace(/_/g, ' ')}
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          <button
                            onClick={() => setSelectedPo(po)}
                            className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs transition cursor-pointer"
                          >
                            {isHistoricalReadOnly ? 'Inspect (Read-Only)' : 'Inspect & Authorize'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <DataGridFooter
            currentPage={poGrid.currentPage}
            totalPages={poGrid.totalPages}
            pageSize={poGrid.pageSize}
            totalRecords={poGrid.totalRecords}
            onPageChange={poGrid.setCurrentPage}
            onPageSizeChange={poGrid.setPageSize}
            pageSizeOptions={poGrid.pageSizeOptions}
            defaultSortNotice="Sorted newest first (PO Date DESC)"
          />
        </>
      ) : (
        /* Compliance & Exemptions Tab (Part N5) */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] font-bold text-slate-500 uppercase">RFQ-Based POs</div>
              <div className="text-xl font-black text-indigo-700 mt-1">
                {complianceReport.rfqBasedPos.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Direct POs Issued</div>
              <div className="text-xl font-black text-amber-700 mt-1">
                {complianceReport.directPos.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Approved RFQ Exemptions</div>
              <div className="text-xl font-black text-emerald-700 mt-1">
                {complianceReport.approvedExemptionPos.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Blocked Bypass Attempts</div>
              <div className="text-xl font-black text-rose-700 mt-1">
                {complianceReport.blockedBypassAttempts.length}
              </div>
            </div>
          </div>

          {/* Pending / Active RFQ Exemptions Queue */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              RFQ Exemption Approvals ({exemptions.length})
            </h3>
            {exemptions.length === 0 ? (
              <div className="text-xs text-slate-400">No RFQ exemption requests logged yet.</div>
            ) : (
              <div className="space-y-2">
                {exemptionGrid.pagedData.map((ex) => (
                  <div
                    key={ex.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span className="font-mono text-indigo-700">{ex.exemptionReference}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ex.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ex.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {ex.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        PR: {ex.prNumber || 'Direct'} • Value: ₹{ex.estimatedValue.toLocaleString()} • Reason: {ex.reasonCode} — {ex.justification}
                      </div>
                    </div>
                    {ex.status === 'PENDING' && !isHistoricalReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleApproveExemption(ex.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Authorize Exemption</span>
                      </button>
                    )}
                  </div>
                ))}
                <DataGridFooter
                  currentPage={exemptionGrid.currentPage}
                  totalPages={exemptionGrid.totalPages}
                  pageSize={exemptionGrid.pageSize}
                  totalRecords={exemptionGrid.totalRecords}
                  onPageChange={exemptionGrid.setCurrentPage}
                  onPageSizeChange={exemptionGrid.setPageSize}
                  pageSizeOptions={exemptionGrid.pageSizeOptions}
                  defaultSortNotice="Sorted newest first (Requested At DESC)"
                />
              </div>
            )}
          </div>

          {/* Blocked Bypass Attempts Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
              Blocked Unauthorized Direct PO Bypass Attempts
            </h3>
            {complianceReport.blockedBypassAttempts.length === 0 ? (
              <div className="text-xs text-slate-400">No unauthorized bypass attempts recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-rose-50 text-rose-900 font-bold">
                    <tr>
                      <th className="p-2">Timestamp</th>
                      <th className="p-2">Attempted By</th>
                      <th className="p-2">Policy Mode</th>
                      <th className="p-2 text-right">Order Value</th>
                      <th className="p-2">Block Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bypassGrid.pagedData.map((b) => (
                      <tr key={b.id}>
                        <td className="p-2 font-mono">{new Date(b.timestamp).toLocaleString()}</td>
                        <td className="p-2 font-semibold">{b.attemptedByName}</td>
                        <td className="p-2 font-mono">{b.effectiveRfqPolicyMode}</td>
                        <td className="p-2 text-right font-mono">₹{b.attemptedValue.toLocaleString()}</td>
                        <td className="p-2 text-rose-800 font-medium">{b.blockReason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="pt-3">
                  <DataGridFooter
                    currentPage={bypassGrid.currentPage}
                    totalPages={bypassGrid.totalPages}
                    pageSize={bypassGrid.pageSize}
                    totalRecords={bypassGrid.totalRecords}
                    onPageChange={bypassGrid.setCurrentPage}
                    onPageSizeChange={bypassGrid.setPageSize}
                    pageSizeOptions={bypassGrid.pageSizeOptions}
                    defaultSortNotice="Sorted newest first (Timestamp DESC)"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail & Approval Modal */}
      {selectedPo && (
        <PoApprovalDetailModal
          po={selectedPo}
          currentUser={currentUser}
          readOnlyHistorical={isHistoricalReadOnly || !selectedPoGuard.allowed}
          historicalLockReason={
            selectedPoGuard.reason ||
            (isHistoricalReadOnly
              ? 'Historical closed financial year view prohibits PO approval or rejection.'
              : undefined)
          }
          onClose={() => setSelectedPo(null)}
          onApprove={() => handleApprove(selectedPo.id)}
          onReject={(reason) => handleReject(selectedPo.id, reason)}
        />
      )}

      {/* Create Direct PO Modal (Part N) */}
      {showDirectPoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                Create Direct Purchase Order Without RFQ (Policy-Gated)
              </h3>
              <button onClick={() => setShowDirectPoModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company</label>
                <select
                  value={directCompanyId}
                  onChange={(e) => setDirectCompanyId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Branch</label>
                <select
                  value={directBranchId}
                  onChange={(e) => setDirectBranchId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">PO Document Date</label>
                <input
                  type="date"
                  value={directPoDate}
                  onChange={(e) => setDirectPoDate(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Accounting Posting Date</label>
                <input
                  type="date"
                  value={directPostingDate}
                  onChange={(e) => setDirectPostingDate(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Direct PO Reason Code</label>
                <select
                  value={directReason}
                  onChange={(e) => setDirectReason(e.target.value as DirectPoReasonCode)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="EMERGENCY_PROCUREMENT">Emergency Breakdown / Critical Procurement</option>
                  <option value="APPROVED_SINGLE_SOURCE">Approved Single-Source Supplier</option>
                  <option value="PROPRIETARY_ITEM">Proprietary / OEM Exclusive Item</option>
                  <option value="EXISTING_CONTRACT">Existing Active Master Supply Contract</option>
                  <option value="RATE_CONTRACT">Approved Rate Contract / Price Book</option>
                  <option value="APPROVED_EXCEPTION">Authorized Management Exception</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Approved RFQ Exemption Reference (If Mandatory)
                </label>
                <input
                  type="text"
                  placeholder="e.g. RFQ-EX-2026-0001"
                  value={directExemptionRef}
                  onChange={(e) => setDirectExemptionRef(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Order Quantity (BAG)</label>
                <input
                  type="number"
                  value={directQty}
                  onChange={(e) => setDirectQty(Number(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Unit Price (₹)</label>
                <input
                  type="number"
                  value={directUnitPrice}
                  onChange={(e) => setDirectUnitPrice(Number(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-semibold text-slate-700 mb-1">Mandatory Justification *</label>
              <input
                type="text"
                placeholder="Explain why this PO is issued directly without competitive RFQ..."
                value={directJustification}
                onChange={(e) => setDirectJustification(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>

            {/* Live Policy Eligibility Preview */}
            <div
              className={`p-3 rounded-xl border text-xs ${
                directEligibility.allowed
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="font-bold">
                Policy Mode: {directEligibility.policyMode} • Status:{' '}
                {directEligibility.rfqRequirementStatus}
              </div>
              {directEligibility.reason && (
                <div className="mt-1 font-semibold">{directEligibility.reason}</div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDirectPoModal(false)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateDirectPo}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Issue Direct PO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RFQ Exemption Request Modal */}
      {showExemptionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Request RFQ Policy Exemption</h3>
              <button onClick={() => setShowExemptionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">PR Reference #</label>
                <input
                  type="text"
                  value={exPrNumber}
                  onChange={(e) => setExPrNumber(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Exemption Reason Code</label>
                <select
                  value={exReason}
                  onChange={(e) => setExReason(e.target.value as DirectPoReasonCode)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="EMERGENCY_PROCUREMENT">Emergency Breakdown / Critical Procurement</option>
                  <option value="APPROVED_SINGLE_SOURCE">Approved Single-Source Supplier</option>
                  <option value="PROPRIETARY_ITEM">Proprietary / OEM Exclusive Item</option>
                  <option value="RATE_CONTRACT">Approved Rate Contract / Price Book</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Justification *</label>
                <textarea
                  rows={3}
                  value={exJustification}
                  onChange={(e) => setExJustification(e.target.value)}
                  placeholder="Provide commercial/operational rationale for waiving RFQ..."
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowExemptionModal(false)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestExemption}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Submit Exemption Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
