import test from 'node:test';
import assert from 'node:assert/strict';
import { generateItemCode } from '../services/itemCodeEngine';
import { INITIAL_ITEM_CODE_RULES } from '../data/seedData';

test('generates exact Raw Material code matching specification: RMPAOPOEXLG0001', () => {
  const rule = INITIAL_ITEM_CODE_RULES[0];
  const result = generateItemCode(rule, {
    categoryCode: 'RM',
    materialCode: 'PA',
    typeCode: 'O',
    materialFormCode: 'PO',
    processCode: 'EX',
    colourCode: 'LG',
    sequenceNumber: 1,
  });

  assert.equal(result.code, 'RMPAOPOEXLG0001');
  assert.equal(result.errors.length, 0);
  assert.equal(result.length, 15);
});

test('generates exact Finished Goods code matching specification: FGHDMCRGY0002', () => {
  const rule = INITIAL_ITEM_CODE_RULES[0];
  const result = generateItemCode(rule, {
    categoryCode: 'FG',
    materialCode: 'HD',
    typeCode: 'M',
    processCode: 'CR',
    colourCode: 'GY',
    sequenceNumber: 2,
  });

  assert.equal(result.code, 'FGHDMCRGY0002');
  assert.equal(result.errors.length, 0);
});

test('generates exact Maintenance / Spares code matching specification: MAPALBL0003', () => {
  const rule = INITIAL_ITEM_CODE_RULES[0];
  const result = generateItemCode(rule, {
    categoryCode: 'MA',
    materialCode: 'PA',
    typeCode: 'L',
    colourCode: 'BL',
    sequenceNumber: 3,
  });

  assert.equal(result.code, 'MAPALBL0003');
  assert.equal(result.errors.length, 0);
});

test('validates missing required component', () => {
  const rule = INITIAL_ITEM_CODE_RULES[0];
  const result = generateItemCode(rule, {
    categoryCode: '', // Missing required category
    materialCode: 'PP',
    sequenceNumber: 10,
  });

  assert.ok(result.errors.length > 0);
  assert.ok(result.errors[0].includes('Missing required component'));
});
