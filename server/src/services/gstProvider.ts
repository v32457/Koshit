import type {
  GstAddressDetails,
  GstFilingHistoryResult,
  GstFilingRecord,
  GstTaxpayerProfile,
  GstVerificationResult,
} from '../../../shared/gst.js';
import { isValidFinancialYear } from '../../../shared/financialYear.js';
import { isValidGstin, normalizeGstin } from '../../../shared/gstin.js';
import { env } from '../config/env.js';

export const GST_PROVIDER_NAME = 'gstinapi.in';

export type GstErrorCode =
  | 'INVALID_GSTIN'
  | 'INVALID_FINANCIAL_YEAR'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_UNAUTHORIZED'
  | 'CREDITS_EXHAUSTED'
  | 'ACCOUNT_INACTIVE'
  | 'GSTIN_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_NETWORK_ERROR'
  | 'INVALID_PROVIDER_RESPONSE'
  | 'PROVIDER_ERROR';

export class GstProviderError extends Error {
  constructor(
    public readonly code: GstErrorCode,
    message: string,
    public readonly httpStatus?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'GstProviderError';
  }
}

export type FetchLike = typeof fetch;

export interface ProviderOptions {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  fetchImpl?: FetchLike;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => Date;
}

interface ProviderRequestOptions extends ProviderOptions {
  path: string;
}

const RETRYABLE_STATUSES = new Set([429, 502]);
const MAX_ATTEMPTS = 3;

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function mapAddressDetails(value: unknown): GstAddressDetails | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const source = value as Record<string, unknown>;

  return {
    buildingNumber: stringOrNull(source.building_number),
    buildingName: stringOrNull(source.building_name),
    floor: stringOrNull(source.floor),
    street: stringOrNull(source.street),
    locality: stringOrNull(source.locality),
    district: stringOrNull(source.district),
    city: stringOrNull(source.city),
    state: stringOrNull(source.state),
    landmark: stringOrNull(source.landmark),
    pincode: stringOrNull(source.pincode),
  };
}

function mapProfile(value: unknown): GstTaxpayerProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GstProviderError(
      'INVALID_PROVIDER_RESPONSE',
      'The GST provider response did not contain a valid taxpayer profile.',
    );
  }

  const source = value as Record<string, unknown>;
  const gstin = normalizeGstin(stringOrNull(source.gstin));
  const legalName = stringOrNull(source.legal_name);
  const status = stringOrNull(source.status);

  if (!gstin || !legalName || !status) {
    throw new GstProviderError(
      'INVALID_PROVIDER_RESPONSE',
      'The GST provider response is missing the GSTIN, legal name, or registration status.',
    );
  }

  return {
    gstin,
    legalName,
    tradeName: stringOrNull(source.trade_name),
    status,
    taxpayerType: stringOrNull(source.taxpayer_type),
    registrationDate: stringOrNull(source.registration_date),
    cancellationDate: stringOrNull(source.cancellation_date),
    stateCode: stringOrNull(source.state_code),
    address: stringOrNull(source.address),
    city: stringOrNull(source.city),
    pincode: stringOrNull(source.pincode),
    blockStatus: stringOrNull(source.block_status),
    addressDetails: mapAddressDetails(source.address_details),
  };
}

function mapFilingRecord(value: unknown): GstFilingRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GstProviderError(
      'INVALID_PROVIDER_RESPONSE',
      'The GST provider returned an invalid return-filing record.',
    );
  }

  const source = value as Record<string, unknown>;
  const returnType = stringOrNull(source.return_type);
  const returnPeriod = stringOrNull(source.return_period);
  const filingStatus = stringOrNull(source.filing_status);

  if (
    !returnType ||
    !returnPeriod ||
    !filingStatus ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(returnPeriod)
  ) {
    throw new GstProviderError(
      'INVALID_PROVIDER_RESPONSE',
      'The GST provider returned a filing record without a valid return type, period, or status.',
    );
  }

  return {
    returnType,
    returnPeriod,
    filingStatus,
    filingDate: stringOrNull(source.filing_date),
    arn: stringOrNull(source.arn),
  };
}

function assertRequestedGstin(actual: unknown, requested: string): void {
  if (normalizeGstin(stringOrNull(actual)) !== requested) {
    throw new GstProviderError(
      'INVALID_PROVIDER_RESPONSE',
      'The GST provider returned a different GSTIN from the one requested.',
    );
  }
}

async function providerRequest(options: ProviderRequestOptions): Promise<Record<string, unknown>> {
  const {
    apiKey,
    baseUrl,
    path,
    timeoutMs,
    fetchImpl = fetch,
    sleep = defaultSleep,
  } = options;

  if (!apiKey) {
    throw new GstProviderError(
      'PROVIDER_NOT_CONFIGURED',
      'GST verification is not configured on the server. Set GST_API_PROVIDER_KEY.',
    );
  }

  const url = `${baseUrl.replace(/\/+$/, '')}${path}`;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;

    try {
      response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-api-key': apiKey,
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GstProviderError(
          'PROVIDER_TIMEOUT',
          'The GST provider did not respond before the request timed out.',
        );
      }

      throw new GstProviderError(
        'PROVIDER_NETWORK_ERROR',
        'The GST provider could not be reached.',
      );
    } finally {
      clearTimeout(timeout);
    }

    const bodyText = await response.text();
    let body: Record<string, unknown>;

    try {
      const parsed: unknown = bodyText ? JSON.parse(bodyText) : null;

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Response is not an object');
      }

      body = parsed as Record<string, unknown>;
    } catch {
      throw new GstProviderError(
        'INVALID_PROVIDER_RESPONSE',
        'The GST provider returned malformed JSON.',
        response.status,
      );
    }

    if (response.ok && body.success === true) {
      return body;
    }

    if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS - 1) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }

    if (retryableStatus(response.status)) {
      throw new GstProviderError(
        response.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_UNAVAILABLE',
        response.status === 429
          ? 'The GST provider rate limit was exceeded. Please retry later.'
          : 'The GST provider is temporarily unavailable.',
        response.status,
        true,
      );
    }

    throw mapHttpError(response.status, body);
  }

  throw new GstProviderError(
    'PROVIDER_UNAVAILABLE',
    'The GST provider is temporarily unavailable.',
    502,
    true,
  );
}

function retryableStatus(status: number): boolean {
  return status === 429 || status === 502;
}

function mapHttpError(status: number, body: Record<string, unknown>): GstProviderError {
  switch (status) {
    case 400:
      return new GstProviderError(
        'INVALID_GSTIN',
        'The GST provider rejected the GSTIN format.',
        400,
      );
    case 401:
      return new GstProviderError(
        'PROVIDER_UNAUTHORIZED',
        'The GST provider credentials are missing or invalid.',
        401,
      );
    case 402:
      return new GstProviderError(
        'CREDITS_EXHAUSTED',
        'The GST provider account has no credits remaining.',
        402,
      );
    case 403:
      return new GstProviderError(
        'ACCOUNT_INACTIVE',
        'The GST provider account is not active.',
        403,
      );
    case 404:
      return new GstProviderError(
        'GSTIN_NOT_FOUND',
        'The GSTIN is not registered in the GST database.',
        404,
      );
    case 429:
      return new GstProviderError(
        'RATE_LIMITED',
        'The GST provider rate limit was exceeded. Please retry later.',
        429,
        true,
      );
    case 502:
      return new GstProviderError(
        'PROVIDER_UNAVAILABLE',
        'The GST provider is temporarily unavailable.',
        502,
        true,
      );
    default: {
      const providerMessage = stringOrNull(body.error);
      return new GstProviderError(
        'PROVIDER_ERROR',
        providerMessage?.slice(0, 300) || 'The GST provider returned an unexpected error.',
        status,
      );
    }
  }
}

export function createGstProviderOptions(overrides: Partial<ProviderOptions> = {}): ProviderOptions {
  return {
    apiKey: env.gstProviderKey,
    baseUrl: env.gstApiBaseUrl,
    timeoutMs: env.gstApiTimeoutMs,
    ...overrides,
  };
}

export async function verifyGstin(
  input: string,
  options: Partial<ProviderOptions> = {},
): Promise<GstVerificationResult> {
  const gstin = normalizeGstin(input);

  if (!isValidGstin(gstin)) {
    throw new GstProviderError(
      'INVALID_GSTIN',
      'The GSTIN format or check digit is invalid.',
      400,
    );
  }

  const providerOptions = createGstProviderOptions(options);
  const path = `/v1/gstin/${encodeURIComponent(gstin)}`;
  const body = await providerRequest({ ...providerOptions, path });

  assertRequestedGstin(body.gstin, gstin);

  const profile = mapProfile(body.data);

  if (profile.gstin !== gstin) {
    throw new GstProviderError(
      'INVALID_PROVIDER_RESPONSE',
      'The GST provider returned a different GSTIN from the one requested.',
    );
  }

  return {
    provider: GST_PROVIDER_NAME,
    endpoint: path,
    retrievedAt: (providerOptions.now?.() ?? new Date()).toISOString(),
    gstin,
    creditsRemaining: numberOrNull(body.credits_remaining),
    profile,
  };
}

export async function getFilingHistory(
  inputGstin: string,
  financialYear: string,
  options: Partial<ProviderOptions> = {},
): Promise<GstFilingHistoryResult> {
  const gstin = normalizeGstin(inputGstin);

  if (!isValidGstin(gstin)) {
    throw new GstProviderError(
      'INVALID_GSTIN',
      'The GSTIN format or check digit is invalid.',
      400,
    );
  }

  if (!isValidFinancialYear(financialYear)) {
    throw new GstProviderError(
      'INVALID_FINANCIAL_YEAR',
      'The financial year must use the YYYY-YY format.',
      400,
    );
  }

  const providerOptions = createGstProviderOptions(options);
  const path = `/v1/gstin/${encodeURIComponent(gstin)}/returns?fy=${encodeURIComponent(
    financialYear,
  )}`;
  const body = await providerRequest({ ...providerOptions, path });

  assertRequestedGstin(body.gstin, gstin);

  if (body.fy !== financialYear) {
    throw new GstProviderError(
      'INVALID_PROVIDER_RESPONSE',
      'The GST provider returned filing history for a different financial year.',
    );
  }

  if (!Array.isArray(body.returns)) {
    throw new GstProviderError(
      'INVALID_PROVIDER_RESPONSE',
      'The GST provider response did not contain a filing-history array.',
    );
  }

  return {
    provider: GST_PROVIDER_NAME,
    endpoint: path,
    retrievedAt: (providerOptions.now?.() ?? new Date()).toISOString(),
    gstin,
    financialYear,
    creditsRemaining: numberOrNull(body.credits_remaining),
    returns: body.returns.map(mapFilingRecord),
  };
}
