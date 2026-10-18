import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import applicationService from '../../services/applicationService';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { formatDate } from '../../utils/formatters';
import { FileText, Clock } from 'lucide-react';

// Maps dashboard ?status= URL param to filter key used in this page
const URL_TO_FILTER_MAP = {
  APPROVED: 'APPROVED',
  APPLIED: 'PENDING',     // dashboard links to ?status=APPLIED for pending
  UNDER_REVIEW: 'PENDING',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
};

export const WorkerApplications = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Read initial filter from URL (from dashboard card navigation)
  const urlStatus = searchParams.get('status');
  const initialFilter = urlStatus ? (URL_TO_FILTER_MAP[urlStatus] || 'ALL') : 'ALL';
  const [filter, setFilter] = useState(initialFilter);

  useEffect(() => {
    const fetchApps = async () => {
      if (user?._id) {
        const res = await applicationService.getWorkerApplications(user._id);
        if (res.success) {
          setApplications(res.data);
        }
      }
      setLoading(false);
    };
    fetchApps();
  }, [user]);

  // Update filter if URL param changes (e.g. navigating from a different dashboard card)
  useEffect(() => {
    if (urlStatus) {
      setFilter(URL_TO_FILTER_MAP[urlStatus] || 'ALL');
    }
  }, [urlStatus]);

  if (loading) return <LoadingSpinner label="Loading your applications..." />;

  // Filter logic:
  // ALL      → all applications
  // PENDING  → APPLIED + UNDER_REVIEW (awaiting Admin decision)
  // APPROVED → APPROVED
  // REJECTED → REJECTED
  // CANCELLED → CANCELLED
  const filteredApps = applications.filter((app) => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return app.status === 'APPLIED' || app.status === 'UNDER_REVIEW';
    return app.status === filter;
  });

  const pendingCount = applications.filter((a) => a.status === 'APPLIED' || a.status === 'UNDER_REVIEW').length;

  const filterButtons = [
    { key: 'ALL',       label: 'All',        count: applications.length },
    { key: 'PENDING',   label: 'Pending',    count: pendingCount },
    { key: 'APPROVED',  label: 'Approved',   count: applications.filter((a) => a.status === 'APPROVED').length },
    { key: 'REJECTED',  label: 'Rejected',   count: applications.filter((a) => a.status === 'REJECTED').length },
    { key: 'CANCELLED', label: 'Cancelled',  count: applications.filter((a) => a.status === 'CANCELLED').length },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">My Submitted Applications</h1>
          <p className="text-xs text-slate-400">Track application status reviewed by Admin.</p>
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        {filterButtons.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filter === key
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {filteredApps.length === 0 ? (
        <EmptyState title="No Applications Found" description="You have not submitted any applications under this status." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredApps.map((app) => (
            <div key={app._id} className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-bold text-white line-clamp-1">{app.jobId?.title || 'Job'}</h3>
                <StatusBadge status={app.status} />
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> Applied on {formatDate(app.appliedAt)}
              </p>
              {app.adminNotes && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                  <span className="font-bold text-brand-400">Admin Note:</span> {app.adminNotes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkerApplications;


