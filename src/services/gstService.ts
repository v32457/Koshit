import type {
  GstFilingHistoryRecord,
  GstVerificationRecord,
} from '../../shared/gst';

const CLIENT_TIMEOUT_MS = 35_000;

export class GstApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'GstApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function postJson(path: string, body: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    return await readResponse(response);
  } catch (error) {
    if (error instanceof GstApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new GstApiError(
        'CLIENT_TIMEOUT',
        'The GST verification request timed out. Please try again.',
        0,
        true,
      );
    }
    throw new GstApiError(
      'NETWORK_ERROR',
      'The Koshit API could not be reached. GST verification is unavailable.',
      0,
      true,
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

async function getJson(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    return await readResponse(response);
  } catch (error) {
    if (error instanceof GstApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new GstApiError(
        'CLIENT_TIMEOUT',
        'The GST filing-history request timed out. Please try again.',
        0,
        true,
      );
    }
    throw new GstApiError(
      'NETWORK_ERROR',
      'The Koshit API could not be reached. GST filing history is unavailable.',
      0,
      true,
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readResponse(response: Response): Promise<unknown> {
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorBody = isRecord(payload) && isRecord(payload.error)
      ? payload.error
      : null;
    const code =
      typeof errorBody?.code === 'string' ? errorBody.code : 'API_ERROR';
    const message =
      typeof errorBody?.message === 'string'
        ? errorBody.message
        : 'The GST request failed.';
    const retryable = errorBody?.retryable === true;

    throw new GstApiError(code, message, response.status, retryable);
  }

  return payload;
}

function readData<T>(payload: unknown): T {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new GstApiError(
      'INVALID_API_RESPONSE',
      'The Koshit API returned an unexpected response.',
      0,
    );
  }

  return payload.data as T;
}

export async function verifyGstinOnServer(
  gstin: string,
): Promise<GstVerificationRecord> {
  const payload = await postJson('/api/gst/verify', { gstin });
  return readData<GstVerificationRecord>(payload);
}

export async function fetchGstFilingHistory(
  gstin: string,
  financialYear: string,
): Promise<GstFilingHistoryRecord> {
  const query = new URLSearchParams({ gstin, fy: financialYear });
  const payload = await getJson(`/api/gst/filings?${query.toString()}`);
  return readData<GstFilingHistoryRecord>(payload);
}
