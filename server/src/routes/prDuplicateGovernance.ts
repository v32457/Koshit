import { Router } from 'express';
import type { RequestHandler } from 'express';
import {
  PrDuplicateGovernanceBackendStore,
  PrDuplicateGovernanceHttpError,
  defaultPrDuplicateGovernanceBackend,
} from '../services/prDuplicateGovernanceBackend.js';

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((err) => {
      if (err instanceof PrDuplicateGovernanceHttpError) {
        res.status(err.status).json({
          error: { code: err.code, message: err.message, details: err.details },
        });
        return;
      }
      next(err);
    });
  };
}

export function createPrDuplicateGovernanceRouter(
  store: PrDuplicateGovernanceBackendStore = defaultPrDuplicateGovernanceBackend
): Router {
  const router = Router();

  router.get(
    '/state',
    asyncRoute((_req, res) => {
      res.json({ data: store.getState() });
    })
  );

  router.post(
    '/sync-prs',
    asyncRoute((req, res) => {
      const prs = Array.isArray(req.body?.prs) ? req.body.prs : [];
      store.syncPrs(prs, true);
      res.json({ data: { syncedCount: prs.length } });
    })
  );

  router.post(
    '/bind-pr',
    asyncRoute((req, res) => {
      const { draftKey, prId, prNumber } = req.body || {};
      if (!draftKey || !prId) {
        throw new PrDuplicateGovernanceHttpError(400, 'INVALID_REQUEST', 'draftKey and prId are required.');
      }
      const record = store.bindDraftToPr(String(draftKey), String(prId), prNumber ? String(prNumber) : undefined);
      res.json({ data: { bound: Boolean(record), record } });
    })
  );

  router.post(
    '/evaluate',
    asyncRoute((req, res) => {
      const snapshot = store.evaluate(req.body || {});
      res.json({ data: snapshot });
    })
  );

  router.post(
    '/acknowledge',
    asyncRoute((req, res) => {
      const result = store.acknowledge(req.body || {});
      res.json({ data: result });
    })
  );

  router.post(
    '/request-override',
    asyncRoute((req, res) => {
      const result = store.requestOverride(req.body || {});
      res.json({ data: result });
    })
  );

  router.post(
    '/authorise-override',
    asyncRoute((req, res) => {
      const result = store.authoriseOverride(req.body || {});
      res.json({ data: result });
    })
  );

  router.post(
    '/checker-decision',
    asyncRoute((req, res) => {
      const result = store.checkerDecision(req.body || {});
      res.json({ data: result });
    })
  );

  router.post(
    '/validate-submission',
    asyncRoute((req, res) => {
      const result = store.validateSubmission(req.body || {});
      if (!result.allowed) {
        res.status(result.httpStatus).json({
          error: { code: result.httpStatus === 409 ? 'DUPLICATE_STALE' : 'DUPLICATE_BLOCKED', message: result.message },
          data: {
            allowed: false,
            message: result.message,
            blockingReasons: result.blockingReasons,
            snapshot: result.snapshot,
          },
        });
        return;
      }
      res.json({
        data: {
          allowed: true,
          message: result.message,
          blockingReasons: [],
          snapshot: result.snapshot,
        },
      });
    })
  );

  return router;
}
