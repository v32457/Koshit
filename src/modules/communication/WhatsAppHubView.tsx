import React, { useState } from 'react';
import {
  WhatsAppConfig,
  WhatsAppMode,
  WhatsAppTemplate,
  WhatsAppManualWorkItem,
  User,
} from '../../types';
import {
  INITIAL_WHATSAPP_CONFIG,
  INITIAL_WHATSAPP_TEMPLATES,
  INITIAL_WHATSAPP_WORK_ITEMS,
} from '../../data/communicationSeed';
import {
  MessageSquare,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  ShieldAlert,
  Server,
  UserCheck,
  Settings,
  Sparkles,
  Lock,
  Phone,
  ShieldCheck,
  Send,
  RefreshCw,
  Key,
  XCircle,
  UserPlus,
  Users,
} from 'lucide-react';

interface RecipientVerificationRecord {
  id: string;
  userId: string;
  name: string;
  roleOrTitle: string;
  normalizedPhone: string;
  verificationStatus: 'VERIFIED' | 'PENDING_OTP' | 'NOT_VERIFIED' | 'FAILED' | 'OPTED_OUT';
  consentStatus: 'OPTED_IN' | 'OPTED_OUT';
  verifiedAt?: string;
  verifiedBy?: string;
  lastOtpSentAt?: string;
}

const INITIAL_RECIPIENT_VERIFICATIONS: RecipientVerificationRecord[] = [
  {
    id: 'rv-01',
    userId: 'usr-checker-03',
    name: 'Ramesh Balasubramanian',
    roleOrTitle: 'Item Checker (Pondicherry HQ)',
    normalizedPhone: '+91 98401 23456',
    verificationStatus: 'VERIFIED',
    consentStatus: 'OPTED_IN',
    verifiedAt: '2026-10-15T09:30:00Z',
    verifiedBy: 'Suresh Kumar (Admin)',
  },
  {
    id: 'rv-02',
    userId: 'usr-maker-02',
    name: 'Karthik Raja',
    roleOrTitle: 'Item Maker (Pondicherry HQ)',
    normalizedPhone: '+91 94431 23456',
    verificationStatus: 'VERIFIED',
    consentStatus: 'OPTED_IN',
    verifiedAt: '2026-10-18T11:20:00Z',
    verifiedBy: 'Suresh Kumar (Admin)',
  },
  {
    id: 'rv-03',
    userId: 'usr-admin-01',
    name: 'Ananya Sharma',
    roleOrTitle: 'Global Item Admin',
    normalizedPhone: '+91 98845 67890',
    verificationStatus: 'VERIFIED',
    consentStatus: 'OPTED_IN',
    verifiedAt: '2026-10-20T14:00:00Z',
    verifiedBy: 'Suresh Kumar (Admin)',
  },
  {
    id: 'rv-04',
    userId: 'bp-contact-01',
    name: 'Mahindra Commercial Procurement',
    roleOrTitle: 'Customer Contact (Pune Plant)',
    normalizedPhone: '+91 98230 11223',
    verificationStatus: 'PENDING_OTP',
    consentStatus: 'OPTED_IN',
    lastOtpSentAt: '2026-10-22T08:00:00Z',
  },
  {
    id: 'rv-05',
    userId: 'usr-admin-02',
    name: 'Suresh Kumar',
    roleOrTitle: 'Platform Administrator',
    normalizedPhone: '+91 98765 43210',
    verificationStatus: 'VERIFIED',
    consentStatus: 'OPTED_IN',
    verifiedAt: '2026-09-01T08:00:00Z',
    verifiedBy: 'System Auto-Verify',
  },
];

interface WhatsAppHubViewProps {
  currentUser: User;
}

export const WhatsAppHubView: React.FC<WhatsAppHubViewProps> = ({ currentUser }) => {
  const [config, setConfig] = useState<WhatsAppConfig>(INITIAL_WHATSAPP_CONFIG);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(INITIAL_WHATSAPP_TEMPLATES);
  const [workItems, setWorkItems] = useState<WhatsAppManualWorkItem[]>(INITIAL_WHATSAPP_WORK_ITEMS);
  const [recipientRecords, setRecipientRecords] = useState<RecipientVerificationRecord[]>(INITIAL_RECIPIENT_VERIFICATIONS);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<'PASS' | 'FAIL' | null>(null);

  // Active OTP Verification Modal State
  const [otpModalRecord, setOtpModalRecord] = useState<RecipientVerificationRecord | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpSimulatedCode, setOtpSimulatedCode] = useState<string>('491823');
  const [otpMessageSent, setOtpMessageSent] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'SENDER_CONFIG' | 'RECIPIENTS' | 'WORK_QUEUE' | 'TEMPLATES'>('SENDER_CONFIG');

  // Switch Mode
  const handleModeChange = (newMode: WhatsAppMode) => {
    setConfig({
      ...config,
      mode: newMode,
      updatedAt: new Date().toISOString(),
    });
  };

  // Trigger OTP dispatch simulation
  const handleTriggerOtp = (record: RecipientVerificationRecord) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setOtpSimulatedCode(code);
    setOtpModalRecord(record);
    setEnteredOtp('');
    setOtpMessageSent(true);

    // Update record state to PENDING_OTP
    setRecipientRecords((prev) =>
      prev.map((r) =>
        r.id === record.id
          ? {
              ...r,
              verificationStatus: 'PENDING_OTP',
              lastOtpSentAt: new Date().toISOString(),
            }
          : r
      )
    );
  };

  // Confirm OTP
  const handleVerifyOtp = () => {
    if (!otpModalRecord) return;
    if (enteredOtp !== otpSimulatedCode) {
      alert(`Invalid OTP code entered. Please enter the simulated code: ${otpSimulatedCode}`);
      return;
    }

    setRecipientRecords((prev) =>
      prev.map((r) =>
        r.id === otpModalRecord.id
          ? {
              ...r,
              verificationStatus: 'VERIFIED',
              verifiedAt: new Date().toISOString(),
              verifiedBy: currentUser.fullName,
            }
          : r
      )
    );

    setOtpModalRecord(null);
    setEnteredOtp('');
    setOtpMessageSent(false);
  };

  // Invalidate verification (e.g., when user updates mobile number)
  const handleInvalidateVerification = (id: string) => {
    setRecipientRecords((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              verificationStatus: 'NOT_VERIFIED',
              verifiedAt: undefined,
              verifiedBy: undefined,
            }
          : r
      )
    );
  };

  // Toggle Opt-In / Opt-Out Consent
  const handleToggleConsent = (id: string) => {
    setRecipientRecords((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              consentStatus: r.consentStatus === 'OPTED_IN' ? 'OPTED_OUT' : 'OPTED_IN',
              verificationStatus: r.consentStatus === 'OPTED_IN' ? 'OPTED_OUT' : 'VERIFIED',
            }
          : r
      )
    );
  };

  // Launch click-to-chat
  const handleLaunchClickToChat = (item: WhatsAppManualWorkItem) => {
    const cleanPhone = item.recipientPhone.replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(item.renderedMessage);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encoded}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');

    setWorkItems((prev) =>
      prev.map((wi) =>
        wi.id === item.id
          ? {
              ...wi,
              status: 'USER_OPENED_WHATSAPP',
              updatedAt: new Date().toISOString(),
              operatorId: currentUser.fullName,
            }
          : wi
      )
    );
  };

  // Copy message
  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Record outcome
  const handleRecordOutcome = (
    id: string,
    status: 'USER_CONFIRMED_SENT' | 'DISCARDED',
    notes?: string
  ) => {
    setWorkItems((prev) =>
      prev.map((wi) =>
        wi.id === id
          ? {
              ...wi,
              status,
              updatedAt: new Date().toISOString(),
              operatorId: currentUser.fullName,
              operatorNotes: notes || wi.operatorNotes,
            }
          : wi
      )
    );
  };

  // Test Connection
  const handleTestConnection = () => {
    setTestingConnection(true);
    setTimeout(() => {
      setTestingConnection(false);
      setConnectionTestResult('PASS');
      setConfig((prev) => ({
        ...prev,
        lastTestStatus: 'PASS',
        lastTestTimestamp: new Date().toISOString(),
      }));
    }, 1200);
  };

  return (
    <div className="space-y-5 select-none">
      {/* Title Header */}
      <div className="bg-[#0B192C] text-white p-5 rounded-2xl border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600/30 border border-emerald-400/30 rounded-xl text-emerald-400">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-wide text-white">
                Central WhatsApp Business Integration & Recipient Verification
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                  config.mode === 'OFFICIAL_API'
                    ? 'bg-blue-900/60 text-blue-300 border-blue-600'
                    : config.mode === 'USER_ASSISTED'
                    ? 'bg-emerald-900/60 text-emerald-300 border-emerald-600'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                MODE: {config.mode}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              One Common Business Number Sender • E.164 Recipient Number Resolution & OTP Verification
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('SENDER_CONFIG')}
          className={`px-4 py-2.5 text-xs font-bold rounded-lg transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'SENDER_CONFIG'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Server className="w-4 h-4" />
          1. Central Company Sender Config
        </button>

        <button
          onClick={() => setActiveTab('RECIPIENTS')}
          className={`px-4 py-2.5 text-xs font-bold rounded-lg transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'RECIPIENTS'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          2. Recipient Number Verification ({recipientRecords.length})
        </button>

        <button
          onClick={() => setActiveTab('WORK_QUEUE')}
          className={`px-4 py-2.5 text-xs font-bold rounded-lg transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'WORK_QUEUE'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          3. Click-to-Chat Queue ({workItems.filter((w) => w.status !== 'DISCARDED').length})
        </button>

        <button
          onClick={() => setActiveTab('TEMPLATES')}
          className={`px-4 py-2.5 text-xs font-bold rounded-lg transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'TEMPLATES'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          4. Meta Approved Templates ({templates.length})
        </button>
      </div>

      {/* TAB 1: CENTRAL COMPANY SENDER CONFIGURATION */}
      {activeTab === 'SENDER_CONFIG' && (
        <div className="space-y-4">
          {/* Central Company Identity Banner */}
          <div className="bg-gradient-to-r from-[#0B192C] to-slate-800 text-white p-5 rounded-xl border border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                Centralized Enterprise Sender Identity
              </span>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Phone className="w-5 h-5 text-emerald-400" />
                KOSH INNOVATIONS PRIVATE LIMITED — Official Business Sender
              </h2>
              <div className="text-xs text-slate-300 font-mono flex items-center gap-3">
                <span>Sender Number: <strong className="text-emerald-300">+91 98*** **320 (+91 98401 22320)</strong></span>
                <span>WABA ID: <strong className="text-cyan-300">WABA-KOSH-INNOVATIONS-91413</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="bg-emerald-900/60 border border-emerald-600 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Gateway Verified & Active
              </span>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Select Outbound Delivery Mode</h3>
                <p className="text-xs text-slate-500">
                  Control automated background delivery vs operator-guided click-to-chat workflows
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Last Configured: {new Date(config.updatedAt).toLocaleDateString()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* OFF Mode */}
              <div
                onClick={() => handleModeChange('OFF')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                  config.mode === 'OFF'
                    ? 'border-slate-900 bg-slate-50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-900">
                      Mode: OFF
                    </span>
                    {config.mode === 'OFF' && <Check className="w-4 h-4 text-slate-900" />}
                  </div>
                  <h4 className="font-bold text-sm text-slate-800 mt-1">Feature Disabled</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Completely disable WhatsApp notifications. No click-to-chat links or API requests will be dispatched.
                  </p>
                </div>
              </div>

              {/* OFFICIAL_API Mode */}
              <div
                onClick={() => handleModeChange('OFFICIAL_API')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                  config.mode === 'OFFICIAL_API'
                    ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-blue-700">
                      Mode: OFFICIAL_API
                    </span>
                    {config.mode === 'OFFICIAL_API' && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mt-1">Meta WhatsApp Cloud API</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Automated background delivery from common company number via Meta Graph API v21.0.
                  </p>
                </div>
              </div>

              {/* USER_ASSISTED Mode */}
              <div
                onClick={() => handleModeChange('USER_ASSISTED')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                  config.mode === 'USER_ASSISTED'
                    ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-emerald-700">
                      Mode: USER_ASSISTED
                    </span>
                    {config.mode === 'USER_ASSISTED' && <Check className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mt-1">Click-to-Chat Queue</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Operator-guided dispatch via standard wa.me protocol with manual sent confirmation.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Official API Settings Panel */}
          {config.mode === 'OFFICIAL_API' && (
            <div className="bg-white rounded-xl border border-blue-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Meta WhatsApp Cloud API Gateway Settings
                    </h3>
                    <p className="text-xs text-slate-500">
                      Shared company credentials secured in Google Cloud Secret Manager vault
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {testingConnection ? (
                    'Testing Ping...'
                  ) : connectionTestResult === 'PASS' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" /> Ping Successful
                    </>
                  ) : (
                    'Test API Gateway Connection'
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Central Business Account ID (WABA)
                  </label>
                  <input
                    type="text"
                    value={config.businessAccountId}
                    onChange={(e) => setConfig({ ...config, businessAccountId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Central Phone Number ID
                  </label>
                  <input
                    type="text"
                    value={config.phoneNumberId}
                    onChange={(e) => setConfig({ ...config, phoneNumberId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Company Central Sender Number
                  </label>
                  <input
                    type="text"
                    value={config.senderNumber}
                    onChange={(e) => setConfig({ ...config, senderNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Access Token Vault Reference
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={config.secretVaultRef}
                      className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-mono"
                    />
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RECIPIENT NUMBER VERIFICATION & ROUTING */}
      {activeTab === 'RECIPIENTS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Recipient WhatsApp Number Verification & Opt-In Governance
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Strict E.164 normalization, user-account binding, and OTP verification status. Outbound notifications route ONLY to verified numbers.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600">
                {recipientRecords.filter((r) => r.verificationStatus === 'VERIFIED').length} / {recipientRecords.length} Numbers Verified
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Recipient Name & Title</th>
                  <th className="p-3">Linked Account ID</th>
                  <th className="p-3">Stored E.164 Phone</th>
                  <th className="p-3">Verification Status</th>
                  <th className="p-3">Consent Status</th>
                  <th className="p-3 text-right">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recipientRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-bold text-slate-900">
                      {r.name}
                      <span className="block text-[10px] text-slate-500 font-normal">{r.roleOrTitle}</span>
                    </td>
                    <td className="p-3 font-mono text-cyan-800 font-bold">{r.userId}</td>
                    <td className="p-3 font-mono font-bold text-slate-800">{r.normalizedPhone}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.verificationStatus === 'PENDING_OTP'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {r.verificationStatus}
                      </span>
                      {r.verifiedAt && (
                        <span className="block text-[9px] text-slate-400 font-mono mt-0.5">
                          Verified: {new Date(r.verifiedAt).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleToggleConsent(r.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                          r.consentStatus === 'OPTED_IN'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {r.consentStatus}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.verificationStatus !== 'VERIFIED' ? (
                          <button
                            onClick={() => handleTriggerOtp(r)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px] shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <Key className="w-3 h-3" /> Send OTP Code
                          </button>
                        ) : (
                          <button
                            onClick={() => handleInvalidateVerification(r.id)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-semibold text-[10px] cursor-pointer"
                            title="Invalidate verification when mobile number is updated"
                          >
                            Re-Verify Number
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CLICK-TO-CHAT WORK QUEUE */}
      {activeTab === 'WORK_QUEUE' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">
                  WhatsApp Manual Work Queue (Section 7.5 Compliance)
                </h3>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full font-mono">
                  {workItems.filter((w) => w.status !== 'DISCARDED').length} Active Items
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Labeled: "Manual — opens WhatsApp for operator confirmation"
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {workItems.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition ${
                  item.status === 'USER_CONFIRMED_SENT'
                    ? 'bg-slate-50 border-slate-200 opacity-80'
                    : item.status === 'USER_OPENED_WHATSAPP'
                    ? 'bg-blue-50/50 border-blue-200'
                    : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{item.recipientName}</span>
                      <span className="font-mono text-xs text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                        {item.recipientPhone}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800 font-mono mt-2 leading-relaxed">
                      {item.renderedMessage}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCopyMessage(item.id, item.renderedMessage)}
                      className="p-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} Copy
                    </button>

                    <button
                      onClick={() => handleLaunchClickToChat(item)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Launch WhatsApp
                    </button>

                    {item.status === 'USER_OPENED_WHATSAPP' && (
                      <button
                        onClick={() => handleRecordOutcome(item.id, 'USER_CONFIRMED_SENT')}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Sent
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: META APPROVED TEMPLATES */}
      {activeTab === 'TEMPLATES' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Pre-Approved WhatsApp Notification Templates
              </h3>
              <p className="text-xs text-slate-500">
                Approved Meta message templates for transactional item notifications
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((t) => (
              <div key={t.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">{t.displayName}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded font-mono">
                    {t.metaApprovalStatus}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  Meta Code: {t.code} • {t.language}
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg text-xs font-mono text-slate-700 border border-slate-100 leading-relaxed">
                  {t.bodyTemplate}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OTP VERIFICATION MODAL */}
      {otpModalRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm text-cyan-300 flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" />
                WhatsApp OTP Number Verification
              </h3>
              <button
                onClick={() => setOtpModalRecord(null)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg space-y-1">
                <div className="font-bold">Simulated OTP Dispatched</div>
                <div className="text-[11px] text-emerald-800">
                  Code sent to <strong>{otpModalRecord.normalizedPhone}</strong> ({otpModalRecord.name}):
                </div>
                <div className="text-base font-mono font-extrabold text-emerald-700 tracking-widest mt-1">
                  {otpSimulatedCode}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Enter Received 6-Digit OTP Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value)}
                  placeholder="e.g. 491823"
                  className="w-full text-center text-lg font-mono font-bold tracking-widest p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setOtpModalRecord(null)}
                className="px-3 py-1.5 text-xs text-slate-600 font-medium hover:bg-slate-200 rounded cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleVerifyOtp}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirm & Verify Number
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
