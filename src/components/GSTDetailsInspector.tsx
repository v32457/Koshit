import React, { useState } from 'react';
import { GSTVerificationDetails } from '../types';
import { formatGstRegistrationDate } from '../services/gstService';
import {
  ShieldCheck,
  Building2,
  MapPin,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  FileText,
  Hash,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface GSTDetailsInspectorProps {
  details?: GSTVerificationDetails;
  compact?: boolean;
}

export const GSTDetailsInspector: React.FC<GSTDetailsInspectorProps> = ({ details, compact = false }) => {
  const [expandedYear, setExpandedYear] = useState<string | null>(null);

  if (!details) {
    return (
      <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center space-y-2">
        <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
        <div className="font-bold text-slate-700 text-xs">No Official GST Verification Record</div>
        <div className="text-[11px] text-slate-500 max-w-md mx-auto">
          This record has not yet been verified against the official Govt GSTN taxpayer search or configured GST API provider.
        </div>
      </div>
    );
  }

  // Group filing history by financial year
  const filingsByYear = (details.filingHistory || []).reduce((acc, curr) => {
    const fy = curr.financialYear || 'Current';
    if (!acc[fy]) acc[fy] = [];
    acc[fy].push(curr);
    return acc;
  }, {} as Record<string, typeof details.filingHistory>);

  const formattedDate = formatGstRegistrationDate(details.registrationDate);

  return (
    <div className="space-y-4 text-xs font-sans">
      {/* 1. Registration Details Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Official GST Registration Details</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 font-mono">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {details.registrationStatus || 'ACTIVE'}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              Outcome: <strong className="text-emerald-700">{details.verificationOutcome}</strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">GSTIN</span>
            <span className="font-mono font-black text-indigo-900 text-sm">{details.gstin}</span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Legal Name of Business</span>
            <span className="font-bold text-slate-900 truncate block">{details.legalName}</span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Trade Name</span>
            <span className="font-bold text-slate-900 truncate block">{details.tradeName || '—'}</span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Taxpayer Type</span>
            <span className="font-bold text-slate-800">{details.taxpayerType || 'Regular'}</span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Constitution of Business</span>
            <span className="font-bold text-slate-800">
              {details.constitutionOfBusiness ? (
                details.constitutionOfBusiness
              ) : (
                <span className="text-slate-400 italic font-normal">Unavailable / Not Supplied</span>
              )}
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Effective Registration Date</span>
            <span className="font-mono font-bold text-slate-800">{formattedDate || '—'}</span>
          </div>
        </div>

        <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
          <div>
            Verification Source: <strong className="text-slate-800">{details.verificationSource}</strong>
          </div>
          {details.correlationId && (
            <div>
              Correlation ID: <strong className="font-mono text-indigo-900">{details.correlationId}</strong>
            </div>
          )}
          <div>
            Verified Timestamp: <strong className="font-mono text-slate-800">{new Date(details.verificationTimestamp).toLocaleString()}</strong>
          </div>
        </div>
      </div>

      {/* 2. Principal Place of Business */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="font-bold text-slate-900 text-xs flex items-center gap-2 border-b border-slate-100 pb-2">
          <MapPin className="w-4 h-4 text-emerald-600" />
          <span>Principal Place of Business</span>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-xs">
          <div className="font-bold text-slate-800">
            {[details.principalPlaceOfBusiness.doorBuildingNo, details.principalPlaceOfBusiness.streetName].filter(Boolean).join(', ') || '—'}
          </div>
          <div className="text-slate-600">
            {[
              details.principalPlaceOfBusiness.locality,
              details.principalPlaceOfBusiness.city,
              details.principalPlaceOfBusiness.district,
            ].filter(Boolean).join(', ')}
            {details.principalPlaceOfBusiness.state && `, ${details.principalPlaceOfBusiness.state}`} — <strong className="font-mono">{details.principalPlaceOfBusiness.postalCode}</strong>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-3 pt-0.5 font-mono">
            <span>State Code: <strong>{details.principalPlaceOfBusiness.stateCode || '—'}</strong></span>
            <span>Country: <strong>{details.principalPlaceOfBusiness.country || 'India'}</strong></span>
            <span>Purpose: <strong>{details.principalPlaceOfBusiness.addressPurpose || 'Principal Office'}</strong></span>
          </div>
        </div>
      </div>

      {/* 3. Administrative and Other Offices (Additional Places) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>Administrative and Other Offices (Additional Places of Business)</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-600">
            {details.additionalPlacesOfBusiness?.length || 0} Registered Locations
          </span>
        </div>

        {(!details.additionalPlacesOfBusiness || details.additionalPlacesOfBusiness.length === 0) ? (
          <div className="p-3 bg-slate-50 border border-dashed rounded-lg text-slate-500 text-center text-[11px]">
            No secondary or administrative offices registered under this GSTIN.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {details.additionalPlacesOfBusiness.map((addr, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-xs">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>{addr.addressPurpose || `Office #${idx + 1}`}</span>
                  <span className="text-[9px] bg-slate-200 font-mono px-1.5 py-0.2 rounded text-slate-700">{addr.type}</span>
                </div>
                <div className="text-slate-600 text-[11px]">
                  {[addr.doorBuildingNo, addr.streetName, addr.locality, addr.city, addr.state].filter(Boolean).join(', ')} - {addr.postalCode}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Nature of Activities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5">
          <div className="font-bold text-slate-900 text-xs flex items-center gap-2 border-b border-slate-100 pb-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Nature of Core Business Activity</span>
          </div>
          {details.natureOfCoreBusinessActivity && details.natureOfCoreBusinessActivity.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {details.natureOfCoreBusinessActivity.map((act, i) => (
                <span key={i} className="px-2.5 py-1 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-lg font-bold text-xs">
                  {act}
                </span>
              ))}
            </div>
          ) : (
            <div className="p-2 text-slate-400 italic text-[11px]">Unavailable / Not Supplied</div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5">
          <div className="font-bold text-slate-900 text-xs flex items-center gap-2 border-b border-slate-100 pb-2">
            <Layers className="w-4 h-4 text-cyan-600" />
            <span>Nature of Business Activities</span>
          </div>
          {details.natureOfBusinessActivities && details.natureOfBusinessActivities.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {details.natureOfBusinessActivities.map((act, i) => (
                <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded-md font-medium text-[11px]">
                  {act}
                </span>
              ))}
            </div>
          ) : (
            <div className="p-2 text-slate-400 italic text-[11px]">Unavailable / Not Supplied</div>
          )}
        </div>
      </div>

      {/* 5. Dealing in Goods and Services */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
        <div className="font-bold text-slate-900 text-xs border-b border-slate-100 pb-2 flex items-center justify-between">
          <span>Dealing in Goods & Services (HSN / SAC Specifications)</span>
          <span className="text-[10px] text-slate-500 font-mono">
            {details.goods?.length || 0} Goods • {details.services?.length || 0} Services
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Goods Table */}
          <div className="space-y-2">
            <h5 className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Goods (HSN)</h5>
            {(!details.goods || details.goods.length === 0) ? (
              <div className="p-2 text-slate-400 italic text-[11px]">No specific HSN goods registered.</div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-bold text-[10px] uppercase border-b border-slate-200">
                      <th className="p-2 w-28">HSN Code</th>
                      <th className="p-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {details.goods.map((g, i) => (
                      <tr key={i}>
                        <td className="p-2 font-mono font-bold text-indigo-700">{g.hsnCode}</td>
                        <td className="p-2 text-slate-800">{g.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Services Table */}
          <div className="space-y-2">
            <h5 className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Services (SAC)</h5>
            {(!details.services || details.services.length === 0) ? (
              <div className="p-2 text-slate-400 italic text-[11px]">No specific SAC services registered.</div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-bold text-[10px] uppercase border-b border-slate-200">
                      <th className="p-2 w-28">SAC Code</th>
                      <th className="p-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {details.services.map((s, i) => (
                      <tr key={i}>
                        <td className="p-2 font-mono font-bold text-indigo-700">{s.sacCode}</td>
                        <td className="p-2 text-slate-800">{s.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. Filing Frequency — Current Financial Year */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Filing Frequency — Current Financial Year</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
            FY {details.filingFrequencyCurrentFY?.[0]?.financialYear || 'Current'}
          </span>
        </div>

        {(!details.filingFrequencyCurrentFY || details.filingFrequencyCurrentFY.length === 0) ? (
          <div className="p-2 text-slate-400 italic text-[11px]">Filing frequency not supplied by provider.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {details.filingFrequencyCurrentFY.map((freq, idx) => (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Return Type</span>
                  <span className="font-mono font-bold text-slate-900 text-xs">{freq.returnType}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block text-right">Frequency</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {freq.frequency}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 7. Filing Table — Financial-Year Based */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Filing Table — Financial-Year Based</span>
          </div>
          <span className="text-[10px] text-slate-500">
            {details.filingHistory?.length || 0} Returns Filed
          </span>
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
                  <th className="p-2.5">ARN Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono">
                {details.filingHistory.map((rec, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-800">{rec.financialYear}</td>
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
  );
};
