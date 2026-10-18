import React, { useState, useEffect } from 'react';
import operationsService from '../../services/operationsService';
import { useNotifications } from '../../context/NotificationContext';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { formatDate } from '../../utils/formatters';
import { CalendarCheck, Lock } from 'lucide-react';

export const OperationsAttendance = () => {
  const { showToast } = useNotifications();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await operationsService.getAttendance();
      if (res.success) setRecords(res.attendance);
    } catch (err) {
      showToast('Failed to load attendance records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdate = async (id, status) => {
    try {
      const res = await operationsService.updateAttendance(id, { status });
      if (res.success) {
        showToast('Attendance updated successfully.', 'success');
        fetchData();
      }
    } catch (err) {
      showToast(err || 'Failed to update attendance.', 'error');
    }
  };

  if (loading) return <LoadingSpinner label="Loading Attendance..." />;

  return (
    <div className="space-y-8 pb-12 text-xs">
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
          <CalendarCheck className="w-6 h-6 text-brand-500" />
          Operations: Attendance
        </h1>
        <p className="mt-1 text-slate-400">Manage worker check-ins and attendance statuses.</p>
      </div>

      {records.length === 0 ? (
        <EmptyState title="No Attendance Logs Found" />
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Worker Name</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Check-In</th>
                  <th className="px-4 py-3">Check-Out</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {records.map((rec) => {
                  const isLocked = !!rec.verifiedByAdminId;
                  return (
                    <tr key={rec._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-white">{rec.workerId?.email}</td>
                      <td className="px-4 py-3.5 font-semibold text-brand-300">{rec.jobId?.title}</td>
                      <td className="px-4 py-3.5 text-slate-400">{formatDate(rec.jobId?.eventDate)}</td>
                      <td className="px-4 py-3.5 text-emerald-400 font-bold">{rec.checkInTime || '-'}</td>
                      <td className="px-4 py-3.5 text-purple-400 font-bold">{rec.checkOutTime || '-'}</td>
                      <td className="px-4 py-3.5"><StatusBadge status={rec.status} /></td>
                      <td className="px-4 py-3.5 text-right flex justify-end items-center gap-2">
                        {isLocked ? (
                          <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase bg-slate-900 px-2 py-1 rounded">
                            <Lock className="w-3 h-3" />
                            Verified by Admin — Editing Locked
                          </span>
                        ) : (
                          <>
                            <button onClick={() => handleUpdate(rec._id, 'PRESENT')} className="px-2 py-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded font-semibold transition-colors">
                              Present
                            </button>
                            <button onClick={() => handleUpdate(rec._id, 'ABSENT')} className="px-2 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded font-semibold transition-colors">
                              Absent
                            </button>
                          </>
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

export default OperationsAttendance;
