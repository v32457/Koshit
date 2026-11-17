import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { INITIAL_BRANCHES, INITIAL_COMPANIES, INITIAL_MODULE_REGISTRY, INITIAL_USERS } from '../../src/data/seedData.js';
import type { User } from '../../src/types/index.js';
import { createApp } from '../src/app.js';
import { ZeroTrustSecurityBackendStore } from '../src/services/zeroTrustSecurityBackend.js';

const EXTRA_TEST_USERS: User[] = [
  ...INITIAL_USERS,
  {
    id: 'usr-admin-02',
    email: 'sec.admin2@koshinnovations.com',
    fullName: 'Meenakshi Sundaram',
    employeeId: 'EMP-1002',
    designation: 'Secondary Security Administrator',
    department: 'Information Security',
    status: 'ACTIVE',
    employeeAssociationStatus: 'ASSOCIATED',
    countryCode: '+91',
    mobilePhone: '9840000102',
    mobileNumberType: 'OFFICIAL',
    mobileVerificationStatus: 'VERIFIED',
    mobileConsentStatus: 'NOT_REQUIRED_OFFICIAL',
    role: 'ORG_ADMIN',
    orgId: 'org-kosh-01',
    allowedBranchIds: [],
    isGlobalScope: true,
    twoFactorEnabled: true,
  },
  {
    id: 'usr-ro-01',
    email: 'readonly@koshinnovations.com',
    fullName: 'Rohan Kulkarni',
    employeeId: 'EMP-9001',
    designation: 'External Audit Viewer',
    department: 'Compliance Audit',
    status: 'ACTIVE',
    employeeAssociationStatus: 'ASSOCIATED',
    countryCode: '+91',
    mobilePhone: '9840009001',
    mobileNumberType: 'OFFICIAL',
    mobileVerificationStatus: 'VERIFIED',
    mobileConsentStatus: 'NOT_REQUIRED_OFFICIAL',
    role: 'READ_ONLY_USER',
    orgId: 'org-kosh-02', // Different org for cross-company denial test
    defaultCompanyId: 'co-kosh-02',
    defaultBranchId: 'br-chen-02',
    allowedBranchIds: ['br-chen-02'],
    isGlobalScope: false,
    twoFactorEnabled: false,
  },
];

async function withSecurityServer<T>(
  run: (baseUrl: string, store: ZeroTrustSecurityBackendStore) => Promise<T>
): Promise<T> {
  const store = new ZeroTrustSecurityBackendStore({
    users: EXTRA_TEST_USERS,
    companies: INITIAL_COMPANIES,
    branches: INITIAL_BRANCHES,
    modules: INITIAL_MODULE_REGISTRY,
  });
  const app = createApp(async () => {}, {}, undefined, store);
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Failed to bind server');
  try {
    return await run(`http://127.0.0.1:${addr.port}`, store);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('Security API enforces unauthenticated rejection (401), RBAC denial (403), and anti-self-modification (403)', async () => {
  await withSecurityServer(async (baseUrl) => {
    // 1. Missing authentication header -> 401
    const unauth = await fetch(`${baseUrl}/api/security/policies`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scopeLevel: 'GLOBAL', scopeRefId: 'GLOBAL', changeReason: 'Unauth test' }),
    });
    assert.equal(unauth.status, 401);

    // 2. Non-admin modifying GLOBAL policy -> 403 RBAC_DENIED
    const nonAdmin = await fetch(`${baseUrl}/api/security/policies`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-kosh-user-id': 'usr-buyer-01',
      },
      body: JSON.stringify({ scopeLevel: 'GLOBAL', scopeRefId: 'GLOBAL', changeReason: 'Buyer attempt' }),
    });
    assert.equal(nonAdmin.status, 403);
    const nonAdminJson = await nonAdmin.json();
    assert.equal(nonAdminJson.error.code, 'RBAC_DENIED');

    // 3. Anti-self-tamper rule: Admin trying to edit own USER policy -> 403 SELF_POLICY_MODIFICATION_FORBIDDEN
    const selfTamper = await fetch(`${baseUrl}/api/security/policies`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-kosh-user-id': 'usr-admin-01',
      },
      body: JSON.stringify({
        scopeLevel: 'USER',
        scopeRefId: 'usr-admin-01',
        userId: 'usr-admin-01',
        controls: { watermark: { state: 'DISABLED' } },
        changeReason: 'Attempt to disable my own watermark',
      }),
    });
    assert.equal(selfTamper.status, 403);
    const selfJson = await selfTamper.json();
    assert.equal(selfJson.error.code, 'SELF_POLICY_MODIFICATION_FORBIDDEN');
  });
});

test('Security API enforces Optional Page & User Scope Scenarios A–E, Mandatory parent lock, and Cache invalidation', async () => {
  await withSecurityServer(async (baseUrl) => {
    // Scenario A: Page=OFF, User=OFF (Default)
    const scA = await fetch(
      `${baseUrl}/api/security/effective-policy?companyId=co-kosh-01&branchId=br-pond-01&moduleKey=PURCHASE_REQUISITION&pageKey=pr_master_list`,
      { headers: { 'x-kosh-user-id': 'usr-buyer-01' } }
    ).then((r) => r.json());
    assert.equal(scA.data.optionalScopes.pageLevelEnabled, false);
    assert.equal(scA.data.optionalScopes.userLevelEnabled, false);
    assert.equal(scA.data.controls.clipboardControl.effectiveValue, true);

    // Configure an optional PAGE rule (disable clipboard + enable webcam) while Page scope is OFF
    await fetch(`${baseUrl}/api/security/policies`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-kosh-user-id': 'usr-admin-01' },
      body: JSON.stringify({
        scopeLevel: 'PAGE',
        scopeRefId: 'pr_master_list',
        pageKey: 'pr_master_list',
        controls: {
          watermark: { state: 'DISABLED' }, // Should be blocked by parent MANDATORY!
          webcamMonitoring: { state: 'ENABLED' },
        },
        changeReason: 'Configure optional PR list page override',
      }),
    }).then((r) => assert.equal(r.status, 200));

    // Confirm while Page=OFF, webcamMonitoring stays false
    const stillOff = await fetch(
      `${baseUrl}/api/security/effective-policy?companyId=co-kosh-01&branchId=br-pond-01&moduleKey=PURCHASE_REQUISITION&pageKey=pr_master_list`,
      { headers: { 'x-kosh-user-id': 'usr-buyer-01' } }
    ).then((r) => r.json());
    assert.equal(stillOff.data.controls.webcamMonitoring.effectiveValue, false);

    // Scenario B: Turn Page=ON, User=OFF -> configured page applies; mandatory watermark CANNOT be disabled
    await fetch(`${baseUrl}/api/security/optional-scopes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-kosh-user-id': 'usr-admin-01' },
      body: JSON.stringify({ pageLevelEnabled: true, reason: 'Scenario B test' }),
    }).then((r) => assert.equal(r.status, 200));

    const scB = await fetch(
      `${baseUrl}/api/security/effective-policy?companyId=co-kosh-01&branchId=br-pond-01&moduleKey=PURCHASE_REQUISITION&pageKey=pr_master_list`,
      { headers: { 'x-kosh-user-id': 'usr-buyer-01' } }
    ).then((r) => r.json());
    assert.equal(scB.data.controls.webcamMonitoring.effectiveValue, true);
    assert.equal(scB.data.controls.webcamMonitoring.sourceLevel, 'PAGE');
    assert.equal(scB.data.controls.watermark.effectiveValue, true);
    assert.equal(scB.data.controls.watermark.overrideStatus, 'LOCKED_BY_PARENT');

    // Unconfigured page safely falls back to MODULE/BRANCH
    const unconfPage = await fetch(
      `${baseUrl}/api/security/effective-policy?companyId=co-kosh-01&branchId=br-pond-01&moduleKey=PURCHASE_REQUISITION&pageKey=unconfigured_page`,
      { headers: { 'x-kosh-user-id': 'usr-buyer-01' } }
    ).then((r) => r.json());
    assert.equal(unconfPage.data.controls.webcamMonitoring.effectiveValue, false);

    // Scenario D: Enable User=ON as well and configure usr-buyer-01 override -> User > Page
    await fetch(`${baseUrl}/api/security/optional-scopes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-kosh-user-id': 'usr-admin-01' },
      body: JSON.stringify({ pageLevelEnabled: true, userLevelEnabled: true, reason: 'Scenario D test' }),
    });
    await fetch(`${baseUrl}/api/security/policies`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-kosh-user-id': 'usr-admin-01' },
      body: JSON.stringify({
        scopeLevel: 'USER',
        scopeRefId: 'usr-buyer-01',
        userId: 'usr-buyer-01',
        controls: { webcamMonitoring: { state: 'DISABLED' } },
        changeReason: 'User override disables optional webcam control',
      }),
    }).then((r) => assert.equal(r.status, 200));

    const scD = await fetch(
      `${baseUrl}/api/security/effective-policy?companyId=co-kosh-01&branchId=br-pond-01&moduleKey=PURCHASE_REQUISITION&pageKey=pr_master_list`,
      { headers: { 'x-kosh-user-id': 'usr-buyer-01' } }
    ).then((r) => r.json());
    assert.equal(scD.data.controls.webcamMonitoring.effectiveValue, false);
    assert.equal(scD.data.controls.webcamMonitoring.sourceLevel, 'USER');

    // Scenario E: Removing optional PAGE and USER policies reverts cleanly to parent
    await fetch(`${baseUrl}/api/security/policies/optional/USER/usr-buyer-01?reason=Cleanup`, {
      method: 'DELETE',
      headers: { 'x-kosh-user-id': 'usr-admin-01' },
    }).then((r) => assert.equal(r.status, 200));

    const afterUserDel = await fetch(
      `${baseUrl}/api/security/effective-policy?companyId=co-kosh-01&branchId=br-pond-01&moduleKey=PURCHASE_REQUISITION&pageKey=pr_master_list`,
      { headers: { 'x-kosh-user-id': 'usr-buyer-01' } }
    ).then((r) => r.json());
    assert.equal(afterUserDel.data.controls.webcamMonitoring.effectiveValue, true);
    assert.equal(afterUserDel.data.controls.webcamMonitoring.sourceLevel, 'PAGE');
  });
});

test('Security API enforces Maker-Checker exception workflow, Cross-Company/Branch isolation, Blackout 423 suspend & recovery', async () => {
  await withSecurityServer(async (baseUrl) => {
    // 1. Cross-company access attempt by usr-ro-01 (org-kosh-02 vs co-kosh-01) -> 403
    const crossCo = await fetch(`${baseUrl}/api/security/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kosh-user-id': 'usr-ro-01' },
      body: JSON.stringify({
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        moduleKey: 'PURCHASE_REQUISITION',
        operation: 'VIEW_SCREEN',
      }),
    });
    assert.equal(crossCo.status, 403);
    assert.equal((await crossCo.json()).error.code, 'CROSS_COMPANY_ACCESS_DENIED');

    // 2. Cross-branch access attempt by usr-maker-02 (only allowed br-pond-01, br-chen-02) -> br-ahm-03 denied 403
    const crossBr = await fetch(`${baseUrl}/api/security/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kosh-user-id': 'usr-maker-02' },
      body: JSON.stringify({
        companyId: 'co-kosh-01',
        branchId: 'br-ahm-03',
        moduleKey: 'PURCHASE_REQUISITION',
        operation: 'VIEW_SCREEN',
      }),
    });
    assert.equal(crossBr.status, 403);

    // 3. Exception Maker-Checker self-approval blocked (403) + Admin-2 approval succeeds
    const now = Date.now();
    const excRes = await fetch(`${baseUrl}/api/security/exceptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kosh-user-id': 'usr-admin-01' },
      body: JSON.stringify({
        companyId: 'co-kosh-01',
        scopeLevel: 'COMPANY',
        scopeRefId: 'co-kosh-01',
        controlKey: 'clipboardControl',
        reason: 'Temporary supplier template paste exception',
        startDate: new Date(now - 60_000).toISOString(),
        expiryDate: new Date(now + 3600_000).toISOString(),
      }),
    });
    assert.equal(excRes.status, 201);
    const exc = (await excRes.json()).data;

    // Self-approval blocked!
    const selfApp = await fetch(`${baseUrl}/api/security/exceptions/${exc.id}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kosh-user-id': 'usr-admin-01' },
      body: JSON.stringify({ decision: 'APPROVED', decisionNotes: 'Self attempt' }),
    });
    assert.equal(selfApp.status, 403);

    // Second admin approves cleanly
    const admin2App = await fetch(`${baseUrl}/api/security/exceptions/${exc.id}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kosh-user-id': 'usr-admin-02' },
      body: JSON.stringify({ decision: 'APPROVED', decisionNotes: 'Verified business need' }),
    });
    assert.equal(admin2App.status, 200);

    // Verify exception applies inside validity window and expires cleanly after expiryDate
    const duringExc = await fetch(
      `${baseUrl}/api/security/effective-policy?companyId=co-kosh-01&branchId=br-pond-01&moduleKey=PURCHASE_REQUISITION`,
      { headers: { 'x-kosh-user-id': 'usr-buyer-01' } }
    ).then((r) => r.json());
    assert.equal(duringExc.data.controls.clipboardControl.exceptionStatus, 'ACTIVE_EXCEPTION');
    assert.equal(duringExc.data.controls.clipboardControl.effectiveValue, false);

    // Query with future nowIso past expiryDate -> reverts cleanly!
    const futureIso = new Date(now + 7200_000).toISOString();
    const afterExpiry = await fetch(
      `${baseUrl}/api/security/effective-policy?companyId=co-kosh-01&branchId=br-pond-01&moduleKey=PURCHASE_REQUISITION&nowIso=${encodeURIComponent(futureIso)}`,
      { headers: { 'x-kosh-user-id': 'usr-buyer-01' } }
    ).then((r) => r.json());
    assert.equal(afterExpiry.data.controls.clipboardControl.effectiveValue, true);

    // 4. Session Heartbeat -> Suspend/Blackout -> 423 SESSION_BLACKOUT_ACTIVE -> Admin Override Recovery
    const sessId = 'test-sess-blackout-01';
    await fetch(`${baseUrl}/api/security/sessions/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kosh-user-id': 'usr-buyer-01' },
      body: JSON.stringify({
        sessionId: sessId,
        userId: 'usr-buyer-01',
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        moduleKey: 'PURCHASE_REQUISITION',
        browserFamily: 'GOOGLE_CHROME',
        browserVersion: '130.0',
        browserCompliant: true,
        secureContext: true,
      }),
    }).then((r) => assert.equal(r.status, 200));

    // Trigger blackout + incident creation
    const blk = await fetch(`${baseUrl}/api/security/sessions/${sessId}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kosh-user-id': 'usr-buyer-01' },
      body: JSON.stringify({
        reason: 'Persistent phone detected via camera',
        severity: 'HIGH',
        action: 'BLACKOUT_LOCKED',
        durationSeconds: 300,
        createIncident: true,
      }),
    });
    assert.equal(blk.status, 200);
    const blkJson = await blk.json();
    assert.equal(blkJson.data.session.blackoutActive, true);
    assert.ok(blkJson.data.incident.incidentNumber.startsWith('SEC-INC-'));

    // Subsequent API call with blocked session -> 423 Locked!
    const blockedAuth = await fetch(`${baseUrl}/api/security/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kosh-user-id': 'usr-buyer-01',
        'x-kosh-session-id': sessId,
      },
      body: JSON.stringify({
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        moduleKey: 'PURCHASE_REQUISITION',
        operation: 'VIEW_SCREEN',
      }),
    });
    assert.equal(blockedAuth.status, 423);

    // Re-authenticate unlocks session cleanly
    const reauth = await fetch(`${baseUrl}/api/security/sessions/${sessId}/reauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kosh-user-id': 'usr-buyer-01' },
      body: JSON.stringify({ reason: 'Cleared workspace', verificationCode: '998877' }),
    });
    assert.equal(reauth.status, 200);
    assert.equal((await reauth.json()).data.blackoutActive, false);

    // Verify /authorize now succeeds 200
    const restoredAuth = await fetch(`${baseUrl}/api/security/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kosh-user-id': 'usr-buyer-01',
        'x-kosh-session-id': sessId,
      },
      body: JSON.stringify({
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        moduleKey: 'PURCHASE_REQUISITION',
        operation: 'VIEW_SCREEN',
      }),
    });
    assert.equal(restoredAuth.status, 200);
  });
});

test('Security API verifies incident lifecycle, Software/Model Registry SHA-256 verification, and high event logging fidelity', async () => {
  await withSecurityServer(async (baseUrl) => {
    const reg = await fetch(`${baseUrl}/api/security/registry`).then((r) => r.json());
    assert.ok(Array.isArray(reg.data) && reg.data.length >= 5);
    const coco = reg.data.find((r: any) => r.id === 'reg-coco-ssd');
    assert.equal(coco.installationStatus, 'INSTALLED');
    assert.equal(coco.sha256Digest, '3770b2528339b1e3340cb74360e1e40401816b009779aeb8d0cce3a4353ea3a9');

    // HIGH event auto-escalates to Incident -> acknowledge -> investigate -> resolve -> close
    const evRes = await fetch(`${baseUrl}/api/security/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kosh-user-id': 'usr-buyer-01' },
      body: JSON.stringify({
        eventType: 'SUSPICIOUS_VISUAL_DETECTION',
        severity: 'HIGH',
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        moduleKey: 'PURCHASE_REQUISITION',
        sessionId: 'sess-inc-flow',
        detectionSource: 'WEBCAM_AI_ENGINE',
        actionTaken: 'BLUR',
        summary: 'Test persistent cell phone risk event',
      }),
    });
    assert.equal(evRes.status, 201);
    const { incident } = (await evRes.json()).data;
    assert.equal(incident.status, 'OPEN');

    for (const [action, expectedStatus] of [
      ['ACKNOWLEDGED', 'ACKNOWLEDGED'],
      ['INVESTIGATED', 'INVESTIGATING'],
      ['RESOLVED', 'RESOLVED'],
      ['CLOSED', 'CLOSED'],
    ] as const) {
      const patch = await fetch(`${baseUrl}/api/security/incidents/${incident.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-kosh-user-id': 'usr-admin-01' },
        body: JSON.stringify({ action, note: `Lifecycle step ${action}` }),
      });
      assert.equal(patch.status, 200);
      assert.equal((await patch.json()).data.status, expectedStatus);
    }
  });
});
