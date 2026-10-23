import React, { useState } from 'react';
import { PageAcceptanceRecord } from '../types';
import { FileText, CheckCircle2, XCircle, AlertCircle, X, Search, Filter } from 'lucide-react';

interface PageAcceptanceRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: PageAcceptanceRecord[];
  onSelectPage: (route: string) => void;
}

export const PageAcceptanceRegisterModal: React.FC<PageAcceptanceRegisterModalProps> = ({
  isOpen,
  onClose,
  records,
  onSelectPage,
}) => {
  const [filter, setFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  if (!isOpen) return null;

  const filteredRecords = records.filter((r) => {
    const matchesFilter = filter === 'ALL' || r.status === filter;
    const matchesSearch =
      r.key.toLowerCase().includes(search.toLowerCase()) ||
      r.displayName.toLowerCase().includes(search.toLowerCase()) ||
      r.route.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const acceptedCount = records.filter((r) => r.status === 'Accepted').length;
  const pendingCount = records.filter((r) => r.status === 'Pending Review').length;
  const changesCount = records.filter((r) => r.status === 'Changes Requested').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#0B192C] text-white p-4 md:px-6 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-600/30 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Kosh Innovations — Page Acceptance Register
              </h2>
              <p className="text-xs text-slate-400">
                Mandatory Page-by-Page Preview, User Acceptance & Iterative Revision Gate
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metric summary bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-xs shrink-0">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-slate-700">Total Registered Screens: {records.length}</span>
            <span className="flex items-center gap-1 text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /> {acceptedCount} Accepted
            </span>
            <span className="flex items-center gap-1 text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-full font-bold">
              <AlertCircle className="w-3.5 h-3.5" /> {pendingCount} Pending Review
            </span>
            {changesCount > 0 && (
              <span className="flex items-center gap-1 text-rose-700 bg-rose-100/80 px-2.5 py-0.5 rounded-full font-bold">
                <XCircle className="w-3.5 h-3.5" /> {changesCount} Changes Requested
              </span>
            )}
          </div>

          {/* Filter and Search */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Search screen or route..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none w-48"
              />
            </div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="Accepted">Accepted</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Changes Requested">Changes Requested</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-y-auto flex-1 p-6">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                  <th className="p-3">Key</th>
                  <th className="p-3">Display Name & Module</th>
                  <th className="p-3">Route</th>
                  <th className="p-3">Review Status</th>
                  <th className="p-3">User Feedback / Decision Reason</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRecords.map((rec) => (
                  <tr key={rec.key} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-mono font-bold text-cyan-700">{rec.key}</td>
                    <td className="p-3 font-semibold text-slate-900">{rec.displayName}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-500">{rec.route}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                          rec.status === 'Accepted'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : rec.status === 'Changes Requested'
                            ? 'bg-rose-50 text-rose-700 border-rose-300'
                            : 'bg-amber-50 text-amber-700 border-amber-300'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 text-[11px] max-w-xs truncate">
                      {rec.rejectionReason || rec.changesMade || <span className="text-slate-400 italic">None</span>}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          onSelectPage(rec.route);
                          onClose();
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                      >
                        Jump to Page
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-3 px-6 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>Synced with <code className="font-mono text-slate-700">docs/page-acceptance-register.md</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 text-white rounded font-medium hover:bg-slate-700 transition cursor-pointer"
          >
            Close Register
          </button>
        </div>
      </div>
    </div>
  );
};
