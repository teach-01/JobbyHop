import React, { useState, useEffect } from 'react';
import operationsService from '../../services/operationsService';
import { useNotifications } from '../../context/NotificationContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { formatDate } from '../../utils/formatters';
import { History } from 'lucide-react';

export const OperationsAuditLog = () => {
  const { showToast } = useNotifications();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await operationsService.getAuditHistory();
        if (res.success) setLogs(res.logs);
      } catch (err) {
        showToast('Failed to load audit history.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner label="Loading Audit Logs..." />;

  return (
    <div className="space-y-8 pb-12 text-xs">
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
          <History className="w-6 h-6 text-brand-500" />
          Operations: Audit History
        </h1>
        <p className="mt-1 text-slate-400">Read-only view of recent operations and overrides.</p>
      </div>

      {logs.length === 0 ? (
        <EmptyState title="No Audit Logs Found" />
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor Role</th>
                  <th className="px-4 py-3">Actor Email</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {logs.map((log) => {
                  const isAdminOverride = log.performedByRole === 'ADMIN';
                  return (
                    <tr key={log._id} className={`hover:bg-slate-800/40 transition-colors ${isAdminOverride ? 'bg-red-500/5' : ''}`}>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 font-mono">{formatDate(log.createdAt)}</td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-1 rounded font-bold text-[10px] ${isAdminOverride ? 'bg-red-500/20 text-red-400' : 'bg-brand-500/20 text-brand-400'}`}>
                          {log.performedByRole}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-300">{log.performedByUserId?.email}</td>
                      <td className="px-4 py-3.5 font-bold text-white">{log.action}</td>
                      <td className="px-4 py-3.5 text-slate-400">{log.entityName}</td>
                      <td className="px-4 py-3.5 text-slate-400 max-w-sm truncate" title={log.notes}>{log.notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationsAuditLog;
