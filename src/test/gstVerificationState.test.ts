import assert from 'node:assert/strict';
import test from 'node:test';
import type { BPGovernanceLog, BusinessPartner } from '../types';
import type { GstVerificationResult } from '../../shared/gst';
import {
  isStoredVerification,
  normalizeStoredPartners,
} from '../services/gstVerificationState';

const GSTIN = '33AAACC1206D1ZN';

const verifiedResult: GstVerificationResult = {
  provider: 'gstinapi.in',
  endpoint: `/v1/gstin/${GSTIN}`,
  retrievedAt: '2026-10-31T06:30:00.000Z',
  gstin: GSTIN,
  creditsRemaining: 10,
  profile: {
    gstin: GSTIN,
    legalName: 'Example Legal Name Private Limited',
    tradeName: 'Example Trading',
    status: 'Active',
    taxpayerType: 'Regular',
    registrationDate: '2017-07-01',
    cancellationDate: null,
    stateCode: '33',
    address: '1 Example Street',
    city: 'Chennai',
    pincode: '600001',
    blockStatus: 'Unblocked',
    addressDetails: null,
  },
};

function governanceLog(overrides: Partial<BPGovernanceLog>): BPGovernanceLog {
  return {
    id: 'gov-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    action: 'GSTIN Verification',
    verifier: 'Some User',
    details: 'Legitimate internal note.',
    status: 'VERIFIED',
    ...overrides,
  };
}

function partner(overrides: Partial<BusinessPartner> = {}): BusinessPartner {
  return {
    id: 'bp-1',
    bpCode: 'BP-0001',
    bpName: 'Example Trading Co',
    bpType: 'SUPPLIER',
    gstinPan: GSTIN,
    gstStatus: 'UNVERIFIED',
    phone: '+91 44 0000 0000',
    email: 'accounts@example.test',
    city: 'Chennai',
    state: 'Tamil Nadu',
    status: 'ACTIVE',
    sapSyncStatus: 'SYNCED',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'tester',
    ...overrides,
  };
}

test('isStoredVerification accepts a complete matching provider result', () => {
  assert.equal(isStoredVerification(verifiedResult), true);
});

test('isStoredVerification rejects legacy flags, mismatched profiles and invalid GSTINs', () => {
  assert.equal(isStoredVerification(undefined), false);
  assert.equal(isStoredVerification(null), false);
  assert.equal(isStoredVerification({}), false);
  assert.equal(
    isStoredVerification({
      ...verifiedResult,
      retrievedAt: 'not-a-date',
    }),
    false,
  );
  assert.equal(
    isStoredVerification({
      ...verifiedResult,
      profile: { ...verifiedResult.profile, gstin: '27AAPFU0939F1ZV' },
    }),
    false,
  );
  assert.equal(
    isStoredVerification({
      ...verifiedResult,
      gstin: 'INVALID',
      profile: { ...verifiedResult.profile, gstin: 'INVALID' },
    }),
    false,
  );
  assert.equal(
    isStoredVerification({
      ...verifiedResult,
      profile: { ...verifiedResult.profile, legalName: '   ' },
    }),
    false,
  );
});

test('normalizeStoredPartners downgrades VERIFIED records without provider evidence and removes fabricated logs', () => {
  const fabricated = governanceLog({
    id: 'gov-fake',
    action: 'GSTIN Verification',
    verifier: 'Govt GSTN Portal Gateway',
    details: 'GSTIN validated by the government gateway.',
  });
  const legitimate = governanceLog({ id: 'gov-real' });

  const [result] = normalizeStoredPartners([
    partner({
      gstStatus: 'VERIFIED',
      governanceLogs: [fabricated, legitimate],
    }),
  ]);

  assert.equal(result.gstStatus, 'UNVERIFIED');
  assert.equal(result.gstVerification, undefined);
  assert.deepEqual(result.governanceLogs?.map((log) => log.id), ['gov-real']);
});

test('normalizeStoredPartners keeps provider-backed verification and removes only fabricated logs', () => {
  const [result] = normalizeStoredPartners([
    partner({
      gstStatus: 'VERIFIED',
      gstVerification: verifiedResult,
      governanceLogs: [
        governanceLog({
          id: 'gov-fake',
          action: 'Government GST lookup',
          verifier: 'System',
        }),
        governanceLog({ id: 'gov-real' }),
      ],
    }),
  ]);

  assert.equal(result.gstStatus, 'VERIFIED');
  assert.deepEqual(result.gstVerification, verifiedResult);
  assert.deepEqual(result.governanceLogs?.map((log) => log.id), ['gov-real']);
});

test('normalizeStoredPartners treats mismatched verification metadata as unverified', () => {
  const [result] = normalizeStoredPartners([
    partner({
      gstStatus: 'VERIFIED',
      gstVerification: {
        ...verifiedResult,
        profile: { ...verifiedResult.profile, gstin: '27AAPFU0939F1ZV' },
      },
    }),
  ]);

  assert.equal(result.gstStatus, 'UNVERIFIED');
  assert.equal(result.gstVerification, undefined);
});

test('normalizeStoredPartners leaves non-VERIFIED statuses and empty log arrays intact', () => {
  const [result] = normalizeStoredPartners([
    partner({ gstStatus: 'EXEMPT', governanceLogs: undefined }),
  ]);

  assert.equal(result.gstStatus, 'EXEMPT');
  assert.deepEqual(result.governanceLogs, []);
});
