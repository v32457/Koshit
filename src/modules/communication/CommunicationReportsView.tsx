import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Mail,
  MessageSquare,
  Bell,
  Clock,
  ArrowRight,
} from 'lucide-react';

export const CommunicationReportsView: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'TODAY' | '7D' | '30D' | '90D'>('30D');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const funnelData = [
    { stage: '1. Intents Created', count: 1840, percentage: 100, color: 'bg-blue-600' },
    { stage: '2. Enqueued & Dispatched', count: 1832, percentage: 99.5, color: 'bg-indigo-600' },
    { stage: '3. Accepted by Provider', count: 1820, percentage: 98.9, color: 'bg-cyan-600' },
    { stage: '4. Delivered to Handset/Inbox', count: 1795, percentage: 97.5, color: 'bg-emerald-600' },
    { stage: '5. Read / Acknowledged', count: 1612, percentage: 87.6, color: 'bg-purple-600' },
  ];

  const channelBreakdown = [
    { channel: 'Email Outbound (SMTP)', sent: 1120, delivered: 1098, failed: 22, successRate: '98.0%' },
    { channel: 'WhatsApp Official (Meta API)', sent: 540, delivered: 535, failed: 5, successRate: '99.1%' },
    { channel: 'In-Portal Notification Center', sent: 180, delivered: 180, failed: 0, successRate: '100%' },
  ];

  const failureReasons = [
    { reason: 'Mailbox unavailable / invalid email format (550 User Unknown)', count: 14, percentage: 51.8 },
    { reason: 'SMTP server rate limit exceeded (421 backoff retry)', count: 6, percentage: 22.2 },
    { reason: 'Meta WhatsApp 24-hr customer service window closed', count: 4, percentage: 14.8 },
    { reason: 'Recipient suppressed in opt-out governance list', count: 3, percentage: 11.2 },
  ];

  const handleExport = () => {
    setExportNotice('Exported delivery performance analytics: delivery_reports_20261022.csv');
    setTimeout(() => setExportNotice(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Delivery Reports & Deliverability Analytics</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Conversion funnels, channel throughput, failure root-cause analysis, and latency percentiles.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium"
          >
            <option value="TODAY">Today (24 Hours)</option>
            <option value="7D">Last 7 Days</option>
            <option value="30D">Last 30 Days</option>
            <option value="90D">Last 90 Days (Quarterly)</option>
          </select>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Analytics CSV</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* High-Level Metric Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Overall Delivery Rate</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">97.5%</div>
          <span className="text-[11px] text-emerald-600 mt-0.5 block font-medium">1,795 / 1,840 intents delivered</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Average Dispatch Latency</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">142 ms</div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">p95 Latency: 285 ms</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">WhatsApp Engagement</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">99.1%</div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">535 verified delivery receipts</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Dead-Letter Replays</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">100%</div>
          <span className="text-[11px] text-emerald-600 mt-0.5 block font-medium">Zero unhandled dropped packets</span>
        </div>
      </div>

      {/* Delivery Funnel Visualizer */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">End-to-End Delivery Funnel Conversion</h2>
            <p className="text-xs text-slate-500">Stage progression from event intent creation to recipient acknowledgment.</p>
          </div>
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
            Timeframe: {timeRange}
          </span>
        </div>

        <div className="space-y-3 pt-2">
          {funnelData.map((stage, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">{stage.stage}</span>
                <span className="font-bold text-slate-900">{stage.count.toLocaleString()} ({stage.percentage}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${stage.color} rounded-full transition-all duration-500`}
                  style={{ width: `${stage.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column: Channel Breakdown & Failure Root Causes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Channel Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Volume & Reliability by Channel
          </h2>

          <div className="space-y-3">
            {channelBreakdown.map((ch, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    {ch.channel.includes('Email') && <Mail className="w-4 h-4 text-blue-600" />}
                    {ch.channel.includes('WhatsApp') && <MessageSquare className="w-4 h-4 text-emerald-600" />}
                    {ch.channel.includes('Portal') && <Bell className="w-4 h-4 text-purple-600" />}
                    {ch.channel}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {ch.successRate}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Sent: <strong>{ch.sent}</strong></span>
                  <span>Delivered: <strong>{ch.delivered}</strong></span>
                  <span>Failed: <strong className="text-red-600">{ch.failed}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Failure Root Causes */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Failure Root-Cause Diagnostics
          </h2>

          <div className="space-y-3">
            {failureReasons.map((fr, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{fr.reason}</span>
                  <span className="font-bold text-red-600">{fr.count} ({fr.percentage}%)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${fr.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
