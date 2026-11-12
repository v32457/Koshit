import React, { useState } from 'react';
import {
  MSMEVerificationDetails,
} from '../types';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Building2,
  MapPin,
  Calendar,
  AlertTriangle,
  Award,
  Info,
  Check,
  X,
  FileText,
  Download,
  Layers,
  Factory,
  Briefcase,
  History,
  Tag,
} from 'lucide-react';

interface MSMEVerificationReviewModalProps {
  isOpen: boolean;
  details: MSMEVerificationDetails;
  targetEntityName: string; // e.g. "Company Registration" | "Business Partner Master"
  currentValues?: {
    name?: string;
    majorActivity?: string;
    city?: string;
    state?: string;
    address?: string;
  };
  onConfirm: (confirmedDetails: MSMEVerificationDetails) => void;
  onCancel: () => void;
}

export const MSMEVerificationReviewModal: React.FC<MSMEVerificationReviewModalProps> = ({
  isOpen,
  details,
  targetEntityName,
  currentValues,
  onConfirm,
  onCancel,
}) => {
  const [activeTab, setActiveTab] = useState<'ENTERPRISE' | 'CLASSIFICATION' | 'UNITS' | 'ADDRESS' | 'NIC' | 'AUDIT'>('ENTERPRISE');

  if (!isOpen || !details) return null;

  const isConflict = Boolean(
    details.requestedUdyamNo &&
    details.requestedUdyamNo.trim().toUpperCase() !== details.udyamRegistrationNo.trim().toUpperCase()
  );
  const isInvalidOutcome = details.verificationOutcome !== 'VERIFIED';
  const canConfirm = !isConflict && !isInvalidOutcome;

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
      ['Official Address', 'Door / Building', details.officialAddress.doorBuildingNo || 'N/A'],
      ['Official Address', 'Street / Locality', `${details.officialAddress.streetName || ''} ${details.officialAddress.locality || ''}`],
      ['Official Address', 'City / District', `${details.officialAddress.city}, ${details.officialAddress.district || ''}`],
      ['Official Address', 'State / PIN Code', `${details.officialAddress.state} - ${details.officialAddress.postalCode}`],
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
        `Effective: ${n.effectiveDate || 'N/A'} (2-Digit: ${n.nic2Digit}, 4-Digit: ${n.nic4Digit})`,
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
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden text-xs font-sans">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Pre-Save MSME / Udyam Verification Review</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
                  {details.providerUsed || 'Ministry of MSME Gateway'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {details.verificationOutcome}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Target: <strong className="text-white font-mono">{targetEntityName}</strong> • Udyam No: <strong className="text-emerald-300 font-mono">{details.udyamRegistrationNo}</strong>
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

        {/* Warning if mismatch */}
        {isConflict && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Identifier Mismatch Warning:</strong> Requested verification for <strong>{details.requestedUdyamNo}</strong>, but certificate data belongs to <strong>{details.udyamRegistrationNo}</strong>. Confirmation blocked.
            </span>
          </div>
        )}

        {/* Modal Navigation Tabs */}
        <div className="flex bg-slate-100 border-b border-slate-200 px-4 gap-1 shrink-0 overflow-x-auto text-[11px] font-bold">
          <button
            onClick={() => setActiveTab('ENTERPRISE')}
            className={`py-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ENTERPRISE'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Enterprise Details</span>
          </button>

          <button
            onClick={() => setActiveTab('CLASSIFICATION')}
            className={`py-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'CLASSIFICATION'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5 text-amber-600" />
            <span>Classification History ({details.classificationHistory?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('UNITS')}
            className={`py-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'UNITS'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Factory className="w-3.5 h-3.5 text-cyan-600" />
            <span>Units & Plant Locations ({details.units?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('ADDRESS')}
            className={`py-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ADDRESS'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-rose-600" />
            <span>Official Enterprise Address</span>
          </button>

          <button
            onClick={() => setActiveTab('NIC')}
            className={`py-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'NIC'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-purple-600" />
            <span>NIC Activities ({details.nicActivities?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('AUDIT')}
            className={`py-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'AUDIT'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verification Audit</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: ENTERPRISE DETAILS */}
          {activeTab === 'ENTERPRISE' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-800 font-bold uppercase">Authoritative Enterprise Name</span>
                  <div className="text-base font-extrabold text-slate-900 mt-0.5">{details.enterpriseName}</div>
                </div>
                <div className="text-right font-mono text-[11px]">
                  <span className="text-slate-500 block">Major Activity:</span>
                  <span className="px-2 py-0.5 rounded font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
                    {details.majorActivity}
                  </span>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Organisation Type</span>
                  <span className="font-bold text-slate-800 text-xs">{details.organisationType || 'N/A'}</span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Social Category</span>
                  <span className="font-bold text-slate-800 text-xs">{details.socialCategory || 'General'}</span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Gender</span>
                  <span className="font-bold text-slate-800 text-xs">{details.gender || 'Not Specified'}</span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Udyam Reg. Date</span>
                  <span className="font-bold text-emerald-700 text-xs font-mono">{details.udyamRegistrationDate}</span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Date of Incorporation</span>
                  <span className="font-bold text-slate-800 text-xs font-mono">{details.dateOfIncorporation || 'N/A'}</span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Date of Commencement</span>
                  <span className="font-bold text-slate-800 text-xs font-mono">{details.dateOfCommencement || 'N/A'}</span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">DIC Details</span>
                  <span className="font-bold text-slate-800 text-xs truncate block" title={details.dicDetails}>
                    {details.dicDetails || 'N/A'}
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">MSME-DI / DFO</span>
                  <span className="font-bold text-slate-800 text-xs truncate block" title={details.msmeDiDfoDetails}>
                    {details.msmeDiDfoDetails || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Difference Checker vs Current Form Values */}
              {currentValues && currentValues.name && currentValues.name.trim() !== details.enterpriseName.trim() && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Discrepancy Detected Between User Input & Official Certificate:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mt-1">
                    <div className="bg-white p-2 rounded border border-amber-200">
                      <span className="text-slate-500 block text-[9px]">Current Entered Name:</span>
                      <strong className="text-slate-700">{currentValues.name}</strong>
                    </div>
                    <div className="bg-white p-2 rounded border border-amber-200">
                      <span className="text-emerald-700 block text-[9px] font-bold">Government Verified Certificate Name:</span>
                      <strong className="text-emerald-900">{details.enterpriseName}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CLASSIFICATION HISTORY */}
          {activeTab === 'CLASSIFICATION' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-[11px]">
                Historical financial-year classifications retrieved from the official Ministry of MSME registry. The latest financial year determines current active status.
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                      <th className="p-3">Financial Year</th>
                      <th className="p-3">Enterprise Classification</th>
                      <th className="p-3">Classification Date</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {details.classificationHistory.map((rec, idx) => (
                      <tr key={idx} className={idx === 0 ? 'bg-emerald-50/40 font-bold' : 'hover:bg-slate-50'}>
                        <td className="p-3 font-mono text-slate-900 font-bold">FY {rec.financialYear}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rec.enterpriseType === 'MICRO'
                                ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                                : rec.enterpriseType === 'SMALL'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {rec.enterpriseType} ENTERPRISE
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-600">{rec.classificationDate}</td>
                        <td className="p-3 text-right">
                          {idx === 0 ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                              CURRENT ACTIVE
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-400">HISTORICAL</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: UNITS & PLANT LOCATIONS */}
          {activeTab === 'UNITS' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-[11px]">
                One Udyam Registration may govern multiple plant, manufacturing, or distribution units. Each unit location maintains independent operational address parameters.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {details.units.map((unit, idx) => (
                  <div key={unit.id || idx} className="p-3.5 bg-white border-2 border-slate-200 rounded-xl shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
                        Unit #{idx + 1}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-bold">{unit.city}, {unit.state}</span>
                    </div>

                    <h5 className="font-bold text-slate-900 text-xs">{unit.unitName}</h5>

                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-[11px] font-mono space-y-0.5 text-slate-700">
                      <div><strong className="text-slate-500">Premises / Door:</strong> {unit.doorBuildingNo || '—'} {unit.building || ''}</div>
                      <div><strong className="text-slate-500">Village / Town:</strong> {unit.villageTown || '—'} {unit.block ? `(${unit.block})` : ''}</div>
                      <div><strong className="text-slate-500">Road / Street:</strong> {unit.road || '—'}</div>
                      <div><strong className="text-slate-500">District & State:</strong> {unit.district || unit.city}, {unit.state} - <strong>{unit.postalCode}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: OFFICIAL ENTERPRISE ADDRESS */}
          {activeTab === 'ADDRESS' && (
            <div className="space-y-3">
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-rose-600" />
                    <span>Official Registered Office Address</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                    State Code: {details.officialAddress.stateCode}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Flat / Door / Building</span>
                    <span className="font-bold text-slate-800">{details.officialAddress.doorBuildingNo || 'CS-46 & 47'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Road / Street / Locality</span>
                    <span className="font-bold text-slate-800">{details.officialAddress.streetName || 'PIPDIC Industrial Estate'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">City / District</span>
                    <span className="font-bold text-slate-800">{details.officialAddress.city}, {details.officialAddress.district || details.officialAddress.city}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">State</span>
                    <span className="font-bold text-slate-800">{details.officialAddress.state}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">PIN Code</span>
                    <span className="font-bold text-indigo-700 font-mono">{details.officialAddress.postalCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Country</span>
                    <span className="font-bold text-slate-800">{details.officialAddress.country || 'India'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: NIC ACTIVITIES */}
          {activeTab === 'NIC' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-[11px]">
                National Industry Classification (NIC) codes authoritative for this enterprise. Enterprises may engage across multiple Manufacturing, Services, and Trading categories simultaneously.
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                      <th className="p-3">Category</th>
                      <th className="p-3">NIC 2-Digit</th>
                      <th className="p-3">NIC 4-Digit</th>
                      <th className="p-3">NIC 5-Digit (Full Code & Activity Description)</th>
                      <th className="p-3 text-right">Effective Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {details.nicActivities.map((act, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              act.activityCategory === 'MANUFACTURING'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : act.activityCategory === 'SERVICES'
                                ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {act.activityCategory}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-700">{act.nic2Digit}</td>
                        <td className="p-3 font-mono font-bold text-slate-700">{act.nic4Digit}</td>
                        <td className="p-3">
                          <span className="font-mono font-bold text-indigo-700">[{act.nic5Digit}]</span>{' '}
                          <span className="font-medium text-slate-800">{act.nic5DigitDesc}</span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-500">{act.effectiveDate || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: AUDIT PROVENANCE */}
          {activeTab === 'AUDIT' && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold font-sans">Verification Source:</span>
                  <span className="font-bold text-slate-800">{details.verificationSource}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold font-sans">Timestamp (UTC/IST):</span>
                  <span className="font-bold text-slate-800">{details.verificationTimestamp}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold font-sans">Correlation ID:</span>
                  <span className="font-bold text-indigo-700">{details.correlationId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold font-sans">Verified By:</span>
                  <span className="font-bold text-slate-800">{details.verifiedBy || 'Platform Administrator'}</span>
                </div>
              </div>

              {details.rawResponseSummary && (
                <div className="mt-2 p-2 bg-white rounded border border-slate-200 text-[11px] text-slate-600">
                  <span className="font-bold text-slate-700 block font-sans">Provider Payload Summary:</span>
                  {details.rawResponseSummary}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export Certificate Data (.csv)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-xs text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(details)}
              disabled={!canConfirm}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Confirm & Apply Verified MSME Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
