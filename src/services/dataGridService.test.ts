import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPageNumberRange,
  clampPageNumber,
  compareGridValues,
  executeDataGridQuery,
  getGlobalGridSettings,
  getUserGridPreference,
  GLOBAL_GRID_AUDIT_MATRIX,
  normalizeAllowedPageSizeOptions,
  normalizePageSize,
  resetForTesting,
  resetUserGridPreference,
  resolveEffectiveSortRules,
  saveGlobalGridSettings,
  saveUserGridPreference,
} from './dataGridService';

interface SampleRecord {
  id: string;
  code: string;
  title: string;
  amount: number;
  status: string;
  createdAt: string | null | undefined;
}

function makeSampleRecords(count: number): SampleRecord[] {
  return Array.from({ length: count }, (_, idx) => {
    const seq = idx + 1;
    const day = String(((idx % 28) + 1)).padStart(2, '0');
    const month = String((Math.floor(idx / 28) % 12) + 1).padStart(2, '0');
    return {
      id: `rec-${String(seq).padStart(3, '0')}`,
      code: `DOC-${String(seq).padStart(4, '0')}`,
      title: `Enterprise Item ${seq}`,
      amount: seq * 100,
      status: seq % 2 === 0 ? 'APPROVED' : 'DRAFT',
      createdAt: `2026-${month}-${day}T10:00:00Z`,
    };
  });
}

describe('dataGridService — Global Data Grid Standard', () => {
  beforeEach(() => {
    resetForTesting();
  });

  it('provides factory defaults: pageSize=20, options=[10,20,25,50,100,200], defaultSortDirection=desc', () => {
    const settings = getGlobalGridSettings();
    assert.equal(settings.defaultPageSize, 20);
    assert.deepEqual(settings.allowedPageSizeOptions, [10, 20, 25, 50, 100, 200]);
    assert.equal(settings.defaultSortDirection, 'desc');
    assert.equal(settings.maxPageSize, 200);
  });

  it('normalizes allowed page sizes and rejects out-of-range page size requests', () => {
    assert.deepEqual(
      normalizeAllowedPageSizeOptions([200, 5, 25, 25, 10, 500]),
      [10, 25, 200]
    );
    const settings = getGlobalGridSettings();
    assert.equal(normalizePageSize(20, settings), 20);
    assert.equal(normalizePageSize(50, settings), 50);
    assert.equal(normalizePageSize(999, settings), 200);
    assert.equal(normalizePageSize(13, settings), 20);
    assert.equal(normalizePageSize('invalid', settings), 20);
  });

  it('forces factory default descending sort even if settings update omits or attempts asc', () => {
    const updated = saveGlobalGridSettings(
      { defaultPageSize: 25, defaultSortDirection: 'asc' },
      'QA Auditor'
    );
    assert.equal(updated.defaultPageSize, 25);
    assert.equal(updated.defaultSortDirection, 'desc');
  });

  it('sorts newest-first DESC by default and sinks missing/null dates to bottom in both directions', () => {
    const records: SampleRecord[] = [
      { id: 'rec-1', code: 'A1', title: 'Oldest', amount: 10, status: 'DRAFT', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'rec-2', code: 'A2', title: 'Missing Null', amount: 20, status: 'DRAFT', createdAt: null },
      { id: 'rec-3', code: 'A3', title: 'Newest', amount: 30, status: 'APPROVED', createdAt: '2026-11-12T00:00:00Z' },
      { id: 'rec-4', code: 'A4', title: 'Missing Empty', amount: 40, status: 'DRAFT', createdAt: '' },
      { id: 'rec-5', code: 'A5', title: 'Middle', amount: 50, status: 'APPROVED', createdAt: '2026-06-15T00:00:00Z' },
    ];

    const descRes = executeDataGridQuery(records, {
      page: 1,
      pageSize: 20,
      defaultSortField: 'createdAt',
      tieBreakerField: 'id',
    });
    assert.deepEqual(
      descRes.data.map((r) => r.id),
      ['rec-3', 'rec-5', 'rec-1', 'rec-4', 'rec-2']
    );

    const ascRes = executeDataGridQuery(records, {
      page: 1,
      pageSize: 20,
      sortRules: [{ field: 'createdAt', direction: 'asc', dataType: 'date' }],
      tieBreakerField: 'id',
    });
    assert.deepEqual(
      ascRes.data.map((r) => r.id),
      ['rec-1', 'rec-5', 'rec-3', 'rec-4', 'rec-2']
    );
  });

  it('applies deterministic descending tie-breaker when primary sort values match', () => {
    const tied: SampleRecord[] = [
      { id: 'id-101', code: 'PR-101', title: 'First', amount: 100, status: 'DRAFT', createdAt: '2026-11-10T09:00:00Z' },
      { id: 'id-103', code: 'PR-103', title: 'Third', amount: 100, status: 'DRAFT', createdAt: '2026-11-10T09:00:00Z' },
      { id: 'id-102', code: 'PR-102', title: 'Second', amount: 100, status: 'DRAFT', createdAt: '2026-11-10T09:00:00Z' },
    ];

    const res = executeDataGridQuery(tied, {
      page: 1,
      pageSize: 20,
      defaultSortField: 'createdAt',
      tieBreakerField: 'code',
    });
    assert.deepEqual(
      res.data.map((r) => r.code),
      ['PR-103', 'PR-102', 'PR-101']
    );
  });

  it('places newly created record at Page 1 Row 1 under default DESC sort', () => {
    const initial = makeSampleRecords(25);
    const newlyCreated: SampleRecord = {
      id: 'rec-999',
      code: 'DOC-0999',
      title: 'Brand New Requisition',
      amount: 99900,
      status: 'DRAFT',
      createdAt: '2026-11-13T12:00:00Z',
    };
    const combined = [...initial, newlyCreated];

    const res = executeDataGridQuery(combined, {
      page: 1,
      pageSize: 20,
      defaultSortField: 'createdAt',
      tieBreakerField: 'id',
    });

    assert.equal(res.pagination.totalRecords, 26);
    assert.equal(res.pagination.totalPages, 2);
    assert.equal(res.pagination.rangeStart, 1);
    assert.equal(res.pagination.rangeEnd, 20);
    assert.equal(res.data[0].id, 'rec-999');
  });

  it('paginates with standard sizes [10, 20, 25, 50, 100, 200] and clamps page after deletion', () => {
    const dataset = makeSampleRecords(45);

    const page3At20 = executeDataGridQuery(dataset, { page: 3, pageSize: 20, defaultSortField: 'createdAt' });
    assert.equal(page3At20.pagination.currentPage, 3);
    assert.equal(page3At20.pagination.totalPages, 3);
    assert.equal(page3At20.pagination.rangeStart, 41);
    assert.equal(page3At20.pagination.rangeEnd, 45);
    assert.equal(page3At20.data.length, 5);

    // Simulate deleting 25 records so only 20 remain while user was on page 3
    const shrunk = dataset.slice(0, 20);
    const clamped = executeDataGridQuery(shrunk, { page: 3, pageSize: 20, defaultSortField: 'createdAt' });
    assert.equal(clamped.pagination.currentPage, 1);
    assert.equal(clamped.pagination.totalPages, 1);
    assert.equal(clamped.pagination.rangeStart, 1);
    assert.equal(clamped.pagination.rangeEnd, 20);

    // Check 10 rows/page
    const at10 = executeDataGridQuery(dataset, { page: 2, pageSize: 10, defaultSortField: 'createdAt' });
    assert.equal(at10.pagination.totalPages, 5);
    assert.equal(at10.pagination.rangeStart, 11);
    assert.equal(at10.pagination.rangeEnd, 20);

    assert.equal(clampPageNumber(-4, 45, 20), 1);
    assert.equal(clampPageNumber(99, 0, 20), 1);
  });

  it('filters by search and rule operators accurately', () => {
    const dataset = makeSampleRecords(30);
    const res = executeDataGridQuery(dataset, {
      page: 1,
      pageSize: 20,
      search: 'Item 2',
      searchableFields: ['title', 'code'],
      filters: [
        { field: 'status', operator: 'EQUALS', value: 'APPROVED' },
        { field: 'amount', operator: 'GREATER_THAN', value: '2100' },
      ],
      defaultSortField: 'amount',
    });

    assert.ok(res.data.length > 0);
    for (const row of res.data) {
      assert.equal(row.status, 'APPROVED');
      assert.ok(row.amount > 2100);
      assert.ok(row.title.includes('Item 2'));
    }

    const emptyRes = executeDataGridQuery(dataset, {
      page: 1,
      pageSize: 20,
      search: 'NON_EXISTENT_XYZ',
    });
    assert.equal(emptyRes.pagination.totalRecords, 0);
    assert.equal(emptyRes.pagination.rangeStart, 0);
    assert.equal(emptyRes.pagination.rangeEnd, 0);
    assert.equal(emptyRes.pagination.totalPages, 1);
  });

  it('persists and resets user + device scoped grid preferences', () => {
    saveUserGridPreference({
      gridId: 'purchase-requisition-list',
      userId: 'usr-buyer-01',
      deviceType: 'tablet',
      pageSize: 50,
      columnOrder: ['prNumber', 'prDate'],
      visibleColumns: { prNumber: true, prDate: true },
      columnWidths: { prNumber: 140 },
      sortRules: [{ field: 'prDate', direction: 'asc', dataType: 'date' }],
    });

    const loaded = getUserGridPreference('purchase-requisition-list', 'usr-buyer-01', 'tablet');
    assert.ok(loaded);
    assert.equal(loaded?.pageSize, 50);
    assert.equal(loaded?.sortRules[0]?.direction, 'asc');

    // Different device does not collide
    assert.equal(getUserGridPreference('purchase-requisition-list', 'usr-buyer-01', 'desktop'), null);

    resetUserGridPreference('purchase-requisition-list', 'usr-buyer-01', 'tablet');
    assert.equal(getUserGridPreference('purchase-requisition-list', 'usr-buyer-01', 'tablet'), null);
  });

  it('builds accessible page ranges with ellipsis cleanly', () => {
    assert.deepEqual(buildPageNumberRange(1, 5, 5), [1, 2, 3, 4, 5]);
    assert.deepEqual(buildPageNumberRange(1, 12, 5), [1, 2, 3, 4, 5, 'ellipsis', 12]);
    assert.deepEqual(buildPageNumberRange(6, 12, 5), [1, 'ellipsis', 4, 5, 6, 7, 8, 'ellipsis', 12]);
    assert.deepEqual(buildPageNumberRange(11, 12, 5), [1, 'ellipsis', 8, 9, 10, 11, 12]);
  });

  it('auto-detects default DESC sort field and validates compareGridValues and audit matrix', () => {
    const autoRules = resolveEffectiveSortRules(undefined, undefined, 'desc', [
      { id: '1', updatedAt: '2026-11-10' },
    ]);
    assert.deepEqual(autoRules, [{ field: 'updatedAt', direction: 'desc' }]);

    assert.ok(compareGridValues('2026-11-13', '2026-11-01', 'desc', 'date', 'createdAt') < 0);
    assert.ok(compareGridValues(200, 100, 'desc', 'number', 'amount') < 0);

    assert.ok(GLOBAL_GRID_AUDIT_MATRIX.length >= 20);
    for (const entry of GLOBAL_GRID_AUDIT_MATRIX) {
      assert.equal(entry.defaultSortDirection, 'DESC');
      assert.ok(entry.gridId.length > 0);
      assert.ok(entry.filePath.startsWith('src/'));
    }
  });
});
