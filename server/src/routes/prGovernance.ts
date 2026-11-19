import { Router } from 'express';
import type { RequestHandler } from 'express';
import {
  PrGovernanceBackendStore,
  PrGovernanceHttpError,
  defaultPrGovernanceBackend,
} from '../services/prGovernanceBackend.js';

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((err) => {
      if (err instanceof PrGovernanceHttpError) {
        res.status(err.status).json({
          error: { code: err.code, message: err.message, details: err.details },
        });
        return;
      }
      next(err);
    });
  };
}

export function createPrGovernanceRouter(
  store: PrGovernanceBackendStore = defaultPrGovernanceBackend
): Router {
  const router = Router();

  router.post(
    '/sync-state',
    asyncRoute((req, res) => {
      const result = store.syncState(req.body || {});
      res.json({ data: result });
    })
  );

  router.get(
    '/effective-policy',
    asyncRoute((req, res) => {
      const companyId = String(req.query.companyId || 'co-kosh-01');
      const branchId = req.query.branchId ? String(req.query.branchId) : 'ALL';
      const evaluationDate = req.query.evaluationDate ? String(req.query.evaluationDate) : undefined;
      const effective = store.getEffectivePolicy(companyId, branchId, evaluationDate);
      const budgetValidationEnabled = store.isBudgetValidationEnabled(
        companyId,
        branchId,
        evaluationDate
      );
      res.json({ data: { effectivePolicy: effective, budgetValidationEnabled } });
    })
  );

  router.get(
    '/eligible-categories',
    asyncRoute((req, res) => {
      const companyId = String(req.query.companyId || 'co-kosh-01');
      const branchId = String(req.query.branchId || 'ALL');
      const purchaseOrgId = req.query.purchaseOrgId ? String(req.query.purchaseOrgId) : 'ALL';
      const prTypeCode = String(req.query.prTypeCode || 'MANUAL');
      const evaluationDate = req.query.evaluationDate ? String(req.query.evaluationDate) : undefined;
      const userRole = req.query.userRole ? String(req.query.userRole) : undefined;
      const categories = store.getEligibleCategories({
        companyId,
        branchId,
        purchaseOrgId,
        prTypeCode,
        evaluationDate,
        userRole,
      });
      res.json({ data: { categories } });
    })
  );

  router.post(
    '/validate-pr',
    asyncRoute((req, res) => {
      const result = store.validatePr(req.body || {});
      if (!result.allowed) {
        res.status(422).json({
          error: {
            code: 'PR_GOVERNANCE_VALIDATION_FAILED',
            message: result.errors[0] || 'PR governance validation failed.',
          },
          data: result,
        });
        return;
      }
      res.json({ data: result });
    })
  );

  router.post(
    '/validate-sap-handoff',
    asyncRoute((req, res) => {
      const result = store.validateSapHandoff(req.body || {});
      if (!result.readyForSap) {
        res.status(422).json({
          error: {
            code: 'SAP_HANDOFF_BLOCKED',
            message: result.blockingReasons[0] || 'PR is not eligible for SAP transaction creation.',
          },
          data: result,
        });
        return;
      }
      res.json({ data: result });
    })
  );

  router.get(
    '/expense-categories',
    asyncRoute((req, res) => {
      const companyId = String(req.query.companyId || 'co-kosh-01');
      const branchId = String(req.query.branchId || 'ALL');
      const categories = store.getEligibleExpenseCategories(companyId, branchId);
      res.json({ data: { categories } });
    })
  );

  router.post(
    '/sap/post',
    asyncRoute((req, res) => {
      const result = store.postPrToSapServiceLayer(req.body || {});
      if (result.trace.status === 'FAILED' || result.trace.status === 'REQUIRES_RECONCILIATION') {
        res.status(422).json({
          error: {
            code: result.trace.lastErrorCode || 'SAP_INTEGRATION_ERROR',
            message: result.trace.lastErrorMessage || 'SAP Service Layer integration did not complete.',
          },
          data: result,
        });
        return;
      }
      res.json({ data: result });
    })
  );

  router.post(
    '/sap/reconcile',
    asyncRoute((req, res) => {
      const result = store.reconcileSapIntegrationState(req.body || {});
      res.json({ data: result });
    })
  );

  router.get(
    '/sap/trace/:prId',
    asyncRoute((req, res) => {
      const prId = String(req.params.prId || '');
      const trace = store.getSapTrace(prId);
      res.json({ data: { trace } });
    })
  );

  return router;
}
