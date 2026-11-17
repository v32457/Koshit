import React, { useState, useMemo } from 'react';
import { FileText, Download, ShieldCheck, Layers, Award, BookOpen, ShoppingBag, Clock, Lock, BarChart3 } from 'lucide-react';
import { User } from '../../types';
import { exportService } from '../../services/exportService';
import { rfqService } from '../../services/rfqService';
import { futureRfqFloatingService } from '../../services/futureRfqFloatingService';
import { vendorPriceRegisterService } from '../../services/vendorPriceRegisterService';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { PurchaseRequisitionService } from '../../services/purchaseRequisitionService';
import { getExpectedDeliveryDate, getPrCurrency, formatEstimatedValue } from '../../services/prGridConfigService';
import { financialYearService } from '../../services/financialYearService';
import { FinancialYearSelector } from '../../components/FinancialYearSelector';
import { EnterpriseDataGrid, GridColumn } from '../../components/EnterpriseDataGrid';
import {
  GOVERNED_REPORT_CATALOG,
  InventoryReportId,
  inventoryReportingService,
} from '../../services/inventoryReportingService';
import { INITIAL_BRANCHES, INITIAL_COMPANIES } from '../../data/seedData';

interface ProcurementReportsViewProps {
  currentUser?: User;
}

export const ProcurementReportsView: React.FC<ProcurementReportsViewProps> = ({ currentUser }) => {
  const [selectedFyId, setSelectedFyId] = useState<string>(
    () => financialYearService.getDefaultFinancialYearForCompany('co-kosh-01')?.id || ''
  );

  // Interactive 14 Governed Inventory & Aging Reports Explorer State
  const [activeReportId, setActiveReportId] = useState<InventoryReportId>('PR_STOCK_AVAILABILITY_VALIDATION');
  const [reportCompanyId, setReportCompanyId] = useState<string>(
    currentUser?.orgId || INITIAL_COMPANIES[0]?.id || 'co-kosh-01'
  );
  const [reportBranchId, setReportBranchId] = useState<string>('ALL');
  const [includeHistoricalClosed, setIncludeHistoricalClosed] = useState<boolean>(false);

  const reportBranches = useMemo(() => {
    try {
      const stored = localStorage.getItem('kosh_branches');
      const all = stored ? JSON.parse(stored) : INITIAL_BRANCHES;
      return all.filter((b: any) => (b.companyId || 'co-kosh-01') === reportCompanyId);
    } catch {
      return INITIAL_BRANCHES.filter((b) => (b.companyId || 'co-kosh-01') === reportCompanyId);
    }
  }, [reportCompanyId]);

  const governedReportResult = useMemo(
    () =>
      inventoryReportingService.generateReport({
        reportId: activeReportId,
        companyId: reportCompanyId,
        branchId: reportBranchId,
        financialYearId: selectedFyId,
        user: currentUser || null,
        includeHistoricalClosed,
      }),
    [activeReportId, reportCompanyId, reportBranchId, selectedFyId, currentUser, includeHistoricalClosed]
  );

  const governedGridColumns: GridColumn<Record<string, any>>[] = useMemo(
    () =>
      governedReportResult.columns.map((col) => ({
        key: col.key,
        header: col.label,
        sortable: true,
        align: col.align || 'left',
        render: (row) => {
          const val = row[col.key];
          if (val === null || val === undefined) return '—';
          if (typeof val === 'number') return <span className="font-mono font-semibold">{val}</span>;
          return <span className="truncate">{String(val)}</span>;
        },
      })),
    [governedReportResult.columns]
  );

  const prFyResult = useMemo(() => {
    const prs = PurchaseRequisitionService.getPurchaseRequisitions();
    return financialYearService.filterTransactionsByFinancialYear({
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
      getFinancialYearCode: (pr) => pr.financialYearCode,
      getAccountingPostingDate: (pr) => pr.accountingPostingDate,
      getDocumentDate: (pr) => pr.documentDate || pr.createdAt?.slice(0, 10),
    });
  }, [selectedFyId, currentUser]);

  const rfqFyResult = useMemo(() => {
    const rfqs = rfqService.getRfqs();
    return financialYearService.filterTransactionsByFinancialYear({
      records: rfqs,
      selectedFyId,
      companyId: 'ALL',
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
  }, [selectedFyId, currentUser]);

  const poFyResult = useMemo(() => {
    const pos = purchaseOrderService.getPOs();
    return financialYearService.filterTransactionsByFinancialYear({
      records: pos,
      selectedFyId,
      companyId: 'ALL',
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
  }, [selectedFyId, currentUser]);

  const combinedGaps = useMemo(
    () => [
      ...prFyResult.dataQualityGaps,
      ...rfqFyResult.dataQualityGaps,
      ...poFyResult.dataQualityGaps,
    ],
    [prFyResult.dataQualityGaps, rfqFyResult.dataQualityGaps, poFyResult.dataQualityGaps]
  );

  const fyLabel = prFyResult.isAllFinancialYears
    ? 'ALL_FY'
    : prFyResult.selectedFy?.financialYearCode.replace(/\s+/g, '_') || 'FY';

  const handleExportPrRegisterCsv = () => {
    const prs = prFyResult.filteredRecords;
    const headers = [
      'PR Number',
      'Financial Year',
      'PR Type',
      'Branch',
      'Department',
      'Requester',
      'Currency',
      'Estimated Value',
      'Expected Delivery Date',
      'PR Date',
      'Budget Status',
      'Approval Status',
    ];
    const tableRows = prs.map((pr) => [
      pr.prNumber,
      pr.financialYearCode || fyLabel,
      pr.prType,
      pr.branchName,
      pr.department,
      pr.requesterName,
      getPrCurrency(pr),
      formatEstimatedValue(pr.estimatedTotalValue, getPrCurrency(pr)),
      getExpectedDeliveryDate(pr) || '—',
      pr.documentDate || (pr.createdAt ? new Date(pr.createdAt).toISOString().slice(0, 10) : '—'),
      pr.budgetValidationStatus,
      pr.status,
    ]);
    exportService.exportToCsv({
      title: `Purchase Requisitions Register Report (${fyLabel})`,
      headers,
      rows: tableRows,
      filenamePrefix: `Kosh_PR_Register_${fyLabel}`,
    });
  };

  const handleExportRfqCsv = () => {
    const rfqs = rfqFyResult.filteredRecords;
    const headers = ['RFQ Number', 'Financial Year', 'Title', 'Company', 'Branch', 'Status', 'Lines Count', 'Deadline', 'Evaluation Mode'];
    const tableRows = rfqs.map((r) => [
      r.rfqNumber,
      r.financialYearCode || fyLabel,
      r.title,
      r.companyCode,
      r.branchName,
      r.status,
      r.lines.length,
      r.responseDeadline,
      r.evaluationMethod,
    ]);
    exportService.exportToCsv({
      title: `RFQ Register & Status Report (${fyLabel})`,
      headers,
      rows: tableRows,
      filenamePrefix: `Kosh_RFQ_Register_${fyLabel}`,
    });
  };

  const handleExportDemandCsv = () => {
    const items = futureRfqFloatingService.getDemandItems();
    const headers = ['PR Number', 'Company', 'Branch', 'Item Code', 'Description', 'Required Qty (Inv UOM)', 'Inv UOM', 'Required Qty (Purch UOM)', 'Purch UOM', 'Sourcing Status'];
    const tableRows = items.map((i) => [
      i.prNumber,
      i.companyCode,
      i.branchName,
      i.itemCode,
      i.description,
      i.requiredQuantityInvUom,
      i.inventoryUom,
      i.requiredQuantityPurchUom,
      i.purchaseUom,
      i.sourcingStatus,
    ]);
    exportService.exportToCsv({
      title: 'Future RFQ Demand Pipeline',
      headers,
      rows: tableRows,
      filenamePrefix: 'Kosh_Future_RFQ_Demand',
    });
  };

  const handleExportPriceRegisterCsv = () => {
    const agrs = vendorPriceRegisterService.getAgreements();
    const headers = ['Agreement Number', 'RFQ Number', 'Vendor Code', 'Vendor Name', 'Item Code', 'Approved Price (Purch UOM)', 'Purch UOM', 'Allocation %', 'Status'];
    const tableRows = agrs.map((a) => [
      a.agreementNumber,
      a.rfqNumber,
      a.vendorCode,
      a.vendorName,
      a.itemCode,
      a.approvedUnitPricePurchUom,
      a.purchaseUom,
      a.allocationPercent,
      a.status,
    ]);
    exportService.exportToCsv({
      title: 'Vendor Item Price Register',
      headers,
      rows: tableRows,
      filenamePrefix: 'Kosh_Vendor_Price_Register',
    });
  };

  const handleExportPoVarianceCsv = () => {
    const pos = poFyResult.filteredRecords;
    const headers = ['PO Number', 'Financial Year', 'PO Date', 'Posting Date', 'Vendor Name', 'Gross Value', 'Price Source', 'Has Override', 'Override Justification', 'Status'];
    const tableRows = pos.map((p) => [
      p.poNumber,
      p.financialYearCode || fyLabel,
      p.poDate,
      p.accountingPostingDate || p.poDate,
      p.vendorName,
      p.totalGrossValue,
      p.priceSourceMode,
      p.hasOverride ? 'YES' : 'NO',
      p.overrideJustification || 'None',
      p.status,
    ]);
    exportService.exportToCsv({
      title: `PO Sourcing Variance & Overrides (${fyLabel})`,
      headers,
      rows: tableRows,
      filenamePrefix: `Kosh_PO_Sourcing_Variance_${fyLabel}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <span>Procurement Reports & Governance Exports</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Financial-year scoped CSV exports and 14 governed Inventory, Cross-Branch & Dual Aging reports.
          </p>
        </div>
      </div>

      <FinancialYearSelector
        selectedFyId={selectedFyId}
        onSelectFy={setSelectedFyId}
        currentUser={currentUser}
        dataQualityGaps={combinedGaps}
        entityLabel="Procurement Reports"
      />

      {/* Interactive 14 Governed Inventory, Cross-Branch, Dual Aging & Audit Reports Explorer */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <span>Governed Inventory Availability, Cross-Branch, Stock Aging & PR Aging Reports (14 Reports)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict company/branch isolation, RBAC permission verification, default Newest-First sorting, and scoped Current Page / All Filtered exports.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              aria-label="Report Company Scope"
              value={reportCompanyId}
              onChange={(e) => {
                setReportCompanyId(e.target.value);
                setReportBranchId('ALL');
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold"
            >
              {INITIAL_COMPANIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            <select
              aria-label="Report Branch Scope"
              value={reportBranchId}
              onChange={(e) => setReportBranchId(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold"
            >
              <option value="ALL">All Company Branches</option>
              {reportBranches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={includeHistoricalClosed}
                onChange={(e) => setIncludeHistoricalClosed(e.target.checked)}
                className="rounded accent-indigo-600"
              />
              <span>Include Historical Closed PRs</span>
            </label>
          </div>
        </div>

        {/* 14-Report Selector Grid */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Select Governed Report"
            value={activeReportId}
            onChange={(e) => setActiveReportId(e.target.value as InventoryReportId)}
            className="flex-1 min-w-[260px] px-3 py-2 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-950"
          >
            {GOVERNED_REPORT_CATALOG.map((rpt) => (
              <option key={rpt.id} value={rpt.id}>
                [{rpt.code}] {rpt.title}
              </option>
            ))}
          </select>
        </div>

        {/* Selected Report Description & Summary Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
          <span className="text-slate-700 font-medium">{governedReportResult.meta.description}</span>
          <div className="flex flex-wrap items-center gap-2">
            {governedReportResult.summary.map((s) => (
              <span
                key={s.label}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-800"
              >
                {s.label}: <span className="font-mono text-indigo-700">{s.value}</span>
              </span>
            ))}
          </div>
        </div>

        {!governedReportResult.authorized ? (
          <div className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-3 text-xs font-bold">
            <Lock className="w-5 h-5 text-amber-700 shrink-0" />
            <span>{governedReportResult.error}</span>
          </div>
        ) : (
          <EnterpriseDataGrid
            gridId={`governed-report-${activeReportId}`}
            userId={currentUser?.id}
            moduleTitle={governedReportResult.meta.title}
            data={governedReportResult.rows}
            columns={governedGridColumns}
            rowKey={(row) => String(row.id ?? row.prNumber ?? row.itemCode ?? JSON.stringify(row))}
            defaultSortField={governedReportResult.meta.defaultSortField}
            defaultSortDirection="desc"
            defaultPageSize={20}
            exportFileName={governedReportResult.meta.code.toLowerCase()}
          />
        )}
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-emerald-50 text-emerald-700 w-fit rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {prFyResult.filteredRecords.length} PRs in FY
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">Purchase Requisitions Register Report</h3>
            <p className="text-xs text-slate-500">Complete PR register with Currency, Estimated Value, Expected Delivery Date, Budget Status, and Approval tracking.</p>
          </div>
          <button
            onClick={handleExportPrRegisterCsv}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export PR Register (CSV)</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-indigo-50 text-indigo-700 w-fit rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                {rfqFyResult.filteredRecords.length} RFQs in FY
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">Sourcing Register & Status Report</h3>
            <p className="text-xs text-slate-500">Complete register of all RFQ documents, line items, deadline dates, and status tracking.</p>
          </div>
          <button
            onClick={handleExportRfqCsv}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Sourcing Register (CSV)</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="p-2.5 bg-blue-50 text-blue-700 w-fit rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Future RFQ Demand Pipeline</h3>
            <p className="text-xs text-slate-500">Approved PR demand items queued for competitive sourcing in RFQ-enabled branches.</p>
          </div>
          <button
            onClick={handleExportDemandCsv}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>Export Demand Pipeline (CSV)</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="p-2.5 bg-teal-50 text-teal-700 w-fit rounded-lg">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Vendor Item Price Register</h3>
            <p className="text-xs text-slate-500">Active approved prices, split allocation percentages, and validity dates from RFQ awards.</p>
          </div>
          <button
            onClick={handleExportPriceRegisterCsv}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>Export Price Register (CSV)</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-rose-50 text-rose-700 w-fit rounded-lg">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                {poFyResult.filteredRecords.length} POs in FY
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">PO Sourcing Variance & Overrides</h3>
            <p className="text-xs text-slate-500">Audit report of buyer/approver allocation overrides, price deviations, and financial impact.</p>
          </div>
          <button
            onClick={handleExportPoVarianceCsv}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>Export PO Sourcing Variances (CSV)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
