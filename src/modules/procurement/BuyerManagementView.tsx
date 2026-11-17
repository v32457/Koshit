import React, { useState, useMemo } from 'react';
import {
  Users2,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Search,
  Filter,
  BarChart3,
  UserCheck,
  UserX,
  ArrowRightLeft,
  ShieldCheck,
  Building2,
  Check,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { User } from '../../types';
import { BuyerAssignmentRecord } from '../../types/buyerAssignment';
import { INITIAL_USERS } from '../../data/seedData';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';

export const INITIAL_BUYER_ASSIGNMENTS: BuyerAssignmentRecord[] = [
  {
    id: 'byr-001',
    itemCategory: 'Raw Materials (RM)',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    branchName: 'Pondicherry Main Plant & HQ',
    branchCode: 'POND-01',
    buyerUserId: 'usr-buyer-01',
    buyerName: 'Vikram Singh (Senior Procurement Officer)',
    buyerEmail: 'vikram.singh@kosh.com',
    activePrCount: 6,
    totalPrValue: 4500000,
    oldestPendingPrDays: 4,
    status: 'ACTIVE',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Procurement Manager',
  },
  {
    id: 'byr-002',
    itemCategory: 'Maintenance & Spares (MA)',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    branchName: 'Pondicherry Main Plant & HQ',
    branchCode: 'POND-01',
    buyerUserId: 'usr-buyer-02',
    buyerName: 'Ananya Roy (Maintenance Buyer)',
    buyerEmail: 'ananya.roy@kosh.com',
    activePrCount: 3,
    totalPrValue: 1200000,
    oldestPendingPrDays: 1,
    status: 'ACTIVE',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Procurement Manager',
  },
  {
    id: 'byr-003',
    itemCategory: 'IT Equipment & Hardware (IT)',
    companyId: 'co-kosh-01',
    branchId: 'br-chen-02',
    branchName: 'Chennai Hub & Electronics Facility',
    branchCode: 'CHEN-02',
    buyerUserId: 'usr-buyer-03',
    buyerName: 'Suresh Kumar (IT Sourcing Buyer)',
    buyerEmail: 'suresh.kumar@kosh.com',
    activePrCount: 8,
    totalPrValue: 7800000,
    oldestPendingPrDays: 9,
    status: 'ON_LEAVE',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Procurement Manager',
  },
  {
    id: 'byr-004',
    itemCategory: 'Packaging Materials (PM)',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    branchName: 'Pondicherry Main Plant & HQ',
    branchCode: 'POND-01',
    buyerUserId: '',
    buyerName: 'Unassigned / Missing Mapping',
    buyerEmail: '',
    activePrCount: 2,
    totalPrValue: 850000,
    oldestPendingPrDays: 7,
    status: 'UNMAPPED',
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Auto-Detect',
  },
];

export const BuyerManagementView: React.FC<{ currentUser?: User }> = () => {
  const [assignments, setAssignments] = useState<BuyerAssignmentRecord[]>(INITIAL_BUYER_ASSIGNMENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reassignModalRecord, setReassignModalRecord] = useState<BuyerAssignmentRecord | null>(null);
  const [targetBuyerName, setTargetBuyerName] = useState('Rajesh Sharma (Platform Admin)');
  const [reassignReason, setReassignReason] = useState('Employee on planned leave; reassigning pending PR queue.');

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          a.buyerName.toLowerCase().includes(q) ||
          a.itemCategory.toLowerCase().includes(q) ||
          a.branchName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [assignments, statusFilter, searchQuery]);

  const grid = useStandardDataGrid({
    gridId: 'procurement-buyer-assignments',
    data: filteredAssignments,
    defaultSortField: 'updatedAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
    filterSignature: `${statusFilter}|${searchQuery}`,
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAssignments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAssignments.map(a => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const exportToCSV = () => {
    const dataToExport = selectedIds.size > 0 
      ? assignments.filter(a => selectedIds.has(a.id))
      : filteredAssignments;

    const headers = ['Category', 'Branch', 'Buyer Name', 'Status', 'Active PRs', 'Workload Value'];
    const rows = dataToExport.map(a => [
      a.itemCategory,
      a.branchName,
      a.buyerName,
      a.status,
      a.activePrCount,
      a.totalPrValue
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'buyer_assignments.csv';
    link.click();
  };
  
  // ... rest of the code ...
  // [Then update table and toolbar in JSX]



  // Aggregate stats
  const totalActivePrs = useMemo(() => assignments.reduce((acc, a) => acc + a.activePrCount, 0), [assignments]);
  const totalPrValue = useMemo(() => assignments.reduce((acc, a) => acc + a.totalPrValue, 0), [assignments]);
  const unmappedCount = useMemo(() => assignments.filter((a) => a.status === 'UNMAPPED').length, [assignments]);

  const handleConfirmReassign = () => {
    if (!reassignModalRecord) return;
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === reassignModalRecord.id
          ? {
              ...a,
              buyerUserId: 'usr-reassigned-01',
              buyerName: targetBuyerName,
              buyerEmail: 'rajesh.sharma@kosh.com',
              status: 'ACTIVE',
              updatedAt: new Date().toISOString(),
              updatedBy: 'Procurement Manager',
            }
          : a
      )
    );

    setNotice(`Reassigned buyer queue for ${reassignModalRecord.itemCategory} to ${targetBuyerName}.`);
    setReassignModalRecord(null);
    setTimeout(() => setNotice(null), 3500);
  };

  return (
    <div className="space-y-5 text-xs font-sans select-none">
      {/* Page Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users2 className="w-5 h-5 text-indigo-600" />
            Buyer Assignment & Procurement Workload Governance
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Manage branch-category buyer mapping, monitor active PR workload, handle buyer reassignment during absence or exit, and resolve unmapped buyer queues.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unmappedCount > 0 && (
            <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-lg text-xs flex items-center gap-1.5 animate-pulse">
              <AlertCircle className="w-4 h-4 text-amber-600" /> {unmappedCount} Missing Buyer Mapping(s)
            </span>
          )}
        </div>
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
          <span className="text-slate-500 font-bold uppercase text-[10px]">Active Mapped Buyers</span>
          <div className="text-xl font-bold text-slate-900 font-mono">
            {assignments.filter((a) => a.status === 'ACTIVE').length} Buyers
          </div>
          <span className="text-[10px] text-slate-400">Across active branch categories</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 font-bold uppercase text-[10px]">Pending PR Workload</span>
          <div className="text-xl font-bold text-indigo-600 font-mono">{totalActivePrs} Requisitions</div>
          <span className="text-[10px] text-slate-400">Awaiting buyer quotation/PO action</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 font-bold uppercase text-[10px]">Total Workload Value</span>
          <div className="text-xl font-bold text-emerald-600 font-mono">₹{totalPrValue.toLocaleString()}</div>
          <span className="text-[10px] text-slate-400">Estimated value of pending queues</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 font-bold uppercase text-[10px]">Max Queue Ageing</span>
          <div className="text-xl font-bold text-amber-600 font-mono">
            {Math.max(...assignments.map((a) => a.oldestPendingPrDays))} Days
          </div>
          <span className="text-[10px] text-slate-400">Oldest un-acknowledged PR</span>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-300 px-3 py-1.5 rounded-lg shadow-2xs">
            <span className="font-bold text-slate-700">Buyer Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-900 cursor-pointer focus:outline-hidden text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ON_LEAVE">ON LEAVE</option>
              <option value="UNMAPPED">UNMAPPED (Action Required)</option>
            </select>
          </div>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search buyer name, category, branch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
          />
        </div>
      </div>

      {/* Buyer Assignments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            Branch Item Category Buyer Mapping & SLA Queue ({filteredAssignments.length} Mappings)
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-bold uppercase text-[10px]">
                <th className="p-3">Item Category & Branch</th>
                <th className="p-3">Assigned Buyer Name</th>
                <th className="p-3 text-center">Active PRs</th>
                <th className="p-3 text-right">Workload Value</th>
                <th className="p-3 text-center">Oldest PR Age</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grid.pagedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    No buyer assignments match your active filters.
                  </td>
                </tr>
              ) : grid.pagedData.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-bold text-slate-900">
                    {rec.itemCategory}
                    <span className="block font-mono text-[10px] text-slate-500">
                      {rec.branchName} ({rec.branchCode})
                    </span>
                  </td>
                  <td className="p-3 font-bold text-slate-800">
                    {rec.buyerName}
                    {rec.buyerEmail && <span className="block text-[10px] text-slate-400 font-mono">{rec.buyerEmail}</span>}
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-indigo-700">
                    {rec.activePrCount} PRs
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900">
                    ₹{rec.totalPrValue.toLocaleString()}
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-amber-700">
                    {rec.oldestPendingPrDays} Days
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rec.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : rec.status === 'ON_LEAVE'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800 font-black'
                      }`}
                    >
                      {rec.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setReassignModalRecord(rec)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-600 border border-slate-300 rounded font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      <span>Reassign Queue</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DataGridFooter
        currentPage={grid.currentPage}
        totalPages={grid.totalPages}
        pageSize={grid.pageSize}
        totalRecords={grid.totalRecords}
        onPageChange={grid.setCurrentPage}
        onPageSizeChange={grid.setPageSize}
        pageSizeOptions={grid.pageSizeOptions}
        defaultSortNotice="Sorted newest first (Updated At DESC)"
      />

      {/* REASSIGN BUYER MODAL */}
      {reassignModalRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">Reassign Buyer Queue for {reassignModalRecord.itemCategory}</h3>
              </div>
              <button onClick={() => setReassignModalRecord(null)} className="text-slate-400 hover:text-white font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg space-y-1">
                <span className="font-bold block">Current Assignment:</span>
                <div>Buyer: {reassignModalRecord.buyerName}</div>
                <div>Branch: {reassignModalRecord.branchName}</div>
                <div>Pending Queue: {reassignModalRecord.activePrCount} PRs (Total Value: ₹{reassignModalRecord.totalPrValue.toLocaleString()})</div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Reassigned Buyer *</label>
                <select
                  value={targetBuyerName}
                  onChange={(e) => setTargetBuyerName(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
                >
                  <option value="Rajesh Sharma (Platform Admin)">Rajesh Sharma (Platform Admin)</option>
                  <option value="Vikram Singh (Senior Procurement Officer)">Vikram Singh (Senior Procurement Officer)</option>
                  <option value="Ananya Roy (Maintenance Buyer)">Ananya Roy (Maintenance Buyer)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mandatory Reassignment Reason *</label>
                <textarea
                  rows={2}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setReassignModalRecord(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReassign}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
