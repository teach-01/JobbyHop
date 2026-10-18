import React, { useState, useEffect } from 'react';
import operationsService from '../../services/operationsService';
import { useNotifications } from '../../context/NotificationContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { formatDate } from '../../utils/formatters';
import { Bell } from 'lucide-react';

export const OperationsNotifications = () => {
  const { showToast } = useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await operationsService.getNotifications();
        if (res.success) setNotifications(res.notifications);
      } catch (err) {
        showToast('Failed to load notifications.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner label="Loading Notifications..." />;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
          <Bell className="w-6 h-6 text-brand-500" />
          Operations: Notifications
        </h1>
        <p className="mt-1 text-slate-400">Recent system notifications related to operations.</p>
      </div>

      {notifications.length === 0 ? (
        <EmptyState title="No Notifications Found" />
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div key={notif._id} className="glass-card p-4 rounded-xl border border-slate-800">
              <h3 className="font-bold text-white">{notif.title}</h3>
              <p className="text-slate-300 text-sm mt-1">{notif.message}</p>
              <div className="text-slate-500 text-xs mt-2 font-mono">{formatDate(notif.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OperationsNotifications;
