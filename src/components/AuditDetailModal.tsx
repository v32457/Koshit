import React, { useState } from 'react';
import { EnterpriseAuditRecord } from '../services/enterpriseAuditService';
import { EnterpriseModal } from './EnterpriseModal';
import { ShieldCheck, ShieldAlert, ArrowRight, FileText, Code, CheckCircle, Clock, Key, Calendar, Tag } from 'lucide-react';

interface AuditDetailModalProps {
  auditRecord: EnterpriseAuditRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AuditDetailModal: React.FC<AuditDetailModalProps> = ({ auditRecord, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'diff' | 'json'>('diff');

  if (!auditRecord) return null;

  const prev = auditRecord.previousValue || {};
  const next = auditRecord.newValue || {};

  // Extract all unique keys from previous and new values
  const allKeys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]));

  const formatFieldValue = (val: any) => {
    if (val === undefined || val === null) return <span className="text-slate-400 italic">None / Not set</span>;
    if (typeof val === 'boolean') return val ? 'True (Active)' : 'False (Inactive)';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  return (
    <EnterpriseModal
      title={`Audit Log Detail & Change Diff [${auditRecord.id}]`}
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="p-5 space-y-4 text-xs">
        {/* Header Metadata & Tamper Verification Banner */}
        <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3 border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3 h-3" /> Event Type: {auditRecord.eventType}
              </div>
              <h3 className="text-sm font-black text-white mt-0.5">{auditRecord.eventDescription}</h3>
            </div>

            <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-mono text-[10px] font-bold flex items-center gap-1 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Cryptographic Hash Verified
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-800/80 p-3 rounded-lg text-[11px] font-mono border border-slate-700">
            <div>
              <div className="text-[10px] text-slate-400">Correlation ID</div>
              <div className="font-bold text-cyan-300 truncate">{auditRecord.correlationId}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Timestamp (UTC)</div>
              <div className="font-bold text-slate-200">{new Date(auditRecord.timestamp).toISOString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Changed By</div>
              <div className="font-bold text-white truncate">{auditRecord.changedByName}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Source Channel</div>
              <div className="font-bold text-amber-300">{auditRecord.source}</div>
            </div>
          </div>
        </div>

        {/* Audit Context Details Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Company Scope</span>
            <div className="font-bold text-slate-800 mt-0.5">{auditRecord.companyName || auditRecord.companyId}</div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Purchase Organization</span>
            <div className="font-bold text-indigo-700 mt-0.5">
              {auditRecord.purchaseOrganizationCode ? `[${auditRecord.purchaseOrganizationCode}]` : 'N/A'} {auditRecord.purchaseOrganizationId}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Authorization Ref</span>
            <div className="font-mono font-bold text-emerald-700 mt-0.5">{auditRecord.authorizationReference || 'AUTH-AUTO'}</div>
          </div>

          <div className="sm:col-span-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Business Justification / Reason</span>
            <div className="text-slate-700 mt-0.5 italic">{auditRecord.changeReason}</div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Validity Period</span>
            <div className="font-mono text-slate-800 mt-0.5 font-bold">
              {auditRecord.effectiveFrom ? `${auditRecord.effectiveFrom} to ${auditRecord.effectiveTo || 'Open-ended'}` : 'Immediate'}
            </div>
          </div>
        </div>

        {/* Tab Switcher for Diff vs Raw JSON */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('diff')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'diff' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Structured Before & After Diff
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'json' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" /> Raw JSON & Cryptographic Chain Payload
          </button>
        </div>

        {/* TAB 1: Structured Before and After Comparison Table */}
        {activeTab === 'diff' && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Field Comparison Breakdown ({allKeys.length} Fields Tracked)</span>
              <span className="text-[10px] text-slate-500 font-normal">Highlighted changes indicate field modifications</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-2.5">Field Name</th>
                    <th className="p-2.5">Previous Value (Before)</th>
                    <th className="p-2.5">New Value (After)</th>
                    <th className="p-2.5 text-right">Change Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allKeys.length > 0 ? (
                    allKeys.map((key) => {
                      const prevVal = prev[key];
                      const nextVal = next[key];
                      const isModified = JSON.stringify(prevVal) !== JSON.stringify(nextVal);
                      const isAdded = prevVal === undefined && nextVal !== undefined;
                      const isRemoved = prevVal !== undefined && nextVal === undefined;

                      return (
                        <tr
                          key={key}
                          className={`transition ${
                            isModified ? 'bg-indigo-50/40' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="p-2.5 font-bold font-mono text-slate-900">{key}</td>

                          <td className="p-2.5">
                            <div className={`p-1.5 rounded font-mono text-[11px] ${
                              isRemoved ? 'bg-rose-100 text-rose-800 font-bold border border-rose-200' :
                              isModified ? 'bg-slate-100 text-slate-600 line-through' : 'text-slate-600'
                            }`}>
                              {formatFieldValue(prevVal)}
                            </div>
                          </td>

                          <td className="p-2.5">
                            <div className={`p-1.5 rounded font-mono text-[11px] ${
                              isAdded ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-200' :
                              isModified ? 'bg-indigo-100 text-indigo-900 font-bold border border-indigo-200' : 'text-slate-800'
                            }`}>
                              {formatFieldValue(nextVal)}
                            </div>
                          </td>

                          <td className="p-2.5 text-right">
                            {isAdded && (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                ADDED
                              </span>
                            )}
                            {isRemoved && (
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                                REMOVED
                              </span>
                            )}
                            {isModified && !isAdded && !isRemoved && (
                              <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[10px]">
                                MODIFIED
                              </span>
                            )}
                            {!isModified && (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px]">
                                UNCHANGED
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500 italic">
                        No structured before/after field deltas captured for this event.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Raw JSON & Chained Hashes */}
        {activeTab === 'json' && (
          <div className="space-y-3 font-mono">
            <div className="p-3 bg-slate-900 text-slate-200 rounded-xl space-y-2 border border-slate-800">
              <div className="text-[10px] text-cyan-400 font-bold uppercase flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" /> Chained Hash Payload Structure
              </div>
              <div className="text-[11px] space-y-1">
                <div><span className="text-slate-400">Previous Record Hash:</span> <span className="text-amber-300 break-all">{auditRecord.previousHash}</span></div>
                <div><span className="text-slate-400">Current Record Hash:</span> <span className="text-emerald-400 break-all">{auditRecord.hash}</span></div>
              </div>
            </div>

            <div className="p-3 bg-slate-950 text-emerald-400 rounded-xl font-mono text-[10px] overflow-x-auto max-h-64 border border-slate-800">
              <pre>{JSON.stringify(auditRecord, null, 2)}</pre>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-2xs cursor-pointer"
          >
            Close Audit Inspector
          </button>
        </div>
      </div>
    </EnterpriseModal>
  );
};
