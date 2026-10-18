import React from 'react';
import {
  FileText,
  ShieldCheck,
  UserCheck,
  CheckCircle,
  CalendarCheck,
  Award,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getLocationString } from '../../utils/locationHelper';

export const EventLifecycleView = ({ job, assignments = [], payments = [], attendances = [], isRecruiter = false }) => {
  if (!job) return null;

  const steps = [
    {
      id: 1,
      title: 'Recruiter Request',
      subtitle: `Proposed Pay: ${formatCurrency(job.recruiterRequestedRate ?? job.recruiterProposedPayment ?? 0)}`,
      icon: FileText,
      completed: true,
    },
    {
      id: 2,
      title: isRecruiter ? 'Admin Review' : 'Admin Review & Edit Pay',
      subtitle: isRecruiter
        ? (job.status === 'PENDING_REVIEW' ? 'Pending Review' : 'Approved by Admin')
        : `Final Pay Set: ${formatCurrency(job.adminApprovedPayment || job.finalWorkerPayout || job.recruiterProposedPayment)}`,
      icon: ShieldCheck,
      completed: job.status !== 'PENDING_REVIEW',
    },
    {
      id: 3,
      title: 'Job Approved',
      subtitle: 'Visible to Workers',
      icon: CheckCircle,
      completed: job.status === 'APPROVED' || job.status === 'COMPLETED',
    },
    {
      id: 4,
      title: 'Worker Assignment',
      subtitle: `${job.assignedWorkersCount || 0} / ${job.workersRequired} Staff Assigned`,
      icon: UserCheck,
      completed: (job.assignedWorkersCount || 0) > 0,
    },
    {
      id: 5,
      title: 'Attendance Verified',
      subtitle: attendances.length > 0 && attendances.some(a => a.status !== 'PENDING') ? 'Verified' : (isRecruiter && job.status === 'COMPLETED' ? 'Verified' : 'Pending'),
      icon: CalendarCheck,
      completed: attendances.some((a) => a.status !== 'PENDING') || (isRecruiter && job.status === 'COMPLETED'),
    },
    {
      id: 6,
      title: 'Event Completion',
      subtitle: job.status === 'COMPLETED' ? 'COMPLETED' : 'In Progress',
      icon: Award,
      completed: job.status === 'COMPLETED',
    },
    {
      id: 7,
      title: isRecruiter ? 'Recruiter Payment' : 'Payment Processing (10-15d)',
      subtitle: isRecruiter
        ? (job.recruiterPaymentStatus === 'PAID' || job.recruiterPaymentStatus === 'COMPLETED' ? 'Paid to Admin' : (job.recruiterPaymentStatus === 'PROCESSING' ? 'Under Review' : 'Pending Payment'))
        : (payments.length > 0 ? (payments.every(p => p.status === 'PAID') ? 'Completed' : (payments.some(p => p.status === 'PROCESSING') ? 'Processing' : 'Scheduled')) : 'Pending'),
      icon: CreditCard,
      completed: isRecruiter
        ? (job.recruiterPaymentStatus === 'PAID' || job.recruiterPaymentStatus === 'COMPLETED' || job.recruiterPaymentStatus === 'PROCESSING')
        : payments.some((p) => p.status === 'PROCESSING' || p.status === 'PAID'),
    },
    {
      id: 8,
      title: isRecruiter ? 'Event Closed' : 'Payout Completed',
      subtitle: isRecruiter
        ? (job.status === 'COMPLETED' && (job.recruiterPaymentStatus === 'PAID' || job.recruiterPaymentStatus === 'COMPLETED') ? 'Completed & Closed' : 'In Progress')
        : (payments.length > 0 && payments.every((p) => p.status === 'PAID') ? 'PAID' : (payments.some((p) => p.status === 'PAID') ? 'Partially Paid' : 'Pending')),
      icon: CheckCircle2,
      completed: isRecruiter
        ? (job.status === 'COMPLETED' && (job.recruiterPaymentStatus === 'PAID' || job.recruiterPaymentStatus === 'COMPLETED'))
        : (payments.length > 0 && payments.every((p) => p.status === 'PAID')),
    },
  ];

  return (
    <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase bg-brand-500/10 text-brand-400 px-2.5 py-0.5 rounded-full border border-brand-500/20">
            {job.eventType}
          </span>
          <h3 className="text-xl font-bold text-white mt-1">{job.title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {formatDate(job.eventDate)} • {getLocationString(job.location)}
          </p>
        </div>
        {!isRecruiter ? (
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase font-semibold">Final Approved Worker Pay</p>
            <p className="text-2xl font-extrabold text-emerald-400">
              {formatCurrency(job.adminApprovedPayment || job.finalWorkerPayout || job.recruiterProposedPayment)}
            </p>
          </div>
        ) : (
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase font-semibold">Your Requested Rate</p>
            <p className="text-2xl font-extrabold text-amber-400">
              {formatCurrency(job.recruiterRequestedRate ?? job.recruiterProposedPayment ?? 0)}
            </p>
          </div>
        )}
      </div>

      {/* Horizontal Lifecycle Steps */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              className={`p-4 rounded-xl border transition-all ${
                s.completed
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-950/60 border-slate-800 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`p-2 rounded-lg ${
                    s.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider">Step 0{s.id}</span>
              </div>
              <h4 className="text-xs font-bold text-white line-clamp-1">{s.title}</h4>
              <p className="text-[11px] text-slate-400 mt-1">{s.subtitle}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EventLifecycleView;
