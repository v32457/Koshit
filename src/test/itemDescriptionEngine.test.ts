import test from 'node:test';
import assert from 'node:assert/strict';
import { generateItemDescription } from '../services/itemDescriptionEngine';
import { INITIAL_DESCRIPTION_RULES } from '../data/seedData';

test('generates Raw Material description omitting empty segments cleanly', () => {
  const rmRule = INITIAL_DESCRIPTION_RULES.find((r) => r.categoryCode === 'RM')!;
  const result = generateItemDescription(rmRule, {
    categoryCode: 'RM',
    materialName: 'PC-ABS',
    specification: 'Item Name',
    colourName: 'Light Grey',
    materialFormName: 'Powder',
  });

  assert.equal(result.description, 'PC-ABS – Item Name – Light Grey – Powder');
  assert.equal(result.isWithinLimit, true);
});

test('generates Finished Goods description without leaving dangling delimiters', () => {
  const fgRule = INITIAL_DESCRIPTION_RULES.find((r) => r.categoryCode === 'FG')!;
  const result = generateItemDescription(fgRule, {
    categoryCode: 'FG',
    materialName: 'HDPE',
    specification: 'Item Name',
    colourName: 'Grey',
  });

  assert.equal(result.description, 'HDPE – Item Name – Grey');
  assert.equal(result.warnings.length, 0);
});

test('handles missing optional fields cleanly without double hyphens', () => {
  const fgRule = INITIAL_DESCRIPTION_RULES.find((r) => r.categoryCode === 'FG')!;
  const result = generateItemDescription(fgRule, {
    categoryCode: 'FG',
    materialName: 'HDPE',
    specification: '', // blank
    colourName: 'Black',
  });

  assert.equal(result.description, 'HDPE – Black');
});
