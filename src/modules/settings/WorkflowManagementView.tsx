import React, { useState } from 'react';
import {
  WorkflowDefinition,
  WorkflowStageDefinition,
  StageType,
  ApprovalPolicy,
  ApproverRule,
} from '../../types/approvalWorkflow';
import { INITIAL_WORKFLOW_TEMPLATES } from '../../data/seedWorkflows';
import { User } from '../../types';
import {
  GitFork,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Play,
  ArrowRight,
  Layers,
  Users,
  AlertCircle,
  FileCode,
  Copy,
  ChevronRight,
  Sparkles,
  HelpCircle,
  ListOrdered,
} from 'lucide-react';

interface WorkflowManagementViewProps {
  currentUser: User;
}

export const WorkflowManagementView: React.FC<WorkflowManagementViewProps> = ({
  currentUser,
}) => {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>(
    INITIAL_WORKFLOW_TEMPLATES
  );
  const [activeTab, setActiveTab] = useState<'TEMPLATES' | 'SIMULATOR' | 'PRECEDENCE'>('TEMPLATES');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWf, setEditingWf] = useState<WorkflowDefinition | null>(null);

  // Form State
  const [wfForm, setWfForm] = useState<Partial<WorkflowDefinition>>({
    workflowKey: '',
    displayName: '',
    description: '',
    moduleKey: 'ITEM_MASTER',
    targetOperation: 'CREATE',
    stages: [],
  });

  const [stages, setStages] = useState<WorkflowStageDefinition[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Simulator State
  const [simModule, setSimModule] = useState<'ITEM_MASTER' | 'BUSINESS_PARTNER_MASTER'>('ITEM_MASTER');
  const [simCategory, setSimCategory] = useState('FG');
  const [simBranch, setSimBranch] = useState('POND-01');
  const [simResults, setSimResults] = useState<WorkflowStageDefinition[] | null>(null);

  // Open Modal for Create / Edit
  const handleOpenModal = (wf?: WorkflowDefinition) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (wf) {
      setEditingWf(wf);
      setWfForm({
        workflowKey: wf.workflowKey,
        displayName: wf.displayName,
        description: wf.description,
        moduleKey: wf.moduleKey,
        targetOperation: wf.targetOperation,
      });
      setStages(wf.stages || []);
    } else {
      setEditingWf(null);
      setWfForm({
        workflowKey: `WF-${Date.now().toString().slice(-4)}`,
        displayName: '',
        description: '',
        moduleKey: 'ITEM_MASTER',
        targetOperation: 'CREATE',
      });
      setStages([
        {
          id: `stg-${Date.now()}-1`,
          order: 1,
          name: 'Level 1: Initial Technical Review',
          stageType: 'SEQUENTIAL',
          policy: 'ANY',
          approvers: [
            { id: 'appr-1', type: 'ROLE', targetId: 'ITEM_CHECKER', targetName: 'Item Checker' },
          ],
          slaHours: 24,
          reminderIntervalHours: 8,
          requireComments: true,
          allowDelegation: true,
        },
      ]);
    }
    setIsModalOpen(true);
  };

  // Add Stage
  const handleAddStage = () => {
    const newStage: WorkflowStageDefinition = {
      id: `stg-${Date.now()}-${stages.length + 1}`,
      order: stages.length + 1,
      name: `Level ${stages.length + 1}: Governance Review`,
      stageType: 'SEQUENTIAL',
      policy: 'ALL',
      approvers: [
        { id: `appr-${Date.now()}`, type: 'ROLE', targetId: 'MASTER_DATA_AUDITOR', targetName: 'Master Data Auditor' },
      ],
      slaHours: 24,
      reminderIntervalHours: 6,
      requireComments: true,
      allowDelegation: false,
    };
    setStages([...stages, newStage]);
  };

  // Delete Stage
  const handleDeleteStage = (id: string) => {
    const filtered = stages.filter((s) => s.id !== id);
    const reordered = filtered.map((s, idx) => ({ ...s, order: idx + 1 }));
    setStages(reordered);
  };

  // Save Workflow Template
  const handleSaveWorkflow = () => {
    if (!wfForm.workflowKey?.trim() || !wfForm.displayName?.trim()) {
      setErrorMsg('Workflow Key and Display Name are required.');
      return;
    }

    if (stages.length === 0) {
      setErrorMsg('At least one approval stage is required.');
      return;
    }

    if (editingWf) {
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === editingWf.id
            ? {
                ...w,
                workflowKey: wfForm.workflowKey!.toUpperCase().trim(),
                displayName: wfForm.displayName!.trim(),
                description: wfForm.description || '',
                moduleKey: wfForm.moduleKey || 'ITEM_MASTER',
                targetOperation: wfForm.targetOperation || 'CREATE',
                stages,
                version: w.version + 1,
                updatedAt: new Date().toISOString(),
              }
            : w
        )
      );
      setSuccessMsg(`Workflow "${wfForm.displayName}" updated to Version ${editingWf.version + 1}`);
    } else {
      const newWf: WorkflowDefinition = {
        id: `wf-${Date.now()}`,
        workflowKey: wfForm.workflowKey!.toUpperCase().trim(),
        displayName: wfForm.displayName!.trim(),
        description: wfForm.description || '',
        moduleKey: wfForm.moduleKey || 'ITEM_MASTER',
        targetOperation: wfForm.targetOperation || 'CREATE',
        version: 1,
        status: 'PUBLISHED',
        stages,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.fullName,
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
        publishedBy: currentUser.fullName,
      };
      setWorkflows([newWf, ...workflows]);
      setSuccessMsg(`New Workflow Template "${newWf.displayName}" created and published.`);
    }

    setIsModalOpen(false);
  };

  // Run Simulator
  const handleRunSimulator = () => {
    const matched = workflows.find(
      (w) => w.moduleKey === simModule && w.status === 'PUBLISHED'
    );
    if (matched) {
      setSimResults(matched.stages);
    } else {
      setSimResults([]);
    }
  };

  return (
    <div className="space-y-4 text-xs select-none font-sans">
      {/* Page Title Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <GitFork className="w-5 h-5 text-indigo-600" />
            Standardized Multi-Level Approval Workflow Management
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Centralized, reusable governance workflow engine for Item Master, Business Partner Master & future modules.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Workflow Template
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 flex gap-1 font-bold text-slate-700">
        <button
          onClick={() => setActiveTab('TEMPLATES')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition ${
            activeTab === 'TEMPLATES'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" /> Workflow Templates ({workflows.length})
        </button>
        <button
          onClick={() => setActiveTab('SIMULATOR')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition ${
            activeTab === 'SIMULATOR'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'hover:bg-slate-100'
          }`}
        >
          <Play className="w-4 h-4" /> Dry-Run Workflow Simulator
        </button>
        <button
          onClick={() => setActiveTab('PRECEDENCE')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition ${
            activeTab === 'PRECEDENCE'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Precedence & Governance Scope Map
        </button>
      </div>

      {/* SUCCESS MESSAGE BANNER */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl font-bold flex items-center justify-between">
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: WORKFLOW TEMPLATES LIBRARY */}
      {activeTab === 'TEMPLATES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 relative hover:border-indigo-300 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-mono font-bold rounded border border-indigo-200 text-[10px]">
                    {wf.workflowKey} (v{wf.version})
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm mt-1">{wf.displayName}</h3>
                  <p className="text-slate-500 text-xs mt-0.5">{wf.description}</p>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                  {wf.status}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-[11px]">
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[9px]">
                    Target Module
                  </span>
                  <strong className="text-slate-800">{wf.moduleKey}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[9px]">
                    Total Stages
                  </span>
                  <strong className="text-indigo-700 font-mono">
                    {wf.stages.length} Approval Levels
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[9px]">
                    Target Operation
                  </span>
                  <strong className="text-slate-800">{wf.targetOperation}</strong>
                </div>
              </div>

              {/* Stage Progress Summary */}
              <div className="space-y-1.5">
                <span className="text-slate-500 font-bold text-[10px] uppercase">
                  Multi-Level Stage Hierarchy:
                </span>
                <div className="space-y-1">
                  {wf.stages.map((stg) => (
                    <div
                      key={stg.id}
                      className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 font-mono font-bold flex items-center justify-center text-[10px]">
                          {stg.order}
                        </span>
                        <span className="font-bold text-slate-800 text-[11px]">{stg.name}</span>
                      </div>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.5 rounded">
                        Policy: {stg.policy} | SLA: {stg.slaHours}h
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                <button
                  onClick={() => handleOpenModal(wf)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" /> Edit Stages
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: DRY-RUN WORKFLOW SIMULATOR */}
      {activeTab === 'SIMULATOR' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Play className="w-4 h-4 text-indigo-600" />
              Interactive Workflow Dry-Run Simulator
            </h3>
            <p className="text-slate-500 text-xs">
              Simulate approval stage resolution for any module request without creating database records or sending notifications.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-50 border rounded-xl">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Target Module *</label>
              <select
                value={simModule}
                onChange={(e) => setSimModule(e.target.value as any)}
                className="w-full p-2 bg-white border rounded-lg text-xs font-bold"
              >
                <option value="ITEM_MASTER">Item Master Module</option>
                <option value="BUSINESS_PARTNER_MASTER">Business Partner Master Module</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Category / Type</label>
              <select
                value={simCategory}
                onChange={(e) => setSimCategory(e.target.value)}
                className="w-full p-2 bg-white border rounded-lg text-xs"
              >
                <option value="FG">Finished Goods (FG)</option>
                <option value="RM">Raw Materials (RM)</option>
                <option value="MA">Maintenance / Spares (MA)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Requesting Branch</label>
              <select
                value={simBranch}
                onChange={(e) => setSimBranch(e.target.value)}
                className="w-full p-2 bg-white border rounded-lg text-xs"
              >
                <option value="POND-01">Pondicherry Main Plant (POND-01)</option>
                <option value="CHEN-02">Chennai Automotive Unit (CHEN-02)</option>
                <option value="PUNE-04">Pune Western Region Plant (PUNE-04)</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleRunSimulator}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Sparkles className="w-4 h-4" /> Run Workflow Resolution Test
          </button>

          {/* Simulation Output */}
          {simResults !== null && (
            <div className="border rounded-xl p-4 bg-slate-900 text-white space-y-3">
              <h4 className="font-bold text-xs text-indigo-300 uppercase flex items-center justify-between">
                <span>Simulated Routing Stages ({simResults.length} Stages Resolved)</span>
                <span className="font-mono text-slate-400">Precedence: Module + Branch → Module Default</span>
              </h4>

              {simResults.length === 0 ? (
                <p className="text-slate-400 italic">No published workflow template found for module.</p>
              ) : (
                <div className="space-y-2">
                  {simResults.map((stg, idx) => (
                    <div
                      key={stg.id}
                      className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-indigo-500 text-white font-mono font-bold flex items-center justify-center text-xs">
                          {stg.order}
                        </span>
                        <div>
                          <div className="font-bold text-white text-xs">{stg.name}</div>
                          <div className="text-[10px] text-slate-400">
                            Approver Role: <strong>{stg.approvers[0]?.targetName}</strong> | Type: {stg.stageType}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 rounded font-bold text-[10px]">
                          Policy: {stg.policy}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">SLA: {stg.slaHours} Hours</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PRECEDENCE MAP */}
      {activeTab === 'PRECEDENCE' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Governance Precedence Resolution Order
          </h3>
          <p className="text-slate-500 text-xs">
            When a request is submitted, the workflow engine resolves effective approval stages in exact deterministic order:
          </p>

          <div className="space-y-2">
            {[
              { level: 1, name: 'Module + Branch + Operation Override', desc: 'Specific branch override for specific operation e.g. ITEM_MASTER + CHEN-02 + CREATE' },
              { level: 2, name: 'Module + Branch Override', desc: 'Specific branch workflow for all operations within a module' },
              { level: 3, name: 'Module Global Workflow', desc: 'Standard published workflow for the module e.g. WF-ITEM-01' },
              { level: 4, name: 'Platform Global Default Workflow', desc: 'Fallback multi-level governance workflow' },
            ].map((p) => (
              <div key={p.level} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center font-mono text-xs">
                  {p.level}
                </span>
                <div>
                  <div className="font-bold text-slate-900 text-xs">{p.name}</div>
                  <p className="text-slate-500 text-[11px]">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE / EDIT WORKFLOW TEMPLATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-indigo-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <GitFork className="w-4 h-4 text-indigo-300" />
                {editingWf ? `Edit Workflow: ${editingWf.workflowKey}` : 'Create Workflow Template'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-indigo-200 hover:text-white font-bold">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mx-4 mt-3 p-2 bg-rose-50 border border-rose-200 text-rose-800 font-bold rounded-lg text-xs">
                {errorMsg}
              </div>
            )}

            {/* Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Workflow Key *</label>
                  <input
                    type="text"
                    value={wfForm.workflowKey}
                    onChange={(e) => setWfForm({ ...wfForm, workflowKey: e.target.value })}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono uppercase font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Module *</label>
                  <select
                    value={wfForm.moduleKey}
                    onChange={(e) => setWfForm({ ...wfForm, moduleKey: e.target.value as any })}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="ITEM_MASTER">Item Master Module</option>
                    <option value="BUSINESS_PARTNER_MASTER">Business Partner Master Module</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Display Name *</label>
                  <input
                    type="text"
                    value={wfForm.displayName}
                    onChange={(e) => setWfForm({ ...wfForm, displayName: e.target.value })}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={wfForm.description}
                    onChange={(e) => setWfForm({ ...wfForm, description: e.target.value })}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Stage Builder Section */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs">Multi-Level Approval Stages</h4>
                  <button
                    type="button"
                    onClick={handleAddStage}
                    className="px-2.5 py-1 bg-indigo-600 text-white font-bold rounded flex items-center gap-1 cursor-pointer text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Approval Level
                  </button>
                </div>

                <div className="space-y-2">
                  {stages.map((stg, idx) => (
                    <div key={stg.id} className="p-3 bg-slate-50 border rounded-xl space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-xs">
                          Level {stg.order}: {stg.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteStage(stg.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="block font-semibold text-slate-600 mb-0.5">Stage Name</label>
                          <input
                            type="text"
                            value={stg.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setStages(
                                stages.map((s) => (s.id === stg.id ? { ...s, name: val } : s))
                              );
                            }}
                            className="w-full p-1.5 border rounded bg-white"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-600 mb-0.5">Approval Policy</label>
                          <select
                            value={stg.policy}
                            onChange={(e) => {
                              const val = e.target.value as ApprovalPolicy;
                              setStages(
                                stages.map((s) => (s.id === stg.id ? { ...s, policy: val } : s))
                              );
                            }}
                            className="w-full p-1.5 border rounded bg-white font-bold"
                          >
                            <option value="ANY">ANY (Single Approver Approval)</option>
                            <option value="ALL">ALL (Unanimous Approval)</option>
                            <option value="QUORUM">QUORUM (N-of-M Threshold)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-600 mb-0.5">SLA Duration (Hours)</label>
                          <input
                            type="number"
                            value={stg.slaHours}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 24;
                              setStages(
                                stages.map((s) => (s.id === stg.id ? { ...s, slaHours: val } : s))
                              );
                            }}
                            className="w-full p-1.5 border rounded bg-white font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 border rounded-lg font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveWorkflow}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg cursor-pointer"
              >
                Save & Publish Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
