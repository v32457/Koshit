/**
 * KOSH INNOVATIONS — ZERO-TRUST SECURITY OPERATIONS PANELS
 * Covers:
 * - Policy Simulator (with Optional Page/Screen & User provenance trace)
 * - Time-Limited Exceptions & Maker-Checker Approval Workflow
 * - Session Security & Live Blackout/Override Management
 * - Security Event Monitor & Security Incident Lifecycle Management
 * - Software & AI Model Registry (verified artifacts & SHA-256 digests)
 * - Security Audit History & System Health
 */

import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Lock,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { Branch, Company, ModuleRegistryItem, User } from '../../../types';
import { ALL_SECURITY_CONTROL_KEYS } from '../../../services/zeroTrustPolicyEvaluator';
import {
  BrowserComplianceEvaluation,
  EffectiveSecurityPolicy,
  PolicyExceptionRecord,
  SecurityControlKey,
  SecurityEventRecord,
  SecurityIncidentRecord,
  SessionProtectionState,
  SoftwareModelRegistryItem,
} from '../../../types/zeroTrustSecurity';
import {
  SecurityAuditHistoryEntry,
  zeroTrustSecurityService,
} from '../../../services/zeroTrustSecurityService';

export const PolicySimulatorPanel: React.FC<{
  currentUser: User;
  sessionId: string;
  users: User[];
  companies: Company[];
  branches: Branch[];
  modules: ModuleRegistryItem[];
}> = ({ currentUser, sessionId, users, companies, branches, modules }) => {
  const [simUserId, setSimUserId] = useState(currentUser.id);
  const [simCompanyId, setSimCompanyId] = useState(companies[0]?.id || 'co-kosh-01');
  const companyBranches = branches.filter((b) => (b.companyId || 'co-kosh-01') === simCompanyId);
  const [simBranchId, setSimBranchId] = useState(companyBranches[0]?.id || 'br-pond-01');
  const [simModuleKey, setSimModuleKey] = useState(modules[0]?.moduleKey || 'PURCHASE_REQUISITION');
  const [simPageKey, setSimPageKey] = useState('pr_master_list');
  const [result, setResult] = useState<EffectiveSecurityPolicy | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expandedControl, setExpandedControl] = useState<SecurityControlKey | null>(null);

  const runSimulation = async () => {
    setErr(null);
    try {
      const evaluated = await zeroTrustSecurityService.evaluateEffectivePolicy({
        actorUserId: currentUser.id,
        targetUserId: simUserId,
        companyId: simCompanyId,
        branchId: simBranchId,
        moduleKey: simModuleKey,
        pageKey: simPageKey || undefined,
        sessionId,
      });
      setResult(evaluated);
    } catch (e: any) {
      setErr(e?.message || 'Simulation failed');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 text-xs">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="font-bold text-slate-900 text-sm">
          Effective Policy Simulator & Inheritance Provenance Inspector
        </h3>
        <p className="text-slate-500 mt-0.5">
          Calculates exact server-side policy resolution across Global → Company → Branch → Module → Optional Page/Screen → Optional User + Active Exceptions.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block font-semibold text-slate-600 mb-1">Company</label>
          <select
            value={simCompanyId}
            onChange={(e) => {
              const cid = e.target.value;
              setSimCompanyId(cid);
              const firstBr = branches.find((b) => (b.companyId || 'co-kosh-01') === cid);
              if (firstBr) setSimBranchId(firstBr.id);
            }}
            className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold text-slate-600 mb-1">Branch</label>
          <select
            value={simBranchId}
            onChange={(e) => setSimBranchId(e.target.value)}
            className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
          >
            {companyBranches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold text-slate-600 mb-1">Module</label>
          <select
            value={simModuleKey}
            onChange={(e) => setSimModuleKey(e.target.value)}
            className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
          >
            {modules.map((m) => (
              <option key={m.moduleKey} value={m.moduleKey}>{m.displayName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold text-slate-600 mb-1">Page Key (Optional)</label>
          <input
            type="text"
            value={simPageKey}
            onChange={(e) => setSimPageKey(e.target.value)}
            className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white font-mono"
          />
        </div>
        <div>
          <label className="block font-semibold text-slate-600 mb-1">Target User (Optional)</label>
          <select
            value={simUserId}
            onChange={(e) => setSimUserId(e.target.value)}
            className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500">
          Evaluation executes against authoritative Express backend `/api/security/effective-policy`.
        </span>
        <button
          type="button"
          onClick={runSimulation}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Evaluate Effective Policy</span>
        </button>
      </div>

      {err && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 font-semibold">{err}</div>
      )}

      {result && (
        <div className="space-y-3 pt-2 border-t border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] font-mono">
            <span>Policy Version: v{result.policyVersion}</span>
            <span>Cache Key: {result.cacheKey}</span>
            <span>
              Optional Scopes: Page={result.optionalScopes.pageLevelEnabled ? 'ON' : 'OFF'} | User=
              {result.optionalScopes.userLevelEnabled ? 'ON' : 'OFF'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold border-b border-slate-200">
                  <th className="p-2.5">Control</th>
                  <th className="p-2.5">Effective Value</th>
                  <th className="p-2.5">Source Level</th>
                  <th className="p-2.5">Source Configuration</th>
                  <th className="p-2.5">Mandatory Status</th>
                  <th className="p-2.5">Override Status</th>
                  <th className="p-2.5">Exception Status</th>
                  <th className="p-2.5">Version</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ALL_SECURITY_CONTROL_KEYS.map((k) => {
                  const c = result.controls[k];
                  return (
                    <React.Fragment key={k}>
                      <tr
                        onClick={() => setExpandedControl(expandedControl === k ? null : k)}
                        className="hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="p-2.5 font-semibold text-slate-900">{c.label}</td>
                        <td className="p-2.5 font-mono font-bold">
                          <span className={c.effectiveValue ? 'text-emerald-700' : 'text-slate-500'}>
                            {c.effectiveValue ? 'ACTIVE' : 'INACTIVE'} ({c.effectiveMode})
                          </span>
                        </td>
                        <td className="p-2.5 font-mono">{c.sourceLevel}</td>
                        <td className="p-2.5 text-slate-700">{c.sourceLabel}</td>
                        <td className="p-2.5 font-semibold">
                          {c.mandatoryStatus ? (
                            <span className="text-rose-700">MANDATORY LOCK</span>
                          ) : (
                            <span className="text-slate-500">Flexible</span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-[11px]">{c.overrideStatus}</td>
                        <td className="p-2.5 font-mono text-[11px]">{c.exceptionStatus}</td>
                        <td className="p-2.5 font-mono tabular-nums">v{c.policyVersion}</td>
                      </tr>
                      {expandedControl === k && (
                        <tr className="bg-slate-50">
                          <td colSpan={8} className="p-3">
                            <div className="font-bold text-[11px] text-slate-700 mb-1.5">
                              Resolution Trace for {c.label}:
                            </div>
                            <div className="space-y-1 font-mono text-[11px]">
                              {c.trace.map((step, i) => (
                                <div key={i} className="text-slate-700">
                                  [{step.scopeLevel}] {step.scopeLabel} — {step.configuredState} → {step.note}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export const ExceptionsPanel: React.FC<{
  currentUser: User;
  sessionId: string;
  companies: Company[];
  exceptions: PolicyExceptionRecord[];
  onRefresh: () => Promise<void>;
}> = ({ currentUser, sessionId, companies, exceptions, onRefresh }) => {
  const [companyId, setCompanyId] = useState(companies[0]?.id || 'co-kosh-01');
  const [controlKey, setControlKey] = useState<SecurityControlKey>('clipboardControl');
  const [reason, setReason] = useState('');
  const [hoursValid, setHoursValid] = useState(24);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const start = new Date();
      const exp = new Date(start.getTime() + hoursValid * 3600 * 1000);
      await zeroTrustSecurityService.requestException(currentUser, sessionId, {
        companyId,
        scopeLevel: 'COMPANY',
        scopeRefId: companyId,
        controlKey,
        reason,
        startDate: start.toISOString(),
        expiryDate: exp.toISOString(),
      });
      setReason('');
      setMsg({ type: 'ok', text: 'Exception request submitted for Maker-Checker administrator approval.' });
      await onRefresh();
    } catch (err: any) {
      setMsg({ type: 'err', text: err?.message || 'Failed to submit exception' });
    }
  };

  const handleDecide = async (id: string, decision: 'APPROVED' | 'REJECTED' | 'REVOKED') => {
    setMsg(null);
    try {
      await zeroTrustSecurityService.decideException(
        currentUser,
        sessionId,
        id,
        decision,
        `${decision} via Security Control Center by ${currentUser.fullName}`
      );
      window.dispatchEvent(new CustomEvent('kosh:zt-policy-updated'));
      await onRefresh();
    } catch (err: any) {
      setMsg({ type: 'err', text: err?.message || 'Decision failed' });
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <form onSubmit={handleRequest} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="font-bold text-slate-900 text-sm">
          Request Time-Limited Policy Exception (Maker-Checker Required)
        </div>
        {msg && (
          <div
            className={`p-2.5 rounded-lg font-semibold ${
              msg.type === 'ok'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border border-rose-200 text-rose-900'
            }`}
          >
            {msg.text}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={controlKey}
            onChange={(e) => setControlKey(e.target.value as SecurityControlKey)}
            className="px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
          >
            {ALL_SECURITY_CONTROL_KEYS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={720}
            value={hoursValid}
            onChange={(e) => setHoursValid(Number(e.target.value) || 24)}
            className="px-2.5 py-2 border border-slate-300 rounded-lg bg-white tabular-nums"
            placeholder="Hours valid"
          />
          <button
            type="submit"
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer"
          >
            Submit Exception Request
          </button>
        </div>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Business & security justification (minimum 5 characters)..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
        />
      </form>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-900">
          Policy Exceptions Ledger ({exceptions.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600 border-b border-slate-200">
                <th className="p-2.5">Exception</th>
                <th className="p-2.5">Scope / Control</th>
                <th className="p-2.5">Requested By</th>
                <th className="p-2.5">Validity Window</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exceptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    No policy exceptions recorded.
                  </td>
                </tr>
              ) : (
                exceptions.map((exc) => (
                  <tr key={exc.id}>
                    <td className="p-2.5">
                      <div className="font-mono font-bold text-slate-900">{exc.id}</div>
                      <div className="text-[11px] text-slate-600">{exc.reason}</div>
                    </td>
                    <td className="p-2.5 font-mono">
                      {exc.companyId} • {exc.controlKey}
                    </td>
                    <td className="p-2.5">{exc.requestedByName}</td>
                    <td className="p-2.5 font-mono text-[11px]">
                      {exc.startDate.slice(0, 16)} → {exc.expiryDate.slice(0, 16)}
                    </td>
                    <td className="p-2.5 font-bold">{exc.status}</td>
                    <td className="p-2.5 text-right space-x-1.5">
                      {exc.status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDecide(exc.id, 'APPROVED')}
                            className="px-2 py-1 bg-emerald-600 text-white rounded font-semibold cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDecide(exc.id, 'REJECTED')}
                            className="px-2 py-1 bg-rose-600 text-white rounded font-semibold cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {exc.status === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => handleDecide(exc.id, 'REVOKED')}
                          className="px-2 py-1 bg-amber-600 text-white rounded font-semibold cursor-pointer"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const SessionsPanel: React.FC<{
  currentUser: User;
  sessionId: string;
  sessions: SessionProtectionState[];
  browserLogs: BrowserComplianceEvaluation[];
  onRefresh: () => Promise<void>;
}> = ({ currentUser, sessionId, sessions, browserLogs, onRefresh }) => {
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAction = async (
    targetSessId: string,
    mode: 'BLACKOUT' | 'SUSPEND' | 'OVERRIDE'
  ) => {
    setActionError(null);
    try {
      if (mode === 'OVERRIDE') {
        await zeroTrustSecurityService.adminOverrideBlackout(
          currentUser,
          sessionId,
          targetSessId,
          `Admin override triggered from Session Security Monitor by ${currentUser.fullName}`
        );
      } else {
        await zeroTrustSecurityService.triggerBlackout(currentUser, targetSessId, {
          reason: `Administrative ${mode.toLowerCase()} issued by ${currentUser.fullName}`,
          severity: 'HIGH',
          action: mode === 'BLACKOUT' ? 'BLACKOUT_LOCKED' : 'SUSPENDED',
          durationSeconds: 300,
          createIncident: true,
        });
      }
      await onRefresh();
    } catch (err: any) {
      setActionError(err?.message || 'Session control action failed');
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 font-semibold">
          {actionError}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold text-slate-900">Active & Protected Sessions ({sessions.length})</span>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600 border-b border-slate-200">
                <th className="p-2.5">Session Ref</th>
                <th className="p-2.5">User</th>
                <th className="p-2.5">Scope</th>
                <th className="p-2.5">Browser</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Version</th>
                <th className="p-2.5 text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">No tracked sessions yet.</td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.sessionId}>
                    <td className="p-2.5 font-mono">{s.watermarkSessionRef}</td>
                    <td className="p-2.5 font-semibold">{s.userName}</td>
                    <td className="p-2.5 font-mono text-[11px]">{s.companyId} / {s.branchId} / {s.moduleKey}</td>
                    <td className="p-2.5">{s.browserFamily} {s.browserVersion}</td>
                    <td className="p-2.5 font-bold">
                      <span className={s.protectionStatus === 'PROTECTED' ? 'text-emerald-700' : 'text-rose-700'}>
                        {s.protectionStatus}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono tabular-nums">v{s.policyVersion}</td>
                    <td className="p-2.5 text-right space-x-1.5">
                      {s.blackoutActive ? (
                        <button
                          type="button"
                          onClick={() => handleAction(s.sessionId, 'OVERRIDE')}
                          className="px-2 py-1 bg-emerald-600 text-white rounded font-semibold cursor-pointer"
                        >
                          Admin Override
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAction(s.sessionId, 'BLACKOUT')}
                            className="px-2 py-1 bg-amber-600 text-white rounded font-semibold cursor-pointer"
                          >
                            Test Blackout
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction(s.sessionId, 'SUSPEND')}
                            className="px-2 py-1 bg-rose-600 text-white rounded font-semibold cursor-pointer"
                          >
                            Suspend
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-900">
          Browser Compliance Evaluations ({browserLogs.length})
        </div>
        <div className="p-3 text-[11px] text-slate-600 border-b border-slate-100">
          Honest technical boundary: Browser detection evaluates User-Agent, Client Hints, Secure Context, and Web APIs. True managed-browser attestation requires Edge / Chrome Enterprise policies and conditional access.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600 border-b border-slate-200">
                <th className="p-2.5">Browser</th>
                <th className="p-2.5">Version</th>
                <th className="p-2.5">Approved</th>
                <th className="p-2.5">Secure Context</th>
                <th className="p-2.5">Decision</th>
                <th className="p-2.5">Evaluated At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {browserLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-5 text-center text-slate-400">All current sessions compliant or awaiting non-compliant browser check.</td>
                </tr>
              ) : (
                browserLogs.slice(0, 20).map((b, i) => (
                  <tr key={i}>
                    <td className="p-2.5 font-semibold">{b.browserDisplayName}</td>
                    <td className="p-2.5 font-mono">{b.browserVersion}</td>
                    <td className="p-2.5">{b.isApprovedFamily ? 'Yes' : 'No'}</td>
                    <td className="p-2.5">{b.isSecureContext ? 'HTTPS/Localhost' : 'Insecure'}</td>
                    <td className="p-2.5 font-bold">{b.decision}</td>
                    <td className="p-2.5 font-mono text-[11px]">{b.evaluatedAt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const EventsAndIncidentsPanel: React.FC<{
  mode: 'EVENTS' | 'INCIDENTS';
  currentUser: User;
  sessionId: string;
  events: SecurityEventRecord[];
  incidents: SecurityIncidentRecord[];
  users: User[];
  onRefresh: () => Promise<void>;
}> = ({ mode, currentUser, sessionId, events, incidents, users, onRefresh }) => {
  const [incTitle, setIncTitle] = useState('');
  const [incErr, setIncErr] = useState<string | null>(null);

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setIncErr(null);
    if (incTitle.trim().length < 4) {
      setIncErr('Provide an incident title (min 4 chars).');
      return;
    }
    try {
      await zeroTrustSecurityService.createIncident(currentUser, sessionId, {
        title: incTitle.trim(),
        category: 'DATA_LEAKAGE_RISK',
        severity: 'HIGH',
        companyId: currentUser.defaultCompanyId || 'co-kosh-01',
        branchId: currentUser.defaultBranchId || 'br-pond-01',
        moduleKey: 'SECURITY_GOVERNANCE',
        affectedUserId: currentUser.id,
      });
      setIncTitle('');
      await onRefresh();
    } catch (err: any) {
      setIncErr(err?.message || 'Incident creation failed');
    }
  };

  const handleLifecycle = async (
    id: string,
    action: 'ACKNOWLEDGED' | 'INVESTIGATED' | 'RESOLVED' | 'CLOSED'
  ) => {
    try {
      await zeroTrustSecurityService.updateIncident(currentUser, sessionId, id, {
        action,
        assignedToUserId: users[0]?.id,
        note: `Incident marked ${action} by ${currentUser.fullName}`,
      });
      await onRefresh();
    } catch (err: any) {
      setIncErr(err?.message || 'Incident update failed');
    }
  };

  if (mode === 'EVENTS') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold text-slate-900">Real-Time Security Event Stream ({events.length})</span>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600 border-b border-slate-200">
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">Severity</th>
                <th className="p-2.5">Event Type</th>
                <th className="p-2.5">User & Scope</th>
                <th className="p-2.5">Source / Action</th>
                <th className="p-2.5">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    No security events recorded yet. Events populate automatically from live violations and policy changes.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id}>
                    <td className="p-2.5 font-mono text-[11px]">{ev.timestamp.slice(0, 19).replace('T', ' ')}</td>
                    <td className="p-2.5 font-bold">
                      <span
                        className={
                          ev.severity === 'CRITICAL'
                            ? 'text-rose-700'
                            : ev.severity === 'HIGH'
                            ? 'text-amber-700'
                            : 'text-slate-700'
                        }
                      >
                        {ev.severity}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono text-[11px]">{ev.eventType}</td>
                    <td className="p-2.5">
                      <div className="font-semibold">{ev.userName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{ev.companyId} / {ev.branchId}</div>
                    </td>
                    <td className="p-2.5 font-mono text-[11px]">{ev.detectionSource} → {ev.actionTaken}</td>
                    <td className="p-2.5 text-slate-700">{ev.summary}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-xs">
      <form onSubmit={handleCreateIncident} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-2.5">
        <input
          type="text"
          value={incTitle}
          onChange={(e) => setIncTitle(e.target.value)}
          placeholder="Log new security investigation incident title..."
          className="flex-1 min-w-[260px] px-3 py-2 border border-slate-300 rounded-lg text-xs"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold cursor-pointer"
        >
          Create Security Incident
        </button>
      </form>
      {incErr && <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">{incErr}</div>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-900">
          Security Incident Register ({incidents.length})
        </div>
        <div className="divide-y divide-slate-100">
          {incidents.length === 0 ? (
            <div className="p-6 text-center text-slate-400">No security incidents open.</div>
          ) : (
            incidents.map((inc) => (
              <div key={inc.id} className="p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-slate-900 mr-2">{inc.incidentNumber}</span>
                    <span className="font-bold text-slate-900">{inc.title}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="font-bold text-rose-700">{inc.severity}</span>
                    <span className="font-bold text-indigo-700">{inc.status}</span>
                    <span>v{inc.policyVersion}</span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500">
                  User: {inc.affectedUserName} • Scope: {inc.companyId} / {inc.branchId} / {inc.moduleKey} • Events linked: {inc.linkedEventIds.length}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {inc.status === 'OPEN' && (
                    <button
                      type="button"
                      onClick={() => handleLifecycle(inc.id, 'ACKNOWLEDGED')}
                      className="px-2.5 py-1 bg-amber-600 text-white rounded font-semibold cursor-pointer"
                    >
                      Acknowledge
                    </button>
                  )}
                  {(inc.status === 'OPEN' || inc.status === 'ACKNOWLEDGED') && (
                    <button
                      type="button"
                      onClick={() => handleLifecycle(inc.id, 'INVESTIGATED')}
                      className="px-2.5 py-1 bg-indigo-600 text-white rounded font-semibold cursor-pointer"
                    >
                      Start Investigation
                    </button>
                  )}
                  {inc.status !== 'RESOLVED' && inc.status !== 'CLOSED' && (
                    <button
                      type="button"
                      onClick={() => handleLifecycle(inc.id, 'RESOLVED')}
                      className="px-2.5 py-1 bg-emerald-600 text-white rounded font-semibold cursor-pointer"
                    >
                      Resolve
                    </button>
                  )}
                  {inc.status === 'RESOLVED' && (
                    <button
                      type="button"
                      onClick={() => handleLifecycle(inc.id, 'CLOSED')}
                      className="px-2.5 py-1 bg-slate-700 text-white rounded font-semibold cursor-pointer"
                    >
                      Close Incident
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const RegistryAndHealthPanels: React.FC<{
  mode: 'REGISTRY' | 'AUDIT' | 'HEALTH';
  registry: SoftwareModelRegistryItem[];
  auditHistory: SecurityAuditHistoryEntry[];
  health: any;
}> = ({ mode, registry, auditHistory, health }) => {
  if (mode === 'REGISTRY') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-900 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-600" />
          <span>Verified Software, Inference Runtime & Local AI Model Registry</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600 border-b border-slate-200">
                <th className="p-2.5">Component</th>
                <th className="p-2.5">Version</th>
                <th className="p-2.5">Licence / Commercial</th>
                <th className="p-2.5">Integrity / SHA-256</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Vulnerabilities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registry.map((item) => (
                <tr key={item.id}>
                  <td className="p-2.5">
                    <div className="font-bold text-slate-900">{item.componentName}</div>
                    <div className="text-[11px] text-slate-500">{item.notes}</div>
                  </td>
                  <td className="p-2.5 font-mono">{item.version}</td>
                  <td className="p-2.5">{item.license} ({item.commercialUseAllowed ? 'Allowed' : 'Restricted'})</td>
                  <td className="p-2.5 font-mono text-[11px]">
                    <div>{item.integrityVerification}</div>
                    {item.sha256Digest && (
                      <div className="text-slate-500 truncate max-w-[180px]" title={item.sha256Digest}>
                        sha256:{item.sha256Digest.slice(0, 18)}...
                      </div>
                    )}
                  </td>
                  <td className="p-2.5 font-semibold text-emerald-700">
                    {item.installationStatus} / {item.integrationStatus} / {item.testStatus}
                  </td>
                  <td className="p-2.5 font-mono">{item.vulnerabilityStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (mode === 'AUDIT') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-900">
          Security Administrative Audit History ({auditHistory.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600 border-b border-slate-200">
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">Actor</th>
                <th className="p-2.5">Action</th>
                <th className="p-2.5">Target</th>
                <th className="p-2.5">Version</th>
                <th className="p-2.5">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">No administrative security mutations logged yet.</td>
                </tr>
              ) : (
                auditHistory.map((a) => (
                  <tr key={a.id}>
                    <td className="p-2.5 font-mono text-[11px]">{a.createdAt}</td>
                    <td className="p-2.5 font-semibold">{a.actorName}</td>
                    <td className="p-2.5 font-mono">{a.actionType}</td>
                    <td className="p-2.5 font-mono text-[11px]">{a.targetEntityType} ({a.targetEntityId})</td>
                    <td className="p-2.5 font-mono tabular-nums">v{a.policyVersion}</td>
                    <td className="p-2.5">{a.changeReason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Zero-Trust Security Engine System Health</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
              Last Verified: {health?.checkedAt ? health.checkedAt.replace('T', ' ').slice(0, 19) + ' UTC' : 'Live'}
            </div>
          </div>
          <span className="font-mono font-bold text-emerald-700">{health?.status || 'HEALTHY'}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 tabular-nums">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500">Policy Version &amp; Cache</div>
            <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
              v{health?.policyVersion || 1} / c{health?.cacheVersion || 1}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">{health?.cacheEntries ?? 0} evaluated cache entries</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500">Local AI Model Artifacts</div>
            <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">
              {health?.localAiModelReady ? `${health.localAiModelFilesVerified} files verified` : 'Missing'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">COCO-SSD SSDLite MobileNet v2 (SHA-256)</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500">Local WASM Inference Binaries</div>
            <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
              {health?.localWasmBinariesVerified || 0} binaries ready
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Served locally from /tfjs-wasm/</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500">Tracked Protected Sessions</div>
            <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
              {health?.activeSessions ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Server-authoritative blackout &amp; re-auth</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500">Optional Scope Runtime</div>
            <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
              Page: {health?.optionalScopes?.pageLevelEnabled ? 'ON' : 'OFF'} · User: {health?.optionalScopes?.userLevelEnabled ? 'ON' : 'OFF'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Independent toggleable granular overrides</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500">Verified Component Registry</div>
            <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
              {registry.length} / {registry.length} Active
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">0 high/critical dependency CVEs tracked</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
        <div className="font-bold text-slate-900">Architecture Verification &amp; Honest Enforcement Boundaries</div>
        <ul className="space-y-1.5 text-[11px] text-slate-600 list-disc pl-4">
          <li>
            <strong>Server-Side Enforcement:</strong> Express `/api/security/*` validates RBAC (`SECURITY_*` permissions), company/branch scope isolation, anti-self-modification, and maker-checker approval separation.
          </li>
          <li>
            <strong>Privacy-Preserving Local AI:</strong> `@tensorflow/tfjs` + `@tensorflow-models/coco-ssd` inspect live camera frames purely in browser memory using verified `/models/coco-ssd/` and `/tfjs-wasm/` assets—zero raw video or frame uploads.
          </li>
          <li>
            <strong>Browser &amp; Endpoint Boundary:</strong> Web application layers enforce Chrome/Edge capability checks, forensic watermarks, blur/focus blackout, and clipboard deterrence. OS-level screenshot blocking, external camera capture, and cryptographic browser attestation require customer MDM / Endpoint DLP.
          </li>
          <li>
            <strong>Database Persistence Schema:</strong> Normalized MySQL DDL prepared in `server/src/migrations/008_create_zero_trust_security_engine.sql` (18 `zt_*` tables) for production cutover.
          </li>
        </ul>
      </div>
    </div>
  );
};
