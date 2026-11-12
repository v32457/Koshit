import React, { useState } from 'react';
import { FileText, Lock, ShieldCheck, AlertTriangle, Eye, CheckCircle2 } from 'lucide-react';
import { rfqService } from '../../services/rfqService';
import { rfqExaminerService } from '../../services/rfqExaminerService';
import { SupplierQuotation } from '../../types/rfqSourcing';

export const SupplierQuotationsView: React.FC = () => {
  const [quotations] = useState<SupplierQuotation[]>(() => rfqService.getQuotations());
  const [selectedQuot, setSelectedQuot] = useState<SupplierQuotation | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <span>Supplier Quotations & Sealed Submissions</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View submitted supplier quotations, Purchase UOM unit prices, landed costs, and technical compliance status.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg text-indigo-900 text-xs font-semibold">
          <Lock className="w-4 h-4 text-indigo-600" />
          <span>Sealed Commercial Price Controls Active</span>
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">RFQ & Quotation #</th>
                <th className="p-3">Supplier Name</th>
                <th className="p-3 text-center">Revision</th>
                <th className="p-3 text-right">Quoted Value (₹)</th>
                <th className="p-3 text-right">Landed Value (₹)</th>
                <th className="p-3 font-medium">Valid Until</th>
                <th className="p-3 font-medium">Technical Gate</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {quotations.map((quot) => (
                <tr key={quot.id} className="hover:bg-slate-50 transition">
                  <td className="p-3">
                    <div className="font-bold text-indigo-600">{quot.rfqNumber}</div>
                    <div className="text-[11px] text-slate-500 font-semibold">{quot.quotationNumber}</div>
                  </td>

                  <td className="p-3">
                    <div className="font-bold text-slate-900">{quot.vendorName}</div>
                    <div className="text-[11px] text-slate-400">{quot.submittedBy}</div>
                  </td>

                  <td className="p-3 text-center font-bold text-slate-800">
                    Rev {quot.revisionNumber}
                  </td>

                  <td className="p-3 text-right font-semibold">
                    ₹{quot.totalQuotedValue.toLocaleString()}
                  </td>

                  <td className="p-3 text-right font-bold text-indigo-700">
                    ₹{quot.totalLandedValue.toLocaleString()}
                  </td>

                  <td className="p-3">{quot.validUntil}</td>

                  <td className="p-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      quot.technicalComplianceStatus === 'PASS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {quot.technicalComplianceStatus}
                    </span>
                  </td>

                  <td className="p-3 text-center">
                    <button
                      onClick={() => setSelectedQuot(quot)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quotation Detail Modal */}
      {selectedQuot && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-indigo-600">{selectedQuot.quotationNumber}</span>
                <h3 className="text-base font-bold text-slate-900">{selectedQuot.vendorName}</h3>
              </div>
              <button onClick={() => setSelectedQuot(null)} className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg">
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl text-xs border border-slate-200">
              <div><strong>Payment Terms:</strong> {selectedQuot.paymentTerms}</div>
              <div><strong>Incoterms:</strong> {selectedQuot.incoterms}</div>
              <div><strong>Valid Until:</strong> {selectedQuot.validUntil}</div>
              <div><strong>Revision:</strong> Rev {selectedQuot.revisionNumber}</div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Line Items & Landed Price Breakdown</h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2">Item Code</th>
                      <th className="p-2 text-right">Quoted Qty</th>
                      <th className="p-2 text-right">Unit Price ({selectedQuot.lines[0]?.purchaseUom})</th>
                      <th className="p-2 text-right">GST %</th>
                      <th className="p-2 text-right">Freight</th>
                      <th className="p-2 text-right">Landed Unit Price</th>
                      <th className="p-2">Tech Compliance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedQuot.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="p-2 font-bold">{l.itemCode}</td>
                        <td className="p-2 text-right">{l.quotedQuantityPurchUom} {l.purchaseUom}</td>
                        <td className="p-2 text-right">₹{l.unitPricePurchUom.toLocaleString()}</td>
                        <td className="p-2 text-right">{l.gstPercent}%</td>
                        <td className="p-2 text-right">₹{l.freightAmount}</td>
                        <td className="p-2 text-right font-bold text-indigo-700">₹{l.landedUnitPricePurchUom.toLocaleString()}</td>
                        <td className="p-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${l.technicalCompliance === 'COMPLIANT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {l.technicalCompliance}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
