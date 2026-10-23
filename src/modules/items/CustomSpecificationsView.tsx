import React, { useState } from 'react';
import {
  CustomerManufacturerBrandMaster,
  CustomerPartModelReference,
  EntityType,
  GlobalItem,
  User,
} from '../../types';
import {
  INITIAL_CUSTOM_SPECIFICATIONS,
  INITIAL_CUSTOMER_PART_MODEL_REFS,
} from '../../data/seedData';
import {
  SlidersHorizontal,
  Search,
  Plus,
  Building2,
  Tag,
  CheckCircle2,
  XCircle,
  Edit2,
  Power,
  Link,
  Info,
  Filter,
  Layers,
  ArrowUpDown,
} from 'lucide-react';

interface CustomSpecificationsViewProps {
  currentUser: User;
  globalItems: GlobalItem[];
}

export const CustomSpecificationsView: React.FC<CustomSpecificationsViewProps> = ({
  currentUser,
  globalItems,
}) => {
  const [activeTab, setActiveTab] = useState<'cmb' | 'part_model'>('cmb');

  // Master State
  const [cmbList, setCmbList] = useState<CustomerManufacturerBrandMaster[]>(
    INITIAL_CUSTOM_SPECIFICATIONS
  );
  const [partModelList, setPartModelList] = useState<CustomerPartModelReference[]>(
    INITIAL_CUSTOMER_PART_MODEL_REFS
  );

  // CMB Filters
  const [cmbSearch, setCmbSearch] = useState('');
  const [cmbTypeFilter, setCmbTypeFilter] = useState<string>('ALL');
  const [cmbStatusFilter, setCmbStatusFilter] = useState<string>('ALL');

  // Part Model Filters
  const [partSearch, setPartSearch] = useState('');
  const [partStatusFilter, setPartStatusFilter] = useState<string>('ALL');

  // Modals
  const [isCmbModalOpen, setIsCmbModalOpen] = useState(false);
  const [editingCmb, setEditingCmb] = useState<CustomerManufacturerBrandMaster | null>(null);
  const [cmbForm, setCmbForm] = useState<{
    code: string;
    name: string;
    entityType: EntityType;
    description: string;
  }>({ code: '', name: '', entityType: 'CUSTOMER', description: '' });

  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<CustomerPartModelReference | null>(null);
  const [partForm, setPartForm] = useState<{
    customerPartNumber: string;
    customerId: string;
    manufacturerBrandId: string;
    globalItemId: string;
    description: string;
  }>({ customerPartNumber: '', customerId: '', manufacturerBrandId: '', globalItemId: '', description: '' });

  const [errorMsg, setErrorMsg] = useState('');

  // CMB Handlers
  const handleOpenCmbModal = (item?: CustomerManufacturerBrandMaster) => {
    setErrorMsg('');
    if (item) {
      setEditingCmb(item);
      setCmbForm({
        code: item.code,
        name: item.name,
        entityType: item.entityType,
        description: item.description || '',
      });
    } else {
      setEditingCmb(null);
      setCmbForm({ code: '', name: '', entityType: 'CUSTOMER', description: '' });
    }
    setIsCmbModalOpen(true);
  };

  const handleSaveCmb = () => {
    if (!cmbForm.code.trim() || !cmbForm.name.trim()) {
      setErrorMsg('Code and Name are required.');
      return;
    }

    if (editingCmb) {
      setCmbList((prev) =>
        prev.map((c) =>
          c.id === editingCmb.id
            ? {
                ...c,
                code: cmbForm.code.toUpperCase().trim(),
                name: cmbForm.name.toUpperCase().trim(),
                entityType: cmbForm.entityType,
                displayLabel: `${cmbForm.name.toUpperCase().trim()} (${cmbForm.code.toUpperCase().trim()})`,
                description: cmbForm.description,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser.fullName,
              }
            : c
        )
      );
    } else {
      // Duplicate check
      if (cmbList.some((c) => c.code.toLowerCase() === cmbForm.code.trim().toLowerCase())) {
        setErrorMsg(`Code "${cmbForm.code}" already exists in Master.`);
        return;
      }

      const newRecord: CustomerManufacturerBrandMaster = {
        id: `cmb-${Date.now()}`,
        code: cmbForm.code.toUpperCase().trim(),
        name: cmbForm.name.toUpperCase().trim(),
        entityType: cmbForm.entityType,
        displayLabel: `${cmbForm.name.toUpperCase().trim()} (${cmbForm.code.toUpperCase().trim()})`,
        description: cmbForm.description,
        isActive: true,
        referencedItemCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.fullName,
      };
      setCmbList([newRecord, ...cmbList]);
    }

    setIsCmbModalOpen(false);
  };

  const handleToggleCmbStatus = (id: string) => {
    setCmbList((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          if (c.isActive && c.referencedItemCount > 0) {
            alert(`Note: Deactivating master record with ${c.referencedItemCount} referenced items. Soft deactivation protects existing item references.`);
          }
          return { ...c, isActive: !c.isActive, updatedAt: new Date().toISOString() };
        }
        return c;
      })
    );
  };

  // Part Model Handlers
  const handleOpenPartModal = (item?: CustomerPartModelReference) => {
    setErrorMsg('');
    if (item) {
      setEditingPart(item);
      setPartForm({
        customerPartNumber: item.customerPartNumber,
        customerId: item.customerId || '',
        manufacturerBrandId: item.manufacturerBrandId || '',
        globalItemId: item.globalItemId || '',
        description: item.description || '',
      });
    } else {
      setEditingPart(null);
      setPartForm({
        customerPartNumber: '',
        customerId: cmbList.find((c) => c.entityType === 'CUSTOMER')?.id || '',
        manufacturerBrandId: cmbList.find((c) => c.entityType === 'MANUFACTURER' || c.entityType === 'BRAND')?.id || '',
        globalItemId: globalItems[0]?.id || '',
        description: '',
      });
    }
    setIsPartModalOpen(true);
  };

  const handleSavePart = () => {
    if (!partForm.customerPartNumber.trim()) {
      setErrorMsg('Customer Part / Model Number is required.');
      return;
    }

    const matchedCust = cmbList.find((c) => c.id === partForm.customerId);
    const matchedMfg = cmbList.find((c) => c.id === partForm.manufacturerBrandId);
    const matchedItem = globalItems.find((i) => i.id === partForm.globalItemId);

    // Business key validation (customer + customerPartNumber)
    const duplicate = partModelList.some(
      (p) =>
        p.id !== editingPart?.id &&
        p.customerPartNumber.toLowerCase() === partForm.customerPartNumber.trim().toLowerCase() &&
        p.customerId === partForm.customerId
    );

    if (duplicate) {
      setErrorMsg(`Customer Part Number "${partForm.customerPartNumber}" is already registered for ${matchedCust?.name || 'this customer'}.`);
      return;
    }

    if (editingPart) {
      setPartModelList((prev) =>
        prev.map((p) =>
          p.id === editingPart.id
            ? {
                ...p,
                customerPartNumber: partForm.customerPartNumber.trim().toUpperCase(),
                customerId: partForm.customerId,
                customerName: matchedCust?.name,
                manufacturerBrandId: partForm.manufacturerBrandId,
                manufacturerBrandName: matchedMfg?.name,
                globalItemId: partForm.globalItemId,
                globalItemCode: matchedItem?.globalItemCode,
                description: partForm.description,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser.fullName,
              }
            : p
        )
      );
    } else {
      const newRef: CustomerPartModelReference = {
        id: `cpm-${Date.now()}`,
        customerPartNumber: partForm.customerPartNumber.trim().toUpperCase(),
        customerId: partForm.customerId,
        customerName: matchedCust?.name,
        manufacturerBrandId: partForm.manufacturerBrandId,
        manufacturerBrandName: matchedMfg?.name,
        globalItemId: partForm.globalItemId,
        globalItemCode: matchedItem?.globalItemCode,
        description: partForm.description,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.fullName,
      };
      setPartModelList([newRef, ...partModelList]);
    }

    setIsPartModalOpen(false);
  };

  const handleTogglePartStatus = (id: string) => {
    setPartModelList((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive, updatedAt: new Date().toISOString() } : p))
    );
  };

  // Filtered lists
  const filteredCmbList = cmbList.filter((c) => {
    const matchesType = cmbTypeFilter === 'ALL' || c.entityType === cmbTypeFilter;
    const matchesStatus =
      cmbStatusFilter === 'ALL' || (cmbStatusFilter === 'ACTIVE' ? c.isActive : !c.isActive);
    const matchesSearch =
      c.code.toLowerCase().includes(cmbSearch.toLowerCase()) ||
      c.name.toLowerCase().includes(cmbSearch.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(cmbSearch.toLowerCase()));
    return matchesType && matchesStatus && matchesSearch;
  });

  const filteredPartList = partModelList.filter((p) => {
    const matchesStatus =
      partStatusFilter === 'ALL' || (partStatusFilter === 'ACTIVE' ? p.isActive : !p.isActive);
    const matchesSearch =
      p.customerPartNumber.toLowerCase().includes(partSearch.toLowerCase()) ||
      (p.customerName && p.customerName.toLowerCase().includes(partSearch.toLowerCase())) ||
      (p.manufacturerBrandName && p.manufacturerBrandName.toLowerCase().includes(partSearch.toLowerCase())) ||
      (p.globalItemCode && p.globalItemCode.toLowerCase().includes(partSearch.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(partSearch.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-4 text-xs">
      {/* Page Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
            Custom Specifications
          </h2>
          <p className="text-slate-500 mt-0.5">
            Dedicated master maintenance for Customer, Manufacturer & Brand entities and Customer / Part / Model Number references.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('cmb')}
            className={`px-3 py-1.5 rounded-md font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'cmb'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Customer / Manufacturer / Brand (Master)
          </button>
          <button
            onClick={() => setActiveTab('part_model')}
            className={`px-3 py-1.5 rounded-md font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'part_model'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Customer / Part / Model Number
          </button>
        </div>
      </div>

      {/* TAB 1: CUSTOMER / MANUFACTURER / BRAND (MASTER) */}
      {activeTab === 'cmb' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search code, name..."
                  value={cmbSearch}
                  onChange={(e) => setCmbSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-52 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <select
                value={cmbTypeFilter}
                onChange={(e) => setCmbTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
              >
                <option value="ALL">All Entity Types</option>
                <option value="CUSTOMER">Customer</option>
                <option value="MANUFACTURER">Manufacturer</option>
                <option value="BRAND">Brand</option>
              </select>

              <select
                value={cmbStatusFilter}
                onChange={(e) => setCmbStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>

            <button
              onClick={() => handleOpenCmbModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Master Entity
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="p-3">Entity Type</th>
                  <th className="p-3">Code</th>
                  <th className="p-3">Full Name</th>
                  <th className="p-3">Display Label</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-center">Referenced Items</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCmbList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400">
                      No customer, manufacturer or brand entities found matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredCmbList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.entityType === 'CUSTOMER'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : item.entityType === 'MANUFACTURER'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-purple-100 text-purple-800 border border-purple-200'
                          }`}
                        >
                          {item.entityType}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">{item.code}</td>
                      <td className="p-3 font-semibold text-slate-800">{item.name}</td>
                      <td className="p-3 font-mono text-slate-600 text-[11px]">{item.displayLabel}</td>
                      <td className="p-3 text-slate-500 max-w-xs truncate">{item.description || '—'}</td>
                      <td className="p-3 text-center">
                        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          {item.referencedItemCount}
                        </span>
                      </td>
                      <td className="p-3">
                        {item.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <button
                          onClick={() => handleOpenCmbModal(item)}
                          className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition cursor-pointer"
                          title="Edit Master"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleCmbStatus(item.id)}
                          className={`p-1 rounded transition cursor-pointer ${
                            item.isActive
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={item.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOMER / PART / MODEL NUMBER */}
      {activeTab === 'part_model' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search customer part #, customer, item code..."
                  value={partSearch}
                  onChange={(e) => setPartSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-64 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <select
                value={partStatusFilter}
                onChange={(e) => setPartStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active References Only</option>
                <option value="INACTIVE">Inactive References Only</option>
              </select>
            </div>

            <button
              onClick={() => handleOpenPartModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Part / Model Ref
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="p-3">Customer Part / Model Number</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Manufacturer / Brand</th>
                  <th className="p-3">Linked Global Item Code</th>
                  <th className="p-3">Reference Description</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPartList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      No customer part / model number references found matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredPartList.map((ref) => (
                    <tr key={ref.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono font-bold text-indigo-700">{ref.customerPartNumber}</td>
                      <td className="p-3 font-semibold text-slate-800">{ref.customerName || '—'}</td>
                      <td className="p-3 text-slate-600">{ref.manufacturerBrandName || '—'}</td>
                      <td className="p-3 font-mono font-bold text-slate-900 flex items-center gap-1.5">
                        <Link className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        {ref.globalItemCode || '—'}
                      </td>
                      <td className="p-3 text-slate-500 max-w-xs truncate">{ref.description || '—'}</td>
                      <td className="p-3">
                        {ref.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <button
                          onClick={() => handleOpenPartModal(ref)}
                          className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition cursor-pointer"
                          title="Edit Reference"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleTogglePartStatus(ref.id)}
                          className={`p-1 rounded transition cursor-pointer ${
                            ref.isActive
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={ref.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CMB MODAL */}
      {isCmbModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
              <span>{editingCmb ? 'Edit Master Entity' : 'Add New Master Entity'}</span>
              <button
                onClick={() => setIsCmbModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </h3>

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Entity Type *</label>
                <select
                  value={cmbForm.entityType}
                  onChange={(e) => setCmbForm({ ...cmbForm, entityType: e.target.value as EntityType })}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="CUSTOMER">Customer</option>
                  <option value="MANUFACTURER">Manufacturer</option>
                  <option value="BRAND">Brand</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Code *</label>
                <input
                  type="text"
                  placeholder="e.g. CUST-003, BASF-01"
                  value={cmbForm.code}
                  disabled={!!editingCmb}
                  onChange={(e) => setCmbForm({ ...cmbForm, code: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg uppercase disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Full Entity Name *</label>
                <input
                  type="text"
                  placeholder="e.g. MAHINDRA & MAHINDRA LTD"
                  value={cmbForm.name}
                  onChange={(e) => setCmbForm({ ...cmbForm, name: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Description / Notes</label>
                <textarea
                  placeholder="Additional details..."
                  value={cmbForm.description}
                  onChange={(e) => setCmbForm({ ...cmbForm, description: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg h-16"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsCmbModalOpen(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCmb}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs cursor-pointer"
              >
                Save Master Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PART MODEL MODAL */}
      {isPartModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
              <span>{editingPart ? 'Edit Customer Part Ref' : 'Add Customer Part / Model Number Reference'}</span>
              <button
                onClick={() => setIsPartModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </h3>

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Customer Part / Model Number *</label>
                <input
                  type="text"
                  placeholder="e.g. TATA-2540-SLEEVE"
                  value={partForm.customerPartNumber}
                  onChange={(e) => setPartForm({ ...partForm, customerPartNumber: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Customer</label>
                  <select
                    value={partForm.customerId}
                    onChange={(e) => setPartForm({ ...partForm, customerId: e.target.value })}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="">— None —</option>
                    {cmbList
                      .filter((c) => c.entityType === 'CUSTOMER' && c.isActive)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Manufacturer / Brand</label>
                  <select
                    value={partForm.manufacturerBrandId}
                    onChange={(e) => setPartForm({ ...partForm, manufacturerBrandId: e.target.value })}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="">— None —</option>
                    {cmbList
                      .filter((c) => (c.entityType === 'MANUFACTURER' || c.entityType === 'BRAND') && c.isActive)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Link to Global Item Master Item</label>
                <select
                  value={partForm.globalItemId}
                  onChange={(e) => setPartForm({ ...partForm, globalItemId: e.target.value })}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                >
                  <option value="">— Unlinked —</option>
                  {globalItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.globalItemCode} – {i.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Reference Notes / Specification</label>
                <textarea
                  placeholder="Customer drawing #, contract specs..."
                  value={partForm.description}
                  onChange={(e) => setPartForm({ ...partForm, description: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg h-16"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsPartModalOpen(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePart}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs cursor-pointer"
              >
                Save Part Reference
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
