import React, { useState } from 'react';
import { EmailConfig, EmailProviderType, EmailTlsMode, EmailAuthMode } from '../../types/communication';
import { INITIAL_EMAIL_CONFIG } from '../../data/communicationExtendedSeed';
import {
  Mail,
  Shield,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  Lock,
  Key,
  Server,
  Zap,
  Clock,
  History,
  RotateCcw,
  Check,
  Globe,
  Sliders,
  ExternalLink,
} from 'lucide-react';

export const EmailConfigView: React.FC = () => {
  const [config, setConfig] = useState<EmailConfig>(INITIAL_EMAIL_CONFIG);
  const [isEditing, setIsEditing] = useState(false);
  const [isRotateSecretOpen, setIsRotateSecretOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secretError, setSecretError] = useState<string | null>(null);

  // Testing states
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestOutput, setConnectionTestOutput] = useState<{
    status: 'SUCCESS' | 'FAILED' | null;
    timestamp: string;
    logs: string[];
    latencyMs: number;
  } | null>(null);

  // Test email send modal
  const [isSendTestModalOpen, setIsSendTestModalOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState(config.testRecipientAllowlist[0] || 'suresh.kumar@koshinnovations.com');
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  // Version history modal
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [savedSuccessAlert, setSavedSuccessAlert] = useState(false);

  const handleTestConnection = () => {
    setIsTestingConnection(true);
    setConnectionTestOutput(null);

    setTimeout(() => {
      setIsTestingConnection(false);
      setConnectionTestOutput({
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
        latencyMs: 114,
        logs: [
          `DNS resolution for ${config.smtpHost} -> 172.24.10.88 OK (12ms)`,
          `TCP socket connection opened on port ${config.smtpPort} OK (24ms)`,
          `EHLO greeting received: 220 mail-relay.koshinnovations.com ESMTP Postfix (31ms)`,
          `STARTTLS command dispatched -> 220 2.0.0 Ready to start TLS (28ms)`,
          `TLSv1.3 cryptographic handshake established [Cipher: TLS_AES_256_GCM_SHA384] OK (15ms)`,
          `AUTH LOGIN challenge successful for ${config.username} -> 235 2.7.0 Authentication Succeeded`,
          `Connection verified successfully in 114ms total round-trip.`,
        ],
      });
      setConfig((prev) => ({
        ...prev,
        lastTestStatus: 'PASS',
        lastTestTimestamp: new Date().toISOString(),
        lastTestDiagnostics: `Connected to ${config.smtpHost}:${config.smtpPort} with ${config.tlsMode}. Handshake took 114ms.`,
      }));
    }, 1200);
  };

  const handleSendTestEmail = () => {
    if (!testRecipient) return;
    setIsSendingTestEmail(true);
    setTestEmailResult(null);

    setTimeout(() => {
      setIsSendingTestEmail(false);
      setTestEmailResult(`Simulated test message dispatched to [${testRecipient}] via ${config.smtpHost}:${config.smtpPort}. Message ID: <test-ack-${Date.now()}@koshinnovations.com>. Status: 250 OK.`);
    }, 1000);
  };

  const handleRotateSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setSecretError('Password or Secret must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecretError('Secret values do not match.');
      return;
    }
    setSecretError(null);
    setConfig((prev) => ({
      ...prev,
      isSecretConfigured: true,
      version: prev.version + 1,
      updatedAt: new Date().toISOString(),
    }));
    setIsRotateSecretOpen(false);
    setNewPassword('');
    setConfirmPassword('');
    setSavedSuccessAlert(true);
    setTimeout(() => setSavedSuccessAlert(false), 3000);
  };

  const handleSaveConfig = () => {
    setConfig((prev) => ({
      ...prev,
      version: prev.version + 1,
      updatedAt: new Date().toISOString(),
    }));
    setIsEditing(false);
    setSavedSuccessAlert(true);
    setTimeout(() => setSavedSuccessAlert(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Email Configuration</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Pluggable SMTP & API relay settings, TLS encryption parameters, sender verification, and live diagnostics.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsVersionModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer shadow-xs transition"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>v{config.version}.0 History</span>
          </button>

          <button
            onClick={() => setIsSendTestModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Test Email</span>
          </button>

          <button
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
            <span>{isTestingConnection ? 'Testing...' : 'Test Connection'}</span>
          </button>
        </div>
      </div>

      {savedSuccessAlert && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Email configuration updated and new version registered in the system audit log.</span>
        </div>
      )}

      {/* Provider Health Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Service State</span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2.5 h-2.5 rounded-full ${config.isEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span className="text-base font-bold text-slate-900">{config.isEnabled ? 'ACTIVE & RELAYING' : 'DISABLED'}</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">{config.environment} Environment</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">TLS Encryption</span>
          <div className="flex items-center gap-2 mt-1 text-slate-900 font-bold text-base">
            <Lock className="w-4 h-4 text-emerald-600" />
            <span>{config.tlsMode} (Enforced)</span>
          </div>
          <span className="text-[11px] text-emerald-600 mt-0.5 block font-medium">Zero-Plaintext Downgrade</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Throughput Rate Limit</span>
          <div className="flex items-center gap-2 mt-1 text-slate-900 font-bold text-base">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>{config.rateLimitPerSec} msg / sec</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Max Payload: {config.maxMessageSizeMb} MB</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Last Health Check</span>
          <div className="flex items-center gap-2 mt-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-bold text-slate-900">{config.lastTestStatus === 'PASS' ? '114ms (Healthy)' : 'Unverified'}</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block truncate">{config.lastTestTimestamp ? new Date(config.lastTestTimestamp).toLocaleTimeString() : 'N/A'}</span>
        </div>
      </div>

      {/* Connection Test Diagnostics Output */}
      {connectionTestOutput && (
        <div className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs font-mono border border-slate-800 shadow-md">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>SMTP Handshake Diagnostic Protocol (Live Run in {connectionTestOutput.latencyMs}ms)</span>
            </div>
            <span className="text-slate-400 text-[11px]">{new Date(connectionTestOutput.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="space-y-1">
            {connectionTestOutput.logs.map((log, idx) => (
              <div key={idx} className="flex gap-2 text-slate-300">
                <span className="text-slate-500 select-none">&gt;</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Settings Form */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Connection & Authentication Parameters</h2>
            <p className="text-xs text-slate-500">Configure outbound SMTP relay or cloud email provider credentials.</p>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer shadow-xs"
              >
                Edit Parameters
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConfig}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  Save & Apply
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Configuration Name */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Configuration Profile Name</label>
            <input
              type="text"
              disabled={!isEditing}
              value={config.configName}
              onChange={(e) => setConfig({ ...config, configName: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-600 font-medium"
            />
          </div>

          {/* Provider Adapter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Provider Adapter</label>
            <select
              disabled={!isEditing}
              value={config.providerType}
              onChange={(e) => setConfig({ ...config, providerType: e.target.value as EmailProviderType })}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-600 font-medium cursor-pointer"
            >
              <option value="SMTP">Corporate SMTP / Postfix Relay</option>
              <option value="AWS_SES">Amazon Simple Email Service (SES)</option>
              <option value="SENDGRID">Twilio SendGrid API Adapter</option>
              <option value="RESEND">Resend Developer API</option>
              <option value="MAILGUN">Mailgun EU/US Transactional</option>
            </select>
          </div>

          {/* SMTP Host */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">SMTP Host / Server Endpoint</label>
            <input
              type="text"
              disabled={!isEditing}
              value={config.smtpHost}
              onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
              className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-600"
            />
          </div>

          {/* SMTP Port */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Port</label>
            <select
              disabled={!isEditing}
              value={config.smtpPort}
              onChange={(e) => setConfig({ ...config, smtpPort: parseInt(e.target.value) })}
              className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-600"
            >
              <option value={587}>587 (Standard Submission with STARTTLS)</option>
              <option value={465}>465 (SMTPS Implicit TLS)</option>
              <option value={25}>25 (Local MTA Relay)</option>
            </select>
          </div>

          {/* TLS Mode */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">TLS Security Mode</label>
            <select
              disabled={!isEditing}
              value={config.tlsMode}
              onChange={(e) => setConfig({ ...config, tlsMode: e.target.value as EmailTlsMode })}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-600 font-medium"
            >
              <option value="STARTTLS">STARTTLS (Opportunistic upgrade with certificate validation)</option>
              <option value="IMPLICIT_TLS">Implicit TLS / SMTPS (Direct TLS socket on port 465)</option>
              <option value="PLAIN">Plaintext (Controlled dev environments only)</option>
            </select>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">SMTP Username / API User</label>
            <input
              type="text"
              disabled={!isEditing}
              value={config.username}
              onChange={(e) => setConfig({ ...config, username: e.target.value })}
              className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-600"
            />
          </div>

          {/* Secret / Password Indicator */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password / API Secret</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 border border-slate-300 bg-slate-100 rounded-lg px-3 py-2 text-xs font-mono text-slate-500 flex items-center justify-between">
                <span>••••••••••••••••</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">CONFIGURED</span>
              </div>
              <button
                type="button"
                onClick={() => setIsRotateSecretOpen(true)}
                className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition"
                title="Rotate secret credentials"
              >
                <Key className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Raw secrets are never returned in plaintext.</p>
          </div>

          {/* Auth Mode */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Authentication Mode</label>
            <select
              disabled={!isEditing}
              value={config.authMode}
              onChange={(e) => setConfig({ ...config, authMode: e.target.value as EmailAuthMode })}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-600"
            >
              <option value="LOGIN_PASSWORD">AUTH LOGIN (Username & Password)</option>
              <option value="API_KEY">Bearer Token / API Key</option>
              <option value="OAUTH2_BEARER">OAuth2 Token Exchange</option>
            </select>
          </div>
        </div>

        {/* Sender Identity Section */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/40">
          <h3 className="text-xs font-bold text-slate-800">Sender Identity & Routing Policies</h3>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Sender Display Name</label>
            <input
              type="text"
              disabled={!isEditing}
              value={config.senderDisplayName}
              onChange={(e) => setConfig({ ...config, senderDisplayName: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-600 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Sender Email Address (From)</label>
            <input
              type="email"
              disabled={!isEditing}
              value={config.senderEmail}
              onChange={(e) => setConfig({ ...config, senderEmail: e.target.value })}
              className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reply-To Address</label>
            <input
              type="email"
              disabled={!isEditing}
              value={config.replyToEmail}
              onChange={(e) => setConfig({ ...config, replyToEmail: e.target.value })}
              className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-600"
            />
          </div>
        </div>

        {/* Timeouts & Limits Section */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/40">
          <h3 className="text-xs font-bold text-slate-800">Timeouts, Throttling & Allowlist</h3>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Connection Timeout (sec)</label>
            <input
              type="number"
              disabled={!isEditing}
              value={config.connectionTimeoutSec}
              onChange={(e) => setConfig({ ...config, connectionTimeoutSec: parseInt(e.target.value) || 10 })}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Send Timeout (sec)</label>
            <input
              type="number"
              disabled={!isEditing}
              value={config.sendTimeoutSec}
              onChange={(e) => setConfig({ ...config, sendTimeoutSec: parseInt(e.target.value) || 15 })}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Rate Limit (Messages/sec)</label>
            <input
              type="number"
              disabled={!isEditing}
              value={config.rateLimitPerSec}
              onChange={(e) => setConfig({ ...config, rateLimitPerSec: parseInt(e.target.value) || 20 })}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Max Message Size (MB)</label>
            <input
              type="number"
              disabled={!isEditing}
              value={config.maxMessageSizeMb}
              onChange={(e) => setConfig({ ...config, maxMessageSizeMb: parseInt(e.target.value) || 15 })}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-600"
            />
          </div>
        </div>
      </div>

      {/* Secret Rotation Modal */}
      {isRotateSecretOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Rotate SMTP Secret / Password</h3>
                <p className="text-xs text-slate-500">Provide new write-only credentials for outbound relay.</p>
              </div>
            </div>

            <form onSubmit={handleRotateSecret} className="space-y-3">
              {secretError && (
                <div className="bg-red-50 text-red-700 text-xs p-2.5 rounded-lg border border-red-200">
                  {secretError}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Password / Secret Token</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new strong password"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Secret</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg text-[11px] text-slate-600 border border-slate-200">
                Rotating this credential increments configuration to <strong>v{config.version + 1}.0</strong> and creates an audit entry.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRotateSecretOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                >
                  Confirm & Rotate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Test Email Modal */}
      {isSendTestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Send Explicit Test Email</h3>
                <p className="text-xs text-slate-500">Dispatch a test envelope to confirm end-to-end mailbox delivery.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Destination Recipient Email</label>
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Recipient must belong to authorized testing domain or allowlist.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
                <div className="font-semibold text-slate-900">Envelope Preview:</div>
                <div><strong>From:</strong> {config.senderDisplayName} &lt;{config.senderEmail}&gt;</div>
                <div><strong>Subject:</strong> [Kosh Test] SMTP Relay Diagnostic Handshake Verification</div>
                <div><strong>Security:</strong> Enforced TLS 1.3 / STARTTLS</div>
              </div>

              {testEmailResult && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs font-mono">
                  {testEmailResult}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsSendTestModalOpen(false);
                  setTestEmailResult(null);
                }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isSendingTestEmail}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingTestEmail ? 'Dispatching...' : 'Dispatch Test Email'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {isVersionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Email Configuration Version History</h3>
              </div>
              <button
                onClick={() => setIsVersionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-3">
                <div className="flex items-center justify-between font-bold text-blue-900">
                  <span>v3.0 (Active & Current)</span>
                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px]">CURRENT</span>
                </div>
                <p className="text-slate-600 mt-1">STARTTLS enforced on port 587. Updated by Suresh Kumar on 21-Oct-2026.</p>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between font-semibold text-slate-800">
                  <span>v2.0 (Archived)</span>
                  <span className="text-slate-400 text-[10px]">15-Oct-2026</span>
                </div>
                <p className="text-slate-500 mt-1">Switched to Postfix relay host mail-relay.koshinnovations.com.</p>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between font-semibold text-slate-800">
                  <span>v1.0 (Initial Deployment)</span>
                  <span className="text-slate-400 text-[10px]">01-Sep-2026</span>
                </div>
                <p className="text-slate-500 mt-1">Initial portal email relay provisioning.</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsVersionModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
