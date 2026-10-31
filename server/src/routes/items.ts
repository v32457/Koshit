import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getPool } from '../db/pool.js';

const router = Router();

const ITEM_COLUMNS = `
  item_id, item_code, item_description,
  category_code, type_code, material_form_code,
  process_code, material_code, colour_code,
  grade, status, is_active, created_at, updated_at
`;

const CODE_FIELDS = [
  'category_code',
  'type_code',
  'material_form_code',
  'process_code',
  'material_code',
  'colour_code',
] as const;

type CodeField = (typeof CODE_FIELDS)[number];

interface ItemRow extends RowDataPacket {
  item_id: number;
  item_code: string;
  item_description: string;
  status: string;
}

interface ItemInput {
  item_code: string;
  item_description: string;
  category_code: string | null;
  type_code: string | null;
  material_form_code: string | null;
  process_code: string | null;
  material_code: string | null;
  colour_code: string | null;
  grade: string | null;
}

const VALID_STATUSES = new Set([
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

function sendError(
  res: Parameters<RequestHandler>[1],
  status: number,
  code: string,
  message: string,
): void {
  res.status(status).json({ error: { code, message } });
}

function parseItemInput(body: unknown): {
  value?: ItemInput;
  error?: string;
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  const input = body as Record<string, unknown>;

  if (input.status !== undefined && input.status !== 'DRAFT') {
    return {
      error: 'Items must be created or updated as DRAFT. Use the approval workflow to change status.',
    };
  }

  if (input.is_active !== undefined) {
    return {
      error: 'is_active cannot be changed through this endpoint.',
    };
  }

  if (
    typeof input.item_code !== 'string' ||
    !input.item_code.trim() ||
    input.item_code.trim().length > 64
  ) {
    return { error: 'item_code is required and must not exceed 64 characters.' };
  }

  if (
    typeof input.item_description !== 'string' ||
    !input.item_description.trim() ||
    input.item_description.trim().length > 500
  ) {
    return {
      error: 'item_description is required and must not exceed 500 characters.',
    };
  }

  const codes: Record<CodeField, string | null> = {
    category_code: null,
    type_code: null,
    material_form_code: null,
    process_code: null,
    material_code: null,
    colour_code: null,
  };

  for (const field of CODE_FIELDS) {
    const raw = input[field];

    if (raw === undefined || raw === null || raw === '') {
      codes[field] = null;
      continue;
    }

    if (typeof raw !== 'string' || !/^[A-Za-z0-9]{2}$/.test(raw.trim())) {
      return {
        error: `${field} must be a two-character alphanumeric code or null.`,
      };
    }

    codes[field] = raw.trim().toUpperCase();
  }

  if (
    input.grade !== undefined &&
    input.grade !== null &&
    typeof input.grade !== 'string'
  ) {
    return { error: 'grade must be a string or null.' };
  }

  if (
    typeof input.grade === 'string' &&
    input.grade.trim().length > 100
  ) {
    return { error: 'grade must not exceed 100 characters.' };
  }

  return {
    value: {
      item_code: input.item_code.trim(),
      item_description: input.item_description.trim(),
      ...codes,
      grade:
        typeof input.grade === 'string' && input.grade.trim()
          ? input.grade.trim()
          : null,
    },
  };
}

function parseId(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;

  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// GET /api/items
router.get('/', asyncRoute(async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 25);

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    sendError(res, 400, 'INVALID_PAGINATION', 'page must be positive and pageSize must be between 1 and 100.');
    return;
  }

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (typeof req.query.status === 'string') {
    const status = req.query.status.trim().toUpperCase();

    if (!VALID_STATUSES.has(status)) {
      sendError(res, 400, 'INVALID_STATUS', 'The requested status is invalid.');
      return;
    }

    conditions.push('status = ?');
    values.push(status);
  }

  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const search = req.query.search.trim().slice(0, 100);
    conditions.push('(item_code LIKE ? OR item_description LIKE ?)');
    values.push(`%${search}%`, `%${search}%`);
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const pool = getPool();

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM global_items ${where}`,
    values,
  );

  const total = Number(countRows[0]?.total ?? 0);
  const offset = (page - 1) * pageSize;

  const [items] = await pool.query<ItemRow[]>(
    `SELECT ${ITEM_COLUMNS}
     FROM global_items
     ${where}
     ORDER BY item_id DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  );

  res.json({
    data: items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}));

// GET /api/items/:id
router.get('/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id);

  if (id === null) {
    sendError(res, 400, 'INVALID_ID', 'Item ID must be a positive integer.');
    return;
  }

  const [rows] = await getPool().execute<ItemRow[]>(
    `SELECT ${ITEM_COLUMNS} FROM global_items WHERE item_id = ?`,
    [id],
  );

  if (!rows.length) {
    sendError(res, 404, 'ITEM_NOT_FOUND', 'The requested item was not found.');
    return;
  }

  res.json({ data: rows[0] });
}));

// POST /api/items — always creates a DRAFT.
router.post('/', asyncRoute(async (req, res) => {
  const parsed = parseItemInput(req.body);

  if (!parsed.value) {
    sendError(res, 400, 'INVALID_ITEM', parsed.error ?? 'Invalid item.');
    return;
  }

  const item = parsed.value;

  const [result] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO global_items (
       item_code, item_description, category_code, type_code,
       material_form_code, process_code, material_code,
       colour_code, grade, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')`,
    [
      item.item_code,
      item.item_description,
      item.category_code,
      item.type_code,
      item.material_form_code,
      item.process_code,
      item.material_code,
      item.colour_code,
      item.grade,
    ],
  );

  const [rows] = await getPool().execute<ItemRow[]>(
    `SELECT ${ITEM_COLUMNS} FROM global_items WHERE item_id = ?`,
    [result.insertId],
  );

  res.status(201).json({ data: rows[0] });
}));

// PUT /api/items/:id — only DRAFT items can be edited.
router.put('/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id);

  if (id === null) {
    sendError(res, 400, 'INVALID_ID', 'Item ID must be a positive integer.');
    return;
  }

  const parsed = parseItemInput(req.body);

  if (!parsed.value) {
    sendError(res, 400, 'INVALID_ITEM', parsed.error ?? 'Invalid item.');
    return;
  }

  const item = parsed.value;
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.execute<ItemRow[]>(
      'SELECT item_id, item_code, item_description, status FROM global_items WHERE item_id = ? FOR UPDATE',
      [id],
    );

    if (!existing.length) {
      await connection.rollback();
      sendError(res, 404, 'ITEM_NOT_FOUND', 'The requested item was not found.');
      return;
    }

    if (existing[0].status !== 'DRAFT') {
      await connection.rollback();
      sendError(res, 409, 'ITEM_NOT_EDITABLE', 'Only DRAFT items can be edited.');
      return;
    }

    await connection.execute(
      `UPDATE global_items
       SET item_code = ?, item_description = ?, category_code = ?,
           type_code = ?, material_form_code = ?, process_code = ?,
           material_code = ?, colour_code = ?, grade = ?
       WHERE item_id = ?`,
      [
        item.item_code,
        item.item_description,
        item.category_code,
        item.type_code,
        item.material_form_code,
        item.process_code,
        item.material_code,
        item.colour_code,
        item.grade,
        id,
      ],
    );

    const [updated] = await connection.execute<ItemRow[]>(
      `SELECT ${ITEM_COLUMNS} FROM global_items WHERE item_id = ?`,
      [id],
    );

    await connection.commit();
    res.json({ data: updated[0] });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// GET /api/items/:id/approvals
router.get('/:id/approvals', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id);

  if (id === null) {
    sendError(res, 400, 'INVALID_ID', 'Item ID must be a positive integer.');
    return;
  }

  const [items] = await getPool().execute<ItemRow[]>(
    'SELECT item_id FROM global_items WHERE item_id = ?',
    [id],
  );

  if (!items.length) {
    sendError(res, 404, 'ITEM_NOT_FOUND', 'The requested item was not found.');
    return;
  }

  const [history] = await getPool().execute<RowDataPacket[]>(
    `SELECT approval_id, item_id, action, action_by, comments, created_at
     FROM item_approval_history
     WHERE item_id = ?
     ORDER BY created_at DESC, approval_id DESC`,
    [id],
  );

  res.json({ data: history });
}));

export function createItemsRouter(): Router {
  return router;
}

