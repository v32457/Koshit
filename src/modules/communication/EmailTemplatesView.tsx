import React, { useState } from 'react';
import { EmailTemplateDetailed } from '../../types/communication';
import { INITIAL_DETAILED_EMAIL_TEMPLATES, SHARED_VARIABLE_REGISTRY } from '../../data/communicationExtendedSeed';
import {
  Mail,
  FileCode,
  Eye,
  Smartphone,
  Monitor,
  CheckCircle2,
  Clock,
  Edit3,
  Copy,
  Plus,
  Send,
  Sliders,
  Check,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

export const EmailTemplatesView: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplateDetailed[]>(INITIAL_DETAILED_EMAIL_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateDetailed>(templates[0]);
  const [previewDevice, setPreviewDevice] = useState<'DESKTOP' | 'MOBILE'>('DESKTOP');
  const [activeTab, setActiveTab] = useState<'HTML_PREVIEW' | 'HTML_SOURCE' | 'PLAIN_TEXT'>('HTML_PREVIEW');
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState(selectedTemplate.subject);
  const [editedHtml, setEditedHtml] = useState(selectedTemplate.htmlBody);
  const [editedPlain, setEditedPlain] = useState(selectedTemplate.plainTextBody);

  // Synthetic Test Data for Preview
  const [testPayload, setTestPayload] = useState<Record<string, string>>({
    recipient_display_name: 'Ramesh Balasubramanian',
    item_code: 'MAPALBL0003',
    item_category: 'MA (Machinery / Spares)',
    item_description: 'Machine Parts Aluminium Blue Finish Grade 6061',
    maker_name: 'Karthik Raja',
    checker_name: 'Ramesh Balasubramanian',
    branch_name: 'Pondicherry HQ Plant',
    timestamp: '22-Oct-2026 14:30 IST',
    portal_url: 'https://my.koshinnovations.com',
    rejection_reason: 'Missing ISO 9001 test certificate attachment.',
    batch_id: 'BATCH-20261022-01',
    error_code: 'SAP-ERR-4001',
    error_message: 'Duplicate ItemCode detected in OITM table.',
    environment: 'PROD (Pondicherry HQ)',
    otp_code: '491823',
  });

  const [testSendAlert, setTestSendAlert] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New template modal fields
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newModule, setNewModule] = useState<'ITEMS' | 'REQUESTS' | 'APPROVALS' | 'SAP_INTEGRATION' | 'SECURITY' | 'SYSTEM'>('APPROVALS');
  const [newEventCode, setNewEventCode] = useState('ITEM_SUBMITTED');
  const [newSubject, setNewSubject] = useState('');

  // Handle template selection
  const handleSelectTemplate = (t: EmailTemplateDetailed) => {
    setSelectedTemplate(t);
    setEditedSubject(t.subject);
    setEditedHtml(t.htmlBody);
    setEditedPlain(t.plainTextBody);
    setIsEditing(false);
  };

  // Helper to replace placeholders
  const renderPreview = (content: string) => {
    let result = content;
    Object.entries(testPayload).forEach(([key, val]) => {
      result = result.replaceAll(`{${key}}`, val);
    });
    return result;
  };

  const handleSaveEdits = () => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === selectedTemplate.id
          ? {
              ...t,
              subject: editedSubject,
              htmlBody: editedHtml,
              plainTextBody: editedPlain,
              version: t.version + 1,
              updatedAt: new Date().toISOString(),
              modifiedBy: 'Suresh Kumar',
            }
          : t
      )
    );
    setSelectedTemplate((prev) => ({
      ...prev,
      subject: editedSubject,
      htmlBody: editedHtml,
      plainTextBody: editedPlain,
      version: prev.version + 1,
      updatedAt: new Date().toISOString(),
    }));
    setIsEditing(false);
  };

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName || !newSubject) return;

    const newTmpl: EmailTemplateDetailed = {
      id: `et-custom-${Date.now()}`,
      code: newCode.toUpperCase().replace(/\s+/g, '_'),
      name: newName,
      businessPurpose: 'Custom corporate notification template',
      module: newModule,
      eventCode: newEventCode,
      language: 'en_IN',
      subject: newSubject,
      htmlBody: `<div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">\n  <h2>KOSH NOTIFICATION</h2>\n  <p>Dear {recipient_display_name},</p>\n  <p>Notification regarding Item {item_code}.</p>\n</div>`,
      plainTextBody: 'Dear {recipient_display_name},\n\nNotification regarding Item {item_code}.\n\nKosh Master Governance',
      availablePlaceholders: ['{recipient_display_name}', '{item_code}', '{portal_url}'],
      version: 1,
      status: 'DRAFT',
      createdBy: 'Suresh Kumar',
      modifiedBy: 'Suresh Kumar',
      updatedAt: new Date().toISOString(),
    };

    setTemplates([newTmpl, ...templates]);
    setSelectedTemplate(newTmpl);
    handleSelectTemplate(newTmpl);
    setIsCreateModalOpen(false);
  };

  const handleTestSend = () => {
    setTestSendAlert(`Simulated test email for [${selectedTemplate.code}] dispatched to suresh.kumar@koshinnovations.com using active SMTP relay.`);
    setTimeout(() => setTestSendAlert(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Email Template Management</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Versioned HTML/Plain-text templates, placeholder schema validations, and desktop/mobile multi-device preview.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestSend}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Test Render</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Template</span>
          </button>
        </div>
      </div>

      {testSendAlert && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{testSendAlert}</span>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Template List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Email Templates ({templates.length})
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Immutable on approval</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
              {templates.map((tmpl) => {
                const isSelected = tmpl.id === selectedTemplate.id;
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => handleSelectTemplate(tmpl)}
                    className={`w-full text-left p-3.5 transition cursor-pointer flex flex-col gap-1.5 ${
                      isSelected ? 'bg-blue-50/80 border-l-4 border-l-blue-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 truncate">{tmpl.name}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          tmpl.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tmpl.status === 'IN_REVIEW'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {tmpl.status}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 truncate">{tmpl.code}</div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>Module: {tmpl.module}</span>
                      <span>v{tmpl.version}.0</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Placeholders Schema Box */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Available Schema Placeholders
              </span>
              <span className="text-[10px] text-slate-400">Click to copy</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pt-1">
              {selectedTemplate.availablePlaceholders.map((ph) => (
                <button
                  key={ph}
                  onClick={() => navigator.clipboard.writeText(ph)}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-mono cursor-pointer transition flex items-center gap-1"
                  title="Copy to clipboard"
                >
                  <span>{ph}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Editor & Preview */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            {/* View / Edit Tab Bar */}
            <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('HTML_PREVIEW')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition ${
                    activeTab === 'HTML_PREVIEW' ? 'bg-white shadow-xs text-blue-700' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Live Visual Preview
                </button>
                <button
                  onClick={() => setActiveTab('HTML_SOURCE')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition ${
                    activeTab === 'HTML_SOURCE' ? 'bg-white shadow-xs text-blue-700' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  HTML Source Code
                </button>
                <button
                  onClick={() => setActiveTab('PLAIN_TEXT')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition ${
                    activeTab === 'PLAIN_TEXT' ? 'bg-white shadow-xs text-blue-700' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Plain-Text Fallback
                </button>
              </div>

              <div className="flex items-center gap-2">
                {activeTab === 'HTML_PREVIEW' && (
                  <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-slate-700">
                    <button
                      onClick={() => setPreviewDevice('DESKTOP')}
                      className={`p-1.5 rounded-md text-xs cursor-pointer ${
                        previewDevice === 'DESKTOP' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-600'
                      }`}
                      title="Desktop Layout"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPreviewDevice('MOBILE')}
                      className={`p-1.5 rounded-md text-xs cursor-pointer ${
                        previewDevice === 'MOBILE' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-600'
                      }`}
                      title="Mobile Layout (380px)"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer shadow-xs"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Edit Template</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-2.5 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdits}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
                    >
                      Save Version v{selectedTemplate.version + 1}.0
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Subject Field */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/20">
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Subject Header</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 bg-white"
                />
              ) : (
                <div className="text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2">
                  {renderPreview(selectedTemplate.subject)}
                </div>
              )}
            </div>

            {/* Content Area */}
            <div className="p-4">
              {activeTab === 'HTML_PREVIEW' && (
                <div className="bg-slate-100 rounded-xl p-4 flex justify-center">
                  <div
                    className={`bg-white shadow-md rounded-lg overflow-hidden transition-all duration-300 ${
                      previewDevice === 'MOBILE' ? 'w-[380px]' : 'w-full max-w-[620px]'
                    }`}
                  >
                    <div className="bg-slate-800 text-slate-300 px-3 py-1.5 text-[10px] flex items-center justify-between select-none">
                      <span>Simulated Inbound Message Preview</span>
                      <span className="text-emerald-400 font-mono">Render OK</span>
                    </div>
                    <div
                      className="p-3"
                      dangerouslySetInnerHTML={{
                        __html: renderPreview(isEditing ? editedHtml : selectedTemplate.htmlBody),
                      }}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'HTML_SOURCE' && (
                <div>
                  <textarea
                    disabled={!isEditing}
                    value={isEditing ? editedHtml : selectedTemplate.htmlBody}
                    onChange={(e) => setEditedHtml(e.target.value)}
                    rows={16}
                    className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg bg-slate-900 text-slate-100 disabled:bg-slate-950 disabled:text-slate-300"
                  />
                </div>
              )}

              {activeTab === 'PLAIN_TEXT' && (
                <div>
                  <textarea
                    disabled={!isEditing}
                    value={isEditing ? editedPlain : selectedTemplate.plainTextBody}
                    onChange={(e) => setEditedPlain(e.target.value)}
                    rows={14}
                    className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-800 disabled:bg-slate-100"
                  />
                </div>
              )}
            </div>

            {/* Meta details footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-3">
                <span>Created by: <strong>{selectedTemplate.createdBy}</strong></span>
                <span>Last updated: <strong>{new Date(selectedTemplate.updatedAt).toLocaleDateString()}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span>Approval: <strong>{selectedTemplate.approvedBy || 'System Baseline'}</strong></span>
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold">
                  v{selectedTemplate.version}.0
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Template Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <div className="p-2 bg-blue-100 text-blue-800 rounded-lg">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Create New Email Template</h3>
                <p className="text-xs text-slate-500">Draft a new corporate email communication template.</p>
              </div>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Template Code (Unique Identifier)</label>
                <input
                  type="text"
                  placeholder="e.g. EMAIL_BRANCH_DISPATCH_ALERT"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Branch Dispatch Inventory Notification"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Owning Module</label>
                  <select
                    value={newModule}
                    onChange={(e) => setNewModule(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="APPROVALS">Approvals</option>
                    <option value="ITEMS">Items Master</option>
                    <option value="SAP_INTEGRATION">SAP Integration</option>
                    <option value="SECURITY">Security / 2FA</option>
                    <option value="SYSTEM">System Broadcasts</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Event Code</label>
                  <input
                    type="text"
                    value={newEventCode}
                    onChange={(e) => setNewEventCode(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Default Subject Line</label>
                <input
                  type="text"
                  placeholder="e.g. [Notice] {item_code} requires attention"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  required
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
                  Create Template Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
