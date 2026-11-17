import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { userRoleAdminService } from '../services/userRoleAdminService';
import { mobileConsentService } from '../services/mobileConsentService';

const ADMIN_ACTOR = { id: 'usr-admin-01', name: 'Rajesh Sharma' };

describe('Employee Association Lifecycle & Mobile Personal Consent Governance', () => {
  beforeEach(() => {
    userRoleAdminService.resetForTesting();
    mobileConsentService.resetForTesting();
  });

  it('keeps Employee Association Status independent from Account Status and enforces offboarding + non-auto-restore Reassociation', () => {
    const user = userRoleAdminService.createUser(
      {
        username: 'rohit.plant',
        email: 'rohit.plant@koshinnovations.com',
        firstName: 'Rohit',
        lastName: 'Verma',
        employeeId: 'EMP-801',
        role: 'ITEM_MAKER',
        defaultCompanyId: 'co-kosh-01',
        defaultBranchId: 'br-pond-01',
        countryCode: '+91',
        mobilePhone: '9840199881',
        mobileNumberType: 'OFFICIAL',
      },
      ADMIN_ACTOR
    );

    assert.equal(user.employeeAssociationStatus, 'ASSOCIATED');
    assert.equal(user.status, 'ACTIVE');

    // Account Deactivate/Reactivate while remaining ASSOCIATED
    const deactivated = userRoleAdminService.deactivateUser(user.id, 'Temporary leave deactivation', ADMIN_ACTOR);
    assert.equal(deactivated.status, 'DEACTIVATED');
    assert.equal(deactivated.employeeAssociationStatus, 'ASSOCIATED');

    const reactivated = userRoleAdminService.reactivateUser(user.id, 'Returned from leave', ADMIN_ACTOR);
    assert.equal(reactivated.status, 'ACTIVE');
    assert.equal(reactivated.employeeAssociationStatus, 'ASSOCIATED');

    // Grant an extra role assignment before marking Not Associated
    const checkerRole = userRoleAdminService.getRoleByCode('ITEM_CHECKER')!;
    const makerRole = userRoleAdminService.getRoleByCode('ITEM_MAKER')!;
    userRoleAdminService.assignUserRole(
      {
        userId: user.id,
        roleId: checkerRole.id,
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
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
        isDefaultContext: false,
        effectiveFrom: '2026-11-01',
        reason: 'Pre-exit secondary checker role',
      },
      ADMIN_ACTOR
    );

    const sess = userRoleAdminService.createSessionForUser(reactivated);
    const notAssoc = userRoleAdminService.markEmployeeNotAssociated(
      user.id,
      {
        effectiveDate: '2026-11-15',
        reason: 'Employee resigned and completed exit clearance',
        approvalReference: 'HR-EXIT-801',
      },
      ADMIN_ACTOR
    );

    assert.equal(notAssoc.employeeAssociationStatus, 'NOT_ASSOCIATED');
    assert.equal(notAssoc.status, 'DEACTIVATED');
    assert.equal(userRoleAdminService.isSessionValid(sess.sessionTokenId), false);

    // Direct reactivation, unlock, repeat Not Associated, and SMS/WhatsApp dispatch are all blocked
    assert.throws(() => {
      userRoleAdminService.reactivateUser(user.id, 'Bypass attempt', ADMIN_ACTOR);
    }, /Not Associated/i);
    assert.throws(() => {
      userRoleAdminService.unlockUser(user.id, 'Bypass unlock', ADMIN_ACTOR);
    }, /Not Associated/i);
    assert.throws(() => {
      userRoleAdminService.markEmployeeNotAssociated(
        user.id,
        { effectiveDate: '2026-11-16', reason: 'Duplicate exit attempt' },
        ADMIN_ACTOR
      );
    }, /already marked Not Associated/i);

    const blockedMsg = mobileConsentService.evaluateCommunicationDispatch({
      targetUserId: user.id,
      channel: 'SMS',
      purpose: 'OPERATIONAL_BUSINESS',
      actor: ADMIN_ACTOR,
    });
    assert.equal(blockedMsg.allowed, false);
    assert.equal(blockedMsg.blockedCode, 'EMPLOYEE_NOT_ASSOCIATED');

    // Authorized Reassociation provisions ONLY the newly approved role (READ_ONLY_USER); prior REVOKED roles stay REVOKED
    const readOnlyRole = userRoleAdminService.getRoleByCode('READ_ONLY_USER')!;
    assert.throws(() => {
      userRoleAdminService.reassociateEmployee(
        user.id,
        {
          effectiveDate: '2026-12-01',
          companyId: 'co-kosh-01',
          branchId: 'br-pond-01',
          employeeId: 'EMP-801-R',
          employeeRelationshipValidated: true,
          roleId: readOnlyRole.id,
          approvalReference: 'HR-REHIRE-801',
          approvedByUserId: ADMIN_ACTOR.id, // Maker-Checker violation: same as actor
          approvedByName: ADMIN_ACTOR.name,
          reason: 'Rejoined operations team',
        },
        ADMIN_ACTOR
      );
    }, /Maker-Checker/i);

    const reassociated = userRoleAdminService.reassociateEmployee(
      user.id,
      {
        effectiveDate: '2026-12-01',
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        employeeId: 'EMP-801-R',
        employeeRelationshipValidated: true,
        roleId: readOnlyRole.id,
        approvalReference: 'HR-REHIRE-801',
        approvedByUserId: 'usr-checker-03',
        approvedByName: 'Venkatesh Iyer',
        reason: 'Rejoined operations team under least-privilege role',
      },
      ADMIN_ACTOR
    );

    assert.equal(reassociated.employeeAssociationStatus, 'ASSOCIATED');
    assert.equal(reassociated.status, 'ACTIVE');
    assert.equal(reassociated.role, 'READ_ONLY_USER');

    const userAssignments = userRoleAdminService.getAssignments().filter((a) => a.userId === user.id);
    const activeRoles = userAssignments.filter((a) => a.status === 'ACTIVE').map((a) => a.roleCode);
    const revokedMaker = userAssignments.find((a) => a.roleId === makerRole.id && a.status === 'REVOKED');
    const revokedChecker = userAssignments.find((a) => a.roleId === checkerRole.id && a.status === 'REVOKED');
    assert.deepEqual(activeRoles, ['READ_ONLY_USER']);
    assert.ok(revokedMaker, 'Prior ITEM_MAKER assignment must remain REVOKED');
    assert.ok(revokedChecker, 'Prior ITEM_CHECKER assignment must remain REVOKED');

    const assocHist = userRoleAdminService.getAssociationHistory(user.id);
    assert.equal(assocHist.length, 2);
    assert.equal(assocHist[0].newStatus, 'ASSOCIATED');
    assert.equal(assocHist[1].newStatus, 'NOT_ASSOCIATED');
  });

  it('enforces Official vs Personal mobile consent, anti-admin-grant guard, independent OTP verification, masking, withdrawal & number change reset', () => {
    // 1. Official mobile needs no personal consent and allows SMS/WhatsApp
    const officialUser = userRoleAdminService.createUser(
      {
        username: 'sita.official',
        email: 'sita.official@koshinnovations.com',
        firstName: 'Sita',
        lastName: 'Menon',
        countryCode: '+91',
        mobilePhone: '9840111222',
        mobileNumberType: 'OFFICIAL',
      },
      ADMIN_ACTOR
    );
    assert.equal(officialUser.mobileConsentStatus, 'NOT_REQUIRED_OFFICIAL');
    assert.equal(
      mobileConsentService.evaluateCommunicationDispatch({
        targetUserId: officialUser.id,
        channel: 'SMS',
        purpose: 'OPERATIONAL_BUSINESS',
        actor: ADMIN_ACTOR,
      }).allowed,
      true
    );

    // 2. Admin and bulk import are strictly blocked from pre-granting Personal Mobile Consent
    assert.throws(() => {
      userRoleAdminService.createUser(
        {
          username: 'admin.override.try',
          email: 'override@koshinnovations.com',
          firstName: 'Override',
          lastName: 'Try',
          countryCode: '+91',
          mobilePhone: '9840111333',
          mobileNumberType: 'PERSONAL',
          mobileConsentStatus: 'CONSENT_GRANTED',
        },
        ADMIN_ACTOR
      );
    }, /Consent governance violation/i);

    const bulkPreview = userRoleAdminService.previewBulkUserImport([
      {
        username: 'bulk.override',
        email: 'bulk.override@koshinnovations.com',
        firstName: 'Bulk',
        lastName: 'Override',
        defaultCompanyCode: 'KOSH-HQ',
        defaultBranchCode: 'PDY',
        roleCode: 'ITEM_MAKER',
        countryCode: '+91',
        mobilePhone: '9840111444',
        mobileNumberType: 'PERSONAL',
        mobileConsentStatus: 'CONSENT_GRANTED',
      },
    ]);
    assert.equal(bulkPreview[0].isValid, false);

    // 3. Valid Personal mobile starts PENDING_EMPLOYEE_CONSENT and blocks SMS/WhatsApp
    const personalUser = userRoleAdminService.createUser(
      {
        username: 'kavitha.personal',
        email: 'kavitha.personal@koshinnovations.com',
        firstName: 'Kavitha',
        lastName: 'Sundaram',
        countryCode: '+91',
        mobilePhone: '9840177889',
        mobileNumberType: 'PERSONAL',
      },
      ADMIN_ACTOR
    );
    assert.equal(personalUser.mobileConsentStatus, 'PENDING_EMPLOYEE_CONSENT');
    assert.equal(personalUser.mobileVerificationStatus, 'NOT_VERIFIED');

    const preConsentBlock = mobileConsentService.evaluateCommunicationDispatch({
      targetUserId: personalUser.id,
      channel: 'WHATSAPP',
      purpose: 'WHATSAPP_NOTIFICATIONS',
      actor: ADMIN_ACTOR,
    });
    assert.equal(preConsentBlock.allowed, false);
    assert.equal(preConsentBlock.blockedCode, 'PERSONAL_CONSENT_REQUIRED');

    // 4. OTP verification succeeds independently and NEVER mutates consent status
    const otp = mobileConsentService.initiateMobileOtp(personalUser.id, ADMIN_ACTOR);
    const verified = mobileConsentService.confirmMobileOtp(personalUser.id, otp.previewOtpCode, {
      id: personalUser.id,
      name: personalUser.fullName,
    });
    assert.equal(verified.verified, true);
    assert.equal(verified.user.mobileVerificationStatus, 'VERIFIED');
    assert.equal(verified.user.mobileConsentStatus, 'PENDING_EMPLOYEE_CONSENT');

    // 5. Admin cannot submit employee self-service consent decision
    assert.throws(() => {
      mobileConsentService.submitEmployeeConsentDecision({
        targetUserId: personalUser.id,
        decision: 'GRANT',
        approvedPurposes: ['SECURITY_AUTH', 'SMS_NOTIFICATIONS'],
        actor: ADMIN_ACTOR,
      });
    }, /Employee Self-Service Only/i);

    // 6. Employee grants consent ONLY for selected purposes
    const granted = mobileConsentService.submitEmployeeConsentDecision({
      targetUserId: personalUser.id,
      decision: 'GRANT',
      approvedPurposes: ['SECURITY_AUTH', 'SMS_NOTIFICATIONS'],
      actor: { id: personalUser.id, name: personalUser.fullName },
    });
    assert.equal(granted.user.mobileConsentStatus, 'CONSENT_GRANTED');

    assert.equal(
      mobileConsentService.evaluateCommunicationDispatch({
        targetUserId: personalUser.id,
        channel: 'SMS',
        purpose: 'SMS_NOTIFICATIONS',
        actor: ADMIN_ACTOR,
      }).allowed,
      true
    );
    const unconsentedPurpose = mobileConsentService.evaluateCommunicationDispatch({
      targetUserId: personalUser.id,
      channel: 'WHATSAPP',
      purpose: 'WHATSAPP_NOTIFICATIONS',
      actor: ADMIN_ACTOR,
    });
    assert.equal(unconsentedPurpose.allowed, false);
    assert.equal(unconsentedPurpose.blockedCode, 'PURPOSE_NOT_CONSENTED');

    // 7. Masking: personal number masked by default for other viewers, unmasked to self
    const viewerOther = userRoleAdminService.getUserById('usr-maker-02')!;
    const maskedForOther = mobileConsentService.formatMobileForViewer(granted.user, viewerOther, true);
    assert.equal(maskedForOther.isMasked, true);
    assert.ok(maskedForOther.display.includes('*'));

    const selfView = mobileConsentService.formatMobileForViewer(granted.user, granted.user, false);
    assert.equal(selfView.isMasked, false);
    assert.equal(selfView.display, '+91 9840177889');

    // 8. Changing personal mobile number resets consent & archives old number
    const changed = mobileConsentService.employeeChangeMobileContact({
      targetUserId: personalUser.id,
      countryCode: '+91',
      mobilePhone: '9840199999',
      mobileNumberType: 'PERSONAL',
      actor: { id: personalUser.id, name: personalUser.fullName },
      reason: 'Switched SIM carrier',
    });
    assert.equal(changed.consentResetRequired, true);
    assert.equal(changed.user.mobileConsentStatus, 'PENDING_EMPLOYEE_CONSENT');
    assert.equal(changed.user.mobileVerificationStatus, 'NOT_VERIFIED');
    assert.equal(mobileConsentService.getNumberHistory(personalUser.id).length, 1);

    // 9. Employee grants again then withdraws -> blocked immediately
    mobileConsentService.submitEmployeeConsentDecision({
      targetUserId: personalUser.id,
      decision: 'GRANT',
      approvedPurposes: ['SMS_NOTIFICATIONS'],
      actor: { id: personalUser.id, name: personalUser.fullName },
    });
    const withdrawn = mobileConsentService.withdrawEmployeeConsent({
      targetUserId: personalUser.id,
      reason: 'Prefer corporate email only going forward',
      actor: { id: personalUser.id, name: personalUser.fullName },
    });
    assert.equal(withdrawn.user.mobileConsentStatus, 'CONSENT_WITHDRAWN');
    const postWithdrawBlock = mobileConsentService.evaluateCommunicationDispatch({
      targetUserId: personalUser.id,
      channel: 'SMS',
      purpose: 'SMS_NOTIFICATIONS',
      actor: ADMIN_ACTOR,
    });
    assert.equal(postWithdrawBlock.allowed, false);
    assert.equal(postWithdrawBlock.blockedCode, 'PERSONAL_CONSENT_WITHDRAWN');

    // 10. Permission Registry CI Gate passes
    const sync = userRoleAdminService.synchronizePermissionRegistry(ADMIN_ACTOR);
    assert.equal(sync.ciGatePassed, true);
  });
});
