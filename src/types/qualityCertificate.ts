/**
 * KOSH INNOVATIONS — QUALITY CERTIFICATE TYPES
 */

export interface QualityCertificateType {
  id: string;
  code: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface CertificateRequirement {
  id: string;
  certificateTypeId: string;
  mandatory: boolean;
  validityRequired: boolean;
  applicableScope: 'COMPANY' | 'BRANCH' | 'CATEGORY' | 'ITEM';
  scopeId: string; // ID of company, branch, category, or item
  status: 'ACTIVE' | 'INACTIVE';
}

export const INITIAL_CERTIFICATE_TYPES: QualityCertificateType[] = [
  { id: 'cert-coa', code: 'COA', name: 'Certificate of Analysis (CoA)', description: 'Analytical test results', status: 'ACTIVE' },
  { id: 'cert-coc', code: 'COC', name: 'Certificate of Conformity (CoC)', description: 'Conformity statement', status: 'ACTIVE' },
  { id: 'cert-mtc', code: 'MTC', name: 'Material Test Certificate (MTC)', description: 'Material composition report', status: 'ACTIVE' },
  { id: 'cert-rohs', code: 'ROHS', name: 'RoHS Certificate', description: 'Restriction of Hazardous Substances', status: 'ACTIVE' },
  { id: 'cert-reach', code: 'REACH', name: 'REACH Compliance Certificate', description: 'Chemical compliance', status: 'ACTIVE' },
  { id: 'cert-iso', code: 'ISO', name: 'ISO Certificate', description: 'Quality management system certification', status: 'ACTIVE' },
  { id: 'cert-cal', code: 'CAL', name: 'Calibration Certificate', description: 'Measurement equipment calibration', status: 'ACTIVE' },
  { id: 'cert-sds', code: 'SDS', name: 'Safety Data Sheet (SDS / MSDS)', description: 'Chemical safety data', status: 'ACTIVE' },
];
