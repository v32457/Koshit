import React, { useState } from 'react';
import {
  ShoppingBag,
  ShieldCheck,
  AlertTriangle,
  Brain,
  MessageSquare,
  Send,
  X,
  CheckCircle2,
  XCircle,
  RotateCcw,
  UserCheck,
  Building,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { User } from '../../types';
import { PurchaseOrderHeader } from '../../types/rfqSourcing';
import { rfqExaminerService } from '../../services/rfqExaminerService';
import { RfqApproverChatQa } from '../../types/rfqSourcing';

interface PoApprovalDetailModalProps {
  po: PurchaseOrderHeader;
  currentUser: User;
  readOnlyHistorical?: boolean;
  historicalLockReason?: string;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
}

export const PoApprovalDetailModal: React.FC<PoApprovalDetailModalProps> = ({
  po,
  currentUser,
  readOnlyHistorical = false,
  historicalLockReason,
  onClose,
  onApprove,
  onReject,
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ALLOCATION_OVERRIDE' | 'EXAMINER_CHAT'>('ALLOCATION_OVERRIDE');
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatLogs, setChatLogs] = useState<RfqApproverChatQa[]>(() => rfqExaminerService.getChatLogs());
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleSendQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatQuestion.trim()) return;

    const qa = rfqExaminerService.askApproverChat(po.lines[0]?.rfqNumberRef || po.id, chatQuestion, currentUser.fullName);
    setChatLogs([qa, ...chatLogs]);
    setChatQuestion('');
  };

  const firstProposal = po.allocationProposals[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                {po.poNumber}
              </span>
              <span className="text-xs font-semibold text-slate-500">{po.companyCode} • {po.branchName}</span>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 mt-1">
              Purchase Order Approval & Sourcing Variance Review
            </h2>
          </div>

          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveTab('ALLOCATION_OVERRIDE')}
            className={`pb-2.5 px-3 border-b-2 transition ${
              activeTab === 'ALLOCATION_OVERRIDE'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Vendor Allocation & Price Deviations
          </button>

          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`pb-2.5 px-3 border-b-2 transition ${
              activeTab === 'OVERVIEW'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            PO Line Details & Financials
          </button>

          <button
            onClick={() => setActiveTab('EXAMINER_CHAT')}
            className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'EXAMINER_CHAT'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Brain className="w-4 h-4 text-emerald-500" />
            <span>Embedded AI Examiner Intelligence</span>
          </button>
        </div>

        {/* TAB 1: ALLOCATION & PRICE DEVIATIONS (PROMINENT DISPLAY) */}
        {activeTab === 'ALLOCATION_OVERRIDE' && (
          <div className="space-y-4 flex-1">
            {/* Override Banner */}
            {po.hasOverride && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>PROMINENT NOTICE: BUYER SOURCING OVERRIDE DETECTED</span>
                </div>
                <p className="text-xs text-amber-900 font-medium">
                  <strong>Override Justification:</strong> {po.overrideJustification || firstProposal?.overrideJustification}
                </p>
                {firstProposal?.overrideProposedBy && (
                  <div className="text-[11px] text-amber-700 font-semibold">
                    Proposed By: {firstProposal.overrideProposedBy}
                  </div>
                )}
              </div>
            )}

            {/* Original vs Proposed Vendor Allocation Comparison Table */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                <span>Original Approved vs Proposed Vendor Allocation Comparison</span>
                <span className="text-[11px] text-indigo-600 font-normal">Price Source: {po.priceSourceMode}</span>
              </h3>

              {firstProposal ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-2.5">Supplier Name</th>
                        <th className="p-2.5 text-center">Original Split %</th>
                        <th className="p-2.5 text-center">Proposed Split %</th>
                        <th className="p-2.5 text-right">Proposed Qty (Purch UOM)</th>
                        <th className="p-2.5 text-right">Approved Unit Price</th>
                        <th className="p-2.5 text-right">Line Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {firstProposal.vendorAllocations.map((v) => {
                        const isDiff = v.originalAllocationPercent !== v.proposedAllocationPercent;
                        return (
                          <tr key={v.vendorId} className={isDiff ? 'bg-amber-50/50 font-semibold' : ''}>
                            <td className="p-2.5">
                              <div className="font-bold text-slate-900">{v.vendorName}</div>
                              <div className="text-[10px] text-slate-400">{v.priceAgreementRef}</div>
                            </td>

                            <td className="p-2.5 text-center font-bold text-slate-600">
                              {v.originalAllocationPercent}%
                            </td>

                            <td className="p-2.5 text-center font-bold text-indigo-700">
                              <span className={isDiff ? 'text-amber-700 underline' : ''}>
                                {v.proposedAllocationPercent}%
                              </span>
                            </td>

                            <td className="p-2.5 text-right font-bold text-slate-900">
                              {v.proposedQtyPurchUom} BAGS
                            </td>

                            <td className="p-2.5 text-right font-semibold text-emerald-700">
                              ₹{v.unitPricePurchUom.toLocaleString()}
                            </td>

                            <td className="p-2.5 text-right font-bold text-slate-900">
                              ₹{v.lineTotalValue.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-slate-500">Standard single-vendor allocation applies.</div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: OVERVIEW & PO LINES */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-4 flex-1">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div><strong>Vendor:</strong> {po.vendorName}</div>
              <div><strong>Buyer:</strong> {po.buyerName}</div>
              <div><strong>Purchasing Manager:</strong> {po.purchasingManagerName}</div>
              <div><strong>Payment Terms:</strong> {po.paymentTerms}</div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold">
                  <tr>
                    <th className="p-2.5">Item Code & Description</th>
                    <th className="p-2.5 text-right">Order Qty (Purch UOM)</th>
                    <th className="p-2.5 text-right">Converted Qty (Inv UOM)</th>
                    <th className="p-2.5 text-right">Unit Price</th>
                    <th className="p-2.5 text-right">Total Net (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {po.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="p-2.5">
                        <div className="font-bold">{l.itemCode}</div>
                        <div className="text-[11px] text-slate-500">{l.description}</div>
                      </td>
                      <td className="p-2.5 text-right font-bold text-indigo-600">{l.orderQtyPurchUom} {l.purchaseUom}</td>
                      <td className="p-2.5 text-right font-bold text-slate-800">{l.orderQtyInvUom} {l.inventoryUom}</td>
                      <td className="p-2.5 text-right font-semibold">₹{l.unitPricePurchUom.toLocaleString()}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900">₹{l.totalAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: EMBEDDED EXAMINER CHAT INTELLIGENCE */}
        {activeTab === 'EXAMINER_CHAT' && (
          <div className="space-y-4 flex-1 flex flex-col">
            <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center gap-3">
              <Brain className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-xs font-bold">Embedded AI Examiner Decision Intelligence</div>
                <div className="text-[11px] text-slate-300">
                  Ask questions about supplier comparisons, technical compliance, market price benchmark variance, or allocation changes.
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50 max-h-60 overflow-y-auto flex-1 text-xs">
              {chatLogs.map((q) => (
                <div key={q.id} className="space-y-2">
                  <div className="flex justify-end">
                    <div className="bg-indigo-600 text-white p-2.5 rounded-xl rounded-tr-none max-w-md font-medium">
                      {q.question}
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-200 text-slate-800 p-3 rounded-xl rounded-tl-none max-w-lg space-y-2 shadow-xs">
                      <div className="font-medium">{q.answer}</div>
                      {q.evidenceReferences && q.evidenceReferences.length > 0 && (
                        <div className="border-t border-slate-100 pt-1.5 text-[10px] text-slate-500 space-y-0.5">
                          <div className="font-bold text-indigo-700">Verified Evidence References:</div>
                          {q.evidenceReferences.map((ref, i) => (
                            <div key={i}>• {ref}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Question Input Form */}
            <form onSubmit={handleSendQuestion} className="flex gap-2">
              <input
                type="text"
                value={chatQuestion}
                onChange={(e) => setChatQuestion(e.target.value)}
                placeholder="Ask Examiner (e.g. Why is BASF allocation 60%? Compare price vs market benchmark)..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ask</span>
              </button>
            </form>
          </div>
        )}

        {/* Rejection Input */}
        {showRejectInput && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl space-y-2">
            <label className="block text-xs font-bold text-rose-900">Mandatory Rejection Reason *</label>
            <input
              type="text"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="State reason for rejecting PO allocation..."
              className="w-full p-2 bg-white border border-rose-300 rounded-lg text-xs text-slate-800"
            />
          </div>
        )}

        {/* Footer Actions (Centralized Workflow Controls) */}
        <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            Authorized Approver: <strong>{currentUser.fullName} ({currentUser.role})</strong>
            {readOnlyHistorical && (
              <span className="block text-amber-700 font-bold mt-0.5">
                {historicalLockReason || 'Closed financial year / locked accounting period — inspection only.'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {readOnlyHistorical ? (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                Close (Read-Only Historical View)
              </button>
            ) : !showRejectInput ? (
              <>
                <button
                  onClick={() => setShowRejectInput(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject PO</span>
                </button>

                <button
                  onClick={onApprove}
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Authorize & Release PO</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowRejectInput(false)}
                  className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onReject(rejectionReason)}
                  disabled={!rejectionReason.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
