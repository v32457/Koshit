/**
 * KOSH INNOVATIONS — AGING PARAMETER MASTER PERSISTENCE SERVICE
 */

import { AgingParameterConfig, AgingBucketRange } from '../types/agingParameter';

const STORAGE_KEY = 'kosh_aging_parameter_configs';

export const DEFAULT_AGING_BUCKETS: AgingBucketRange[] = [
  { bucketIndex: 0, bucketName: 'Current', label: 'Current', fromDays: 0, toDays: 0 },
  { bucketIndex: 1, bucketName: 'Bucket 1', label: '1–30 Days', fromDays: 1, toDays: 30 },
  { bucketIndex: 2, bucketName: 'Bucket 2', label: '31–60 Days', fromDays: 31, toDays: 60 },
  { bucketIndex: 3, bucketName: 'Bucket 3', label: '61–90 Days', fromDays: 61, toDays: 90 },
  { bucketIndex: 4, bucketName: 'Bucket 4', label: '91–120 Days', fromDays: 91, toDays: 120 },
  { bucketIndex: 5, bucketName: 'Bucket 5', label: '121–180 Days', fromDays: 121, toDays: 180 },
  { bucketIndex: 6, bucketName: 'Bucket 6', label: 'Above 180 Days', fromDays: 181, toDays: 999999 },
];

export const INITIAL_AGING_CONFIGS: AgingParameterConfig[] = [
  {
    id: 'age-cfg-001',
    code: 'AGE-STD-01',
    name: 'Standard Enterprise 180-Day Aging Parameter',
    description: 'Default 30-day bucket intervals for AP/AR outstanding, vendor payables and customer receipts.',
    companyId: 'co-kosh-01',
    branchId: 'ALL',
    agingBasis: 'DUE_DATE',
    buckets: DEFAULT_AGING_BUCKETS,
    status: 'ACTIVE',
    isDefault: true,
    applicableModules: [
      'AP_AGING',
      'AR_AGING',
      'VENDOR_OUTSTANDING',
      'CUSTOMER_OUTSTANDING',
      'INVOICE_PENDING_AGING',
      'PAYMENT_DUE_REPORTS',
    ],
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-11-05T10:00:00Z',
    updatedBy: 'Platform Admin',
  },
  {
    id: 'age-cfg-002',
    code: 'AGE-PROC-01',
    name: 'Procurement & Purchase Order Pending Aging',
    description: 'Document-date based tracking for unfulfilled POs and pending GRN deliveries across manufacturing plants.',
    companyId: 'co-kosh-01',
    branchId: 'ALL',
    agingBasis: 'DOCUMENT_DATE',
    buckets: [
      { bucketIndex: 0, bucketName: 'Current', label: 'Current', fromDays: 0, toDays: 0 },
      { bucketIndex: 1, bucketName: 'Bucket 1', label: '1–15 Days', fromDays: 1, toDays: 15 },
      { bucketIndex: 2, bucketName: 'Bucket 2', label: '16–30 Days', fromDays: 16, toDays: 30 },
      { bucketIndex: 3, bucketName: 'Bucket 3', label: '31–45 Days', fromDays: 31, toDays: 45 },
      { bucketIndex: 4, bucketName: 'Bucket 4', label: '46–60 Days', fromDays: 46, toDays: 60 },
      { bucketIndex: 5, bucketName: 'Bucket 5', label: '61–90 Days', fromDays: 61, toDays: 90 },
      { bucketIndex: 6, bucketName: 'Bucket 6', label: 'Above 90 Days', fromDays: 91, toDays: 999999 },
    ],
    status: 'ACTIVE',
    isDefault: false,
    applicableModules: ['PURCHASE_ORDER_AGING', 'GRN_PENDING_AGING'],
    createdAt: '2026-02-01T09:00:00Z',
    updatedAt: '2026-11-05T11:00:00Z',
    updatedBy: 'Procurement Admin',
  },
];

export class AgingParameterService {
  static getConfigs(): AgingParameterConfig[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Error reading aging parameter configs:', err);
    }
    this.saveConfigs(INITIAL_AGING_CONFIGS);
    return INITIAL_AGING_CONFIGS;
  }

  static saveConfigs(configs: AgingParameterConfig[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
    } catch (err) {
      console.error('Error saving aging parameter configs:', err);
    }
  }

  static saveOrUpdateConfig(config: AgingParameterConfig): { success: boolean; message: string; config?: AgingParameterConfig } {
    const configs = this.getConfigs();

    // Check unique code
    const existingWithCode = configs.find(
      (c) => c.code.toLowerCase() === config.code.toLowerCase() && c.id !== config.id
    );
    if (existingWithCode) {
      return { success: false, message: `Aging Parameter Code "${config.code}" is already in use.` };
    }

    // Validate bucket boundaries
    const validation = this.validateBuckets(config.buckets);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    // If marked as default for this scope, unset existing defaults for same company
    let updatedConfigs = [...configs];
    if (config.isDefault) {
      updatedConfigs = updatedConfigs.map((c) => {
        if (c.companyId === config.companyId && c.id !== config.id) {
          return { ...c, isDefault: false };
        }
        return c;
      });
    }

    const index = updatedConfigs.findIndex((c) => c.id === config.id);
    if (index >= 0) {
      updatedConfigs[index] = { ...config, updatedAt: new Date().toISOString() };
    } else {
      updatedConfigs.push({ ...config, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }

    this.saveConfigs(updatedConfigs);
    return { success: true, message: `Aging Parameter Configuration "${config.name}" saved successfully.`, config };
  }

  static deleteConfig(id: string): { success: boolean; message: string } {
    const configs = this.getConfigs();
    const target = configs.find((c) => c.id === id);
    if (!target) {
      return { success: false, message: 'Configuration not found.' };
    }
    if (target.isDefault) {
      return { success: false, message: 'Cannot delete the default aging parameter configuration for this company.' };
    }
    const updated = configs.filter((c) => c.id !== id);
    this.saveConfigs(updated);
    return { success: true, message: `Configuration "${target.name}" removed.` };
  }

  static toggleStatus(id: string): { success: boolean; message: string; newStatus?: 'ACTIVE' | 'INACTIVE' } {
    const configs = this.getConfigs();
    const target = configs.find((c) => c.id === id);
    if (!target) return { success: false, message: 'Configuration not found.' };

    const newStatus = target.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    target.status = newStatus;
    target.updatedAt = new Date().toISOString();

    this.saveConfigs(configs);
    return {
      success: true,
      message: `Configuration "${target.name}" is now ${newStatus}.`,
      newStatus,
    };
  }

  /**
   * Validates continuous, non-overlapping aging bucket ranges.
   */
  static validateBuckets(buckets: AgingBucketRange[]): { valid: boolean; message: string } {
    if (!buckets || buckets.length < 2) {
      return { valid: false, message: 'Aging configuration must have at least 2 buckets.' };
    }

    // Check Current (0 to 0)
    if (buckets[0].fromDays !== 0 || buckets[0].toDays !== 0) {
      return { valid: false, message: 'Bucket 0 (Current) must start at 0 days and end at 0 days.' };
    }

    // Check subsequent buckets continuity
    for (let i = 1; i < buckets.length; i++) {
      const current = buckets[i];
      const prev = buckets[i - 1];

      if (current.fromDays > current.toDays) {
        return {
          valid: false,
          message: `Bucket "${current.bucketName}" (${current.label}) invalid: "From Days" (${current.fromDays}) cannot be greater than "To Days" (${current.toDays}).`,
        };
      }

      if (current.fromDays !== prev.toDays + 1) {
        return {
          valid: false,
          message: `Gap or overlap detected between "${prev.bucketName}" (ends at ${prev.toDays}) and "${current.bucketName}" (starts at ${current.fromDays}). Expected "From Days" to be ${prev.toDays + 1}.`,
        };
      }
    }

    return { valid: true, message: 'All bucket boundaries are valid and continuous.' };
  }
}
