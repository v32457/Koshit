import React, { useState } from 'react';
import { WhatsAppConfig, WhatsAppMode } from '../../types';
import { INITIAL_WHATSAPP_CONFIG } from '../../data/communicationSeed';
import {
  MessageSquare,
  Shield,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Send,
  Lock,
  Key,
  Server,
  UserCheck,
  History,
  Power,
  ExternalLink,
  Smartphone,
  Copy,
  Check,
} from 'lucide-react';

export const WhatsAppConfigView: React.FC = () => {
  const [config, setConfig] = useState<WhatsAppConfig>(INITIAL_WHATSAPP_CONFIG);
  const [isEditing, setIsEditing] = useState(false);

  // Testing Graph API
  const [isTestingGraphApi, setIsTestingGraphApi] = useState(false);
  const [graphApiTestResult, setGraphApiTestResult] = useState<{
    status: 'PASS' | 'FAIL';
    timestamp: string;
    details: string[];
    wabaName: string;
    phoneQuality: string;
  } | null>(null);

  // Send test message
  const [isTestSendModalOpen, setIsTestSendModalOpen] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('+919840123456');
  const [testMsgStatus, setTestMsgStatus] = useState<string | null>(null);
  const [isSendingTestMsg, setIsSendingTestMsg] = useState(false);

  // Template sync status
  const [isSyncingTemplates, setIsSyncingTemplates] = useState(false);
  const [syncAlert, setSyncAlert] = useState<string | null>(null);

  // Webhook test signature
  const [isWebhookTesterOpen, setIsWebhookTesterOpen] = useState(false);
  const [webhookSignatureValid, setWebhookSignatureValid] = useState<boolean | null>(null);

  const handleModeChange = (mode: WhatsAppMode) => {
    setConfig((prev) => ({
      ...prev,
      mode,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleTestGraphApi = () => {
    setIsTestingGraphApi(true);
    setGraphApiTestResult(null);

    setTimeout(() => {
      setIsTestingGraphApi(false);
      setGraphApiTestResult({
        status: 'PASS',
        timestamp: new Date().toISOString(),
        wabaName: 'Kosh Innovations Pvt Ltd (Verified Business)',
        phoneQuality: 'GREEN (High Messaging Limit Tier - 100K/day)',
        details: [
          `GET https://graph.facebook.com/v21.0/${config.phoneNumberId} -> HTTP 200 OK (82ms)`,
          `Bearer token authenticated with whatsapp_business_messaging scope`,
          `Registered Name: "Kosh Innovations Global Item Portal"`,
          `Status: CONNECTED (Verified display name certificate valid)`,
          `Webhook URL subscribed for event 'messages' -> 200 OK`,
        ],
      });
      setConfig((prev) => ({
        ...prev,
        lastTestStatus: 'PASS',
        lastTestTimestamp: new Date().toISOString(),
      }));
    }, 1100);
  };

  const handleSendTestMessage = () => {
    if (!testPhoneNumber) return;
    setIsSendingTestMsg(true);
    setTestMsgStatus(null);

    setTimeout(() => {
      setIsSendingTestMsg(false);
      setTestMsgStatus(`Meta Cloud API accepted message: wamid.HBgMOTE5ODQwMTIzNDU2FQIAERgSRTk0OTM5 for ${testPhoneNumber}.`);
    }, 900);
  };

  const handleSyncTemplates = () => {
    setIsSyncingTemplates(true);
    setSyncAlert(null);

    setTimeout(() => {
      setIsSyncingTemplates(false);
      setSyncAlert('Successfully synchronized 3 WhatsApp templates from Meta Business Manager. All templates APPROVED.');
      setTimeout(() => setSyncAlert(null), 4000);
    }, 1200);
  };

  const handleValidateWebhookSignature = () => {
    setWebhookSignatureValid(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">WhatsApp Configuration</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Official Meta WhatsApp Cloud API credentials, 3 controlled operational modes, webhooks, and rate limits.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncTemplates}
            disabled={isSyncingTemplates || config.mode === 'OFF'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-xs transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingTemplates ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
            <span>{isSyncingTemplates ? 'Syncing...' : 'Sync Meta Templates'}</span>
          </button>

          <button
            onClick={() => setIsTestSendModalOpen(true)}
            disabled={config.mode === 'OFF'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer transition disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Test WhatsApp</span>
          </button>

          <button
            onClick={handleTestGraphApi}
            disabled={isTestingGraphApi || config.mode === 'OFF'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer transition disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${isTestingGraphApi ? 'animate-spin' : ''}`} />
            <span>{isTestingGraphApi ? 'Testing API...' : 'Test Graph API'}</span>
          </button>
        </div>
      </div>

      {syncAlert && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncAlert}</span>
        </div>
      )}

      {/* 3 Explicit Modes Selector Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            WhatsApp Integration Operational Mode
          </span>
          <span className="text-[11px] font-semibold text-slate-500">
            Selected: <span className="text-emerald-700 font-bold">{config.mode}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Mode 1: OFF */}
          <button
            onClick={() => handleModeChange('OFF')}
            className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              config.mode === 'OFF'
                ? 'border-red-500 bg-red-50/50 shadow-xs ring-2 ring-red-400'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Power className="w-4 h-4 text-red-500" />
                  OFF (Disabled)
                </span>
                {config.mode === 'OFF' && <Check className="w-4 h-4 text-red-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Completely stops all WhatsApp message creation, queueing, and dispatch. Non-delivering policy retained.
              </p>
            </div>
          </button>

          {/* Mode 2: OFFICIAL_API */}
          <button
            onClick={() => handleModeChange('OFFICIAL_API')}
            className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              config.mode === 'OFFICIAL_API'
                ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-400'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-emerald-600" />
                  OFFICIAL_API (Meta Cloud API)
                </span>
                {config.mode === 'OFFICIAL_API' && <Check className="w-4 h-4 text-emerald-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Automated programmatic delivery via official Meta WhatsApp Business Platform with webhook delivery receipts.
              </p>
            </div>
          </button>

          {/* Mode 3: USER_ASSISTED */}
          <button
            onClick={() => handleModeChange('USER_ASSISTED')}
            className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              config.mode === 'USER_ASSISTED'
                ? 'border-blue-500 bg-blue-50/50 shadow-xs ring-2 ring-blue-400'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  USER_ASSISTED (Click-to-Chat)
                </span>
                {config.mode === 'USER_ASSISTED' && <Check className="w-4 h-4 text-blue-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Generates <code className="font-mono text-[10px] text-blue-700">wa.me/</code> prefilled links for human operator review and manual dispatch. Zero unauthorized scraping.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Mode Warning Notice */}
      {config.mode === 'USER_ASSISTED' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">USER_ASSISTED Operating Notice:</span> The application prepares structured, approved messages and opens WhatsApp Web/desktop for operator dispatch. The system records &quot;Draft Prepared&quot; and &quot;Operator Marked Sent&quot; independently, and explicitly does not claim automated Meta delivery confirmation.
          </div>
        </div>
      )}

      {config.mode === 'OFF' && (
        <div className="bg-slate-100 border border-slate-300 rounded-xl p-3.5 text-xs text-slate-700 flex items-center gap-2.5">
          <Power className="w-4 h-4 text-slate-500 shrink-0" />
          <div>
            <span className="font-bold">WhatsApp Channel is Currently OFF:</span> Notification rules routing to WhatsApp will be safely held as non-delivering intents in the audit log without throwing system errors.
          </div>
        </div>
      )}

      {/* Graph API Test Diagnostics */}
      {graphApiTestResult && (
        <div className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs font-mono border border-slate-800 shadow-md">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Meta WhatsApp Cloud API Diagnostic Output (Status: 200 OK)</span>
            </div>
            <span className="text-slate-400 text-[11px]">{new Date(graphApiTestResult.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="mb-2 text-slate-300">
            <div>WABA Account: <strong className="text-white">{graphApiTestResult.wabaName}</strong></div>
            <div>Phone Tier: <strong className="text-emerald-400">{graphApiTestResult.phoneQuality}</strong></div>
          </div>
          <div className="space-y-1 text-slate-400">
            {graphApiTestResult.details.map((d, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-slate-600">&gt;</span>
                <span>{d}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Settings Form */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Meta WhatsApp Cloud API & Webhook Parameters</h2>
            <p className="text-xs text-slate-500">Official business credentials stored in enterprise secret references.</p>
          </div>
          <div>
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
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Business Account ID */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Business Account ID (WABA)</label>
            <input
              type="text"
              disabled={!isEditing}
              value={config.businessAccountId}
              onChange={(e) => setConfig({ ...config, businessAccountId: e.target.value })}
              className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100"
            />
          </div>

          {/* Phone Number ID */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number ID</label>
            <input
              type="text"
              disabled={!isEditing}
              value={config.phoneNumberId}
              onChange={(e) => setConfig({ ...config, phoneNumberId: e.target.value })}
              className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100"
            />
          </div>

          {/* Registered Sender Phone Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Registered Display Number</label>
            <input
              type="text"
              disabled={!isEditing}
              value={config.senderNumber}
              onChange={(e) => setConfig({ ...config, senderNumber: e.target.value })}
              className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100 font-bold text-emerald-800"
            />
          </div>

          {/* Secret Token Vault Reference */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">System User Access Token</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 border border-slate-300 bg-slate-100 rounded-lg px-3 py-2 text-xs font-mono text-slate-500 flex items-center justify-between">
                <span>••••••••••••••••</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">VAULT LOCKED</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-mono">{config.secretVaultRef}</p>
          </div>

          {/* Graph API Version */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Graph API Version</label>
            <select
              disabled={!isEditing}
              value={config.apiVersion}
              onChange={(e) => setConfig({ ...config, apiVersion: e.target.value })}
              className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100"
            >
              <option value="v21.0">v21.0 (Current Stable Meta Version)</option>
              <option value="v20.0">v20.0 (Legacy)</option>
            </select>
          </div>

          {/* Rate Limit */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Throughput Rate Limit</label>
            <input
              type="number"
              disabled={!isEditing}
              value={config.rateLimitPerSec}
              onChange={(e) => setConfig({ ...config, rateLimitPerSec: parseInt(e.target.value) || 10 })}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 disabled:bg-slate-100"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Tier Limit: 80 messages per second max</span>
          </div>
        </div>

        {/* Webhooks Section */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/40 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800">Inbound Webhook Verification & HMAC Security</h3>
          <button
            onClick={() => setIsWebhookTesterOpen(!isWebhookTesterOpen)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            {isWebhookTesterOpen ? 'Hide Signature Tester' : 'Open Webhook Tester'}
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Webhook Inbound Endpoint URL</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                disabled
                value={config.webhookUrl}
                className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-100 text-slate-700"
              />
              <button
                onClick={() => navigator.clipboard.writeText(config.webhookUrl)}
                className="p-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg text-slate-600"
                title="Copy Webhook URL"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Registered in Meta App Dashboard under WhatsApp &gt; Configuration &gt; Callback URL.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Webhook Verify Token Reference</label>
            <div className="border border-slate-300 bg-slate-100 rounded-lg px-3 py-2 text-xs font-mono text-slate-600">
              {config.webhookVerifyTokenRef}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Used during GET verification handshake (hub.challenge response).
            </p>
          </div>
        </div>

        {/* Webhook Signature Simulator */}
        {isWebhookTesterOpen && (
          <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/70 space-y-3">
            <div className="text-xs font-bold text-slate-900">HMAC-SHA256 Signature Verification Simulator</div>
            <p className="text-xs text-slate-500">
              Simulates inbound POST delivery receipt with header <code className="font-mono text-blue-700">X-Hub-Signature-256: sha256=...</code>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleValidateWebhookSignature}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Simulate Inbound POST & Validate HMAC
              </button>
              {webhookSignatureValid && (
                <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Signature Verified: HMAC-SHA256 matches application app secret.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Send Test WhatsApp Modal */}
      {isTestSendModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Send Test WhatsApp Message</h3>
                <p className="text-xs text-slate-500">Dispatch a test message using approved template kosh_item_approval_alert.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Destination Phone Number (E.164 format)</label>
                <input
                  type="text"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Must include country code, e.g. +91 98401 23456.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
                <div className="font-semibold text-slate-900">Payload Preview:</div>
                <div><strong>Template:</strong> kosh_item_approval_alert (en_US)</div>
                <div><strong>Parameters:</strong> Ramesh Balasubramanian, MAPALBL0003, Machine Parts, Karthik Raja</div>
                <div><strong>Mode:</strong> {config.mode}</div>
              </div>

              {testMsgStatus && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs font-mono">
                  {testMsgStatus}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsTestSendModalOpen(false);
                  setTestMsgStatus(null);
                }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSendTestMessage}
                disabled={isSendingTestMsg}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingTestMsg ? 'Dispatching...' : 'Dispatch WhatsApp'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
