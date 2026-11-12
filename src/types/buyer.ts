import { User } from './index';

export interface Buyer {
  id: string;
  userId: string;
  user: User; // To hold user details
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
