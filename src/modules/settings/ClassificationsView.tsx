import React, { useState, useEffect } from 'react';
import { classificationMasterService } from '../../services/classificationMasterService';
import { ClassificationDimension, ClassificationValue } from '../../types';
import { Layers, CheckCircle2, Search, Plus, Edit3, Power, X } from 'lucide-react';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';

export const ClassificationsView: React.FC = () => {
  const [dimensions, setDimensions] = useState<Record<string, ClassificationDimension>>({});
  const [selectedDimension, setSelectedDimension] = useState<string>('category');
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(true);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [modalCode, setModalCode] = useState('');
  const [modalName, setModalName] = useState('');
  const [modalDisplay, setModalDisplay] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalError, setModalError] = useState('');

  const refreshDimensions = () => {
    setDimensions(classificationMasterService.getAllDimensions());
  };

  useEffect(() => {
    refreshDimensions();
  }, []);

  const activeDim = dimensions[selectedDimension] || {
    label: 'Category',
    description: '',
    values: [],
  };

  const filteredValues = activeDim.values.filter(
    (v: ClassificationValue) =>
      (includeInactive || v.isActive !== false) &&
      (v.code.toLowerCase().includes(search.toLowerCase()) ||
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.display.toLowerCase().includes(search.toLowerCase()))
  );

  const grid = useStandardDataGrid({
    data: filteredValues,
    gridId: 'settings-classifications',
    userId: 'usr-default',
    primarySortField: 'code',
    tieBreakerField: 'name',
    filterSignature: `${selectedDimension}|${search}|${includeInactive}`,
  });

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setModalCode('');
    setModalName('');
    setModalDisplay('');
    setModalDescription('');
    setModalError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (val: ClassificationValue) => {
    setIsEditMode(true);
    setModalCode(val.code);
    setModalName(val.name);
    setModalDisplay(val.display || '');
    setModalDescription(val.description || '');
    setModalError('');
    setIsModalOpen(true);
  };

  const handleSaveCode = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setModalError('');
      classificationMasterService.upsertDimensionValue(
        selectedDimension,
        {
          code: modalCode,
          name: modalName,
          display: modalDisplay,
          description: modalDescription,
          isEdit: isEditMode,
        },
        'Platform Admin',
        'usr-admin-01'
      );
      refreshDimensions();
      setIsModalOpen(false);
    } catch (err: any) {
      setModalError(err.message || 'Failed to save classification code.');
    }
  };

  const handleToggleStatus = (code: string, currentActive?: boolean) => {
    try {
      const nextActive = currentActive === false ? true : false;
      classificationMasterService.toggleDimensionValueStatus(
        selectedDimension,
        code,
        nextActive,
        'Platform Admin',
        'usr-admin-01'
      );
      refreshDimensions();
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
    }
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Classification & Attribute Masters Administration
          </h2>
          <p className="text-slate-500 mt-0.5">
            Configurable database-backed classification dimensions. Soft deactivation protects existing items from broken references.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Classification Code
        </button>
      </div>

      {/* Dimension Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 font-semibold">
        {Object.entries(dimensions).map(([key, dim]) => (
          <button
            key={key}
            onClick={() => {
              setSelectedDimension(key);
              setSearch('');
            }}
            className={`px-3.5 py-2 rounded-lg border transition cursor-pointer ${
              selectedDimension === key
                ? 'bg-[#0B192C] text-white border-slate-800 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {dim.label} ({dim.values.length})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">
              Dimension: {activeDim.label} ({filteredValues.length} records)
            </span>
            <label className="flex items-center gap-1.5 text-slate-600 font-medium ml-4 cursor-pointer">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 cursor-pointer"
              />
              Show Inactive
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter codes or names..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs w-64 shadow-2xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px]">
                <th className="p-3.5">Code</th>
                <th className="p-3.5">Full Master Name</th>
                <th className="p-3.5">Dropdown Display Label</th>
                <th className="p-3.5">Description</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grid.pagedData.map((v: ClassificationValue) => {
                const isActive = v.isActive !== false;
                return (
                  <tr key={v.code} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono font-bold text-indigo-700">{v.code}</td>
                    <td className="p-3.5 font-semibold text-slate-900">{v.name}</td>
                    <td className="p-3.5 text-slate-700 font-medium">{v.display}</td>
                    <td className="p-3.5 text-slate-500 max-w-xs truncate">{v.description || '—'}</td>
                    <td className="p-3.5">
                      <span
                        className={`font-bold px-2.5 py-1 rounded text-[10px] ${
                          isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(v)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded transition cursor-pointer inline-flex items-center gap-1"
                        title="Edit Code"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(v.code, v.isActive)}
                        className={`px-2.5 py-1 font-bold rounded transition cursor-pointer inline-flex items-center gap-1 ${
                          isActive
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                            : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                        }`}
                      >
                        <Power className="w-3 h-3" /> {isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <DataGridFooter
          totalRecords={grid.totalRecords}
          currentPage={grid.currentPage}
          pageSize={grid.pageSize}
          totalPages={grid.totalPages}
          onPageChange={grid.onPageChange}
          onPageSizeChange={grid.onPageSizeChange}
          entityLabel="classification codes"
          sortNotice="Sorted newest code first"
        />
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-[#0B192C] text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                {isEditMode ? `Edit ${activeDim.label} Code: ${modalCode}` : `Add New ${activeDim.label} Code`}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCode} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg font-bold text-xs">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isEditMode}
                  placeholder="e.g., FG02 or SS"
                  value={modalCode}
                  onChange={(e) => setModalCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold uppercase disabled:bg-slate-100 disabled:text-slate-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">1–12 uppercase alphanumeric characters.</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Full Master Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Finished Goods Tier 2"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Dropdown Display Label</label>
                <input
                  type="text"
                  placeholder="e.g., Finished Goods Tier 2 (FG02)"
                  value={modalDisplay}
                  onChange={(e) => setModalDisplay(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional explanatory notes..."
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  {isEditMode ? 'Save Changes' : 'Create Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
