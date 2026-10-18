import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { Bell, CheckCircle2 } from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';

export const RecruiterNotifications = () => {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const unreadNotifications = notifications.filter(n => !n.isRead);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Notifications</h1>
          <p className="text-xs text-slate-400">Updates regarding job submissions and Admin reviews.</p>
        </div>
        {unreadNotifications.length > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-xs font-semibold text-brand-400 hover:underline flex items-center gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Mark all read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {unreadNotifications.length === 0 ? (
          <div className="glass-card p-12 text-center text-xs text-slate-400 rounded-2xl">
            No new notifications.
          </div>
        ) : (
          unreadNotifications.map((n) => (
            <div
              key={n._id}
              onClick={() => {
                markAsRead(n._id);
                if (n.link) navigate(n.link);
              }}
              className={`glass-card p-5 rounded-2xl border transition-all cursor-pointer ${
                !n.isRead ? 'border-brand-500/50 bg-brand-950/20' : 'border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-bold text-white">{n.title}</h4>
                <span className="text-[10px] text-slate-500">{formatDate(n.createdAt)}</span>
              </div>
              <p className="text-xs text-slate-300 mt-1">{n.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecruiterNotifications;
