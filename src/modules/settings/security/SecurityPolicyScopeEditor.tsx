/**
 * KOSH INNOVATIONS — HIERARCHICAL SECURITY POLICY EDITOR & VERSION DIFF COMPARATOR
 * Supports Global, Company, Branch, Module, Optional Page/Screen, and Optional User levels.
 * Displays explicit states (INHERIT, ENABLED, DISABLED, MANDATORY, OPTIONAL, NOT_APPLICABLE),
 * enforces anti-self-modification on User policies, and provides Policy Version Comparison.
 */

import React, { useEffect, useState } from 'react';
import { Check, History, GitCompare, ShieldAlert, ShieldCheck, Lock, Trash2 } from 'lucide-react';
import type { User } from '../../../types';
import {
  ALL_SECURITY_CONTROL_KEYS,
  createInheritedControlsMap,
  DEFAULT_SECURITY_PARAMETERS,
} from '../../../services/zeroTrustPolicyEvaluator';
import {
  PolicyControlState,
  ScopedSecurityPolicyConfig,
  SECURITY_CONTROL_METADATA,
  SecurityControlKey,
  SecurityControlRule,
  SecurityPolicyParameters,
  SecurityPolicyVersionSnapshot,
  SecurityScopeLevel,
} from '../../../types/zeroTrustSecurity';
import { zeroTrustSecurityService } from '../../../services/zeroTrustSecurityService';

interface SecurityPolicyScopeEditorProps {
  scopeLevel: SecurityScopeLevel;
  scopeRefId: string;
  scopeLabel: string;
  companyId?: string;
  branchId?: string;
  moduleKey?: string;
  pageKey?: string;
  userId?: string;
  existingPolicy?: ScopedSecurityPolicyConfig;
  allVersions: SecurityPolicyVersionSnapshot[];
  currentUser: User;
  sessionId: string;
  optionalLevelEnabled?: boolean;
  onSaved: () => Promise<void>;
  allowDeleteOptional?: boolean;
}

const CONTROL_STATE_OPTIONS: PolicyControlState[] = [
  'INHERIT',
  'ENABLED',
  'DISABLED',
  'MANDATORY',
  'OPTIONAL',
  'NOT_APPLICABLE',
];

export const SecurityPolicyScopeEditor: React.FC<SecurityPolicyScopeEditorProps> = ({
  scopeLevel,
  scopeRefId,
  scopeLabel,
  companyId,
  branchId,
  moduleKey,
  pageKey,
  userId,
  existingPolicy,
  allVersions,
  currentUser,
  sessionId,
  optionalLevelEnabled = true,
  onSaved,
  allowDeleteOptional = false,
}) => {
  const [controls, setControls] = useState<Record<SecurityControlKey, SecurityControlRule>>(() =>
    existingPolicy ? JSON.parse(JSON.stringify(existingPolicy.controls)) : createInheritedControlsMap()
  );
  const [watermarkParams, setWatermarkParams] = useState(
    () => existingPolicy?.parameters?.watermark || DEFAULT_SECURITY_PARAMETERS.watermark
  );
  const [webcamParams, setWebcamParams] = useState(
    () => existingPolicy?.parameters?.webcamAi || DEFAULT_SECURITY_PARAMETERS.webcamAi
  );
  const [changeReason, setChangeReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [masterStatus, setMasterStatus] = useState<{
    enabled: boolean;
    version: number;
    updatedAt: string;
    updatedByName: string;
    effectiveRuntimeStatus: string;
  } | null>(null);
  const [showMasterConfirm, setShowMasterConfirm] = useState(false);
  const [pendingMasterState, setPendingMasterState] = useState<boolean>(true);
  const [masterReason, setMasterReason] = useState('');

  useEffect(() => {
    if (scopeLevel === 'GLOBAL') {
      zeroTrustSecurityService.getMasterStatus().then(setMasterStatus).catch(() => {});
    }
  }, [scopeLevel]);

  const handleToggleMaster = (nextState: boolean) => {
    setPendingMasterState(nextState);
    setMasterReason('');
    setShowMasterConfirm(true);
  };

  const confirmMasterToggle = async () => {
    if (masterReason.trim().length < 3) {
      setNotice({ type: 'err', text: 'Enter a mandatory master switch justification (minimum 3 characters).' });
      return;
    }
    setSaving(true);
    try {
      const res = await zeroTrustSecurityService.updateMasterStatus(currentUser, sessionId, pendingMasterState, masterReason.trim());
      setMasterStatus(res);
      setShowMasterConfirm(false);
      setNotice({
        type: 'ok',
        text: `Global Security Governance master switch successfully set to ${pendingMasterState ? 'ENABLED' : 'DISABLED'}.`,
      });
      window.dispatchEvent(new CustomEvent('kosh:zt-policy-updated'));
      await onSaved();
    } catch (err: any) {
      setNotice({ type: 'err', text: err?.message || 'Failed to update global master status.' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setControls(
      existingPolicy ? JSON.parse(JSON.stringify(existingPolicy.controls)) : createInheritedControlsMap()
    );
    setWatermarkParams(existingPolicy?.parameters?.watermark || DEFAULT_SECURITY_PARAMETERS.watermark);
    setWebcamParams(existingPolicy?.parameters?.webcamAi || DEFAULT_SECURITY_PARAMETERS.webcamAi);
    setNotice(null);
  }, [scopeLevel, scopeRefId, existingPolicy]);

  const isSelfUserPolicy = scopeLevel === 'USER' && scopeRefId === currentUser.id;
  const scopeVersions = allVersions.filter(
    (v) => v.scopeLevel === scopeLevel && v.scopeRefId === scopeRefId
  );

  const handleSave = async () => {
    setNotice(null);
    if (changeReason.trim().length < 3) {
      setNotice({ type: 'err', text: 'Enter a mandatory governance change reason (minimum 3 characters).' });
      return;
    }
    setSaving(true);
    try {
      const parameters: Partial<SecurityPolicyParameters> = {
        watermark: watermarkParams,
        webcamAi: webcamParams,
      };
      const saved = await zeroTrustSecurityService.upsertScopedPolicy(currentUser, sessionId, {
        scopeLevel,
        scopeRefId,
        scopeLabel,
        companyId,
        branchId,
        moduleKey,
        pageKey,
        userId,
        isActive: true,
        controls,
        parameters,
        changeReason: changeReason.trim(),
        triggersRevalidation: true,
      });
      setChangeReason('');
      setNotice({
        type: 'ok',
        text: `Published ${scopeLevel} security policy (${saved.scopeLabel}) as v${saved.version}. Active sessions revalidated.`,
      });
      window.dispatchEvent(new CustomEvent('kosh:zt-policy-updated'));
      await onSaved();
    } catch (err: any) {
      setNotice({ type: 'err', text: err?.message || 'Failed to save policy.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveOptional = async () => {
    if (scopeLevel !== 'PAGE' && scopeLevel !== 'USER') return;
    setSaving(true);
    try {
      await zeroTrustSecurityService.removeOptionalPolicy(
        currentUser,
        sessionId,
        scopeLevel,
        scopeRefId,
        `Removed optional ${scopeLevel} override for ${scopeRefId}`
      );
      setNotice({ type: 'ok', text: `Removed optional ${scopeLevel} policy. Safely inheriting parent policy.` });
      window.dispatchEvent(new CustomEvent('kosh:zt-policy-updated'));
      await onSaved();
    } catch (err: any) {
      setNotice({ type: 'err', text: err?.message || 'Failed to remove optional policy.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {scopeLevel === 'GLOBAL' && masterStatus && (
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-5 shadow-md space-y-4 border border-indigo-900">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-800/60 pb-3">
            <div>
              <div className="text-[10px] font-mono tracking-widest text-indigo-400 uppercase">Enterprise Master Control</div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                GLOBAL SECURITY GOVERNANCE
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${masterStatus.enabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                Master Status: {masterStatus.enabled ? 'ENABLED' : 'DISABLED'}
              </span>
              <button
                type="button"
                onClick={() => handleToggleMaster(!masterStatus.enabled)}
                disabled={saving}
                className={`px-4 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer disabled:opacity-50 ${
                  masterStatus.enabled
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {masterStatus.enabled ? 'Disable Global Governance' : 'Enable Global Governance'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-indigo-200">
            <div>
              <span className="text-slate-400 text-[10px] uppercase block">Policy Version</span>
              <span className="font-mono font-bold text-white">v{masterStatus.version}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase block">Last Modified By</span>
              <span className="font-semibold text-white">{masterStatus.updatedByName}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase block">Last Modified Date</span>
              <span className="font-mono text-white">{new Date(masterStatus.updatedAt).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase block">Effective Runtime Status</span>
              <span className={`font-bold font-mono ${masterStatus.effectiveRuntimeStatus === 'ENABLED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {masterStatus.effectiveRuntimeStatus}
              </span>
            </div>
          </div>
        </div>
      )}

      {showMasterConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              Confirm Global Security Governance {pendingMasterState ? 'Enable' : 'Disable'}
            </h3>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed font-medium">
              {!pendingMasterState ? (
                <>
                  Are you sure you want to disable Global Security Governance?<br /><br />
                  All configurable Zero-Trust visual and data protection enforcement policies will be suspended. The application will return to its standard authorized operating behaviour.<br /><br />
                  Authentication, authorization, RBAC, company/branch isolation and essential audit logging will remain active.<br /><br />
                  Previously configured security policies will be retained and can be restored by enabling Global Security Governance.
                </>
              ) : (
                <>
                  Are you sure you want to enable Global Security Governance?<br /><br />
                  All approved configured Zero-Trust policies will be reactivated and enforced across all active company and branch scopes.
                </>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mandatory Authorization Reason & Change Reference *
              </label>
              <input
                type="text"
                value={masterReason}
                onChange={(e) => setMasterReason(e.target.value)}
                placeholder="e.g., CHG-2026-9901: Enterprise security baseline toggle..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowMasterConfirm(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmMasterToggle}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Applying...' : 'Confirm & Execute'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!optionalLevelEnabled && (scopeLevel === 'PAGE' || scopeLevel === 'USER') && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
          <strong>Optional Scope Currently Disabled:</strong> Changes saved here are stored cleanly, but runtime evaluation skips this level and uses the effective Module policy until you enable the <em>{scopeLevel === 'PAGE' ? 'Page / Screen' : 'Individual User'}</em> toggle above.
        </div>
      )}

      {isSelfUserPolicy && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-center gap-2 font-semibold">
          <Lock className="w-4 h-4 text-rose-600 shrink-0" />
          <span>
            Zero-Trust Anti-Self-Tamper Rule: You cannot modify your own Individual User security policy ({currentUser.fullName}). Another administrator must manage this record.
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wide text-slate-500">
              {scopeLevel} POLICY • REF: {scopeRefId}
            </div>
            <h4 className="font-bold text-slate-900 text-sm">{scopeLabel}</h4>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono font-bold text-slate-700 tabular-nums">
              v{existingPolicy?.version || 0} {existingPolicy ? 'Active' : '(Inheriting Parent)'}
            </span>
            {scopeVersions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCompare((v) => !v)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold flex items-center gap-1 cursor-pointer"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Compare Versions ({scopeVersions.length})</span>
              </button>
            )}
            {allowDeleteOptional && existingPolicy && (scopeLevel === 'PAGE' || scopeLevel === 'USER') && (
              <button
                type="button"
                disabled={saving || isSelfUserPolicy}
                onClick={handleRemoveOptional}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Optional Config</span>
              </button>
            )}
          </div>
        </div>

        {notice && (
          <div
            className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
              notice.type === 'ok'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border border-rose-200 text-rose-900'
            }`}
          >
            {notice.type === 'err' && <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{notice.text}</span>
          </div>
        )}

        {/* 12 Security Controls Matrix */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="py-2.5 px-3">Security Control</th>
                <th className="py-2.5 px-3 w-48">Configured State</th>
                <th className="py-2.5 px-3">Governance Rationale / Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ALL_SECURITY_CONTROL_KEYS.map((key) => {
                const meta = SECURITY_CONTROL_METADATA[key];
                const rule = controls[key] || { state: 'INHERIT' };
                return (
                  <tr key={key} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{meta.label}</div>
                      <div className="text-[11px] text-slate-500">{meta.description}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        aria-label={`${meta.label} state`}
                        disabled={isSelfUserPolicy}
                        value={rule.state}
                        onChange={(e) =>
                          setControls((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], state: e.target.value as PolicyControlState },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-xs"
                      >
                        {CONTROL_STATE_OPTIONS.filter((opt) =>
                          scopeLevel === 'GLOBAL' ? opt !== 'INHERIT' : true
                        ).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        disabled={isSelfUserPolicy}
                        value={rule.rationale || ''}
                        onChange={(e) =>
                          setControls((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], rationale: e.target.value },
                          }))
                        }
                        placeholder="Optional policy rationale..."
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Key Watermark & Webcam Parameter Overrides for Scope */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2.5">
            <div className="font-bold text-slate-900">Watermark Parameters ({scopeLevel})</div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Classification</label>
                <select
                  disabled={isSelfUserPolicy}
                  value={watermarkParams.confidentialityClassification}
                  onChange={(e) =>
                    setWatermarkParams({
                      ...watermarkParams,
                      confidentialityClassification: e.target.value as any,
                    })
                  }
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="INTERNAL">INTERNAL</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                  <option value="RESTRICTED">RESTRICTED</option>
                  <option value="HIGHLY_CONFIDENTIAL">HIGHLY_CONFIDENTIAL</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Position</label>
                <select
                  disabled={isSelfUserPolicy}
                  value={watermarkParams.position}
                  onChange={(e) =>
                    setWatermarkParams({ ...watermarkParams, position: e.target.value as any })
                  }
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="TILED">TILED</option>
                  <option value="CENTER">CENTER</option>
                  <option value="TOP_RIGHT">TOP_RIGHT</option>
                  <option value="BOTTOM_RIGHT">BOTTOM_RIGHT</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Opacity</label>
                <input
                  type="number"
                  step={0.02}
                  min={0.05}
                  max={0.45}
                  disabled={isSelfUserPolicy}
                  value={watermarkParams.opacity}
                  onChange={(e) =>
                    setWatermarkParams({
                      ...watermarkParams,
                      opacity: Math.min(0.45, Math.max(0.05, Number(e.target.value) || 0.14)),
                    })
                  }
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pattern</label>
                <select
                  disabled={isSelfUserPolicy}
                  value={watermarkParams.pattern}
                  onChange={(e) =>
                    setWatermarkParams({ ...watermarkParams, pattern: e.target.value as any })
                  }
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="DIAGONAL_GRID">DIAGONAL_GRID</option>
                  <option value="CROSS_HATCH">CROSS_HATCH</option>
                  <option value="HORIZON_BANDS">HORIZON_BANDS</option>
                  <option value="CORNER_STAMP">CORNER_STAMP</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2.5">
            <div className="font-bold text-slate-900">Webcam AI Thresholds ({scopeLevel})</div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Confidence Threshold</label>
                <input
                  type="number"
                  step={0.05}
                  min={0.35}
                  max={0.95}
                  disabled={isSelfUserPolicy}
                  value={webcamParams.confidenceThreshold}
                  onChange={(e) =>
                    setWebcamParams({
                      ...webcamParams,
                      confidenceThreshold: Math.min(0.95, Math.max(0.35, Number(e.target.value) || 0.62)),
                    })
                  }
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Persistence Frames</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  disabled={isSelfUserPolicy}
                  value={webcamParams.persistenceFrames}
                  onChange={(e) =>
                    setWebcamParams({
                      ...webcamParams,
                      persistenceFrames: Math.max(1, Number(e.target.value) || 3),
                    })
                  }
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sampling FPS</label>
                <input
                  type="number"
                  step={0.1}
                  min={0.2}
                  max={2}
                  disabled={isSelfUserPolicy}
                  value={webcamParams.fps}
                  onChange={(e) =>
                    setWebcamParams({
                      ...webcamParams,
                      fps: Math.min(2, Math.max(0.2, Number(e.target.value) || 0.5)),
                    })
                  }
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Denial Policy</label>
                <select
                  disabled={isSelfUserPolicy}
                  value={webcamParams.blockProtectedScreensOnDenial ? 'BLOCK' : 'WARN'}
                  onChange={(e) =>
                    setWebcamParams({
                      ...webcamParams,
                      blockProtectedScreensOnDenial: e.target.value === 'BLOCK',
                    })
                  }
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="WARN">Log & Warn Only</option>
                  <option value="BLOCK">Block Protected Screens</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-200">
          <input
            type="text"
            disabled={isSelfUserPolicy}
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            placeholder="Mandatory audit change reason (e.g. Q4 compliance hardening)..."
            className="flex-1 min-w-[240px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
          />
          <button
            type="button"
            disabled={saving || isSelfUserPolicy}
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{saving ? 'Publishing...' : `Publish ${scopeLevel} Policy`}</span>
          </button>
        </div>

        {/* Policy Version History & Comparison Diff */}
        {showCompare && scopeVersions.length > 0 && (
          <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 text-xs">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <History className="w-4 h-4 text-indigo-600" />
              <span>Version History & Control Diff ({scopeVersions.length} snapshot(s))</span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {scopeVersions.map((ver) => {
                const diffs = ALL_SECURITY_CONTROL_KEYS.filter(
                  (k) =>
                    ver.previousControls &&
                    ver.previousControls[k]?.state !== ver.newControls[k]?.state
                );
                return (
                  <div key={ver.id} className="bg-white border border-slate-200 rounded-lg p-2.5">
                    <div className="flex items-center justify-between font-semibold text-slate-900">
                      <span className="font-mono">v{ver.version} • {ver.changedByName}</span>
                      <span className="text-[11px] text-slate-500">{ver.changedAt}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">Reason: {ver.changeReason}</div>
                    {diffs.length > 0 ? (
                      <div className="mt-1.5 text-[11px] font-mono text-indigo-800 space-y-0.5">
                        {diffs.map((dk) => (
                          <div key={dk}>
                            {dk}: {ver.previousControls?.[dk]?.state} → {ver.newControls[dk]?.state}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1 text-[11px] text-slate-500">
                        Parameter or initial baseline snapshot
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
