import React, { useState } from 'react';
import { PageAcceptanceRecord } from '../types';
import { CheckCircle2, XCircle, AlertCircle, Shield, Database, Lock, Layers, Zap, X, ExternalLink } from 'lucide-react';

interface Stage0ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApproveStage0: () => void;
  onRequestStage0Changes: (feedback: string) => void;
  stage0Status: 'PENDING_APPROVAL' | 'APPROVED' | 'CHANGES_REQUESTED';
}

export const Stage0ReviewModal: React.FC<Stage0ReviewModalProps> = ({
  isOpen,
  onClose,
  onApproveStage0,
  onRequestStage0Changes,
  stage0Status,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'datamodel' | 'rbac' | 'routes' | 'sap' | 'rules'>('overview');
  const [feedback, setFeedback] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#0B192C] text-white p-4 md:px-6 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  STAGE 0: Full Architecture & Specification Approval Gate
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  stage0Status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' :
                  stage0Status === 'CHANGES_REQUESTED' ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40' :
                  'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                }`}>
                  {stage0Status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                My Kosh Innovations Global IT System • Master Data Governance & SAP B1 HANA Integration
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2 flex items-center gap-2 overflow-x-auto shrink-0 text-xs font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'overview' ? 'bg-white text-blue-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            System Blueprint & Shell
          </button>
          <button
            onClick={() => setActiveTab('datamodel')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'datamodel' ? 'bg-white text-blue-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Relational Data Model
          </button>
          <button
            onClick={() => setActiveTab('rbac')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rbac' ? 'bg-white text-blue-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            RBAC & Multi-Branch Scopes
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rules' ? 'bg-white text-blue-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Code & Description Rule Engines
          </button>
          <button
            onClick={() => setActiveTab('sap')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sap' ? 'bg-white text-blue-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-500" />
            Module 05.05 SAP Integration
          </button>
          <button
            onClick={() => setActiveTab('routes')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'routes' ? 'bg-white text-blue-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            Route Inventory (19 Screens)
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 text-slate-800 text-xs space-y-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="font-bold text-sm text-blue-900 mb-1">
                  1. Modular Portal Shell & Kosh Corporate Standards
                </h4>
                <p className="text-blue-800 leading-relaxed">
                  The portal is designed as an extensible multi-module platform for Kosh Innovations (Pondicherry HQ, Chennai, Hosur, Pune, Dehradun). The shared shell encapsulates authentication, 2FA, multi-branch scoping, maker-checker approvals, and enterprise audit logging. Future modules (e.g. BOM Master, Quality Assurance, Production Scheduling) mount into this unified foundation.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50">
                  <h5 className="font-bold text-slate-900 text-xs mb-1">Target Environments</h5>
                  <ul className="text-slate-600 space-y-1 list-disc list-inside">
                    <li><strong className="text-slate-800">Production URL:</strong> https://my.koshinnovations.com/</li>
                    <li><strong className="text-slate-800">UAT Environment:</strong> http://localhost/mykoshinnovations</li>
                    <li><strong className="text-slate-800">Timezone:</strong> Asia/Kolkata default</li>
                  </ul>
                </div>
                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50">
                  <h5 className="font-bold text-slate-900 text-xs mb-1">Security & 2FA</h5>
                  <ul className="text-slate-600 space-y-1 list-disc list-inside">
                    <li>Email-based 6-digit OTP Two-Factor Authentication</li>
                    <li>Admin master toggle (Enable/Disable)</li>
                    <li>Account lockout after 5 consecutive failures</li>
                    <li>Strict server-side secret masking</li>
                  </ul>
                </div>
                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50">
                  <h5 className="font-bold text-slate-900 text-xs mb-1">Governance Quality</h5>
                  <ul className="text-slate-600 space-y-1 list-disc list-inside">
                    <li>Segregated Maker-Checker roles</li>
                    <li>Provisional code preview vs. atomic sequence commit</li>
                    <li>Zero decorative buttons without backend integration</li>
                    <li>Immutable audit trail for all operations</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'datamodel' && (
            <div className="space-y-3 font-mono text-[11px]">
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="font-bold text-slate-800 text-xs mb-1 font-sans">Primary Relational Schemas</div>
                <p className="font-sans text-slate-600 text-[11px] mb-2">
                  PostgreSQL relational schema enforces ACID guarantees, atomic sequence counters, foreign keys, and soft deactivation:
                </p>
                <div className="bg-slate-900 text-emerald-400 p-3 rounded-lg overflow-x-auto text-[11px] leading-relaxed">
{`• organizations (id, code, name, created_at)
• branches (id, org_id, code, name, city, is_active)
• plants (id, branch_id, code, name, is_active)
• users (id, org_id, email, full_name, password_hash, two_factor_enabled, is_active)
• roles (id, code, name, description)
• user_branch_roles (id, user_id, branch_id, role_id, is_primary)
• classification_values (id, dimension_key, code, name, display_label, is_active)
• item_code_rules (id, name, category_code, components_json, separator, sequence_scope, version, status)
• item_code_sequences (scope_key, current_val, updated_at) -- Atomic Concurrency Protection
• item_description_rules (id, category_code, template_pattern, separator, max_length, version)
• global_items (id, global_item_code, category_code, description, status, attributes_json, code_rule_version)
• branch_item_availability (id, item_id, branch_id, is_stocked, is_purchased, is_manufactured, is_active)
• approval_records (id, item_id, action, decided_by, decision_timestamp, remarks, snapshot_json)
• sap_integration_profiles (id, name, environment, service_layer_url, company_db, credential_vault_ref, status)
• sap_schedules (id, profile_id, cron_expression, timezone, is_enabled, next_run_at, last_run_at)
• sap_integration_jobs (id, profile_id, idempotency_key, status, total_records, success_records, failed_records)
• sap_dead_letter_records (id, job_id, item_id, error_category, error_message, retry_count, resolution_status)
• audit_logs (id, correlation_id, actor_id, actor_email, action, entity_name, entity_id, changes, created_at)`}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rbac' && (
            <div className="space-y-3">
              <p className="text-slate-600">
                Explicit role-based access control with organization-wide and branch-scoped permissions:
              </p>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                      <th className="p-2.5 font-bold">Role</th>
                      <th className="p-2.5 font-bold">Scope</th>
                      <th className="p-2.5 font-bold">Create Drafts</th>
                      <th className="p-2.5 font-bold">Approve Items</th>
                      <th className="p-2.5 font-bold">Rule Builder</th>
                      <th className="p-2.5 font-bold">SAP Activation</th>
                      <th className="p-2.5 font-bold">Maker-Checker Segregation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2.5 font-bold text-slate-900">Platform Administrator</td>
                      <td className="p-2.5">Global</td>
                      <td className="p-2.5 text-emerald-600">Yes</td>
                      <td className="p-2.5 text-emerald-600">Yes</td>
                      <td className="p-2.5 text-emerald-600">Yes</td>
                      <td className="p-2.5 text-emerald-600">Yes</td>
                      <td className="p-2.5 text-slate-500">Subject to Audit Log</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-900">Global Item Master Admin</td>
                      <td className="p-2.5">Global</td>
                      <td className="p-2.5 text-emerald-600">Yes</td>
                      <td className="p-2.5 text-emerald-600">Yes</td>
                      <td className="p-2.5 text-emerald-600">Yes</td>
                      <td className="p-2.5 text-slate-400">View Only</td>
                      <td className="p-2.5 text-rose-600 font-semibold">Cannot self-approve</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-900">Item Creator / Maker</td>
                      <td className="p-2.5">Branch</td>
                      <td className="p-2.5 text-emerald-600 font-bold">Yes</td>
                      <td className="p-2.5 text-rose-600 font-bold">No</td>
                      <td className="p-2.5 text-slate-400">No</td>
                      <td className="p-2.5 text-slate-400">No</td>
                      <td className="p-2.5 text-rose-600 font-bold">Strict: Self-approval barred</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-900">Item Approver / Checker</td>
                      <td className="p-2.5">Branch / Org</td>
                      <td className="p-2.5 text-slate-400">No</td>
                      <td className="p-2.5 text-emerald-600 font-bold">Yes</td>
                      <td className="p-2.5 text-slate-400">No</td>
                      <td className="p-2.5 text-slate-400">No</td>
                      <td className="p-2.5 text-slate-700">Can Approve / Reject / Return</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-900">Master Data Auditor</td>
                      <td className="p-2.5">Global</td>
                      <td className="p-2.5 text-slate-400">No</td>
                      <td className="p-2.5 text-slate-400">No</td>
                      <td className="p-2.5 text-slate-400">No</td>
                      <td className="p-2.5 text-slate-400">No</td>
                      <td className="p-2.5 text-slate-500">Read-Only Audit Trail</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-900">
                <div className="font-bold text-xs mb-1">Pure Unit-Tested Logic Verification (All 7 Tests Passed)</div>
                <p className="text-[11px]">
                  Executed logic verification using <code className="bg-emerald-100 px-1 py-0.5 rounded">tsx --test</code> against the user's exact specification examples:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2 font-mono text-[11px]">
                  <div className="bg-white p-2 rounded border border-emerald-200">
                    <div className="font-bold text-slate-800">Raw Materials (RM)</div>
                    <div className="text-slate-500">Code: RMPAOPOEXLG0001</div>
                    <div className="text-slate-500">Desc: PC-ABS – Item Name – Light Grey – Powder</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-emerald-200">
                    <div className="font-bold text-slate-800">Finished Goods (FG)</div>
                    <div className="text-slate-500">Code: FGHDMCRGY0002</div>
                    <div className="text-slate-500">Desc: HDPE – Item Name – Grey</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-emerald-200">
                    <div className="font-bold text-slate-800">Maintenance (MA)</div>
                    <div className="text-slate-500">Code: MAPALBL0003</div>
                    <div className="text-slate-500">Desc: Festo – DSNU-25 – 10 Bar</div>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="font-bold text-slate-900 text-xs mb-1">Atomic Concurrency & Numbering Protection</div>
                <ul className="text-slate-600 list-disc list-inside space-y-1">
                  <li>Provisional Code is shown during drafting without burning sequential integers.</li>
                  <li>Atomic database counter lock guarantees zero duplicate ItemCodes under simultaneous multi-user submissions.</li>
                  <li>No recycling of rejected or discarded codes. Full version immutability and rollback protection.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'sap' && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900">
                <div className="font-bold text-xs mb-1">Module 05.05 — SAP Business One HANA Integration Controls</div>
                <p className="text-[11px]">
                  Controlled stage-by-stage lifecycle: Draft → Validated → Test Required (20 Safe Checks) → Test Passed → Approval Required → Approved → Active.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <h5 className="font-bold text-slate-900 text-xs mb-1">Idempotency & Reconciliation</h5>
                  <ul className="text-slate-600 space-y-1 list-disc list-inside text-[11px]">
                    <li>Unique idempotency key per sync attempt prevents duplicate items.</li>
                    <li>Dead Letter Queue (DLQ) captures transient and permanent rejections with sanitization.</li>
                    <li>Target Reconciliation detects out-of-sync or orphan SAP items.</li>
                    <li>Asia/Kolkata timezone scheduled executions with lock protection.</li>
                  </ul>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <h5 className="font-bold text-slate-900 text-xs mb-1">Safe Testing Safeguards</h5>
                  <ul className="text-slate-600 space-y-1 list-disc list-inside text-[11px]">
                    <li>Default testing is strictly non-mutating (TLS, Session, Endpoint, Metadata).</li>
                    <li>Production write tests require explicit elevated authorization.</li>
                    <li>Failed mandatory tests block production activation unconditionally.</li>
                    <li>Emergency Stop control immediately halts pending scheduled workers.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'routes' && (
            <div className="space-y-2">
              <div className="font-bold text-slate-900 text-xs">Page Inventory & Review Order (19 Gated Screens)</div>
              <p className="text-slate-600 text-[11px]">
                Each page below is registered in <code className="bg-slate-200 px-1 py-0.5 rounded">docs/page-acceptance-register.md</code> and will be presented for individual accept/reject review:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-00:</strong> Login & 2FA Verification
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-01:</strong> Corporate Dashboard & Metrics
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-02:</strong> Global Item Master & Import/Export
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-03:</strong> Item Creation Form
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-04:</strong> Branch Item Availability Matrix
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-05:</strong> My Requests & Revision Tracker
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-06:</strong> Approval Inbox (Checker Review)
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-07:</strong> General Settings
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-08:</strong> Classification Masters
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-09:</strong> Item Code & Description
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-10:</strong> Item Description Rules
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-11:</strong> Org, Branch & Plant Management
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-12:</strong> User & Role Administration
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-13:</strong> Rule Version History & Rollback
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-14:</strong> Enterprise Audit Logs
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-15:</strong> SAP Integration & Scheduling
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-16:</strong> SAP Integration Testing & 20 Checks
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-17:</strong> Activate Integration & Emergency Stop
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <strong className="text-cyan-700">P-18:</strong> SAP Monitor, Jobs & DLQ
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with User Approval Actions */}
        <div className="bg-slate-50 p-4 px-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            Stage 0 Architecture specification is stored at <code className="text-slate-800 font-mono">docs/stage-0-architecture-proposal.md</code>
          </div>

          <div className="flex items-center gap-2">
            {!showFeedbackInput ? (
              <>
                <button
                  onClick={() => setShowFeedbackInput(true)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition cursor-pointer text-xs"
                >
                  Request Changes to Architecture
                </button>
                <button
                  onClick={() => {
                    onApproveStage0();
                    onClose();
                  }}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5 text-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve Stage 0 & Proceed to Page Reviews
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Specify architectural adjustments or questions..."
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    if (feedback.trim()) {
                      onRequestStage0Changes(feedback.trim());
                      setShowFeedbackInput(false);
                      setFeedback('');
                    }
                  }}
                  className="px-3 py-1.5 bg-rose-600 text-white rounded font-semibold text-xs hover:bg-rose-700 cursor-pointer"
                >
                  Submit Changes
                </button>
                <button
                  onClick={() => setShowFeedbackInput(false)}
                  className="px-2 py-1.5 text-slate-500 text-xs hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
