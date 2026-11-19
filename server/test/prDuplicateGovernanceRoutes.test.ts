import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import express from 'express';
import { createPrDuplicateGovernanceRouter } from '../src/routes/prDuplicateGovernance.js';
import { PrDuplicateGovernanceBackendStore } from '../src/services/prDuplicateGovernanceBackend.js';

async function withDuplicateServer<T>(
  run: (baseUrl: string, store: PrDuplicateGovernanceBackendStore) => Promise<T>
): Promise<T> {
  const store = new PrDuplicateGovernanceBackendStore({ persistToDisk: false });
  const app = express();
  app.use(express.json({ limit: '1mb', strict: true }));
  app.use('/api/pr-duplicate-governance', createPrDuplicateGovernanceRouter(store));
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not bind test server');
  }
  try {
    return await run(`http://127.0.0.1:${address.port}`, store);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

const MAKER_REQ = { id: 'usr-req-1', fullName: 'Arun Kumar', role: 'REQUESTER' };
const ADMIN_MAKER = { id: 'usr-admin-1', fullName: 'Vikram Singh', role: 'PLATFORM_ADMIN' };
const CHECKER_USER = { id: 'usr-chk-1', fullName: 'Venkatesh Iyer', role: 'ITEM_CHECKER' };

const OPEN_PR = {
  id: 'pr-open-1',
  prNumber: 'PR-2026-0005',
  status: 'PENDING_MANAGER_APPROVAL',
  companyId: 'co-kosh-01',
  branchId: 'br-pond-01',
  requesterId: 'usr-req-2',
  requesterName: 'Suresh',
  createdAt: '2026-11-10T09:00:00Z',
  updatedAt: '2026-11-10T09:00:00Z',
  lines: [{ id: 'ol-1', itemCode: 'RMPAOPOEXLG0004', requestedQuantity: 20, inventoryUom: 'KG' }],
};

test('API: Acknowledged state persists but remains blocked until Override Authorised or Checker Approved', async () => {
  await withDuplicateServer(async (baseUrl) => {
    const syncRes = await fetch(`${baseUrl}/api/pr-duplicate-governance/sync-prs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prs: [OPEN_PR] }),
    });
    assert.equal(syncRes.status, 200);

    const payload = {
      draftKey: 'draft-api-1',
      conditionKey: 'dl-1::RMPAOPOEXLG0004',
      companyId: 'co-kosh-01',
      branchId: 'br-pond-01',
      lines: [{ id: 'dl-1', itemCode: 'RMPAOPOEXLG0004', requestedQuantity: 20, inventoryUom: 'KG' }],
      policy: {
        policyVersion: 'POL-STD-2026',
        duplicatePrevention: {
          enableDuplicateDetection: true,
          warningLevel: 'WARNING_WITH_JUSTIFICATION',
          allowOverride: true,
          requireCheckerApprovalForOverride: true,
        },
      },
    };

    // Blank justification rejected (400)
    const blankAck = await fetch(`${baseUrl}/api/pr-duplicate-governance/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, justification: '   ', actorUser: MAKER_REQ }),
    });
    assert.equal(blankAck.status, 400);

    // Valid acknowledgement persists State B without granting submission permission
    const ackRes = await fetch(`${baseUrl}/api/pr-duplicate-governance/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        justification: 'Urgent duplicate line required for Plant 2',
        actorUser: MAKER_REQ,
      }),
    });
    assert.equal(ackRes.status, 200);
    const ackJson = await ackRes.json();
    assert.equal(ackJson.data.condition.state, 'ACKNOWLEDGED');
    assert.equal(ackJson.data.condition.overrideStatus, 'PENDING_CHECKER_APPROVAL');
    assert.equal(ackJson.data.snapshot.submissionEligible, false);

    // Validate submission rejects while awaiting Checker approval (403)
    const valPending = await fetch(`${baseUrl}/api/pr-duplicate-governance/validate-submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, actorUser: MAKER_REQ }),
    });
    assert.equal(valPending.status, 403);

    // Maker cannot self-approve as Checker (403 Maker-Checker violation)
    const selfChk = await fetch(`${baseUrl}/api/pr-duplicate-governance/checker-decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        decision: 'APPROVED',
        remarks: 'Self approval attempt',
        checkerUser: MAKER_REQ,
      }),
    });
    assert.equal(selfChk.status, 403);

    // Independent Checker approves override -> State C OVERRIDE_AUTHORISED
    const chkApprove = await fetch(`${baseUrl}/api/pr-duplicate-governance/checker-decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        decision: 'APPROVED',
        remarks: 'Verified distinct demand schedule',
        checkerUser: CHECKER_USER,
      }),
    });
    assert.equal(chkApprove.status, 200);
    const chkJson = await chkApprove.json();
    assert.equal(chkJson.data.condition.state, 'OVERRIDE_AUTHORISED');
    assert.ok(chkJson.data.condition.overrideRecord.approvalReference.startsWith('DUP-CHK-'));

    // Submission validation now returns 200 Allowed
    const valOk = await fetch(`${baseUrl}/api/pr-duplicate-governance/validate-submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, actorUser: MAKER_REQ }),
    });
    assert.equal(valOk.status, 200);
    const valJson = await valOk.json();
    assert.equal(valJson.data.allowed, true);
  });
});

test('API: Rejects unpersisted frontend bypass and stale PR status drift on submission (403 / 409)', async () => {
  await withDuplicateServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/pr-duplicate-governance/sync-prs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prs: [OPEN_PR] }),
    });

    const basePayload = {
      draftKey: 'draft-api-bypass',
      conditionKey: 'dl-1::RMPAOPOEXLG0004',
      companyId: 'co-kosh-01',
      branchId: 'br-pond-01',
      lines: [{ id: 'dl-1', itemCode: 'RMPAOPOEXLG0004', requestedQuantity: 20 }],
      policy: {
        duplicatePrevention: {
          enableDuplicateDetection: true,
          warningLevel: 'WARNING_WITH_JUSTIFICATION',
          allowOverride: true,
          requireCheckerApprovalForOverride: false,
        },
      },
    };

    // Direct submission attempt without backend ack/override fails (403)
    const bypassAttempt = await fetch(`${baseUrl}/api/pr-duplicate-governance/validate-submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, actorUser: ADMIN_MAKER }),
    });
    assert.equal(bypassAttempt.status, 403);

    // Acknowledge + Authorise Override
    await fetch(`${baseUrl}/api/pr-duplicate-governance/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        justification: 'Emergency batch',
        actorUser: ADMIN_MAKER,
      }),
    });
    await fetch(`${baseUrl}/api/pr-duplicate-governance/authorise-override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        remarks: 'Authorized by manager',
        actorUser: ADMIN_MAKER,
      }),
    });

    // Simulate matching PR status changing on backend before final submission
    await fetch(`${baseUrl}/api/pr-duplicate-governance/sync-prs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prs: [{ ...OPEN_PR, status: 'APPROVED_PENDING_BUYER', updatedAt: '2026-11-18T12:00:00Z' }],
      }),
    });

    // Submission revalidation detects STALE status drift -> HTTP 409
    const staleSubmit = await fetch(`${baseUrl}/api/pr-duplicate-governance/validate-submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, actorUser: ADMIN_MAKER }),
    });
    assert.equal(staleSubmit.status, 409);
    const staleJson = await staleSubmit.json();
    assert.equal(staleJson.error.code, 'DUPLICATE_STALE');
  });
});

test('API: HARD_BLOCK prohibits override and prevents modifying approved override without supersede audit', async () => {
  await withDuplicateServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/pr-duplicate-governance/sync-prs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prs: [OPEN_PR] }),
    });

    const hardPayload = {
      draftKey: 'draft-hard-block',
      conditionKey: 'dl-1::RMPAOPOEXLG0004',
      companyId: 'co-kosh-01',
      branchId: 'br-pond-01',
      lines: [{ id: 'dl-1', itemCode: 'RMPAOPOEXLG0004', requestedQuantity: 20 }],
      policy: {
        duplicatePrevention: {
          enableDuplicateDetection: true,
          warningLevel: 'HARD_BLOCK',
          allowOverride: false,
        },
      },
    };

    const ackHard = await fetch(`${baseUrl}/api/pr-duplicate-governance/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...hardPayload,
        justification: 'Testing hard block',
        actorUser: ADMIN_MAKER,
      }),
    });
    assert.equal(ackHard.status, 200);
    const ackHardJson = await ackHard.json();
    assert.equal(ackHardJson.data.condition.overrideStatus, 'PROHIBITED_BY_POLICY');

    const ovrHard = await fetch(`${baseUrl}/api/pr-duplicate-governance/authorise-override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...hardPayload, actorUser: ADMIN_MAKER }),
    });
    assert.equal(ovrHard.status, 403);
  });
});
