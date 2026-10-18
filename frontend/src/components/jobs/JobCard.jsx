import React from 'react';
import { Calendar, Clock, MapPin, Users, Sparkles, CheckCircle2 } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getLocationString } from '../../utils/locationHelper';

export const JobCard = ({ job, onApply, onViewDetails, isWorker = false }) => {
  // Workers: show admin-approved payment only
  // Recruiters: show their own requested rate only
  const recruiterRate = job.recruiterRequestedRate ?? job.recruiterProposedPayment ?? 0;
  const workerRate = job.adminApprovedPayment ?? job.finalWorkerPayout ?? 0;
  const displayPayment = isWorker ? workerRate : recruiterRate;

  // Determine badge status:
  // For workers who have applied, badge reflects their application status (e.g. 'APPLIED', 'APPROVED', 'REJECTED').
  // For workers who have not applied, badge reflects the approved job's active state.
  const badgeStatus = isWorker && (job.hasApplied || job.myApplicationStatus)
    ? (job.myApplicationStatus || 'APPLIED')
    : (job.status === 'APPROVED' && (!job.acceptedAt && job.acceptedAt !== undefined) ? 'PENDING_REVIEW' : job.status);

  return (
    <div className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col justify-between border border-slate-800 relative group overflow-hidden">
      <div className="space-y-4">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-brand-500/10 text-brand-400 border border-brand-500/20 mb-2 inline-block">
              {job.eventType}
            </span>
            <h3 className="text-lg font-bold text-white group-hover:text-brand-300 transition-colors line-clamp-1">
              {job.title}
            </h3>
          </div>
          <StatusBadge status={badgeStatus} />
        </div>

        {/* Location & Time Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 pt-2 border-t border-slate-800/60">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-400 shrink-0" />
            <span>{formatDate(job.eventDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400 shrink-0" />
            <span>{job.startTime} - {job.endTime}</span>
          </div>
          <div className="flex items-center gap-2 col-span-2">
            <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="truncate">{getLocationString(job.location)}</span>
          </div>
        </div>

        {/* Workers Required & Skills */}
        <div className="flex items-center justify-between text-xs pt-2">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>{job.assignedWorkersCount || 0} / {job.workersRequired} Staff</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {job.requiredSkills?.slice(0, 2).map((skill, i) => (
              <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Payment & Action */}
      <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
        <div>
          {isWorker ? (
            <>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Verified Pay</p>
              <p className="text-xl font-extrabold text-emerald-400">
                {formatCurrency(displayPayment)}
              </p>
            </>
          ) : (
            <>
              <p className="text-[10px] text-amber-500/70 font-semibold uppercase tracking-wider">Your Requested Rate</p>
              <p className="text-xl font-extrabold text-amber-400">
                {formatCurrency(displayPayment)}
              </p>
            </>
          )}
        </div>

        <div className="flex gap-2">
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(job)}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Details
            </button>
          )}

          {isWorker && onApply && (
            job.hasApplied ? (
              <span className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 border ${
                job.myApplicationStatus === 'APPROVED'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> {job.myApplicationStatus === 'APPROVED' ? 'Assigned' : 'Applied'}
              </span>
            ) : (
              <button
                onClick={() => onApply(job)}
                className="gradient-btn px-4 py-2 rounded-xl text-xs font-bold"
              >
                Apply Now
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default JobCard;
