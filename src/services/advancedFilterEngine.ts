/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PHASE 10 — ENTERPRISE ADVANCED FILTER ENGINE
 * Reusable, user-input-driven multi-condition & multi-group filter evaluation engine,
 * independent inclusive date-range evaluator, and user-scoped Saved Filter Preset manager.
 */

export type FilterFieldType = 'TEXT' | 'DATE' | 'NUMBER' | 'DROPDOWN' | 'BOOLEAN';

export type TextFilterOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'DOES_NOT_CONTAIN'
  | 'STARTS_WITH'
  | 'ENDS_WITH';

export type DateFilterOperator =
  | 'BETWEEN'
  | 'BEFORE'
  | 'AFTER'
  | 'ON'
  | 'IS_EMPTY'
  | 'IS_NOT_EMPTY';

export type NumberFilterOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN_OR_EQUAL'
  | 'BETWEEN';

export type DropdownFilterOperator = 'EQUALS' | 'NOT_EQUALS' | 'IS_ANY_OF';

export type BooleanFilterOperator = 'TRUE' | 'FALSE';

export type FilterOperator =
  | TextFilterOperator
  | DateFilterOperator
  | NumberFilterOperator
  | DropdownFilterOperator
  | BooleanFilterOperator;

export type LogicalOperator = 'AND' | 'OR';

export interface FilterOptionItem {
  value: string;
  label: string;
}

export interface FilterFieldDefinition<T = any> {
  key: string;
  label: string;
  type: FilterFieldType;
  options?: FilterOptionItem[];
  placeholder?: string;
  /**
   * Extracts either a single value or an array of values (e.g., line items inside a PR header)
   * from a record. When an array is returned, condition evaluation checks whether ANY element
   * satisfies positive operators (or ALL elements satisfy negative operators like NOT_EQUALS / DOES_NOT_CONTAIN).
   */
  accessor: (record: T) => unknown;
}

export interface FilterCondition {
  id: string;
  fieldKey: string;
  operator: FilterOperator;
  value: string;
  valueTo?: string;
  values?: string[];
}

export interface FilterConditionGroup {
  id: string;
  label?: string;
  logicalOperator: LogicalOperator;
  conditions: FilterCondition[];
}

export interface AdvancedFilterState {
  groupLogicalOperator: LogicalOperator;
  groups: FilterConditionGroup[];
}

export interface DateRangeFilterValue {
  from: string;
  to: string;
}

export interface DateRangeValidationResult {
  isValid: boolean;
  error?: string;
}

export interface SavedFilterPreset {
  id: string;
  moduleKey: string;
  userId: string;
  name: string;
  filterState: AdvancedFilterState;
  quickFilters?: Record<string, any>;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveFilterChip {
  id: string;
  groupId?: string;
  conditionId?: string;
  category: 'ADVANCED' | 'DATE_RANGE' | 'QUICK';
  fieldLabel: string;
  operatorLabel: string;
  valueLabel: string;
  onRemove?: () => void;
}

export const OPERATORS_BY_FIELD_TYPE: Record<
  FilterFieldType,
  Array<{ value: FilterOperator; label: string }>
> = {
  TEXT: [
    { value: 'CONTAINS', label: 'Contains' },
    { value: 'EQUALS', label: 'Equals' },
    { value: 'NOT_EQUALS', label: 'Not Equals' },
    { value: 'DOES_NOT_CONTAIN', label: 'Does Not Contain' },
    { value: 'STARTS_WITH', label: 'Starts With' },
    { value: 'ENDS_WITH', label: 'Ends With' },
  ],
  DATE: [
    { value: 'ON', label: 'On' },
    { value: 'BETWEEN', label: 'Between' },
    { value: 'BEFORE', label: 'Before' },
    { value: 'AFTER', label: 'After' },
    { value: 'IS_EMPTY', label: 'Is Empty' },
    { value: 'IS_NOT_EMPTY', label: 'Is Not Empty' },
  ],
  NUMBER: [
    { value: 'EQUALS', label: 'Equals' },
    { value: 'NOT_EQUALS', label: 'Not Equals' },
    { value: 'GREATER_THAN', label: 'Greater Than (>)' },
    { value: 'LESS_THAN', label: 'Less Than (<)' },
    { value: 'GREATER_THAN_OR_EQUAL', label: 'Greater Than or Equal (>=)' },
    { value: 'LESS_THAN_OR_EQUAL', label: 'Less Than or Equal (<=)' },
    { value: 'BETWEEN', label: 'Between' },
  ],
  DROPDOWN: [
    { value: 'EQUALS', label: 'Equals' },
    { value: 'NOT_EQUALS', label: 'Not Equals' },
    { value: 'IS_ANY_OF', label: 'Is Any Of' },
  ],
  BOOLEAN: [
    { value: 'TRUE', label: 'True' },
    { value: 'FALSE', label: 'False' },
  ],
};

export function getDefaultOperatorForFieldType(type: FilterFieldType): FilterOperator {
  switch (type) {
    case 'TEXT':
      return 'CONTAINS';
    case 'DATE':
      return 'ON';
    case 'NUMBER':
      return 'EQUALS';
    case 'DROPDOWN':
      return 'EQUALS';
    case 'BOOLEAN':
      return 'TRUE';
  }
}

export function getOperatorLabel(operator: FilterOperator): string {
  for (const list of Object.values(OPERATORS_BY_FIELD_TYPE)) {
    const found = list.find((item) => item.value === operator);
    if (found) return found.label;
  }
  return operator;
}

export function createEmptyCondition(firstField?: FilterFieldDefinition): FilterCondition {
  const fieldKey = firstField?.key || '';
  const op = firstField ? getDefaultOperatorForFieldType(firstField.type) : 'CONTAINS';
  return {
    id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fieldKey,
    operator: op,
    value: '',
    valueTo: '',
    values: [],
  };
}

export function createEmptyGroup(
  firstField?: FilterFieldDefinition,
  index = 1
): FilterConditionGroup {
  return {
    id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: `Condition Group ${index}`,
    logicalOperator: 'AND',
    conditions: firstField ? [createEmptyCondition(firstField)] : [],
  };
}

export function createInitialAdvancedFilterState(): AdvancedFilterState {
  return {
    groupLogicalOperator: 'AND',
    groups: [],
  };
}

/**
 * Normalizes any ISO timestamp or date string to YYYY-MM-DD for calendar-date comparison.
 */
export function normalizeDateString(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  if (!str || str === '—' || str === 'N/A') return '';
  // Match YYYY-MM-DD at start
  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return '';
}

/**
 * Validates an inclusive date range (From / To).
 * Rejects invalid ranges where From > To with a clear inline validation error.
 */
export function validateDateRange(
  range: DateRangeFilterValue,
  fieldLabel = 'Date'
): DateRangeValidationResult {
  const from = normalizeDateString(range.from);
  const to = normalizeDateString(range.to);
  if (from && to && from > to) {
    return {
      isValid: false,
      error: `${fieldLabel} range is invalid: "From" date (${from}) cannot be later than "To" date (${to}).`,
    };
  }
  return { isValid: true };
}

/**
 * Evaluates whether a record's date value (or array of date values) satisfies an inclusive Date Range filter.
 * - Supports start date only (`from` set, `to` empty): date >= from
 * - Supports end date only (`from` empty, `to` set): date <= to
 * - Supports both start and end dates: from <= date <= to (inclusive)
 * - If range is invalid (`from > to`), returns false so invalid ranges never return misleading records.
 */
export function matchesDateRange(
  rawDateOrDates: unknown,
  range: DateRangeFilterValue
): boolean {
  const from = normalizeDateString(range.from);
  const to = normalizeDateString(range.to);
  if (!from && !to) return true;

  const validation = validateDateRange({ from, to });
  if (!validation.isValid) return false;

  const candidates = Array.isArray(rawDateOrDates) ? rawDateOrDates : [rawDateOrDates];
  const normalizedCandidates = candidates
    .map((c) => normalizeDateString(c))
    .filter((d) => d.length > 0);

  if (normalizedCandidates.length === 0) return false;

  return normalizedCandidates.some((dateStr) => {
    if (from && dateStr < from) return false;
    if (to && dateStr > to) return false;
    return true;
  });
}

/**
 * Determines whether a condition has meaningful user input to be evaluated as active.
 */
export function isConditionActive(
  condition: FilterCondition,
  fieldDef?: FilterFieldDefinition
): boolean {
  if (!condition.fieldKey) return false;
  const op = condition.operator;

  if (op === 'IS_EMPTY' || op === 'IS_NOT_EMPTY' || op === 'TRUE' || op === 'FALSE') {
    return true;
  }

  if (op === 'IS_ANY_OF') {
    const list =
      condition.values && condition.values.length > 0
        ? condition.values
        : condition.value
          ? condition.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
    return list.length > 0;
  }

  if (op === 'BETWEEN') {
    const hasStart = String(condition.value ?? '').trim().length > 0;
    const hasEnd = String(condition.valueTo ?? '').trim().length > 0;
    if (fieldDef?.type === 'DATE') {
      return hasStart || hasEnd;
    }
    return hasStart || hasEnd;
  }

  return String(condition.value ?? '').trim().length > 0;
}

/**
 * Validates a single filter condition (e.g. checking for invalid Date or Number BETWEEN ranges).
 */
export function validateCondition(
  condition: FilterCondition,
  fieldDef?: FilterFieldDefinition
): string | null {
  if (!isConditionActive(condition, fieldDef)) return null;
  if (condition.operator === 'BETWEEN') {
    const v1 = String(condition.value ?? '').trim();
    const v2 = String(condition.valueTo ?? '').trim();
    if (fieldDef?.type === 'DATE' && v1 && v2 && v1 > v2) {
      return `${fieldDef.label}: "From" date (${v1}) cannot be after "To" date (${v2}).`;
    }
    if (fieldDef?.type === 'NUMBER' && v1 && v2) {
      const n1 = Number(v1);
      const n2 = Number(v2);
      if (!Number.isNaN(n1) && !Number.isNaN(n2) && n1 > n2) {
        return `${fieldDef.label}: Minimum (${n1}) cannot be greater than Maximum (${n2}).`;
      }
    }
  }
  return null;
}

function evaluateSingleScalarCondition(
  rawScalar: unknown,
  condition: FilterCondition,
  fieldType: FilterFieldType
): boolean {
  const op = condition.operator;

  if (fieldType === 'BOOLEAN') {
    const boolVal =
      typeof rawScalar === 'boolean'
        ? rawScalar
        : ['true', 'yes', '1', 'active', 'enabled'].includes(
            String(rawScalar ?? '')
              .trim()
              .toLowerCase()
          );
    if (op === 'TRUE') return boolVal === true;
    if (op === 'FALSE') return boolVal === false;
    return false;
  }

  if (fieldType === 'DATE') {
    const dateStr = normalizeDateString(rawScalar);
    if (op === 'IS_EMPTY') return dateStr.length === 0;
    if (op === 'IS_NOT_EMPTY') return dateStr.length > 0;
    if (!dateStr) return false;

    const target = normalizeDateString(condition.value);
    const targetTo = normalizeDateString(condition.valueTo);

    switch (op) {
      case 'ON':
      case 'EQUALS':
        return Boolean(target) && dateStr === target;
      case 'BEFORE':
        return Boolean(target) && dateStr < target;
      case 'AFTER':
        return Boolean(target) && dateStr > target;
      case 'BETWEEN':
        return matchesDateRange(dateStr, { from: target, to: targetTo });
      default:
        return false;
    }
  }

  if (fieldType === 'NUMBER') {
    if (rawScalar === null || rawScalar === undefined || String(rawScalar).trim() === '') {
      return false;
    }
    const numVal = Number(rawScalar);
    if (Number.isNaN(numVal)) return false;

    const target1 = Number(condition.value);
    const target2 = Number(condition.valueTo);

    switch (op) {
      case 'EQUALS':
        return !Number.isNaN(target1) && numVal === target1;
      case 'NOT_EQUALS':
        return !Number.isNaN(target1) && numVal !== target1;
      case 'GREATER_THAN':
        return !Number.isNaN(target1) && numVal > target1;
      case 'LESS_THAN':
        return !Number.isNaN(target1) && numVal < target1;
      case 'GREATER_THAN_OR_EQUAL':
        return !Number.isNaN(target1) && numVal >= target1;
      case 'LESS_THAN_OR_EQUAL':
        return !Number.isNaN(target1) && numVal <= target1;
      case 'BETWEEN': {
        const hasMin = String(condition.value ?? '').trim().length > 0 && !Number.isNaN(target1);
        const hasMax = String(condition.valueTo ?? '').trim().length > 0 && !Number.isNaN(target2);
        if (hasMin && hasMax && target1 > target2) return false;
        if (hasMin && numVal < target1) return false;
        if (hasMax && numVal > target2) return false;
        return hasMin || hasMax;
      }
      default:
        return false;
    }
  }

  if (fieldType === 'DROPDOWN') {
    const strVal = String(rawScalar ?? '').trim().toLowerCase();
    const target = String(condition.value ?? '').trim().toLowerCase();

    if (op === 'EQUALS') {
      return strVal === target;
    }
    if (op === 'NOT_EQUALS') {
      return strVal !== target;
    }
    if (op === 'IS_ANY_OF') {
      const allowedList = (
        condition.values && condition.values.length > 0
          ? condition.values
          : String(condition.value ?? '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
      ).map((v) => v.toLowerCase());
      return allowedList.includes(strVal);
    }
    return false;
  }

  // TEXT field evaluation (case-insensitive)
  const strVal = String(rawScalar ?? '').trim().toLowerCase();
  const target = String(condition.value ?? '').trim().toLowerCase();

  switch (op) {
    case 'EQUALS':
      return strVal === target;
    case 'NOT_EQUALS':
      return strVal !== target;
    case 'CONTAINS':
      return strVal.includes(target);
    case 'DOES_NOT_CONTAIN':
      return !strVal.includes(target);
    case 'STARTS_WITH':
      return strVal.startsWith(target);
    case 'ENDS_WITH':
      return strVal.endsWith(target);
    default:
      return false;
  }
}

/**
 * Evaluates a single condition against a record.
 * Supports both scalar field values and array field values (e.g. line items on a PR header).
 */
export function evaluateConditionOnRecord<T>(
  record: T,
  condition: FilterCondition,
  fieldMap: Map<string, FilterFieldDefinition<T>>
): boolean {
  const fieldDef = fieldMap.get(condition.fieldKey);
  if (!fieldDef) return true;
  if (!isConditionActive(condition, fieldDef)) return true;

  const rawValue = fieldDef.accessor(record);

  if (Array.isArray(rawValue)) {
    if (rawValue.length === 0) {
      if (condition.operator === 'IS_EMPTY') return true;
      if (
        condition.operator === 'NOT_EQUALS' ||
        condition.operator === 'DOES_NOT_CONTAIN'
      ) {
        return true;
      }
      return false;
    }
    // For negative operators (NOT_EQUALS, DOES_NOT_CONTAIN), none of the elements should violate it
    if (
      condition.operator === 'NOT_EQUALS' ||
      condition.operator === 'DOES_NOT_CONTAIN'
    ) {
      return rawValue.every((item) =>
        evaluateSingleScalarCondition(item, condition, fieldDef.type)
      );
    }
    return rawValue.some((item) =>
      evaluateSingleScalarCondition(item, condition, fieldDef.type)
    );
  }

  return evaluateSingleScalarCondition(rawValue, condition, fieldDef.type);
}

/**
 * Evaluates a full AdvancedFilterState (multiple groups & multiple conditions with AND / OR operators)
 * against a list of records.
 */
export function evaluateAdvancedFilters<T>(
  records: T[],
  filterState: AdvancedFilterState,
  fields: FilterFieldDefinition<T>[]
): T[] {
  if (!filterState || !filterState.groups || filterState.groups.length === 0) {
    return records;
  }

  const fieldMap = new Map<string, FilterFieldDefinition<T>>(
    fields.map((f) => [f.key, f])
  );

  // Keep only groups that have at least one active condition
  const activeGroups = filterState.groups
    .map((group) => ({
      ...group,
      activeConditions: group.conditions.filter((cond) =>
        isConditionActive(cond, fieldMap.get(cond.fieldKey))
      ),
    }))
    .filter((g) => g.activeConditions.length > 0);

  if (activeGroups.length === 0) {
    return records;
  }

  return records.filter((record) => {
    const groupResults = activeGroups.map((group) => {
      if (group.logicalOperator === 'OR') {
        return group.activeConditions.some((cond) =>
          evaluateConditionOnRecord(record, cond, fieldMap)
        );
      }
      return group.activeConditions.every((cond) =>
        evaluateConditionOnRecord(record, cond, fieldMap)
      );
    });

    if (filterState.groupLogicalOperator === 'OR') {
      return groupResults.some(Boolean);
    }
    return groupResults.every(Boolean);
  });
}

/**
 * Counts the total number of active conditions across all groups in AdvancedFilterState.
 */
export function countActiveAdvancedConditions<T>(
  filterState: AdvancedFilterState,
  fields: FilterFieldDefinition<T>[]
): number {
  if (!filterState || !filterState.groups) return 0;
  const fieldMap = new Map(fields.map((f) => [f.key, f]));
  let total = 0;
  for (const grp of filterState.groups) {
    for (const cond of grp.conditions) {
      if (isConditionActive(cond, fieldMap.get(cond.fieldKey))) {
        total += 1;
      }
    }
  }
  return total;
}

/**
 * Builds active filter chips for all active conditions in AdvancedFilterState.
 */
export function buildAdvancedFilterChips<T>(
  filterState: AdvancedFilterState,
  fields: FilterFieldDefinition<T>[],
  onRemoveCondition: (groupId: string, conditionId: string) => void
): ActiveFilterChip[] {
  if (!filterState || !filterState.groups) return [];
  const fieldMap = new Map(fields.map((f) => [f.key, f]));
  const chips: ActiveFilterChip[] = [];

  filterState.groups.forEach((group) => {
    group.conditions.forEach((cond) => {
      const fieldDef = fieldMap.get(cond.fieldKey);
      if (!fieldDef || !isConditionActive(cond, fieldDef)) return;

      let valueLabel = cond.value;
      if (cond.operator === 'IS_EMPTY' || cond.operator === 'IS_NOT_EMPTY') {
        valueLabel = '';
      } else if (cond.operator === 'TRUE') {
        valueLabel = 'True';
      } else if (cond.operator === 'FALSE') {
        valueLabel = 'False';
      } else if (cond.operator === 'BETWEEN') {
        valueLabel = `${cond.value || 'Any'} to ${cond.valueTo || 'Any'}`;
      } else if (cond.operator === 'IS_ANY_OF') {
        const vals =
          cond.values && cond.values.length > 0
            ? cond.values
            : cond.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        valueLabel = vals
          .map((v) => fieldDef.options?.find((o) => o.value === v)?.label || v)
          .join(', ');
      } else if (fieldDef.type === 'DROPDOWN' && fieldDef.options) {
        valueLabel =
          fieldDef.options.find((o) => o.value === cond.value)?.label || cond.value;
      }

      chips.push({
        id: `${group.id}_${cond.id}`,
        groupId: group.id,
        conditionId: cond.id,
        category: 'ADVANCED',
        fieldLabel: fieldDef.label,
        operatorLabel: getOperatorLabel(cond.operator),
        valueLabel,
        onRemove: () => onRemoveCondition(group.id, cond.id),
      });
    });
  });

  return chips;
}

// ============================================================================
// USER-SCOPED SAVED FILTER PRESETS (localStorage)
// ============================================================================

const PRESET_STORAGE_PREFIX = 'kosh_adv_filter_presets_v1';

function getPresetStorageKey(moduleKey: string, userId: string): string {
  const safeMod = (moduleKey || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeUser = (userId || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${PRESET_STORAGE_PREFIX}_${safeMod}_${safeUser}`;
}

export function listFilterPresets(moduleKey: string, userId: string): SavedFilterPreset[] {
  try {
    const raw = localStorage.getItem(getPresetStorageKey(moduleKey, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistFilterPresets(
  moduleKey: string,
  userId: string,
  presets: SavedFilterPreset[]
): void {
  try {
    localStorage.setItem(getPresetStorageKey(moduleKey, userId), JSON.stringify(presets));
  } catch (err) {
    console.error('Failed to save filter presets to localStorage:', err);
  }
}

export function saveFilterPreset(params: {
  moduleKey: string;
  userId: string;
  name: string;
  filterState: AdvancedFilterState;
  quickFilters?: Record<string, any>;
  isDefault?: boolean;
}): SavedFilterPreset {
  const trimmedName = params.name.trim();
  if (!trimmedName) {
    throw new Error('Filter preset name is required.');
  }

  const existing = listFilterPresets(params.moduleKey, params.userId);
  const now = new Date().toISOString();

  const newPreset: SavedFilterPreset = {
    id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    moduleKey: params.moduleKey,
    userId: params.userId,
    name: trimmedName,
    filterState: JSON.parse(JSON.stringify(params.filterState)),
    quickFilters: params.quickFilters
      ? JSON.parse(JSON.stringify(params.quickFilters))
      : undefined,
    isDefault: Boolean(params.isDefault),
    createdAt: now,
    updatedAt: now,
  };

  const updatedList = existing.map((p) =>
    params.isDefault ? { ...p, isDefault: false } : p
  );
  updatedList.push(newPreset);
  persistFilterPresets(params.moduleKey, params.userId, updatedList);
  return newPreset;
}

export function updateFilterPreset(params: {
  moduleKey: string;
  userId: string;
  presetId: string;
  filterState: AdvancedFilterState;
  quickFilters?: Record<string, any>;
  isDefault?: boolean;
}): SavedFilterPreset {
  const existing = listFilterPresets(params.moduleKey, params.userId);
  const idx = existing.findIndex((p) => p.id === params.presetId);
  if (idx === -1) {
    throw new Error('Saved filter preset not found.');
  }

  const now = new Date().toISOString();
  const updatedPreset: SavedFilterPreset = {
    ...existing[idx],
    filterState: JSON.parse(JSON.stringify(params.filterState)),
    quickFilters: params.quickFilters
      ? JSON.parse(JSON.stringify(params.quickFilters))
      : existing[idx].quickFilters,
    isDefault:
      params.isDefault !== undefined ? params.isDefault : existing[idx].isDefault,
    updatedAt: now,
  };

  const nextList = existing.map((p, i) => {
    if (i === idx) return updatedPreset;
    if (params.isDefault) return { ...p, isDefault: false };
    return p;
  });

  persistFilterPresets(params.moduleKey, params.userId, nextList);
  return updatedPreset;
}

export function renameFilterPreset(
  moduleKey: string,
  userId: string,
  presetId: string,
  newName: string
): SavedFilterPreset {
  const trimmed = newName.trim();
  if (!trimmed) {
    throw new Error('Preset name cannot be empty.');
  }

  const existing = listFilterPresets(moduleKey, userId);
  const idx = existing.findIndex((p) => p.id === presetId);
  if (idx === -1) {
    throw new Error('Saved filter preset not found.');
  }

  const updated: SavedFilterPreset = {
    ...existing[idx],
    name: trimmed,
    updatedAt: new Date().toISOString(),
  };
  existing[idx] = updated;
  persistFilterPresets(moduleKey, userId, existing);
  return updated;
}

export function deleteFilterPreset(
  moduleKey: string,
  userId: string,
  presetId: string
): void {
  const existing = listFilterPresets(moduleKey, userId);
  const filtered = existing.filter((p) => p.id !== presetId);
  persistFilterPresets(moduleKey, userId, filtered);
}

export function getDefaultFilterPreset(
  moduleKey: string,
  userId: string
): SavedFilterPreset | null {
  const list = listFilterPresets(moduleKey, userId);
  return list.find((p) => p.isDefault) || null;
}
