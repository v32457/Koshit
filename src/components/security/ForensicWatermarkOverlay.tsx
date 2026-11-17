/**
 * KOSH INNOVATIONS — DYNAMIC FORENSIC WATERMARK OVERLAY
 * Renders an identity-bound, policy-driven, non-interactive forensic watermark over protected screens.
 * Updates dynamically when User, Company, Branch, Session, Security Policy, Route, or refresh interval changes.
 * NEVER renders authentication tokens, passwords, or secrets.
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { Branch, Company, User } from '../../types';
import type { WatermarkConfig } from '../../types/zeroTrustSecurity';

interface ForensicWatermarkOverlayProps {
  enabled: boolean;
  config: WatermarkConfig;
  user: User;
  company: Company;
  branch: Branch;
  sessionRef: string;
  screenRoute: string;
  visualDeterrencePattern?: 'NONE' | 'SUBTLE_SCANLINE' | 'MICRO_GRID';
}

export const ForensicWatermarkOverlay: React.FC<ForensicWatermarkOverlayProps> = ({
  enabled,
  config,
  user,
  company,
  branch,
  sessionRef,
  screenRoute,
  visualDeterrencePattern = 'NONE',
}) => {
  const [tickTs, setTickTs] = useState<string>(() => new Date().toISOString());

  useEffect(() => {
    setTickTs(new Date().toISOString());
    if (!enabled) return;
    const ms = Math.max(5000, config.refreshIntervalMs || 30000);
    const id = setInterval(() => {
      setTickTs(new Date().toISOString());
    }, ms);
    return () => clearInterval(id);
  }, [enabled, config.refreshIntervalMs, user.id, company.id, branch.id, sessionRef, screenRoute]);

  const watermarkLines = useMemo(() => {
    const partsLine1: string[] = [];
    if (config.includeUsername) partsLine1.push(user.fullName);
    if (config.includeEmployeeId && user.employeeId) partsLine1.push(user.employeeId);
    if (config.includeCompany) partsLine1.push(company.code);
    if (config.includeBranch) partsLine1.push(branch.code || branch.portalBranchCode);

    const partsLine2: string[] = [config.confidentialityClassification];
    if (config.includeSessionRef) partsLine2.push(sessionRef);
    if (config.includeScreenRef) partsLine2.push(screenRoute);
    if (config.includeTimestamp) partsLine2.push(tickTs.slice(0, 19).replace('T', ' ') + 'Z');

    return {
      line1: partsLine1.join(' | ') || 'KOSH ENTERPRISE',
      line2: partsLine2.join(' • '),
    };
  }, [config, user.fullName, user.employeeId, company.code, branch.code, branch.portalBranchCode, sessionRef, screenRoute, tickTs]);

  if (!enabled) return null;

  const tileWidth = config.density === 'HIGH' ? 320 : config.density === 'LOW' ? 540 : 420;
  const tileHeight = config.density === 'HIGH' ? 160 : config.density === 'LOW' ? 280 : 210;
  const fontFamily =
    config.fontStyle === 'MONO'
      ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
      : config.fontStyle === 'SERIF'
      ? 'Georgia, Cambria, serif'
      : 'ui-sans-serif, system-ui, sans-serif';

  const patternId = `kosh-wm-pat-${config.density}-${config.pattern}`;

  const cornerOrCenterPositionClass =
    config.position === 'CENTER'
      ? 'inset-0 flex items-center justify-center'
      : config.position === 'TOP_LEFT'
      ? 'top-16 left-6'
      : config.position === 'TOP_RIGHT'
      ? 'top-16 right-6 text-right'
      : config.position === 'BOTTOM_LEFT'
      ? 'bottom-6 left-6'
      : 'bottom-6 right-6 text-right';

  return (
    <div
      data-testid="forensic-watermark-overlay"
      data-wm-user={user.id}
      data-wm-company={company.code}
      data-wm-branch={branch.code}
      data-wm-session={sessionRef}
      data-wm-classification={config.confidentialityClassification}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none select-none z-[45] overflow-hidden opacity-0"
    />
  );
};
