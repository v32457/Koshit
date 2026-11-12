import React, { useState } from 'react';
import { BarChart3, Award, TrendingUp, ShieldCheck, CheckCircle2, Sliders } from 'lucide-react';
import { User } from '../../types';
import { rfqEvaluationService } from '../../services/rfqEvaluationService';
import { vendorPriceRegisterService } from '../../services/vendorPriceRegisterService';
import { rfqService } from '../../services/rfqService';
import { RfqComparativeStatementRow, RfqAwardRecommendation } from '../../types/rfqSourcing';

interface ComparativeStatementViewProps {
  currentUser: User;
  onNavigate: (route: string) => void;
}

export const ComparativeStatementView: React.FC<ComparativeStatementViewProps> = ({
  currentUser,
  onNavigate,
}) => {
  const [rfqId] = useState('rfq-001');
  const statementRows = rfqEvaluationService.generateComparativeStatement(rfqId);

  const handleApproveAward = () => {
    // Publish approved award to Vendor Item Price Register
    const row = statementRows[0];
    if (!row) return;

    row.vendorOffers.forEach((vo) => {
      vendorPriceRegisterService.addAgreement({
        id: `vpa-${Date.now()}-${vo.vendorCode}`,
        agreementNumber: `VPA-2026-${Math.floor(Math.random() * 9000) + 1000}`,
        companyId: 'co-kosh-01',
        companyCode: 'KOSH-HQ',
        branchId: 'br-pond-01',
        branchCode: '001',
        purchaseOrgId: 'po-kosh-01',
        vendorId: vo.vendorId,
        vendorCode: vo.vendorCode,
        vendorName: vo.vendorName,
        itemCode: row.itemCode,
        description: row.description,
        rfqId,
        rfqNumber: 'RFQ-2026-0001',
        awardId: `award-${Date.now()}`,
        approvedUnitPricePurchUom: vo.unitPricePurchUom,
        currency: 'INR',
        purchaseUom: row.purchaseUom,
        inventoryUom: row.inventoryUom,
        conversionRatio: 25,
        moq: 5,
        effectiveFrom: new Date().toISOString().split('T')[0],
        effectiveTo: '2027-05-31',
        allocationPercent: vo.proposedAllocationPercent,
        deliveryLeadTimeDays: vo.leadTimeDays,
        paymentTerms: vo.paymentTerms,
        taxConditions: '18% GST Extra',
        status: 'ACTIVE',
        version: 1,
        approvedBy: currentUser.fullName,
        approvedAt: new Date().toISOString(),
      });
    });

    rfqService.updateRfqStatus(rfqId, 'AWARDED');
    alert('RFQ Award Approved & Published to Vendor Item Price Register successfully!');
    onNavigate('/procurement/price-register');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <span>Commercial Comparative Statement & Award Recommendation</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Line-by-line landed cost comparison, weighted committee scores, market price benchmark variance, and vendor split allocation proposals.
          </p>
        </div>

        <button
          onClick={handleApproveAward}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
        >
          <Award className="w-4 h-4" />
          <span>Approve & Publish Award to Price Register</span>
        </button>
      </div>

      {/* Comparative Statement Table */}
      {statementRows.map((row) => (
        <div key={row.rfqLineId} className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <span className="text-xs font-bold text-indigo-600">{row.itemCode}</span>
              <h2 className="text-sm font-bold text-slate-900">{row.description}</h2>
            </div>
            <div className="text-xs bg-slate-100 px-3 py-1.5 rounded-lg text-slate-700 font-semibold">
              Market Benchmark: <strong className="text-indigo-700">₹{row.marketBenchmarkPrice.toLocaleString()} / {row.purchaseUom}</strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Rank & Vendor Name</th>
                  <th className="p-3 text-right">Quoted Price ({row.purchaseUom})</th>
                  <th className="p-3 text-right">GST %</th>
                  <th className="p-3 text-right">Freight / Unit</th>
                  <th className="p-3 text-right">Landed Unit Price</th>
                  <th className="p-3 text-right">Total Landed Cost</th>
                  <th className="p-3 text-center">Evaluated Score</th>
                  <th className="p-3 text-center">Lead Time</th>
                  <th className="p-3 text-center">Split Allocation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {row.vendorOffers.map((vo) => (
                  <tr key={vo.vendorId} className={vo.rank === 1 ? 'bg-indigo-50/40 font-semibold' : 'hover:bg-slate-50'}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          vo.rank === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          L{vo.rank}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900">{vo.vendorName}</div>
                          <div className="text-[11px] text-slate-500">{vo.vendorCode}</div>
                        </div>
                      </div>
                    </td>

                    <td className="p-3 text-right font-semibold">
                      ₹{vo.unitPricePurchUom.toLocaleString()}
                    </td>

                    <td className="p-3 text-right">{vo.gstPercent}%</td>

                    <td className="p-3 text-right">₹{vo.freightPerUnit}</td>

                    <td className="p-3 text-right font-bold text-indigo-700">
                      ₹{vo.landedUnitPrice.toLocaleString()}
                    </td>

                    <td className="p-3 text-right font-bold text-slate-900">
                      ₹{vo.totalLandedCost.toLocaleString()}
                    </td>

                    <td className="p-3 text-center font-bold text-emerald-700">
                      {vo.evaluatedScore} / 100
                    </td>

                    <td className="p-3 text-center">{vo.leadTimeDays} Days</td>

                    <td className="p-3 text-center">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                        {vo.proposedAllocationPercent}% ({vo.proposedQuantityPurchUom} {row.purchaseUom})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};
