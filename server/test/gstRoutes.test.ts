import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import type {
  GstFilingHistoryResult,
  GstVerificationResult,
} from '../../shared/gst.js';
import { createApp } from '../src/app.js';
import type { GstRouterDependencies } from '../src/routes/gst.js';
import { GstProviderError } from '../src/services/gstProvider.js';

const GSTIN = '33AAACC1206D1ZN';
const RETRIEVED_AT = '2026-10-31T05:00:00.000Z';

const verification: GstVerificationResult = {
  provider: 'gstinapi.in',
  endpoint: `/v1/gstin/${GSTIN}`,
  retrievedAt: RETRIEVED_AT,
  gstin: GSTIN,
  creditsRemaining: 17,
  profile: {
    gstin: GSTIN,
    legalName: 'SAMPLE TAXPAYER PRIVATE LIMITED',
    tradeName: 'SAMPLE TRADE',
    status: 'Active',
    taxpayerType: 'Regular',
    registrationDate: '2017-07-01',
    cancellationDate: null,
    stateCode: '33',
    address: '1 Sample Street',
    city: 'Chennai',
    pincode: '600001',
    blockStatus: 'Unblocked',
    addressDetails: null,
  },
};

const filingHistory: GstFilingHistoryResult = {
  provider: 'gstinapi.in',
  endpoint: `/v1/gstin/${GSTIN}/returns?fy=2025-26`,
  retrievedAt: RETRIEVED_AT,
  gstin: GSTIN,
  financialYear: '2025-26',
  creditsRemaining: 16,
  returns: [],
};

async function withServer<T>(
  dependencies: Partial<GstRouterDependencies>,
  run: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const server = createServer(
    createApp(async () => {}, {
      verifyGstin: async () => verification,
      getFilingHistory: async () => filingHistory,
      saveVerification: async () => {},
      saveFilingHistory: async () => {},
      now: () => new Date('2026-10-31T05:00:00.000Z'),
      ...dependencies,
    }),
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not determine test server address');
  }

  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('POST /api/gst/verify returns validated provider data and persists it', async () => {
  let savedGstin = '';

  await withServer(
    {
      saveVerification: async (result) => {
        savedGstin = result.gstin;
      },
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/gst/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin: GSTIN }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.data.persisted, true);
      assert.equal(body.data.gstin, GSTIN);
      assert.equal(
        body.data.profile.legalName,
        'SAMPLE TAXPAYER PRIVATE LIMITED',
      );
      assert.equal(body.data.profile.registrationDate, '2017-07-01');
      assert.equal(body.data.persistenceError, undefined);
      assert.doesNotMatch(JSON.stringify(body), /api[_-]?key|x-api-key/i);
    },
  );

  assert.equal(savedGstin, GSTIN);
});

test('POST /api/gst/verify reports a database failure without discarding provider data', async () => {
  await withServer(
    {
      saveVerification: async () => {
        throw new Error('mysql: connection refused');
      },
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/gst/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin: GSTIN }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.data.persisted, false);
      assert.match(body.data.persistenceError, /could not be saved/i);
      assert.equal(body.data.gstin, GSTIN);
      assert.doesNotMatch(JSON.stringify(body), /connection refused/i);
    },
  );
});

test('POST /api/gst/verify rejects a missing GSTIN before calling the provider', async () => {
  let calls = 0;

  await withServer(
    {
      verifyGstin: async () => {
        calls += 1;
        return verification;
      },
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/gst/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.error.code, 'INVALID_GSTIN');
    },
  );

  assert.equal(calls, 0);
});

test('POST /api/gst/verify maps a provider 401 to a safe 502 response', async () => {
  await withServer(
    {
      verifyGstin: async () => {
        throw new GstProviderError(
          'PROVIDER_UNAUTHORIZED',
          'The GST provider credentials are missing or invalid.',
          401,
        );
      },
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/gst/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin: GSTIN }),
      });
      const body = await response.json();

      assert.equal(response.status, 502);
      assert.equal(body.error.code, 'PROVIDER_UNAUTHORIZED');
      assert.doesNotMatch(JSON.stringify(body), /test-provider-key/);
    },
  );
});

test('POST /api/gst/verify maps missing provider configuration to 503', async () => {
  await withServer(
    {
      verifyGstin: async () => {
        throw new GstProviderError(
          'PROVIDER_NOT_CONFIGURED',
          'GST verification is not configured on the server. Set GST_API_PROVIDER_KEY.',
        );
      },
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/gst/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin: GSTIN }),
      });
      const body = await response.json();

      assert.equal(response.status, 503);
      assert.equal(body.error.code, 'PROVIDER_NOT_CONFIGURED');
    },
  );
});

test('POST /api/gst/verify maps rate limiting, timeouts and all-provider failures', async () => {
  const cases = [
    {
      error: new GstProviderError('RATE_LIMITED', 'Rate limited.', 429, true),
      status: 429,
      code: 'RATE_LIMITED',
    },
    {
      error: new GstProviderError('PROVIDER_TIMEOUT', 'Timed out.'),
      status: 504,
      code: 'PROVIDER_TIMEOUT',
    },
    {
      error: new GstProviderError('PROVIDER_NETWORK_ERROR', 'Unreachable.'),
      status: 502,
      code: 'PROVIDER_NETWORK_ERROR',
    },
    {
      error: new GstProviderError('INVALID_PROVIDER_RESPONSE', 'Malformed.'),
      status: 502,
      code: 'INVALID_PROVIDER_RESPONSE',
    },
  ];

  for (const entry of cases) {
    await withServer(
      {
        verifyGstin: async () => {
          throw entry.error;
        },
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/gst/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gstin: GSTIN }),
        });
        const body = await response.json();

        assert.equal(response.status, entry.status);
        assert.equal(body.error.code, entry.code);
      },
    );
  }
});

test('GET /api/gst/filings returns provider filing history and persists it', async () => {
  let savedYear = '';

  await withServer(
    {
      getFilingHistory: async (_gstin, financialYear) => ({
        ...filingHistory,
        financialYear,
        endpoint: `/v1/gstin/${GSTIN}/returns?fy=${financialYear}`,
      }),
      saveFilingHistory: async (result) => {
        savedYear = result.financialYear;
      },
    },
    async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/gst/filings?gstin=${GSTIN}&fy=2025-26`,
      );
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.data.persisted, true);
      assert.equal(body.data.financialYear, '2025-26');
      assert.deepEqual(body.data.returns, []);
    },
  );

  assert.equal(savedYear, '2025-26');
});

test('GET /api/gst/filings reports a database failure honestly', async () => {
  await withServer(
    {
      saveFilingHistory: async () => {
        throw new Error('mysql: connection refused');
      },
    },
    async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/gst/filings?gstin=${GSTIN}&fy=2025-26`,
      );
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.data.persisted, false);
      assert.match(body.data.persistenceError, /could not be saved/i);
    },
  );
});

test('GET /api/gst/filings limits the selector to the current and previous two financial years', async () => {
  let calls = 0;

  await withServer(
    {
      getFilingHistory: async () => {
        calls += 1;
        return filingHistory;
      },
    },
    async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/gst/filings?gstin=${GSTIN}&fy=2020-21`,
      );
      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.error.code, 'INVALID_FINANCIAL_YEAR');
      assert.match(body.error.message, /2026-27/);
      assert.match(body.error.message, /2025-26/);
      assert.match(body.error.message, /2024-25/);
    },
  );

  assert.equal(calls, 0);
});

test('GET /api/gst/filings keeps a provider failure as a failure', async () => {
  await withServer(
    {
      getFilingHistory: async () => {
        throw new GstProviderError(
          'PROVIDER_UNAVAILABLE',
          'The GST provider is temporarily unavailable.',
          502,
          true,
        );
      },
    },
    async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/gst/filings?gstin=${GSTIN}&fy=2025-26`,
      );
      const body = await response.json();

      assert.equal(response.status, 502);
      assert.equal(body.error.code, 'PROVIDER_UNAVAILABLE');
      assert.equal(body.error.retryable, true);
    },
  );
});

test('GET /api/gst/filings rejects an invalid GSTIN through the provider layer', async () => {
  await withServer(
    {
      getFilingHistory: async () => {
        throw new GstProviderError(
          'INVALID_GSTIN',
          'The GSTIN format or check digit is invalid.',
          400,
        );
      },
    },
    async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/gst/filings?gstin=27AAACB0395M1Z9&fy=2025-26`,
      );
      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.error.code, 'INVALID_GSTIN');
    },
  );
});
