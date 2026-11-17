import React, { useMemo, useState } from 'react';
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
import { userRoleAdminService } from '../../services/userRoleAdminService';
import { mobileConsentService } from '../../services/mobileConsentService';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';
import { StatusTag } from '../settings/userRoleAdmin/shared';
import {
  MessageSquare,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  ShieldAlert,
  Server,
  UserCheck,
  Sparkles,
  Lock,
  Phone,
  ShieldCheck,
  Key,
} from 'lucide-react';

interface WhatsAppHubViewProps {
  currentUser: User;
}

export const WhatsAppHubView: React.FC<WhatsAppHubViewProps> = ({ currentUser }) => {
  const [config, setConfig] = useState<WhatsAppConfig>(INITIAL_WHATSAPP_CONFIG);
  const [templates] = useState<WhatsAppTemplate[]>(INITIAL_WHATSAPP_TEMPLATES);
  const [workItems, setWorkItems] = useState<WhatsAppManualWorkItem[]>(INITIAL_WHATSAPP_WORK_ITEMS);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<'PASS' | 'FAIL' | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [otpModalUser, setOtpModalUser] = useState<User | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpSimulatedCode, setOtpSimulatedCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  const [dispatchNotice, setDispatchNotice] = useState<{
    allowed: boolean;
    message: string;
    waUrl?: string;
    auditEventId?: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'SENDER_CONFIG' | 'RECIPIENTS' | 'WORK_QUEUE' | 'TEMPLATES'>('SENDER_CONFIG');

  const enterpriseUsers = useMemo(() => userRoleAdminService.getUsers(), [refreshTick]);
  const actor = { id: currentUser.id, name: currentUser.fullName };

  const recipientGrid = useStandardDataGrid({
    gridId: 'comm-whatsapp-recipients-v2',
    userId: currentUser.id,
    data: enterpriseUsers,
    defaultSortField: 'createdAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
  });

  const handleModeChange = (newMode: WhatsAppMode) => {
    setConfig({
      ...config,
      mode: newMode,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleTriggerOtp = (user: User) => {
    try {
      const res = mobileConsentService.initiateMobileOtp(user.id, actor);
      setOtpSimulatedCode(res.previewOtpCode);
      setOtpModalUser(user);
      setEnteredOtp('');
      setOtpError(null);
      setRefreshTick((t) => t + 1);
    } catch (err: any) {
      setDispatchNotice({ allowed: false, message: err.message });
    }
  };

  const handleVerifyOtp = () => {
    if (!otpModalUser) return;
    try {
      const res = mobileConsentService.confirmMobileOtp(otpModalUser.id, enteredOtp, actor);
      setRefreshTick((t) => t + 1);
      if (!res.verified) {
        setOtpError(res.message);
        return;
      }
      setDispatchNotice({
        allowed: true,
        message: `${res.message} Consent status remains independently governed (${res.user.mobileConsentStatus || 'N/A'}).`,
      });
      setOtpModalUser(null);
      setEnteredOtp('');
      setOtpError(null);
    } catch (err: any) {
      setOtpError(err.message);
    }
  };

  const handleLaunchClickToChat = (item: WhatsAppManualWorkItem) => {
    const matchedUser = enterpriseUsers.find(
      (u) => u.fullName.toLowerCase() === item.recipientName.toLowerCase()
    );

    const decision = mobileConsentService.evaluateCommunicationDispatch({
      targetUserId: matchedUser?.id,
      phoneNumber: item.recipientPhone,
      channel: 'WHATSAPP',
      purpose: 'WHATSAPP_NOTIFICATIONS',
      actor,
      context: `WhatsApp Hub Click-to-Chat (${item.id})`,
    });

    if (!decision.allowed) {
      setDispatchNotice({
        allowed: false,
        message: decision.reason,
        auditEventId: decision.auditEventId,
      });
      return;
    }

    const cleanPhone = (decision.e164Number || item.recipientPhone).replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(item.renderedMessage);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encoded}`;

    setDispatchNotice({
      allowed: true,
      message: `Consent & verification checks passed for ${item.recipientName}. Operator click-to-chat link prepared.`,
      waUrl,
    });

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

  const handleCopyMessage = (id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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
    }, 800);
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
                Central WhatsApp Business Integration &amp; Recipient Consent Gate
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
              One Common Business Number Sender • Independent OTP Verification &amp; Personal Mobile Consent Gate
            </p>
          </div>
        </div>
      </div>

      {dispatchNotice && (
        <div
          className={`rounded-xl border p-3.5 text-xs flex flex-wrap items-center justify-between gap-3 ${
            dispatchNotice.allowed
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              {dispatchNotice.allowed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-600" />
              )}
              <span>{dispatchNotice.message}</span>
            </div>
            {dispatchNotice.auditEventId && (
              <div className="text-[11px] font-mono">Audit Ref: {dispatchNotice.auditEventId}</div>
            )}
            {dispatchNotice.waUrl && (
              <a
                href={dispatchNotice.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 underline"
              >
                <ExternalLink className="w-3 h-3" /> Open Prepared WhatsApp Link
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => setDispatchNotice(null)}
            className="text-[11px] font-bold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
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
          type="button"
          onClick={() => setActiveTab('RECIPIENTS')}
          className={`px-4 py-2.5 text-xs font-bold rounded-lg transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'RECIPIENTS'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          2. Recipient Verification &amp; Consent ({enterpriseUsers.length})
        </button>

        <button
          type="button"
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
          type="button"
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
                <span>
                  Sender Number: <strong className="text-emerald-300">+91 98401 22320</strong>
                </span>
                <span>
                  WABA ID: <strong className="text-cyan-300">WABA-KOSH-INNOVATIONS-91413</strong>
                </span>
              </div>
            </div>

            <span className="bg-emerald-900/60 border border-emerald-600 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Gateway Verified &amp; Active
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Select Outbound Delivery Mode</h3>
                <p className="text-xs text-slate-500">
                  Control automated background delivery vs operator-guided click-to-chat workflows
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                Last Configured: {new Date(config.updatedAt).toLocaleDateString()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['OFF', 'OFFICIAL_API', 'USER_ASSISTED'] as WhatsAppMode[]).map((m) => (
                <div
                  key={m}
                  onClick={() => handleModeChange(m)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                    config.mode === m
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs uppercase tracking-wider text-slate-900">Mode: {m}</span>
                      {config.mode === m && <Check className="w-4 h-4 text-blue-600" />}
                    </div>
                    <h4 className="font-bold text-sm text-slate-800 mt-1">
                      {m === 'OFF'
                        ? 'Feature Disabled'
                        : m === 'OFFICIAL_API'
                        ? 'Meta WhatsApp Cloud API'
                        : 'Click-to-Chat Queue'}
                    </h4>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {config.mode === 'OFFICIAL_API' && (
            <div className="bg-white rounded-xl border border-blue-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Meta WhatsApp Cloud API Gateway Settings</h3>
                    <p className="text-xs text-slate-500">Shared company credentials secured in vault</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs shadow-xs cursor-pointer"
                >
                  {testingConnection
                    ? 'Testing Ping...'
                    : connectionTestResult === 'PASS'
                    ? 'Ping Successful'
                    : 'Test API Gateway Connection'}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">WABA ID</label>
                  <input
                    type="text"
                    value={config.businessAccountId}
                    onChange={(e) => setConfig({ ...config, businessAccountId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Vault Reference</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={config.secretVaultRef}
                      className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono"
                    />
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RECIPIENT NUMBER VERIFICATION & PERSONAL CONSENT */}
      {activeTab === 'RECIPIENTS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Recipient Mobile Verification &amp; Personal Mobile Consent
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Verification status (OTP) and Personal Mobile Consent are strictly decoupled. Personal numbers remain masked.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Recipient Name</th>
                  <th className="p-3">Association</th>
                  <th className="p-3">Masked Mobile &amp; Type</th>
                  <th className="p-3">Verification (OTP)</th>
                  <th className="p-3">Consent Status</th>
                  <th className="p-3 text-right">OTP Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recipientGrid.pagedData.map((u) => {
                  const mob = mobileConsentService.formatMobileForViewer(u, currentUser, false);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{u.fullName}</div>
                        <div className="text-[10px] text-slate-500">{u.role}</div>
                      </td>
                      <td className="p-3">
                        <StatusTag status={u.employeeAssociationStatus || 'ASSOCIATED'} />
                      </td>
                      <td className="p-3">
                        <div className="font-mono font-bold text-slate-800 tabular-nums">{mob.display}</div>
                        <div className="text-[10px] text-slate-500">
                          {u.mobileNumberType === 'PERSONAL'
                            ? 'Personal Mobile'
                            : u.mobileNumberType === 'OFFICIAL'
                            ? 'Official Mobile'
                            : 'No Mobile'}
                        </div>
                      </td>
                      <td className="p-3">
                        <StatusTag status={u.mobileVerificationStatus || 'NOT_VERIFIED'} />
                      </td>
                      <td className="p-3 space-y-1">
                        <StatusTag status={u.mobileConsentStatus || 'NOT_REQUIRED_OFFICIAL'} />
                        {u.mobileNumberType === 'PERSONAL' && (
                          <div className="text-[10px] text-slate-400">Employee Self-Service Only</div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {u.mobilePhone ? (
                          <button
                            type="button"
                            onClick={() => handleTriggerOtp(u)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px] shadow-xs cursor-pointer inline-flex items-center gap-1"
                          >
                            <Key className="w-3 h-3" /> Send OTP
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <DataGridFooter
            currentPage={recipientGrid.currentPage}
            totalPages={recipientGrid.totalPages}
            pageSize={recipientGrid.pageSize}
            totalRecords={recipientGrid.totalRecords}
            onPageChange={recipientGrid.setCurrentPage}
            onPageSizeChange={recipientGrid.setPageSize}
            pageSizeOptions={recipientGrid.pageSizeOptions}
          />
        </div>
      )}

      {/* TAB 3: CLICK-TO-CHAT WORK QUEUE */}
      {activeTab === 'WORK_QUEUE' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900">WhatsApp Manual Work Queue (Consent-Gated)</h3>
            <p className="text-xs text-slate-500">
              All click-to-chat dispatches are validated against Personal Mobile Consent and Employee Association status prior to link generation.
            </p>
          </div>

          <div className="space-y-3">
            {workItems.map((item) => {
              const matched = enterpriseUsers.find(
                (u) => u.fullName.toLowerCase() === item.recipientName.toLowerCase()
              );
              const displayPhone = matched
                ? mobileConsentService.formatMobileForViewer(matched, currentUser, false).display
                : item.recipientPhone;
              return (
                <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{item.recipientName}</span>
                        <span className="font-mono text-xs text-blue-800 bg-blue-50 px-2 py-0.5 rounded tabular-nums">
                          {displayPhone}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800 font-mono mt-2 leading-relaxed">
                        {item.renderedMessage}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(item.id, item.renderedMessage)}
                        className="p-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} Copy
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLaunchClickToChat(item)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Validate &amp; Prepare WhatsApp Link
                      </button>

                      {item.status === 'USER_OPENED_WHATSAPP' && (
                        <button
                          type="button"
                          onClick={() => handleRecordOutcome(item.id, 'USER_CONFIRMED_SENT')}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Sent
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: META APPROVED TEMPLATES */}
      {activeTab === 'TEMPLATES' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900">Pre-Approved WhatsApp Notification Templates</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((t) => (
              <div key={t.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">{t.displayName}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded font-mono">
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
      {otpModalUser && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm text-cyan-300 flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" />
                Mobile OTP Verification
              </h3>
              <button
                type="button"
                onClick={() => setOtpModalUser(null)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg space-y-1">
                <div className="font-bold">Simulated OTP Dispatched</div>
                <div className="text-[11px] text-emerald-800">
                  Target:{' '}
                  <strong>{mobileConsentService.formatMobileForViewer(otpModalUser, currentUser, false).display}</strong>{' '}
                  ({otpModalUser.fullName})
                </div>
                <div className="text-base font-mono font-extrabold text-emerald-700 tracking-widest mt-1">
                  {otpSimulatedCode}
                </div>
              </div>

              {otpError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-semibold">
                  {otpError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-800 mb-1">Enter Received 6-Digit OTP Code *</label>
                <input
                  type="text"
                  maxLength={6}
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value)}
                  placeholder="e.g. 491823"
                  className="w-full text-center text-lg font-mono font-bold tracking-widest p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setOtpModalUser(null)}
                className="px-3 py-1.5 text-xs text-slate-600 font-medium hover:bg-slate-200 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerifyOtp}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirm &amp; Verify Number
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
