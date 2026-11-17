/**
 * CIPPLATFORM — MOBILE NUMBER GOVERNANCE, OTP VERIFICATION & PERSONAL MOBILE CONSENT ENGINE
 * Manages Official vs Personal mobile numbers, E.164 validation, default masking,
 * independent OTP verification, employee-only Personal Mobile Consent evidence,
 * immutable number/consent history, and centralized SMS / WhatsApp dispatch gating.
 */

import type { User } from '../types';
import type {
  BlockedCommunicationAuditRecord,
  CommunicationDispatchDecision,
  CommunicationPurpose,
  CompanyMobilePolicyConfig,
  MobileConsentEvidenceRecord,
  MobileNumberHistoryRecord,
  MobileNumberType,
  MobileVerificationStatus,
  PersonalConsentStatus,
  SmsGatewayConfig,
} from '../types/userRoleAdmin';
import { INITIAL_USERS } from '../data/seedData';
import { EnterpriseAuditService } from './enterpriseAuditService';

const KEYS = {
  POLICY: 'cip_mob_company_policy_v1',
  SMS_GATEWAY: 'cip_mob_sms_gateway_v1',
  EVIDENCE: 'cip_mob_consent_evidence_v1',
  NUM_HISTORY: 'cip_mob_number_history_v1',
  BLOCKED_LOGS: 'cip_mob_blocked_dispatch_v1',
  OTPS: 'cip_mob_pending_otps_v1',
};

export interface CountryDialCodeOption {
  code: string;
  country: string;
  iso: string;
  minDigits: number;
  maxDigits: number;
}

export const COUNTRY_DIAL_CODES: CountryDialCodeOption[] = [
  { code: '+91', country: 'India', iso: 'IN', minDigits: 10, maxDigits: 10 },
  { code: '+1', country: 'United States / Canada', iso: 'US', minDigits: 10, maxDigits: 10 },
  { code: '+44', country: 'United Kingdom', iso: 'GB', minDigits: 9, maxDigits: 11 },
  { code: '+65', country: 'Singapore', iso: 'SG', minDigits: 8, maxDigits: 8 },
  { code: '+971', country: 'United Arab Emirates', iso: 'AE', minDigits: 8, maxDigits: 9 },
  { code: '+49', country: 'Germany', iso: 'DE', minDigits: 8, maxDigits: 12 },
  { code: '+81', country: 'Japan', iso: 'JP', minDigits: 9, maxDigits: 11 },
  { code: '+61', country: 'Australia', iso: 'AU', minDigits: 9, maxDigits: 9 },
  { code: '+33', country: 'France', iso: 'FR', minDigits: 9, maxDigits: 9 },
  { code: '+86', country: 'China', iso: 'CN', minDigits: 11, maxDigits: 11 },
];

export const COMMUNICATION_PURPOSE_CATALOG: Array<{
  code: CommunicationPurpose;
  label: string;
  description: string;
}> = [
  {
    code: 'ACCOUNT_ACTIVATION',
    label: 'Account Activation & Onboarding',
    description: 'Initial activation links and onboarding readiness alerts.',
  },
  {
    code: 'SECURITY_AUTH',
    label: 'Security Alerts & Authentication / 2FA',
    description: 'Security advisories, suspicious login notifications, and mobile OTP verification.',
  },
  {
    code: 'EMERGENCY_COMMS',
    label: 'Emergency Communications',
    description: 'Urgent plant safety, incident response, and continuity alerts.',
  },
  {
    code: 'HR_EMPLOYEE',
    label: 'HR & Employee Communications',
    description: 'HR policy updates, employment lifecycle notices, and employee advisories.',
  },
  {
    code: 'OPERATIONAL_BUSINESS',
    label: 'Operational / Business Notifications',
    description: 'Purchase requisition approvals, workflow escalations, and ERP operational notices.',
  },
  {
    code: 'SMS_NOTIFICATIONS',
    label: 'SMS Notifications',
    description: 'Transactional SMS dispatches via enterprise DLT-registered SMS gateway.',
  },
  {
    code: 'WHATSAPP_NOTIFICATIONS',
    label: 'WhatsApp Notifications',
    description: 'Approved WhatsApp Business template notifications and workflow alerts.',
  },
];

export const DEFAULT_COMPANY_MOBILE_POLICY: CompanyMobilePolicyConfig = {
  id: 'mob-policy-global',
  companyId: 'GLOBAL',
  isMobileMandatoryOnOnboarding: false,
  allowPersonalMobile: true,
  requireOtpVerificationForOfficial: false,
  requireOtpVerificationForPersonal: false,
  requireVerifiedNumberBeforeComm: false,
  allowedPersonalPurposes: [
    'ACCOUNT_ACTIVATION',
    'SECURITY_AUTH',
    'EMERGENCY_COMMS',
    'HR_EMPLOYEE',
    'OPERATIONAL_BUSINESS',
    'SMS_NOTIFICATIONS',
    'WHATSAPP_NOTIFICATIONS',
  ],
  activeConsentVersion: 'v2.0',
  consentNoticeText:
    'I explicitly authorize Kosh Innovations / CIPPlatform to contact my Personal Mobile Number solely for the specific communication purposes I select below. My personal mobile number will remain masked to unauthorized staff, will never be used for unapproved purposes, and I may withdraw consent or update my number at any time via Employee Self-Service.',
  maskPersonalNumbersByDefault: true,
  updatedAt: '2026-11-13T00:00:00Z',
  updatedBy: 'Platform Governance',
};

export const DEFAULT_SMS_GATEWAY_CONFIG: SmsGatewayConfig = {
  id: 'sms-gw-default',
  providerName: 'MSG91',
  senderId: 'KOSHIN',
  entityIdDlt: '1101592837465001',
  isEnabled: true,
  environment: 'PROD',
  rateLimitPerMin: 120,
  updatedAt: '2026-11-13T00:00:00Z',
  updatedBy: 'Platform Governance',
};

const INITIAL_CONSENT_EVIDENCE: MobileConsentEvidenceRecord[] = [
  {
    id: 'mce-seed-001',
    userId: 'usr-maker-02',
    userName: 'Ananya Deshmukh',
    employeeId: 'EMP-2002',
    companyId: 'co-kosh-01',
    countryCode: '+91',
    e164Number: '+919840255612',
    mobileNumberType: 'PERSONAL',
    action: 'CONSENT_GRANTED',
    consentStatus: 'CONSENT_GRANTED',
    consentVersion: 'v2.0',
    consentMethod: 'EMPLOYEE_CONFIRMATION',
    approvedPurposes: ['SECURITY_AUTH', 'OPERATIONAL_BUSINESS', 'WHATSAPP_NOTIFICATIONS'],
    reason: 'Employee confirmed personal mobile usage for security and operational WhatsApp alerts.',
    actorUserId: 'usr-maker-02',
    actorName: 'Ananya Deshmukh',
    evidenceReference: 'EVID-2026-0001',
    requestChannel: 'PORTAL_AND_EMAIL',
    timestamp: '2026-01-16T11:35:00Z',
  },
  {
    id: 'mce-seed-002',
    userId: 'usr-mgr-02',
    userName: 'Priya Ramachandran',
    employeeId: 'EMP-3002',
    companyId: 'co-kosh-01',
    countryCode: '+91',
    e164Number: '+919840622418',
    mobileNumberType: 'PERSONAL',
    action: 'CONSENT_GRANTED',
    consentStatus: 'CONSENT_GRANTED',
    consentVersion: 'v2.0',
    consentMethod: 'EMPLOYEE_CONFIRMATION',
    approvedPurposes: [
      'SECURITY_AUTH',
      'EMERGENCY_COMMS',
      'OPERATIONAL_BUSINESS',
      'SMS_NOTIFICATIONS',
      'WHATSAPP_NOTIFICATIONS',
    ],
    reason: 'Employee confirmed personal mobile for approvals, emergency and SMS/WhatsApp alerts.',
    actorUserId: 'usr-mgr-02',
    actorName: 'Priya Ramachandran',
    evidenceReference: 'EVID-2026-0002',
    requestChannel: 'PORTAL_AND_EMAIL',
    timestamp: '2026-01-21T09:20:00Z',
  },
  {
    id: 'mce-seed-003',
    userId: 'usr-auditor-05',
    userName: 'Meera Nambiar',
    employeeId: 'EMP-5001',
    companyId: 'co-kosh-01',
    countryCode: '+91',
    e164Number: '+919840955310',
    mobileNumberType: 'PERSONAL',
    action: 'CONSENT_DECLINED',
    consentStatus: 'CONSENT_DECLINED',
    consentVersion: 'v2.0',
    consentMethod: 'EMPLOYEE_CONFIRMATION',
    approvedPurposes: [],
    reason: 'Employee declined organizational messaging on personal mobile device.',
    actorUserId: 'usr-auditor-05',
    actorName: 'Meera Nambiar',
    evidenceReference: 'EVID-2026-0003',
    requestChannel: 'PORTAL_AND_EMAIL',
    timestamp: '2026-01-13T14:05:00Z',
  },
];

interface PendingOtpChallenge {
  userId: string;
  e164Number: string;
  otpCode: string;
  expiresAt: number;
  attempts: number;
}

interface HostBridge {
  getUsers: () => User[];
  getUserById: (userId: string) => User | undefined;
  updateUserDirect: (userId: string, patch: Partial<User>, actor: { id: string; name: string }, reason: string) => User;
  evaluatePermission: (userId: string, permissionCode: string) => boolean;
  emitNotification: (params: {
    title: string;
    message: string;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
    route?: string;
    recipientUserId?: string;
  }) => void;
}

let hostBridge: HostBridge | null = null;
const memoryStore: Record<string, unknown> = {};

function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

function readStore<T>(key: string, fallback: T): T {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
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
      // ignore
    }
  }
  return deepClone(cloned);
}

function writeStore<T>(key: string, val: T): void {
  const cloned = deepClone(val);
  memoryStore[key] = cloned;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(cloned));
    } catch {
      // ignore
    }
  }
}

function dispatchUiEvent(eventName: string, detail?: unknown): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

function normalizeDigits(raw: string): string {
  return (raw || '').replace(/[\s\-().]/g, '');
}

function buildE164(countryCode: string, mobilePhone: string): string {
  const cc = (countryCode || '').trim().startsWith('+')
    ? (countryCode || '').trim()
    : `+${normalizeDigits(countryCode || '')}`;
  const digits = normalizeDigits(mobilePhone);
  return `${cc}${digits}`;
}

export const mobileConsentService = {
  registerHostBridge(bridge: HostBridge): void {
    hostBridge = bridge;
  },

  _getAllUsers(): User[] {
    if (hostBridge) return hostBridge.getUsers();
    return readStore<User[]>('cip_ura_users_v1', INITIAL_USERS);
  },

  _getUserById(userId: string): User | undefined {
    if (hostBridge) return hostBridge.getUserById(userId);
    return this._getAllUsers().find((u) => u.id === userId);
  },

  _updateUserDirect(userId: string, patch: Partial<User>, actor: { id: string; name: string }, reason: string): User {
    if (hostBridge) return hostBridge.updateUserDirect(userId, patch, actor, reason);
    const users = this._getAllUsers();
    const existing = users.find((u) => u.id === userId);
    if (!existing) throw new Error('User not found.');
    const updated: User = { ...existing, ...patch, updatedAt: new Date().toISOString(), updatedBy: actor.name };
    writeStore('cip_ura_users_v1', users.map((u) => (u.id === userId ? updated : u)));
    return updated;
  },

  // =========================================================================
  // POLICY & GATEWAY CONFIGURATION
  // =========================================================================
  getCompanyMobilePolicy(companyId = 'GLOBAL'): CompanyMobilePolicyConfig {
    const list = readStore<CompanyMobilePolicyConfig[]>(KEYS.POLICY, [DEFAULT_COMPANY_MOBILE_POLICY]);
    return list.find((p) => p.companyId === companyId) || list.find((p) => p.companyId === 'GLOBAL') || DEFAULT_COMPANY_MOBILE_POLICY;
  },

  saveCompanyMobilePolicy(
    patch: Partial<CompanyMobilePolicyConfig>,
    actor: { id: string; name: string },
    companyId = 'GLOBAL'
  ): CompanyMobilePolicyConfig {
    const list = readStore<CompanyMobilePolicyConfig[]>(KEYS.POLICY, [DEFAULT_COMPANY_MOBILE_POLICY]);
    const current = this.getCompanyMobilePolicy(companyId);
    const updated: CompanyMobilePolicyConfig = {
      ...current,
      ...patch,
      companyId,
      id: current.companyId === companyId ? current.id : `mob-policy-${companyId}`,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.name,
    };
    const next = list.some((p) => p.companyId === companyId)
      ? list.map((p) => (p.companyId === companyId ? updated : p))
      : [updated, ...list];
    writeStore(KEYS.POLICY, next);
    EnterpriseAuditService.logEvent({
      companyId: companyId === 'GLOBAL' ? 'co-kosh-01' : companyId,
      entityType: 'SECURITY',
      entityId: updated.id,
      eventType: 'MOBILE_POLICY_UPDATED',
      eventDescription: `Updated Company Mobile & Consent Policy (${companyId}, v${updated.activeConsentVersion}, mandatory=${updated.isMobileMandatoryOnOnboarding})`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: 'Company Mobile & Consent Policy governance update',
    });
    dispatchUiEvent('cip:mobile-consent-updated', { companyId });
    return updated;
  },

  getSmsGatewayConfig(): SmsGatewayConfig {
    return readStore<SmsGatewayConfig>(KEYS.SMS_GATEWAY, DEFAULT_SMS_GATEWAY_CONFIG);
  },

  saveSmsGatewayConfig(patch: Partial<SmsGatewayConfig>, actor: { id: string; name: string }): SmsGatewayConfig {
    const current = this.getSmsGatewayConfig();
    const updated: SmsGatewayConfig = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.name,
    };
    writeStore(KEYS.SMS_GATEWAY, updated);
    EnterpriseAuditService.logEvent({
      companyId: 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: updated.id,
      eventType: 'SMS_GATEWAY_UPDATED',
      eventDescription: `Updated SMS Gateway (${updated.providerName}, sender=${updated.senderId}, enabled=${updated.isEnabled})`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: 'SMS Gateway configuration update',
    });
    return updated;
  },

  // =========================================================================
  // VALIDATION & MASKING
  // =========================================================================
  validateMobileInput(input: {
    countryCode?: string;
    mobilePhone?: string;
    mobileNumberType?: MobileNumberType;
    isMandatory?: boolean;
  }): {
    valid: boolean;
    hasNumber: boolean;
    countryCode: string;
    nationalNumber: string;
    e164Number: string;
    mobileNumberType: MobileNumberType;
    errors: string[];
  } {
    const errors: string[] = [];
    const rawNumber = (input.mobilePhone || '').trim();
    const rawCc = (input.countryCode || '').trim();
    const numType: MobileNumberType = input.mobileNumberType || 'OFFICIAL';

    if (!rawNumber) {
      if (input.isMandatory) {
        errors.push('Mobile Number is mandatory under active company onboarding policy.');
      }
      return {
        valid: errors.length === 0,
        hasNumber: false,
        countryCode: rawCc || '+91',
        nationalNumber: '',
        e164Number: '',
        mobileNumberType: numType,
        errors,
      };
    }

    if (!rawCc || !/^\+\d{1,4}$/.test(rawCc)) {
      errors.push('A valid Country Code (e.g. +91, +1, +44) is mandatory when providing a Mobile Number.');
    }

    if (/[a-zA-Z]/.test(rawNumber)) {
      errors.push('Mobile Number must contain digits only (no alphabetic characters).');
    }

    const digits = normalizeDigits(rawNumber);
    if (!/^\d{7,15}$/.test(digits)) {
      errors.push('Mobile Number must be 7 to 15 digits in length.');
    }

    const e164 = buildE164(rawCc || '+91', digits);
    const e164Digits = e164.replace(/\D/g, '');
    if (e164Digits.length < 8 || e164Digits.length > 15) {
      errors.push('Combined Country Code + Mobile Number must satisfy E.164 length (8–15 total digits).');
    }

    const knownCountry = COUNTRY_DIAL_CODES.find((c) => c.code === rawCc);
    if (knownCountry && (digits.length < knownCountry.minDigits || digits.length > knownCountry.maxDigits)) {
      errors.push(
        `${knownCountry.country} (${knownCountry.code}) numbers must be ${knownCountry.minDigits}${
          knownCountry.minDigits === knownCountry.maxDigits ? '' : `–${knownCountry.maxDigits}`
        } digits.`
      );
    }

    if (numType !== 'OFFICIAL' && numType !== 'PERSONAL') {
      errors.push('Mobile Number Type must be Official Mobile Number or Personal Mobile Number.');
    }

    return {
      valid: errors.length === 0,
      hasNumber: true,
      countryCode: rawCc || '+91',
      nationalNumber: digits,
      e164Number: e164,
      mobileNumberType: numType,
      errors,
    };
  },

  maskMobileNumber(countryCode?: string, mobilePhone?: string): string {
    const digits = normalizeDigits(mobilePhone || '');
    if (!digits) return '-';
    const cc = (countryCode || '+91').trim();
    const visibleTail = digits.slice(-4);
    const maskedPrefix = '*'.repeat(Math.max(digits.length - 4, 4));
    return `${cc} ${maskedPrefix}${visibleTail}`;
  },

  canViewUnmaskedPersonalMobile(viewer: User | null | undefined, targetUserId?: string): boolean {
    if (!viewer) return false;
    if (targetUserId && viewer.id === targetUserId) return true;
    if (hostBridge) {
      return hostBridge.evaluatePermission(viewer.id, 'USER_ADMIN.MOBILE_CONTACT.VIEW_UNMASKED');
    }
    return viewer.role === 'PLATFORM_ADMIN';
  },

  formatMobileForViewer(
    targetUser: Pick<User, 'id' | 'countryCode' | 'mobilePhone' | 'mobileNumberType' | 'defaultCompanyId'>,
    viewer?: User | null,
    revealRequested = false
  ): { display: string; isMasked: boolean; e164: string } {
    const digits = normalizeDigits(targetUser.mobilePhone || '');
    if (!digits) return { display: '-', isMasked: false, e164: '' };
    const cc = targetUser.countryCode || '+91';
    const e164 = buildE164(cc, digits);
    const policy = this.getCompanyMobilePolicy(targetUser.defaultCompanyId);

    if (targetUser.mobileNumberType !== 'PERSONAL' || !policy.maskPersonalNumbersByDefault) {
      return { display: `${cc} ${digits}`, isMasked: false, e164 };
    }

    const isSelf = Boolean(viewer && viewer.id === targetUser.id);
    if (isSelf || (revealRequested && this.canViewUnmaskedPersonalMobile(viewer, targetUser.id))) {
      return { display: `${cc} ${digits}`, isMasked: false, e164 };
    }

    return {
      display: this.maskMobileNumber(cc, digits),
      isMasked: true,
      e164: this.maskMobileNumber(cc, digits),
    };
  },

  // =========================================================================
  // EVIDENCE & HISTORY ACCESSORS
  // =========================================================================
  getConsentEvidence(userId?: string): MobileConsentEvidenceRecord[] {
    const list = readStore<MobileConsentEvidenceRecord[]>(KEYS.EVIDENCE, INITIAL_CONSENT_EVIDENCE);
    return userId ? list.filter((e) => e.userId === userId) : list;
  },

  appendConsentEvidence(entry: Omit<MobileConsentEvidenceRecord, 'id' | 'timestamp' | 'evidenceReference'>): MobileConsentEvidenceRecord {
    const list = this.getConsentEvidence();
    const record: MobileConsentEvidenceRecord = {
      ...entry,
      id: `mce-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      evidenceReference: `EVID-${new Date().getFullYear()}-${String(list.length + 1).padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
    };
    writeStore(KEYS.EVIDENCE, [record, ...list]);
    return record;
  },

  getNumberHistory(userId?: string): MobileNumberHistoryRecord[] {
    const list = readStore<MobileNumberHistoryRecord[]>(KEYS.NUM_HISTORY, []);
    return userId ? list.filter((h) => h.userId === userId) : list;
  },

  archiveNumberRecord(entry: Omit<MobileNumberHistoryRecord, 'id' | 'archivedAt'>): MobileNumberHistoryRecord {
    const list = this.getNumberHistory();
    const record: MobileNumberHistoryRecord = {
      ...entry,
      id: `mnh-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      archivedAt: new Date().toISOString(),
    };
    writeStore(KEYS.NUM_HISTORY, [record, ...list]);
    return record;
  },

  getBlockedDispatchLogs(): BlockedCommunicationAuditRecord[] {
    return readStore<BlockedCommunicationAuditRecord[]>(KEYS.BLOCKED_LOGS, []);
  },

  // =========================================================================
  // ONBOARDING / PROFILE PREPARATION (STRICT ANTI-ADMIN-GRANT GUARD)
  // =========================================================================
  prepareMobileOnboardingFields(
    input: {
      countryCode?: string;
      mobilePhone?: string;
      mobileNumberType?: MobileNumberType;
      mobileConsentStatus?: PersonalConsentStatus;
      mobileConsentPurposes?: CommunicationPurpose[];
      companyId?: string;
      userId?: string;
      userName?: string;
      employeeId?: string;
    },
    actor: { id: string; name: string },
    existingUser?: User
  ): {
    patch: Partial<User>;
    shouldDispatchPersonalConsentRequest: boolean;
    numberChanged: boolean;
    typeChanged: boolean;
  } {
    const policy = this.getCompanyMobilePolicy(input.companyId || existingUser?.defaultCompanyId);

    // Strictly forbid any admin or bulk import from pre-granting Personal Mobile Consent
    if (input.mobileConsentStatus === 'CONSENT_GRANTED') {
      this.appendConsentEvidence({
        userId: input.userId || existingUser?.id || 'pending-user',
        userName: input.userName || existingUser?.fullName || 'Onboarding User',
        employeeId: input.employeeId || existingUser?.employeeId,
        companyId: input.companyId || existingUser?.defaultCompanyId || 'co-kosh-01',
        countryCode: input.countryCode || '+91',
        e164Number: buildE164(input.countryCode || '+91', input.mobilePhone || ''),
        mobileNumberType: input.mobileNumberType || 'PERSONAL',
        action: 'ADMIN_OVERRIDE_BLOCKED',
        consentStatus: 'PENDING_EMPLOYEE_CONSENT',
        consentVersion: policy.activeConsentVersion,
        consentMethod: 'EMPLOYEE_CONFIRMATION',
        approvedPurposes: [],
        reason: 'Blocked attempt by administrator or bulk import to grant personal mobile consent on behalf of employee.',
        actorUserId: actor.id,
        actorName: actor.name,
      });
      EnterpriseAuditService.logEvent({
        companyId: input.companyId || 'co-kosh-01',
        entityType: 'SECURITY',
        entityId: input.userId || existingUser?.id || 'onboarding',
        eventType: 'PERSONAL_CONSENT_ADMIN_OVERRIDE_BLOCKED',
        eventDescription: `Blocked attempt by ${actor.name} to set Personal Mobile Consent to CONSENT_GRANTED on behalf of employee.`,
        changedByUserId: actor.id,
        changedByName: actor.name,
        changeReason: 'Employee-only personal mobile consent enforcement',
      });
      throw new Error(
        'Consent governance violation: Administrators and bulk imports cannot grant Personal Mobile Consent on behalf of an employee.'
      );
    }

    const validation = this.validateMobileInput({
      countryCode: input.countryCode,
      mobilePhone: input.mobilePhone,
      mobileNumberType: input.mobileNumberType,
      isMandatory: policy.isMobileMandatoryOnOnboarding && !existingUser,
    });

    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    if (validation.hasNumber && validation.mobileNumberType === 'PERSONAL' && !policy.allowPersonalMobile) {
      throw new Error('Company Mobile Policy does not permit Personal Mobile Numbers for this entity.');
    }

    // Check if existing user had a number/type that changed
    const prevDigits = normalizeDigits(existingUser?.mobilePhone || '');
    const prevCc = existingUser?.countryCode || '+91';
    const prevE164 = prevDigits ? buildE164(prevCc, prevDigits) : '';
    const numberChanged = Boolean(existingUser && prevE164 !== validation.e164Number);
    const typeChanged = Boolean(
      existingUser &&
        validation.hasNumber &&
        existingUser.mobileNumberType &&
        existingUser.mobileNumberType !== validation.mobileNumberType
    );

    if (existingUser && prevE164 && (numberChanged || typeChanged)) {
      this.archiveNumberRecord({
        userId: existingUser.id,
        countryCode: prevCc,
        mobileNumber: prevDigits,
        e164Number: prevE164,
        mobileNumberType: existingUser.mobileNumberType || 'OFFICIAL',
        verificationStatus: existingUser.mobileVerificationStatus || 'NOT_VERIFIED',
        consentStatus: existingUser.mobileConsentStatus || 'NOT_REQUIRED_OFFICIAL',
        consentVersion: existingUser.mobileConsentVersion,
        archivedReason: numberChanged ? 'NUMBER_CHANGED' : 'TYPE_CHANGED',
        archivedBy: actor.name,
      });
    }

    if (!validation.hasNumber) {
      return {
        patch: {
          countryCode: undefined,
          mobilePhone: undefined,
          mobileNumberType: undefined,
          mobileVerificationStatus: 'NOT_VERIFIED',
          mobileVerifiedAt: undefined,
          mobileConsentStatus: undefined,
          mobileConsentVersion: undefined,
          mobileConsentMethod: undefined,
          mobileConsentPurposes: [],
          mobileConsentTimestamp: undefined,
          mobileConsentRequestedAt: undefined,
        },
        shouldDispatchPersonalConsentRequest: false,
        numberChanged,
        typeChanged,
      };
    }

    if (validation.mobileNumberType === 'OFFICIAL') {
      return {
        patch: {
          countryCode: validation.countryCode,
          mobilePhone: validation.nationalNumber,
          mobileNumberType: 'OFFICIAL',
          mobileVerificationStatus: numberChanged
            ? 'NOT_VERIFIED'
            : existingUser?.mobileVerificationStatus || 'NOT_VERIFIED',
          mobileVerifiedAt: numberChanged ? undefined : existingUser?.mobileVerifiedAt,
          mobileConsentStatus: 'NOT_REQUIRED_OFFICIAL',
          mobileConsentVersion: undefined,
          mobileConsentMethod: undefined,
          mobileConsentPurposes: [],
          mobileConsentTimestamp: undefined,
          mobileConsentRequestedAt: undefined,
        },
        shouldDispatchPersonalConsentRequest: false,
        numberChanged,
        typeChanged,
      };
    }

    // PERSONAL mobile number
    const mustResetConsent =
      !existingUser ||
      numberChanged ||
      typeChanged ||
      !existingUser.mobileConsentStatus ||
      existingUser.mobileConsentStatus === 'NOT_REQUIRED_OFFICIAL';

    if (existingUser && (numberChanged || typeChanged) && existingUser.mobileConsentStatus === 'CONSENT_GRANTED') {
      this.appendConsentEvidence({
        userId: existingUser.id,
        userName: existingUser.fullName,
        employeeId: existingUser.employeeId,
        companyId: existingUser.defaultCompanyId || 'co-kosh-01',
        countryCode: validation.countryCode,
        e164Number: validation.e164Number,
        mobileNumberType: 'PERSONAL',
        action: 'NUMBER_CHANGED_RESET',
        consentStatus: 'PENDING_EMPLOYEE_CONSENT',
        consentVersion: policy.activeConsentVersion,
        consentMethod: 'EMPLOYEE_CONFIRMATION',
        approvedPurposes: [],
        reason: numberChanged
          ? 'Personal mobile number changed; prior consent invalidated and fresh employee consent required.'
          : 'Mobile number classification switched to Personal; employee consent required.',
        actorUserId: actor.id,
        actorName: actor.name,
      });
    }

    return {
      patch: {
        countryCode: validation.countryCode,
        mobilePhone: validation.nationalNumber,
        mobileNumberType: 'PERSONAL',
        mobileVerificationStatus: numberChanged
          ? 'NOT_VERIFIED'
          : existingUser?.mobileVerificationStatus || 'NOT_VERIFIED',
        mobileVerifiedAt: numberChanged ? undefined : existingUser?.mobileVerifiedAt,
        mobileConsentStatus: mustResetConsent ? 'PENDING_EMPLOYEE_CONSENT' : existingUser!.mobileConsentStatus,
        mobileConsentVersion: policy.activeConsentVersion,
        mobileConsentMethod: 'EMPLOYEE_CONFIRMATION',
        mobileConsentPurposes: mustResetConsent ? [] : existingUser?.mobileConsentPurposes || [],
        mobileConsentTimestamp: mustResetConsent ? undefined : existingUser?.mobileConsentTimestamp,
      },
      shouldDispatchPersonalConsentRequest: mustResetConsent,
      numberChanged,
      typeChanged,
    };
  },

  // =========================================================================
  // CONSENT REQUEST DISPATCH (VERIFIED CHANNELS ONLY)
  // =========================================================================
  requestPersonalMobileConsent(
    user: User,
    actor: { id: string; name: string }
  ): {
    dispatched: boolean;
    channel: 'PORTAL_AND_EMAIL' | 'PORTAL_ONLY' | 'OFFLINE_LIMITED';
    channelLimitationWarning?: string;
    evidence: MobileConsentEvidenceRecord;
  } {
    if (user.mobileNumberType !== 'PERSONAL' || !user.mobilePhone) {
      throw new Error('Personal Mobile Consent request can only be sent when a Personal Mobile Number is registered.');
    }

    const policy = this.getCompanyMobilePolicy(user.defaultCompanyId);
    const e164 = buildE164(user.countryCode || '+91', user.mobilePhone);
    const hasCorporateEmail = Boolean(user.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email));
    const hasPortalAccount = user.status !== 'DEACTIVATED' && user.employeeAssociationStatus !== 'NOT_ASSOCIATED';

    let channel: 'PORTAL_AND_EMAIL' | 'PORTAL_ONLY' | 'OFFLINE_LIMITED' = 'PORTAL_AND_EMAIL';
    let channelLimitationWarning: string | undefined;

    if (hasCorporateEmail && hasPortalAccount) {
      channel = 'PORTAL_AND_EMAIL';
    } else if (hasPortalAccount) {
      channel = 'PORTAL_ONLY';
      channelLimitationWarning =
        'No verified corporate email address is available; consent request delivered via In-Portal Self-Service only.';
    } else {
      channel = 'OFFLINE_LIMITED';
      channelLimitationWarning =
        'User lacks active portal login or corporate email. Personal SMS/WhatsApp remains blocked until the employee confirms consent via an activated portal session.';
    }

    const nowIso = new Date().toISOString();
    const evidence = this.appendConsentEvidence({
      userId: user.id,
      userName: user.fullName,
      employeeId: user.employeeId,
      companyId: user.defaultCompanyId || 'co-kosh-01',
      countryCode: user.countryCode || '+91',
      e164Number: e164,
      mobileNumberType: 'PERSONAL',
      action: 'CONSENT_REQUESTED',
      consentStatus: 'PENDING_EMPLOYEE_CONSENT',
      consentVersion: policy.activeConsentVersion,
      consentMethod: 'EMPLOYEE_CONFIRMATION',
      approvedPurposes: [],
      reason: channelLimitationWarning || 'Personal mobile consent request dispatched via verified portal & corporate email.',
      actorUserId: actor.id,
      actorName: actor.name,
      requestChannel: channel,
    });

    this._updateUserDirect(
      user.id,
      {
        mobileConsentStatus: 'PENDING_EMPLOYEE_CONSENT',
        mobileConsentVersion: policy.activeConsentVersion,
        mobileConsentMethod: 'EMPLOYEE_CONFIRMATION',
        mobileConsentRequestedAt: nowIso,
        mobileConsentRequestChannel: channel,
      },
      actor,
      'Personal mobile consent request dispatched'
    );

    if (hostBridge && hasPortalAccount) {
      hostBridge.emitNotification({
        title: 'Action Required: Confirm Personal Mobile Consent',
        message: `Your personal mobile number (${this.maskMobileNumber(
          user.countryCode,
          user.mobilePhone
        )}) was registered. Review allowed purposes and confirm or decline consent in My Contact & Personal Consent.`,
        severity: 'WARNING',
        route: '/settings/my-contact-consent',
        recipientUserId: user.id,
      });
    }

    EnterpriseAuditService.logEvent({
      companyId: user.defaultCompanyId || 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: user.id,
      eventType: 'PERSONAL_CONSENT_REQUESTED',
      eventDescription: `Dispatched Personal Mobile Consent request (${policy.activeConsentVersion}) to ${user.fullName} via ${channel}`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: 'Personal mobile onboarding / update consent workflow',
    });

    dispatchUiEvent('cip:mobile-consent-updated', { userId: user.id });

    return {
      dispatched: channel !== 'OFFLINE_LIMITED',
      channel,
      channelLimitationWarning,
      evidence,
    };
  },

  // =========================================================================
  // OTP VERIFICATION (STRICTLY INDEPENDENT FROM CONSENT STATUS)
  // =========================================================================
  initiateMobileOtp(
    userId: string,
    actor: { id: string; name: string }
  ): {
    sent: boolean;
    e164Number: string;
    maskedNumber: string;
    verificationStatus: MobileVerificationStatus;
    previewOtpCode: string;
    expiresAt: string;
  } {
    const user = this._getUserById(userId);
    if (!user) throw new Error('User not found.');
    if (!user.mobilePhone) throw new Error('No mobile number registered for OTP verification.');

    const e164 = buildE164(user.countryCode || '+91', user.mobilePhone);
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAtMs = Date.now() + 10 * 60 * 1000;

    const otps = readStore<Record<string, PendingOtpChallenge>>(KEYS.OTPS, {});
    otps[userId] = {
      userId,
      e164Number: e164,
      otpCode,
      expiresAt: expiresAtMs,
      attempts: 0,
    };
    writeStore(KEYS.OTPS, otps);

    this._updateUserDirect(
      userId,
      { mobileVerificationStatus: 'PENDING' },
      actor,
      'Initiated mobile OTP verification challenge'
    );

    EnterpriseAuditService.logEvent({
      companyId: user.defaultCompanyId || 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: userId,
      eventType: 'MOBILE_OTP_INITIATED',
      eventDescription: `Initiated mobile OTP verification for ${user.fullName} (${this.maskMobileNumber(user.countryCode, user.mobilePhone)})`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: 'Mobile number ownership verification',
    });

    dispatchUiEvent('cip:mobile-consent-updated', { userId });

    return {
      sent: true,
      e164Number: e164,
      maskedNumber: this.maskMobileNumber(user.countryCode, user.mobilePhone),
      verificationStatus: 'PENDING',
      previewOtpCode: otpCode,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  },

  confirmMobileOtp(
    userId: string,
    submittedOtp: string,
    actor: { id: string; name: string }
  ): { verified: boolean; user: User; message: string } {
    const user = this._getUserById(userId);
    if (!user) throw new Error('User not found.');
    const otps = readStore<Record<string, PendingOtpChallenge>>(KEYS.OTPS, {});
    const challenge = otps[userId];
    if (!challenge) {
      throw new Error('No active OTP verification challenge found. Request a new OTP code.');
    }
    if (Date.now() > challenge.expiresAt) {
      delete otps[userId];
      writeStore(KEYS.OTPS, otps);
      const failedUser = this._updateUserDirect(userId, { mobileVerificationStatus: 'FAILED' }, actor, 'OTP verification expired');
      return { verified: false, user: failedUser, message: 'OTP expired. Please request a new verification code.' };
    }

    if ((submittedOtp || '').trim() !== challenge.otpCode) {
      challenge.attempts += 1;
      otps[userId] = challenge;
      writeStore(KEYS.OTPS, otps);
      const updated = this._updateUserDirect(
        userId,
        { mobileVerificationStatus: 'FAILED' },
        actor,
        'Invalid mobile OTP code entered'
      );
      return { verified: false, user: updated, message: 'Invalid OTP code. Mobile verification marked Failed.' };
    }

    delete otps[userId];
    writeStore(KEYS.OTPS, otps);

    // Strictly update verification status only — NEVER mutate mobileConsentStatus
    const verifiedUser = this._updateUserDirect(
      userId,
      {
        mobileVerificationStatus: 'VERIFIED',
        mobileVerifiedAt: new Date().toISOString(),
      },
      actor,
      'Mobile OTP verified successfully'
    );

    EnterpriseAuditService.logEvent({
      companyId: user.defaultCompanyId || 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: userId,
      eventType: 'MOBILE_OTP_VERIFIED',
      eventDescription: `Verified mobile number ownership via OTP for ${user.fullName} (Consent status preserved as ${verifiedUser.mobileConsentStatus || 'N/A'})`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: 'Mobile OTP verification confirmed',
    });

    dispatchUiEvent('cip:mobile-consent-updated', { userId });

    return {
      verified: true,
      user: verifiedUser,
      message: 'Mobile number verified successfully.',
    };
  },

  // =========================================================================
  // EMPLOYEE SELF-SERVICE CONSENT ACTIONS
  // =========================================================================
  submitEmployeeConsentDecision(params: {
    targetUserId: string;
    decision: 'GRANT' | 'DECLINE';
    approvedPurposes: CommunicationPurpose[];
    actor: { id: string; name: string };
    reason?: string;
  }): { user: User; evidence: MobileConsentEvidenceRecord } {
    if (params.actor.id !== params.targetUserId) {
      throw new Error(
        'Employee Self-Service Only: Administrators cannot grant or decline Personal Mobile Consent on behalf of another employee.'
      );
    }

    const user = this._getUserById(params.targetUserId);
    if (!user) throw new Error('Employee user account not found.');
    if (user.employeeAssociationStatus === 'NOT_ASSOCIATED') {
      throw new Error('Not Associated employee accounts cannot submit personal mobile consent.');
    }
    if (user.mobileNumberType !== 'PERSONAL' || !user.mobilePhone) {
      throw new Error('Personal Mobile Consent applies only to users with a Personal Mobile Number.');
    }

    const policy = this.getCompanyMobilePolicy(user.defaultCompanyId);
    const e164 = buildE164(user.countryCode || '+91', user.mobilePhone);
    const nowIso = new Date().toISOString();

    const allowedPurposes = (params.approvedPurposes || []).filter((p) =>
      policy.allowedPersonalPurposes.includes(p)
    );

    if (params.decision === 'GRANT' && allowedPurposes.length === 0) {
      throw new Error('Select at least one policy-approved communication purpose to grant Personal Mobile Consent.');
    }

    const nextStatus: PersonalConsentStatus =
      params.decision === 'GRANT' ? 'CONSENT_GRANTED' : 'CONSENT_DECLINED';
    const nextPurposes = params.decision === 'GRANT' ? allowedPurposes : [];

    const evidence = this.appendConsentEvidence({
      userId: user.id,
      userName: user.fullName,
      employeeId: user.employeeId,
      companyId: user.defaultCompanyId || 'co-kosh-01',
      countryCode: user.countryCode || '+91',
      e164Number: e164,
      mobileNumberType: 'PERSONAL',
      action: params.decision === 'GRANT' ? 'CONSENT_GRANTED' : 'CONSENT_DECLINED',
      consentStatus: nextStatus,
      consentVersion: policy.activeConsentVersion,
      consentMethod: 'EMPLOYEE_CONFIRMATION',
      approvedPurposes: nextPurposes,
      reason:
        params.reason?.trim() ||
        (params.decision === 'GRANT'
          ? `Employee explicitly granted consent for: ${nextPurposes.join(', ')}`
          : 'Employee declined personal mobile communication consent.'),
      actorUserId: params.actor.id,
      actorName: params.actor.name,
      requestChannel: 'PORTAL_AND_EMAIL',
    });

    const updated = this._updateUserDirect(
      user.id,
      {
        mobileConsentStatus: nextStatus,
        mobileConsentVersion: policy.activeConsentVersion,
        mobileConsentMethod: 'EMPLOYEE_CONFIRMATION',
        mobileConsentPurposes: nextPurposes,
        mobileConsentTimestamp: nowIso,
        mobileConsentEvidenceId: evidence.id,
      },
      params.actor,
      `Employee ${params.decision === 'GRANT' ? 'granted' : 'declined'} Personal Mobile Consent (${policy.activeConsentVersion})`
    );

    EnterpriseAuditService.logEvent({
      companyId: user.defaultCompanyId || 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: user.id,
      eventType: params.decision === 'GRANT' ? 'PERSONAL_CONSENT_GRANTED' : 'PERSONAL_CONSENT_DECLINED',
      eventDescription: `${user.fullName} ${params.decision === 'GRANT' ? 'granted' : 'declined'} Personal Mobile Consent (${policy.activeConsentVersion}); purposes: ${nextPurposes.join(', ') || 'None'}`,
      changedByUserId: params.actor.id,
      changedByName: params.actor.name,
      changeReason: evidence.reason || 'Employee self-service consent decision',
      authorizationReference: evidence.evidenceReference,
    });

    dispatchUiEvent('cip:mobile-consent-updated', { userId: user.id });

    return { user: updated, evidence };
  },

  withdrawEmployeeConsent(params: {
    targetUserId: string;
    reason: string;
    actor: { id: string; name: string };
  }): { user: User; evidence: MobileConsentEvidenceRecord } {
    if (!params.reason || params.reason.trim().length < 5) {
      throw new Error('Mandatory withdrawal reason (minimum 5 characters) is required.');
    }
    const user = this._getUserById(params.targetUserId);
    if (!user) throw new Error('User not found.');
    if (user.mobileNumberType !== 'PERSONAL' || !user.mobilePhone) {
      throw new Error('Consent withdrawal applies only to Personal Mobile Numbers.');
    }

    const policy = this.getCompanyMobilePolicy(user.defaultCompanyId);
    const e164 = buildE164(user.countryCode || '+91', user.mobilePhone);
    const nowIso = new Date().toISOString();

    this.archiveNumberRecord({
      userId: user.id,
      countryCode: user.countryCode || '+91',
      mobileNumber: normalizeDigits(user.mobilePhone),
      e164Number: e164,
      mobileNumberType: 'PERSONAL',
      verificationStatus: user.mobileVerificationStatus || 'NOT_VERIFIED',
      consentStatus: user.mobileConsentStatus || 'CONSENT_GRANTED',
      consentVersion: user.mobileConsentVersion || policy.activeConsentVersion,
      archivedReason: 'CONSENT_WITHDRAWN',
      archivedBy: params.actor.name,
    });

    const evidence = this.appendConsentEvidence({
      userId: user.id,
      userName: user.fullName,
      employeeId: user.employeeId,
      companyId: user.defaultCompanyId || 'co-kosh-01',
      countryCode: user.countryCode || '+91',
      e164Number: e164,
      mobileNumberType: 'PERSONAL',
      action: 'CONSENT_WITHDRAWN',
      consentStatus: 'CONSENT_WITHDRAWN',
      consentVersion: policy.activeConsentVersion,
      consentMethod: 'EMPLOYEE_CONFIRMATION',
      approvedPurposes: [],
      reason: params.reason.trim(),
      actorUserId: params.actor.id,
      actorName: params.actor.name,
    });

    const updated = this._updateUserDirect(
      user.id,
      {
        mobileConsentStatus: 'CONSENT_WITHDRAWN',
        mobileConsentPurposes: [],
        mobileConsentTimestamp: nowIso,
        mobileConsentEvidenceId: evidence.id,
      },
      params.actor,
      `Personal mobile consent withdrawn: ${params.reason.trim()}`
    );

    EnterpriseAuditService.logEvent({
      companyId: user.defaultCompanyId || 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: user.id,
      eventType: 'PERSONAL_CONSENT_WITHDRAWN',
      eventDescription: `${user.fullName} withdrew Personal Mobile Consent; all consent-dependent SMS/WhatsApp dispatches halted immediately.`,
      changedByUserId: params.actor.id,
      changedByName: params.actor.name,
      changeReason: params.reason.trim(),
      authorizationReference: evidence.evidenceReference,
    });

    dispatchUiEvent('cip:mobile-consent-updated', { userId: user.id });

    return { user: updated, evidence };
  },

  employeeChangeMobileContact(params: {
    targetUserId: string;
    countryCode: string;
    mobilePhone: string;
    mobileNumberType: MobileNumberType;
    actor: { id: string; name: string };
    reason?: string;
  }): { user: User; consentResetRequired: boolean } {
    if (params.actor.id !== params.targetUserId) {
      throw new Error('Only the authenticated employee can update their contact via Employee Self-Service.');
    }
    const existing = this._getUserById(params.targetUserId);
    if (!existing) throw new Error('User not found.');

    const prep = this.prepareMobileOnboardingFields(
      {
        countryCode: params.countryCode,
        mobilePhone: params.mobilePhone,
        mobileNumberType: params.mobileNumberType,
        companyId: existing.defaultCompanyId,
        userId: existing.id,
        userName: existing.fullName,
        employeeId: existing.employeeId,
      },
      params.actor,
      existing
    );

    const updated = this._updateUserDirect(
      existing.id,
      prep.patch,
      params.actor,
      params.reason || 'Employee self-service mobile contact update'
    );

    if (prep.shouldDispatchPersonalConsentRequest) {
      this.requestPersonalMobileConsent(updated, params.actor);
    }

    dispatchUiEvent('cip:mobile-consent-updated', { userId: existing.id });

    return {
      user: this._getUserById(existing.id) || updated,
      consentResetRequired: prep.shouldDispatchPersonalConsentRequest,
    };
  },

  // =========================================================================
  // CENTRALIZED COMMUNICATION CONSENT GATE (SMS & WHATSAPP)
  // =========================================================================
  evaluateCommunicationDispatch(params: {
    targetUserId?: string;
    phoneNumber?: string;
    channel: 'SMS' | 'WHATSAPP';
    purpose: CommunicationPurpose;
    actor: { id: string; name: string };
    context?: string;
  }): CommunicationDispatchDecision {
    const users = this._getAllUsers();
    let user = params.targetUserId ? users.find((u) => u.id === params.targetUserId) : undefined;
    if (!user && params.phoneNumber) {
      const targetDigits = normalizeDigits(params.phoneNumber).slice(-10);
      user = users.find((u) => normalizeDigits(u.mobilePhone || '').endsWith(targetDigits));
    }

    const logBlock = (
      blockedCode: NonNullable<CommunicationDispatchDecision['blockedCode']>,
      reason: string
    ): CommunicationDispatchDecision => {
      const maskedPhone = user?.mobilePhone
        ? this.maskMobileNumber(user.countryCode, user.mobilePhone)
        : params.phoneNumber
        ? this.maskMobileNumber('', params.phoneNumber)
        : 'N/A';
      const logs = this.getBlockedDispatchLogs();
      const auditId = `blk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const entry: BlockedCommunicationAuditRecord = {
        id: auditId,
        timestamp: new Date().toISOString(),
        channel: params.channel,
        purpose: params.purpose,
        targetUserId: user?.id,
        targetUserName: user?.fullName,
        maskedPhone,
        blockedCode,
        reason,
        actorUserId: params.actor.id,
        actorName: params.actor.name,
        context: params.context,
      };
      writeStore(KEYS.BLOCKED_LOGS, [entry, ...logs].slice(0, 200));

      EnterpriseAuditService.logEvent({
        companyId: user?.defaultCompanyId || 'co-kosh-01',
        entityType: 'SECURITY',
        entityId: user?.id || maskedPhone,
        eventType: 'COMMUNICATION_BLOCKED_NO_CONSENT',
        eventDescription: `Blocked ${params.channel} (${params.purpose}) to ${user?.fullName || maskedPhone}: ${reason}`,
        changedByUserId: params.actor.id,
        changedByName: params.actor.name,
        changeReason: params.context || blockedCode,
      });

      return {
        allowed: false,
        blockedCode,
        reason,
        targetUserId: user?.id,
        e164Number: user?.mobilePhone ? buildE164(user.countryCode || '+91', user.mobilePhone) : undefined,
        mobileNumberType: user?.mobileNumberType,
        consentStatus: user?.mobileConsentStatus,
        verificationStatus: user?.mobileVerificationStatus,
        auditEventId: auditId,
      };
    };

    if (params.channel === 'SMS') {
      const smsGw = this.getSmsGatewayConfig();
      if (!smsGw.isEnabled) {
        return logBlock('CHANNEL_DISABLED', 'Enterprise SMS Gateway is currently disabled by policy.');
      }
    }

    if (!user && !params.phoneNumber) {
      return logBlock('NO_MOBILE_NUMBER', 'No target user or mobile number provided for communication dispatch.');
    }

    if (user) {
      if (user.employeeAssociationStatus === 'NOT_ASSOCIATED') {
        return logBlock(
          'EMPLOYEE_NOT_ASSOCIATED',
          `Blocked: ${user.fullName} is marked Not Associated. Organizational communication is prohibited.`
        );
      }
      if (user.status === 'DEACTIVATED' || user.status === 'INACTIVE' || user.status === 'ARCHIVED') {
        return logBlock(
          'ACCOUNT_INACTIVE',
          `Blocked: ${user.fullName} account status is ${user.status}.`
        );
      }
      if (!user.mobilePhone) {
        return logBlock('NO_MOBILE_NUMBER', `Blocked: ${user.fullName} has no mobile number on profile.`);
      }

      const policy = this.getCompanyMobilePolicy(user.defaultCompanyId);
      const e164 = buildE164(user.countryCode || '+91', user.mobilePhone);

      if (policy.requireVerifiedNumberBeforeComm && user.mobileVerificationStatus !== 'VERIFIED') {
        return logBlock(
          'UNVERIFIED_MOBILE',
          `Blocked: ${user.fullName} mobile verification status is ${user.mobileVerificationStatus || 'NOT_VERIFIED'}, and company policy requires Verified status before dispatch.`
        );
      }

      if (user.mobileNumberType === 'PERSONAL') {
        if (!policy.allowedPersonalPurposes.includes(params.purpose)) {
          return logBlock(
            'PURPOSE_POLICY_DISABLED',
            `Blocked: Company Mobile Policy does not permit Personal Mobile communication for purpose '${params.purpose}'.`
          );
        }

        if (user.mobileConsentStatus === 'CONSENT_DECLINED') {
          return logBlock(
            'PERSONAL_CONSENT_DECLINED',
            `Blocked: ${user.fullName} declined Personal Mobile Consent.`
          );
        }
        if (user.mobileConsentStatus === 'CONSENT_WITHDRAWN') {
          return logBlock(
            'PERSONAL_CONSENT_WITHDRAWN',
            `Blocked: ${user.fullName} withdrew Personal Mobile Consent.`
          );
        }
        if (user.mobileConsentStatus !== 'CONSENT_GRANTED') {
          return logBlock(
            'PERSONAL_CONSENT_REQUIRED',
            `Blocked: Personal Mobile Consent is ${user.mobileConsentStatus || 'PENDING_EMPLOYEE_CONSENT'} for ${user.fullName}.`
          );
        }
        if (!(user.mobileConsentPurposes || []).includes(params.purpose)) {
          return logBlock(
            'PURPOSE_NOT_CONSENTED',
            `Blocked: ${user.fullName} has not granted Personal Mobile Consent for '${params.purpose}'.`
          );
        }
      }

      return {
        allowed: true,
        reason:
          user.mobileNumberType === 'PERSONAL'
            ? `Authorized: Verified Personal Mobile Consent (${user.mobileConsentVersion || 'v2.0'}) covers ${params.purpose}.`
            : 'Authorized: Official Mobile Number (personal consent not required).',
        targetUserId: user.id,
        e164Number: e164,
        mobileNumberType: user.mobileNumberType || 'OFFICIAL',
        consentStatus: user.mobileConsentStatus || 'NOT_REQUIRED_OFFICIAL',
        verificationStatus: user.mobileVerificationStatus || 'NOT_VERIFIED',
      };
    }

    // Raw phone number provided without matched user
    const cleanDigits = normalizeDigits(params.phoneNumber || '');
    if (!/^\d{8,15}$/.test(cleanDigits)) {
      return logBlock('INVALID_MOBILE_FORMAT', 'Provided phone number fails E.164 format validation.');
    }
    return {
      allowed: true,
      reason: 'Authorized external number format validated.',
      e164Number: params.phoneNumber!.startsWith('+') ? params.phoneNumber! : `+${cleanDigits}`,
    };
  },

  filterBroadcastRecipients(
    users: User[],
    opts: {
      channels: Array<'IN_PORTAL' | 'EMAIL' | 'WHATSAPP' | 'SMS'>;
      purpose: CommunicationPurpose;
      actor: { id: string; name: string };
      campaignTitle?: string;
    }
  ): {
    eligible: User[];
    blocked: Array<{ user: User; channel: 'SMS' | 'WHATSAPP'; decision: CommunicationDispatchDecision }>;
  } {
    const mobileChannels = opts.channels.filter((c): c is 'SMS' | 'WHATSAPP' => c === 'SMS' || c === 'WHATSAPP');
    const eligible: User[] = [];
    const blocked: Array<{ user: User; channel: 'SMS' | 'WHATSAPP'; decision: CommunicationDispatchDecision }> = [];

    for (const u of users) {
      if (mobileChannels.length === 0) {
        if (u.employeeAssociationStatus !== 'NOT_ASSOCIATED' && u.status !== 'DEACTIVATED') {
          eligible.push(u);
        }
        continue;
      }

      let userAllowed = true;
      for (const ch of mobileChannels) {
        const decision = this.evaluateCommunicationDispatch({
          targetUserId: u.id,
          channel: ch,
          purpose: opts.purpose,
          actor: opts.actor,
          context: opts.campaignTitle ? `Broadcast: ${opts.campaignTitle}` : 'Broadcast Campaign',
        });
        if (!decision.allowed) {
          blocked.push({ user: u, channel: ch, decision });
          userAllowed = false;
          break;
        }
      }
      if (userAllowed) eligible.push(u);
    }

    return { eligible, blocked };
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
  },
};
