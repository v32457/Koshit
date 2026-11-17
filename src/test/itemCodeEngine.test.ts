import test from 'node:test';
import assert from 'node:assert/strict';
import { generateItemCode } from '../services/itemCodeEngine';
import { INITIAL_ITEM_CODE_RULES } from '../data/seedData';

test('generates exact Material code matching specification without category: PAOPOEXLG0001', () => {
  const rule = INITIAL_ITEM_CODE_RULES[0];
  const result = generateItemCode(rule, {
    materialCode: 'PA',
    typeCode: 'O',
    materialFormCode: 'PO',
    processCode: 'EX',
    colourCode: 'LG',
    sequenceNumber: 1,
  });

  assert.equal(result.code, 'PAOPOEXLG0001');
  assert.equal(result.errors.length, 0);
  assert.equal(result.length, 13);
});

test('generates exact code without category: HDMCRGY0002', () => {
  const rule = INITIAL_ITEM_CODE_RULES[0];
  const result = generateItemCode(rule, {
    materialCode: 'HD',
    typeCode: 'M',
    processCode: 'CR',
    colourCode: 'GY',
    sequenceNumber: 2,
  });

  assert.equal(result.code, 'HDMCRGY0002');
  assert.equal(result.errors.length, 0);
});

test('validates missing required component (material)', () => {
  const rule = INITIAL_ITEM_CODE_RULES[0];
  const result = generateItemCode(rule, {
    materialCode: '', // Missing required material
    sequenceNumber: 10,
  });

  assert.ok(result.errors.length > 0);
  assert.ok(result.errors[0].includes('Missing required component'));
});
