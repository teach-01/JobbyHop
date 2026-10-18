import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { jobService } from '../../services/jobService';
import JobCard from '../../components/jobs/JobCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { ShieldAlert, Briefcase } from 'lucide-react';

export const RecruiterMyJobs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Normalize incoming URL query param 'status'
  // Supports: all, pending, pending_review, approved, rejected, completed, cancelled
  const parseStatusParam = (param) => {
    if (!param) return 'ALL';
    const norm = param.trim().toUpperCase();
    if (norm === 'PENDING' || norm === 'PENDING_REVIEW') return 'PENDING';
    if (norm === 'APPROVED') return 'APPROVED';
    if (norm === 'REJECTED') return 'REJECTED';
    if (norm === 'COMPLETED') return 'COMPLETED';
    if (norm === 'CANCELLED') return 'CANCELLED';
    return 'ALL';
  };

  const activeTab = parseStatusParam(searchParams.get('status'));

  const handleTabChange = (key) => {
    const param = key.toLowerCase();
    const nextParams = new URLSearchParams(searchParams);
    if (param === 'all') {
      nextParams.delete('status');
    } else {
      nextParams.set('status', param);
    }
    setSearchParams(nextParams);
  };

  useEffect(() => {
    const fetchJobs = async () => {
      if (user?._id) {
        const res = await jobService.getRecruiterJobs({ limit: 1000 });
        if (res.success) {
          setJobs(res.data);
        }
      }
      setLoading(false);
    };
    fetchJobs();
  }, [user]);

  if (loading) return <LoadingSpinner label="Loading your event jobs..." />;

  const filteredJobs = jobs.filter((j) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PENDING') return j.status === 'PENDING_REVIEW';
    if (activeTab === 'APPROVED') return j.status === 'APPROVED';
    if (activeTab === 'REJECTED') return j.status === 'REJECTED';
    if (activeTab === 'COMPLETED') return j.status === 'COMPLETED';
    if (activeTab === 'CANCELLED') return j.status === 'CANCELLED';
    return true;
  });

  const tabs = [
    { key: 'ALL', label: `All Jobs (${jobs.length})` },
    { key: 'PENDING', label: `Pending Review (${jobs.filter((j) => j.status === 'PENDING_REVIEW').length})` },
    { key: 'APPROVED', label: `Approved (${jobs.filter((j) => j.status === 'APPROVED').length})` },
    { key: 'REJECTED', label: `Rejected (${jobs.filter((j) => j.status === 'REJECTED').length})` },
    { key: 'COMPLETED', label: `Completed (${jobs.filter((j) => j.status === 'COMPLETED').length})` },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">My Submitted Events</h1>
          <p className="text-xs text-slate-400">Track your event request statuses and Admin review history.</p>
        </div>
      </div>

      {/* Admin Mediation Notice */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center gap-3">
        <ShieldAlert className="w-5 h-5 text-brand-400 shrink-0" />
        <p>
          <span className="font-bold text-white">Note:</span> Worker applications and staff assignments are managed directly by JobbyHop Admin. Recruiters cannot directly assign workers.
        </p>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === tab.key
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredJobs.length === 0 ? (
        <EmptyState
          title="No Jobs Found in this Category"
          description="You have no jobs matching the selected status filter."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job) => (
            <JobCard
              key={job._id}
              job={job}
              onViewDetails={() => navigate(`/recruiter/submitted-events/${job._id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default RecruiterMyJobs;
