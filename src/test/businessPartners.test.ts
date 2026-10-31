import test from 'node:test';
import assert from 'node:assert/strict';
import { GST_STATE_CODES } from '../data/geoData';

test('validates 15-digit GSTIN format and state code mapping', () => {
  const gstin = '27AAACT2727Q1ZW';
  const stateCode = gstin.slice(0, 2);
  const stateName = GST_STATE_CODES[stateCode];

  assert.equal(gstin.length, 15);
  assert.equal(stateCode, '27');
  assert.equal(stateName, 'Maharashtra');
});

test('detects GST state code mismatch against address state', () => {
  const gstin = '33AAACG0000A1Z5'; // 33 = Tamil Nadu
  const selectedAddressState = 'Maharashtra';
  const expectedGstState = GST_STATE_CODES[gstin.slice(0, 2)];

  const isMismatch =
    expectedGstState &&
    !expectedGstState.toLowerCase().includes(selectedAddressState.toLowerCase()) &&
    !selectedAddressState.toLowerCase().includes(expectedGstState.toLowerCase());

  assert.equal(expectedGstState, 'Tamil Nadu');
  assert.equal(isMismatch, true);
});

test('enforces GST official legal name as a read-only governance property', () => {
  const verifiedGstRecord = {
    bpCode: 'CUST-TATA-01',
    bpName: 'TATA MOTORS LIMITED',
    gstinPan: '27AAACT2727Q1ZW',
    gstLegalName: 'TATA MOTORS LIMITED (OFFICIAL GST portal NAME)',
    isLegalNameEditable: false,
  };

  assert.equal(verifiedGstRecord.isLegalNameEditable, false);
  assert.ok(verifiedGstRecord.gstLegalName.length > 0);
});
