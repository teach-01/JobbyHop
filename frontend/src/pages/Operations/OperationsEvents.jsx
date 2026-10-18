import React, { useState, useEffect } from 'react';
import operationsService from '../../services/operationsService';
import { useNotifications } from '../../context/NotificationContext';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { formatDate } from '../../utils/formatters';
import { Layers, Lock } from 'lucide-react';

export const OperationsEvents = () => {
  const { showToast } = useNotifications();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await operationsService.getEvents();
      if (res.success) setRecords(res.assignments);
    } catch (err) {
      showToast('Failed to load events.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleComplete = async (id) => {
    try {
      const res = await operationsService.completeEvent(id, 'Operations marked as completed');
      if (res.success) {
        showToast('Event marked as completed.', 'success');
        fetchData();
      }
    } catch (err) {
      showToast(err || 'Failed to complete event.', 'error');
    }
  };

  if (loading) return <LoadingSpinner label="Loading Events..." />;

  return (
    <div className="space-y-8 pb-12 text-xs">
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
          <Layers className="w-6 h-6 text-brand-500" />
          Operations: Events & Completion
        </h1>
        <p className="mt-1 text-slate-400">Mark events as completed to initiate the 10-15 day payment timeline.</p>
      </div>

      {records.length === 0 ? (
        <EmptyState title="No Events Found" />
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Worker</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {records.map((rec) => {
                  const isLocked = !!rec.verifiedByAdminId;
                  const isCompleted = rec.status === 'COMPLETED';
                  return (
                    <tr key={rec._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-brand-300">{rec.jobId?.title}</td>
                      <td className="px-4 py-3.5 font-bold text-white">{rec.workerId?.email}</td>
                      <td className="px-4 py-3.5 text-slate-400">{formatDate(rec.jobId?.eventDate)}</td>
                      <td className="px-4 py-3.5"><StatusBadge status={rec.status} /></td>
                      <td className="px-4 py-3.5 text-right flex justify-end items-center gap-2">
                        {isLocked ? (
                          <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase bg-slate-900 px-2 py-1 rounded">
                            <Lock className="w-3 h-3" />
                            Verified by Admin — Editing Locked
                          </span>
                        ) : !isCompleted && (
                          <button onClick={() => handleComplete(rec._id)} className="px-2 py-1 bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 rounded font-semibold transition-colors">
                            Mark Completed
                          </button>
                        )}
                      </td>
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

export default OperationsEvents;
