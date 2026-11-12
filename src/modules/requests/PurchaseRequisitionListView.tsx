/**
 * CIPPLATFORM - PURCHASE REQUISITION LIST & DASHBOARD VIEW
 * Phase 1 PR Module (170 features): Covers MRP, Manual, Repair, and Maintenance PRs, multi-warehouse stock visibility, budget validation, approval tracking, and bulk cleanup.
 */

import React, { useState, useMemo } from 'react';
import { User } from '../../types';
import { PurchaseRequisitionHeader, PRType, PRStatus } from '../../types/purchaseRequisition';
import { PurchaseRequisitionService } from '../../services/purchaseRequisitionService';
import {
  FileText,
  Plus,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  Wrench,
  Cpu,
  Package,
  ArrowUpRight,
  ShieldAlert,
  Trash2,
  RefreshCw,
  Download
} from 'lucide-react';

interface PurchaseRequisitionListViewProps {
  currentUser: User;
  onOpenCreateModal: () => void;
  onOpenDetailsModal: (pr: PurchaseRequisitionHeader) => void;
  onOpenCleanupView: () => void;
}

export const PurchaseRequisitionListView: React.FC<PurchaseRequisitionListViewProps> = ({
  currentUser,
  onOpenCreateModal,
  onOpenDetailsModal,
  onOpenCleanupView,
}) => {
  const [prs, setPrs] = useState<PurchaseRequisitionHeader[]>(() => PurchaseRequisitionService.getPurchaseRequisitions());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<PRType | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<PRStatus | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<'HEADER' | 'LINE'>('HEADER');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedPrs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedPrs.map((pr: PurchaseRequisitionHeader) => pr.id)));
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

  const getPRStatus = (pr: PurchaseRequisitionHeader) => {
    const isCompleted = pr.lines.every(line => (line.receivedQuantity || 0) >= line.requestedQuantity);
    return isCompleted ? 'COMPLETED' : pr.status;
  };

  // Export functionality
  const exportData = (format: 'csv' | 'xls') => {
    const dataToExport = selectedIds.size > 0 
      ? sortedPrs.filter((pr: PurchaseRequisitionHeader) => selectedIds.has(pr.id))
      : sortedPrs;
    
    let content = "";
    if (viewMode === 'HEADER') {
      content = "PR Number,Type,Branch,Requester,Est. Value,Date,Status\n" +
        dataToExport.map((pr: PurchaseRequisitionHeader) => `${pr.prNumber},${pr.prType},${pr.branchName},${pr.requesterName},${pr.estimatedTotalValue},${new Date(pr.createdAt).toLocaleDateString()},${getPRStatus(pr)}`).join("\n");
    } else {
      content = "PR Number,Line No,Item Code,Item Desc,Required Qty,Received Qty,Unit Price,Tax Amount,Total Amount\n";
      dataToExport.forEach((pr: PurchaseRequisitionHeader) => {
        pr.lines.forEach((line: any, index: number) => {
          content += `${pr.prNumber},${index + 1},${line.itemCode},${line.description},${line.requestedQuantity},${line.receivedQuantity || 0},${line.approximateUnitPrice},0,${line.estimatedTotalValue}\n`;
        });
      });
    }

    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PurchaseRequisitions_${viewMode}_${new Date().toISOString()}.${format}`;
    a.click();
  };

  // Check branch applicability
  const currentBranchId = currentUser.allowedBranchIds?.[0] || 'branch-001';
  const isApplicable = PurchaseRequisitionService.isPRApplicable(currentBranchId, 'MANUAL');

  const filteredPrs = prs.filter((pr) => {
    const matchesSearch =
      pr.prNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.purchasePurpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.requesterName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'ALL' || pr.prType === selectedType;
    const matchesStatus = selectedStatus === 'ALL' || pr.status === selectedStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const [sortConfig, setSortConfig] = useState<{ key: keyof PurchaseRequisitionHeader; direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: keyof PurchaseRequisitionHeader) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedPrs = useMemo(() => {
    const sorted = [...filteredPrs];
    if (sortConfig) {
      sorted.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [filteredPrs, sortConfig]);

  const getStatusBadge = (status: PRStatus) => {
    switch (status) {
      case 'APPROVED_PENDING_BUYER':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">Approved - Pending Buyer</span>;
      case 'PENDING_MANAGER_APPROVAL':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300">Pending Manager L1</span>;
      case 'PENDING_SUBSEQUENT_APPROVAL':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-300">Pending Category Approval</span>;
      case 'PENDING_REAPPROVAL':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-300">Pending Reapproval</span>;
      case 'DRAFT':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">Draft</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300">Rejected</span>;
      case 'RETURNED_FOR_CORRECTION':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-300">Returned for Correction</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">Cancelled</span>;
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Completed</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">{status}</span>;
    }
  };

  const getTypeBadge = (type: PRType) => {
    switch (type) {
      case 'MRP':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">MRP</span>;
      case 'MANUAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Manual</span>;
      case 'REPAIR':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Repair</span>;
      case 'MAINTENANCE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">Maintenance</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Applicability Warning Banner if disabled */}
      {!isApplicable && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 p-3 rounded-xl flex items-center gap-3 text-xs font-medium">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold">Applicability Notice:</span> Purchase Requests are currently restricted or disabled for your branch ({currentBranchId}) under General Settings configuration. Contact an administrator to enable access.
          </div>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Purchase Requisitions (PR) - Phase 1 Master
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage MRP, Manual, Repair, and Maintenance PRs with mandatory budget checks, stock visibility, and Reporting Manager L1 approval.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative group">
            <button className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer">
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <div className="absolute right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-32 hidden group-hover:block z-10">
              <button onClick={() => exportData('csv')} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 cursor-pointer">CSV</button>
              <button onClick={() => exportData('xls')} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 cursor-pointer">Excel</button>
            </div>
          </div>
          
          <button
            onClick={onOpenCleanupView}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-500" />
            Stale Cleanup
          </button>

          <button
            onClick={onOpenCreateModal}
            disabled={!isApplicable}
            className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer ${
              !isApplicable ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Plus className="w-4 h-4" />
            Create PR
          </button>
        </div>
      </div>


      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          onClick={() => { setSelectedStatus('ALL'); setSelectedType('ALL'); }}
          className={`bg-white p-3.5 rounded-xl border shadow-xs cursor-pointer transition hover:shadow-md ${
            selectedStatus === 'ALL' && selectedType === 'ALL' ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/20' : 'border-slate-200 hover:border-indigo-300'
          }`}
        >
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Total Active PRs</span>
            <span className="text-[10px] text-indigo-600 font-bold underline">Show All</span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">{prs.length}</div>
          <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" /> All branches active
          </div>
        </div>

        <div
          onClick={() => setSelectedStatus('PENDING_MANAGER_APPROVAL')}
          className={`bg-white p-3.5 rounded-xl border shadow-xs cursor-pointer transition hover:shadow-md ${
            selectedStatus === 'PENDING_MANAGER_APPROVAL' ? 'border-amber-500 ring-1 ring-amber-500 bg-amber-50/20' : 'border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Pending Approvals</span>
            <span className="text-[10px] text-amber-600 font-bold underline">Filter Pending</span>
          </div>
          <div className="text-xl font-bold text-amber-600 mt-1">
            {prs.filter(p => p.status.includes('PENDING')).length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Manager L1 & Matrix</div>
        </div>

        <div
          onClick={() => setSelectedStatus('APPROVED_PENDING_BUYER')}
          className={`bg-white p-3.5 rounded-xl border shadow-xs cursor-pointer transition hover:shadow-md ${
            selectedStatus === 'APPROVED_PENDING_BUYER' ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/20' : 'border-slate-200 hover:border-indigo-300'
          }`}
        >
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Approved - Pending Buyer</span>
            <span className="text-[10px] text-indigo-600 font-bold underline">Filter Approved</span>
          </div>
          <div className="text-xl font-bold text-indigo-600 mt-1">
            {prs.filter(p => p.status === 'APPROVED_PENDING_BUYER').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Ready for buyer assignment</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Estimated Value (Total / Min / Max)</div>
          <div className="text-lg font-bold text-slate-900 mt-1">
            ₹{filteredPrs.reduce((acc, p) => acc + p.estimatedTotalValue, 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex gap-2">
            <span>Min: ₹{filteredPrs.length > 0 ? Math.min(...filteredPrs.map(p => p.estimatedTotalValue)).toLocaleString('en-IN') : 0}</span>
            <span>Max: ₹{filteredPrs.length > 0 ? Math.max(...filteredPrs.map(p => p.estimatedTotalValue)).toLocaleString('en-IN') : 0}</span>
          </div>
        </div>
      </div>

      {/* Filters & Search & View Toggle */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by PR Number, purpose, requester..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('HEADER')}
              className={`px-3 py-1 rounded font-bold text-xs transition cursor-pointer ${
                viewMode === 'HEADER' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Header
            </button>
            <button
              onClick={() => setViewMode('LINE')}
              className={`px-3 py-1 rounded font-bold text-xs transition cursor-pointer ${
                viewMode === 'LINE' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Line
            </button>
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All PR Types</option>
            <option value="MRP">MRP</option>
            <option value="MANUAL">Manual</option>
            <option value="REPAIR">Repair</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_MANAGER_APPROVAL">Pending Manager L1</option>
            <option value="APPROVED_PENDING_BUYER">Approved - Pending Buyer</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>


      {/* PR Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1200px]">
            {viewMode === 'LINE' && (
              <colgroup>
                <col className="w-10" />
                <col className="w-24" />
                <col className="w-16" />
                <col className="w-24" />
                <col className="w-48" />
                <col className="w-20" />
                <col className="w-20" />
                <col className="w-20" />
                <col className="w-24" />
                <col className="w-20" />
                <col className="w-24" />
                <col className="w-32" />
                <col className="w-24" />
              </colgroup>
            )}
            {viewMode === 'HEADER' ? (
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3"><input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.size === sortedPrs.length && sortedPrs.length > 0} /></th>
                  <th className="p-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('prNumber')}>PR Number {sortConfig?.key === 'prNumber' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Branch & Dept</th>
                  <th className="p-3">Requester</th>
                  <th className="p-3">Purpose & Items</th>
                  <th className="p-3">Est. Value (INR)</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Budget Status</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
            ) : (
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3 text-center"><input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.size === sortedPrs.length && sortedPrs.length > 0} /></th>
                  <th className="p-3 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('prNumber')}>PR Number {sortConfig?.key === 'prNumber' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="p-3">Line</th>
                  <th className="p-3">Item Code</th>
                  <th className="p-3">Item Desc</th>
                  <th className="p-3 text-right">Req Qty</th>
                  <th className="p-3 text-right">Rec Qty</th>
                  <th className="p-3 text-right">Pending</th>
                  <th className="p-3 text-right">Unit Price</th>
                  <th className="p-3 text-right">Tax</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-slate-100">
              {viewMode === 'HEADER' ? (
                sortedPrs.map((pr: PurchaseRequisitionHeader) => (
                  <tr
                    key={pr.id}
                    className="hover:bg-indigo-50/50 transition cursor-pointer"
                    onClick={() => onOpenDetailsModal(pr)}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(pr.id)} onChange={() => toggleSelect(pr.id)} /></td>
                    <td className="p-3 font-mono font-bold text-indigo-700">{pr.prNumber}</td>
                    <td className="p-3">{getTypeBadge(pr.prType)}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{pr.branchName}</div>
                      <div className="text-[11px] text-slate-500">{pr.department}</div>
                    </td>
                    <td className="p-3 font-medium text-slate-800">{pr.requesterName}</td>
                    <td className="p-3 max-w-xs">
                      <div className="font-semibold text-slate-800 truncate">{pr.purchasePurpose}</div>
                      <div className="text-[11px] text-slate-500">{pr.lines.length} item line(s)</div>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900">
                      ₹{pr.estimatedTotalValue.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-slate-600">{new Date(pr.createdAt).toLocaleDateString()}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        pr.budgetValidationStatus === 'SUFFICIENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {pr.budgetValidationStatus}
                      </span>
                    </td>
                    <td className="p-3">{getStatusBadge(getPRStatus(pr))}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onOpenDetailsModal(pr)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold transition cursor-pointer"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                sortedPrs.flatMap((pr: PurchaseRequisitionHeader) => pr.lines.map((line: any, index: number) => {
                  const pendingQty = line.requestedQuantity - (line.receivedQuantity || 0);
                  return (
                    <tr key={`${pr.id}-${line.id}`} className="hover:bg-indigo-50/50 transition">
                      <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(pr.id)} onChange={() => toggleSelect(pr.id)} /></td>
                      <td className="p-3 font-mono font-bold text-indigo-700">{pr.prNumber}</td>
                      <td className="p-3 text-center">{index + 1}</td>
                      <td className="p-3 font-mono">{line.itemCode}</td>
                      <td className="p-3">{line.description}</td>
                      <td className="p-3 text-right">{line.requestedQuantity}</td>
                      <td className="p-3 text-right">{line.receivedQuantity || 0}</td>
                      <td className="p-3 font-bold text-amber-700 text-right">{pendingQty}</td>
                      <td className="p-3 text-right">₹{line.approximateUnitPrice.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right">₹0</td>
                      <td className="p-3 font-bold text-right">₹{line.estimatedTotalValue.toLocaleString('en-IN')}</td>
                      <td className="p-3">
                        {/* Map line-level status if possible, otherwise use PR header status */}
                        {getStatusBadge(
                          (line.status === 'ACTIVE' ? getPRStatus(pr) : line.status as unknown as PRStatus)
                        )}
                      </td>
                      <td className="p-3 text-right">
                         <button
                           onClick={() => onOpenDetailsModal(pr)}
                           className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold transition cursor-pointer"
                         >
                           View Details
                         </button>
                      </td>
                    </tr>
                  );
                }))
              )}
              {sortedPrs.length === 0 && (
                <tr>
                  <td colSpan={viewMode === 'HEADER' ? 11 : 12} className="p-8 text-center text-slate-400 italic">
                    No purchase requisitions found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
