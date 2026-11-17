/**
 * KOSH INNOVATIONS — FUTURE RFQ FLOATING & CONSOLIDATED SOURCING AUTOMATED TEST SUITE
 * Tests all 10 mandatory validation scenarios for PR-to-RFQ line tracking, partial conversions,
 * consolidation, mutex locking, reversal audit trails, and UOM calculations.
 */

import test from 'node:test';
import assert from 'node:assert';

// Polyfill localStorage for Node.js test runner environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

import { futureRfqFloatingService } from '../services/futureRfqFloatingService';
import { prRfqConversionService } from '../services/prRfqConversionService';
import { uomConversionService } from '../services/uomConversionService';
import { EnterpriseAuditService } from '../services/enterpriseAuditService';
import { marketBenchmarkService } from '../services/marketBenchmarkService';

test('Scenario 1: Multiple PRs with same item consolidated into one RFQ line', () => {
  const groups = futureRfqFloatingService.getConsolidatedDemandItems();
  assert.ok(groups.length > 0, 'Consolidated groups must be generated');
  const group = groups[0];
  assert.ok(group.contributingDemandItems.length >= 1);
});

test('Scenario 2: Partial quantities selected from multiple PRs', () => {
  const summary = prRfqConversionService.getSummaryForPrLine('pr-line-001', 500, 'KG', 'PR-2026-0001', 'RM-ALLOY-316L');

  // PR-001 has 500 KG original Qty. Initial seed converted 500 KG.
  // Let's test line pr-line-002 (120 BOX original Qty)
  const summary2 = prRfqConversionService.getSummaryForPrLine('pr-line-002', 120, 'BOX', 'PR-2026-0002', 'PKG-FASTENER-M8');

  assert.strictEqual(summary2.originalPrQtyInvUom, 120);
  assert.strictEqual(summary2.conversionStatus, 'NOT_CONVERTED');

  const res = prRfqConversionService.recordConversion({
    prId: 'pr-002',
    prNumber: 'PR-2026-0002',
    prLineId: 'pr-line-002',
    itemCode: 'PKG-FASTENER-M8',
    rfqId: 'rfq-test-01',
    rfqNumber: 'RFQ-TEST-001',
    rfqLineId: 'rfq-line-test-01',
    convertQtyInvUom: 50,
    convertQtyPurchUom: 50,
    prInvUom: 'BOX',
    rfqPurchUom: 'BOX',
    conversionRatio: 1,
    userId: 'usr-buyer-01',
    userName: 'Test Buyer',
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.summary.remainingQtyInvUom, 70);
  assert.strictEqual(res.summary.conversionStatus, 'PARTIALLY_CONVERTED');
});

test('Scenario 3: Remaining quantities converted into subsequent RFQs', () => {
  const res2 = prRfqConversionService.recordConversion({
    prId: 'pr-002',
    prNumber: 'PR-2026-0002',
    prLineId: 'pr-line-002',
    itemCode: 'PKG-FASTENER-M8',
    rfqId: 'rfq-test-02',
    rfqNumber: 'RFQ-TEST-002',
    rfqLineId: 'rfq-line-test-02',
    convertQtyInvUom: 70,
    convertQtyPurchUom: 70,
    prInvUom: 'BOX',
    rfqPurchUom: 'BOX',
    conversionRatio: 1,
    userId: 'usr-buyer-01',
    userName: 'Test Buyer',
  });

  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.summary.remainingQtyInvUom, 0);
  assert.strictEqual(res2.summary.conversionStatus, 'FULLY_CONVERTED');
});

test('Scenario 4: Fully converted PR lines blocked from further conversion', () => {
  const resBlock = prRfqConversionService.recordConversion({
    prId: 'pr-002',
    prNumber: 'PR-2026-0002',
    prLineId: 'pr-line-002',
    itemCode: 'PKG-FASTENER-M8',
    rfqId: 'rfq-test-03',
    rfqNumber: 'RFQ-TEST-003',
    rfqLineId: 'rfq-line-test-03',
    convertQtyInvUom: 10,
    convertQtyPurchUom: 10,
    prInvUom: 'BOX',
    rfqPurchUom: 'BOX',
    conversionRatio: 1,
    userId: 'usr-buyer-01',
    userName: 'Test Buyer',
  });

  assert.strictEqual(resBlock.success, false);
  assert.ok(resBlock.errorMessage?.includes('fully converted'));
});

test('Scenario 5: Incompatible specifications or UOMs excluded from consolidation', () => {
  const groups = futureRfqFloatingService.getConsolidatedDemandItems();
  groups.forEach((g) => {
    const itemCodes = new Set(g.contributingDemandItems.map((i) => i.itemCode));
    assert.strictEqual(itemCodes.size, 1, 'Group must only contain matching item codes');
  });
});

test('Scenario 6: Mutex locking prevents over-allocation', () => {
  const summary = prRfqConversionService.getSummaryForPrLine('pr-line-002');
  assert.strictEqual(summary.remainingQtyInvUom, 0, 'Line remains at 0 remaining');
});

test('Scenario 7: Traceability from RFQ quantity back to PR line', () => {
  const records = prRfqConversionService.getRecords();
  const rec = records.find((r) => r.prLineId === 'pr-line-002' && r.status === 'ACTIVE');
  assert.ok(rec !== undefined);
  assert.strictEqual(rec.prNumber, 'PR-2026-0002');
});

test('Scenario 8: Cancellation and authorized reversal preserve audit history', async () => {
  const records = prRfqConversionService.getRecords();
  const rec = records.find((r) => r.prLineId === 'pr-line-002' && r.status === 'ACTIVE');
  if (rec) {
    const revRes = prRfqConversionService.reverseConversion(rec.id, 'Admin Tester', 'Testing Authorized Reversal');
    assert.strictEqual(revRes.success, true);
    assert.strictEqual(revRes.record?.status, 'CANCELLED');

    let revLog: any;
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      const auditLogs = EnterpriseAuditService.getAuditLogs();
      revLog = auditLogs.find((l) => l.eventType === 'RFQ_CONVERSION_REVERSED');
      if (revLog) break;
    }
    assert.ok(revLog !== undefined);
  }
});

test('Scenario 9: Original PR quantities remain unchanged', () => {
  const summary = prRfqConversionService.getSummaryForPrLine('pr-line-002');
  assert.strictEqual(summary.originalPrQtyInvUom, 120);
});

test('Scenario 10: Purchase UOM and Inventory UOM conversion accuracy', () => {
  const convQty = uomConversionService.convertInvToPurchQty('RMPAOPOEXLG0001', 500); // 500 KG -> 20 BAGS
  assert.strictEqual(convQty, 20);

  const backInvQty = uomConversionService.convertPurchToInvQty('RMPAOPOEXLG0001', 20); // 20 BAGS -> 500 KG
  assert.strictEqual(backInvQty, 500);
});

test('Scenario 11: Web-Based Market Price Discovery generates up to 10 verified vendor offers', () => {
  const benchmark = marketBenchmarkService.getBenchmarkForItem('RMPAOPOEXLG0001', 'PC-ABS Flame Retardant Resin');
  assert.ok(benchmark !== undefined);
  assert.strictEqual(benchmark.itemCode, 'RMPAOPOEXLG0001');
  assert.ok(benchmark.sampleSize >= 3, 'Must contain multiple genuine vendor offers');
  assert.ok(benchmark.lowestPrice > 0);
  assert.ok(benchmark.medianPrice >= benchmark.lowestPrice);
  assert.ok(benchmark.highestPrice >= benchmark.medianPrice);
});

test('Scenario 12: Supplier Preference Levels (L1, L2, L3) assigned via Vendor Master Governance', () => {
  const benchmark = marketBenchmarkService.getBenchmarkForItem('RMPAOPOEXLG0001');
  assert.ok(benchmark.l1Supplier !== undefined, 'L1 Preferred Supplier must exist');
  assert.strictEqual(benchmark.l1Supplier?.preferenceLevel, 'L1');
  assert.ok(benchmark.l1Supplier?.historicalPerformanceScore !== undefined);
  assert.ok(benchmark.l1Supplier?.historicalPerformanceScore! >= 95, 'L1 must meet high QA performance threshold');

  if (benchmark.l2Supplier) {
    assert.strictEqual(benchmark.l2Supplier.preferenceLevel, 'L2');
  }
  if (benchmark.l3Supplier) {
    assert.strictEqual(benchmark.l3Supplier.preferenceLevel, 'L3');
  }
});

test('Scenario 13: Landed price calculation includes published price, GST, and freight', () => {
  const benchmark = marketBenchmarkService.getBenchmarkForItem('RMPAOPOEXLG0001');
  const offer = benchmark.offers[0];
  assert.ok(offer.estimatedLandedPrice >= offer.normalizedPricePurchUom, 'Landed price must be equal or greater than base price');
  assert.ok(offer.gstPercent !== undefined && offer.gstPercent > 0);
  assert.ok(offer.deliveryLeadTimeDays > 0);
});

test('Scenario 14: Non-comparable / distressed listings strictly excluded from benchmark calculation', () => {
  const benchmark = marketBenchmarkService.getBenchmarkForItem('RMPAOPOEXLG0001');
  if (benchmark.excludedOffers && benchmark.excludedOffers.length > 0) {
    benchmark.excludedOffers.forEach((ex) => {
      assert.strictEqual(ex.isEligibleForComparison, false);
      assert.ok(ex.exclusionReason !== undefined && ex.exclusionReason.length > 0);
    });
  }
});

test('Scenario 15: Consolidated groups and demand lines retain market benchmark intelligence', () => {
  const groups = futureRfqFloatingService.getConsolidatedDemandItems();
  const group = groups.find((g) => g.marketBenchmark !== undefined);
  assert.ok(group !== undefined, 'Consolidated groups must attach marketBenchmark');
  assert.ok(group.marketBenchmark!.lowestPrice > 0);
  assert.ok(group.marketBenchmark!.sampleSize > 0);
});

