import React, { useState } from 'react';
import { CLASSIFICATION_DIMENSIONS } from '../../data/seedData';
import { Layers, CheckCircle2, Search, Plus } from 'lucide-react';

export const ClassificationsView: React.FC = () => {
  const [selectedDimension, setSelectedDimension] = useState<string>('category');
  const [search, setSearch] = useState('');

  const activeDim = CLASSIFICATION_DIMENSIONS[selectedDimension] || CLASSIFICATION_DIMENSIONS.category;

  const filteredValues = activeDim.values.filter(
    (v) =>
      v.code.toLowerCase().includes(search.toLowerCase()) ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.display.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Classification Masters Administration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configurable database-backed classification dimensions. Soft deactivation protects existing items from broken references.
          </p>
        </div>

        <button
          onClick={() => alert('New Classification Code modal: requires Code, Name, Display Label, and Category mappings.')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Classification Code
        </button>
      </div>

      {/* Dimension Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        {Object.entries(CLASSIFICATION_DIMENSIONS).map(([key, dim]) => (
          <button
            key={key}
            onClick={() => {
              setSelectedDimension(key);
              setSearch('');
            }}
            className={`px-3 py-2 rounded-lg border transition cursor-pointer ${
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden text-xs">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold text-slate-800">
            Dimension: {activeDim.label} ({filteredValues.length} active records)
          </span>
          <input
            type="text"
            placeholder="Filter codes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs w-48"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-3">Code</th>
                <th className="p-3">Full Master Name</th>
                <th className="p-3">Dropdown Display Label</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Referenced in Items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredValues.map((v) => (
                <tr key={v.code} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-mono font-bold text-cyan-800">{v.code}</td>
                  <td className="p-3 font-semibold text-slate-900">{v.name}</td>
                  <td className="p-3 text-slate-600 font-medium">{v.display}</td>
                  <td className="p-3">
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                      Active
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono text-slate-500">
                    Protected Master
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
