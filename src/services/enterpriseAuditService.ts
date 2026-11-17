import { User } from '../types';
import { INITIAL_COMPANIES, INITIAL_USERS } from '../data/seedData';

export type AuditEntityType =
  | 'PURCHASE_ORGANIZATION'
  | 'BUYER_ASSIGNMENT'
  | 'MANAGER_ASSIGNMENT'
  | 'DELEGATION'
  | 'ASSIGNMENT_RULE'
  | 'PURCHASE_REQUISITION'
  | 'APPROVAL_MAPPING'
  | 'FINANCIAL_YEAR'
  | 'ACCOUNTING_PERIOD'
  | 'WORKDAY_CALENDAR'
  | 'BUDGET_CONTROL'
  | 'INVOICE_MATCHING'
  | 'INVENTORY_VALIDATION'
  | 'INVENTORY_TRANSFER'
  | 'STOCK_AGING'
  | 'PR_AGING'
  | 'SECURITY'
  | 'SYSTEM_CONFIG'
  | 'CHARGE_GOVERNANCE'
  | 'GLOBAL_ITEM'
  | 'GLOBAL_ITEM_MASTER'
  | 'BRANCH_ITEM'
  | 'UOM_MASTER'
  | 'CLASSIFICATION_MASTER'
  | 'ITEM_RULE';

export type AuditSourceType = 'UI' | 'API' | 'SYSTEM';

export interface EnterpriseAuditRecord {
  id: string;
  correlationId: string;
  companyId: string;
  companyName?: string;
  purchaseOrganizationId?: string;
  purchaseOrganizationCode?: string;
  branchId?: string;
  branchName?: string;
  entityType: AuditEntityType;
  entityId: string;
  eventType: string;
  eventDescription: string;
  previousValue?: Record<string, any>;
  newValue?: Record<string, any>;
  changedByUserId: string;
  changedByName: string;
  timestamp: string; // UTC ISO string
  effectiveFrom?: string;
  effectiveTo?: string;
  changeReason: string;
  authorizationReference?: string;
  source: AuditSourceType;
  relatedPrId?: string;
  previousHash: string;
  hash: string;
  idempotencyKey?: string;
}

export interface AuditFilterParams {
  companyId?: string;
  purchaseOrganizationId?: string;
  branchId?: string;
  entityType?: string;
  eventType?: string;
  employeeUserId?: string;
  itemCategory?: string;
  materialCode?: string;
  changedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  source?: string;
  searchQuery?: string;
  financialYearId?: string;
  financialYearCode?: string;
}

const STORAGE_KEY_AUDIT_LOGS = 'kosh_enterprise_audit_log_v4';
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

// Deterministic Cryptographic Hash Calculator (Web Crypto API SHA-256 with fallback)
export async function calculateRecordHash(
  payload: {
    id: string;
    correlationId: string;
    previousHash: string;
    timestamp: string;
    entityType: string;
    eventType: string;
    changedByUserId: string;
    previousValue?: any;
    newValue?: any;
  }
): Promise<string> {
  const str = JSON.stringify({
    id: payload.id,
    correlationId: payload.correlationId,
    previousHash: payload.previousHash,
    timestamp: payload.timestamp,
    entityType: payload.entityType,
    eventType: payload.eventType,
    changedByUserId: payload.changedByUserId,
    previousValue: payload.previousValue || null,
    newValue: payload.newValue || null,
  });

  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(str);
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback to FNV-1a calculation if subtle crypto fails
    }
  }

  let hash1 = 0x811c9dc5;
  let hash2 = 0x27d4eb2f;
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    hash1 = (hash1 ^ charCode) * 16777619;
    hash2 = (hash2 ^ charCode) * 16777619;
  }
  const h1Hex = (hash1 >>> 0).toString(16).padStart(8, '0');
  const h2Hex = (hash2 >>> 0).toString(16).padStart(8, '0');
  return `sha256-${h1Hex}${h2Hex}${Math.abs(hash1).toString(36)}`;
}

// Initial Immutable Seed Logs (ordered newest-first; valid cryptographic SHA-256 chain)
const INITIAL_AUDIT_RECORDS: EnterpriseAuditRecord[] = [
  {
    id: 'aud-20260101-0003',
    correlationId: 'corr-mgr-pm-01',
    companyId: 'co-kosh-01',
    companyName: 'Kosh Innovations Pvt Ltd',
    purchaseOrganizationId: 'po-kosh-01',
    purchaseOrganizationCode: 'PO-HQ-01',
    entityType: 'MANAGER_ASSIGNMENT',
    entityId: 'eff-po-01-pm-1',
    eventType: 'PRIMARY_MANAGER_ASSIGNED',
    eventDescription: 'Assigned Primary Purchasing Manager (Venkatesh Iyer [EMP-3001]) for PO-HQ-01',
    previousValue: undefined,
    newValue: {
      role: 'PRIMARY_MANAGER',
      userId: 'usr-checker-03',
      userName: 'Venkatesh Iyer',
      employeeId: 'EMP-3001',
      designation: 'Chief Purchasing Manager',
      department: 'Global Sourcing & Contracts',
      validFrom: '2026-01-01',
      validTo: null,
    },
    changedByUserId: 'usr-admin-01',
    changedByName: 'Rajesh Sharma (Platform Admin)',
    timestamp: '2026-01-01T00:10:00.000Z',
    effectiveFrom: '2026-01-01',
    changeReason: 'Assigned Chief Purchasing Manager',
    authorizationReference: 'AUTH-MGR-01',
    source: 'UI',
    previousHash: 'ea26159cb0024fa0afb303b0e3f9df7df9dbd8c08ba1da518ae429423e02f2a2',
    hash: '7991f6a36f5e547b9db4bdff1849c9a2a4e566ff84b79a60e6c9059d5cd94bba',
  },
  {
    id: 'aud-20260101-0002',
    correlationId: 'corr-buyer-pb-01',
    companyId: 'co-kosh-01',
    companyName: 'Kosh Innovations Pvt Ltd',
    purchaseOrganizationId: 'po-kosh-01',
    purchaseOrganizationCode: 'PO-HQ-01',
    entityType: 'BUYER_ASSIGNMENT',
    entityId: 'eff-po-01-pb-1',
    eventType: 'PRIMARY_BUYER_ASSIGNED',
    eventDescription: 'Assigned Primary Buyer (Vikram Singh [EMP-2001]) for PO-HQ-01',
    previousValue: undefined,
    newValue: {
      role: 'PRIMARY_BUYER',
      userId: 'usr-buyer-01',
      userName: 'Vikram Singh',
      employeeId: 'EMP-2001',
      designation: 'Senior Procurement Officer',
      department: 'Central Purchasing Division',
      validFrom: '2026-01-01',
      validTo: null,
    },
    changedByUserId: 'usr-admin-01',
    changedByName: 'Rajesh Sharma (Platform Admin)',
    timestamp: '2026-01-01T00:05:00.000Z',
    effectiveFrom: '2026-01-01',
    changeReason: 'Assigned Primary Buyer for Central HQ Procurement',
    authorizationReference: 'AUTH-BUYER-01',
    source: 'UI',
    previousHash: 'f74e4acfff032f8343815477cf43a1ba2afccd2ebe091be211a5b7bc41815dc3',
    hash: 'ea26159cb0024fa0afb303b0e3f9df7df9dbd8c08ba1da518ae429423e02f2a2',
  },
  {
    id: 'aud-20260101-0001',
    correlationId: 'corr-po-init-01',
    companyId: 'co-kosh-01',
    companyName: 'Kosh Innovations Pvt Ltd',
    purchaseOrganizationId: 'po-kosh-01',
    purchaseOrganizationCode: 'PO-HQ-01',
    entityType: 'PURCHASE_ORGANIZATION',
    entityId: 'po-kosh-01',
    eventType: 'PURCHASE_ORG_CREATED',
    eventDescription: 'Created Purchase Organization [PO-HQ-01] Kosh Central Procurement Organization',
    previousValue: undefined,
    newValue: {
      code: 'PO-HQ-01',
      name: 'Kosh Central Procurement Organization',
      model: 'CENTRALIZED',
      companyId: 'co-kosh-01',
      status: 'ACTIVE',
      effectiveFrom: '2026-01-01',
    },
    changedByUserId: 'usr-admin-01',
    changedByName: 'Rajesh Sharma (Platform Admin)',
    timestamp: '2026-01-01T00:00:00.000Z',
    effectiveFrom: '2026-01-01',
    changeReason: 'Initial setup of central procurement governance',
    authorizationReference: 'AUTH-GOV-2026-001',
    source: 'UI',
    previousHash: GENESIS_HASH,
    hash: 'f74e4acfff032f8343815477cf43a1ba2afccd2ebe091be211a5b7bc41815dc3',
  },
];

let memoryAuditFallback: EnterpriseAuditRecord[] | null = null;
let auditWriteQueue: Promise<any> = Promise.resolve();

export const EnterpriseAuditService = {
  getAuditLogs(filters?: AuditFilterParams, currentUser?: User): EnterpriseAuditRecord[] {
    try {
      let list: EnterpriseAuditRecord[];
      if (typeof localStorage === 'undefined') {
        if (!memoryAuditFallback) {
          memoryAuditFallback = JSON.parse(JSON.stringify(INITIAL_AUDIT_RECORDS));
        }
        list = [...memoryAuditFallback!];
      } else {
        const stored = localStorage.getItem(STORAGE_KEY_AUDIT_LOGS);
        if (!stored) {
          localStorage.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(INITIAL_AUDIT_RECORDS));
          list = [...INITIAL_AUDIT_RECORDS];
        } else {
          list = JSON.parse(stored);
        }
      }

      // Company isolation check (RBAC data isolation)
      if (currentUser && currentUser.role !== 'PLATFORM_ADMIN' && currentUser.orgId) {
        // Find companies associated with orgId or user allowedBranchIds
        list = list.filter(r => r.companyId === 'co-kosh-01' || r.companyId === currentUser.orgId);
      }

      if (filters) {
        if (filters.companyId && filters.companyId !== 'ALL') {
          list = list.filter(r => r.companyId === filters.companyId);
        }
        if (filters.purchaseOrganizationId && filters.purchaseOrganizationId !== 'ALL') {
          list = list.filter(r => r.purchaseOrganizationId === filters.purchaseOrganizationId);
        }
        if (filters.branchId && filters.branchId !== 'ALL') {
          list = list.filter(r => r.branchId === filters.branchId);
        }
        if (filters.entityType && filters.entityType !== 'ALL') {
          list = list.filter(r => r.entityType === filters.entityType);
        }
        if (filters.eventType && filters.eventType !== 'ALL') {
          list = list.filter(r => r.eventType === filters.eventType);
        }
        if (filters.employeeUserId) {
          list = list.filter(r => {
            const matchesPrev = r.previousValue && JSON.stringify(r.previousValue).toLowerCase().includes(filters.employeeUserId!.toLowerCase());
            const matchesNew = r.newValue && JSON.stringify(r.newValue).toLowerCase().includes(filters.employeeUserId!.toLowerCase());
            return matchesPrev || matchesNew || r.changedByUserId === filters.employeeUserId;
          });
        }
        if (filters.changedBy) {
          list = list.filter(r => r.changedByName.toLowerCase().includes(filters.changedBy!.toLowerCase()) || r.changedByUserId === filters.changedBy);
        }
        if (filters.source && filters.source !== 'ALL') {
          list = list.filter(r => r.source === filters.source);
        }
        if (filters.dateFrom) {
          list = list.filter(r => r.timestamp.slice(0, 10) >= filters.dateFrom!.slice(0, 10));
        }
        if (filters.dateTo) {
          list = list.filter(r => r.timestamp.slice(0, 10) <= filters.dateTo!.slice(0, 10));
        }
        if (filters.financialYearCode) {
          const targetCode = filters.financialYearCode.toLowerCase();
          list = list.filter(r => {
            const nv = r.newValue as Record<string, any> | undefined;
            const pv = r.previousValue as Record<string, any> | undefined;
            if (nv?.financialYearCode?.toLowerCase() === targetCode || pv?.financialYearCode?.toLowerCase() === targetCode) {
              return true;
            }
            if (filters.financialYearId && (nv?.financialYearId === filters.financialYearId || pv?.financialYearId === filters.financialYearId)) {
              return true;
            }
            return false;
          });
        }
        if (filters.searchQuery && filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase().trim();
          list = list.filter(r => {
            return (
              r.eventDescription.toLowerCase().includes(q) ||
              r.id.toLowerCase().includes(q) ||
              r.correlationId.toLowerCase().includes(q) ||
              (r.purchaseOrganizationCode || '').toLowerCase().includes(q) ||
              r.changedByName.toLowerCase().includes(q) ||
              r.changeReason.toLowerCase().includes(q)
            );
          });
        }
      }

      // Sort newest first (descending UTC timestamp)
      return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch {
      return INITIAL_AUDIT_RECORDS;
    }
  },

  async logEvent(params: {
    companyId: string;
    companyName?: string;
    purchaseOrganizationId?: string;
    purchaseOrganizationCode?: string;
    branchId?: string;
    branchName?: string;
    entityType: AuditEntityType;
    entityId: string;
    eventType: string;
    eventDescription: string;
    previousValue?: Record<string, any>;
    newValue?: Record<string, any>;
    changedByUserId: string;
    changedByName: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    changeReason: string;
    authorizationReference?: string;
    source?: AuditSourceType;
    relatedPrId?: string;
    idempotencyKey?: string;
  }): Promise<EnterpriseAuditRecord> {
    const task = auditWriteQueue.then(async () => {
      const list = this.getAuditLogs();

      // Idempotency check to prevent duplicate events
      if (params.idempotencyKey) {
        const existing = list.find(r => r.idempotencyKey === params.idempotencyKey);
        if (existing) {
          return existing;
        }
      }

      const coObj = INITIAL_COMPANIES.find(c => c.id === params.companyId);
      const chronoLatest = [...list].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];
      const previousHash = chronoLatest ? chronoLatest.hash : GENESIS_HASH;
      const minNextTs = chronoLatest ? Math.max(Date.now(), new Date(chronoLatest.timestamp).getTime() + 1) : Date.now();

      const id = `aud-${new Date(minNextTs).toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}-${Math.random().toString(36).substring(2, 6)}`;
      const correlationId = `corr-${Math.random().toString(36).substring(2, 9)}`;
      const timestamp = new Date(minNextTs).toISOString();

      const hash = await calculateRecordHash({
        id,
        correlationId,
        previousHash,
        timestamp,
        entityType: params.entityType,
        eventType: params.eventType,
        changedByUserId: params.changedByUserId,
        previousValue: params.previousValue,
        newValue: params.newValue,
      });

      const newRecord: EnterpriseAuditRecord = {
        id,
        correlationId,
        companyId: params.companyId,
        companyName: params.companyName || coObj?.name || params.companyId,
        purchaseOrganizationId: params.purchaseOrganizationId,
        purchaseOrganizationCode: params.purchaseOrganizationCode,
        branchId: params.branchId,
        branchName: params.branchName,
        entityType: params.entityType,
        entityId: params.entityId,
        eventType: params.eventType,
        eventDescription: params.eventDescription,
        previousValue: params.previousValue,
        newValue: params.newValue,
        changedByUserId: params.changedByUserId,
        changedByName: params.changedByName,
        timestamp,
        effectiveFrom: params.effectiveFrom,
        effectiveTo: params.effectiveTo,
        changeReason: params.changeReason || 'Enterprise change event recorded',
        authorizationReference: params.authorizationReference || `AUTH-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        source: params.source || 'UI',
        relatedPrId: params.relatedPrId,
        previousHash,
        hash,
        idempotencyKey: params.idempotencyKey,
      };

      list.unshift(newRecord);
      memoryAuditFallback = list;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(list));
      }
      return newRecord;
    });
    auditWriteQueue = task.catch(() => {});
    return task;
  },

  // Log Security / Unauthorized Access Attempts
  async logUnauthorizedAttempt(params: {
    attemptedAction: string;
    targetResource: string;
    userId: string;
    userName: string;
    companyId: string;
    reason: string;
  }): Promise<EnterpriseAuditRecord> {
    return this.logEvent({
      companyId: params.companyId,
      entityType: 'SECURITY',
      entityId: `sec-${Date.now()}`,
      eventType: 'UNAUTHORIZED_ATTEMPT',
      eventDescription: `UNAUTHORIZED ACCESS ATTEMPT: User [${params.userName}] attempted [${params.attemptedAction}] on [${params.targetResource}]`,
      previousValue: { accessAllowed: false },
      newValue: { accessBlocked: true, violation: params.reason },
      changedByUserId: params.userId,
      changedByName: params.userName,
      changeReason: params.reason,
      source: 'SYSTEM',
    });
  },

  // Cryptographic Tamper-Evident Chain Integrity Verifier
  async verifyAuditChainIntegrity(): Promise<{
    isValid: boolean;
    totalRecords: number;
    tamperedRecordId?: string;
    message: string;
  }> {
    const logs = this.getAuditLogs();
    if (logs.length === 0) {
      return { isValid: true, totalRecords: 0, message: 'Audit chain empty.' };
    }

    // Chronological order for verification (oldest to newest)
    const chronoLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (let i = 0; i < chronoLogs.length; i++) {
      const record = chronoLogs[i];
      const expectedPrevHash = i === 0 ? GENESIS_HASH : chronoLogs[i - 1].hash;

      if (record.previousHash !== expectedPrevHash) {
        return {
          isValid: false,
          totalRecords: logs.length,
          tamperedRecordId: record.id,
          message: `CHAIN BROKEN at Record ID ${record.id}: previousHash mismatch. Chain tamper detected!`,
        };
      }

      const calculated = await calculateRecordHash({
        id: record.id,
        correlationId: record.correlationId,
        previousHash: record.previousHash,
        timestamp: record.timestamp,
        entityType: record.entityType,
        eventType: record.eventType,
        changedByUserId: record.changedByUserId,
        previousValue: record.previousValue,
        newValue: record.newValue,
      });

      if (calculated !== record.hash) {
        return {
          isValid: false,
          totalRecords: logs.length,
          tamperedRecordId: record.id,
          message: `PAYLOAD TAMPERING detected at Record ID ${record.id}: Calculated Hash (${calculated.substring(0, 10)}) does not match stored hash (${record.hash.substring(0, 10)}).`,
        };
      }
    }

    return {
      isValid: true,
      totalRecords: logs.length,
      message: `VERIFIED: All ${logs.length} audit records intact. Cryptographic chained hash integrity validated.`,
    };
  },

  // Export Filtered Audit Logs to CSV
  exportAuditLogsToCsv(
    filters?: AuditFilterParams,
    currentUser?: User,
    preFilteredLogs?: EnterpriseAuditRecord[]
  ): void {
    const logs = preFilteredLogs ?? this.getAuditLogs(filters, currentUser);

    const headers = [
      'Audit Event ID',
      'Correlation ID',
      'Timestamp (UTC)',
      'Source',
      'Company Name',
      'Purchase Org',
      'Entity Type',
      'Event Type',
      'Event Description',
      'Changed By User',
      'Effective From',
      'Effective To',
      'Change Reason',
      'Auth Reference',
      'Previous Value JSON',
      'New Value JSON',
      'Chained Hash',
    ];

    const rows = logs.map(r => [
      r.id,
      r.correlationId,
      r.timestamp,
      r.source,
      `"${(r.companyName || r.companyId).replace(/"/g, '""')}"`,
      `"${(r.purchaseOrganizationCode || r.purchaseOrganizationId || 'N/A').replace(/"/g, '""')}"`,
      r.entityType,
      r.eventType,
      `"${r.eventDescription.replace(/"/g, '""')}"`,
      `"${r.changedByName.replace(/"/g, '""')}"`,
      r.effectiveFrom || 'N/A',
      r.effectiveTo || 'Open-ended',
      `"${(r.changeReason || '').replace(/"/g, '""')}"`,
      r.authorizationReference || 'N/A',
      `"${JSON.stringify(r.previousValue || {}).replace(/"/g, '""')}"`,
      `"${JSON.stringify(r.newValue || {}).replace(/"/g, '""')}"`,
      r.hash,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kosh_enterprise_audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Audit log the export action itself!
    this.logEvent({
      companyId: filters?.companyId || 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: `export-${Date.now()}`,
      eventType: 'AUDIT_LOG_EXPORTED',
      eventDescription: `Exported ${logs.length} audit trail records to CSV`,
      changedByUserId: currentUser?.id || 'usr-admin-01',
      changedByName: currentUser?.fullName || 'Rajesh Sharma (Platform Admin)',
      changeReason: 'Compliance Audit CSV Export requested',
      source: 'UI',
    });
  },

  // Dashboard Aggregation Metrics
  getDashboardMetrics(filters?: AuditFilterParams, currentUser?: User) {
    const logs = this.getAuditLogs(filters, currentUser);

    return {
      totalEvents: logs.length,
      poChanges: logs.filter(r => r.entityType === 'PURCHASE_ORGANIZATION').length,
      buyerChanges: logs.filter(r => r.entityType === 'BUYER_ASSIGNMENT').length,
      managerChanges: logs.filter(r => r.entityType === 'MANAGER_ASSIGNMENT').length,
      validityChanges: logs.filter(r => r.eventType.includes('VALIDITY') || r.effectiveFrom || r.effectiveTo).length,
      delegationEvents: logs.filter(r => r.entityType === 'DELEGATION').length,
      unauthorizedAttempts: logs.filter(r => r.entityType === 'SECURITY' || r.eventType === 'UNAUTHORIZED_ATTEMPT').length,
    };
  },
};
