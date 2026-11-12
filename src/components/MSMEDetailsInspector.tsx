import React, { useState } from 'react';
import { MSMEVerificationDetails } from '../types';
import {
  Award,
  Building2,
  MapPin,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  Factory,
  Tag,
  ShieldCheck,
} from 'lucide-react';

interface MSMEDetailsInspectorProps {
  details?: MSMEVerificationDetails;
  compact?: boolean;
}

export const MSMEDetailsInspector: React.FC<MSMEDetailsInspectorProps> = ({ details, compact = false }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CLASSIFICATIONS' | 'UNITS' | 'NIC'>('OVERVIEW');

  if (!details) {
    return (
      <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center space-y-2">
        <Award className="w-8 h-8 text-slate-400 mx-auto" />
        <div className="font-bold text-slate-700 text-xs">No Official MSME / Udyam Verification Record</div>
        <div className="text-[11px] text-slate-500 max-w-md mx-auto">
          This record has not yet been verified against the official Ministry of MSME Udyam registration portal or configured API provider.
        </div>
      </div>
    );
  }

  const handleExportCsv = () => {
    const headers = ['Category', 'Field', 'Value'];
    const rows: string[][] = [
      ['Enterprise', 'Udyam Registration Number', details.udyamRegistrationNo],
      ['Enterprise', 'Enterprise Name', details.enterpriseName],
      ['Enterprise', 'Organisation Type', details.organisationType],
      ['Enterprise', 'Major Activity', details.majorActivity],
      ['Enterprise', 'Social Category', details.socialCategory || 'N/A'],
      ['Enterprise', 'Gender', details.gender || 'N/A'],
      ['Enterprise', 'Date of Incorporation', details.dateOfIncorporation || 'N/A'],
      ['Enterprise', 'Date of Commencement', details.dateOfCommencement || 'N/A'],
      ['Enterprise', 'Udyam Registration Date', details.udyamRegistrationDate],
      ['Enterprise', 'DIC Details', details.dicDetails || 'N/A'],
      ['Enterprise', 'MSME-DI/DFO Details', details.msmeDiDfoDetails || 'N/A'],
      ...details.classificationHistory.map((c, idx) => [
        `Classification #${idx + 1}`,
        `FY ${c.financialYear}`,
        `${c.enterpriseType} (Date: ${c.classificationDate})`,
      ]),
      ...details.units.map((u, idx) => [
        `Unit Location #${idx + 1}`,
        u.unitName,
        `${u.doorBuildingNo || ''} ${u.building || ''}, ${u.villageTown || ''}, ${u.city}, ${u.state} - ${u.postalCode}`,
      ]),
      ...details.nicActivities.map((n, idx) => [
        `NIC Activity #${idx + 1}`,
        `[${n.activityCategory}] ${n.nic5Digit} - ${n.nic5DigitDesc}`,
        `Effective: ${n.effectiveDate || 'N/A'}`,
      ]),
      ['Verification Audit', 'Source Gateway', details.verificationSource],
      ['Verification Audit', 'Timestamp', details.verificationTimestamp],
      ['Verification Audit', 'Outcome', details.verificationOutcome],
    ];

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `msme_certificate_${details.udyamRegistrationNo}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      {/* 1. Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
          <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-600" />
            <span>Official MSME / Udyam Certificate Details</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              {details.verificationOutcome}
            </span>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold cursor-pointer transition"
          >
            <Download className="w-3 h-3 text-emerald-600" />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div>
            <span className="text-slate-400 block text-[10px] font-bold uppercase">Udyam Reg. Number</span>
            <span className="font-mono font-bold text-indigo-700 text-xs">{details.udyamRegistrationNo}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-bold uppercase">Enterprise Name</span>
            <span className="font-bold text-slate-800 text-xs truncate block" title={details.enterpriseName}>
              {details.enterpriseName}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-bold uppercase">Major Activity</span>
            <span className="font-bold text-slate-800 text-xs">{details.majorActivity}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-bold uppercase">Active Classification</span>
            <span className="font-bold text-emerald-700 text-xs">
              {details.classificationHistory[0]?.enterpriseType || 'MICRO'}
            </span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 gap-1 text-[11px] font-bold pt-1">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`py-1.5 px-3 border-b-2 cursor-pointer transition ${
              activeTab === 'OVERVIEW' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'
            }`}
          >
            Overview & Address
          </button>
          <button
            onClick={() => setActiveTab('CLASSIFICATIONS')}
            className={`py-1.5 px-3 border-b-2 cursor-pointer transition ${
              activeTab === 'CLASSIFICATIONS' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'
            }`}
          >
            Classification History ({details.classificationHistory.length})
          </button>
          <button
            onClick={() => setActiveTab('UNITS')}
            className={`py-1.5 px-3 border-b-2 cursor-pointer transition ${
              activeTab === 'UNITS' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'
            }`}
          >
            Units & Plants ({details.units.length})
          </button>
          <button
            onClick={() => setActiveTab('NIC')}
            className={`py-1.5 px-3 border-b-2 cursor-pointer transition ${
              activeTab === 'NIC' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'
            }`}
          >
            NIC Activities ({details.nicActivities.length})
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-bold">Organisation Type</span>
                <span className="font-bold text-slate-800">{details.organisationType || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-bold">Social Category</span>
                <span className="font-bold text-slate-800">{details.socialCategory || 'General'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-bold">Udyam Reg Date</span>
                <span className="font-bold text-slate-800 font-mono">{details.udyamRegistrationDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-bold">DIC Details</span>
                <span className="font-bold text-slate-800 truncate block" title={details.dicDetails}>{details.dicDetails || 'N/A'}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 block text-[10px] font-bold uppercase mb-0.5">Official Registered Enterprise Address</span>
              <div className="font-medium text-slate-800 text-xs">
                {details.officialAddress.doorBuildingNo || ''} {details.officialAddress.streetName || ''}, {details.officialAddress.locality || ''}, {details.officialAddress.city}, {details.officialAddress.state} - <strong className="font-mono">{details.officialAddress.postalCode}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Classifications */}
        {activeTab === 'CLASSIFICATIONS' && (
          <div className="space-y-2 pt-1">
            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 font-bold uppercase text-[9px] text-slate-600">
                <tr>
                  <th className="p-2">Financial Year</th>
                  <th className="p-2">Enterprise Type</th>
                  <th className="p-2">Classification Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {details.classificationHistory.map((rec, i) => (
                  <tr key={i} className={i === 0 ? 'bg-emerald-50/50 font-bold' : ''}>
                    <td className="p-2 font-mono">FY {rec.financialYear}</td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                        {rec.enterpriseType}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-slate-500">{rec.classificationDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Units */}
        {activeTab === 'UNITS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            {details.units.map((u, i) => (
              <div key={i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-900">{u.unitName}</span>
                  <span className="text-cyan-700 font-mono text-[10px]">Unit #{i + 1}</span>
                </div>
                <div className="text-slate-600 text-[10px] font-mono">
                  {u.doorBuildingNo || ''} {u.building || ''}, {u.road || ''}, {u.city}, {u.state} - {u.postalCode}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 4: NIC */}
        {activeTab === 'NIC' && (
          <div className="space-y-2 pt-1 max-h-48 overflow-y-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 font-bold uppercase text-[9px] text-slate-600">
                <tr>
                  <th className="p-2">Category</th>
                  <th className="p-2">Code</th>
                  <th className="p-2">Activity Description</th>
                  <th className="p-2">Effective Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {details.nicActivities.map((nic, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-2">
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800">
                        {nic.activityCategory}
                      </span>
                    </td>
                    <td className="p-2 font-mono font-bold text-slate-800">{nic.nic5Digit}</td>
                    <td className="p-2 text-slate-700 truncate max-w-xs">{nic.nic5DigitDesc}</td>
                    <td className="p-2 font-mono text-slate-500 text-[10px]">{nic.effectiveDate || '—'}</td>
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
