import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import assignmentService from '../../services/assignmentService';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { CheckCircle, Calendar, Clock, MapPin, IndianRupee } from 'lucide-react';
import { getLocationString } from '../../utils/locationHelper';

export const WorkerAssignments = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssignments = async () => {
      if (user?._id) {
        const res = await assignmentService.getWorkerAssignments(user._id);
        if (res.success) {
          setAssignments(res.data);
        }
      }
      setLoading(false);
    };
    fetchAssignments();
  }, [user]);

  if (loading) return <LoadingSpinner label="Loading your event assignments..." />;

  return (
    <div className="space-y-6 pb-12">
      <div className="glass-card p-6 rounded-3xl border border-slate-800">
        <h1 className="text-2xl font-extrabold text-white">My Active Event Assignments</h1>
        <p className="text-xs text-slate-400">Confirmed shifts assigned to you by JobbyHop Admin.</p>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          title="No Assignments Active"
          description="You currently have no active event assignments. Apply for approved jobs to get assigned!"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assignments.map((asg) => (
            <div key={asg._id} className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    ASSIGNED BY ADMIN
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1">{asg.jobId?.title || 'Event Assignment'}</h3>
                </div>
                <StatusBadge status={asg.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand-400 shrink-0" />
                  <span>{formatDate(asg.jobId?.eventDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>{asg.jobId?.startTime} - {asg.jobId?.endTime}</span>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="truncate">{getLocationString(asg.jobId?.location)}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Verified Shift Pay</p>
                  <p className="text-xl font-extrabold text-emerald-400">
                    {formatCurrency(asg.jobId?.adminApprovedPayment)}
                  </p>
                </div>
                <span className="text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  Payout in 10–15d
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkerAssignments;
