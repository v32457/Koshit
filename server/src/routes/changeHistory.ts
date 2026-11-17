/**
 * KOSH INNOVATIONS — CHANGE HISTORY & AUDIT REPORT ROUTER
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import { changeHistoryBackend } from '../services/changeHistoryBackend.js';

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

// GET /api/change-history/global
router.get('/global', asyncRoute(async (req, res) => {
  const { entityId } = req.query;
  const history = await changeHistoryBackend.getGlobalHistory(entityId ? String(entityId) : undefined);
  res.json({ data: history });
}));

// POST /api/change-history/global
router.post('/global', asyncRoute(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    sendError(res, 400, 'INVALID_BODY', 'Request body must be an object.');
    return;
  }

  const entries = Array.isArray(body.entries)
    ? body.entries
    : Array.isArray(body)
    ? body
    : [body];

  await changeHistoryBackend.recordGlobalChanges(entries);
  res.status(201).json({ success: true, count: entries.length });
}));

// GET /api/change-history/branch
router.get('/branch', asyncRoute(async (req, res) => {
  const { entityId, globalItemId, branchId, companyId } = req.query;
  const history = await changeHistoryBackend.getBranchHistory({
    entityId: entityId ? String(entityId) : undefined,
    globalItemId: globalItemId ? String(globalItemId) : undefined,
    branchId: branchId ? String(branchId) : undefined,
    companyId: companyId ? String(companyId) : undefined,
  });
  res.json({ data: history });
}));

// POST /api/change-history/branch
router.post('/branch', asyncRoute(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    sendError(res, 400, 'INVALID_BODY', 'Request body must be an object.');
    return;
  }

  const entries = Array.isArray(body.entries)
    ? body.entries
    : Array.isArray(body)
    ? body
    : [body];

  await changeHistoryBackend.recordBranchChanges(entries);
  res.status(201).json({ success: true, count: entries.length });
}));

// GET /api/change-history/audits
router.get('/audits', asyncRoute(async (req, res) => {
  const { entityId, auditType } = req.query;
  const reports = await changeHistoryBackend.getAuditReports(
    entityId ? String(entityId) : undefined,
    auditType ? String(auditType) : undefined
  );
  res.json({ data: reports });
}));

// POST /api/change-history/audits
router.post('/audits', asyncRoute(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    sendError(res, 400, 'INVALID_BODY', 'Request body must be an object.');
    return;
  }

  const saved = await changeHistoryBackend.saveAuditReport(body);
  res.status(201).json({ data: saved });
}));

export function createChangeHistoryRouter(): Router {
  return router;
}
