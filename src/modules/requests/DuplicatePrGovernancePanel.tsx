/**
 * UNIFIED DUPLICATE PR GOVERNANCE PANEL
 * Consolidates Header-Level & Line-Level Duplicate PR Detection, Persisted Justification Acknowledgement,
 * Policy / Checker Override Authorisation, Stale Drift Detection, Submission Eligibility, and Immutable Audit History
 * into ONE authoritative governance panel (never rendering contradictory dual banners).
 */

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { User } from '../../types';
import {
  DuplicateConditionRecord,
  PRDuplicateGovernanceSnapshot,
} from '../../types/purchaseRequisition';
import { prGovernancePolicyService } from '../../services/prGovernancePolicyService';
import {
  DEFAULT_CHECKER_ROLES,
  DEFAULT_OVERRIDE_ROLES,
  DuplicateLineInput,
  prDuplicateGovernanceService,
} from '../../services/prDuplicateGovernanceService';

interface DuplicatePrGovernancePanelProps {
  draftKey: string;
  prId?: string;
  prNumber?: string;
  companyId: string;
  branchId: string;
  requesterId?: string;
  purchasePurpose?: string;
  expectedDeliveryDate?: string;
  lines: DuplicateLineInput[];
  currentUser: User;
  snapshot: PRDuplicateGovernanceSnapshot;
  readOnly?: boolean;
  onSnapshotUpdated: (nextSnapshot: PRDuplicateGovernanceSnapshot) => void;
  onRefresh: () => void;
}

export const DuplicatePrGovernancePanel: React.FC<DuplicatePrGovernancePanelProps> = ({
  draftKey,
  prId,
  prNumber,
  companyId,
  branchId,
  requesterId,
  purchasePurpose,
  expectedDeliveryDate,
  lines,
  currentUser,
  snapshot,
  readOnly = false,
  onSnapshotUpdated,
  onRefresh,
}) => {
  const [justificationsByKey, setJustificationsByKey] = useState<Record<string, string>>({});
  const [checkerRemarksByKey, setCheckerRemarksByKey] = useState<Record<string, string>>({});
  const [overrideRemarksByKey, setOverrideRemarksByKey] = useState<Record<string, string>>({});
  const [supersedeModeByKey, setSupersedeModeByKey] = useState<Record<string, boolean>>({});
  const [supersedeReasonByKey, setSupersedeReasonByKey] = useState<Record<string, string>>({});
  const [feedbackByKey, setFeedbackByKey] = useState<
    Record<string, { type: 'success' | 'error' | 'info'; message: string }>
  >({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [showAuditHistory, setShowAuditHistory] = useState(false);

  const effPolicy = useMemo(
    () => prGovernancePolicyService.getEffectivePolicy(companyId, branchId),
    [companyId, branchId]
  );

  const checkerRoles =
    effPolicy.duplicatePrevention?.checkerApprovalRoles &&
    effPolicy.duplicatePrevention.checkerApprovalRoles.length > 0
      ? effPolicy.duplicatePrevention.checkerApprovalRoles
      : DEFAULT_CHECKER_ROLES;

  const overrideRoles =
    effPolicy.duplicatePrevention?.authorizedOverrideRoles &&
    effPolicy.duplicatePrevention.authorizedOverrideRoles.length > 0
      ? effPolicy.duplicatePrevention.authorizedOverrideRoles
      : DEFAULT_OVERRIDE_ROLES;

  const allMatchingPrNumbers = useMemo(
    () =>
      Array.from(
        new Set(snapshot.conditions.flatMap((c) => c.matchingPrs.map((m) => m.prNumber)))
      ),
    [snapshot.conditions]
  );

  const allMatchingItemCodes = useMemo(
    () => Array.from(new Set(snapshot.conditions.map((c) => c.itemCode))),
    [snapshot.conditions]
  );

  if (!snapshot.hasDuplicates && (!snapshot.auditHistory || snapshot.auditHistory.length === 0)) {
    return null;
  }

  // If all duplicate conditions resolved cleanly (e.g., matching PR cancelled), show resolved summary briefly + audit toggle
  if (!snapshot.hasDuplicates && snapshot.auditHistory && snapshot.auditHistory.length > 0) {
    return (
      <div
        data-testid="duplicate-governance-panel"
        className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs space-y-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">Duplicate PR Governance: Clear</span>
              <span className="ml-2 text-emerald-800">
                All previous duplicate PR conditions have been resolved. Submission Eligible: YES.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="px-2 py-1 bg-white border border-emerald-300 rounded text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowAuditHistory((v) => !v)}
              className="px-2 py-1 bg-white border border-emerald-300 rounded text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 flex items-center gap-1 cursor-pointer"
            >
              <History className="w-3 h-3" /> Audit ({snapshot.auditHistory.length})
            </button>
          </div>
        </div>
        {showAuditHistory && (
          <div className="bg-white border border-emerald-200 rounded-lg p-2.5 space-y-1.5 max-h-44 overflow-y-auto">
            {snapshot.auditHistory.map((h) => (
              <div key={h.id} className="text-[11px] text-slate-700 border-b border-slate-100 pb-1 last:border-b-0">
                <span className="font-mono font-bold text-slate-900">{h.eventType}</span> •{' '}
                <span className="font-semibold">{h.itemCode}</span> • {h.actorName} (
                {new Date(h.timestamp).toLocaleString()}) — {h.reason || h.justification}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const handleAcknowledge = async (cond: DuplicateConditionRecord) => {
    const draftJustif = (
      justificationsByKey[cond.conditionKey] ??
      cond.acknowledgement?.justification ??
      ''
    ).trim();

    if (!draftJustif) {
      setFeedbackByKey((prev) => ({
        ...prev,
        [cond.conditionKey]: {
          type: 'error',
          message: 'Please enter a business justification before acknowledging.',
        },
      }));
      return;
    }

    const isSupersede = Boolean(supersedeModeByKey[cond.conditionKey]);
    const supersedeReason = (supersedeReasonByKey[cond.conditionKey] || '').trim();
    if (isSupersede && !supersedeReason) {
      setFeedbackByKey((prev) => ({
        ...prev,
        [cond.conditionKey]: {
          type: 'error',
          message: 'Please provide an audit reason to supersede an already approved override.',
        },
      }));
      return;
    }

    setBusyKey(cond.conditionKey);
    try {
      const res = await prDuplicateGovernanceService.acknowledgeConditionRemote({
        draftKey,
        prId,
        prNumber,
        conditionKey: cond.conditionKey,
        justification: draftJustif,
        companyId,
        branchId,
        requesterId,
        purchasePurpose,
        expectedDeliveryDate,
        lines,
        actorUser: currentUser,
        allowSupersede: isSupersede,
        supersedeReason: isSupersede ? supersedeReason : undefined,
      });

      onSnapshotUpdated(res.snapshot);
      if (res.success) {
        setSupersedeModeByKey((prev) => ({ ...prev, [cond.conditionKey]: false }));
        setSupersedeReasonByKey((prev) => ({ ...prev, [cond.conditionKey]: '' }));
        setFeedbackByKey((prev) => ({
          ...prev,
          [cond.conditionKey]: {
            type: res.condition?.policyAllowsOverride ? 'success' : 'error',
            message: res.message,
          },
        }));
      } else {
        setFeedbackByKey((prev) => ({
          ...prev,
          [cond.conditionKey]: { type: 'error', message: res.message },
        }));
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleAuthoriseOverride = async (cond: DuplicateConditionRecord) => {
    setBusyKey(cond.conditionKey);
    try {
      const res = await prDuplicateGovernanceService.authoriseOverrideRemote({
        draftKey,
        prId,
        prNumber,
        conditionKey: cond.conditionKey,
        remarks: overrideRemarksByKey[cond.conditionKey],
        companyId,
        branchId,
        requesterId,
        purchasePurpose,
        expectedDeliveryDate,
        lines,
        actorUser: currentUser,
      });
      onSnapshotUpdated(res.snapshot);
      setFeedbackByKey((prev) => ({
        ...prev,
        [cond.conditionKey]: {
          type: res.success ? 'success' : 'error',
          message: res.message,
        },
      }));
    } finally {
      setBusyKey(null);
    }
  };

  const handleRequestCheckerOverride = async (cond: DuplicateConditionRecord) => {
    setBusyKey(cond.conditionKey);
    try {
      const res = await prDuplicateGovernanceService.requestCheckerOverrideRemote({
        draftKey,
        prId,
        prNumber,
        conditionKey: cond.conditionKey,
        companyId,
        branchId,
        requesterId,
        purchasePurpose,
        expectedDeliveryDate,
        lines,
        actorUser: currentUser,
      });
      onSnapshotUpdated(res.snapshot);
      setFeedbackByKey((prev) => ({
        ...prev,
        [cond.conditionKey]: {
          type: res.success ? 'info' : 'error',
          message: res.message,
        },
      }));
    } finally {
      setBusyKey(null);
    }
  };

  const handleCheckerDecision = async (
    cond: DuplicateConditionRecord,
    decision: 'APPROVED' | 'REJECTED'
  ) => {
    const remarks = (checkerRemarksByKey[cond.conditionKey] || '').trim();
    if (decision === 'REJECTED' && !remarks) {
      setFeedbackByKey((prev) => ({
        ...prev,
        [cond.conditionKey]: {
          type: 'error',
          message: 'Please provide rejection remarks before rejecting the duplicate override.',
        },
      }));
      return;
    }
    setBusyKey(cond.conditionKey);
    try {
      const res = await prDuplicateGovernanceService.checkerDecisionRemote({
        draftKey,
        prId,
        prNumber,
        conditionKey: cond.conditionKey,
        decision,
        remarks: remarks || (decision === 'APPROVED' ? 'Approved by Checker' : ''),
        companyId,
        branchId,
        requesterId,
        purchasePurpose,
        expectedDeliveryDate,
        lines,
        checkerUser: currentUser,
      });
      onSnapshotUpdated(res.snapshot);
      setFeedbackByKey((prev) => ({
        ...prev,
        [cond.conditionKey]: {
          type: res.success ? (decision === 'APPROVED' ? 'success' : 'error') : 'error',
          message: res.message,
        },
      }));
    } finally {
      setBusyKey(null);
    }
  };

  const panelTheme = snapshot.submissionEligible
    ? 'bg-emerald-50/80 border-emerald-300'
    : snapshot.overallStatus === 'PROHIBITED' || snapshot.overallStatus === 'REJECTED' || snapshot.overallStatus === 'STALE'
    ? 'bg-rose-50/90 border-rose-300'
    : 'bg-amber-50/90 border-amber-300';

  const getStateBadge = (cond: DuplicateConditionRecord) => {
    if (cond.state === 'STALE') {
      return (
        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[10px]">
          STALE — Re-Acknowledgement Required
        </span>
      );
    }
    if (cond.state === 'OVERRIDE_AUTHORISED') {
      return (
        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px]">
          OVERRIDE AUTHORISED
        </span>
      );
    }
    if (cond.state === 'ACKNOWLEDGED') {
      return (
        <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold text-[10px]">
          ACKNOWLEDGED
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]">
        DETECTED (Blocked)
      </span>
    );
  };

  const getOverrideStatusLabel = (cond: DuplicateConditionRecord) => {
    switch (cond.overrideStatus) {
      case 'AUTHORISED':
        return `Override Authorised (${cond.overrideRecord?.approvalReference || 'APPROVED'})`;
      case 'PENDING_CHECKER_APPROVAL':
        return 'Awaiting Checker Approval';
      case 'REJECTED':
        return `Rejected (${cond.overrideRecord?.rejectionReason || 'Denied by Checker'})`;
      case 'PROHIBITED_BY_POLICY':
        return 'Duplicate PR Submission Blocked (Prohibited by Policy)';
      case 'STALE':
        return 'Stale — Revalidation Required';
      default:
        return 'Not Requested / Not Authorised';
    }
  };

  return (
    <div
      data-testid="duplicate-governance-panel"
      data-overall-status={snapshot.overallStatus}
      data-submission-eligible={String(snapshot.submissionEligible)}
      className={`border p-3.5 rounded-xl space-y-3 text-xs ${panelTheme}`}
    >
      {/* Consolidated Header Summary */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-black/10 pb-2.5">
        <div className="flex items-start gap-2.5">
          {snapshot.submissionEligible ? (
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-bold text-slate-900 flex flex-wrap items-center gap-2">
              <span>Duplicate PR Governance</span>
              <span
                data-testid="dup-count-badge"
                className="px-2 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px] text-slate-800"
              >
                Duplicate PRs: {snapshot.totalMatchingPrCount} ({snapshot.totalDuplicateConditions} Item Condition
                {snapshot.totalDuplicateConditions === 1 ? '' : 's'})
              </span>
              <span
                data-testid="dup-eligibility-badge"
                className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                  snapshot.submissionEligible
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}
              >
                {snapshot.submissionEligible ? 'Submission Eligible' : 'Submission Blocked'}
              </span>
            </div>
            <div className="text-[11px] text-slate-700 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              <span>
                <strong>Matching PRs:</strong> {allMatchingPrNumbers.join(', ')}
              </span>
              <span>
                <strong>Matching Items:</strong> {allMatchingItemCodes.join(', ')}
              </span>
              <span>
                <strong>Policy:</strong> {snapshot.policyVersion}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Refresh Duplicate Check
          </button>
          <button
            type="button"
            onClick={() => setShowAuditHistory((v) => !v)}
            className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
          >
            <History className="w-3 h-3" /> Audit Trail ({snapshot.auditHistory.length})
            {showAuditHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Per-Condition Identifiable Records */}
      <div className="space-y-2.5">
        {snapshot.conditions.map((cond) => {
          const isBusy = busyKey === cond.conditionKey;
          const isApprovedImmutable =
            cond.state === 'OVERRIDE_AUTHORISED' && !supersedeModeByKey[cond.conditionKey];
          const currentJustif =
            justificationsByKey[cond.conditionKey] ?? cond.acknowledgement?.justification ?? '';
          const canUserDirectAuthorise =
            !readOnly &&
            cond.state === 'ACKNOWLEDGED' &&
            cond.policyAllowsOverride &&
            !cond.requiresCheckerApproval &&
            overrideRoles.includes(currentUser.role) &&
            cond.overrideStatus !== 'AUTHORISED';
          const canUserActAsChecker =
            !readOnly &&
            cond.acknowledgement &&
            cond.policyAllowsOverride &&
            cond.state !== 'STALE' &&
            cond.overrideStatus !== 'AUTHORISED' &&
            checkerRoles.includes(currentUser.role) &&
            currentUser.id !== cond.acknowledgement.userId;
          const condFeedback = feedbackByKey[cond.conditionKey];

          return (
            <div
              key={cond.conditionKey}
              data-testid={`dup-condition-${cond.itemCode}`}
              data-state={cond.state}
              data-override-status={cond.overrideStatus}
              className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5 shadow-2xs"
            >
              {/* Condition Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold text-[10px]">
                    Line #{cond.lineIndex + 1}
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    {cond.itemCode}
                  </span>
                  {cond.itemDescription && (
                    <span className="text-slate-600 text-[11px] truncate max-w-[260px]">
                      {cond.itemDescription}
                    </span>
                  )}
                  <span className="text-[11px] font-semibold text-slate-700">
                    (Proposed Qty: {cond.proposedQuantity} {cond.inventoryUom || ''})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {getStateBadge(cond)}
                  <span
                    className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                      cond.submissionEligible
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {cond.submissionEligible ? 'Eligible for Submission' : 'Blocked'}
                  </span>
                </div>
              </div>

              {/* Matching Open PRs Table */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px]">
                    <tr>
                      <th className="py-1.5 px-2.5">Matching PR #</th>
                      <th className="py-1.5 px-2.5">PR Status</th>
                      <th className="py-1.5 px-2.5">Item Code</th>
                      <th className="py-1.5 px-2.5">Existing Qty</th>
                      <th className="py-1.5 px-2.5">Requester</th>
                      <th className="py-1.5 px-2.5">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {cond.matchingPrs.map((m) => (
                      <tr key={`${m.prId}-${m.itemCode}`}>
                        <td className="py-1.5 px-2.5 font-mono font-bold text-indigo-700">
                          {m.prNumber}
                        </td>
                        <td className="py-1.5 px-2.5">
                          <span className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-semibold text-slate-800 text-[10px]">
                            {m.status}
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 font-mono">{m.itemCode}</td>
                        <td className="py-1.5 px-2.5 font-mono">
                          {m.existingQty} {m.inventoryUom || ''}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-700">{m.requesterName || 'N/A'}</td>
                        <td className="py-1.5 px-2.5 font-mono text-slate-500">{m.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Consolidated Governance Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px] block">
                    Acknowledgement Status
                  </span>
                  {cond.acknowledgement ? (
                    <div className="text-slate-900 font-semibold mt-0.5">
                      Persisted ({cond.acknowledgement.id})
                      <div className="text-[10px] text-slate-600 font-normal">
                        By {cond.acknowledgement.userName} ({cond.acknowledgement.userRole}) •{' '}
                        {new Date(cond.acknowledgement.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <span className="text-amber-800 font-semibold">Pending User Acknowledgement</span>
                  )}
                </div>

                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px] block">
                    Override Approval Status
                  </span>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {getOverrideStatusLabel(cond)}
                    {cond.overrideRecord?.decidedByName && (
                      <div className="text-[10px] text-slate-600 font-normal">
                        By {cond.overrideRecord.decidedByName} ({cond.overrideRecord.decidedByRole})
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px] block">
                    Submission Eligibility & Policy
                  </span>
                  <div className="mt-0.5 font-semibold text-slate-800">
                    {cond.submissionEligible ? (
                      <span className="text-emerald-700">Permitted to Submit PR</span>
                    ) : (
                      <span className="text-rose-700">
                        {cond.blockingReason || cond.policyReason}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Banner for Prohibited / Awaiting Checker / Rejected / Stale */}
              {!cond.policyAllowsOverride && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 font-semibold text-[11px] flex items-start gap-2">
                  <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{cond.policyReason}</span>
                </div>
              )}

              {cond.overrideStatus === 'PENDING_CHECKER_APPROVAL' && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 font-semibold text-[11px] flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Awaiting Checker Approval: Acknowledgement and justification have been persisted,
                    but submission remains blocked until an authorised Checker approves the duplicate PR
                    override.
                  </span>
                </div>
              )}

              {cond.overrideStatus === 'REJECTED' && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 font-semibold text-[11px] flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    Duplicate PR Override Rejected by {cond.overrideRecord?.decidedByName || 'Checker'}
                    {cond.overrideRecord?.rejectionReason
                      ? `: "${cond.overrideRecord.rejectionReason}". Update justification and re-acknowledge to re-request.`
                      : '.'}
                  </span>
                </div>
              )}

              {cond.state === 'STALE' && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 font-semibold text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{cond.staleReason}</span>
                </div>
              )}

              {/* Justification Input & Acknowledgement Action */}
              {!readOnly && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[260px]">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Mandatory Duplicate Justification ({cond.itemCode}) *
                      </label>
                      <input
                        type="text"
                        disabled={isApprovedImmutable || isBusy}
                        aria-label={`Duplicate Justification for ${cond.itemCode}`}
                        placeholder="Enter business justification why this duplicate PR item is required..."
                        value={currentJustif}
                        onChange={(e) =>
                          setJustificationsByKey((prev) => ({
                            ...prev,
                            [cond.conditionKey]: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 disabled:bg-slate-100 disabled:text-slate-600"
                      />
                    </div>

                    {isApprovedImmutable ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSupersedeModeByKey((prev) => ({
                            ...prev,
                            [cond.conditionKey]: true,
                          }))
                        }
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold rounded-lg text-xs cursor-pointer"
                      >
                        Supersede & Re-Acknowledge
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleAcknowledge(cond)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs cursor-pointer"
                      >
                        {isBusy ? 'Persisting...' : 'Acknowledge & Record Justification'}
                      </button>
                    )}
                  </div>

                  {supersedeModeByKey[cond.conditionKey] && (
                    <div className="flex flex-wrap items-center gap-2 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      <input
                        type="text"
                        placeholder="Audit reason for superseding approved override..."
                        value={supersedeReasonByKey[cond.conditionKey] || ''}
                        onChange={(e) =>
                          setSupersedeReasonByKey((prev) => ({
                            ...prev,
                            [cond.conditionKey]: e.target.value,
                          }))
                        }
                        className="flex-1 min-w-[220px] px-2.5 py-1 bg-white border border-amber-300 rounded text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSupersedeModeByKey((prev) => ({
                            ...prev,
                            [cond.conditionKey]: false,
                          }))
                        }
                        className="px-2 py-1 text-slate-600 hover:text-slate-900 font-bold text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Read-only justification view when readOnly */}
              {readOnly && cond.acknowledgement && (
                <div className="text-[11px] text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                  <strong>Persisted Justification:</strong> {cond.acknowledgement.justification}
                </div>
              )}

              {/* Direct Override Authorisation (Authorised User when policy allows without separate Checker) */}
              {canUserDirectAuthorise && (
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                  <input
                    type="text"
                    aria-label={`Override remarks for ${cond.itemCode}`}
                    placeholder="Optional override authorisation remarks..."
                    value={overrideRemarksByKey[cond.conditionKey] || ''}
                    onChange={(e) =>
                      setOverrideRemarksByKey((prev) => ({
                        ...prev,
                        [cond.conditionKey]: e.target.value,
                      }))
                    }
                    className="flex-1 min-w-[200px] px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleAuthoriseOverride(cond)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Authorise Duplicate Override
                  </button>
                </div>
              )}

              {/* Request Checker Approval when role lacks direct override or policy requires Checker */}
              {!readOnly &&
                cond.state === 'ACKNOWLEDGED' &&
                cond.policyAllowsOverride &&
                cond.requiresCheckerApproval &&
                cond.overrideStatus === 'NOT_REQUESTED' && (
                  <div className="pt-1 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleRequestCheckerOverride(cond)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs cursor-pointer"
                    >
                      Request Checker Override Approval
                    </button>
                  </div>
                )}

              {/* Checker Approve / Reject Controls (Maker != Checker enforced) */}
              {canUserActAsChecker && cond.overrideStatus === 'PENDING_CHECKER_APPROVAL' && (
                <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-slate-200 bg-indigo-50/70 p-2 rounded-lg">
                  <span className="font-bold text-indigo-900 text-[11px]">
                    Checker Override Review ({currentUser.role}):
                  </span>
                  <input
                    type="text"
                    aria-label={`Checker decision remarks for ${cond.itemCode}`}
                    placeholder="Checker remarks (mandatory for rejection)..."
                    value={checkerRemarksByKey[cond.conditionKey] || ''}
                    onChange={(e) =>
                      setCheckerRemarksByKey((prev) => ({
                        ...prev,
                        [cond.conditionKey]: e.target.value,
                      }))
                    }
                    className="flex-1 min-w-[200px] px-2.5 py-1 bg-white border border-indigo-300 rounded text-xs"
                  />
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleCheckerDecision(cond, 'APPROVED')}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs cursor-pointer"
                  >
                    Approve Override
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleCheckerDecision(cond, 'REJECTED')}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs cursor-pointer"
                  >
                    Reject Override
                  </button>
                </div>
              )}

              {/* Condition-level confirmation/error feedback (shown ONLY after persistence/response) */}
              {condFeedback && (
                <div
                  className={`p-2 rounded-lg border text-[11px] font-semibold ${
                    condFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : condFeedback.type === 'info'
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {condFeedback.message}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Collapsible Audit History */}
      {showAuditHistory && snapshot.auditHistory && snapshot.auditHistory.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5">
          <div className="font-bold text-slate-900 text-[11px] flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-indigo-600" />
            <span>Immutable Duplicate Governance Audit Trail</span>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
            {snapshot.auditHistory.map((h) => (
              <div key={h.id} className="py-1.5 text-[11px] text-slate-700 flex flex-wrap gap-x-2">
                <span className="font-mono font-bold text-slate-900">{h.eventType}</span>
                <span className="font-mono text-indigo-700">{h.itemCode}</span>
                <span>by <strong>{h.actorName}</strong> ({h.actorRole})</span>
                <span className="text-slate-500">{new Date(h.timestamp).toLocaleString()}</span>
                {h.approvalReference && (
                  <span className="px-1.5 py-0.2 bg-emerald-50 border border-emerald-200 rounded font-mono text-[10px] text-emerald-800">
                    Ref: {h.approvalReference}
                  </span>
                )}
                {(h.reason || h.justification) && (
                  <span className="text-slate-600 w-full">— {h.reason || h.justification}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
