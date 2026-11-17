import React, { useMemo, useState } from 'react';
import { ShieldAlert, Plus, CheckCircle2 } from 'lucide-react';
import type { SodConflictFinding, SodEnforcementMode, SodRiskLevel } from '../../../types/userRoleAdmin';
import { userRoleAdminService } from '../../../services/userRoleAdminService';
import { useStandardDataGrid } from '../../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../../components/DataGridFooter';
import { ModalShell, RiskTag, StatusTag, UserRoleAdminTabProps } from './shared';

export const SodGovernanceTab: React.FC<UserRoleAdminTabProps> = ({
  currentUser,
  onNotify,
  refreshTick,
  triggerRefresh,
}) => {
  const rules = useMemo(() => userRoleAdminService.getSodRules(), [refreshTick]);
  const roleMatrix = useMemo(() => userRoleAdminService.getRoleConflictMatrix(), [refreshTick]);
  const findings = useMemo(() => userRoleAdminService.scanUserSodConflicts(), [refreshTick]);

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [exceptionTarget, setExceptionTarget] = useState<SodConflictFinding | null>(null);
  const [exceptionExpires, setExceptionExpires] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [exceptionReason, setExceptionReason] = useState('');

  const [ruleForm, setRuleForm] = useState({
    ruleCode: '',
    ruleName: '',
    description: '',
    leftSideLabel: '',
    rightSideLabel: '',
    leftCodesText: '',
    rightCodesText: '',
    enforcementMode: 'PREVENTIVE' as SodEnforcementMode,
    riskLevel: 'HIGH' as SodRiskLevel,
    sameTransactionBlock: true,
  });

  const findingsGrid = useStandardDataGrid({
    gridId: 'ura-sod-findings',
    userId: currentUser.id,
    data: findings,
    defaultSortField: 'detectedAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
  });

  const actor = { id: currentUser.id, name: currentUser.fullName };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const saved = userRoleAdminService.saveSodRule(
        {
          ruleCode: ruleForm.ruleCode.trim().toUpperCase(),
          ruleName: ruleForm.ruleName.trim(),
          description: ruleForm.description.trim(),
          leftSideLabel: ruleForm.leftSideLabel.trim(),
          rightSideLabel: ruleForm.rightSideLabel.trim(),
          leftPermissionOrRoleCodes: ruleForm.leftCodesText.split(',').map((s) => s.trim()).filter(Boolean),
          rightPermissionOrRoleCodes: ruleForm.rightCodesText.split(',').map((s) => s.trim()).filter(Boolean),
          enforcementMode: ruleForm.enforcementMode,
          riskLevel: ruleForm.riskLevel,
          sameTransactionBlock: ruleForm.sameTransactionBlock,
          status: 'ACTIVE',
        },
        actor
      );
      setShowRuleModal(false);
      triggerRefresh();
      onNotify(`Saved SoD Rule '${saved.ruleCode}'.`, 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleApproveException = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exceptionTarget) return;
    try {
      userRoleAdminService.approveSodException(exceptionTarget, exceptionExpires, exceptionReason, actor);
      setExceptionTarget(null);
      setExceptionReason('');
      triggerRefresh();
      onNotify('SoD exception approved with time expiration and compensating justification.', 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-orange-600" />
            Segregation of Duties (SoD) Matrix & Conflict Governance
          </h3>
          <p className="text-[11px] text-slate-500">
            Configure Preventive / Warning / Exception rules, inspect role-level conflicts, scan user assignments, and enforce maker-checker exception approval.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowRuleModal(true)}
          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add SoD Rule
        </button>
      </div>

      {/* Active Rules Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
        <h4 className="text-xs font-bold text-slate-900">Active SoD Policy Rules ({rules.length})</h4>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-2.5">Rule Code & Name</th>
                <th className="p-2.5">Conflicting Pair (Side A vs Side B)</th>
                <th className="p-2.5">Enforcement Mode</th>
                <th className="p-2.5">Risk</th>
                <th className="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="p-2.5">
                    <div className="font-mono font-bold text-indigo-700">{r.ruleCode}</div>
                    <div className="font-bold text-slate-800">{r.ruleName}</div>
                    <div className="text-[11px] text-slate-500">{r.description}</div>
                  </td>
                  <td className="p-2.5 text-[11px]">
                    <div className="font-semibold text-slate-800">{r.leftSideLabel}</div>
                    <div className="font-mono text-slate-500">{r.leftPermissionOrRoleCodes.join(', ')}</div>
                    <div className="font-bold text-rose-600 my-0.5">VS</div>
                    <div className="font-semibold text-slate-800">{r.rightSideLabel}</div>
                    <div className="font-mono text-slate-500">{r.rightPermissionOrRoleCodes.join(', ')}</div>
                  </td>
                  <td className="p-2.5 font-bold text-slate-800">
                    {r.enforcementMode}
                    {r.sameTransactionBlock && (
                      <div className="text-[10px] font-normal text-slate-500">Same-Tx Maker-Checker Block</div>
                    )}
                  </td>
                  <td className="p-2.5"><RiskTag level={r.riskLevel} /></td>
                  <td className="p-2.5"><StatusTag status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Conflict Matrix + User Findings */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
        <h4 className="text-xs font-bold text-slate-900">
          Live User SoD Conflict Findings ({findings.length}) • Role Embedded Conflicts ({roleMatrix.length})
        </h4>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-2.5">User</th>
                <th className="p-2.5">Rule</th>
                <th className="p-2.5">Matched Conflicting Permissions</th>
                <th className="p-2.5">Risk & Mode</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {findingsGrid.pagedData.map((f) => (
                <tr key={f.id}>
                  <td className="p-2.5 font-bold text-slate-900">{f.userName}</td>
                  <td className="p-2.5">
                    <div className="font-mono font-bold text-indigo-700">{f.ruleCode}</div>
                    <div className="text-[11px] text-slate-600">{f.ruleName}</div>
                  </td>
                  <td className="p-2.5 font-mono text-[10px] text-slate-600">
                    <div>L: {f.leftMatched.join(', ')}</div>
                    <div>R: {f.rightMatched.join(', ')}</div>
                  </td>
                  <td className="p-2.5">
                    <RiskTag level={f.riskLevel} />
                    <div className="text-[10px] text-slate-500 mt-0.5">{f.enforcementMode}</div>
                  </td>
                  <td className="p-2.5">
                    <StatusTag status={f.status} />
                    {f.exceptionApprovedBy && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        By {f.exceptionApprovedBy} (until {f.exceptionExpiresAt})
                      </div>
                    )}
                  </td>
                  <td className="p-2.5 text-right">
                    {f.status !== 'EXCEPTION_APPROVED' && (
                      <button
                        type="button"
                        onClick={() => {
                          setExceptionTarget(f);
                          setExceptionReason('');
                        }}
                        className="px-2.5 py-1 rounded border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-[11px] font-bold text-indigo-800 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3 h-3 inline mr-0.5" /> Approve Exception
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {findingsGrid.pagedData.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-emerald-700 font-semibold bg-emerald-50/40">
                    Zero unresolved user-level SoD conflicts detected across active users.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <DataGridFooter
          currentPage={findingsGrid.currentPage}
          totalPages={findingsGrid.totalPages}
          pageSize={findingsGrid.pageSize}
          totalRecords={findingsGrid.totalRecords}
          onPageChange={findingsGrid.setCurrentPage}
          onPageSizeChange={findingsGrid.setPageSize}
          pageSizeOptions={findingsGrid.pageSizeOptions}
        />
      </div>

      {showRuleModal && (
        <ModalShell title="Create Segregation of Duties (SoD) Rule" onClose={() => setShowRuleModal(false)}>
          <form onSubmit={handleCreateRule} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Rule Code *</label>
                <input required value={ruleForm.ruleCode} onChange={(e) => setRuleForm({ ...ruleForm, ruleCode: e.target.value.toUpperCase() })} placeholder="SOD-PROC-99" className="w-full p-2 border border-slate-300 rounded-lg font-mono uppercase" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Rule Name *</label>
                <input required value={ruleForm.ruleName} onChange={(e) => setRuleForm({ ...ruleForm, ruleName: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Left Side Label *</label>
                <input required value={ruleForm.leftSideLabel} onChange={(e) => setRuleForm({ ...ruleForm, leftSideLabel: e.target.value })} placeholder="Create Supplier" className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Right Side Label *</label>
                <input required value={ruleForm.rightSideLabel} onChange={(e) => setRuleForm({ ...ruleForm, rightSideLabel: e.target.value })} placeholder="Approve Supplier Payment" className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Left Codes (CSV) *</label>
                <input required value={ruleForm.leftCodesText} onChange={(e) => setRuleForm({ ...ruleForm, leftCodesText: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Right Codes (CSV) *</label>
                <input required value={ruleForm.rightCodesText} onChange={(e) => setRuleForm({ ...ruleForm, rightCodesText: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Enforcement Mode</label>
                <select value={ruleForm.enforcementMode} onChange={(e) => setRuleForm({ ...ruleForm, enforcementMode: e.target.value as SodEnforcementMode })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  <option value="PREVENTIVE">PREVENTIVE (Block)</option>
                  <option value="WARNING">WARNING (Flag & Log)</option>
                  <option value="EXCEPTION_APPROVAL">EXCEPTION_APPROVAL</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Risk Level</label>
                <select value={ruleForm.riskLevel} onChange={(e) => setRuleForm({ ...ruleForm, riskLevel: e.target.value as SodRiskLevel })} className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Description *</label>
              <textarea required value={ruleForm.description} onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg h-16" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowRuleModal(false)} className="px-3.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">Save Rule</button>
            </div>
          </form>
        </ModalShell>
      )}

      {exceptionTarget && (
        <ModalShell title={`Approve SoD Exception — ${exceptionTarget.ruleCode}`} subtitle="Maker-Checker enforced: users cannot approve their own SoD exception." onClose={() => setExceptionTarget(null)} maxWidth="max-w-lg">
          <form onSubmit={handleApproveException} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Exception Expiration Date *</label>
              <input required type="date" value={exceptionExpires} onChange={(e) => setExceptionExpires(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Compensating Controls & Justification *</label>
              <textarea required value={exceptionReason} onChange={(e) => setExceptionReason(e.target.value)} placeholder="Describe compensating audit controls..." className="w-full p-2 border border-slate-300 rounded-lg h-20" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setExceptionTarget(null)} className="px-3.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">Approve Time-Bounded Exception</button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
};
