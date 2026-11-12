import React, { useState, useMemo } from 'react';
import { User, Buyer } from '../../types';
import { INITIAL_USERS } from '../../data/seedData';
import { INITIAL_BUYERS } from '../../data/buyerData';
import { Plus, Search, CheckCircle, XCircle, User as UserIcon } from 'lucide-react';

export const BuyerManagementView: React.FC = () => {
  const [buyers, setBuyers] = useState<Buyer[]>(INITIAL_BUYERS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const availableUsers = useMemo(() => {
    return INITIAL_USERS.filter(user => !buyers.some(b => b.userId === user.id));
  }, [buyers]);

  const filteredUsers = useMemo(() => {
    return availableUsers.filter(u => u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [availableUsers, searchQuery]);

  const handleAddBuyer = () => {
    const user = INITIAL_USERS.find(u => u.id === selectedUserId);
    if (!user) return;

    const newBuyer: Buyer = {
      id: `buy-${Date.now()}`,
      userId: user.id,
      user: user,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setBuyers([...buyers, newBuyer]);
    setIsModalOpen(false);
    setSelectedUserId('');
  };

  return (
    <div className="space-y-4 p-4 text-xs font-sans">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-indigo-600" />
          Buyer Management
        </h3>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add New Buyer
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-[10px] text-slate-600">
              <th className="p-3">User Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {buyers.map(b => (
              <tr key={b.id}>
                <td className="p-3 font-bold">{b.user.fullName}</td>
                <td className="p-3 text-slate-600">{b.user.email}</td>
                <td className="p-3">{b.isActive ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <h4 className="font-bold text-sm">Add New Buyer</h4>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg"
            >
              <option value="">Select User</option>
              {filteredUsers.map(u => (
                <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsModalOpen(false)} className="px-3 py-1 bg-slate-100 rounded">Cancel</button>
              <button onClick={handleAddBuyer} disabled={!selectedUserId} className="px-3 py-1 bg-indigo-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
