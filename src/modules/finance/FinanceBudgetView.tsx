import React, { useState, useMemo } from 'react';
import {
  Coins,
  Building2,
  PieChart,
  DollarSign,
  TrendingUp,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Plus,
  Sliders,
  FileCheck,
  Check,
  Search,
  Filter,
  Calculator,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { Company, Branch } from '../../types';
import { INITIAL_COMPANIES, INITIAL_BRANCHES, CLASSIFICATION_DIMENSIONS } from '../../data/seedData';

export interface DepartmentBudgetRecord {
  id: string;
  companyId: string;
  branchId: string;
  departmentId: string;
  department: string;
  category: string;
  costCentre: string;
  expenditureType: 'OPEX' | 'CAPEX';
  financialYear: string;
  allocatedBudget: number;
  spentBudget: number;
  committedBudget: number;
  availableBudget: number;
  tolerancePercent: number;
  currency: string;
  isEnabled: boolean;
  reservationStage: 'ON_PR_SUBMISSION' | 'ON_FINAL_APPROVAL' | 'ON_PO_ISSUE';
  updatedAt: string;
  updatedBy: string;
}

export const INITIAL_DEPARTMENT_BUDGETS: DepartmentBudgetRecord[] = [
  {
    id: 'bgt-pd-01',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentId: 'dept-pdy-01',
    department: 'Production & Plant Operations',
    category: 'FG',
    costCentre: 'CC-PROD-101',
    expenditureType: 'OPEX',
    financialYear: 'FY 2026-27',
    allocatedBudget: 5000000,
    spentBudget: 1250000,
    committedBudget: 750000,
    availableBudget: 3000000,
    tolerancePercent: 5,
    currency: 'INR',
    isEnabled: true,
    reservationStage: 'ON_FINAL_APPROVAL',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Finance Controller',
  },
  {
    id: 'bgt-pd-02',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentId: 'dept-pdy-03',
    department: 'Maintenance & Engineering',
    category: 'MA',
    costCentre: 'CC-MAINT-202',
    expenditureType: 'CAPEX',
    financialYear: 'FY 2026-27',
    allocatedBudget: 2500000,
    spentBudget: 400000,
    committedBudget: 600000,
    availableBudget: 1500000,
    tolerancePercent: 3,
    currency: 'INR',
    isEnabled: true,
    reservationStage: 'ON_FINAL_APPROVAL',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Finance Controller',
  },
  {
    id: 'bgt-chn-01',
    companyId: 'co-kosh-02',
    branchId: 'br-chen-02',
    departmentId: '',
    department: 'Information Technology',
    category: 'CO',
    costCentre: 'CC-IT-303',
    expenditureType: 'CAPEX',
    financialYear: 'FY 2026-27',
    allocatedBudget: 3500000,
    spentBudget: 900000,
    committedBudget: 500000,
    availableBudget: 2100000,
    tolerancePercent: 5,
    currency: 'INR',
    isEnabled: true,
    reservationStage: 'ON_PR_SUBMISSION',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Finance Controller',
  },
];

interface FinanceBudgetViewProps {
  companyId?: string;
  branchId?: string;
}

export const FinanceBudgetView: React.FC<FinanceBudgetViewProps> = ({ companyId, branchId }) => {
  const [budgets, setBudgets] = useState<DepartmentBudgetRecord[]>(INITIAL_DEPARTMENT_BUDGETS);
  const [companies] = useState<Company[]>(() => {
    try {
      const stored = localStorage.getItem('kosh_companies');
      return stored ? JSON.parse(stored) : INITIAL_COMPANIES;
    } catch {
      return INITIAL_COMPANIES;
    }
  });
  const [branches] = useState<Branch[]>(() => {
    try {
      const stored = localStorage.getItem('kosh_branches');
      return stored ? JSON.parse(stored) : INITIAL_BRANCHES;
    } catch {
      return INITIAL_BRANCHES;
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [fyFilter, setFyFilter] = useState('FY 2026-27');
  const [notice, setNotice] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Partial<DepartmentBudgetRecord> | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [deptSearch, setDeptSearch] = useState('');
  const allDepartments = useMemo(() => INITIAL_BRANCHES.flatMap(b => b.departments?.map(d => ({ ...d, branchId: b.id })) || []), [INITIAL_BRANCHES]);
  const filteredDepts = useMemo(() => allDepartments.filter(d => d.departmentName.toLowerCase().includes(deptSearch.toLowerCase()) || d.departmentCode.toLowerCase().includes(deptSearch.toLowerCase())), [allDepartments, deptSearch]);


  // Filtered branches for company
  const companyActiveBranches = useMemo(() => {
    return branches.filter((b) => (b.companyId || 'co-kosh-01') === companyId && b.lifecycleStatus !== 'INACTIVE');
  }, [branches, companyId]);

  const filteredBudgets = useMemo(() => {
    return budgets.filter((b) => {
      if (companyId && b.companyId !== companyId) return false;
      if (branchId && branchId !== 'ALL' && b.branchId !== branchId) return false;
      if (fyFilter !== 'ALL' && b.financialYear !== fyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          b.department.toLowerCase().includes(q) ||
          b.costCentre.toLowerCase().includes(q) ||
          b.expenditureType.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [budgets, companyId, branchId, fyFilter, searchQuery]);

  // Aggregate Totals
  const totalAllocated = useMemo(() => filteredBudgets.reduce((acc, b) => acc + b.allocatedBudget, 0), [filteredBudgets]);
  const totalSpent = useMemo(() => filteredBudgets.reduce((acc, b) => acc + b.spentBudget, 0), [filteredBudgets]);
  const totalCommitted = useMemo(() => filteredBudgets.reduce((acc, b) => acc + b.committedBudget, 0), [filteredBudgets]);
  const totalAvailable = useMemo(() => filteredBudgets.reduce((acc, b) => acc + b.availableBudget, 0), [filteredBudgets]);

  const handleToggleEnable = (id: string) => {
    setBudgets((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              isEnabled: !b.isEnabled,
              updatedAt: new Date().toISOString(),
              updatedBy: 'Finance Controller',
            }
          : b
      )
    );
  };

  const handleOpenModal = (bgt?: DepartmentBudgetRecord) => {
    if (bgt) {
      setEditingBudget({ ...bgt });
    } else {
      setEditingBudget({
        id: `bgt-${Date.now()}`,
        companyId: companyId || 'co-kosh-01',
        branchId: companyActiveBranches[0]?.id || 'br-pond-01',
        department: 'Quality & Regulatory Assurance',
        category: 'FG',
        costCentre: 'CC-QUAL-404',
        expenditureType: 'OPEX',
        financialYear: 'FY 2026-27',
        allocatedBudget: 2000000,
        spentBudget: 0,
        committedBudget: 0,
        availableBudget: 2000000,
        tolerancePercent: 5,
        currency: 'INR',
        isEnabled: true,
        reservationStage: 'ON_FINAL_APPROVAL',
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveBudget = () => {
    if (!editingBudget || !editingBudget.department || !editingBudget.costCentre) return;
    const allocated = Number(editingBudget.allocatedBudget) || 0;
    const spent = Number(editingBudget.spentBudget) || 0;
    const committed = Number(editingBudget.committedBudget) || 0;
    const available = allocated - (spent + committed);

    const existing = budgets.find(b => b.id === editingBudget.id);
    const shouldCreateNew = existing && existing.isEnabled;

    const recordToSave: DepartmentBudgetRecord = {
      id: shouldCreateNew ? `bgt-${Date.now()}` : (editingBudget.id || `bgt-${Date.now()}`),
      companyId: editingBudget.companyId || companyId || 'co-kosh-01',
      branchId: editingBudget.branchId || companyActiveBranches[0]?.id || 'br-pond-01',
      departmentId: editingBudget.departmentId || '',
      department: editingBudget.department || '',
      category: editingBudget.category || 'FG',
      costCentre: editingBudget.costCentre || '',
      expenditureType: editingBudget.expenditureType || 'OPEX',
      financialYear: editingBudget.financialYear || 'FY 2026-27',
      allocatedBudget: allocated,
      spentBudget: spent,
      committedBudget: committed,
      availableBudget: available,
      tolerancePercent: Number(editingBudget.tolerancePercent) || 5,
      currency: editingBudget.currency || 'INR',
      isEnabled: true, // New records are always enabled
      reservationStage: editingBudget.reservationStage || 'ON_FINAL_APPROVAL',
      updatedAt: new Date().toISOString(),
      updatedBy: 'Finance Controller',
    };

    // Prevent duplicate mapping:
    // If creating a new one (superseding), check for other enabled records.
    // If updating existing (not enabled), check for other enabled records.
    const isDuplicate = budgets.some(b =>
      b.companyId === recordToSave.companyId &&
      b.branchId === recordToSave.branchId &&
      b.departmentId === recordToSave.departmentId &&
      b.id !== (shouldCreateNew ? existing.id : recordToSave.id) &&
      b.isEnabled
    );

    if (isDuplicate) {
      alert('A budget allocation for this department already exists for the selected branch and company.');
      return;
    }

    setBudgets((prev) => {
      if (shouldCreateNew) {
        // Disable the old one, add the new one
        const disabledOld = prev.map(b => b.id === existing.id ? { ...b, isEnabled: false } : b);
        return [recordToSave, ...disabledOld];
      }

      // Existing update logic
      const idx = prev.findIndex((b) => b.id === recordToSave.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = recordToSave;
        return copy;
      }
      return [recordToSave, ...prev];
    });

    setIsModalOpen(false);
    setEditingBudget(null);
    setNotice(`Budget allocation for ${recordToSave.department} (${recordToSave.costCentre}) saved successfully.`);
    setTimeout(() => setNotice(null), 3500);
  };

  return (
    <div className="space-y-5 text-xs font-sans select-none">
      {/* Page Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-600" />
            Budget
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Configure department cost centre allocations, Capex/Opex classifications, budget tolerance limits, and reservation policies across companies and active branches.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Department Budget
        </button>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 font-bold uppercase text-[10px]">Total Allocated Budget</span>
          <div className="text-xl font-bold text-slate-900 font-mono">₹{totalAllocated.toLocaleString()}</div>
          <span className="text-[10px] text-slate-400">Across {filteredBudgets.length} cost centres</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 font-bold uppercase text-[10px]">Actual Spent</span>
          <div className="text-xl font-bold text-rose-600 font-mono">₹{totalSpent.toLocaleString()}</div>
          <span className="text-[10px] text-slate-400">Invoiced & settled PR/PO</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 font-bold uppercase text-[10px]">Committed Outstanding</span>
          <div className="text-xl font-bold text-amber-600 font-mono">₹{totalCommitted.toLocaleString()}</div>
          <span className="text-[10px] text-slate-400">In-flight PRs & open POs</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 font-bold uppercase text-[10px]">Net Available Balance</span>
          <div className="text-xl font-bold text-emerald-600 font-mono">₹{totalAvailable.toLocaleString()}</div>
          <span className="text-[10px] text-slate-400">Ready for procurement requests</span>
        </div>
      </div>

      {/* Selection Filters Toolbar */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* FY Filter */}
          <div className="flex items-center gap-2 bg-white border border-slate-300 px-3 py-1.5 rounded-lg shadow-2xs">
            <span className="font-bold text-slate-700">Financial Year:</span>
            <select
              value={fyFilter}
              onChange={(e) => setFyFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-900 cursor-pointer focus:outline-hidden text-xs"
            >
              <option value="ALL">All Financial Years</option>
              <option value="FY 2026-27">FY 2026-27</option>
              <option value="FY 2025-26">FY 2025-26</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search department, cost centre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
          />
        </div>
      </div>

      {/* Budget Records Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-600" />
            Department Budget Allocations & Expenditure Status ({filteredBudgets.length} Records)
          </h4>
          <span className="text-[10px] text-slate-500">Toggle Enable/Disable status to activate or pause budget enforcement</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-bold uppercase text-[10px]">
                <th className="p-3">Department & Cost Centre</th>
                <th className="p-3">Type & FY</th>
                <th className="p-3 text-right">Allocated</th>
                <th className="p-3 text-right">Spent</th>
                <th className="p-3 text-right">Committed</th>
                <th className="p-3 text-right">Available Balance</th>
                <th className="p-3 text-center font-mono">Tolerance</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBudgets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-400">
                    No budget records found for the selected company and branch filters.
                  </td>
                </tr>
              ) : (
                filteredBudgets.map((bgt) => {
                  const br = branches.find((b) => b.id === bgt.branchId);
                  const availablePct = Math.round((bgt.availableBudget / (bgt.allocatedBudget || 1)) * 100);

                  return (
                    <tr key={bgt.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-slate-900">
                        {bgt.department}
                        <span className="block font-mono text-[10px] text-slate-500">
                          {bgt.costCentre} • {br?.name || 'Branch'} ({br?.portalBranchCode || br?.code})
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            bgt.expenditureType === 'CAPEX' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {bgt.expenditureType}
                        </span>
                        <span className="block text-[10px] text-slate-500 font-mono">{bgt.financialYear}</span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        ₹{bgt.allocatedBudget.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-rose-600">
                        ₹{bgt.spentBudget.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-amber-600">
                        ₹{bgt.committedBudget.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">
                        ₹{bgt.availableBudget.toLocaleString()}
                        <span className="block text-[10px] text-slate-400 font-medium">{availablePct}% Remaining</span>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-700">
                        ±{bgt.tolerancePercent}%
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggleEnable(bgt.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition ${
                            bgt.isEnabled
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {bgt.isEnabled ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Enabled</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-slate-500" />
                              <span>Disabled</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleOpenModal(bgt)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-600 border border-slate-300 rounded font-bold text-[11px] cursor-pointer transition shadow-2xs"
                        >
                          Edit Budget
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT / CREATE BUDGET MODAL */}
      {isModalOpen && editingBudget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">
                  {editingBudget.id?.includes('bgt-') ? 'Edit Department Budget Allocation' : 'Add Department Budget'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department Name *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={deptSearch || editingBudget.department || ''}
                      onChange={(e) => {
                        setDeptSearch(e.target.value);
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      placeholder="Search Department..."
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
                    />
                    {isDropdownOpen && filteredDepts.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {filteredDepts.map(d => (
                          <div
                            key={d.id}
                            className="p-2 hover:bg-slate-100 cursor-pointer text-xs"
                            onClick={() => {
                              setEditingBudget({ ...editingBudget, department: d.departmentName, departmentId: d.id, costCentre: d.departmentCode });
                              setDeptSearch('');
                              setIsDropdownOpen(false);
                            }}
                          >
                            <span className="font-bold">{d.departmentName}</span>
                            <span className="block font-mono text-[10px] text-slate-500">{d.departmentCode}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cost Centre Code *</label>
                  <input
                    type="text"
                    value={editingBudget.costCentre || ''}
                    onChange={(e) => setEditingBudget({ ...editingBudget, costCentre: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={editingBudget.category || 'FG'}
                    onChange={(e) => setEditingBudget({ ...editingBudget, category: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  >
                    {CLASSIFICATION_DIMENSIONS.category.values.map(c => (
                      <option key={c.code} value={c.code}>{c.display}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expenditure Type</label>
                  <select
                    value={editingBudget.expenditureType || 'OPEX'}
                    onChange={(e) => setEditingBudget({ ...editingBudget, expenditureType: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="OPEX">Operating (OPEX)</option>
                    <option value="CAPEX">Capital (CAPEX)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Financial Year</label>
                  <select
                    value={editingBudget.financialYear || 'FY 2026-27'}
                    onChange={(e) => setEditingBudget({ ...editingBudget, financialYear: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="FY 2026-27">FY 2026-27</option>
                    <option value="FY 2025-26">FY 2025-26</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tolerance (%)</label>
                  <input
                    type="number"
                    value={editingBudget.tolerancePercent || 5}
                    onChange={(e) => setEditingBudget({ ...editingBudget, tolerancePercent: Number(e.target.value) || 0 })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Allocated Budget (₹)</label>
                  <input
                    type="number"
                    value={editingBudget.allocatedBudget || 0}
                    onChange={(e) => setEditingBudget({ ...editingBudget, allocatedBudget: Number(e.target.value) || 0 })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Spent (₹)</label>
                  <input
                    type="number"
                    value={editingBudget.spentBudget || 0}
                    onChange={(e) => setEditingBudget({ ...editingBudget, spentBudget: Number(e.target.value) || 0 })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-rose-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Committed (₹)</label>
                  <input
                    type="number"
                    value={editingBudget.committedBudget || 0}
                    onChange={(e) => setEditingBudget({ ...editingBudget, committedBudget: Number(e.target.value) || 0 })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-amber-700"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBudget}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              >
                Save Budget Allocation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
