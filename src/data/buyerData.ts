import { Buyer } from '../types/buyer';
import { INITIAL_USERS } from './seedData';

export const INITIAL_BUYERS: Buyer[] = [
  {
    id: 'buy-001',
    userId: 'usr-admin-01',
    user: INITIAL_USERS.find(u => u.id === 'usr-admin-01')!,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];
