import React from 'react';
import { X, ShieldCheck, Layers, Calculator, Receipt, History, CheckCircle2 } from 'lucide-react';
import { TransactionChargeItem } from '../../types/chargeManagement';
import { formatChargeAmount } from '../../services/prChargeItemService';

interface ChargeDetailsModalProps {
  charge: TransactionChargeItem | null;
  onClose: () => void;
}

export const ChargeDetailsModal: React.FC<ChargeDetailsModalProps> = ({ charge, onClose }) => {
  if (!charge) return null;

  const latestCalc = charge.calculationHistory?.[0];
  const latestAlloc = charge.allocationHistory?.[0];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Charge Details ${charge.chargeCode}`}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#0B192C] text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-indigo-300 text-xs">{charge.chargeCode}</span>
              <span className="text-slate-400">•</span>
              <h3 className="text-sm font-bold">{charge.chargeName}</h3>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Source: {charge.sourceDocumentType} {charge.sourceDocumentNumber} · Stage:{' '}
              {charge.lifecycleStage} · Level: {charge.applicationLevel.replace(/_/g, ' ')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Charge Details Modal"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Financial Stage Progression */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-500">Estimated</div>
              <div className="font-mono font-extrabold text-sm text-slate-800 mt-0.5">
                {formatChargeAmount(charge.estimatedChargeAmount, charge.currency)}
              </div>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-500">Quoted</div>
              <div className="font-mono font-extrabold text-sm text-slate-800 mt-0.5">
                {formatChargeAmount(charge.quotedChargeAmount, charge.currency)}
              </div>
            </div>
            <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/50">
              <div className="text-[10px] font-bold uppercase text-indigo-700">Approved</div>
              <div className="font-mono font-extrabold text-sm text-indigo-900 mt-0.5">
                {formatChargeAmount(charge.approvedChargeAmount, charge.currency)}
              </div>
            </div>
            <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
              <div className="text-[10px] font-bold uppercase text-emerald-700">Actual Invoice</div>
              <div className="font-mono font-extrabold text-sm text-emerald-900 mt-0.5">
                {formatChargeAmount(charge.actualChargeAmount, charge.currency)}
              </div>
            </div>
          </div>

          {/* Calculation & Tax Governance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-indigo-600" />
                Calculation Snapshot
              </h4>
              <div className="grid grid-cols-2 gap-y-1.5 text-[11px]">
                <span className="text-slate-500">Method:</span>
                <span className="font-semibold text-slate-900">
                  {charge.calculationMethod.replace(/_/g, ' ')}
                </span>
                <span className="text-slate-500">Basis:</span>
                <span className="font-semibold text-slate-900">
                  {charge.calculationBasis.replace(/_/g, ' ')}
                </span>
                <span className="text-slate-500">Applied Rate:</span>
                <span className="font-mono font-bold text-slate-900">
                  {charge.rate} ({charge.currency})
                </span>
                <span className="text-slate-500">Active Charge Amount:</span>
                <span className="font-mono font-bold text-indigo-800">
                  {formatChargeAmount(charge.chargeAmount, charge.currency)}
                </span>
                <span className="text-slate-500">Bearer:</span>
                <span className="font-semibold text-slate-900">
                  {charge.chargeBearer.replace(/_/g, ' ')}
                </span>
              </div>
              {latestCalc?.formulaAuditTrace && (
                <div className="mt-2 p-2 rounded bg-slate-50 border border-slate-200 font-mono text-[10px] text-slate-700">
                  Formula Trace: {latestCalc.formulaAuditTrace}
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-600" />
                Statutory Tax & Recoverability Breakdown
              </h4>
              <div className="grid grid-cols-2 gap-y-1.5 text-[11px]">
                <span className="text-slate-500">Tax Rule:</span>
                <span className="font-semibold text-slate-900">{charge.taxBreakdown.taxName}</span>
                <span className="text-slate-500">Treatment:</span>
                <span className="font-mono text-slate-800">{charge.taxBreakdown.treatmentType}</span>
                <span className="text-slate-500">Tax + Surcharge:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatChargeAmount(
                    charge.taxBreakdown.taxAmount + charge.taxBreakdown.surchargeAmount,
                    charge.currency
                  )}
                </span>
                <span className="text-slate-500">Recoverable ITC (Excluded from Landed):</span>
                <span className="font-mono font-bold text-emerald-700">
                  {formatChargeAmount(charge.taxBreakdown.recoverableTax, charge.currency)}
                </span>
                <span className="text-slate-500">Non-Recoverable Tax (Capitalized):</span>
                <span className="font-mono font-bold text-amber-800">
                  {formatChargeAmount(charge.taxBreakdown.nonRecoverableTax, charge.currency)}
                </span>
                <span className="text-slate-500">Total with Tax:</span>
                <span className="font-mono font-extrabold text-indigo-900">
                  {formatChargeAmount(charge.totalWithTax, charge.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Allocation History */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                Header-to-Line Allocation Status ({charge.allocationStatus})
              </h4>
              <span className="text-[11px] font-mono text-slate-600">
                Allocated: {formatChargeAmount(charge.allocatedAmount, charge.currency)} · Remaining:{' '}
                {formatChargeAmount(charge.remainingUnallocatedAmount, charge.currency)}
              </span>
            </div>

            {!latestAlloc || latestAlloc.lines.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">
                No line-level allocations have been executed yet for this charge.
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2">Item Code</th>
                      <th className="p-2">Method</th>
                      <th className="p-2 text-right">Base Share</th>
                      <th className="p-2 text-right">Non-Rec Tax</th>
                      <th className="p-2 text-right">Landed Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {latestAlloc.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="p-2 font-mono font-bold text-slate-900">{line.targetItemCode}</td>
                        <td className="p-2 text-slate-600">{latestAlloc.allocationMethod}</td>
                        <td className="p-2 text-right font-mono">
                          {formatChargeAmount(line.allocatedChargeAmount, charge.currency)}
                        </td>
                        <td className="p-2 text-right font-mono text-amber-800">
                          {formatChargeAmount(line.allocatedNonRecoverableTax, charge.currency)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-indigo-900">
                          {formatChargeAmount(line.allocatedLandedCostContribution, charge.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Approval & Governance */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Approval & Reconciliation Status
            </h4>
            <div className="flex flex-wrap items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1 font-semibold text-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Approval: {charge.approvalStatus}
              </span>
              <span className="flex items-center gap-1 font-semibold text-slate-700">
                <History className="w-3.5 h-3.5 text-indigo-600" />
                Reconciliation: {charge.reconciliationStatus}
              </span>
              {charge.remarks && (
                <span className="text-slate-600">Remarks: {charge.remarks}</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
