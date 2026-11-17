import React, { useMemo, useState } from 'react';
import type { User } from '../../types';
import { BroadcastCampaignDetailed } from '../../types/communication';
import type { CommunicationPurpose } from '../../types/userRoleAdmin';
import { INITIAL_DETAILED_CAMPAIGNS } from '../../data/communicationExtendedSeed';
import { userRoleAdminService } from '../../services/userRoleAdminService';
import { COMMUNICATION_PURPOSE_CATALOG, mobileConsentService } from '../../services/mobileConsentService';
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  XCircle,
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';

interface BroadcastCampaignsViewProps {
  currentUser?: User;
}

export const BroadcastCampaignsView: React.FC<BroadcastCampaignsViewProps> = ({ currentUser }) => {
  const [campaigns, setCampaigns] = useState<BroadcastCampaignDetailed[]>(INITIAL_DETAILED_CAMPAIGNS);
  const [selectedCampaign, setSelectedCampaign] = useState<BroadcastCampaignDetailed>(campaigns[0]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Wizard fields
  const [wizardTitle, setWizardTitle] = useState('');
  const [wizardReason, setWizardReason] = useState('');
  const [wizardScope, setWizardScope] = useState<'ALL_USERS' | 'SPECIFIC_ROLE' | 'SPECIFIC_BRANCH'>('ALL_USERS');
  const [wizardRole, setWizardRole] = useState<'ITEM_MAKER' | 'ITEM_CHECKER' | 'GLOBAL_ITEM_ADMIN'>('ITEM_MAKER');
  const [wizardPurpose, setWizardPurpose] = useState<CommunicationPurpose>('OPERATIONAL_BUSINESS');
  const [wizardEmail, setWizardEmail] = useState(true);
  const [wizardWhatsApp, setWizardWhatsApp] = useState(true);
  const [wizardSms, setWizardSms] = useState(false);
  const [wizardInPortal, setWizardInPortal] = useState(true);
  const [wizardMessage, setWizardMessage] = useState('');
  const [wizardPriority, setWizardPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');

  const [audienceEval, setAudienceEval] = useState<{
    eligible: User[];
    blocked: Array<{ user: User; channel: 'SMS' | 'WHATSAPP'; reason: string; blockedCode?: string }>;
  } | null>(null);

  const actor = {
    id: currentUser?.id || 'usr-admin-01',
    name: currentUser?.fullName || 'Platform Administrator',
  };

  const scopeUsers = useMemo(() => {
    const all = userRoleAdminService.getUsers();
    if (wizardScope === 'SPECIFIC_ROLE') return all.filter((u) => u.role === wizardRole);
    if (wizardScope === 'SPECIFIC_BRANCH' && currentUser?.defaultBranchId) {
      return all.filter((u) => u.isGlobalScope || u.defaultBranchId === currentUser.defaultBranchId);
    }
    return all;
  }, [wizardScope, wizardRole, currentUser?.defaultBranchId]);

  const selectedChannels = useMemo(() => {
    const ch: Array<'IN_PORTAL' | 'EMAIL' | 'WHATSAPP' | 'SMS'> = [];
    if (wizardInPortal) ch.push('IN_PORTAL');
    if (wizardEmail) ch.push('EMAIL');
    if (wizardWhatsApp) ch.push('WHATSAPP');
    if (wizardSms) ch.push('SMS');
    return ch;
  }, [wizardInPortal, wizardEmail, wizardWhatsApp, wizardSms]);

  const evaluateAudience = () => {
    const res = mobileConsentService.filterBroadcastRecipients(scopeUsers, {
      channels: selectedChannels,
      purpose: wizardPurpose,
      actor,
      campaignTitle: wizardTitle || 'Draft Broadcast Campaign',
    });
    const evaluated = {
      eligible: res.eligible,
      blocked: res.blocked.map((b) => ({
        user: b.user,
        channel: b.channel,
        reason: b.decision.reason,
        blockedCode: b.decision.blockedCode,
      })),
    };
    setAudienceEval(evaluated);
    return evaluated;
  };

  const handleGoToStep3 = () => {
    evaluateAudience();
    setWizardStep(3);
  };

  const handleCreateCampaign = () => {
    const res = audienceEval || evaluateAudience();
    const newCamp: BroadcastCampaignDetailed = {
      id: `camp-${Date.now()}`,
      title: wizardTitle,
      businessReason: wizardReason,
      targetScope: wizardScope,
      targetRole: wizardScope === 'SPECIFIC_ROLE' ? (wizardRole as any) : undefined,
      channels: selectedChannels.filter((c): c is 'IN_PORTAL' | 'EMAIL' | 'WHATSAPP' => c !== 'SMS'),
      priority: wizardPriority,
      status: 'SCHEDULED',
      customMessage: wizardMessage,
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      createdBy: actor.name,
      approvedBy: 'Secondary Compliance Reviewer',
      totalRecipients: res.eligible.length,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: res.blocked.length,
    };

    setCampaigns([newCamp, ...campaigns]);
    setSelectedCampaign(newCamp);
    setIsWizardOpen(false);
    setWizardStep(1);
    setAudienceEval(null);
    setWizardTitle('');
    setWizardReason('');
    setWizardMessage('');
  };

  const handlePause = (id: string) => {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'PAUSED' } : c)));
    if (selectedCampaign.id === id) setSelectedCampaign((prev) => ({ ...prev, status: 'PAUSED' }));
  };

  const handleResume = (id: string) => {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'RUNNING' } : c)));
    if (selectedCampaign.id === id) setSelectedCampaign((prev) => ({ ...prev, status: 'RUNNING' }));
  };

  const handleCancel = (id: string) => {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'CANCELLED' } : c)));
    if (selectedCampaign.id === id) setSelectedCampaign((prev) => ({ ...prev, status: 'CANCELLED' }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Broadcast Campaigns</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-channel announcements across In-Portal, Email, SMS, and WhatsApp gated by Personal Mobile Consent &amp; Association Status.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsWizardOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Broadcast Campaign</span>
        </button>
      </div>

      {/* Campaign List & Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                All Campaigns ({campaigns.length})
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Consent-Verified Audience</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
              {campaigns.map((camp) => {
                const isSelected = camp.id === selectedCampaign.id;
                const percent =
                  camp.totalRecipients > 0 ? Math.round((camp.deliveredCount / camp.totalRecipients) * 100) : 0;
                return (
                  <button
                    type="button"
                    key={camp.id}
                    onClick={() => setSelectedCampaign(camp)}
                    className={`w-full text-left p-4 transition cursor-pointer flex flex-col gap-2 ${
                      isSelected ? 'bg-indigo-50/70 ring-1 ring-inset ring-indigo-300' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 leading-snug line-clamp-1">{camp.title}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                          camp.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : camp.status === 'RUNNING'
                            ? 'bg-blue-100 text-blue-800'
                            : camp.status === 'SCHEDULED'
                            ? 'bg-amber-100 text-amber-800'
                            : camp.status === 'PAUSED'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {camp.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 tabular-nums">
                      <span>
                        Scope: <strong>{camp.targetScope}</strong>
                      </span>
                      <span>•</span>
                      <span>{camp.totalRecipients} Eligible Recipients</span>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
                        <span>
                          Delivered: {camp.deliveredCount}/{camp.totalRecipients}
                        </span>
                        <span>{percent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${percent}%` }} />
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
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{selectedCampaign.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{selectedCampaign.businessReason}</p>
              </div>

              <div className="flex items-center gap-1.5">
                {selectedCampaign.status === 'RUNNING' && (
                  <button
                    type="button"
                    onClick={() => handlePause(selectedCampaign.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5 text-amber-600" />
                    <span>Pause</span>
                  </button>
                )}

                {selectedCampaign.status === 'PAUSED' && (
                  <button
                    type="button"
                    onClick={() => handleResume(selectedCampaign.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume</span>
                  </button>
                )}

                {selectedCampaign.status !== 'CANCELLED' && selectedCampaign.status !== 'COMPLETED' && (
                  <button
                    type="button"
                    onClick={() => handleCancel(selectedCampaign.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 bg-white hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                )}
              </div>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Eligible Audience</span>
                  <div className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">{selectedCampaign.totalRecipients}</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-blue-700 uppercase">Sent Dispatches</span>
                  <div className="text-lg font-bold text-blue-900 mt-0.5 tabular-nums">{selectedCampaign.sentCount}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Delivered Receipts</span>
                  <div className="text-lg font-bold text-emerald-900 mt-0.5 tabular-nums">{selectedCampaign.deliveredCount}</div>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-rose-700 uppercase">Blocked / Failed</span>
                  <div className="text-lg font-bold text-rose-900 mt-0.5 tabular-nums">{selectedCampaign.failedCount}</div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-2">
                <div className="text-xs font-bold text-slate-800">Dispatch Channels &amp; Target Scope</div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedCampaign.channels.map((ch) => (
                    <span
                      key={ch}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 shadow-xs"
                    >
                      {ch === 'EMAIL' && <Mail className="w-3.5 h-3.5 text-blue-600" />}
                      {ch === 'WHATSAPP' && <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />}
                      {ch === 'IN_PORTAL' && <Bell className="w-3.5 h-3.5 text-indigo-600" />}
                      <span>{ch}</span>
                    </span>
                  ))}
                  <span className="text-xs text-slate-500 ml-2">
                    Priority: <strong className="text-slate-800">{selectedCampaign.priority}</strong>
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                  Maker-Checker Governance Chain
                </div>
                <div className="grid grid-cols-2 gap-3 text-slate-600">
                  <div>
                    Authored By: <strong className="text-slate-800">{selectedCampaign.createdBy}</strong>
                  </div>
                  <div>
                    Approved By: <strong className="text-slate-800">{selectedCampaign.approvedBy || 'Pending Signoff'}</strong>
                  </div>
                  <div className="tabular-nums">
                    Scheduled At:{' '}
                    <strong className="text-slate-800">
                      {selectedCampaign.scheduledAt ? new Date(selectedCampaign.scheduledAt).toLocaleString() : 'Immediate'}
                    </strong>
                  </div>
                  <div className="tabular-nums">
                    Completed At:{' '}
                    <strong className="text-slate-800">
                      {selectedCampaign.completedAt ? new Date(selectedCampaign.completedAt).toLocaleString() : 'In Progress'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Creation Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Broadcast Campaign Wizard</h3>
                  <p className="text-xs text-slate-500">Step {wizardStep} of 3 • Personal Mobile Consent Gate Active</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsWizardOpen(false);
                  setAudienceEval(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {wizardStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Campaign Title *</label>
                  <input
                    type="text"
                    value={wizardTitle}
                    onChange={(e) => setWizardTitle(e.target.value)}
                    placeholder="e.g. Urgent Notice: Scheduled Maintenance Window"
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-medium"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Business Reason &amp; Audit Purpose *</label>
                  <input
                    type="text"
                    value={wizardReason}
                    onChange={(e) => setWizardReason(e.target.value)}
                    placeholder="e.g. Operational SLA advisory"
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Target Scope</label>
                    <select
                      value={wizardScope}
                      onChange={(e) => setWizardScope(e.target.value as any)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    >
                      <option value="ALL_USERS">All Enterprise Users ({userRoleAdminService.getUsers().length})</option>
                      <option value="SPECIFIC_ROLE">Specific User Role</option>
                      <option value="SPECIFIC_BRANCH">Active Operating Branch</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Communication Purpose (Consent Gate)</label>
                    <select
                      value={wizardPurpose}
                      onChange={(e) => setWizardPurpose(e.target.value as CommunicationPurpose)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    >
                      {COMMUNICATION_PURPOSE_CATALOG.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {wizardScope === 'SPECIFIC_ROLE' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Target Role</label>
                      <select
                        value={wizardRole}
                        onChange={(e) => setWizardRole(e.target.value as any)}
                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                      >
                        <option value="ITEM_MAKER">ITEM_MAKER</option>
                        <option value="ITEM_CHECKER">ITEM_CHECKER</option>
                        <option value="GLOBAL_ITEM_ADMIN">GLOBAL_ITEM_ADMIN</option>
                      </select>
                    </div>
                  )}

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
                  <div className="flex flex-wrap gap-4 text-xs font-medium">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={wizardInPortal} onChange={(e) => setWizardInPortal(e.target.checked)} />
                      <span>In-Portal</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={wizardEmail} onChange={(e) => setWizardEmail(e.target.checked)} />
                      <span>Email Relay</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={wizardSms} onChange={(e) => setWizardSms(e.target.checked)} />
                      <span className="flex items-center gap-1">
                        <Smartphone className="w-3.5 h-3.5 text-indigo-600" /> SMS Gateway
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={wizardWhatsApp} onChange={(e) => setWizardWhatsApp(e.target.checked)} />
                      <span>WhatsApp Business</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Announcement Body Message</label>
                  <textarea
                    rows={5}
                    value={wizardMessage}
                    onChange={(e) => setWizardMessage(e.target.value)}
                    placeholder="Enter broadcast communication text..."
                    className="w-full text-xs p-3 border border-slate-300 rounded-lg font-sans"
                  />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                  Target pool: <strong className="tabular-nums">{scopeUsers.length} user(s)</strong> for purpose{' '}
                  <strong className="font-mono">{wizardPurpose}</strong>. Clicking Next evaluates Personal Mobile Consent &amp; Association eligibility.
                </div>
              </div>
            )}

            {wizardStep === 3 && audienceEval && (
              <div className="space-y-3 text-xs">
                <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4 space-y-2">
                  <div className="font-bold text-indigo-900 text-sm">Campaign Pre-Dispatch Consent Gate Summary</div>
                  <div>
                    <strong>Title:</strong> {wizardTitle}
                  </div>
                  <div>
                    <strong>Purpose:</strong> {wizardPurpose} • <strong>Channels:</strong> {selectedChannels.join(', ')}
                  </div>
                  <div className="flex flex-wrap gap-3 pt-1 tabular-nums">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {audienceEval.eligible.length} Eligible
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                      <ShieldAlert className="w-3.5 h-3.5" /> {audienceEval.blocked.length} Blocked by Consent/Policy
                    </span>
                  </div>
                </div>

                {audienceEval.blocked.length > 0 && (
                  <div className="border border-rose-200 rounded-lg p-3 bg-rose-50/60 space-y-1.5 max-h-40 overflow-y-auto">
                    <div className="font-bold text-rose-900">Blocked Recipients (Personal Numbers Masked):</div>
                    {audienceEval.blocked.map((b, idx) => (
                      <div key={idx} className="text-[11px] text-rose-800">
                        <strong>{b.user.fullName}</strong> (
                        {mobileConsentService.formatMobileForViewer(b.user, currentUser, false).display}) — {b.reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((prev) => (prev - 1) as any)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Back
                </button>
              ) : (
                <div />
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsWizardOpen(false);
                    setAudienceEval(null);
                  }}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                {wizardStep === 1 && (
                  <button
                    type="button"
                    disabled={!wizardTitle || !wizardReason}
                    onClick={() => setWizardStep(2)}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    Next Step
                  </button>
                )}
                {wizardStep === 2 && (
                  <button
                    type="button"
                    onClick={handleGoToStep3}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Evaluate Consent &amp; Review
                  </button>
                )}
                {wizardStep === 3 && (
                  <button
                    type="button"
                    onClick={handleCreateCampaign}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Authorize &amp; Schedule Campaign
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
