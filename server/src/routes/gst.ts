import { Router } from 'express';
import type { RequestHandler } from 'express';
import type {
  GstFilingHistoryRecord,
  GstVerificationRecord,
} from '../../../shared/gst.js';
import { getAvailableFinancialYears } from '../../../shared/financialYear.js';
import {
  GstProviderError,
  getFilingHistory,
  verifyGstin,
} from '../services/gstProvider.js';
import {
  saveGstFilingHistory,
  saveGstVerification,
} from '../repositories/gst.js';

export interface GstRouterDependencies {
  verifyGstin: typeof verifyGstin;
  getFilingHistory: typeof getFilingHistory;
  saveVerification: (result: Awaited<ReturnType<typeof verifyGstin>>) => Promise<void>;
  saveFilingHistory: (
    result: Awaited<ReturnType<typeof getFilingHistory>>,
  ) => Promise<void>;
  now?: () => Date;
}

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function sendError(
  res: Parameters<RequestHandler>[1],
  status: number,
  code: string,
  message: string,
  retryable = false,
): void {
  res.status(status).json({ error: { code, message, retryable } });
}

function httpStatusFor(error: GstProviderError): number {
  switch (error.code) {
    case 'INVALID_GSTIN':
    case 'INVALID_FINANCIAL_YEAR':
      return 400;
    case 'GSTIN_NOT_FOUND':
      return 404;
    case 'RATE_LIMITED':
      return 429;
    case 'PROVIDER_NOT_CONFIGURED':
    case 'CREDITS_EXHAUSTED':
      return 503;
    case 'PROVIDER_TIMEOUT':
      return 504;
    default:
      return 502;
  }
}

function handleProviderFailure(
  error: unknown,
  res: Parameters<RequestHandler>[1],
  fallbackMessage: string,
): void {
  if (error instanceof GstProviderError) {
    sendError(
      res,
      httpStatusFor(error),
      error.code,
      error.message,
      error.retryable,
    );
    return;
  }

  console.error('Unexpected GST verification failure:', error);
  sendError(res, 500, 'INTERNAL_ERROR', fallbackMessage);
}

const PERSISTENCE_ERROR =
  'The provider returned valid data, but it could not be saved to the database.';

export function createGstRouter(
  overrides: Partial<GstRouterDependencies> = {},
): Router {
  const dependencies: GstRouterDependencies = {
    verifyGstin,
    getFilingHistory,
    saveVerification: saveGstVerification,
    saveFilingHistory: saveGstFilingHistory,
    now: () => new Date(),
    ...overrides,
  };

  const router = Router();

  router.post('/verify', asyncRoute(async (req, res) => {
    const body = req.body as unknown;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendError(res, 400, 'INVALID_GSTIN', 'Request body must be a JSON object.');
      return;
    }

    const gstin = (body as Record<string, unknown>).gstin;

    if (typeof gstin !== 'string' || !gstin.trim()) {
      sendError(res, 400, 'INVALID_GSTIN', 'GSTIN is required.');
      return;
    }

    let result: Awaited<ReturnType<typeof verifyGstin>>;

    try {
      result = await dependencies.verifyGstin(gstin);
    } catch (error) {
      handleProviderFailure(
        error,
        res,
        'GST verification failed because of an unexpected server error.',
      );
      return;
    }

    const record: GstVerificationRecord = { ...result, persisted: true };

    try {
      await dependencies.saveVerification(result);
    } catch (error) {
      console.error('Could not persist GST verification:', error);
      record.persisted = false;
      record.persistenceError = PERSISTENCE_ERROR;
    }

    res.status(200).json({ data: record });
  }));

  router.get('/filings', asyncRoute(async (req, res) => {
    const gstin = req.query.gstin;
    const financialYear = req.query.fy;

    if (typeof gstin !== 'string' || !gstin.trim()) {
      sendError(res, 400, 'INVALID_GSTIN', 'GSTIN is required.');
      return;
    }

    if (typeof financialYear !== 'string' || !financialYear.trim()) {
      sendError(
        res,
        400,
        'INVALID_FINANCIAL_YEAR',
        'Financial year is required in YYYY-YY format.',
      );
      return;
    }

    const allowedYears = getAvailableFinancialYears(
      dependencies.now?.() ?? new Date(),
    );

    if (!allowedYears.includes(financialYear.trim())) {
      sendError(
        res,
        400,
        'INVALID_FINANCIAL_YEAR',
        `Financial year must be one of: ${allowedYears.join(', ')}.`,
      );
      return;
    }

    let result: Awaited<ReturnType<typeof getFilingHistory>>;

    try {
      result = await dependencies.getFilingHistory(gstin, financialYear.trim());
    } catch (error) {
      handleProviderFailure(
        error,
        res,
        'GST filing history could not be retrieved because of an unexpected server error.',
      );
      return;
    }

    const record: GstFilingHistoryRecord = { ...result, persisted: true };

    try {
      await dependencies.saveFilingHistory(result);
    } catch (error) {
      console.error('Could not persist GST filing history:', error);
      record.persisted = false;
      record.persistenceError = PERSISTENCE_ERROR;
    }

    res.status(200).json({ data: record });
  }));

  return router;
}
