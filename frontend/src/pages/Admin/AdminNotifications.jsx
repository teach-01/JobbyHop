import React, { useState, useMemo } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { Bell, CheckCircle2, Search, RotateCcw } from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import DateFilter from '../../components/common/DateFilter';
import { DEFAULT_DATE_FILTER, matchesDateFilter } from '../../utils/dateFilterHelper';

export const AdminNotifications = () => {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState(DEFAULT_DATE_FILTER);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (!matchesDateFilter(n.createdAt, dateFilter)) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const title = (n.title || '').toLowerCase();
        const msg = (n.message || '').toLowerCase();
        if (!title.includes(q) && !msg.includes(q)) return false;
      }
      return true;
    });
  }, [notifications, searchTerm, dateFilter]);

  const isFiltered = searchTerm.trim() !== '' || dateFilter.preset !== 'all';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 text-xs">
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">System Admin Notifications</h1>
          <p className="text-slate-400">High-priority alerts for new job submissions and applications.</p>
        </div>
        {notifications.length > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-xs font-semibold text-brand-400 hover:underline flex items-center gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Mark all read
          </button>
        )}
      </div>

      {/* Search & Date Filter Bar */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <DateFilter dateFilter={dateFilter} onDateFilterChange={setDateFilter} />
          {isFiltered && (
            <button
              onClick={() => { setSearchTerm(''); setDateFilter(DEFAULT_DATE_FILTER); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white font-semibold text-xs transition-colors shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="glass-card p-12 text-center text-slate-400 rounded-2xl">
            {isFiltered ? 'No notifications matched your filter criteria.' : 'No system notifications recorded.'}
          </div>
        ) : (
          filteredNotifications.map((n) => (
            <div
              key={n._id}
              onClick={() => markAsRead(n._id)}
              className={`glass-card p-5 rounded-2xl border transition-all cursor-pointer ${
                !n.isRead ? 'border-brand-500/50 bg-brand-950/20' : 'border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-bold text-white">{n.title}</h4>
                <span className="text-[10px] text-slate-500">{formatDate(n.createdAt)}</span>
              </div>
              <p className="text-slate-300 mt-1">{n.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminNotifications;
