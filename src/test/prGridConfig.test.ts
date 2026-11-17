/**
 * CIPPLATFORM - PURCHASE REQUISITIONS (PR) CONFIGURABLE DATA GRID UNIT TEST SUITE
 * Validates all 12 acceptance criteria for column resizing, reordering, multi-sorting,
 * visibility management, per-user layout persistence, separate Currency & Estimated Value,
 * Expected Delivery Date validation, and legacy PR record compatibility.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AVAILABLE_PR_COLUMNS,
  clampColumnWidth,
  calculateAutoFitWidth,
  reorderColumns,
  toggleSortRule,
  sortPrRecords,
  formatEstimatedValue,
  getPrCurrency,
  getExpectedDeliveryDate,
  isValidIsoDate,
  getUserGridLayout,
  saveUserGridLayout,
  resetUserGridLayout,
  getDefaultColumnStates,
} from '../services/prGridConfigService';
import { PurchaseRequisitionService } from '../services/purchaseRequisitionService';
import { prGovernancePolicyService } from '../services/prGovernancePolicyService';
import { PurchaseRequisitionHeader } from '../types/purchaseRequisition';

test('1. Recommended 20 Available Columns are registered with distinct Currency and Estimated Value columns', () => {
  assert.equal(AVAILABLE_PR_COLUMNS.length, 20);
  const keys = AVAILABLE_PR_COLUMNS.map((c) => c.key);
  assert.ok(keys.includes('currency'), 'Must include separate Currency column');
  assert.ok(keys.includes('estimatedTotalValue'), 'Must include separate Estimated Value column');
  assert.ok(keys.includes('expectedDeliveryDate'), 'Must include Expected Delivery Date column');
  assert.ok(keys.includes('priority'), 'Must include Priority column');
  assert.ok(keys.includes('requiredBy'), 'Must include Required By column');
  assert.ok(keys.includes('creatorName'), 'Must include Created By column');
  assert.ok(keys.includes('createdAt'), 'Must include Created On column');
  assert.ok(keys.includes('modifiedBy'), 'Must include Modified By column');
  assert.ok(keys.includes('updatedAt'), 'Must include Modified On column');
});

test('2. Column width resizing clamps between minWidth and maxWidth and auto-fits content', () => {
  const prs = PurchaseRequisitionService.getPurchaseRequisitions();
  const clampedMin = clampColumnWidth('prNumber', 20);
  const clampedMax = clampColumnWidth('prNumber', 999);
  assert.equal(clampedMin, 105);
  assert.equal(clampedMax, 260);

  const autoFitted = calculateAutoFitWidth('purposeAndItems', prs);
  assert.ok(autoFitted >= 150 && autoFitted <= 460);
});

test('3. Column drag-and-drop reordering updates column order indices deterministically', () => {
  const defaults = getDefaultColumnStates();
  const reordered = reorderColumns(defaults, 'expectedDeliveryDate', 'prNumber');
  assert.equal(reordered[0].key, 'expectedDeliveryDate');
  assert.equal(reordered[0].order, 0);
  assert.equal(reordered[1].key, 'prNumber');
  assert.equal(reordered[1].order, 1);
});

test('4. Separate Currency and Estimated Value formatting never combines symbols with numbers', () => {
  const inrFormatted = formatEstimatedValue(300000, 'INR');
  const usdFormatted = formatEstimatedValue(2500, 'USD');
  const eurFormatted = formatEstimatedValue(1800, 'EUR');

  assert.equal(inrFormatted, '3,00,000');
  assert.equal(usdFormatted, '2,500');
  assert.equal(eurFormatted, '1,800');
  assert.doesNotMatch(inrFormatted, /[₹$€£A-Za-z]/);
  assert.doesNotMatch(usdFormatted, /[₹$€£A-Za-z]/);
  assert.doesNotMatch(eurFormatted, /[₹$€£A-Za-z]/);
});

test('5. Sorting works across numeric, text, and date columns including multi-column sort', () => {
  const prs = PurchaseRequisitionService.getPurchaseRequisitions();

  // Numeric sort ascending by estimatedTotalValue
  const ascByValue = sortPrRecords(prs, [{ key: 'estimatedTotalValue', direction: 'asc' }]);
  for (let i = 1; i < ascByValue.length; i++) {
    assert.ok(ascByValue[i].estimatedTotalValue >= ascByValue[i - 1].estimatedTotalValue);
  }

  // Date sort descending by expectedDeliveryDate
  const descByDelivery = sortPrRecords(prs, [{ key: 'expectedDeliveryDate', direction: 'desc' }]);
  const firstDate = getExpectedDeliveryDate(descByDelivery[0]);
  const lastDate = getExpectedDeliveryDate(descByDelivery[descByDelivery.length - 1]);
  assert.ok(firstDate >= lastDate);

  // Multi-sort rule toggling
  let rules: import('../services/prGridConfigService').PRSortRule[] = toggleSortRule([], 'currency', false);
  assert.deepEqual(rules, [{ key: 'currency', direction: 'asc' }]);
  rules = toggleSortRule(rules, 'estimatedTotalValue', true);
  assert.equal(rules.length, 2);
});

test('6. Per-user column layout save, reload across sessions, and reset to default', () => {
  const userId = 'usr-test-layout-01';
  const initial = getUserGridLayout(userId);
  const customCols = initial.columns.map((c) =>
    c.key === 'priority' || c.key === 'modifiedBy' ? { ...c, visible: true, width: 150 } : c
  );

  saveUserGridLayout(userId, {
    columns: customCols,
    sortRules: [{ key: 'expectedDeliveryDate', direction: 'asc' }],
  });

  const reloaded = getUserGridLayout(userId);
  assert.equal(reloaded.columns.find((c) => c.key === 'priority')?.visible, true);
  assert.equal(reloaded.columns.find((c) => c.key === 'modifiedBy')?.visible, true);
  assert.equal(reloaded.columns.find((c) => c.key === 'priority')?.width, 150);
  assert.deepEqual(reloaded.sortRules, [{ key: 'expectedDeliveryDate', direction: 'asc' }]);

  const afterReset = resetUserGridLayout(userId);
  assert.equal(afterReset.columns.find((c) => c.key === 'priority')?.visible, false);
  assert.equal(afterReset.sortRules.length, 0);
});

test('7. Expected Delivery Date validation, PR creation/update persistence, and legacy record fallback', () => {
  assert.equal(isValidIsoDate('2026-12-15'), true);
  assert.equal(isValidIsoDate('invalid-date'), false);
  assert.equal(isValidIsoDate('2026-02-31'), false);

  // Configure policy to enable Expected Delivery Date for comp-1 during this test
  const originalPolicies = prGovernancePolicyService.getPolicies();
  const koshPolicyIdx = originalPolicies.findIndex(
    (p) => (p.companyId === 'co-kosh-01' || p.companyId === 'comp-1') && p.branchId === 'ALL'
  );
  const prevSetting = koshPolicyIdx !== -1 ? originalPolicies[koshPolicyIdx].activation.expectedDeliveryDateEnabled : false;
  if (koshPolicyIdx !== -1) {
    originalPolicies[koshPolicyIdx].activation.expectedDeliveryDateEnabled = true;
    originalPolicies[koshPolicyIdx].activation.expectedDeliveryDateMandatory = true;
    prGovernancePolicyService.savePolicies(originalPolicies);
  }

  try {
    // Create PR with Expected Delivery Date and USD currency
    const created = PurchaseRequisitionService.createPR({
      prType: 'MANUAL',
      companyId: 'comp-1',
      companyCode: 'KOSH_INNOVATIONS',
      branchId: 'branch-001',
      branchCode: '001',
      branchName: 'Hosur Plant 1',
      department: 'Production',
      costCentre: 'CC-PROD-101',
      requesterId: 'usr-test',
      requesterName: 'Test Engineer',
      creatorId: 'usr-test',
      creatorName: 'Test Engineer',
      modifiedBy: 'Test Engineer',
      priority: 'URGENT',
      status: 'DRAFT',
      purchasePurpose: 'Precision tooling inserts',
      businessJustification: 'Line expansion',
      deliveryLocation: 'Hosur Bay 1',
      estimatedTotalValue: 4200,
      currency: 'USD',
      expectedDeliveryDate: '2026-12-20',
      budgetValidationStatus: 'SUFFICIENT',
      erpStockStatus: 'FRESH',
      lines: [],
      changeHistory: [],
      attachments: [],
    });

    assert.equal(getPrCurrency(created), 'USD');
    assert.equal(getExpectedDeliveryDate(created), '2026-12-20');

    // Update Expected Delivery Date
    const updated = PurchaseRequisitionService.updatePR(created.id, {
      expectedDeliveryDate: '2026-12-28',
      modifiedBy: 'Manager User',
    });
    assert.ok(updated);
    assert.equal(getExpectedDeliveryDate(updated!), '2026-12-28');

    // Legacy PR without header expectedDeliveryDate falls back to earliest line schedule date
    const legacyPr = {
      ...created,
      expectedDeliveryDate: undefined,
      lines: [
        {
          id: 'l-1',
          prId: created.id,
          itemCode: 'ITEM-1',
          description: 'Legacy Item',
          itemCategory: 'General',
          inventoryUom: 'NOS',
          requestedQuantity: 10,
          approximateUnitPrice: 100,
          currency: 'INR',
          estimatedTotalValue: 1000,
          status: 'ACTIVE' as const,
          deliverySchedules: [
            { id: 's-1', lineId: 'l-1', deliveryDate: '2026-11-30', quantity: 5 },
            { id: 's-2', lineId: 'l-1', deliveryDate: '2026-11-18', quantity: 5 },
          ],
        },
      ],
    } as PurchaseRequisitionHeader;

    assert.equal(getExpectedDeliveryDate(legacyPr), '2026-11-18');
  } finally {
    if (koshPolicyIdx !== -1) {
      originalPolicies[koshPolicyIdx].activation.expectedDeliveryDateEnabled = prevSetting;
      originalPolicies[koshPolicyIdx].activation.expectedDeliveryDateMandatory = false;
      prGovernancePolicyService.savePolicies(originalPolicies);
    }
  }
});
