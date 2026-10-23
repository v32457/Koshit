import React, { useState } from 'react';
import { WhatsAppTemplateDetailed } from '../../types/communication';
import { INITIAL_DETAILED_WHATSAPP_TEMPLATES, SHARED_VARIABLE_REGISTRY } from '../../data/communicationExtendedSeed';
import {
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Plus,
  Send,
  ExternalLink,
  Smartphone,
  Copy,
  Check,
  ShieldCheck,
  Layers,
  Sparkles,
} from 'lucide-react';

export const WhatsAppTemplatesView: React.FC = () => {
  const [templates, setTemplates] = useState<WhatsAppTemplateDetailed[]>(INITIAL_DETAILED_WHATSAPP_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplateDetailed>(templates[0]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncAlert, setSyncAlert] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Parameter live preview values
  const [paramValues, setParamValues] = useState<Record<number, string>>({
    1: 'Ramesh Balasubramanian',
    2: 'MAPALBL0003',
    3: 'Machine Parts Aluminium Blue Finish',
    4: 'Karthik Raja',
    5: 'https://my.koshinnovations.com/approvals',
  });

  // Test send simulation modal
  const [isTestSendOpen, setIsTestSendOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('+919840123456');
  const [testSentMsg, setTestSentMsg] = useState<string | null>(null);

  // New template modal states
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<'UTILITY' | 'MARKETING' | 'AUTHENTICATION'>('UTILITY');
  const [newBody, setNewBody] = useState('Hello {{1}}, your item creation request {{2}} is being processed.');

  // Helper to render body with parameters
  const renderRenderedBody = () => {
    let text = selectedTemplate.bodyTemplate;
    selectedTemplate.parameters.forEach((param) => {
      const val = paramValues[param.index] || param.sampleValue;
      text = text.replaceAll(`{{${param.index}}}`, val);
    });
    return text;
  };

  const handleSyncMeta = () => {
    setIsSyncing(true);
    setSyncAlert(null);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncAlert(`Synchronized 3 WhatsApp templates from Meta Business Platform. Statuses updated at ${new Date().toLocaleTimeString()}.`);
      setTimeout(() => setSyncAlert(null), 4000);
    }, 1200);
  };

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName) return;

    const newTmpl: WhatsAppTemplateDetailed = {
      id: `wat-${Date.now()}`,
      code: newCode.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      displayName: newName,
      category: newCategory,
      language: 'en_US',
      bodyTemplate: newBody,
      parameters: [{ index: 1, sampleValue: 'Staff Member', variableKey: 'recipient_display_name' }],
      metaApprovalStatus: 'PENDING',
      internalApprovalStatus: 'DRAFT',
      supportedModes: ['OFFICIAL_API', 'USER_ASSISTED'],
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    setTemplates([newTmpl, ...templates]);
    setSelectedTemplate(newTmpl);
    setIsCreateModalOpen(false);
  };

  const handleSendTest = () => {
    setTestSentMsg(`Simulated Meta Cloud API message sent to ${testPhone} using template [${selectedTemplate.code}]. Status: ACCEPTED.`);
    setTimeout(() => {
      setTestSentMsg(null);
      setIsTestSendOpen(false);
    }, 2500);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">WhatsApp Template Management</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Meta Business Platform approved message templates, variable mapping, interactive action buttons, and click-to-chat drafts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncMeta}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-xs transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Meta Status'}</span>
          </button>

          <button
            onClick={() => setIsTestSendOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Test Dispatch</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Draft Template</span>
          </button>
        </div>
      </div>

      {syncAlert && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncAlert}</span>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: WhatsApp Templates Catalog */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Templates Catalog ({templates.length})
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Meta Sync v21.0</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {templates.map((tmpl) => {
                const isSelected = tmpl.id === selectedTemplate.id;
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl)}
                    className={`w-full text-left p-3.5 transition cursor-pointer flex flex-col gap-1.5 ${
                      isSelected ? 'bg-emerald-50/80 border-l-4 border-l-emerald-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 truncate">{tmpl.displayName}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          tmpl.metaApprovalStatus === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tmpl.metaApprovalStatus === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        META: {tmpl.metaApprovalStatus}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 truncate">{tmpl.code}</div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>Category: {tmpl.category}</span>
                      <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                        {tmpl.language}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compliance & WhatsApp Messaging Policies Box */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Meta WhatsApp Guidelines Compliance</span>
            </div>
            <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc pl-4">
              <li>Variables cannot be placed consecutively (e.g. <code>&#123;&#123;1&#125;&#125;&#123;&#123;2&#125;&#125;</code> is rejected by Meta).</li>
              <li>Authentication & Utility templates cannot contain promotional copy.</li>
              <li>User-Assisted click-to-chat links fall back cleanly when API is offline.</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Template Detail & WhatsApp Handset Visualizer */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            {/* Header / Info bar */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">{selectedTemplate.displayName}</h2>
                  <span className="text-xs font-mono text-slate-500">({selectedTemplate.code})</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                  <span>Category: <strong className="text-slate-700">{selectedTemplate.category}</strong></span>
                  <span>•</span>
                  <span>Language: <strong className="text-slate-700">{selectedTemplate.language}</strong></span>
                  <span>•</span>
                  <span>Meta Review: <strong className="text-emerald-700 font-bold">{selectedTemplate.metaApprovalStatus}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-medium">
                  Last synced: {selectedTemplate.lastSyncTimestamp ? new Date(selectedTemplate.lastSyncTimestamp).toLocaleTimeString() : 'N/A'}
                </span>
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Parameter Editor Inputs */}
              <div className="md:col-span-6 space-y-3">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-1.5">
                  Template Parameter Binding
                </div>
                <p className="text-xs text-slate-500">
                  Provide sample values for parameter tokens to preview live rendered message.
                </p>

                <div className="space-y-2.5 pt-1">
                  {selectedTemplate.parameters.map((param) => (
                    <div key={param.index} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-blue-700">&#123;&#123;{param.index}&#125;&#125;</span>
                        <span className="text-[11px] text-slate-400 font-mono">{param.variableKey}</span>
                      </div>
                      <input
                        type="text"
                        value={paramValues[param.index] ?? param.sampleValue}
                        onChange={(e) => setParamValues({ ...paramValues, [param.index]: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-slate-50 font-medium"
                      />
                    </div>
                  ))}
                </div>

                {/* Buttons configuration preview */}
                {selectedTemplate.buttons && selectedTemplate.buttons.length > 0 && (
                  <div className="pt-3 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-700 block mb-1.5">Configured Quick Actions</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.buttons.map((b, i) => (
                        <div key={i} className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 flex items-center gap-1.5">
                          {b.type === 'URL' && <ExternalLink className="w-3 h-3 text-blue-600" />}
                          <span className="font-medium">{b.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Handset WhatsApp Chat Bubble Simulator */}
              <div className="md:col-span-6 flex justify-center">
                <div className="w-full max-w-[340px] bg-[#EFEAE2] border border-slate-300 rounded-2xl shadow-md p-3 space-y-3 font-sans relative">
                  {/* WhatsApp Status Bar Header */}
                  <div className="bg-[#075E54] -m-3 mb-3 p-3 text-white rounded-t-2xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-800 text-white text-xs font-bold flex items-center justify-center">
                        K
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-tight">Kosh Innovations Official</div>
                        <div className="text-[9px] text-emerald-200 leading-tight">Official Business Account ✓</div>
                      </div>
                    </div>
                  </div>

                  {/* Message Bubble */}
                  <div className="bg-white rounded-lg p-3 shadow-xs text-xs text-slate-800 space-y-2 relative border border-slate-200/60">
                    {selectedTemplate.headerText && (
                      <div className="text-[11px] font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-1">
                        {selectedTemplate.headerText}
                      </div>
                    )}

                    <div className="whitespace-pre-wrap leading-relaxed text-slate-800">
                      {renderRenderedBody()}
                    </div>

                    {selectedTemplate.footerText && (
                      <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-1">
                        {selectedTemplate.footerText}
                      </div>
                    )}

                    <div className="flex justify-end items-center gap-1 text-[9px] text-slate-400">
                      <span>14:32</span>
                      <span className="text-blue-500 font-bold">✓✓</span>
                    </div>
                  </div>

                  {/* Interactive Action Buttons */}
                  {selectedTemplate.buttons && (
                    <div className="space-y-1.5 pt-1">
                      {selectedTemplate.buttons.map((b, i) => (
                        <div
                          key={i}
                          className="bg-white text-[#00A884] text-xs font-semibold py-1.5 text-center rounded-lg shadow-xs border border-slate-200 cursor-pointer hover:bg-slate-50 flex items-center justify-center gap-1.5"
                        >
                          {b.type === 'URL' && <ExternalLink className="w-3.5 h-3.5" />}
                          <span>{b.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Test Send Modal */}
      {isTestSendOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Send WhatsApp Test Envelope</h3>
                <p className="text-xs text-slate-500">Dispatch template message with sample parameters.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Destination Phone Number</label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              {testSentMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-xs font-mono">
                  {testSentMsg}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsTestSendOpen(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendTest}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
              >
                Dispatch Test WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draft New Template Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <div className="p-2 bg-blue-100 text-blue-800 rounded-lg">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Draft WhatsApp Template</h3>
                <p className="text-xs text-slate-500">Creates local draft prior to Meta Business Manager submission.</p>
              </div>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Template Code (lowercase_snake_case)</label>
                <input
                  type="text"
                  placeholder="e.g. kosh_inventory_dispatch_alert"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Display Label</label>
                <input
                  type="text"
                  placeholder="e.g. Inventory Dispatch Alert"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                >
                  <option value="UTILITY">UTILITY (Transactional notifications & account alerts)</option>
                  <option value="AUTHENTICATION">AUTHENTICATION (One-time passcodes & 2FA)</option>
                  <option value="MARKETING">MARKETING (Announcements & broad updates)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Message Body Template</label>
                <textarea
                  rows={3}
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg font-sans"
                  placeholder="Hello {{1}}, ..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                >
                  Save Local Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
