import React, { useState } from 'react';
import {
  GSTVerificationDetails,
  GSTVerificationMode,
} from '../types';
import { formatGstRegistrationDate } from '../services/gstService';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Building2,
  MapPin,
  Calendar,
  AlertTriangle,
  Sparkles,
  Info,
  Check,
  X,
  FileText,
} from 'lucide-react';

interface GSTVerificationReviewModalProps {
  isOpen: boolean;
  details: GSTVerificationDetails;
  mode: GSTVerificationMode;
  targetEntityName: string; // e.g. "Business Partner" | "Enterprise Company" | "Branch"
  currentValues?: {
    name?: string;
    tradeName?: string;
    city?: string;
    state?: string;
    address?: string;
  };
  onConfirm: (confirmedDetails: GSTVerificationDetails) => void;
  onCancel: () => void;
}

export const GSTVerificationReviewModal: React.FC<GSTVerificationReviewModalProps> = ({
  isOpen,
  details,
  mode,
  targetEntityName,
  currentValues,
  onConfirm,
  onCancel,
}) => {
  const [activeReviewTab, setActiveReviewTab] = useState<'REGISTRATION' | 'ADDRESSES' | 'ACTIVITIES' | 'GOODS_SERVICES' | 'FILING_HISTORY'>('REGISTRATION');

  if (!isOpen) return null;

  const isConflict = Boolean(
    details.requestedGstin &&
    details.requestedGstin.trim().toUpperCase() !== details.gstin.trim().toUpperCase()
  );
  const isInvalidOutcome = details.verificationOutcome !== 'VERIFIED';
  const canConfirm = !isConflict && !isInvalidOutcome;

  const formattedRegDate = formatGstRegistrationDate(details.registrationDate);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden text-xs font-sans">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Pre-Save GSTIN Verification Review</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-900/60 text-cyan-300 border border-cyan-700/50">
                  {mode === 'PAID_API' ? 'Paid B2B Provider' : 'Govt GSTN Portal'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {details.registrationStatus || 'ACTIVE'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Target Record: <strong className="text-white font-mono">{targetEntityName}</strong> • GSTIN: <strong className="text-cyan-300 font-mono">{details.gstin}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Identity Conflict or Error Warning */}
        {isConflict && (
          <div className="bg-red-500/10 border-b border-red-300 px-4 py-3 flex items-start gap-2.5 shrink-0 text-red-900">
            <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-red-900 font-bold block">CRITICAL SECURITY MISMATCH: GSTIN Identity Conflict Detected</strong>
              <span className="text-red-800 text-[11px]">
                The requested GSTIN was <strong className="font-mono">{details.requestedGstin}</strong>, but the verification response returned details for <strong className="font-mono">{details.gstin}</strong>.
                Applying this record has been blocked to protect master data integrity.
              </span>
            </div>
          </div>
        )}

        {/* Governance Notice */}
        <div className="bg-amber-50/90 border-b border-amber-200 px-4 py-2.5 flex items-start gap-2.5 shrink-0 text-amber-900">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-tight">
            <strong>Mandatory Governance Check:</strong> Inspect the official taxpayer details returned below before confirming. 
            Confirming will apply verified Legal/Trade names, constitution, and Principal Place address to the master record. 
            <span className="text-amber-800 font-semibold block mt-0.5">
              Note: GSTIN verification validates taxpayer legitimacy but does <u>not</u> bypass standard maker-checker approval workflows.
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 flex gap-1 text-[11px] font-bold text-slate-600 pt-2 shrink-0 overflow-x-auto">
          {[
            { key: 'REGISTRATION', label: '1. Registration & Constitution' },
            { key: 'ADDRESSES', label: `2. Principal & Additional Places (${1 + (details.additionalPlacesOfBusiness?.length || 0)})` },
            { key: 'ACTIVITIES', label: '3. Nature of Activities' },
            { key: 'GOODS_SERVICES', label: `4. Goods & Services (${details.goods?.length || 0} HSN / ${details.services?.length || 0} SAC)` },
            { key: 'FILING_HISTORY', label: `5. Return Filing Records (${details.filingHistory?.length || 0})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveReviewTab(tab.key as any)}
              className={`px-3 py-2 border-b-2 font-bold cursor-pointer whitespace-nowrap transition ${
                activeReviewTab === tab.key
                  ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: REGISTRATION & CONSTITUTION */}
          {activeReviewTab === 'REGISTRATION' && (
            <div className="space-y-4">
              {/* Field Mapping Comparison Table */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-100 font-bold text-slate-800 border-b border-slate-200 flex items-center justify-between">
                  <span>Field Mapping & Inbound Resolution</span>
                  <span className="text-[10px] text-indigo-700 font-mono font-semibold">Source: {details.verificationSource}</span>
                </div>

                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-200/60 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                      <th className="p-2.5">Master Target Field</th>
                      <th className="p-2.5">Current Master Value</th>
                      <th className="p-2.5 text-indigo-700">Official GST Portal Returned Value</th>
                      <th className="p-2.5">Mapping Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2.5 font-bold text-slate-800">Legal Name of Business</td>
                      <td className="p-2.5 text-slate-500 font-mono">{currentValues?.name || '— (Unsaved)'}</td>
                      <td className="p-2.5 font-bold text-indigo-900 font-mono">{details.legalName}</td>
                      <td className="p-2.5 text-emerald-700 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Apply & Lock
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-800">Trade Name</td>
                      <td className="p-2.5 text-slate-500 font-mono">{currentValues?.tradeName || '— (Unsaved)'}</td>
                      <td className="p-2.5 font-bold text-indigo-900 font-mono">{details.tradeName || '—'}</td>
                      <td className="p-2.5 text-emerald-700 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Apply & Lock
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-800">Taxpayer Type</td>
                      <td className="p-2.5 text-slate-500 font-mono">Regular</td>
                      <td className="p-2.5 font-bold text-slate-900 font-mono">{details.taxpayerType || 'Regular'}</td>
                      <td className="p-2.5 text-emerald-700 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Apply
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-800">Business Constitution</td>
                      <td className="p-2.5 text-slate-500 font-mono">—</td>
                      <td className="p-2.5 font-bold text-slate-900">
                        {details.constitutionOfBusiness ? (
                          <span className="font-mono">{details.constitutionOfBusiness}</span>
                        ) : (
                          <span className="text-amber-700 font-sans italic font-normal">Unavailable / Not Supplied by Source</span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-600 font-medium">
                        {details.constitutionOfBusiness ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-600" /> Apply
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Leave Blank</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-800">Registration Date</td>
                      <td className="p-2.5 text-slate-500 font-mono">—</td>
                      <td className="p-2.5 font-bold text-slate-900 font-mono">{formattedRegDate || '—'}</td>
                      <td className="p-2.5 text-emerald-700 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Persist
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-800">GST Registration Status</td>
                      <td className="p-2.5 text-slate-500 font-mono">UNVERIFIED</td>
                      <td className="p-2.5 font-bold text-emerald-700 font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {details.registrationStatus}
                      </td>
                      <td className="p-2.5 text-emerald-700 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Set ACTIVE
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Technical Audit Signature */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1 font-mono text-[11px]">
                <div className="flex items-center justify-between text-indigo-900 font-bold">
                  <span>Audit Verification Signature</span>
                  <span>{new Date(details.verificationTimestamp).toLocaleString()}</span>
                </div>
                <div className="text-slate-700 flex flex-wrap gap-x-4">
                  <span>Source: {details.verificationSource}</span>
                  <span>Requested GSTIN: <strong className="text-slate-900">{details.requestedGstin || details.gstin}</strong></span>
                  <span>Correlation ID: <strong className="text-indigo-950">{details.correlationId || 'N/A'}</strong></span>
                </div>
                <div className="text-slate-500 text-[10px]">
                  Verified By: {details.verifiedBy || 'Platform Admin'} • Outcome: <strong className={details.verificationOutcome === 'VERIFIED' ? 'text-emerald-700' : 'text-red-700'}>{details.verificationOutcome}</strong>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ADDRESSES */}
          {activeReviewTab === 'ADDRESSES' && (
            <div className="space-y-4">
              {/* Principal Place */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>Principal Place of Business (Mapped to Bill-to Address)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    CANONICAL HQ
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Door / Building / Street:</span>
                    <strong className="text-slate-800">
                      {[details.principalPlaceOfBusiness.doorBuildingNo, details.principalPlaceOfBusiness.streetName].filter(Boolean).join(', ') || '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Locality / Area:</span>
                    <strong className="text-slate-800">{details.principalPlaceOfBusiness.locality || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">City / District / State:</span>
                    <strong className="text-slate-800">
                      {details.principalPlaceOfBusiness.city}, {details.principalPlaceOfBusiness.state} {details.principalPlaceOfBusiness.stateCode ? `(Code: ${details.principalPlaceOfBusiness.stateCode})` : ''}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Postal Code & Country:</span>
                    <strong className="text-slate-800 font-mono">
                      {details.principalPlaceOfBusiness.postalCode}, {details.principalPlaceOfBusiness.country || 'India'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Additional Places */}
              <div className="space-y-2">
                <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>Additional Places of Business ({details.additionalPlacesOfBusiness?.length || 0})</span>
                  <span className="text-[10px] text-slate-500">Office / Factory / Warehouse Locations</span>
                </div>

                {(!details.additionalPlacesOfBusiness || details.additionalPlacesOfBusiness.length === 0) ? (
                  <div className="p-4 bg-slate-50 border border-dashed rounded-xl text-center text-slate-500">
                    No additional places of business registered on this GSTIN.
                  </div>
                ) : (
                  details.additionalPlacesOfBusiness.map((addr, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{addr.addressPurpose || `Additional Office #${idx + 1}`}</span>
                          <span className="text-[9px] font-mono bg-slate-200 px-1.5 py-0.2 rounded text-slate-700">
                            {addr.type}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {[addr.doorBuildingNo, addr.streetName, addr.locality, addr.city, addr.state].filter(Boolean).join(', ')} - {addr.postalCode}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: NATURE OF ACTIVITIES */}
          {activeReviewTab === 'ACTIVITIES' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="font-bold text-slate-900 text-xs">Nature of Core Business Activity</h4>
                {details.natureOfCoreBusinessActivity && details.natureOfCoreBusinessActivity.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {details.natureOfCoreBusinessActivity.map((act, i) => (
                      <span key={i} className="px-3 py-1 bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg font-bold text-xs flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        {act}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-slate-500 italic text-xs">
                    Unavailable / Not Supplied by Source
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="font-bold text-slate-900 text-xs">All Nature of Business Activities</h4>
                {details.natureOfBusinessActivities && details.natureOfBusinessActivities.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {details.natureOfBusinessActivities.map((act, i) => (
                      <div key={i} className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center gap-2 text-slate-800 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{act}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-slate-500 italic text-xs">
                    Unavailable / Not Supplied by Source
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: GOODS & SERVICES */}
          {activeReviewTab === 'GOODS_SERVICES' && (
            <div className="space-y-4">
              {/* Goods HSN */}
              <div className="space-y-2">
                <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                  <span>Dealing in Goods (HSN Codes)</span>
                  <span className="text-[10px] text-slate-500 font-mono">{details.goods?.length || 0} registered commodities</span>
                </div>
                {(!details.goods || details.goods.length === 0) ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 italic text-xs">
                    No specific HSN goods listed by source.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                          <th className="p-2.5 w-32">HSN Code</th>
                          <th className="p-2.5">Official Commodity Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {details.goods.map((g, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono font-bold text-indigo-700">{g.hsnCode}</td>
                            <td className="p-2.5 text-slate-800 font-medium">{g.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Services SAC */}
              <div className="space-y-2">
                <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                  <span>Dealing in Services (SAC Codes)</span>
                  <span className="text-[10px] text-slate-500 font-mono">{details.services?.length || 0} registered service classes</span>
                </div>
                {(!details.services || details.services.length === 0) ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 italic text-xs">
                    No specific SAC services listed by source.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                          <th className="p-2.5 w-32">SAC Code</th>
                          <th className="p-2.5">Official Service Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {details.services.map((s, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono font-bold text-indigo-700">{s.sacCode}</td>
                            <td className="p-2.5 text-slate-800 font-medium">{s.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: FILING HISTORY */}
          {activeReviewTab === 'FILING_HISTORY' && (
            <div className="space-y-4">
              {/* Current FY Filing Frequency */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>Current Financial Year Filing Frequency</span>
                  <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                    FY {details.filingFrequencyCurrentFY?.[0]?.financialYear || 'Current'}
                  </span>
                </div>
                {(!details.filingFrequencyCurrentFY || details.filingFrequencyCurrentFY.length === 0) ? (
                  <div className="p-2 text-slate-500 italic text-xs">Filing frequency not supplied by provider.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {details.filingFrequencyCurrentFY.map((f, i) => (
                      <div key={i} className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-slate-900">{f.returnType}</span>
                        <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                          {f.frequency}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Multi-Year Filing Records Table */}
              <div className="space-y-2">
                <div className="font-bold text-slate-900 text-xs">
                  Financial-Year Based Return Filing History
                </div>
                {(!details.filingHistory || details.filingHistory.length === 0) ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 italic text-xs">
                    No filing records available for this taxpayer.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                          <th className="p-2.5">Financial Year</th>
                          <th className="p-2.5">Return Type</th>
                          <th className="p-2.5">Tax Period</th>
                          <th className="p-2.5">Date of Filing</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">ARN (Ack. Ref)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white font-mono">
                        {details.filingHistory.map((rec, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-700">{rec.financialYear}</td>
                            <td className="p-2.5 font-bold text-indigo-700">{rec.returnType}</td>
                            <td className="p-2.5 text-slate-800">{rec.taxPeriod}</td>
                            <td className="p-2.5 text-slate-600">{rec.dateOfFiling}</td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded text-[10px] border border-emerald-300">
                                {rec.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-500 text-[10px]">{rec.arn || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Clicking Confirm will map official GST values into the active master form.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold text-xs cursor-pointer transition"
            >
              Discard / Reject
            </button>

            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => canConfirm && onConfirm(details)}
              className={`px-5 py-2 rounded-lg font-bold text-xs shadow-xs transition flex items-center gap-1.5 ${
                canConfirm
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Confirm & Apply to Record</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
