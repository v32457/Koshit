/**
 * KOSH INNOVATIONS — ITEM GOVERNANCE & DUPLICATE DETECTION API ROUTER
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import { itemGovernanceBackend } from '../services/itemGovernanceBackend.js';

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

// POST /api/items/check-duplicates
router.post('/check-duplicates', asyncRoute(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    sendError(res, 400, 'INVALID_BODY', 'Request body must be a JSON object.');
    return;
  }

  const result = await itemGovernanceBackend.checkDuplicates(body);
  res.json({ data: result });
}));

// POST /api/items/merge
router.post('/merge', asyncRoute(async (req, res) => {
  const { sourceItemId, targetItemId, actorName } = req.body;
  if (!sourceItemId || !targetItemId) {
    sendError(res, 400, 'INVALID_PARAMS', 'sourceItemId and targetItemId are required.');
    return;
  }

  const success = await itemGovernanceBackend.mergeItems(sourceItemId, targetItemId, actorName || 'Platform Admin');
  res.json({ success, message: `Successfully merged item ${sourceItemId} into ${targetItemId}.` });
}));

export function createItemGovernanceRouter(): Router {
  return router;
}
