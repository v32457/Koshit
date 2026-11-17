import React, { useState, useMemo } from 'react';
import {
  PackageCheck,
  Plus,
  CheckCircle2,
  FileCheck,
  AlertTriangle,
  ShieldAlert,
  Lock,
  Eye,
  X,
  Check,
  XCircle,
} from 'lucide-react';
import { User, Company, Branch } from '../../types';
import { goodsReceiptService } from '../../services/goodsReceiptService';
import { uomConversionService } from '../../services/uomConversionService';
import { invoiceMatchingService } from '../../services/invoiceMatchingService';
import { financialYearService } from '../../services/financialYearService';
import { FinancialYearSelector } from '../../components/FinancialYearSelector';
import { GoodsReceiptHeader } from '../../types/rfqSourcing';
import {
  SupplierInvoiceRecord,
  InvoiceVarianceDetail,
} from '../../types/procurementFinanceGovernance';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';

interface GoodsReceiptViewProps {
  currentUser: User;
  companies: Company[];
  branches: Branch[];
}

export const GoodsReceiptView: React.FC<GoodsReceiptViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'GRN' | 'INVOICE_MATCHING'>('GRN');
  const [receipts, setReceipts] = useState<GoodsReceiptHeader[]>(() =>
    goodsReceiptService.getReceipts()
  );
  const [invoices, setInvoices] = useState<SupplierInvoiceRecord[]>(() =>
    invoiceMatchingService.getInvoices()
  );
  const [selectedFyId, setSelectedFyId] = useState<string>(
    () => financialYearService.getDefaultFinancialYearForCompany('co-kosh-01')?.id || ''
  );

  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Create GRN modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [poNumber, setPoNumber] = useState('PO-2026-0001');
  const [challanNumber, setChallanNumber] = useState(
    `DC-VENDOR-${Math.floor(Math.random() * 9000) + 1000}`
  );
  const [itemCode] = useState('RMPAOPOEXLG0001');
  const [recQtyPurchUom, setRecQtyPurchUom] = useState<number>(12);
  const [receiptDate, setReceiptDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [grnPostingDate, setGrnPostingDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Submit Supplier Invoice modal state (Part O)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invSupplierNumber, setInvSupplierNumber] = useState(
    `SUPP-INV-${Math.floor(Math.random() * 9000) + 1000}`
  );
  const [invPoNumber, setInvPoNumber] = useState('PO-2026-0001');
  const [invDate, setInvDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [invPostingDate, setInvPostingDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [invQty, setInvQty] = useState<number>(10);
  const [invUnitPrice, setInvUnitPrice] = useState<number>(7450);
  const [invTaxPercent, setInvTaxPercent] = useState<number>(18);
  const [invFreight, setInvFreight] = useState<number>(0);

  // Inspect Invoice & Variance Exception state
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoiceRecord | null>(null);
  const [varianceJustification, setVarianceJustification] = useState('');
  const [approverRemarks, setApproverRemarks] = useState(
    'Authorized AP variance exception approved for accounting posting.'
  );

  const reload = () => {
    setReceipts(goodsReceiptService.getReceipts());
    setInvoices(invoiceMatchingService.getInvoices());
  };

  // Centralized Financial Year & RBAC Filtering for GRNs
  const grnFyResult = useMemo(() => {
    return financialYearService.filterTransactionsByFinancialYear({
      records: receipts,
      selectedFyId,
      companyId: 'co-kosh-01',
      currentUser,
      entityType: 'GRN',
      getRecordId: (g) => g.id,
      getDocumentNumber: (g) => g.grnNumber,
      getCompanyId: (g) => g.companyId,
      getBranchId: (g) => g.branchId,
      getFinancialYearId: (g) => g.financialYearId,
      getFinancialYearCode: (g) => g.financialYearCode,
      getAccountingPostingDate: (g) => g.accountingPostingDate,
      getDocumentDate: (g) => g.receiptDate,
    });
  }, [receipts, selectedFyId, currentUser]);

  // Centralized Financial Year & RBAC Filtering for Supplier Invoices
  const invFyResult = useMemo(() => {
    return financialYearService.filterTransactionsByFinancialYear({
      records: invoices,
      selectedFyId,
      companyId: 'co-kosh-01',
      currentUser,
      entityType: 'SUPPLIER_INVOICE',
      getRecordId: (i) => i.id,
      getDocumentNumber: (i) => i.internalInvoiceNumber,
      getCompanyId: (i) => i.companyId,
      getBranchId: (i) => i.branchId,
      getPurchaseOrgId: (i) => i.purchaseOrgId,
      getFinancialYearId: (i) => i.financialYearId,
      getFinancialYearCode: (i) => i.financialYearCode,
      getAccountingPostingDate: (i) => i.accountingPostingDate,
      getDocumentDate: (i) => i.invoiceDate,
    });
  }, [invoices, selectedFyId, currentUser]);

  const isHistoricalReadOnly = grnFyResult.isHistoricalReadOnly;
  const combinedGaps = useMemo(
    () =>
      activeTab === 'GRN' ? grnFyResult.dataQualityGaps : invFyResult.dataQualityGaps,
    [activeTab, grnFyResult.dataQualityGaps, invFyResult.dataQualityGaps]
  );

  const grnGrid = useStandardDataGrid({
    gridId: 'goods-receipts',
    userId: currentUser?.id,
    data: grnFyResult.filteredRecords,
    defaultSortField: 'receiptDate',
    defaultSortDirection: 'desc',
    tieBreakerField: 'grnNumber',
    filterSignature: selectedFyId,
  });

  const invGrid = useStandardDataGrid({
    gridId: 'supplier-invoices',
    userId: currentUser?.id,
    data: invFyResult.filteredRecords,
    defaultSortField: 'invoiceDate',
    defaultSortDirection: 'desc',
    tieBreakerField: 'internalInvoiceNumber',
    filterSignature: selectedFyId,
  });

  const uomSnap = uomConversionService.getUomSnapshot(itemCode);
  const calculatedInvQty = recQtyPurchUom * uomSnap.conversionRatio;

  const handlePostReceipt = () => {
    setErrorMsg(null);
    try {
      const created = goodsReceiptService.postGoodsReceipt(
        {
          poNumber,
          companyId: 'co-kosh-01',
          branchId: 'br-pond-01',
          branchName: 'Puducherry Plant',
          vendorId: 'bp-002',
          vendorName: 'BASF INDIA LIMITED',
          challanNumber,
          receiptDate,
          accountingPostingDate: grnPostingDate,
          receivedBy: currentUser.fullName,
        },
        [
          {
            itemCode,
            description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
            purchaseUom: uomSnap.purchaseUom,
            inventoryUom: uomSnap.inventoryUom,
            conversionRatio: uomSnap.conversionRatio,
            receivedQtyPurchUom: recQtyPurchUom,
            convertedQtyInvUom: calculatedInvQty,
            acceptedQtyInvUom: calculatedInvQty,
            rejectedQtyInvUom: 0,
            warehouseCode: 'WH-RM-01',
            batchNumber: `BATCH-${Date.now()}`,
            remarks: 'Goods Receipt posted with UOM conversion.',
          },
        ]
      );
      reload();
      setShowCreateModal(false);
      setNotice(
        `GRN ${created.grnNumber} posted (${recQtyPurchUom} ${uomSnap.purchaseUom} = ${calculatedInvQty} ${uomSnap.inventoryUom}) and synchronized with Inventory Management.`
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleSubmitInvoice = () => {
    setErrorMsg(null);
    try {
      const created = invoiceMatchingService.submitAndMatchSupplierInvoice({
        supplierInvoiceNumber: invSupplierNumber,
        invoiceDate: invDate,
        accountingPostingDate: invPostingDate,
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        vendorId: 'bp-002',
        poNumber: invPoNumber,
        transactionType: 'MATERIAL',
        invoiceType: 'STANDARD',
        createdBy: currentUser.fullName,
        lines: [
          {
            itemCode: 'RMPAOPOEXLG0001',
            description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
            uom: 'BAG',
            invoicedQuantity: invQty,
            unitPrice: invUnitPrice,
            taxPercent: invTaxPercent,
            freightAmount: invFreight,
          },
        ],
      });
      reload();
      setShowInvoiceModal(false);
      setSelectedInvoice(created);
      setNotice(
        `Invoice ${created.internalInvoiceNumber} (${created.supplierInvoiceNumber}) evaluated: Outcome = ${created.matchingOutcome.replace(/_/g, ' ')}.`
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRequestException = (inv: SupplierInvoiceRecord) => {
    setErrorMsg(null);
    try {
      const updated = invoiceMatchingService.requestInvoiceExceptionApproval({
        invoiceId: inv.id,
        requestedBy: currentUser.fullName,
        varianceJustification,
      });
      reload();
      setSelectedInvoice(updated);
      setVarianceJustification('');
      setNotice(`Variance exception approval requested for ${updated.internalInvoiceNumber}.`);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleResolveException = (
    inv: SupplierInvoiceRecord,
    decision: 'APPROVE' | 'REJECT'
  ) => {
    setErrorMsg(null);
    const guard = financialYearService.evaluateHistoricalRecordMutationGuard({
      companyId: inv.companyId,
      accountingPostingDate: inv.accountingPostingDate,
      documentDate: inv.invoiceDate,
      financialYearId: inv.financialYearId,
      actionLabel: `INVOICE_EXCEPTION_${decision}`,
    });
    if (!guard.allowed) {
      setErrorMsg(guard.reason || 'Closed FY prohibits invoice exception resolution.');
      return;
    }
    try {
      const approverName =
        inv.matchingSnapshot.exceptionRecord?.requestedBy === currentUser.fullName
          ? 'Ananya Sharma (Finance Controller)'
          : currentUser.fullName;
      const updated = invoiceMatchingService.resolveInvoiceExceptionApproval({
        invoiceId: inv.id,
        approvedBy: approverName,
        decision,
        approverRemarks,
      });
      reload();
      setSelectedInvoice(updated);
      setNotice(
        `Invoice ${updated.internalInvoiceNumber} exception ${decision === 'APPROVE' ? 'APPROVED (Ready for Accounting Posting)' : 'REJECTED'}.`
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-indigo-600" />
            <span>Goods Receipt & 2-Way / 3-Way Invoice Matching (Part O)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Capture GRN in Purchase UOM with live Inventory sync, enforce FY accounting posting dates, and evaluate 2-Way/3-Way Supplier Invoice variances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isHistoricalReadOnly}
            onClick={() => {
              setErrorMsg(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>Post New GRN</span>
          </button>

          <button
            type="button"
            disabled={isHistoricalReadOnly}
            onClick={() => {
              setErrorMsg(null);
              setActiveTab('INVOICE_MATCHING');
              setShowInvoiceModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>Submit & Match Supplier Invoice</span>
          </button>
        </div>
      </div>

      {/* Centralized Financial Year Selector */}
      <FinancialYearSelector
        companyId="co-kosh-01"
        selectedFyId={selectedFyId}
        onSelectFy={setSelectedFyId}
        currentUser={currentUser}
        dataQualityGaps={combinedGaps}
        entityLabel={activeTab === 'GRN' ? 'Goods Receipts' : 'Supplier Invoices'}
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

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('GRN')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
            activeTab === 'GRN'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Goods Receipts ({grnFyResult.filteredRecords.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('INVOICE_MATCHING')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
            activeTab === 'INVOICE_MATCHING'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          2-Way / 3-Way Supplier Invoice Matching ({invFyResult.filteredRecords.length})
        </button>
      </div>

      {activeTab === 'GRN' ? (
        /* Goods Receipt Table */
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">GRN Number & Dates</th>
                  <th className="p-3">PO Reference</th>
                  <th className="p-3">Vendor / Supplier</th>
                  <th className="p-3 text-right">Received (Purch UOM)</th>
                  <th className="p-3 text-right">Converted (Inv UOM)</th>
                  <th className="p-3">Batch Number</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {grnGrid.pagedData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      No Goods Receipts recorded for the selected Financial Year.
                    </td>
                  </tr>
                ) : (
                  grnGrid.pagedData.map((grn) => (
                    <tr key={grn.id} className="hover:bg-slate-50 transition">
                      <td className="p-3">
                        <div className="font-bold text-indigo-600">{grn.grnNumber}</div>
                        <div className="text-[11px] text-slate-500 font-semibold">
                          Doc: {grn.receiptDate}
                          {grn.accountingPostingDate && grn.accountingPostingDate !== grn.receiptDate && (
                            <span className="block text-[10px] font-mono text-indigo-700">
                              Post: {grn.accountingPostingDate}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 font-bold text-slate-800">{grn.poNumber}</td>

                      <td className="p-3">
                        <div className="font-bold text-slate-900">{grn.vendorName}</div>
                        <div className="text-[11px] text-slate-400">Challan: {grn.challanNumber}</div>
                      </td>

                      <td className="p-3 text-right font-bold text-indigo-700">
                        {grn.lines[0]?.receivedQtyPurchUom} {grn.lines[0]?.purchaseUom}
                      </td>

                      <td className="p-3 text-right font-bold text-emerald-700">
                        {grn.lines[0]?.convertedQtyInvUom} {grn.lines[0]?.inventoryUom}
                        <div className="text-[10px] text-slate-400 font-normal">
                          (Ratio: 1 {grn.lines[0]?.purchaseUom} = {grn.lines[0]?.conversionRatio}{' '}
                          {grn.lines[0]?.inventoryUom})
                        </div>
                      </td>

                      <td className="p-3 font-mono text-[11px] text-slate-600">
                        {grn.lines[0]?.batchNumber}
                      </td>

                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {grn.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-slate-100 bg-slate-50/40">
            <DataGridFooter
              currentPage={grnGrid.currentPage}
              totalPages={grnGrid.totalPages}
              pageSize={grnGrid.pageSize}
              totalRecords={grnGrid.totalRecords}
              onPageChange={grnGrid.setCurrentPage}
              onPageSizeChange={grnGrid.setPageSize}
              pageSizeOptions={grnGrid.pageSizeOptions}
              defaultSortNotice="Sorted newest first (Receipt Date DESC)"
            />
          </div>
        </div>
      ) : (
        /* Supplier Invoice Matching Table (Part O) */
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Internal & Supplier Inv #</th>
                  <th className="p-3">PO / GRN Refs</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3 text-right">Gross Amount (₹)</th>
                  <th className="p-3">Matching Outcome</th>
                  <th className="p-3">Posting Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {invGrid.pagedData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      No Supplier Invoices found for the selected Financial Year.
                    </td>
                  </tr>
                ) : (
                  invGrid.pagedData.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition">
                      <td className="p-3">
                        <div className="font-bold text-indigo-600">{inv.internalInvoiceNumber}</div>
                        <div className="text-[11px] text-slate-600 font-mono">
                          {inv.supplierInvoiceNumber}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Inv: {inv.invoiceDate} • Post: {inv.accountingPostingDate || inv.invoiceDate}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-slate-800">{inv.poNumber || 'NO PO'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          GRN: {inv.grnNumbers.length > 0 ? inv.grnNumbers.join(', ') : 'None'}
                        </div>
                      </td>

                      <td className="p-3 font-mono font-bold text-slate-700">
                        {inv.matchingSnapshot.matchingModeUsed}
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        ₹{inv.totalGrossAmount.toLocaleString()}
                      </td>

                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.matchingOutcome === 'MATCHED' ||
                            inv.matchingOutcome === 'MATCHED_WITHIN_TOLERANCE' ||
                            inv.matchingOutcome === 'APPROVED_FOR_POSTING'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inv.matchingOutcome === 'PENDING_EXCEPTION_APPROVAL'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {inv.matchingOutcome.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="p-3 font-semibold text-xs">
                        {inv.postingStatus.replace(/_/g, ' ')}
                      </td>

                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[11px] cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect Variances</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-slate-100 bg-slate-50/40">
            <DataGridFooter
              currentPage={invGrid.currentPage}
              totalPages={invGrid.totalPages}
              pageSize={invGrid.pageSize}
              totalRecords={invGrid.totalRecords}
              onPageChange={invGrid.setCurrentPage}
              onPageSizeChange={invGrid.setPageSize}
              pageSizeOptions={invGrid.pageSizeOptions}
              defaultSortNotice="Sorted newest first (Invoice Date DESC)"
            />
          </div>
        </div>
      )}

      {/* Post GRN Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Post Goods Receipt & Authoritative UOM Conversion
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">PO Reference Number</label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GRN Receipt Date</label>
                  <input
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Accounting Posting Date
                  </label>
                  <input
                    type="date"
                    value={grnPostingDate}
                    onChange={(e) => setGrnPostingDate(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Vendor Delivery Challan #
                </label>
                <input
                  type="text"
                  value={challanNumber}
                  onChange={(e) => setChallanNumber(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Received Quantity in Purchase UOM ({uomSnap.purchaseUom})
                </label>
                <input
                  type="number"
                  value={recQtyPurchUom}
                  onChange={(e) => setRecQtyPurchUom(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-indigo-700"
                />
              </div>

              <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl text-indigo-900 font-semibold space-y-1">
                <div>Calculated Inventory Receipt Posting:</div>
                <div className="text-sm font-black text-indigo-950">
                  {recQtyPurchUom} {uomSnap.purchaseUom} × {uomSnap.conversionRatio} ={' '}
                  <span className="text-emerald-700">
                    {calculatedInvQty} {uomSnap.inventoryUom}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePostReceipt}
                className="px-4 py-1.5 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-700 cursor-pointer"
              >
                Post GRN & Update Inventory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit & Match Supplier Invoice Modal (Part O) */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                Submit & Match Supplier Invoice (2-Way / 3-Way Governance)
              </h3>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Supplier Invoice Number *
                </label>
                <input
                  type="text"
                  value={invSupplierNumber}
                  onChange={(e) => setInvSupplierNumber(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">PO Number *</label>
                <input
                  type="text"
                  value={invPoNumber}
                  onChange={(e) => setInvPoNumber(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={invDate}
                  onChange={(e) => setInvDate(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Accounting Posting Date
                </label>
                <input
                  type="date"
                  value={invPostingDate}
                  onChange={(e) => setInvPostingDate(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Invoiced Quantity (BAG)
                </label>
                <input
                  type="number"
                  value={invQty}
                  onChange={(e) => setInvQty(Number(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Unit Price (₹)</label>
                <input
                  type="number"
                  value={invUnitPrice}
                  onChange={(e) => setInvUnitPrice(Number(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">GST Tax (%)</label>
                <input
                  type="number"
                  value={invTaxPercent}
                  onChange={(e) => setInvTaxPercent(Number(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Freight (₹)</label>
                <input
                  type="number"
                  value={invFreight}
                  onChange={(e) => setInvFreight(Number(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowInvoiceModal(false)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitInvoice}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Evaluate & Match Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Invoice Variances & Exception Workflow Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-700">
                    {selectedInvoice.internalInvoiceNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                    {selectedInvoice.matchingSnapshot.matchingModeUsed}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[10px] font-bold">
                    {selectedInvoice.matchingOutcome.replace(/_/g, ' ')}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Supplier Invoice: {selectedInvoice.supplierInvoiceNumber} ({selectedInvoice.vendorName})
                </h3>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl text-xs border border-slate-200">
              <div>
                <strong>Invoice Date:</strong> {selectedInvoice.invoiceDate}
              </div>
              <div>
                <strong>Posting Date:</strong>{' '}
                {selectedInvoice.accountingPostingDate || selectedInvoice.invoiceDate}
              </div>
              <div>
                <strong>Financial Year:</strong> {selectedInvoice.financialYearCode}
              </div>
              <div>
                <strong>Can Post:</strong>{' '}
                {selectedInvoice.matchingSnapshot.canPostToAccounting ? 'YES' : 'BLOCKED'}
              </div>
            </div>

            {/* Variance Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Matching Variances ({selectedInvoice.matchingSnapshot.variances.length})
              </h4>
              {selectedInvoice.matchingSnapshot.variances.length === 0 ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-900">
                  Zero quantity, price, tax, or freight variances detected. Ready for accounting posting.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedInvoice.matchingSnapshot.variances.map(
                    (v: InvoiceVarianceDetail, i: number) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border text-xs ${
                          !v.withinTolerance
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        <div className="font-bold">
                          {v.varianceType} ({v.withinTolerance ? 'WITHIN TOLERANCE' : 'BLOCK / VARIANCE'}) — Expected: {v.expectedValue}, Invoiced:{' '}
                          {v.invoicedValue}
                        </div>
                        <div className="text-[11px] mt-0.5">{v.description}</div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Variance Exception Request / Approval Controls */}
            {!isHistoricalReadOnly &&
              !selectedInvoice.matchingSnapshot.canPostToAccounting &&
              selectedInvoice.matchingOutcome !== 'DUPLICATE_INVOICE' && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5 text-xs">
                  {!selectedInvoice.matchingSnapshot.exceptionRecord ? (
                    <>
                      <div className="font-bold text-amber-900">
                        Request Variance Exception Approval
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          placeholder="Mandatory variance justification..."
                          value={varianceJustification}
                          onChange={(e) => setVarianceJustification(e.target.value)}
                          className="flex-1 min-w-[200px] px-2.5 py-1.5 bg-white border border-amber-300 rounded text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleRequestException(selectedInvoice)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-xs cursor-pointer"
                        >
                          Request Exception Approval
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-bold text-amber-900">
                        Exception Status: {selectedInvoice.matchingSnapshot.exceptionRecord.status} (Requested by{' '}
                        {selectedInvoice.matchingSnapshot.exceptionRecord.requestedBy})
                      </div>
                      <div className="text-[11px] text-amber-800">
                        Justification:{' '}
                        {selectedInvoice.matchingSnapshot.exceptionRecord.varianceJustification}
                      </div>
                      {selectedInvoice.matchingSnapshot.exceptionRecord.status === 'PENDING' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={approverRemarks}
                            onChange={(e) => setApproverRemarks(e.target.value)}
                            className="flex-1 min-w-[200px] px-2.5 py-1.5 bg-white border border-amber-300 rounded text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleResolveException(selectedInvoice, 'APPROVE')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve Exception</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveException(selectedInvoice, 'REJECT')}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject Exception</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};
