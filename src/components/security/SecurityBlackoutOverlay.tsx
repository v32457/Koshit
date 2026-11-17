/**
 * KOSH INNOVATIONS — ZERO-TRUST SECURITY BLACKOUT & RECOVERY OVERLAY
 * Displays when a session is BLACKOUT_LOCKED, SUSPENDED, TERMINATED, or when focus-loss screen lock triggers.
 * Supports Re-Authentication recovery (for non-terminated sessions), Administrator Override, and Re-Login.
 */

import React, { useEffect, useState } from 'react';
import { ShieldAlert, Lock, KeyRound, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import type { User } from '../../types';
import type { SessionProtectionState } from '../../types/zeroTrustSecurity';

interface SecurityBlackoutOverlayProps {
  session: SessionProtectionState | null;
  currentUser: User;
  allowReauthRecovery: boolean;
  allowAdminOverride: boolean;
  localLockReason?: string | null;
  onUnlockLocalLock?: () => void;
  onReauthenticate: (reason: string, verificationCode: string) => Promise<void>;
  onAdminOverride: (reason: string) => Promise<void>;
  onLogout: () => void;
}

export const SecurityBlackoutOverlay: React.FC<SecurityBlackoutOverlayProps> = ({
  session,
  currentUser,
  allowReauthRecovery,
  allowAdminOverride,
  localLockReason,
  onUnlockLocalLock,
  onReauthenticate,
  onAdminOverride,
  onLogout,
}) => {
  const [verificationCode, setVerificationCode] = useState('');
  const [reauthReason, setReauthReason] = useState('Resuming protected KOSH workspace after verification');
  const [overrideReason, setOverrideReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number>(0);

  const isBackendLocked = Boolean(
    session &&
      (session.blackoutActive ||
        session.protectionStatus === 'BLACKOUT_LOCKED' ||
        session.protectionStatus === 'SUSPENDED' ||
        session.protectionStatus === 'TERMINATED')
  );
  const isTerminated = session?.protectionStatus === 'TERMINATED';
  const visible = isBackendLocked || Boolean(localLockReason);
  const isAdmin = currentUser.role === 'PLATFORM_ADMIN' || currentUser.role === 'ORG_ADMIN';

  useEffect(() => {
    if (!session?.blackoutUntil) {
      setRemainingSec(0);
      return;
    }
    const update = () => {
      const diff = Math.max(0, Math.round((new Date(session.blackoutUntil!).getTime() - Date.now()) / 1000));
      setRemainingSec(diff);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [session?.blackoutUntil]);

  if (!visible) return null;

  const handleReauthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!isBackendLocked && onUnlockLocalLock) {
      onUnlockLocalLock();
      return;
    }
    if (verificationCode.trim().length < 4) {
      setErrorMsg('Enter at least 4 characters of your password/2FA confirmation code.');
      return;
    }
    setBusy(true);
    try {
      await onReauthenticate(reauthReason, verificationCode.trim());
      setVerificationCode('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Re-authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleOverride = async () => {
    setErrorMsg(null);
    if (overrideReason.trim().length < 5) {
      setErrorMsg('Enter an administrator override justification (min 5 characters).');
      return;
    }
    setBusy(true);
    try {
      await onAdminOverride(overrideReason.trim());
      setOverrideReason('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Administrator override failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="security-blackout-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Zero-Trust Security Blackout Protection"
      className="fixed inset-0 z-[90] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="w-full max-w-xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="bg-[#0B192C] text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-600/20 border border-rose-400/40">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                {isTerminated
                  ? 'Session Terminated by Zero-Trust Security'
                  : 'Zero-Trust Security Blackout Active'}
              </h2>
              <p className="text-[11px] text-slate-300">
                Protected workspace data and backend APIs have been suspended.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded bg-rose-500/20 text-rose-200 border border-rose-400/30">
            {session?.protectionStatus || 'SCREEN_LOCKED'}
          </span>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-slate-900">Trigger Reason</div>
                <div className="text-slate-700 mt-0.5">
                  {session?.blackoutReason || localLockReason || 'Security policy violation detected.'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-[11px]">
              <div>
                <span className="text-slate-500 block">Incident Ref</span>
                <span className="font-mono font-bold text-slate-900">
                  {session?.incidentRef || 'LOCAL-GUARD'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Policy Version</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  v{session?.policyVersion || 1}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Event Timestamp</span>
                <span className="font-mono text-slate-800">
                  {(session?.blackoutTriggeredAt || new Date().toISOString()).slice(11, 19)} UTC
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Blackout Window</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {remainingSec > 0 ? `${remainingSec}s` : 'Active'}
                </span>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!isBackendLocked && localLockReason && onUnlockLocalLock && (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onUnlockLocalLock}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Resume Protected Workspace</span>
              </button>
            </div>
          )}

          {isBackendLocked && !isTerminated && allowReauthRecovery && (
            <form onSubmit={handleReauthSubmit} className="space-y-3 border border-slate-200 rounded-lg p-3.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <span>Session Re-Authentication Recovery ({currentUser.email})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Verification / 2FA Code
                  </label>
                  <input
                    type="password"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Enter verification code (e.g. KOSH2026)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Recovery Note
                  </label>
                  <input
                    type="text"
                    value={reauthReason}
                    onChange={(e) => setReauthReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  Sign Out Completely
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold cursor-pointer"
                >
                  {busy ? 'Verifying...' : 'Re-Authenticate & Unlock'}
                </button>
              </div>
            </form>
          )}

          {isBackendLocked && !isTerminated && allowAdminOverride && isAdmin && (
            <div className="border border-amber-200 bg-amber-50/70 rounded-lg p-3.5 space-y-2">
              <div className="font-bold text-amber-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                <span>Administrator Override (Audited)</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Enter mandatory override justification..."
                  className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleOverride}
                  className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-bold cursor-pointer whitespace-nowrap"
                >
                  Override Blackout
                </button>
              </div>
            </div>
          )}

          {isTerminated && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onLogout}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold cursor-pointer"
              >
                Return to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
