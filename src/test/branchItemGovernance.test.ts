import test from 'node:test';
import assert from 'node:assert/strict';
import { branchItemBackend } from '../../server/src/services/branchItemBackend.js';
import { uomConversionService } from '../services/uomConversionService';

test('Section F: Alternative items rejects self-reference', () => {
  const result = branchItemBackend.validateAlternativeItems('item-101', [
    {
      alternativeGlobalItemId: 'item-101',
      alternativeGlobalItemCode: 'RM-POL-PA-001',
      relationshipType: 'ALTERNATIVE',
      effectiveFrom: '2026-01-01',
      reason: 'Testing self reference',
    },
  ]);

  assert.equal(result.valid, false);
  assert.match(result.errors[0], /Self-Reference Error/);
});

test('Section F: Alternative items requires justification reason', () => {
  const result = branchItemBackend.validateAlternativeItems('item-101', [
    {
      alternativeGlobalItemId: 'item-202',
      alternativeGlobalItemCode: 'RM-POL-PA-002',
      relationshipType: 'ALTERNATIVE',
      effectiveFrom: '2026-01-01',
      reason: '   ',
    },
  ]);

  assert.equal(result.valid, false);
  assert.match(result.errors[0], /must specify a clear business justification/);
});

test('Section F: Valid alternative item succeeds', () => {
  const result = branchItemBackend.validateAlternativeItems('item-101', [
    {
      alternativeGlobalItemId: 'item-202',
      alternativeGlobalItemCode: 'RM-POL-PA-002',
      relationshipType: 'SUBSTITUTE',
      effectiveFrom: '2026-01-01',
      reason: 'Approved substitute from certified alternate vendor',
    },
  ]);

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('Section G: Attachments blocks unsafe script protocols', () => {
  const result = branchItemBackend.validateAttachments([
    {
      documentType: 'TECHNICAL_DATASHEET',
      fileName: 'spec.pdf',
      fileReference: 'javascript:alert("exploit")',
      documentVersion: 'v1.0',
      uploadedBy: 'Tester',
    },
  ]);

  assert.equal(result.valid, false);
  assert.match(result.errors[0], /Security Violation/);
});

test('Section G: Attachments enforces max size 25MB', () => {
  const result = branchItemBackend.validateAttachments([
    {
      documentType: 'ENGINEERING_DRAWING',
      fileName: 'assembly_cad.dwg',
      fileReference: '/assets/cad/assembly_cad.dwg',
      documentVersion: 'v2.1',
      uploadedBy: 'Tester',
      fileSizeBytes: 30 * 1024 * 1024, // 30MB
    },
  ]);

  assert.equal(result.valid, false);
  assert.match(result.errors[0], /exceeds max allowed attachment size/);
});

test('Section G: Valid attachments succeed', () => {
  const result = branchItemBackend.validateAttachments([
    {
      documentType: 'SAFETY_DATA_SHEET',
      fileName: 'msds_nylon.pdf',
      fileReference: '/assets/docs/msds_nylon.pdf',
      documentVersion: 'v1.0',
      uploadedBy: 'Tester',
      fileSizeBytes: 500 * 1024,
    },
  ]);

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('Section H: Barcode rejects blank values', async () => {
  const result = await branchItemBackend.validateBarcodes('co-kosh-01', 'br-pond-01', 'bia-01', [
    {
      barcodeValue: '   ',
      barcodeType: 'EAN13',
      effectiveFrom: '2026-01-01',
    },
  ]);

  assert.equal(result.valid, false);
  assert.match(result.errors[0], /Barcode value cannot be blank/);
});

test('Section H: Shared barcode requires justification', async () => {
  const result = await branchItemBackend.validateBarcodes('co-kosh-01', 'br-pond-01', 'bia-01', [
    {
      barcodeValue: '8901234567890',
      barcodeType: 'EAN13',
      effectiveFrom: '2026-01-01',
      isIntentionallyShared: true,
      sharedJustification: '',
    },
  ]);

  assert.equal(result.valid, false);
  assert.match(result.errors[0], /requires a non-empty shared justification/);
});

test('Section C: UOM exact decimal conversion validation', () => {
  // Same UOM => Factor must be 1.0
  const sameUomResult = uomConversionService.validateUomConversion({
    purchaseUom: 'KG',
    inventoryUom: 'KG',
    numerator: 1,
    denominator: 1,
  });
  assert.equal(sameUomResult.valid, true);
  assert.equal(sameUomResult.normalizedFactor, 1);

  // Different UOM within count/packaging
  const boxResult = uomConversionService.validateUomConversion({
    purchaseUom: 'BOX',
    inventoryUom: 'EA',
    numerator: 50,
    denominator: 1,
  });
  assert.equal(boxResult.valid, true);
  assert.equal(boxResult.normalizedFactor, 50);
});
