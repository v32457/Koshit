import React, { useMemo, useState } from 'react';
import {
  Shield,
  Save,
  Monitor,
  LogOut,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Smartphone,
  MessageSquare,
} from 'lucide-react';
import type {
  CommunicationPurpose,
  CompanyMobilePolicyConfig,
  SecurityPolicyConfig,
  SmsGatewayConfig,
} from '../../../types/userRoleAdmin';
import { userRoleAdminService } from '../../../services/userRoleAdminService';
import {
  COMMUNICATION_PURPOSE_CATALOG,
  mobileConsentService,
} from '../../../services/mobileConsentService';
import { useStandardDataGrid } from '../../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../../components/DataGridFooter';
import { RiskTag, StatusTag, UserRoleAdminTabProps } from './shared';

export const SecurityPoliciesSessionsTab: React.FC<UserRoleAdminTabProps> = ({
  currentUser,
  companies,
  onNotify,
  refreshTick,
  triggerRefresh,
}) => {
  const savedPolicy = useMemo(() => userRoleAdminService.getSecurityPolicy(), [refreshTick]);
  const [policy, setPolicy] = useState<SecurityPolicyConfig>(savedPolicy);
  const [policyReason, setPolicyReason] = useState('Enterprise security baseline review');

  const savedMobilePolicy = useMemo(() => mobileConsentService.getCompanyMobilePolicy('GLOBAL'), [refreshTick]);
  const [mobilePolicy, setMobilePolicy] = useState<CompanyMobilePolicyConfig>(savedMobilePolicy);

  const savedSmsGateway = useMemo(() => mobileConsentService.getSmsGatewayConfig(), [refreshTick]);
  const [smsGateway, setSmsGateway] = useState<SmsGatewayConfig>(savedSmsGateway);

  const users = useMemo(() => userRoleAdminService.getUsers(), [refreshTick]);
  const sessions = useMemo(() => userRoleAdminService.getSessions(), [refreshTick]);
  const loginHistory = useMemo(() => userRoleAdminService.getLoginHistory(), [refreshTick]);

  // Break-Glass Emergency Access state
  const [bgTargetUserId, setBgTargetUserId] = useState<string>(users[1]?.id || currentUser.id);
  const [bgHours, setBgHours] = useState<number>(4);
  const [bgCompanyId, setBgCompanyId] = useState<string>(companies[0]?.id || 'co-kosh-01');
  const [bgReason, setBgReason] = useState<string>('');

  const sessionsGrid = useStandardDataGrid({
    gridId: 'ura-active-sessions',
    userId: currentUser.id,
    data: sessions,
    defaultSortField: 'lastActivityAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
  });

  const historyGrid = useStandardDataGrid({
    gridId: 'ura-login-history',
    userId: currentUser.id,
    data: loginHistory,
    defaultSortField: 'timestamp',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
  });

  const actor = { id: currentUser.id, name: currentUser.fullName };

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = userRoleAdminService.updateSecurityPolicy(policy, policyReason, actor);
      setPolicy(updated);
      triggerRefresh();
      onNotify('Enterprise Security & Offboarding Policy saved and audited.', 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleSaveMobilePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = mobileConsentService.saveCompanyMobilePolicy(mobilePolicy, actor, 'GLOBAL');
      setMobilePolicy(updated);
      triggerRefresh();
      onNotify('Company Mobile & Personal Consent Policy saved and audited.', 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleTogglePurpose = (purpose: CommunicationPurpose) => {
    setMobilePolicy((prev) => {
      const exists = prev.allowedPersonalPurposes.includes(purpose);
      return {
        ...prev,
        allowedPersonalPurposes: exists
          ? prev.allowedPersonalPurposes.filter((p) => p !== purpose)
          : [...prev.allowedPersonalPurposes, purpose],
      };
    });
  };

  const handleSaveSmsGateway = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = mobileConsentService.saveSmsGatewayConfig(smsGateway, actor);
      setSmsGateway(updated);
      triggerRefresh();
      onNotify('Enterprise SMS Gateway configuration saved and audited.', 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleForceLogout = (sessionId: string) => {
    try {
      userRoleAdminService.forceLogoutSession(sessionId, 'Security Administrator Force Logout', actor);
      triggerRefresh();
      onNotify('Session revoked immediately; token invalidated.', 'info');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleRevokeAllForUser = (userId: string, userName: string) => {
    const count = userRoleAdminService.revokeAllUserSessions(userId, 'Security Administrator Bulk Revocation', actor);
    triggerRefresh();
    onNotify(`Revoked ${count} active session(s) for ${userName}.`, 'info');
  };

  const handleReviewSuspicious = (historyId: string, decision: 'CLEARED' | 'CONFIRMED_INCIDENT') => {
    userRoleAdminService.reviewSuspiciousLogin(historyId, decision, `Reviewed by ${currentUser.fullName}`, actor);
    triggerRefresh();
    onNotify(`Suspicious login event marked as ${decision}.`, decision === 'CLEARED' ? 'success' : 'error');
  };

  const handleBreakGlass = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const rec = userRoleAdminService.grantEmergencyAccess(
        {
          targetUserId: bgTargetUserId,
          durationHours: bgHours,
          reason: bgReason,
          companyId: bgCompanyId,
        },
        actor
      );
      setBgReason('');
      triggerRefresh();
      onNotify(`Break-Glass Emergency Access activated until ${rec.validTo}. High-severity audit & CRITICAL alert recorded.`, 'info');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Security Policies Configuration */}
      <form onSubmit={handleSavePolicy} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-600" />
              Enterprise Password, Lockout, Session & MFA Policy
            </h3>
            <p className="text-[11px] text-slate-500">
              Enforced across authentication, password rotation, concurrent session limits, and account lockout workflows.
            </p>
          </div>
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> Save Security Policy
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Min Password Length</label>
            <input type="number" min={8} max={32} value={policy.minPasswordLength} onChange={(e) => setPolicy({ ...policy, minPasswordLength: Number(e.target.value) })} className="w-full p-2 border border-slate-300 rounded-lg tabular-nums font-bold" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">History Count</label>
            <input type="number" min={1} max={24} value={policy.passwordHistoryCount} onChange={(e) => setPolicy({ ...policy, passwordHistoryCount: Number(e.target.value) })} className="w-full p-2 border border-slate-300 rounded-lg tabular-nums font-bold" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Pwd Expiry (Days)</label>
            <input type="number" min={15} max={365} value={policy.passwordExpirationDays} onChange={(e) => setPolicy({ ...policy, passwordExpirationDays: Number(e.target.value) })} className="w-full p-2 border border-slate-300 rounded-lg tabular-nums font-bold" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Lockout Threshold</label>
            <input type="number" min={3} max={15} value={policy.failedLoginThreshold} onChange={(e) => setPolicy({ ...policy, failedLoginThreshold: Number(e.target.value) })} className="w-full p-2 border border-slate-300 rounded-lg tabular-nums font-bold" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Session Timeout (Min)</label>
            <input type="number" min={5} max={1440} value={policy.sessionTimeoutMinutes} onChange={(e) => setPolicy({ ...policy, sessionTimeoutMinutes: Number(e.target.value) })} className="w-full p-2 border border-slate-300 rounded-lg tabular-nums font-bold" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Max Concurrent Sessions</label>
            <input type="number" min={1} max={10} value={policy.maxConcurrentSessions} onChange={(e) => setPolicy({ ...policy, maxConcurrentSessions: Number(e.target.value) })} className="w-full p-2 border border-slate-300 rounded-lg tabular-nums font-bold" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
          <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
            <input type="checkbox" checked={policy.requireUppercase} onChange={(e) => setPolicy({ ...policy, requireUppercase: e.target.checked })} /> Uppercase
          </label>
          <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
            <input type="checkbox" checked={policy.requireLowercase} onChange={(e) => setPolicy({ ...policy, requireLowercase: e.target.checked })} /> Lowercase
          </label>
          <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
            <input type="checkbox" checked={policy.requireNumber} onChange={(e) => setPolicy({ ...policy, requireNumber: e.target.checked })} /> Number
          </label>
          <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
            <input type="checkbox" checked={policy.requireSpecialChar} onChange={(e) => setPolicy({ ...policy, requireSpecialChar: e.target.checked })} /> Special Char
          </label>
          <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
            <input type="checkbox" checked={policy.allowEmailOtp} onChange={(e) => setPolicy({ ...policy, allowEmailOtp: e.target.checked })} /> Email OTP MFA
          </label>
          <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
            <input type="checkbox" checked={policy.allowAuthenticatorMfa} onChange={(e) => setPolicy({ ...policy, allowAuthenticatorMfa: e.target.checked })} /> Authenticator App
          </label>
          <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
            <input type="checkbox" checked={policy.suspiciousLoginAlertEnabled} onChange={(e) => setPolicy({ ...policy, suspiciousLoginAlertEnabled: e.target.checked })} /> Suspicious Login Alerts
          </label>
        </div>

        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="text-[11px] font-bold uppercase text-slate-600">
            Employee Offboarding &amp; Reassociation Policy (Not Associated / Associated)
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={policy.deactivateAccountOnNotAssociated !== false}
                onChange={(e) => setPolicy({ ...policy, deactivateAccountOnNotAssociated: e.target.checked })}
              />
              Deactivate Login Account on Not Associated
            </label>
            <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={policy.revokeSessionsOnNotAssociated !== false}
                onChange={(e) => setPolicy({ ...policy, revokeSessionsOnNotAssociated: e.target.checked })}
              />
              Revoke Active Sessions Immediately
            </label>
            <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={policy.revokeOrgAssignmentsOnNotAssociated !== false}
                onChange={(e) => setPolicy({ ...policy, revokeOrgAssignmentsOnNotAssociated: e.target.checked })}
              />
              Revoke Organizational Role Assignments, Temp Access &amp; Delegations
            </label>
            <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={policy.requireApprovalForReassociation !== false}
                onChange={(e) => setPolicy({ ...policy, requireApprovalForReassociation: e.target.checked })}
              />
              Require Authorized Approval &amp; Maker-Checker for Reassociation
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">MFA Enforcement Scope</label>
            <select value={policy.mfaRequirement} onChange={(e) => setPolicy({ ...policy, mfaRequirement: e.target.value as any })} className="w-full p-2 border border-slate-300 rounded-lg bg-white font-semibold">
              <option value="ALL_USERS">Mandatory for All Users</option>
              <option value="ADMINS_AND_CHECKERS">Mandatory for Admins & Checkers</option>
              <option value="OPTIONAL">Optional User Opt-In</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Policy Change Reason</label>
            <input value={policyReason} onChange={(e) => setPolicyReason(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg" />
          </div>
        </div>
      </form>

      {/* 1B. Company Mobile & Personal Consent Policy + SMS Gateway */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <form onSubmit={handleSaveMobilePolicy} className="xl:col-span-2 bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-indigo-600" />
                Company Mobile &amp; Personal Consent Governance Policy
              </h4>
              <p className="text-[11px] text-slate-500">
                Controls mandatory onboarding mobile rules, OTP verification independence, default personal mobile masking, and approved purposes.
              </p>
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save Mobile Policy
            </button>
          </div>

          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={mobilePolicy.isMobileMandatoryOnOnboarding}
                onChange={(e) => setMobilePolicy({ ...mobilePolicy, isMobileMandatoryOnOnboarding: e.target.checked })}
              />
              Mobile Mandatory on Onboarding
            </label>
            <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={mobilePolicy.allowPersonalMobile}
                onChange={(e) => setMobilePolicy({ ...mobilePolicy, allowPersonalMobile: e.target.checked })}
              />
              Allow Personal Mobile Numbers
            </label>
            <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={mobilePolicy.requireVerifiedNumberBeforeComm}
                onChange={(e) => setMobilePolicy({ ...mobilePolicy, requireVerifiedNumberBeforeComm: e.target.checked })}
              />
              Require Verified OTP Before Communication
            </label>
            <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={mobilePolicy.maskPersonalNumbersByDefault}
                onChange={(e) => setMobilePolicy({ ...mobilePolicy, maskPersonalNumbersByDefault: e.target.checked })}
              />
              Mask Personal Numbers by Default
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Active Consent Version</label>
              <input
                value={mobilePolicy.activeConsentVersion}
                onChange={(e) => setMobilePolicy({ ...mobilePolicy, activeConsentVersion: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Employee Consent Notice Text</label>
              <input
                value={mobilePolicy.consentNoticeText}
                onChange={(e) => setMobilePolicy({ ...mobilePolicy, consentNoticeText: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">
              Policy-Approved Personal Mobile Communication Purposes
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
              {COMMUNICATION_PURPOSE_CATALOG.map((p) => (
                <label key={p.code} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mobilePolicy.allowedPersonalPurposes.includes(p.code)}
                    onChange={() => handleTogglePurpose(p.code)}
                  />
                  <span className="font-semibold text-slate-800">{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        </form>

        <form onSubmit={handleSaveSmsGateway} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                Enterprise SMS Gateway
              </h4>
              <p className="text-[11px] text-slate-500">DLT sender &amp; consent-gated SMS relay</p>
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
            >
              Save SMS
            </button>
          </div>
          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Provider</label>
              <select
                value={smsGateway.providerName}
                onChange={(e) => setSmsGateway({ ...smsGateway, providerName: e.target.value as SmsGatewayConfig['providerName'] })}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white font-semibold"
              >
                <option value="MSG91">MSG91 (India DLT)</option>
                <option value="TWILIO">Twilio Programmable SMS</option>
                <option value="AWS_SNS">AWS SNS</option>
                <option value="INTERNAL_SMTP_SMS">Internal Enterprise Relay</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Sender ID</label>
                <input
                  value={smsGateway.senderId}
                  onChange={(e) => setSmsGateway({ ...smsGateway, senderId: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Rate Limit / Min</label>
                <input
                  type="number"
                  min={10}
                  max={5000}
                  value={smsGateway.rateLimitPerMin}
                  onChange={(e) => setSmsGateway({ ...smsGateway, rateLimitPerMin: Number(e.target.value) })}
                  className="w-full p-2 border border-slate-300 rounded-lg tabular-nums font-bold"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">DLT Entity ID</label>
              <input
                value={smsGateway.entityIdDlt || ''}
                onChange={(e) => setSmsGateway({ ...smsGateway, entityIdDlt: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <label className="flex items-center gap-2 font-semibold cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={smsGateway.isEnabled}
                onChange={(e) => setSmsGateway({ ...smsGateway, isEnabled: e.target.checked })}
              />
              Enable Outbound SMS Channel (Consent-Gated)
            </label>
          </div>
        </form>
      </div>

      {/* 2. Active Sessions Management */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Monitor className="w-4 h-4 text-emerald-600" />
            Login & Session Management ({sessions.filter((s) => s.status === 'ACTIVE').length} Active)
          </h4>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-2.5">User & Token</th>
                <th className="p-2.5">Device & IP</th>
                <th className="p-2.5">Auth / MFA</th>
                <th className="p-2.5">Last Activity / Expires</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right">Session Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessionsGrid.pagedData.map((s) => (
                <tr key={s.id}>
                  <td className="p-2.5">
                    <div className="font-bold text-slate-900">{s.userName}</div>
                    <div className="text-[10px] font-mono text-slate-500">{s.sessionTokenId}</div>
                  </td>
                  <td className="p-2.5">
                    <div className="text-slate-800">{s.deviceInfo}</div>
                    <div className="text-[11px] font-mono text-slate-500">{s.ipAddress}</div>
                  </td>
                  <td className="p-2.5 text-[11px]">
                    <div>{s.authMethod}</div>
                    <div className={s.mfaVerified ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                      {s.mfaVerified ? 'MFA Verified' : 'MFA Unverified'}
                    </div>
                  </td>
                  <td className="p-2.5 font-mono text-[10px] text-slate-600">
                    <div>Act: {s.lastActivityAt}</div>
                    <div>Exp: {s.expiresAt}</div>
                  </td>
                  <td className="p-2.5"><StatusTag status={s.status} /></td>
                  <td className="p-2.5 text-right">
                    {s.status === 'ACTIVE' && (
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleForceLogout(s.id)}
                          className="px-2 py-1 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-[11px] font-bold text-rose-700 cursor-pointer"
                        >
                          <LogOut className="w-3 h-3 inline mr-0.5" /> Force Logout
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevokeAllForUser(s.userId, s.userName)}
                          className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-bold text-slate-700 cursor-pointer"
                        >
                          Revoke All
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DataGridFooter
          currentPage={sessionsGrid.currentPage}
          totalPages={sessionsGrid.totalPages}
          pageSize={sessionsGrid.pageSize}
          totalRecords={sessionsGrid.totalRecords}
          onPageChange={sessionsGrid.setCurrentPage}
          onPageSizeChange={sessionsGrid.setPageSize}
          pageSizeOptions={sessionsGrid.pageSizeOptions}
        />
      </div>

      {/* 3. Login History & Suspicious Event Review */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          Authentication History & Suspicious Login Review
        </h4>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">Account</th>
                <th className="p-2.5">Event</th>
                <th className="p-2.5">Device & IP</th>
                <th className="p-2.5">Risk / Review</th>
                <th className="p-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyGrid.pagedData.map((h) => (
                <tr key={h.id}>
                  <td className="p-2.5 font-mono text-[11px] text-slate-600">{h.timestamp}</td>
                  <td className="p-2.5 font-semibold text-slate-900">{h.userName || h.usernameOrEmail}</td>
                  <td className="p-2.5">
                    <div className="font-mono font-bold text-slate-800">{h.eventType}</div>
                    {h.failureReason && <div className="text-[10px] text-rose-600">{h.failureReason}</div>}
                  </td>
                  <td className="p-2.5 text-[11px]">
                    <div>{h.deviceInfo}</div>
                    <div className="font-mono text-slate-500">{h.ipAddress}</div>
                  </td>
                  <td className="p-2.5">
                    {h.isSuspicious ? (
                      <div className="space-y-0.5">
                        <RiskTag level="HIGH" />
                        <div className="text-[10px] text-slate-600">{h.suspiciousReason}</div>
                        {h.reviewStatus && <StatusTag status={h.reviewStatus} />}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">Normal</span>
                    )}
                  </td>
                  <td className="p-2.5 text-right">
                    {h.isSuspicious && h.reviewStatus === 'PENDING_REVIEW' && (
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleReviewSuspicious(h.id, 'CLEARED')}
                          className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-[11px] font-bold text-emerald-800 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3 inline mr-0.5" /> Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewSuspicious(h.id, 'CONFIRMED_INCIDENT')}
                          className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-700 cursor-pointer"
                        >
                          Confirm Incident
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DataGridFooter
          currentPage={historyGrid.currentPage}
          totalPages={historyGrid.totalPages}
          pageSize={historyGrid.pageSize}
          totalRecords={historyGrid.totalRecords}
          onPageChange={historyGrid.setCurrentPage}
          onPageSizeChange={historyGrid.setPageSize}
          pageSizeOptions={historyGrid.pageSizeOptions}
        />
      </div>

      {/* 4. System Security Settings & Break-Glass Emergency Access */}
      <form onSubmit={handleBreakGlass} className="bg-rose-50/70 rounded-xl border border-rose-200 p-4 space-y-3">
        <div>
          <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-rose-600" />
            System Security Settings — Protected Break-Glass Emergency Access
          </h4>
          <p className="text-[11px] text-rose-800">
            Super Administrator only. Grants time-bounded emergency audit & governance access with mandatory incident justification (min 15 chars) and CRITICAL security alert logging.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div>
            <label className="block font-bold text-rose-900 mb-1">Recipient User *</label>
            <select value={bgTargetUserId} onChange={(e) => setBgTargetUserId(e.target.value)} className="w-full p-2 border border-rose-300 rounded-lg bg-white">
              {users.filter((u) => u.status === 'ACTIVE').map((u) => (
                <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-bold text-rose-900 mb-1">Bounded Hours (Max {policy.emergencyAccessMaxHours}h) *</label>
            <input type="number" min={1} max={policy.emergencyAccessMaxHours} value={bgHours} onChange={(e) => setBgHours(Number(e.target.value))} className="w-full p-2 border border-rose-300 rounded-lg bg-white tabular-nums font-bold" />
          </div>
          <div>
            <label className="block font-bold text-rose-900 mb-1">Company Scope *</label>
            <select value={bgCompanyId} onChange={(e) => setBgCompanyId(e.target.value)} className="w-full p-2 border border-rose-300 rounded-lg bg-white">
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-rose-900 mb-1">Mandatory Emergency Incident Ticket & Justification *</label>
          <input required value={bgReason} onChange={(e) => setBgReason(e.target.value)} placeholder="INC-2026-0891: Production SAP sync outage recovery..." className="w-full p-2 border border-rose-300 rounded-lg bg-white text-xs" />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="px-4 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold cursor-pointer">
            Activate Break-Glass Emergency Access
          </button>
        </div>
      </form>
    </div>
  );
};
