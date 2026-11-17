/**
 * KOSH INNOVATIONS — UOM MASTER & CONVERSION API ROUTER (/api/uoms)
 * Backed by MySQL uom_master and uom_conversions tables with exact decimal arithmetic.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getPool } from '../db/pool.js';
import { INITIAL_UOM_MASTER } from '../../../src/services/uomConversionService.js';

const router = Router();

const UOM_COLUMNS = `
  uom_id, uom_code, uom_name, dimension, is_base_unit,
  base_unit_code, decimal_precision, allow_fractional, is_active,
  created_at, updated_at, updated_by
`;

interface UomMasterRow extends RowDataPacket {
  uom_id: string;
  uom_code: string;
  uom_name: string;
  dimension: string;
  is_base_unit: number;
  base_unit_code: string | null;
  decimal_precision: number;
  allow_fractional: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

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

// GET /api/uoms — Get all UOM master records
router.get('/', asyncRoute(async (req, res) => {
  const pool = getPool();
  let rows: UomMasterRow[] = [];
  try {
    const [dbRows] = await pool.execute<UomMasterRow[]>(
      `SELECT ${UOM_COLUMNS} FROM uom_master ORDER BY uom_code ASC`
    );
    rows = dbRows;
  } catch (err) {
    // If table doesn't exist yet or DB error, fall back to initial seed UOM master
    console.warn('uom_master table query fallback:', err);
  }

  if (rows.length === 0) {
    // Map initial seed records
    const seedRecords = INITIAL_UOM_MASTER.map((u) => ({
      uom_id: u.id,
      uom_code: u.code,
      uom_name: u.name,
      dimension: u.dimension,
      is_base_unit: u.isBaseUnit ? 1 : 0,
      base_unit_code: u.baseUnitCode || null,
      decimal_precision: u.decimalPrecision,
      allow_fractional: u.allowFractional ? 1 : 0,
      is_active: u.isActive ? 1 : 0,
      created_at: u.createdAt,
      updated_at: u.updatedAt,
      updated_by: u.updatedBy,
    }));
    res.json({ data: seedRecords });
    return;
  }

  res.json({ data: rows });
}));

// POST /api/uoms — Create or update UOM master record
router.post('/', asyncRoute(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    sendError(res, 400, 'INVALID_BODY', 'Request body must be a JSON object.');
    return;
  }

  const code = (body.code || '').trim().toUpperCase();
  const name = (body.name || '').trim();
  const dimension = (body.dimension || 'OTHER').trim().toUpperCase();
  const isBaseUnit = !!body.isBaseUnit;
  const baseUnitCode = body.baseUnitCode ? body.baseUnitCode.trim().toUpperCase() : null;
  const decimalPrecision = Number(body.decimalPrecision ?? 2);
  const allowFractional = body.allowFractional !== undefined ? !!body.allowFractional : true;
  const updatedBy = body.updatedBy || 'Platform Admin';

  if (!code || !/^[A-Z0-9_-]{1,16}$/.test(code)) {
    sendError(res, 400, 'INVALID_UOM_CODE', 'UOM Code must be 1–16 uppercase alphanumeric characters.');
    return;
  }
  if (!name) {
    sendError(res, 400, 'INVALID_UOM_NAME', 'UOM Name is required.');
    return;
  }

  const pool = getPool();
  const uomId = `uom-${code.toLowerCase()}-${Date.now()}`;

  try {
    await pool.execute<ResultSetHeader>(
      `INSERT INTO uom_master (
         uom_id, uom_code, uom_name, dimension, is_base_unit,
         base_unit_code, decimal_precision, allow_fractional, is_active, updated_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)
       ON DUPLICATE KEY UPDATE
         uom_name = VALUES(uom_name),
         dimension = VALUES(dimension),
         is_base_unit = VALUES(is_base_unit),
         base_unit_code = VALUES(base_unit_code),
         decimal_precision = VALUES(decimal_precision),
         allow_fractional = VALUES(allow_fractional),
         updated_by = VALUES(updated_by)`,
      [
        uomId,
        code,
        name,
        dimension,
        isBaseUnit,
        baseUnitCode,
        decimalPrecision,
        allowFractional,
        updatedBy,
      ]
    );

    const [savedRows] = await pool.execute<UomMasterRow[]>(
      `SELECT ${UOM_COLUMNS} FROM uom_master WHERE uom_code = ?`,
      [code]
    );

    res.status(201).json({ data: savedRows[0] });
  } catch (err: any) {
    sendError(res, 500, 'UOM_SAVE_ERROR', err.message || 'Failed to save UOM master record.');
  }
}));

export function createUomsRouter(): Router {
  return router;
}
