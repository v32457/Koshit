/**
 * CIPPLATFORM — CENTRALIZED USER & ROLE ADMINISTRATION ENGINE
 * Single authoritative service for Identity Lifecycle, Role Hierarchy, Granular Permission Registry,
 * 10-Step Deny-by-Default Authorization Engine (with Versioned Cache Invalidation),
 * Organizational Scopes, Access Requests, Temporary Access, Delegations, SoD,
 * Security Policies, Session Revocation, Access Reviews, and 23 Governance Reports.
 */

import type { InPortalNotification, User, UserRole } from '../types';
import type {
  AccessDelegationRecord,
  AccessRequestApprovalStep,
  AccessRequestRecord,
  AccessRequestType,
  AccessReviewItem,
  AuthenticationMethod,
  AuthorizationCheckRequest,
  AuthorizationCheckResult,
  BulkUserImportRowPreview,
  CommunicationPurpose,
  DataScopeLevel,
  EmployeeAssociationHistoryRecord,
  EmployeeAssociationStatus,
  LoginHistoryRecord,
  ManagedUserStatus,
  ManagedUserType,
  MobileNumberType,
  OrganizationalScope,
  PermissionActionType,
  PermissionChangeHistoryRecord,
  PermissionSyncReport,
  PersonalConsentStatus,
  RegistryFeatureEntry,
  RegistryModuleEntry,
  RegistryPermissionEntry,
  RegistrySubmoduleEntry,
  RoleCategory,
  RoleDefinition,
  RoleImpactProposalItem,
  RoleLifecycleStatus,
  RoleVersionHistoryRecord,
  SecurityAlertRecord,
  SecurityPolicyConfig,
  SodConflictFinding,
  SodRule,
  TemporaryAccessRecord,
  UserRoleAssignment,
  UserSessionRecord,
} from '../types/userRoleAdmin';
import {
  INITIAL_BRANCHES,
  INITIAL_COMPANIES,
  INITIAL_USERS,
} from '../data/seedData';
import {
  INITIAL_ACCESS_DELEGATIONS,
  INITIAL_ACCESS_REQUESTS,
  INITIAL_ACCESS_REVIEWS,
  INITIAL_LOGIN_HISTORY,
  INITIAL_PERMISSION_CHANGE_HISTORY,
  INITIAL_REGISTRY_FEATURES,
  INITIAL_REGISTRY_MODULES,
  INITIAL_REGISTRY_PERMISSIONS,
  INITIAL_REGISTRY_SUBMODULES,
  INITIAL_ROLES,
  INITIAL_SECURITY_ALERTS,
  INITIAL_SECURITY_POLICY,
  INITIAL_SOD_RULES,
  INITIAL_TEMPORARY_ACCESS,
  INITIAL_USER_ROLE_ASSIGNMENTS,
  INITIAL_USER_SESSIONS,
} from '../data/userRoleAdminSeed';
import { EnterpriseAuditService } from './enterpriseAuditService';
import {
  hashSecretSalted,
  validatePasswordAgainstPolicy,
  verifySaltedSecret,
} from './securityCryptoUtils';
import { rbacPermissionService, EnterprisePermissionKey } from './rbacPermissionService';
import { PurchaseOrganizationService } from './purchaseOrganizationService';
import { INITIAL_IN_PORTAL_NOTIFICATIONS } from '../data/communicationSeed';
import { mobileConsentService } from './mobileConsentService';

const KEYS = {
  USERS: 'cip_ura_users_v1',
  ROLES: 'cip_ura_roles_v1',
  ROLE_VERSIONS: 'cip_ura_role_versions_v1',
  MODULES: 'cip_ura_modules_v1',
  SUBMODULES: 'cip_ura_submodules_v1',
  FEATURES: 'cip_ura_features_v1',
  PERMISSIONS: 'cip_ura_permissions_v1',
  ASSIGNMENTS: 'cip_ura_assignments_v1',
  ACCESS_REQUESTS: 'cip_ura_access_requests_v1',
  TEMP_ACCESS: 'cip_ura_temp_access_v1',
  DELEGATIONS: 'cip_ura_delegations_v1',
  SOD_RULES: 'cip_ura_sod_rules_v1',
  SOD_FINDINGS: 'cip_ura_sod_findings_v1',
  SECURITY_POLICY: 'cip_ura_security_policy_v1',
  SESSIONS: 'cip_ura_sessions_v1',
  LOGIN_HISTORY: 'cip_ura_login_history_v1',
  ACCESS_REVIEWS: 'cip_ura_access_reviews_v1',
  PERM_HISTORY: 'cip_ura_perm_history_v1',
  ASSOCIATION_HISTORY: 'cip_ura_association_history_v1',
  ALERTS: 'cip_ura_security_alerts_v1',
  NOTIFICATIONS: 'kosh_in_portal_notifications_v1',
};

const DATA_SCOPE_RANK: Record<DataScopeLevel, number> = {
  READ_ONLY_RECORDS: 1,
  OWN_RECORDS: 2,
  ASSIGNED_RECORDS: 3,
  DEPARTMENT_RECORDS: 4,
  BRANCH_RECORDS: 5,
  PURCHASE_ORG_RECORDS: 6,
  COMPANY_RECORDS: 7,
  ALL_AUTHORIZED_RECORDS: 8,
};

const memoryStore: Record<string, any> = {};

function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

function readStore<T>(key: string, fallback: T): T {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw) as T;
      }
    } catch {
      // fall through
    }
  }
  if (memoryStore[key] !== undefined) {
    return deepClone(memoryStore[key]) as T;
  }
  const cloned = deepClone(fallback);
  memoryStore[key] = cloned;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(cloned));
    } catch {
      // ignore quota errors
    }
  }
  return deepClone(cloned);
}

function writeStore<T>(key: string, value: T): void {
  const cloned = deepClone(value);
  memoryStore[key] = cloned;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(cloned));
    } catch {
      // ignore
    }
  }
}

function dispatchUiEvent(eventName: string, detail?: any): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

function enrichSeedUser(u: User): User {
  const parts = (u.fullName || 'User Account').trim().split(/\s+/);
  const firstName = u.firstName || parts[0] || 'User';
  const lastName = u.lastName || parts.slice(1).join(' ') || 'Member';
  const derivedUsername =
    u.username ||
    (u.email
      ? u.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '')
      : u.id);

  // Normalize legacy statuses cleanly into canonical Account Status & Employee Association Status
  const rawStatus = (u.status as string | undefined) || 'ACTIVE';
  let normalizedStatus: ManagedUserStatus = 'ACTIVE';
  let normalizedAssociation: EmployeeAssociationStatus = u.employeeAssociationStatus || 'ASSOCIATED';

  if (rawStatus === 'TERMINATED') {
    normalizedStatus = 'DEACTIVATED';
    normalizedAssociation = 'NOT_ASSOCIATED';
  } else if (rawStatus === 'INACTIVE' || rawStatus === 'DEACTIVATED') {
    normalizedStatus = 'DEACTIVATED';
  } else if (rawStatus === 'INVITED' || rawStatus === 'PENDING_APPROVAL' || rawStatus === 'PENDING_ACTIVATION') {
    normalizedStatus = 'PENDING_ACTIVATION';
  } else {
    normalizedStatus = rawStatus as ManagedUserStatus;
  }

  return {
    ...u,
    username: derivedUsername,
    firstName,
    lastName,
    displayName: u.displayName || u.fullName,
    userType: u.userType || (u.role === 'PLATFORM_ADMIN' ? 'ADMINISTRATOR' : u.role === 'INTEGRATION_SERVICE_ACCOUNT' ? 'SERVICE_ACCOUNT' : 'EMPLOYEE'),
    authMethod: u.authMethod || (u.twoFactorEnabled ? 'PASSWORD_EMAIL_2FA' : 'PASSWORD_ONLY'),
    status: normalizedStatus,
    employeeAssociationStatus: normalizedAssociation,
    associationStartDate: u.associationStartDate || u.effectiveFrom || '2026-01-01',
    countryCode: u.mobilePhone ? u.countryCode || '+91' : u.countryCode,
    mobileNumberType: u.mobilePhone ? u.mobileNumberType || 'OFFICIAL' : u.mobileNumberType,
    mobileVerificationStatus: u.mobileVerificationStatus || 'NOT_VERIFIED',
    mobileConsentStatus:
      u.mobilePhone && (u.mobileNumberType || 'OFFICIAL') === 'PERSONAL'
        ? u.mobileConsentStatus || 'PENDING_EMPLOYEE_CONSENT'
        : u.mobilePhone
        ? 'NOT_REQUIRED_OFFICIAL'
        : u.mobileConsentStatus,
    defaultCompanyId: u.defaultCompanyId || 'co-kosh-01',
    defaultBranchId: u.defaultBranchId || u.allowedBranchIds?.[0] || 'br-pond-01',
    failedLoginAttempts: u.failedLoginAttempts ?? 0,
    invitationStatus: u.invitationStatus || 'ACCEPTED',
    createdAt: u.createdAt || '2026-01-01T00:00:00Z',
    updatedAt: u.updatedAt || '2026-11-12T00:00:00Z',
  };
}

// ============================================================================
// PERMISSION EVALUATION CACHE + INVALIDATION STRATEGY
// ============================================================================
let authCacheVersion = 1;
const authEvalCache = new Map<string, AuthorizationCheckResult>();
let cacheHits = 0;
let cacheMisses = 0;
let lastInvalidationReason = 'Initial boot';
let lastInvalidatedAt = new Date().toISOString();

function invalidatePermissionCache(reason = 'RBAC state changed'): void {
  authCacheVersion += 1;
  authEvalCache.clear();
  lastInvalidationReason = reason;
  lastInvalidatedAt = new Date().toISOString();
}

function todayDateOnly(isoOrDate?: string): string {
  return (isoOrDate || new Date().toISOString()).slice(0, 10);
}

function isWithinDateWindow(from?: string, to?: string, refDate = todayDateOnly()): boolean {
  if (from && refDate < from.slice(0, 10)) return false;
  if (to && refDate > to.slice(0, 10)) return false;
  return true;
}

function emptyScope(companyId = 'co-kosh-01', dataScopeLevel: DataScopeLevel = 'BRANCH_RECORDS'): OrganizationalScope {
  return {
    companyIds: companyId ? [companyId] : [],
    branchIds: [],
    businessUnitIds: [],
    departmentIds: [],
    purchaseOrgIds: [],
    purchaseGroupIds: [],
    salesOrgIds: [],
    warehouseIds: [],
    locationCodes: [],
    costCentreIds: [],
    projectIds: [],
    dataScopeLevel,
  };
}

export type AccessReportKey =
  | 'USER_MASTER'
  | 'ACTIVE_INACTIVE_USERS'
  | 'USERS_WITHOUT_ROLE'
  | 'USER_ROLE_ASSIGNMENTS'
  | 'ROLE_PERMISSION_MATRIX'
  | 'EFFECTIVE_USER_PERMISSIONS'
  | 'MODULE_ACCESS'
  | 'COMPANY_BRANCH_ACCESS'
  | 'PURCHASE_ORG_ACCESS'
  | 'TEMPORARY_ACCESS'
  | 'EXPIRED_ACCESS'
  | 'ACCESS_REQUESTS'
  | 'ROLE_CONFLICTS'
  | 'SOD_FINDINGS'
  | 'LOGIN_HISTORY'
  | 'FAILED_LOGINS'
  | 'ACTIVE_SESSIONS'
  | 'PRIVILEGED_USERS'
  | 'DORMANT_ACCOUNTS'
  | 'PERMISSION_CHANGE_HISTORY'
  | 'SECURITY_AUDIT'
  | 'ACCESS_REVIEWS'
  | 'MODULE_FEATURE_REGISTRATION'
  | 'EMPLOYEE_ASSOCIATION_LIFECYCLE'
  | 'PERSONAL_MOBILE_CONSENT';

export interface AccessReportCatalogItem {
  key: AccessReportKey;
  number: number;
  title: string;
  category: 'Identity' | 'RBAC & Scope' | 'Governance & SoD' | 'Security & Sessions' | 'Compliance & Registry';
}

export const ACCESS_REPORT_CATALOG: AccessReportCatalogItem[] = [
  { key: 'USER_MASTER', number: 1, title: 'User Master Report', category: 'Identity' },
  { key: 'ACTIVE_INACTIVE_USERS', number: 2, title: 'Account Status & Association Report', category: 'Identity' },
  { key: 'USERS_WITHOUT_ROLE', number: 3, title: 'User Without Role Report', category: 'Identity' },
  { key: 'USER_ROLE_ASSIGNMENTS', number: 4, title: 'User Role Assignment Report', category: 'RBAC & Scope' },
  { key: 'ROLE_PERMISSION_MATRIX', number: 5, title: 'Role Permission Matrix', category: 'RBAC & Scope' },
  { key: 'EFFECTIVE_USER_PERMISSIONS', number: 6, title: 'Effective User Permission Report', category: 'RBAC & Scope' },
  { key: 'MODULE_ACCESS', number: 7, title: 'Module Access Report', category: 'RBAC & Scope' },
  { key: 'COMPANY_BRANCH_ACCESS', number: 8, title: 'Company and Branch Access Report', category: 'RBAC & Scope' },
  { key: 'PURCHASE_ORG_ACCESS', number: 9, title: 'Purchase Organization Access Report', category: 'RBAC & Scope' },
  { key: 'TEMPORARY_ACCESS', number: 10, title: 'Temporary Access Report', category: 'Governance & SoD' },
  { key: 'EXPIRED_ACCESS', number: 11, title: 'Expired Access Report', category: 'Governance & SoD' },
  { key: 'ACCESS_REQUESTS', number: 12, title: 'Access Request Report', category: 'Governance & SoD' },
  { key: 'ROLE_CONFLICTS', number: 13, title: 'Role Conflict Report', category: 'Governance & SoD' },
  { key: 'SOD_FINDINGS', number: 14, title: 'Segregation of Duties Report', category: 'Governance & SoD' },
  { key: 'LOGIN_HISTORY', number: 15, title: 'Login History Report', category: 'Security & Sessions' },
  { key: 'FAILED_LOGINS', number: 16, title: 'Failed Login Report', category: 'Security & Sessions' },
  { key: 'ACTIVE_SESSIONS', number: 17, title: 'Active Session Report', category: 'Security & Sessions' },
  { key: 'PRIVILEGED_USERS', number: 18, title: 'Privileged User Report', category: 'Security & Sessions' },
  { key: 'DORMANT_ACCOUNTS', number: 19, title: 'Dormant Account Report', category: 'Security & Sessions' },
  { key: 'PERMISSION_CHANGE_HISTORY', number: 20, title: 'Permission Change History', category: 'Compliance & Registry' },
  { key: 'SECURITY_AUDIT', number: 21, title: 'Security Audit Report', category: 'Compliance & Registry' },
  { key: 'ACCESS_REVIEWS', number: 22, title: 'Access Review Report', category: 'Compliance & Registry' },
  { key: 'MODULE_FEATURE_REGISTRATION', number: 23, title: 'Module and Feature Permission Registration Report', category: 'Compliance & Registry' },
  { key: 'EMPLOYEE_ASSOCIATION_LIFECYCLE', number: 24, title: 'Employee Association & Reassociation Audit Report', category: 'Identity' },
  { key: 'PERSONAL_MOBILE_CONSENT', number: 25, title: 'Mobile Contact & Personal Consent Compliance Report', category: 'Compliance & Registry' },
];

export interface DashboardFilterState {
  companyId?: string;
  branchId?: string;
  department?: string;
  purchaseOrgId?: string;
  roleCode?: string;
  userStatus?: string;
  associationStatus?: EmployeeAssociationStatus | 'ALL';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export const userRoleAdminService = {
  // =========================================================================
  // NOTIFICATIONS & CHANGE HISTORY HELPERS
  // =========================================================================
  emitGovernanceNotification(params: {
    title: string;
    message: string;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
    route?: string;
    recipientUserId?: string;
  }): void {
    const existing = readStore<InPortalNotification[]>(KEYS.NOTIFICATIONS, INITIAL_IN_PORTAL_NOTIFICATIONS);
    const priority =
      params.severity === 'CRITICAL'
        ? 'CRITICAL'
        : params.severity === 'WARNING'
        ? 'HIGH'
        : 'MEDIUM';
    const notif: InPortalNotification = {
      id: `notif-sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: params.recipientUserId || 'usr-admin-01',
      category: 'SECURITY',
      title: params.title,
      message: params.message,
      isRead: false,
      createdAt: new Date().toISOString(),
      linkRoute: params.route || '/settings/users-roles',
      priority,
    };
    writeStore(KEYS.NOTIFICATIONS, [notif, ...existing].slice(0, 100));
    dispatchUiEvent('cip:notifications-updated', notif);
  },

  recordPermissionChange(entry: Omit<PermissionChangeHistoryRecord, 'id' | 'timestamp'>): PermissionChangeHistoryRecord {
    const list = readStore<PermissionChangeHistoryRecord[]>(KEYS.PERM_HISTORY, INITIAL_PERMISSION_CHANGE_HISTORY);
    const created: PermissionChangeHistoryRecord = {
      ...entry,
      id: `pch-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      timestamp: new Date().toISOString(),
    };
    writeStore(KEYS.PERM_HISTORY, [created, ...list]);
    return created;
  },

  getPermissionChangeHistory(): PermissionChangeHistoryRecord[] {
    return readStore<PermissionChangeHistoryRecord[]>(KEYS.PERM_HISTORY, INITIAL_PERMISSION_CHANGE_HISTORY);
  },

  getSecurityAlerts(): SecurityAlertRecord[] {
    return readStore<SecurityAlertRecord[]>(KEYS.ALERTS, INITIAL_SECURITY_ALERTS);
  },

  createSecurityAlert(alert: Omit<SecurityAlertRecord, 'id' | 'createdAt' | 'status'>): SecurityAlertRecord {
    const alerts = this.getSecurityAlerts();
    const record: SecurityAlertRecord = {
      ...alert,
      id: `salert-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    };
    writeStore(KEYS.ALERTS, [record, ...alerts]);
    return record;
  },

  acknowledgeAlert(alertId: string, actor: { id: string; name: string }): SecurityAlertRecord | null {
    const alerts = this.getSecurityAlerts();
    let updated: SecurityAlertRecord | null = null;
    const next = alerts.map((a) => {
      if (a.id === alertId) {
        updated = { ...a, status: 'ACKNOWLEDGED', acknowledgedBy: actor.name };
        return updated;
      }
      return a;
    });
    writeStore(KEYS.ALERTS, next);
    return updated;
  },

  // =========================================================================
  // USER MASTER & LIFECYCLE MANAGEMENT
  // =========================================================================
  getUsers(filters?: DashboardFilterState): User[] {
    const raw = readStore<User[]>(KEYS.USERS, INITIAL_USERS.map(enrichSeedUser));
    let list = raw.map(enrichSeedUser);

    if (filters) {
      if (filters.associationStatus && filters.associationStatus !== 'ALL') {
        list = list.filter((u) => (u.employeeAssociationStatus || 'ASSOCIATED') === filters.associationStatus);
      }
      if (filters.userStatus && filters.userStatus !== 'ALL') {
        const targetStatus =
          filters.userStatus === 'INACTIVE'
            ? 'DEACTIVATED'
            : filters.userStatus === 'INVITED' || filters.userStatus === 'PENDING_APPROVAL'
            ? 'PENDING_ACTIVATION'
            : filters.userStatus;
        list = list.filter((u) => u.status === targetStatus);
      }
      if (filters.roleCode && filters.roleCode !== 'ALL') {
        const assignments = this.getAssignments();
        list = list.filter(
          (u) =>
            u.role === filters.roleCode ||
            assignments.some((a) => a.userId === u.id && a.status === 'ACTIVE' && a.roleCode === filters.roleCode)
        );
      }
      if (filters.companyId && filters.companyId !== 'ALL') {
        const assignments = this.getAssignments();
        list = list.filter(
          (u) =>
            u.defaultCompanyId === filters.companyId ||
            u.isGlobalScope ||
            assignments.some(
              (a) =>
                a.userId === u.id &&
                a.status === 'ACTIVE' &&
                (a.companyId === filters.companyId || a.scope.companyIds.includes(filters.companyId!))
            )
        );
      }
      if (filters.branchId && filters.branchId !== 'ALL') {
        list = list.filter(
          (u) =>
            u.isGlobalScope ||
            u.defaultBranchId === filters.branchId ||
            u.allowedBranchIds?.includes(filters.branchId!)
        );
      }
      if (filters.department && filters.department !== 'ALL') {
        list = list.filter((u) => (u.department || '').toLowerCase().includes(filters.department!.toLowerCase()));
      }
      if (filters.search && filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        list = list.filter(
          (u) =>
            u.fullName.toLowerCase().includes(q) ||
            (u.username || '').toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.employeeId || '').toLowerCase().includes(q) ||
            (u.designation || '').toLowerCase().includes(q) ||
            (u.mobileNumberType !== 'PERSONAL' && (u.mobilePhone || '').toLowerCase().includes(q))
        );
      }
    }
    return list;
  },

  getUserById(userId: string): User | undefined {
    return this.getUsers().find((u) => u.id === userId);
  },

  createUser(
    input: {
      username: string;
      email: string;
      firstName: string;
      middleName?: string;
      lastName: string;
      countryCode?: string;
      mobilePhone?: string;
      mobileNumberType?: MobileNumberType;
      mobileConsentStatus?: PersonalConsentStatus;
      mobileConsentPurposes?: CommunicationPurpose[];
      employeeId?: string;
      designation?: string;
      department?: string;
      managerId?: string;
      userType?: ManagedUserType;
      authMethod?: AuthenticationMethod;
      role?: UserRole;
      defaultCompanyId?: string;
      defaultBranchId?: string;
      allowedBranchIds?: string[];
      isGlobalScope?: boolean;
      twoFactorEnabled?: boolean;
      creationMode?: 'MANUAL' | 'EMPLOYEE_LINKED' | 'INVITED';
      initialPassword?: string;
      effectiveFrom?: string;
      effectiveTo?: string;
      mustChangePassword?: boolean;
      reason?: string;
    },
    actor: { id: string; name: string }
  ): User {
    const users = this.getUsers();
    const normUsername = input.username.trim().toLowerCase();
    const normEmail = input.email.trim().toLowerCase();

    if (!normUsername || !/^[a-z0-9._-]{3,40}$/.test(normUsername)) {
      throw new Error('Username must be 3-40 lowercase alphanumeric characters (._- allowed).');
    }
    if (!normEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
      throw new Error('A valid corporate email address is required.');
    }
    if (users.some((u) => (u.username || '').toLowerCase() === normUsername)) {
      throw new Error(`Duplicate username rejected: '${normUsername}' is already registered.`);
    }
    if (users.some((u) => u.email.toLowerCase() === normEmail)) {
      throw new Error(`Duplicate email rejected: '${normEmail}' is already linked to another user account.`);
    }

    const policy = this.getSecurityPolicy(input.defaultCompanyId);
    let passwordHash: string | undefined;
    let passwordHistoryHashes: string[] = [];
    if (input.creationMode !== 'INVITED' && input.initialPassword) {
      const check = validatePasswordAgainstPolicy(input.initialPassword, policy);
      if (!check.valid) {
        throw new Error(`Password policy failed: ${check.errors.join(' ')}`);
      }
      passwordHash = hashSecretSalted(input.initialPassword);
      passwordHistoryHashes = [passwordHash];
    }

    const fullName = [input.firstName.trim(), input.middleName?.trim(), input.lastName.trim()]
      .filter(Boolean)
      .join(' ');

    const assignedRole: UserRole = input.role || 'READ_ONLY_USER';
    // Never allow silent elevation to PLATFORM_ADMIN unless actor is PLATFORM_ADMIN
    const actorUser = users.find((u) => u.id === actor.id);
    if (assignedRole === 'PLATFORM_ADMIN' && actorUser && actorUser.role !== 'PLATFORM_ADMIN') {
      throw new Error('Security policy violation: Only an active Platform Super Administrator can provision a PLATFORM_ADMIN user.');
    }

    const status: ManagedUserStatus = input.creationMode === 'INVITED' ? 'PENDING_ACTIVATION' : 'ACTIVE';
    const nowIso = new Date().toISOString();
    const companyId = input.defaultCompanyId || 'co-kosh-01';
    const branchId = input.defaultBranchId || 'br-pond-01';
    const newUserId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

    const mobilePrep = mobileConsentService.prepareMobileOnboardingFields(
      {
        countryCode: input.countryCode,
        mobilePhone: input.mobilePhone,
        mobileNumberType: input.mobileNumberType,
        mobileConsentStatus: input.mobileConsentStatus,
        mobileConsentPurposes: input.mobileConsentPurposes,
        companyId,
        userId: newUserId,
        userName: fullName,
        employeeId: input.employeeId,
      },
      actor
    );

    const newUser: User = enrichSeedUser({
      id: newUserId,
      username: normUsername,
      email: normEmail,
      firstName: input.firstName.trim(),
      middleName: input.middleName?.trim(),
      lastName: input.lastName.trim(),
      fullName,
      displayName: fullName,
      ...mobilePrep.patch,
      employeeId: input.employeeId,
      designation: input.designation || 'Enterprise User',
      department: input.department || 'Operations',
      managerId: input.managerId,
      userType: input.userType || (input.creationMode === 'EMPLOYEE_LINKED' ? 'EMPLOYEE' : 'EMPLOYEE'),
      authMethod: input.authMethod || 'PASSWORD_EMAIL_2FA',
      status,
      employeeAssociationStatus: 'ASSOCIATED',
      associationStartDate: input.effectiveFrom || todayDateOnly(),
      role: assignedRole,
      orgId: 'org-kosh-01',
      defaultCompanyId: companyId,
      defaultBranchId: branchId,
      allowedBranchIds: input.allowedBranchIds || (input.isGlobalScope ? [] : [branchId]),
      isGlobalScope: Boolean(input.isGlobalScope),
      twoFactorEnabled: input.twoFactorEnabled ?? true,
      passwordHash,
      passwordHistoryHashes,
      passwordUpdatedAt: passwordHash ? nowIso : undefined,
      mustChangePassword: input.mustChangePassword ?? (input.creationMode === 'INVITED'),
      effectiveFrom: input.effectiveFrom || todayDateOnly(),
      effectiveTo: input.effectiveTo,
      invitationStatus: input.creationMode === 'INVITED' ? 'SENT' : 'ACCEPTED',
      invitationSentAt: input.creationMode === 'INVITED' ? nowIso : undefined,
      createdAt: nowIso,
      createdBy: actor.name,
      updatedAt: nowIso,
      updatedBy: actor.name,
    });

    writeStore(KEYS.USERS, [newUser, ...users]);

    // Also provision baseline UserRoleAssignment for the assigned role & scope
    const targetRole = this.getRoleByCode(assignedRole);
    if (targetRole) {
      const assignments = this.getAssignments();
      const ura: UserRoleAssignment = {
        id: `ura-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        userId: newUser.id,
        roleId: targetRole.id,
        roleCode: targetRole.roleCode,
        roleName: targetRole.roleName,
        companyId,
        branchId,
        scope: {
          ...emptyScope(companyId, newUser.isGlobalScope ? 'COMPANY_RECORDS' : 'BRANCH_RECORDS'),
          branchIds: newUser.allowedBranchIds || [],
        },
        isDefaultContext: true,
        assignmentDate: todayDateOnly(),
        effectiveFrom: input.effectiveFrom || todayDateOnly(),
        effectiveTo: input.effectiveTo,
        assignedBy: actor.name,
        approvedBy: actor.name,
        status: 'ACTIVE',
        reason: input.reason || 'Initial user creation role assignment',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      writeStore(KEYS.ASSIGNMENTS, [ura, ...assignments]);
    }

    invalidatePermissionCache(`Created user ${newUser.username}`);
    dispatchUiEvent('cip:users-updated', { userId: newUser.id });

    EnterpriseAuditService.logEvent({
      companyId,
      branchId,
      entityType: 'SECURITY',
      entityId: newUser.id,
      eventType: status === 'PENDING_ACTIVATION' ? 'USER_INVITED' : 'USER_CREATED',
      eventDescription: `${status === 'PENDING_ACTIVATION' ? 'Invited' : 'Created'} user ${newUser.fullName} (@${newUser.username}, ${newUser.email}) with baseline role ${assignedRole} (Association: ASSOCIATED, MobileType: ${newUser.mobileNumberType || 'NONE'})`,
      newValue: {
        username: newUser.username,
        email: newUser.email,
        role: assignedRole,
        status,
        employeeAssociationStatus: newUser.employeeAssociationStatus,
        mobileNumberType: newUser.mobileNumberType,
        mobileConsentStatus: newUser.mobileConsentStatus,
        employeeId: newUser.employeeId,
      },
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: input.reason || 'User Master onboarding',
    });

    this.emitGovernanceNotification({
      title: status === 'PENDING_ACTIVATION' ? 'User Invitation Sent' : 'User Account Activated',
      message: `${newUser.fullName} (${newUser.email}) onboarded as ${assignedRole}.`,
      severity: 'INFO',
      recipientUserId: newUser.id,
    });

    if (mobilePrep.shouldDispatchPersonalConsentRequest) {
      mobileConsentService.requestPersonalMobileConsent(newUser, actor);
    }

    return this.getUserById(newUser.id) || newUser;
  },

  updateUser(
    userId: string,
    patch: Partial<User>,
    actor: { id: string; name: string },
    reason = 'User profile update'
  ): User {
    const users = this.getUsers();
    const existing = users.find((u) => u.id === userId);
    if (!existing) throw new Error('User record not found.');

    if (patch.email && patch.email.toLowerCase().trim() !== existing.email.toLowerCase()) {
      if (users.some((u) => u.id !== userId && u.email.toLowerCase() === patch.email!.toLowerCase().trim())) {
        throw new Error(`Email '${patch.email}' is already used by another user.`);
      }
    }
    if (patch.username && patch.username.toLowerCase().trim() !== (existing.username || '').toLowerCase()) {
      if (users.some((u) => u.id !== userId && (u.username || '').toLowerCase() === patch.username!.toLowerCase().trim())) {
        throw new Error(`Username '${patch.username}' is already taken.`);
      }
    }

    // Never allow silent self-elevation via updateUser
    if (patch.role && patch.role !== existing.role) {
      if (actor.id === userId && patch.role === 'PLATFORM_ADMIN') {
        throw new Error('Self-elevation blocked: users cannot elevate their own role.');
      }
    }

    // Check if mobile contact / number type fields were explicitly passed in patch
    const mobileFieldsTouched =
      'mobilePhone' in patch ||
      'countryCode' in patch ||
      'mobileNumberType' in patch ||
      'mobileConsentStatus' in patch;

    let effectivePatch = { ...patch };
    let shouldDispatchConsent = false;
    if (mobileFieldsTouched && actor.id !== 'system-consent-direct') {
      const mobilePrep = mobileConsentService.prepareMobileOnboardingFields(
        {
          countryCode: 'countryCode' in patch ? patch.countryCode : existing.countryCode,
          mobilePhone: 'mobilePhone' in patch ? patch.mobilePhone : existing.mobilePhone,
          mobileNumberType: 'mobileNumberType' in patch ? patch.mobileNumberType : existing.mobileNumberType,
          mobileConsentStatus: patch.mobileConsentStatus,
          companyId: patch.defaultCompanyId || existing.defaultCompanyId,
          userId: existing.id,
          userName: existing.fullName,
          employeeId: patch.employeeId || existing.employeeId,
        },
        actor,
        existing
      );
      effectivePatch = { ...effectivePatch, ...mobilePrep.patch };
      shouldDispatchConsent = mobilePrep.shouldDispatchPersonalConsentRequest;
    }

    const first = effectivePatch.firstName ?? existing.firstName ?? '';
    const mid = effectivePatch.middleName ?? existing.middleName ?? '';
    const last = effectivePatch.lastName ?? existing.lastName ?? '';
    const recomputedFullName =
      effectivePatch.fullName || [first, mid, last].filter(Boolean).join(' ') || existing.fullName;

    const updated = enrichSeedUser({
      ...existing,
      ...effectivePatch,
      fullName: recomputedFullName,
      displayName: effectivePatch.displayName || recomputedFullName,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.name,
    });

    writeStore(KEYS.USERS, users.map((u) => (u.id === userId ? updated : u)));
    invalidatePermissionCache(`Updated user ${updated.username}`);
    dispatchUiEvent('cip:users-updated', { userId });

    EnterpriseAuditService.logEvent({
      companyId: updated.defaultCompanyId || 'co-kosh-01',
      branchId: updated.defaultBranchId,
      entityType: 'SECURITY',
      entityId: userId,
      eventType: 'USER_MODIFIED',
      eventDescription: `Modified user ${updated.fullName} (@${updated.username})`,
      previousValue: {
        status: existing.status,
        employeeAssociationStatus: existing.employeeAssociationStatus,
        role: existing.role,
        department: existing.department,
        employeeId: existing.employeeId,
        mobileNumberType: existing.mobileNumberType,
      },
      newValue: {
        status: updated.status,
        employeeAssociationStatus: updated.employeeAssociationStatus,
        role: updated.role,
        department: updated.department,
        employeeId: updated.employeeId,
        mobileNumberType: updated.mobileNumberType,
      },
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: reason,
    });

    if (shouldDispatchConsent) {
      mobileConsentService.requestPersonalMobileConsent(updated, actor);
    }

    return this.getUserById(userId) || updated;
  },

  setUserStatus(
    userId: string,
    status: ManagedUserStatus,
    reason: string,
    actor: { id: string; name: string }
  ): User {
    const existing = this.getUserById(userId);
    if (!existing) throw new Error('User not found.');
    if (!reason || reason.trim().length < 3) {
      throw new Error('Mandatory reason is required for user status change.');
    }

    const normalizedNext: ManagedUserStatus =
      status === 'INACTIVE' ? 'DEACTIVATED' : status === 'INVITED' || status === 'PENDING_APPROVAL' ? 'PENDING_ACTIVATION' : status;

    if (normalizedNext === 'ACTIVE' && existing.employeeAssociationStatus === 'NOT_ASSOCIATED') {
      throw new Error(
        'Cannot activate or unlock a Not Associated employee account. Complete the authorized Reassociation workflow first.'
      );
    }

    // Last active Super Admin safeguard
    if (existing.role === 'PLATFORM_ADMIN' && normalizedNext !== 'ACTIVE') {
      const activeSuperAdmins = this.getUsers().filter((u) => u.role === 'PLATFORM_ADMIN' && u.status === 'ACTIVE');
      if (activeSuperAdmins.length <= 1 && activeSuperAdmins[0]?.id === userId) {
        throw new Error('Protected safeguard: Cannot deactivate or lock the last active Platform Super Administrator.');
      }
    }

    const updated = this.updateUser(
      userId,
      {
        status: normalizedNext,
        failedLoginAttempts: normalizedNext === 'ACTIVE' ? 0 : existing.failedLoginAttempts,
        lockedUntil: normalizedNext === 'ACTIVE' ? undefined : existing.lockedUntil,
      },
      actor,
      reason
    );

    if (normalizedNext === 'DEACTIVATED' || normalizedNext === 'LOCKED' || normalizedNext === 'EXPIRED' || normalizedNext === 'SUSPENDED') {
      this.revokeAllUserSessions(userId, `Account transitioned to ${normalizedNext}: ${reason}`, actor);
    }

    this.emitGovernanceNotification({
      title: `Account ${normalizedNext}`,
      message: `${updated.fullName} account status changed to ${normalizedNext}. Reason: ${reason}`,
      severity: normalizedNext === 'ACTIVE' ? 'SUCCESS' : 'WARNING',
      recipientUserId: userId,
    });

    return updated;
  },

  deactivateUser(userId: string, reason: string, actor: { id: string; name: string }): User {
    return this.setUserStatus(userId, 'DEACTIVATED', reason || 'Administrative account deactivation', actor);
  },

  reactivateUser(userId: string, reason: string, actor: { id: string; name: string }): User {
    const existing = this.getUserById(userId);
    if (!existing) throw new Error('User not found.');
    if (existing.employeeAssociationStatus === 'NOT_ASSOCIATED') {
      throw new Error(
        'Cannot directly reactivate a Not Associated employee account. Perform an authorized Reassociation instead.'
      );
    }
    return this.setUserStatus(userId, 'ACTIVE', reason || 'Administrative account reactivation', actor);
  },

  lockUser(userId: string, reason: string, actor: { id: string; name: string }): User {
    const policy = this.getSecurityPolicy();
    const lockedUntil = new Date(Date.now() + policy.lockoutDurationMinutes * 60 * 1000).toISOString();
    this.setUserStatus(userId, 'LOCKED', reason || 'Administrative account lock', actor);
    return this.updateUser(userId, { lockedUntil }, actor, reason);
  },

  unlockUser(userId: string, reason: string, actor: { id: string; name: string }): User {
    const existing = this.getUserById(userId);
    if (!existing) throw new Error('User not found.');
    if (existing.employeeAssociationStatus === 'NOT_ASSOCIATED') {
      throw new Error(
        'Cannot unlock a Not Associated employee account. Complete the authorized Reassociation workflow first.'
      );
    }
    return this.setUserStatus(userId, 'ACTIVE', reason || 'Administrator unlocked account', actor);
  },

  resetUserPassword(
    userId: string,
    newPassword: string,
    actor: { id: string; name: string },
    requireChangeOnLogin = true,
    reason = 'Administrative password reset'
  ): { success: boolean; message: string } {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found.');
    const policy = this.getSecurityPolicy(user.defaultCompanyId);
    const check = validatePasswordAgainstPolicy(newPassword, policy, user.passwordHistoryHashes || []);
    if (!check.valid) {
      throw new Error(check.errors.join(' '));
    }

    const hash = hashSecretSalted(newPassword);
    const nextHistory = [hash, ...(user.passwordHistoryHashes || [])].slice(0, Math.max(policy.passwordHistoryCount, 5));
    const expiresAt = new Date(Date.now() + policy.passwordExpirationDays * 86400000).toISOString();

    this.updateUser(
      userId,
      {
        passwordHash: hash,
        passwordHistoryHashes: nextHistory,
        passwordUpdatedAt: new Date().toISOString(),
        passwordExpiresAt: expiresAt,
        mustChangePassword: requireChangeOnLogin,
        failedLoginAttempts: 0,
      },
      actor,
      reason
    );

    EnterpriseAuditService.logEvent({
      companyId: user.defaultCompanyId || 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: userId,
      eventType: 'PASSWORD_RESET',
      eventDescription: `Password securely reset (salted hash rotated) for ${user.fullName}`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: reason,
    });

    this.emitGovernanceNotification({
      title: 'Password Reset Recorded',
      message: `Credentials updated for ${user.fullName}. Next-login change flag: ${requireChangeOnLogin ? 'Required' : 'No'}.`,
      severity: 'INFO',
      recipientUserId: userId,
    });

    return { success: true, message: `Password updated cleanly under policy rules for ${user.fullName}.` };
  },

  forcePasswordChange(userId: string, actor: { id: string; name: string }): User {
    return this.updateUser(userId, { mustChangePassword: true }, actor, 'Forced password change on next login');
  },

  resendInvitation(userId: string, actor: { id: string; name: string }): User {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found.');
    const updated = this.updateUser(
      userId,
      { invitationStatus: 'SENT', invitationSentAt: new Date().toISOString() },
      actor,
      'Resent onboarding invitation'
    );
    this.emitGovernanceNotification({
      title: 'User Invitation Dispatched',
      message: `Onboarding invite sent to ${updated.email}.`,
      severity: 'INFO',
      recipientUserId: userId,
    });
    return updated;
  },

  getAssociationHistory(userId?: string): EmployeeAssociationHistoryRecord[] {
    const list = readStore<EmployeeAssociationHistoryRecord[]>(KEYS.ASSOCIATION_HISTORY, []);
    return userId ? list.filter((h) => h.userId === userId) : list;
  },

  /**
   * Marks an employee as Not Associated while strictly preserving user profile, employee history,
   * transactions, approvals, and audit records. Applies configured offboarding policy actions.
   */
  markEmployeeNotAssociated(
    userId: string,
    input: {
      effectiveDate: string;
      reason: string;
      approvalReference?: string;
    },
    actor: { id: string; name: string }
  ): User {
    if (!input.reason || input.reason.trim().length < 5) {
      throw new Error('Mandatory reason (minimum 5 characters) is required to mark an employee Not Associated.');
    }
    if (!input.effectiveDate) {
      throw new Error('Association end effective date is mandatory.');
    }
    const existing = this.getUserById(userId);
    if (!existing) throw new Error('User not found.');

    const previousAssociation: EmployeeAssociationStatus = existing.employeeAssociationStatus || 'ASSOCIATED';
    if (previousAssociation === 'NOT_ASSOCIATED') {
      throw new Error(
        'Employee is already marked Not Associated. Repeat Not Associated action is not permitted; use authorized Reassociation if returning.'
      );
    }

    if (existing.role === 'PLATFORM_ADMIN') {
      const activeSuperAdmins = this.getUsers().filter(
        (u) => u.role === 'PLATFORM_ADMIN' && u.status === 'ACTIVE' && u.employeeAssociationStatus !== 'NOT_ASSOCIATED'
      );
      if (activeSuperAdmins.length <= 1 && activeSuperAdmins[0]?.id === userId) {
        throw new Error('Protected safeguard: Cannot mark the last active Platform Super Administrator as Not Associated.');
      }
    }

    const policy = this.getSecurityPolicy(existing.defaultCompanyId);
    const nowIso = new Date().toISOString();
    const endDate = todayDateOnly(input.effectiveDate);

    // Apply offboarding policy: revoke active sessions, assignments, temp access, delegations & deactivate login
    const sessionsRevokedCount =
      policy.revokeSessionsOnNotAssociated !== false
        ? this.revokeAllUserSessions(userId, `Employee marked Not Associated (${input.reason.trim()})`, actor)
        : 0;

    let assignmentsRevokedCount = 0;
    let tempAccessRevokedCount = 0;
    let delegationsRevokedCount = 0;

    if (policy.revokeOrgAssignmentsOnNotAssociated !== false) {
      const assignments = this.getAssignments();
      const nextAssignments = assignments.map((a) => {
        if (a.userId === userId && (a.status === 'ACTIVE' || a.status === 'PENDING_APPROVAL')) {
          assignmentsRevokedCount += 1;
          return { ...a, status: 'REVOKED' as const, effectiveTo: endDate, updatedAt: nowIso };
        }
        return a;
      });
      writeStore(KEYS.ASSIGNMENTS, nextAssignments);

      const temps = this.getTemporaryAccess();
      const nextTemps = temps.map((t) => {
        if (t.userId === userId && (t.status === 'ACTIVE' || t.status === 'EXPIRING_SOON')) {
          tempAccessRevokedCount += 1;
          return {
            ...t,
            status: 'REVOKED' as const,
            revokedBy: actor.name,
            revokedAt: nowIso,
            revokeReason: `Employee Not Associated: ${input.reason.trim()}`,
          };
        }
        return t;
      });
      writeStore(KEYS.TEMP_ACCESS, nextTemps);

      const dels = this.getDelegations();
      const nextDels = dels.map((d) => {
        if ((d.delegatorUserId === userId || d.delegateUserId === userId) && d.status === 'ACTIVE') {
          delegationsRevokedCount += 1;
          return { ...d, status: 'REVOKED' as const, revokedBy: actor.name, revokedAt: nowIso };
        }
        return d;
      });
      writeStore(KEYS.DELEGATIONS, nextDels);
    }

    const accountDeactivated = policy.deactivateAccountOnNotAssociated !== false;
    const nextStatus: ManagedUserStatus = accountDeactivated ? 'DEACTIVATED' : existing.status || 'DEACTIVATED';

    const updated = this.updateUser(
      userId,
      {
        employeeAssociationStatus: 'NOT_ASSOCIATED',
        associationEndDate: endDate,
        associationReason: input.reason.trim(),
        associationUpdatedAt: nowIso,
        associationUpdatedBy: actor.name,
        status: nextStatus,
        effectiveTo: endDate,
      },
      actor,
      `Employee marked Not Associated: ${input.reason.trim()}`
    );

    const historyRecord: EmployeeAssociationHistoryRecord = {
      id: `ahist-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      userId,
      username: updated.username,
      userName: updated.fullName,
      employeeId: updated.employeeId,
      companyId: updated.defaultCompanyId || 'co-kosh-01',
      previousStatus: previousAssociation,
      newStatus: 'NOT_ASSOCIATED',
      effectiveDate: endDate,
      reason: input.reason.trim(),
      changedByUserId: actor.id,
      changedByName: actor.name,
      approvalReference: input.approvalReference?.trim(),
      offboardingActionsApplied: {
        accountDeactivated,
        sessionsRevokedCount,
        assignmentsRevokedCount,
        tempAccessRevokedCount,
        delegationsRevokedCount,
      },
      timestamp: nowIso,
    };
    const assocHistory = this.getAssociationHistory();
    writeStore(KEYS.ASSOCIATION_HISTORY, [historyRecord, ...assocHistory]);

    invalidatePermissionCache(`Employee marked Not Associated: ${updated.username}`);

    EnterpriseAuditService.logEvent({
      companyId: updated.defaultCompanyId || 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: userId,
      eventType: 'EMPLOYEE_NOT_ASSOCIATED',
      eventDescription: `Marked ${updated.fullName} (@${updated.username}) as Not Associated (End Date: ${endDate}); revoked ${assignmentsRevokedCount} assignment(s), ${sessionsRevokedCount} session(s), ${tempAccessRevokedCount} temp grant(s), ${delegationsRevokedCount} delegation(s) while preserving all historical records`,
      previousValue: { employeeAssociationStatus: previousAssociation, status: existing.status },
      newValue: { employeeAssociationStatus: 'NOT_ASSOCIATED', status: updated.status, associationEndDate: endDate },
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: input.reason.trim(),
      authorizationReference: input.approvalReference,
    });

    this.emitGovernanceNotification({
      title: 'Employee Marked Not Associated',
      message: `${updated.fullName} marked Not Associated effective ${endDate}. Access revoked per offboarding policy; historical records preserved.`,
      severity: 'CRITICAL',
    });

    return updated;
  },

  /**
   * Authorized Reassociation workflow (Not Associated -> Associated).
   * Requires validated employee relationship, target company, explicit approved role/org assignment,
   * and authorized approval reference. NEVER auto-restores previously revoked roles or permissions.
   */
  reassociateEmployee(
    userId: string,
    input: {
      effectiveDate: string;
      companyId: string;
      branchId?: string;
      employeeId: string;
      employeeRelationshipValidated: boolean;
      roleId: string;
      scope?: Partial<OrganizationalScope>;
      approvalReference: string;
      approvedByUserId?: string;
      approvedByName: string;
      reason: string;
      activateAccount?: boolean;
    },
    actor: { id: string; name: string }
  ): User {
    const existing = this.getUserById(userId);
    if (!existing) throw new Error('User not found.');
    if ((existing.employeeAssociationStatus || 'ASSOCIATED') !== 'NOT_ASSOCIATED') {
      throw new Error('Authorized Reassociation applies only to employees currently marked Not Associated.');
    }
    if (!input.effectiveDate) {
      throw new Error('Effective reassociation date is mandatory.');
    }
    if (!input.employeeRelationshipValidated || !input.employeeId?.trim()) {
      throw new Error('Validated employee ID and confirmation of active employee relationship are required for Reassociation.');
    }
    const company = INITIAL_COMPANIES.find((c) => c.id === input.companyId);
    if (!company) {
      throw new Error('A valid Company selection is required for Reassociation.');
    }
    const role = this.getRoleById(input.roleId);
    if (!role || role.status !== 'ACTIVE') {
      throw new Error('An explicitly approved active Role must be selected for Reassociation (previous roles are never auto-restored).');
    }
    if (!input.reason || input.reason.trim().length < 5) {
      throw new Error('Mandatory business reason (minimum 5 characters) is required for Reassociation.');
    }

    const policy = this.getSecurityPolicy(input.companyId);
    if (policy.requireApprovalForReassociation !== false) {
      if (!input.approvalReference?.trim() || !input.approvedByName?.trim()) {
        throw new Error('Authorized approval reference and approver name are required under Reassociation governance policy.');
      }
      if (input.approvedByUserId && (input.approvedByUserId === userId || input.approvedByUserId === actor.id)) {
        throw new Error('Maker-Checker violation: Reassociation approver must be distinct from the target employee and initiator.');
      }
    }

    const nowIso = new Date().toISOString();
    const effDate = todayDateOnly(input.effectiveDate);
    const branchId = input.branchId || existing.defaultBranchId || 'br-pond-01';
    const nextStatus: ManagedUserStatus = input.activateAccount === false ? 'DEACTIVATED' : 'ACTIVE';

    // Update user profile WITHOUT auto-restoring any previously revoked assignments
    const updated = this.updateUser(
      userId,
      {
        employeeAssociationStatus: 'ASSOCIATED',
        employeeId: input.employeeId.trim(),
        defaultCompanyId: input.companyId,
        defaultBranchId: branchId,
        allowedBranchIds: input.scope?.branchIds?.length ? input.scope.branchIds : [branchId],
        role: role.roleCode as UserRole,
        status: nextStatus,
        associationStartDate: effDate,
        associationEndDate: undefined,
        associationReason: input.reason.trim(),
        associationUpdatedAt: nowIso,
        associationUpdatedBy: actor.name,
        reassociatedAt: nowIso,
        reassociatedBy: actor.name,
        reassociationApprovalRef: input.approvalReference.trim(),
        effectiveFrom: effDate,
        effectiveTo: undefined,
      },
      actor,
      `Employee Reassociated (${input.approvalReference.trim()}): ${input.reason.trim()}`
    );

    // Explicitly provision ONLY the newly approved organizational role assignment;
    // historical REVOKED assignments remain REVOKED in audit history!
    const newScope: OrganizationalScope = {
      ...emptyScope(input.companyId, input.scope?.dataScopeLevel || 'BRANCH_RECORDS'),
      ...input.scope,
      companyIds: input.scope?.companyIds?.length ? input.scope.companyIds : [input.companyId],
      branchIds: input.scope?.branchIds?.length ? input.scope.branchIds : branchId ? [branchId] : [],
    };
    const assignments = this.getAssignments();
    const freshAssignment: UserRoleAssignment = {
      id: `ura-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      userId,
      roleId: role.id,
      roleCode: role.roleCode,
      roleName: role.roleName,
      companyId: input.companyId,
      branchId,
      scope: newScope,
      isDefaultContext: true,
      assignmentDate: todayDateOnly(),
      effectiveFrom: effDate,
      assignedBy: actor.name,
      approvedBy: input.approvedByName.trim(),
      status: 'ACTIVE',
      reason: `Explicitly approved reassociation assignment (Ref: ${input.approvalReference.trim()}) — prior revoked assignments NOT restored`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    writeStore(KEYS.ASSIGNMENTS, [freshAssignment, ...assignments]);

    const historyRecord: EmployeeAssociationHistoryRecord = {
      id: `ahist-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      userId,
      username: updated.username,
      userName: updated.fullName,
      employeeId: updated.employeeId,
      companyId: input.companyId,
      previousStatus: 'NOT_ASSOCIATED',
      newStatus: 'ASSOCIATED',
      effectiveDate: effDate,
      reason: input.reason.trim(),
      changedByUserId: actor.id,
      changedByName: actor.name,
      approvedByUserId: input.approvedByUserId,
      approvedByName: input.approvedByName.trim(),
      approvalReference: input.approvalReference.trim(),
      revalidatedOrgAssignments: [
        {
          roleCode: role.roleCode,
          companyId: input.companyId,
          branchId,
          scopeSummary: `${newScope.dataScopeLevel} (${newScope.branchIds.join(', ') || 'Company-wide'})`,
        },
      ],
      timestamp: nowIso,
    };
    const assocHistory = this.getAssociationHistory();
    writeStore(KEYS.ASSOCIATION_HISTORY, [historyRecord, ...assocHistory]);

    invalidatePermissionCache(`Employee Reassociated: ${updated.username}`);

    EnterpriseAuditService.logEvent({
      companyId: input.companyId,
      branchId,
      entityType: 'SECURITY',
      entityId: userId,
      eventType: 'EMPLOYEE_REASSOCIATED',
      eventDescription: `Authorized Reassociation completed for ${updated.fullName} (@${updated.username}, EmpID: ${updated.employeeId}) effective ${effDate}; new approved role ${role.roleCode} provisioned (historical revoked roles NOT restored)`,
      previousValue: { employeeAssociationStatus: 'NOT_ASSOCIATED', status: existing.status },
      newValue: {
        employeeAssociationStatus: 'ASSOCIATED',
        status: updated.status,
        roleCode: role.roleCode,
        companyId: input.companyId,
        approvalReference: input.approvalReference.trim(),
      },
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: input.reason.trim(),
      authorizationReference: input.approvalReference.trim(),
    });

    this.emitGovernanceNotification({
      title: 'Employee Reassociated',
      message: `${updated.fullName} reassociated effective ${effDate} with explicitly approved role ${role.roleCode} (Ref: ${input.approvalReference.trim()}).`,
      severity: 'SUCCESS',
      recipientUserId: userId,
    });

    return updated;
  },

  archiveUser(userId: string, actor: { id: string; name: string }, reason = 'Archived historical identity'): User {
    const existing = this.getUserById(userId);
    if (!existing) throw new Error('User not found.');
    if (existing.status === 'ACTIVE') {
      throw new Error('Deactivate or mark user Not Associated before archiving.');
    }
    return this.updateUser(
      userId,
      { status: 'ARCHIVED', archivedAt: new Date().toISOString() },
      actor,
      reason
    );
  },

  previewBulkUserImport(
    rows: Array<{
      username: string;
      email: string;
      firstName: string;
      lastName: string;
      userType?: ManagedUserType;
      employeeId?: string;
      defaultCompanyCode: string;
      defaultBranchCode: string;
      roleCode: string;
      countryCode?: string;
      mobilePhone?: string;
      mobileNumberType?: MobileNumberType;
      mobileConsentStatus?: PersonalConsentStatus;
    }>
  ): BulkUserImportRowPreview[] {
    const existingUsers = this.getUsers();
    const roles = this.getRoles();
    const seenUsernames = new Set<string>();
    const seenEmails = new Set<string>();

    return rows.map((row, idx) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const uName = (row.username || '').trim().toLowerCase();
      const email = (row.email || '').trim().toLowerCase();

      if (!uName || uName.length < 3) errors.push('Invalid username (min 3 chars).');
      if (!email || !email.includes('@')) errors.push('Invalid email address.');
      if (!row.firstName?.trim() || !row.lastName?.trim()) errors.push('First and Last name are required.');

      if (uName && existingUsers.some((u) => (u.username || '').toLowerCase() === uName)) {
        errors.push(`Username '${uName}' already exists.`);
      }
      if (uName && seenUsernames.has(uName)) {
        errors.push(`Duplicate username '${uName}' inside import batch.`);
      }
      if (email && existingUsers.some((u) => u.email.toLowerCase() === email)) {
        errors.push(`Email '${email}' already exists.`);
      }
      if (email && seenEmails.has(email)) {
        errors.push(`Duplicate email '${email}' inside import batch.`);
      }

      const company = INITIAL_COMPANIES.find(
        (c) => c.code.toLowerCase() === (row.defaultCompanyCode || '').toLowerCase() || c.id === row.defaultCompanyCode
      );
      if (!company) errors.push(`Unknown Company '${row.defaultCompanyCode}'.`);

      const branch = INITIAL_BRANCHES.find(
        (b) => b.code.toLowerCase() === (row.defaultBranchCode || '').toLowerCase() || b.id === row.defaultBranchCode
      );
      if (!branch) errors.push(`Unknown Branch '${row.defaultBranchCode}'.`);
      else if (company && branch.companyId !== company.id) {
        errors.push(`Branch '${branch.code}' does not belong to Company '${company.code}'.`);
      }

      const role = roles.find((r) => r.roleCode === row.roleCode);
      if (!role) errors.push(`Unknown Role '${row.roleCode}'.`);
      if (role?.isSuperAdmin) {
        errors.push('Bulk import cannot directly provision PLATFORM_ADMIN role.');
      }
      if (row.userType === 'EMPLOYEE' && !row.employeeId) {
        warnings.push('Employee-type user lacks Employee ID linkage.');
      }

      if (row.mobileConsentStatus === 'CONSENT_GRANTED') {
        errors.push('Bulk import cannot mark Personal Mobile Consent as Granted; employee self-confirmation is mandatory.');
      }

      const mobPolicy = mobileConsentService.getCompanyMobilePolicy(company?.id);
      const mobCheck = mobileConsentService.validateMobileInput({
        countryCode: row.countryCode || '+91',
        mobilePhone: row.mobilePhone,
        mobileNumberType: row.mobileNumberType,
        isMandatory: mobPolicy.isMobileMandatoryOnOnboarding,
      });
      if (!mobCheck.valid) {
        errors.push(...mobCheck.errors);
      } else if (mobCheck.hasNumber && mobCheck.mobileNumberType === 'PERSONAL') {
        warnings.push('Personal mobile will start in PENDING_EMPLOYEE_CONSENT until employee confirms.');
      }

      if (uName) seenUsernames.add(uName);
      if (email) seenEmails.add(email);

      return {
        rowNumber: idx + 1,
        username: uName,
        email,
        firstName: row.firstName || '',
        lastName: row.lastName || '',
        userType: row.userType || 'EMPLOYEE',
        employeeId: row.employeeId,
        defaultCompanyCode: row.defaultCompanyCode,
        defaultBranchCode: row.defaultBranchCode,
        roleCode: row.roleCode || 'READ_ONLY_USER',
        countryCode: row.countryCode || (row.mobilePhone ? '+91' : undefined),
        mobilePhone: row.mobilePhone,
        mobileNumberType: row.mobileNumberType || (row.mobilePhone ? 'OFFICIAL' : undefined),
        mobileConsentStatus:
          row.mobilePhone && row.mobileNumberType === 'PERSONAL' ? 'PENDING_EMPLOYEE_CONSENT' : undefined,
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    });
  },

  commitBulkUserImport(
    previews: BulkUserImportRowPreview[],
    actor: { id: string; name: string }
  ): { createdCount: number; failedCount: number; createdUsers: User[]; errors: string[] } {
    const createdUsers: User[] = [];
    const errors: string[] = [];

    for (const row of previews) {
      if (!row.isValid) {
        errors.push(`Row ${row.rowNumber}: ${row.errors.join(' ')}`);
        continue;
      }
      try {
        const company = INITIAL_COMPANIES.find(
          (c) => c.code.toLowerCase() === row.defaultCompanyCode.toLowerCase() || c.id === row.defaultCompanyCode
        );
        const branch = INITIAL_BRANCHES.find(
          (b) => b.code.toLowerCase() === row.defaultBranchCode.toLowerCase() || b.id === row.defaultBranchCode
        );
        const created = this.createUser(
          {
            username: row.username,
            email: row.email,
            firstName: row.firstName,
            lastName: row.lastName,
            userType: row.userType,
            employeeId: row.employeeId,
            countryCode: row.countryCode,
            mobilePhone: row.mobilePhone,
            mobileNumberType: row.mobileNumberType,
            mobileConsentStatus: row.mobileConsentStatus,
            role: row.roleCode as UserRole,
            defaultCompanyId: company?.id || 'co-kosh-01',
            defaultBranchId: branch?.id || 'br-pond-01',
            allowedBranchIds: branch ? [branch.id] : [],
            creationMode: 'INVITED',
            reason: `Bulk user import (Row #${row.rowNumber})`,
          },
          actor
        );
        createdUsers.push(created);
      } catch (err: any) {
        errors.push(`Row ${row.rowNumber}: ${err.message}`);
      }
    }

    EnterpriseAuditService.logEvent({
      companyId: 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: `bulk-import-${Date.now()}`,
      eventType: 'USER_BULK_IMPORT',
      eventDescription: `Bulk import executed: ${createdUsers.length} created, ${errors.length} rejected`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: 'Controlled bulk user onboarding import',
    });

    return {
      createdCount: createdUsers.length,
      failedCount: errors.length,
      createdUsers,
      errors,
    };
  },

  // =========================================================================
  // ROLE MANAGEMENT, HIERARCHY, VERSIONING & COMPARISON
  // =========================================================================
  getRoles(filters?: { search?: string; category?: string; status?: string }): RoleDefinition[] {
    let roles = readStore<RoleDefinition[]>(KEYS.ROLES, INITIAL_ROLES);
    if (filters) {
      if (filters.category && filters.category !== 'ALL') {
        roles = roles.filter((r) => r.category === filters.category);
      }
      if (filters.status && filters.status !== 'ALL') {
        roles = roles.filter((r) => r.status === filters.status);
      }
      if (filters.search && filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        roles = roles.filter(
          (r) =>
            r.roleName.toLowerCase().includes(q) ||
            r.roleCode.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q)
        );
      }
    }
    return roles;
  },

  getRoleById(roleId: string): RoleDefinition | undefined {
    return this.getRoles().find((r) => r.id === roleId);
  },

  getRoleByCode(roleCode: string): RoleDefinition | undefined {
    return this.getRoles().find((r) => r.roleCode === roleCode);
  },

  wouldCreateCycle(roleId: string, candidateParentId?: string | null): boolean {
    if (!candidateParentId) return false;
    if (roleId === candidateParentId) return true;
    const roles = this.getRoles();
    const visited = new Set<string>([roleId]);
    let curr: string | null | undefined = candidateParentId;
    while (curr) {
      if (visited.has(curr)) return true;
      visited.add(curr);
      const node = roles.find((r) => r.id === curr);
      curr = node?.parentRoleId;
    }
    return false;
  },

  getEffectiveRolePermissions(roleIdOrCode: string): {
    effectivePermissions: string[];
    explicitPermissions: string[];
    inheritedPermissions: string[];
    restrictedPermissions: string[];
    inheritanceChain: string[];
  } {
    const roles = this.getRoles();
    const root = roles.find((r) => r.id === roleIdOrCode || r.roleCode === roleIdOrCode);
    if (!root) {
      return {
        effectivePermissions: [],
        explicitPermissions: [],
        inheritedPermissions: [],
        restrictedPermissions: [],
        inheritanceChain: [],
      };
    }

    // Build chain from highest ancestor down to root
    const chainRoles: RoleDefinition[] = [];
    const seen = new Set<string>();
    let curr: RoleDefinition | undefined = root;
    while (curr && !seen.has(curr.id)) {
      seen.add(curr.id);
      chainRoles.unshift(curr);
      curr = curr.parentRoleId ? roles.find((r) => r.id === curr!.parentRoleId) : undefined;
    }

    const inheritedSet = new Set<string>();
    const restrictedSet = new Set<string>(root.restrictedPermissionCodes || []);

    for (let i = 0; i < chainRoles.length - 1; i++) {
      const ancestor = chainRoles[i];
      if (ancestor.status !== 'ACTIVE') continue;
      ancestor.explicitPermissionCodes.forEach((p) => inheritedSet.add(p));
      (ancestor.restrictedPermissionCodes || []).forEach((p) => restrictedSet.add(p));
    }

    const combined = new Set<string>([...inheritedSet, ...root.explicitPermissionCodes]);
    restrictedSet.forEach((r) => combined.delete(r));

    return {
      effectivePermissions: Array.from(combined),
      explicitPermissions: [...root.explicitPermissionCodes],
      inheritedPermissions: Array.from(inheritedSet).filter((p) => !restrictedSet.has(p)),
      restrictedPermissions: Array.from(restrictedSet),
      inheritanceChain: chainRoles.map((r) => r.roleCode),
    };
  },

  getRoleVersionHistory(roleId?: string): RoleVersionHistoryRecord[] {
    const list = readStore<RoleVersionHistoryRecord[]>(KEYS.ROLE_VERSIONS, []);
    return roleId ? list.filter((v) => v.roleId === roleId) : list;
  },

  createRole(
    input: {
      roleCode: string;
      roleName: string;
      description: string;
      category: RoleCategory;
      parentRoleId?: string | null;
      status?: RoleLifecycleStatus;
      effectiveFrom?: string;
      effectiveTo?: string;
      explicitPermissionCodes?: string[];
      restrictedPermissionCodes?: string[];
    },
    actor: { id: string; name: string },
    reason = 'Created new custom role'
  ): RoleDefinition {
    const roles = this.getRoles();
    const code = input.roleCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!code || code.length < 3) throw new Error('Role Code must be at least 3 uppercase characters.');
    if (roles.some((r) => r.roleCode.toUpperCase() === code)) {
      throw new Error(`Role code '${code}' already exists.`);
    }
    if (roles.some((r) => r.roleName.toLowerCase() === input.roleName.trim().toLowerCase())) {
      throw new Error(`Role name '${input.roleName}' already exists.`);
    }

    const id = `role-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    if (this.wouldCreateCycle(id, input.parentRoleId)) {
      throw new Error('Circular role inheritance rejected.');
    }

    const nowIso = new Date().toISOString();
    const created: RoleDefinition = {
      id,
      roleCode: code,
      roleName: input.roleName.trim(),
      description: input.description.trim() || 'Custom enterprise role.',
      category: input.category,
      roleType: 'CUSTOM',
      parentRoleId: input.parentRoleId || null,
      status: input.status || 'ACTIVE',
      isSystemProtected: false,
      isSuperAdmin: false,
      effectiveFrom: input.effectiveFrom || todayDateOnly(),
      effectiveTo: input.effectiveTo,
      version: 1,
      createdBy: actor.name,
      approvedBy: actor.name,
      createdAt: nowIso,
      updatedAt: nowIso,
      explicitPermissionCodes: input.explicitPermissionCodes || [],
      restrictedPermissionCodes: input.restrictedPermissionCodes || [],
    };

    writeStore(KEYS.ROLES, [created, ...roles]);
    const versions = readStore<RoleVersionHistoryRecord[]>(KEYS.ROLE_VERSIONS, []);
    writeStore(KEYS.ROLE_VERSIONS, [
      {
        id: `rv-${Date.now()}`,
        roleId: created.id,
        roleCode: created.roleCode,
        version: 1,
        changedBy: actor.name,
        changedAt: nowIso,
        changeReason: reason,
        snapshot: {
          roleName: created.roleName,
          description: created.description,
          parentRoleId: created.parentRoleId,
          status: created.status,
          explicitPermissionCodes: [...created.explicitPermissionCodes],
          restrictedPermissionCodes: [...created.restrictedPermissionCodes],
        },
      },
      ...versions,
    ]);

    invalidatePermissionCache(`Created role ${created.roleCode}`);
    this.recordPermissionChange({
      targetType: 'ROLE',
      targetId: created.id,
      targetName: created.roleCode,
      action: 'CREATED',
      permissionCodes: created.explicitPermissionCodes,
      newValue: `Role v1 created (${created.status})`,
      companyId: 'co-kosh-01',
      actorUserId: actor.id,
      actorName: actor.name,
      reason,
    });

    EnterpriseAuditService.logEvent({
      companyId: 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: created.id,
      eventType: 'ROLE_CREATED',
      eventDescription: `Created role ${created.roleCode} (${created.roleName})`,
      newValue: { roleCode: created.roleCode, category: created.category, permissionCount: created.explicitPermissionCodes.length },
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: reason,
    });

    return created;
  },

  updateRole(
    roleId: string,
    patch: Partial<Pick<RoleDefinition, 'roleName' | 'description' | 'category' | 'parentRoleId' | 'status' | 'effectiveFrom' | 'effectiveTo'>>,
    reason: string,
    actor: { id: string; name: string }
  ): RoleDefinition {
    const roles = this.getRoles();
    const existing = roles.find((r) => r.id === roleId);
    if (!existing) throw new Error('Role not found.');

    if (patch.parentRoleId !== undefined && this.wouldCreateCycle(roleId, patch.parentRoleId)) {
      throw new Error('Circular role inheritance rejected: selected parent role descends from this role.');
    }
    if (existing.isSuperAdmin && patch.status && patch.status !== 'ACTIVE') {
      throw new Error('Protected safeguard: Platform Super Administrator role cannot be deactivated or expired.');
    }

    const nowIso = new Date().toISOString();
    const updated: RoleDefinition = {
      ...existing,
      ...patch,
      version: existing.version + 1,
      updatedAt: nowIso,
    };

    writeStore(KEYS.ROLES, roles.map((r) => (r.id === roleId ? updated : r)));

    const versions = readStore<RoleVersionHistoryRecord[]>(KEYS.ROLE_VERSIONS, []);
    writeStore(KEYS.ROLE_VERSIONS, [
      {
        id: `rv-${Date.now()}`,
        roleId: updated.id,
        roleCode: updated.roleCode,
        version: updated.version,
        changedBy: actor.name,
        changedAt: nowIso,
        changeReason: reason || 'Role metadata updated',
        snapshot: {
          roleName: updated.roleName,
          description: updated.description,
          parentRoleId: updated.parentRoleId,
          status: updated.status,
          explicitPermissionCodes: [...updated.explicitPermissionCodes],
          restrictedPermissionCodes: [...updated.restrictedPermissionCodes],
        },
      },
      ...versions,
    ]);

    invalidatePermissionCache(`Updated role ${updated.roleCode}`);
    EnterpriseAuditService.logEvent({
      companyId: 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: updated.id,
      eventType: 'ROLE_MODIFIED',
      eventDescription: `Modified role ${updated.roleCode} (v${updated.version})`,
      previousValue: { status: existing.status, parentRoleId: existing.parentRoleId },
      newValue: { status: updated.status, parentRoleId: updated.parentRoleId },
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: reason || 'Role updated',
    });

    return updated;
  },

  cloneRole(
    sourceRoleId: string,
    newRoleCode: string,
    newRoleName: string,
    actor: { id: string; name: string }
  ): RoleDefinition {
    const source = this.getRoleById(sourceRoleId);
    if (!source) throw new Error('Source role not found.');
    return this.createRole(
      {
        roleCode: newRoleCode,
        roleName: newRoleName,
        description: `Cloned from ${source.roleCode}: ${source.description}`,
        category: source.category === 'SYSTEM_ROLE' ? 'CUSTOM_ROLE' : source.category,
        parentRoleId: source.parentRoleId,
        status: 'ACTIVE',
        explicitPermissionCodes: [...source.explicitPermissionCodes],
        restrictedPermissionCodes: [...source.restrictedPermissionCodes],
      },
      actor,
      `Cloned from role ${source.roleCode}`
    );
  },

  deleteRole(roleId: string, reason: string, actor: { id: string; name: string }): void {
    const roles = this.getRoles();
    const target = roles.find((r) => r.id === roleId);
    if (!target) throw new Error('Role not found.');
    if (target.isSystemProtected || target.isSuperAdmin) {
      throw new Error(`Protected system role '${target.roleCode}' cannot be deleted.`);
    }
    const activeAssignments = this.getAssignments().filter((a) => a.roleId === roleId && a.status === 'ACTIVE');
    if (activeAssignments.length > 0) {
      throw new Error(`Cannot delete role '${target.roleCode}' because ${activeAssignments.length} active user assignment(s) depend on it.`);
    }

    writeStore(KEYS.ROLES, roles.filter((r) => r.id !== roleId));
    invalidatePermissionCache(`Deleted role ${target.roleCode}`);

    EnterpriseAuditService.logEvent({
      companyId: 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: roleId,
      eventType: 'ROLE_DELETED',
      eventDescription: `Deleted custom role ${target.roleCode} (${target.roleName})`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: reason || 'Role retired',
    });
  },

  setRolePermissions(
    roleId: string,
    explicitPermissionCodes: string[],
    restrictedPermissionCodes: string[] = [],
    permissionScopes: Record<string, DataScopeLevel> | undefined,
    reason: string,
    actor: { id: string; name: string }
  ): RoleDefinition {
    const roles = this.getRoles();
    const existing = roles.find((r) => r.id === roleId);
    if (!existing) throw new Error('Role not found.');

    const actorUser = this.getUserById(actor.id);
    if (existing.isSuperAdmin && actorUser && actorUser.role !== 'PLATFORM_ADMIN') {
      throw new Error('Additional authorization required: only an active Platform Super Administrator can modify super admin permissions.');
    }

    const dedupedExplicit = Array.from(new Set(explicitPermissionCodes));
    const dedupedRestricted = Array.from(new Set(restrictedPermissionCodes));
    const added = dedupedExplicit.filter((p) => !existing.explicitPermissionCodes.includes(p));
    const removed = existing.explicitPermissionCodes.filter((p) => !dedupedExplicit.includes(p));

    const nowIso = new Date().toISOString();
    const updated: RoleDefinition = {
      ...existing,
      explicitPermissionCodes: dedupedExplicit,
      restrictedPermissionCodes: dedupedRestricted,
      permissionScopes: permissionScopes ?? existing.permissionScopes,
      version: existing.version + 1,
      updatedAt: nowIso,
    };

    writeStore(KEYS.ROLES, roles.map((r) => (r.id === roleId ? updated : r)));
    invalidatePermissionCache(`Updated permissions on role ${updated.roleCode}`);

    // Sync legacy rbacPermissionService for the 13 overlapping keys if this is a core UserRole
    const permsRegistry = this.getPermissions();
    const legacyKeysToSync = permsRegistry.filter((p) => p.legacyAliasKey);
    if (['PLATFORM_ADMIN', 'ORG_ADMIN', 'GLOBAL_ITEM_ADMIN', 'ITEM_MAKER', 'ITEM_CHECKER', 'BRANCH_COORDINATOR', 'MASTER_DATA_AUDITOR', 'INTEGRATION_SERVICE_ACCOUNT', 'READ_ONLY_USER'].includes(updated.roleCode)) {
      const legacyRoleMap = rbacPermissionService.getRolePermissionsMap();
      const effectiveSet = new Set(this.getEffectiveRolePermissions(updated.id).effectivePermissions);
      const nextLegacyKeys: EnterprisePermissionKey[] = [];
      for (const def of legacyKeysToSync) {
        if (effectiveSet.has(def.permissionCode) && def.legacyAliasKey) {
          nextLegacyKeys.push(def.legacyAliasKey as EnterprisePermissionKey);
        }
      }
      legacyRoleMap[updated.roleCode as UserRole] = nextLegacyKeys;
      rbacPermissionService.saveRolePermissionsMap(legacyRoleMap);
    }

    if (added.length > 0) {
      this.recordPermissionChange({
        targetType: 'ROLE',
        targetId: updated.id,
        targetName: updated.roleCode,
        action: 'GRANTED',
        permissionCodes: added,
        previousValue: `${existing.explicitPermissionCodes.length} explicit permissions`,
        newValue: `${dedupedExplicit.length} explicit permissions`,
        companyId: 'co-kosh-01',
        actorUserId: actor.id,
        actorName: actor.name,
        reason: reason || 'Role permission grant',
      });
    }
    if (removed.length > 0) {
      this.recordPermissionChange({
        targetType: 'ROLE',
        targetId: updated.id,
        targetName: updated.roleCode,
        action: 'REVOKED',
        permissionCodes: removed,
        previousValue: `${existing.explicitPermissionCodes.length} explicit permissions`,
        newValue: `${dedupedExplicit.length} explicit permissions`,
        companyId: 'co-kosh-01',
        actorUserId: actor.id,
        actorName: actor.name,
        reason: reason || 'Role permission revocation',
      });
    }

    EnterpriseAuditService.logEvent({
      companyId: 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: updated.id,
      eventType: 'ROLE_PERMISSIONS_UPDATED',
      eventDescription: `Updated permissions for ${updated.roleCode} (+${added.length} / -${removed.length})`,
      previousValue: { count: existing.explicitPermissionCodes.length },
      newValue: { count: dedupedExplicit.length, added, removed },
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: reason || 'Role permission matrix update',
    });

    this.emitGovernanceNotification({
      title: 'Role Permissions Updated',
      message: `${updated.roleCode} updated (+${added.length} granted, -${removed.length} revoked). Cache invalidated.`,
      severity: 'INFO',
    });

    return updated;
  },

  compareRoles(roleIdA: string, roleIdB: string): {
    onlyInA: string[];
    onlyInB: string[];
    common: string[];
  } {
    const effA = new Set(this.getEffectiveRolePermissions(roleIdA).effectivePermissions);
    const effB = new Set(this.getEffectiveRolePermissions(roleIdB).effectivePermissions);
    return {
      onlyInA: Array.from(effA).filter((p) => !effB.has(p)).sort(),
      onlyInB: Array.from(effB).filter((p) => !effA.has(p)).sort(),
      common: Array.from(effA).filter((p) => effB.has(p)).sort(),
    };
  },

  // =========================================================================
  // MODULE, SUBMODULE, FEATURE & AUTOMATIC PERMISSION REGISTRY (SECTION 10)
  // =========================================================================
  getModules(): RegistryModuleEntry[] {
    return readStore<RegistryModuleEntry[]>(KEYS.MODULES, INITIAL_REGISTRY_MODULES);
  },

  getSubmodules(): RegistrySubmoduleEntry[] {
    return readStore<RegistrySubmoduleEntry[]>(KEYS.SUBMODULES, INITIAL_REGISTRY_SUBMODULES);
  },

  getFeatures(): RegistryFeatureEntry[] {
    return readStore<RegistryFeatureEntry[]>(KEYS.FEATURES, INITIAL_REGISTRY_FEATURES);
  },

  getPermissions(): RegistryPermissionEntry[] {
    return readStore<RegistryPermissionEntry[]>(KEYS.PERMISSIONS, INITIAL_REGISTRY_PERMISSIONS);
  },

  /**
   * Registers a new Module / Submodule / Feature / Actions into the centralized permission tree.
   * CRITICAL SECURITY INVARIANT:
   * Newly registered permissions are NEVER auto-granted to existing operational or admin roles!
   * Instead, they default to DENY and emit a RoleImpactProposalItem[] for explicit admin approval.
   */
  registerModuleFeaturePermissions(
    input: {
      moduleCode: string;
      moduleName: string;
      routeReference: string;
      apiNamespace: string;
      moduleOwner?: string;
      submoduleCode?: string;
      submoduleName?: string;
      featureCode: string;
      featureName: string;
      featureDescription?: string;
      relatedApi: string;
      relatedService?: string;
      actions: PermissionActionType[];
      sensitivity?: 'STANDARD' | 'HIGH' | 'CRITICAL';
      allowedDataScopes?: DataScopeLevel[];
      recommendedRoleCodes?: string[];
    },
    actor: { id: string; name: string }
  ): {
    module: RegistryModuleEntry;
    feature: RegistryFeatureEntry;
    registeredPermissions: RegistryPermissionEntry[];
    roleImpactProposals: RoleImpactProposalItem[];
  } {
    const modCode = input.moduleCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const subCode = input.submoduleCode?.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const featCode = input.featureCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const nowIso = new Date().toISOString();

    const modules = this.getModules();
    let mod = modules.find((m) => m.moduleCode === modCode);
    if (!mod) {
      mod = {
        id: `reg-mod-${Date.now()}`,
        moduleCode: modCode,
        moduleName: input.moduleName.trim() || modCode,
        description: `${input.moduleName} registered enterprise module.`,
        routeReference: input.routeReference || `/${modCode.toLowerCase()}`,
        apiNamespace: input.apiNamespace || `/api/${modCode.toLowerCase()}`,
        moduleOwner: input.moduleOwner || 'Platform Governance',
        status: 'ACTIVE',
        version: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      writeStore(KEYS.MODULES, [...modules, mod]);
    }

    const submodules = this.getSubmodules();
    let sub: RegistrySubmoduleEntry | undefined;
    if (subCode) {
      sub = submodules.find((s) => s.submoduleCode === subCode && s.parentModuleCode === modCode);
      if (!sub) {
        sub = {
          id: `sub-${Date.now()}`,
          submoduleCode: subCode,
          submoduleName: input.submoduleName || subCode,
          parentModuleId: mod.id,
          parentModuleCode: modCode,
          description: `${input.submoduleName || subCode} submodule`,
          routeReference: input.routeReference || mod.routeReference,
          status: 'ACTIVE',
          version: 1,
        };
        writeStore(KEYS.SUBMODULES, [...submodules, sub]);
      }
    }

    const existingPerms = this.getPermissions();
    const newPerms: RegistryPermissionEntry[] = [];
    const generatedCodes: string[] = [];

    for (const action of Array.from(new Set(input.actions))) {
      const permissionCode = `${modCode}.${featCode}.${action}`;
      generatedCodes.push(permissionCode);
      if (!existingPerms.some((p) => p.permissionCode === permissionCode)) {
        const perm: RegistryPermissionEntry = {
          id: `perm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          permissionCode,
          moduleCode: modCode,
          submoduleCode: subCode,
          featureCode: featCode,
          action,
          label: `${input.featureName} — ${action}`,
          description: `${action} permission for ${input.featureName} under ${mod.moduleName}.`,
          allowedDataScopes:
            input.allowedDataScopes && input.allowedDataScopes.length > 0
              ? input.allowedDataScopes
              : ['BRANCH_RECORDS', 'COMPANY_RECORDS', 'ALL_AUTHORIZED_RECORDS'],
          sensitivity:
            input.sensitivity ||
            (['APPROVE', 'CONFIGURE', 'ADMIN_OVERRIDE', 'DELETE', 'POST'].includes(action) ? 'HIGH' : 'STANDARD'),
          apiEndpoint: input.relatedApi,
          uiControlKey: `${modCode.toLowerCase()}.${featCode.toLowerCase()}.${action.toLowerCase()}`,
          status: 'ACTIVE',
          version: 1,
          registeredAt: nowIso,
          registeredBy: actor.name,
          requiresApprovalToGrant: true,
        };
        newPerms.push(perm);
      }
    }

    const features = this.getFeatures();
    let feat = features.find((f) => f.featureCode === featCode && f.parentModuleCode === modCode);
    if (!feat) {
      feat = {
        id: `feat-${Date.now()}`,
        featureCode: featCode,
        featureName: input.featureName.trim(),
        parentModuleId: mod.id,
        parentModuleCode: modCode,
        parentSubmoduleId: sub?.id,
        parentSubmoduleCode: sub?.submoduleCode,
        description: input.featureDescription || `${input.featureName} protected business actions.`,
        relatedApi: input.relatedApi || mod.apiNamespace,
        relatedService: input.relatedService || 'enterpriseService',
        requiredPermissionCodes: generatedCodes,
        validActions: Array.from(new Set(input.actions)),
        status: 'ACTIVE',
        version: 1,
        registeredAt: nowIso,
      };
      writeStore(KEYS.FEATURES, [...features, feat]);
    } else {
      feat = {
        ...feat,
        requiredPermissionCodes: Array.from(new Set([...feat.requiredPermissionCodes, ...generatedCodes])),
        validActions: Array.from(new Set([...feat.validActions, ...input.actions])),
        version: feat.version + 1,
      };
      writeStore(KEYS.FEATURES, features.map((f) => (f.id === feat!.id ? feat! : f)));
    }

    if (newPerms.length > 0) {
      writeStore(KEYS.PERMISSIONS, [...existingPerms, ...newPerms]);
      invalidatePermissionCache(`Registered ${newPerms.length} permissions for ${featCode}`);
    }

    // Build Role-Impact Proposal WITHOUT auto-granting to ANY role
    const roles = this.getRoles();
    const roleImpactProposals: RoleImpactProposalItem[] = newPerms.map((p) => ({
      permissionCode: p.permissionCode,
      label: p.label,
      moduleCode: p.moduleCode,
      featureCode: p.featureCode,
      recommendedRoleCodes:
        input.recommendedRoleCodes && input.recommendedRoleCodes.length > 0
          ? input.recommendedRoleCodes
          : p.action === 'VIEW'
          ? ['PLATFORM_ADMIN', 'ORG_ADMIN', 'MASTER_DATA_AUDITOR']
          : ['PLATFORM_ADMIN', 'ORG_ADMIN'],
      alreadyGrantedRoleCodes: roles
        .filter((r) => r.explicitPermissionCodes.includes(p.permissionCode))
        .map((r) => r.roleCode),
      pendingApprovalRoleCodes: ['PLATFORM_ADMIN', 'ORG_ADMIN'],
      rationale: 'Registered as DENY-BY-DEFAULT. Requires explicit administrator approval before granting to any role.',
    }));

    this.recordPermissionChange({
      targetType: 'REGISTRY',
      targetId: feat.id,
      targetName: `${modCode}.${featCode}`,
      action: 'REGISTERED',
      permissionCodes: newPerms.map((p) => p.permissionCode),
      newValue: `${newPerms.length} permission(s) registered (no roles auto-granted)`,
      companyId: 'co-kosh-01',
      actorUserId: actor.id,
      actorName: actor.name,
      reason: 'Automated Module/Feature Permission Registration',
    });

    EnterpriseAuditService.logEvent({
      companyId: 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: feat.id,
      eventType: 'PERMISSION_REGISTRY_UPDATED',
      eventDescription: `Registered ${newPerms.length} new permission(s) under ${modCode} -> ${featCode} (Deny-by-Default enforced)`,
      newValue: { permissionCodes: newPerms.map((p) => p.permissionCode) },
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: 'Automatic permission registration for feature/module',
    });

    return {
      module: mod,
      feature: feat,
      registeredPermissions: newPerms,
      roleImpactProposals,
    };
  },

  approveRoleImpactGrant(
    params: { permissionCode: string; targetRoleIds: string[]; reason: string },
    actor: { id: string; name: string }
  ): { grantedRoles: string[] } {
    const auth = this.evaluateAuthorization({
      userId: actor.id,
      permissionCode: 'USER_ADMIN.ROLE_MANAGEMENT.APPROVE',
      actionType: 'APPROVE',
    });
    if (!auth.allowed) {
      throw new Error(`Authorization denied: ${auth.reason}`);
    }
    const perm = this.getPermissions().find((p) => p.permissionCode === params.permissionCode);
    if (!perm) throw new Error(`Permission '${params.permissionCode}' is not registered.`);

    const grantedRoles: string[] = [];
    for (const roleId of params.targetRoleIds) {
      const role = this.getRoleById(roleId);
      if (!role) continue;
      if (!role.explicitPermissionCodes.includes(perm.permissionCode)) {
        this.setRolePermissions(
          role.id,
          [...role.explicitPermissionCodes, perm.permissionCode],
          role.restrictedPermissionCodes,
          role.permissionScopes,
          params.reason || `Approved role-impact grant for ${perm.permissionCode}`,
          actor
        );
        grantedRoles.push(role.roleCode);
      }
    }
    return { grantedRoles };
  },

  /**
   * Synchronizes and audits Module -> Submodule -> Feature -> Permission integrity.
   * Detects missing permissions, duplicates, orphans, deprecated grants, and unmapped controls.
   */
  synchronizePermissionRegistry(actor: { id: string; name: string }): PermissionSyncReport {
    const modules = this.getModules();
    const submodules = this.getSubmodules();
    const features = this.getFeatures();
    const permissions = this.getPermissions();
    const roles = this.getRoles();

    const missingPermissions: PermissionSyncReport['missingPermissions'] = [];
    const seenCodes = new Map<string, number>();
    const duplicatePermissionCodes: string[] = [];

    for (const p of permissions) {
      const count = (seenCodes.get(p.permissionCode) || 0) + 1;
      seenCodes.set(p.permissionCode, count);
      if (count === 2) duplicatePermissionCodes.push(p.permissionCode);
    }

    const activeFeatureCodes = new Set(features.filter((f) => f.status === 'ACTIVE').map((f) => f.featureCode));
    const activeModuleCodes = new Set(modules.filter((m) => m.status === 'ACTIVE').map((m) => m.moduleCode));

    for (const feat of features.filter((f) => f.status === 'ACTIVE')) {
      for (const action of feat.validActions) {
        const expectedExact = `${feat.parentModuleCode}.${feat.featureCode}.${action}`;
        const hasMatch = permissions.some(
          (p) =>
            p.status === 'ACTIVE' &&
            (p.permissionCode === expectedExact ||
              (p.featureCode === feat.featureCode && p.action === action))
        );
        if (!hasMatch) {
          missingPermissions.push({
            featureCode: feat.featureCode,
            action,
            suggestedCode: expectedExact,
          });
        }
      }
    }

    const orphanedPermissions = permissions
      .filter((p) => !activeModuleCodes.has(p.moduleCode) || !activeFeatureCodes.has(p.featureCode))
      .map((p) => p.permissionCode);

    const deprecatedFeaturesWithActiveGrants: PermissionSyncReport['deprecatedFeaturesWithActiveGrants'] = [];
    const deprecatedCodes = new Set(
      permissions.filter((p) => p.status === 'DEPRECATED').map((p) => p.permissionCode)
    );
    for (const feat of features.filter((f) => f.status === 'DEPRECATED')) {
      feat.requiredPermissionCodes.forEach((c) => deprecatedCodes.add(c));
    }
    for (const depCode of deprecatedCodes) {
      const roleCodes = roles.filter((r) => r.explicitPermissionCodes.includes(depCode)).map((r) => r.roleCode);
      if (roleCodes.length > 0) {
        deprecatedFeaturesWithActiveGrants.push({
          featureCode: permissions.find((p) => p.permissionCode === depCode)?.featureCode || 'DEPRECATED',
          permissionCode: depCode,
          roleCodes,
        });
      }
    }

    const unprotectedApis = features
      .filter((f) => f.status === 'ACTIVE' && (!f.relatedApi || f.requiredPermissionCodes.length === 0))
      .map((f) => ({
        apiEndpoint: f.relatedApi || '(missing endpoint)',
        moduleCode: f.parentModuleCode,
        issue: 'Active feature lacks bound API endpoint or required permission codes.',
      }));

    const unmappedFrontendActions = permissions
      .filter((p) => p.status === 'ACTIVE' && !p.uiControlKey)
      .map((p) => ({
        uiControlKey: p.permissionCode,
        moduleCode: p.moduleCode,
        issue: 'Permission lacks mapped UI control key.',
      }));

    // Permissions not granted to any non-PLATFORM_ADMIN role yet -> Role-Impact Proposal
    const roleImpactProposals: RoleImpactProposalItem[] = permissions
      .filter((p) => {
        const nonSuperGrants = roles.filter((r) => !r.isSuperAdmin && r.explicitPermissionCodes.includes(p.permissionCode));
        return p.status === 'ACTIVE' && nonSuperGrants.length === 0 && p.requiresApprovalToGrant;
      })
      .slice(0, 12)
      .map((p) => ({
        permissionCode: p.permissionCode,
        label: p.label,
        moduleCode: p.moduleCode,
        featureCode: p.featureCode,
        recommendedRoleCodes: p.sensitivity === 'CRITICAL' ? ['ORG_ADMIN'] : ['ORG_ADMIN', 'ITEM_CHECKER'],
        alreadyGrantedRoleCodes: roles.filter((r) => r.explicitPermissionCodes.includes(p.permissionCode)).map((r) => r.roleCode),
        pendingApprovalRoleCodes: ['ORG_ADMIN'],
        rationale: 'No operational role has been explicitly granted this permission yet.',
      }));

    const ciGatePassed =
      missingPermissions.length === 0 &&
      duplicatePermissionCodes.length === 0 &&
      orphanedPermissions.length === 0 &&
      deprecatedFeaturesWithActiveGrants.length === 0 &&
      unprotectedApis.length === 0;

    const summaryMessage = ciGatePassed
      ? `Registry CI Gate PASSED: ${modules.length} modules, ${features.length} features, and ${permissions.length} permissions verified with zero orphans, duplicates, or missing mappings.`
      : `Registry CI Gate WARNING: ${missingPermissions.length} missing, ${duplicatePermissionCodes.length} duplicates, ${orphanedPermissions.length} orphaned, ${deprecatedFeaturesWithActiveGrants.length} deprecated grants.`;

    EnterpriseAuditService.logEvent({
      companyId: 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: `sync-${Date.now()}`,
      eventType: 'PERMISSION_REGISTRY_SYNC',
      eventDescription: summaryMessage,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: 'Automated permission registry audit & sync check',
    });

    return {
      id: `sync-rep-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      generatedBy: actor.name,
      totalModules: modules.length,
      totalSubmodules: submodules.length,
      totalFeatures: features.length,
      totalPermissions: permissions.length,
      missingPermissions,
      duplicatePermissionCodes,
      orphanedPermissions,
      deprecatedFeaturesWithActiveGrants,
      unprotectedApis,
      unmappedFrontendActions,
      roleImpactProposals,
      ciGatePassed,
      summaryMessage,
    };
  },

  // =========================================================================
  // USER-ROLE ASSIGNMENTS & ORGANIZATIONAL SCOPE
  // =========================================================================
  getAssignments(userId?: string): UserRoleAssignment[] {
    const list = readStore<UserRoleAssignment[]>(KEYS.ASSIGNMENTS, INITIAL_USER_ROLE_ASSIGNMENTS);
    return userId ? list.filter((a) => a.userId === userId) : list;
  },

  assignUserRole(
    input: {
      userId: string;
      roleId: string;
      companyId: string;
      branchId?: string;
      scope: OrganizationalScope;
      isDefaultContext?: boolean;
      effectiveFrom: string;
      effectiveTo?: string;
      reason: string;
      isTemporary?: boolean;
    },
    actor: { id: string; name: string }
  ): UserRoleAssignment {
    const user = this.getUserById(input.userId);
    if (!user) throw new Error('Target user not found.');
    if (user.employeeAssociationStatus === 'NOT_ASSOCIATED') {
      throw new Error('Cannot assign roles to a Not Associated employee. Complete authorized Reassociation first.');
    }
    if (user.status === 'ARCHIVED') {
      throw new Error(`Cannot assign roles to ${user.status} account.`);
    }

    const role = this.getRoleById(input.roleId);
    if (!role) throw new Error('Target role not found.');
    if (role.status !== 'ACTIVE') {
      throw new Error(`Cannot assign inactive/expired role '${role.roleCode}'.`);
    }

    if (actor.id === input.userId && role.isSuperAdmin) {
      throw new Error('Self-elevation blocked: users cannot assign Super Administrator role to themselves.');
    }

    const assignments = this.getAssignments();
    const duplicate = assignments.find(
      (a) =>
        a.userId === input.userId &&
        a.roleId === input.roleId &&
        a.companyId === input.companyId &&
        (a.branchId || '') === (input.branchId || '') &&
        a.status === 'ACTIVE'
    );
    if (duplicate) {
      throw new Error(`Duplicate active role assignment rejected for ${user.fullName} -> ${role.roleCode} in selected company/branch.`);
    }

    // Check preventive SoD rules before saving assignment
    const prospectivePerms = new Set([
      ...this.getEffectiveUserPermissions(input.userId).map((p) => p.permissionCode),
      ...this.getEffectiveRolePermissions(role.id).effectivePermissions,
    ]);
    const rules = this.getSodRules().filter((r) => r.status === 'ACTIVE' && r.enforcementMode === 'PREVENTIVE' && !r.sameTransactionBlock);
    for (const rule of rules) {
      const hasLeft = rule.leftPermissionOrRoleCodes.some((c) => prospectivePerms.has(c) || c === role.roleCode);
      const hasRight = rule.rightPermissionOrRoleCodes.some((c) => prospectivePerms.has(c) || c === role.roleCode);
      if (hasLeft && hasRight) {
        throw new Error(`Preventive SoD conflict (${rule.ruleCode}): assigning ${role.roleName} conflicts with ${rule.leftSideLabel} vs ${rule.rightSideLabel}.`);
      }
    }

    const nowIso = new Date().toISOString();
    const created: UserRoleAssignment = {
      id: `ura-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      userId: input.userId,
      roleId: role.id,
      roleCode: role.roleCode,
      roleName: role.roleName,
      companyId: input.companyId,
      branchId: input.branchId,
      scope: {
        ...input.scope,
        companyIds: input.scope.companyIds.length > 0 ? input.scope.companyIds : [input.companyId],
      },
      isDefaultContext: Boolean(input.isDefaultContext),
      assignmentDate: todayDateOnly(),
      effectiveFrom: input.effectiveFrom || todayDateOnly(),
      effectiveTo: input.effectiveTo,
      assignedBy: actor.name,
      approvedBy: actor.name,
      status: 'ACTIVE',
      reason: input.reason || 'Role scope assignment',
      isTemporary: input.isTemporary,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    let nextAssignments = [created, ...assignments];
    if (created.isDefaultContext) {
      nextAssignments = nextAssignments.map((a) =>
        a.userId === input.userId && a.id !== created.id ? { ...a, isDefaultContext: false } : a
      );
    }

    writeStore(KEYS.ASSIGNMENTS, nextAssignments);
    invalidatePermissionCache(`Assigned role ${role.roleCode} to ${user.username}`);

    this.recordPermissionChange({
      targetType: 'ASSIGNMENT',
      targetId: created.id,
      targetName: `${user.fullName} -> ${role.roleCode}`,
      action: 'GRANTED',
      permissionCodes: this.getEffectiveRolePermissions(role.id).effectivePermissions.slice(0, 10),
      newValue: `Company=${input.companyId}, Branch=${input.branchId || 'ALL'}, Scope=${input.scope.dataScopeLevel}`,
      companyId: input.companyId,
      branchId: input.branchId,
      actorUserId: actor.id,
      actorName: actor.name,
      reason: input.reason || 'User-role assignment',
    });

    EnterpriseAuditService.logEvent({
      companyId: input.companyId,
      branchId: input.branchId,
      entityType: 'SECURITY',
      entityId: created.id,
      eventType: 'USER_ROLE_ASSIGNED',
      eventDescription: `Assigned role ${role.roleCode} to ${user.fullName} for Company ${input.companyId}`,
      newValue: { roleCode: role.roleCode, scope: created.scope },
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: input.reason,
    });

    this.emitGovernanceNotification({
      title: 'Role Assignment Updated',
      message: `${user.fullName} assigned ${role.roleName} (${input.companyId}).`,
      severity: 'INFO',
      recipientUserId: input.userId,
    });

    return created;
  },

  updateAssignmentScope(
    assignmentId: string,
    scope: OrganizationalScope,
    reason: string,
    actor: { id: string; name: string }
  ): UserRoleAssignment {
    const assignments = this.getAssignments();
    const existing = assignments.find((a) => a.id === assignmentId);
    if (!existing) throw new Error('Role assignment not found.');

    const updated: UserRoleAssignment = {
      ...existing,
      scope,
      updatedAt: new Date().toISOString(),
    };
    writeStore(KEYS.ASSIGNMENTS, assignments.map((a) => (a.id === assignmentId ? updated : a)));
    invalidatePermissionCache(`Updated scope for assignment ${assignmentId}`);

    EnterpriseAuditService.logEvent({
      companyId: existing.companyId,
      branchId: existing.branchId,
      entityType: 'SECURITY',
      entityId: assignmentId,
      eventType: 'ORG_SCOPE_UPDATED',
      eventDescription: `Updated organizational scope for ${existing.roleCode} (${existing.userId})`,
      previousValue: existing.scope,
      newValue: scope,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: reason || 'Organizational scope update',
    });

    return updated;
  },

  revokeAssignment(assignmentId: string, reason: string, actor: { id: string; name: string }): UserRoleAssignment {
    const assignments = this.getAssignments();
    const target = assignments.find((a) => a.id === assignmentId);
    if (!target) throw new Error('Assignment not found.');

    if (target.roleCode === 'PLATFORM_ADMIN' && target.status === 'ACTIVE') {
      const otherActiveSuper = assignments.filter(
        (a) => a.id !== assignmentId && a.roleCode === 'PLATFORM_ADMIN' && a.status === 'ACTIVE'
      );
      if (otherActiveSuper.length === 0) {
        throw new Error('Protected safeguard: Cannot revoke the last active Platform Super Administrator assignment.');
      }
    }

    const updated: UserRoleAssignment = {
      ...target,
      status: 'REVOKED',
      effectiveTo: todayDateOnly(),
      updatedAt: new Date().toISOString(),
    };
    writeStore(KEYS.ASSIGNMENTS, assignments.map((a) => (a.id === assignmentId ? updated : a)));
    invalidatePermissionCache(`Revoked assignment ${assignmentId}`);

    this.recordPermissionChange({
      targetType: 'ASSIGNMENT',
      targetId: assignmentId,
      targetName: `${target.userId} -> ${target.roleCode}`,
      action: 'REVOKED',
      permissionCodes: [],
      companyId: target.companyId,
      branchId: target.branchId,
      actorUserId: actor.id,
      actorName: actor.name,
      reason: reason || 'Assignment revoked',
    });

    EnterpriseAuditService.logEvent({
      companyId: target.companyId,
      branchId: target.branchId,
      entityType: 'SECURITY',
      entityId: assignmentId,
      eventType: 'USER_ROLE_REVOKED',
      eventDescription: `Revoked role ${target.roleCode} from user ${target.userId}`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: reason || 'Role assignment revoked',
    });

    return updated;
  },

  getUserOrganizationalMatrix(userId: string): OrganizationalScope {
    const assignments = this.getAssignments(userId).filter(
      (a) => a.status === 'ACTIVE' && isWithinDateWindow(a.effectiveFrom, a.effectiveTo)
    );
    const merged = emptyScope('', 'READ_ONLY_RECORDS');
    let maxRank = 0;
    const addUnique = (arr: string[], items: string[]) => {
      for (const i of items) {
        if (i && !arr.includes(i)) arr.push(i);
      }
    };

    for (const a of assignments) {
      addUnique(merged.companyIds, a.scope.companyIds.length ? a.scope.companyIds : [a.companyId]);
      addUnique(merged.branchIds, a.scope.branchIds);
      addUnique(merged.businessUnitIds, a.scope.businessUnitIds);
      addUnique(merged.departmentIds, a.scope.departmentIds);
      addUnique(merged.purchaseOrgIds, a.scope.purchaseOrgIds);
      addUnique(merged.purchaseGroupIds, a.scope.purchaseGroupIds);
      addUnique(merged.salesOrgIds, a.scope.salesOrgIds);
      addUnique(merged.warehouseIds, a.scope.warehouseIds);
      addUnique(merged.locationCodes, a.scope.locationCodes);
      addUnique(merged.costCentreIds, a.scope.costCentreIds);
      addUnique(merged.projectIds, a.scope.projectIds);
      const r = DATA_SCOPE_RANK[a.scope.dataScopeLevel] || 1;
      if (r > maxRank) {
        maxRank = r;
        merged.dataScopeLevel = a.scope.dataScopeLevel;
      }
    }
    return merged;
  },

  // =========================================================================
  // 10-STEP DENY-BY-DEFAULT CENTRALIZED AUTHORIZATION ENGINE
  // =========================================================================
  invalidatePermissionCache,

  getAuthCacheStats(): {
    version: number;
    entries: number;
    cacheHits: number;
    cacheMisses: number;
    lastInvalidationReason: string;
    lastInvalidatedAt: string;
  } {
    return {
      version: authCacheVersion,
      entries: authEvalCache.size,
      cacheHits,
      cacheMisses,
      lastInvalidationReason,
      lastInvalidatedAt,
    };
  },

  getEffectiveUserPermissions(
    userId: string,
    companyId?: string,
    branchId?: string
  ): Array<{
    permissionCode: string;
    label: string;
    moduleCode: string;
    source: 'ROLE' | 'INHERITED_ROLE' | 'USER_OVERRIDE' | 'TEMPORARY_ACCESS' | 'DELEGATION';
    sourceLabel: string;
    dataScope: DataScopeLevel;
  }> {
    const user = this.getUserById(userId);
    if (!user || user.status !== 'ACTIVE') return [];

    const registry = this.getPermissions();
    const permByCode = new Map(registry.map((p) => [p.permissionCode, p]));
    const byLegacy = new Map<string, RegistryPermissionEntry>();
    registry.forEach((p) => {
      if (p.legacyAliasKey) byLegacy.set(p.legacyAliasKey, p);
    });

    const resolveCode = (code: string) => permByCode.get(code)?.permissionCode || byLegacy.get(code)?.permissionCode || code;
    const overrides = rbacPermissionService.getUserOverridesMap()[userId] || { granted: [], revoked: [] };
    const revokedSet = new Set(overrides.revoked.map(resolveCode));

    const effective = new Map<
      string,
      {
        permissionCode: string;
        label: string;
        moduleCode: string;
        source: 'ROLE' | 'INHERITED_ROLE' | 'USER_OVERRIDE' | 'TEMPORARY_ACCESS' | 'DELEGATION';
        sourceLabel: string;
        dataScope: DataScopeLevel;
      }
    >();

    const upsert = (
      code: string,
      source: 'ROLE' | 'INHERITED_ROLE' | 'USER_OVERRIDE' | 'TEMPORARY_ACCESS' | 'DELEGATION',
      sourceLabel: string,
      dataScope: DataScopeLevel
    ) => {
      const resolved = resolveCode(code);
      if (revokedSet.has(resolved)) return;
      const meta = permByCode.get(resolved);
      if (!meta || meta.status !== 'ACTIVE') return;
      const prev = effective.get(resolved);
      if (!prev || DATA_SCOPE_RANK[dataScope] > DATA_SCOPE_RANK[prev.dataScope]) {
        effective.set(resolved, {
          permissionCode: resolved,
          label: meta.label,
          moduleCode: meta.moduleCode,
          source,
          sourceLabel,
          dataScope,
        });
      }
    };

    // 1. Active Scoped UserRoleAssignments
    const today = todayDateOnly();
    const assignments = this.getAssignments(userId).filter(
      (a) =>
        a.status === 'ACTIVE' &&
        isWithinDateWindow(a.effectiveFrom, a.effectiveTo, today) &&
        (!companyId || a.companyId === companyId || a.scope.companyIds.includes(companyId)) &&
        (!branchId || a.scope.branchIds.length === 0 || a.scope.branchIds.includes(branchId))
    );

    for (const a of assignments) {
      const role = this.getRoleById(a.roleId) || this.getRoleByCode(a.roleCode);
      if (!role || role.status !== 'ACTIVE' || !isWithinDateWindow(role.effectiveFrom, role.effectiveTo, today)) continue;
      const eff = this.getEffectiveRolePermissions(role.id);
      for (const pCode of eff.explicitPermissions) {
        if (eff.effectivePermissions.includes(pCode)) {
          upsert(pCode, 'ROLE', `${role.roleCode}`, a.scope.dataScopeLevel);
        }
      }
      for (const pCode of eff.inheritedPermissions) {
        if (eff.effectivePermissions.includes(pCode)) {
          upsert(pCode, 'INHERITED_ROLE', `Inherited (${role.roleCode})`, a.scope.dataScopeLevel);
        }
      }
    }

    // 2. Fallback to primary user.role ONLY if user has no explicit assignment rows yet for baseline role
    if (assignments.length === 0 && !companyId) {
      const primaryRole = this.getRoleByCode(user.role);
      if (primaryRole && primaryRole.status === 'ACTIVE') {
        const eff = this.getEffectiveRolePermissions(primaryRole.id);
        for (const pCode of eff.effectivePermissions) {
          upsert(
            pCode,
            eff.explicitPermissions.includes(pCode) ? 'ROLE' : 'INHERITED_ROLE',
            primaryRole.roleCode,
            user.isGlobalScope ? 'ALL_AUTHORIZED_RECORDS' : 'BRANCH_RECORDS'
          );
        }
      }
    }

    // 3. Explicit User Overrides (Granted)
    for (const ov of overrides.granted) {
      upsert(ov, 'USER_OVERRIDE', 'Direct User Override', 'COMPANY_RECORDS');
    }

    // 4. Active Temporary Access (auto-checks validTo expiry!)
    const nowIso = new Date().toISOString();
    const activeTemp = this.getTemporaryAccess().filter(
      (t) =>
        t.userId === userId &&
        (t.status === 'ACTIVE' || t.status === 'EXPIRING_SOON') &&
        t.validFrom.slice(0, 10) <= today &&
        t.validTo.slice(0, 10) >= today &&
        !(t.validTo.includes('T') && t.validTo < nowIso) &&
        (!companyId || t.scope.companyIds.includes(companyId)) &&
        (!branchId || t.scope.branchIds.length === 0 || t.scope.branchIds.includes(branchId))
    );
    for (const t of activeTemp) {
      for (const c of t.permissionCodes) {
        upsert(c, 'TEMPORARY_ACCESS', `Temporary (${t.grantType})`, t.scope.dataScopeLevel);
      }
      if (t.roleCode) {
        const roleEff = this.getEffectiveRolePermissions(t.roleCode);
        roleEff.effectivePermissions.forEach((c) =>
          upsert(c, 'TEMPORARY_ACCESS', `Temporary Role (${t.roleCode})`, t.scope.dataScopeLevel)
        );
      }
    }

    // 5. Active Delegations where userId is delegate
    const activeDels = this.getDelegations().filter(
      (d) =>
        d.delegateUserId === userId &&
        d.status === 'ACTIVE' &&
        isWithinDateWindow(d.validFrom, d.validTo, today) &&
        (!companyId || d.companyId === companyId) &&
        (!branchId || !d.branchId || d.branchId === branchId)
    );
    for (const d of activeDels) {
      for (const c of d.delegatedPermissionCodes) {
        upsert(c, 'DELEGATION', `Delegated by ${d.delegatorName}`, 'BRANCH_RECORDS');
      }
    }

    return Array.from(effective.values());
  },

  evaluateAuthorization(req: AuthorizationCheckRequest): AuthorizationCheckResult {
    const evaluatedAt = new Date().toISOString();
    const cacheKey = `${authCacheVersion}|${JSON.stringify(req)}`;
    const cached = authEvalCache.get(cacheKey);
    if (cached && !req.sessionTokenId) {
      cacheHits += 1;
      return { ...cached, cacheHit: true };
    }
    cacheMisses += 1;

    const deny = (
      denialCode: NonNullable<AuthorizationCheckResult['denialCode']>,
      reason: string
    ): AuthorizationCheckResult => {
      const res: AuthorizationCheckResult = {
        allowed: false,
        denialCode,
        reason,
        cacheHit: false,
        evaluatedAt,
      };
      if (!req.sessionTokenId) authEvalCache.set(cacheKey, res);
      return res;
    };

    // Step 1: Authenticated user identity
    if (!req.userId) {
      return deny('UNAUTHENTICATED', 'Authentication required: no user context present.');
    }
    const user = this.getUserById(req.userId);
    if (!user) {
      return deny('UNAUTHENTICATED', 'Authentication failed: user identity not found.');
    }

    // Step 2: Employee association, active account & date validity
    if (user.employeeAssociationStatus === 'NOT_ASSOCIATED') {
      return deny('ACCOUNT_INACTIVE', 'Access denied: employee association status is Not Associated.');
    }
    if (user.status !== 'ACTIVE') {
      return deny('ACCOUNT_INACTIVE', `Account access denied: user status is ${user.status}.`);
    }
    if (!isWithinDateWindow(user.effectiveFrom, user.effectiveTo)) {
      return deny('ACCOUNT_INACTIVE', 'Account access denied: outside user effective validity dates.');
    }

    // Step 3: Session validation (when sessionTokenId is supplied)
    if (req.sessionTokenId) {
      if (!this.isSessionValid(req.sessionTokenId)) {
        return deny('SESSION_INVALID', 'Session revoked or expired. Re-authentication required.');
      }
    }

    // Step 4: Permission existence & active status in central registry (Deny unregistered)
    const registry = this.getPermissions();
    const permDef = registry.find(
      (p) => p.permissionCode === req.permissionCode || p.legacyAliasKey === req.permissionCode
    );
    if (!permDef || permDef.status !== 'ACTIVE') {
      return deny('PERMISSION_UNREGISTERED', `Permission '${req.permissionCode}' is not registered or deprecated (Deny-by-Default).`);
    }
    const resolvedPermCode = permDef.permissionCode;

    // Step 5: Direct user revoke override always wins
    const overrides = rbacPermissionService.getUserOverridesMap()[user.id];
    if (overrides?.revoked?.includes(req.permissionCode as EnterprisePermissionKey) || overrides?.revoked?.includes(resolvedPermCode as EnterprisePermissionKey)) {
      return deny('PERMISSION_DENIED', `Permission '${resolvedPermCode}' explicitly revoked by user-level override.`);
    }

    // Step 6: Evaluate permission + organizational scope across assignments, temp access, delegations, overrides
    const today = todayDateOnly();
    const assignments = this.getAssignments(user.id);
    const activeAssignments = assignments.filter(
      (a) => a.status === 'ACTIVE' && isWithinDateWindow(a.effectiveFrom, a.effectiveTo, today)
    );

    const userAllEffWithoutScope = this.getEffectiveUserPermissions(user.id);
    const hasPermissionAnywhere = userAllEffWithoutScope.some((p) => p.permissionCode === resolvedPermCode);

    if (!hasPermissionAnywhere) {
      const hadExpiredOrRevokedAssignment = assignments.some(
        (a) => a.status !== 'ACTIVE' || !isWithinDateWindow(a.effectiveFrom, a.effectiveTo, today)
      );
      if (hadExpiredOrRevokedAssignment) {
        return deny('ASSIGNMENT_INACTIVE_OR_EXPIRED', `Role assignment for '${resolvedPermCode}' is expired, inactive, or revoked.`);
      }
      return deny('PERMISSION_DENIED', `Deny-by-default: user '${user.fullName}' does not hold '${resolvedPermCode}'.`);
    }

    // Organizational Scope checks (Company, Branch, Dept, Purchase Org)
    const scopedEff = this.getEffectiveUserPermissions(user.id, req.companyId, req.branchId);
    const matchedGrant = scopedEff.find((p) => p.permissionCode === resolvedPermCode);
    if (!matchedGrant) {
      EnterpriseAuditService.logUnauthorizedAttempt({
        attemptedAction: resolvedPermCode,
        targetResource: `Company=${req.companyId || 'N/A'} Branch=${req.branchId || 'N/A'}`,
        userId: user.id,
        userName: user.fullName,
        companyId: req.companyId || user.defaultCompanyId || 'co-kosh-01',
        reason: 'Cross-company or cross-branch organizational scope violation blocked by centralized engine.',
      });
      return deny(
        'ORG_SCOPE_DENIED',
        `Organizational scope denied: user '${user.fullName}' lacks '${resolvedPermCode}' for Company=${req.companyId || '*'} Branch=${req.branchId || '*'}.`
      );
    }

    // Additional Department / Purchase Org scope checks if explicitly passed on non-override grants
    if (req.purchaseOrgId && activeAssignments.length > 0) {
      const matchingOrgAssignment = activeAssignments.some(
        (a) =>
          (!req.companyId || a.companyId === req.companyId || a.scope.companyIds.includes(req.companyId)) &&
          (a.scope.dataScopeLevel === 'ALL_AUTHORIZED_RECORDS' ||
            a.scope.purchaseOrgIds.length === 0 ||
            a.scope.purchaseOrgIds.includes(req.purchaseOrgId!))
      );
      if (!matchingOrgAssignment && matchedGrant.source !== 'USER_OVERRIDE' && matchedGrant.source !== 'DELEGATION') {
        return deny('ORG_SCOPE_DENIED', `Purchase Organization scope '${req.purchaseOrgId}' is not authorized.`);
      }
    }

    if (req.departmentId && activeAssignments.length > 0) {
      const matchingDeptAssignment = activeAssignments.some(
        (a) =>
          (!req.companyId || a.companyId === req.companyId || a.scope.companyIds.includes(req.companyId)) &&
          (a.scope.dataScopeLevel === 'ALL_AUTHORIZED_RECORDS' ||
            a.scope.dataScopeLevel === 'COMPANY_RECORDS' ||
            a.scope.dataScopeLevel === 'BRANCH_RECORDS' ||
            a.scope.departmentIds.length === 0 ||
            a.scope.departmentIds.includes(req.departmentId!))
      );
      if (!matchingDeptAssignment && matchedGrant.source !== 'USER_OVERRIDE') {
        return deny('ORG_SCOPE_DENIED', `Department scope '${req.departmentId}' is not authorized.`);
      }
    }

    // Step 7: Record-level data scope checks
    if (matchedGrant.dataScope === 'OWN_RECORDS' && req.recordOwnerUserId && req.recordOwnerUserId !== user.id) {
      return deny('RECORD_SCOPE_DENIED', 'Data scope restriction (OWN_RECORDS): record belongs to another user.');
    }
    if (
      matchedGrant.dataScope === 'ASSIGNED_RECORDS' &&
      req.recordAssignedUserId &&
      req.recordAssignedUserId !== user.id &&
      req.recordOwnerUserId !== user.id
    ) {
      return deny('RECORD_SCOPE_DENIED', 'Data scope restriction (ASSIGNED_RECORDS): record is not assigned to user.');
    }
    if (matchedGrant.dataScope === 'READ_ONLY_RECORDS' && req.actionType && req.actionType !== 'VIEW') {
      return deny('RECORD_SCOPE_DENIED', 'Data scope restriction (READ_ONLY_RECORDS): write/approval actions prohibited.');
    }

    // Step 8: Maker-Checker self-approval prohibition
    if (req.actionType === 'APPROVE' && req.transactionCreatorUserId && req.transactionCreatorUserId === user.id) {
      return deny('MAKER_CHECKER_VIOLATION', 'Maker-Checker violation: creator cannot approve their own transaction.');
    }

    // Step 9: Preventive SoD evaluation on same transaction
    if (req.transactionCreatorUserId && req.transactionCreatorUserId === user.id) {
      const activeSod = this.getSodRules().find(
        (r) =>
          r.status === 'ACTIVE' &&
          r.enforcementMode === 'PREVENTIVE' &&
          r.rightPermissionOrRoleCodes.includes(resolvedPermCode)
      );
      if (activeSod) {
        return deny('SOD_PREVENTIVE_BLOCK', `Segregation of Duties block (${activeSod.ruleCode}): ${activeSod.description}`);
      }
    }

    // Step 10: Allowed
    const allowedResult: AuthorizationCheckResult = {
      allowed: true,
      reason: `Authorized via ${matchedGrant.sourceLabel} (${matchedGrant.dataScope})`,
      matchedSource: matchedGrant.source,
      effectiveDataScope: matchedGrant.dataScope,
      cacheHit: false,
      evaluatedAt,
    };
    if (!req.sessionTokenId) authEvalCache.set(cacheKey, allowedResult);
    return allowedResult;
  },

  // =========================================================================
  // ACCESS REQUESTS & MULTI-STAGE APPROVAL WORKFLOW
  // =========================================================================
  getAccessRequests(): AccessRequestRecord[] {
    return readStore<AccessRequestRecord[]>(KEYS.ACCESS_REQUESTS, INITIAL_ACCESS_REQUESTS);
  },

  submitAccessRequest(
    input: {
      requesterUserId: string;
      targetUserId: string;
      requestType: AccessRequestType;
      requestedRoleId?: string;
      requestedPermissionCodes?: string[];
      requestedScope: OrganizationalScope;
      isTemporary: boolean;
      validFrom: string;
      validTo?: string;
      justification: string;
    }
  ): AccessRequestRecord {
    const requester = this.getUserById(input.requesterUserId);
    const target = this.getUserById(input.targetUserId);
    if (!requester || !target) throw new Error('Requester or target user not found.');
    if (!input.justification || input.justification.trim().length < 8) {
      throw new Error('Mandatory business justification (min 8 characters) is required.');
    }

    const role = input.requestedRoleId ? this.getRoleById(input.requestedRoleId) : undefined;
    const requests = this.getAccessRequests();

    // Check potential SoD warnings on request
    const sodWarnings: string[] = [];
    const targetPerms = new Set(this.getEffectiveUserPermissions(target.id).map((p) => p.permissionCode));
    (input.requestedPermissionCodes || []).forEach((c) => targetPerms.add(c));
    if (role) this.getEffectiveRolePermissions(role.id).effectivePermissions.forEach((c) => targetPerms.add(c));

    for (const rule of this.getSodRules().filter((r) => r.status === 'ACTIVE')) {
      const l = rule.leftPermissionOrRoleCodes.some((c) => targetPerms.has(c));
      const r = rule.rightPermissionOrRoleCodes.some((c) => targetPerms.has(c));
      if (l && r) {
        sodWarnings.push(`${rule.ruleCode}: ${rule.ruleName} (${rule.riskLevel})`);
      }
    }

    const reqNumber = `AR-${new Date().getFullYear()}-${String(requests.length + 1).padStart(4, '0')}`;
    const nowIso = new Date().toISOString();
    const record: AccessRequestRecord = {
      id: `areq-${Date.now()}`,
      requestNumber: reqNumber,
      workflowKey: 'WF-ACCESS-REQ-01',
      requesterUserId: requester.id,
      requesterName: requester.fullName,
      targetUserId: target.id,
      targetUserName: target.fullName,
      requestType: input.requestType,
      requestedRoleId: role?.id,
      requestedRoleCode: role?.roleCode,
      requestedRoleName: role?.roleName,
      requestedPermissionCodes: input.requestedPermissionCodes || [],
      requestedScope: input.requestedScope,
      isTemporary: input.isTemporary,
      validFrom: input.validFrom || todayDateOnly(),
      validTo: input.validTo,
      justification: input.justification.trim(),
      status: 'PENDING_MANAGER',
      currentStageOrder: 1,
      requiresSecurityAdminApproval: true,
      sodWarnings,
      resubmissionCount: 0,
      approvals: [
        { id: `astg-${Date.now()}-1`, stageOrder: 1, stageName: 'Manager Approval', approverRole: 'ITEM_CHECKER', decision: 'PENDING' },
        { id: `astg-${Date.now()}-2`, stageOrder: 2, stageName: 'Data Owner Approval', approverRole: 'GLOBAL_ITEM_ADMIN', decision: 'PENDING' },
        { id: `astg-${Date.now()}-3`, stageOrder: 3, stageName: 'Security / Admin Approval', approverRole: 'PLATFORM_ADMIN', decision: 'PENDING' },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    writeStore(KEYS.ACCESS_REQUESTS, [record, ...requests]);

    EnterpriseAuditService.logEvent({
      companyId: input.requestedScope.companyIds[0] || 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: record.id,
      eventType: 'ACCESS_REQUEST_SUBMITTED',
      eventDescription: `Submitted Access Request ${reqNumber} for ${target.fullName} (${input.requestType})`,
      changedByUserId: requester.id,
      changedByName: requester.fullName,
      changeReason: input.justification,
    });

    this.emitGovernanceNotification({
      title: `Access Request Pending (${reqNumber})`,
      message: `${requester.fullName} requested ${input.requestType} for ${target.fullName}. Manager approval required.`,
      severity: sodWarnings.length > 0 ? 'WARNING' : 'INFO',
    });

    return record;
  },

  actOnAccessRequest(
    requestId: string,
    action: 'APPROVE' | 'REJECT' | 'ESCALATE' | 'RESUBMIT',
    payload: { comments?: string; rejectionReason?: string; updatedJustification?: string },
    actor: { id: string; name: string }
  ): AccessRequestRecord {
    const requests = this.getAccessRequests();
    const req = requests.find((r) => r.id === requestId);
    if (!req) throw new Error('Access request not found.');

    // Self-approval prohibition (critical security control)
    if (action === 'APPROVE' && (actor.id === req.targetUserId || actor.id === req.requesterUserId)) {
      throw new Error('Maker-Checker violation: users cannot approve their own access request or self-elevate.');
    }

    const nowIso = new Date().toISOString();
    let updated: AccessRequestRecord = { ...req, updatedAt: nowIso };

    if (action === 'REJECT') {
      if (!payload.rejectionReason || payload.rejectionReason.trim().length < 5) {
        throw new Error('Mandatory rejection reason (min 5 characters) is required.');
      }
      updated.status = 'REJECTED';
      updated.rejectionReason = payload.rejectionReason.trim();
      updated.approvals = req.approvals.map((st) =>
        st.stageOrder === req.currentStageOrder
          ? { ...st, decision: 'REJECTED', actorUserId: actor.id, actorName: actor.name, timestamp: nowIso, comments: payload.rejectionReason }
          : st
      );
      this.emitGovernanceNotification({
        title: `Access Request Rejected (${req.requestNumber})`,
        message: `Rejected by ${actor.name}: ${updated.rejectionReason}`,
        severity: 'WARNING',
        recipientUserId: req.requesterUserId,
      });
    } else if (action === 'ESCALATE') {
      updated.status = 'ESCALATED';
      updated.approvals = req.approvals.map((st) =>
        st.stageOrder === req.currentStageOrder
          ? { ...st, decision: 'ESCALATED', actorUserId: actor.id, actorName: actor.name, timestamp: nowIso, comments: payload.comments || 'Escalated to Security Admin' }
          : st
      );
      updated.currentStageOrder = 3;
    } else if (action === 'RESUBMIT') {
      updated.status = 'PENDING_MANAGER';
      updated.currentStageOrder = 1;
      updated.resubmissionCount += 1;
      updated.rejectionReason = undefined;
      if (payload.updatedJustification) updated.justification = payload.updatedJustification;
      updated.approvals = req.approvals.map((st) => ({ ...st, decision: 'PENDING', timestamp: undefined, actorUserId: undefined, actorName: undefined }));
    } else if (action === 'APPROVE') {
      const stageIdx = req.approvals.findIndex((s) => s.stageOrder === req.currentStageOrder);
      updated.approvals = req.approvals.map((st) =>
        st.stageOrder === req.currentStageOrder
          ? { ...st, decision: 'APPROVED', actorUserId: actor.id, actorName: actor.name, timestamp: nowIso, comments: payload.comments || 'Approved' }
          : st
      );

      if (req.currentStageOrder < 3 && stageIdx !== -1) {
        const nextOrder = req.currentStageOrder + 1;
        updated.currentStageOrder = nextOrder;
        updated.status = nextOrder === 2 ? 'PENDING_DATA_OWNER' : 'PENDING_SECURITY_ADMIN';
      } else {
        // Final approval -> provision requested access cleanly
        updated.status = 'APPROVED';
        if (req.isTemporary && req.validTo) {
          this.grantTemporaryAccess(
            {
              userId: req.targetUserId,
              grantType: req.requestedRoleId ? 'TEMPORARY_ROLE' : 'TEMPORARY_PERMISSION',
              roleId: req.requestedRoleId,
              permissionCodes: req.requestedPermissionCodes,
              scope: req.requestedScope,
              validFrom: req.validFrom,
              validTo: req.validTo,
              reason: `Approved via Access Request ${req.requestNumber}: ${req.justification}`,
            },
            actor
          );
        } else if (req.requestedRoleId) {
          this.assignUserRole(
            {
              userId: req.targetUserId,
              roleId: req.requestedRoleId,
              companyId: req.requestedScope.companyIds[0] || 'co-kosh-01',
              branchId: req.requestedScope.branchIds[0],
              scope: req.requestedScope,
              effectiveFrom: req.validFrom,
              effectiveTo: req.validTo,
              reason: `Approved via Access Request ${req.requestNumber}`,
            },
            actor
          );
        } else if (req.requestedPermissionCodes.length > 0) {
          // Grant via temporary/permanent override
          this.grantTemporaryAccess(
            {
              userId: req.targetUserId,
              grantType: 'TEMPORARY_PERMISSION',
              permissionCodes: req.requestedPermissionCodes,
              scope: req.requestedScope,
              validFrom: req.validFrom,
              validTo: req.validTo || '2099-12-31',
              reason: `Approved via Access Request ${req.requestNumber}`,
            },
            actor
          );
        }

        this.emitGovernanceNotification({
          title: `Access Request Approved (${req.requestNumber})`,
          message: `Access provisioned for ${req.targetUserName}.`,
          severity: 'SUCCESS',
          recipientUserId: req.targetUserId,
        });
      }
    }

    writeStore(KEYS.ACCESS_REQUESTS, requests.map((r) => (r.id === requestId ? updated : r)));

    EnterpriseAuditService.logEvent({
      companyId: req.requestedScope.companyIds[0] || 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: req.id,
      eventType: `ACCESS_REQUEST_${action}`,
      eventDescription: `Access Request ${req.requestNumber} ${action} by ${actor.name} (Status: ${updated.status})`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: payload.rejectionReason || payload.comments || req.justification,
      authorizationReference: req.requestNumber,
    });

    return updated;
  },

  // =========================================================================
  // TEMPORARY ACCESS & DELEGATIONS
  // =========================================================================
  getTemporaryAccess(): TemporaryAccessRecord[] {
    return readStore<TemporaryAccessRecord[]>(KEYS.TEMP_ACCESS, INITIAL_TEMPORARY_ACCESS);
  },

  grantTemporaryAccess(
    input: {
      userId: string;
      grantType: TemporaryAccessRecord['grantType'];
      roleId?: string;
      permissionCodes: string[];
      scope: OrganizationalScope;
      validFrom: string;
      validTo: string;
      reason: string;
    },
    actor: { id: string; name: string }
  ): TemporaryAccessRecord {
    const user = this.getUserById(input.userId);
    if (!user) throw new Error('Target user not found.');
    if (!input.validTo) throw new Error('Expiration date/time (validTo) is mandatory for temporary access.');
    if (input.validTo.slice(0, 10) < (input.validFrom || todayDateOnly()).slice(0, 10)) {
      throw new Error('Expiration date cannot precede start date.');
    }

    const role = input.roleId ? this.getRoleById(input.roleId) : undefined;
    const record: TemporaryAccessRecord = {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      userId: user.id,
      userName: user.fullName,
      grantType: input.grantType,
      roleId: role?.id,
      roleCode: role?.roleCode,
      permissionCodes: input.permissionCodes,
      scope: input.scope,
      validFrom: input.validFrom || todayDateOnly(),
      validTo: input.validTo,
      status: 'ACTIVE',
      grantedBy: actor.name,
      approvedBy: actor.name,
      reason: input.reason || 'Temporary access grant',
      reminderSent: false,
      createdAt: new Date().toISOString(),
    };

    const list = this.getTemporaryAccess();
    writeStore(KEYS.TEMP_ACCESS, [record, ...list]);
    invalidatePermissionCache(`Granted temporary access ${record.id}`);

    this.recordPermissionChange({
      targetType: 'TEMP_ACCESS',
      targetId: record.id,
      targetName: user.fullName,
      action: 'GRANTED',
      permissionCodes: input.permissionCodes,
      newValue: `${input.grantType} until ${input.validTo}`,
      companyId: input.scope.companyIds[0] || 'co-kosh-01',
      actorUserId: actor.id,
      actorName: actor.name,
      reason: input.reason,
    });

    EnterpriseAuditService.logEvent({
      companyId: input.scope.companyIds[0] || 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: record.id,
      eventType: 'TEMPORARY_ACCESS_GRANTED',
      eventDescription: `Granted temporary access (${input.grantType}) to ${user.fullName} until ${input.validTo}`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: input.reason,
    });

    return record;
  },

  revokeTemporaryAccess(tempId: string, reason: string, actor: { id: string; name: string }): TemporaryAccessRecord {
    const list = this.getTemporaryAccess();
    const target = list.find((t) => t.id === tempId);
    if (!target) throw new Error('Temporary access grant not found.');

    const updated: TemporaryAccessRecord = {
      ...target,
      status: 'REVOKED',
      revokedBy: actor.name,
      revokedAt: new Date().toISOString(),
      revokeReason: reason || 'Revoked by administrator',
    };
    writeStore(KEYS.TEMP_ACCESS, list.map((t) => (t.id === tempId ? updated : t)));
    invalidatePermissionCache(`Revoked temporary access ${tempId}`);

    EnterpriseAuditService.logEvent({
      companyId: target.scope.companyIds[0] || 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: tempId,
      eventType: 'TEMPORARY_ACCESS_REVOKED',
      eventDescription: `Revoked temporary access for ${target.userName}`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: reason || 'Immediate revocation',
    });

    return updated;
  },

  /** Sweeps temporary access & delegations to auto-expire past validTo and send expiry reminders. */
  sweepExpiredAccess(referenceNowIso = new Date().toISOString()): { expiredTempCount: number; expiredDelegationCount: number; remindersSent: number } {
    const refDate = referenceNowIso.slice(0, 10);
    const soonThresholdDate = new Date(new Date(referenceNowIso).getTime() + 48 * 3600 * 1000).toISOString().slice(0, 10);

    let expiredTempCount = 0;
    let remindersSent = 0;
    const temps = this.getTemporaryAccess();
    const nextTemps = temps.map((t) => {
      if (t.status === 'REVOKED' || t.status === 'EXPIRED') return t;
      const isTimeExpired = t.validTo.includes('T') ? t.validTo < referenceNowIso : t.validTo.slice(0, 10) < refDate;
      if (isTimeExpired) {
        expiredTempCount += 1;
        this.emitGovernanceNotification({
          title: 'Temporary Access Expired',
          message: `Temporary access for ${t.userName} (${t.grantType}) automatically expired on ${t.validTo}.`,
          severity: 'INFO',
          recipientUserId: t.userId,
        });
        return { ...t, status: 'EXPIRED' as const };
      }
      if (t.validTo.slice(0, 10) <= soonThresholdDate && !t.reminderSent) {
        remindersSent += 1;
        this.emitGovernanceNotification({
          title: 'Temporary Access Expiring Soon',
          message: `Temporary access for ${t.userName} expires on ${t.validTo}.`,
          severity: 'WARNING',
          recipientUserId: t.userId,
        });
        return { ...t, status: 'EXPIRING_SOON' as const, reminderSent: true };
      }
      return t;
    });
    if (expiredTempCount > 0 || remindersSent > 0) {
      writeStore(KEYS.TEMP_ACCESS, nextTemps);
      if (expiredTempCount > 0) invalidatePermissionCache('Auto-expired temporary access sweep');
    }

    let expiredDelegationCount = 0;
    const dels = this.getDelegations();
    const nextDels = dels.map((d) => {
      if (d.status === 'ACTIVE' && d.validTo.slice(0, 10) < refDate) {
        expiredDelegationCount += 1;
        return { ...d, status: 'EXPIRED' as const };
      }
      return d;
    });
    if (expiredDelegationCount > 0) {
      writeStore(KEYS.DELEGATIONS, nextDels);
      invalidatePermissionCache('Auto-expired delegation sweep');
    }

    return { expiredTempCount, expiredDelegationCount, remindersSent };
  },

  getDelegations(): AccessDelegationRecord[] {
    return readStore<AccessDelegationRecord[]>(KEYS.DELEGATIONS, INITIAL_ACCESS_DELEGATIONS);
  },

  createDelegation(
    input: {
      delegationType: AccessDelegationRecord['delegationType'];
      delegatorUserId: string;
      delegateUserId: string;
      companyId: string;
      branchId?: string;
      purchaseOrgId?: string;
      delegatedPermissionCodes: string[];
      validFrom: string;
      validTo: string;
      reason: string;
    },
    actor: { id: string; name: string }
  ): AccessDelegationRecord {
    if (input.delegatorUserId === input.delegateUserId) {
      throw new Error('Self-delegation is prohibited.');
    }
    const delegator = this.getUserById(input.delegatorUserId);
    const delegate = this.getUserById(input.delegateUserId);
    if (!delegator || !delegate) throw new Error('Delegator or delegate user not found.');
    if (delegator.status !== 'ACTIVE' || delegate.status !== 'ACTIVE') {
      throw new Error('Both delegator and delegate must be ACTIVE users.');
    }
    if (input.validTo < input.validFrom) {
      throw new Error('Delegation end date cannot precede start date.');
    }

    // Scope ceiling invariant: delegator cannot delegate permissions they do not actively hold
    const delegatorPerms = new Set(
      this.getEffectiveUserPermissions(delegator.id, input.companyId, input.branchId).map((p) => p.permissionCode)
    );
    const unauthorizedPerms = input.delegatedPermissionCodes.filter((c) => !delegatorPerms.has(c));
    if (unauthorizedPerms.length > 0) {
      throw new Error(`Scope ceiling violation: delegator '${delegator.fullName}' cannot delegate permissions they do not hold (${unauthorizedPerms.join(', ')}).`);
    }

    const record: AccessDelegationRecord = {
      id: `del-sec-${Date.now()}`,
      delegationType: input.delegationType,
      delegatorUserId: delegator.id,
      delegatorName: delegator.fullName,
      delegateUserId: delegate.id,
      delegateName: delegate.fullName,
      companyId: input.companyId,
      branchId: input.branchId,
      purchaseOrgId: input.purchaseOrgId,
      delegatedRoleCodes: [],
      delegatedPermissionCodes: input.delegatedPermissionCodes,
      validFrom: input.validFrom,
      validTo: input.validTo,
      status: 'ACTIVE',
      reason: input.reason || 'Authorized delegation',
      createdBy: actor.name,
      approvedBy: actor.name,
      createdAt: new Date().toISOString(),
    };

    const list = this.getDelegations();
    writeStore(KEYS.DELEGATIONS, [record, ...list]);
    invalidatePermissionCache(`Created delegation ${record.id}`);

    // Sync with PurchaseOrganizationService if purchaseOrgId specified
    if (input.purchaseOrgId) {
      try {
        const effAssign = PurchaseOrganizationService.getEffectiveRoleAssignments(input.purchaseOrgId).find(
          (a) => a.userId === delegator.id && a.status === 'ACTIVE'
        );
        if (effAssign) {
          PurchaseOrganizationService.addTemporaryDelegation({
            assignmentId: effAssign.id,
            replacementUserId: delegate.id,
            replacementUserName: delegate.fullName,
            replacementEmail: delegate.email,
            delegationValidFrom: input.validFrom,
            delegationValidTo: input.validTo,
            reason: input.reason,
            authorizedBy: actor.name,
          });
        }
      } catch {
        // non-blocking if PO rule doesn't require duplicate
      }
    }

    this.recordPermissionChange({
      targetType: 'DELEGATION',
      targetId: record.id,
      targetName: `${delegator.fullName} -> ${delegate.fullName}`,
      action: 'GRANTED',
      permissionCodes: input.delegatedPermissionCodes,
      newValue: `${input.delegationType} (${input.validFrom} to ${input.validTo})`,
      companyId: input.companyId,
      branchId: input.branchId,
      actorUserId: actor.id,
      actorName: actor.name,
      reason: input.reason,
    });

    EnterpriseAuditService.logEvent({
      companyId: input.companyId,
      branchId: input.branchId,
      entityType: 'DELEGATION',
      entityId: record.id,
      eventType: 'ACCESS_DELEGATION_CREATED',
      eventDescription: `${delegator.fullName} delegated ${input.delegatedPermissionCodes.length} permission(s) to ${delegate.fullName}`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: input.reason,
    });

    return record;
  },

  revokeDelegation(delegationId: string, reason: string, actor: { id: string; name: string }): AccessDelegationRecord {
    const list = this.getDelegations();
    const target = list.find((d) => d.id === delegationId);
    if (!target) throw new Error('Delegation record not found.');
    const updated: AccessDelegationRecord = {
      ...target,
      status: 'REVOKED',
      revokedBy: actor.name,
      revokedAt: new Date().toISOString(),
    };
    writeStore(KEYS.DELEGATIONS, list.map((d) => (d.id === delegationId ? updated : d)));
    invalidatePermissionCache(`Revoked delegation ${delegationId}`);

    EnterpriseAuditService.logEvent({
      companyId: target.companyId,
      entityType: 'DELEGATION',
      entityId: delegationId,
      eventType: 'ACCESS_DELEGATION_REVOKED',
      eventDescription: `Revoked delegation ${target.delegatorName} -> ${target.delegateName}`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: reason || 'Delegation revoked',
    });

    return updated;
  },

  // =========================================================================
  // SEGREGATION OF DUTIES (SoD) ENGINE
  // =========================================================================
  getSodRules(): SodRule[] {
    return readStore<SodRule[]>(KEYS.SOD_RULES, INITIAL_SOD_RULES);
  },

  saveSodRule(
    ruleInput: Omit<SodRule, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    actor: { id: string; name: string }
  ): SodRule {
    const list = this.getSodRules();
    const nowIso = new Date().toISOString();
    const existing = ruleInput.id ? list.find((r) => r.id === ruleInput.id) : undefined;
    const saved: SodRule = existing
      ? { ...existing, ...ruleInput, updatedAt: nowIso }
      : {
          ...ruleInput,
          id: `sod-${Date.now()}`,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
    writeStore(
      KEYS.SOD_RULES,
      existing ? list.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...list]
    );
    EnterpriseAuditService.logEvent({
      companyId: 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: saved.id,
      eventType: existing ? 'SOD_RULE_UPDATED' : 'SOD_RULE_CREATED',
      eventDescription: `Saved SoD rule ${saved.ruleCode}: ${saved.ruleName} (${saved.enforcementMode})`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: 'SoD governance configuration',
    });
    return saved;
  },

  getRoleConflictMatrix(): Array<{
    roleCode: string;
    roleName: string;
    ruleCode: string;
    ruleName: string;
    riskLevel: SodRule['riskLevel'];
    leftMatched: string[];
    rightMatched: string[];
  }> {
    const roles = this.getRoles().filter((r) => r.status === 'ACTIVE' && !r.isSuperAdmin);
    const rules = this.getSodRules().filter((r) => r.status === 'ACTIVE');
    const conflicts: Array<{
      roleCode: string;
      roleName: string;
      ruleCode: string;
      ruleName: string;
      riskLevel: SodRule['riskLevel'];
      leftMatched: string[];
      rightMatched: string[];
    }> = [];

    for (const role of roles) {
      const eff = new Set(this.getEffectiveRolePermissions(role.id).effectivePermissions);
      for (const rule of rules) {
        const leftMatched = rule.leftPermissionOrRoleCodes.filter((c) => eff.has(c) || c === role.roleCode);
        const rightMatched = rule.rightPermissionOrRoleCodes.filter((c) => eff.has(c) || c === role.roleCode);
        if (leftMatched.length > 0 && rightMatched.length > 0) {
          conflicts.push({
            roleCode: role.roleCode,
            roleName: role.roleName,
            ruleCode: rule.ruleCode,
            ruleName: rule.ruleName,
            riskLevel: rule.riskLevel,
            leftMatched,
            rightMatched,
          });
        }
      }
    }
    return conflicts;
  },

  scanUserSodConflicts(targetUserId?: string): SodConflictFinding[] {
    const users = targetUserId
      ? this.getUsers().filter((u) => u.id === targetUserId && u.status === 'ACTIVE' && u.employeeAssociationStatus !== 'NOT_ASSOCIATED')
      : this.getUsers().filter((u) => u.status === 'ACTIVE' && u.employeeAssociationStatus !== 'NOT_ASSOCIATED');
    const rules = this.getSodRules().filter((r) => r.status === 'ACTIVE');
    const storedExceptions = readStore<SodConflictFinding[]>(KEYS.SOD_FINDINGS, []);
    const exceptionMap = new Map(storedExceptions.map((e) => [`${e.userId}|${e.ruleId}`, e]));

    const findings: SodConflictFinding[] = [];
    for (const u of users) {
      if (u.role === 'PLATFORM_ADMIN') continue; // Root system admin governed via Break-Glass & Audit
      const effCodes = new Set(this.getEffectiveUserPermissions(u.id).map((p) => p.permissionCode));
      for (const rule of rules) {
        const leftMatched = rule.leftPermissionOrRoleCodes.filter((c) => effCodes.has(c));
        const rightMatched = rule.rightPermissionOrRoleCodes.filter((c) => effCodes.has(c));
        if (leftMatched.length > 0 && rightMatched.length > 0) {
          const prev = exceptionMap.get(`${u.id}|${rule.id}`);
          findings.push({
            id: prev?.id || `sodf-${u.id}-${rule.id}`,
            userId: u.id,
            userName: u.fullName,
            ruleId: rule.id,
            ruleCode: rule.ruleCode,
            ruleName: rule.ruleName,
            riskLevel: rule.riskLevel,
            enforcementMode: rule.enforcementMode,
            leftMatched,
            rightMatched,
            companyId: u.defaultCompanyId || 'co-kosh-01',
            branchId: u.defaultBranchId,
            status:
              prev?.status === 'EXCEPTION_APPROVED'
                ? 'EXCEPTION_APPROVED'
                : rule.enforcementMode === 'PREVENTIVE'
                ? 'BLOCKED'
                : 'OPEN_WARNING',
            exceptionApprovedBy: prev?.exceptionApprovedBy,
            exceptionApprovedAt: prev?.exceptionApprovedAt,
            exceptionExpiresAt: prev?.exceptionExpiresAt,
            exceptionReason: prev?.exceptionReason,
            detectedAt: prev?.detectedAt || new Date().toISOString(),
          });
        }
      }
    }
    return findings;
  },

  approveSodException(
    finding: SodConflictFinding,
    expiresAt: string,
    reason: string,
    actor: { id: string; name: string }
  ): SodConflictFinding {
    if (actor.id === finding.userId) {
      throw new Error('Maker-Checker violation: users cannot approve an SoD exception for themselves.');
    }
    if (!reason || reason.trim().length < 5) {
      throw new Error('Mandatory exception justification is required.');
    }
    const stored = readStore<SodConflictFinding[]>(KEYS.SOD_FINDINGS, []);
    const approved: SodConflictFinding = {
      ...finding,
      status: 'EXCEPTION_APPROVED',
      exceptionApprovedBy: actor.name,
      exceptionApprovedAt: new Date().toISOString(),
      exceptionExpiresAt: expiresAt,
      exceptionReason: reason.trim(),
    };
    const next = stored.some((s) => s.userId === finding.userId && s.ruleId === finding.ruleId)
      ? stored.map((s) => (s.userId === finding.userId && s.ruleId === finding.ruleId ? approved : s))
      : [approved, ...stored];
    writeStore(KEYS.SOD_FINDINGS, next);

    EnterpriseAuditService.logEvent({
      companyId: finding.companyId,
      entityType: 'SECURITY',
      entityId: approved.id,
      eventType: 'SOD_EXCEPTION_APPROVED',
      eventDescription: `Approved SoD exception (${finding.ruleCode}) for ${finding.userName} until ${expiresAt}`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: reason,
    });
    return approved;
  },

  // =========================================================================
  // SECURITY POLICIES, AUTHENTICATION, SESSIONS, LOGIN HISTORY & BREAK-GLASS
  // =========================================================================
  getSecurityPolicy(companyId = 'GLOBAL'): SecurityPolicyConfig {
    const policies = readStore<SecurityPolicyConfig[]>(KEYS.SECURITY_POLICY, [INITIAL_SECURITY_POLICY]);
    return policies.find((p) => p.companyId === companyId) || policies[0] || INITIAL_SECURITY_POLICY;
  },

  updateSecurityPolicy(
    patch: Partial<SecurityPolicyConfig>,
    reason: string,
    actor: { id: string; name: string }
  ): SecurityPolicyConfig {
    const policies = readStore<SecurityPolicyConfig[]>(KEYS.SECURITY_POLICY, [INITIAL_SECURITY_POLICY]);
    const current = policies[0] || INITIAL_SECURITY_POLICY;
    const updated: SecurityPolicyConfig = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.name,
    };
    writeStore(KEYS.SECURITY_POLICY, [updated, ...policies.slice(1)]);

    EnterpriseAuditService.logEvent({
      companyId: 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: updated.id,
      eventType: 'SECURITY_POLICY_UPDATED',
      eventDescription: `Updated Enterprise Security Policy (Min length ${updated.minPasswordLength}, Lockout ${updated.failedLoginThreshold}, Timeout ${updated.sessionTimeoutMinutes}m)`,
      previousValue: current,
      newValue: updated,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: reason || 'Security policy update',
    });

    return updated;
  },

  getSessions(): UserSessionRecord[] {
    return readStore<UserSessionRecord[]>(KEYS.SESSIONS, INITIAL_USER_SESSIONS);
  },

  getLoginHistory(): LoginHistoryRecord[] {
    return readStore<LoginHistoryRecord[]>(KEYS.LOGIN_HISTORY, INITIAL_LOGIN_HISTORY);
  },

  isSessionValid(sessionTokenId: string): boolean {
    const session = this.getSessions().find((s) => s.sessionTokenId === sessionTokenId);
    if (!session || session.status !== 'ACTIVE') return false;
    if (new Date(session.expiresAt).getTime() <= Date.now()) return false;
    const user = this.getUserById(session.userId);
    if (!user || user.status !== 'ACTIVE') return false;
    return true;
  },

  createSessionForUser(
    user: User,
    opts?: { deviceInfo?: string; ipAddress?: string; mfaVerified?: boolean }
  ): UserSessionRecord {
    const policy = this.getSecurityPolicy(user.defaultCompanyId);
    let sessions = this.getSessions();

    // Enforce max concurrent sessions per user
    const activeUserSessions = sessions
      .filter((s) => s.userId === user.id && s.status === 'ACTIVE')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (activeUserSessions.length >= policy.maxConcurrentSessions) {
      const toRevokeIds = new Set(
        activeUserSessions.slice(0, activeUserSessions.length - policy.maxConcurrentSessions + 1).map((s) => s.id)
      );
      sessions = sessions.map((s) =>
        toRevokeIds.has(s.id)
          ? {
              ...s,
              status: 'REVOKED',
              revokedBy: 'System Concurrent Session Limit',
              revokedAt: new Date().toISOString(),
              revokeReason: `Exceeded max concurrent sessions (${policy.maxConcurrentSessions})`,
            }
          : s
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + policy.sessionTimeoutMinutes * 60 * 1000).toISOString();
    const newSession: UserSessionRecord = {
      id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      sessionTokenId: `tok-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: user.id,
      username: user.username || user.email,
      userName: user.fullName,
      companyId: user.defaultCompanyId || 'co-kosh-01',
      branchId: user.defaultBranchId,
      deviceInfo: opts?.deviceInfo || (typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 65) : 'Web Browser'),
      ipAddress: opts?.ipAddress || '10.24.18.50',
      authMethod: user.authMethod || 'PASSWORD_EMAIL_2FA',
      mfaVerified: opts?.mfaVerified ?? Boolean(user.twoFactorEnabled),
      createdAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
      expiresAt,
      status: 'ACTIVE',
    };

    writeStore(KEYS.SESSIONS, [newSession, ...sessions]);

    // Update user lastLoginAt
    const users = this.getUsers();
    writeStore(
      KEYS.USERS,
      users.map((u) =>
        u.id === user.id ? { ...u, lastLoginAt: now.toISOString(), failedLoginAttempts: 0 } : u
      )
    );

    const history = this.getLoginHistory();
    const logItem: LoginHistoryRecord = {
      id: `lhist-${Date.now()}`,
      userId: user.id,
      usernameOrEmail: user.email,
      userName: user.fullName,
      companyId: user.defaultCompanyId || 'co-kosh-01',
      branchId: user.defaultBranchId,
      eventType: 'LOGIN_SUCCESS',
      authMethod: newSession.authMethod,
      deviceInfo: newSession.deviceInfo,
      ipAddress: newSession.ipAddress,
      isSuspicious: false,
      reviewStatus: 'NONE',
      timestamp: now.toISOString(),
    };
    writeStore(KEYS.LOGIN_HISTORY, [logItem, ...history]);

    EnterpriseAuditService.logEvent({
      companyId: user.defaultCompanyId || 'co-kosh-01',
      branchId: user.defaultBranchId,
      entityType: 'SECURITY',
      entityId: newSession.id,
      eventType: 'USER_LOGIN_SUCCESS',
      eventDescription: `Authenticated session started for ${user.fullName} (@${user.username})`,
      changedByUserId: user.id,
      changedByName: user.fullName,
      changeReason: 'Portal authentication',
    });

    return newSession;
  },

  authenticateWithCredentials(params: {
    emailOrUsername: string;
    password: string;
    deviceInfo?: string;
    ipAddress?: string;
  }): {
    ok: boolean;
    user?: User;
    requires2FA?: boolean;
    errorMessage?: string;
  } {
    const query = params.emailOrUsername.toLowerCase().trim();
    const users = this.getUsers();
    const found = users.find(
      (u) => u.email.toLowerCase() === query || (u.username || '').toLowerCase() === query
    );

    const history = this.getLoginHistory();
    const recordFailure = (reason: string, user?: User, suspicious = false, eventType: LoginHistoryRecord['eventType'] = 'LOGIN_FAILED') => {
      const rec: LoginHistoryRecord = {
        id: `lhist-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
        userId: user?.id,
        usernameOrEmail: params.emailOrUsername,
        userName: user?.fullName,
        companyId: user?.defaultCompanyId,
        branchId: user?.defaultBranchId,
        eventType,
        authMethod: user?.authMethod || 'PASSWORD_ONLY',
        deviceInfo: params.deviceInfo || 'Web Browser',
        ipAddress: params.ipAddress || '10.24.18.50',
        isSuspicious: suspicious,
        suspiciousReason: suspicious ? reason : undefined,
        reviewStatus: suspicious ? 'PENDING_REVIEW' : 'NONE',
        failureReason: reason,
        timestamp: new Date().toISOString(),
      };
      writeStore(KEYS.LOGIN_HISTORY, [rec, ...history]);
      EnterpriseAuditService.logEvent({
        companyId: user?.defaultCompanyId || 'co-kosh-01',
        entityType: 'SECURITY',
        entityId: user?.id || params.emailOrUsername,
        eventType: 'LOGIN_FAILED',
        eventDescription: `Failed login for '${params.emailOrUsername}': ${reason}`,
        changedByUserId: user?.id || 'anonymous',
        changedByName: user?.fullName || params.emailOrUsername,
        changeReason: reason,
      });
    };

    if (!found) {
      recordFailure('Account not found', undefined, false);
      return { ok: false, errorMessage: 'Invalid username/email or password. Please verify your credentials.' };
    }

    if (found.employeeAssociationStatus === 'NOT_ASSOCIATED') {
      recordFailure('Employee marked Not Associated', found, true);
      return {
        ok: false,
        errorMessage: 'Access denied: employee association status is Not Associated. Contact Security Administrator.',
      };
    }

    if (
      found.status === 'DEACTIVATED' ||
      found.status === 'INACTIVE' ||
      found.status === 'PENDING_ACTIVATION' ||
      found.status === 'SUSPENDED' ||
      found.status === 'ARCHIVED'
    ) {
      recordFailure(`Account is ${found.status}`, found, true);
      return {
        ok: false,
        errorMessage: `Access denied: your account is currently ${found.status}. Contact Security Administrator.`,
      };
    }

    if (found.status === 'LOCKED') {
      if (found.lockedUntil && new Date(found.lockedUntil).getTime() <= Date.now()) {
        // Lockout duration expired -> auto unlock
        this.unlockUser(found.id, 'Automatic lockout duration elapsed', { id: 'system', name: 'System Security Policy' });
      } else {
        recordFailure('Account locked due to failed login threshold', found, true);
        return { ok: false, errorMessage: 'Account is temporarily LOCKED due to multiple failed authentication attempts.' };
      }
    }

    const policy = this.getSecurityPolicy(found.defaultCompanyId);
    const passwordMatches = found.passwordHash
      ? verifySaltedSecret(params.password, found.passwordHash)
      : params.password.length >= 6 && (params.password === 'Kosh@2026!' || params.password.length >= 8);

    if (!passwordMatches) {
      const nextAttempts = (found.failedLoginAttempts || 0) + 1;
      const shouldLock = nextAttempts >= policy.failedLoginThreshold;
      const updatedUsers = this.getUsers().map((u) =>
        u.id === found.id
          ? {
              ...u,
              failedLoginAttempts: nextAttempts,
              status: shouldLock ? ('LOCKED' as ManagedUserStatus) : u.status,
              lockedUntil: shouldLock
                ? new Date(Date.now() + policy.lockoutDurationMinutes * 60 * 1000).toISOString()
                : u.lockedUntil,
            }
          : u
      );
      writeStore(KEYS.USERS, updatedUsers);

      if (shouldLock) {
        recordFailure(`Locked after ${nextAttempts} failed attempts`, found, true, 'ACCOUNT_LOCKED');
        this.createSecurityAlert({
          severity: 'HIGH',
          category: 'LOCKED_ACCOUNT',
          title: `Account Locked: ${found.fullName}`,
          description: `Account locked automatically after ${nextAttempts} failed login attempts.`,
          userId: found.id,
          companyId: found.defaultCompanyId || 'co-kosh-01',
        });
        this.emitGovernanceNotification({
          title: 'Account Locked Alert',
          message: `${found.fullName} locked after ${nextAttempts} failed login attempts.`,
          severity: 'CRITICAL',
        });
        return { ok: false, errorMessage: `Account locked after ${nextAttempts} failed attempts. Contact administrator to unlock.` };
      }

      recordFailure(`Invalid password (attempt ${nextAttempts} of ${policy.failedLoginThreshold})`, found, nextAttempts >= 3);
      return {
        ok: false,
        errorMessage: `Invalid password. Attempt ${nextAttempts} of ${policy.failedLoginThreshold} before automatic lockout.`,
      };
    }

    const mfaRequired =
      policy.mfaRequirement === 'ALL_USERS' ||
      found.twoFactorEnabled ||
      (policy.mfaRequirement === 'ADMINS_AND_CHECKERS' &&
        (found.role === 'PLATFORM_ADMIN' || found.role === 'ORG_ADMIN' || found.role === 'ITEM_CHECKER'));

    return {
      ok: true,
      user: found,
      requires2FA: mfaRequired,
    };
  },

  forceLogoutSession(sessionId: string, reason: string, actor: { id: string; name: string }): UserSessionRecord {
    const sessions = this.getSessions();
    const target = sessions.find((s) => s.id === sessionId || s.sessionTokenId === sessionId);
    if (!target) throw new Error('Session not found.');

    const updated: UserSessionRecord = {
      ...target,
      status: 'REVOKED',
      revokedBy: actor.name,
      revokedAt: new Date().toISOString(),
      revokeReason: reason || 'Administrator forced logout',
    };
    writeStore(KEYS.SESSIONS, sessions.map((s) => (s.id === target.id ? updated : s)));
    invalidatePermissionCache(`Revoked session ${target.id}`);

    const history = this.getLoginHistory();
    writeStore(KEYS.LOGIN_HISTORY, [
      {
        id: `lhist-${Date.now()}`,
        userId: target.userId,
        usernameOrEmail: target.username,
        userName: target.userName,
        companyId: target.companyId,
        branchId: target.branchId,
        eventType: 'SESSION_REVOKED',
        deviceInfo: target.deviceInfo,
        ipAddress: target.ipAddress,
        isSuspicious: false,
        reviewStatus: 'NONE',
        failureReason: reason,
        timestamp: new Date().toISOString(),
      },
      ...history,
    ]);

    EnterpriseAuditService.logEvent({
      companyId: target.companyId,
      entityType: 'SECURITY',
      entityId: target.id,
      eventType: 'SESSION_REVOKED',
      eventDescription: `Force-revoked active session for ${target.userName} (${target.ipAddress})`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: reason || 'Forced session revocation',
    });

    return updated;
  },

  revokeAllUserSessions(userId: string, reason: string, actor: { id: string; name: string }): number {
    const sessions = this.getSessions();
    let count = 0;
    const nowIso = new Date().toISOString();
    const next = sessions.map((s) => {
      if (s.userId === userId && s.status === 'ACTIVE') {
        count += 1;
        return {
          ...s,
          status: 'REVOKED' as const,
          revokedBy: actor.name,
          revokedAt: nowIso,
          revokeReason: reason,
        };
      }
      return s;
    });
    if (count > 0) {
      writeStore(KEYS.SESSIONS, next);
      invalidatePermissionCache(`Revoked ${count} sessions for ${userId}`);
      EnterpriseAuditService.logEvent({
        companyId: 'co-kosh-01',
        entityType: 'SECURITY',
        entityId: userId,
        eventType: 'ALL_SESSIONS_REVOKED',
        eventDescription: `Revoked ${count} active session(s) for user ${userId}`,
        changedByUserId: actor.id,
        changedByName: actor.name,
        changeReason: reason,
      });
    }
    return count;
  },

  reviewSuspiciousLogin(
    historyId: string,
    decision: 'CLEARED' | 'CONFIRMED_INCIDENT',
    notes: string,
    actor: { id: string; name: string }
  ): LoginHistoryRecord {
    const history = this.getLoginHistory();
    const target = history.find((h) => h.id === historyId);
    if (!target) throw new Error('Login history entry not found.');

    const updated: LoginHistoryRecord = {
      ...target,
      reviewStatus: decision,
      reviewedBy: actor.name,
      reviewedAt: new Date().toISOString(),
    };
    writeStore(KEYS.LOGIN_HISTORY, history.map((h) => (h.id === historyId ? updated : h)));

    EnterpriseAuditService.logEvent({
      companyId: target.companyId || 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: historyId,
      eventType: 'SUSPICIOUS_LOGIN_REVIEWED',
      eventDescription: `Reviewed suspicious login (${target.usernameOrEmail} / ${target.ipAddress}) as ${decision}`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: notes || decision,
    });

    return updated;
  },

  /**
   * Break-Glass Emergency Access process with mandatory reason, bounded duration & high-severity audit.
   */
  grantEmergencyAccess(
    params: { targetUserId: string; durationHours: number; reason: string; companyId: string },
    actor: { id: string; name: string }
  ): TemporaryAccessRecord {
    const policy = this.getSecurityPolicy(params.companyId);
    if (!params.reason || params.reason.trim().length < 15) {
      throw new Error('Mandatory emergency incident reason (min 15 characters) is required for Break-Glass access.');
    }
    if (params.durationHours <= 0 || params.durationHours > policy.emergencyAccessMaxHours) {
      throw new Error(`Break-Glass emergency access duration must be between 1 and ${policy.emergencyAccessMaxHours} hours.`);
    }

    const auth = this.evaluateAuthorization({
      userId: actor.id,
      permissionCode: 'USER_ADMIN.ACCESS_GOVERNANCE.ADMIN_OVERRIDE',
      actionType: 'ADMIN',
    });
    if (!auth.allowed) {
      throw new Error(`Authorization denied for Break-Glass override: ${auth.reason}`);
    }

    const now = new Date();
    const validTo = new Date(now.getTime() + params.durationHours * 3600 * 1000).toISOString();
    const record = this.grantTemporaryAccess(
      {
        userId: params.targetUserId,
        grantType: 'EMERGENCY_ACCESS',
        permissionCodes: ['USER_ADMIN.ACCESS_GOVERNANCE.VIEW', 'ORGANIZATION.VIEW', 'AUDIT.LOGS.VIEW'],
        scope: emptyScope(params.companyId, 'COMPANY_RECORDS'),
        validFrom: now.toISOString(),
        validTo,
        reason: `BREAK-GLASS (${params.durationHours}h): ${params.reason.trim()}`,
      },
      actor
    );

    this.createSecurityAlert({
      severity: 'CRITICAL',
      category: 'EMERGENCY_ACCESS',
      title: `Break-Glass Emergency Access Activated (${params.durationHours}h)`,
      description: `Granted to ${record.userName} by ${actor.name}. Reason: ${params.reason}`,
      userId: params.targetUserId,
      companyId: params.companyId,
    });

    EnterpriseAuditService.logEvent({
      companyId: params.companyId,
      entityType: 'SECURITY',
      entityId: record.id,
      eventType: 'BREAK_GLASS_EMERGENCY_ACCESS',
      eventDescription: `BREAK-GLASS EMERGENCY ACCESS granted to ${record.userName} for ${params.durationHours} hour(s)`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: params.reason,
    });

    return record;
  },

  // =========================================================================
  // ACCESS REVIEWS & CERTIFICATION
  // =========================================================================
  getAccessReviews(): AccessReviewItem[] {
    return readStore<AccessReviewItem[]>(KEYS.ACCESS_REVIEWS, INITIAL_ACCESS_REVIEWS);
  },

  generatePeriodicAccessReviews(actor: { id: string; name: string }): AccessReviewItem[] {
    const existing = this.getAccessReviews();
    const assignments = this.getAssignments().filter((a) => a.status === 'ACTIVE');
    const generated: AccessReviewItem[] = [];

    for (const a of assignments) {
      const u = this.getUserById(a.userId);
      if (!u) continue;
      const alreadyPending = existing.some(
        (r) => r.decision === 'PENDING' && r.targetUserId === a.userId && r.targetRoleCode === a.roleCode && r.companyId === a.companyId
      );
      if (alreadyPending) continue;
      generated.push({
        id: `arev-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        reviewType: a.roleCode === 'PLATFORM_ADMIN' ? 'EXCESSIVE_PRIVILEGE' : 'USER_WISE',
        targetUserId: u.id,
        targetUserName: u.fullName,
        targetRoleCode: a.roleCode,
        companyId: a.companyId,
        branchId: a.branchId,
        purchaseOrgId: a.scope.purchaseOrgIds[0],
        summary: `Periodic certification of ${a.roleCode} assignment in Company ${a.companyId} (${a.scope.dataScopeLevel}).`,
        riskIndicator: a.roleCode === 'PLATFORM_ADMIN' || a.roleCode === 'FINANCE_MANAGER' ? 'HIGH' : 'LOW',
        decision: 'PENDING',
        createdAt: new Date().toISOString(),
      });
    }

    if (generated.length > 0) {
      writeStore(KEYS.ACCESS_REVIEWS, [...generated, ...existing]);
      EnterpriseAuditService.logEvent({
        companyId: 'co-kosh-01',
        entityType: 'SECURITY',
        entityId: `review-cycle-${Date.now()}`,
        eventType: 'ACCESS_REVIEW_GENERATED',
        eventDescription: `Generated ${generated.length} periodic access certification review item(s)`,
        changedByUserId: actor.id,
        changedByName: actor.name,
        changeReason: 'Periodic access certification cycle initiated',
      });
    }
    return this.getAccessReviews();
  },

  submitAccessReviewDecision(
    reviewId: string,
    decision: Exclude<AccessReviewItem['decision'], 'PENDING'>,
    justification: string,
    evidenceRef: string,
    actor: { id: string; name: string }
  ): AccessReviewItem {
    const reviews = this.getAccessReviews();
    const target = reviews.find((r) => r.id === reviewId);
    if (!target) throw new Error('Access review item not found.');
    if (!justification || justification.trim().length < 4) {
      throw new Error('Mandatory review justification is required.');
    }

    const updated: AccessReviewItem = {
      ...target,
      decision,
      reviewerUserId: actor.id,
      reviewerName: actor.name,
      reviewedAt: new Date().toISOString(),
      justification: justification.trim(),
      evidenceRef: evidenceRef || `CERT-${new Date().getFullYear()}-${reviewId.slice(-4).toUpperCase()}`,
    };
    writeStore(KEYS.ACCESS_REVIEWS, reviews.map((r) => (r.id === reviewId ? updated : r)));

    // If reviewer revokes access, immediately revoke matching assignment or temporary grant
    if (decision === 'REVOKED') {
      if (target.reviewType === 'TEMPORARY_ACCESS') {
        const temp = this.getTemporaryAccess().find((t) => t.userId === target.targetUserId && (t.status === 'ACTIVE' || t.status === 'EXPIRING_SOON'));
        if (temp) this.revokeTemporaryAccess(temp.id, `Revoked during Access Review: ${justification}`, actor);
      } else {
        const assignment = this.getAssignments(target.targetUserId).find(
          (a) => a.roleCode === target.targetRoleCode && a.companyId === target.companyId && a.status === 'ACTIVE'
        );
        if (assignment) {
          this.revokeAssignment(assignment.id, `Revoked during Access Review: ${justification}`, actor);
        }
      }
    }

    EnterpriseAuditService.logEvent({
      companyId: target.companyId,
      entityType: 'SECURITY',
      entityId: reviewId,
      eventType: 'ACCESS_REVIEW_CERTIFIED',
      eventDescription: `Access Review ${decision} for ${target.targetUserName} (${target.targetRoleCode})`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: justification,
      authorizationReference: updated.evidenceRef,
    });

    return updated;
  },

  // =========================================================================
  // DASHBOARD KPIs (15 METRICS) & 23 COMPLIANCE REPORTS
  // =========================================================================
  getDashboardKpis(filters?: DashboardFilterState) {
    const users = this.getUsers(filters);
    const roles = this.getRoles();
    const permissions = this.getPermissions();
    const requests = this.getAccessRequests();
    const temps = this.getTemporaryAccess();
    const sessions = this.getSessions();
    const loginHistory = this.getLoginHistory();
    const sodFindings = this.scanUserSodConflicts();
    const audits = EnterpriseAuditService.getAuditLogs({ entityType: 'SECURITY' });

    const activeUsers = users.filter((u) => (u.status || 'ACTIVE') === 'ACTIVE').length;
    const inactiveOrLocked = users.filter((u) => ['DEACTIVATED', 'INACTIVE', 'SUSPENDED', 'LOCKED'].includes(u.status || '')).length;
    const notAssociatedUsers = users.filter((u) => u.employeeAssociationStatus === 'NOT_ASSOCIATED').length;
    const deactivatedUsers = users.filter((u) => u.status === 'DEACTIVATED').length;
    const pendingPersonalConsentUsers = users.filter(
      (u) => u.mobileNumberType === 'PERSONAL' && (u.mobileConsentStatus || 'PENDING_EMPLOYEE_CONSENT') === 'PENDING_EMPLOYEE_CONSENT'
    ).length;
    const consentedPersonalUsers = users.filter(
      (u) => u.mobileNumberType === 'PERSONAL' && u.mobileConsentStatus === 'CONSENT_GRANTED'
    ).length;
    const expiringTemp = temps.filter((t) => t.status === 'EXPIRING_SOON').length;
    const pendingRequests = requests.filter((r) => r.status.startsWith('PENDING') || r.status === 'ESCALATED').length;
    const activeSessions = sessions.filter((s) => s.status === 'ACTIVE').length;
    const failedLoginsRecent = loginHistory.filter((l) => l.eventType === 'LOGIN_FAILED' || l.eventType === 'ACCOUNT_LOCKED').length;
    const mfaEnabledUsers = users.filter((u) => u.twoFactorEnabled).length;
    const privilegedUsers = users.filter((u) => ['PLATFORM_ADMIN', 'ORG_ADMIN', 'GLOBAL_ITEM_ADMIN', 'ITEM_CHECKER'].includes(u.role)).length;
    const dormantUsers = users.filter((u) => {
      if (!u.lastLoginAt) return true;
      return Date.now() - new Date(u.lastLoginAt).getTime() > 30 * 86400 * 1000;
    }).length;
    const syncReport = this.synchronizePermissionRegistry({ id: 'system', name: 'Dashboard KPI Sync' });

    return {
      totalUsers: users.length,
      activeUsers,
      inactiveLockedUsers: inactiveOrLocked,
      notAssociatedUsers,
      deactivatedUsers,
      pendingPersonalConsentUsers,
      consentedPersonalUsers,
      totalRoles: roles.length,
      totalPermissions: permissions.length,
      pendingAccessRequests: pendingRequests,
      expiringTempAccess: expiringTemp,
      activeSessions,
      failedLoginsRecent,
      sodConflicts: sodFindings.length,
      mfaAdoptionCount: mfaEnabledUsers,
      mfaAdoptionPct: users.length > 0 ? Math.round((mfaEnabledUsers / users.length) * 100) : 0,
      privilegedUsersCount: privilegedUsers,
      dormantAccountsCount: dormantUsers,
      unassignedOrOrphanedPermissions: syncReport.orphanedPermissions.length + syncReport.missingPermissions.length,
      recentPermissionChanges: audits.length,
    };
  },

  getAccessReport(
    reportKey: AccessReportKey,
    filters?: DashboardFilterState,
    viewerUser?: User | null
  ): {
    title: string;
    subtitle: string;
    headers: string[];
    rows: Array<Array<string | number>>;
  } {
    const users = this.getUsers(filters);
    const roles = this.getRoles();
    const assignments = this.getAssignments();
    const permissions = this.getPermissions();
    const tempAccess = this.getTemporaryAccess();
    const requests = this.getAccessRequests();
    const sessions = this.getSessions();
    const loginHistory = this.getLoginHistory();
    const reviews = this.getAccessReviews();
    const permHistory = this.getPermissionChangeHistory();
    const assocHistory = this.getAssociationHistory();
    const consentEvidence = mobileConsentService.getConsentEvidence();

    switch (reportKey) {
      case 'USER_MASTER':
        return {
          title: '1. User Master Report',
          subtitle: 'Complete identity directory with employee association, account status, mobile contact (personal masked by policy) & MFA posture',
          headers: ['Username', 'Full Name', 'Email', 'Employee ID', 'Employee Association', 'Account Status', 'Mobile Contact', 'Mobile Type', 'Consent Status', 'Primary Role'],
          rows: users.map((u) => [
            u.username || u.id,
            u.fullName,
            u.email,
            u.employeeId || 'N/A',
            u.employeeAssociationStatus === 'NOT_ASSOCIATED' ? 'Not Associated' : 'Associated',
            u.status || 'ACTIVE',
            mobileConsentService.formatMobileForViewer(u, viewerUser, false).display,
            u.mobileNumberType || 'NONE',
            u.mobileConsentStatus || 'N/A',
            u.role,
          ]),
        };
      case 'ACTIVE_INACTIVE_USERS':
        return {
          title: '2. Account Status & Association Report',
          subtitle: 'Independent separation of Employee Association (Associated / Not Associated) and Account Status (Pending Activation / Active / Locked / Deactivated)',
          headers: ['Username', 'Full Name', 'Employee Association', 'Association End Date', 'Account Status', 'Department', 'Last Login', 'Failed Attempts'],
          rows: users.map((u) => [
            u.username || u.id,
            u.fullName,
            u.employeeAssociationStatus === 'NOT_ASSOCIATED' ? 'Not Associated' : 'Associated',
            u.associationEndDate || '-',
            u.status || 'ACTIVE',
            u.department || '-',
            u.lastLoginAt || 'Never logged in',
            u.failedLoginAttempts || 0,
          ]),
        };
      case 'USERS_WITHOUT_ROLE': {
        const noRole = users.filter((u) => assignments.filter((a) => a.userId === u.id && a.status === 'ACTIVE').length === 0);
        return {
          title: '3. User Without Role Report',
          subtitle: 'Users lacking active scoped User-Role Assignment entries',
          headers: ['Username', 'Full Name', 'Email', 'Employee Association', 'Account Status', 'Fallback Role', 'Default Company'],
          rows: noRole.map((u) => [
            u.username || u.id,
            u.fullName,
            u.email,
            u.employeeAssociationStatus === 'NOT_ASSOCIATED' ? 'Not Associated' : 'Associated',
            u.status || 'ACTIVE',
            u.role,
            u.defaultCompanyId || 'co-kosh-01',
          ]),
        };
      }
      case 'USER_ROLE_ASSIGNMENTS':
        return {
          title: '4. User Role Assignment Report',
          subtitle: 'Scoped user-role mappings with Company, Branch, Data Scope & effective dates',
          headers: ['Assignment ID', 'User', 'Role Code', 'Company', 'Branch', 'Data Scope', 'Status', 'Valid From', 'Valid To'],
          rows: assignments.map((a) => {
            const u = users.find((x) => x.id === a.userId);
            return [a.id, u?.fullName || a.userId, a.roleCode, a.companyId, a.branchId || 'ALL', a.scope.dataScopeLevel, a.status, a.effectiveFrom, a.effectiveTo || 'Open-ended'];
          }),
        };
      case 'ROLE_PERMISSION_MATRIX':
        return {
          title: '5. Role Permission Matrix',
          subtitle: 'Effective permission coverage across enterprise and custom roles',
          headers: ['Role Code', 'Role Name', 'Category', 'Status', 'Parent Role', 'Effective Permission Count', 'Explicit Restricted Count'],
          rows: roles.map((r) => {
            const eff = this.getEffectiveRolePermissions(r.id);
            return [r.roleCode, r.roleName, r.category, r.status, r.parentRoleId || 'None', eff.effectivePermissions.length, eff.restrictedPermissions.length];
          }),
        };
      case 'EFFECTIVE_USER_PERMISSIONS':
        return {
          title: '6. Effective User Permission Report',
          subtitle: 'Resolved permissions per user including inheritance, overrides, temporary access & delegations',
          headers: ['User', 'Primary Role', 'Permission Code', 'Module', 'Grant Source', 'Data Scope'],
          rows: users.flatMap((u) =>
            this.getEffectiveUserPermissions(u.id).slice(0, 25).map((p) => [u.fullName, u.role, p.permissionCode, p.moduleCode, p.sourceLabel, p.dataScope])
          ),
        };
      case 'MODULE_ACCESS':
        return {
          title: '7. Module Access Report',
          subtitle: 'Role and permission mapping per enterprise module',
          headers: ['Module Code', 'Module Name', 'Registered Permissions', 'Roles with Access', 'Status', 'Route'],
          rows: this.getModules().map((m) => {
            const modPerms = permissions.filter((p) => p.moduleCode === m.moduleCode);
            const grantedRoles = roles.filter((r) => modPerms.some((mp) => r.explicitPermissionCodes.includes(mp.permissionCode))).map((r) => r.roleCode);
            return [m.moduleCode, m.moduleName, modPerms.length, grantedRoles.join(', ') || 'None', m.status, m.routeReference];
          }),
        };
      case 'COMPANY_BRANCH_ACCESS':
        return {
          title: '8. Company and Branch Access Report',
          subtitle: 'Multi-entity organizational isolation matrix per user',
          headers: ['User', 'Role Code', 'Authorized Companies', 'Authorized Branches', 'Data Scope', 'Assignment Status'],
          rows: assignments.map((a) => {
            const u = users.find((x) => x.id === a.userId);
            return [u?.fullName || a.userId, a.roleCode, a.scope.companyIds.join(', '), a.scope.branchIds.join(', ') || 'ALL IN COMPANY', a.scope.dataScopeLevel, a.status];
          }),
        };
      case 'PURCHASE_ORG_ACCESS':
        return {
          title: '9. Purchase Organization Access Report',
          subtitle: 'Authorized Purchase Organizations and Purchase Groups per user',
          headers: ['User', 'Role Code', 'Company', 'Purchase Orgs', 'Purchase Groups', 'Status'],
          rows: assignments.map((a) => {
            const u = users.find((x) => x.id === a.userId);
            return [u?.fullName || a.userId, a.roleCode, a.companyId, a.scope.purchaseOrgIds.join(', ') || 'Unrestricted / None', a.scope.purchaseGroupIds.join(', ') || '-', a.status];
          }),
        };
      case 'TEMPORARY_ACCESS':
        return {
          title: '10. Temporary Access Report',
          subtitle: 'Time-bounded elevated & emergency access grants',
          headers: ['Grant ID', 'User', 'Type', 'Permissions / Role', 'Valid From', 'Valid To', 'Status', 'Granted By'],
          rows: tempAccess.map((t) => [t.id, t.userName, t.grantType, t.roleCode || t.permissionCodes.join(', '), t.validFrom, t.validTo, t.status, t.grantedBy]),
        };
      case 'EXPIRED_ACCESS': {
        const expTemps = tempAccess.filter((t) => t.status === 'EXPIRED' || t.status === 'REVOKED');
        const expAssigns = assignments.filter((a) => a.status === 'EXPIRED' || a.status === 'REVOKED');
        return {
          title: '11. Expired Access Report',
          subtitle: 'Expired or revoked temporary access and role assignments',
          headers: ['Record ID', 'Category', 'User', 'Detail', 'Expired / Effective To', 'Status'],
          rows: [
            ...expTemps.map((t) => [t.id, t.grantType, t.userName, t.permissionCodes.join(', ') || t.roleCode || '-', t.validTo, t.status]),
            ...expAssigns.map((a) => [a.id, 'ROLE_ASSIGNMENT', users.find((u) => u.id === a.userId)?.fullName || a.userId, a.roleCode, a.effectiveTo || '-', a.status]),
          ],
        };
      }
      case 'ACCESS_REQUESTS':
        return {
          title: '12. Access Request Report',
          subtitle: 'Workflow access requests with stage status and SoD warnings',
          headers: ['Request #', 'Requester', 'Target User', 'Type', 'Status', 'Current Stage', 'SoD Warnings', 'Created At'],
          rows: requests.map((r) => [r.requestNumber, r.requesterName, r.targetUserName, r.requestType, r.status, `Stage ${r.currentStageOrder}/3`, r.sodWarnings.length, r.createdAt.slice(0, 10)]),
        };
      case 'ROLE_CONFLICTS': {
        const matrix = this.getRoleConflictMatrix();
        return {
          title: '13. Role Conflict Report',
          subtitle: 'Segregation of Duties conflicts embedded within single role definitions',
          headers: ['Role Code', 'Role Name', 'SoD Rule', 'Risk Level', 'Left Side Matched', 'Right Side Matched'],
          rows: matrix.map((m) => [m.roleCode, m.roleName, m.ruleCode, m.riskLevel, m.leftMatched.join(', '), m.rightMatched.join(', ')]),
        };
      }
      case 'SOD_FINDINGS': {
        const findings = this.scanUserSodConflicts();
        return {
          title: '14. Segregation of Duties Report',
          subtitle: 'Active user-level SoD conflicts, blocks, and approved exceptions',
          headers: ['User', 'Rule Code', 'Rule Name', 'Risk Level', 'Enforcement', 'Status', 'Exception Approved By'],
          rows: findings.map((f) => [f.userName, f.ruleCode, f.ruleName, f.riskLevel, f.enforcementMode, f.status, f.exceptionApprovedBy || '-']),
        };
      }
      case 'LOGIN_HISTORY':
        return {
          title: '15. Login History Report',
          subtitle: 'Successful, failed, MFA, and session revocation authentication events',
          headers: ['Timestamp', 'User / Email', 'Event Type', 'Auth Method', 'Device', 'IP Address', 'Suspicious', 'Review Status'],
          rows: loginHistory.map((l) => [l.timestamp, l.userName || l.usernameOrEmail, l.eventType, l.authMethod || '-', l.deviceInfo, l.ipAddress, l.isSuspicious ? 'YES' : 'No', l.reviewStatus || 'NONE']),
        };
      case 'FAILED_LOGINS':
        return {
          title: '16. Failed Login Report',
          subtitle: 'Failed login and automatic lockout events with IP & reason',
          headers: ['Timestamp', 'Username / Email', 'Event Type', 'IP Address', 'Failure Reason', 'Suspicious', 'Review Status'],
          rows: loginHistory.filter((l) => l.eventType === 'LOGIN_FAILED' || l.eventType === 'ACCOUNT_LOCKED').map((l) => [l.timestamp, l.usernameOrEmail, l.eventType, l.ipAddress, l.failureReason || '-', l.isSuspicious ? 'YES' : 'No', l.reviewStatus || 'NONE']),
        };
      case 'ACTIVE_SESSIONS':
        return {
          title: '17. Active Session Report',
          subtitle: 'Live authenticated portal sessions with device, IP, MFA & expiration',
          headers: ['Session ID', 'User', 'Company', 'Device', 'IP Address', 'MFA Verified', 'Expires At', 'Status'],
          rows: sessions.filter((s) => s.status === 'ACTIVE').map((s) => [s.id, s.userName, s.companyId, s.deviceInfo, s.ipAddress, s.mfaVerified ? 'Yes' : 'No', s.expiresAt, s.status]),
        };
      case 'PRIVILEGED_USERS': {
        const priv = users.filter((u) => ['PLATFORM_ADMIN', 'ORG_ADMIN', 'GLOBAL_ITEM_ADMIN', 'ITEM_CHECKER'].includes(u.role));
        return {
          title: '18. Privileged User Report',
          subtitle: 'Super Administrators, Company Admins & Approval Checkers',
          headers: ['Username', 'Full Name', 'Role', 'Employee Association', 'Account Status', '2FA Active', 'Last Login', 'Global Scope'],
          rows: priv.map((u) => [
            u.username || u.id,
            u.fullName,
            u.role,
            u.employeeAssociationStatus === 'NOT_ASSOCIATED' ? 'Not Associated' : 'Associated',
            u.status || 'ACTIVE',
            u.twoFactorEnabled ? 'Yes' : 'No',
            u.lastLoginAt || 'Seeded',
            u.isGlobalScope ? 'Yes' : 'No',
          ]),
        };
      }
      case 'DORMANT_ACCOUNTS': {
        const dormant = users.filter((u) => !u.lastLoginAt || Date.now() - new Date(u.lastLoginAt).getTime() > 30 * 86400 * 1000);
        return {
          title: '19. Dormant Account Report',
          subtitle: 'Accounts with no recorded login activity in the last 30 days',
          headers: ['Username', 'Full Name', 'Email', 'Role', 'Employee Association', 'Account Status', 'Last Login'],
          rows: dormant.map((u) => [
            u.username || u.id,
            u.fullName,
            u.email,
            u.role,
            u.employeeAssociationStatus === 'NOT_ASSOCIATED' ? 'Not Associated' : 'Associated',
            u.status || 'ACTIVE',
            u.lastLoginAt || 'No recent login',
          ]),
        };
      }
      case 'PERMISSION_CHANGE_HISTORY':
        return {
          title: '20. Permission Change History',
          subtitle: 'Immutable log of role, permission, override, delegation & registry mutations',
          headers: ['Timestamp', 'Target Type', 'Target Name', 'Action', 'Permissions', 'Actor', 'Reason', 'Approval Ref'],
          rows: permHistory.map((h) => [h.timestamp, h.targetType, h.targetName, h.action, h.permissionCodes.join(', ') || '-', h.actorName, h.reason, h.approvalReference || '-']),
        };
      case 'SECURITY_AUDIT': {
        const logs = EnterpriseAuditService.getAuditLogs({ entityType: 'SECURITY' });
        return {
          title: '21. Security Audit Report',
          subtitle: 'Tamper-evident SHA-256 hash-chained enterprise security events',
          headers: ['Audit ID', 'Timestamp', 'Event Type', 'Entity ID', 'Description', 'Actor', 'Reason', 'Hash Prefix'],
          rows: logs.map((l) => [l.id, l.timestamp, l.eventType, l.entityId, l.eventDescription, l.changedByName, l.changeReason, l.hash.slice(0, 14)]),
        };
      }
      case 'ACCESS_REVIEWS':
        return {
          title: '22. Access Review Report',
          subtitle: 'Periodic user, role, temporary access & SoD certification evidence',
          headers: ['Review ID', 'Review Type', 'Target User', 'Role', 'Company', 'Risk', 'Decision', 'Reviewer', 'Evidence Ref'],
          rows: reviews.map((r) => [r.id, r.reviewType, r.targetUserName, r.targetRoleCode, r.companyId, r.riskIndicator, r.decision, r.reviewerName || 'Pending', r.evidenceRef || '-']),
        };
      case 'MODULE_FEATURE_REGISTRATION':
        return {
          title: '23. Module and Feature Permission Registration Report',
          subtitle: 'Centralized Module -> Submodule -> Feature -> Permission catalog governance',
          headers: ['Permission Code', 'Module', 'Submodule', 'Feature', 'Action', 'Sensitivity', 'API Endpoint', 'Requires Approval', 'Status'],
          rows: permissions.map((p) => [p.permissionCode, p.moduleCode, p.submoduleCode || '-', p.featureCode, p.action, p.sensitivity, p.apiEndpoint || '-', p.requiresApprovalToGrant ? 'Yes' : 'No', p.status]),
        };
      case 'EMPLOYEE_ASSOCIATION_LIFECYCLE':
        return {
          title: '24. Employee Association & Reassociation Audit Report',
          subtitle: 'Immutable transition ledger between Associated and Not Associated states with offboarding and revalidation proof',
          headers: ['Timestamp', 'User', 'Employee ID', 'Previous Status', 'New Status', 'Effective Date', 'Changed By', 'Approved By', 'Approval Ref', 'Reason'],
          rows: assocHistory.map((h) => [
            h.timestamp,
            h.userName,
            h.employeeId || '-',
            h.previousStatus === 'NOT_ASSOCIATED' ? 'Not Associated' : 'Associated',
            h.newStatus === 'NOT_ASSOCIATED' ? 'Not Associated' : 'Associated',
            h.effectiveDate,
            h.changedByName,
            h.approvedByName || '-',
            h.approvalReference || '-',
            h.reason,
          ]),
        };
      case 'PERSONAL_MOBILE_CONSENT':
        return {
          title: '25. Mobile Contact & Personal Consent Compliance Report',
          subtitle: 'Mobile number types, OTP verification statuses, employee-confirmed consent versions & purpose coverage (personal numbers masked by policy)',
          headers: ['Employee', 'Company', 'Mobile Number', 'Number Type', 'Verified Status', 'Consent Status', 'Consent Version', 'Consent Method', 'Approved Purposes', 'Consent Timestamp'],
          rows: users.map((u) => {
            const latestEv = consentEvidence.find((e) => e.userId === u.id);
            return [
              u.fullName,
              u.defaultCompanyId || 'co-kosh-01',
              mobileConsentService.formatMobileForViewer(u, viewerUser, false).display,
              u.mobileNumberType || 'NONE',
              u.mobileVerificationStatus || 'NOT_VERIFIED',
              u.mobileConsentStatus || 'N/A',
              u.mobileConsentVersion || latestEv?.consentVersion || '-',
              u.mobileConsentMethod || latestEv?.consentMethod || '-',
              (u.mobileConsentPurposes || []).join(', ') || '-',
              u.mobileConsentTimestamp || latestEv?.timestamp || '-',
            ];
          }),
        };
    }
  },

  resetForTesting(): void {
    Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
    Object.values(KEYS).forEach((k) => {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem(k);
        } catch {
          // ignore
        }
      }
    });
    mobileConsentService.resetForTesting();
    rbacPermissionService.resetForTesting();
    invalidatePermissionCache('resetForTesting');
    cacheHits = 0;
    cacheMisses = 0;
  },
};

// Bridge centralized identity & permission evaluation into mobileConsentService
mobileConsentService.registerHostBridge({
  getUsers: () => userRoleAdminService.getUsers(),
  getUserById: (userId) => userRoleAdminService.getUserById(userId),
  updateUserDirect: (userId, patch, actor, reason) =>
    userRoleAdminService.updateUser(
      userId,
      patch,
      { id: 'system-consent-direct', name: actor.name },
      reason
    ),
  evaluatePermission: (userId, permissionCode) =>
    userRoleAdminService.evaluateAuthorization({ userId, permissionCode }).allowed,
  emitNotification: (params) => userRoleAdminService.emitGovernanceNotification(params),
});

// Unify rbacPermissionService with the centralized User & Role Administration Engine
rbacPermissionService.registerCentralBridge({
  evaluator: (user, permission) =>
    userRoleAdminService.evaluateAuthorization({
      userId: user.id,
      permissionCode: permission,
    }).allowed,
  onMutate: (event) => {
    if (event.type === 'USER_OVERRIDE') {
      invalidatePermissionCache(`RBAC override ${event.mode} ${event.permission} for ${event.userId}`);
      userRoleAdminService.recordPermissionChange({
        targetType: 'USER_OVERRIDE',
        targetId: event.userId || '',
        targetName: event.userId || '',
        action: event.mode === 'GRANT' ? 'GRANTED' : event.mode === 'REVOKE' ? 'REVOKED' : 'MODIFIED',
        permissionCodes: [event.permission],
        companyId: 'co-kosh-01',
        actorUserId: event.actor.id,
        actorName: event.actor.name,
        reason: 'User permission override',
      });
    } else if (event.role && (event.type === 'ROLE_GRANT' || event.type === 'ROLE_REVOKE')) {
      const roleDef = userRoleAdminService.getRoleByCode(event.role);
      if (roleDef) {
        const hasPerm = roleDef.explicitPermissionCodes.includes(event.permission);
        if (event.type === 'ROLE_GRANT' && !hasPerm) {
          const roles = userRoleAdminService.getRoles();
          const next = roles.map((r) =>
            r.id === roleDef.id
              ? { ...r, explicitPermissionCodes: [...r.explicitPermissionCodes, event.permission], updatedAt: new Date().toISOString() }
              : r
          );
          writeStore(KEYS.ROLES, next);
        } else if (event.type === 'ROLE_REVOKE' && hasPerm) {
          const roles = userRoleAdminService.getRoles();
          const next = roles.map((r) =>
            r.id === roleDef.id
              ? { ...r, explicitPermissionCodes: r.explicitPermissionCodes.filter((p) => p !== event.permission), updatedAt: new Date().toISOString() }
              : r
          );
          writeStore(KEYS.ROLES, next);
        }
      }
      invalidatePermissionCache(`Legacy RBAC sync ${event.type} ${event.permission} on ${event.role}`);
    }
  },
});
