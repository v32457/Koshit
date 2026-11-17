/**
 * KOSH INNOVATIONS — ZERO-TRUST WORKSPACE RUNTIME WRAPPER
 * Enforces active Effective Security Policy across protected KOSH screens:
 * 1. Resolves route -> moduleKey / pageKey context
 * 2. Evaluates Browser Governance & syncs session heartbeat with Express /api/security/*
 * 3. Renders Dynamic Forensic Watermark Overlay
 * 4. Monitors visibilitychange, window blur, focus, pagehide, clipboard, context-menu & print shortcuts
 * 5. Coordinates frontend blackout & backend session suspension / re-auth / admin override
 * 6. Hosts optional privacy-first Local Webcam AI Detection widget when enabled by policy
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Shield, AlertTriangle, ShieldAlert, Eye } from 'lucide-react';
import type { Branch, Company, ModuleRegistryItem, User } from '../../types';
import type {
  BrowserComplianceEvaluation,
  EffectiveSecurityPolicy,
  SessionProtectionState,
} from '../../types/zeroTrustSecurity';
import { evaluateBrowserCompliance } from '../../services/browserGovernanceService';
import {
  getOrCreateClientSessionId,
  zeroTrustSecurityService,
} from '../../services/zeroTrustSecurityService';
import { ForensicWatermarkOverlay } from './ForensicWatermarkOverlay';
import { SecurityBlackoutOverlay } from './SecurityBlackoutOverlay';
import { WebcamSecurityMonitorWidget } from './WebcamSecurityMonitorWidget';

interface ZeroTrustWorkspaceRuntimeProps {
  currentUser: User;
  activeCompany: Company;
  activeBranch: Branch;
  users: User[];
  companies: Company[];
  branches: Branch[];
  moduleRegistry: ModuleRegistryItem[];
  currentRoute: string;
  onLogout: () => void;
  children: React.ReactNode;
}

export function resolveModuleAndPageFromRoute(route: string): {
  moduleKey: string;
  pageKey: string;
} {
  if (route.startsWith('/purchasing/requisitions')) {
    return { moduleKey: 'PURCHASE_REQUISITION', pageKey: 'pr_master_list' };
  }
  if (route.startsWith('/procurement')) {
    return { moduleKey: 'RFQ_SOURCING', pageKey: route.replace(/\//g, '_').replace(/^_/, '') || 'rfq_dashboard' };
  }
  if (route.startsWith('/items')) {
    return { moduleKey: 'ITEM_MASTER', pageKey: route === '/items/new' ? 'item_create' : 'item_master_list' };
  }
  if (route.startsWith('/business-partners')) {
    return { moduleKey: 'BUSINESS_PARTNER_MASTER', pageKey: 'bp_master_list' };
  }
  if (route.startsWith('/settings/security') || route.startsWith('/settings/general/security')) {
    return { moduleKey: 'SECURITY_GOVERNANCE', pageKey: 'security_governance_center' };
  }
  if (route.startsWith('/settings')) {
    return { moduleKey: 'SYSTEM_GOVERNANCE', pageKey: route.replace(/\//g, '_').replace(/^_/, '') };
  }
  return { moduleKey: 'CORE_WORKSPACE', pageKey: route.replace(/\//g, '_').replace(/^_/, '') || 'dashboard' };
}

export const ZeroTrustWorkspaceRuntime: React.FC<ZeroTrustWorkspaceRuntimeProps> = ({
  currentUser,
  activeCompany,
  activeBranch,
  users,
  companies,
  branches,
  moduleRegistry,
  currentRoute,
  onLogout,
  children,
}) => {
  const [sessionId] = useState<string>(() => getOrCreateClientSessionId());
  const [effectivePolicy, setEffectivePolicy] = useState<EffectiveSecurityPolicy | null>(null);
  const [sessionState, setSessionState] = useState<SessionProtectionState | null>(null);
  const [browserEval, setBrowserEval] = useState<BrowserComplianceEvaluation | null>(null);
  const [isBlurredByFocus, setIsBlurredByFocus] = useState(false);
  const [localLockReason, setLocalLockReason] = useState<string | null>(null);
  const [securityBannerNotice, setSecurityBannerNotice] = useState<string | null>(null);
  const [cameraDenialBlocked, setCameraDenialBlocked] = useState<string | null>(null);
  const catalogSyncedRef = useRef(false);

  const { moduleKey, pageKey } = useMemo(
    () => resolveModuleAndPageFromRoute(currentRoute),
    [currentRoute]
  );

  // Sync master catalog once + whenever companies/branches/users update
  useEffect(() => {
    void zeroTrustSecurityService
      .syncCatalog({ users, companies, branches, modules: moduleRegistry })
      .then(() => {
        catalogSyncedRef.current = true;
      })
      .catch(() => {
        // Backend unreachable fallback handled gracefully below
      });
  }, [users, companies, branches, moduleRegistry]);

  // Evaluate policy & browser compliance whenever user/company/branch/route changes
  const refreshSecurityPosture = useCallback(async () => {
    try {
      const policy = await zeroTrustSecurityService.evaluateEffectivePolicy({
        actorUserId: currentUser.id,
        companyId: activeCompany.id,
        branchId: activeBranch.id,
        moduleKey,
        pageKey,
        sessionId,
      });
      setEffectivePolicy(policy);

      const bEval = evaluateBrowserCompliance(
        policy.effectiveParameters.browserGovernance,
        policy.controls.browserRestriction.effectiveValue
      );
      setBrowserEval(bEval);

      const hb = await zeroTrustSecurityService.sendSessionHeartbeat({
        sessionId,
        userId: currentUser.id,
        companyId: activeCompany.id,
        branchId: activeBranch.id,
        moduleKey,
        pageKey,
        browserFamily: bEval.browserFamily,
        browserVersion: bEval.browserVersion,
        browserCompliant: bEval.compliant,
        secureContext: bEval.isSecureContext,
      });
      setSessionState(hb.session);
      setEffectivePolicy(hb.effectivePolicy);

      if (!bEval.compliant) {
        await zeroTrustSecurityService.recordBrowserEvaluation(currentUser, sessionId, {
          ...bEval,
          companyId: activeCompany.id,
          branchId: activeBranch.id,
          moduleKey,
          sessionId,
        });
      }
    } catch (err) {
      console.warn('Zero-Trust posture sync failed:', err);
    }
  }, [currentUser, activeCompany.id, activeBranch.id, moduleKey, pageKey, sessionId]);

  useEffect(() => {
    void refreshSecurityPosture();
    const poll = setInterval(() => {
      void refreshSecurityPosture();
    }, 30_000);
    const onPolicyUpdated = () => {
      void refreshSecurityPosture();
    };
    window.addEventListener('kosh:zt-policy-updated', onPolicyUpdated);
    return () => {
      clearInterval(poll);
      window.removeEventListener('kosh:zt-policy-updated', onPolicyUpdated);
    };
  }, [refreshSecurityPosture]);

  // Listen to visibilitychange, blur, focus, pagehide
  useEffect(() => {
    if (!effectivePolicy) return;
    const focusActive = effectivePolicy.controls.focusProtection.effectiveValue;
    const visualCfg = effectivePolicy.effectiveParameters.visual;

    const handleVisibility = () => {
      if (!focusActive || !visualCfg.monitorVisibilityChange) return;
      if (document.visibilityState === 'hidden') {
        if (visualCfg.blurOnFocusLoss) setIsBlurredByFocus(true);
        if (visualCfg.lockScreenOnVisibilityHide) {
          setLocalLockReason('Protected workspace locked when tab visibility became hidden.');
        }
        void zeroTrustSecurityService
          .recordEvent(currentUser, sessionId, {
            eventType: 'FOCUS_VISIBILITY_EVENT',
            severity: visualCfg.lockScreenOnVisibilityHide ? 'MEDIUM' : 'LOW',
            companyId: activeCompany.id,
            branchId: activeBranch.id,
            moduleKey,
            pageKey,
            sessionId,
            detectionSource: 'VISUAL_PROTECTION',
            actionTaken: visualCfg.lockScreenOnVisibilityHide ? 'LOCK_SCREEN' : 'BLUR_APPLIED',
            summary: `Document visibility changed to hidden on ${moduleKey}/${pageKey}.`,
          })
          .catch(() => {});
      } else {
        setIsBlurredByFocus(false);
      }
    };

    const handleBlur = () => {
      if (!focusActive || !visualCfg.monitorWindowBlur) return;
      if (visualCfg.blurOnFocusLoss) setIsBlurredByFocus(true);
    };

    const handleFocus = () => {
      setIsBlurredByFocus(false);
    };

    const handlePageHide = () => {
      if (!focusActive || !visualCfg.monitorPageHide) return;
      if (visualCfg.blurOnFocusLoss) setIsBlurredByFocus(true);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [effectivePolicy, currentUser, activeCompany.id, activeBranch.id, moduleKey, pageKey, sessionId]);

  // Clipboard, context menu, and print shortcut deterrence
  useEffect(() => {
    if (!effectivePolicy) return;
    const clipControl = effectivePolicy.controls.clipboardControl.effectiveValue;
    const exportControl = effectivePolicy.controls.exportRestrictions.effectiveValue;
    const clipCfg = effectivePolicy.effectiveParameters.clipboard;

    const recordViolation = (
      eventType: 'CLIPBOARD_VIOLATION' | 'PRINT_SHORTCUT_BLOCKED' | 'CONTEXT_MENU_BLOCKED',
      summary: string
    ) => {
      setSecurityBannerNotice(summary);
      setTimeout(() => setSecurityBannerNotice(null), 5000);
      void zeroTrustSecurityService
        .recordEvent(currentUser, sessionId, {
          eventType,
          severity: 'MEDIUM',
          companyId: activeCompany.id,
          branchId: activeBranch.id,
          moduleKey,
          pageKey,
          sessionId,
          detectionSource: 'CLIPBOARD_ENGINE',
          actionTaken: 'ACTION_BLOCKED_BY_POLICY',
          summary,
        })
        .catch(() => {});
    };

    const isEditableField = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (target.closest('[data-sensitive-field="true"]')) return false; // Always protect explicitly marked sensitive fields
      return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
    };

    const onCopy = (e: ClipboardEvent) => {
      if (!clipControl) return;
      // Do not break editing ordinary non-sensitive inputs unless configured
      const sensitive = e.target instanceof HTMLElement && Boolean(e.target.closest('[data-sensitive-field="true"]'));
      if ((clipCfg.blockCopy && !isEditableField(e.target)) || (clipCfg.blockSensitiveFieldCopy && sensitive)) {
        e.preventDefault();
        recordViolation('CLIPBOARD_VIOLATION', 'Copy blocked by active Zero-Trust Clipboard Protection policy.');
      }
    };

    const onCut = (e: ClipboardEvent) => {
      if (!clipControl || !clipCfg.blockCut) return;
      if (!isEditableField(e.target)) {
        e.preventDefault();
        recordViolation('CLIPBOARD_VIOLATION', 'Cut blocked by active Zero-Trust Clipboard Protection policy.');
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      if (!clipControl || !clipCfg.blockPaste) return;
      e.preventDefault();
      recordViolation('CLIPBOARD_VIOLATION', 'Paste blocked by active Zero-Trust Clipboard Protection policy.');
    };

    const onContextMenu = (e: MouseEvent) => {
      if (!clipControl || !clipCfg.blockContextMenu) return;
      if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return; // Allow normal spellcheck/edit inside plain inputs
      }
      e.preventDefault();
      recordViolation('CONTEXT_MENU_BLOCKED', 'Context menu restricted on protected workspace content.');
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if ((exportControl || clipControl) && clipCfg.blockPrintShortcut && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        recordViolation('PRINT_SHORTCUT_BLOCKED', 'Browser print shortcut (Ctrl/Cmd+P) restricted by Zero-Trust policy.');
      }
    };

    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [effectivePolicy, currentUser, activeCompany.id, activeBranch.id, moduleKey, pageKey, sessionId]);

  const watermarkEnabled = Boolean(effectivePolicy?.controls.watermark.effectiveValue);
  const webcamEnabled = Boolean(effectivePolicy?.controls.webcamMonitoring.effectiveValue);
  const selectionDisabled = Boolean(
    effectivePolicy?.controls.clipboardControl.effectiveValue &&
      effectivePolicy.effectiveParameters.clipboard.blockTextSelection
  );
  const showBanner = Boolean(
    effectivePolicy?.controls.focusProtection.effectiveValue &&
      effectivePolicy.effectiveParameters.visual.showConfidentialityBanner
  );
  const blurActive = Boolean(
    (isBlurredByFocus || cameraDenialBlocked) &&
      effectivePolicy?.controls.focusProtection.effectiveValue
  );

  return (
    <div
      data-zt-runtime="active"
      data-zt-policy-version={effectivePolicy?.policyVersion || 1}
      data-zt-watermark-active={watermarkEnabled ? 'true' : 'false'}
      data-zt-browser-compliant={browserEval?.compliant !== false ? 'true' : 'false'}
      data-zt-blackout-active={sessionState?.blackoutActive ? 'true' : 'false'}
      className={`relative flex-1 flex flex-col min-w-0 ${selectionDisabled ? 'select-none' : ''}`}
    >
      {/* Dynamic Confidentiality & Zero-Trust Deterrence Header Strip */}
      {showBanner && (
        <div className="bg-[#0B192C] text-slate-200 border-b border-slate-800 px-3 sm:px-5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-bold text-white">
              {effectivePolicy?.effectiveParameters.watermark.confidentialityClassification || 'CONFIDENTIAL'}
            </span>
            <span className="text-slate-400">
              • Policy v{effectivePolicy?.policyVersion || 1} ({moduleKey}) •{' '}
              {effectivePolicy?.optionalScopes.pageLevelEnabled ? 'Page Opt: ON' : 'Page Opt: OFF'} /{' '}
              {effectivePolicy?.optionalScopes.userLevelEnabled ? 'User Opt: ON' : 'User Opt: OFF'}
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-slate-300 tabular-nums">
            <span>
              Browser: {browserEval?.browserDisplayName || 'Checking...'}{' '}
              {browserEval?.compliant ? '(Approved)' : '(Non-Compliant)'}
            </span>
            <span>Ref: {sessionState?.watermarkSessionRef || sessionId.slice(-8).toUpperCase()}</span>
          </div>
        </div>
      )}

      {/* Unsupported Browser Warning Banner when decision is WARN_ONLY or RESTRICT_SENSITIVE */}
      {browserEval && !browserEval.compliant && browserEval.decision !== 'BLACKOUT_BLOCK' && (
        <div
          data-testid="unsupported-browser-banner"
          className="bg-amber-50 border-b border-amber-300 text-amber-950 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Browser Governance Notice:</strong> {browserEval.reasons.join(' ')} Approved enterprise browsers: Microsoft Edge or Google Chrome.
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold text-amber-900">
            Decision: {browserEval.decision}
          </span>
        </div>
      )}

      {/* Live Clipboard / Print / Camera Security Violation Toast */}
      {securityBannerNotice && (
        <div
          data-testid="security-violation-banner"
          className="bg-rose-50 border-b border-rose-300 text-rose-900 px-4 py-2 text-xs font-semibold flex items-center gap-2"
        >
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{securityBannerNotice}</span>
        </div>
      )}

      {/* Privacy-First Webcam Local AI Widget when enabled by Policy */}
      {webcamEnabled && effectivePolicy && (
        <div className="px-3 sm:px-5 pt-2">
          <WebcamSecurityMonitorWidget
            enabled={webcamEnabled}
            config={effectivePolicy.effectiveParameters.webcamAi}
            onEscalatedDetection={async (outcome) => {
              const summary = `Local AI CV detected persistent [${outcome.detectedTargets
                .map((d) => `${d.className} ${Math.round(d.score * 100)}%`)
                .join(', ')}] across ${outcome.persistenceCount} frame(s).`;
              setSecurityBannerNotice(summary);
              await zeroTrustSecurityService.recordEvent(currentUser, sessionId, {
                eventType: 'SUSPICIOUS_VISUAL_DETECTION',
                severity: outcome.riskSeverity,
                companyId: activeCompany.id,
                branchId: activeBranch.id,
                moduleKey,
                pageKey,
                sessionId,
                detectionSource: 'WEBCAM_AI_ENGINE',
                actionTaken: effectivePolicy.effectiveParameters.webcamAi.actionOnPersistentDetection,
                summary,
                metadata: {
                  inferenceMs: outcome.inferenceMs,
                  persistenceCount: outcome.persistenceCount,
                },
              });
              if (
                effectivePolicy.effectiveParameters.webcamAi.actionOnPersistentDetection === 'LOCK_SCREEN' ||
                effectivePolicy.effectiveParameters.webcamAi.actionOnPersistentDetection === 'SUSPEND_API'
              ) {
                const res = await zeroTrustSecurityService.triggerBlackout(currentUser, sessionId, {
                  reason: summary,
                  severity: outcome.riskSeverity,
                  action:
                    effectivePolicy.effectiveParameters.webcamAi.actionOnPersistentDetection === 'SUSPEND_API'
                      ? 'SUSPENDED'
                      : 'BLACKOUT_LOCKED',
                  durationSeconds: effectivePolicy.effectiveParameters.blackout.durationSeconds,
                  createIncident: true,
                });
                setSessionState(res.session);
              }
            }}
            onPermissionDenied={async (reason) => {
              await zeroTrustSecurityService.recordEvent(currentUser, sessionId, {
                eventType: 'WEBCAM_PERMISSION_DENIED',
                severity: effectivePolicy.effectiveParameters.webcamAi.blockProtectedScreensOnDenial ? 'HIGH' : 'MEDIUM',
                companyId: activeCompany.id,
                branchId: activeBranch.id,
                moduleKey,
                pageKey,
                sessionId,
                detectionSource: 'WEBCAM_AI_ENGINE',
                actionTaken: effectivePolicy.effectiveParameters.webcamAi.blockProtectedScreensOnDenial
                  ? 'BLOCK_PROTECTED_SCREENS'
                  : 'LOG_AND_WARN',
                summary: `Webcam permission denied/unavailable: ${reason}`,
              });
              if (effectivePolicy.effectiveParameters.webcamAi.blockProtectedScreensOnDenial) {
                setCameraDenialBlocked(reason);
                setLocalLockReason(`Camera monitoring is mandatory under active policy: ${reason}`);
              } else {
                setSecurityBannerNotice(`Camera monitoring notice: ${reason}`);
              }
            }}
            onModelFailure={async (reason) => {
              await zeroTrustSecurityService.recordEvent(currentUser, sessionId, {
                eventType: 'AI_MODEL_LOAD_FAILURE',
                severity: 'HIGH',
                companyId: activeCompany.id,
                branchId: activeBranch.id,
                moduleKey,
                pageKey,
                sessionId,
                detectionSource: 'WEBCAM_AI_ENGINE',
                actionTaken: 'FALLBACK_WARN',
                summary: `Local AI inference runtime error: ${reason}`,
              });
              setSecurityBannerNotice(`Local AI CV runtime notice: ${reason}`);
            }}
          />
        </div>
      )}

      {/* Protected Application Content (with configurable Focus-Loss Blur) */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-150"
        style={
          blurActive
            ? { filter: `blur(${effectivePolicy?.effectiveParameters.visual.blurIntensityPx || 8}px)` }
            : undefined
        }
      >
        {children}
      </div>

      {/* Focus-Loss Subtle Notice */}
      {isBlurredByFocus && !localLockReason && !sessionState?.blackoutActive && (
        <div
          data-testid="focus-loss-blur-banner"
          className="fixed bottom-4 right-4 z-[60] bg-[#0B192C] text-white px-4 py-2.5 rounded-lg border border-slate-700 shadow-lg text-xs flex items-center gap-2"
        >
          <Eye className="w-4 h-4 text-amber-400" />
          <span>Protected view blurred while window focus is inactive.</span>
        </div>
      )}

      {/* Dynamic Forensic Watermark Overlay */}
      {effectivePolicy && (
        <ForensicWatermarkOverlay
          enabled={watermarkEnabled}
          config={effectivePolicy.effectiveParameters.watermark}
          user={currentUser}
          company={activeCompany}
          branch={activeBranch}
          sessionRef={sessionState?.watermarkSessionRef || sessionId.slice(-8).toUpperCase()}
          screenRoute={currentRoute}
          visualDeterrencePattern={effectivePolicy.effectiveParameters.visual.visualDeterrencePattern}
        />
      )}

      {/* Security Blackout & Re-Auth Overlay */}
      <SecurityBlackoutOverlay
        session={sessionState}
        currentUser={currentUser}
        allowReauthRecovery={effectivePolicy?.effectiveParameters.blackout.allowReauthRecovery ?? true}
        allowAdminOverride={effectivePolicy?.effectiveParameters.blackout.allowAdminOverride ?? true}
        localLockReason={localLockReason}
        onUnlockLocalLock={() => {
          setLocalLockReason(null);
          setCameraDenialBlocked(null);
        }}
        onReauthenticate={async (reason, code) => {
          const updated = await zeroTrustSecurityService.reauthenticateSession(
            currentUser,
            sessionId,
            reason,
            code
          );
          setSessionState(updated);
          setLocalLockReason(null);
          setCameraDenialBlocked(null);
        }}
        onAdminOverride={async (reason) => {
          const updated = await zeroTrustSecurityService.adminOverrideBlackout(
            currentUser,
            sessionId,
            sessionId,
            reason
          );
          setSessionState(updated);
          setLocalLockReason(null);
          setCameraDenialBlocked(null);
        }}
        onLogout={onLogout}
      />
    </div>
  );
};
