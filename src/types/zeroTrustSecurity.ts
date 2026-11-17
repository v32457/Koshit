/**
 * KOSH INNOVATIONS — ENTERPRISE ZERO-TRUST VISUAL DATA PROTECTION & LEAKAGE PREVENTION ENGINE
 * Shared Domain Model, Policy Hierarchy, Inheritance, Exception, Telemetry, and Enforcement Types.
 */

import type { UserRole } from './index';

export type SecurityScopeLevel =
  | 'GLOBAL'
  | 'COMPANY'
  | 'BRANCH'
  | 'MODULE'
  | 'PAGE'
  | 'USER';

export type PolicyControlState =
  | 'INHERIT'
  | 'ENABLED'
  | 'DISABLED'
  | 'MANDATORY'
  | 'OPTIONAL'
  | 'NOT_APPLICABLE'
  | 'AUTHORIZED_EXCEPTION';

export type SecurityControlKey =
  | 'browserRestriction'
  | 'watermark'
  | 'clipboardControl'
  | 'focusProtection'
  | 'webcamMonitoring'
  | 'blackoutResponse'
  | 'sessionTimeout'
  | 'sensitiveFieldMasking'
  | 'screenAccessRestriction'
  | 'securityEventMonitoring'
  | 'exportRestrictions'
  | 'exceptionApproval';

export type SecuritySeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type BlackoutResponseAction =
  | 'WARNING'
  | 'BLUR'
  | 'HIDE_FIELDS'
  | 'LOCK_SCREEN'
  | 'SUSPEND_API'
  | 'REAUTH_REQUIRED'
  | 'TERMINATE_SESSION';

export type WatermarkPosition = 'TILED' | 'CENTER' | 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT';
export type WatermarkPattern = 'DIAGONAL_GRID' | 'CROSS_HATCH' | 'HORIZON_BANDS' | 'CORNER_STAMP';
export type ConfidentialityLevel = 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED' | 'HIGHLY_CONFIDENTIAL';

export interface WatermarkConfig {
  position: WatermarkPosition;
  opacity: number; // 0.05 to 0.45
  fontSizePx: number; // 10 to 24
  rotationDeg: number; // -45 to 45
  density: 'LOW' | 'MEDIUM' | 'HIGH';
  fontStyle: 'MONO' | 'SANS' | 'SERIF';
  colorHex: string;
  refreshIntervalMs: number;
  pattern: WatermarkPattern;
  confidentialityClassification: ConfidentialityLevel;
  includeUsername: boolean;
  includeEmployeeId: boolean;
  includeCompany: boolean;
  includeBranch: boolean;
  includeTimestamp: boolean;
  includeSessionRef: boolean;
  includeScreenRef: boolean;
}

export interface BrowserGovernanceConfig {
  approvedFamilies: ('MICROSOFT_EDGE' | 'GOOGLE_CHROME')[];
  minimumVersions: {
    MICROSOFT_EDGE: number;
    GOOGLE_CHROME: number;
  };
  blockUnsupportedBrowsers: boolean;
  requireSecureContext: boolean;
  requireManagedBrowserEvaluation: boolean;
  allowedAccessDecision: 'ALLOW' | 'WARN_ONLY' | 'RESTRICT_SENSITIVE' | 'BLACKOUT_BLOCK';
}

export interface ClipboardProtectionConfig {
  blockCopy: boolean;
  blockCut: boolean;
  blockPaste: boolean;
  blockClipboardRead: boolean;
  blockClipboardWrite: boolean;
  blockContextMenu: boolean;
  blockSensitiveFieldCopy: boolean;
  allowControlledAppCopy: boolean;
  blockPrintShortcut: boolean;
  blockTextSelection: boolean;
}

export interface VisualProtectionConfig {
  blurOnFocusLoss: boolean;
  blurIntensityPx: number;
  maskSensitiveFields: boolean;
  lockScreenOnVisibilityHide: boolean;
  monitorVisibilityChange: boolean;
  monitorWindowBlur: boolean;
  monitorPageHide: boolean;
  showConfidentialityBanner: boolean;
  visualDeterrencePattern: 'NONE' | 'SUBTLE_SCANLINE' | 'MICRO_GRID';
  focusLossAction: BlackoutResponseAction;
}

export interface WebcamAiDetectionConfig {
  enabled: boolean;
  confidenceThreshold: number; // 0.35 - 0.95
  persistenceFrames: number; // consecutive detections required before escalation
  escalationWindowSeconds: number;
  fps: number; // 0.2 to 2 FPS (avoid unnecessary full-res inference)
  cooldownSeconds: number;
  requireCameraPermission: boolean;
  blockProtectedScreensOnDenial: boolean;
  targetClasses: string[]; // e.g., ['cell phone', 'laptop', 'tv', 'remote']
  preferredBackend: 'auto' | 'webgpu' | 'webgl' | 'wasm' | 'cpu';
  riskOnSingleDetection: SecuritySeverity;
  riskOnPersistentDetection: SecuritySeverity;
  actionOnPersistentDetection: BlackoutResponseAction;
}

export interface BlackoutPolicyConfig {
  durationSeconds: number;
  allowReauthRecovery: boolean;
  allowAdminOverride: boolean;
  autoSuspendApiOnCritical: boolean;
  terminateAfterViolations: number;
}

export interface ExportControlConfig {
  requireAuthorizedPermission: boolean;
  blockUnauthorizedExport: boolean;
  requireWatermarkMetadata: boolean;
  maxRowsWithoutSecondaryApproval: number;
}

export interface SessionProtectionPolicyConfig {
  inactivityTimeoutMinutes: number;
  maxSessionDurationMinutes: number;
  revalidateOnPolicyChange: boolean;
  autoSuspendOnCriticalEvent: boolean;
}

export interface SecurityControlRule {
  state: PolicyControlState;
  isMandatoryByParent?: boolean;
  rationale?: string;
}

export interface SecurityPolicyParameters {
  watermark: WatermarkConfig;
  browserGovernance: BrowserGovernanceConfig;
  clipboard: ClipboardProtectionConfig;
  visual: VisualProtectionConfig;
  webcamAi: WebcamAiDetectionConfig;
  blackout: BlackoutPolicyConfig;
  exportControl: ExportControlConfig;
  session: SessionProtectionPolicyConfig;
}

export interface ScopedSecurityPolicyConfig {
  id: string;
  scopeLevel: SecurityScopeLevel;
  scopeRefId: string; // 'GLOBAL', companyId, branchId, moduleKey, pageKey, userId
  scopeLabel: string;
  companyId?: string;
  branchId?: string;
  moduleKey?: string;
  pageKey?: string;
  userId?: string;
  isActive: boolean;
  version: number;
  controls: Record<SecurityControlKey, SecurityControlRule>;
  parameters: Partial<SecurityPolicyParameters>;
  updatedAt: string;
  updatedById: string;
  updatedByName: string;
  changeReason: string;
}

export interface OptionalScopeSettings {
  pageLevelEnabled: boolean;
  userLevelEnabled: boolean;
  updatedAt: string;
  updatedBy: string;
  reason: string;
}

export interface PolicyExceptionRecord {
  id: string;
  companyId: string;
  branchId?: string;
  moduleKey?: string;
  pageKey?: string;
  targetUserId?: string;
  scopeLevel: SecurityScopeLevel;
  scopeRefId: string;
  controlKey: SecurityControlKey;
  requestedByUserId: string;
  requestedByName: string;
  approverUserId?: string;
  approverName?: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'REVOKED';
  startDate: string; // ISO
  expiryDate: string; // ISO
  createdAt: string;
  decidedAt?: string;
  decisionNotes?: string;
}

export interface PolicyScopeTraceStep {
  scopeLevel: SecurityScopeLevel | 'EXCEPTION';
  scopeRefId: string;
  scopeLabel: string;
  configuredState: PolicyControlState | 'SKIPPED_OPTIONAL_DISABLED' | 'UNCONFIGURED';
  applied: boolean;
  note: string;
}

export interface EffectiveControlResolution {
  controlKey: SecurityControlKey;
  label: string;
  effectiveValue: boolean;
  effectiveMode: PolicyControlState;
  sourceLevel: SecurityScopeLevel | 'EXCEPTION';
  sourceConfigurationId: string;
  sourceLabel: string;
  mandatoryStatus: boolean;
  overrideStatus:
    | 'DEFAULT'
    | 'INHERITED'
    | 'OVERRIDDEN'
    | 'LOCKED_BY_PARENT'
    | 'EXCEPTION_APPLIED'
    | 'OPTIONAL_DISABLED';
  exceptionStatus: 'NONE' | 'ACTIVE_EXCEPTION' | 'EXPIRED_EXCEPTION';
  exceptionId?: string;
  policyVersion: number;
  trace: PolicyScopeTraceStep[];
}

export interface EffectiveSecurityPolicy {
  evaluationId: string;
  evaluatedAt: string;
  cacheKey: string;
  cacheVersion: number;
  policyVersion: number;
  optionalScopes: OptionalScopeSettings;
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
  controls: Record<SecurityControlKey, EffectiveControlResolution>;
  effectiveParameters: SecurityPolicyParameters;
  activeExceptions: PolicyExceptionRecord[];
  degradedReason?: string;
}

export interface SecurityPolicyVersionSnapshot {
  id: string;
  version: number;
  scopeLevel: SecurityScopeLevel;
  scopeRefId: string;
  scopeLabel: string;
  changedById: string;
  changedByName: string;
  changedAt: string;
  changeReason: string;
  previousControls?: Record<SecurityControlKey, SecurityControlRule>;
  newControls: Record<SecurityControlKey, SecurityControlRule>;
  previousParameters?: Partial<SecurityPolicyParameters>;
  newParameters: Partial<SecurityPolicyParameters>;
  triggersRevalidation: boolean;
}

export type SecurityEventType =
  | 'UNSUPPORTED_BROWSER'
  | 'BROWSER_COMPLIANCE_FAILURE'
  | 'CLIPBOARD_VIOLATION'
  | 'PRINT_SHORTCUT_BLOCKED'
  | 'CONTEXT_MENU_BLOCKED'
  | 'SUSPICIOUS_VISUAL_DETECTION'
  | 'WEBCAM_PERMISSION_DENIED'
  | 'WEBCAM_HARDWARE_UNAVAILABLE'
  | 'AI_MODEL_LOAD_FAILURE'
  | 'REQUIRED_INIT_FAILURE'
  | 'FOCUS_VISIBILITY_EVENT'
  | 'BLACKOUT_TRIGGERED'
  | 'BLACKOUT_RECOVERED'
  | 'BLACKOUT_ADMIN_OVERRIDE'
  | 'SESSION_SUSPENDED'
  | 'SESSION_TERMINATED'
  | 'SESSION_REAUTHENTICATED'
  | 'UNAUTHORIZED_API_REQUEST'
  | 'CROSS_COMPANY_ACCESS_ATTEMPT'
  | 'CROSS_BRANCH_ACCESS_ATTEMPT'
  | 'SELF_POLICY_TAMPER_ATTEMPT'
  | 'POLICY_MODIFICATION'
  | 'POLICY_EXCEPTION_ACTION'
  | 'UNAUTHORIZED_DOWNLOAD'
  | 'UNAUTHORIZED_EXPORT'
  | 'SENSITIVE_FIELD_REVEALED';

export interface SecurityEventRecord {
  id: string;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  userId: string;
  userName: string;
  companyId: string;
  branchId: string;
  moduleKey: string;
  pageKey?: string;
  sessionId: string;
  policyVersion: number;
  timestamp: string;
  detectionSource:
    | 'BROWSER_GOVERNANCE'
    | 'WATERMARK_ENGINE'
    | 'VISUAL_PROTECTION'
    | 'CLIPBOARD_ENGINE'
    | 'WEBCAM_AI_ENGINE'
    | 'BLACKOUT_ENGINE'
    | 'BACKEND_ZERO_TRUST'
    | 'POLICY_ENGINE';
  actionTaken: string;
  resolutionStatus: 'OPEN' | 'ACKNOWLEDGED' | 'MITIGATED' | 'ESCALATED_TO_INCIDENT' | 'CLOSED';
  summary: string;
  metadata?: Record<string, string | number | boolean>; // Never stores frames/secrets/tokens
}

export interface SecurityIncidentNote {
  id: string;
  authorId: string;
  authorName: string;
  timestamp: string;
  action: 'CREATED' | 'CLASSIFIED' | 'ASSIGNED' | 'INVESTIGATED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CLOSED';
  note: string;
}

export interface SecurityIncidentRecord {
  id: string;
  incidentNumber: string;
  title: string;
  category:
    | 'DATA_LEAKAGE_RISK'
    | 'UNSUPPORTED_ENVIRONMENT'
    | 'UNAUTHORIZED_ACCESS'
    | 'DEVICE_DETECTION_ALERT'
    | 'CLIPBOARD_OR_EXPORT_BREACH'
    | 'POLICY_TAMPERING'
    | 'SESSION_ANOMALY';
  severity: SecuritySeverity;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  companyId: string;
  branchId: string;
  moduleKey: string;
  pageKey?: string;
  affectedUserId: string;
  affectedUserName: string;
  assignedToUserId?: string;
  assignedToName?: string;
  linkedEventIds: string[];
  policyVersion: number;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  resolutionSummary?: string;
  auditHistory: SecurityIncidentNote[];
}

export interface SessionProtectionState {
  sessionId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  companyId: string;
  branchId: string;
  moduleKey: string;
  pageKey?: string;
  browserFamily: string;
  browserVersion: string;
  browserCompliant: boolean;
  secureContext: boolean;
  protectionStatus: 'PROTECTED' | 'WARNING' | 'BLACKOUT_LOCKED' | 'SUSPENDED' | 'TERMINATED';
  blackoutActive: boolean;
  blackoutReason?: string;
  blackoutTriggeredAt?: string;
  blackoutUntil?: string;
  incidentRef?: string;
  watermarkSessionRef: string;
  webcamMonitoringActive: boolean;
  webcamBackend?: string;
  policyVersion: number;
  lastHeartbeatAt: string;
  createdAt: string;
}

export interface BrowserComplianceEvaluation {
  evaluatedAt: string;
  browserFamily: 'MICROSOFT_EDGE' | 'GOOGLE_CHROME' | 'FIREFOX' | 'SAFARI' | 'UNKNOWN_OR_OTHER';
  browserDisplayName: string;
  browserVersion: string;
  majorVersion: number | null;
  isApprovedFamily: boolean;
  meetsMinimumVersion: boolean;
  isSecureContext: boolean;
  capabilities: {
    canvas2d: boolean;
    mediaDevices: boolean;
    clipboardApi: boolean;
    visibilityApi: boolean;
    webGl: boolean;
    webGpu: boolean;
    webAssembly: boolean;
  };
  managedBrowserSignal: 'ENTERPRISE_POLICY_NOT_DETECTABLE_VIA_UA' | 'CLIENT_HINTS_PRESENT';
  compliant: boolean;
  decision: 'ALLOW' | 'WARN_ONLY' | 'RESTRICT_SENSITIVE' | 'BLACKOUT_BLOCK';
  reasons: string[];
  technicalLimitationNote: string;
}

export interface SoftwareModelRegistryItem {
  id: string;
  componentName: string;
  category: 'INFERENCE_RUNTIME' | 'AI_MODEL' | 'BACKEND_FRAMEWORK' | 'DATABASE_DRIVER' | 'FRONTEND_LIBRARY';
  version: string;
  officialSource: string;
  downloadSource: string;
  license: string;
  commercialUseAllowed: boolean;
  integrityVerification: string;
  sha256Digest?: string;
  installationStatus: 'INSTALLED' | 'PENDING' | 'FAILED';
  integrationStatus: 'INTEGRATED' | 'PENDING' | 'BLOCKED';
  configurationStatus: 'CONFIGURED' | 'PENDING';
  testStatus: 'PASSED' | 'PENDING' | 'FAILED' | 'NOT_RUN';
  vulnerabilityStatus: 'NO_KNOWN_CRITICAL' | 'REVIEW_REQUIRED' | 'UNSCANNED';
  lastVerifiedAt: string;
  notes: string;
}

export interface WebcamDetectionTelemetry {
  runtimeReady: boolean;
  backend: string;
  modelLoaded: boolean;
  modelName: string;
  cameraPermission: 'granted' | 'denied' | 'prompt' | 'unavailable' | 'idle';
  cameraActive: boolean;
  lastInferenceMs: number;
  avgInferenceMs: number;
  totalFramesProcessed: number;
  memoryMbEstimate: number | null;
  consecutivePhoneDetections: number;
  lastDetections: Array<{
    className: string;
    score: number;
    bbox: [number, number, number, number];
    riskLevel: SecuritySeverity;
  }>;
  lastError?: string;
}

export interface SecurityDashboardSnapshot {
  generatedAt: string;
  policyVersion: number;
  cacheVersion: number;
  optionalScopes: OptionalScopeSettings;
  counts: {
    companiesConfigured: number;
    branchesConfigured: number;
    modulesCovered: number;
    activePolicies: number;
    optionalPageConfigs: number;
    optionalUserConfigs: number;
    activeExceptions: number;
    pendingExceptions: number;
    activeProtectedSessions: number;
    suspendedSessions: number;
    blackoutLockedSessions: number;
    nonCompliantBrowsers: number;
    totalEvents: number;
    criticalEvents: number;
    openIncidents: number;
    resolvedIncidents: number;
  };
  webcamHealth: {
    policyEnabledCount: number;
    modelInstalled: boolean;
    modelVersion: string;
  };
  dependencyHealth: {
    totalComponents: number;
    installedCount: number;
    verifiedCount: number;
  };
  lastSecurityAuditAt: string;
  systemStatus: 'HEALTHY' | 'DEGRADED';
}

export const SECURITY_CONTROL_METADATA: Record<
  SecurityControlKey,
  { label: string; description: string; defaultMandatory: boolean }
> = {
  browserRestriction: {
    label: 'Approved Browser Governance',
    description: 'Restrict sensitive workspace access to approved Edge/Chrome versions & secure contexts.',
    defaultMandatory: true,
  },
  watermark: {
    label: 'Dynamic Forensic Watermark',
    description: 'Overlay identity-bound company, branch, user, session, and classification watermark.',
    defaultMandatory: true,
  },
  clipboardControl: {
    label: 'Clipboard & Context Protection',
    description: 'Control copy, cut, paste, context menu, and sensitive-field copy actions.',
    defaultMandatory: false,
  },
  focusProtection: {
    label: 'Focus, Visibility & Screen Deterrence',
    description: 'Monitor visibilitychange, blur, focus, and pagehide with configurable blur/lock.',
    defaultMandatory: false,
  },
  webcamMonitoring: {
    label: 'Webcam Local AI Device Detection',
    description: 'Optional local-only CV model inference to detect visible mobile phones/cameras.',
    defaultMandatory: false,
  },
  blackoutResponse: {
    label: 'Security Blackout & Re-Auth Engine',
    description: 'Coordinate frontend screen blackout with backend API/session suspension.',
    defaultMandatory: true,
  },
  sessionTimeout: {
    label: 'Session Inactivity & Revalidation',
    description: 'Enforce inactivity timeout, policy version revalidation, and session lifetime.',
    defaultMandatory: true,
  },
  sensitiveFieldMasking: {
    label: 'Sensitive Field Masking',
    description: 'Mask confidential financial, statutory, and contact fields unless explicitly revealed.',
    defaultMandatory: false,
  },
  screenAccessRestriction: {
    label: 'Protected Screen Access Gate',
    description: 'Verify RBAC, company/branch tenant isolation, and protection init before render.',
    defaultMandatory: true,
  },
  securityEventMonitoring: {
    label: 'Security Event & Incident Logging',
    description: 'Capture immutable zero-trust security telemetry and incident escalations.',
    defaultMandatory: true,
  },
  exportRestrictions: {
    label: 'Download, Print & Export Guard',
    description: 'Gate document exports, downloads, print shortcuts, and selection controls.',
    defaultMandatory: false,
  },
  exceptionApproval: {
    label: 'Time-Limited Exception Governance',
    description: 'Allow maker-checker approved, time-bounded overrides without weakening auditability.',
    defaultMandatory: false,
  },
};
