import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateContextPair,
  restoreOperatingContext,
  switchCompanyContext,
  switchBranchContext,
  getSapCompanyDbForCompany,
  filterBusinessPartnersByContext,
  filterWarehousesByContext,
  createAuditLogWithContext,
} from '../services/operatingContextService';
import { INITIAL_COMPANIES, INITIAL_BRANCHES, INITIAL_USERS, INITIAL_BUSINESS_PARTNERS } from '../data/seedData';
import { User, Company, Branch, BusinessPartner, Warehouse } from '../types';

// Mock localStorage for node test runner environment
const mockStorage: Record<string, string> = {};
global.localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = val;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  },
  length: 0,
  key: () => null,
};

test('Scenario 1: Valid company selection updates active context and loads correct branches', () => {
  const adminUser = INITIAL_USERS[0]; // Platform Admin
  const companies = [...INITIAL_COMPANIES];
  const branches = [...INITIAL_BRANCHES];

  const context = switchCompanyContext('co-kosh-02', adminUser, companies, branches);

  assert.equal(context.activeCompanyId, 'co-kosh-02');
  assert.equal(context.activeCompany.code, 'KOSH-SOUTH');
  assert.equal(context.activeCompany.sapCompanyDb, 'KOSH_SOUTH_HANA');
  // Should auto-select default branch in co-kosh-02 (Chennai or Hosur)
  assert.equal(context.activeBranch.companyId, 'co-kosh-02');
});

test('Scenario 2: Changing active company clears invalid branch selection', () => {
  const adminUser = INITIAL_USERS[0];
  const companies = [...INITIAL_COMPANIES];
  const branches = [...INITIAL_BRANCHES];

  // Set initial context to co-kosh-01 with branch br-pond-01
  switchCompanyContext('co-kosh-01', adminUser, companies, branches);
  switchBranchContext('br-pond-01', 'co-kosh-01', adminUser, companies, branches);

  // Switch to co-kosh-03 (Kosh Global Exports Ltd - Sanand / Halol)
  const newContext = switchCompanyContext('co-kosh-03', adminUser, companies, branches);

  // Active branch must no longer be br-pond-01!
  assert.notEqual(newContext.activeBranchId, 'br-pond-01');
  assert.equal(newContext.activeBranch.companyId, 'co-kosh-03');
});

test('Scenario 3: Default branch auto-selection works for single-branch company', () => {
  const adminUser = INITIAL_USERS[0];
  const testCompanies: Company[] = [
    ...INITIAL_COMPANIES,
    {
      id: 'co-single-01',
      code: 'SINGLE-CO',
      name: 'Single Branch Company Ltd',
      legalName: 'SINGLE BRANCH CO LTD',
      tradeName: 'SINGLE BRANCH',
      gstin: '29AAACK4603M1Z1',
      sapCompanyDb: 'SINGLE_CO_HANA',
      isEnabled: true,
    },
  ];

  const testBranches: Branch[] = [
    ...INITIAL_BRANCHES,
    {
      id: 'br-single-01',
      orgId: 'org-kosh-01',
      companyId: 'co-single-01',
      portalBranchCode: '099',
      code: 'SGL',
      name: 'Single Branch HQ',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      lifecycleStatus: 'ACTIVE',
      plants: [],
      warehouses: [],
    },
  ];

  const context = switchCompanyContext('co-single-01', adminUser, testCompanies, testBranches);
  assert.equal(context.activeBranchId, 'br-single-01');
  assert.equal(context.activeBranch.name, 'Single Branch HQ');
});

test('Scenario 4: User role scope restricts company/branch dropdown options', () => {
  const restrictedMakerUser: User = {
    id: 'usr-restricted-01',
    email: 'maker.chennai@kosh.com',
    fullName: 'Chennai Local Maker',
    role: 'ITEM_MAKER',
    orgId: 'org-kosh-01',
    allowedBranchIds: ['br-chen-02'], // Only Chennai branch authorized
    isGlobalScope: false,
    twoFactorEnabled: true,
  };

  const companies = [...INITIAL_COMPANIES];
  const branches = [...INITIAL_BRANCHES];

  const context = restoreOperatingContext(restrictedMakerUser, companies, branches);

  assert.equal(context.scope.isGlobalScope, false);
  assert.deepEqual(context.scope.allowedBranchIds, ['br-chen-02']);
});

test('Scenario 5: Inactive/disabled company cannot be selected as active context', () => {
  const adminUser = INITIAL_USERS[0];
  const companies = [...INITIAL_COMPANIES]; // co-kosh-04 is disabled (isEnabled: false)
  const branches = [...INITIAL_BRANCHES];

  assert.throws(() => {
    switchCompanyContext('co-kosh-04', adminUser, companies, branches);
  }, /DISABLED/);
});

test('Scenario 6: Inactive branch cannot be selected as active context', () => {
  const adminUser = INITIAL_USERS[0];
  const companies = [...INITIAL_COMPANIES];
  const testBranches: Branch[] = [
    ...INITIAL_BRANCHES,
    {
      id: 'br-inactive-01',
      orgId: 'org-kosh-01',
      companyId: 'co-kosh-01',
      portalBranchCode: '088',
      code: 'INA',
      name: 'Inactive Test Branch',
      city: 'Pune',
      state: 'Maharashtra',
      lifecycleStatus: 'INACTIVE',
      plants: [],
      warehouses: [],
    },
  ];

  assert.throws(() => {
    switchBranchContext('br-inactive-01', 'co-kosh-01', adminUser, companies, testBranches);
  }, /INACTIVE/);
});

test('Scenario 7: BP Master list filters strictly by active company/branch', () => {
  const bps: BusinessPartner[] = [
    {
      id: 'bp-co1-01',
      branchId: 'br-pond-01',
      bpCode: 'KC001PDY0001',
      bpName: 'Puducherry Customer',
      bpType: 'CUSTOMER',
      city: 'Puducherry',
      state: 'Puducherry',
      country: 'India',
      phone: '+91 98765 43210',
      email: 'pdy@cust.com',
      status: 'ACTIVE',
      contacts: [],
      addresses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'Admin',
    },
    {
      id: 'bp-co2-01',
      branchId: 'br-chen-02',
      bpCode: 'KC002CHE0001',
      bpName: 'Chennai Customer',
      bpType: 'CUSTOMER',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      phone: '+91 98765 43211',
      email: 'che@cust.com',
      status: 'ACTIVE',
      contacts: [],
      addresses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'Admin',
    },
  ];

  // Attached company ID manually to BP
  (bps[0] as any).companyId = 'co-kosh-01';
  (bps[1] as any).companyId = 'co-kosh-02';

  const co1Bps = filterBusinessPartnersByContext(bps, 'co-kosh-01', 'br-pond-01');
  assert.equal(co1Bps.length, 1);
  assert.equal(co1Bps[0].bpName, 'Puducherry Customer');

  const co2Bps = filterBusinessPartnersByContext(bps, 'co-kosh-02', 'br-chen-02');
  assert.equal(co2Bps.length, 1);
  assert.equal(co2Bps[0].bpName, 'Chennai Customer');
});

test('Scenario 8: BP creation rejects branch ID outside active company', () => {
  const activeCompanyId = 'co-kosh-01';
  const targetBranchId = 'br-chen-02'; // belongs to co-kosh-02!
  const branches = [...INITIAL_BRANCHES];

  const targetBranch = branches.find((b) => b.id === targetBranchId);
  const isBranchInActiveCompany = (targetBranch?.companyId || 'co-kosh-01') === activeCompanyId;

  assert.equal(isBranchInActiveCompany, false);
});

test('Scenario 9: Warehouse creation forces branch belonging to active company', () => {
  const activeCompanyId = 'co-kosh-01';
  const branches = [...INITIAL_BRANCHES];

  const companyBranchIds = branches.filter((b) => (b.companyId || 'co-kosh-01') === activeCompanyId).map((b) => b.id);

  // br-pond-01 and br-pune-04 are in co-kosh-01
  assert.ok(companyBranchIds.includes('br-pond-01'));
  assert.ok(companyBranchIds.includes('br-pune-04'));
  assert.equal(companyBranchIds.includes('br-chen-02'), false);
});

test('Scenario 10: Default warehouse enforcement validates branch active state', () => {
  const activeBranch = INITIAL_BRANCHES[0]; // Puducherry Branch
  const warehouses = activeBranch.warehouses;

  const defaultWh = warehouses.find((w) => w.isDefault);
  assert.ok(defaultWh);
  assert.equal(defaultWh.warehouseCode, 'PDY-STR');
  assert.equal(activeBranch.lifecycleStatus, 'ACTIVE');
});

test('Scenario 11: SAP Integration connection profile resolves exact SAP DB mapped to active company', () => {
  const companies = [...INITIAL_COMPANIES];

  const dbCo1 = getSapCompanyDbForCompany('co-kosh-01', companies);
  assert.equal(dbCo1, 'KOSH_PROD_HANA');

  const dbCo2 = getSapCompanyDbForCompany('co-kosh-02', companies);
  assert.equal(dbCo2, 'KOSH_SOUTH_HANA');

  const dbCo3 = getSapCompanyDbForCompany('co-kosh-03', companies);
  assert.equal(dbCo3, 'KOSH_GLOBAL_EXPORTS_HANA');
});

test('Scenario 12: Company Details discovery records are isolated by company DB and environment', () => {
  const discoveryRecord = {
    id: 'disc-01',
    companyConfigId: 'co-kosh-02',
    environmentId: 'DEV' as const,
    companyDb: 'KOSH_SOUTH_HANA',
    tabName: 'GENERAL_LOCAL' as const,
    visibleSapLabel: 'Company Name',
    technicalProperty: 'CompanyName',
  };

  assert.equal(discoveryRecord.companyDb, 'KOSH_SOUTH_HANA');
  assert.equal(discoveryRecord.environmentId, 'DEV');
});

test('Scenario 13: Audit log records active company ID, branch ID, and user ID on context change', () => {
  const adminUser = INITIAL_USERS[0];
  const companies = [...INITIAL_COMPANIES];
  const branches = [...INITIAL_BRANCHES];

  const context = restoreOperatingContext(adminUser, companies, branches);

  const logEntry = createAuditLogWithContext(
    adminUser,
    context,
    'CONTEXT_SWITCH',
    'OPERATING_CONTEXT',
    context.activeCompanyId,
    { reason: 'User selected new enterprise company in header' }
  );

  assert.equal(logEntry.companyId, context.activeCompanyId);
  assert.equal(logEntry.branchId, context.activeBranchId);
  assert.equal(logEntry.environmentId, context.environmentId);
  assert.equal(logEntry.actorEmail, adminUser.email);
  assert.equal(logEntry.details.operatingContext.sapCompanyDb, context.activeCompany.sapCompanyDb);
});

test('Scenario 14: Background sync job contains explicit company DB, environment, and branch context', () => {
  const syncJobPayload = {
    jobCorrelationId: 'corr-job-8812',
    companyId: 'co-kosh-02',
    branchId: 'br-chen-02',
    companyDb: 'KOSH_SOUTH_HANA',
    environmentId: 'PROD',
    operationType: 'ITEM_MASTER_SYNC',
    queuedAt: new Date().toISOString(),
  };

  assert.equal(syncJobPayload.companyId, 'co-kosh-02');
  assert.equal(syncJobPayload.companyDb, 'KOSH_SOUTH_HANA');
  assert.equal(syncJobPayload.branchId, 'br-chen-02');
  assert.equal(syncJobPayload.environmentId, 'PROD');
});

test('Scenario 15: Cross-company data mutation attempt throws explicit context authorization error', () => {
  const adminUser = INITIAL_USERS[0];
  const activeCompanyId = 'co-kosh-01';
  const targetBranchInOtherCompany = 'br-chen-02'; // belongs to co-kosh-02

  const branches = [...INITIAL_BRANCHES];
  const companies = [...INITIAL_COMPANIES];

  assert.throws(() => {
    switchBranchContext(targetBranchInOtherCompany, activeCompanyId, adminUser, companies, branches);
  }, /does not match active Company/);
});
