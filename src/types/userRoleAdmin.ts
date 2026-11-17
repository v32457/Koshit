/**
 * CIPPLATFORM — USER & ROLE ADMINISTRATION DOMAIN TYPES
 * Centralized Enterprise Identity, RBAC, Permission Registry, Organizational Scope,
 * Access Request Workflow, Temporary Access, Delegation, SoD, Session & Access Review Types.
 */

import type { UserRole } from './index';

export type ManagedUserType =
  | 'EMPLOYEE'
  | 'ADMINISTRATOR'
  | 'EXTERNAL_USER'
  | 'SUPPLIER_USER'
  | 'CUSTOMER_USER'
  | 'SERVICE_ACCOUNT'
  | 'CONTRACTOR';

export type EmployeeAssociationStatus = 'ASSOCIATED' | 'NOT_ASSOCIATED';

export type ManagedUserStatus =
  | 'PENDING_ACTIVATION'
  | 'ACTIVE'
  | 'LOCKED'
  | 'DEACTIVATED'
  | 'INACTIVE'
  | 'PENDING_APPROVAL'
  | 'INVITED'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'ARCHIVED';

export type MobileNumberType = 'OFFICIAL' | 'PERSONAL';

export type MobileVerificationStatus = 'NOT_VERIFIED' | 'PENDING' | 'VERIFIED' | 'FAILED';

export type PersonalConsentStatus =
  | 'NOT_REQUIRED_OFFICIAL'
  | 'PENDING_EMPLOYEE_CONSENT'
  | 'CONSENT_GRANTED'
  | 'CONSENT_DECLINED'
  | 'CONSENT_WITHDRAWN';

export type CommunicationPurpose =
  | 'ACCOUNT_ACTIVATION'
  | 'SECURITY_AUTH'
  | 'EMERGENCY_COMMS'
  | 'HR_EMPLOYEE'
  | 'OPERATIONAL_BUSINESS'
  | 'SMS_NOTIFICATIONS'
  | 'WHATSAPP_NOTIFICATIONS';

export interface EmployeeAssociationHistoryRecord {
  id: string;
  userId: string;
  username?: string;
  userName: string;
  employeeId?: string;
  companyId: string;
  previousStatus: EmployeeAssociationStatus;
  newStatus: EmployeeAssociationStatus;
  effectiveDate: string;
  reason: string;
  changedByUserId: string;
  changedByName: string;
  approvedByUserId?: string;
  approvedByName?: string;
  approvalReference?: string;
  offboardingActionsApplied?: {
    accountDeactivated: boolean;
    sessionsRevokedCount: number;
    assignmentsRevokedCount: number;
    tempAccessRevokedCount: number;
    delegationsRevokedCount: number;
  };
  revalidatedOrgAssignments?: Array<{
    roleCode: string;
    companyId: string;
    branchId?: string;
    scopeSummary: string;
  }>;
  timestamp: string;
}

export interface MobileConsentEvidenceRecord {
  id: string;
  userId: string;
  userName: string;
  employeeId?: string;
  companyId: string;
  countryCode: string;
  e164Number: string;
  mobileNumberType: MobileNumberType;
  action:
    | 'CONSENT_REQUESTED'
    | 'CONSENT_GRANTED'
    | 'CONSENT_DECLINED'
    | 'CONSENT_WITHDRAWN'
    | 'NUMBER_CHANGED_RESET'
    | 'ADMIN_OVERRIDE_BLOCKED';
  consentStatus: PersonalConsentStatus;
  consentVersion: string;
  consentMethod: 'EMPLOYEE_CONFIRMATION';
  approvedPurposes: CommunicationPurpose[];
  reason?: string;
  actorUserId: string;
  actorName: string;
  evidenceReference: string;
  requestChannel?: 'PORTAL_AND_EMAIL' | 'PORTAL_ONLY' | 'OFFLINE_LIMITED';
  timestamp: string;
}

export interface MobileNumberHistoryRecord {
  id: string;
  userId: string;
  countryCode: string;
  mobileNumber: string;
  e164Number: string;
  mobileNumberType: MobileNumberType;
  verificationStatus: MobileVerificationStatus;
  consentStatus: PersonalConsentStatus;
  consentVersion?: string;
  archivedReason: 'NUMBER_CHANGED' | 'TYPE_CHANGED' | 'CONSENT_WITHDRAWN' | 'ASSOCIATION_ENDED';
  archivedAt: string;
  archivedBy: string;
}

export interface CompanyMobilePolicyConfig {
  id: string;
  companyId: string; // 'GLOBAL' or specific companyId
  isMobileMandatoryOnOnboarding: boolean;
  allowPersonalMobile: boolean;
  requireOtpVerificationForOfficial: boolean;
  requireOtpVerificationForPersonal: boolean;
  requireVerifiedNumberBeforeComm: boolean;
  allowedPersonalPurposes: CommunicationPurpose[];
  activeConsentVersion: string;
  consentNoticeText: string;
  maskPersonalNumbersByDefault: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface SmsGatewayConfig {
  id: string;
  providerName: 'MSG91' | 'TWILIO' | 'AWS_SNS' | 'GUPSHUP_SMS';
  senderId: string;
  entityIdDlt?: string;
  isEnabled: boolean;
  environment: 'DEV' | 'UAT' | 'PROD';
  rateLimitPerMin: number;
  updatedAt: string;
  updatedBy: string;
}

export interface CommunicationDispatchDecision {
  allowed: boolean;
  blockedCode?:
    | 'NO_MOBILE_NUMBER'
    | 'INVALID_MOBILE_FORMAT'
    | 'EMPLOYEE_NOT_ASSOCIATED'
    | 'ACCOUNT_INACTIVE'
    | 'CHANNEL_DISABLED'
    | 'UNVERIFIED_MOBILE'
    | 'PERSONAL_CONSENT_REQUIRED'
    | 'PERSONAL_CONSENT_DECLINED'
    | 'PERSONAL_CONSENT_WITHDRAWN'
    | 'PURPOSE_NOT_CONSENTED'
    | 'PURPOSE_POLICY_DISABLED';
  reason: string;
  targetUserId?: string;
  e164Number?: string;
  mobileNumberType?: MobileNumberType;
  consentStatus?: PersonalConsentStatus;
  verificationStatus?: MobileVerificationStatus;
  auditEventId?: string;
}

export interface BlockedCommunicationAuditRecord {
  id: string;
  timestamp: string;
  channel: 'SMS' | 'WHATSAPP';
  purpose: CommunicationPurpose;
  targetUserId?: string;
  targetUserName?: string;
  maskedPhone: string;
  blockedCode: NonNullable<CommunicationDispatchDecision['blockedCode']>;
  reason: string;
  actorUserId: string;
  actorName: string;
  context?: string;
}

export type AuthenticationMethod =
  | 'PASSWORD_EMAIL_2FA'
  | 'PASSWORD_AUTHENTICATOR_MFA'
  | 'PASSWORD_ONLY'
  | 'API_TOKEN_SERVICE';

export type RoleCategory =
  | 'SYSTEM_ROLE'
  | 'ADMINISTRATOR_ROLE'
  | 'FUNCTIONAL_ROLE'
  | 'DEPARTMENT_ROLE'
  | 'OPERATIONAL_ROLE'
  | 'READ_ONLY_ROLE'
  | 'APPROVAL_ROLE'
  | 'CUSTOM_ROLE'
  | 'EXTERNAL_USER_ROLE';

export type RoleLifecycleStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'EXPIRED' | 'ARCHIVED';

export type PermissionActionType =
  | 'VIEW'
  | 'CREATE'
  | 'EDIT'
  | 'DELETE'
  | 'SUBMIT'
  | 'APPROVE'
  | 'REJECT'
  | 'CANCEL'
  | 'RELEASE'
  | 'POST'
  | 'EXPORT'
  | 'IMPORT'
  | 'PRINT'
  | 'CONFIGURE'
  | 'ASSIGN'
  | 'DELEGATE'
  | 'CLOSE'
  | 'REOPEN'
  | 'ADMIN_OVERRIDE';

export type DataScopeLevel =
  | 'OWN_RECORDS'
  | 'ASSIGNED_RECORDS'
  | 'DEPARTMENT_RECORDS'
  | 'BRANCH_RECORDS'
  | 'PURCHASE_ORG_RECORDS'
  | 'COMPANY_RECORDS'
  | 'ALL_AUTHORIZED_RECORDS'
  | 'READ_ONLY_RECORDS';

export interface RoleDefinition {
  id: string;
  roleCode: UserRole | string;
  roleName: string;
  description: string;
  category: RoleCategory;
  roleType: 'SYSTEM' | 'CUSTOM';
  parentRoleId?: string | null;
  status: RoleLifecycleStatus;
  isSystemProtected: boolean;
  isSuperAdmin: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  version: number;
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
  /** Directly granted permission codes on this role */
  explicitPermissionCodes: string[];
  /** Explicit restrictions overriding parent inheritance */
  restrictedPermissionCodes: string[];
  /** Default data scope assigned per permission or fallback */
  permissionScopes?: Record<string, DataScopeLevel>;
}

export interface RoleVersionHistoryRecord {
  id: string;
  roleId: string;
  roleCode: string;
  version: number;
  changedBy: string;
  changedAt: string;
  changeReason: string;
  snapshot: Pick<
    RoleDefinition,
    'roleName' | 'description' | 'parentRoleId' | 'status' | 'explicitPermissionCodes' | 'restrictedPermissionCodes'
  >;
}

export interface RegistryModuleEntry {
  id: string;
  moduleCode: string;
  moduleName: string;
  parentModuleCode?: string;
  description: string;
  routeReference: string;
  apiNamespace: string;
  moduleOwner: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DEPRECATED';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrySubmoduleEntry {
  id: string;
  submoduleCode: string;
  submoduleName: string;
  parentModuleId: string;
  parentModuleCode: string;
  description: string;
  routeReference: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DEPRECATED';
  version: number;
}

export interface RegistryFeatureEntry {
  id: string;
  featureCode: string;
  featureName: string;
  parentModuleId: string;
  parentModuleCode: string;
  parentSubmoduleId?: string;
  parentSubmoduleCode?: string;
  description: string;
  relatedApi: string;
  relatedService: string;
  requiredPermissionCodes: string[];
  validActions: PermissionActionType[];
  status: 'ACTIVE' | 'INACTIVE' | 'DEPRECATED';
  version: number;
  registeredAt: string;
}

export interface RegistryPermissionEntry {
  id: string;
  permissionCode: string; // e.g., PROCUREMENT.PURCHASE_REQUISITION.APPROVE
  legacyAliasKey?: string; // e.g., INVENTORY_VALIDATION_CONFIG_VIEW
  moduleCode: string;
  submoduleCode?: string;
  featureCode: string;
  action: PermissionActionType;
  label: string;
  description: string;
  allowedDataScopes: DataScopeLevel[];
  sensitivity: 'STANDARD' | 'HIGH' | 'CRITICAL';
  apiEndpoint?: string;
  uiControlKey?: string;
  status: 'ACTIVE' | 'DEPRECATED';
  version: number;
  registeredAt: string;
  registeredBy: string;
  requiresApprovalToGrant: boolean;
}

export interface RoleImpactProposalItem {
  permissionCode: string;
  label: string;
  moduleCode: string;
  featureCode: string;
  recommendedRoleCodes: string[];
  alreadyGrantedRoleCodes: string[];
  pendingApprovalRoleCodes: string[];
  rationale: string;
}

export interface PermissionSyncReport {
  id: string;
  generatedAt: string;
  generatedBy: string;
  totalModules: number;
  totalSubmodules: number;
  totalFeatures: number;
  totalPermissions: number;
  missingPermissions: Array<{ featureCode: string; action: PermissionActionType; suggestedCode: string }>;
  duplicatePermissionCodes: string[];
  orphanedPermissions: string[];
  deprecatedFeaturesWithActiveGrants: Array<{ featureCode: string; permissionCode: string; roleCodes: string[] }>;
  unprotectedApis: Array<{ apiEndpoint: string; moduleCode: string; issue: string }>;
  unmappedFrontendActions: Array<{ uiControlKey: string; moduleCode: string; issue: string }>;
  roleImpactProposals: RoleImpactProposalItem[];
  ciGatePassed: boolean;
  summaryMessage: string;
}

export interface OrganizationalScope {
  companyIds: string[];
  branchIds: string[];
  businessUnitIds: string[];
  departmentIds: string[];
  purchaseOrgIds: string[];
  purchaseGroupIds: string[];
  salesOrgIds: string[];
  warehouseIds: string[];
  locationCodes: string[];
  costCentreIds: string[];
  projectIds: string[];
  dataScopeLevel: DataScopeLevel;
}

export interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  companyId: string;
  branchId?: string;
  scope: OrganizationalScope;
  isDefaultContext: boolean;
  assignmentDate: string;
  effectiveFrom: string;
  effectiveTo?: string;
  assignedBy: string;
  approvedBy?: string;
  status: 'ACTIVE' | 'PENDING_APPROVAL' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED';
  reason: string;
  isTemporary?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AccessRequestType =
  | 'NEW_ROLE'
  | 'ADDITIONAL_PERMISSION'
  | 'COMPANY_ACCESS'
  | 'BRANCH_ACCESS'
  | 'PURCHASE_ORG_ACCESS'
  | 'TEMPORARY_ACCESS'
  | 'ELEVATED_ACCESS';

export type AccessRequestStatus =
  | 'PENDING_MANAGER'
  | 'PENDING_DATA_OWNER'
  | 'PENDING_SECURITY_ADMIN'
  | 'APPROVED'
  | 'REJECTED'
  | 'ESCALATED'
  | 'CANCELLED';

export interface AccessRequestApprovalStep {
  id: string;
  stageOrder: number;
  stageName: string;
  approverRole: string;
  actorUserId?: string;
  actorName?: string;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELEGATED' | 'ESCALATED';
  timestamp?: string;
  comments?: string;
}

export interface AccessRequestRecord {
  id: string;
  requestNumber: string;
  workflowKey: string; // Linked to Approval Workflow Manager template
  requesterUserId: string;
  requesterName: string;
  targetUserId: string;
  targetUserName: string;
  requestType: AccessRequestType;
  requestedRoleId?: string;
  requestedRoleCode?: string;
  requestedRoleName?: string;
  requestedPermissionCodes: string[];
  requestedScope: OrganizationalScope;
  isTemporary: boolean;
  validFrom: string;
  validTo?: string;
  justification: string;
  status: AccessRequestStatus;
  currentStageOrder: number;
  requiresSecurityAdminApproval: boolean;
  sodWarnings: string[];
  rejectionReason?: string;
  resubmissionCount: number;
  approvals: AccessRequestApprovalStep[];
  createdAt: string;
  updatedAt: string;
}

export interface TemporaryAccessRecord {
  id: string;
  userId: string;
  userName: string;
  grantType: 'TEMPORARY_ROLE' | 'TEMPORARY_PERMISSION' | 'TEMPORARY_ORG_ACCESS' | 'ELEVATED_PRIVILEGE' | 'EMERGENCY_ACCESS';
  roleId?: string;
  roleCode?: string;
  permissionCodes: string[];
  scope: OrganizationalScope;
  validFrom: string;
  validTo: string;
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'REVOKED';
  grantedBy: string;
  approvedBy?: string;
  reason: string;
  reminderSent: boolean;
  revokedBy?: string;
  revokedAt?: string;
  revokeReason?: string;
  createdAt: string;
}

export interface AccessDelegationRecord {
  id: string;
  delegationType: 'APPROVAL_DELEGATION' | 'ABSENCE_DELEGATION';
  delegatorUserId: string;
  delegatorName: string;
  delegateUserId: string;
  delegateName: string;
  companyId: string;
  branchId?: string;
  purchaseOrgId?: string;
  delegatedRoleCodes: string[];
  delegatedPermissionCodes: string[];
  validFrom: string;
  validTo: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  reason: string;
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
  revokedAt?: string;
  revokedBy?: string;
}

export type SodEnforcementMode = 'PREVENTIVE' | 'WARNING' | 'EXCEPTION_APPROVAL';
export type SodRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SodRule {
  id: string;
  ruleCode: string;
  ruleName: string;
  description: string;
  leftSideLabel: string;
  rightSideLabel: string;
  leftPermissionOrRoleCodes: string[];
  rightPermissionOrRoleCodes: string[];
  enforcementMode: SodEnforcementMode;
  riskLevel: SodRiskLevel;
  sameTransactionBlock?: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface SodConflictFinding {
  id: string;
  userId: string;
  userName: string;
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  riskLevel: SodRiskLevel;
  enforcementMode: SodEnforcementMode;
  leftMatched: string[];
  rightMatched: string[];
  companyId: string;
  branchId?: string;
  status: 'OPEN_WARNING' | 'BLOCKED' | 'EXCEPTION_APPROVED' | 'RESOLVED';
  exceptionApprovedBy?: string;
  exceptionApprovedAt?: string;
  exceptionExpiresAt?: string;
  exceptionReason?: string;
  detectedAt: string;
}

export interface SecurityPolicyConfig {
  id: string;
  companyId: string; // 'GLOBAL' or specific companyId
  minPasswordLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
  passwordHistoryCount: number;
  passwordExpirationDays: number;
  failedLoginThreshold: number;
  lockoutDurationMinutes: number;
  sessionTimeoutMinutes: number;
  maxConcurrentSessions: number;
  mfaRequirement: 'ALL_USERS' | 'ADMINS_AND_CHECKERS' | 'OPTIONAL';
  allowEmailOtp: boolean;
  allowAuthenticatorMfa: boolean;
  recoveryCodesEnabled: boolean;
  loginNotificationEnabled: boolean;
  suspiciousLoginAlertEnabled: boolean;
  emergencyAccessMaxHours: number;
  deactivateAccountOnNotAssociated: boolean;
  revokeSessionsOnNotAssociated: boolean;
  revokeOrgAssignmentsOnNotAssociated: boolean;
  requireApprovalForReassociation: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface UserSessionRecord {
  id: string;
  sessionTokenId: string;
  userId: string;
  username: string;
  userName: string;
  companyId: string;
  branchId?: string;
  deviceInfo: string;
  ipAddress: string;
  authMethod: AuthenticationMethod;
  mfaVerified: boolean;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'LOGGED_OUT';
  revokedBy?: string;
  revokedAt?: string;
  revokeReason?: string;
}

export interface LoginHistoryRecord {
  id: string;
  userId?: string;
  usernameOrEmail: string;
  userName?: string;
  companyId?: string;
  branchId?: string;
  eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'SESSION_REVOKED' | 'MFA_VERIFIED' | 'MFA_FAILED' | 'ACCOUNT_LOCKED';
  authMethod?: string;
  deviceInfo: string;
  ipAddress: string;
  isSuspicious: boolean;
  suspiciousReason?: string;
  reviewStatus?: 'NONE' | 'PENDING_REVIEW' | 'CLEARED' | 'CONFIRMED_INCIDENT';
  reviewedBy?: string;
  reviewedAt?: string;
  failureReason?: string;
  timestamp: string;
}

export interface AccessReviewItem {
  id: string;
  reviewType:
    | 'USER_WISE'
    | 'ROLE_WISE'
    | 'COMPANY_WISE'
    | 'BRANCH_WISE'
    | 'PURCHASE_ORG_WISE'
    | 'DORMANT_ACCOUNT'
    | 'EXCESSIVE_PRIVILEGE'
    | 'TEMPORARY_ACCESS'
    | 'SOD_REVIEW';
  targetUserId: string;
  targetUserName: string;
  targetRoleCode: string;
  companyId: string;
  branchId?: string;
  purchaseOrgId?: string;
  summary: string;
  riskIndicator: 'LOW' | 'MEDIUM' | 'HIGH';
  decision: 'PENDING' | 'CONFIRMED' | 'REVOKED' | 'MODIFIED' | 'CLARIFICATION_REQUESTED';
  reviewerUserId?: string;
  reviewerName?: string;
  reviewedAt?: string;
  justification?: string;
  evidenceRef?: string;
  createdAt: string;
}

export interface PermissionChangeHistoryRecord {
  id: string;
  targetType: 'ROLE' | 'USER_OVERRIDE' | 'ASSIGNMENT' | 'REGISTRY' | 'TEMP_ACCESS' | 'DELEGATION';
  targetId: string;
  targetName: string;
  action: 'GRANTED' | 'REVOKED' | 'CREATED' | 'MODIFIED' | 'EXPIRED' | 'REGISTERED' | 'DEPRECATED';
  permissionCodes: string[];
  previousValue?: string;
  newValue?: string;
  companyId: string;
  branchId?: string;
  actorUserId: string;
  actorName: string;
  reason: string;
  approvalReference?: string;
  timestamp: string;
}

export interface SecurityAlertRecord {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category:
    | 'FAILED_LOGINS'
    | 'SUSPICIOUS_LOGIN'
    | 'LOCKED_ACCOUNT'
    | 'EXPIRING_ACCESS'
    | 'SOD_CONFLICT'
    | 'EMERGENCY_ACCESS'
    | 'UNREGISTERED_PERMISSION'
    | 'LIFECYCLE_CHANGE'
    | 'CONSENT_COMPLIANCE';
  title: string;
  description: string;
  userId?: string;
  companyId: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  createdAt: string;
  acknowledgedBy?: string;
}

export interface AuthorizationCheckRequest {
  userId: string;
  permissionCode: string;
  sessionTokenId?: string;
  companyId?: string;
  branchId?: string;
  departmentId?: string;
  purchaseOrgId?: string;
  recordOwnerUserId?: string;
  recordAssignedUserId?: string;
  transactionCreatorUserId?: string;
  actionType?: 'VIEW' | 'CREATE' | 'EDIT' | 'APPROVE' | 'ADMIN';
}

export interface AuthorizationCheckResult {
  allowed: boolean;
  denialCode?:
    | 'UNAUTHENTICATED'
    | 'ACCOUNT_INACTIVE'
    | 'SESSION_INVALID'
    | 'PERMISSION_UNREGISTERED'
    | 'PERMISSION_DENIED'
    | 'ASSIGNMENT_INACTIVE_OR_EXPIRED'
    | 'ORG_SCOPE_DENIED'
    | 'RECORD_SCOPE_DENIED'
    | 'MAKER_CHECKER_VIOLATION'
    | 'SOD_PREVENTIVE_BLOCK';
  reason: string;
  matchedSource?: 'ROLE' | 'INHERITED_ROLE' | 'USER_OVERRIDE' | 'TEMPORARY_ACCESS' | 'DELEGATION';
  effectiveDataScope?: DataScopeLevel;
  cacheHit: boolean;
  evaluatedAt: string;
}

export interface BulkUserImportRowPreview {
  rowNumber: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: ManagedUserType;
  employeeId?: string;
  defaultCompanyCode: string;
  defaultBranchCode: string;
  roleCode: string;
  countryCode?: string;
  mobilePhone?: string;
  mobileNumberType?: MobileNumberType;
  mobileConsentStatus?: PersonalConsentStatus;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
