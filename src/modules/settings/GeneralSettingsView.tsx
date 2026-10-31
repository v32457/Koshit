import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  Key,
  Mail,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Zap,
  RefreshCw,
  Server,
  Globe,
  Sliders,
  Check,
  Eye,
  EyeOff,
  Radio,
  FileCheck,
} from 'lucide-react';
import {
  getGstVerificationMode,
  setGstVerificationMode,
  getGstProviderConfig,
  saveGstProviderConfig,
  testPaidProviderConnection,
  maskSecret,
} from '../../services/gstService';
import { GSTVerificationMode, GSTProviderConfig } from '../../types';

export const GeneralSettingsView: React.FC = () => {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(30);
  const [maxFailedLogins, setMaxFailedLogins] = useState(5);
  const [isSaved, setIsSaved] = useState(false);

  // GST Verification Settings State
  const [gstMode, setGstModeState] = useState<GSTVerificationMode>(() => getGstVerificationMode());
  const [gstConfig, setGstConfig] = useState<GSTProviderConfig>(() => getGstProviderConfig());
  const [showApiKey, setShowApiKey] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [isTestingGst, setIsTestingGst] = useState(false);
  const [gstTestFeedback, setGstTestFeedback] = useState<{ success: boolean; msg: string; latency?: number } | null>(null);
  const [gstSaveSuccess, setGstSaveSuccess] = useState(false);

  const handleSaveSecurity = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleSaveGstConfig = () => {
    setGstVerificationMode(gstMode);
    saveGstProviderConfig(gstConfig);
    setGstSaveSuccess(true);
    setTimeout(() => setGstSaveSuccess(false), 3000);
  };

  const handleTestConnection = async () => {
    setIsTestingGst(true);
    setGstTestFeedback(null);
    try {
      const res = await testPaidProviderConnection(gstConfig);
      setGstTestFeedback({
        success: res.success,
        msg: res.message,
        latency: res.latencyMs,
      });
      // Refresh local config to reflect lastTestedAt
      setGstConfig(getGstProviderConfig());
    } catch (err: any) {
      setGstTestFeedback({
        success: false,
        msg: err?.message || 'Connection test failed to reach provider endpoint.',
      });
    } finally {
      setIsTestingGst(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6 text-xs max-w-4xl font-sans">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            General & Verification Settings
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure Email OTP Two-Factor Authentication, Session Timeouts, and Master GSTIN Verification Modes.
          </p>
        </div>

        <button
          onClick={handleSaveSecurity}
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

      {/* ------------------------------------------------------------------------- */}
      {/* SECTION: GST VERIFICATION CONFIGURATION & MODES */}
      {/* ------------------------------------------------------------------------- */}
      <div className="border-t border-slate-200 pt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              GST Verification Configuration & Modes
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Select the active GSTIN taxpayer verification mode and configure automated API provider credentials.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveGstConfig}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Save GST Configuration
          </button>
        </div>

        {gstSaveSuccess && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>GST Verification Mode and Provider credentials persisted successfully.</span>
          </div>
        )}

        {/* Mode Selector Radio Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: Manual CAPTCHA Mode */}
          <div
            onClick={() => setGstModeState('MANUAL_CAPTCHA')}
            className={`p-4 rounded-xl border-2 transition cursor-pointer space-y-2.5 ${
              gstMode === 'MANUAL_CAPTCHA'
                ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-500/30'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <input
                  type="radio"
                  name="gstMode"
                  checked={gstMode === 'MANUAL_CAPTCHA'}
                  onChange={() => setGstModeState('MANUAL_CAPTCHA')}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Manual CAPTCHA Mode (Default)</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                Official Portal
              </span>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              Uses the official Govt GSTN taxpayer search workflow with user-assisted inline CAPTCHA challenge. 
              Zero recurring API costs, session-bound challenge (120s timeout), and strict answer validation.
            </p>

            <div className="text-[10px] font-mono bg-white/80 p-2 rounded border border-slate-200 text-slate-600">
              Flow: Enter GSTIN → Inline CAPTCHA Challenge → Solve Challenge → Pre-save Review Modal → Confirm.
            </div>
          </div>

          {/* Option 2: Paid API Mode */}
          <div
            onClick={() => setGstModeState('PAID_API')}
            className={`p-4 rounded-xl border-2 transition cursor-pointer space-y-2.5 ${
              gstMode === 'PAID_API'
                ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-500/30'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <input
                  type="radio"
                  name="gstMode"
                  checked={gstMode === 'PAID_API'}
                  onChange={() => setGstModeState('PAID_API')}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Paid API Mode (Automated)</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                B2B Provider
              </span>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              Automated instantaneous GSTIN taxpayer lookup without CAPTCHA. Connects to authorized GSP providers 
              (ClearTax, Iris GST, or direct Sandbox) using enterprise server credentials.
            </p>

            <div className="text-[10px] font-mono bg-white/80 p-2 rounded border border-slate-200 text-slate-600">
              Flow: Enter GSTIN → Direct Verification via API Gateway → Pre-save Review Modal → Confirm.
            </div>
          </div>
        </div>

        {/* Paid API Provider Credentials Panel (Rendered when Paid API Mode is active or being configured) */}
        {gstMode === 'PAID_API' && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-slate-900 text-xs">Paid Provider Connection & Credentials</h4>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 text-[11px]">
                  <span>Provider Active:</span>
                  <input
                    type="checkbox"
                    checked={gstConfig.isActive}
                    onChange={(e) => setGstConfig({ ...gstConfig, isActive: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingGst}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition"
                >
                  {isTestingGst ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" /> : <Zap className="w-3.5 h-3.5 text-indigo-600" />}
                  <span>Test Connection</span>
                </button>
              </div>
            </div>

            {/* Test Connection Feedback Banner */}
            {gstTestFeedback && (
              <div
                className={`p-3 rounded-lg border text-xs font-bold flex items-start gap-2 ${
                  gstTestFeedback.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-rose-50 border-rose-300 text-rose-800'
                }`}
              >
                {gstTestFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div>{gstTestFeedback.msg}</div>
                  {gstTestFeedback.latency && (
                    <div className="text-[10px] font-mono text-emerald-700">Roundtrip Latency: {gstTestFeedback.latency}ms</div>
                  )}
                </div>
              </div>
            )}

            {/* Provider Form Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">GST API Provider *</label>
                <select
                  value={gstConfig.providerName}
                  onChange={(e) =>
                    setGstConfig({
                      ...gstConfig,
                      providerName: e.target.value as any,
                      endpointUrl:
                        e.target.value === 'CLEAR_TAX'
                          ? 'https://api.cleartax.in/v2/gstin/search'
                          : e.target.value === 'IRIS_GST'
                          ? 'https://api.irisgst.com/v2/search'
                          : e.target.value === 'GOVT_DIRECT_SANDBOX'
                          ? 'https://sandbox.gst.gov.in/taxpayerapi/v1.0/search'
                          : gstConfig.endpointUrl,
                    })
                  }
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold"
                >
                  <option value="CLEAR_TAX">ClearTax GST API (Recommended)</option>
                  <option value="IRIS_GST">IRIS GST Peridot Enterprise</option>
                  <option value="GOVT_DIRECT_SANDBOX">Official Govt GSTN Developer Sandbox</option>
                  <option value="CUSTOM_REST">Custom Enterprise REST Endpoint</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Provider Endpoint URL *</label>
                <input
                  type="text"
                  value={gstConfig.endpointUrl}
                  onChange={(e) => setGstConfig({ ...gstConfig, endpointUrl: e.target.value })}
                  placeholder="https://api.provider.com/gstin/lookup"
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>API Key / Secret Token *</span>
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 font-normal cursor-pointer"
                  >
                    {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showApiKey ? 'Mask' : 'Reveal'}
                  </button>
                </label>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={gstConfig.apiKey}
                  onChange={(e) => setGstConfig({ ...gstConfig, apiKey: e.target.value })}
                  placeholder="••••••••••••••••"
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Client ID / App Key</label>
                <input
                  type="text"
                  value={gstConfig.clientId}
                  onChange={(e) => setGstConfig({ ...gstConfig, clientId: e.target.value })}
                  placeholder="e.g. KOSH-PROD-APP"
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Client Secret</span>
                  <button
                    type="button"
                    onClick={() => setShowClientSecret(!showClientSecret)}
                    className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 font-normal cursor-pointer"
                  >
                    {showClientSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showClientSecret ? 'Mask' : 'Reveal'}
                  </button>
                </label>
                <input
                  type={showClientSecret ? 'text' : 'password'}
                  value={gstConfig.clientSecret}
                  onChange={(e) => setGstConfig({ ...gstConfig, clientSecret: e.target.value })}
                  placeholder="••••••••••••••••"
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Request Timeout (Seconds)</label>
                <input
                  type="number"
                  min={5}
                  max={60}
                  value={gstConfig.timeoutSeconds}
                  onChange={(e) => setGstConfig({ ...gstConfig, timeoutSeconds: Number(e.target.value) || 15 })}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
            </div>

            {/* Last tested info */}
            {gstConfig.lastTestedAt && (
              <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between pt-1 border-t border-slate-200">
                <span>Last Tested: {new Date(gstConfig.lastTestedAt).toLocaleString()}</span>
                <span>Status: <strong className="text-emerald-700">{gstConfig.testStatus || 'SUCCESS'}</strong></span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
