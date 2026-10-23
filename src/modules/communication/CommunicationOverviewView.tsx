import React from 'react';
import {
  Bell,
  Mail,
  MessageSquare,
  Megaphone,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Zap,
  TrendingUp,
  Server,
  Layers,
  ArrowRight,
  ShieldCheck,
  Activity,
  Sliders,
} from 'lucide-react';

interface CommunicationOverviewViewProps {
  onNavigate: (route: string) => void;
}

export const CommunicationOverviewView: React.FC<CommunicationOverviewViewProps> = ({
  onNavigate,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Communication & Notification Hub — Operational Overview
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized orchestration for multi-channel messaging, delivery queues, template compliance, and provider reliability.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('/communication/centre')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-xs transition"
          >
            <Bell className="w-3.5 h-3.5 text-blue-600" />
            <span>Open Notification Inbox</span>
          </button>
          <button
            onClick={() => onNavigate('/communication/broadcasts')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer transition"
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>New Broadcast</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Intents Dispatched</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">1,840</div>
          <div className="text-[11px] text-emerald-600 mt-0.5 font-medium flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>+12.4% vs last week</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Delivery Success</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">97.5%</div>
          <div className="text-[11px] text-slate-500 mt-0.5">1,795 confirmed receipts</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Queue Depth</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">3</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Oldest intent: 2m 14s</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Dead-Letter / Retries</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">1</div>
          <div className="text-[11px] text-red-600 mt-0.5 font-medium">1 job requires operator action</div>
        </div>
      </div>

      {/* Channel Quick Hub Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Email Hub Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-300 transition">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                <Mail className="w-5 h-5" />
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                SMTP ACTIVE
              </span>
            </div>
            <h3 className="font-bold text-sm text-slate-900">Email Relay & Templates</h3>
            <p className="text-xs text-slate-500">
              Corporate Postfix SMTP relay, STARTTLS encryption, and HTML template management.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <button
              onClick={() => onNavigate('/communication/email-config')}
              className="w-full flex items-center justify-between text-xs text-blue-600 hover:text-blue-800 font-semibold py-1 cursor-pointer"
            >
              <span>Email Configuration</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate('/communication/email-templates')}
              className="w-full flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 font-medium py-1 cursor-pointer"
            >
              <span>Email Templates (3)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* WhatsApp Hub Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-emerald-300 transition">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                <MessageSquare className="w-5 h-5" />
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                META CONNECTED
              </span>
            </div>
            <h3 className="font-bold text-sm text-slate-900">WhatsApp Business Platform</h3>
            <p className="text-xs text-slate-500">
              Official Meta Cloud API v21.0, user-assisted click-to-chat queue, and verified templates.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <button
              onClick={() => onNavigate('/communication/whatsapp-config')}
              className="w-full flex items-center justify-between text-xs text-emerald-700 hover:text-emerald-900 font-semibold py-1 cursor-pointer"
            >
              <span>WhatsApp Configuration</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate('/communication/whatsapp-templates')}
              className="w-full flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 font-medium py-1 cursor-pointer"
            >
              <span>Meta Approved Templates (3)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Broadcasts & Rules Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-purple-300 transition">
          <div className="space-y-2">
            <div className="p-2 bg-purple-50 text-purple-700 rounded-lg w-fit">
              <Megaphone className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Broadcasts & Routing Rules</h3>
            <p className="text-xs text-slate-500">
              Targeted role/branch campaigns with maker-checker approvals and event triggers.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <button
              onClick={() => onNavigate('/communication/broadcasts')}
              className="w-full flex items-center justify-between text-xs text-purple-700 hover:text-purple-900 font-semibold py-1 cursor-pointer"
            >
              <span>Broadcast Campaigns (4)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate('/communication/rules')}
              className="w-full flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 font-medium py-1 cursor-pointer"
            >
              <span>Notification Rules (5)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Queue & Operations Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-cyan-300 transition">
          <div className="space-y-2">
            <div className="p-2 bg-cyan-50 text-cyan-700 rounded-lg w-fit">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Queues & Delivery Operations</h3>
            <p className="text-xs text-slate-500">
              Unified delivery queue, dead-letter reprocess, inbound webhooks, and consent governance.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <button
              onClick={() => onNavigate('/communication/queue')}
              className="w-full flex items-center justify-between text-xs text-cyan-700 hover:text-cyan-900 font-semibold py-1 cursor-pointer"
            >
              <span>Unified Delivery Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate('/communication/reports')}
              className="w-full flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 font-medium py-1 cursor-pointer"
            >
              <span>Delivery Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Operational Attention Required Callout */}
      <div className="bg-red-50/70 border border-red-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 text-red-700 rounded-lg shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-red-900">
              Dead-Letter Queue Alert: 1 Failed Message Requires Investigation
            </h3>
            <p className="text-[11px] text-red-700 mt-0.5">
              Event <strong>SAP_SYNC_FAILED</strong> for batch #BATCH-20261021-01 exhausted 5 retry attempts.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('/communication/queue')}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
        >
          Inspect & Reprocess Dead Letter
        </button>
      </div>
    </div>
  );
};
