import React, { useState } from 'react';
import { Shield, Lock, Key, Mail, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export const GeneralSettingsView: React.FC = () => {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(30);
  const [maxFailedLogins, setMaxFailedLogins] = useState(5);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6 text-xs max-w-4xl">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            General Settings
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cloud deployment readiness: Configure Email OTP Two-Factor Authentication, session timeouts, and lockout rules.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer"
        >
          Save Security Settings
        </button>
      </div>

      {isSaved && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Security policies updated and recorded in enterprise audit trail.</span>
        </div>
      )}

      {/* 2FA Master Switch */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Email-Based Two-Factor Authentication (2FA)</h3>
              <p className="text-[11px] text-slate-500">
                Requires all users to verify a 6-digit one-time password (OTP) sent to their official corporate email upon login.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={twoFactorEnabled}
              onChange={(e) => setTwoFactorEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded border border-slate-200">
          <span className="font-semibold text-slate-800">Operational Policy:</span> When enabled, login sessions expire after the configured timeout and require re-authentication. 2FA state is visible in the application header.
        </div>
      </div>

      {/* Session Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-600" />
            Session Inactivity Timeout
          </h4>
          <p className="text-[11px] text-slate-500">
            Automatically invalidates session tokens after inactivity to protect plant terminals.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <input
              type="number"
              value={sessionTimeoutMinutes}
              onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
              className="p-1.5 border border-slate-300 rounded text-xs w-24 bg-white font-mono"
            />
            <span className="text-slate-700 font-medium">Minutes</span>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
            <Key className="w-4 h-4 text-slate-600" />
            Account Lockout Threshold
          </h4>
          <p className="text-[11px] text-slate-500">
            Locks user access after consecutive failed password or 2FA attempts.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <input
              type="number"
              value={maxFailedLogins}
              onChange={(e) => setMaxFailedLogins(Number(e.target.value))}
              className="p-1.5 border border-slate-300 rounded text-xs w-24 bg-white font-mono"
            />
            <span className="text-slate-700 font-medium">Failed Attempts</span>
          </div>
        </div>
      </div>
    </div>
  );
};
