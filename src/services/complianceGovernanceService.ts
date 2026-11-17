/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CIPPlatform — STATUTORY COMPLIANCE & VERIFICATION GOVERNANCE SERVICE
 * 
 * Centralized governance engine controlling GST and MSME/Udyam verification policies.
 * When Enabled: Strict live online verification (API / CAPTCHA / Govt Registry) is enforced.
 * When Disabled: Users type GSTIN and MSME numbers directly, upload supporting certificates,
 * and records enter the manual compliance validation workflow.
 */

import {
  ComplianceGovernanceSettings,
  ComplianceDocumentAttachment,
  ManualComplianceValidation,
} from '../types';

export const COMPLIANCE_SETTINGS_STORAGE_KEY = 'kosh_compliance_governance_settings';
export const COMPLIANCE_SETTINGS_EVENT = 'cip-compliance-settings-updated';

export const DEFAULT_COMPLIANCE_SETTINGS: ComplianceGovernanceSettings = {
  gstValidationEnabled: true,
  gstRequireDocumentUpload: true,
  gstDefaultStatusOnUpload: 'PENDING_MANUAL_VALIDATION',
  gstAllowedFileTypes: ['.pdf', '.png', '.jpg', '.jpeg'],
  gstMaxFileSizeBytes: 5 * 1024 * 1024, // 5MB

  msmeValidationEnabled: true,
  msmeRequireDocumentUpload: true,
  msmeDefaultStatusOnUpload: 'PENDING_MANUAL_VALIDATION',
  msmeAllowedFileTypes: ['.pdf', '.png', '.jpg', '.jpeg'],
  msmeMaxFileSizeBytes: 5 * 1024 * 1024, // 5MB

  updatedAt: new Date().toISOString(),
  updatedBy: 'System Governance Administrator',
  remarks: 'Initial statutory compliance governance policies',
};

class ComplianceGovernanceService {
  private cache: ComplianceGovernanceSettings | null = null;

  public getComplianceSettings(): ComplianceGovernanceSettings {
    if (this.cache) return this.cache;

    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(COMPLIANCE_SETTINGS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.cache = {
            ...DEFAULT_COMPLIANCE_SETTINGS,
            ...parsed,
          };
          return this.cache!;
        }
      }
    } catch (err) {
      console.warn('Failed to load compliance governance settings from localStorage:', err);
    }

    this.cache = { ...DEFAULT_COMPLIANCE_SETTINGS };
    return this.cache;
  }

  public saveComplianceSettings(
    updates: Partial<ComplianceGovernanceSettings>,
    actorName: string = 'Platform Administrator'
  ): ComplianceGovernanceSettings {
    const current = this.getComplianceSettings();
    const updated: ComplianceGovernanceSettings = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: actorName,
    };

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(COMPLIANCE_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Failed to persist compliance governance settings:', err);
    }

    this.cache = updated;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(COMPLIANCE_SETTINGS_EVENT, { detail: updated })
      );
    }

    return updated;
  }

  public resetComplianceSettings(
    actorName: string = 'Platform Administrator'
  ): ComplianceGovernanceSettings {
    return this.saveComplianceSettings(
      {
        ...DEFAULT_COMPLIANCE_SETTINGS,
        updatedAt: new Date().toISOString(),
        updatedBy: actorName,
        remarks: 'Reset to factory statutory compliance settings',
      },
      actorName
    );
  }

  public isGstValidationEnabled(): boolean {
    return this.getComplianceSettings().gstValidationEnabled;
  }

  public isMsmeValidationEnabled(): boolean {
    return this.getComplianceSettings().msmeValidationEnabled;
  }

  public validateGstinFormat(gstin: string): { valid: boolean; error?: string } {
    if (!gstin || !gstin.trim()) {
      return { valid: false, error: 'GSTIN cannot be empty.' };
    }
    const clean = gstin.trim().toUpperCase();
    if (clean.length !== 15) {
      return { valid: false, error: 'GSTIN must be exactly 15 characters long.' };
    }
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(clean)) {
      return { valid: false, error: 'Invalid GSTIN format (Expected: 2 state digits + 10 PAN chars + 1 entity + Z + 1 checksum).' };
    }
    return { valid: true };
  }

  public validateUdyamFormat(udyam: string): { valid: boolean; error?: string } {
    if (!udyam || !udyam.trim()) {
      return { valid: false, error: 'Udyam Registration Number cannot be empty.' };
    }
    const clean = udyam.trim().toUpperCase();
    const udyamRegex = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;
    if (!udyamRegex.test(clean)) {
      return {
        valid: false,
        error: 'Invalid Udyam Registration format (Expected: UDYAM-XX-00-0000000).',
      };
    }
    return { valid: true };
  }

  public formatFileSize(bytes?: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  public createDocumentAttachment(
    fileName: string,
    fileSizeBytes: number,
    fileType: string,
    uploadedBy: string,
    documentType?: 'GST_CERTIFICATE' | 'MSME_CERTIFICATE' | 'OTHER',
    notes?: string,
    fileDataUrl?: string
  ): ComplianceDocumentAttachment {
    return {
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      fileName,
      fileSizeBytes,
      fileType,
      documentType,
      uploadedAt: new Date().toISOString(),
      uploadedBy,
      notes,
      fileDataUrl,
    };
  }

  public createManualValidationRecord(
    status: 'PENDING_MANUAL_VALIDATION' | 'MANUALLY_VERIFIED' | 'REJECTED',
    validatedBy: string,
    notes?: string,
    rejectionReason?: string
  ): ManualComplianceValidation {
    return {
      status,
      validatedBy: status !== 'PENDING_MANUAL_VALIDATION' ? validatedBy : undefined,
      validatedAt: status !== 'PENDING_MANUAL_VALIDATION' ? new Date().toISOString() : undefined,
      notes,
      rejectionReason,
    };
  }
}

export const complianceGovernanceService = new ComplianceGovernanceService();
