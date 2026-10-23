import React, { useState } from 'react';
import { RecipientConsentRecord } from '../../types/communication';
import { INITIAL_CONSENT_REGISTRY } from '../../data/communicationExtendedSeed';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Plus,
  Download,
  AlertTriangle,
  Mail,
  MessageSquare,
  Search,
  Filter,
  UserCheck,
} from 'lucide-react';

export const ConsentGovernanceView: React.FC = () => {
  const [records, setRecords] = useState<RecipientConsentRecord[]>(INITIAL_CONSENT_REGISTRY);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSuppressed, setFilterSuppressed] = useState<string>('ALL');
  const [isAddSuppressionOpen, setIsAddSuppressionOpen] = useState(false);
  const [suppressEmail, setSuppressEmail] = useState('');
  const [suppressReason, setSuppressReason] = useState('Recipient opted out of non-transactional notices');
  const [downloadSuccessNotice, setDownloadSuccessNotice] = useState<string | null>(null);

  const filteredRecords = records.filter((r) => {
    if (filterSuppressed === 'SUPPRESSED_ONLY' && !r.isSuppressed) return false;
    if (filterSuppressed === 'ACTIVE_ONLY' && r.isSuppressed) return false;
    if (
      searchQuery &&
      !r.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !r.email.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !r.phoneNumber.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleToggleConsent = (id: string, channel: 'email' | 'whatsapp') => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          if (channel === 'email') {
            return { ...r, emailConsent: !r.emailConsent, consentUpdatedAt: new Date().toISOString() };
          } else {
            const nextStatus = r.whatsAppConsent === 'OPTED_IN' ? 'OPTED_OUT' : 'OPTED_IN';
            return { ...r, whatsAppConsent: nextStatus, consentUpdatedAt: new Date().toISOString() };
          }
        }
        return r;
      })
    );
  };

  const handleAddSuppression = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppressEmail) return;

    const newRecord: RecipientConsentRecord = {
      id: `cs-sup-${Date.now()}`,
      userId: `u-suppressed-${Date.now()}`,
      name: 'Suppressed Contact',
      email: suppressEmail,
      phoneNumber: 'N/A',
      role: 'ITEM_MAKER',
      branchName: 'Corporate',
      emailConsent: false,
      whatsAppConsent: 'OPTED_OUT',
      consentSource: 'USER_PORTAL_PREFERENCE',
      consentUpdatedAt: new Date().toISOString(),
      isSuppressed: true,
      suppressionReason: suppressReason,
    };

    setRecords([newRecord, ...records]);
    setIsAddSuppressionOpen(false);
    setSuppressEmail('');
  };

  const handleExportConsentReport = () => {
    setDownloadSuccessNotice('Exported compliance audit report: consent_register_20261022.csv');
    setTimeout(() => setDownloadSuccessNotice(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Communication Preferences & Consent Governance</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Regulatory consent tracking, opt-in/opt-out status, suppression lists, and deliverability compliance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportConsentReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Consent Audit CSV</span>
          </button>

          <button
            onClick={() => setIsAddSuppressionOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Suppression Entry</span>
          </button>
        </div>
      </div>

      {downloadSuccessNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{downloadSuccessNotice}</span>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-600">Filter Status:</span>
          <select
            value={filterSuppressed}
            onChange={(e) => setFilterSuppressed(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 font-medium"
          >
            <option value="ALL">All Contacts ({records.length})</option>
            <option value="ACTIVE_ONLY">Active & Consented Only</option>
            <option value="SUPPRESSED_ONLY">Suppressed / Opted Out Only</option>
          </select>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contact name, email, or phone..."
            className="text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg bg-slate-50 w-64"
          />
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Contact Identity</th>
                <th className="px-4 py-3">Branch & Role</th>
                <th className="px-4 py-3">Email Consent</th>
                <th className="px-4 py-3">WhatsApp Consent</th>
                <th className="px-4 py-3">Consent Source</th>
                <th className="px-4 py-3 text-right">Suppression Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3.5">
                    <div className="font-bold text-slate-900">{rec.name}</div>
                    <div className="text-[11px] font-mono text-slate-500">{rec.email}</div>
                    <div className="text-[10px] font-mono text-slate-400">{rec.phoneNumber}</div>
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="font-medium text-slate-800">{rec.branchName}</div>
                    <div className="text-[10px] text-slate-400">{rec.role}</div>
                  </td>

                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => handleToggleConsent(rec.id, 'email')}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition flex items-center gap-1 ${
                        rec.emailConsent
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {rec.emailConsent ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      <span>{rec.emailConsent ? 'OPT-IN' : 'OPT-OUT'}</span>
                    </button>
                  </td>

                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => handleToggleConsent(rec.id, 'whatsapp')}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition flex items-center gap-1 ${
                        rec.whatsAppConsent === 'OPTED_IN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {rec.whatsAppConsent === 'OPTED_IN' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      <span>{rec.whatsAppConsent}</span>
                    </button>
                  </td>

                  <td className="px-4 py-3.5 text-slate-600 text-[11px]">
                    <div>{rec.consentSource}</div>
                    <div className="text-[10px] text-slate-400">{new Date(rec.consentUpdatedAt).toLocaleDateString()}</div>
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    {rec.isSuppressed ? (
                      <span
                        className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded cursor-help"
                        title={rec.suppressionReason}
                      >
                        SUPPRESSED
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                        DELIVERABLE
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Suppression Entry Modal */}
      {isAddSuppressionOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <div className="p-2 bg-red-100 text-red-700 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add to Suppression List</h3>
                <p className="text-xs text-slate-500">Prevent future emails and WhatsApp messages to this address.</p>
              </div>
            </div>

            <form onSubmit={handleAddSuppression} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email or Phone Number</label>
                <input
                  type="text"
                  value={suppressEmail}
                  onChange={(e) => setSuppressEmail(e.target.value)}
                  placeholder="e.g. user@domain.com or +919840123456"
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Suppression Reason</label>
                <input
                  type="text"
                  value={suppressReason}
                  onChange={(e) => setSuppressReason(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddSuppressionOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold"
                >
                  Add Suppression
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
