/**
 * CIPPLATFORM - PHASE 1 PURCHASE REQUEST (PR) DOMAIN TYPES
 */

export type PRType = 'MRP' | 'MANUAL' | 'REPAIR' | 'MAINTENANCE';

export type PRPriority = 'NORMAL' | 'URGENT' | 'CRITICAL';

export type PRStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_MANAGER_APPROVAL'
  | 'PENDING_SUBSEQUENT_APPROVAL'
  | 'PENDING_REAPPROVAL'
  | 'APPROVED_PENDING_BUYER'
  | 'PENDING_BUYER_CONFIGURATION'
  | 'REJECTED'
  | 'RETURNED_FOR_CORRECTION'
  | 'RESUBMITTED'
  | 'CANCELLED'
  | 'ARCHIVED'
  | 'COMPLETED';

export interface PRDeliverySchedule {
  id: string;
  lineId: string;
  deliveryDate: string;
  quantity: number;
}

export interface PurchaseRequisitionLine {
  id: string;
  prId: string;
  itemCode: string;
  description: string;
  itemCategory: string;
  inventoryUom: string; // Authoritative UOM locked to Item Master
  requestedQuantity: number;
  approximateUnitPrice: number;
  currency: string;
  estimatedTotalValue: number;
  specifications?: string;
  purchasePurpose?: string;
  businessJustification?: string;
  remarks?: string;
  defaultWarehouse?: string;
  deliverySchedules: PRDeliverySchedule[];
  lineAttachments?: Array<{
    id: string;
    fileName: string;
    fileSize: string;
    fileType: string;
    uploadedAt: string;
    url?: string;
  }>;
  assignedBuyer?: string;
  buyerStatus?: 'PENDING_BUYER_ACTION' | 'PENDING_CONFIGURATION' | 'ACKNOWLEDGED';
  status: 'ACTIVE' | 'ARCHIVED' | 'CANCELLED' | 'REJECTED';
  approvedQuantity?: number;
  rejectedQuantity?: number;
  receivedQuantity?: number;
}

export interface PRChangeHistory {
  id: string;
  prId: string;
  changedBy: string;
  changedByName: string;
  timestamp: string;
  reason: string;
  fieldDeltas: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  status: 'PENDING_REAPPROVAL' | 'APPROVED' | 'REJECTED';
}

export interface PurchaseRequisitionHeader {
  id: string;
  prNumber: string; // e.g. PR-2026-0001
  prType: PRType;
  companyId: string;
  companyCode: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  department: string;
  costCentre: string;
  requesterId: string;
  requesterName: string;
  creatorId: string;
  creatorName: string;
  priority: PRPriority;
  status: PRStatus;
  purchasePurpose: string;
  businessJustification: string;
  deliveryLocation: string;
  estimatedTotalValue: number;
  currency: string;
  budgetValidationStatus: 'NOT_VALIDATED' | 'SUFFICIENT' | 'INSUFFICIENT' | 'MISSING_ASSIGNMENT' | 'EXCEPTION_APPROVED';
  budgetSourceRef?: string;
  erpStockStatus: 'FRESH' | 'STALE' | 'UNAVAILABLE' | 'CHECKED';
  erpStockTimestamp?: string;
  equipmentId?: string; // Optional for Repair and Maintenance
  breakdownRef?: string; // Optional for Repair
  maintenanceScheduleRef?: string; // Optional for Maintenance
  mrpRunRef?: string; // Optional for MRP
  lines: PurchaseRequisitionLine[];
  changeHistory: PRChangeHistory[];
  attachments: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    uploadedAt: string;
    uploadedBy: string;
  }>;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
}

export interface PRApplicabilityConfig {
  id: string;
  companyId: string;
  branchId: string; // 'ALL' or specific branch
  groupId: string; // 'ALL' or specific group
  prType: PRType | 'ALL';
  isEnabled: boolean;
  allowedAssetCategories?: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface PRCleanupConfig {
  isEnabled: boolean;
  ageThresholdDays: number; // e.g. 45 days
  calculationBasis: 'LINE_CREATION' | 'PR_CREATION' | 'LAST_SUBMISSION' | 'LAST_ACTIVITY';
  eligibleStatuses: PRStatus[];
  exemptUrgentCritical: boolean;
  executionMode: 'PREVIEW' | 'MANUAL_BULK' | 'SCHEDULED';
  advanceWarningDays: number;
}

export interface BranchPRCleanupPolicy {
  branchId: string;
  branchCode: string;
  branchName: string;
  ageThresholdDays: number; // e.g. 45 days
  advanceWarningDays: number; // e.g. 5 days before threshold for message initiation
  isEnabled: boolean;
  notifyRequesters: boolean;
  notifyApprovers: boolean;
  notifyBuyers: boolean;
  channels: Array<'IN_PORTAL' | 'EMAIL' | 'WHATSAPP'>;
  updatedAt: string;
  updatedBy: string;
}

export interface PRArchiveLog {
  id: string;
  prId: string;
  lineId?: string;
  prNumber: string;
  itemCode: string;
  archivedAt: string;
  archivedBy: string;
  reason: string;
  ageInDays: number;
  originalStatus: PRStatus;
  restoredAt?: string;
  restoredBy?: string;
}
