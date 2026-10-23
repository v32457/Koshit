import React from 'react';
import { FileCheck, Shield, Search } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const auditEntries = [
    { id: 'aud-01', correlationId: 'corr-sap-sync-91', actor: 'usr-sap-04 (SAP System)', role: 'GLOBAL_ITEM_ADMIN', action: 'SAP_B1_ITEM_SYNC', entity: 'global_items', entityId: 'RMPAOPOEXLG0001', outcome: 'SUCCESS', timestamp: '2026-10-21 09:15:00 IST' },
    { id: 'aud-02', correlationId: 'corr-appr-04', actor: 'usr-checker-03 (Venkatesh Iyer)', role: 'ITEM_CHECKER', action: 'ITEM_APPROVE_COMMITTED', entity: 'global_items', entityId: 'FGHDMCRGY0002', outcome: 'SUCCESS', timestamp: '2026-10-22 02:00:00 IST' },
    { id: 'aud-03', correlationId: 'corr-sub-05', actor: 'usr-maker-02 (Ananya Deshmukh)', role: 'ITEM_MAKER', action: 'ITEM_DRAFT_SUBMITTED', entity: 'global_items', entityId: 'MAPALBL0003', outcome: 'SUCCESS', timestamp: '2026-10-22 03:15:00 IST' },
    { id: 'aud-04', correlationId: 'corr-sec-2fa-01', actor: 'usr-admin-01 (Rajesh Sharma)', role: 'PLATFORM_ADMIN', action: 'SECURITY_POLICY_UPDATE', entity: 'system_settings', entityId: '2FA_CONFIG', outcome: 'SUCCESS', timestamp: '2026-10-22 03:30:00 IST' },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-emerald-600" />
            Enterprise Audit Logs & Compliance Trail
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Append-only, tamper-evident audit logs capturing actor, role, correlation ID, entity change diffs, and outcomes.
          </p>
        </div>

        <span className="text-xs font-mono font-bold px-3 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
          Append-Only Mode Active
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                <th className="p-3">Correlation ID</th>
                <th className="p-3">Actor & Role</th>
                <th className="p-3">Operation / Action</th>
                <th className="p-3">Target Entity</th>
                <th className="p-3">Entity Identifier</th>
                <th className="p-3">Outcome</th>
                <th className="p-3">Timestamp (IST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditEntries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-mono font-bold text-cyan-800">{e.correlationId}</td>
                  <td className="p-3">
                    <div className="font-semibold text-slate-900">{e.actor}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{e.role}</div>
                  </td>
                  <td className="p-3 font-mono text-[11px] font-bold text-blue-700">{e.action}</td>
                  <td className="p-3 font-mono text-slate-600">{e.entity}</td>
                  <td className="p-3 font-mono font-bold text-slate-800">{e.entityId}</td>
                  <td className="p-3">
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                      {e.outcome}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-slate-500 text-[11px]">{e.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
