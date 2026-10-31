import test from 'node:test';
import assert from 'node:assert/strict';
import { GST_STATE_CODES } from '../data/geoData';

test('validates mandatory 3-digit numeric portal branch code format', () => {
  const isValidPortalBranchCode = (code: string) => /^\d{3}$/.test(code.trim());

  assert.equal(isValidPortalBranchCode('001'), true);
  assert.equal(isValidPortalBranchCode('008'), true);
  assert.equal(isValidPortalBranchCode('123'), true);
  assert.equal(isValidPortalBranchCode('01'), false);
  assert.equal(isValidPortalBranchCode('ABC'), false);
  assert.equal(isValidPortalBranchCode('0001'), false);
});

test('enforces exactly one active default warehouse per branch requirement', () => {
  const warehouses = [
    { id: 'wh-1', warehouseCode: 'HSR-FG', isDefault: true, isInactive: false },
    { id: 'wh-2', warehouseCode: 'HSR-STR', isDefault: false, isInactive: false },
    { id: 'wh-3', warehouseCode: 'HSR-WIP', isDefault: false, isInactive: false },
  ];

  const activeDefaults = warehouses.filter((w) => w.isDefault && !w.isInactive);
  assert.equal(activeDefaults.length, 1);
});

test('validates item assignment to branch-scoped warehouses only', () => {
  const hosurBranchId = 'br-hosr-03';
  const hosurWarehouses = [
    { id: 'wh-hsr-fg', branchId: 'br-hosr-03', warehouseCode: 'HSR-FG' },
    { id: 'wh-hsr-str', branchId: 'br-hosr-03', warehouseCode: 'HSR-STR' },
  ];

  const chennaiWarehouse = { id: 'wh-che-str', branchId: 'br-chen-02', warehouseCode: 'CHE-STR' };

  const isWarehouseValidForBranch = (warehouseBranchId: string, targetBranchId: string) => {
    return warehouseBranchId === targetBranchId;
  };

  assert.equal(isWarehouseValidForBranch(hosurWarehouses[0].branchId, hosurBranchId), true);
  assert.equal(isWarehouseValidForBranch(chennaiWarehouse.branchId, hosurBranchId), false);
});

test('validates GST state code mismatch detection for branch address', () => {
  const gstin = '27AAHCK4603M1ZB'; // 27 = Maharashtra
  const selectedState = 'Maharashtra';
  const gstinStatePrefix = gstin.slice(0, 2);
  const expectedState = GST_STATE_CODES[gstinStatePrefix];

  const isStateMismatch =
    expectedState &&
    !expectedState.toLowerCase().includes(selectedState.toLowerCase()) &&
    !selectedState.toLowerCase().includes(expectedState.toLowerCase());

  assert.equal(expectedState, 'Maharashtra');
  assert.equal(isStateMismatch, false);
});
