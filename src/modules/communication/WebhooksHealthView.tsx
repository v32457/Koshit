import React, { useState } from 'react';
import { WebhookEventRecord } from '../../types/communication';
import { INITIAL_WEBHOOK_EVENTS } from '../../data/communicationExtendedSeed';
import {
  Server,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Eye,
  Shield,
  Activity,
  Play,
} from 'lucide-react';

export const WebhooksHealthView: React.FC = () => {
  const [events, setEvents] = useState<WebhookEventRecord[]>(INITIAL_WEBHOOK_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEventRecord | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationNotice, setSimulationNotice] = useState<string | null>(null);

  // Trigger test webhook
  const handleSimulateWebhook = (type: 'message.delivered' | 'message.read' | 'message.bounced') => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      const newEvt: WebhookEventRecord = {
        id: `wh-sim-${Date.now()}`,
        provider: type === 'message.bounced' ? 'EMAIL_RELAY' : 'WHATSAPP_META',
        eventType: type,
        messageId: `sim-msg-${Date.now()}`,
        recipient: type === 'message.bounced' ? 'bounced.test@koshinnovations.com' : '+919840123456',
        timestamp: new Date().toISOString(),
        signatureStatus: 'VALID_HMAC_SHA256',
        payloadSummary: `Inbound webhook: ${type} event processed with verified signature.`,
        rawPayload: {
          event: type,
          timestamp: Date.now(),
          signature: 'sha256=9b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c',
          status: type.replace('message.', ''),
        },
      };

      setEvents([newEvt, ...events]);
      setSimulationNotice(`Simulated ${type} event received and verified against secret vault token.`);
      setTimeout(() => setSimulationNotice(null), 3000);
    }, 700);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Provider Webhooks & Health Operations</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time inbound delivery receipts, HMAC-SHA256 signature verification, and provider latency metrics.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSimulateWebhook('message.delivered')}
            disabled={isSimulating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer transition disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Simulate Delivery Receipt</span>
          </button>
        </div>
      </div>

      {simulationNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{simulationNotice}</span>
        </div>
      )}

      {/* Provider Health Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Email Provider Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-blue-600" />
              Corporate SMTP Relay
            </span>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
              99.98% UPTIME
            </span>
          </div>
          <div className="text-sm font-bold text-slate-900">mail-relay.koshinnovations.com:587</div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <div>Latency: <strong className="text-slate-800">114ms</strong></div>
            <div>Handshake: <strong className="text-emerald-700">TLS 1.3 OK</strong></div>
            <div>Queue Depth: <strong className="text-slate-800">1 msg</strong></div>
            <div>Failure Rate: <strong className="text-emerald-700">0.02%</strong></div>
          </div>
        </div>

        {/* WhatsApp Meta Cloud API Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-600" />
              Meta WhatsApp Cloud API
            </span>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
              CONNECTED
            </span>
          </div>
          <div className="text-sm font-bold text-slate-900">+91 413 222 3344 (Tier: 100K/day)</div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <div>Graph API: <strong className="text-slate-800">v21.0 OK</strong></div>
            <div>Webhook Ack: <strong className="text-emerald-700">42ms</strong></div>
            <div>Rate Capacity: <strong className="text-slate-800">80 msg/s</strong></div>
            <div>Quality Rating: <strong className="text-emerald-700">GREEN</strong></div>
          </div>
        </div>

        {/* Security & Webhook Signatures Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-600" />
              Signature Engine
            </span>
            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold">
              HMAC-SHA256
            </span>
          </div>
          <div className="text-sm font-bold text-slate-900">Replay Attack Shield (300s)</div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <div>Verified Events: <strong className="text-slate-800">{events.length}</strong></div>
            <div>Rejected: <strong className="text-slate-800">0</strong></div>
            <div>Secret Token: <strong className="text-slate-800">Vault OK</strong></div>
            <div>IP Allowlist: <strong className="text-emerald-700">Meta Ranges</strong></div>
          </div>
        </div>
      </div>

      {/* Inbound Webhook Event Feed */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Inbound Webhook Status Event Feed ({events.length})
          </span>
          <span className="text-[11px] text-slate-500">Live webhook ingress</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Event Type</th>
                <th className="px-4 py-3">Recipient / Message ID</th>
                <th className="px-4 py-3">Signature Verification</th>
                <th className="px-4 py-3 text-right">Raw Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </td>

                  <td className="px-4 py-3.5 font-bold text-slate-800">
                    {evt.provider}
                  </td>

                  <td className="px-4 py-3.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        evt.eventType === 'message.delivered' || evt.eventType === 'message.read'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {evt.eventType}
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="font-medium text-slate-800">{evt.recipient}</div>
                    <div className="text-[10px] font-mono text-slate-400 truncate max-w-xs">{evt.messageId}</div>
                  </td>

                  <td className="px-4 py-3.5">
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 w-fit">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{evt.signatureStatus}</span>
                    </span>
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => setSelectedEvent(evt)}
                      className="px-2.5 py-1 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-semibold"
                    >
                      Inspect JSON
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Payload Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Inbound Webhook Payload Inspector</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-900 text-emerald-400 font-mono p-3 rounded-lg overflow-x-auto max-h-72">
                <pre>{JSON.stringify(selectedEvent.rawPayload, null, 2)}</pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedEvent(null)}
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
