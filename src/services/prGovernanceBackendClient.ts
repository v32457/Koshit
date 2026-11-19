import { User } from '../types';
import { prGovernancePolicyService } from './prGovernancePolicyService';
import { prTypeMasterService } from './prTypeMasterService';
import { budgetControlService } from './budgetControlService';

export interface RemotePrGovernanceValidationResult {
  allowed: boolean;
  errors: string[];
  warnings: string[];
  effectivePolicySummary?: {
    policyId: string;
    policyVersion: string;
    resolutionSource: string;
    budgetValidationEnabled: boolean;
  };
  categoryValidation?: {
    valid: boolean;
    prTypeEligible: boolean;
    prTypeReason?: string;
    eligibleCategories: Array<{ code: string; name: string; display: string }>;
    invalidLines: Array<{
      lineIndex: number;
      lineId?: string;
      itemCode?: string;
      rawCategory: string;
      normalizedCategory: string;
      reason: string;
    }>;
  };
  workflowPlan?: {
    enabled: boolean;
    configuredLevels: number;
    requiredLevels: number;
    valuationReportingAmount: number;
    reportingCurrency: string;
  };
  budgetResult?: {
    enabled: boolean;
    status: string;
    proposedReportingAmount: number;
    availableBudget?: number;
    shortfall?: number;
  };
}

export const prGovernanceBackendClient = {
  async syncState(): Promise<void> {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return;
    try {
      await fetch('/api/pr-governance/sync-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policies: prGovernancePolicyService.getPolicies(),
          prTypes: prTypeMasterService.getPrTypes(),
          prTypeMappings: prTypeMasterService.getMappings(),
          budgetLedgers: budgetControlService.getLedgers(),
          budgetPolicies: budgetControlService.getPolicies(),
        }),
      });
    } catch {
      // Ignore network unavailability in offline / unit-test environments
    }
  },

  async validatePrRemote(params: {
    action: 'SAVE_DRAFT' | 'SUBMIT' | 'APPROVE';
    pr: {
      id?: string;
      prNumber?: string;
      companyId: string;
      branchId: string;
      purchaseOrgId?: string;
      prType: string;
      department?: string;
      costCentre?: string;
      currency?: string;
      estimatedTotalValue?: number;
      grandTotalWithCharges?: number;
      budgetValidationStatus?: string;
      approvalHistory?: Array<{ cycleNumber?: number; decision?: string }>;
      approvalCycleCount?: number;
      lines: Array<{
        id?: string;
        itemCode?: string;
        itemCategory?: string;
        chargeItems?: Array<{ chargeCode?: string; applicability?: string }>;
      }>;
      expenseLines?: Array<{
        id?: string;
        expenseCategoryCode?: string;
        expenseDescription?: string;
        costCentre?: string;
        serviceFromDate?: string;
        serviceToDate?: string;
        expectedServiceDate?: string;
        amount?: number;
        taxPercent?: number;
        sapGlAccountCode?: string;
        purchasePurpose?: string;
        businessJustification?: string;
      }>;
      chargeItems?: Array<{ chargeCode?: string; applicability?: string }>;
    };
    actorUser?: User;
    evaluationDate?: string;
  }): Promise<RemotePrGovernanceValidationResult | null> {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return null;
    try {
      await this.syncState();
      const res = await fetch('/api/pr-governance/validate-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: params.action,
          pr: params.pr,
          actorUser: params.actorUser
            ? { id: params.actorUser.id, role: params.actorUser.role }
            : undefined,
          evaluationDate: params.evaluationDate,
        }),
      });
      const json = await res.json().catch(() => null);
      if (json?.data) {
        return json.data as RemotePrGovernanceValidationResult;
      }
      if (!res.ok) {
        return {
          allowed: false,
          errors: [json?.error?.message || 'Backend PR governance validation failed.'],
          warnings: [],
        };
      }
    } catch {
      // Offline / non-HTTP fallback relies on local authoritative checks
    }
    return null;
  },
};
