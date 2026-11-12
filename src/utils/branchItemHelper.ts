import { GlobalItem, Branch, BranchAvailabilitySetting } from '../types';

/**
 * Resiliently checks whether an item is active and available in a given branch.
 * Supports matching by branch.id, branch.code (e.g. 'PDY', 'SAN', 'POND-01'),
 * or branch.portalBranchCode (e.g. '001', '002').
 * Prevents mismatches between Global Item Master, Branch Availability, and Branch-Created Items.
 */
export function isItemAvailableInBranch(item: GlobalItem, branch: Branch | null | undefined): boolean {
  if (!item || !branch || !Array.isArray(item.branchAvailability)) {
    return false;
  }

  const branchId = (branch.id || '').toLowerCase().trim();
  const branchCode = (branch.code || '').toLowerCase().trim();
  const portalCode = (branch.portalBranchCode || '').toLowerCase().trim();
  const shortName = (branch.shortName || '').toLowerCase().trim();

  return item.branchAvailability.some((ba: BranchAvailabilitySetting) => {
    if (ba.isActive === false) return false;
    const target = (ba.branchId || '').toLowerCase().trim();
    if (!target) return false;

    return (
      target === branchId ||
      target === branchCode ||
      target === portalCode ||
      target === shortName
    );
  });
}

/**
 * Returns all active items assigned or available for a given branch.
 */
export function getBranchActiveItems(items: GlobalItem[], branch: Branch | null | undefined): GlobalItem[] {
  if (!branch || !Array.isArray(items)) return [];
  return items.filter((item) => isItemAvailableInBranch(item, branch));
}
