import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { jobService } from '../../services/jobService';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EventLifecycleView from '../../components/admin/EventLifecycleView';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Calendar, Clock, MapPin, Users, ArrowLeft, ShieldCheck, IndianRupee } from 'lucide-react';
import { getLocationString } from '../../utils/locationHelper';

export const RecruiterJobDetails = () => {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await jobService.getJobById(id);
        if (res.success) {
          setJob(res.data);
        } else {
          setError(res.message || 'Event not found.');
        }
      } catch (err) {
        setError(err?.message || 'Failed to load event details.');
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [id]);

  if (loading) return <LoadingSpinner label="Loading job specifications..." />;

  if (error || !job) return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <Link to="/recruiter/submitted-events" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back to Submitted Events
      </Link>
      <div className="glass-card p-10 rounded-3xl border border-red-900/50 bg-red-950/10 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
          <ShieldCheck className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-red-300">Event Not Found</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          {error || 'This event could not be loaded. It may have been removed or you may not have permission to view it.'}
        </p>
        <Link
          to="/recruiter/submitted-events"
          className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-semibold hover:bg-brand-500/20 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Submitted Events
        </Link>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <Link to="/recruiter/submitted-events" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back to Submitted Events
      </Link>

      {/* Header Banner */}
      <div className="glass-card p-8 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-brand-500/10 text-brand-400 border border-brand-500/20">
              {job.eventType}
            </span>
            <h1 className="text-3xl font-extrabold text-white mt-2">{job.title}</h1>
            <p className="text-xs text-slate-400 mt-1">Submitted on {formatDate(job.createdAt)}</p>
          </div>
          <StatusBadge status={job.status} />
        </div>

        {/* Financial Details */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-3">
          {/* Recruiter's Original Requested Rate — always visible */}
          <div>
            <p className="text-amber-500/70 font-semibold uppercase text-[10px]">Your Requested Rate (per person)</p>
            <p className="text-xl font-extrabold text-amber-400">
              {formatCurrency(job.recruiterRequestedRate ?? 0)}
              <span className="text-amber-500/50 text-xs font-normal ml-1">/person</span>
            </p>
          </div>
        </div>

        {/* Rejection Reason */}
        {job.status === 'REJECTED' && (
          <div className="p-4 rounded-2xl bg-red-950/30 border border-red-900/50 text-xs space-y-2 mt-4">
            <p className="text-red-400 font-semibold uppercase text-[10px]">Rejection Reason</p>
            <p className="text-red-300">{job.rejectionReason}</p>
          </div>
        )}
      </div>

      {/* Horizontal Lifecycle Steps */}
      <EventLifecycleView job={job} isRecruiter={true} />

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white">Event Description</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{job.description}</p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white">Shift Responsibilities & Requirements</h3>
            <p className="text-xs text-slate-300">
              <strong className="text-slate-200">Responsibilities:</strong> {job.responsibilities || 'N/A'}
            </p>
            <p className="text-xs text-slate-300">
              <strong className="text-slate-200">Dress Code / Attire:</strong> {job.workerRequirements || 'N/A'}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">Event Logistics</h3>
            <div className="flex items-center gap-2.5 text-slate-300">
              <Calendar className="w-4 h-4 text-brand-400 shrink-0" />
              <span>{formatDate(job.eventDate)}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-300">
              <Clock className="w-4 h-4 text-purple-400 shrink-0" />
              <span>{job.startTime} - {job.endTime}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-300">
              <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{getLocationString(job.location)}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-300">
              <Users className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{job.assignedWorkersCount || 0} / {job.workersRequired} Staff Assigned</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecruiterJobDetails;
