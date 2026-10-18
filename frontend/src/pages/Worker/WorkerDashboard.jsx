import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import jobService from '../../services/jobService';
import applicationService from '../../services/applicationService';
import assignmentService from '../../services/assignmentService';
import paymentService from '../../services/paymentService';
import StatCard from '../../components/common/StatCard';
import JobCard from '../../components/jobs/JobCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import {
  Briefcase,
  FileText,
  CheckCircle2,
  Calendar,
  CreditCard,
  Clock,
  XCircle,
  Hourglass,
} from 'lucide-react';

export const WorkerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [availableJobs, setAvailableJobs] = useState([]);
  const [availableJobsTotal, setAvailableJobsTotal] = useState(0);
  const [applications, setApplications] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (user?._id) {
        const [jobsRes, appsRes, asgRes, payRes] = await Promise.all([
          // Fetch up to 6 jobs for card display; use pagination.totalDocs for real count
          jobService.getAvailableJobsForWorker(user._id, { limit: 100 }),
          applicationService.getWorkerApplications(user._id),
          assignmentService.getWorkerAssignments(user._id),
          paymentService.getWorkerPayments(user._id),
        ]);

        if (jobsRes.success) {
          setAvailableJobs(jobsRes.data);
          // Real total from backend pagination — not capped by page limit
          setAvailableJobsTotal(jobsRes.pagination?.totalDocs ?? jobsRes.data.length);
        }
        if (appsRes.success) setApplications(appsRes.data);
        if (asgRes.success) setAssignments(asgRes.data);
        if (payRes.success) setPayments(payRes.data);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  if (loading) return <LoadingSpinner label="Loading worker dashboard..." />;

  // APPLICATION_STATUS from backend constants:
  // APPLIED (initial submission), UNDER_REVIEW, APPROVED, REJECTED, CANCELLED
  // "Pending" = APPLIED + UNDER_REVIEW (awaiting Admin decision)
  const approvedAppsCount = applications.filter((a) => a.status === 'APPROVED').length;
  const pendingAppsCount = applications.filter(
    (a) => a.status === 'APPLIED' || a.status === 'UNDER_REVIEW'
  ).length;
  const rejectedAppsCount = applications.filter((a) => a.status === 'REJECTED').length;

  // Upcoming events: ASSIGNED or CONFIRMED assignments (active, not yet started)
  const upcomingEventsCount = assignments.filter(
    (a) => a.status === 'ASSIGNED' || a.status === 'CONFIRMED'
  ).length;

  // PAYMENT_STATUS: PENDING, PROCESSING, PAID, ON_HOLD, FAILED
  const pendingPaymentsCount = payments.filter(
    (p) => p.status === 'PENDING' || p.status === 'PROCESSING'
  ).length;
  const paidPaymentsCount = payments.filter((p) => p.status === 'PAID').length;

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 rounded-3xl border border-slate-800">
        <div>
          <span className="text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/20">
            Worker Portal
          </span>
          <h1 className="text-2xl font-extrabold text-white mt-2">
            Welcome, {user?.profile?.fullName || 'Event Staff'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse Admin-approved event opportunities and track your 10–15 day payout schedule.
          </p>
        </div>
        <Link
          to="/worker/available-jobs"
          className="gradient-btn px-5 py-3 rounded-2xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shrink-0"
        >
          <Briefcase className="w-4 h-4" /> Explore Available Jobs
        </Link>
      </div>

      {/* Payout Notice Callout */}
      <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-200 text-xs flex items-center gap-3">
        <Clock className="w-5 h-5 text-purple-400 shrink-0" />
        <div>
          <p className="font-bold text-purple-300">Guaranteed 10–15 Day Payout Rule:</p>
          <p className="text-[11px] text-purple-200/80 mt-0.5">
            Every shift completed is verified by Admin and processed into your registered UPI/Bank account within 10–15 days.
          </p>
        </div>
      </div>

      {/* Dashboard Stat Cards — exact spec order:
          Available Jobs | My Applications | Approved Applications | Pending Applications
          Rejected Applications | Upcoming Events | Pending Payments | Paid Payments
          NO Active Assignments card — use My Assignments sidebar page instead.
      */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Available Jobs"
          value={availableJobsTotal}
          icon={Briefcase}
          color="purple"
          to="/worker/available-jobs"
        />
        <StatCard
          title="My Applications"
          value={applications.length}
          icon={FileText}
          color="amber"
          to="/worker/applications"
        />
        <StatCard
          title="Approved Applications"
          value={approvedAppsCount}
          icon={CheckCircle2}
          color="emerald"
          to="/worker/applications?status=APPROVED"
        />
        <StatCard
          title="Pending Applications"
          value={pendingAppsCount}
          icon={Hourglass}
          color="indigo"
          to="/worker/applications?status=APPLIED"
        />
        <StatCard
          title="Rejected Applications"
          value={rejectedAppsCount}
          icon={XCircle}
          color="rose"
          to="/worker/applications?status=REJECTED"
        />
        <StatCard
          title="Upcoming Events"
          value={upcomingEventsCount}
          icon={Calendar}
          color="cyan"
          to="/worker/assignments"
        />
        <StatCard
          title="Pending Payments"
          value={pendingPaymentsCount}
          icon={CreditCard}
          color="rose"
          to="/worker/payments?status=PENDING"
        />
        <StatCard
          title="Paid Payments"
          value={paidPaymentsCount}
          icon={CheckCircle2}
          color="emerald"
          to="/worker/payments?status=PAID"
        />
      </div>

      {/* Available Jobs Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Recommended Admin-Approved Jobs</h2>
          <Link to="/worker/available-jobs" className="text-xs font-semibold text-brand-400 hover:underline">
            View All Approved Jobs →
          </Link>
        </div>

        {availableJobs.length === 0 ? (
          <EmptyState
            title="No Approved Jobs Available"
            description="There are currently no new Admin-approved jobs matching your criteria. Check back soon!"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableJobs.slice(0, 6).map((job) => (
              <JobCard
                key={job._id}
                job={job}
                isWorker={true}
                onViewDetails={() => navigate(`/worker/jobs/${job._id}`)}
                onApply={() => navigate(`/worker/jobs/${job._id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkerDashboard;

