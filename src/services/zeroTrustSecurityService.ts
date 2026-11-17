/**
 * KOSH INNOVATIONS — FRONTEND ZERO-TRUST SECURITY SERVICE BRIDGE
 * Synchronizes policy evaluation, session heartbeats, browser compliance, blackouts,
 * event telemetry, and incidents with the authoritative /api/security Express backend,
 * while logging governance mutations into EnterpriseAuditService.
 */

import type { Branch, Company, ModuleRegistryItem, User } from '../types';
import type {
  BrowserComplianceEvaluation,
  EffectiveSecurityPolicy,
  OptionalScopeSettings,
  PolicyExceptionRecord,
  ScopedSecurityPolicyConfig,
  SecurityControlKey,
  SecurityDashboardSnapshot,
  SecurityEventRecord,
  SecurityIncidentRecord,
  SecurityPolicyParameters,
  SecurityPolicyVersionSnapshot,
  SecuritySeverity,
  SessionProtectionState,
  SoftwareModelRegistryItem,
} from '../types/zeroTrustSecurity';
import { EnterpriseAuditService } from './enterpriseAuditService';

export interface SecurityAuditHistoryEntry {
  id: string;
  companyId: string;
  actorUserId: string;
  actorName: string;
  actionType: string;
  targetEntityType: string;
  targetEntityId: string;
  previousValue?: unknown;
  newValue: unknown;
  changeReason: string;
  policyVersion: number;
  createdAt: string;
}

const SESSION_STORAGE_KEY = 'kosh_zt_client_session_id';

export function getOrCreateClientSessionId(): string {
  if (typeof sessionStorage !== 'undefined') {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const generated = `zt-sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(SESSION_STORAGE_KEY, generated);
    return generated;
  }
  return `zt-sess-node-${Date.now()}`;
}

async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    userId?: string;
    sessionId?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.userId) headers['x-kosh-user-id'] = options.userId;
  if (options.sessionId) headers['x-kosh-session-id'] = options.sessionId;

  const res = await fetch(`/api/security${path}`, {
    method: options.method || 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = payload?.error?.message || `Security API failed (${res.status})`;
    const err = new Error(msg) as Error & { code?: string; status?: number };
    err.code = payload?.error?.code;
    err.status = res.status;
    throw err;
  }
  return payload.data as T;
}

export const zeroTrustSecurityService = {
  async syncCatalog(catalog: {
    users: User[];
    companies: Company[];
    branches: Branch[];
    modules: ModuleRegistryItem[];
  }): Promise<void> {
    await apiRequest('/sync-catalog', { method: 'POST', body: catalog });
  },

  async getDashboard(): Promise<SecurityDashboardSnapshot> {
    return apiRequest<SecurityDashboardSnapshot>('/dashboard');
  },

  async getHierarchy(): Promise<{
    optionalScopes: OptionalScopeSettings;
    globalPolicy: ScopedSecurityPolicyConfig;
    companyPolicies: ScopedSecurityPolicyConfig[];
    branchPolicies: ScopedSecurityPolicyConfig[];
    modulePolicies: ScopedSecurityPolicyConfig[];
    pagePolicies: ScopedSecurityPolicyConfig[];
    userPolicies: ScopedSecurityPolicyConfig[];
    policyVersions: SecurityPolicyVersionSnapshot[];
    cacheVersion: number;
    globalPolicyVersion: number;
  }> {
    return apiRequest('/policies/hierarchy');
  },

  async updateOptionalScopes(
    actor: User,
    sessionId: string,
    updates: { pageLevelEnabled?: boolean; userLevelEnabled?: boolean; reason: string }
  ): Promise<OptionalScopeSettings> {
    const res = await apiRequest<OptionalScopeSettings>('/optional-scopes', {
      method: 'PUT',
      userId: actor.id,
      sessionId,
      body: updates,
    });
    void EnterpriseAuditService.logEvent({
      companyId: actor.defaultCompanyId || 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: 'OPTIONAL_SCOPE_SETTINGS',
      eventType: 'ZERO_TRUST_OPTIONAL_SCOPE_UPDATED',
      eventDescription: `Optional security scopes updated (Page=${res.pageLevelEnabled}, User=${res.userLevelEnabled})`,
      newValue: res,
      changedByUserId: actor.id,
      changedByName: actor.fullName,
      changeReason: updates.reason,
      source: 'UI',
    });
    return res;
  },

  async upsertScopedPolicy(
    actor: User,
    sessionId: string,
    payload: {
      scopeLevel: ScopedSecurityPolicyConfig['scopeLevel'];
      scopeRefId: string;
      scopeLabel?: string;
      companyId?: string;
      branchId?: string;
      moduleKey?: string;
      pageKey?: string;
      userId?: string;
      isActive?: boolean;
      controls?: Partial<
        Record<
          SecurityControlKey,
          { state: ScopedSecurityPolicyConfig['controls'][SecurityControlKey]['state']; rationale?: string }
        >
      >;
      parameters?: Partial<SecurityPolicyParameters>;
      changeReason: string;
      triggersRevalidation?: boolean;
    }
  ): Promise<ScopedSecurityPolicyConfig> {
    const saved = await apiRequest<ScopedSecurityPolicyConfig>('/policies', {
      method: 'PUT',
      userId: actor.id,
      sessionId,
      body: payload,
    });
    void EnterpriseAuditService.logEvent({
      companyId: payload.companyId || actor.defaultCompanyId || 'co-kosh-01',
      branchId: payload.branchId,
      entityType: 'SECURITY',
      entityId: saved.id,
      eventType: 'ZERO_TRUST_POLICY_SAVED',
      eventDescription: `Saved ${saved.scopeLevel} Zero-Trust policy [${saved.scopeLabel}] v${saved.version}`,
      newValue: { version: saved.version, scopeLevel: saved.scopeLevel, scopeRefId: saved.scopeRefId },
      changedByUserId: actor.id,
      changedByName: actor.fullName,
      changeReason: payload.changeReason,
      source: 'UI',
    });
    return saved;
  },

  async getMasterStatus(): Promise<{ enabled: boolean; version: number; updatedAt: string; updatedByName: string; effectiveRuntimeStatus: string }> {
    return apiRequest<{ enabled: boolean; version: number; updatedAt: string; updatedByName: string; effectiveRuntimeStatus: string }>('/master-status');
  },

  async updateMasterStatus(actor: User, sessionId: string, enabled: boolean, reason: string): Promise<any> {
    return apiRequest<any>('/master-status', {
      method: 'PUT',
      userId: actor.id,
      sessionId,
      body: { enabled, reason },
    });
  },

  async removeOptionalPolicy(
    actor: User,
    sessionId: string,
    scopeLevel: 'PAGE' | 'USER',
    scopeRefId: string,
    reason = 'Administrator removed optional override'
  ): Promise<{ removed: boolean }> {
    return apiRequest(
      `/policies/optional/${scopeLevel}/${encodeURIComponent(scopeRefId)}?reason=${encodeURIComponent(reason)}`,
      { method: 'DELETE', userId: actor.id, sessionId }
    );
  },

  async evaluateEffectivePolicy(params: {
    actorUserId: string;
    targetUserId?: string;
    companyId: string;
    branchId: string;
    moduleKey: string;
    pageKey?: string;
    sessionId?: string;
  }): Promise<EffectiveSecurityPolicy> {
    const qs = new URLSearchParams({
      companyId: params.companyId,
      branchId: params.branchId,
      moduleKey: params.moduleKey,
      ...(params.pageKey ? { pageKey: params.pageKey } : {}),
      ...(params.targetUserId ? { targetUserId: params.targetUserId } : {}),
    });
    return apiRequest<EffectiveSecurityPolicy>(`/effective-policy?${qs.toString()}`, {
      userId: params.actorUserId,
      sessionId: params.sessionId,
    });
  },

  async sendSessionHeartbeat(payload: {
    sessionId: string;
    userId: string;
    companyId: string;
    branchId: string;
    moduleKey: string;
    pageKey?: string;
    browserFamily: string;
    browserVersion: string;
    browserCompliant: boolean;
    secureContext: boolean;
    webcamMonitoringActive?: boolean;
    webcamBackend?: string;
  }): Promise<{ session: SessionProtectionState; effectivePolicy: EffectiveSecurityPolicy }> {
    return apiRequest('/sessions/heartbeat', {
      method: 'POST',
      userId: payload.userId,
      sessionId: payload.sessionId,
      body: payload,
    });
  },

  async triggerBlackout(
    actor: User,
    sessionId: string,
    payload: {
      reason: string;
      severity: SecuritySeverity;
      action: 'BLACKOUT_LOCKED' | 'SUSPENDED' | 'TERMINATED';
      durationSeconds?: number;
      createIncident?: boolean;
    }
  ): Promise<{ session: SessionProtectionState; incident?: SecurityIncidentRecord }> {
    return apiRequest(`/sessions/${encodeURIComponent(sessionId)}/suspend`, {
      method: 'POST',
      userId: actor.id,
      sessionId,
      body: payload,
    });
  },

  async reauthenticateSession(
    actor: User,
    sessionId: string,
    reason: string,
    verificationCode: string
  ): Promise<SessionProtectionState> {
    return apiRequest(`/sessions/${encodeURIComponent(sessionId)}/reauth`, {
      method: 'POST',
      userId: actor.id,
      sessionId,
      body: { reason, verificationCode },
    });
  },

  async adminOverrideBlackout(
    actor: User,
    actorSessionId: string,
    targetSessionId: string,
    reason: string
  ): Promise<SessionProtectionState> {
    return apiRequest(`/sessions/${encodeURIComponent(targetSessionId)}/override`, {
      method: 'POST',
      userId: actor.id,
      sessionId: actorSessionId,
      body: { reason },
    });
  },

  async recordBrowserEvaluation(
    actor: User,
    sessionId: string,
    payload: BrowserComplianceEvaluation & {
      companyId: string;
      branchId: string;
      moduleKey: string;
      sessionId: string;
    }
  ): Promise<BrowserComplianceEvaluation> {
    return apiRequest('/browser/evaluate', {
      method: 'POST',
      userId: actor.id,
      sessionId,
      body: payload,
    });
  },

  async recordEvent(
    actor: User,
    sessionId: string,
    payload: Omit<SecurityEventRecord, 'id' | 'timestamp' | 'policyVersion' | 'userId' | 'userName' | 'resolutionStatus'> & {
      resolutionStatus?: SecurityEventRecord['resolutionStatus'];
    }
  ): Promise<{ event: SecurityEventRecord; incident?: SecurityIncidentRecord }> {
    return apiRequest('/events', {
      method: 'POST',
      userId: actor.id,
      sessionId,
      body: payload,
    });
  },

  async listExceptions(companyId?: string): Promise<PolicyExceptionRecord[]> {
    const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    return apiRequest(`/exceptions${q}`);
  },

  async requestException(
    actor: User,
    sessionId: string,
    payload: {
      companyId: string;
      branchId?: string;
      moduleKey?: string;
      pageKey?: string;
      targetUserId?: string;
      scopeLevel: PolicyExceptionRecord['scopeLevel'];
      scopeRefId: string;
      controlKey: SecurityControlKey;
      reason: string;
      startDate: string;
      expiryDate: string;
    }
  ): Promise<PolicyExceptionRecord> {
    return apiRequest('/exceptions', {
      method: 'POST',
      userId: actor.id,
      sessionId,
      body: payload,
    });
  },

  async decideException(
    actor: User,
    sessionId: string,
    exceptionId: string,
    decision: 'APPROVED' | 'REJECTED' | 'REVOKED',
    decisionNotes: string
  ): Promise<PolicyExceptionRecord> {
    return apiRequest(`/exceptions/${encodeURIComponent(exceptionId)}/decide`, {
      method: 'POST',
      userId: actor.id,
      sessionId,
      body: { decision, decisionNotes },
    });
  },

  async listSessions(companyId?: string): Promise<SessionProtectionState[]> {
    const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    return apiRequest(`/sessions${q}`);
  },

  async listBrowserCompliance(): Promise<BrowserComplianceEvaluation[]> {
    return apiRequest('/browser/compliance');
  },

  async listEvents(companyId?: string): Promise<SecurityEventRecord[]> {
    const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    return apiRequest(`/events${q}`);
  },

  async listIncidents(companyId?: string): Promise<SecurityIncidentRecord[]> {
    const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    return apiRequest(`/incidents${q}`);
  },

  async createIncident(
    actor: User,
    sessionId: string,
    payload: {
      title: string;
      category: SecurityIncidentRecord['category'];
      severity: SecuritySeverity;
      companyId: string;
      branchId: string;
      moduleKey: string;
      affectedUserId: string;
    }
  ): Promise<SecurityIncidentRecord> {
    return apiRequest('/incidents', {
      method: 'POST',
      userId: actor.id,
      sessionId,
      body: payload,
    });
  },

  async updateIncident(
    actor: User,
    sessionId: string,
    incidentId: string,
    payload: {
      action: 'ASSIGNED' | 'INVESTIGATED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CLOSED' | 'CLASSIFIED';
      severity?: SecuritySeverity;
      assignedToUserId?: string;
      note: string;
    }
  ): Promise<SecurityIncidentRecord> {
    return apiRequest(`/incidents/${encodeURIComponent(incidentId)}`, {
      method: 'PATCH',
      userId: actor.id,
      sessionId,
      body: payload,
    });
  },

  async listRegistry(): Promise<SoftwareModelRegistryItem[]> {
    return apiRequest('/registry');
  },

  async listAuditHistory(companyId?: string): Promise<SecurityAuditHistoryEntry[]> {
    const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    return apiRequest(`/audit${q}`);
  },

  async getSystemHealth(): Promise<any> {
    return apiRequest('/health');
  },

  async authorizeOperation(
    actor: User,
    sessionId: string,
    payload: {
      companyId: string;
      branchId: string;
      moduleKey: string;
      pageKey?: string;
      operation: 'VIEW_SCREEN' | 'EXPORT_DATA' | 'REVEAL_SENSITIVE' | 'MODIFY_BUSINESS_RECORD';
      exportRowCount?: number;
    }
  ): Promise<{ allowed: boolean; policyVersion: number }> {
    return apiRequest('/authorize', {
      method: 'POST',
      userId: actor.id,
      sessionId,
      body: payload,
    });
  },
};
