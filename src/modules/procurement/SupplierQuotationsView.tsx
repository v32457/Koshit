import React, { useState, useMemo } from 'react';
import {
  FileText,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Eye,
  CheckCircle2,
  Mail,
  Globe,
  Plus,
  History,
  X,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { User } from '../../types';
import { rfqService } from '../../services/rfqService';
import { financialYearService } from '../../services/financialYearService';
import { FinancialYearSelector } from '../../components/FinancialYearSelector';
import { SupplierQuotation } from '../../types/rfqSourcing';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';

interface SupplierQuotationsViewProps {
  currentUser?: User;
}

export const SupplierQuotationsView: React.FC<SupplierQuotationsViewProps> = ({ currentUser }) => {
  const [quotations, setQuotations] = useState<SupplierQuotation[]>(() => rfqService.getQuotations());
  const rfqs = useMemo(() => rfqService.getRfqs(), [quotations]);

  const [selectedFyId, setSelectedFyId] = useState<string>(
    () => financialYearService.getDefaultFinancialYearForCompany('co-kosh-01')?.id || ''
  );
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'PORTAL' | 'EMAIL'>('ALL');
  const [selectedQuot, setSelectedQuot] = useState<SupplierQuotation | null>(null);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Part M Submission Modal (Portal Quote or Inbound Email Quote)
  const [submitMode, setSubmitMode] = useState<'PORTAL' | 'EMAIL' | null>(null);
  const [targetRfqId, setTargetRfqId] = useState<string>(() => rfqs[0]?.id || '');
  const [quoteNumberInput, setQuoteNumberInput] = useState<string>(`QT-${Date.now().toString().slice(-5)}`);
  const [senderEmailInput, setSenderEmailInput] = useState<string>('orders.india@basf.com');
  const [unitPriceInput, setUnitPriceInput] = useState<number>(7450);
  const [freightInput, setFreightInput] = useState<number>(2500);
  const [leadTimeInput, setLeadTimeInput] = useState<number>(7);
  const [verifyRemarks, setVerifyRemarks] = useState<string>('Commercial rates verified against RFQ lines & attached PDF.');

  const reload = () => {
    setQuotations(rfqService.getQuotations());
  };

  const fyResult = useMemo(() => {
    return financialYearService.filterTransactionsByFinancialYear({
      records: quotations,
      selectedFyId,
      companyId: 'co-kosh-01',
      currentUser,
      entityType: 'SUPPLIER_QUOTATION',
      getRecordId: (q) => q.id,
      getDocumentNumber: (q) => q.quotationNumber,
      getCompanyId: (q) => {
        const parent = rfqs.find((r) => r.id === q.rfqId || r.rfqNumber === q.rfqNumber);
        return parent?.companyId || 'co-kosh-01';
      },
      getBranchId: (q) => {
        const parent = rfqs.find((r) => r.id === q.rfqId || r.rfqNumber === q.rfqNumber);
        return parent?.branchId || 'br-pond-01';
      },
      getPurchaseOrgId: (q) => {
        const parent = rfqs.find((r) => r.id === q.rfqId || r.rfqNumber === q.rfqNumber);
        return parent?.purchaseOrgId || 'po-kosh-01';
      },
      getFinancialYearId: (q) => {
        const parent = rfqs.find((r) => r.id === q.rfqId || r.rfqNumber === q.rfqNumber);
        return (q as any).financialYearId || parent?.financialYearId;
      },
      getFinancialYearCode: (q) => {
        const parent = rfqs.find((r) => r.id === q.rfqId || r.rfqNumber === q.rfqNumber);
        return (q as any).financialYearCode || parent?.financialYearCode;
      },
      getDocumentDate: (q) => q.quotationDate,
    });
  }, [quotations, rfqs, selectedFyId, currentUser]);

  const isHistoricalReadOnly = fyResult.isHistoricalReadOnly;

  const visibleQuotations = useMemo(() => {
    return fyResult.filteredRecords.filter((q) => {
      const ch = q.submissionChannel || 'PORTAL';
      return channelFilter === 'ALL' || ch === channelFilter;
    });
  }, [fyResult.filteredRecords, channelFilter]);

  const quotGrid = useStandardDataGrid({
    gridId: 'supplier-quotations',
    userId: currentUser?.id,
    data: visibleQuotations,
    defaultSortField: 'submittedAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'quotationNumber',
    filterSignature: `${selectedFyId}|${channelFilter}`,
  });

  const handleInspectQuotation = (quot: SupplierQuotation) => {
    setErrorNotice(null);
    const res = rfqService.accessCommercialQuotation({
      quotationId: quot.id,
      actorId: currentUser?.id || 'usr-buyer-01',
      actorName: currentUser?.fullName || 'Vikram Singh',
      actorRole: currentUser?.role === 'PLATFORM_ADMIN' ? 'PURCHASING_MANAGER' : 'BUYER',
    });
    reload();
    if (!res.accessAllowed) {
      setErrorNotice(res.denialReason || 'Sealed commercial quotation is locked until opening time.');
      setSelectedQuot(quot); // Open metadata view without commercial unlock
      return;
    }
    setSelectedQuot(res.quotation || quot);
  };

  const handleVerifyEmailQuote = (quot: SupplierQuotation, decision: 'ACCEPT' | 'REJECT') => {
    try {
      const updated = rfqService.verifyEmailQuotationByBuyer({
        quotationId: quot.id,
        buyerId: currentUser?.id || 'usr-buyer-01',
        buyerName: currentUser?.fullName || 'Vikram Singh',
        decision,
        verificationRemarks: verifyRemarks,
      });
      reload();
      setSelectedQuot(updated);
      setAccessNotice(`Inbound email quotation ${quot.quotationNumber} marked ${decision === 'ACCEPT' ? 'BUYER VERIFIED' : 'REJECTED'}.`);
    } catch (err: any) {
      setErrorNotice(err.message);
    }
  };

  const handleSubmitModalQuote = () => {
    setErrorNotice(null);
    const rfq = rfqs.find((r) => r.id === targetRfqId);
    if (!rfq) {
      setErrorNotice('Please select a valid RFQ.');
      return;
    }
    const line = rfq.lines[0];
    try {
      if (submitMode === 'PORTAL') {
        const inv = rfq.invitations[0];
        rfqService.submitPortalQuotation({
          rfqId: rfq.id,
          vendorId: inv?.vendorId || 'bp-002',
          quotationNumber: quoteNumberInput,
          validUntil: rfq.responseDeadline || '2026-12-31',
          paymentTerms: 'NET 45 Days',
          incoterms: rfq.incoterms || 'DDP',
          submittedBy: `${inv?.vendorName || 'BASF INDIA LIMITED'} (Supplier Portal)`,
          lines: [
            {
              rfqLineId: line?.id || 'rfq-line-1',
              itemCode: line?.itemCode || 'RMPAOPOEXLG0001',
              description: line?.description || 'Item Line',
              quotedQuantityPurchUom: line?.quantityPurchUom || 20,
              purchaseUom: line?.purchaseUom || 'BAG',
              unitPricePurchUom: unitPriceInput,
              gstPercent: 18,
              freightAmount: freightInput,
              deliveryLeadTimeDays: leadTimeInput,
              technicalCompliance: 'COMPLIANT',
            },
          ],
          attachments: [
            {
              fileName: `Portal_Offer_${quoteNumberInput}.pdf`,
              fileSize: 384000,
              category: 'COMMERCIAL',
            },
          ],
        });
        setAccessNotice(`Supplier Portal quotation ${quoteNumberInput} submitted cleanly.`);
      } else if (submitMode === 'EMAIL') {
        const res = rfqService.ingestInboundEmailQuotation({
          rfqId: rfq.id,
          senderEmail: senderEmailInput,
          emailMessageId: `<msg-${Date.now()}@supplier.com>`,
          emailSubject: `Quotation for ${rfq.rfqNumber} - ${quoteNumberInput}`,
          emailBodyExcerpt: `Please find attached quotation ${quoteNumberInput} referenced against ${rfq.rfqNumber}.`,
          quotationNumber: quoteNumberInput,
          validUntil: rfq.responseDeadline || '2026-12-31',
          paymentTerms: 'NET 60 Days',
          incoterms: rfq.incoterms || 'DDP',
          rawAttachmentFileNames: [`Email_Quote_${quoteNumberInput}.pdf`],
          lines: [
            {
              rfqLineId: line?.id || 'rfq-line-1',
              itemCode: line?.itemCode || 'RMPAOPOEXLG0001',
              description: line?.description || 'Item Line',
              quotedQuantityPurchUom: line?.quantityPurchUom || 20,
              purchaseUom: line?.purchaseUom || 'BAG',
              unitPricePurchUom: unitPriceInput,
              gstPercent: 18,
              freightAmount: freightInput,
              deliveryLeadTimeDays: leadTimeInput,
              technicalCompliance: 'COMPLIANT',
            },
          ],
        });
        setAccessNotice(
          `Inbound email quotation ${res.quotation.quotationNumber} ingested (Ref: ${res.quotation.emailEvidence?.rfqEmailReference}) — queued for Buyer Verification.`
        );
      }
      reload();
      setSubmitMode(null);
      setQuoteNumberInput(`QT-${Date.now().toString().slice(-5)}`);
    } catch (err: any) {
      setErrorNotice(err.message);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <span>Supplier Quotations — Portal, Email & Sealed Governance (Part M)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Dual-channel quotation intake (Supplier Portal + Verified Inbound Email), sealed bid confidentiality audit, and revision preservation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isHistoricalReadOnly}
            onClick={() => {
              setErrorNotice(null);
              setSubmitMode('PORTAL');
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Submit Portal Quotation</span>
          </button>

          <button
            type="button"
            disabled={isHistoricalReadOnly}
            onClick={() => {
              setErrorNotice(null);
              setSubmitMode('EMAIL');
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Mail className="w-3.5 h-3.5 text-amber-400" />
            <span>Ingest Email Quotation</span>
          </button>
        </div>
      </div>

      {/* Centralized Financial Year Selector */}
      <FinancialYearSelector
        companyId="co-kosh-01"
        selectedFyId={selectedFyId}
        onSelectFy={setSelectedFyId}
        currentUser={currentUser}
        dataQualityGaps={fyResult.dataQualityGaps}
        entityLabel="Supplier Quotations"
      />

      {accessNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{accessNotice}</span>
          </div>
          <button onClick={() => setAccessNotice(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorNotice && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorNotice}</span>
          </div>
          <button onClick={() => setErrorNotice(null)} className="text-rose-700 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Channel Filter Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(['ALL', 'PORTAL', 'EMAIL'] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => setChannelFilter(ch)}
              className={`px-3 py-1.5 rounded-lg font-bold border transition cursor-pointer ${
                channelFilter === ch
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {ch === 'ALL' ? 'All Channels' : ch === 'PORTAL' ? 'Supplier Portal Bids' : 'Inbound Email Bids'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg text-indigo-900 text-xs font-semibold">
          <Lock className="w-4 h-4 text-indigo-600" />
          <span>Sealed Confidentiality & Access Audit Active ({visibleQuotations.length} Quotes)</span>
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">RFQ & Quotation #</th>
                <th className="p-3">Channel & Evidence</th>
                <th className="p-3">Supplier Name</th>
                <th className="p-3 text-center">Rev</th>
                <th className="p-3 text-right">Quoted Value (₹)</th>
                <th className="p-3 text-right">Landed Value (₹)</th>
                <th className="p-3">Verification / Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {quotGrid.pagedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    No quotations found for the selected Financial Year and channel filter.
                  </td>
                </tr>
              ) : (
                quotGrid.pagedData.map((quot) => {
                  const channel = quot.submissionChannel || 'PORTAL';
                  return (
                    <tr key={quot.id} className="hover:bg-slate-50 transition">
                      <td className="p-3">
                        <div className="font-bold text-indigo-600">{quot.rfqNumber}</div>
                        <div className="text-[11px] text-slate-500 font-semibold">{quot.quotationNumber}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{quot.quotationDate}</div>
                      </td>

                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            channel === 'EMAIL'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-sky-100 text-sky-900 border border-sky-200'
                          }`}
                        >
                          {channel === 'EMAIL' ? <Mail className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                          {channel}
                        </span>
                        {quot.emailEvidence?.rfqEmailReference && (
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            {quot.emailEvidence.rfqEmailReference}
                          </div>
                        )}
                        {quot.isSealed && (
                          <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-700">
                            <Lock className="w-2.5 h-2.5" /> Sealed
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-slate-900">{quot.vendorName}</div>
                        <div className="text-[11px] text-slate-400">{quot.submittedBy}</div>
                      </td>

                      <td className="p-3 text-center font-bold text-slate-800">
                        Rev {quot.revisionNumber}
                        {quot.supersededByRevision && (
                          <div className="text-[9px] text-amber-700 font-semibold">
                            Superseded → v{quot.supersededByRevision}
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-right font-semibold">
                        ₹{quot.totalQuotedValue.toLocaleString()}
                      </td>

                      <td className="p-3 text-right font-bold text-indigo-700">
                        ₹{quot.totalLandedValue.toLocaleString()}
                      </td>

                      <td className="p-3 space-y-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            quot.verificationStatus === 'PENDING_BUYER_VERIFICATION'
                              ? 'bg-amber-100 text-amber-900'
                              : quot.verificationStatus === 'REJECTED_BY_BUYER'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {(quot.verificationStatus || 'VERIFIED_PORTAL').replace(/_/g, ' ')}
                        </span>
                        {quot.isLateSubmission && (
                          <div className="text-[10px] font-bold text-rose-700">LATE SUBMISSION</div>
                        )}
                        {quot.isDuplicateEmail && (
                          <div className="text-[10px] font-bold text-rose-700">DUPLICATE EMAIL</div>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleInspectQuotation(quot)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[11px] transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect & Verify</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DataGridFooter
        currentPage={quotGrid.currentPage}
        totalPages={quotGrid.totalPages}
        pageSize={quotGrid.pageSize}
        totalRecords={quotGrid.totalRecords}
        onPageChange={quotGrid.setCurrentPage}
        onPageSizeChange={quotGrid.setPageSize}
        pageSizeOptions={quotGrid.pageSizeOptions}
        defaultSortNotice="Sorted newest first (Submission Timestamp DESC)"
      />

      {/* Quotation Detail & Buyer Verification / Sealed Access Audit Modal */}
      {selectedQuot && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-600">{selectedQuot.quotationNumber}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                    {selectedQuot.submissionChannel || 'PORTAL'} • Rev {selectedQuot.revisionNumber}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">{selectedQuot.vendorName}</h3>
              </div>
              <button
                onClick={() => setSelectedQuot(null)}
                className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl text-xs border border-slate-200">
              <div><strong>Payment Terms:</strong> {selectedQuot.paymentTerms}</div>
              <div><strong>Incoterms:</strong> {selectedQuot.incoterms}</div>
              <div><strong>Valid Until:</strong> {selectedQuot.validUntil}</div>
              <div><strong>Status:</strong> {(selectedQuot.unifiedStatus || 'ACCEPTED').replace(/_/g, ' ')}</div>
            </div>

            {selectedQuot.emailEvidence && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs space-y-2">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-amber-700" />
                  <span>Inbound Email Evidence & Buyer Verification</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-amber-950">
                  <div><strong>Sender Email:</strong> {selectedQuot.emailEvidence.senderEmail}</div>
                  <div><strong>RFQ Email Ref:</strong> {selectedQuot.emailEvidence.rfqEmailReference}</div>
                  <div><strong>Subject:</strong> {selectedQuot.emailEvidence.emailSubject}</div>
                  <div><strong>Received:</strong> {selectedQuot.emailEvidence.receivedTimestamp}</div>
                </div>
                <div className="p-2 bg-white rounded border border-amber-200 text-[11px] text-slate-700">
                  {selectedQuot.emailEvidence.emailBodyExcerpt}
                </div>

                {!isHistoricalReadOnly && selectedQuot.verificationStatus === 'PENDING_BUYER_VERIFICATION' && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={verifyRemarks}
                      onChange={(e) => setVerifyRemarks(e.target.value)}
                      placeholder="Verification remarks..."
                      className="flex-1 min-w-[200px] px-2.5 py-1.5 bg-white border border-amber-300 rounded text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleVerifyEmailQuote(selectedQuot, 'ACCEPT')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs cursor-pointer"
                    >
                      Verify & Accept for CS
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerifyEmailQuote(selectedQuot, 'REJECT')}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-xs cursor-pointer"
                    >
                      Reject Email Bid
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Line Items & Landed Price Breakdown</h4>
              <div className="border border-slate-200 rounded-lg overflow-x-auto text-xs">
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

            {/* Access Audit History */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-indigo-600" />
                <span>Commercial Access & Confidentiality Audit Log ({(selectedQuot.accessHistory || []).length})</span>
              </div>
              {selectedQuot.accessHistory && selectedQuot.accessHistory.length > 0 ? (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {selectedQuot.accessHistory.map((h) => (
                    <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded border border-slate-200 text-[11px]">
                      <span>
                        <strong>{h.actorName}</strong> ({h.actorRole}) — {h.action}
                        {h.denialReason && <span className="text-rose-700 font-semibold"> ({h.denialReason})</span>}
                      </span>
                      <span className={`font-bold ${h.accessAllowed ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {h.accessAllowed ? 'ALLOWED' : 'DENIED'} • {new Date(h.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400">No access attempts logged prior to this inspection.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Submit Portal / Email Quote Modal */}
      {submitMode && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                {submitMode === 'PORTAL' ? 'Submit Supplier Portal Quotation' : 'Ingest Inbound Supplier Email Quotation'}
              </h3>
              <button onClick={() => setSubmitMode(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target RFQ</label>
                <select
                  value={targetRfqId}
                  onChange={(e) => setTargetRfqId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                >
                  {rfqs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.rfqNumber} — {r.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quotation Reference #</label>
                  <input
                    type="text"
                    value={quoteNumberInput}
                    onChange={(e) => setQuoteNumberInput(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                {submitMode === 'EMAIL' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Registered Supplier Sender Email</label>
                    <input
                      type="email"
                      value={senderEmailInput}
                      onChange={(e) => setSenderEmailInput(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    value={unitPriceInput}
                    onChange={(e) => setUnitPriceInput(Number(e.target.value) || 0)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Freight (₹)</label>
                  <input
                    type="number"
                    value={freightInput}
                    onChange={(e) => setFreightInput(Number(e.target.value) || 0)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    value={leadTimeInput}
                    onChange={(e) => setLeadTimeInput(Number(e.target.value) || 1)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSubmitMode(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitModalQuote}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitMode === 'PORTAL' ? 'Submit Portal Quote' : 'Ingest & Queue Email Quote'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
