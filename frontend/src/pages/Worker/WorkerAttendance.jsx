import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import attendanceService from '../../services/attendanceService';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { formatDate } from '../../utils/formatters';
import { RefreshCw } from 'lucide-react';

export const WorkerAttendance = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * loadAttendance — always fetches fresh data from the backend.
   * showSpinner=true shows the spinning Refresh button indicator without
   * blocking the full-page LoadingSpinner (used for manual refresh clicks).
   */
  const loadAttendance = useCallback(
    async (showSpinner = false) => {
      if (!user?._id) {
        setLoading(false);
        return;
      }
      if (showSpinner) setRefreshing(true);
      const res = await attendanceService.getWorkerAttendance(user._id);
      if (res.success) {
        setRecords(res.data);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [user]
  );

  // Fetch on mount and whenever the logged-in user changes
  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  /**
   * Attendance Fix — Stale Data Root Cause & Solution:
   *
   * Problem: After Admin updates a worker's attendance, the Worker Attendance
   * page would show the old (stale) status if the component was already mounted
   * (e.g., navigating back without a full reload). The original useEffect only
   * ran when `user` changed — not when returning to the page.
   *
   * Fix: Listen to the browser's `visibilitychange` event. When the Worker
   * switches back to this tab or window (document.visibilityState === 'visible'),
   * we immediately re-fetch attendance from the backend. This ensures the
   * displayed data matches what's stored in MongoDB without requiring a full
   * page reload or logout/login cycle.
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadAttendance();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadAttendance]);

  if (loading) return <LoadingSpinner label="Loading attendance history..." />;

  return (
    <div className="space-y-6 pb-12">
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">My Attendance</h1>
          <p className="text-xs text-slate-400">
            Verified shift check-ins and punctuality records logged by Admin.
          </p>
        </div>
        {/* Manual refresh: lets Worker pull latest attendance without browser reload */}
        <button
          onClick={() => loadAttendance(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all disabled:opacity-50"
          title="Refresh attendance records from server"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {records.length === 0 ? (
        <EmptyState
          title="No Attendance Records"
          description="No attendance logs found for your shifts yet."
        />
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Event / Job</th>
                  <th className="px-4 py-3">Attendance Date</th>
                  <th className="px-4 py-3">Check-In</th>
                  <th className="px-4 py-3">Check-Out</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Admin Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {records.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-800/40 transition-colors">
                    {/* jobId populated: { title, eventType, eventDate, location } */}
                    <td className="px-4 py-3.5 font-bold text-white">
                      {r.jobId?.title || '—'}
                      {r.jobId?.eventType && (
                        <span className="ml-2 text-[10px] text-slate-500 font-normal">
                          ({r.jobId.eventType})
                        </span>
                      )}
                    </td>
                    {/* r.date = attendance date field from Attendance model */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-400">
                      {formatDate(r.date)}
                    </td>
                    <td className="px-4 py-3.5 text-emerald-400 font-semibold">
                      {r.checkInTime || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-purple-400 font-semibold">
                      {r.checkOutTime || '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 max-w-xs truncate">
                      {r.notes || 'Verified by Admin'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerAttendance;
