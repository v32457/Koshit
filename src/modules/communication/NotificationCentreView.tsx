import React, { useState } from 'react';
import { InPortalNotification, User } from '../../types';
import { INITIAL_IN_PORTAL_NOTIFICATIONS } from '../../data/communicationSeed';
import {
  Bell,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Search,
  CheckCheck,
  Shield,
  Layers,
  Database,
  Megaphone,
  Trash2,
} from 'lucide-react';

interface NotificationCentreViewProps {
  currentUser: User;
  onNavigate: (route: string) => void;
}

export const NotificationCentreView: React.FC<NotificationCentreViewProps> = ({
  currentUser,
  onNavigate,
}) => {
  const [notifications, setNotifications] = useState<InPortalNotification[]>(INITIAL_IN_PORTAL_NOTIFICATIONS);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNotifs = notifications.filter((n) => {
    if (activeCategory !== 'ALL' && n.category !== activeCategory) return false;
    if (priorityFilter !== 'ALL' && n.priority !== priorityFilter) return false;
    if (
      searchQuery &&
      !n.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !n.message.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleClearRead = () => {
    setNotifications((prev) => prev.filter((n) => !n.isRead));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Notification Centre / Inbox</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized in-portal operational notifications, approval alerts, SAP sync events, and security advisories.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-xs transition"
            >
              <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Mark All Read</span>
            </button>
          )}

          <button
            onClick={handleClearRead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-xs transition"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Clear Read</span>
          </button>
        </div>
      </div>

      {/* Filter and Category Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          {[
            { id: 'ALL', label: 'All Alerts' },
            { id: 'WORKFLOW', label: 'Workflow & Items' },
            { id: 'SAP_SYNC', label: 'SAP B1 Sync' },
            { id: 'SECURITY', label: 'Security & 2FA' },
            { id: 'ANNOUNCEMENT', label: 'Announcements' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition ${
                activeCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Priority and Search */}
        <div className="flex items-center gap-2">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 font-medium"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notifications..."
              className="text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg bg-slate-50 w-48"
            />
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Notifications ({filteredNotifs.length})
          </span>
          <span className="text-[11px] text-slate-500">
            {unreadCount} unread
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredNotifs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No notifications match your current category or search criteria.
            </div>
          ) : (
            filteredNotifs.map((notif) => {
              return (
                <div
                  key={notif.id}
                  className={`p-4 transition flex items-start justify-between gap-4 ${
                    !notif.isRead ? 'bg-blue-50/40 border-l-4 border-l-blue-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        notif.category === 'SAP_SYNC'
                          ? 'bg-amber-100 text-amber-800'
                          : notif.category === 'SECURITY'
                          ? 'bg-emerald-100 text-emerald-800'
                          : notif.category === 'ANNOUNCEMENT'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {notif.category === 'SAP_SYNC' && <Database className="w-4 h-4" />}
                      {notif.category === 'SECURITY' && <Shield className="w-4 h-4" />}
                      {notif.category === 'ANNOUNCEMENT' && <Megaphone className="w-4 h-4" />}
                      {notif.category === 'WORKFLOW' && <Layers className="w-4 h-4" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{notif.title}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            notif.priority === 'CRITICAL'
                              ? 'bg-red-100 text-red-800'
                              : notif.priority === 'HIGH'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {notif.priority}
                        </span>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">{notif.message}</p>

                      <div className="text-[10px] text-slate-400 pt-1">
                        {new Date(notif.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {notif.linkRoute && (
                      <button
                        onClick={() => onNavigate(notif.linkRoute!)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition cursor-pointer"
                      >
                        <span>Open Target</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}

                    {!notif.isRead && (
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                        title="Mark as Read"
                      >
                        <CheckCheck className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
