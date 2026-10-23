import React from 'react';
import { GlobalItem, User } from '../../types';
import { FileText, Clock, RotateCcw, CheckCircle2, ArrowRight } from 'lucide-react';

interface MyRequestsViewProps {
  items: GlobalItem[];
  currentUser: User;
  onNavigateNew: () => void;
}

export const MyRequestsView: React.FC<MyRequestsViewProps> = ({
  items,
  currentUser,
  onNavigateNew,
}) => {
  // Items created by user or visible drafts
  const userItems = items;

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            My Item Requests & Submissions
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track draft progress, submitted requests in checker review, and returned corrections.
          </p>
        </div>

        <button
          onClick={onNavigateNew}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
        >
          Create New Request
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-3">Item Code</th>
                <th className="p-3">Category</th>
                <th className="p-3">Description</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created / Updated</th>
                <th className="p-3">Latest Checker Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {userItems.map((item) => {
                const latestDecision = item.approvalHistory[item.approvalHistory.length - 1];
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-mono font-bold text-cyan-800">
                      {item.globalItemCode}
                      {item.isProvisionalCode && (
                        <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-sans">
                          Provisional
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-slate-800">{item.categoryCode}</td>
                    <td className="p-3 text-slate-800 font-medium max-w-sm truncate">{item.description}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          item.status === 'SAP_CREATED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : item.status === 'APPROVED'
                            ? 'bg-blue-50 text-blue-700 border-blue-300'
                            : item.status === 'RETURNED_FOR_CORRECTION'
                            ? 'bg-rose-50 text-rose-700 border-rose-300'
                            : 'bg-amber-50 text-amber-700 border-amber-300'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-500 text-[11px]">{item.updatedAt}</td>
                    <td className="p-3 text-slate-600 text-[11px] max-w-xs truncate">
                      {latestDecision?.remarks ? (
                        <span>"{latestDecision.remarks}"</span>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
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
