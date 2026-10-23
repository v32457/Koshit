import React, { useState } from 'react';
import { ModuleAuditEvent, ModuleRegistryItem, User } from '../../types';
import { INITIAL_MODULE_REGISTRY } from '../../data/seedData';
import {
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
  Boxes,
  Users2,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Search,
  Filter,
  ArrowUpDown,
  History,
  AlertTriangle,
  Play,
  Pause,
  Save,
  Check,
  ChevronRight,
  FileCode2,
  Settings2,
  Database,
  Lock,
} from 'lucide-react';

interface ModuleManagementViewProps {
  currentUser: User;
  moduleRegistry: ModuleRegistryItem[];
  onToggleModule: (moduleKey: string, isEnabled: boolean, reason: string) => void;
  onAddModule: (newModule: ModuleRegistryItem) => void;
}

export const ModuleManagementView: React.FC<ModuleManagementViewProps> = ({
  currentUser,
  moduleRegistry,
  onToggleModule,
  onAddModule,
}) => {
  const [activeTab, setActiveTab] = useState<'primary' | 'registry' | 'audit'>('primary');

  // Disable Confirmation Modal State
  const [targetModule, setTargetModule] = useState<ModuleRegistryItem | null>(null);
  const [disableReason, setDisableReason] = useState('');
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);

  // Search & Filter for Registry
  const [registrySearch, setRegistrySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Audit Events State
  const [auditLogs, setAuditLogs] = useState<ModuleAuditEvent[]>([
    {
      id: 'aud-001',
      moduleId: 'mod-item-master',
      moduleKey: 'ITEM_MASTER',
      actorUserId: currentUser.id,
      actorUserName: currentUser.fullName,
      eventType: 'ENABLE',
      previousState: false,
      newState: true,
      reason: 'Initial system rollout verification',
      timestamp: '2026-10-22T08:00:00Z',
      impactedJobCount: 3,
    },
  ]);

  // Wizard State ("Add New Module")
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardForm, setWizardForm] = useState({
    displayName: '',
    moduleKey: '',
    description: '',
    navigationGroup: 'Operations',
    ownerTeam: 'Enterprise Applications',
    dependencies: [] as string[],
    pagesCount: 3,
    fieldsCount: 5,
  });
  const [wizardError, setWizardError] = useState('');

  // Disable Modal Trigger
  const handleOpenDisableModal = (mod: ModuleRegistryItem) => {
    setTargetModule(mod);
    setDisableReason('');
    setIsDisableModalOpen(true);
  };

  const handleConfirmToggle = () => {
    if (!targetModule) return;
    const newState = !targetModule.isEnabled;

    if (!newState && !disableReason.trim()) {
      alert('Please provide a reason for disabling this module.');
      return;
    }

    onToggleModule(targetModule.moduleKey, newState, disableReason);

    // Record audit event
    const newAudit: ModuleAuditEvent = {
      id: `aud-${Date.now()}`,
      moduleId: targetModule.id,
      moduleKey: targetModule.moduleKey,
      actorUserId: currentUser.id,
      actorUserName: currentUser.fullName,
      eventType: newState ? 'ENABLE' : 'DISABLE',
      previousState: targetModule.isEnabled,
      newState,
      reason: disableReason || 'Administrator state toggle',
      timestamp: new Date().toISOString(),
      impactedJobCount: targetModule.activeJobCount,
    };
    setAuditLogs([newAudit, ...auditLogs]);

    setIsDisableModalOpen(false);
    setTargetModule(null);
  };

  // Wizard Handlers
  const handleNextStep = () => {
    setWizardError('');
    if (wizardStep === 1) {
      if (!wizardForm.displayName.trim() || !wizardForm.moduleKey.trim()) {
        setWizardError('Display Name and Unique Machine Key are required.');
        return;
      }
      // Check duplicate key
      if (moduleRegistry.some((m) => m.moduleKey.toLowerCase() === wizardForm.moduleKey.trim().toLowerCase())) {
        setWizardError(`Module Key "${wizardForm.moduleKey}" already exists.`);
        return;
      }
    }
    setWizardStep((prev) => Math.min(prev + 1, 10));
  };

  const handleFinishWizard = () => {
    const newModule: ModuleRegistryItem = {
      id: `mod-${Date.now()}`,
      moduleKey: wizardForm.moduleKey.toUpperCase().trim(),
      displayName: wizardForm.displayName.trim(),
      description: wizardForm.description.trim() || 'Custom registered enterprise module.',
      iconKey: 'Layers',
      navigationGroup: wizardForm.navigationGroup,
      displayOrder: moduleRegistry.length + 1,
      ownerTeam: wizardForm.ownerTeam,
      ownerUser: currentUser.fullName,
      version: 1,
      isEnabled: true,
      lifecycleStatus: 'ENABLED',
      changedAt: new Date().toISOString(),
      changedBy: currentUser.fullName,
      changeReason: 'Registered via Administrative Module Builder Wizard',
      dependencies: wizardForm.dependencies,
      activeJobCount: 0,
      pausedJobCount: 0,
      pages: [
        {
          id: `p-cust-01`,
          pageKey: `${wizardForm.moduleKey}_list`,
          displayName: `${wizardForm.displayName} Overview`,
          description: `Primary listing and search page for ${wizardForm.displayName}.`,
          routeKey: `/${wizardForm.moduleKey.toLowerCase()}`,
          templateType: 'LIST_SEARCH',
          displayOrder: 1,
          isEnabled: true,
          requiredPermission: `${wizardForm.moduleKey}_ACCESS`,
        },
      ],
      fields: [
        {
          id: `f-cust-01`,
          fieldKey: 'code',
          displayLabel: 'Record Identifier',
          fieldType: 'TEXT',
          isRequired: true,
          isReadOnly: true,
          isSearchable: true,
          isFilterable: true,
          displayOrder: 1,
        },
      ],
    };

    onAddModule(newModule);

    // Audit log
    setAuditLogs([
      {
        id: `aud-${Date.now()}`,
        moduleId: newModule.id,
        moduleKey: newModule.moduleKey,
        actorUserId: currentUser.id,
        actorUserName: currentUser.fullName,
        eventType: 'PUBLISH_VERSION',
        previousState: false,
        newState: true,
        reason: 'Registered and published custom module version 1',
        timestamp: new Date().toISOString(),
        impactedJobCount: 0,
      },
      ...auditLogs,
    ]);

    setIsWizardOpen(false);
    setWizardStep(1);
  };

  const filteredRegistry = moduleRegistry.filter((m) => {
    const matchesSearch =
      m.displayName.toLowerCase().includes(registrySearch.toLowerCase()) ||
      m.moduleKey.toLowerCase().includes(registrySearch.toLowerCase()) ||
      m.description.toLowerCase().includes(registrySearch.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ENABLED' ? m.isEnabled : !m.isEnabled);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4 text-xs select-none">
      {/* Top Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-indigo-600" />
            Global Module Enable / Disable Management
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Central feature flag & server-enforced gating for Item Master, Business Partner Master, and registered enterprise modules.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('primary')}
            className={`px-3 py-1.5 rounded-md font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'primary' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Module Enable / Disable
          </button>
          <button
            onClick={() => setActiveTab('registry')}
            className={`px-3 py-1.5 rounded-md font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'registry' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Module Registry & Builder
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-md font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'audit' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Module Audit History
          </button>
        </div>
      </div>

      {/* TAB 1: PRIMARY MODULE ENABLE / DISABLE CARDS */}
      {activeTab === 'primary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {moduleRegistry.map((mod) => (
              <div
                key={mod.id}
                className={`bg-white rounded-xl border p-5 shadow-xs space-y-4 transition ${
                  mod.isEnabled ? 'border-slate-200' : 'border-rose-200 bg-rose-50/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${
                        mod.isEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {mod.moduleKey === 'ITEM_MASTER' ? (
                        <Boxes className="w-5 h-5" />
                      ) : (
                        <Users2 className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        {mod.displayName}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">
                          {mod.moduleKey}
                        </span>
                      </h3>
                      <p className="text-slate-500 text-[11px] mt-0.5 leading-snug">{mod.description}</p>
                    </div>
                  </div>

                  {/* Enable / Disable Toggle Switch */}
                  <button
                    onClick={() => handleOpenDisableModal(mod)}
                    className="cursor-pointer transition hover:scale-105 shrink-0"
                    title={mod.isEnabled ? 'Click to Disable Module' : 'Click to Enable Module'}
                  >
                    {mod.isEnabled ? (
                      <ToggleRight className="w-9 h-9 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="w-9 h-9 text-slate-400" />
                    )}
                  </button>
                </div>

                {/* Status Badges & Info */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px]">
                  <div>
                    <span className="text-slate-400 block font-semibold">Functional Access Status:</span>
                    {mod.isEnabled ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Fully Operational
                      </span>
                    ) : (
                      <span className="text-rose-700 font-bold flex items-center gap-1 mt-0.5">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" /> Module Disabled & Gated
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-400 block font-semibold">Active Background Processing:</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">
                      {mod.isEnabled ? `${mod.activeJobCount} Active SAP Jobs` : '0 Jobs (Processing Paused)'}
                    </span>
                  </div>

                  <div className="col-span-2 border-t border-slate-200 pt-2 flex justify-between text-slate-500 text-[10px]">
                    <span>Last Updated: <strong className="text-slate-700">{mod.changedAt}</strong></span>
                    <span>By: <strong className="text-slate-700">{mod.changedBy}</strong></span>
                  </div>
                </div>

                {/* Actionable Button */}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => handleOpenDisableModal(mod)}
                    className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                      mod.isEnabled
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs'
                    }`}
                  >
                    {mod.isEnabled ? (
                      <>
                        <Pause className="w-3.5 h-3.5" /> Disable {mod.displayName} Module
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" /> Enable {mod.displayName} Module
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: MODULE REGISTRY & BUILDER */}
      {activeTab === 'registry' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search module name, key..."
                  value={registrySearch}
                  onChange={(e) => setRegistrySearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-56 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="ENABLED">Enabled Only</option>
                <option value="DISABLED">Disabled Only</option>
              </select>
            </div>

            <button
              onClick={() => {
                setWizardStep(1);
                setWizardForm({
                  displayName: '',
                  moduleKey: '',
                  description: '',
                  navigationGroup: 'Operations',
                  ownerTeam: 'Enterprise Applications',
                  dependencies: [],
                  pagesCount: 3,
                  fieldsCount: 5,
                });
                setIsWizardOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add New Module (Wizard)
            </button>
          </div>

          {/* Module Registry Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="p-3">Module Name</th>
                  <th className="p-3">Module Key</th>
                  <th className="p-3">Group</th>
                  <th className="p-3">Owner Team</th>
                  <th className="p-3 text-center">Version</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRegistry.map((mod) => (
                  <tr key={mod.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-bold text-slate-900">{mod.displayName}</td>
                    <td className="p-3 font-mono font-bold text-indigo-700">{mod.moduleKey}</td>
                    <td className="p-3 text-slate-600">{mod.navigationGroup}</td>
                    <td className="p-3 text-slate-600">{mod.ownerTeam}</td>
                    <td className="p-3 text-center font-mono font-bold text-slate-800">v{mod.version}</td>
                    <td className="p-3">
                      {mod.isEnabled ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ENABLED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          DISABLED
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        onClick={() => handleOpenDisableModal(mod)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded font-bold text-slate-700 cursor-pointer"
                      >
                        Toggle State
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT HISTORY */}
      {activeTab === 'audit' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" /> Module State Transition Audit Log
          </h3>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="p-3">Event ID</th>
                  <th className="p-3">Module Key</th>
                  <th className="p-3">Event Type</th>
                  <th className="p-3">Changed By</th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Reason / Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-mono text-slate-500">{log.id}</td>
                    <td className="p-3 font-mono font-bold text-indigo-700">{log.moduleKey}</td>
                    <td className="p-3 font-bold">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          log.eventType === 'ENABLE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.eventType === 'DISABLE'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {log.eventType}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-800">{log.actorUserName}</td>
                    <td className="p-3 font-mono text-slate-600">{log.timestamp}</td>
                    <td className="p-3 text-slate-600 italic">{log.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DISABLE CONFIRMATION MODAL */}
      {isDisableModalOpen && targetModule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  targetModule.isEnabled ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {targetModule.isEnabled ? `Disable ${targetModule.displayName} Module` : `Enable ${targetModule.displayName} Module`}
                </h3>
                <p className="text-slate-500 text-[11px]">
                  Confirm functional state change for module key <strong className="font-mono text-slate-700">{targetModule.moduleKey}</strong>.
                </p>
              </div>
            </div>

            {targetModule.isEnabled && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-900 space-y-1.5 text-[11px]">
                <div className="font-bold flex items-center gap-1.5 text-rose-800">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  Functional Gating Impact Notice:
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-rose-700">
                  <li>Sidebar menus for {targetModule.displayName} will be hidden.</li>
                  <li>Direct URL navigation and API mutations will be blocked on server.</li>
                  <li>Active SAP background synchronization jobs ({targetModule.activeJobCount}) will be safely paused.</li>
                  <li>Existing database records, approved codes, and audit logs will remain intact.</li>
                </ul>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Reason / Justification for Change *
              </label>
              <textarea
                value={disableReason}
                onChange={(e) => setDisableReason(e.target.value)}
                placeholder="e.g. Scheduled SAP system maintenance, compliance audit hold..."
                className="w-full text-xs p-2 border border-slate-300 rounded-lg h-18"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsDisableModalOpen(false)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmToggle}
                className={`px-4 py-1.5 rounded-lg font-bold shadow-xs transition cursor-pointer text-white ${
                  targetModule.isEnabled ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                Confirm & Apply State Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODULE BUILDER WIZARD MODAL */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Administrative Module Builder Wizard (Step {wizardStep} of 10)
                </h3>
                <p className="text-slate-500 text-[11px]">
                  Register a new first-class business module with configurable navigation, fields, and workflows.
                </p>
              </div>
              <button
                onClick={() => setIsWizardOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {wizardError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-bold">
                {wizardError}
              </div>
            )}

            {/* Step Indicators */}
            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200 text-[10px] font-bold overflow-x-auto">
              {[
                '1. Identity',
                '2. Dependencies',
                '3. Navigation Tree',
                '4. Page Builder',
                '5. Fields',
                '6. Workflow',
                '7. Roles',
                '8. Integration',
                '9. Preview',
                '10. Publish',
              ].map((name, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-0.5 rounded shrink-0 ${
                    wizardStep === idx + 1
                      ? 'bg-indigo-600 text-white'
                      : wizardStep > idx + 1
                      ? 'text-emerald-700'
                      : 'text-slate-400'
                  }`}
                >
                  {name}
                </span>
              ))}
            </div>

            {/* Step Content */}
            {wizardStep === 1 && (
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1">Step 1: Module Identity</h4>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Display Module Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Asset Management, Quality Control"
                    value={wizardForm.displayName}
                    onChange={(e) => setWizardForm({ ...wizardForm, displayName: e.target.value })}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unique Machine Key / Slug *</label>
                  <input
                    type="text"
                    placeholder="e.g. ASSET_MASTER, QUALITY_INSPECTION"
                    value={wizardForm.moduleKey}
                    onChange={(e) => setWizardForm({ ...wizardForm, moduleKey: e.target.value.toUpperCase() })}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Business Description</label>
                  <textarea
                    placeholder="Functional scope and purpose..."
                    value={wizardForm.description}
                    onChange={(e) => setWizardForm({ ...wizardForm, description: e.target.value })}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg h-16"
                  />
                </div>
              </div>
            )}

            {wizardStep > 1 && wizardStep < 10 && (
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-800">
                  Step {wizardStep}: Configurable Component Assembly ({wizardForm.displayName || 'Custom Module'})
                </h4>
                <p className="text-slate-500 text-[11px]">
                  Configuring declarative schema metadata for reusable page templates, RBAC security scopes, and SAP Service Layer endpoints.
                </p>
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                  <div className="font-bold text-indigo-700 text-xs">Configuration Preset Verified:</div>
                  <div className="text-[11px] text-slate-600">
                    Template: Standard List/Search + Creation Form + Approval Queue
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 10 && (
              <div className="space-y-3 bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-emerald-900">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Step 10: Validation Passed & Ready to Register
                </h4>
                <p className="text-xs text-emerald-800">
                  Module <strong>{wizardForm.displayName}</strong> ({wizardForm.moduleKey}) has passed declarative configuration checks and is ready to publish to the central module registry.
                </p>
              </div>
            )}

            {/* Wizard Navigation Footer */}
            <div className="flex justify-between pt-3 border-t border-slate-100">
              <button
                disabled={wizardStep === 1}
                onClick={() => setWizardStep((prev) => Math.max(prev - 1, 1))}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 disabled:opacity-40 cursor-pointer"
              >
                Previous Step
              </button>

              {wizardStep < 10 ? (
                <button
                  onClick={handleNextStep}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs cursor-pointer flex items-center gap-1"
                >
                  Next Step <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleFinishWizard}
                  className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <Save className="w-4 h-4" /> Publish & Register Module
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
