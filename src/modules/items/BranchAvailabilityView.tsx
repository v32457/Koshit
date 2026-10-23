import React, { useState } from 'react';
import { GlobalItem, Branch } from '../../types';
import { Layers, MapPin, Check, X, Save, AlertCircle } from 'lucide-react';

interface BranchAvailabilityViewProps {
  items: GlobalItem[];
  allBranches: Branch[];
}

export const BranchAvailabilityView: React.FC<BranchAvailabilityViewProps> = ({
  items,
  allBranches,
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(allBranches[0].id);
  const [isSaved, setIsSaved] = useState(false);

  const selectedBranch = allBranches.find((b) => b.id === selectedBranchId)!;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-600" />
            Branch Item Availability Matrix
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure plant-specific stocking, procurement, and manufacturing permissions without duplicating the Global Item Master.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsSaved(true);
              setTimeout(() => setIsSaved(false), 2000);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Save Branch Matrix
          </button>
        </div>
      </div>

      {isSaved && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xl font-medium">
          Branch item availability updated and synchronized for {selectedBranch.name}.
        </div>
      )}

      {/* Branch Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        {allBranches.map((br) => (
          <button
            key={br.id}
            onClick={() => setSelectedBranchId(br.id)}
            className={`px-3 py-2 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
              br.id === selectedBranchId
                ? 'bg-[#0B192C] text-white border-slate-800 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>{br.name}</span>
            <span className="text-[10px] opacity-75 font-mono">({br.code})</span>
          </button>
        ))}
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden text-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Operating Plant Scope: {selectedBranch.name}</h3>
            <p className="text-[11px] text-slate-500">{selectedBranch.city}, {selectedBranch.state} • {selectedBranch.plants.length} Units</p>
          </div>
          <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
            Branch Code: {selectedBranch.code}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                <th className="p-3">Global Item Code</th>
                <th className="p-3">Category</th>
                <th className="p-3">Description</th>
                <th className="p-3 text-center">Permitted in Branch</th>
                <th className="p-3 text-center">Stocked</th>
                <th className="p-3 text-center">Purchased</th>
                <th className="p-3 text-center">Manufactured</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const avail = item.branchAvailability.find((b) => b.branchId === selectedBranchId);
                const isPermitted = !!avail?.isActive;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono font-bold text-cyan-800">{item.globalItemCode}</td>
                    <td className="p-3 font-bold text-slate-700">{item.categoryCode}</td>
                    <td className="p-3 text-slate-800 max-w-sm truncate">{item.description}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block w-6 h-6 rounded-full font-bold text-xs leading-6 text-center ${
                          isPermitted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isPermitted ? '✓' : '—'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={avail?.isStocked ?? false}
                        onChange={() => {}}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={avail?.isPurchased ?? false}
                        onChange={() => {}}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={avail?.isManufactured ?? false}
                        onChange={() => {}}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
