export interface BuyerAssignmentRecord {
  id: string;
  itemCategory: string;
  companyId: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  buyerUserId: string;
  buyerName: string;
  buyerEmail: string;
  activePrCount: number;
  totalPrValue: number;
  oldestPendingPrDays: number;
  status: 'ACTIVE' | 'ON_LEAVE' | 'REASSIGNED' | 'UNMAPPED';
  updatedAt: string;
  updatedBy: string;
}
