import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GstProviderError,
  getFilingHistory,
  verifyGstin,
} from '../src/services/gstProvider.js';

const GSTIN = '33AAACC1206D1ZN';
const BASE_URL = 'https://gst.example.test';
const NOW = new Date('2026-10-31T05:00:00.000Z');

const baseOptions = {
  apiKey: 'test-provider-key',
  baseUrl: BASE_URL,
  timeoutMs: 5_000,
  now: () => NOW,
  sleep: async () => {},
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function successfulProfile(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    gstin: GSTIN,
    credits_remaining: 42,
    data: {
      gstin: GSTIN,
      legal_name: 'SAMPLE TAXPAYER PRIVATE LIMITED',
      trade_name: 'SAMPLE TRADE',
      status: 'Active',
      taxpayer_type: 'Regular',
      registration_date: '2017-07-01',
      cancellation_date: null,
      state_code: '33',
      address: '1 Sample Street',
      city: 'Chennai',
      pincode: '600001',
      block_status: 'Unblocked',
      address_details: {
        building_number: '1',
        building_name: 'Sample Tower',
        floor: '2',
        street: 'Sample Street',
        locality: 'Sample Locality',
        district: 'Chennai',
        city: 'Chennai',
        state: 'Tamil Nadu',
        landmark: null,
        pincode: '600001',
      },
      ...overrides,
    },
  };
}

async function expectProviderError(
  action: () => Promise<unknown>,
  code: string,
): Promise<GstProviderError> {
  try {
    await action();
  } catch (error) {
    assert.ok(error instanceof GstProviderError);
    assert.equal(error.code, code);
    return error;
  }
  assert.fail(`Expected a GstProviderError with code ${code}`);
}

test('verifyGstin rejects an invalid GSTIN before calling the provider', async () => {
  let calls = 0;
  const error = await expectProviderError(
    () =>
      verifyGstin('27AAACB0395M1Z9', {
        ...baseOptions,
        fetchImpl: (async () => {
          calls += 1;
          return jsonResponse(successfulProfile());
        }) as typeof fetch,
      }),
    'INVALID_GSTIN',
  );

  assert.equal(error.httpStatus, 400);
  assert.equal(calls, 0);
});

test('verifyGstin maps a valid provider response and sends the API key server-side', async () => {
  let capturedUrl = '';
  let capturedKey = '';

  const result = await verifyGstin(GSTIN, {
    ...baseOptions,
    fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedKey = String(
        (init?.headers as Record<string, string> | undefined)?.['x-api-key'],
      );
      return jsonResponse(successfulProfile());
    }) as typeof fetch,
  });

  assert.equal(capturedUrl, `${BASE_URL}/v1/gstin/${GSTIN}`);
  assert.equal(capturedKey, 'test-provider-key');
  assert.equal(result.provider, 'gstinapi.in');
  assert.equal(result.endpoint, `/v1/gstin/${GSTIN}`);
  assert.equal(result.gstin, GSTIN);
  assert.equal(result.retrievedAt, NOW.toISOString());
  assert.equal(result.creditsRemaining, 42);
  assert.equal(result.profile.legalName, 'SAMPLE TAXPAYER PRIVATE LIMITED');
  assert.equal(result.profile.status, 'Active');
  assert.equal(result.profile.addressDetails?.district, 'Chennai');
  assert.doesNotMatch(JSON.stringify(result), /test-provider-key/);
});

test('verifyGstin rejects a provider response for a different GSTIN', async () => {
  await expectProviderError(
    () =>
      verifyGstin(GSTIN, {
        ...baseOptions,
        fetchImpl: (async () =>
          jsonResponse(
            successfulProfile({ gstin: '24APLPV0398G1ZH' }),
          )) as typeof fetch,
      }),
    'INVALID_PROVIDER_RESPONSE',
  );
});

test('verifyGstin rejects malformed JSON', async () => {
  await expectProviderError(
    () =>
      verifyGstin(GSTIN, {
        ...baseOptions,
        fetchImpl: (async () =>
          new Response('<html>not json</html>', { status: 200 })) as typeof fetch,
      }),
    'INVALID_PROVIDER_RESPONSE',
  );
});

test('verifyGstin rejects a response missing required taxpayer fields', async () => {
  await expectProviderError(
    () =>
      verifyGstin(GSTIN, {
        ...baseOptions,
        fetchImpl: (async () =>
          jsonResponse(successfulProfile({ legal_name: null }))) as typeof fetch,
      }),
    'INVALID_PROVIDER_RESPONSE',
  );
});

test('verifyGstin keeps optional missing fields as null instead of inventing values', async () => {
  const result = await verifyGstin(GSTIN, {
    ...baseOptions,
    fetchImpl: (async () =>
      jsonResponse(
        successfulProfile({
          trade_name: undefined,
          taxpayer_type: undefined,
          registration_date: undefined,
          cancellation_date: undefined,
          state_code: undefined,
          address: undefined,
          city: undefined,
          pincode: undefined,
          block_status: undefined,
          address_details: undefined,
        }),
      )) as typeof fetch,
  });

  assert.equal(result.profile.tradeName, null);
  assert.equal(result.profile.taxpayerType, null);
  assert.equal(result.profile.registrationDate, null);
  assert.equal(result.profile.cancellationDate, null);
  assert.equal(result.profile.stateCode, null);
  assert.equal(result.profile.address, null);
  assert.equal(result.profile.city, null);
  assert.equal(result.profile.pincode, null);
  assert.equal(result.profile.blockStatus, null);
  assert.equal(result.profile.addressDetails, null);
});

test('verifyGstin maps a 401 response without exposing provider internals', async () => {
  const error = await expectProviderError(
    () =>
      verifyGstin(GSTIN, {
        ...baseOptions,
        fetchImpl: (async () =>
          jsonResponse({ error: 'invalid key' }, 401)) as typeof fetch,
      }),
    'PROVIDER_UNAUTHORIZED',
  );

  assert.equal(error.httpStatus, 401);
  assert.doesNotMatch(error.message, /test-provider-key/);
});

test('verifyGstin maps a 403 response to an inactive account', async () => {
  await expectProviderError(
    () =>
      verifyGstin(GSTIN, {
        ...baseOptions,
        fetchImpl: (async () =>
          jsonResponse({ error: 'deactivated' }, 403)) as typeof fetch,
      }),
    'ACCOUNT_INACTIVE',
  );
});

test('verifyGstin maps a 402 response to exhausted credits', async () => {
  await expectProviderError(
    () =>
      verifyGstin(GSTIN, {
        ...baseOptions,
        fetchImpl: (async () =>
          jsonResponse({ error: 'out of credits' }, 402)) as typeof fetch,
      }),
    'CREDITS_EXHAUSTED',
  );
});

test('verifyGstin retries 429 three times and then reports rate limiting', async () => {
  let calls = 0;
  const error = await expectProviderError(
    () =>
      verifyGstin(GSTIN, {
        ...baseOptions,
        fetchImpl: (async () => {
          calls += 1;
          return jsonResponse({ error: 'rate limited' }, 429);
        }) as typeof fetch,
      }),
    'RATE_LIMITED',
  );

  assert.equal(calls, 3);
  assert.equal(error.retryable, true);
});

test('verifyGstin retries a 502 outage and succeeds on the next attempt', async () => {
  let calls = 0;
  const result = await verifyGstin(GSTIN, {
    ...baseOptions,
    fetchImpl: (async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({ error: 'outage' }, 502);
      return jsonResponse(successfulProfile());
    }) as typeof fetch,
  });

  assert.equal(calls, 2);
  assert.equal(result.gstin, GSTIN);
});

test('verifyGstin reports a request timeout', async () => {
  const error = await expectProviderError(
    () =>
      verifyGstin(GSTIN, {
        ...baseOptions,
        fetchImpl: (async () => {
          const abortError = new Error('aborted');
          abortError.name = 'AbortError';
          throw abortError;
        }) as typeof fetch,
      }),
    'PROVIDER_TIMEOUT',
  );

  assert.doesNotMatch(error.message, /test-provider-key/);
});

test('verifyGstin reports a network failure as a provider failure', async () => {
  await expectProviderError(
    () =>
      verifyGstin(GSTIN, {
        ...baseOptions,
        fetchImpl: (async () => {
          throw new Error('socket hang up');
        }) as typeof fetch,
      }),
    'PROVIDER_NETWORK_ERROR',
  );
});

test('verifyGstin refuses to run when the provider key is missing', async () => {
  let calls = 0;
  await expectProviderError(
    () =>
      verifyGstin(GSTIN, {
        ...baseOptions,
        apiKey: '',
        fetchImpl: (async () => {
          calls += 1;
          return jsonResponse(successfulProfile());
        }) as typeof fetch,
      }),
    'PROVIDER_NOT_CONFIGURED',
  );

  assert.equal(calls, 0);
});

test('getFilingHistory maps returns and enforces the requested financial year', async () => {
  let capturedUrl = '';
  const result = await getFilingHistory(GSTIN, '2025-26', {
    ...baseOptions,
    fetchImpl: (async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return jsonResponse({
        success: true,
        gstin: GSTIN,
        fy: '2025-26',
        credits_remaining: 10,
        returns: [
          {
            return_type: 'GSTR-3B',
            return_period: '2025-04',
            filing_status: 'Filed',
            filing_date: '20/05/2025',
            arn: 'AA330425000001',
          },
        ],
      });
    }) as typeof fetch,
  });

  assert.equal(
    capturedUrl,
    `${BASE_URL}/v1/gstin/${GSTIN}/returns?fy=2025-26`,
  );
  assert.equal(result.financialYear, '2025-26');
  assert.equal(result.returns.length, 1);
  assert.deepEqual(result.returns[0], {
    returnType: 'GSTR-3B',
    returnPeriod: '2025-04',
    filingStatus: 'Filed',
    filingDate: '20/05/2025',
    arn: 'AA330425000001',
  });
});

test('getFilingHistory preserves an empty provider result as empty', async () => {
  const result = await getFilingHistory(GSTIN, '2025-26', {
    ...baseOptions,
    fetchImpl: (async () =>
      jsonResponse({
        success: true,
        gstin: GSTIN,
        fy: '2025-26',
        credits_remaining: 10,
        returns: [],
      })) as typeof fetch,
  });

  assert.deepEqual(result.returns, []);
});

test('getFilingHistory rejects a response for a different financial year', async () => {
  await expectProviderError(
    () =>
      getFilingHistory(GSTIN, '2025-26', {
        ...baseOptions,
        fetchImpl: (async () =>
          jsonResponse({
            success: true,
            gstin: GSTIN,
            fy: '2024-25',
            returns: [],
          })) as typeof fetch,
      }),
    'INVALID_PROVIDER_RESPONSE',
  );
});

test('getFilingHistory rejects a response without a returns array', async () => {
  await expectProviderError(
    () =>
      getFilingHistory(GSTIN, '2025-26', {
        ...baseOptions,
        fetchImpl: (async () =>
          jsonResponse({
            success: true,
            gstin: GSTIN,
            fy: '2025-26',
            returns: null,
          })) as typeof fetch,
      }),
    'INVALID_PROVIDER_RESPONSE',
  );
});

test('getFilingHistory validates the financial year before calling the provider', async () => {
  let calls = 0;
  await expectProviderError(
    () =>
      getFilingHistory(GSTIN, '2025/26', {
        ...baseOptions,
        fetchImpl: (async () => {
          calls += 1;
          return jsonResponse({ success: true, gstin: GSTIN, fy: '2025-26', returns: [] });
        }) as typeof fetch,
      }),
    'INVALID_FINANCIAL_YEAR',
  );

  assert.equal(calls, 0);
});
