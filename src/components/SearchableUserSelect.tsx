import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User } from '../types';
import { Search, X, Check, Calendar, AlertCircle, Clock, UserCheck, ShieldAlert, History, UserPlus } from 'lucide-react';

interface SearchableUserSelectProps {
  label: string;
  value?: string; // userId or user identifier
  onChange: (user: User | null) => void;
  users: User[];
  placeholder?: string;
  disabledUserIds?: string[]; // IDs to disable (e.g., counterpart already selected)
  required?: boolean;
  disabledNotice?: string;

  // Validity Date Controls
  validFrom?: string;
  validTo?: string;
  onValidFromChange?: (date: string) => void;
  onValidToChange?: (date: string) => void;
  statusBadge?: 'CURRENT' | 'UPCOMING' | 'EXPIRED' | 'TEMPORARILY_REPLACED' | string;
  delegationInfo?: {
    replacementUserName: string;
    delegationValidFrom: string;
    delegationValidTo: string;
    reason: string;
  };

  // Quick Action Handlers
  onScheduleClick?: () => void;
  onDelegateClick?: () => void;
  onHistoryClick?: () => void;
}

export const SearchableUserSelect: React.FC<SearchableUserSelectProps> = ({
  label,
  value,
  onChange,
  users,
  placeholder = 'Search by Name, Employee ID (e.g. EMP-2001), or Email...',
  disabledUserIds = [],
  required = false,
  disabledNotice = 'Already selected',
  validFrom,
  validTo,
  onValidFromChange,
  onValidToChange,
  statusBadge = 'CURRENT',
  delegationInfo,
  onScheduleClick,
  onDelegateClick,
  onHistoryClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Active users only
  const activeUsers = useMemo(() => {
    return users.filter(u => !u.status || u.status === 'ACTIVE');
  }, [users]);

  // Selected user object
  const selectedUser = useMemo(() => {
    if (!value) return null;
    return (
      activeUsers.find(u => u.id === value || u.fullName === value || u.email === value || (u.employeeId && u.employeeId === value)) || null
    );
  }, [value, activeUsers]);

  // Filtered list based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return activeUsers;
    const q = searchQuery.toLowerCase().trim();
    return activeUsers.filter(u => {
      const matchName = u.fullName.toLowerCase().includes(q);
      const matchId = (u.employeeId || '').toLowerCase().includes(q);
      const matchEmail = u.email.toLowerCase().includes(q);
      const matchDept = (u.department || '').toLowerCase().includes(q);
      const matchDesig = (u.designation || '').toLowerCase().includes(q);
      return matchName || matchId || matchEmail || matchDept || matchDesig;
    });
  }, [searchQuery, activeUsers]);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % Math.max(1, filteredUsers.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + filteredUsers.length) % Math.max(1, filteredUsers.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const targetUser = filteredUsers[highlightedIndex];
      if (targetUser && !disabledUserIds.includes(targetUser.id)) {
        handleSelectUser(targetUser);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelectUser = (user: User) => {
    onChange(user);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSearchQuery('');
    setIsOpen(false);
  };

  return (
    <div className="space-y-1.5 relative" ref={dropdownRef}>
      {/* Label & Header Status */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
          <span>{label}</span> {required && <span className="text-rose-500">*</span>}
        </label>

        <div className="flex items-center gap-1.5">
          {statusBadge === 'CURRENT' && (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-bold flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-emerald-600" /> Current Active
            </span>
          )}
          {statusBadge === 'UPCOMING' && (
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-300 rounded-full text-[10px] font-bold flex items-center gap-1">
              <Clock className="w-3 h-3 text-indigo-600" /> Scheduled Upcoming
            </span>
          )}
          {statusBadge === 'EXPIRED' && (
            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 border border-slate-300 rounded-full text-[10px] font-bold flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-slate-500" /> Expired
            </span>
          )}
          {statusBadge === 'TEMPORARILY_REPLACED' && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-[10px] font-bold flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-amber-600" /> Temporarily Replaced
            </span>
          )}

          {/* Action Trigger Buttons */}
          {onScheduleClick && (
            <button
              type="button"
              onClick={onScheduleClick}
              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer"
              title="Schedule Future Assignment"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelegateClick && (
            <button
              type="button"
              onClick={onDelegateClick}
              className="p-1 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded transition cursor-pointer"
              title="Temporary Replacement / Delegation"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          )}
          {onHistoryClick && (
            <button
              type="button"
              onClick={onHistoryClick}
              className="p-1 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded transition cursor-pointer"
              title="View Role Assignment History"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Selected User Card Display */}
      {selectedUser ? (
        <div className="p-2.5 bg-white border border-slate-300 rounded-xl space-y-2 shadow-2xs hover:border-indigo-300 transition">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0 border border-indigo-200">
                {selectedUser.fullName.charAt(0)}
              </div>
              <div className="truncate">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                  <span>{selectedUser.fullName}</span>
                  {selectedUser.employeeId && (
                    <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded text-[10px] font-mono border border-indigo-200">
                      {selectedUser.employeeId}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {selectedUser.designation || selectedUser.role} {selectedUser.department ? `• ${selectedUser.department}` : ''}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition cursor-pointer shrink-0"
              title="Change or Clear Selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Delegation Alert Banner if temporarily replaced */}
          {delegationInfo && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900 space-y-0.5">
              <div className="font-bold flex items-center gap-1 text-amber-800">
                <ShieldAlert className="w-3 h-3 text-amber-600" />
                Temporary Replacement Delegate: {delegationInfo.replacementUserName}
              </div>
              <div>
                Period: <span className="font-bold">{delegationInfo.delegationValidFrom}</span> to <span className="font-bold">{delegationInfo.delegationValidTo}</span> • Reason: {delegationInfo.reason}
              </div>
            </div>
          )}

          {/* Integrated Validity Dates */}
          {(onValidFromChange || onValidToChange) && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-500" /> Valid From *
                </label>
                <input
                  type="date"
                  value={validFrom || new Date().toISOString().split('T')[0]}
                  onChange={e => onValidFromChange && onValidFromChange(e.target.value)}
                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> Valid To (Optional)
                </label>
                <input
                  type="date"
                  value={validTo || ''}
                  onChange={e => onValidToChange && onValidToChange(e.target.value)}
                  placeholder="Open-ended"
                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Searchable Input Field */
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              className="w-full pl-8 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs"
              placeholder={placeholder}
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
                setHighlightedIndex(0);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown Options List */}
          {isOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user, idx) => {
                  const isDisabled = disabledUserIds.includes(user.id);
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <div
                      key={user.id}
                      onClick={() => {
                        if (!isDisabled) handleSelectUser(user);
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`p-2.5 text-xs transition cursor-pointer ${
                        isDisabled
                          ? 'opacity-50 bg-slate-50 cursor-not-allowed'
                          : isHighlighted
                          ? 'bg-indigo-50 text-indigo-900'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-slate-900">{user.fullName}</div>
                          {user.employeeId && (
                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-[10px] font-mono border border-slate-200">
                              {user.employeeId}
                            </span>
                          )}
                        </div>
                        {isDisabled && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold">
                            {disabledNotice}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{user.designation || user.role}</span>
                        {user.department && <span>• {user.department}</span>}
                        <span>• {user.email}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-3 text-center text-xs text-slate-500 italic flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                  No matching active users found for "{searchQuery}"
                </div>
              )}
            </div>
          )}

          {/* Date inputs when no user selected yet */}
          {(onValidFromChange || onValidToChange) && (
            <div className="grid grid-cols-2 gap-2 pt-1.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-500" /> Valid From *
                </label>
                <input
                  type="date"
                  value={validFrom || new Date().toISOString().split('T')[0]}
                  onChange={e => onValidFromChange && onValidFromChange(e.target.value)}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded text-[11px] font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> Valid To (Optional)
                </label>
                <input
                  type="date"
                  value={validTo || ''}
                  onChange={e => onValidToChange && onValidToChange(e.target.value)}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded text-[11px] font-mono font-bold text-slate-800"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
