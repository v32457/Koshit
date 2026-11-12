import React, { useState } from 'react';
import { Award, Search, Filter, Calendar, CheckCircle2, Building, ShieldCheck } from 'lucide-react';
import { vendorPriceRegisterService } from '../../services/vendorPriceRegisterService';
import { VendorItemPriceAgreement } from '../../types/rfqSourcing';

export const VendorPriceRegisterView: React.FC = () => {
  const [agreements] = useState<VendorItemPriceAgreement[]>(() => vendorPriceRegisterService.getAgreements());
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = agreements.filter(a =>
    a.agreementNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.itemCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            <span>Approved Vendor Item Price Register (RFQ Sourcing)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Active approved price agreements resulting from competitive RFQ awards for RFQ-enabled companies and branches.
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-lg text-emerald-900 text-xs font-semibold flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Active PO Purchasing Price Source</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Agreement #, Vendor, Item Code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Register Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Agreement & RFQ #</th>
                <th className="p-3">Supplier Name</th>
                <th className="p-3">Item Details</th>
                <th className="p-3 text-right">Approved Price (Purch UOM)</th>
                <th className="p-3 text-center">Split Allocation</th>
                <th className="p-3 text-center">MOQ</th>
                <th className="p-3">Validity Period</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filtered.map((agr) => (
                <tr key={agr.id} className="hover:bg-slate-50 transition">
                  <td className="p-3">
                    <div className="font-bold text-indigo-600">{agr.agreementNumber}</div>
                    <div className="text-[11px] text-slate-400 font-semibold">{agr.rfqNumber}</div>
                  </td>

                  <td className="p-3">
                    <div className="font-bold text-slate-900">{agr.vendorName}</div>
                    <div className="text-[11px] text-slate-500">{agr.vendorCode}</div>
                  </td>

                  <td className="p-3">
                    <div className="font-bold text-slate-900">{agr.itemCode}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-xs">{agr.description}</div>
                  </td>

                  <td className="p-3 text-right font-bold text-emerald-700">
                    ₹{agr.approvedUnitPricePurchUom.toLocaleString()} / {agr.purchaseUom}
                    <div className="text-[10px] text-slate-400 font-normal">
                      (1 {agr.purchaseUom} = {agr.conversionRatio} {agr.inventoryUom})
                    </div>
                  </td>

                  <td className="p-3 text-center font-bold text-indigo-700">
                    {agr.allocationPercent}%
                  </td>

                  <td className="p-3 text-center">{agr.moq} {agr.purchaseUom}</td>

                  <td className="p-3 font-medium">
                    {agr.effectiveFrom} to {agr.effectiveTo}
                  </td>

                  <td className="p-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {agr.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
