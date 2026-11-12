import React from 'react';
import { FileText, Download, ShieldCheck, Layers, Award, BookOpen, ShoppingBag, Clock } from 'lucide-react';
import { exportService } from '../../services/exportService';
import { rfqService } from '../../services/rfqService';
import { futureRfqFloatingService } from '../../services/futureRfqFloatingService';
import { vendorPriceRegisterService } from '../../services/vendorPriceRegisterService';
import { purchasePriceBookService } from '../../services/purchasePriceBookService';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { EnterpriseAuditService } from '../../services/enterpriseAuditService';

export const ProcurementReportsView: React.FC = () => {
  const handleExportRfqCsv = () => {
    const rfqs = rfqService.getRfqs();
    const headers = ['RFQ Number', 'Title', 'Company', 'Branch', 'Status', 'Lines Count', 'Deadline', 'Evaluation Mode'];
    const tableRows = rfqs.map((r) => [
      r.rfqNumber,
      r.title,
      r.companyCode,
      r.branchName,
      r.status,
      r.lines.length,
      r.responseDeadline,
      r.evaluationMethod,
    ]);
    exportService.exportToCsv({
      title: 'RFQ Register & Status Report',
      headers,
      rows: tableRows,
      filenamePrefix: 'Kosh_RFQ_Register',
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
      title: 'Future RFQ Floating Demand Pipeline',
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
    const pos = purchaseOrderService.getPOs();
    const headers = ['PO Number', 'Vendor Name', 'Gross Value', 'Price Source', 'Has Override', 'Override Justification', 'Status'];
    const tableRows = pos.map((p) => [
      p.poNumber,
      p.vendorName,
      p.totalGrossValue,
      p.priceSourceMode,
      p.hasOverride ? 'YES' : 'NO',
      p.overrideJustification || 'None',
      p.status,
    ]);
    exportService.exportToCsv({
      title: 'PO Sourcing Variance & Overrides',
      headers,
      rows: tableRows,
      filenamePrefix: 'Kosh_PO_Sourcing_Variance',
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
            Export-ready CSV, Excel, and PDF audit reports across all procurement sourcing modules.
          </p>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 w-fit rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">RFQ Register & Status Report</h3>
            <p className="text-xs text-slate-500">Complete register of all RFQ documents, line items, deadline dates, and status tracking.</p>
          </div>
          <button
            onClick={handleExportRfqCsv}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>Export RFQ Register (CSV)</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="p-2.5 bg-blue-50 text-blue-700 w-fit rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Future RFQ Floating Demand Pipeline</h3>
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
            <div className="p-2.5 bg-rose-50 text-rose-700 w-fit rounded-lg">
              <ShoppingBag className="w-5 h-5" />
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
