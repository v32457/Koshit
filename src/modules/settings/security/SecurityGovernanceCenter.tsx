/**
 * KOSH INNOVATIONS — ZERO-TRUST SECURITY GOVERNANCE CONTROL CENTER
 * Comprehensive enterprise governance console for Visual Data Protection, Browser Governance,
 * Forensic Watermarking, Clipboard/Screen Deterrence, Local AI Webcam Monitoring, Exceptions,
 * Incidents, Policy Simulation, Verified Registry, Audit History, and System Health.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Camera,
  Check,
  ClipboardCheck,
  Cpu,
  Eye,
  FileWarning,
  Globe,
  History,
  Layers,
  Lock,
  Play,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  UserCheck,
} from 'lucide-react';
import type { Branch, Company, ModuleRegistryItem, User } from '../../../types';
import type {
  OptionalScopeSettings,
  PolicyExceptionRecord,
  ScopedSecurityPolicyConfig,
  SecurityDashboardSnapshot,
  SecurityEventRecord,
  SecurityIncidentRecord,
  SecurityPolicyVersionSnapshot,
  SessionProtectionState,
  SoftwareModelRegistryItem,
} from '../../../types/zeroTrustSecurity';
import {
  getOrCreateClientSessionId,
  SecurityAuditHistoryEntry,
  zeroTrustSecurityService,
} from '../../../services/zeroTrustSecurityService';
import { DEFAULT_SECURITY_PARAMETERS } from '../../../services/zeroTrustPolicyEvaluator';
import { evaluateBrowserCompliance } from '../../../services/browserGovernanceService';
import { sharedWebcamAiEngine } from '../../../services/webcamAiDetectionEngine';
import { SecurityPolicyScopeEditor } from './SecurityPolicyScopeEditor';
import {
  EventsAndIncidentsPanel,
  ExceptionsPanel,
  PolicySimulatorPanel,
  RegistryAndHealthPanels,
  SessionsPanel,
} from './SecurityOperationsPanels';

export type SecurityGovernanceSectionId =
  | 'dashboard'
  | 'global'
  | 'company'
  | 'branch'
  | 'module'
  | 'page'
  | 'user'
  | 'browser'
  | 'visual'
  | 'webcam'
  | 'clipboard'
  | 'session'
  | 'exceptions'
  | 'events'
  | 'incidents'
  | 'registry'
  | 'simulator'
  | 'audit'
  | 'health';

const NAV_ITEMS: Array<{
  id: SecurityGovernanceSectionId;
  label: string;
  group: 'GOVERNANCE' | 'PROTECTION' | 'OPERATIONS';
}> = [
  { id: 'dashboard', label: 'Security Dashboard', group: 'GOVERNANCE' },
  { id: 'global', label: 'Global Baseline Policy', group: 'GOVERNANCE' },
  { id: 'company', label: 'Company Config', group: 'GOVERNANCE' },
  { id: 'branch', label: 'Branch Config', group: 'GOVERNANCE' },
  { id: 'module', label: 'Module Config', group: 'GOVERNANCE' },
  { id: 'page', label: 'Optional Page Config', group: 'GOVERNANCE' },
  { id: 'user', label: 'Optional User Config', group: 'GOVERNANCE' },
  { id: 'browser', label: 'Browser Governance', group: 'PROTECTION' },
  { id: 'visual', label: 'Visual & Watermark', group: 'PROTECTION' },
  { id: 'webcam', label: 'Webcam & AI Detection', group: 'PROTECTION' },
  { id: 'clipboard', label: 'Clipboard & Export', group: 'PROTECTION' },
  { id: 'session', label: 'Session & Blackout', group: 'PROTECTION' },
  { id: 'exceptions', label: 'Exceptions & Approvals', group: 'OPERATIONS' },
  { id: 'events', label: 'Event Monitor', group: 'OPERATIONS' },
  { id: 'incidents', label: 'Incident Management', group: 'OPERATIONS' },
  { id: 'simulator', label: 'Policy Simulator', group: 'OPERATIONS' },
  { id: 'registry', label: 'Software & Model Registry', group: 'OPERATIONS' },
  { id: 'audit', label: 'Security Audit History', group: 'OPERATIONS' },
  { id: 'health', label: 'System Health', group: 'OPERATIONS' },
];

const PREDEFINED_PAGE_KEYS = [
  { key: 'pr_master_list', label: 'Purchase Requisition List (PR)' },
  { key: 'item_master_list', label: 'Global Item Master List' },
  { key: 'item_create', label: 'Create Item Workspace' },
  { key: 'bp_master_list', label: 'Business Partner Master' },
  { key: 'security_governance_center', label: 'Security Governance Center' },
];

interface SecurityGovernanceCenterProps {
  currentUser: User;
  companies: Company[];
  branches: Branch[];
  users: User[];
  modules: ModuleRegistryItem[];
  initialSection?: SecurityGovernanceSectionId;
}

export const SecurityGovernanceCenter: React.FC<SecurityGovernanceCenterProps> = ({
  currentUser,
  companies,
  branches,
  users,
  modules,
  initialSection = 'dashboard',
}) => {
  const [sessionId] = useState<string>(() => getOrCreateClientSessionId());
  const [activeSection, setActiveSection] = useState<SecurityGovernanceSectionId>(initialSection);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [dashboard, setDashboard] = useState<SecurityDashboardSnapshot | null>(null);
  const [optionalScopes, setOptionalScopes] = useState<OptionalScopeSettings>({
    pageLevelEnabled: false,
    userLevelEnabled: false,
    updatedAt: '',
    updatedBy: 'System',
    reason: '',
  });
  const [globalPolicy, setGlobalPolicy] = useState<ScopedSecurityPolicyConfig | undefined>();
  const [companyPolicies, setCompanyPolicies] = useState<ScopedSecurityPolicyConfig[]>([]);
  const [branchPolicies, setBranchPolicies] = useState<ScopedSecurityPolicyConfig[]>([]);
  const [modulePolicies, setModulePolicies] = useState<ScopedSecurityPolicyConfig[]>([]);
  const [pagePolicies, setPagePolicies] = useState<ScopedSecurityPolicyConfig[]>([]);
  const [userPolicies, setUserPolicies] = useState<ScopedSecurityPolicyConfig[]>([]);
  const [policyVersions, setPolicyVersions] = useState<SecurityPolicyVersionSnapshot[]>([]);
  const [exceptions, setExceptions] = useState<PolicyExceptionRecord[]>([]);
  const [sessions, setSessions] = useState<SessionProtectionState[]>([]);
  const [browserLogs, setBrowserLogs] = useState<any[]>([]);
  const [events, setEvents] = useState<SecurityEventRecord[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncidentRecord[]>([]);
  const [registry, setRegistry] = useState<SoftwareModelRegistryItem[]>([]);
  const [auditHistory, setAuditHistory] = useState<SecurityAuditHistoryEntry[]>([]);
  const [health, setHealth] = useState<any>(null);

  // Scope selectors
  const [selectedCompanyId, setSelectedCompanyId] = useState(companies[0]?.id || 'co-kosh-01');
  const filteredBranches = useMemo(
    () => branches.filter((b) => (b.companyId || 'co-kosh-01') === selectedCompanyId),
    [branches, selectedCompanyId]
  );
  const [selectedBranchId, setSelectedBranchId] = useState(filteredBranches[0]?.id || 'br-pond-01');
  const [selectedModuleKey, setSelectedModuleKey] = useState(
    modules[0]?.moduleKey || 'PURCHASE_REQUISITION'
  );
  const [selectedPageKey, setSelectedPageKey] = useState('pr_master_list');
  const [selectedTargetUserId, setSelectedTargetUserId] = useState(
    users.find((u) => u.id !== currentUser.id)?.id || users[0]?.id || currentUser.id
  );

  // Focused parameter editor drafts (synchronized with Global Policy)
  const [paramCompanyScope, setParamCompanyScope] = useState<'GLOBAL' | string>('GLOBAL');
  const targetParamPolicy = useMemo(() => {
    if (paramCompanyScope === 'GLOBAL') return globalPolicy;
    return companyPolicies.find((p) => p.scopeRefId === paramCompanyScope);
  }, [paramCompanyScope, globalPolicy, companyPolicies]);

  const [browserDraft, setBrowserDraft] = useState(DEFAULT_SECURITY_PARAMETERS.browserGovernance);
  const [visualDraft, setVisualDraft] = useState(DEFAULT_SECURITY_PARAMETERS.visual);
  const [watermarkDraft, setWatermarkDraft] = useState(DEFAULT_SECURITY_PARAMETERS.watermark);
  const [blackoutDraft, setBlackoutDraft] = useState(DEFAULT_SECURITY_PARAMETERS.blackout);
  const [webcamDraft, setWebcamDraft] = useState(DEFAULT_SECURITY_PARAMETERS.webcamAi);
  const [clipboardDraft, setClipboardDraft] = useState(DEFAULT_SECURITY_PARAMETERS.clipboard);
  const [exportDraft, setExportDraft] = useState(DEFAULT_SECURITY_PARAMETERS.exportControl);
  const [paramChangeReason, setParamChangeReason] = useState('');
  const [savingParams, setSavingParams] = useState(false);

  // Local AI model warm-up verification state
  const [aiVerifyResult, setAiVerifyResult] = useState<{
    status: 'idle' | 'running' | 'ok' | 'err';
    detail?: string;
  }>({ status: 'idle' });

  useEffect(() => {
    if (
      filteredBranches.length > 0 &&
      !filteredBranches.some((b) => b.id === selectedBranchId)
    ) {
      setSelectedBranchId(filteredBranches[0].id);
    }
  }, [filteredBranches, selectedBranchId]);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await zeroTrustSecurityService
        .syncCatalog({ users, companies, branches, modules })
        .catch(() => {});

      const [dash, hier, excs, sess, bLogs, evs, incs, reg, aud, hlth] = await Promise.all([
        zeroTrustSecurityService.getDashboard(),
        zeroTrustSecurityService.getHierarchy(),
        zeroTrustSecurityService.listExceptions(),
        zeroTrustSecurityService.listSessions(),
        zeroTrustSecurityService.listBrowserCompliance(),
        zeroTrustSecurityService.listEvents(),
        zeroTrustSecurityService.listIncidents(),
        zeroTrustSecurityService.listRegistry(),
        zeroTrustSecurityService.listAuditHistory(),
        zeroTrustSecurityService.getSystemHealth(),
      ]);

      setDashboard(dash);
      setOptionalScopes(hier.optionalScopes);
      setGlobalPolicy(hier.globalPolicy);
      setCompanyPolicies(hier.companyPolicies);
      setBranchPolicies(hier.branchPolicies);
      setModulePolicies(hier.modulePolicies);
      setPagePolicies(hier.pagePolicies);
      setUserPolicies(hier.userPolicies);
      setPolicyVersions(hier.policyVersions);
      setExceptions(excs);
      setSessions(sess);
      setBrowserLogs(bLogs);
      setEvents(evs);
      setIncidents(incs);
      setRegistry(reg);
      setAuditHistory(aud);
      setHealth(hlth);
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load Security Governance state from backend.');
    } finally {
      setLoading(false);
    }
  }, [users, companies, branches, modules]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const p = targetParamPolicy?.parameters || globalPolicy?.parameters;
    if (!p) return;
    setBrowserDraft(p.browserGovernance || DEFAULT_SECURITY_PARAMETERS.browserGovernance);
    setVisualDraft(p.visual || DEFAULT_SECURITY_PARAMETERS.visual);
    setWatermarkDraft(p.watermark || DEFAULT_SECURITY_PARAMETERS.watermark);
    setBlackoutDraft(p.blackout || DEFAULT_SECURITY_PARAMETERS.blackout);
    setWebcamDraft(p.webcamAi || DEFAULT_SECURITY_PARAMETERS.webcamAi);
    setClipboardDraft(p.clipboard || DEFAULT_SECURITY_PARAMETERS.clipboard);
    setExportDraft(p.exportControl || DEFAULT_SECURITY_PARAMETERS.exportControl);
  }, [targetParamPolicy, globalPolicy]);

  const handleToggleOptionalScope = async (
    target: 'PAGE' | 'USER',
    nextValue: boolean
  ) => {
    setActionNotice(null);
    try {
      const updated = await zeroTrustSecurityService.updateOptionalScopes(currentUser, sessionId, {
        ...(target === 'PAGE' ? { pageLevelEnabled: nextValue } : { userLevelEnabled: nextValue }),
        reason: `Governance administrator toggled Optional ${target} Security Scope to ${
          nextValue ? 'ENABLED' : 'DISABLED'
        }`,
      });
      setOptionalScopes(updated);
      window.dispatchEvent(new CustomEvent('kosh:zt-policy-updated'));
      setActionNotice({
        type: 'ok',
        text: `Optional ${target === 'PAGE' ? 'Page / Screen' : 'Individual User'} policy scope is now ${
          nextValue ? 'ENABLED' : 'DISABLED'
        }. Effective runtime policies updated cleanly.`,
      });
      await refreshAll();
    } catch (err: any) {
      setActionNotice({
        type: 'err',
        text: err?.message || 'Failed to update optional scope configuration.',
      });
    }
  };

  const handleSaveParameterSection = async (sectionLabel: string, parametersPayload: any) => {
    setActionNotice(null);
    if (paramChangeReason.trim().length < 3) {
      setActionNotice({
        type: 'err',
        text: 'Enter a mandatory governance audit reason (minimum 3 characters) before publishing parameter updates.',
      });
      return;
    }
    setSavingParams(true);
    try {
      const isGlobal = paramCompanyScope === 'GLOBAL';
      const co = companies.find((c) => c.id === paramCompanyScope);
      await zeroTrustSecurityService.upsertScopedPolicy(currentUser, sessionId, {
        scopeLevel: isGlobal ? 'GLOBAL' : 'COMPANY',
        scopeRefId: isGlobal ? 'GLOBAL' : paramCompanyScope,
        scopeLabel: isGlobal ? 'Global Enterprise Baseline' : co?.name || paramCompanyScope,
        ...(isGlobal ? {} : { companyId: paramCompanyScope }),
        parameters: parametersPayload,
        changeReason: `[${sectionLabel}] ${paramChangeReason.trim()}`,
        triggersRevalidation: true,
      });
      setParamChangeReason('');
      window.dispatchEvent(new CustomEvent('kosh:zt-policy-updated'));
      setActionNotice({
        type: 'ok',
        text: `${sectionLabel} parameters published to ${isGlobal ? 'Global Baseline' : co?.name || paramCompanyScope}. Active sessions revalidated.`,
      });
      await refreshAll();
    } catch (err: any) {
      setActionNotice({
        type: 'err',
        text: err?.message || `Failed to publish ${sectionLabel} parameters.`,
      });
    } finally {
      setSavingParams(false);
    }
  };

  const handleVerifyLocalAiModel = async () => {
    setAiVerifyResult({ status: 'running', detail: 'Loading local COCO-SSD model and WASM/WebGL backend...' });
    try {
      const init = await sharedWebcamAiEngine.initializeRuntime(webcamDraft.preferredBackend);
      setAiVerifyResult({
        status: init.modelLoaded ? 'ok' : 'err',
        detail: init.modelLoaded
          ? `Local TensorFlow.js COCO-SSD model loaded from /models/coco-ssd/model.json using [${init.backend}] backend. Ready for in-memory inference (zero frame upload).`
          : 'Runtime initialized but model was not marked loaded.',
      });
    } catch (err: any) {
      setAiVerifyResult({
        status: 'err',
        detail: err?.message || 'Failed to load local AI model weights.',
      });
    }
  };

  const liveBrowserProbe = useMemo(
    () => evaluateBrowserCompliance(browserDraft, true),
    [browserDraft]
  );

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const selectedBranch = branches.find((b) => b.id === selectedBranchId);
  const selectedModule = modules.find((m) => m.moduleKey === selectedModuleKey);
  const selectedTargetUser = users.find((u) => u.id === selectedTargetUserId);

  return (
    <div className="space-y-3" data-testid="security-governance-center">
      {/* Control Center Header + Optional Scope Controls */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-700 shrink-0" />
              <h2 className="text-sm font-bold tracking-tight text-slate-900">
                Zero-Trust Visual Data Protection &amp; Leakage Prevention Governance
              </h2>
            </div>
            <p className="text-xs text-slate-500 tabular-nums">
              Global → Company → Branch → Module → Optional Page/Screen → Optional User
              {dashboard ? ` · Policy v${dashboard.policyVersion} · Cache v${dashboard.cacheVersion}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh State</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('simulator')}
              className="px-3.5 py-1.5 bg-[#0B192C] hover:bg-slate-800 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Open Policy Simulator</span>
            </button>
          </div>
        </div>

        {/* Independent Optional Scope Master Switches */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-600">
            <span className="font-bold text-slate-800 mr-1.5">Optional Policy Scopes:</span>
            <span>Enable granular Page/Screen or Individual User overrides only when required.</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="toggle-optional-page-scope"
              onClick={() => void handleToggleOptionalScope('PAGE', !optionalScopes.pageLevelEnabled)}
              className={`px-3 py-1.5 rounded-lg border font-bold cursor-pointer whitespace-nowrap ${
                optionalScopes.pageLevelEnabled
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Optional Page/Screen Scope: {optionalScopes.pageLevelEnabled ? 'ENABLED' : 'DISABLED'}
            </button>
            <button
              type="button"
              data-testid="toggle-optional-user-scope"
              onClick={() => void handleToggleOptionalScope('USER', !optionalScopes.userLevelEnabled)}
              className={`px-3 py-1.5 rounded-lg border font-bold cursor-pointer whitespace-nowrap ${
                optionalScopes.userLevelEnabled
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Optional User Scope: {optionalScopes.userLevelEnabled ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 font-semibold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {actionNotice && (
        <div
          data-testid="security-governance-notice"
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            actionNotice.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {actionNotice.type === 'ok' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{actionNotice.text}</span>
        </div>
      )}

      {/* Workspace Grid: Section Navigation + Active Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Section Rail */}
        <nav
          aria-label="Security Governance Sections"
          className="lg:col-span-3 lg:sticky lg:top-4 bg-white rounded-xl border border-slate-200 p-2 space-y-2 text-xs"
        >
          {(['GOVERNANCE', 'PROTECTION', 'OPERATIONS'] as const).map((group) => (
            <div key={group} className="space-y-0.5">
              <div className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-slate-400">
                {group === 'GOVERNANCE'
                  ? 'Policy Hierarchy'
                  : group === 'PROTECTION'
                  ? 'Protection Runtimes'
                  : 'Monitoring & Operations'}
              </div>
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                const isActive = activeSection === item.id;
                const optOff =
                  (item.id === 'page' && !optionalScopes.pageLevelEnabled) ||
                  (item.id === 'user' && !optionalScopes.userLevelEnabled);
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`sec-nav-${item.id}`}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg font-medium flex items-center justify-between gap-2 cursor-pointer ${
                      isActive
                        ? 'bg-[#0B192C] text-white font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    {optOff && (
                      <span className={`text-[10px] font-mono ${isActive ? 'text-amber-300' : 'text-slate-400'}`}>
                        OFF
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Main Content Viewport */}
        <div className="lg:col-span-9 min-w-0 space-y-4">
          {activeSection === 'dashboard' && dashboard && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
                <div className="bg-white rounded-xl border border-slate-200 p-3.5">
                  <div className="text-slate-500 font-semibold">Active Policies</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{dashboard.counts.activePolicies}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {dashboard.counts.companiesConfigured} co · {dashboard.counts.branchesConfigured} br · {dashboard.counts.modulesCovered} mod
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-3.5">
                  <div className="text-slate-500 font-semibold">Protected Sessions</div>
                  <div className="text-xl font-bold text-emerald-700 mt-1">
                    {dashboard.counts.activeProtectedSessions}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Blackout: {dashboard.counts.blackoutLockedSessions} · Susp: {dashboard.counts.suspendedSessions}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-3.5">
                  <div className="text-slate-500 font-semibold">Security Events &amp; Incidents</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{dashboard.counts.totalEvents}</div>
                  <div className="text-[11px] text-rose-700 font-semibold mt-0.5">
                    {dashboard.counts.openIncidents} open incident(s) · {dashboard.counts.criticalEvents} critical
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-3.5">
                  <div className="text-slate-500 font-semibold">Exceptions &amp; Verified AI</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{dashboard.counts.activeExceptions}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {dashboard.counts.pendingExceptions} pending · {dashboard.dependencyHealth.verifiedCount}/
                    {dashboard.dependencyHealth.totalComponents} deps ready
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Enterprise Control Coverage &amp; Quick Navigation</h3>
                    <p className="text-slate-500">
                      Every mandatory and optional security layer connects directly to authoritative server policies.
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    Status: {dashboard.systemStatus}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveSection('global')}
                    className="p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 text-left space-y-1 cursor-pointer"
                  >
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>Global / Company / Branch / Module</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Configure baseline rules, parent MANDATORY locks, and branch overrides.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection('webcam')}
                    className="p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 text-left space-y-1 cursor-pointer"
                  >
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-indigo-600" />
                      <span>Local AI Camera Readiness</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {dashboard.webcamHealth.modelInstalled
                        ? `Model ${dashboard.webcamHealth.modelVersion} verified locally`
                        : 'Local model artifact check needed'}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection('exceptions')}
                    className="p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 text-left space-y-1 cursor-pointer"
                  >
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-indigo-600" />
                      <span>Maker-Checker Exceptions</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {dashboard.counts.pendingExceptions} pending request(s) · {dashboard.counts.activeExceptions} active time-bound override(s)
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'global' && (
            <SecurityPolicyScopeEditor
              scopeLevel="GLOBAL"
              scopeRefId="GLOBAL"
              scopeLabel="Global Enterprise Security Baseline"
              existingPolicy={globalPolicy}
              allVersions={policyVersions}
              currentUser={currentUser}
              sessionId={sessionId}
              onSaved={refreshAll}
            />
          )}

          {activeSection === 'company' && (
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-wrap items-center gap-3 text-xs">
                <label className="font-bold text-slate-700" htmlFor="sec-company-select">
                  Target Enterprise Company:
                </label>
                <select
                  id="sec-company-select"
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
              <SecurityPolicyScopeEditor
                scopeLevel="COMPANY"
                scopeRefId={selectedCompanyId}
                scopeLabel={selectedCompany ? `${selectedCompany.name} (${selectedCompany.code})` : selectedCompanyId}
                companyId={selectedCompanyId}
                existingPolicy={companyPolicies.find((p) => p.scopeRefId === selectedCompanyId)}
                allVersions={policyVersions}
                currentUser={currentUser}
                sessionId={sessionId}
                onSaved={refreshAll}
              />
            </div>
          )}

          {activeSection === 'branch' && (
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-wrap items-center gap-3 text-xs">
                <label className="font-bold text-slate-700">Company:</label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <label className="font-bold text-slate-700">Branch:</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  {filteredBranches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
              <SecurityPolicyScopeEditor
                scopeLevel="BRANCH"
                scopeRefId={selectedBranchId}
                scopeLabel={selectedBranch ? `${selectedBranch.name} (${selectedBranch.code})` : selectedBranchId}
                companyId={selectedCompanyId}
                branchId={selectedBranchId}
                existingPolicy={branchPolicies.find((p) => p.scopeRefId === selectedBranchId)}
                allVersions={policyVersions}
                currentUser={currentUser}
                sessionId={sessionId}
                onSaved={refreshAll}
              />
            </div>
          )}

          {activeSection === 'module' && (
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-wrap items-center gap-3 text-xs">
                <label className="font-bold text-slate-700">Enterprise Module:</label>
                <select
                  value={selectedModuleKey}
                  onChange={(e) => setSelectedModuleKey(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  {modules.map((m) => (
                    <option key={m.moduleKey} value={m.moduleKey}>
                      {m.displayName} ({m.moduleKey})
                    </option>
                  ))}
                </select>
              </div>
              <SecurityPolicyScopeEditor
                scopeLevel="MODULE"
                scopeRefId={selectedModuleKey}
                scopeLabel={selectedModule ? `${selectedModule.displayName} (${selectedModule.moduleKey})` : selectedModuleKey}
                moduleKey={selectedModuleKey}
                existingPolicy={modulePolicies.find((p) => p.scopeRefId === selectedModuleKey)}
                allVersions={policyVersions}
                currentUser={currentUser}
                sessionId={sessionId}
                onSaved={refreshAll}
              />
            </div>
          )}

          {activeSection === 'page' && (
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-wrap items-center gap-3 text-xs">
                <label className="font-bold text-slate-700">Page / Screen Key:</label>
                <select
                  value={PREDEFINED_PAGE_KEYS.some((p) => p.key === selectedPageKey) ? selectedPageKey : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value !== '__custom__') setSelectedPageKey(e.target.value);
                  }}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  {PREDEFINED_PAGE_KEYS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label} ({p.key})
                    </option>
                  ))}
                  <option value="__custom__">Custom Page Key</option>
                </select>
                <input
                  type="text"
                  value={selectedPageKey}
                  onChange={(e) => setSelectedPageKey(e.target.value.trim())}
                  placeholder="Custom page_key..."
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono"
                />
              </div>
              <SecurityPolicyScopeEditor
                scopeLevel="PAGE"
                scopeRefId={selectedPageKey}
                scopeLabel={`Screen Override: ${selectedPageKey}`}
                pageKey={selectedPageKey}
                existingPolicy={pagePolicies.find((p) => p.scopeRefId === selectedPageKey)}
                allVersions={policyVersions}
                currentUser={currentUser}
                sessionId={sessionId}
                optionalLevelEnabled={optionalScopes.pageLevelEnabled}
                allowDeleteOptional
                onSaved={refreshAll}
              />
            </div>
          )}

          {activeSection === 'user' && (
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-wrap items-center gap-3 text-xs">
                <label className="font-bold text-slate-700">Target Employee / User:</label>
                <select
                  value={selectedTargetUserId}
                  onChange={(e) => setSelectedTargetUserId(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.role}) {u.id === currentUser.id ? '— Current Actor (Self-Edit Blocked)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <SecurityPolicyScopeEditor
                scopeLevel="USER"
                scopeRefId={selectedTargetUserId}
                scopeLabel={
                  selectedTargetUser
                    ? `${selectedTargetUser.fullName} (${selectedTargetUser.role})`
                    : selectedTargetUserId
                }
                userId={selectedTargetUserId}
                existingPolicy={userPolicies.find((p) => p.scopeRefId === selectedTargetUserId)}
                allVersions={policyVersions}
                currentUser={currentUser}
                sessionId={sessionId}
                optionalLevelEnabled={optionalScopes.userLevelEnabled}
                allowDeleteOptional
                onSaved={refreshAll}
              />
            </div>
          )}

          {/* Focused Parameter Sections: Browser / Visual / Webcam / Clipboard */}
          {(activeSection === 'browser' ||
            activeSection === 'visual' ||
            activeSection === 'webcam' ||
            activeSection === 'clipboard') && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {activeSection === 'browser'
                      ? 'Approved Browser Governance Rules'
                      : activeSection === 'visual'
                      ? 'Visual Protection, Watermark & Blackout Parameters'
                      : activeSection === 'webcam'
                      ? 'Local Webcam AI Detection Parameters & Verification'
                      : 'Clipboard, Context Menu & Export Restrictions'}
                  </h3>
                  <p className="text-slate-500 mt-0.5">
                    Publish policy parameters to the Global Baseline or a specific Company override.
                  </p>
                </div>
                <select
                  value={paramCompanyScope}
                  onChange={(e) => setParamCompanyScope(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-slate-50 font-semibold"
                >
                  <option value="GLOBAL">Scope: Global Enterprise Baseline</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      Company Override: {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {activeSection === 'browser' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="font-bold text-slate-700 mb-1.5">Approved Families</div>
                      <label className="flex items-center gap-2 mb-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={browserDraft.approvedFamilies.includes('MICROSOFT_EDGE')}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? Array.from(new Set([...browserDraft.approvedFamilies, 'MICROSOFT_EDGE' as const]))
                              : browserDraft.approvedFamilies.filter((f) => f !== 'MICROSOFT_EDGE');
                            setBrowserDraft({ ...browserDraft, approvedFamilies: next });
                          }}
                        />
                        <span>Microsoft Edge</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={browserDraft.approvedFamilies.includes('GOOGLE_CHROME')}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? Array.from(new Set([...browserDraft.approvedFamilies, 'GOOGLE_CHROME' as const]))
                              : browserDraft.approvedFamilies.filter((f) => f !== 'GOOGLE_CHROME');
                            setBrowserDraft({ ...browserDraft, approvedFamilies: next });
                          }}
                        />
                        <span>Google Chrome</span>
                      </label>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <label className="block font-bold text-slate-700">Min Edge Major Version</label>
                      <input
                        type="number"
                        min={90}
                        max={200}
                        value={browserDraft.minimumVersions.MICROSOFT_EDGE}
                        onChange={(e) =>
                          setBrowserDraft({
                            ...browserDraft,
                            minimumVersions: {
                              ...browserDraft.minimumVersions,
                              MICROSOFT_EDGE: Number(e.target.value) || 110,
                            },
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono tabular-nums"
                      />
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <label className="block font-bold text-slate-700">Min Chrome Major Version</label>
                      <input
                        type="number"
                        min={90}
                        max={200}
                        value={browserDraft.minimumVersions.GOOGLE_CHROME}
                        onChange={(e) =>
                          setBrowserDraft({
                            ...browserDraft,
                            minimumVersions: {
                              ...browserDraft.minimumVersions,
                              GOOGLE_CHROME: Number(e.target.value) || 110,
                            },
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono tabular-nums"
                      />
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <label className="block font-bold text-slate-700">Non-Compliant Action</label>
                      <select
                        value={browserDraft.allowedAccessDecision}
                        onChange={(e) =>
                          setBrowserDraft({
                            ...browserDraft,
                            allowedAccessDecision: e.target.value as any,
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
                      >
                        <option value="WARN_ONLY">WARN_ONLY (Log + Banner)</option>
                        <option value="RESTRICT_SENSITIVE">RESTRICT_SENSITIVE</option>
                        <option value="BLACKOUT_BLOCK">BLACKOUT_BLOCK</option>
                      </select>
                      <label className="flex items-center gap-2 pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={browserDraft.requireSecureContext}
                          onChange={(e) =>
                            setBrowserDraft({ ...browserDraft, requireSecureContext: e.target.checked })
                          }
                        />
                        <span>Require Secure Context (HTTPS)</span>
                      </label>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900">
                      Current Session Probe: {liveBrowserProbe.browserDisplayName} v{liveBrowserProbe.browserVersion} —{' '}
                      <span className={liveBrowserProbe.compliant ? 'text-emerald-700' : 'text-amber-700'}>
                        {liveBrowserProbe.compliant ? 'COMPLIANT' : `NON-COMPLIANT (${liveBrowserProbe.decision})`}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">{liveBrowserProbe.technicalLimitationNote}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <input
                      type="text"
                      value={paramChangeReason}
                      onChange={(e) => setParamChangeReason(e.target.value)}
                      placeholder="Audit reason for Browser Governance update..."
                      className="flex-1 min-w-[220px] px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      disabled={savingParams}
                      onClick={() =>
                        void handleSaveParameterSection('Browser Governance', {
                          browserGovernance: browserDraft,
                        })
                      }
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer"
                    >
                      Save Browser Governance
                    </button>
                  </div>
                </div>
              )}

              {activeSection === 'visual' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <div className="font-bold text-slate-800">Focus &amp; Visibility Monitoring</div>
                      {[
                        ['monitorVisibilityChange', 'Monitor visibilitychange'],
                        ['monitorWindowBlur', 'Monitor window blur'],
                        ['monitorPageHide', 'Monitor pagehide'],
                        ['blurOnFocusLoss', 'Blur protected content on focus loss'],
                        ['lockScreenOnVisibilityHide', 'Lock screen when tab hidden'],
                        ['showConfidentialityBanner', 'Show Zero-Trust header strip'],
                      ].map(([field, label]) => (
                        <label key={field} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean((visualDraft as any)[field])}
                            onChange={(e) =>
                              setVisualDraft({ ...visualDraft, [field]: e.target.checked })
                            }
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <div className="font-bold text-slate-800">Forensic Watermark Display</div>
                      <label className="block text-[11px] font-semibold text-slate-600">Classification</label>
                      <select
                        value={watermarkDraft.confidentialityClassification}
                        onChange={(e) =>
                          setWatermarkDraft({
                            ...watermarkDraft,
                            confidentialityClassification: e.target.value as any,
                          })
                        }
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="INTERNAL">INTERNAL</option>
                        <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                        <option value="RESTRICTED">RESTRICTED</option>
                        <option value="HIGHLY_CONFIDENTIAL">HIGHLY_CONFIDENTIAL</option>
                      </select>
                      <label className="block text-[11px] font-semibold text-slate-600">Position &amp; Density</label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={watermarkDraft.position}
                          onChange={(e) =>
                            setWatermarkDraft({ ...watermarkDraft, position: e.target.value as any })
                          }
                          className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="TILED">TILED</option>
                          <option value="CENTER">CENTER</option>
                          <option value="TOP_RIGHT">TOP_RIGHT</option>
                          <option value="BOTTOM_RIGHT">BOTTOM_RIGHT</option>
                        </select>
                        <select
                          value={watermarkDraft.density}
                          onChange={(e) =>
                            setWatermarkDraft({ ...watermarkDraft, density: e.target.value as any })
                          }
                          className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="LOW">LOW</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HIGH">HIGH</option>
                        </select>
                      </div>
                      <label className="block text-[11px] font-semibold text-slate-600">
                        Blur Px ({visualDraft.blurIntensityPx}px)
                      </label>
                      <input
                        type="number"
                        min={4}
                        max={24}
                        value={visualDraft.blurIntensityPx}
                        onChange={(e) =>
                          setVisualDraft({
                            ...visualDraft,
                            blurIntensityPx: Math.min(24, Math.max(4, Number(e.target.value) || 8)),
                          })
                        }
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg tabular-nums"
                      />
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <div className="font-bold text-slate-800">Blackout Recovery Policy</div>
                      <label className="block text-[11px] font-semibold text-slate-600">
                        Default Blackout Duration (sec)
                      </label>
                      <input
                        type="number"
                        min={30}
                        max={3600}
                        value={blackoutDraft.durationSeconds}
                        onChange={(e) =>
                          setBlackoutDraft({
                            ...blackoutDraft,
                            durationSeconds: Math.max(30, Number(e.target.value) || 300),
                          })
                        }
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg tabular-nums"
                      />
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={blackoutDraft.allowReauthRecovery}
                          onChange={(e) =>
                            setBlackoutDraft({ ...blackoutDraft, allowReauthRecovery: e.target.checked })
                          }
                        />
                        <span>Allow Self Re-Authentication Unlock</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={blackoutDraft.allowAdminOverride}
                          onChange={(e) =>
                            setBlackoutDraft({ ...blackoutDraft, allowAdminOverride: e.target.checked })
                          }
                        />
                        <span>Allow Administrator Override</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <input
                      type="text"
                      value={paramChangeReason}
                      onChange={(e) => setParamChangeReason(e.target.value)}
                      placeholder="Audit reason for Visual / Watermark update..."
                      className="flex-1 min-w-[220px] px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      disabled={savingParams}
                      onClick={() =>
                        void handleSaveParameterSection('Visual & Watermark Protection', {
                          visual: visualDraft,
                          watermark: watermarkDraft,
                          blackout: blackoutDraft,
                        })
                      }
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer"
                    >
                      Save Visual &amp; Watermark Settings
                    </button>
                  </div>
                </div>
              )}

              {activeSection === 'webcam' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <label className="block font-bold text-slate-700 mb-1">Confidence Threshold</label>
                      <input
                        type="number"
                        step={0.05}
                        min={0.35}
                        max={0.95}
                        value={webcamDraft.confidenceThreshold}
                        onChange={(e) =>
                          setWebcamDraft({
                            ...webcamDraft,
                            confidenceThreshold: Math.min(0.95, Math.max(0.35, Number(e.target.value) || 0.62)),
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono tabular-nums"
                      />
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <label className="block font-bold text-slate-700 mb-1">Persistence Frames</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={webcamDraft.persistenceFrames}
                        onChange={(e) =>
                          setWebcamDraft({
                            ...webcamDraft,
                            persistenceFrames: Math.max(1, Number(e.target.value) || 3),
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono tabular-nums"
                      />
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <label className="block font-bold text-slate-700 mb-1">Sampling FPS (0.2–2)</label>
                      <input
                        type="number"
                        step={0.1}
                        min={0.2}
                        max={2}
                        value={webcamDraft.fps}
                        onChange={(e) =>
                          setWebcamDraft({
                            ...webcamDraft,
                            fps: Math.min(2, Math.max(0.2, Number(e.target.value) || 0.5)),
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono tabular-nums"
                      />
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <label className="block font-bold text-slate-700 mb-1">Escalation Action</label>
                      <select
                        value={webcamDraft.actionOnPersistentDetection}
                        onChange={(e) =>
                          setWebcamDraft({
                            ...webcamDraft,
                            actionOnPersistentDetection: e.target.value as any,
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
                      >
                        <option value="WARNING">WARNING</option>
                        <option value="BLUR">BLUR</option>
                        <option value="LOCK_SCREEN">LOCK_SCREEN</option>
                        <option value="SUSPEND_API">SUSPEND_API</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-900">
                        Privacy-First Local Computer Vision Runtime Verification
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        100% local in-memory inference via @tensorflow/tfjs + COCO-SSD SSDLite MobileNet v2 (`/models/coco-ssd/model.json`). Zero frame upload, zero video recording, zero facial recognition.
                      </div>
                      {aiVerifyResult.detail && (
                        <div
                          className={`mt-1.5 text-[11px] font-semibold ${
                            aiVerifyResult.status === 'ok'
                              ? 'text-emerald-700'
                              : aiVerifyResult.status === 'err'
                              ? 'text-rose-700'
                              : 'text-indigo-700'
                          }`}
                        >
                          {aiVerifyResult.detail}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleVerifyLocalAiModel()}
                      disabled={aiVerifyResult.status === 'running'}
                      className="px-3.5 py-2 bg-[#0B192C] hover:bg-slate-800 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>
                        {aiVerifyResult.status === 'running' ? 'Loading Model...' : 'Verify Local AI Runtime'}
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <input
                      type="text"
                      value={paramChangeReason}
                      onChange={(e) => setParamChangeReason(e.target.value)}
                      placeholder="Audit reason for Webcam AI configuration..."
                      className="flex-1 min-w-[220px] px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      disabled={savingParams}
                      onClick={() =>
                        void handleSaveParameterSection('Webcam & AI Detection', {
                          webcamAi: webcamDraft,
                        })
                      }
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer"
                    >
                      Save Webcam AI Parameters
                    </button>
                  </div>
                </div>
              )}

              {activeSection === 'clipboard' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <div className="font-bold text-slate-800">Clipboard &amp; Print Deterrence</div>
                      {[
                        ['blockCopy', 'Block copy on protected workspace content'],
                        ['blockCut', 'Block cut on protected workspace content'],
                        ['blockPaste', 'Block paste on protected screens'],
                        ['blockContextMenu', 'Restrict right-click context menu'],
                        ['blockSensitiveFieldCopy', 'Always block copying [data-sensitive-field] values'],
                        ['blockPrintShortcut', 'Restrict Ctrl/Cmd+P print shortcut'],
                        ['blockTextSelection', 'Disable text selection on protected workspace'],
                      ].map(([field, label]) => (
                        <label key={field} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean((clipboardDraft as any)[field])}
                            onChange={(e) =>
                              setClipboardDraft({ ...clipboardDraft, [field]: e.target.checked })
                            }
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <div className="font-bold text-slate-800">Authoritative Export Restrictions</div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportDraft.requireAuthorizedPermission}
                          onChange={(e) =>
                            setExportDraft({ ...exportDraft, requireAuthorizedPermission: e.target.checked })
                          }
                        />
                        <span>Require SECURITY_EXPORT_APPROVE RBAC right</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportDraft.blockUnauthorizedExport}
                          onChange={(e) =>
                            setExportDraft({ ...exportDraft, blockUnauthorizedExport: e.target.checked })
                          }
                        />
                        <span>Deny unauthorized export requests at API boundary</span>
                      </label>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Max Export Rows Without Secondary Approval
                        </label>
                        <input
                          type="number"
                          min={50}
                          max={50000}
                          value={exportDraft.maxRowsWithoutSecondaryApproval}
                          onChange={(e) =>
                            setExportDraft({
                              ...exportDraft,
                              maxRowsWithoutSecondaryApproval: Math.max(50, Number(e.target.value) || 1000),
                            })
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg tabular-nums"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <input
                      type="text"
                      value={paramChangeReason}
                      onChange={(e) => setParamChangeReason(e.target.value)}
                      placeholder="Audit reason for Clipboard / Export protection..."
                      className="flex-1 min-w-[220px] px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      disabled={savingParams}
                      onClick={() =>
                        void handleSaveParameterSection('Clipboard & Export Controls', {
                          clipboard: clipboardDraft,
                          exportControl: exportDraft,
                        })
                      }
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer"
                    >
                      Save Clipboard &amp; Export Controls
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'session' && (
            <SessionsPanel
              currentUser={currentUser}
              sessionId={sessionId}
              sessions={sessions}
              browserLogs={browserLogs}
              onRefresh={refreshAll}
            />
          )}

          {activeSection === 'exceptions' && (
            <ExceptionsPanel
              currentUser={currentUser}
              sessionId={sessionId}
              companies={companies}
              exceptions={exceptions}
              onRefresh={refreshAll}
            />
          )}

          {activeSection === 'events' && (
            <EventsAndIncidentsPanel
              mode="EVENTS"
              currentUser={currentUser}
              sessionId={sessionId}
              events={events}
              incidents={incidents}
              users={users}
              onRefresh={refreshAll}
            />
          )}

          {activeSection === 'incidents' && (
            <EventsAndIncidentsPanel
              mode="INCIDENTS"
              currentUser={currentUser}
              sessionId={sessionId}
              events={events}
              incidents={incidents}
              users={users}
              onRefresh={refreshAll}
            />
          )}

          {activeSection === 'simulator' && (
            <PolicySimulatorPanel
              currentUser={currentUser}
              sessionId={sessionId}
              users={users}
              companies={companies}
              branches={branches}
              modules={modules}
            />
          )}

          {activeSection === 'registry' && (
            <RegistryAndHealthPanels
              mode="REGISTRY"
              registry={registry}
              auditHistory={auditHistory}
              health={health}
            />
          )}

          {activeSection === 'audit' && (
            <RegistryAndHealthPanels
              mode="AUDIT"
              registry={registry}
              auditHistory={auditHistory}
              health={health}
            />
          )}

          {activeSection === 'health' && (
            <RegistryAndHealthPanels
              mode="HEALTH"
              registry={registry}
              auditHistory={auditHistory}
              health={health}
            />
          )}
        </div>
      </div>
    </div>
  );
};
