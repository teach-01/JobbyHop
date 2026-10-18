import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import jobService from '../../services/jobService';
import applicationService from '../../services/applicationService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Calendar, Clock, MapPin, Users, ArrowLeft, ShieldCheck, CheckCircle2, IndianRupee, Sparkles, Navigation } from 'lucide-react';

export const WorkerJobDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const fetchJobDetails = async () => {
      if (id && user?._id) {
        const res = await jobService.getJobById(id);
        if (res.success) {
          setJob(res.data);
        }

        const appsRes = await applicationService.getWorkerApplications(user._id);
        if (appsRes.success) {
          const applied = appsRes.data.some(
            (a) => (a.jobId?._id || a.jobId)?.toString() === id?.toString()
          );
          setHasApplied(applied);
        } else if (res.data?.hasApplied) {
          setHasApplied(true);
        }
      }
      setLoading(false);
    };
    fetchJobDetails();
  }, [id, user]);

  const handleApply = async () => {
    if (hasApplied) return;
    setApplying(true);
    try {
      const res = await applicationService.applyForJob(id, user);
      if (res.success) {
        setHasApplied(true);
        showToast('APPLICATION SUBMITTED! JobbyHop Admin will review your profile.', 'success');
      } else {
        showToast(res.message || 'Application failed', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Failed to submit application', 'error');
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <LoadingSpinner label="Loading event job specifications..." />;
  if (!job) return <div className="p-8 text-center text-slate-400">Job not found or unavailable.</div>;

  const locationAddress = typeof job.location === 'object' && job.location !== null ? job.location.address : job.location;
  const hasCoordinates = typeof job.location === 'object' && job.location !== null && typeof job.location.latitude === 'number' && typeof job.location.longitude === 'number';
  const getDirectionsUrl = hasCoordinates ? `https://www.google.com/maps/dir/?api=1&destination=${job.location.latitude},${job.location.longitude}` : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <Link to="/worker/available-jobs" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back to Available Jobs
      </Link>

      {/* Header Glass Card */}
      <div className="glass-card p-8 rounded-3xl border border-slate-800 space-y-4 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-brand-500/10 text-brand-300 border border-brand-500/20">
            {job.eventType}
          </span>
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
            <ShieldCheck className="w-4 h-4" /> Admin Verified Job
          </div>
        </div>

        <h1 className="text-3xl font-extrabold text-white">{job.title}</h1>
        <p className="text-xs text-slate-400">Posted by {job.recruiterName} • Verified by Admin</p>

        {/* Big Payout Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-950 border border-emerald-500/30 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Verified Payout Amount</p>
            <p className="text-3xl font-black text-emerald-400">{formatCurrency(job.adminApprovedPayment)}</p>
          </div>
          <div className="text-right text-[11px] text-slate-400">
            <p className="font-semibold text-purple-300">10–15 Day Payout Window</p>
            <p className="text-[10px] text-slate-500">Processed directly via Admin</p>
          </div>
        </div>
      </div>

      {/* Job Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white">Event Overview & Description</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{job.description}</p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white">Shift Responsibilities & Attire</h3>
            <div className="space-y-2 text-xs text-slate-300">
              <p><strong className="text-white">Responsibilities:</strong> {job.responsibilities || 'Standard event support'}</p>
              <p><strong className="text-white">Requirements & Attire:</strong> {job.workerRequirements || 'Formal dress code'}</p>
            </div>
          </div>

          {/* Required Skills Badges */}
          {job.requiredSkills && job.requiredSkills.length > 0 && (
            <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white">Required Skills</h3>
              <div className="flex flex-wrap gap-2">
                {job.requiredSkills.map((skill, i) => (
                  <span key={i} className="px-3 py-1 rounded-xl bg-brand-500/10 text-brand-300 border border-brand-500/20 text-xs font-semibold">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Logistics & CTA */}
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">Shift Schedule</h3>
            <div className="flex items-center gap-2.5 text-slate-300">
              <Calendar className="w-4 h-4 text-brand-400 shrink-0" />
              <span>{formatDate(job.eventDate)}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-300">
              <Clock className="w-4 h-4 text-purple-400 shrink-0" />
              <span>{job.startTime} - {job.endTime}</span>
            </div>
            <div className="flex items-start gap-2.5 text-slate-300">
              <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <span className="block">{locationAddress}</span>
                {hasCoordinates && (
                  <a
                    href={getDirectionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 border border-blue-500/20 text-[10px] font-bold uppercase transition-colors"
                  >
                    <Navigation className="w-3 h-3" /> Get Directions
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-slate-300">
              <Users className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{job.assignedWorkersCount || 0} / {job.workersRequired} Staff Required</span>
            </div>
          </div>

          {/* Apply CTA Card */}
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 text-center">
            {hasApplied ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> APPLICATION SUBMITTED
              </div>
            ) : (
              <button
                onClick={handleApply}
                disabled={applying}
                className="gradient-btn w-full py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-brand-600/30"
              >
                {applying ? 'Submitting Application...' : 'APPLY NOW'}
              </button>
            )}
            <p className="text-[11px] text-slate-500">
              Application goes directly to JobbyHop Admin for worker assignment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkerJobDetails;
