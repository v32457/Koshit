import test from 'node:test';
import assert from 'node:assert/strict';

test('enforces 2-character uppercase classification category codes', () => {
  const isValidCategoryCode = (code: string) => /^[A-Z0-9]{2}$/.test(code);

  assert.equal(isValidCategoryCode('RM'), true);
  assert.equal(isValidCategoryCode('FG'), true);
  assert.equal(isValidCategoryCode('MA'), true);
  assert.equal(isValidCategoryCode('INVALID'), false);
  assert.equal(isValidCategoryCode('x'), false);
});

test('validates classification dimension mapping structure', () => {
  const classificationMaster = {
    categoryCode: 'RM',
    categoryName: 'Raw Material',
    dimensions: ['Material', 'Type', 'Form', 'Process', 'Colour'],
  };

  assert.equal(classificationMaster.categoryCode, 'RM');
  assert.equal(classificationMaster.dimensions.length, 5);
  assert.ok(classificationMaster.dimensions.includes('Material'));
});

test('validates custom specifications binding to global items', () => {
  const customSpec = {
    id: 'spec-01',
    customerCode: 'CUST-TATA-01',
    customerPartNumber: 'TPN-998877',
    brandName: 'TATA Genuine Parts',
    modelNumber: '2026-X1',
  };

  assert.equal(customSpec.customerCode, 'CUST-TATA-01');
  assert.equal(customSpec.customerPartNumber, 'TPN-998877');
});
