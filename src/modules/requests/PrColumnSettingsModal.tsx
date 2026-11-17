import React, { useMemo, useState } from 'react';
import {
  SlidersHorizontal,
  X,
  Search,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  RotateCcw,
  Check,
  Lock,
} from 'lucide-react';
import type { PRUserColumnState, PRViewType } from '../../services/prGridConfigService';

export interface PrColumnMeta<K extends string = string> {
  key: K;
  label: string;
  description: string;
  defaultVisible: boolean;
  defaultWidth: number;
  mandatory?: boolean;
}

interface PrColumnSettingsModalProps<K extends string = string> {
  isOpen: boolean;
  viewMode: PRViewType;
  orderedColumns: PRUserColumnState<K>[];
  getColumnDef: (key: K) => PrColumnMeta<K>;
  onToggleVisibility: (key: K) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onMoveStep: (key: K, direction: 'up' | 'down') => void;
  onDragStartColumn: (e: React.DragEvent, key: K) => void;
  onDragOverColumn: (e: React.DragEvent, key: K) => void;
  onDropColumn: (e: React.DragEvent, targetKey: K) => void;
  onRestoreDefaultWidths: () => void;
  onRestoreDefaultOrder: () => void;
  onResetToFactoryDefault: () => void;
  onSaveLayout: () => void;
  onClose: () => void;
}

export function PrColumnSettingsModal<K extends string = string>({
  isOpen,
  viewMode,
  orderedColumns,
  getColumnDef,
  onToggleVisibility,
  onSelectAll,
  onDeselectAll,
  onMoveStep,
  onDragStartColumn,
  onDragOverColumn,
  onDropColumn,
  onRestoreDefaultWidths,
  onRestoreDefaultOrder,
  onResetToFactoryDefault,
  onSaveLayout,
  onClose,
}: PrColumnSettingsModalProps<K>) {
  const [columnSearchQuery, setColumnSearchQuery] = useState('');
  const [columnFilterTab, setColumnFilterTab] = useState<'ALL' | 'VISIBLE' | 'HIDDEN'>('ALL');

  const visibleColumns = useMemo(
    () => orderedColumns.filter((c) => c.visible),
    [orderedColumns]
  );
  const hiddenColumns = useMemo(
    () => orderedColumns.filter((c) => !c.visible),
    [orderedColumns]
  );

  const modalFilteredColumns = useMemo(() => {
    const q = columnSearchQuery.toLowerCase().trim();
    return orderedColumns.filter((colState) => {
      const def = getColumnDef(colState.key);
      const matchesQuery =
        !q ||
        def.label.toLowerCase().includes(q) ||
        def.description.toLowerCase().includes(q) ||
        def.key.toLowerCase().includes(q);
      const matchesTab =
        columnFilterTab === 'ALL' ||
        (columnFilterTab === 'VISIBLE' && colState.visible) ||
        (columnFilterTab === 'HIDDEN' && !colState.visible);
      return matchesQuery && matchesTab;
    });
  }, [orderedColumns, getColumnDef, columnSearchQuery, columnFilterTab]);

  if (!isOpen) return null;

  const viewLabel = viewMode === 'HEADER' ? 'Header View' : 'Line / Live View';

  return (
    <div
      className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 flex items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Column Settings - ${viewLabel}`}
    >
      <div className="bg-white w-full h-full sm:h-auto sm:rounded-2xl border border-slate-200 shadow-2xl sm:max-w-3xl sm:max-h-[88vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-[#0B192C] text-white flex items-center justify-between border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
              <span>Column Settings — {viewLabel}</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Show, hide, reorder, or restore widths for {viewLabel}. Mandatory business identifiers remain locked visible.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
            aria-label="Close Column Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Tabs & Bulk Controls */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setColumnFilterTab('ALL')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                  columnFilterTab === 'ALL'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Available ({orderedColumns.length})
              </button>
              <button
                type="button"
                onClick={() => setColumnFilterTab('VISIBLE')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                  columnFilterTab === 'VISIBLE'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Visible ({visibleColumns.length})
              </button>
              <button
                type="button"
                onClick={() => setColumnFilterTab('HIDDEN')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                  columnFilterTab === 'HIDDEN'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Hidden ({hiddenColumns.length})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onSelectAll}
                className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={onDeselectAll}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Hide Optional
              </button>
              <button
                type="button"
                onClick={onRestoreDefaultWidths}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Reset Widths
              </button>
              <button
                type="button"
                onClick={onRestoreDefaultOrder}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Reset Order
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              aria-label="Search available columns"
              placeholder="Search available fields by name or description..."
              value={columnSearchQuery}
              onChange={(e) => setColumnSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Columns List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-1.5">
          {modalFilteredColumns.map((colState) => {
            const def = getColumnDef(colState.key);
            const orderIdx = orderedColumns.findIndex((c) => c.key === colState.key);
            const isMandatory = Boolean(def.mandatory);

            return (
              <div
                key={colState.key}
                draggable
                onDragStart={(e) => onDragStartColumn(e, colState.key)}
                onDragOver={(e) => onDragOverColumn(e, colState.key)}
                onDrop={(e) => onDropColumn(e, colState.key)}
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                  colState.visible
                    ? 'bg-white border-slate-200 hover:border-indigo-300'
                    : 'bg-slate-50/80 border-slate-200/70 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <GripVertical className="w-4 h-4 text-slate-400 cursor-grab shrink-0" />
                  <input
                    type="checkbox"
                    id={`col-toggle-${viewMode}-${colState.key}`}
                    aria-label={`Toggle ${def.label} column`}
                    checked={colState.visible}
                    disabled={isMandatory}
                    onChange={() => onToggleVisibility(colState.key)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer disabled:cursor-not-allowed shrink-0"
                  />
                  <label
                    htmlFor={`col-toggle-${viewMode}-${colState.key}`}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {def.label}
                      </span>
                      {isMandatory && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-indigo-100 text-indigo-800 shrink-0">
                          <Lock className="w-2.5 h-2.5" /> Mandatory
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 ${
                          colState.visible
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {colState.visible ? 'Visible' : 'Hidden'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{def.description}</div>
                  </label>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="hidden sm:inline text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {colState.width}px
                  </span>
                  <button
                    type="button"
                    onClick={() => onMoveStep(colState.key, 'up')}
                    disabled={orderIdx === 0}
                    aria-label={`Move ${def.label} up`}
                    className="p-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded text-slate-700 cursor-pointer"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveStep(colState.key, 'down')}
                    disabled={orderIdx === orderedColumns.length - 1}
                    aria-label={`Move ${def.label} down`}
                    className="p-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded text-slate-700 cursor-pointer"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={isMandatory}
                    onClick={() => onToggleVisibility(colState.key)}
                    aria-label={`${colState.visible ? 'Hide' : 'Show'} ${def.label}`}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      colState.visible
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    {colState.visible ? (
                      <>
                        <EyeOff className="w-3 h-3" /> Hide
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" /> Show
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onResetToFactoryDefault}
            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Factory Default</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onSaveLayout();
                onClose();
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save {viewMode === 'HEADER' ? 'Header' : 'Line'} Layout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
