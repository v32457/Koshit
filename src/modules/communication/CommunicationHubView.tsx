import React, { useState } from 'react';
import {
  CommunicationTemplate,
  BroadcastAnnouncement,
  DeliveryQueueItem,
  InPortalNotification,
  User,
} from '../../types';
import {
  INITIAL_EMAIL_TEMPLATES,
  INITIAL_BROADCAST_ANNOUNCEMENTS,
  INITIAL_DELIVERY_QUEUE,
  INITIAL_IN_PORTAL_NOTIFICATIONS,
} from '../../data/communicationSeed';
import {
  Mail,
  Megaphone,
  Bell,
  RefreshCw,
  Send,
  Plus,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Eye,
  Filter,
  Check,
  Zap,
} from 'lucide-react';

interface CommunicationHubViewProps {
  currentUser: User;
  onNavigateWhatsApp?: () => void;
}

export const CommunicationHubView: React.FC<CommunicationHubViewProps> = ({
  currentUser,
  onNavigateWhatsApp,
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TEMPLATES' | 'BROADCASTS' | 'IN_PORTAL' | 'QUEUE'>('OVERVIEW');

  // Templates State
  const [templates, setTemplates] = useState<CommunicationTemplate[]>(INITIAL_EMAIL_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<CommunicationTemplate | null>(templates[0]);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [previewPlaceholderData, setPreviewPlaceholderData] = useState({
    recipient_display_name: 'Karthik Raja',
    item_code: 'MAPALBL0003',
    item_category: 'MA (Machinery)',
    item_description: 'Machine Parts Aluminium Blue Finish Grade 6061',
    maker_name: 'Karthik Raja',
    checker_name: 'Ramesh Balasubramanian',
    branch_name: 'Pondicherry HQ Plant',
    timestamp: '22-Oct-2026 14:30 IST',
    portal_url: 'https://my.koshinnovations.com',
    rejection_reason: 'Missing ISO 9001 surface finish grade certificate attachment.',
    otp_code: '491823',
    batch_id: 'BATCH-20261022-01',
    error_code: 'SAP-ERR-4001',
    error_message: 'Duplicate ItemCode detected in OITM table.',
    environment: 'PROD (Pondicherry HQ)',
  });
  const [testSentMessage, setTestSentMessage] = useState<string | null>(null);

  // Broadcasts State
  const [broadcasts, setBroadcasts] = useState<BroadcastAnnouncement[]>(INITIAL_BROADCAST_ANNOUNCEMENTS);
  const [newBroadcastTitle, setNewBroadcastTitle] = useState('');
  const [newBroadcastMsg, setNewBroadcastMsg] = useState('');
  const [newBroadcastScope, setNewBroadcastScope] = useState<'ALL_USERS' | 'SPECIFIC_ROLE' | 'SPECIFIC_BRANCH'>('ALL_USERS');
  const [newBroadcastPriority, setNewBroadcastPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [isCreatingBroadcast, setIsCreatingBroadcast] = useState(false);

  // Delivery Queue State
  const [deliveryQueue, setDeliveryQueue] = useState<DeliveryQueueItem[]>(INITIAL_DELIVERY_QUEUE);
  const [queueFilter, setQueueFilter] = useState<'ALL' | 'FAILED' | 'DELIVERED'>('ALL');

  // In-Portal Notifications State
  const [inPortalNotifs, setInPortalNotifs] = useState<InPortalNotification[]>(INITIAL_IN_PORTAL_NOTIFICATIONS);

  // Helper to replace placeholders in preview
  const renderTemplatePreview = (content: string) => {
    let result = content;
    Object.entries(previewPlaceholderData).forEach(([key, val]) => {
      result = result.replaceAll(`{${key}}`, val);
    });
    return result;
  };

  // Trigger test send simulation
  const handleTestSend = () => {
    if (!selectedTemplate) return;
    setTestSentMessage(`Simulated test message dispatched to ${currentUser.email} for template [${selectedTemplate.code}].`);
    setTimeout(() => setTestSentMessage(null), 4000);
  };

  // Retry delivery item
  const handleRetryQueueItem = (id: string) => {
    setDeliveryQueue((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: 'ACCEPTED_BY_PROVIDER',
              retryCount: item.retryCount + 1,
              lastAttemptAt: new Date().toISOString(),
              errorMessage: undefined,
            }
          : item
      )
    );
  };

  // Publish new broadcast
  const handlePublishBroadcast = () => {
    if (!newBroadcastTitle.trim() || !newBroadcastMsg.trim()) return;
    const newBc: BroadcastAnnouncement = {
      id: `bc-${Date.now()}`,
      title: newBroadcastTitle,
      message: newBroadcastMsg,
      targetScope: newBroadcastScope,
      channels: ['IN_PORTAL', 'EMAIL'],
      priority: newBroadcastPriority,
      status: 'PUBLISHED',
      publishedAt: new Date().toISOString(),
      publishedBy: currentUser.fullName,
      acknowledgedCount: 1,
      totalRecipients: 32,
    };
    setBroadcasts([newBc, ...broadcasts]);
    setNewBroadcastTitle('');
    setNewBroadcastMsg('');
    setIsCreatingBroadcast(false);
  };

  return (
    <div className="space-y-5 select-none">
      {/* Title & Hub Header */}
      <div className="bg-[#0B192C] text-white p-5 rounded-2xl border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/30 border border-blue-400/30 rounded-xl text-cyan-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-wide text-white">
                Enterprise Communication & Notification Hub
              </h1>
              <p className="text-xs text-slate-400">
                Transactional Emails, In-Portal Alerts, WhatsApp Integration, Broadcast Engine & Telemetry Queue
              </p>
            </div>
          </div>
        </div>

        {onNavigateWhatsApp && (
          <button
            onClick={onNavigateWhatsApp}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            WhatsApp Integration Hub →
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2.5 text-xs font-bold rounded-lg transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'OVERVIEW'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          Hub Operational Overview
        </button>

        <button
          onClick={() => setActiveTab('TEMPLATES')}
          className={`px-4 py-2.5 text-xs font-bold rounded-lg transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'TEMPLATES'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Mail className="w-4 h-4" />
          Email Templates Catalogue ({templates.length})
        </button>

        <button
          onClick={() => setActiveTab('BROADCASTS')}
          className={`px-4 py-2.5 text-xs font-bold rounded-lg transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'BROADCASTS'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Broadcasts & Announcements ({broadcasts.length})
        </button>

        <button
          onClick={() => setActiveTab('IN_PORTAL')}
          className={`px-4 py-2.5 text-xs font-bold rounded-lg transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'IN_PORTAL'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Bell className="w-4 h-4" />
          In-Portal Notification Hub ({inPortalNotifs.length})
        </button>

        <button
          onClick={() => setActiveTab('QUEUE')}
          className={`px-4 py-2.5 text-xs font-bold rounded-lg transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'QUEUE'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Delivery Queue & Retries ({deliveryQueue.length})
        </button>
      </div>

      {/* 0. Hub Operational Overview Landing Page */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-5">
          {/* Operational Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Queued Messages</span>
              <span className="text-xl font-extrabold text-blue-700 block mt-0.5">
                {deliveryQueue.filter((q) => q.status === 'QUEUED' || q.status === 'ACCEPTED_BY_PROVIDER').length}
              </span>
              <span className="text-[10px] text-slate-500">Ready for dispatch</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Delivered Today</span>
              <span className="text-xl font-extrabold text-emerald-700 block mt-0.5">
                {deliveryQueue.filter((q) => q.status === 'DELIVERED').length + 42}
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold">100% SLA target</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Failed Delivery</span>
              <span className="text-xl font-extrabold text-rose-700 block mt-0.5">
                {deliveryQueue.filter((q) => q.status === 'FAILED').length}
              </span>
              <span className="text-[10px] text-rose-600 font-semibold">Requires retry</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">In-Portal Alerts</span>
              <span className="text-xl font-extrabold text-indigo-700 block mt-0.5">{inPortalNotifs.length}</span>
              <span className="text-[10px] text-slate-500">Active sessions</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Broadcasts</span>
              <span className="text-xl font-extrabold text-purple-700 block mt-0.5">{broadcasts.length}</span>
              <span className="text-[10px] text-slate-500">Published notices</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Active Templates</span>
              <span className="text-xl font-extrabold text-cyan-700 block mt-0.5">{templates.length}</span>
              <span className="text-[10px] text-slate-500">Event bindings</span>
            </div>
          </div>

          {/* Provider Channel Health Grid */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
            <h3 className="font-bold text-xs uppercase text-slate-500 tracking-wider flex items-center justify-between">
              <span>Channel Gateway Health & Circuit-Breakers</span>
              <span className="text-emerald-700 text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                All Gateways Operational
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-blue-600" /> SMTP Email Gateway
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">Host: smtp.koshinnovations.com:587</div>
                  <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">TLS 1.3 • Last checked: 1 min ago</div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" title="Operational" />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-emerald-600" /> WhatsApp Business API
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">Meta Graph API v18.0</div>
                  <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">Webhook Active • Latency 140ms</div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" title="Operational" />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-purple-600" /> In-Portal Websockets
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">Realtime Push Stream</div>
                  <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">18 Active Session Connections</div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" title="Operational" />
              </div>
            </div>
          </div>

          {/* Recent Communication Log Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase text-slate-800 tracking-wider">
                Recent Transactional Telemetry Stream
              </h3>
              <button
                onClick={() => setActiveTab('QUEUE')}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold"
              >
                View Complete Queue →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Time</th>
                    <th className="p-3">Channel</th>
                    <th className="p-3">Event Code</th>
                    <th className="p-3">Target Recipient</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deliveryQueue.slice(0, 5).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-[11px] text-slate-500">
                        {(item.lastAttemptAt || '').split('T')[1]?.slice(0, 8) || '14:30:12'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.channel === 'WHATSAPP'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {item.channel}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-800 font-bold">{item.eventCode}</td>
                      <td className="p-3 font-mono text-slate-600">{item.recipient}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'DELIVERED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'FAILED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-cyan-100 text-cyan-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {item.status === 'FAILED' ? (
                          <button
                            onClick={() => handleRetryQueueItem(item.id)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer"
                          >
                            Retry
                          </button>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 1. Email Templates Tab */}
      {activeTab === 'TEMPLATES' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Template Master List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Event-Triggered Templates
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">
                {templates.length} Active
              </span>
            </div>

            <div className="space-y-2">
              {templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  onClick={() => {
                    setSelectedTemplate(tmpl);
                    setIsEditingTemplate(false);
                  }}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                    selectedTemplate?.id === tmpl.id
                      ? 'border-blue-600 bg-blue-50/70 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{tmpl.name}</span>
                    <span className="text-[10px] font-mono bg-white border border-slate-200 px-1.5 py-0.2 rounded text-slate-600">
                      v{tmpl.version}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-blue-700 mt-1">
                    Event: {tmpl.eventCode}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 truncate">
                    Subject: {tmpl.subject}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Template Editor & Live Preview */}
          {selectedTemplate && (
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900">{selectedTemplate.name}</h3>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full font-mono">
                      {selectedTemplate.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Code: <span className="font-mono text-slate-700">{selectedTemplate.code}</span> • Channel:{' '}
                    <span className="font-bold text-slate-700">{selectedTemplate.channel}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditingTemplate(!isEditingTemplate)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {isEditingTemplate ? 'Exit Edit' : 'Edit Template'}
                  </button>

                  <button
                    onClick={handleTestSend}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Test Dispatch
                  </button>
                </div>
              </div>

              {testSentMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{testSentMessage}</span>
                </div>
              )}

              {/* Allowed Placeholders Syntax Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  Allowed Template Placeholders (Strict Syntax Whitelist)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTemplate.availablePlaceholders.map((ph) => (
                    <span
                      key={ph}
                      className="px-2 py-0.8 bg-white border border-slate-200 rounded text-[11px] font-mono text-blue-800 font-medium select-all"
                    >
                      {ph}
                    </span>
                  ))}
                </div>
              </div>

              {/* Subject Line */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Subject Line Expression
                </label>
                {isEditingTemplate ? (
                  <input
                    type="text"
                    value={selectedTemplate.subject}
                    onChange={(e) =>
                      setSelectedTemplate({ ...selectedTemplate, subject: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                ) : (
                  <div className="p-2.5 bg-slate-100 rounded-lg text-xs font-mono text-slate-800 border border-slate-200">
                    {selectedTemplate.subject}
                  </div>
                )}
              </div>

              {/* Template Body / Preview */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase">
                    {isEditingTemplate ? 'Template Body Editor' : 'Simulated Rendered Preview'}
                  </label>
                  {!isEditingTemplate && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" /> Sample Parameters Applied
                    </span>
                  )}
                </div>

                {isEditingTemplate ? (
                  <textarea
                    rows={12}
                    value={selectedTemplate.bodyContent}
                    onChange={(e) =>
                      setSelectedTemplate({ ...selectedTemplate, bodyContent: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs text-slate-900 font-mono leading-relaxed focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {renderTemplatePreview(selectedTemplate.bodyContent)}
                  </div>
                )}
              </div>

              {isEditingTemplate && (
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setTemplates((prev) =>
                        prev.map((t) => (t.id === selectedTemplate.id ? selectedTemplate : t))
                      );
                      setIsEditingTemplate(false);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-xs cursor-pointer"
                  >
                    Save Template Revision
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. Broadcasts & Announcements Tab */}
      {activeTab === 'BROADCASTS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Enterprise Broadcasts & Operational Notices</h3>
              <p className="text-xs text-slate-500">Scheduled maintenance announcements, policy changes, and master code freezes</p>
            </div>
            <button
              onClick={() => setIsCreatingBroadcast(!isCreatingBroadcast)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Broadcast Announcement
            </button>
          </div>

          {isCreatingBroadcast && (
            <div className="bg-white rounded-xl border border-blue-200 p-5 shadow-sm space-y-4">
              <h4 className="font-bold text-sm text-blue-900 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-blue-600" />
                Draft Corporate Broadcast
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Announcement Headline
                  </label>
                  <input
                    type="text"
                    value={newBroadcastTitle}
                    onChange={(e) => setNewBroadcastTitle(e.target.value)}
                    placeholder="e.g. Scheduled SAP B1 HANA Maintenance Window"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Audience Target Scope
                  </label>
                  <select
                    value={newBroadcastScope}
                    onChange={(e) => setNewBroadcastScope(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-medium"
                  >
                    <option value="ALL_USERS">All Users (Enterprise Scope)</option>
                    <option value="SPECIFIC_ROLE">Item Makers Only</option>
                    <option value="SPECIFIC_BRANCH">Pondicherry HQ Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Message Content
                </label>
                <textarea
                  rows={4}
                  value={newBroadcastMsg}
                  onChange={(e) => setNewBroadcastMsg(e.target.value)}
                  placeholder="Detail the operational impact, affected modules, and recommended user actions..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Priority:</span>
                  {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setNewBroadcastPriority(p)}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                        newBroadcastPriority === p
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsCreatingBroadcast(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePublishBroadcast}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded-lg text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Publish Immediately
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Broadcasts List */}
          <div className="space-y-3">
            {broadcasts.map((bc) => (
              <div
                key={bc.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        bc.priority === 'HIGH' || bc.priority === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {bc.priority} Priority
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{bc.title}</h4>
                  </div>
                  <p className="text-xs text-slate-600">{bc.message}</p>
                  <div className="text-[11px] text-slate-400 font-mono mt-1">
                    Published by {bc.publishedBy} • Target: {bc.targetScope} • Channels: {bc.channels.join(', ')}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-slate-900">
                    {bc.acknowledgedCount} / {bc.totalRecipients} Read
                  </div>
                  <div className="w-28 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                    <div
                      className="bg-blue-600 h-full"
                      style={{ width: `${(bc.acknowledgedCount / bc.totalRecipients) * 100}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    {Math.round((bc.acknowledgedCount / bc.totalRecipients) * 100)}% Ack Rate
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. In-Portal Notifications Hub Tab */}
      {activeTab === 'IN_PORTAL' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Real-Time In-Portal Notification Stream</h3>
              <p className="text-xs text-slate-500">Live operational alerts dispatched to active user sessions</p>
            </div>
            <button
              onClick={() => {
                const sample: InPortalNotification = {
                  id: `notif-${Date.now()}`,
                  userId: currentUser.id,
                  category: 'WORKFLOW',
                  title: 'Test Notification Dispatched',
                  message: 'Generated by Communication Hub test runner.',
                  isRead: false,
                  createdAt: new Date().toISOString(),
                  priority: 'MEDIUM',
                };
                setInPortalNotifs([sample, ...inPortalNotifs]);
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer"
            >
              Dispatch Test Alert
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {inPortalNotifs.map((n) => (
              <div key={n.id} className="py-3 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0 mt-0.5">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{n.title}</span>
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                        {n.category}
                      </span>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{n.message}</p>
                    <div className="text-[10px] text-slate-400 font-mono mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      n.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {n.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Delivery Queue & Alerts Tab */}
      {activeTab === 'QUEUE' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Message Delivery Queue & Provider Telemetry</h3>
              <p className="text-xs text-slate-500">Inspection of transactional outbound queue, SMTP status, and provider acknowledgments</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Filter:</span>
              {(['ALL', 'FAILED', 'DELIVERED'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setQueueFilter(f)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                    queueFilter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Channel</th>
                  <th className="p-2.5">Recipient</th>
                  <th className="p-2.5">Event</th>
                  <th className="p-2.5">Subject</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Retries</th>
                  <th className="p-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveryQueue
                  .filter((item) => (queueFilter === 'ALL' ? true : item.status === queueFilter))
                  .map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold font-mono">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            item.channel === 'WHATSAPP'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {item.channel}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-slate-800">{item.recipient}</td>
                      <td className="p-2.5 text-slate-600 font-mono text-[11px]">{item.eventCode}</td>
                      <td className="p-2.5 text-slate-700 max-w-xs truncate">{item.subject}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'DELIVERED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'ACCEPTED_BY_PROVIDER'
                              ? 'bg-cyan-100 text-cyan-800'
                              : item.status === 'FAILED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.status}
                        </span>
                        {item.errorMessage && (
                          <div className="text-[10px] text-rose-600 font-mono mt-0.5">
                            {item.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 font-mono">{item.retryCount}</td>
                      <td className="p-2.5">
                        {item.status === 'FAILED' ? (
                          <button
                            onClick={() => handleRetryQueueItem(item.id)}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1 rounded text-[10px] flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" /> Retry Now
                          </button>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
