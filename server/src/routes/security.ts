import { Router } from 'express';
import type { Request, RequestHandler } from 'express';
import {
  ActorIdentityContext,
  ZeroTrustHttpError,
  ZeroTrustSecurityBackendStore,
  defaultZeroTrustSecurityBackend,
} from '../services/zeroTrustSecurityBackend.js';

function asyncRoute(handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      if (err instanceof ZeroTrustHttpError) {
        res.status(err.status).json({
          error: {
            code: err.code,
            message: err.message,
            ...(err.details ? { details: err.details } : {}),
          },
        });
        return;
      }
      next(err);
    }
  };
}

function extractActor(req: Request): ActorIdentityContext {
  const headerUserId = req.header('x-kosh-user-id')?.trim();
  const headerSessionId = req.header('x-kosh-session-id')?.trim();
  const bodyUserId = typeof req.body?.actorUserId === 'string' ? req.body.actorUserId.trim() : undefined;
  const queryUserId = typeof req.query?.actorUserId === 'string' ? req.query.actorUserId.trim() : undefined;
  const userId = headerUserId || bodyUserId || queryUserId || '';
  const sessionId =
    headerSessionId ||
    (typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined) ||
    (typeof req.query?.sessionId === 'string' ? req.query.sessionId : undefined);
  return { userId, sessionId, ipAddress: req.ip };
}

export function createSecurityRouter(
  store: ZeroTrustSecurityBackendStore = defaultZeroTrustSecurityBackend
): Router {
  const router = Router();

  router.get(
    '/health',
    asyncRoute((_req, res) => {
      res.json({ data: store.getSystemHealth() });
    })
  );

  router.get(
    '/dashboard',
    asyncRoute((_req, res) => {
      res.json({ data: store.getDashboardSnapshot() });
    })
  );

  router.get(
    '/policies/hierarchy',
    asyncRoute((_req, res) => {
      res.json({ data: store.getHierarchySnapshot() });
    })
  );

  router.post(
    '/sync-catalog',
    asyncRoute((req, res) => {
      store.syncMasterCatalog(req.body || {});
      res.json({ data: { synced: true } });
    })
  );

  router.put(
    '/optional-scopes',
    asyncRoute((req, res) => {
      const actor = extractActor(req);
      const updated = store.updateOptionalScopes(actor, req.body || {});
      res.json({ data: updated });
    })
  );

  router.put(
    '/policies',
    asyncRoute((req, res) => {
      const actor = extractActor(req);
      const updated = store.upsertScopedPolicy(actor, req.body || {});
      res.json({ data: updated });
    })
  );

  router.get(
    '/master-status',
    asyncRoute((_req, res) => {
      res.json({ data: store.getGlobalSecurityMasterStatus() });
    })
  );

  router.put(
    '/master-status',
    asyncRoute((req, res) => {
      const actor = extractActor(req);
      const updated = store.updateGlobalSecurityMaster(actor, req.body || {});
      res.json({ data: updated });
    })
  );

  router.delete(
    '/policies/optional/:scopeLevel/:scopeRefId',
    asyncRoute((req, res) => {
      const actor = extractActor(req);
      const scopeLevel = String(req.params.scopeLevel).toUpperCase();
      if (scopeLevel !== 'PAGE' && scopeLevel !== 'USER') {
        throw new ZeroTrustHttpError(400, 'INVALID_OPTIONAL_SCOPE', 'Only PAGE or USER optional policies can be removed.');
      }
      const result = store.removeOptionalPolicy(
        actor,
        scopeLevel,
        String(req.params.scopeRefId),
        typeof req.query.reason === 'string' ? req.query.reason : undefined
      );
      res.json({ data: result });
    })
  );

  router.get(
    '/effective-policy',
    asyncRoute((req, res) => {
      const actor = extractActor(req);
      const evaluated = store.evaluateEffectivePolicy({
        actorUserId: actor.userId,
        targetUserId: typeof req.query.targetUserId === 'string' ? req.query.targetUserId : undefined,
        companyId: String(req.query.companyId || 'co-kosh-01'),
        branchId: String(req.query.branchId || 'br-pond-01'),
        moduleKey: String(req.query.moduleKey || 'PURCHASE_REQUISITION'),
        pageKey: typeof req.query.pageKey === 'string' ? req.query.pageKey : undefined,
        sessionId: actor.sessionId,
        nowIso: typeof req.query.nowIso === 'string' ? req.query.nowIso : undefined,
      });
      res.json({ data: evaluated });
    })
  );

  router.post(
    '/authorize',
    asyncRoute((req, res) => {
      const actor = extractActor(req);
      const result = store.authorizeOperation(actor, req.body || {});
      res.json({ data: result });
    })
  );

  router.get(
    '/exceptions',
    asyncRoute((req, res) => {
      const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
      res.json({ data: store.listExceptions(companyId) });
    })
  );

  router.post(
    '/exceptions',
    asyncRoute((req, res) => {
      const actor = extractActor(req);
      const created = store.requestPolicyException(actor, req.body || {});
      res.status(201).json({ data: created });
    })
  );

  router.post(
    '/exceptions/:id/decide',
    asyncRoute((req, res) => {
      const actor = extractActor(req);
      const decided = store.decidePolicyException(
        actor,
        String(req.params.id),
        req.body?.decision,
        String(req.body?.decisionNotes || '')
      );
      res.json({ data: decided });
    })
  );

  router.get(
    '/sessions',
    asyncRoute((req, res) => {
      const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
      res.json({ data: store.listSessions(companyId) });
    })
  );

  router.post(
    '/sessions/heartbeat',
    asyncRoute((req, res) => {
      const actor = extractActor(req);
      const result = store.upsertSessionHeartbeat({
        ...(req.body || {}),
        userId: actor.userId || req.body?.userId,
      });
      res.json({ data: result });
    })
  );

  router.post(
    '/sessions/:id/suspend',
    asyncRoute((req, res) => {
      const actor = extractActor(req);
      const result = store.suspendOrBlackoutSession(actor, String(req.params.id), req.body || {});
      res.json({ data: result });
    })
  );

  router.post(
    '/sessions/:id/reauth',
    asyncRoute((req, res) => {
      const actor = extractActor(req);
      const session = store.reauthenticateSession(actor, String(req.params.id), req.body || {});
      res.json({ data: session });
    })
  );

  router.post(
    '/sessions/:id/override',
    asyncRoute((req, res) => {
      const actor = extractActor(req);
      const session = store.adminOverrideBlackout(
        actor,
        String(req.params.id),
        String(req.body?.reason || '')
      );
      res.json({ data: session });
    })
  );

  router.post(
    '/browser/evaluate',
    asyncRoute((req, res) => {
      const actor = extractActor(req);
      const saved = store.recordBrowserEvaluation(actor, req.body || {});
      res.json({ data: saved });
    })
  );

  router.get(
    '/browser/compliance',
    asyncRoute((_req, res) => {
      res.json({ data: store.listBrowserCompliance() });
    })
  );

  router.get(
    '/events',
    asyncRoute((req, res) => {
      const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
      res.json({ data: store.listEvents(companyId) });
    })
  );

  router.post(
    '/events',
    asyncRoute((req, res) => {
      const actor = extractActor(req);
      const result = store.ingestSecurityEvent(actor, req.body || {});
      res.status(201).json({ data: result });
    })
  );

  router.get(
    '/incidents',
    asyncRoute((req, res) => {
      const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
      res.json({ data: store.listIncidents(companyId) });
    })
  );

  router.post(
    '/incidents',
    asyncRoute((req, res) => {
      const actor = extractActor(req);
      const created = store.createIncident(actor, req.body || {});
      res.status(201).json({ data: created });
    })
  );

  router.patch(
    '/incidents/:id',
    asyncRoute((req, res) => {
      const actor = extractActor(req);
      const updated = store.updateIncident(actor, String(req.params.id), req.body || {});
      res.json({ data: updated });
    })
  );

  router.get(
    '/registry',
    asyncRoute((_req, res) => {
      res.json({ data: store.listRegistry() });
    })
  );

  router.get(
    '/audit',
    asyncRoute((req, res) => {
      const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
      res.json({ data: store.listAuditHistory(companyId) });
    })
  );

  router.use((_req, res) => {
    res.status(404).json({ error: { code: 'SECURITY_ROUTE_NOT_FOUND', message: 'Security API endpoint not found' } });
  });

  return router;
}
