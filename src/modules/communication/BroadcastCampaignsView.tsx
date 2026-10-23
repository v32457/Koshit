import React, { useState } from 'react';
import { BroadcastCampaignDetailed } from '../../types/communication';
import { INITIAL_DETAILED_CAMPAIGNS } from '../../data/communicationExtendedSeed';
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  XCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Send,
  Mail,
  MessageSquare,
  Bell,
  Eye,
  BarChart3,
  Filter,
} from 'lucide-react';

export const BroadcastCampaignsView: React.FC = () => {
  const [campaigns, setCampaigns] = useState<BroadcastCampaignDetailed[]>(INITIAL_DETAILED_CAMPAIGNS);
  const [selectedCampaign, setSelectedCampaign] = useState<BroadcastCampaignDetailed>(campaigns[0]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Wizard fields
  const [wizardTitle, setWizardTitle] = useState('');
  const [wizardReason, setWizardReason] = useState('');
  const [wizardScope, setWizardScope] = useState<'ALL_USERS' | 'SPECIFIC_ROLE' | 'SPECIFIC_BRANCH'>('ALL_USERS');
  const [wizardRole, setWizardRole] = useState<'ITEM_MAKER' | 'ITEM_CHECKER' | 'GLOBAL_ITEM_ADMIN'>('ITEM_MAKER');
  const [wizardEmail, setWizardEmail] = useState(true);
  const [wizardWhatsApp, setWizardWhatsApp] = useState(true);
  const [wizardInPortal, setWizardInPortal] = useState(true);
  const [wizardMessage, setWizardMessage] = useState('');
  const [wizardPriority, setWizardPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');

  // Estimate audience
  const estimatedCount = wizardScope === 'ALL_USERS' ? 32 : wizardScope === 'SPECIFIC_ROLE' ? 10 : 18;

  const handleCreateCampaign = () => {
    const newCamp: BroadcastCampaignDetailed = {
      id: `camp-${Date.now()}`,
      title: wizardTitle,
      businessReason: wizardReason,
      targetScope: wizardScope,
      targetRole: wizardScope === 'SPECIFIC_ROLE' ? (wizardRole as any) : undefined,
      channels: [
        ...(wizardInPortal ? ['IN_PORTAL' as const] : []),
        ...(wizardEmail ? ['EMAIL' as const] : []),
        ...(wizardWhatsApp ? ['WHATSAPP' as const] : []),
      ],
      priority: wizardPriority,
      status: 'SCHEDULED',
      customMessage: wizardMessage,
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      createdBy: 'Suresh Kumar',
      approvedBy: 'Ananya Sharma',
      totalRecipients: estimatedCount,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
    };

    setCampaigns([newCamp, ...campaigns]);
    setSelectedCampaign(newCamp);
    setIsWizardOpen(false);
    setWizardStep(1);
    setWizardTitle('');
    setWizardReason('');
    setWizardMessage('');
  };

  const handlePause = (id: string) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'PAUSED' } : c))
    );
    if (selectedCampaign.id === id) {
      setSelectedCampaign((prev) => ({ ...prev, status: 'PAUSED' }));
    }
  };

  const handleResume = (id: string) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'RUNNING' } : c))
    );
    if (selectedCampaign.id === id) {
      setSelectedCampaign((prev) => ({ ...prev, status: 'RUNNING' }));
    }
  };

  const handleCancel = (id: string) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'CANCELLED' } : c))
    );
    if (selectedCampaign.id === id) {
      setSelectedCampaign((prev) => ({ ...prev, status: 'CANCELLED' }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Broadcast Campaigns</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-channel broadcast announcements across In-Portal, Email, and WhatsApp with maker-checker approvals.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsWizardOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Broadcast Campaign</span>
        </button>
      </div>

      {/* Campaign List & Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Campaigns List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                All Campaigns ({campaigns.length})
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Verified Audience</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
              {campaigns.map((camp) => {
                const isSelected = camp.id === selectedCampaign.id;
                const percent = camp.totalRecipients > 0 ? Math.round((camp.deliveredCount / camp.totalRecipients) * 100) : 0;
                return (
                  <button
                    key={camp.id}
                    onClick={() => setSelectedCampaign(camp)}
                    className={`w-full text-left p-4 transition cursor-pointer flex flex-col gap-2 ${
                      isSelected ? 'bg-purple-50/70 border-l-4 border-l-purple-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 leading-snug line-clamp-1">{camp.title}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                          camp.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : camp.status === 'RUNNING'
                            ? 'bg-blue-100 text-blue-800 animate-pulse'
                            : camp.status === 'SCHEDULED'
                            ? 'bg-amber-100 text-amber-800'
                            : camp.status === 'PAUSED'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {camp.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>Scope: <strong>{camp.targetScope}</strong></span>
                      <span>•</span>
                      <span>{camp.totalRecipients} Recipients</span>
                    </div>

                    {/* Mini progress bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Delivered: {camp.deliveredCount}/{camp.totalRecipients}</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Campaign Inspector */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            {/* Header / Actions */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{selectedCampaign.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{selectedCampaign.businessReason}</p>
              </div>

              <div className="flex items-center gap-1.5">
                {selectedCampaign.status === 'RUNNING' && (
                  <button
                    onClick={() => handlePause(selectedCampaign.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5 text-amber-600" />
                    <span>Pause</span>
                  </button>
                )}

                {selectedCampaign.status === 'PAUSED' && (
                  <button
                    onClick={() => handleResume(selectedCampaign.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume</span>
                  </button>
                )}

                {selectedCampaign.status !== 'CANCELLED' && selectedCampaign.status !== 'COMPLETED' && (
                  <button
                    onClick={() => handleCancel(selectedCampaign.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 bg-white hover:bg-red-50 text-xs font-semibold cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                )}
              </div>
            </div>

            {/* Campaign Stats Card */}
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Target Audience</span>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">{selectedCampaign.totalRecipients}</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-blue-700 uppercase">Sent Dispatches</span>
                  <div className="text-lg font-bold text-blue-900 mt-0.5">{selectedCampaign.sentCount}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Delivered Receipts</span>
                  <div className="text-lg font-bold text-emerald-900 mt-0.5">{selectedCampaign.deliveredCount}</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-purple-700 uppercase">Read / Opened</span>
                  <div className="text-lg font-bold text-purple-900 mt-0.5">{selectedCampaign.readCount}</div>
                </div>
              </div>

              {/* Channels & Policy */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-2">
                <div className="text-xs font-bold text-slate-800">Dispatch Channels & Target Scope</div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedCampaign.channels.map((ch) => (
                    <span
                      key={ch}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 shadow-xs"
                    >
                      {ch === 'EMAIL' && <Mail className="w-3.5 h-3.5 text-blue-600" />}
                      {ch === 'WHATSAPP' && <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />}
                      {ch === 'IN_PORTAL' && <Bell className="w-3.5 h-3.5 text-purple-600" />}
                      <span>{ch}</span>
                    </span>
                  ))}
                  <span className="text-xs text-slate-500 ml-2">
                    Priority: <strong className="text-slate-800">{selectedCampaign.priority}</strong>
                  </span>
                </div>
              </div>

              {/* Governance Audit Details */}
              <div className="border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                  Maker-Checker Governance Chain
                </div>
                <div className="grid grid-cols-2 gap-3 text-slate-600">
                  <div>Authored By: <strong className="text-slate-800">{selectedCampaign.createdBy}</strong></div>
                  <div>Approved By: <strong className="text-slate-800">{selectedCampaign.approvedBy || 'Pending Signoff'}</strong></div>
                  <div>Scheduled At: <strong className="text-slate-800">{selectedCampaign.scheduledAt ? new Date(selectedCampaign.scheduledAt).toLocaleString() : 'Immediate'}</strong></div>
                  <div>Completed At: <strong className="text-slate-800">{selectedCampaign.completedAt ? new Date(selectedCampaign.completedAt).toLocaleString() : 'In Progress'}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Creation Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Broadcast Campaign Wizard</h3>
                  <p className="text-xs text-slate-500">Step {wizardStep} of 3</p>
                </div>
              </div>
              <button
                onClick={() => setIsWizardOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                &times;
              </button>
            </div>

            {/* Step 1: Definition & Audience */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Campaign Title</label>
                  <input
                    type="text"
                    value={wizardTitle}
                    onChange={(e) => setWizardTitle(e.target.value)}
                    placeholder="e.g. Urgent Notice: Scheduled HANA Maintenance Window"
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-medium"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Business Reason & Audit Purpose</label>
                  <input
                    type="text"
                    value={wizardReason}
                    onChange={(e) => setWizardReason(e.target.value)}
                    placeholder="e.g. Mandatory ERP index optimization per Q4 IT roadmap"
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Target Scope</label>
                    <select
                      value={wizardScope}
                      onChange={(e) => setWizardScope(e.target.value as any)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    >
                      <option value="ALL_USERS">All Operational Users (32 Contacts)</option>
                      <option value="SPECIFIC_ROLE">Specific User Role</option>
                      <option value="SPECIFIC_BRANCH">Specific Operating Branch</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Urgency Priority</label>
                    <select
                      value={wizardPriority}
                      onChange={(e) => setWizardPriority(e.target.value as any)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    >
                      <option value="LOW">Low (Informational)</option>
                      <option value="MEDIUM">Medium (Operational)</option>
                      <option value="HIGH">High (Important Notice)</option>
                      <option value="CRITICAL">Critical (Immediate Attention)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Delivery Channels</label>
                  <div className="flex gap-4 text-xs font-medium">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wizardInPortal}
                        onChange={(e) => setWizardInPortal(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>In-Portal Notification</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wizardEmail}
                        onChange={(e) => setWizardEmail(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Email Relay</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wizardWhatsApp}
                        onChange={(e) => setWizardWhatsApp(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>WhatsApp Business</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Message Content */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Announcement Body Message</label>
                  <textarea
                    rows={6}
                    value={wizardMessage}
                    onChange={(e) => setWizardMessage(e.target.value)}
                    placeholder="Enter broadcast communication text..."
                    className="w-full text-xs p-3 border border-slate-300 rounded-lg font-sans"
                  />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                  Estimated Audience: <strong>{estimatedCount} verified recipients</strong> with active consent. Unsubscribed recipients are automatically filtered out.
                </div>
              </div>
            )}

            {/* Step 3: Review & Submit */}
            {wizardStep === 3 && (
              <div className="space-y-3 text-xs">
                <div className="border border-purple-200 bg-purple-50 rounded-xl p-4 space-y-2">
                  <div className="font-bold text-purple-900 text-sm">Campaign Summary Pre-Dispatch Review</div>
                  <div><strong>Title:</strong> {wizardTitle}</div>
                  <div><strong>Reason:</strong> {wizardReason}</div>
                  <div><strong>Scope:</strong> {wizardScope} ({estimatedCount} Recipients)</div>
                  <div><strong>Priority:</strong> {wizardPriority}</div>
                </div>
                <div className="text-[11px] text-slate-500">
                  Submission sends notification to Checker role for secondary authorization before outbound dispatch begins.
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((prev) => (prev - 1) as any)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
                >
                  Back
                </button>
              ) : <div />}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsWizardOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
                {wizardStep < 3 ? (
                  <button
                    type="button"
                    disabled={wizardStep === 1 && (!wizardTitle || !wizardReason)}
                    onClick={() => setWizardStep((prev) => (prev + 1) as any)}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                  >
                    Next Step
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateCampaign}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                  >
                    Authorize & Schedule Campaign
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
