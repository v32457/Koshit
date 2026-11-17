import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import express from 'express';
import { createChargesRouter } from '../src/routes/charges.js';
import { ChargeEngineBackendStore } from '../src/services/chargeEngineBackend.js';

async function withChargeServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const store = new ChargeEngineBackendStore();
  const app = express();
  app.use(express.json({ limit: '1mb', strict: true }));
  app.use('/api/charges', createChargesRouter(store));
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not bind test server');
  }
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('Charge Master API supports creation, duplicate active code rejection (409), and admin role check', async () => {
  await withChargeServer(async (baseUrl) => {
    const createRes = await fetch(`${baseUrl}/api/charges/master`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chargeCode: 'CHG-ESCORT',
        chargeName: 'Escort Security Charges',
        chargeCategory: 'LOGISTICS',
        defaultCalculationMethod: 'FIXED_AMOUNT',
        defaultRate: 2200,
        actorRole: 'PLATFORM_ADMIN',
      }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(created.data.chargeCode, 'CHG-ESCORT');
    assert.equal(created.data.versionNumber, 1);

    // Duplicate active chargeCode must be rejected with 409
    const dupRes = await fetch(`${baseUrl}/api/charges/master`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chargeCode: 'CHG-ESCORT',
        chargeName: 'Duplicate Escort',
        actorRole: 'PLATFORM_ADMIN',
      }),
    });
    assert.equal(dupRes.status, 409);

    // Non-admin role rejected
    const forbiddenRes = await fetch(`${baseUrl}/api/charges/master`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chargeCode: 'CHG-NEW-99',
        chargeName: 'Unauthorized',
        actorRole: 'ITEM_MAKER',
      }),
    });
    assert.equal(forbiddenRes.status, 403);
  });
});

test('Company/Branch Charge Mapping API enforces inheritance, centrally controlled locks (403), and branch override permissions', async () => {
  await withChargeServer(async (baseUrl) => {
    // 1. Disallowed override on cm-insurance (allowBranchOverride: false)
    const blockedRes = await fetch(`${baseUrl}/api/charges/mappings/branch`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        chargeMasterId: 'cm-insurance',
        fixedTariffOrRate: 1.5,
        actorRole: 'PLATFORM_ADMIN',
      }),
    });
    assert.equal(blockedRes.status, 403);

    // 2. Central field lock violation on cm-freight (taxTreatment is centrally controlled)
    const centralLockRes = await fetch(`${baseUrl}/api/charges/mappings/branch`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        chargeMasterId: 'cm-freight',
        taxTreatment: 'EXEMPT_ZERO_RATED',
        actorRole: 'PLATFORM_ADMIN',
      }),
    });
    assert.equal(centralLockRes.status, 403);

    // 3. Permitted rate override on cm-freight for br-pond-01
    const okRes = await fetch(`${baseUrl}/api/charges/mappings/branch`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        chargeMasterId: 'cm-freight',
        fixedTariffOrRate: 5100,
        actorRole: 'PLATFORM_ADMIN',
      }),
    });
    assert.equal(okRes.status, 200);

    // Effective resolution for br-pond-01 uses 5100, another branch inherits 4500
    const effPond = await fetch(`${baseUrl}/api/charges/mappings/effective?companyId=co-kosh-01&branchId=br-pond-01`).then((r) => r.json());
    const freightPond = effPond.data.find((x: any) => x.chargeCode === 'CHG-FREIGHT');
    assert.equal(freightPond.rate, 5100);
    assert.equal(freightPond.sourceScope, 'BRANCH_OVERRIDE');

    const effOther = await fetch(`${baseUrl}/api/charges/mappings/effective?companyId=co-kosh-01&branchId=br-other`).then((r) => r.json());
    const freightOther = effOther.data.find((x: any) => x.chargeCode === 'CHG-FREIGHT');
    assert.equal(freightOther.rate, 4500);
    assert.equal(freightOther.sourceScope, 'COMPANY_INHERITED');
  });
});

test('PR Charge Calculation API validates mapped charges, rejects invented/duplicate charges, and freezes historical snapshots', async () => {
  await withChargeServer(async (baseUrl) => {
    // Reject unmapped invented charge
    const badRes = await fetch(`${baseUrl}/api/charges/pr/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        itemsSubtotal: 100000,
        selectedCharges: [{ chargeCode: 'CHG-INVENTED-FREE-TEXT' }],
      }),
    });
    assert.equal(badRes.status, 400);

    // Reject duplicate charge selection
    const dupRes = await fetch(`${baseUrl}/api/charges/pr/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        itemsSubtotal: 100000,
        selectedCharges: [{ chargeCode: 'CHG-LOAD' }, { chargeCode: 'CHG-LOAD' }],
      }),
    });
    assert.equal(dupRes.status, 409);

    // Lock snapshot on PR-HIST-001
    const okRes = await fetch(`${baseUrl}/api/charges/pr/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prId: 'PR-HIST-001',
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        itemsSubtotal: 100000,
        lockSnapshot: true,
        selectedCharges: [{ chargeCode: 'CHG-LOAD' }, { chargeCode: 'CHG-FREIGHT' }],
      }),
    });
    assert.equal(okRes.status, 200);
    const first = await okRes.json();
    assert.equal(first.data.immutableLocked, true);
    assert.equal(first.data.applicableChargesBaseTotal, 6000); // 1500 + 4500

    // Update Company mapping CHG-FREIGHT rate to 9999 -> locked PR-HIST-001 snapshot remains unchanged
    await fetch(`${baseUrl}/api/charges/mappings/company`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: 'co-kosh-01',
        chargeMasterId: 'cm-freight',
        fixedTariffOrRate: 9999,
        actorRole: 'PLATFORM_ADMIN',
      }),
    });

    const lockedCheck = await fetch(`${baseUrl}/api/charges/pr/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prId: 'PR-HIST-001',
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        itemsSubtotal: 100000,
        selectedCharges: [{ chargeCode: 'CHG-FREIGHT' }],
      }),
    }).then((r) => r.json());
    assert.equal(lockedCheck.data.immutableLocked, true);
    const freightSnap = lockedCheck.data.items.find((i: any) => i.chargeCode === 'CHG-FREIGHT');
    assert.equal(freightSnap.estimatedAmount, 4500);
  });
});
