import React, { useMemo, useState } from 'react';
import {
  Phone,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  KeyRound,
  History,
  Save,
} from 'lucide-react';
import type { User } from '../../../types';
import type { CommunicationPurpose, MobileNumberType } from '../../../types/userRoleAdmin';
import { userRoleAdminService } from '../../../services/userRoleAdminService';
import {
  COMMUNICATION_PURPOSE_CATALOG,
  COUNTRY_DIAL_CODES,
  mobileConsentService,
} from '../../../services/mobileConsentService';
import { StatusTag } from './shared';

interface MyContactConsentViewProps {
  currentUser: User;
  onUserUpdated?: () => void;
}

export const MyContactConsentView: React.FC<MyContactConsentViewProps> = ({
  currentUser,
  onUserUpdated,
}) => {
  const [refreshTick, setRefreshTick] = useState(0);
  const [notice, setNotice] = useState<{ msg: string; tone: 'success' | 'error' | 'info' } | null>(null);

  const liveUser = useMemo(
    () => userRoleAdminService.getUserById(currentUser.id) || currentUser,
    [currentUser, refreshTick]
  );

  const policy = useMemo(
    () => mobileConsentService.getCompanyMobilePolicy(liveUser.defaultCompanyId),
    [liveUser.defaultCompanyId, refreshTick]
  );

  const [selectedPurposes, setSelectedPurposes] = useState<CommunicationPurpose[]>(() =>
    liveUser.mobileConsentPurposes?.length
      ? liveUser.mobileConsentPurposes
      : policy.allowedPersonalPurposes.filter(
          (p) => p === 'SECURITY_AUTH' || p === 'OPERATIONAL_BUSINESS' || p === 'SMS_NOTIFICATIONS'
        )
  );
  const [withdrawReason, setWithdrawReason] = useState('');
  const [otpChallenge, setOtpChallenge] = useState<{ previewOtpCode: string; codeInput: string } | null>(null);

  const [contactForm, setContactForm] = useState({
    countryCode: liveUser.countryCode || '+91',
    mobilePhone: liveUser.mobilePhone || '',
    mobileNumberType: (liveUser.mobileNumberType || 'OFFICIAL') as MobileNumberType,
    reason: 'Employee self-service contact update',
  });

  const evidenceList = useMemo(
    () => mobileConsentService.getConsentEvidence(liveUser.id),
    [liveUser.id, refreshTick]
  );
  const numberHistory = useMemo(
    () => mobileConsentService.getNumberHistory(liveUser.id),
    [liveUser.id, refreshTick]
  );

  const actor = { id: liveUser.id, name: liveUser.fullName };

  const triggerUpdate = () => {
    setRefreshTick((t) => t + 1);
    if (onUserUpdated) onUserUpdated();
  };

  const handleTogglePurpose = (purpose: CommunicationPurpose) => {
    setSelectedPurposes((prev) =>
      prev.includes(purpose) ? prev.filter((p) => p !== purpose) : [...prev, purpose]
    );
  };

  const handleStartOtp = () => {
    try {
      const res = mobileConsentService.initiateMobileOtp(liveUser.id, actor);
      setOtpChallenge({ previewOtpCode: res.previewOtpCode, codeInput: '' });
      setNotice({
        msg: `6-digit verification OTP generated for ${liveUser.countryCode || '+91'} ${liveUser.mobilePhone}.`,
        tone: 'info',
      });
      triggerUpdate();
    } catch (err: any) {
      setNotice({ msg: err.message, tone: 'error' });
    }
  };

  const handleConfirmOtp = () => {
    if (!otpChallenge) return;
    try {
      const res = mobileConsentService.confirmMobileOtp(liveUser.id, otpChallenge.codeInput, actor);
      setNotice({ msg: res.message, tone: res.verified ? 'success' : 'error' });
      if (res.verified) setOtpChallenge(null);
      triggerUpdate();
    } catch (err: any) {
      setNotice({ msg: err.message, tone: 'error' });
    }
  };

  const handleConsentDecision = (decision: 'GRANT' | 'DECLINE') => {
    try {
      const res = mobileConsentService.submitEmployeeConsentDecision({
        targetUserId: liveUser.id,
        decision,
        approvedPurposes: decision === 'GRANT' ? selectedPurposes : [],
        actor,
      });
      setNotice({
        msg:
          decision === 'GRANT'
            ? `Personal mobile consent granted (${res.evidence.evidenceReference}, Version ${res.evidence.consentVersion}).`
            : `Personal mobile consent declined (${res.evidence.evidenceReference}). Organizational SMS/WhatsApp messaging remains blocked.`,
        tone: decision === 'GRANT' ? 'success' : 'info',
      });
      triggerUpdate();
    } catch (err: any) {
      setNotice({ msg: err.message, tone: 'error' });
    }
  };

  const handleWithdrawConsent = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = mobileConsentService.withdrawEmployeeConsent({
        targetUserId: liveUser.id,
        reason: withdrawReason,
        actor,
      });
      setWithdrawReason('');
      setNotice({
        msg: `Consent withdrawn (${res.evidence.evidenceReference}). Personal mobile messaging blocked immediately.`,
        tone: 'info',
      });
      triggerUpdate();
    } catch (err: any) {
      setNotice({ msg: err.message, tone: 'error' });
    }
  };

  const handleUpdateContact = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = mobileConsentService.employeeChangeMobileContact({
        targetUserId: liveUser.id,
        countryCode: contactForm.countryCode,
        mobilePhone: contactForm.mobilePhone,
        mobileNumberType: contactForm.mobileNumberType,
        actor,
        reason: contactForm.reason,
      });
      setOtpChallenge(null);
      setNotice({
        msg: res.consentResetRequired
          ? 'Mobile contact updated. Prior personal mobile consent was archived and reset to Pending Employee Consent.'
          : 'Mobile contact updated successfully.',
        tone: 'success',
      });
      triggerUpdate();
    } catch (err: any) {
      setNotice({ msg: err.message, tone: 'error' });
    }
  };

  const isPersonal = liveUser.mobileNumberType === 'PERSONAL';

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
            <Phone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">My Contact &amp; Personal Mobile Consent</h1>
            <p className="text-xs text-slate-500">
              Employee self-service control for mobile number classification, OTP verification, and explicit Personal Mobile Consent.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusTag status={liveUser.employeeAssociationStatus || 'ASSOCIATED'} />
          <StatusTag status={liveUser.mobileVerificationStatus || 'NOT_VERIFIED'} />
          <StatusTag status={liveUser.mobileConsentStatus || 'NOT_REQUIRED_OFFICIAL'} />
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-xl border p-3.5 text-xs font-semibold flex items-center justify-between gap-3 ${
            notice.tone === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : notice.tone === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-sky-50 border-sky-200 text-sky-800'
          }`}
        >
          <span>{notice.msg}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-[11px] font-bold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Current Mobile Profile & OTP Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h2 className="text-sm font-bold text-slate-900">Current Registered Mobile Contact</h2>
            <span className="text-[11px] font-mono text-slate-500">@{liveUser.username || liveUser.id}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 font-semibold">Mobile Number (Visible to Self)</div>
              <div className="text-sm font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
                {liveUser.mobilePhone ? `${liveUser.countryCode || '+91'} ${liveUser.mobilePhone}` : 'Not Registered'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 font-semibold">Mobile Number Type</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {liveUser.mobileNumberType === 'PERSONAL'
                  ? 'Personal Mobile Number'
                  : liveUser.mobileNumberType === 'OFFICIAL'
                  ? 'Official Mobile Number'
                  : 'Unclassified'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 font-semibold mb-1">Verified Status (OTP)</div>
              <StatusTag status={liveUser.mobileVerificationStatus || 'NOT_VERIFIED'} />
              {liveUser.mobileVerifiedAt && (
                <div className="text-[10px] text-slate-500 mt-1 tabular-nums">
                  {new Date(liveUser.mobileVerifiedAt).toLocaleString()}
                </div>
              )}
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 font-semibold mb-1">Consent Status</div>
              <StatusTag status={liveUser.mobileConsentStatus || 'NOT_REQUIRED_OFFICIAL'} />
              {liveUser.mobileConsentTimestamp && (
                <div className="text-[10px] text-slate-500 mt-1 tabular-nums">
                  {new Date(liveUser.mobileConsentTimestamp).toLocaleString()} • {liveUser.mobileConsentVersion}
                </div>
              )}
            </div>
          </div>

          {liveUser.mobilePhone && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                  Independent OTP Ownership Verification
                </span>
                <button
                  type="button"
                  onClick={handleStartOtp}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                >
                  {liveUser.mobileVerificationStatus === 'VERIFIED' ? 'Re-Verify via OTP' : 'Send Verification OTP'}
                </button>
              </div>
              {otpChallenge && (
                <div className="rounded-lg border border-indigo-200 bg-white p-3 space-y-2">
                  <div className="text-[11px] text-slate-600">
                    Simulated OTP Code:{' '}
                    <code className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {otpChallenge.previewOtpCode}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpChallenge.codeInput}
                      onChange={(e) => setOtpChallenge({ ...otpChallenge, codeInput: e.target.value })}
                      placeholder="Enter 6-digit OTP"
                      className="w-40 p-1.5 border border-slate-300 rounded font-mono text-center tracking-widest"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmOtp}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                    >
                      Confirm OTP
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Update Mobile Number / Type Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="border-b border-slate-100 pb-2.5">
            <h2 className="text-sm font-bold text-slate-900">Update Mobile Number or Classification</h2>
            <p className="text-[11px] text-slate-500">
              Changing a personal mobile number or switching from Official to Personal archives the previous record and requires fresh consent confirmation.
            </p>
          </div>
          <form onSubmit={handleUpdateContact} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Country Code *</label>
                <select
                  value={contactForm.countryCode}
                  onChange={(e) => setContactForm({ ...contactForm, countryCode: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                >
                  {COUNTRY_DIAL_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.iso})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Mobile Number *</label>
                <input
                  required
                  value={contactForm.mobilePhone}
                  onChange={(e) => setContactForm({ ...contactForm, mobilePhone: e.target.value })}
                  placeholder="10-digit E.164 national number"
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mobile Number Type *</label>
              <select
                value={contactForm.mobileNumberType}
                onChange={(e) =>
                  setContactForm({ ...contactForm, mobileNumberType: e.target.value as MobileNumberType })
                }
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="OFFICIAL">Official Mobile Number</option>
                {policy.allowPersonalMobile && (
                  <option value="PERSONAL">Personal Mobile Number</option>
                )}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Update Reason</label>
              <input
                value={contactForm.reason}
                onChange={(e) => setContactForm({ ...contactForm, reason: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Save Contact Changes
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Personal Mobile Consent Management */}
      {isPersonal ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Personal Mobile Consent &amp; Communication Purposes
              </h2>
              <p className="text-[11px] text-slate-500">
                Consent Method: <strong>Employee confirmation</strong> • Active Policy Version:{' '}
                <strong className="font-mono">{policy.activeConsentVersion}</strong>
              </p>
            </div>
            <StatusTag status={liveUser.mobileConsentStatus || 'PENDING_EMPLOYEE_CONSENT'} />
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
            {policy.consentNoticeText}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-800">
              Select Approved Organizational Communication Purposes:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {COMMUNICATION_PURPOSE_CATALOG.filter((p) =>
                policy.allowedPersonalPurposes.includes(p.code)
              ).map((purpose) => {
                const checked = selectedPurposes.includes(purpose.code);
                return (
                  <label
                    key={purpose.code}
                    className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 cursor-pointer transition ${
                      checked
                        ? 'bg-indigo-50/60 border-indigo-300 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleTogglePurpose(purpose.code)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-bold">{purpose.label}</div>
                      <div className="text-[11px] text-slate-500">{purpose.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleConsentDecision('GRANT')}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Grant Personal Mobile Consent
              </button>
              <button
                type="button"
                onClick={() => handleConsentDecision('DECLINE')}
                className="px-4 py-2 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-4 h-4" /> Decline Consent
              </button>
            </div>
          </div>

          {liveUser.mobileConsentStatus === 'CONSENT_GRANTED' && (
            <form
              onSubmit={handleWithdrawConsent}
              className="rounded-lg border border-orange-200 bg-orange-50/60 p-3.5 space-y-2 text-xs"
            >
              <div className="font-bold text-orange-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                Withdraw Previously Granted Consent
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  required
                  minLength={5}
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  placeholder="Enter mandatory withdrawal reason (min 5 chars)..."
                  className="flex-1 min-w-[240px] p-2 border border-orange-300 rounded-lg bg-white"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold cursor-pointer"
                >
                  Withdraw Consent
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs text-slate-600 flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
          <span>
            Your registered mobile number is classified as an <strong>Official Mobile Number</strong>. Personal mobile consent is not required.
          </span>
        </div>
      )}

      {/* Employee Consent Evidence & Number History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-indigo-600" />
            My Consent Evidence Ledger ({evidenceList.length})
          </h3>
          {evidenceList.length === 0 ? (
            <p className="text-[11px] text-slate-400">No consent evidence entries recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {evidenceList.map((ev) => (
                <div key={ev.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-slate-800">{ev.evidenceReference}</span>
                    <StatusTag status={ev.consentStatus} />
                  </div>
                  <div className="text-slate-600">
                    {ev.action} • {ev.consentVersion} •{' '}
                    <span className="tabular-nums">{new Date(ev.timestamp).toLocaleString()}</span>
                  </div>
                  {ev.approvedPurposes.length > 0 && (
                    <div className="text-slate-500">Purposes: {ev.approvedPurposes.join(', ')}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-slate-600" />
            Archived Mobile Number History ({numberHistory.length})
          </h3>
          {numberHistory.length === 0 ? (
            <p className="text-[11px] text-slate-400">No prior mobile numbers archived.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {numberHistory.map((nh) => (
                <div key={nh.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-slate-800">
                      {nh.countryCode} {nh.mobileNumber} ({nh.mobileNumberType})
                    </span>
                    <StatusTag status={nh.consentStatus} />
                  </div>
                  <div className="text-slate-500 tabular-nums">
                    Archived: {new Date(nh.archivedAt).toLocaleString()} • Reason: {nh.archivedReason}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
