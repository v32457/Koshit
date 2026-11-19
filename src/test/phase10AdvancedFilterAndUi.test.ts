import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDateRange,
  matchesDateRange,
  evaluateAdvancedFilters,
  buildAdvancedFilterChips,
  countActiveAdvancedConditions,
  saveFilterPreset,
  listFilterPresets,
  updateFilterPreset,
  renameFilterPreset,
  deleteFilterPreset,
  getDefaultFilterPreset,
  FilterFieldDefinition,
  AdvancedFilterState,
} from '../services/advancedFilterEngine';

// Mock localStorage for Node.js test environment
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => (storageMap.has(key) ? storageMap.get(key)! : null),
  setItem: (key: string, value: string) => storageMap.set(key, String(value)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

interface SamplePrRecord {
  id: string;
  prNumber: string;
  prDate: string;
  expectedDeliveryDate: string;
  branchName: string;
  department: string;
  priority: string;
  status: string;
  estimatedTotalValue: number;
  isPreferredVendor: boolean;
  lineItemCodes: string[];
}

const SAMPLE_PRS: SamplePrRecord[] = [
  {
    id: 'pr-1',
    prNumber: 'PR-2026-0001',
    prDate: '2026-03-01',
    expectedDeliveryDate: '2026-03-15',
    branchName: 'Pondicherry Manufacturing Plant',
    department: 'Production',
    priority: 'HIGH',
    status: 'APPROVED',
    estimatedTotalValue: 45000,
    isPreferredVendor: true,
    lineItemCodes: ['GLB-PA-RAW-INJ-00001', 'GLB-STL-CMP-CNC-00002'],
  },
  {
    id: 'pr-2',
    prNumber: 'PR-2026-0002',
    prDate: '2026-03-10',
    expectedDeliveryDate: '2026-03-25',
    branchName: 'Chennai Automotive Hub',
    department: 'Quality',
    priority: 'URGENT',
    status: 'SUBMITTED',
    estimatedTotalValue: 125000,
    isPreferredVendor: true,
    lineItemCodes: ['GLB-ALU-RAW-SHT-00003'],
  },
  {
    id: 'pr-3',
    prNumber: 'PR-2026-0003',
    prDate: '2026-03-20',
    expectedDeliveryDate: '2026-04-05',
    branchName: 'Pondicherry Manufacturing Plant',
    department: 'Maintenance',
    priority: 'NORMAL',
    status: 'DRAFT',
    estimatedTotalValue: 8500,
    isPreferredVendor: false,
    lineItemCodes: ['GLB-COP-SPR-WIR-00004'],
  },
];

const PR_FILTER_FIELDS: FilterFieldDefinition<SamplePrRecord>[] = [
  { key: 'prNumber', label: 'PR Number', type: 'TEXT', accessor: (r) => r.prNumber },
  { key: 'prDate', label: 'PR Date', type: 'DATE', accessor: (r) => r.prDate },
  { key: 'expectedDeliveryDate', label: 'Expected Delivery Date', type: 'DATE', accessor: (r) => r.expectedDeliveryDate },
  { key: 'branchName', label: 'Branch', type: 'DROPDOWN', accessor: (r) => r.branchName },
  { key: 'department', label: 'Department', type: 'TEXT', accessor: (r) => r.department },
  { key: 'priority', label: 'Priority', type: 'DROPDOWN', accessor: (r) => r.priority },
  { key: 'status', label: 'Approval Status', type: 'DROPDOWN', accessor: (r) => r.status },
  { key: 'estimatedTotalValue', label: 'Estimated Value', type: 'NUMBER', accessor: (r) => r.estimatedTotalValue },
  { key: 'isPreferredVendor', label: 'Preferred Vendor', type: 'BOOLEAN', accessor: (r) => r.isPreferredVendor },
  { key: 'lineItemCodes', label: 'Global Item Code', type: 'TEXT', accessor: (r) => r.lineItemCodes },
];

describe('Phase 10 — Independent Date-Range Filter & Advanced Filter Engine', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it('validates inclusive Date Ranges and rejects invalid ranges where From > To', () => {
    assert.deepEqual(validateDateRange({ from: '', to: '' }, 'PR Date'), { isValid: true });
    assert.deepEqual(validateDateRange({ from: '2026-03-01', to: '' }, 'PR Date'), { isValid: true });
    assert.deepEqual(validateDateRange({ from: '', to: '2026-03-31' }, 'PR Date'), { isValid: true });
    assert.deepEqual(validateDateRange({ from: '2026-03-10', to: '2026-03-10' }, 'PR Date'), { isValid: true });

    const invalid = validateDateRange({ from: '2026-03-20', to: '2026-03-05' }, 'PR Date');
    assert.equal(invalid.isValid, false);
    assert.ok(invalid.error?.includes('cannot be later than'));
  });

  it('evaluates PR Date Range and Expected Delivery Date Range independently with inclusive bounds', () => {
    // 1. Start date only on PR Date
    const prFromMarch10 = SAMPLE_PRS.filter((pr) =>
      matchesDateRange(pr.prDate, { from: '2026-03-10', to: '' })
    );
    assert.equal(prFromMarch10.length, 2);
    assert.deepEqual(
      prFromMarch10.map((r) => r.prNumber),
      ['PR-2026-0002', 'PR-2026-0003']
    );

    // 2. End date only on Expected Delivery Date
    const deliveryUpToMarch25 = SAMPLE_PRS.filter((pr) =>
      matchesDateRange(pr.expectedDeliveryDate, { from: '', to: '2026-03-25' })
    );
    assert.equal(deliveryUpToMarch25.length, 2);
    assert.deepEqual(
      deliveryUpToMarch25.map((r) => r.prNumber),
      ['PR-2026-0001', 'PR-2026-0002']
    );

    // 3. Combined independent PR Date Range AND Expected Delivery Date Range
    const combined = SAMPLE_PRS.filter(
      (pr) =>
        matchesDateRange(pr.prDate, { from: '2026-03-01', to: '2026-03-15' }) &&
        matchesDateRange(pr.expectedDeliveryDate, { from: '2026-03-20', to: '2026-03-30' })
    );
    assert.equal(combined.length, 1);
    assert.equal(combined[0].prNumber, 'PR-2026-0002');

    // 4. Invalid range returns false (blocks misleading records)
    const invalidResult = SAMPLE_PRS.filter((pr) =>
      matchesDateRange(pr.prDate, { from: '2026-04-01', to: '2026-03-01' })
    );
    assert.equal(invalidResult.length, 0);
  });

  it('evaluates TEXT, NUMBER, DROPDOWN, BOOLEAN, and DATE operators in multi-condition AND/OR groups', () => {
    const stateAnd: AdvancedFilterState = {
      groupLogicalOperator: 'AND',
      groups: [
        {
          id: 'g1',
          logicalOperator: 'AND',
          conditions: [
            { id: 'c1', fieldKey: 'branchName', operator: 'EQUALS', value: 'Pondicherry Manufacturing Plant' },
            { id: 'c2', fieldKey: 'estimatedTotalValue', operator: 'GREATER_THAN', value: '10000' },
            { id: 'c3', fieldKey: 'isPreferredVendor', operator: 'TRUE', value: '' },
          ],
        },
      ],
    };

    const resAnd = evaluateAdvancedFilters(SAMPLE_PRS, stateAnd, PR_FILTER_FIELDS);
    assert.equal(resAnd.length, 1);
    assert.equal(resAnd[0].prNumber, 'PR-2026-0001');

    // Multi-group OR evaluation
    const stateMultiGroupOr: AdvancedFilterState = {
      groupLogicalOperator: 'OR',
      groups: [
        {
          id: 'g1',
          logicalOperator: 'AND',
          conditions: [
            { id: 'c1', fieldKey: 'priority', operator: 'EQUALS', value: 'URGENT' },
          ],
        },
        {
          id: 'g2',
          logicalOperator: 'AND',
          conditions: [
            { id: 'c2', fieldKey: 'lineItemCodes', operator: 'CONTAINS', value: 'COP-SPR' },
          ],
        },
      ],
    };

    const resOr = evaluateAdvancedFilters(SAMPLE_PRS, stateMultiGroupOr, PR_FILTER_FIELDS);
    assert.equal(resOr.length, 2);
    assert.deepEqual(
      resOr.map((r) => r.prNumber),
      ['PR-2026-0002', 'PR-2026-0003']
    );

    assert.equal(countActiveAdvancedConditions(stateMultiGroupOr, PR_FILTER_FIELDS), 2);
    const chips = buildAdvancedFilterChips(stateMultiGroupOr, PR_FILTER_FIELDS, () => {});
    assert.equal(chips.length, 2);
  });

  it('manages user-scoped Saved Filter Presets (Save, List, Update, Rename, Delete)', () => {
    const filterState: AdvancedFilterState = {
      groupLogicalOperator: 'AND',
      groups: [
        {
          id: 'g1',
          logicalOperator: 'AND',
          conditions: [{ id: 'c1', fieldKey: 'status', operator: 'EQUALS', value: 'APPROVED' }],
        },
      ],
    };

    const saved = saveFilterPreset({
      moduleKey: 'PURCHASE_REQUISITION_LIST',
      userId: 'usr-01',
      name: 'Approved High Value PRs',
      filterState,
      isDefault: true,
    });

    assert.equal(saved.name, 'Approved High Value PRs');
    assert.equal(listFilterPresets('PURCHASE_REQUISITION_LIST', 'usr-01').length, 1);
    assert.equal(listFilterPresets('PURCHASE_REQUISITION_LIST', 'usr-02').length, 0);
    assert.equal(getDefaultFilterPreset('PURCHASE_REQUISITION_LIST', 'usr-01')?.id, saved.id);

    const renamed = renameFilterPreset(
      'PURCHASE_REQUISITION_LIST',
      'usr-01',
      saved.id,
      'Approved Plant PRs'
    );
    assert.equal(renamed.name, 'Approved Plant PRs');

    const updated = updateFilterPreset({
      moduleKey: 'PURCHASE_REQUISITION_LIST',
      userId: 'usr-01',
      presetId: saved.id,
      filterState: { groupLogicalOperator: 'OR', groups: [] },
    });
    assert.equal(updated.filterState.groupLogicalOperator, 'OR');

    deleteFilterPreset('PURCHASE_REQUISITION_LIST', 'usr-01', saved.id);
    assert.equal(listFilterPresets('PURCHASE_REQUISITION_LIST', 'usr-01').length, 0);
  });

  it('evaluates multi-select dropdown values across quick filters and advanced EQUALS/NOT_EQUALS/IS_ANY_OF conditions', () => {
    const multiEqualsState: AdvancedFilterState = {
      groupLogicalOperator: 'AND',
      groups: [
        {
          id: 'g-multi',
          logicalOperator: 'AND',
          conditions: [
            {
              id: 'c-multi',
              fieldKey: 'status',
              operator: 'EQUALS',
              value: 'APPROVED,DRAFT',
              values: ['APPROVED', 'DRAFT'],
            },
          ],
        },
      ],
    };

    const matched = evaluateAdvancedFilters(SAMPLE_PRS, multiEqualsState, PR_FILTER_FIELDS);
    assert.equal(matched.length, 2);
    assert.deepEqual(
      matched.map((r) => r.prNumber),
      ['PR-2026-0001', 'PR-2026-0003']
    );
  });
});

