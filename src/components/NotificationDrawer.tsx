import React, { useState } from 'react';
import { InPortalNotification, CommunicationPriority } from '../types';
import {
  X,
  CheckCheck,
  Bell,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Inbox,
  Megaphone,
} from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: InPortalNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onNavigate: (route: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigate,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  if (!isOpen) return null;

  const filtered = notifications.filter((n) => {
    if (filterCategory === 'ALL') return true;
    if (filterCategory === 'UNREAD') return !n.isRead;
    return n.category === filterCategory;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getPriorityBadge = (priority: CommunicationPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-200">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">MEDIUM</span>;
      case 'LOW':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">LOW</span>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'WORKFLOW':
        return <Inbox className="w-4 h-4 text-amber-500" />;
      case 'SAP_SYNC':
        return <Cpu className="w-4 h-4 text-blue-500" />;
      case 'SECURITY':
        return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
      case 'ANNOUNCEMENT':
        return <Megaphone className="w-4 h-4 text-purple-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200">
          {/* Header */}
          <div className="p-4 bg-[#0B192C] text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-600/30 border border-blue-400/40 text-blue-300">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm tracking-wide flex items-center gap-2">
                  Governance Notification Hub
                  {unreadCount > 0 && (
                    <span className="bg-[#E85C0D] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">Section 6 Real-time In-Portal Alerts</div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Actions & Filter Pills */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                Filter Stream
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all as read
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'ALL', label: 'All' },
                { key: 'UNREAD', label: `Unread (${unreadCount})` },
                { key: 'WORKFLOW', label: 'Workflow' },
                { key: 'SAP_SYNC', label: 'SAP Sync' },
                { key: 'SECURITY', label: 'Security' },
                { key: 'ANNOUNCEMENT', label: 'Broadcasts' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterCategory(tab.key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                    filterCategory === tab.key
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No notifications in this filter view.
              </div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border transition ${
                    item.isRead
                      ? 'bg-white border-slate-200/80 hover:bg-slate-50'
                      : 'bg-blue-50/50 border-blue-200 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-slate-100">
                        {getCategoryIcon(item.category)}
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {item.category.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getPriorityBadge(item.priority)}
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                      )}
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 mt-1.5">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    {item.message}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-mono text-[10px]">
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Today
                    </span>

                    <div className="flex items-center gap-2">
                      {!item.isRead && (
                        <button
                          onClick={() => onMarkAsRead(item.id)}
                          className="text-slate-500 hover:text-slate-800 text-[10px] font-medium cursor-pointer"
                        >
                          Mark read
                        </button>
                      )}
                      {item.linkRoute && (
                        <button
                          onClick={() => {
                            onNavigate(item.linkRoute!);
                            onClose();
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-[10px] px-2 py-0.8 rounded flex items-center gap-1 cursor-pointer"
                        >
                          Open <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Notification Retention: 90 Days</span>
            <button
              onClick={() => {
                onNavigate('/communication');
                onClose();
              }}
              className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              Manage Communication Settings →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
