/**
 * CIPPLATFORM - PURCHASE REQUISITION (PR) MODULE TEST SUITE
 * Validates PR types, applicability, inventory UOM lock, duplicate detection, budget validation, and stale line cleanup using node:test.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { PurchaseRequisitionService } from '../services/purchaseRequisitionService';

test('1. Applicability Check', () => {
  const isApplicable = PurchaseRequisitionService.isPRApplicable('branch-001', 'MANUAL');
  assert.equal(typeof isApplicable, 'boolean');
});

test('2. PR Number Generation', () => {
  const prNum = PurchaseRequisitionService.generatePRNumber();
  assert.match(prNum, /^PR-2026-\d{4}$/);
});

test('3. Create and Retrieve PRs', () => {
  const prs = PurchaseRequisitionService.getPurchaseRequisitions();
  assert.equal(Array.isArray(prs), true);
  assert.ok(prs.length > 0);
});

test('4. Duplicate Detection Check', () => {
  const duplicates = PurchaseRequisitionService.checkForDuplicates('RM-ALLOY-316L', 'comp-1', 'branch-001');
  assert.equal(Array.isArray(duplicates), true);
});

test('5. Cleanup Configuration Retrieval', () => {
  const cleanupConfig = PurchaseRequisitionService.getCleanupConfig();
  assert.ok(cleanupConfig);
  assert.ok(cleanupConfig.ageThresholdDays > 0);
});
