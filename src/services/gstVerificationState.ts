import type { BPGovernanceLog, BusinessPartner } from '../types';
import type { GstVerificationResult } from '../../shared/gst';
import { isValidGstin, normalizeGstin } from '../../shared/gstin';

/**
 * A stored verification is only trusted when it carries a complete provider
 * record whose GSTIN matches the taxpayer profile. This prevents manually
 * set or legacy "VERIFIED" flags from being treated as provider evidence.
 */
export function isStoredVerification(
  value: unknown,
): value is GstVerificationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const candidate = value as Record<string, unknown>;
  const profile = candidate.profile;

  if (
    typeof candidate.provider !== 'string' ||
    !candidate.provider.trim() ||
    typeof candidate.endpoint !== 'string' ||
    !candidate.endpoint.trim() ||
    typeof candidate.retrievedAt !== 'string' ||
    Number.isNaN(new Date(candidate.retrievedAt).getTime()) ||
    typeof candidate.gstin !== 'string' ||
    !isValidGstin(candidate.gstin) ||
    !profile ||
    typeof profile !== 'object'
  ) {
    return false;
  }

  const storedProfile = profile as Record<string, unknown>;

  return (
    typeof storedProfile.gstin === 'string' &&
    normalizeGstin(storedProfile.gstin) === normalizeGstin(candidate.gstin) &&
    typeof storedProfile.legalName === 'string' &&
    storedProfile.legalName.trim().length > 0 &&
    typeof storedProfile.status === 'string' &&
    storedProfile.status.trim().length > 0
  );
}

export function isFabricatedPortalLog(log: BPGovernanceLog): boolean {
  return /Govt GSTN Portal|Government GST|GSTN Portal Gateway/i.test(
    `${log.verifier} ${log.details} ${log.action}`,
  );
}

/**
 * Downgrades legacy "VERIFIED" records that have no provider evidence and
 * removes the fabricated government-portal governance logs created by the
 * previous simulated verification flow.
 */
export function normalizeStoredPartners(
  partners: BusinessPartner[],
): BusinessPartner[] {
  return partners.map((partner) => {
    const hasVerification = isStoredVerification(partner.gstVerification);
    const governanceLogs = (partner.governanceLogs ?? []).filter(
      (log) => !isFabricatedPortalLog(log),
    );

    if (partner.gstStatus === 'VERIFIED' && !hasVerification) {
      return {
        ...partner,
        gstStatus: 'UNVERIFIED',
        gstVerification: undefined,
        governanceLogs,
      };
    }

    return { ...partner, governanceLogs };
  });
}
