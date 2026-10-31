import React, { useState } from 'react';
import { Branch, Warehouse } from '../../types';
import { INITIAL_BRANCHES } from '../../data/seedData';
import { Warehouse as WarehouseIcon, Building, Plus, CheckCircle2, AlertTriangle, Search, Filter, ShieldCheck, MapPin } from 'lucide-react';

import { OperatingContext } from '../../services/operatingContextService';
import { ContextIndicatorBar } from '../../components/ContextIndicatorBar';

interface WarehouseSetupViewProps {
  operatingContext?: OperatingContext;
}

export const WarehouseSetupView: React.FC<WarehouseSetupViewProps> = ({
  operatingContext,
}) => {
  const [branches, setBranches] = useState<Branch[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_branches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading branches from localStorage:', err);
    }
    return INITIAL_BRANCHES;
  });

  const [selectedBranchId, setSelectedBranchId] = useState<string>('br-hosr-03'); // Hosur by default
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form state
  const [warehouseCode, setWarehouseCode] = useState('');
  const [warehouseName, setWarehouseName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isNettable, setIsNettable] = useState(true);
  const [isInactive, setIsInactive] = useState(false);
  const [isDropShip, setIsDropShip] = useState(false);
  const [isExciseable, setIsExciseable] = useState(false);
  const [enableBinLocations, setEnableBinLocations] = useState(false);
  const [street, setStreet] = useState('');

  const activeBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];
  const activeWarehouses = activeBranch ? activeBranch.warehouses || [] : [];

  const handleOpenModal = () => {
    setErrorMsg('');
    const existingWhCount = (activeBranch.warehouses || []).length;
    setWarehouseCode(`${activeBranch.portalBranchCode}-${activeBranch.code}-WH${existingWhCount + 1}`);
    setWarehouseName('');
    setIsDefault(existingWhCount === 0);
    setIsNettable(true);
    setIsInactive(false);
    setIsDropShip(false);
    setIsExciseable(false);
    setEnableBinLocations(false);
    setStreet(activeBranch.streetAddress || '');
    setIsModalOpen(true);
  };

  const handleSaveWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!warehouseCode.trim() || !warehouseName.trim()) {
      setErrorMsg('Warehouse Code and Warehouse Name are required.');
      return;
    }

    const cleanCode = warehouseCode.trim().toUpperCase();

    // Check duplicate code across all SAP company warehouses
    const allWarehouses = branches.flatMap((b) => b.warehouses || []);
    if (allWarehouses.some((w) => w.warehouseCode === cleanCode)) {
      setErrorMsg(`Warehouse Code "${cleanCode}" already exists in the SAP Company Database.`);
      return;
    }

    const newWh: Warehouse = {
      id: `wh-${Date.now()}`,
      branchId: activeBranch.id,
      warehouseCode: cleanCode,
      warehouseName: warehouseName.trim(),
      locationCode: activeBranch.code,
      isDefault,
      isNettable,
      isInactive,
      isDropShip,
      isExciseable,
      enableBinLocations,
      street,
      city: activeBranch.city,
      state: activeBranch.state,
      postalCode: activeBranch.postalCode,
      country: activeBranch.country || 'India',
    };

    const updatedBranches = branches.map((b) => {
      if (b.id === activeBranch.id) {
        let whList = b.warehouses || [];
        if (isDefault) {
          // Reset other defaults if setting this one as default
          whList = whList.map((w) => ({ ...w, isDefault: false }));
        }

        // Automatically create/associate a corresponding plant record with the warehouse name
        const plantList = b.plants || [];
        const autoPlantName = `${warehouseName.trim()} Unit`;
        const plantExists = plantList.some((p) => p.name.toLowerCase() === autoPlantName.toLowerCase());
        const updatedPlants = plantExists
          ? plantList
          : [
              ...plantList,
              {
                id: `plt-auto-${Date.now()}`,
                branchId: b.id,
                code: `${cleanCode}-PLT`,
                name: autoPlantName,
                unitDescription: 'Main Stores & Operational Plant Unit',
              },
            ];

        return {
          ...b,
          plants: updatedPlants,
          warehouses: [...whList, newWh],
          defaultWarehouseId: isDefault ? newWh.id : b.defaultWarehouseId,
        };
      }
      return b;
    });

    setBranches(updatedBranches);
    localStorage.setItem('kosh_branches', JSON.stringify(updatedBranches));
    setIsModalOpen(false);
    setSuccessMsg(`Warehouse "${newWh.warehouseName}" (${newWh.warehouseCode}) added successfully to ${activeBranch.name} along with default plant unit.`);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handleSetDefault = (whId: string) => {
    const updatedBranches = branches.map((b) => {
      if (b.id === activeBranch.id) {
        return {
          ...b,
          defaultWarehouseId: whId,
          warehouses: (b.warehouses || []).map((w) => ({
            ...w,
            isDefault: w.id === whId,
          })),
        };
      }
      return b;
    });

    setBranches(updatedBranches);
    localStorage.setItem('kosh_branches', JSON.stringify(updatedBranches));
    setSuccessMsg(`Set default warehouse for ${activeBranch.name}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const filteredWarehouses = activeWarehouses.filter(
    (w) =>
      w.warehouseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.warehouseName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableCompanyBranches = operatingContext
    ? branches.filter((b) => (b.companyId || 'co-kosh-01') === operatingContext.activeCompanyId && b.lifecycleStatus === 'ACTIVE')
    : branches;

  return (
    <div className="space-y-4 text-xs font-sans select-none">
      {operatingContext && <ContextIndicatorBar context={operatingContext} compact={true} />}

      {/* Title Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <WarehouseIcon className="w-5 h-5 text-indigo-600" />
            Warehouse Setup & Multi-Warehouse Register
          </h2>
          <p className="text-slate-500 mt-0.5">
            Configure SAP Warehouses per Branch. Policy Rule: Exactly one active Default Warehouse required per Branch before activation.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Warehouse
        </button>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Branch Selector Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700 text-xs">Select Operating Branch:</span>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {availableCompanyBranches.map((b) => (
              <option key={b.id} value={b.id}>
                Branch [{b.portalBranchCode}] {b.name} ({b.code}) — {b.city}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search WH Code or Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-56 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Active Branch Summary Card */}
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-xs border border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
            Selected Branch Context
          </div>
          <div className="text-base font-black text-white mt-0.5 flex items-center gap-2">
            <span>{activeBranch.name}</span>
            <span className="text-xs bg-indigo-900/80 text-cyan-300 font-mono px-2 py-0.5 rounded border border-cyan-500/30">
              Portal Code: {activeBranch.portalBranchCode} | SAP Code: {activeBranch.code}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>{activeBranch.streetAddress || `${activeBranch.city}, ${activeBranch.state}`}</span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-400 font-semibold">
            Registered Warehouses: <strong className="text-white text-sm font-mono">{activeWarehouses.length}</strong>
          </div>
          <div className="text-[11px] text-emerald-400 font-bold mt-1 flex items-center gap-1 justify-end">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Default WH: {activeWarehouses.find((w) => w.isDefault)?.warehouseCode || 'None Set'}</span>
          </div>
        </div>
      </div>

      {/* Warehouses Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-3.5">WH Code</th>
                <th className="p-3.5">Warehouse Name</th>
                <th className="p-3.5">Default Policy</th>
                <th className="p-3.5">Nett-able</th>
                <th className="p-3.5">Bin Locations</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWarehouses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    No warehouses registered for this branch. Click "Add Warehouse" above to create one.
                  </td>
                </tr>
              ) : (
                filteredWarehouses.map((wh) => (
                  <tr key={wh.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono font-bold text-indigo-700">{wh.warehouseCode}</td>
                    <td className="p-3.5 font-bold text-slate-900">{wh.warehouseName}</td>
                    <td className="p-3.5">
                      {wh.isDefault ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          PRIMARY DEFAULT WH
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSetDefault(wh.id)}
                          className="text-[10px] bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2 py-0.5 rounded border border-slate-200 font-bold cursor-pointer transition"
                        >
                          Make Default
                        </button>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${wh.isNettable ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                        {wh.isNettable ? 'Yes (Included)' : 'No'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${wh.enableBinLocations ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                        {wh.enableBinLocations ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${wh.isInactive ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {wh.isInactive ? 'INACTIVE' : 'ACTIVE'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono text-[11px] text-slate-500">
                      SAP Ref: {wh.warehouseCode}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Warehouse Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-indigo-900 text-white flex items-center justify-between">
              <div className="font-bold text-sm flex items-center gap-2">
                <WarehouseIcon className="w-4 h-4 text-indigo-300" />
                <span>Add Warehouse for {activeBranch.name}</span>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-indigo-200 hover:text-white font-bold">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mx-4 mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveWarehouse} className="p-5 space-y-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Warehouse Code *</label>
                <input
                  type="text"
                  placeholder="e.g. HSR-FG or HSR-STR"
                  value={warehouseCode}
                  onChange={(e) => setWarehouseCode(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg font-mono uppercase font-bold text-indigo-700"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Warehouse Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Hosur-Finished Goods"
                  value={warehouseName}
                  onChange={(e) => setWarehouseName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Street Address</label>
                <input
                  type="text"
                  placeholder="Street / PO Box"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="font-bold text-slate-800 text-xs">Set as Branch Default WH</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isNettable}
                    onChange={(e) => setIsNettable(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="font-bold text-slate-800 text-xs">Nett-able Stock</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableBinLocations}
                    onChange={(e) => setEnableBinLocations(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="font-bold text-slate-800 text-xs">Enable Bin Locations</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDropShip}
                    onChange={(e) => setIsDropShip(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="font-bold text-slate-800 text-xs">Drop-Ship Warehouse</span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-500 cursor-pointer"
                >
                  Save Warehouse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
