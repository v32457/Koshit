import { Router } from 'express';
import type { RequestHandler } from 'express';
import {
  ChargeEngineBackendStore,
  ChargeEngineHttpError,
  defaultChargeEngineBackend,
} from '../services/chargeEngineBackend.js';

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((err) => {
      if (err instanceof ChargeEngineHttpError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      next(err);
    });
  };
}

export function createChargesRouter(store: ChargeEngineBackendStore = defaultChargeEngineBackend): Router {
  const router = Router();

  router.get(
    '/master',
    asyncRoute((req, res) => {
      const includeInactive = req.query.includeInactive !== 'false';
      res.json({ data: store.listChargeMasters(includeInactive) });
    })
  );

  router.post(
    '/master',
    asyncRoute((req, res) => {
      const { actorName, actorRole, ...payload } = req.body || {};
      const created = store.createChargeMaster(payload, actorName, actorRole);
      res.status(201).json({ data: created });
    })
  );

  router.put(
    '/master/:id',
    asyncRoute((req, res) => {
      const id = String(req.params.id);
      const { actorName, actorRole, ...updates } = req.body || {};
      const updated = store.updateChargeMaster(id, updates, actorName, actorRole);
      res.json({ data: updated });
    })
  );

  router.patch(
    '/master/:id/status',
    asyncRoute((req, res) => {
      const id = String(req.params.id);
      const { isActive, actorName, actorRole } = req.body || {};
      const updated = store.updateChargeMaster(id, { isActive: Boolean(isActive) }, actorName, actorRole);
      res.json({ data: updated });
    })
  );

  router.post(
    '/master/:id/approve',
    asyncRoute((req, res) => {
      const id = String(req.params.id);
      const { decision, actorName, actorRole } = req.body || {};
      const updated = store.approveChargeMaster(
        id,
        decision === 'REJECTED' ? 'REJECTED' : 'APPROVED',
        actorName,
        actorRole
      );
      res.json({ data: updated });
    })
  );

  router.get(
    '/mappings',
    asyncRoute((req, res) => {
      const companyId = req.query.companyId ? String(req.query.companyId) : undefined;
      const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
      res.json({ data: store.listMappings(companyId, branchId) });
    })
  );

  router.get(
    '/mappings/effective',
    asyncRoute((req, res) => {
      const companyId = String(req.query.companyId || 'co-kosh-01');
      const branchId = String(req.query.branchId || 'ALL');
      const asOfDate = req.query.asOfDate ? String(req.query.asOfDate) : undefined;
      const prType = req.query.prType ? String(req.query.prType).toUpperCase() : undefined;
      const onlyPrApplicable = req.query.prApplicable === 'true';
      if (prType === 'EXPENSE' && onlyPrApplicable) {
        res.json({ data: [] });
        return;
      }
      let items = store.resolveEffectiveMappings(companyId, branchId, asOfDate, prType);
      if (onlyPrApplicable) {
        items = items.filter(
          (i) =>
            i.isActiveInMaster &&
            i.isEnabled &&
            i.isEffectiveNow &&
            i.approvalStatus === 'APPROVED' &&
            i.applicability !== 'NOT_APPLICABLE' &&
            (!prType || i.applicablePrTypes.includes(prType)) &&
            (i.permittedApplicationLevels.includes('PR_HEADER') ||
              i.permittedApplicationLevels.includes('PR_LINE'))
        );
      }
      res.json({ data: items });
    })
  );

  router.put(
    '/mappings/company',
    asyncRoute((req, res) => {
      const { actorName, actorRole, ...payload } = req.body || {};
      const saved = store.saveCompanyMapping(payload, actorName, actorRole);
      res.json({ data: saved });
    })
  );

  router.put(
    '/mappings/branch',
    asyncRoute((req, res) => {
      const { actorName, actorRole, ...payload } = req.body || {};
      const saved = store.saveBranchOverride(payload, actorName, actorRole);
      res.json({ data: saved });
    })
  );

  router.delete(
    '/mappings/branch',
    asyncRoute((req, res) => {
      const companyId = String(req.query.companyId || '');
      const branchId = String(req.query.branchId || '');
      const chargeMasterId = String(req.query.chargeMasterId || '');
      const reverted = store.revertBranchOverride(companyId, branchId, chargeMasterId);
      res.json({ data: { reverted } });
    })
  );

  router.post(
    '/pr/calculate',
    asyncRoute((req, res) => {
      const result = store.calculatePrCharges(req.body || {});
      res.json({ data: result });
    })
  );

  router.post(
    '/calculate',
    asyncRoute((req, res) => {
      const result = store.calculateRawCharge(req.body || {});
      res.json({ data: result });
    })
  );

  router.post(
    '/allocate',
    asyncRoute((req, res) => {
      const result = store.allocateCharge(req.body || {});
      res.json({ data: result });
    })
  );

  router.get(
    '/landed-cost',
    asyncRoute((req, res) => {
      const companyId = String(req.query.companyId || 'co-kosh-01');
      const branchId = String(req.query.branchId || 'ALL');
      res.json({
        data: {
          companyId,
          branchId,
          effectiveChargesCount: store.resolveEffectiveMappings(companyId, branchId).filter((c) => c.isEffectiveNow).length,
        },
      });
    })
  );

  return router;
}
