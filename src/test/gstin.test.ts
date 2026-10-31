import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidGstin, normalizeGstin } from '../../shared/gstin';

test('isValidGstin accepts known valid GSTIN check digits', () => {
  for (const gstin of [
    '33AAACC1206D1ZN',
    '24APLPV0398G1ZH',
    '27AAPFU0939F1ZV',
    '27AAACT2727Q1ZW',
  ]) {
    assert.equal(isValidGstin(gstin), true, gstin);
  }
});

test('isValidGstin rejects an incorrect check digit', () => {
  assert.equal(isValidGstin('27AAACT2727Q1ZX'), false);
});

test('isValidGstin rejects malformed values and invalid state codes', () => {
  assert.equal(isValidGstin(''), false);
  assert.equal(isValidGstin('27AAACT2727Q1Z'), false);
  assert.equal(isValidGstin('00AAACT2727Q1ZW'), false);
  assert.equal(isValidGstin('39AAACT2727Q1ZW'), false);
  assert.equal(isValidGstin('27AAACT2727Q1Z!'), false);
});

test('normalizeGstin trims whitespace and uppercases the value', () => {
  assert.equal(normalizeGstin(' 27aaact2727q1zw '), '27AAACT2727Q1ZW');
  assert.equal(normalizeGstin(null), '');
  assert.equal(normalizeGstin(undefined), '');
});
