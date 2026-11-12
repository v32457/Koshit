/**
 * KOSH INNOVATIONS — RFQ POLICY CONFIGURATION SERVICE
 * Controls Company and Branch level RFQ Enablement / Disability rules.
 * Governs whether approved RFQ Awards or Purchase Price Books are used as purchasing price sources.
 */

import { RfqPolicyConfig, RfqPolicyMode } from '../types/rfqSourcing';
import { INITIAL_COMPANIES, INITIAL_BRANCHES } from '../data/seedData';

const STORAGE_KEY_RFQ_POLICIES = 'kosh_rfq_policy_configs_v1';

export const INITIAL_RFQ_POLICIES: RfqPolicyConfig[] = [
  {
    id: 'pol-co-01',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'ALL',
    branchCode: 'ALL',
    branchName: 'All Branches (Company Default)',
    policyMode: 'RFQ_ENABLED',
    isInheritedFromCompany: false,
    allowBranchOverride: true,
    minSupplierInvitations: 3,
    maxSupplierInvitations: 10,
    defaultQuotationValidityDays: 30,
    evaluationType: 'TWO_STAGE',
    sealedCommercialQuotations: true,
    updatedAt: '2026-11-01T08:00:00Z',
    updatedBy: 'Platform Admin',
    remarks: 'Default company policy requiring RFQ for all purchases.',
  },
  {
    id: 'pol-co-02',
    companyId: 'co-kosh-02',
    companyCode: 'KOSH-SOUTH',
    branchId: 'ALL',
    branchCode: 'ALL',
    branchName: 'All Branches (Company Default)',
    policyMode: 'RFQ_ENABLED',
    isInheritedFromCompany: false,
    allowBranchOverride: true,
    minSupplierInvitations: 3,
    maxSupplierInvitations: 8,
    defaultQuotationValidityDays: 30,
    evaluationType: 'SINGLE_STAGE',
    sealedCommercialQuotations: false,
    updatedAt: '2026-11-01T08:00:00Z',
    updatedBy: 'Platform Admin',
  },
  {
    id: 'pol-br-005',
    companyId: 'co-kosh-04',
    companyCode: 'KOSH-NORTH',
    branchId: 'br-ddun-05',
    branchCode: 'DDN',
    branchName: 'Dehradun Northern Plant',
    policyMode: 'RFQ_DISABLED',
    isInheritedFromCompany: false,
    allowBranchOverride: false,
    minSupplierInvitations: 0,
    maxSupplierInvitations: 0,
    defaultQuotationValidityDays: 30,
    evaluationType: 'SINGLE_STAGE',
    sealedCommercialQuotations: false,
    updatedAt: '2026-11-02T10:00:00Z',
    updatedBy: 'Platform Admin',
    remarks: 'Branch operates exclusively via Approved Purchase Price Book contracts.',
  },
];

let memoryCache: RfqPolicyConfig[] | null = null;

export const rfqPolicyService = {
  getPolicies(): RfqPolicyConfig[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_RFQ_POLICIES);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (err) {
        console.error('Error reading RFQ policies from storage:', err);
      }
    }
    return memoryCache ? [...memoryCache] : [...INITIAL_RFQ_POLICIES];
  },

  savePolicies(policies: RfqPolicyConfig[]) {
    memoryCache = [...policies];
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_RFQ_POLICIES, JSON.stringify(policies));
      } catch (err) {
        console.error('Error saving RFQ policies:', err);
      }
    }
  },

  hasBranchOverride(companyId: string, branchId?: string): boolean {
    if (!branchId || branchId === 'ALL') return false;
    const policies = this.getPolicies();
    return policies.some(p => p.companyId === companyId && p.branchId === branchId && !p.isInheritedFromCompany);
  },

  getEffectivePolicy(companyId: string, branchId?: string): RfqPolicyConfig {
    const policies = this.getPolicies();
    
    // Check for specific branch policy
    if (branchId && branchId !== 'ALL') {
      const branchPolicy = policies.find(p => p.companyId === companyId && p.branchId === branchId);
      if (branchPolicy && !branchPolicy.isInheritedFromCompany) {
        return branchPolicy;
      }
    }

    // Fall back to company default policy
    const companyPolicy = policies.find(p => p.companyId === companyId && (p.branchId === 'ALL' || !p.branchId));
    if (companyPolicy) {
      if (branchId && branchId !== 'ALL') {
        return {
          ...companyPolicy,
          branchId,
          isInheritedFromCompany: true,
        };
      }
      return companyPolicy;
    }

    // Return default enabled policy
    return {
      id: `pol-default-${Date.now()}`,
      companyId,
      companyCode: 'KOSH',
      branchId: branchId || 'ALL',
      branchCode: 'DEFAULT',
      branchName: 'Default Operating Context',
      policyMode: 'RFQ_ENABLED',
      isInheritedFromCompany: true,
      allowBranchOverride: true,
      minSupplierInvitations: 3,
      maxSupplierInvitations: 10,
      defaultQuotationValidityDays: 30,
      evaluationType: 'TWO_STAGE',
      sealedCommercialQuotations: true,
      updatedAt: new Date().toISOString(),
      updatedBy: 'System',
    };
  },

  isRfqEnabled(companyId: string, branchId?: string): boolean {
    const policy = this.getEffectivePolicy(companyId, branchId);
    return policy.policyMode === 'RFQ_ENABLED' || policy.policyMode === 'RFQ_OPTIONAL';
  },

  isRfqMandatory(companyId: string, branchId?: string): boolean {
    const policy = this.getEffectivePolicy(companyId, branchId);
    return policy.policyMode === 'RFQ_ENABLED';
  },

  isPriceBookMandatory(companyId: string, branchId?: string): boolean {
    const policy = this.getEffectivePolicy(companyId, branchId);
    return policy.policyMode === 'RFQ_DISABLED';
  },

  updatePolicy(updated: RfqPolicyConfig): RfqPolicyConfig {
    const policies = this.getPolicies();
    const branchId = updated.branchId || 'ALL';
    const normalized = { ...updated, branchId };

    const existingIndex = policies.findIndex(
      p => p.id === normalized.id || (p.companyId === normalized.companyId && (p.branchId || 'ALL') === branchId)
    );
    let result: RfqPolicyConfig[];
    if (existingIndex >= 0) {
      policies[existingIndex] = {
        ...policies[existingIndex],
        ...normalized,
        updatedAt: new Date().toISOString(),
      };
      result = policies;
    } else {
      result = [{ ...normalized, updatedAt: new Date().toISOString() }, ...policies];
    }
    this.savePolicies(result);
    return normalized;
  },

  revertBranchToInheritance(companyId: string, branchId: string): RfqPolicyConfig {
    const policies = this.getPolicies();
    const filtered = policies.filter(p => !(p.companyId === companyId && p.branchId === branchId));
    this.savePolicies(filtered);
    return this.getEffectivePolicy(companyId, branchId);
  },
};

