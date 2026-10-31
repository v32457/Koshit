import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGstPrintHtml, printGstData } from '../services/gstPrint';
import type { GstVerificationResult } from '../../shared/gst';
import type { BusinessPartner } from '../types';

const businessPartner: BusinessPartner = {
  id: 'bp-1',
  bpCode: 'BP-0001',
  bpName: 'Example Trading Co',
  bpType: 'SUPPLIER',
  gstinPan: '33AAACC1206D1ZN',
  gstStatus: 'VERIFIED',
  phone: '+91 44 0000 0000',
  email: 'accounts@example.test',
  city: 'Chennai',
  state: 'Tamil Nadu',
  status: 'ACTIVE',
  sapSyncStatus: 'SYNCED',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'tester',
};

const verification: GstVerificationResult = {
  provider: 'gstinapi.in',
  endpoint: 'https://www.gstinapi.in/v1/gstin/33AAACC1206D1ZN',
  retrievedAt: '2026-10-31T06:30:00.000Z',
  gstin: '33AAACC1206D1ZN',
  creditsRemaining: 42,
  profile: {
    gstin: '33AAACC1206D1ZN',
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

const filingHistory = {
  financialYear: '2026-27',
  retrievedAt: '2026-10-31T06:31:00.000Z',
  returns: [
    {
      returnType: 'GSTR-3B',
      returnPeriod: '2026-09',
      filingStatus: 'Filed',
      filingDate: '2026-10-20',
      arn: 'AA332026000001',
    },
  ],
};

test('print HTML uses the actual displayed verification and filing values', () => {
  const html = buildGstPrintHtml({ businessPartner, verification, filingHistory });

  assert.match(html, /Example Trading Co/);
  assert.match(html, /BP-0001/);
  assert.match(html, /33AAACC1206D1ZN/);
  assert.match(html, /Example Legal Name Private Limited/);
  assert.match(html, /Example Trading/);
  assert.match(html, /Regular/);
  assert.match(html, /2017-07-01/);
  assert.match(html, /1 Example Street/);
  assert.match(html, /600001/);

  assert.match(html, /GSTR-3B/);
  assert.match(html, /2026-09/);
  assert.match(html, /Filed/);
  assert.match(html, /2026-10-20/);
  assert.match(html, /AA332026000001/);
  assert.match(html, /FY 2026-27/);
});

test('print HTML labels missing optional provider fields as Unavailable', () => {
  const html = buildGstPrintHtml({
    businessPartner,
    verification: {
      ...verification,
      profile: {
        ...verification.profile,
        tradeName: null,
        cancellationDate: null,
        taxpayerType: null,
        address: null,
        city: null,
        pincode: null,
        blockStatus: null,
      },
    },
    filingHistory,
  });

  assert.match(html, /<th>Trade name<\/th><td>Unavailable<\/td>/);
  assert.match(html, /<th>Cancellation date<\/th><td>Unavailable<\/td>/);
  assert.match(html, /<th>Taxpayer type<\/th><td>Unavailable<\/td>/);
  assert.match(html, /<th>Registered address<\/th><td>Unavailable<\/td>/);
});

test('print HTML escapes provider and partner values before rendering', () => {
  const html = buildGstPrintHtml({
    businessPartner: {
      ...businessPartner,
      bpName: 'Example <script>alert("bp")</script>',
    },
    verification: {
      ...verification,
      profile: {
        ...verification.profile,
        legalName: 'Legal <img src=x onerror="alert(1)">',
        address: "1 <Street> & 'Lane'",
      },
    },
    filingHistory: {
      ...filingHistory,
      returns: [
        {
          ...filingHistory.returns[0],
          arn: '<b>ARN</b>',
        },
      ],
    },
  });

  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /1 &lt;Street&gt; &amp; &#39;Lane&#39;/);
  assert.match(html, /&lt;b&gt;ARN&lt;\/b&gt;/);
});

test('print HTML reports an empty provider filing history without inventing records', () => {
  const html = buildGstPrintHtml({
    businessPartner,
    verification,
    filingHistory: { ...filingHistory, returns: [] },
  });

  assert.match(html, /The provider returned no filing records for this financial year\./);
  assert.doesNotMatch(html, /GSTR-3B/);
});

test('print HTML states when filing history was not loaded', () => {
  const html = buildGstPrintHtml({ businessPartner, verification, filingHistory: null });

  assert.match(html, /Filing history was not loaded\./);
  assert.doesNotMatch(html, /FY 2026-27/);
});

test('print HTML identifies the data as third-party and not an official certificate', () => {
  const html = buildGstPrintHtml({ businessPartner, verification, filingHistory });

  assert.match(html, /Third-party GST data retrieved from gstinapi\.in/);
  assert.match(html, /not an official GST certificate/);
  assert.match(html, /Verify details on the official GST portal/);
  assert.doesNotMatch(html, /Government of India certificate/i);
});

test('printGstData throws when the browser blocks the print window', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { open: () => null },
  });

  try {
    assert.throws(
      () => printGstData({ businessPartner, verification, filingHistory }),
      /The print window was blocked by the browser\./,
    );
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  }
});
