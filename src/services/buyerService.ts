import { BuyerAssignmentRecord } from '../types/buyerAssignment';

const STORAGE_KEY_BUYER_ASSIGNMENTS = 'cip_buyer_assignments_v1';

// Initial Seed Data (matching the structure in BuyerManagementView)
const INITIAL_BUYER_ASSIGNMENTS: BuyerAssignmentRecord[] = [
  {
    id: 'byr-001',
    itemCategory: 'RM',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    branchName: 'Pondicherry Main Plant & HQ',
    branchCode: 'POND-01',
    buyerUserId: 'usr-buyer-01',
    buyerName: 'Vikram Singh (Senior Procurement Officer)',
    buyerEmail: 'vikram.singh@kosh.com',
    activePrCount: 6,
    totalPrValue: 4500000,
    oldestPendingPrDays: 4,
    status: 'ACTIVE',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Procurement Manager',
  },
  {
    id: 'byr-002',
    itemCategory: 'MA',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    branchName: 'Pondicherry Main Plant & HQ',
    branchCode: 'POND-01',
    buyerUserId: 'usr-buyer-02',
    buyerName: 'Ananya Roy (Maintenance Buyer)',
    buyerEmail: 'ananya.roy@kosh.com',
    activePrCount: 3,
    totalPrValue: 1200000,
    oldestPendingPrDays: 1,
    status: 'ACTIVE',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Procurement Manager',
  },
  {
    id: 'byr-003',
    itemCategory: 'CO',
    companyId: 'co-kosh-02',
    branchId: 'br-chen-02',
    branchName: 'Chennai Hub & Electronics Facility',
    branchCode: 'CHEN-02',
    buyerUserId: 'usr-buyer-03',
    buyerName: 'Suresh Kumar (IT Sourcing Buyer)',
    buyerEmail: 'suresh.kumar@kosh.com',
    activePrCount: 8,
    totalPrValue: 7800000,
    oldestPendingPrDays: 9,
    status: 'ON_LEAVE',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Procurement Manager',
  },
];

export const BuyerService = {
  getAssignments(): BuyerAssignmentRecord[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_BUYER_ASSIGNMENTS);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY_BUYER_ASSIGNMENTS, JSON.stringify(INITIAL_BUYER_ASSIGNMENTS));
        return INITIAL_BUYER_ASSIGNMENTS;
      }
      return JSON.parse(stored);
    } catch {
      return INITIAL_BUYER_ASSIGNMENTS;
    }
  },

  getDefaultBuyer(companyId: string, branchId: string, categoryCode: string): BuyerAssignmentRecord | undefined {
    const assignments = this.getAssignments();
    return assignments.find(a => 
      a.companyId === companyId && 
      a.branchId === branchId && 
      a.itemCategory === categoryCode &&
      a.status === 'ACTIVE'
    );
  },

  getEligibleBuyers(companyId: string, branchId: string, categoryCode: string): BuyerAssignmentRecord[] {
    const assignments = this.getAssignments();
    return assignments.filter(a => 
      a.companyId === companyId && 
      a.branchId === branchId && 
      a.itemCategory === categoryCode
    );
  },

  saveAssignment(assignment: BuyerAssignmentRecord): void {
    const assignments = this.getAssignments();
    const idx = assignments.findIndex(a => a.id === assignment.id);
    if (idx >= 0) {
      assignments[idx] = assignment;
    } else {
      assignments.push(assignment);
    }
    localStorage.setItem(STORAGE_KEY_BUYER_ASSIGNMENTS, JSON.stringify(assignments));
  }
};
