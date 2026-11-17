import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getPool } from '../db/pool.js';
import { changeHistoryBackend } from '../services/changeHistoryBackend.js';
import { makerCheckerBackend } from '../services/makerCheckerBackend.js';
import { INITIAL_GLOBAL_ITEMS } from '../../../src/data/seedData.js';

const router = Router();

const ITEM_COLUMNS = `
  item_id, item_code, item_description,
  type_code, material_form_code,
  process_code, material_code, colour_code,
  grade, status, is_active, created_at, updated_at
`;

const CODE_FIELDS = [
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

const ALLOWED_ITEM_SORT_COLUMNS: Record<string, string> = {
  item_id: 'item_id',
  item_code: 'item_code',
  item_description: 'item_description',
  status: 'status',
  created_at: 'created_at',
  updated_at: 'updated_at',
};

// GET /api/items
router.get('/', asyncRoute(async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);
  const rawSortField = typeof req.query.sortField === 'string' ? req.query.sortField.trim() : 'created_at';
  const rawSortDir = typeof req.query.sortDirection === 'string' ? req.query.sortDirection.trim().toLowerCase() : 'desc';

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 200
  ) {
    sendError(res, 400, 'INVALID_PAGINATION', 'page must be positive and pageSize must be between 1 and 200.');
    return;
  }

  const sortColumn = ALLOWED_ITEM_SORT_COLUMNS[rawSortField] || 'created_at';
  const sortDirection = rawSortDir === 'asc' ? 'ASC' : 'DESC';

  const conditions: string[] = [];
  const values: unknown[] = [];

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search) {
    conditions.push('(item_code LIKE ? OR item_description LIKE ?)');
    const like = `%${search}%`;
    values.push(like, like);
  }

  const status = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : '';
  if (status && VALID_STATUSES.has(status)) {
    conditions.push('status = ?');
    values.push(status);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countSql = `SELECT COUNT(*) as total FROM global_items ${whereClause}`;
    const [countRows] = await getPool().execute<RowDataPacket[]>(countSql, values as any);
    const total = Number((countRows[0] as { total: number }).total);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const clampedPage = Math.min(page, totalPages);
    const offset = (clampedPage - 1) * pageSize;

    const dataSql = `
      SELECT ${ITEM_COLUMNS}
      FROM global_items
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const [items] = await getPool().execute<ItemRow[]>(dataSql, [...values, pageSize, offset] as any);

    res.json({
      data: items,
      pagination: {
        page: clampedPage,
        currentPage: clampedPage,
        pageSize,
        total,
        totalRecords: total,
        totalPages,
        sortField: sortColumn,
        sortDirection: sortDirection.toLowerCase(),
      },
    });
  } catch {
    // Database unavailable — fallback to memory store
    let memoryList: any[] = [];
    for (const seed of INITIAL_GLOBAL_ITEMS) {
      const live = await makerCheckerBackend.getGlobalItem(seed.id);
      if (live) {
        memoryList.push(live);
      } else {
        memoryList.push({
          item_id: seed.id,
          item_code: seed.globalItemCode,
          item_description: seed.description,
          status: seed.status,
          type_code: seed.attributes.type || null,
          material_form_code: seed.attributes.materialForm || null,
          process_code: seed.attributes.process || null,
          material_code: seed.attributes.material || null,
          colour_code: seed.attributes.colour || null,
          grade: seed.attributes.specification || null,
          is_active: 1,
          created_by_user_id: seed.createdBy || 'usr-maker-02',
          created_by_name: seed.createdByName || 'Ananya Deshmukh',
          created_at: seed.createdAt,
          updated_at: seed.updatedAt,
        });
      }
    }

    if (search) {
      const q = search.toLowerCase();
      memoryList = memoryList.filter(
        (i) => i.item_code?.toLowerCase().includes(q) || i.item_description?.toLowerCase().includes(q)
      );
    }
    if (status) {
      memoryList = memoryList.filter((i) => i.status === status);
    }

    const total = memoryList.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const clampedPage = Math.min(page, totalPages);
    const offset = (clampedPage - 1) * pageSize;
    const paged = memoryList.slice(offset, offset + pageSize);

    res.json({
      data: paged,
      pagination: {
        page: clampedPage,
        currentPage: clampedPage,
        pageSize,
        total,
        totalRecords: total,
        totalPages,
        sortField: sortColumn,
        sortDirection: sortDirection.toLowerCase(),
      },
    });
  }
}));

// GET /api/items/:id
router.get('/:id', asyncRoute(async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id !== null) {
      const [rows] = await getPool().execute<ItemRow[]>(
        `SELECT ${ITEM_COLUMNS} FROM global_items WHERE item_id = ?`,
        [id],
      );
      if (rows.length) {
        res.json({ data: rows[0] });
        return;
      }
    }
  } catch {
    // Database fallback
  }

  const memoryItem = await makerCheckerBackend.getGlobalItem(req.params.id);
  if (!memoryItem) {
    sendError(res, 404, 'ITEM_NOT_FOUND', 'The requested item was not found.');
    return;
  }

  res.json({ data: memoryItem });
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
       item_code, item_description, type_code,
       material_form_code, process_code, material_code,
       colour_code, grade, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')`,
    [
      item.item_code,
      item.item_description,
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

  const createdRow = rows[0];
  if (createdRow) {
    try {
      await changeHistoryBackend.recordGlobalChanges([{
        entityId: String(createdRow.item_id),
        fieldAttribute: 'ITEM_CREATION',
        previousValue: '',
        newValue: createdRow.item_code,
        changedBy: 'Platform Admin',
        changedByUserId: 'usr-admin-01',
        changeReason: 'Global Item Master record creation',
        applicableRuleVersion: 1,
      }]);
    } catch {}
  }

  res.status(201).json({ data: createdRow });
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
       SET item_code = ?, item_description = ?,
           type_code = ?, material_form_code = ?, process_code = ?,
           material_code = ?, colour_code = ?, grade = ?
       WHERE item_id = ?`,
      [
        item.item_code,
        item.item_description,
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

    try {
      await changeHistoryBackend.recordGlobalChanges([{
        entityId: String(id),
        fieldAttribute: 'ITEM_UPDATE',
        previousValue: existing[0].item_code,
        newValue: item.item_code,
        changedBy: 'Platform Admin',
        changedByUserId: 'usr-admin-01',
        changeReason: 'Updated Global Item master details',
        applicableRuleVersion: 1,
      }]);
    } catch {}

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

  try {
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
  } catch {
    // Database fallback
    res.json({ data: [] });
  }
}));

// POST /api/items/:id/submit — Stage 1: Global Item Creation submit
router.post('/:id/submit', asyncRoute(async (req, res) => {
  const actor = makerCheckerBackend.resolveActor({
    userId: req.header('x-kosh-user-id') || req.body?.actorUserId || req.body?.userId,
    userName: req.header('x-kosh-user-name') || req.body?.actorName || req.body?.userName,
    userRole: req.header('x-kosh-user-role') || req.body?.actorRole || req.body?.userRole,
  });

  try {
    const result = await makerCheckerBackend.submitGlobalItem(
      req.params.id,
      actor,
      req.body?.remarks || 'Submitted Global Item for Checker review'
    );
    res.json({ data: result.item });
  } catch (err: any) {
    sendError(res, err.status || 400, err.code || 'SUBMIT_FAILED', err.message);
  }
}));

// POST /api/items/:id/approve — Stage 1: Global Item Creation approval (checker only; non-self-approval enforced; NO branch auto-activation)
router.post('/:id/approve', asyncRoute(async (req, res) => {
  const actor = makerCheckerBackend.resolveActor({
    userId: req.header('x-kosh-user-id') || req.body?.actorUserId || req.body?.userId,
    userName: req.header('x-kosh-user-name') || req.body?.actorName || req.body?.userName,
    userRole: req.header('x-kosh-user-role') || req.body?.actorRole || req.body?.userRole,
  });

  try {
    const result = await makerCheckerBackend.approveGlobalItem(
      req.params.id,
      actor,
      req.body?.remarks || 'Approved for Global Item Master catalog'
    );
    res.json({ data: result.item });
  } catch (err: any) {
    sendError(res, err.status || 400, err.code || 'APPROVE_FAILED', err.message);
  }
}));

// POST /api/items/:id/reject — Stage 1: Global Item Creation rejection (checker only)
router.post('/:id/reject', asyncRoute(async (req, res) => {
  const actor = makerCheckerBackend.resolveActor({
    userId: req.header('x-kosh-user-id') || req.body?.actorUserId || req.body?.userId,
    userName: req.header('x-kosh-user-name') || req.body?.actorName || req.body?.userName,
    userRole: req.header('x-kosh-user-role') || req.body?.actorRole || req.body?.userRole,
  });

  try {
    const result = await makerCheckerBackend.rejectGlobalItem(
      req.params.id,
      actor,
      req.body?.remarks || 'Rejected'
    );
    res.json({ data: result.item });
  } catch (err: any) {
    sendError(res, err.status || 400, err.code || 'REJECT_FAILED', err.message);
  }
}));

export function createItemsRouter(): Router {
  return router;
}
