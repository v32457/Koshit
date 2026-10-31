import test from 'node:test';
import assert from 'node:assert/strict';

test('enforces strict maker-checker isolation (maker cannot self-approve)', () => {
  const makerUser = { id: 'usr-001', role: 'ITEM_MAKER', fullName: 'Rajesh Sharma' };
  const itemRequest = {
    id: 'item-101',
    globalItemCode: 'RMPAOPOEXLG0001',
    createdBy: 'usr-001',
    status: 'SUBMITTED',
  };

  const canApprove = (userId: string, userRole: string, requestCreatedBy: string) => {
    if (userId === requestCreatedBy) return false; // Self approval strictly blocked
    return userRole === 'ITEM_CHECKER' || userRole === 'ADMIN';
  };

  assert.equal(canApprove(makerUser.id, makerUser.role, itemRequest.createdBy), false);

  const checkerUser = { id: 'usr-002', role: 'ITEM_CHECKER', fullName: 'Anita Desai' };
  assert.equal(canApprove(checkerUser.id, checkerUser.role, itemRequest.createdBy), true);
});
