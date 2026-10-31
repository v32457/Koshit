import React, { useState } from 'react';
import { SapIntegrationProfile, SapScheduleConfig, SapTestResult, User } from '../../types';
import {
  Cpu,
  PlayCircle,
  Power,
  LayoutDashboard,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Database,
  ArrowRight,
  Sliders,
  AlertOctagon,
} from 'lucide-react';

interface SapIntegrationViewProps {
  currentUser: User;
  activeTab?: 'profiles' | 'testing' | 'activate' | 'monitor';
}

export const SapIntegrationView: React.FC<SapIntegrationViewProps> = ({
  currentUser,
  activeTab: initialTab = 'profiles',
}) => {
  const [tab, setTab] = useState<'profiles' | 'testing' | 'activate' | 'monitor'>(initialTab);

  // Profile Configuration State
  const [profile, setProfile] = useState<SapIntegrationProfile>({
    id: 'sap-prof-01',
    name: 'Unconfigured SAP Integration Profile',
    description: 'No SAP Business One Service Layer connection has been configured or verified.',
    environment: 'DEV',
    serviceLayerUrl: '',
    companyDb: '',
    authMethod: 'SESSION',
    credentialVaultRef: '',
    timeoutSeconds: 30,
    maxRetries: 3,
    batchSize: 50,
    tlsVerify: true,
    status: 'DRAFT',
    version: 0,
    updatedAt: new Date(0).toISOString(),
  });

  const [schedule, setSchedule] = useState<SapScheduleConfig>({
    id: 'sched-01',
    profileId: 'sap-prof-01',
    scheduleType: 'MANUAL',
    intervalMinutes: 15,
    timezone: 'Asia/Kolkata',
    isEnabled: false,
  });

  /**
   * These are test definitions only. No SAP connector exists in this repository,
   * so every check starts and remains NOT_RUN until a real connector executes it.
   */
  const testDefinitions: Array<Pick<SapTestResult, 'id' | 'testId' | 'name' | 'category'>> = [
    { id: 't1', testId: 'SAP-T01', name: 'Configuration Completeness', category: 'Config' },
    { id: 't2', testId: 'SAP-T02', name: 'DNS & Network Reachability', category: 'Network' },
    { id: 't3', testId: 'SAP-T03', name: 'TLS Certificate Validation', category: 'Security' },
    { id: 't4', testId: 'SAP-T04', name: 'Service Layer Endpoint Reachability', category: 'Endpoint' },
    { id: 't5', testId: 'SAP-T05', name: 'Authentication & Session Establishment', category: 'Auth' },
    { id: 't6', testId: 'SAP-T06', name: 'Company Database Identification', category: 'Schema' },
    { id: 't7', testId: 'SAP-T07', name: 'Authorization & Item Object Permissions', category: 'Permissions' },
    { id: 't8', testId: 'SAP-T08', name: 'SAP Metadata & Required Field Discovery', category: 'Metadata' },
    { id: 't9', testId: 'SAP-T09', name: 'Portal-to-SAP Field Mapping', category: 'Mapping' },
    { id: 't10', testId: 'SAP-T10', name: 'Mandatory Field Constraints Validation', category: 'Validation' },
    { id: 't11', testId: 'SAP-T11', name: 'Item Code & Description Syntax Validation', category: 'Rules' },
    { id: 't12', testId: 'SAP-T12', name: 'Duplicate ItemCode Pre-Check Detection', category: 'Idempotency' },
    { id: 't13', testId: 'SAP-T13', name: 'Approved UDF Availability in SAP Schema', category: 'UDF' },
    { id: 't14', testId: 'SAP-T14', name: 'Read-Only SAP Item Master Lookup', category: 'Read-Test' },
    { id: 't15', testId: 'SAP-T15', name: 'Safe Item Master Create Simulation', category: 'Simulation' },
    { id: 't16', testId: 'SAP-T16', name: 'Scheduler Configuration (Asia/Kolkata)', category: 'Scheduler' },
    { id: 't17', testId: 'SAP-T17', name: 'Retry & Timeout Safeguards', category: 'Resilience' },
    { id: 't18', testId: 'SAP-T18', name: 'Audit Log Trail Generation', category: 'Audit' },
    { id: 't19', testId: 'SAP-T19', name: 'Error Classification & Sanitization', category: 'Security' },
    { id: 't20', testId: 'SAP-T20', name: 'End-to-End Integration Test', category: 'End-to-End' },
  ];

  const initialTests: SapTestResult[] = testDefinitions.map((definition) => ({
    ...definition,
    durationMs: 0,
    result: 'NOT_RUN',
    details: 'Not executed: no SAP Business One Service Layer connector is configured.',
    executedAt: profile.updatedAt,
    correlationId: 'not-executed',
  }));

  const [tests, setTests] = useState<SapTestResult[]>(initialTests);
  const [testRunNotice, setTestRunNotice] = useState<string | null>(null);

  const runAllTests = () => {
    // No connector exists. Do not fabricate PASS results or timings.
    setTests((prev) =>
      prev.map((t) => ({
        ...t,
        result: 'NOT_RUN',
        durationMs: 0,
        details:
          'Not executed: the SAP Service Layer connector, credentials, and scheduler are not implemented in the backend.',
        correlationId: 'not-executed',
      }))
    );
    setTestRunNotice(
      'SAP integration tests are BLOCKED: no Service Layer connector or credentials are configured. No test was executed.',
    );
  };

  // There is no backend SAP connector or scheduler, so no remote state can be
  // suspended or resumed from this screen. Refuse the action instead of
  // pretending the integration was stopped or reactivated.
  const handleToggleEmergencyStop = () => {
    setTestRunNotice(
      'Emergency stop is unavailable: no SAP connector or server-side scheduler is implemented, so there is no live sync to suspend or resume.',
    );
  };

  return (
    <div className="space-y-4">
      {/* Module Title & Tab Navigation */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">SAP Integration Management (B1 HANA)</h2>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                profile.status === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              Status: {profile.status} (NOT CONFIGURED)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configuration and test-definition screen only. No SAP Business One connector, credentials, or scheduler
            exists in this build, so activation and synchronization are BLOCKED.
          </p>
        </div>

        {/* Emergency Stop Switch */}
        <button
          onClick={handleToggleEmergencyStop}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition cursor-not-allowed bg-slate-200 text-slate-600"
          title="No live SAP connector exists to suspend or resume."
        >
          <AlertOctagon className="w-4 h-4" />
          Sync Control Unavailable
        </button>
      </div>

      {testRunNotice && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-3 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{testRunNotice}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs font-medium border border-slate-200">
        <button
          onClick={() => setTab('profiles')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
            tab === 'profiles' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          Creation & Scheduling
        </button>
        <button
          onClick={() => setTab('testing')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
            tab === 'testing' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <PlayCircle className="w-3.5 h-3.5" />
          Safe Testing (20 Checks)
        </button>
        <button
          onClick={() => setTab('activate')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
            tab === 'activate' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          Gated Activation
        </button>
        <button
          onClick={() => setTab('monitor')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
            tab === 'monitor' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Monitor & Recovery Queue
        </button>
      </div>

      {/* Tab 1: Profile & Scheduling */}
      {tab === 'profiles' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5 text-xs shadow-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900">SAP Business One HANA Connection Profile</h3>
            <p className="text-slate-500">Service Layer parameters, company database, and protected credential reference.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Profile Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Target SAP Environment</label>
              <select
                value={profile.environment}
                onChange={(e) => setProfile({ ...profile, environment: e.target.value as any })}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold"
              >
                <option value="DEV">Development</option>
                <option value="UAT">UAT / Testing Company</option>
                <option value="PROD">Production (KOSH_PROD_HANA)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Company Database ID</label>
              <input
                type="text"
                value={profile.companyDb}
                onChange={(e) => setProfile({ ...profile, companyDb: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Service Layer Base URL</label>
              <input
                type="text"
                value={profile.serviceLayerUrl}
                onChange={(e) => setProfile({ ...profile, serviceLayerUrl: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Credential Vault Reference</label>
              <input
                type="text"
                value={profile.credentialVaultRef}
                readOnly
                className="w-full p-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono text-slate-600"
              />
            </div>
          </div>

          {/* Scheduling Configuration */}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="font-bold text-xs text-slate-900 mb-2">Durable Server-Side Job Scheduling</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Execution Schedule</label>
                <select
                  value={schedule.scheduleType}
                  onChange={(e) => setSchedule({ ...schedule, scheduleType: e.target.value as any })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="INTERVAL">Every 15 Minutes</option>
                  <option value="RECURRING">Daily at 02:00 AM IST</option>
                  <option value="MANUAL">Manual Trigger Only</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Timezone Scope</label>
                <input
                  type="text"
                  value={schedule.timezone}
                  readOnly
                  className="w-full p-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono text-slate-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Scheduler Status</label>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`w-3 h-3 rounded-full ${schedule.isEnabled ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span className="font-bold text-slate-800">
                    {schedule.isEnabled ? 'Enabled (no scheduler backend)' : 'Disabled / Paused'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: 20 Safe Automated Tests */}
      {tab === 'testing' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">20 Safe Automated Pre-Activation Tests</h3>
              <p className="text-slate-500">
                Non-mutating tests verify connectivity, authentication, schema, UDFs, and ItemCode constraints without creating dummy items.
              </p>
            </div>

            <button
              onClick={runAllTests}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Run All 20 Tests
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {tests.map((t) => (
              <div key={t.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-cyan-800 text-[11px]">{t.testId}</span>
                    <span className="font-bold text-slate-900">{t.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">{t.details}</div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Category: {t.category} • Result: {t.result} • Latency: {t.durationMs > 0 ? `${t.durationMs}ms` : 'n/a'}
                  </div>
                </div>

                <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px] flex items-center gap-1 shrink-0">
                  <AlertTriangle className="w-3 h-3 text-amber-500" /> NOT RUN
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Gated Activation */}
      {tab === 'activate' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5 shadow-xs text-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900">05.05.03 Gated Activation Dashboard</h3>
            <p className="text-slate-500">Preconditions gate activation: All 20 mandatory tests must pass before production sync can be enabled.</p>
          </div>

          <div className="bg-rose-50 border border-rose-300 text-rose-900 rounded-lg p-3 flex items-start gap-2">
            <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Activation is BLOCKED. No SAP Business One connector, credential vault, or scheduler is implemented, and
              no test has been executed. No approval can be granted while these preconditions are unmet.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
              <h4 className="font-bold text-slate-900 text-xs mb-2">Activation Preconditions Checklist:</h4>
              <div className="flex items-center gap-2 text-rose-700">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>1. Service Layer URL &amp; Company DB — not configured</span>
              </div>
              <div className="flex items-center gap-2 text-rose-700">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>2. 20/20 Safe Tests Passed — 0/20 executed</span>
              </div>
              <div className="flex items-center gap-2 text-rose-700">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>3. UDF Schema Parity Verified in SAP HANA — not verified</span>
              </div>
              <div className="flex items-center gap-2 text-rose-700">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>4. Protected Credential Vault Reference — not configured</span>
              </div>
              <div className="flex items-center gap-2 text-rose-700">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>5. Asia/Kolkata Scheduler Safeguards — no scheduler backend</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
              <h4 className="font-bold text-slate-900 text-xs">Maker-Checker Activation Approval:</h4>
              <div className="p-3 bg-white rounded border border-slate-200 text-[11px] space-y-1">
                <div>Creator: <strong className="text-slate-500">No activation request submitted</strong></div>
                <div>Reviewer: <strong className="text-slate-500">Not assigned</strong></div>
                <div>Decision: <strong className="text-rose-600 font-bold">NOT APPROVED</strong></div>
                <div className="text-slate-500 italic">No approval record exists. Activation remains blocked.</div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() =>
                    setTestRunNotice(
                      'Health verification cannot run: no SAP Service Layer endpoint or connector is configured.',
                    )
                  }
                  className="w-full py-2 bg-slate-200 text-slate-600 font-bold rounded-lg text-xs cursor-not-allowed flex items-center justify-center gap-2"
                  title="No SAP Service Layer endpoint is configured."
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Run Non-Mutating Health Verification (Blocked)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Monitor & DLQ */}
      {tab === 'monitor' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5 shadow-xs text-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900">SAP Synchronization Monitor & Recovery Queue</h3>
            <p className="text-slate-500">Live job batches, reconciliation discrepancies, and Dead Letter Queue (DLQ).</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 block text-[11px]">Last Sync Batch:</span>
              <span className="font-bold text-slate-500 text-sm">None recorded</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 block text-[11px]">Records Synced:</span>
              <span className="font-bold text-slate-500 text-sm">0</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 block text-[11px]">DLQ Failed Records:</span>
              <span className="font-bold text-slate-500 text-sm">No queue backend</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 block text-[11px]">Target Reconciliation:</span>
              <span className="font-bold text-slate-500 text-sm">Not available</span>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 mb-2">Sync Audit Execution History:</h4>
            <div className="border border-slate-200 rounded-lg p-4 text-slate-500 bg-slate-50">
              No synchronization jobs have been recorded. The SAP connector and job queue are not implemented in this build.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
