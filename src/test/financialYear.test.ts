import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAvailableFinancialYears,
  getFinancialYearRange,
  getIndianFinancialYear,
  isReturnPeriodInFinancialYear,
  isValidFinancialYear,
} from '../../shared/financialYear';

// 2026-03-31 23:59:59 in Asia/Kolkata (UTC+05:30).
const END_OF_FY_2025_26 = new Date('2026-03-31T18:29:59.000Z');
// 2026-04-01 00:00:00 in Asia/Kolkata.
const START_OF_FY_2026_27 = new Date('2026-03-31T18:30:00.000Z');

test('getIndianFinancialYear respects the Indian April-March boundary', () => {
  assert.equal(getIndianFinancialYear(END_OF_FY_2025_26), '2025-26');
  assert.equal(getIndianFinancialYear(START_OF_FY_2026_27), '2026-27');
  assert.equal(
    getIndianFinancialYear(new Date('2027-03-31T18:29:59.000Z')),
    '2026-27',
  );
  assert.equal(
    getIndianFinancialYear(new Date('2027-03-31T18:30:00.000Z')),
    '2027-28',
  );
});

test('getAvailableFinancialYears returns the current and previous two years', () => {
  assert.deepEqual(getAvailableFinancialYears(START_OF_FY_2026_27), [
    '2026-27',
    '2025-26',
    '2024-25',
  ]);
  assert.deepEqual(getAvailableFinancialYears(END_OF_FY_2025_26), [
    '2025-26',
    '2024-25',
    '2023-24',
  ]);
});

test('isValidFinancialYear requires YYYY-YY with a consecutive end year', () => {
  assert.equal(isValidFinancialYear('2026-27'), true);
  assert.equal(isValidFinancialYear('2025-26'), true);
  assert.equal(isValidFinancialYear('2026-28'), false);
  assert.equal(isValidFinancialYear('26-27'), false);
  assert.equal(isValidFinancialYear('2026/27'), false);
});

test('getFinancialYearRange covers 1 April to 31 March', () => {
  assert.deepEqual(getFinancialYearRange('2026-27'), {
    startDate: '2026-04-01',
    endDate: '2027-03-31',
  });
  assert.equal(getFinancialYearRange('2026-28'), null);
});

test('isReturnPeriodInFinancialYear assigns March and April correctly', () => {
  assert.equal(isReturnPeriodInFinancialYear('2025-04', '2025-26'), true);
  assert.equal(isReturnPeriodInFinancialYear('2026-03', '2025-26'), true);
  assert.equal(isReturnPeriodInFinancialYear('2026-04', '2025-26'), false);
  assert.equal(isReturnPeriodInFinancialYear('2025-03', '2025-26'), false);
  assert.equal(isReturnPeriodInFinancialYear('2026-13', '2025-26'), false);
});
