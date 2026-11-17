import React, { useMemo, useState } from 'react';
import type { User } from '../../types';
import { RecipientConsentRecord } from '../../types/communication';
import { INITIAL_CONSENT_REGISTRY } from '../../data/communicationExtendedSeed';
import { userRoleAdminService } from '../../services/userRoleAdminService';
import { mobileConsentService } from '../../services/mobileConsentService';
import { exportService } from '../../services/exportService';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';
import { StatusTag } from '../settings/userRoleAdmin/shared';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Plus,
  Download,
  AlertTriangle,
  Search,
  Lock,
  ShieldAlert,
  Eye,
  EyeOff,
} from 'lucide-react';

interface ConsentGovernanceViewProps {
  currentUser?: User;
}

export const ConsentGovernanceView: React.FC<ConsentGovernanceViewProps> = ({ currentUser }) => {
  const [suppressions, setSuppressions] = useState<RecipientConsentRecord[]>(INITIAL_CONSENT_REGISTRY);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<string>('ALL');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [isAddSuppressionOpen, setIsAddSuppressionOpen] = useState(false);
  const [suppressEmail, setSuppressEmail] = useState('');
  const [suppressReason, setSuppressReason] = useState('Recipient opted out of non-transactional notices');
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'info' } | null>(null);
  const [activeTab, setActiveTab] = useState<'DIRECTORY' | 'EVIDENCE' | 'BLOCKED_LOGS'>('DIRECTORY');

  const liveUsers = useMemo(() => userRoleAdminService.getUsers(), [notice, activeTab]);
  const evidenceLogs = useMemo(() => mobileConsentService.getConsentEvidence(), [activeTab, notice]);
  const blockedLogs = useMemo(() => mobileConsentService.getBlockedDispatchLogs(), [activeTab, notice]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return liveUsers.filter((u) => {
      if (filterMode === 'PERSONAL_ONLY' && u.mobileNumberType !== 'PERSONAL') return false;
      if (filterMode === 'PENDING_CONSENT' && u.mobileConsentStatus !== 'PENDING_EMPLOYEE_CONSENT') return false;
      if (filterMode === 'CONSENT_GRANTED' && u.mobileConsentStatus !== 'CONSENT_GRANTED') return false;
      if (
        filterMode === 'DECLINED_WITHDRAWN' &&
        u.mobileConsentStatus !== 'CONSENT_DECLINED' &&
        u.mobileConsentStatus !== 'CONSENT_WITHDRAWN'
      ) {
        return false;
      }
      if (filterMode === 'NOT_ASSOCIATED' && u.employeeAssociationStatus !== 'NOT_ASSOCIATED') return false;
      if (q) {
        const hay = `${u.fullName} ${u.email} ${u.employeeId || ''} ${u.role}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [liveUsers, filterMode, searchQuery]);

  const consentGrid = useStandardDataGrid({
    gridId: 'comm-consent-governance-users',
    userId: currentUser?.id,
    data: filteredUsers,
    defaultSortField: 'createdAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
    filterSignature: `${filterMode}|${searchQuery}`,
  });

  const handleToggleSuppressionEmail = (id: string) => {
    setSuppressions((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, emailConsent: !r.emailConsent, consentUpdatedAt: new Date().toISOString() } : r
      )
    );
  };

  const handleAddSuppression = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppressEmail) return;
    const newRecord: RecipientConsentRecord = {
      id: `cs-sup-${Date.now()}`,
      userId: `u-suppressed-${Date.now()}`,
      name: 'Suppressed External Contact',
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
    setSuppressions([newRecord, ...suppressions]);
    setIsAddSuppressionOpen(false);
    setSuppressEmail('');
    setNotice({ text: `Added external suppression entry for ${suppressEmail}.`, tone: 'info' });
  };

  const handleExportConsentReport = () => {
    exportService.executeExport('csv', {
      title: 'Enterprise Mobile & Personal Consent Compliance Register',
      subtitle: 'Authoritative Employee Consent & Association Audit (Personal Numbers Masked)',
      filenamePrefix: 'consent_governance_audit',
      headers: [
        'User',
        'Email',
        'Employee Association',
        'Masked Mobile',
        'Mobile Type',
        'Verification Status',
        'Consent Status',
        'Consent Version',
        'Consent Timestamp',
        'Approved Purposes',
      ],
      rows: filteredUsers.map((u) => {
        const mob = mobileConsentService.formatMobileForViewer(u, currentUser, false);
        return [
          u.fullName,
          u.email,
          u.employeeAssociationStatus || 'ASSOCIATED',
          mob.display,
          u.mobileNumberType || '-',
          u.mobileVerificationStatus || 'NOT_VERIFIED',
          u.mobileConsentStatus || 'NOT_REQUIRED_OFFICIAL',
          u.mobileConsentVersion || '-',
          u.mobileConsentTimestamp || '-',
          (u.mobileConsentPurposes || []).join('; ') || '-',
        ];
      }),
    });
    setNotice({
      text: `Exported ${filteredUsers.length} consent governance record(s) to CSV.`,
      tone: 'success',
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Communication Preferences &amp; Personal Mobile Consent Governance
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Employee-only Personal Mobile Consent enforcement, OTP verification independence, default masking, and blocked-dispatch audit logs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportConsentReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Consent Audit CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddSuppressionOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add External Suppression</span>
          </button>
        </div>
      </div>

      {/* Employee-Only Consent Policy Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
        <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong>Employee Self-Service Consent Lock:</strong> Administrators cannot grant, override, or toggle Personal Mobile Consent on behalf of employees. Employees manage personal mobile decisions exclusively via <em>My Contact &amp; Personal Consent</em>.
        </div>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-xs flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice.text}</span>
          </span>
          <button type="button" onClick={() => setNotice(null)} className="font-bold underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('DIRECTORY')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
            activeTab === 'DIRECTORY'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Employee Contact &amp; Consent Directory ({liveUsers.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('EVIDENCE')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
            activeTab === 'EVIDENCE'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Consent Evidence Ledger ({evidenceLogs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('BLOCKED_LOGS')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
            activeTab === 'BLOCKED_LOGS'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Blocked SMS/WhatsApp Audits ({blockedLogs.length})
        </button>
      </div>

      {activeTab === 'DIRECTORY' && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-600">Governance Filter:</span>
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
                className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 font-medium"
              >
                <option value="ALL">All Enterprise Users ({liveUsers.length})</option>
                <option value="PERSONAL_ONLY">Personal Mobile Numbers</option>
                <option value="PENDING_CONSENT">Pending Employee Consent</option>
                <option value="CONSENT_GRANTED">Consent Granted</option>
                <option value="DECLINED_WITHDRAWN">Consent Declined / Withdrawn</option>
                <option value="NOT_ASSOCIATED">Not Associated Employees</option>
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, employee ID..."
                className="text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg bg-slate-50 w-64"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">User Identity</th>
                    <th className="px-4 py-3">Association &amp; Account</th>
                    <th className="px-4 py-3">Mobile Number &amp; Type</th>
                    <th className="px-4 py-3">Verification (OTP)</th>
                    <th className="px-4 py-3">Personal Consent Status</th>
                    <th className="px-4 py-3">Permitted Purposes &amp; Policy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consentGrid.pagedData.map((u) => {
                    const revealed = Boolean(revealedIds[u.id]);
                    const mob = mobileConsentService.formatMobileForViewer(u, currentUser, revealed);
                    const canReveal =
                      u.mobileNumberType === 'PERSONAL' &&
                      Boolean(u.mobilePhone) &&
                      mobileConsentService.canViewUnmaskedPersonalMobile(currentUser, u.id);

                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition align-top">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{u.fullName}</div>
                          <div className="text-[11px] font-mono text-slate-500">{u.email}</div>
                          <div className="text-[10px] text-slate-400">
                            {u.employeeId || '-'} • {u.role}
                          </div>
                        </td>
                        <td className="px-4 py-3 space-y-1">
                          <div>
                            <StatusTag status={u.employeeAssociationStatus || 'ASSOCIATED'} />
                          </div>
                          <div>
                            <StatusTag status={u.status || 'ACTIVE'} />
                          </div>
                        </td>
                        <td className="px-4 py-3 space-y-1">
                          <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-800 tabular-nums">
                            <span>{mob.display}</span>
                            {canReveal && (
                              <button
                                type="button"
                                onClick={() => setRevealedIds((p) => ({ ...p, [u.id]: !p[u.id] }))}
                                className="p-0.5 rounded border border-slate-200 bg-white text-slate-600 cursor-pointer"
                                title={revealed ? 'Mask' : 'Reveal'}
                              >
                                {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                          <div className="text-[10px] font-semibold text-slate-500">
                            {u.mobileNumberType === 'PERSONAL'
                              ? 'Personal Mobile Number'
                              : u.mobileNumberType === 'OFFICIAL'
                              ? 'Official Mobile Number'
                              : 'No Number'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusTag status={u.mobileVerificationStatus || 'NOT_VERIFIED'} />
                        </td>
                        <td className="px-4 py-3 space-y-1">
                          <StatusTag status={u.mobileConsentStatus || 'NOT_REQUIRED_OFFICIAL'} />
                          {u.mobileNumberType === 'PERSONAL' && (
                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-slate-400" /> Employee Self-Service Only
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-600">
                          {u.mobileConsentPurposes?.length ? (
                            <div className="font-medium text-slate-800">
                              {u.mobileConsentPurposes.join(', ')}
                            </div>
                          ) : (
                            <span className="text-slate-400">
                              {u.mobileNumberType === 'PERSONAL' ? 'None consented' : 'Official business purposes'}
                            </span>
                          )}
                          {u.mobileConsentTimestamp && (
                            <div className="text-[10px] text-slate-400 tabular-nums mt-0.5">
                              {u.mobileConsentVersion || 'v2.0'} • {new Date(u.mobileConsentTimestamp).toLocaleString()}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-slate-100">
              <DataGridFooter
                currentPage={consentGrid.currentPage}
                totalPages={consentGrid.totalPages}
                pageSize={consentGrid.pageSize}
                totalRecords={consentGrid.totalRecords}
                onPageChange={consentGrid.setCurrentPage}
                onPageSizeChange={consentGrid.setPageSize}
                pageSizeOptions={consentGrid.pageSizeOptions}
              />
            </div>
          </div>

          {/* External Suppression Registry */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-900">
              External Email Suppression Registry ({suppressions.length})
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              {suppressions.map((rec) => (
                <div key={rec.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-800">{rec.name}</span>{' '}
                    <span className="font-mono text-slate-500">({rec.email})</span>
                    {rec.suppressionReason && (
                      <div className="text-[11px] text-slate-500">{rec.suppressionReason}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSuppressionEmail(rec.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer flex items-center gap-1 ${
                      rec.emailConsent ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {rec.emailConsent ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    <span>{rec.emailConsent ? 'EMAIL OPT-IN' : 'EMAIL OPT-OUT'}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'EVIDENCE' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Evidence Ref</th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Masked Number</th>
                  <th className="p-3">Action &amp; Status</th>
                  <th className="p-3">Purposes</th>
                  <th className="p-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {evidenceLogs.map((ev) => (
                  <tr key={ev.id}>
                    <td className="p-3 font-mono font-bold text-slate-800">{ev.evidenceReference}</td>
                    <td className="p-3 tabular-nums text-slate-500">
                      {new Date(ev.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3 font-semibold text-slate-800">{ev.userName}</td>
                    <td className="p-3 font-mono text-slate-600">
                      {mobileConsentService.maskMobileNumber(ev.countryCode, ev.e164Number)}
                    </td>
                    <td className="p-3 space-y-1">
                      <div className="font-semibold text-slate-700">{ev.action}</div>
                      <StatusTag status={ev.consentStatus} />
                    </td>
                    <td className="p-3 text-[11px]">{ev.approvedPurposes.join(', ') || '-'}</td>
                    <td className="p-3 text-[11px] text-slate-600">{ev.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'BLOCKED_LOGS' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {blockedLogs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No blocked SMS or WhatsApp communication attempts recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Channel &amp; Purpose</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">Block Code</th>
                    <th className="p-3">Enforcement Reason</th>
                    <th className="p-3">Initiator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {blockedLogs.map((b) => (
                    <tr key={b.id}>
                      <td className="p-3 tabular-nums text-slate-500">
                        {new Date(b.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3 font-mono">
                        <span className="font-bold">{b.channel}</span> • {b.purpose}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold">{b.targetUserName || '-'}</div>
                        <div className="font-mono text-[10px] text-slate-500">{b.maskedPhone}</div>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold">
                          <ShieldAlert className="w-3 h-3" /> {b.blockedCode}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] text-slate-700">{b.reason}</td>
                      <td className="p-3 text-[11px]">{b.actorName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Suppression Entry Modal */}
      {isAddSuppressionOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add to External Suppression List</h3>
                <p className="text-xs text-slate-500">Prevent future outbound notices to this address.</p>
              </div>
            </div>

            <form onSubmit={handleAddSuppression} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={suppressEmail}
                  onChange={(e) => setSuppressEmail(e.target.value)}
                  placeholder="e.g. external.vendor@domain.com"
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
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
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
