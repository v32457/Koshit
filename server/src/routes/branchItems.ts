/**
 * KOSH INNOVATIONS — BRANCH ITEM AVAILABILITY API ROUTER (PHASE 7: SECTIONS C–J)
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import { branchItemBackend } from '../services/branchItemBackend.js';
import { changeHistoryBackend } from '../services/changeHistoryBackend.js';
import { makerCheckerBackend } from '../services/makerCheckerBackend.js';

const router = Router();

function sendError(
  res: Parameters<RequestHandler>[1],
  status: number,
  code: string,
  message: string,
): void {
  res.status(status).json({ error: { code, message } });
}

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// GET /api/branch-items
router.get('/', asyncRoute(async (req, res) => {
  const { branchId, companyId, globalItemId } = req.query;
  const items = await branchItemBackend.getBranchItems({
    branchId: branchId ? String(branchId) : undefined,
    companyId: companyId ? String(companyId) : undefined,
    globalItemId: globalItemId ? String(globalItemId) : undefined,
  });
  res.json({ data: items });
}));

// POST /api/branch-items
router.post('/', asyncRoute(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    sendError(res, 400, 'INVALID_BODY', 'Request body must be an object.');
    return;
  }
  if (!body.globalItemId || !body.branchId || !body.companyId) {
    sendError(res, 400, 'MISSING_FIELDS', 'globalItemId, branchId, and companyId are required.');
    return;
  }

  try {
    const saved = await branchItemBackend.saveBranchItemAvailability(body);
    res.status(201).json({ data: saved });
  } catch (err: any) {
    sendError(res, 422, 'VALIDATION_FAILED', err.message || 'Validation failed.');
  }
}));

// PUT /api/branch-items/:id
router.put('/:id', asyncRoute(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    sendError(res, 400, 'INVALID_BODY', 'Request body must be an object.');
    return;
  }

  try {
    const saved = await branchItemBackend.saveBranchItemAvailability({
      ...body,
      branchAvailabilityId: req.params.id,
    });
    res.json({ data: saved });
  } catch (err: any) {
    sendError(res, 422, 'VALIDATION_FAILED', err.message || 'Validation failed.');
  }
}));

// POST /api/branch-items/validate-alternatives
router.post('/validate-alternatives', asyncRoute(async (req, res) => {
  const { globalItemId, alternatives } = req.body;
  if (!globalItemId || !Array.isArray(alternatives)) {
    sendError(res, 400, 'INVALID_PAYLOAD', 'globalItemId and alternatives array are required.');
    return;
  }

  const result = branchItemBackend.validateAlternativeItems(globalItemId, alternatives);
  res.json({ data: result });
}));

// POST /api/branch-items/validate-attachments
router.post('/validate-attachments', asyncRoute(async (req, res) => {
  const { attachments } = req.body;
  if (!Array.isArray(attachments)) {
    sendError(res, 400, 'INVALID_PAYLOAD', 'attachments array is required.');
    return;
  }

  const result = branchItemBackend.validateAttachments(attachments);
  res.json({ data: result });
}));

// POST /api/branch-items/validate-barcodes
router.post('/validate-barcodes', asyncRoute(async (req, res) => {
  const { companyId, branchId, branchAvailabilityId, barcodes } = req.body;
  if (!companyId || !branchId || !Array.isArray(barcodes)) {
    sendError(res, 400, 'INVALID_PAYLOAD', 'companyId, branchId, and barcodes array are required.');
    return;
  }

  const result = await branchItemBackend.validateBarcodes(
    companyId,
    branchId,
    branchAvailabilityId || '',
    barcodes
  );
  res.json({ data: result });
}));

// POST /api/branch-items/:id/audit
router.post('/:id/audit', asyncRoute(async (req, res) => {
  const body = req.body || {};
  const payload = {
    ...body,
    branchAvailabilityId: req.params.id,
  };

  const auditReport = await branchItemBackend.evaluateBranchItemAudit(
    payload,
    body.actorName || 'Platform Checker',
    body.actorUserId || 'usr-checker-01',
    body.ruleVersion || 1
  );

  res.json({ data: auditReport });
}));

// GET /api/branch-items/:id/audit
router.get('/:id/audit', asyncRoute(async (req, res) => {
  const reports = await changeHistoryBackend.getAuditReports(req.params.id, 'BRANCH_ITEM_ACTIVATION');
  res.json({ data: reports });
}));

// GET /api/branch-items/:id/history
router.get('/:id/history', asyncRoute(async (req, res) => {
  const history = await changeHistoryBackend.getBranchHistory({ entityId: req.params.id });
  res.json({ data: history });
}));

// POST /api/branch-items/:id/history
router.post('/:id/history', asyncRoute(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    sendError(res, 400, 'INVALID_BODY', 'Request body must be an object.');
    return;
  }

  const rawEntries = Array.isArray(body.entries)
    ? body.entries
    : Array.isArray(body)
    ? body
    : [body];

  const entries = rawEntries.map((e: any) => ({
    ...e,
    entityId: req.params.id,
  }));

  await changeHistoryBackend.recordBranchChanges(entries);
  res.status(201).json({ success: true, count: entries.length });
}));

// POST /api/branch-items/:id/submit — Stage 2: Branch Item Activation submit
router.post('/:id/submit', asyncRoute(async (req, res) => {
  const branchAvailId = decodeURIComponent(req.params.id);
  const actor = makerCheckerBackend.resolveActor({
    userId: req.header('x-kosh-user-id') || req.body?.actorUserId || req.body?.userId,
    userName: req.header('x-kosh-user-name') || req.body?.actorName || req.body?.userName,
    userRole: req.header('x-kosh-user-role') || req.body?.actorRole || req.body?.userRole,
  });

  try {
    const result = await makerCheckerBackend.submitBranchItem(
      branchAvailId,
      actor,
      req.body?.remarks || 'Submitted Branch Item Activation for Checker review'
    );
    res.json({ data: result.branchItem });
  } catch (err: any) {
    sendError(res, err.status || 400, err.code || 'SUBMIT_FAILED', err.message);
  }
}));

// POST /api/branch-items/:id/approve — Stage 2: Branch Item Activation approval (checker only; non-self-approval enforced; leaves global items untouched)
router.post('/:id/approve', asyncRoute(async (req, res) => {
  const branchAvailId = decodeURIComponent(req.params.id);
  const actor = makerCheckerBackend.resolveActor({
    userId: req.header('x-kosh-user-id') || req.body?.actorUserId || req.body?.userId,
    userName: req.header('x-kosh-user-name') || req.body?.actorName || req.body?.userName,
    userRole: req.header('x-kosh-user-role') || req.body?.actorRole || req.body?.userRole,
  });

  try {
    const result = await makerCheckerBackend.approveBranchItem(
      branchAvailId,
      actor,
      req.body?.remarks || 'Approved for branch procurement and inventory availability'
    );
    res.json({ data: result.branchItem });
  } catch (err: any) {
    sendError(res, err.status || 400, err.code || 'APPROVE_FAILED', err.message);
  }
}));

// POST /api/branch-items/:id/reject — Stage 2: Branch Item Activation rejection (checker only)
router.post('/:id/reject', asyncRoute(async (req, res) => {
  const branchAvailId = decodeURIComponent(req.params.id);
  const actor = makerCheckerBackend.resolveActor({
    userId: req.header('x-kosh-user-id') || req.body?.actorUserId || req.body?.userId,
    userName: req.header('x-kosh-user-name') || req.body?.actorName || req.body?.userName,
    userRole: req.header('x-kosh-user-role') || req.body?.actorRole || req.body?.userRole,
  });

  try {
    const result = await makerCheckerBackend.rejectBranchItem(
      branchAvailId,
      actor,
      req.body?.remarks || 'Rejected'
    );
    res.json({ data: result.branchItem });
  } catch (err: any) {
    sendError(res, err.status || 400, err.code || 'REJECT_FAILED', err.message);
  }
}));

export function createBranchItemsRouter(): Router {
  return router;
}
