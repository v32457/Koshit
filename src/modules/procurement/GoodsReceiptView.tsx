import React, { useState } from 'react';
import { PackageCheck, Search, Plus, CheckCircle2, RefreshCw } from 'lucide-react';
import { User, Company, Branch } from '../../types';
import { goodsReceiptService } from '../../services/goodsReceiptService';
import { uomConversionService } from '../../services/uomConversionService';
import { GoodsReceiptHeader } from '../../types/rfqSourcing';

interface GoodsReceiptViewProps {
  currentUser: User;
  companies: Company[];
  branches: Branch[];
}

export const GoodsReceiptView: React.FC<GoodsReceiptViewProps> = ({ currentUser }) => {
  const [receipts, setReceipts] = useState<GoodsReceiptHeader[]>(() => goodsReceiptService.getReceipts());
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New GRN form state
  const [poNumber, setPoNumber] = useState('PO-2026-0001');
  const [challanNumber, setChallanNumber] = useState(`DC-VENDOR-${Math.floor(Math.random() * 9000) + 1000}`);
  const [itemCode, setItemCode] = useState('RMPAOPOEXLG0001');
  const [recQtyPurchUom, setRecQtyPurchUom] = useState<number>(12);

  const uomSnap = uomConversionService.getUomSnapshot(itemCode);
  const calculatedInvQty = recQtyPurchUom * uomSnap.conversionRatio;

  const handlePostReceipt = () => {
    goodsReceiptService.postGoodsReceipt(
      {
        poNumber,
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        branchName: 'Puducherry Plant',
        vendorId: 'bp-002',
        vendorName: 'BASF INDIA LIMITED',
        challanNumber,
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
          warehouseCode: 'PDY-STR',
          batchNumber: `BATCH-${Date.now()}`,
          remarks: 'Goods Receipt posted with UOM conversion.',
        },
      ]
    );

    setReceipts(goodsReceiptService.getReceipts());
    setShowCreateModal(false);
    alert(`Goods Receipt posted! ${recQtyPurchUom} ${uomSnap.purchaseUom} converted to ${calculatedInvQty} ${uomSnap.inventoryUom} for inventory receipt.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-indigo-600" />
            <span>Goods Receipt & Dual UOM Inventory Posting</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Capture Goods Receipt in Purchase UOM and perform authoritative conversion into Inventory UOM for inventory balances.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Post New Goods Receipt (GRN)</span>
        </button>
      </div>

      {/* Goods Receipt Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">GRN Number & Date</th>
                <th className="p-3">PO Reference</th>
                <th className="p-3">Vendor / Supplier</th>
                <th className="p-3 text-right">Received (Purch UOM)</th>
                <th className="p-3 text-right">Converted (Inv UOM)</th>
                <th className="p-3">Batch Number</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {receipts.map((grn) => (
                <tr key={grn.id} className="hover:bg-slate-50 transition">
                  <td className="p-3">
                    <div className="font-bold text-indigo-600">{grn.grnNumber}</div>
                    <div className="text-[11px] text-slate-400 font-semibold">{grn.receiptDate}</div>
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
                      (Ratio: 1 {grn.lines[0]?.purchaseUom} = {grn.lines[0]?.conversionRatio} {grn.lines[0]?.inventoryUom})
                    </div>
                  </td>

                  <td className="p-3 font-mono text-[11px] text-slate-600">{grn.lines[0]?.batchNumber}</td>

                  <td className="p-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {grn.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Post Modal */}
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

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Vendor Delivery Challan #</label>
                <input
                  type="text"
                  value={challanNumber}
                  onChange={(e) => setChallanNumber(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Received Quantity in Purchase UOM ({uomSnap.purchaseUom})</label>
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
                  {recQtyPurchUom} {uomSnap.purchaseUom} × {uomSnap.conversionRatio} = <span className="text-emerald-700">{calculatedInvQty} {uomSnap.inventoryUom}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 font-semibold rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handlePostReceipt}
                className="px-4 py-1.5 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-700"
              >
                Post GRN & Update Inventory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
