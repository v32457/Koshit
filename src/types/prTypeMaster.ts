/**
 * CIPPLATFORM — PR TYPE MASTER & ELIGIBILITY MAPPING DOMAIN TYPES
 * Supports genuine PR Type Master records (preserving MANUAL, MRP, REPAIR, MAINTENANCE
 * and adding CAPEX_ASSET) plus versioned Company -> Branch -> Purchase Org -> Item Category -> PR Type
 * applicability mappings with Maker-Checker approval and effective-date governance.
 */

import { PRType } from './purchaseRequisition';

export type PRTypeMasterStatus = 'ACTIVE' | 'INACTIVE';

export type PRTypeApprovalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface PRTypeMasterRecord {
  id: string;
  code: PRType | string;
  name: string;
  description: string;
  isSystemType: boolean;
  isCapexType: boolean;
  isExpenseType?: boolean;
  applicableMechanism?: 'INVENTORY' | 'EXPENSE';
  requiresAssetClassification: boolean;
  requiresBudgetExceptionFlow: boolean;
  allowedRoles: string[]; // Empty array = governed by PR Governance / RBAC; non-empty = explicit role list
  status: PRTypeMasterStatus;
  approvalStatus: PRTypeApprovalStatus;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveUntil?: string; // Optional YYYY-MM-DD
  versionNumber: number;
  createdAt: string;
  createdBy: string;
  createdByUserId?: string;
  updatedAt: string;
  updatedBy: string;
  updatedByUserId?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvedByUserId?: string;
  rejectionReason?: string;
}

export interface PRTypeApplicabilityMappingRecord {
  id: string;
  companyId: string; // 'ALL' or canonical companyId (e.g. 'co-kosh-01')
  companyCode: string;
  companyName: string;
  branchId: string; // 'ALL' or canonical branchId (e.g. 'br-pond-01')
  branchCode: string;
  branchName: string;
  purchaseOrgId: string; // 'ALL' or PurchaseOrganization.id (e.g. 'po-kosh-01')
  purchaseOrgCode: string;
  purchaseOrgName: string;
  itemCategoryCode: string; // 'ALL' or Item Category code (e.g. 'CP', 'MO', 'RM')
  itemCategoryName: string;
  prTypeCode: PRType | string;
  isEligible: boolean; // true = ALLOW, false = explicit DENY override
  effectiveFrom: string; // YYYY-MM-DD
  effectiveUntil?: string;
  status: PRTypeMasterStatus;
  approvalStatus: PRTypeApprovalStatus;
  versionNumber: number;
  remarks?: string;
  createdAt: string;
  createdBy: string;
  createdByUserId?: string;
  updatedAt: string;
  updatedBy: string;
  updatedByUserId?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvedByUserId?: string;
  rejectionReason?: string;
}

export interface PRTypeMasterVersionHistoryEntry {
  id: string;
  entityType: 'PR_TYPE_MASTER' | 'PR_TYPE_MAPPING';
  entityId: string;
  entityCodeOrLabel: string;
  versionNumber: number;
  action:
    | 'CREATED'
    | 'UPDATED'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'ACTIVATED'
    | 'DEACTIVATED';
  actorId: string;
  actorName: string;
  timestamp: string;
  changeSummary: string;
  previousSnapshot?: any;
  newSnapshot: any;
}

export interface PRTypeEligibilityEvaluationResult {
  eligible: boolean;
  reason: string;
  prTypeCode: string;
  prTypeRecord?: PRTypeMasterRecord;
  matchedMapping?: PRTypeApplicabilityMappingRecord;
  specificityScore?: number;
}

export interface ExpenseCategoryRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  expenseCode: string;
  defaultTaxCode: string;
  defaultGstRatePercent: number;
  requiresQuantityUom: boolean;
  defaultUom?: string;
  status: PRTypeMasterStatus;
  approvalStatus: PRTypeApprovalStatus;
  effectiveFrom: string;
  effectiveUntil?: string;
  versionNumber: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface CompanyBranchExpenseCategoryMapping {
  id: string;
  companyId: string;
  companyCode: string;
  branchId: string;
  branchCode: string;
  prTypeCode: PRType | string;
  expenseCategoryCode: string;
  expenseCategoryName: string;
  isEligible: boolean;
  effectiveFrom: string;
  effectiveUntil?: string;
  status: PRTypeMasterStatus;
  approvalStatus: PRTypeApprovalStatus;
  versionNumber: number;
  remarks?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface SapExpenseAccountMapping {
  id: string;
  companyId: string;
  companyCode: string;
  branchId: string;
  expenseCategoryCode: string;
  sapExpenseCode: string;
  sapServiceAccountCode: string;
  sapAccountName: string;
  sapTaxCode: string;
  gstRatePercent: number;
  costCenterRequired: boolean;
  effectiveFrom: string;
  effectiveUntil?: string;
  status: PRTypeMasterStatus;
  approvalStatus: PRTypeApprovalStatus;
  versionNumber: number;
  updatedAt: string;
  updatedBy: string;
}

export interface ExpenseCategoryOptionResolved {
  category: ExpenseCategoryRecord;
  mapping: CompanyBranchExpenseCategoryMapping;
  sapAccountMapping?: SapExpenseAccountMapping;
  categoryCode: string;
  categoryName: string;
  description?: string;
  defaultTaxCode: string;
  defaultTaxPercent: number;
  sapGlAccountCode: string;
  sapGlAccountName: string;
  sapExpenseCode?: string;
  sapCostCenterCode?: string;
}

export interface ExpensePrReadinessResult {
  ready: boolean;
  blockingReasons: string[];
  activeMappingsCount: number;
  activeCategoryMappingsCount: number;
  activeSapGlMappingsCount: number;
  eligibleCategoriesCount: number;
  sapAccountMappingsCount: number;
  missingSapMappings: string[];
  approvalConfigured: boolean;
}
