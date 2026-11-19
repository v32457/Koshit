import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import express from 'express';
import { createPrGovernanceRouter } from '../src/routes/prGovernance.js';
import { PrGovernanceBackendStore } from '../src/services/prGovernanceBackend.js';

async function withGovernanceServer<T>(
  run: (baseUrl: string, store: PrGovernanceBackendStore) => Promise<T>
): Promise<T> {
  const store = new PrGovernanceBackendStore();
  const app = express();
  app.use(express.json({ limit: '1mb', strict: true }));
  app.use('/api/pr-governance', createPrGovernanceRouter(store));
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

test('API /api/pr-governance: Conditional Budget Validation OFF skips budget blocks while keeping approval & category rules active', async () => {
  await withGovernanceServer(async (baseUrl) => {
    // Sync company policy with Budget Validation OFF and centrally controlled locks
    const effRes = await fetch(`${baseUrl}/api/pr-governance/effective-policy?companyId=co-kosh-01&branchId=br-pond-01`);
    assert.equal(effRes.status, 200);
    const effJson: any = await effRes.json();
    const basePol = effJson.data.effectivePolicy;
    basePol.branchId = 'ALL';
    basePol.policyScope = 'COMPANY';
    basePol.activation.budgetValidationEnabled = false;
    basePol.budget.enableBudgetValidation = false;

    const syncRes = await fetch(`${baseUrl}/api/pr-governance/sync-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policies: [basePol] }),
    });
    assert.equal(syncRes.status, 200);

    // Huge 50,00,000 PR with valid OT category passes when Budget Validation is OFF
    const valOffRes = await fetch(`${baseUrl}/api/pr-governance/validate-pr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SUBMIT',
        pr: {
          companyId: 'co-kosh-01',
          branchId: 'br-pond-01',
          prType: 'MANUAL',
          costCentre: 'CC-PROD-101',
          currency: 'INR',
          estimatedTotalValue: 5000000,
          grandTotalWithCharges: 5000000,
          lines: [{ id: 'l1', itemCode: 'OT-ITEM-1', itemCategory: 'OT' }],
        },
        actorUser: { id: 'usr-1', role: 'PLATFORM_ADMIN' },
      }),
    });
    assert.equal(valOffRes.status, 200);
    const valOffJson: any = await valOffRes.json();
    assert.equal(valOffJson.data.allowed, true);
    assert.equal(valOffJson.data.budgetResult.enabled, false);
    assert.equal(valOffJson.data.workflowPlan.requiredLevels, 3);

    // CAPEX_ASSET with RM category fails even when Budget Validation is OFF
    const badCatRes = await fetch(`${baseUrl}/api/pr-governance/validate-pr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SUBMIT',
        pr: {
          companyId: 'co-kosh-01',
          branchId: 'br-pond-01',
          prType: 'CAPEX_ASSET',
          costCentre: 'CC-PROD-101',
          currency: 'INR',
          estimatedTotalValue: 50000,
          grandTotalWithCharges: 50000,
          lines: [{ id: 'l1', itemCode: 'RM-01', itemCategory: 'RM' }],
        },
        actorUser: { id: 'usr-1', role: 'PLATFORM_ADMIN' },
      }),
    });
    assert.equal(badCatRes.status, 422);
    const badCatJson: any = await badCatRes.json();
    assert.equal(badCatJson.data.allowed, false);
    assert.equal(badCatJson.data.categoryValidation.valid, false);
  });
});

test('API /api/pr-governance: Budget Validation ON enforces ledger limit and SAP handoff requires full matrix approval', async () => {
  await withGovernanceServer(async (baseUrl) => {
    // Default store has Budget Validation ON and Pondicherry CC-PROD-101 available = 10,00,000
    const overBudgetRes = await fetch(`${baseUrl}/api/pr-governance/validate-pr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SUBMIT',
        pr: {
          companyId: 'co-kosh-01',
          branchId: 'br-pond-01',
          prType: 'CAPEX_ASSET',
          costCentre: 'CC-PROD-101',
          currency: 'INR',
          estimatedTotalValue: 2500000,
          grandTotalWithCharges: 2500000,
          lines: [{ id: 'l1', itemCode: 'FA-CNC-01', itemCategory: 'FA' }],
        },
        actorUser: { id: 'usr-1', role: 'PLATFORM_ADMIN' },
      }),
    });
    assert.equal(overBudgetRes.status, 422);
    const overBudgetJson: any = await overBudgetRes.json();
    assert.equal(overBudgetJson.data.budgetResult.enabled, true);
    assert.equal(overBudgetJson.data.budgetResult.status, 'BLOCKED_INSUFFICIENT_BUDGET');

    // Eligible categories check returns ONLY ['FA'] for CAPEX_ASSET
    const catRes = await fetch(
      `${baseUrl}/api/pr-governance/eligible-categories?companyId=co-kosh-01&branchId=br-pond-01&prTypeCode=CAPEX_ASSET&userRole=PLATFORM_ADMIN`
    );
    assert.equal(catRes.status, 200);
    const catJson: any = await catRes.json();
    assert.deepEqual(
      catJson.data.categories.map((c: any) => c.code),
      ['FA']
    );

    // SAP B1 readiness blocks pending PR with insufficient approval steps
    const sapBlockedRes = await fetch(`${baseUrl}/api/pr-governance/validate-sap-handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pr: {
          id: 'pr-sap-1',
          prNumber: 'PR-2026-0999',
          status: 'PENDING_SUBSEQUENT_APPROVAL',
          companyId: 'co-kosh-01',
          branchId: 'br-pond-01',
          prType: 'CAPEX_ASSET',
          costCentre: 'CC-PROD-101',
          currency: 'INR',
          estimatedTotalValue: 500000,
          grandTotalWithCharges: 500000,
          approvalCycleCount: 1,
          approvalHistory: [{ cycleNumber: 1, decision: 'APPROVED' }],
          lines: [{ id: 'l1', itemCode: 'FA-CNC-01', itemCategory: 'FA' }],
        },
      }),
    });
    assert.equal(sapBlockedRes.status, 422);
    const sapBlockedJson: any = await sapBlockedRes.json();
    assert.equal(sapBlockedJson.data.readyForSap, false);
  });
});
