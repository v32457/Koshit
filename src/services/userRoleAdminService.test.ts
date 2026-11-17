import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_REPORT_CATALOG,
  userRoleAdminService,
} from './userRoleAdminService';
import { rbacPermissionService } from './rbacPermissionService';

const ADMIN_ACTOR = { id: 'usr-admin-01', name: 'Rajesh Sharma' };
const MAKER_ACTOR = { id: 'usr-maker-02', name: 'Ananya Deshmukh' };

describe('userRoleAdminService — Centralized Identity, RBAC, Registry, Scope & Governance', () => {
  beforeEach(() => {
    userRoleAdminService.resetForTesting();
  });

  it('creates users with salted password hashing, blocks duplicate username/email, and preserves history on termination', () => {
    const created = userRoleAdminService.createUser(
      {
        username: 'kavya.buyer',
        email: 'kavya.buyer@koshinnovations.com',
        firstName: 'Kavya',
        lastName: 'Rao',
        employeeId: 'EMP-901',
        role: 'ITEM_MAKER',
        defaultCompanyId: 'co-kosh-01',
        defaultBranchId: 'br-pond-01',
        initialPassword: 'KoshSecure#2026',
      },
      ADMIN_ACTOR
    );

    assert.equal(created.status, 'ACTIVE');
    assert.ok(created.passwordHash && !created.passwordHash.includes('KoshSecure#2026'));

    assert.throws(() => {
      userRoleAdminService.createUser(
        {
          username: 'kavya.buyer',
          email: 'other@koshinnovations.com',
          firstName: 'Dup',
          lastName: 'User',
        },
        ADMIN_ACTOR
      );
    }, /Duplicate username/i);

    assert.throws(() => {
      userRoleAdminService.createUser(
        {
          username: 'other.buyer',
          email: 'kavya.buyer@koshinnovations.com',
          firstName: 'Dup',
          lastName: 'Email',
        },
        ADMIN_ACTOR
      );
    }, /Duplicate email/i);

    // Create active session then mark employee Not Associated -> session revoked, account deactivated, history preserved
    const sess = userRoleAdminService.createSessionForUser(created);
    assert.equal(userRoleAdminService.isSessionValid(sess.sessionTokenId), true);

    const notAssociated = userRoleAdminService.markEmployeeNotAssociated(
      created.id,
      {
        effectiveDate: '2026-11-15',
        reason: 'Employee resignation processed cleanly',
        approvalReference: 'HR-EXIT-2026-01',
      },
      ADMIN_ACTOR
    );
    assert.equal(notAssociated.employeeAssociationStatus, 'NOT_ASSOCIATED');
    assert.equal(notAssociated.status, 'DEACTIVATED');
    assert.equal(userRoleAdminService.isSessionValid(sess.sessionTokenId), false);
    assert.ok(userRoleAdminService.getUserById(created.id), 'Not Associated user record must remain preserved');
  });

  it('validates bulk user import preview and commits only valid non-admin rows', () => {
    const preview = userRoleAdminService.previewBulkUserImport([
      {
        username: 'valid.batch1',
        email: 'valid.batch1@koshinnovations.com',
        firstName: 'Valid',
        lastName: 'Batch',
        userType: 'EMPLOYEE',
        employeeId: 'EMP-501',
        defaultCompanyCode: 'KOSH-HQ',
        defaultBranchCode: 'PDY',
        roleCode: 'ITEM_MAKER',
      },
      {
        username: 'bad.super',
        email: 'bad.super@koshinnovations.com',
        firstName: 'Bad',
        lastName: 'Super',
        userType: 'ADMINISTRATOR',
        defaultCompanyCode: 'KOSH-HQ',
        defaultBranchCode: 'PDY',
        roleCode: 'PLATFORM_ADMIN',
      },
    ]);

    assert.equal(preview[0].isValid, true);
    assert.equal(preview[1].isValid, false);

    const committed = userRoleAdminService.commitBulkUserImport(preview, ADMIN_ACTOR);
    assert.equal(committed.createdCount, 1);
    assert.equal(committed.failedCount, 1);
    assert.equal(committed.createdUsers[0].status, 'PENDING_ACTIVATION');
  });

  it('supports role hierarchy inheritance, explicit restrictions, circular inheritance guard, and protected system role deletion block', () => {
    const baseRole = userRoleAdminService.createRole(
      {
        roleCode: 'BASE_BUYER',
        roleName: 'Base Buyer',
        description: 'Base procurement view and PR creation',
        category: 'CUSTOM_ROLE',
        explicitPermissionCodes: [
          'PROCUREMENT.PURCHASE_REQUISITION.VIEW',
          'PROCUREMENT.PURCHASE_REQUISITION.CREATE',
        ],
      },
      ADMIN_ACTOR
    );

    const childRole = userRoleAdminService.createRole(
      {
        roleCode: 'SENIOR_BUYER',
        roleName: 'Senior Buyer',
        description: 'Inherits base buyer, adds export, restricts create',
        category: 'CUSTOM_ROLE',
        parentRoleId: baseRole.id,
        explicitPermissionCodes: ['PROCUREMENT.PURCHASE_REQUISITION.EXPORT'],
        restrictedPermissionCodes: ['PROCUREMENT.PURCHASE_REQUISITION.CREATE'],
      },
      ADMIN_ACTOR
    );

    const eff = userRoleAdminService.getEffectiveRolePermissions(childRole.id);
    assert.ok(eff.effectivePermissions.includes('PROCUREMENT.PURCHASE_REQUISITION.VIEW'));
    assert.ok(eff.effectivePermissions.includes('PROCUREMENT.PURCHASE_REQUISITION.EXPORT'));
    assert.ok(!eff.effectivePermissions.includes('PROCUREMENT.PURCHASE_REQUISITION.CREATE'));

    // Circular inheritance must be blocked
    assert.throws(() => {
      userRoleAdminService.updateRole(
        baseRole.id,
        { parentRoleId: childRole.id },
        'Attempt circular loop',
        ADMIN_ACTOR
      );
    }, /Circular role inheritance/i);

    // Protected system role deletion must be blocked
    const sysSuper = userRoleAdminService.getRoleByCode('PLATFORM_ADMIN')!;
    assert.throws(() => {
      userRoleAdminService.deleteRole(sysSuper.id, 'Attempt delete super admin', ADMIN_ACTOR);
    }, /Protected system role/i);

    // Clone role works cleanly
    const cloned = userRoleAdminService.cloneRole(childRole.id, 'SENIOR_BUYER_V2', 'Senior Buyer V2', ADMIN_ACTOR);
    assert.equal(cloned.roleCode, 'SENIOR_BUYER_V2');
  });

  it('auto-registers new module/feature permissions as DENY-BY-DEFAULT, generates Role-Impact Proposal, and requires explicit approval', () => {
    const reg = userRoleAdminService.registerModuleFeaturePermissions(
      {
        moduleCode: 'SUPPLIER_RISK',
        moduleName: 'Supplier Risk & ESG',
        routeReference: '/procurement/supplier-risk',
        apiNamespace: '/api/supplier-risk',
        featureCode: 'ESG_AUDIT',
        featureName: 'Vendor ESG Audit',
        relatedApi: '/api/supplier-risk/esg',
        actions: ['VIEW', 'APPROVE'],
      },
      ADMIN_ACTOR
    );

    assert.equal(reg.registeredPermissions.length, 2);
    assert.equal(reg.roleImpactProposals.length, 2);

    const newPerm = 'SUPPLIER_RISK.ESG_AUDIT.APPROVE';
    // Operational & checker roles MUST NOT be auto-granted
    const checkBefore = userRoleAdminService.evaluateAuthorization({
      userId: 'usr-checker-03',
      permissionCode: newPerm,
    });
    assert.equal(checkBefore.allowed, false);
    assert.equal(checkBefore.denialCode, 'PERMISSION_DENIED');

    // Explicit approval grants cleanly and invalidates cache
    const checkerRole = userRoleAdminService.getRoleByCode('ITEM_CHECKER')!;
    const approved = userRoleAdminService.approveRoleImpactGrant(
      { permissionCode: newPerm, targetRoleIds: [checkerRole.id], reason: 'Approved ESG auditor signoff' },
      ADMIN_ACTOR
    );
    assert.deepEqual(approved.grantedRoles, ['ITEM_CHECKER']);

    const checkAfter = userRoleAdminService.evaluateAuthorization({
      userId: 'usr-checker-03',
      permissionCode: newPerm,
      companyId: 'co-kosh-01',
    });
    assert.equal(checkAfter.allowed, true);

    const syncReport = userRoleAdminService.synchronizePermissionRegistry(ADMIN_ACTOR);
    assert.equal(syncReport.ciGatePassed, true);
  });

  it('enforces 10-step deny-by-default authorization: unregistered perm, cross-company, maker-checker, and cache invalidation', () => {
    // 1. Unregistered permission rejected
    const unreg = userRoleAdminService.evaluateAuthorization({
      userId: 'usr-admin-01',
      permissionCode: 'NONEXISTENT.FAKE.VIEW',
    });
    assert.equal(unreg.allowed, false);
    assert.equal(unreg.denialCode, 'PERMISSION_UNREGISTERED');

    // 2. Cross-company rejected for branch-scoped maker
    const crossCompany = userRoleAdminService.evaluateAuthorization({
      userId: 'usr-maker-02',
      permissionCode: 'PROCUREMENT.PURCHASE_REQUISITION.CREATE',
      companyId: 'co-kosh-03',
    });
    assert.equal(crossCompany.allowed, false);
    assert.equal(crossCompany.denialCode, 'ORG_SCOPE_DENIED');

    // 3. Maker-Checker blocks approving own transaction even if role allows APPROVE
    const selfApprove = userRoleAdminService.evaluateAuthorization({
      userId: 'usr-checker-03',
      permissionCode: 'PROCUREMENT.PURCHASE_REQUISITION.APPROVE',
      companyId: 'co-kosh-01',
      actionType: 'APPROVE',
      transactionCreatorUserId: 'usr-checker-03',
    });
    assert.equal(selfApprove.allowed, false);
    assert.equal(selfApprove.denialCode, 'MAKER_CHECKER_VIOLATION');

    // 4. Unified rbacPermissionService bridge reflects override revocation immediately
    assert.equal(
      rbacPermissionService.hasPermission(
        userRoleAdminService.getUserById('usr-maker-02'),
        'PR_AGING_VIEW'
      ),
      true
    );
    rbacPermissionService.setUserPermissionOverride('usr-maker-02', 'PR_AGING_VIEW', 'REVOKE', ADMIN_ACTOR);
    assert.equal(
      rbacPermissionService.hasPermission(
        userRoleAdminService.getUserById('usr-maker-02'),
        'PR_AGING_VIEW'
      ),
      false
    );
  });

  it('enforces multi-stage Access Request workflow, blocks self-approval, and requires rejection reason', () => {
    const checkerRole = userRoleAdminService.getRoleByCode('ITEM_CHECKER')!;
    const req = userRoleAdminService.submitAccessRequest({
      requesterUserId: MAKER_ACTOR.id,
      targetUserId: MAKER_ACTOR.id,
      requestType: 'ADDITIONAL_PERMISSION',
      requestedRoleId: checkerRole.id,
      requestedPermissionCodes: ['PROCUREMENT.PURCHASE_REQUISITION.APPROVE'],
      requestedScope: {
        companyIds: ['co-kosh-01'],
        branchIds: ['br-pond-01'],
        businessUnitIds: [],
        departmentIds: [],
        purchaseOrgIds: [],
        purchaseGroupIds: [],
        salesOrgIds: [],
        warehouseIds: [],
        locationCodes: [],
        costCentreIds: [],
        projectIds: [],
        dataScopeLevel: 'BRANCH_RECORDS',
      },
      isTemporary: true,
      validFrom: '2026-11-01',
      validTo: '2026-12-31',
      justification: 'Year-end backup approval coverage',
    });

    assert.equal(req.status, 'PENDING_MANAGER');

    // Self-approval must fail
    assert.throws(() => {
      userRoleAdminService.actOnAccessRequest(req.id, 'APPROVE', {}, MAKER_ACTOR);
    }, /Maker-Checker violation/i);

    // Rejection without reason fails
    assert.throws(() => {
      userRoleAdminService.actOnAccessRequest(req.id, 'REJECT', { rejectionReason: 'no' }, ADMIN_ACTOR);
    }, /Mandatory rejection reason/i);

    // 3-stage approval completes cleanly and provisions temporary access
    const s1 = userRoleAdminService.actOnAccessRequest(req.id, 'APPROVE', { comments: 'Manager OK' }, { id: 'usr-checker-03', name: 'Venkatesh Iyer' });
    assert.equal(s1.status, 'PENDING_DATA_OWNER');
    const s2 = userRoleAdminService.actOnAccessRequest(req.id, 'APPROVE', { comments: 'Owner OK' }, { id: 'usr-sap-04', name: 'Karthik Raman' });
    assert.equal(s2.status, 'PENDING_SECURITY_ADMIN');
    const s3 = userRoleAdminService.actOnAccessRequest(req.id, 'APPROVE', { comments: 'SecAdmin OK' }, ADMIN_ACTOR);
    assert.equal(s3.status, 'APPROVED');
  });

  it('auto-expires temporary access on sweep and enforces delegation scope ceiling', () => {
    const granted = userRoleAdminService.grantTemporaryAccess(
      {
        userId: 'usr-maker-02',
        grantType: 'TEMPORARY_PERMISSION',
        permissionCodes: ['AUDIT.LOGS.VIEW'],
        scope: {
          companyIds: ['co-kosh-01'],
          branchIds: ['br-pond-01'],
          businessUnitIds: [],
          departmentIds: [],
          purchaseOrgIds: [],
          purchaseGroupIds: [],
          salesOrgIds: [],
          warehouseIds: [],
          locationCodes: [],
          costCentreIds: [],
          projectIds: [],
          dataScopeLevel: 'BRANCH_RECORDS',
        },
        validFrom: '2026-01-01',
        validTo: '2026-10-01',
        reason: 'Audit window coverage',
      },
      ADMIN_ACTOR
    );

    // Expired grant is denied immediately in evaluation & marked EXPIRED on sweep
    const evalExpired = userRoleAdminService.evaluateAuthorization({
      userId: 'usr-maker-02',
      permissionCode: 'AUDIT.LOGS.VIEW',
      companyId: 'co-kosh-01',
    });
    assert.equal(evalExpired.allowed, false);

    const sweep = userRoleAdminService.sweepExpiredAccess('2026-11-15T00:00:00Z');
    assert.ok(sweep.expiredTempCount >= 1);
    assert.equal(userRoleAdminService.getTemporaryAccess().find((t) => t.id === granted.id)?.status, 'EXPIRED');

    // Delegation scope ceiling: MAKER cannot delegate APPROVE permission they do not hold
    assert.throws(() => {
      userRoleAdminService.createDelegation(
        {
          delegationType: 'APPROVAL_DELEGATION',
          delegatorUserId: 'usr-maker-02',
          delegateUserId: 'usr-checker-03',
          companyId: 'co-kosh-01',
          branchId: 'br-pond-01',
          delegatedPermissionCodes: ['PROCUREMENT.PURCHASE_REQUISITION.APPROVE'],
          validFrom: '2026-11-01',
          validTo: '2026-11-30',
          reason: 'Out of bounds delegation attempt',
        },
        ADMIN_ACTOR
      );
    }, /Scope ceiling violation/i);
  });

  it('enforces account lockout on failed attempts, Break-Glass Emergency Access bounds, and generates all 25 reports', () => {
    const policy = userRoleAdminService.updateSecurityPolicy(
      { failedLoginThreshold: 3 },
      'Strict 3-strike policy for test',
      ADMIN_ACTOR
    );
    assert.equal(policy.failedLoginThreshold, 3);

    const target = userRoleAdminService.createUser(
      {
        username: 'lock.test',
        email: 'lock.test@koshinnovations.com',
        firstName: 'Lock',
        lastName: 'Tester',
        initialPassword: 'ValidPass#2026',
      },
      ADMIN_ACTOR
    );

    for (let i = 0; i < 3; i++) {
      const attempt = userRoleAdminService.authenticateWithCredentials({
        emailOrUsername: 'lock.test',
        password: 'WrongPassword!1',
      });
      assert.equal(attempt.ok, false);
    }
    assert.equal(userRoleAdminService.getUserById(target.id)?.status, 'LOCKED');

    // Break-Glass requires mandatory min-15-char reason and bounded hours
    assert.throws(() => {
      userRoleAdminService.grantEmergencyAccess(
        { targetUserId: 'usr-checker-03', durationHours: 2, reason: 'short', companyId: 'co-kosh-01' },
        ADMIN_ACTOR
      );
    }, /Mandatory emergency incident reason/i);

    const bg = userRoleAdminService.grantEmergencyAccess(
      {
        targetUserId: 'usr-checker-03',
        durationHours: 4,
        reason: 'INC-2026-991: Emergency P1 supplier settlement recovery',
        companyId: 'co-kosh-01',
      },
      ADMIN_ACTOR
    );
    assert.equal(bg.grantType, 'EMERGENCY_ACCESS');

    // Verify all 25 reports render cleanly
    assert.equal(ACCESS_REPORT_CATALOG.length, 25);
    for (const item of ACCESS_REPORT_CATALOG) {
      const report = userRoleAdminService.getAccessReport(item.key);
      assert.ok(report.title.length > 0);
      assert.ok(report.headers.length >= 4);
      assert.ok(Array.isArray(report.rows));
    }
  });
});
