/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PHASE 10 — PURCHASE REQUISITION-ALIGNED ADVANCED FILTER PANEL & DATE RANGE CONTROLS
 * Provides:
 *  - <DateRangeFilterControl />: Independent inclusive From/To date range filter with inline validation
 *  - <ActiveFilterChipsBar />: Active filter chips with individual removal and Clear All
 *  - <AdvancedFilterPanel />: Expandable multi-group, multi-condition builder + User-scoped Saved Filter Presets
 */

import React, { useState, useMemo } from 'react';
import {
  Filter,
  Plus,
  Trash2,
  X,
  Calendar,
  Bookmark,
  BookmarkCheck,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  Edit3,
  Layers,
} from 'lucide-react';
import {
  AdvancedFilterState,
  FilterCondition,
  FilterConditionGroup,
  FilterFieldDefinition,
  FilterOperator,
  LogicalOperator,
  OPERATORS_BY_FIELD_TYPE,
  SavedFilterPreset,
  ActiveFilterChip,
  DateRangeFilterValue,
  createEmptyCondition,
  createEmptyGroup,
  getDefaultOperatorForFieldType,
  validateCondition,
  validateDateRange,
  listFilterPresets,
  saveFilterPreset,
  updateFilterPreset,
  renameFilterPreset,
  deleteFilterPreset,
  countActiveAdvancedConditions,
} from '../services/advancedFilterEngine';

// ============================================================================
// 1. INDEPENDENT DATE RANGE FILTER CONTROL
// ============================================================================

export interface DateRangeFilterControlProps {
  label: string;
  range: DateRangeFilterValue;
  onChange: (nextRange: DateRangeFilterValue) => void;
  fromAriaLabel?: string;
  toAriaLabel?: string;
  compact?: boolean;
}

export const DateRangeFilterControl: React.FC<DateRangeFilterControlProps> = ({
  label,
  range,
  onChange,
  fromAriaLabel,
  toAriaLabel,
  compact = false,
}) => {
  const validation = useMemo(() => validateDateRange(range, label), [range, label]);
  const hasAnyBound = Boolean(range.from || range.to);

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-lg border px-2.5 py-1 transition ${
          !validation.isValid
            ? 'bg-rose-50 border-rose-300 text-rose-900'
            : hasAnyBound
              ? 'bg-indigo-50/50 border-indigo-200 text-slate-800'
              : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}
      >
        <Calendar
          className={`w-3.5 h-3.5 shrink-0 ${
            !validation.isValid
              ? 'text-rose-600'
              : hasAnyBound
                ? 'text-indigo-600'
                : 'text-slate-400'
          }`}
        />
        <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">
          {label}:
        </span>

        {/* FROM DATE */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase">From</span>
          <input
            type="date"
            aria-label={fromAriaLabel || `${label} From`}
            value={range.from}
            onChange={(e) => onChange({ ...range, from: e.target.value })}
            className={`bg-transparent text-xs font-medium text-slate-800 focus:outline-none ${
              compact ? 'w-[112px]' : 'w-[118px]'
            }`}
          />
          {range.from && (
            <button
              type="button"
              onClick={() => onChange({ ...range, from: '' })}
              aria-label={`Clear ${label} From`}
              title={`Clear ${label} From`}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <span className="text-[10px] text-slate-400 font-bold">–</span>

        {/* TO DATE */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase">To</span>
          <input
            type="date"
            aria-label={toAriaLabel || `${label} To`}
            value={range.to}
            onChange={(e) => onChange({ ...range, to: e.target.value })}
            className={`bg-transparent text-xs font-medium text-slate-800 focus:outline-none ${
              compact ? 'w-[112px]' : 'w-[118px]'
            }`}
          />
          {range.to && (
            <button
              type="button"
              onClick={() => onChange({ ...range, to: '' })}
              aria-label={`Clear ${label} To`}
              title={`Clear ${label} To`}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* CLEAR BOTH */}
        {hasAnyBound && (
          <button
            type="button"
            onClick={() => onChange({ from: '', to: '' })}
            aria-label={`Clear ${label} Range`}
            title={`Clear ${label} Range`}
            className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {!validation.isValid && validation.error && (
        <div
          role="alert"
          className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2.5 py-1"
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>{validation.error}</span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. ACTIVE FILTER CHIPS BAR
// ============================================================================

export interface ActiveFilterChipsBarProps {
  chips: ActiveFilterChip[];
  onClearAll: () => void;
  totalFilteredCount?: number;
  totalUnfilteredCount?: number;
  entityPluralLabel?: string;
}

export const ActiveFilterChipsBar: React.FC<ActiveFilterChipsBarProps> = ({
  chips,
  onClearAll,
  totalFilteredCount,
  totalUnfilteredCount,
  entityPluralLabel = 'records',
}) => {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mr-1">
          <Filter className="w-3 h-3 text-indigo-600" />
          <span>Active Filters ({chips.length}):</span>
        </span>
        {chips.map((chip) => (
          <span
            key={chip.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-indigo-50 text-indigo-900 border border-indigo-200 font-medium"
          >
            <strong className="font-bold text-indigo-800">{chip.fieldLabel}</strong>
            <span className="text-indigo-600 text-[10px]">{chip.operatorLabel}</span>
            {chip.valueLabel && (
              <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.2 rounded border border-indigo-100">
                {chip.valueLabel}
              </span>
            )}
            {chip.onRemove && (
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={`Remove filter ${chip.fieldLabel}`}
                className="ml-0.5 text-indigo-500 hover:text-rose-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {typeof totalFilteredCount === 'number' && typeof totalUnfilteredCount === 'number' && (
          <span className="text-[11px] text-slate-500">
            Matching <strong className="text-slate-900">{totalFilteredCount}</strong> of{' '}
            <strong className="text-slate-900">{totalUnfilteredCount}</strong> {entityPluralLabel}
          </span>
        )}
        <button
          type="button"
          onClick={onClearAll}
          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Clear All Filters</span>
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 3. EXPANDABLE ADVANCED FILTER ENGINE PANEL + SAVED PRESET MANAGER
// ============================================================================

export interface AdvancedFilterPanelProps<T = any> {
  moduleKey: string;
  userId: string;
  fields: FilterFieldDefinition<T>[];
  filterState: AdvancedFilterState;
  onChangeFilterState: (next: AdvancedFilterState) => void;
  quickFiltersSnapshot?: Record<string, any>;
  onApplyQuickFiltersSnapshot?: (snapshot: Record<string, any>) => void;
  onResetAllFilters: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  extraActiveFilterCount?: number;
}

export const AdvancedFilterPanel = <T,>({
  moduleKey,
  userId,
  fields,
  filterState,
  onChangeFilterState,
  quickFiltersSnapshot,
  onApplyQuickFiltersSnapshot,
  onResetAllFilters,
  isOpen,
  onToggleOpen,
  extraActiveFilterCount = 0,
}: AdvancedFilterPanelProps<T>) => {
  const [presetsTick, setPresetsTick] = useState(0);
  const [activePresetId, setActivePresetId] = useState<string>('');
  const [newPresetName, setNewPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'info' | 'error'; text: string } | null>(
    null
  );

  const presets: SavedFilterPreset[] = useMemo(
    () => listFilterPresets(moduleKey, userId),
    [moduleKey, userId, presetsTick]
  );

  const activeAdvancedCount = useMemo(
    () => countActiveAdvancedConditions(filterState, fields),
    [filterState, fields]
  );

  const totalFilterBadgeCount = activeAdvancedCount + extraActiveFilterCount;

  const fieldMap = useMemo(
    () => new Map<string, FilterFieldDefinition<T>>(fields.map((f) => [f.key, f])),
    [fields]
  );

  const showToast = (text: string, type: 'info' | 'error' = 'info') => {
    setFeedbackMsg({ type, text });
    setTimeout(() => {
      setFeedbackMsg((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  };

  const handleAddGroup = () => {
    const nextGroup = createEmptyGroup(fields[0], filterState.groups.length + 1);
    onChangeFilterState({
      ...filterState,
      groups: [...filterState.groups, nextGroup],
    });
  };

  const handleRemoveGroup = (groupId: string) => {
    onChangeFilterState({
      ...filterState,
      groups: filterState.groups.filter((g) => g.id !== groupId),
    });
  };

  const handleGroupLogicalChange = (groupId: string, logicalOperator: LogicalOperator) => {
    onChangeFilterState({
      ...filterState,
      groups: filterState.groups.map((g) =>
        g.id === groupId ? { ...g, logicalOperator } : g
      ),
    });
  };

  const handleAddCondition = (groupId: string) => {
    const nextCond = createEmptyCondition(fields[0]);
    onChangeFilterState({
      ...filterState,
      groups: filterState.groups.map((g) =>
        g.id === groupId ? { ...g, conditions: [...g.conditions, nextCond] } : g
      ),
    });
  };

  const handleRemoveCondition = (groupId: string, conditionId: string) => {
    onChangeFilterState({
      ...filterState,
      groups: filterState.groups
        .map((g) =>
          g.id === groupId
            ? { ...g, conditions: g.conditions.filter((c) => c.id !== conditionId) }
            : g
        )
        .filter((g) => g.conditions.length > 0),
    });
  };

  const handleUpdateCondition = (
    groupId: string,
    conditionId: string,
    patch: Partial<FilterCondition>
  ) => {
    onChangeFilterState({
      ...filterState,
      groups: filterState.groups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          conditions: g.conditions.map((c) => {
            if (c.id !== conditionId) return c;
            const updated = { ...c, ...patch };
            // If fieldKey changed, reset operator & values to match new field type
            if (patch.fieldKey && patch.fieldKey !== c.fieldKey) {
              const newField = fieldMap.get(patch.fieldKey);
              const defaultOp = newField
                ? getDefaultOperatorForFieldType(newField.type)
                : 'CONTAINS';
              updated.operator = defaultOp;
              updated.value = '';
              updated.valueTo = '';
              updated.values = [];
            }
            return updated;
          }),
        };
      }),
    });
  };

  const handleSaveNewPreset = () => {
    try {
      const saved = saveFilterPreset({
        moduleKey,
        userId,
        name: newPresetName,
        filterState,
        quickFilters: quickFiltersSnapshot,
      });
      setActivePresetId(saved.id);
      setNewPresetName('');
      setShowSaveInput(false);
      setPresetsTick((t) => t + 1);
      showToast(`Saved filter preset "${saved.name}".`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to save filter preset.', 'error');
    }
  };

  const handleLoadPreset = (presetId: string) => {
    setActivePresetId(presetId);
    setIsRenaming(false);
    if (!presetId) return;
    const found = presets.find((p) => p.id === presetId);
    if (!found) return;
    onChangeFilterState(JSON.parse(JSON.stringify(found.filterState)));
    if (found.quickFilters && onApplyQuickFiltersSnapshot) {
      onApplyQuickFiltersSnapshot(found.quickFilters);
    }
    showToast(`Loaded filter preset "${found.name}".`);
  };

  const handleUpdateActivePreset = () => {
    if (!activePresetId) return;
    try {
      const updated = updateFilterPreset({
        moduleKey,
        userId,
        presetId: activePresetId,
        filterState,
        quickFilters: quickFiltersSnapshot,
      });
      setPresetsTick((t) => t + 1);
      showToast(`Updated preset "${updated.name}".`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update preset.', 'error');
    }
  };

  const handleConfirmRename = () => {
    if (!activePresetId) return;
    try {
      const updated = renameFilterPreset(moduleKey, userId, activePresetId, renameValue);
      setIsRenaming(false);
      setPresetsTick((t) => t + 1);
      showToast(`Renamed preset to "${updated.name}".`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to rename preset.', 'error');
    }
  };

  const handleDeleteActivePreset = () => {
    if (!activePresetId) return;
    const target = presets.find((p) => p.id === activePresetId);
    deleteFilterPreset(moduleKey, userId, activePresetId);
    setActivePresetId('');
    setIsRenaming(false);
    setPresetsTick((t) => t + 1);
    showToast(`Deleted preset "${target?.name || ''}".`);
  };

  const handleOpenAndEnsureGroup = () => {
    if (!isOpen && filterState.groups.length === 0 && fields.length > 0) {
      onChangeFilterState({
        groupLogicalOperator: 'AND',
        groups: [createEmptyGroup(fields[0], 1)],
      });
    }
    onToggleOpen();
  };

  if (!isOpen) return null;

  return (
    <div className="bg-slate-50/90 rounded-xl border border-indigo-200 p-3.5 space-y-3 text-xs shadow-2xs animate-in fade-in duration-150">
      {/* Top Bar: Title, Inter-Group AND/OR Toggle, Preset Controls, Close */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold text-indigo-950 text-xs">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Advanced Filter Builder</span>
            {activeAdvancedCount > 0 && (
              <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[10px]">
                {activeAdvancedCount} Active
              </span>
            )}
          </div>

          {filterState.groups.length > 1 && (
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                Combine Groups:
              </span>
              <button
                type="button"
                onClick={() =>
                  onChangeFilterState({ ...filterState, groupLogicalOperator: 'AND' })
                }
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                  filterState.groupLogicalOperator === 'AND'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                AND
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeFilterState({ ...filterState, groupLogicalOperator: 'OR' })
                }
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                  filterState.groupLogicalOperator === 'OR'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                OR
              </button>
            </div>
          )}
        </div>

        {/* Saved Filter Presets Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
            <Bookmark className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <select
              aria-label="Saved Filter Presets"
              value={activePresetId}
              onChange={(e) => handleLoadPreset(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
            >
              <option value="">Saved Filter Presets ({presets.length})</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {activePresetId && !isRenaming && (
            <>
              <button
                type="button"
                onClick={handleUpdateActivePreset}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-[11px] cursor-pointer"
                title="Overwrite selected preset with current filter criteria"
              >
                Update Preset
              </button>
              <button
                type="button"
                onClick={() => {
                  const curr = presets.find((p) => p.id === activePresetId);
                  setRenameValue(curr?.name || '');
                  setIsRenaming(true);
                }}
                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                title="Rename selected preset"
              >
                <Edit3 className="w-3 h-3" />
                <span>Rename</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteActivePreset}
                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                title="Delete selected preset"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}

          {isRenaming && (
            <div className="flex items-center gap-1 bg-white border border-indigo-300 rounded-lg px-2 py-0.5">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="New preset name..."
                className="text-xs font-medium text-slate-800 focus:outline-none w-32"
              />
              <button
                type="button"
                onClick={handleConfirmRename}
                className="p-1 text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                title="Confirm rename"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                title="Cancel rename"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {!showSaveInput ? (
            <button
              type="button"
              onClick={() => setShowSaveInput(true)}
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>Save Preset</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-white border border-indigo-300 rounded-lg px-2 py-0.5">
              <input
                type="text"
                aria-label="New Filter Preset Name"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Preset name..."
                className="text-xs font-medium text-slate-800 focus:outline-none w-36"
              />
              <button
                type="button"
                onClick={handleSaveNewPreset}
                className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-[11px] cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSaveInput(false);
                  setNewPresetName('');
                }}
                className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setActivePresetId('');
              onResetAllFilters();
            }}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Default</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAndEnsureGroup}
            className="px-2 py-1 text-slate-500 hover:text-slate-900 font-bold text-[11px] cursor-pointer"
          >
            Hide
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-between ${
            feedbackMsg.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Condition Groups */}
      {filterState.groups.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-slate-300 p-4 text-center space-y-2">
          <p className="text-slate-600 font-medium">
            No advanced filter condition groups configured. Add a condition group to filter by any field and operator.
          </p>
          <button
            type="button"
            onClick={handleAddGroup}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Filter Condition Group</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filterState.groups.map((group: FilterConditionGroup, gIdx: number) => (
            <div
              key={group.id}
              className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-2xs"
            >
              {/* Group Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-bold text-[11px]">
                    Group {gIdx + 1}
                  </span>
                  <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    <span className="text-[10px] font-semibold text-slate-500">
                      Match conditions with:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleGroupLogicalChange(group.id, 'AND')}
                      className={`px-2 py-0.2 rounded text-[10px] font-bold cursor-pointer ${
                        group.logicalOperator === 'AND'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      AND (All)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGroupLogicalChange(group.id, 'OR')}
                      className={`px-2 py-0.2 rounded text-[10px] font-bold cursor-pointer ${
                        group.logicalOperator === 'OR'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      OR (Any)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAddCondition(group.id)}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Condition</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveGroup(group.id)}
                    className="px-2 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    title="Remove Condition Group"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Conditions List inside Group */}
              <div className="space-y-2">
                {group.conditions.map((cond: FilterCondition, cIdx: number) => {
                  const fieldDef = fieldMap.get(cond.fieldKey) || fields[0];
                  const fieldType = fieldDef?.type || 'TEXT';
                  const allowedOperators = OPERATORS_BY_FIELD_TYPE[fieldType] || [];
                  const condError = validateCondition(cond, fieldDef);

                  const needsNoInput =
                    cond.operator === 'IS_EMPTY' ||
                    cond.operator === 'IS_NOT_EMPTY' ||
                    cond.operator === 'TRUE' ||
                    cond.operator === 'FALSE';

                  const isBetween = cond.operator === 'BETWEEN';
                  const isMultiDropdown =
                    fieldType === 'DROPDOWN' && cond.operator === 'IS_ANY_OF';

                  return (
                    <div key={cond.id} className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-10 text-right text-[10px] font-bold uppercase text-slate-400">
                          {cIdx === 0 ? 'Where' : group.logicalOperator}
                        </span>

                        {/* Field Selector */}
                        <select
                          aria-label={`Condition ${cIdx + 1} Field`}
                          value={cond.fieldKey}
                          onChange={(e) =>
                            handleUpdateCondition(group.id, cond.id, {
                              fieldKey: e.target.value,
                            })
                          }
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[170px]"
                        >
                          {fields.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </select>

                        {/* Operator Selector */}
                        <select
                          aria-label={`Condition ${cIdx + 1} Operator`}
                          value={cond.operator}
                          onChange={(e) =>
                            handleUpdateCondition(group.id, cond.id, {
                              operator: e.target.value as FilterOperator,
                            })
                          }
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[150px]"
                        >
                          {allowedOperators.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>

                        {/* Value Input(s) */}
                        {!needsNoInput && (
                          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-[200px]">
                            {fieldType === 'DROPDOWN' && fieldDef?.options && !isMultiDropdown ? (
                              <select
                                aria-label={`Condition ${cIdx + 1} Value`}
                                value={cond.value}
                                onChange={(e) =>
                                  handleUpdateCondition(group.id, cond.id, {
                                    value: e.target.value,
                                  })
                                }
                                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[180px]"
                              >
                                <option value="">Select value...</option>
                                {fieldDef.options.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : isMultiDropdown && fieldDef?.options ? (
                              <div className="flex flex-wrap items-center gap-1 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                                {fieldDef.options.map((opt) => {
                                  const selectedList = cond.values || [];
                                  const isChecked = selectedList.includes(opt.value);
                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => {
                                        const nextVals = isChecked
                                          ? selectedList.filter((v) => v !== opt.value)
                                          : [...selectedList, opt.value];
                                        handleUpdateCondition(group.id, cond.id, {
                                          values: nextVals,
                                          value: nextVals.join(','),
                                        });
                                      }}
                                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition cursor-pointer ${
                                        isChecked
                                          ? 'bg-indigo-600 text-white border-indigo-600'
                                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : fieldType === 'DATE' ? (
                              <>
                                <input
                                  type="date"
                                  aria-label={`Condition ${cIdx + 1} Date Value`}
                                  value={cond.value}
                                  onChange={(e) =>
                                    handleUpdateCondition(group.id, cond.id, {
                                      value: e.target.value,
                                    })
                                  }
                                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                {isBetween && (
                                  <>
                                    <span className="text-slate-400 font-bold text-xs">and</span>
                                    <input
                                      type="date"
                                      aria-label={`Condition ${cIdx + 1} Date To Value`}
                                      value={cond.valueTo || ''}
                                      onChange={(e) =>
                                        handleUpdateCondition(group.id, cond.id, {
                                          valueTo: e.target.value,
                                        })
                                      }
                                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </>
                                )}
                              </>
                            ) : fieldType === 'NUMBER' ? (
                              <>
                                <input
                                  type="number"
                                  step="any"
                                  aria-label={`Condition ${cIdx + 1} Number Value`}
                                  placeholder={fieldDef?.placeholder || 'Enter number...'}
                                  value={cond.value}
                                  onChange={(e) =>
                                    handleUpdateCondition(group.id, cond.id, {
                                      value: e.target.value,
                                    })
                                  }
                                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-36"
                                />
                                {isBetween && (
                                  <>
                                    <span className="text-slate-400 font-bold text-xs">and</span>
                                    <input
                                      type="number"
                                      step="any"
                                      aria-label={`Condition ${cIdx + 1} Number To Value`}
                                      placeholder="Max number..."
                                      value={cond.valueTo || ''}
                                      onChange={(e) =>
                                        handleUpdateCondition(group.id, cond.id, {
                                          valueTo: e.target.value,
                                        })
                                      }
                                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-36"
                                    />
                                  </>
                                )}
                              </>
                            ) : (
                              <input
                                type="text"
                                aria-label={`Condition ${cIdx + 1} Text Value`}
                                placeholder={
                                  fieldDef?.placeholder || `Enter ${fieldDef?.label || 'value'}...`
                                }
                                value={cond.value}
                                onChange={(e) =>
                                  handleUpdateCondition(group.id, cond.id, {
                                    value: e.target.value,
                                  })
                                }
                                className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[180px]"
                              />
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveCondition(group.id, cond.id)}
                          aria-label={`Remove Condition ${cIdx + 1}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Remove condition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {condError && (
                        <div className="ml-12 flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>{condError}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Bottom Bar: Add Another Group */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleAddGroup}
              className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Condition Group ({filterState.groupLogicalOperator})</span>
            </button>

            <span className="text-[11px] text-slate-500">
              All conditions evaluate dynamically against live records and reset pagination to Page 1.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 4. ADVANCED FILTER TRIGGER BUTTON
// ============================================================================

export interface AdvancedFilterToggleButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  activeCount: number;
}

export const AdvancedFilterToggleButton: React.FC<AdvancedFilterToggleButtonProps> = ({
  isOpen,
  onToggle,
  activeCount,
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
        isOpen || activeCount > 0
          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
      }`}
    >
      <Filter className="w-3.5 h-3.5 shrink-0" />
      <span>Advanced Filters</span>
      {activeCount > 0 && (
        <span
          className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            isOpen || activeCount > 0
              ? 'bg-white text-indigo-700'
              : 'bg-indigo-600 text-white'
          }`}
        >
          {activeCount}
        </span>
      )}
      {isOpen ? (
        <ChevronUp className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
      )}
    </button>
  );
};
