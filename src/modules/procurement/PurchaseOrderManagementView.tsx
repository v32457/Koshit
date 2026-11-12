import React, { useState } from 'react';
import { ShoppingBag, Search, Filter, Eye, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { User, Company, Branch } from '../../types';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { PurchaseOrderHeader } from '../../types/rfqSourcing';
import { PoApprovalDetailModal } from './PoApprovalDetailModal';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPo, setSelectedPo] = useState<PurchaseOrderHeader | null>(null);

  const filteredPos = pos.filter(p =>
    p.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.vendorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleApprove = (poId: string) => {
    purchaseOrderService.approvePo(poId, currentUser.fullName);
    setPos(purchaseOrderService.getPOs());
    setSelectedPo(null);
    alert('Purchase Order Authorized & Released successfully!');
  };

  const handleReject = (poId: string, reason: string) => {
    purchaseOrderService.rejectPo(poId, currentUser.fullName, reason);
    setPos(purchaseOrderService.getPOs());
    setSelectedPo(null);
    alert('Purchase Order Rejected.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-600" />
            <span>Purchase Order Management & Multi-Vendor Allocations</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatic price retrieval (RFQ Award vs Price Book), multi-vendor split allocations, and buyer/approver override auditing.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by PO #, Vendor Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* PO List Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">PO Number & Date</th>
                <th className="p-3">Vendor / Supplier</th>
                <th className="p-3">Company / Branch</th>
                <th className="p-3">Price Source</th>
                <th className="p-3 text-right">Gross Value (₹)</th>
                <th className="p-3">Sourcing Override</th>
                <th className="p-3">Approval Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredPos.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50 transition">
                  <td className="p-3">
                    <div className="font-bold text-indigo-600">{po.poNumber}</div>
                    <div className="text-[11px] text-slate-400 font-semibold">{po.poDate}</div>
                  </td>

                  <td className="p-3">
                    <div className="font-bold text-slate-900">{po.vendorName}</div>
                    <div className="text-[11px] text-slate-500">{po.vendorCode}</div>
                  </td>

                  <td className="p-3">
                    <div className="font-semibold text-slate-800">{po.companyCode}</div>
                    <div className="text-[11px] text-slate-500">{po.branchName}</div>
                  </td>

                  <td className="p-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      po.priceSourceMode === 'RFQ_AWARD' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {po.priceSourceMode.replace(/_/g, ' ')}
                    </span>
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
                    ) : (
                      <span className="text-[11px] text-slate-400 font-semibold">Standard Split</span>
                    )}
                  </td>

                  <td className="p-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      po.status === 'APPROVED' || po.status === 'RELEASED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : po.status === 'PENDING_APPROVAL'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {po.status.replace(/_/g, ' ')}
                    </span>
                  </td>

                  <td className="p-3 text-center">
                    <button
                      onClick={() => setSelectedPo(po)}
                      className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs transition"
                    >
                      Inspect & Authorize
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail & Approval Modal */}
      {selectedPo && (
        <PoApprovalDetailModal
          po={selectedPo}
          currentUser={currentUser}
          onClose={() => setSelectedPo(null)}
          onApprove={() => handleApprove(selectedPo.id)}
          onReject={(reason) => handleReject(selectedPo.id, reason)}
        />
      )}
    </div>
  );
};
