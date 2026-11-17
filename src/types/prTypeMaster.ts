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
