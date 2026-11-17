/**
 * KOSH INNOVATIONS — DETERMINISTIC ZERO-TRUST POLICY EVALUATION ENGINE
 * Evaluates policies in exact order:
 *   GLOBAL -> COMPANY -> BRANCH -> MODULE -> [OPTIONAL PAGE/SCREEN] -> [OPTIONAL USER]
 * Enforces:
 * - Unconfigured !== Disabled (inherits parent cleanly)
 * - No simplistic last-write-wins: mandatory parent restrictions cannot be weakened by lower scopes
 * - Optional Page/Screen and User levels are independently toggleable and non-blocking when disabled
 * - Time-limited approved exceptions override only within valid [startDate, expiryDate] and expire automatically
 * - Full provenance trace per security control
 */

import type { UserRole } from '../types';
import {
  EffectiveControlResolution,
  EffectiveSecurityPolicy,
  OptionalScopeSettings,
  PolicyControlState,
  PolicyExceptionRecord,
  PolicyScopeTraceStep,
  ScopedSecurityPolicyConfig,
  SECURITY_CONTROL_METADATA,
  SecurityControlKey,
  SecurityControlRule,
  SecurityPolicyParameters,
} from '../types/zeroTrustSecurity';

export const ALL_SECURITY_CONTROL_KEYS: SecurityControlKey[] = [
  'browserRestriction',
  'watermark',
  'clipboardControl',
  'focusProtection',
  'webcamMonitoring',
  'blackoutResponse',
  'sessionTimeout',
  'sensitiveFieldMasking',
  'screenAccessRestriction',
  'securityEventMonitoring',
  'exportRestrictions',
  'exceptionApproval',
];

export const DEFAULT_SECURITY_PARAMETERS: SecurityPolicyParameters = {
  watermark: {
    position: 'TILED',
    opacity: 0.14,
    fontSizePx: 12,
    rotationDeg: -28,
    density: 'MEDIUM',
    fontStyle: 'MONO',
    colorHex: '#334155',
    refreshIntervalMs: 30000,
    pattern: 'DIAGONAL_GRID',
    confidentialityClassification: 'CONFIDENTIAL',
    includeUsername: true,
    includeEmployeeId: true,
    includeCompany: true,
    includeBranch: true,
    includeTimestamp: true,
    includeSessionRef: true,
    includeScreenRef: true,
  },
  browserGovernance: {
    approvedFamilies: ['MICROSOFT_EDGE', 'GOOGLE_CHROME'],
    minimumVersions: {
      MICROSOFT_EDGE: 110,
      GOOGLE_CHROME: 110,
    },
    blockUnsupportedBrowsers: true,
    requireSecureContext: false, // Allows localhost HTTP dev while flagging in telemetry unless toggled strict
    requireManagedBrowserEvaluation: true,
    allowedAccessDecision: 'RESTRICT_SENSITIVE',
  },
  clipboard: {
    blockCopy: true,
    blockCut: true,
    blockPaste: false, // Preserve normal data entry unless restricted at narrower scope
    blockClipboardRead: true,
    blockClipboardWrite: true,
    blockContextMenu: true,
    blockSensitiveFieldCopy: true,
    allowControlledAppCopy: true,
    blockPrintShortcut: true,
    blockTextSelection: false,
  },
  visual: {
    blurOnFocusLoss: true,
    blurIntensityPx: 8,
    maskSensitiveFields: true,
    lockScreenOnVisibilityHide: false,
    monitorVisibilityChange: true,
    monitorWindowBlur: true,
    monitorPageHide: true,
    showConfidentialityBanner: true,
    visualDeterrencePattern: 'NONE',
    focusLossAction: 'BLUR',
  },
  webcamAi: {
    enabled: false, // Opt-in at Global/Company/Branch/Module or optional scope with explicit consent
    confidenceThreshold: 0.62,
    persistenceFrames: 3,
    escalationWindowSeconds: 20,
    fps: 0.5,
    cooldownSeconds: 15,
    requireCameraPermission: true,
    blockProtectedScreensOnDenial: false,
    targetClasses: ['cell phone', 'laptop', 'tv', 'remote'],
    preferredBackend: 'auto',
    riskOnSingleDetection: 'LOW',
    riskOnPersistentDetection: 'HIGH',
    actionOnPersistentDetection: 'BLUR',
  },
  blackout: {
    durationSeconds: 300,
    allowReauthRecovery: true,
    allowAdminOverride: true,
    autoSuspendApiOnCritical: true,
    terminateAfterViolations: 5,
  },
  exportControl: {
    requireAuthorizedPermission: true,
    blockUnauthorizedExport: true,
    requireWatermarkMetadata: true,
    maxRowsWithoutSecondaryApproval: 5000,
  },
  session: {
    inactivityTimeoutMinutes: 30,
    maxSessionDurationMinutes: 480,
    revalidateOnPolicyChange: true,
    autoSuspendOnCriticalEvent: true,
  },
};

export function createInheritedControlsMap(
  overrides: Partial<Record<SecurityControlKey, SecurityControlRule>> = {}
): Record<SecurityControlKey, SecurityControlRule> {
  const map = {} as Record<SecurityControlKey, SecurityControlRule>;
  for (const key of ALL_SECURITY_CONTROL_KEYS) {
    map[key] = overrides[key] || { state: 'INHERIT' };
  }
  return map;
}

function deepMergeParameters(
  base: SecurityPolicyParameters,
  patch?: Partial<SecurityPolicyParameters>
): SecurityPolicyParameters {
  if (!patch) return JSON.parse(JSON.stringify(base));
  return {
    watermark: { ...base.watermark, ...(patch.watermark || {}) },
    browserGovernance: {
      ...base.browserGovernance,
      ...(patch.browserGovernance || {}),
      minimumVersions: {
        ...base.browserGovernance.minimumVersions,
        ...(patch.browserGovernance?.minimumVersions || {}),
      },
    },
    clipboard: { ...base.clipboard, ...(patch.clipboard || {}) },
    visual: { ...base.visual, ...(patch.visual || {}) },
    webcamAi: { ...base.webcamAi, ...(patch.webcamAi || {}) },
    blackout: { ...base.blackout, ...(patch.blackout || {}) },
    exportControl: { ...base.exportControl, ...(patch.exportControl || {}) },
    session: { ...base.session, ...(patch.session || {}) },
  };
}

function stateToBoolean(state: PolicyControlState): boolean {
  return state === 'ENABLED' || state === 'MANDATORY';
}

function isWeakeningAttempt(state: PolicyControlState): boolean {
  return state === 'DISABLED' || state === 'OPTIONAL' || state === 'NOT_APPLICABLE';
}

export interface PolicyEvaluationInput {
  context: {
    userId: string;
    userName: string;
    userRole: UserRole;
    companyId: string;
    companyName: string;
    branchId: string;
    branchName: string;
    moduleKey: string;
    pageKey?: string;
  };
  optionalScopes: OptionalScopeSettings;
  globalPolicy: ScopedSecurityPolicyConfig;
  companyPolicy?: ScopedSecurityPolicyConfig;
  branchPolicy?: ScopedSecurityPolicyConfig;
  modulePolicy?: ScopedSecurityPolicyConfig;
  pagePolicy?: ScopedSecurityPolicyConfig;
  userPolicy?: ScopedSecurityPolicyConfig;
  exceptions: PolicyExceptionRecord[];
  cacheVersion: number;
  nowIso?: string;
}

export function buildPolicyCacheKey(input: {
  companyId: string;
  branchId: string;
  moduleKey: string;
  pageKey?: string;
  userId: string;
  pageLevelEnabled: boolean;
  userLevelEnabled: boolean;
  policyVersion: number;
  cacheVersion: number;
}): string {
  const pKey = input.pageLevelEnabled ? input.pageKey || 'NONE' : 'OPT_PAGE_OFF';
  const uKey = input.userLevelEnabled ? input.userId : 'OPT_USER_OFF';
  return `ztp:v${input.policyVersion}:c${input.cacheVersion}:${input.companyId}:${input.branchId}:${input.moduleKey}:${pKey}:${uKey}`;
}

export function evaluateEffectiveSecurityPolicy(input: PolicyEvaluationInput): EffectiveSecurityPolicy {
  const nowIso = input.nowIso || new Date().toISOString();
  const nowMs = new Date(nowIso).getTime();

  // Collect ordered scope chain
  const orderedScopes: Array<{
    level: 'GLOBAL' | 'COMPANY' | 'BRANCH' | 'MODULE' | 'PAGE' | 'USER';
    refId: string;
    label: string;
    policy?: ScopedSecurityPolicyConfig;
    skippedBecauseOptionalDisabled?: boolean;
  }> = [
    {
      level: 'GLOBAL',
      refId: 'GLOBAL',
      label: input.globalPolicy.scopeLabel,
      policy: input.globalPolicy,
    },
    {
      level: 'COMPANY',
      refId: input.context.companyId,
      label: input.companyPolicy?.scopeLabel || `${input.context.companyName} (Inherited)`,
      policy: input.companyPolicy?.isActive ? input.companyPolicy : undefined,
    },
    {
      level: 'BRANCH',
      refId: input.context.branchId,
      label: input.branchPolicy?.scopeLabel || `${input.context.branchName} (Inherited)`,
      policy: input.branchPolicy?.isActive ? input.branchPolicy : undefined,
    },
    {
      level: 'MODULE',
      refId: input.context.moduleKey,
      label: input.modulePolicy?.scopeLabel || `${input.context.moduleKey} (Inherited)`,
      policy: input.modulePolicy?.isActive ? input.modulePolicy : undefined,
    },
    {
      level: 'PAGE',
      refId: input.context.pageKey || 'UNSPECIFIED_PAGE',
      label: input.pagePolicy?.scopeLabel || input.context.pageKey || 'Optional Page/Screen',
      policy: input.optionalScopes.pageLevelEnabled && input.pagePolicy?.isActive ? input.pagePolicy : undefined,
      skippedBecauseOptionalDisabled: !input.optionalScopes.pageLevelEnabled,
    },
    {
      level: 'USER',
      refId: input.context.userId,
      label: input.userPolicy?.scopeLabel || input.context.userName,
      policy: input.optionalScopes.userLevelEnabled && input.userPolicy?.isActive ? input.userPolicy : undefined,
      skippedBecauseOptionalDisabled: !input.optionalScopes.userLevelEnabled,
    },
  ];

  // Aggregate highest version in active chain
  let maxVersion = input.globalPolicy.version || 1;
  for (const s of orderedScopes) {
    if (s.policy && s.policy.version > maxVersion) {
      maxVersion = s.policy.version;
    }
  }

  // Merge parameters deterministically along active chain
  let effectiveParameters = deepMergeParameters(DEFAULT_SECURITY_PARAMETERS, input.globalPolicy.parameters);
  for (const s of orderedScopes.slice(1)) {
    if (s.policy && !s.skippedBecauseOptionalDisabled) {
      effectiveParameters = deepMergeParameters(effectiveParameters, s.policy.parameters);
    }
  }

  // Identify matching exceptions (both active & recently expired for provenance display)
  const activeExceptions: PolicyExceptionRecord[] = [];
  const expiredExceptionsByControl = new Map<SecurityControlKey, PolicyExceptionRecord>();

  for (const exc of input.exceptions) {
    if (exc.companyId !== input.context.companyId) continue;
    if (exc.branchId && exc.branchId !== 'ALL' && exc.branchId !== input.context.branchId) continue;
    if (exc.moduleKey && exc.moduleKey !== 'ALL' && exc.moduleKey !== input.context.moduleKey) continue;
    if (exc.pageKey && (!input.optionalScopes.pageLevelEnabled || exc.pageKey !== input.context.pageKey)) continue;
    if (exc.targetUserId && exc.targetUserId !== input.context.userId) continue;

    if (exc.status !== 'APPROVED') continue;

    const startMs = new Date(exc.startDate).getTime();
    const expMs = new Date(exc.expiryDate).getTime();
    if (nowMs >= startMs && nowMs <= expMs) {
      activeExceptions.push(exc);
    } else if (nowMs > expMs) {
      expiredExceptionsByControl.set(exc.controlKey, exc);
    }
  }

  const controls = {} as Record<SecurityControlKey, EffectiveControlResolution>;

  for (const key of ALL_SECURITY_CONTROL_KEYS) {
    const meta = SECURITY_CONTROL_METADATA[key];
    const trace: PolicyScopeTraceStep[] = [];

    // Baseline fallback if Global itself had INHERIT
    let currentValue = meta.defaultMandatory;
    let currentMode: PolicyControlState = meta.defaultMandatory ? 'MANDATORY' : 'OPTIONAL';
    let sourceLevel: EffectiveControlResolution['sourceLevel'] = 'GLOBAL';
    let sourceConfigurationId = input.globalPolicy.id;
    let sourceLabel = input.globalPolicy.scopeLabel;
    let isLockedMandatory = false;
    let overrideStatus: EffectiveControlResolution['overrideStatus'] = 'DEFAULT';

    for (const scope of orderedScopes) {
      if (scope.skippedBecauseOptionalDisabled) {
        trace.push({
          scopeLevel: scope.level,
          scopeRefId: scope.refId,
          scopeLabel: scope.label,
          configuredState: 'SKIPPED_OPTIONAL_DISABLED',
          applied: false,
          note: `Optional ${scope.level} configuration is disabled; safely inheriting parent policy.`,
        });
        continue;
      }

      if (!scope.policy) {
        trace.push({
          scopeLevel: scope.level,
          scopeRefId: scope.refId,
          scopeLabel: scope.label,
          configuredState: 'UNCONFIGURED',
          applied: false,
          note: `No explicit ${scope.level} record present; inheriting parent configuration.`,
        });
        continue;
      }

      const rule = scope.policy.controls[key];
      if (!rule || rule.state === 'INHERIT') {
        trace.push({
          scopeLevel: scope.level,
          scopeRefId: scope.refId,
          scopeLabel: scope.label,
          configuredState: 'INHERIT',
          applied: false,
          note: `${scope.level} explicitly set to INHERIT.`,
        });
        continue;
      }

      // Check parent mandatory lock invariant (never allow lower scope to weaken a mandatory restriction)
      if (isLockedMandatory && isWeakeningAttempt(rule.state)) {
        overrideStatus = 'LOCKED_BY_PARENT';
        trace.push({
          scopeLevel: scope.level,
          scopeRefId: scope.refId,
          scopeLabel: scope.label,
          configuredState: rule.state,
          applied: false,
          note: `Blocked weakening (${rule.state}): ${sourceLevel} marked control MANDATORY.`,
        });
        continue;
      }

      // Apply explicit configuration
      currentMode = rule.state;
      currentValue = stateToBoolean(rule.state);
      sourceLevel = scope.level;
      sourceConfigurationId = scope.policy.id;
      sourceLabel = scope.label;
      if (rule.state === 'MANDATORY') {
        isLockedMandatory = true;
      }
      overrideStatus = scope.level === 'GLOBAL' ? 'INHERITED' : 'OVERRIDDEN';

      trace.push({
        scopeLevel: scope.level,
        scopeRefId: scope.refId,
        scopeLabel: scope.label,
        configuredState: rule.state,
        applied: true,
        note:
          rule.state === 'MANDATORY'
            ? `Applied MANDATORY lock from ${scope.level}. Lower scopes cannot weaken.`
            : `Applied ${rule.state} from ${scope.level}.`,
      });
    }

    // Check active vs expired exception
    const activeExc = activeExceptions.find((e) => e.controlKey === key);
    const expiredExc = expiredExceptionsByControl.get(key);
    let exceptionStatus: EffectiveControlResolution['exceptionStatus'] = 'NONE';
    let exceptionId: string | undefined;

    if (activeExc) {
      exceptionStatus = 'ACTIVE_EXCEPTION';
      exceptionId = activeExc.id;
      currentMode = 'AUTHORIZED_EXCEPTION';
      currentValue = false; // Exception authorizes temporary relaxation of the restriction
      sourceLevel = 'EXCEPTION';
      sourceConfigurationId = activeExc.id;
      sourceLabel = `Exception #${activeExc.id} (Approver: ${activeExc.approverName || 'Admin'})`;
      overrideStatus = 'EXCEPTION_APPLIED';
      trace.push({
        scopeLevel: 'EXCEPTION',
        scopeRefId: activeExc.id,
        scopeLabel: sourceLabel,
        configuredState: 'AUTHORIZED_EXCEPTION',
        applied: true,
        note: `Time-limited exception active until ${activeExc.expiryDate}. Reason: ${activeExc.reason}`,
      });
    } else if (expiredExc) {
      exceptionStatus = 'EXPIRED_EXCEPTION';
      exceptionId = expiredExc.id;
      trace.push({
        scopeLevel: 'EXCEPTION',
        scopeRefId: expiredExc.id,
        scopeLabel: `Expired Exception #${expiredExc.id}`,
        configuredState: 'NOT_APPLICABLE',
        applied: false,
        note: `Exception expired at ${expiredExc.expiryDate}; automatically reverted to parent policy.`,
      });
    }

    controls[key] = {
      controlKey: key,
      label: meta.label,
      effectiveValue: currentValue,
      effectiveMode: currentMode,
      sourceLevel,
      sourceConfigurationId,
      sourceLabel,
      mandatoryStatus: isLockedMandatory && !activeExc,
      overrideStatus,
      exceptionStatus,
      exceptionId,
      policyVersion: maxVersion,
      trace,
    };
  }

  // Synchronize effective boolean controls into effectiveParameters where needed
  effectiveParameters.webcamAi.enabled = controls.webcamMonitoring.effectiveValue;

  const cacheKey = buildPolicyCacheKey({
    companyId: input.context.companyId,
    branchId: input.context.branchId,
    moduleKey: input.context.moduleKey,
    pageKey: input.context.pageKey,
    userId: input.context.userId,
    pageLevelEnabled: input.optionalScopes.pageLevelEnabled,
    userLevelEnabled: input.optionalScopes.userLevelEnabled,
    policyVersion: maxVersion,
    cacheVersion: input.cacheVersion,
  });

  return {
    evaluationId: `eval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    evaluatedAt: nowIso,
    cacheKey,
    cacheVersion: input.cacheVersion,
    policyVersion: maxVersion,
    optionalScopes: { ...input.optionalScopes },
    context: { ...input.context },
    controls,
    effectiveParameters,
    activeExceptions,
  };
}
