/**
 * KOSH INNOVATIONS — APPROVED BROWSER GOVERNANCE ENGINE
 * Detects browser family, version, secure context, and required runtime capabilities.
 * Technical honesty: User-Agent and Client Hints can be spoofed by users; managed-browser
 * cryptographic/policy attestation requires Edge/Chrome Enterprise policies & MDM.
 */

import type {
  BrowserComplianceEvaluation,
  BrowserGovernanceConfig,
} from '../types/zeroTrustSecurity';

export interface BrowserEnvironmentProbe {
  userAgent: string;
  isSecureContext: boolean;
  brands?: Array<{ brand: string; version: string }>;
  capabilities?: Partial<BrowserComplianceEvaluation['capabilities']>;
}

export function detectBrowserEnvironment(probe?: BrowserEnvironmentProbe): {
  browserFamily: BrowserComplianceEvaluation['browserFamily'];
  browserDisplayName: string;
  browserVersion: string;
  majorVersion: number | null;
  isSecureContext: boolean;
  managedBrowserSignal: BrowserComplianceEvaluation['managedBrowserSignal'];
  capabilities: BrowserComplianceEvaluation['capabilities'];
} {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const win = typeof window !== 'undefined' ? window : undefined;

  const ua = probe?.userAgent ?? nav?.userAgent ?? '';
  const uaDataBrands = probe?.brands ?? (nav as any)?.userAgentData?.brands;
  const isSecureContext =
    probe?.isSecureContext ??
    (win
      ? Boolean(
          win.isSecureContext ||
            win.location?.hostname === 'localhost' ||
            win.location?.hostname === '127.0.0.1'
        )
      : true);

  let browserFamily: BrowserComplianceEvaluation['browserFamily'] = 'UNKNOWN_OR_OTHER';
  let browserDisplayName = 'Unknown Browser';
  let browserVersion = '0.0';
  let majorVersion: number | null = null;

  // Order matters: Edge UA contains Chrome & Safari; Chrome UA contains Safari
  const edgeMatch = ua.match(/Edg(?:A|iOS)?\/(\d+(?:\.\d+)*)/i);
  const oprMatch = ua.match(/(?:OPR|Opera)\/(\d+(?:\.\d+)*)/i);
  const firefoxMatch = ua.match(/Firefox\/(\d+(?:\.\d+)*)/i);
  const chromeMatch = ua.match(/(?:Chrome|CriOS)\/(\d+(?:\.\d+)*)/i);
  const safariMatch = ua.match(/Version\/(\d+(?:\.\d+)*).*Safari\//i);

  if (edgeMatch) {
    browserFamily = 'MICROSOFT_EDGE';
    browserDisplayName = 'Microsoft Edge';
    browserVersion = edgeMatch[1];
    majorVersion = parseInt(edgeMatch[1].split('.')[0], 10);
  } else if (oprMatch) {
    browserFamily = 'UNKNOWN_OR_OTHER';
    browserDisplayName = 'Opera (Unsupported)';
    browserVersion = oprMatch[1];
    majorVersion = parseInt(oprMatch[1].split('.')[0], 10);
  } else if (chromeMatch) {
    browserFamily = 'GOOGLE_CHROME';
    browserDisplayName = 'Google Chrome';
    browserVersion = chromeMatch[1];
    majorVersion = parseInt(chromeMatch[1].split('.')[0], 10);
  } else if (firefoxMatch) {
    browserFamily = 'FIREFOX';
    browserDisplayName = 'Mozilla Firefox';
    browserVersion = firefoxMatch[1];
    majorVersion = parseInt(firefoxMatch[1].split('.')[0], 10);
  } else if (safariMatch) {
    browserFamily = 'SAFARI';
    browserDisplayName = 'Apple Safari';
    browserVersion = safariMatch[1];
    majorVersion = parseInt(safariMatch[1].split('.')[0], 10);
  }

  const capabilities: BrowserComplianceEvaluation['capabilities'] = {
    canvas2d:
      probe?.capabilities?.canvas2d ??
      (typeof document !== 'undefined'
        ? Boolean(document.createElement('canvas')?.getContext?.('2d'))
        : true),
    mediaDevices:
      probe?.capabilities?.mediaDevices ??
      Boolean(nav?.mediaDevices && typeof nav.mediaDevices.getUserMedia === 'function'),
    clipboardApi: probe?.capabilities?.clipboardApi ?? Boolean(nav?.clipboard),
    visibilityApi:
      probe?.capabilities?.visibilityApi ??
      (typeof document !== 'undefined' ? 'visibilityState' in document : true),
    webGl:
      probe?.capabilities?.webGl ??
      (typeof document !== 'undefined'
        ? Boolean(
            document.createElement('canvas')?.getContext?.('webgl2') ||
              document.createElement('canvas')?.getContext?.('webgl')
          )
        : false),
    webGpu: probe?.capabilities?.webGpu ?? Boolean((nav as any)?.gpu),
    webAssembly: probe?.capabilities?.webAssembly ?? typeof WebAssembly !== 'undefined',
  };

  return {
    browserFamily,
    browserDisplayName,
    browserVersion,
    majorVersion: Number.isFinite(majorVersion as number) ? majorVersion : null,
    isSecureContext,
    managedBrowserSignal:
      Array.isArray(uaDataBrands) && uaDataBrands.length > 0
        ? 'CLIENT_HINTS_PRESENT'
        : 'ENTERPRISE_POLICY_NOT_DETECTABLE_VIA_UA',
    capabilities,
  };
}

export function evaluateBrowserCompliance(
  config: BrowserGovernanceConfig,
  enforcementActive: boolean,
  probe?: BrowserEnvironmentProbe
): BrowserComplianceEvaluation {
  const detected = detectBrowserEnvironment(probe);
  const reasons: string[] = [];

  const isApprovedFamily =
    detected.browserFamily === 'MICROSOFT_EDGE' || detected.browserFamily === 'GOOGLE_CHROME'
      ? config.approvedFamilies.includes(detected.browserFamily)
      : false;

  if (!isApprovedFamily) {
    reasons.push(
      `Browser "${detected.browserDisplayName}" is not in approved enterprise browsers (${config.approvedFamilies.join(', ')}).`
    );
  }

  let meetsMinimumVersion = true;
  if (isApprovedFamily && detected.majorVersion !== null) {
    const minReq =
      detected.browserFamily === 'MICROSOFT_EDGE'
        ? config.minimumVersions.MICROSOFT_EDGE
        : config.minimumVersions.GOOGLE_CHROME;
    if (detected.majorVersion < minReq) {
      meetsMinimumVersion = false;
      reasons.push(
        `${detected.browserDisplayName} v${detected.majorVersion} is below minimum compliant version v${minReq}.`
      );
    }
  } else if (isApprovedFamily && detected.majorVersion === null) {
    meetsMinimumVersion = false;
    reasons.push('Unable to determine browser version.');
  }

  if (config.requireSecureContext && !detected.isSecureContext) {
    reasons.push('Insecure context detected (HTTPS or localhost required for Zero-Trust protection).');
  }

  if (!detected.capabilities.visibilityApi || !detected.capabilities.canvas2d) {
    reasons.push('Required browser security capabilities (Visibility API / Canvas 2D) are missing.');
  }

  const compliant = !enforcementActive || reasons.length === 0;
  const decision: BrowserComplianceEvaluation['decision'] = compliant
    ? 'ALLOW'
    : config.blockUnsupportedBrowsers
    ? config.allowedAccessDecision
    : 'WARN_ONLY';

  return {
    evaluatedAt: new Date().toISOString(),
    browserFamily: detected.browserFamily,
    browserDisplayName: detected.browserDisplayName,
    browserVersion: detected.browserVersion,
    majorVersion: detected.majorVersion,
    isApprovedFamily,
    meetsMinimumVersion,
    isSecureContext: detected.isSecureContext,
    capabilities: detected.capabilities,
    managedBrowserSignal: detected.managedBrowserSignal,
    compliant,
    decision,
    reasons,
    technicalLimitationNote:
      'Browser User-Agent/Client-Hints detection provides application-level compliance checks only; User-Agent can be spoofed, and managed-browser enforcement requires Microsoft Edge / Chrome Enterprise MDM policies.',
  };
}
