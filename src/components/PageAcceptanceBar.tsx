import React, { useState } from 'react';
import { PageAcceptanceRecord } from '../types';
import { CheckCircle2, XCircle, AlertCircle, Eye, FileText, ChevronRight, ShieldCheck } from 'lucide-react';

interface PageAcceptanceBarProps {
  currentRecord: PageAcceptanceRecord;
  onAccept: (key: string, comment?: string) => void;
  onReject: (key: string, reason: string) => void;
  onOpenRegister: () => void;
  onOpenStage0Spec: () => void;
}

export const PageAcceptanceBar: React.FC<PageAcceptanceBarProps> = ({
  currentRecord,
  onAccept,
  onReject,
  onOpenRegister,
  onOpenStage0Spec,
}) => {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const statusColors = {
    'Accepted': 'bg-emerald-50 text-emerald-800 border-emerald-300',
    'Pending Review': 'bg-amber-50 text-amber-800 border-amber-300',
    'Changes Requested': 'bg-rose-50 text-rose-800 border-rose-300',
    'In Progress': 'bg-blue-50 text-blue-800 border-blue-300',
    'Not Started': 'bg-slate-50 text-slate-700 border-slate-300',
  };

  const handleConfirmReject = () => {
    if (!rejectReason.trim()) return;
    onReject(currentRecord.key, rejectReason.trim());
    setShowRejectModal(false);
    setRejectReason('');
  };

  return (
    <>
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 text-white flex flex-wrap items-center justify-between gap-3 shadow-md z-40 text-xs">
        {/* Left: Current Page Info & Gated Review Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2 py-1 rounded border border-slate-700">
            <span className="font-mono text-cyan-400 font-bold">{currentRecord.key}</span>
            <span className="text-slate-400">•</span>
            <span className="font-medium text-slate-200">{currentRecord.displayName}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Review Gate Status:</span>
            <span className={`px-2 py-0.5 rounded-full font-semibold border text-[11px] ${statusColors[currentRecord.status] || 'bg-slate-800 text-slate-300'}`}>
              {currentRecord.status === 'Accepted' && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-emerald-600" />}
              {currentRecord.status === 'Changes Requested' && <XCircle className="w-3.5 h-3.5 inline mr-1 text-rose-600" />}
              {currentRecord.status === 'Pending Review' && <AlertCircle className="w-3.5 h-3.5 inline mr-1 text-amber-500" />}
              {currentRecord.status}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenStage0Spec}
            className="flex items-center gap-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/60 px-2.5 py-1 rounded font-medium transition cursor-pointer"
            title="Inspect Stage 0 Architecture Proposal"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            Stage 0 Architecture Spec
          </button>

          <button
            onClick={onOpenRegister}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-2.5 py-1 rounded font-medium transition cursor-pointer"
            title="View full Page Acceptance Register"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            Acceptance Register (19 Pages)
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* User Decision Controls */}
          {currentRecord.status !== 'Accepted' ? (
            <>
              <button
                onClick={() => onAccept(currentRecord.key)}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1 rounded shadow-sm transition cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Accept Page
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold px-3 py-1 rounded shadow-sm transition cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject / Request Changes
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Page Accepted by Product Owner
              <button
                onClick={() => setShowRejectModal(true)}
                className="ml-2 text-slate-400 hover:text-white underline text-[10px]"
              >
                Revise Decision
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="bg-rose-50 border-b border-rose-100 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Reject / Request Changes: {currentRecord.key}</h3>
                <p className="text-xs text-slate-600">{currentRecord.displayName}</p>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Rejection Reason / Specific Changes Requested <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="State specific issues, UI defects, missing fields, or workflow corrections..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 italic">
                Per governance guidelines, this feedback is recorded verbatim in docs/page-acceptance-register.md before revisions.
              </p>
            </div>

            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-3 py-1.5 rounded text-xs font-medium text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={!rejectReason.trim()}
                className="px-4 py-1.5 rounded text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition disabled:opacity-50 cursor-pointer"
              >
                Record Rejection & Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
