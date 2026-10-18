import React, { useState, useEffect } from 'react';
import jobService from '../../services/jobService';
import JobCard from '../../components/jobs/JobCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export const AdminApprovedJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApprovedJobs = async () => {
      const res = await jobService.getAllJobs();
      if (res.success) {
        setJobs(res.data.filter((j) => j.status === 'APPROVED'));
      }
      setLoading(false);
    };
    fetchApprovedJobs();
  }, []);

  if (loading) return <LoadingSpinner label="Loading approved jobs feed..." />;

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h1 className="text-2xl font-extrabold text-white">Live Approved Jobs Catalog ({jobs.length})</h1>
          </div>
          <p className="text-slate-400 mt-1">Jobs currently visible to Workers with final Admin-approved payments.</p>
        </div>
      </div>

      {jobs.length === 0 ? (
        <EmptyState title="No Live Approved Jobs" description="Approve pending job requests to make them live for workers." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <JobCard key={job._id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminApprovedJobs;
