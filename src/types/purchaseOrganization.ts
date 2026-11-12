export type PurchasingModel = 'CENTRALIZED' | 'DECENTRALIZED' | 'HYBRID';

export type AssignmentRole =
  | 'PRIMARY_BUYER'
  | 'SECONDARY_BUYER'
  | 'PRIMARY_MANAGER'
  | 'SECONDARY_MANAGER';

export interface TemporaryDelegation {
  id: string;
  originalUserId: string;
  originalUserName: string;
  replacementUserId: string;
  replacementUserName: string;
  replacementEmployeeId?: string;
  replacementDesignation?: string;
  replacementEmail?: string;
  delegationValidFrom: string; // YYYY-MM-DD
  delegationValidTo: string;   // YYYY-MM-DD
  reason: string;
  authorizedBy: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  createdAt: string;
}

export interface EffectiveRoleAssignment {
  id: string;
  purchaseOrganizationId: string;
  companyId: string;
  role: AssignmentRole;
  userId: string;
  userName: string;
  employeeId?: string;
  designation?: string;
  department?: string;
  email?: string;
  validFrom: string; // YYYY-MM-DD
  validTo?: string;   // YYYY-MM-DD (optional, open-ended if empty)
  status: 'ACTIVE' | 'INACTIVE' | 'SUPERSEDED';
  delegation?: TemporaryDelegation;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface AssignmentHistoryRecord {
  id: string;
  companyId: string;
  companyName?: string;
  purchaseOrganizationId: string;
  purchaseOrganizationCode?: string;
  purchaseOrganizationName?: string;
  branchId?: string;
  branchName?: string;
  itemCategory?: string;
  materialCode?: string;
  role: AssignmentRole;
  previousUserId?: string;
  previousUserName?: string;
  newUserId: string;
  newUserName: string;
  validFrom: string;
  validTo?: string;
  changedBy: string;
  changedTimestamp: string;
  changeReason: string;
  actionType: 'CREATED' | 'SCHEDULED' | 'DEACTIVATED' | 'DELEGATED' | 'REVOKED_DELEGATION' | 'MODIFIED';
}

export interface PurchaseOrganization {
  id: string;
  companyId: string;
  code: string;
  name: string;
  model: PurchasingModel;
  parentPoId?: string;
  description?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: 'ACTIVE' | 'INACTIVE';

  // Buyer Mappings (Active Current Snapshot)
  primaryBuyerId?: string;
  primaryBuyerName?: string;
  secondaryBuyerId?: string;
  secondaryBuyerName?: string;

  // Purchasing Manager Mappings (Active Current Snapshot)
  primaryManagerId?: string;
  primaryManagerName?: string;
  secondaryManagerId?: string;
  secondaryManagerName?: string;

  // Effective-Dated Schedules for each role
  assignments?: EffectiveRoleAssignment[];

  createdAt: string;
  updatedAt: string;
}

export interface BuyerManagerAssignmentRule {
  id: string;
  companyId: string;
  branchId?: string; // Optional: ALL if missing
  itemCategoryId?: string; // Optional: ALL if missing
  materialId?: string; // Optional: ALL if missing
  purchaseOrganizationId?: string; // Optional: Scoping restriction
  primaryBuyerId: string;
  secondaryBuyerId?: string;
  backupBuyerId?: string;
  primaryManagerId: string;
  alternateManagerId?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  priority: number;
  status: 'ACTIVE' | 'INACTIVE';
  remarks?: string;
}
