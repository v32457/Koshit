import React, { useState } from 'react';
import { NotificationRule } from '../../types/communication';
import { INITIAL_NOTIFICATION_RULES } from '../../data/communicationExtendedSeed';
import {
  Sliders,
  CheckCircle2,
  Play,
  Zap,
  Mail,
  MessageSquare,
  Bell,
  Plus,
  Edit2,
  Check,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const NotificationRulesView: React.FC = () => {
  const [rules, setRules] = useState<NotificationRule[]>(INITIAL_NOTIFICATION_RULES);
  const [selectedRule, setSelectedRule] = useState<NotificationRule>(rules[0]);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Simulator State
  const [simEvent, setSimEvent] = useState('ITEM_SUBMITTED');
  const [simItemCode, setSimItemCode] = useState('MAPALBL0003');
  const [simRecipient, setSimRecipient] = useState('ramesh.checker@koshinnovations.com');
  const [simResult, setSimResult] = useState<{
    matchedRule: string;
    conditionEvaluated: boolean;
    resolvedChannels: string[];
    simulatedPreview: string;
  } | null>(null);

  const handleToggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isEnabled: !r.isEnabled } : r))
    );
  };

  const handleRunSimulation = () => {
    const matched = rules.find((r) => r.eventCode === simEvent && r.isEnabled);
    if (!matched) {
      setSimResult({
        matchedRule: 'NO_ACTIVE_RULE_FOUND',
        conditionEvaluated: false,
        resolvedChannels: [],
        simulatedPreview: 'No active notification rule mapped to event: ' + simEvent,
      });
      return;
    }

    const channels: string[] = [];
    if (matched.channels.email) channels.push('EMAIL (Active SMTP)');
    if (matched.channels.whatsApp) channels.push('WHATSAPP (Meta Cloud API)');
    if (matched.channels.inPortal) channels.push('IN_PORTAL (Live Drawer)');

    setSimResult({
      matchedRule: matched.name,
      conditionEvaluated: true,
      resolvedChannels: channels,
      simulatedPreview: `[Simulated Notification] Review Required: Item ${simItemCode} submitted by Karthik Raja. Recipient resolved: ${simRecipient}. Priority: ${matched.priority}.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Notification Rules & Event Mapping</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Declarative trigger conditions, recipient resolver matrices, and channel eligibility rules.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsSimulatorOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer transition"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Dry-Run Rule Simulator</span>
        </button>
      </div>

      {/* Rules Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Registered Event Notification Rules ({rules.length})
          </span>
          <span className="text-[11px] text-slate-500">Evaluated on business transaction commit</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Rule Name & Event</th>
                <th className="px-4 py-3">Trigger Condition</th>
                <th className="px-4 py-3">Recipient Resolver</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Eligible Channels</th>
                <th className="px-4 py-3 text-right">Rule State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3.5">
                    <div className="font-bold text-slate-900">{rule.name}</div>
                    <div className="text-[11px] font-mono text-slate-500">{rule.eventCode}</div>
                  </td>

                  <td className="px-4 py-3.5">
                    <code className="text-[11px] bg-slate-100 text-slate-800 px-2 py-1 rounded font-mono border border-slate-200">
                      {rule.triggerCondition}
                    </code>
                  </td>

                  <td className="px-4 py-3.5 font-medium text-slate-700">
                    <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded text-[11px] font-semibold border border-blue-200">
                      {rule.recipientResolutionRule}
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        rule.priority === 'CRITICAL'
                          ? 'bg-red-100 text-red-800'
                          : rule.priority === 'HIGH'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {rule.priority}
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`p-1 rounded ${rule.channels.email ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-300'}`}
                        title="Email Channel"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </span>
                      <span
                        className={`p-1 rounded ${rule.channels.whatsApp ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-300'}`}
                        title="WhatsApp Channel"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </span>
                      <span
                        className={`p-1 rounded ${rule.channels.inPortal ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-300'}`}
                        title="In-Portal Notification"
                      >
                        <Bell className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition ${
                        rule.isEnabled
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {rule.isEnabled ? 'ACTIVE' : 'MUTED'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dry Run Simulation Modal */}
      {isSimulatorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <Play className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Rule Engine Dry-Run Simulator</h3>
                  <p className="text-xs text-slate-500">Test how incoming domain events trigger notification pipelines.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsSimulatorOpen(false);
                  setSimResult(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Trigger Event</label>
                <select
                  value={simEvent}
                  onChange={(e) => setSimEvent(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50"
                >
                  <option value="ITEM_SUBMITTED">ITEM_SUBMITTED (Item Maker locks item code)</option>
                  <option value="ITEM_APPROVED">ITEM_APPROVED (Checker authorizes record)</option>
                  <option value="SAP_SYNC_FAILED">SAP_SYNC_FAILED (Service Layer error)</option>
                  <option value="TWO_FACTOR_OTP">TWO_FACTOR_OTP (Passcode requested)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Item Code Payload</label>
                  <input
                    type="text"
                    value={simItemCode}
                    onChange={(e) => setSimItemCode(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Resolved Recipient</label>
                  <input
                    type="text"
                    value={simRecipient}
                    onChange={(e) => setSimRecipient(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {simResult && (
                <div className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs space-y-2 font-mono">
                  <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Rule Match: {simResult.matchedRule}</span>
                  </div>
                  <div>Condition: <span className="text-amber-300">PASS (Rule criteria met)</span></div>
                  <div>Eligible Channels: {simResult.resolvedChannels.join(' • ')}</div>
                  <div className="pt-2 border-t border-slate-800 text-slate-300 whitespace-pre-wrap">
                    {simResult.simulatedPreview}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsSimulatorOpen(false);
                  setSimResult(null);
                }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleRunSimulation}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Execute Dry-Run</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
