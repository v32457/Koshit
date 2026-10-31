import React, { useState } from 'react';
import { GlobalItem, Branch, Warehouse, BranchItemClassification } from '../../types';
import { Layers, MapPin, Save, ShieldCheck, Warehouse as WarehouseIcon } from 'lucide-react';
import { INITIAL_BRANCH_ITEM_CLASSIFICATIONS } from '../../data/seedData';

interface BranchAvailabilityViewProps {
  items: GlobalItem[];
  allBranches: Branch[];
}

export const BranchAvailabilityView: React.FC<BranchAvailabilityViewProps> = ({
  items: initialItems,
  allBranches,
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(allBranches[0].id);
  const [items, setItems] = useState<GlobalItem[]>(initialItems);
  const [assignedWarehouses, setAssignedWarehouses] = useState<Record<string, string>>({});
  const [isSaved, setIsSaved] = useState(false);

  // Authoritative Branch Item Classifications
  const [branchClassifications, setBranchClassifications] = useState<BranchItemClassification[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_branch_classifications');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_BRANCH_ITEM_CLASSIFICATIONS;
  });

  const selectedBranch = allBranches.find((b) => b.id === selectedBranchId) || allBranches[0];
  const branchWarehouses: Warehouse[] = selectedBranch.warehouses || [];

  const handleUpdateBranchCategory = (itemId: string, newCategoryCode: string) => {
    const existing = branchClassifications.find(
      (bc) => bc.branchId === selectedBranchId && bc.globalItemId === itemId
    );

    const updated = branchClassifications.filter(
      (bc) => !(bc.branchId === selectedBranchId && bc.globalItemId === itemId)
    );

    const categoryNames: Record<string, string> = {
      FG: 'Finished Goods',
      RM: 'Raw Materials',
      SF: 'Semi-Finished Goods',
      PK: 'Packaging Materials',
      CO: 'Consumables',
      MA: 'Maintenance / Spares',
      BO: 'Bought-Out',
    };

    const roles: Record<string, any> = {
      FG: 'MANUFACTURE',
      RM: 'PURCHASE',
      SF: 'STOCK',
      PK: 'PURCHASE',
      CO: 'PURCHASE',
      MA: 'PURCHASE',
      BO: 'PURCHASE',
    };

    const newRecord: BranchItemClassification = existing
      ? {
          ...existing,
          categoryCode: newCategoryCode,
          categoryName: categoryNames[newCategoryCode] || 'Custom Category',
          itemRole: roles[newCategoryCode] || 'STOCK',
          updatedAt: new Date().toISOString(),
        }
      : {
          id: `bic-${itemId}-${selectedBranchId}`,
          globalItemId: itemId,
          companyId: selectedBranch.companyId || 'co-kosh-01',
          companyCode: 'KOSH-HQ',
          companyName: 'Kosh Innovations Pvt Ltd',
          branchId: selectedBranchId,
          branchCode: selectedBranch.portalBranchCode,
          branchName: selectedBranch.name,
          categoryCode: newCategoryCode,
          categoryName: categoryNames[newCategoryCode] || 'Custom Category',
          itemRole: roles[newCategoryCode] || 'STOCK',
          isStocked: true,
          isPurchased: newCategoryCode === 'RM',
          isManufactured: newCategoryCode === 'FG',
          isSalesPermitted: newCategoryCode === 'FG',
          status: 'ACTIVE',
          sapItemCode: `${newCategoryCode}-${itemId}-${selectedBranch.portalBranchCode}`,
          updatedAt: new Date().toISOString(),
        };

    const nextList = [...updated, newRecord];
    setBranchClassifications(nextList);
    localStorage.setItem('kosh_branch_classifications', JSON.stringify(nextList));
  };

  const handleToggleSetting = (
    itemId: string,
    field: 'isActive' | 'isStocked' | 'isPurchased' | 'isManufactured'
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const existingAvail = item.branchAvailability.find(
            (b) => b.branchId === selectedBranchId
          );
          let newAvail = item.branchAvailability.filter(
            (b) => b.branchId !== selectedBranchId
          );

          const updatedSetting = existingAvail
            ? { ...existingAvail, [field]: !existingAvail[field] }
            : {
                branchId: selectedBranchId,
                isStocked: field === 'isStocked',
                isPurchased: field === 'isPurchased',
                isManufactured: field === 'isManufactured',
                isActive: true,
              };

          return {
            ...item,
            branchAvailability: [...newAvail, updatedSetting],
          };
        }
        return item;
      })
    );
  };

  const handleSelectWarehouse = (itemId: string, warehouseId: string) => {
    setAssignedWarehouses((prev) => ({ ...prev, [`${selectedBranchId}_${itemId}`]: warehouseId }));
  };

  const handleSaveMatrix = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-4 text-xs font-sans select-none">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Branch Item Availability & Warehouse Mapping Matrix
          </h2>
          <p className="text-slate-500 mt-0.5">
            Govern plant-specific stocking, procurement, and warehouse assignments without duplicating Global Item Codes.
          </p>
        </div>

        <button
          onClick={handleSaveMatrix}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
        >
          <Save className="w-4 h-4" /> Save Branch Matrix
        </button>
      </div>

      {isSaved && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Branch item availability & warehouse mappings saved for {selectedBranch.name}.</span>
        </div>
      )}

      {/* Branch Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 font-semibold">
        {allBranches.map((br) => (
          <button
            key={br.id}
            onClick={() => setSelectedBranchId(br.id)}
            className={`px-3.5 py-2 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
              br.id === selectedBranchId
                ? 'bg-[#0B192C] text-white border-slate-800 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>{br.name}</span>
            <span className="text-[10px] font-mono text-cyan-300">[{br.portalBranchCode}]</span>
          </button>
        ))}
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Branch Scope: [{selectedBranch.portalBranchCode}] {selectedBranch.name}
            </h3>
            <p className="text-[11px] text-slate-500">
              {selectedBranch.city}, {selectedBranch.state} • GSTIN: {selectedBranch.gstinPan || 'N/A'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] bg-indigo-100 text-indigo-800 font-bold px-2.5 py-1 rounded">
              Active Warehouses: {branchWarehouses.length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[11px]">
                <th className="p-3.5">Global Item Code</th>
                <th className="p-3.5">Global Cat</th>
                <th className="p-3.5">Branch Category Role</th>
                <th className="p-3.5">Item Description</th>
                <th className="p-3.5 text-center">Permitted</th>
                <th className="p-3.5 text-center">Stocked</th>
                <th className="p-3.5 text-center">Purchased</th>
                <th className="p-3.5 text-center">Manufactured</th>
                <th className="p-3.5">Assigned Warehouse (Branch Only)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const avail = item.branchAvailability.find((b) => b.branchId === selectedBranchId);
                const isPermitted = avail?.isActive ?? false;

                const bic = branchClassifications.find(
                  (b) => b.branchId === selectedBranchId && b.globalItemId === item.id
                ) || {
                  categoryCode: selectedBranch.portalBranchCode === '001' ? 'FG' : selectedBranch.portalBranchCode === '002' ? 'RM' : 'SF',
                };

                const warehouseKey = `${selectedBranchId}_${item.id}`;
                const selectedWhId =
                  assignedWarehouses[warehouseKey] ||
                  selectedBranch.defaultWarehouseId ||
                  branchWarehouses[0]?.id ||
                  '';

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono font-bold text-indigo-700">{item.globalItemCode}</td>
                    <td className="p-3.5 font-bold text-slate-500">{item.categoryCode}</td>
                    <td className="p-3.5">
                      <select
                        value={bic.categoryCode}
                        onChange={(e) => handleUpdateBranchCategory(item.id, e.target.value)}
                        className="p-1 text-xs font-bold rounded border border-slate-300 bg-white text-indigo-900 shadow-2xs"
                      >
                        <option value="FG">FG (Finished Goods)</option>
                        <option value="RM">RM (Raw Materials)</option>
                        <option value="SF">SF (Semi-Finished)</option>
                        <option value="PK">PK (Packaging)</option>
                        <option value="CO">CO (Consumables)</option>
                        <option value="MA">MA (Spares)</option>
                        <option value="BO">BO (Bought-Out)</option>
                      </select>
                    </td>
                    <td className="p-3.5 text-slate-800 font-medium max-w-xs truncate">{item.description}</td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleToggleSetting(item.id, 'isActive')}
                        className={`w-6 h-6 rounded-full font-bold text-xs text-center cursor-pointer ${
                          isPermitted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isPermitted ? '✓' : '—'}
                      </button>
                    </td>
                    <td className="p-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={avail?.isStocked ?? false}
                        onChange={() => handleToggleSetting(item.id, 'isStocked')}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                      />
                    </td>
                    <td className="p-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={avail?.isPurchased ?? false}
                        onChange={() => handleToggleSetting(item.id, 'isPurchased')}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                      />
                    </td>
                    <td className="p-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={avail?.isManufactured ?? false}
                        onChange={() => handleToggleSetting(item.id, 'isManufactured')}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                      />
                    </td>
                    <td className="p-3.5">
                      <select
                        value={selectedWhId}
                        onChange={(e) => handleSelectWarehouse(item.id, e.target.value)}
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-800 text-xs focus:outline-none"
                      >
                        {branchWarehouses.length === 0 ? (
                          <option value="">No Warehouse for Branch</option>
                        ) : (
                          branchWarehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.warehouseCode} ({w.warehouseName}) {w.isDefault ? '★ [Default]' : ''}
                            </option>
                          ))
                        )}
                      </select>
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
