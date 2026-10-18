import React from 'react';

const statusConfig = {
  // Job Statuses
  PENDING_REVIEW: { label: 'Pending Admin Review', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  APPROVED: { label: 'Approved & Active', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  REJECTED: { label: 'Rejected by Admin', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  CLOSED: { label: 'Closed', bg: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  COMPLETED: { label: 'Event Completed', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },

  // Application Statuses
  APPLIED: { label: 'Applied', bg: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  UNDER_REVIEW: { label: 'Under Review', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },

  // Assignment Statuses
  ASSIGNED: { label: 'Assigned by Admin', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  CONFIRMED: { label: 'Confirmed', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  IN_PROGRESS: { label: 'Event In Progress', bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },

  // Attendance Statuses
  PENDING: { label: 'Attendance Pending', bg: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
  PRESENT: { label: 'Present', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  ABSENT: { label: 'Absent', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  LATE: { label: 'Late', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  EXCUSED: { label: 'Excused', bg: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },

  // Payment Statuses
  PROCESSING: { label: 'Payment Processing (10-15 days)', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30 animate-pulse' },
  PAID: { label: 'Payment Completed', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  ON_HOLD: { label: 'Payment On Hold', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  FAILED: { label: 'Payment Failed', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },

  // User Account Statuses
  ACTIVE: { label: 'Active', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  SUSPENDED: { label: 'Suspended', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  BLOCKED: { label: 'Blocked', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  DEACTIVATED: { label: 'Deactivated', bg: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
  DELETED: { label: 'Deleted', bg: 'bg-red-900/40 text-red-400 border-red-500/30 line-through' },
};

export const StatusBadge = ({ status, customLabel, type }) => {
  let config = statusConfig[status];

  // Specific override for Payment PENDING vs Attendance PENDING
  if (type === 'payment' && status === 'PENDING') {
    config = { label: 'Payment Pending', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
  } else if (!config) {
    config = {
      label: customLabel || status || 'Unknown',
      bg: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
    };
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${config.bg}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {customLabel || config.label}
    </span>
  );
};

export default StatusBadge;
