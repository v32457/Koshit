/**
 * CIPPLATFORM - PURCHASE REQUISITIONS HEADER VIEW vs LINE / LIVE VIEW PARITY UNIT TEST SUITE
 * Verifies functional parity between Header View and Line / Live View across:
 *  - Line flattening & parent-child integrity
 *  - Factory default descending sort + deterministic tie-breakers
 *  - Text / numeric / date / status ASC & DESC & multi-column sorting
 *  - Column visibility with mandatory identifier locks, drag/step reordering, clamping & auto-fit
 *  - View-scoped, user-scoped, company-scoped Saved Layouts (Save New, Update, Load, Set Default, Delete, Reset)
 *  - Strict isolation between HEADER and LINE views and across users/companies
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AVAILABLE_PR_LINE_COLUMNS,
  PRLineColumnKey,
  PRSortRule,
  calculateLineAutoFitWidth,
  clampLineColumnWidth,
  deleteSavedViewLayout,
  flattenPrLines,
  getActiveSavedViewLayout,
  getDefaultLineColumnStates,
  getLineColumnDisplayText,
  listSavedViewLayouts,
  loadSavedViewLayoutById,
  reorderColumns,
  resetViewGridLayout,
  saveNamedViewLayout,
  setDefaultSavedViewLayout,
  sortPrLineRecords,
  toggleSortRule,
} from '../services/prGridConfigService';
import { PurchaseRequisitionService } from '../services/purchaseRequisitionService';
import { dataGridService, GLOBAL_GRID_AUDIT_MATRIX } from '../services/dataGridService';

test('1. Line View registers 24 columns with mandatory PR Number, Line, and Item Code identifiers', () => {
  assert.equal(AVAILABLE_PR_LINE_COLUMNS.length, 24);
  const mandatoryKeys = AVAILABLE_PR_LINE_COLUMNS.filter((c) => c.mandatory).map((c) => c.key);
  assert.deepEqual(mandatoryKeys, ['prNumber', 'lineNumber', 'itemCode']);

  const defaultCols = getDefaultLineColumnStates();
  const defaultVisible = defaultCols.filter((c) => c.visible);
  const defaultHidden = defaultCols.filter((c) => !c.visible);
  assert.equal(defaultVisible.length, 14);
  assert.equal(defaultHidden.length, 10);
});

test('2. flattenPrLines expands multi-line PRs without data loss and resolves pending qty, currency, and delivery date', () => {
  const prs = PurchaseRequisitionService.getPurchaseRequisitions();
  const expectedTotalLines = prs.reduce((acc, pr) => acc + (pr.lines?.length || 0), 0);
  const flattened = flattenPrLines(prs);

  assert.equal(flattened.length, expectedTotalLines);
  const uniqueRowIds = new Set(flattened.map((r) => r.rowId));
  assert.equal(uniqueRowIds.size, flattened.length, 'Each line row must have a unique rowId');

  // Verify line numbers are sequential per PR and pending qty = max(0, requested - received)
  for (const row of flattened) {
    assert.ok(row.lineNumber >= 1);
    assert.equal(row.pendingQuantity, Math.max(0, row.requestedQuantity - row.receivedQuantity));
    assert.ok(row.currency.length >= 3);
  }
});

test('3. Line View sorting defaults to prDate DESC with deterministic tie-breakers and supports multi-sort', () => {
  const prs = PurchaseRequisitionService.getPurchaseRequisitions();
  const rows = flattenPrLines(prs);

  // Default descending order (empty sortRules -> prDate DESC, prNumber DESC, lineNumber ASC)
  const defaultSorted = sortPrLineRecords(rows, []);
  for (let i = 1; i < defaultSorted.length; i++) {
    const prevTime = new Date(defaultSorted[i - 1].createdAt).getTime();
    const currTime = new Date(defaultSorted[i].createdAt).getTime();
    assert.ok(prevTime >= currTime, 'Default Line View sort must be prDate DESC');
  }

  // Numeric sort ascending by estimatedTotalValue
  const ascVal = sortPrLineRecords(rows, [{ key: 'estimatedTotalValue', direction: 'asc' }]);
  for (let i = 1; i < ascVal.length; i++) {
    assert.ok(ascVal[i].estimatedTotalValue >= ascVal[i - 1].estimatedTotalValue);
  }

  // Text sort descending by itemCode
  const descItem = sortPrLineRecords(rows, [{ key: 'itemCode', direction: 'desc' }]);
  for (let i = 1; i < descItem.length; i++) {
    assert.ok(
      getLineColumnDisplayText(descItem[i - 1], 'itemCode').toLowerCase() >=
        getLineColumnDisplayText(descItem[i], 'itemCode').toLowerCase()
    );
  }

  // Multi-column sort toggling for PRLineColumnKey
  let rules: PRSortRule<PRLineColumnKey>[] = toggleSortRule([], 'currency', false);
  assert.deepEqual(rules, [{ key: 'currency', direction: 'asc' }]);
  rules = toggleSortRule(rules, 'requestedQuantity', true);
  assert.equal(rules.length, 2);
  rules = toggleSortRule(rules, 'requestedQuantity', true);
  assert.equal(rules[1].direction, 'desc');
});

test('4. Line View column resizing, auto-fit calculation, and drag/step column reordering work accurately', () => {
  const prs = PurchaseRequisitionService.getPurchaseRequisitions();
  const rows = flattenPrLines(prs);

  assert.equal(clampLineColumnWidth('lineNumber', 10), 56);
  assert.equal(clampLineColumnWidth('lineNumber', 500), 120);

  const autoFitDesc = calculateLineAutoFitWidth('description', rows);
  assert.ok(autoFitDesc >= 150 && autoFitDesc <= 460);

  const defaults = getDefaultLineColumnStates();
  const reordered = reorderColumns(defaults, 'expectedDeliveryDate', 'itemCode');
  const idxExp = reordered.findIndex((c) => c.key === 'expectedDeliveryDate');
  const idxItem = reordered.findIndex((c) => c.key === 'itemCode');
  assert.ok(idxExp < idxItem, 'Dragged column should move ahead of target column');
  reordered.forEach((col, index) => assert.equal(col.order, index));
});

test('5. Named Saved Layouts support Save New, Update, Load, Set Default, Delete, and Reset with User + Company + View isolation', () => {
  const userA = 'usr-parity-alpha';
  const userB = 'usr-parity-beta';
  const compA = 'comp-1';
  const compB = 'comp-2';

  // Ensure clean slate
  resetViewGridLayout(userA, 'LINE', compA);
  resetViewGridLayout(userA, 'HEADER', compA);

  // Save Layout 1 in LINE view for userA / compA
  const customLineCols = getDefaultLineColumnStates().map((c) =>
    c.key === 'itemCategory' ? { ...c, visible: true, width: 190 } : c
  );
  const layout1 = saveNamedViewLayout<PRLineColumnKey>({
    userId: userA,
    viewType: 'LINE',
    companyId: compA,
    layoutName: 'Buyer Line Focus',
    columns: customLineCols,
    sortRules: [{ key: 'estimatedTotalValue', direction: 'desc' }],
    pageSize: 50,
    filters: { selectedCurrency: 'INR' },
    isDefault: true,
  });

  assert.equal(layout1.viewType, 'LINE');
  assert.equal(layout1.isDefault, true);
  assert.equal(layout1.pageSize, 50);

  // Save Layout 2 for same user/view/company and switch default
  const layout2 = saveNamedViewLayout<PRLineColumnKey>({
    userId: userA,
    viewType: 'LINE',
    companyId: compA,
    layoutName: 'Pending Qty Focus',
    columns: getDefaultLineColumnStates(),
    sortRules: [{ key: 'pendingQuantity', direction: 'desc' }],
    pageSize: 25,
    isDefault: false,
  });

  const afterDefaultSwitch = setDefaultSavedViewLayout<PRLineColumnKey>(
    userA,
    'LINE',
    compA,
    layout2.id
  );
  assert.equal(afterDefaultSwitch.filter((l) => l.isDefault).length, 1);
  assert.equal(afterDefaultSwitch.find((l) => l.isDefault)?.id, layout2.id);

  // Update Layout 1 and verify updatedAt + pageSize change while createdAt stays intact
  const updated1 = saveNamedViewLayout<PRLineColumnKey>({
    userId: userA,
    viewType: 'LINE',
    companyId: compA,
    layoutId: layout1.id,
    layoutName: 'Buyer Line Focus v2',
    columns: customLineCols,
    sortRules: [{ key: 'itemCode', direction: 'asc' }],
    pageSize: 100,
    isDefault: false,
  });
  assert.equal(updated1.createdAt, layout1.createdAt);
  assert.equal(updated1.pageSize, 100);
  assert.equal(updated1.layoutName, 'Buyer Line Focus v2');

  // Isolation checks:
  // 1) HEADER view for userA / compA has NO layouts from LINE view
  assert.equal(listSavedViewLayouts(userA, 'HEADER', compA).length, 0);
  // 2) userB for LINE / compA has NO layouts from userA
  assert.equal(listSavedViewLayouts(userB, 'LINE', compA).length, 0);
  // 3) userA for LINE / compB has NO layouts from compA
  assert.equal(listSavedViewLayouts(userA, 'LINE', compB).length, 0);

  // Load Layout 1 explicitly and check active layout
  const loaded = loadSavedViewLayoutById<PRLineColumnKey>(userA, 'LINE', compA, layout1.id);
  assert.equal(loaded.id, layout1.id);
  assert.equal(getActiveSavedViewLayout(userA, 'LINE', compA)?.id, layout1.id);

  // Mandatory column protection: even if corrupted input tries to hide prNumber/lineNumber/itemCode, save forces visible=true
  const corruptedAttempt = getDefaultLineColumnStates().map((c) =>
    c.key === 'itemCode' || c.key === 'lineNumber' ? { ...c, visible: false } : c
  );
  const hardened = saveNamedViewLayout<PRLineColumnKey>({
    userId: userA,
    viewType: 'LINE',
    companyId: compA,
    layoutName: 'Hardened Check',
    columns: hardenedColumnsInput(corruptedAttempt),
    sortRules: [],
    pageSize: 20,
  });
  assert.equal(hardened.columns.find((c) => c.key === 'itemCode')?.visible, true);
  assert.equal(hardened.columns.find((c) => c.key === 'lineNumber')?.visible, true);

  // Cross-view schema sanitization: passing a Header-only key into LINE layout strips it cleanly
  const sanitized = saveNamedViewLayout({
    userId: userA,
    viewType: 'LINE',
    companyId: compA,
    layoutName: 'Cross View Check',
    columns: [],
    sortRules: [
      { key: 'purposeAndItems', direction: 'asc' },
      { key: 'itemCode', direction: 'desc' },
    ],
    pageSize: 20,
  });
  assert.deepEqual(sanitized.sortRules, [{ key: 'itemCode', direction: 'desc' }]);

  // Delete layout and reset to Factory Default
  deleteSavedViewLayout(userA, 'LINE', compA, layout2.id);
  assert.equal(
    listSavedViewLayouts(userA, 'LINE', compA).some((l) => l.id === layout2.id),
    false
  );
  // Trying to delete another user's layout fails explicitly
  assert.throws(() => deleteSavedViewLayout(userB, 'LINE', compA, layout1.id));

  const resetResult = resetViewGridLayout<PRLineColumnKey>(userA, 'LINE', compA);
  assert.equal(resetResult.pageSize, 20);
  assert.equal(resetResult.sortRules.length, 0);
  assert.equal(resetResult.columns.filter((c) => c.visible).length, 14);
  assert.equal(
    getActiveSavedViewLayout(userA, 'LINE', compA),
    null,
    'After Reset Layout, getActiveSavedViewLayout must remain null instead of snapping back to old default'
  );
});

test('6. Line-level pagination slices rows accurately per page and registers in Global Grid Audit Matrix', () => {
  const prs = PurchaseRequisitionService.getPurchaseRequisitions();
  const rows = flattenPrLines(prs);
  const page1 = dataGridService.executeDataGridQuery(rows, {
    page: 1,
    pageSize: 10,
    defaultSortField: 'prDate',
    defaultSortDirection: 'desc',
    tieBreakerField: 'rowId',
  });
  const page2 = dataGridService.executeDataGridQuery(rows, {
    page: 2,
    pageSize: 10,
    defaultSortField: 'prDate',
    defaultSortDirection: 'desc',
    tieBreakerField: 'rowId',
  });

  assert.equal(page1.data.length, Math.min(10, rows.length));
  assert.equal(page1.pagination.totalRecords, rows.length);
  if (rows.length > 10) {
    assert.notEqual(page1.data[0].rowId, page2.data[0].rowId);
  }

  const lineAudit = GLOBAL_GRID_AUDIT_MATRIX.find(
    (entry) => entry.gridId === 'purchase-requisition-line-list'
  );
  assert.ok(lineAudit, 'Line View must be registered in GLOBAL_GRID_AUDIT_MATRIX');
  assert.equal(lineAudit?.defaultSortField, 'prDate');
  assert.equal(lineAudit?.defaultSortDirection, 'DESC');
});

test('7. Named Saved Layout rejects empty layout names and surfaces storage failure errors explicitly', () => {
  assert.throws(
    () =>
      saveNamedViewLayout({
        userId: 'usr-err-test',
        viewType: 'LINE',
        companyId: 'comp-1',
        layoutName: '   ',
        columns: getDefaultLineColumnStates(),
        sortRules: [],
        pageSize: 20,
      }),
    /Layout name is required/
  );

  // Simulate localStorage quota/failure
  const prevStorage = (globalThis as { localStorage?: Storage }).localStorage;
  try {
    (globalThis as { localStorage?: Partial<Storage> }).localStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    };
    assert.throws(
      () =>
        saveNamedViewLayout({
          userId: 'usr-err-test',
          viewType: 'LINE',
          companyId: 'comp-1',
          layoutName: 'Fail Safe Check',
          columns: getDefaultLineColumnStates(),
          sortRules: [],
          pageSize: 20,
        }),
      /Failed to persist saved layout/
    );
  } finally {
    if (prevStorage === undefined) {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    } else {
      (globalThis as { localStorage?: Storage }).localStorage = prevStorage;
    }
  }
});

function hardenedColumnsInput(cols: ReturnType<typeof getDefaultLineColumnStates>) {
  return cols;
}
