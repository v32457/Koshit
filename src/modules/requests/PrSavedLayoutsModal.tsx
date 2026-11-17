import React, { useEffect, useState } from 'react';
import {
  BookmarkCheck,
  X,
  Plus,
  Save,
  Star,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { PRNamedGridLayout, PRViewType } from '../../services/prGridConfigService';

interface PrSavedLayoutsModalProps {
  isOpen: boolean;
  viewMode: PRViewType;
  userName: string;
  companyScopeLabel: string;
  layouts: PRNamedGridLayout[];
  activeLayoutId: string | null;
  onSaveNewLayout: (layoutName: string, setAsDefault: boolean) => void;
  onUpdateExistingLayout: (layoutId: string, layoutName: string) => void;
  onLoadLayout: (layoutId: string) => void;
  onSetDefaultLayout: (layoutId: string) => void;
  onDeleteLayout: (layoutId: string) => void;
  onResetFactoryDefault: () => void;
  onClose: () => void;
  errorMsg?: string | null;
}

export const PrSavedLayoutsModal: React.FC<PrSavedLayoutsModalProps> = ({
  isOpen,
  viewMode,
  userName,
  companyScopeLabel,
  layouts,
  activeLayoutId,
  onSaveNewLayout,
  onUpdateExistingLayout,
  onLoadLayout,
  onSetDefaultLayout,
  onDeleteLayout,
  onResetFactoryDefault,
  onClose,
  errorMsg,
}) => {
  const [newLayoutName, setNewLayoutName] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalError(null);
      setNewLayoutName(
        `${viewMode === 'HEADER' ? 'Header' : 'Line'} View Layout ${layouts.length + 1}`
      );
    }
  }, [isOpen, viewMode, layouts.length]);

  if (!isOpen) return null;

  const viewLabel = viewMode === 'HEADER' ? 'Header View' : 'Line / Live View';
  const activeLayout = layouts.find((l) => l.id === activeLayoutId) || null;
  const displayError = errorMsg || localError;

  const handleSaveNew = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newLayoutName.trim();
    if (!trimmed) {
      setLocalError('Please enter a layout name.');
      return;
    }
    setLocalError(null);
    onSaveNewLayout(trimmed, setAsDefault);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 flex items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Saved Layouts - ${viewLabel}`}
    >
      <div className="bg-white w-full h-full sm:h-auto sm:rounded-2xl border border-slate-200 shadow-2xl sm:max-w-2xl sm:max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-[#0B192C] text-white flex items-center justify-between border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <BookmarkCheck className="w-4 h-4 text-emerald-400" />
              <span>Saved Layouts — {viewLabel}</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              User: <strong className="text-slate-200">{userName}</strong> • Scope:{' '}
              <strong className="text-slate-200">{companyScopeLabel}</strong> • View-isolated layouts
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
            aria-label="Close Saved Layouts"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
          {displayError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{displayError}</span>
            </div>
          )}

          {/* Save New Layout Form */}
          <form
            onSubmit={handleSaveNew}
            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
          >
            <div className="font-bold text-slate-800 flex items-center justify-between">
              <span>Save Current {viewLabel} Configuration as New Layout</span>
              <span className="text-[10px] font-mono text-slate-500">
                Preserves columns, widths, order, sort, page size & filters
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                aria-label="New layout name"
                placeholder="Enter layout name..."
                value={newLayoutName}
                onChange={(e) => setNewLayoutName(e.target.value)}
                className="flex-1 min-w-[180px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <label className="flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={setAsDefault}
                  onChange={(e) => setSetAsDefault(e.target.checked)}
                  className="accent-indigo-600 rounded"
                />
                <span>Set as Default</span>
              </label>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save New Layout</span>
              </button>
            </div>
          </form>

          {/* Update Active Layout */}
          {activeLayout && (
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Active Layout: {activeLayout.layoutName}</span>
                </div>
                <div className="text-[11px] text-emerald-800 mt-0.5">
                  Save your latest column, sort, page size, or filter adjustments to this layout.
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateExistingLayout(activeLayout.id, activeLayout.layoutName)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Update Existing Layout</span>
              </button>
            </div>
          )}

          {/* Saved Layouts List */}
          <div className="space-y-2">
            <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
              Your Saved {viewLabel} Layouts ({layouts.length})
            </div>
            {layouts.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center text-slate-500">
                No saved layouts yet for {viewLabel} in this user/company scope. Save your current view above to persist columns, sorting, page size, and filters.
              </div>
            ) : (
              <div className="space-y-2">
                {layouts.map((layout) => {
                  const isActive = layout.id === activeLayoutId;
                  const visibleCount = layout.columns.filter((c) => c.visible).length;
                  const sortSummary =
                    layout.sortRules.length > 0
                      ? layout.sortRules
                          .map((r) => `${r.key} ${r.direction.toUpperCase()}`)
                          .join(', ')
                      : 'Default (PR Date DESC)';

                  return (
                    <div
                      key={layout.id}
                      className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                        isActive
                          ? 'bg-indigo-50/50 border-indigo-300'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-900 truncate">
                            {layout.layoutName}
                          </span>
                          {layout.isDefault && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-200">
                              Default
                            </span>
                          )}
                          {isActive && (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 font-bold text-[10px] border border-indigo-200">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {visibleCount}/{layout.columns.length} cols • {layout.pageSize} rows/page • Sort: {sortSummary}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Created: {new Date(layout.createdAt).toLocaleString()} • Modified:{' '}
                          {new Date(layout.updatedAt).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onLoadLayout(layout.id)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateExistingLayout(layout.id, layout.layoutName)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] cursor-pointer"
                          title="Overwrite this layout with current grid state"
                        >
                          Update
                        </button>
                        {!layout.isDefault && (
                          <button
                            type="button"
                            onClick={() => onSetDefaultLayout(layout.id)}
                            aria-label={`Set ${layout.layoutName} as default`}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <Star className="w-3 h-3" /> Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteLayout(layout.id)}
                          aria-label={`Delete layout ${layout.layoutName}`}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg cursor-pointer"
                          title="Delete layout"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onResetFactoryDefault}
            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Factory Default</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
