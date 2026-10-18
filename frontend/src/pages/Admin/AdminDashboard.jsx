import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import jobService from '../../services/jobService';
import userService from '../../services/userService';
import applicationService from '../../services/applicationService';
import assignmentService from '../../services/assignmentService';
import paymentService from '../../services/paymentService';
import recruiterPaymentService from '../../services/recruiterPaymentService';
import StatCard from '../../components/common/StatCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import JobApprovalModal from '../../components/admin/JobApprovalModal';
import DateFilter from '../../components/common/DateFilter';
import { DEFAULT_DATE_FILTER, matchesDateFilter } from '../../utils/dateFilterHelper';
import { formatCurrency } from '../../utils/formatters';
import {
  Shield,
  Users,
  UserCheck,
  Briefcase,
  CheckCircle,
  FileText,
  CalendarCheck,
  CreditCard,
  WalletCards,
  XCircle,
  Clock,
  Award,
  AlertTriangle,
  RefreshCw,
  IndianRupee,
  ArrowRight,
} from 'lucide-react';

export const AdminDashboard = () => {
  const { user: adminUser } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [recruiters, setRecruiters] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [recruiterCollections, setRecruiterCollections] = useState([]);
  const [recruiterCollectionsSummary, setRecruiterCollectionsSummary] = useState(null);
  const [eventStats, setEventStats] = useState({ upcomingEvents: 0, completedEvents: 0, trashedEvents: 0 });
  const [dateFilter, setDateFilter] = useState(DEFAULT_DATE_FILTER);

  const [selectedReviewJob, setSelectedReviewJob] = useState(null);

  const fetchAllMetrics = async () => {
    setLoading(true);
    setError(false);
    try {
      const [recRes, wrkRes, jobRes, appRes, asgRes, payRes, recColRes, evtStatsRes] = await Promise.all([
        userService.getRecruiters(),
        userService.getWorkers(),
        jobService.getAllJobs(),
        applicationService.getAllApplications(),
        assignmentService.getAllAssignments(),
        paymentService.getAllPayments(),
        recruiterPaymentService.getAllCollections(),
        jobService.getEventStats(),
      ]);

      if (recRes?.success) setRecruiters(recRes.data || []);
      if (wrkRes?.success) setWorkers(wrkRes.data || []);
      if (jobRes?.success) setJobs(jobRes.data || []);
      if (appRes?.success) setApplications(appRes.data || []);
      if (asgRes?.success) setAssignments(asgRes.data || []);
      if (payRes?.success) setPayments(payRes.data || []);
      if (recColRes?.success) {
        setRecruiterCollections(recColRes.data || recColRes.payments || []);
        setRecruiterCollectionsSummary(recColRes.summary || null);
      }
      if (evtStatsRes?.success) setEventStats(evtStatsRes.stats || { upcomingEvents: 0, completedEvents: 0, trashedEvents: 0 });

      // If every request failed (no success at all), mark error
      const anySuccess = [recRes, wrkRes, jobRes, appRes, asgRes, payRes, recColRes].some((r) => r?.success);
      if (!anySuccess) setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllMetrics();
  }, []);

  const handleReviewSubmit = async (jobId, formData) => {
    try {
      const res = await jobService.reviewJobByAdmin(jobId, formData, adminUser);
      if (res.success) {
        showToast(`Job successfully ${formData.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'}.`, 'success');
        setSelectedReviewJob(null);
        // Refresh without a full page reload
        fetchAllMetrics();
      } else {
        showToast(res.message || 'Action failed', 'error');
      }
    } catch (err) {
      showToast('Error submitting review', 'error');
    }
  };

  // ── Date-Filtered Datasets ──
  const isDateFiltered = dateFilter.preset !== 'all';

  const filteredRecruiters = useMemo(
    () => recruiters.filter((r) => matchesDateFilter(r.createdAt || r.userId?.createdAt, dateFilter)),
    [recruiters, dateFilter]
  );
  const filteredWorkers = useMemo(
    () => workers.filter((w) => matchesDateFilter(w.createdAt || w.userId?.createdAt, dateFilter)),
    [workers, dateFilter]
  );
  const filteredJobs = useMemo(
    () => jobs.filter((j) => matchesDateFilter(j.createdAt || j.eventDate, dateFilter)),
    [jobs, dateFilter]
  );
  const filteredApplications = useMemo(
    () => applications.filter((a) => matchesDateFilter(a.appliedAt || a.createdAt, dateFilter)),
    [applications, dateFilter]
  );
  const filteredAssignments = useMemo(
    () => assignments.filter((a) => matchesDateFilter(a.assignedAt || a.createdAt, dateFilter)),
    [assignments, dateFilter]
  );
  const filteredPayments = useMemo(
    () => payments.filter((p) => matchesDateFilter(p.paidAt || p.expectedPaymentDate || p.createdAt, dateFilter)),
    [payments, dateFilter]
  );
  const filteredCollections = useMemo(
    () => recruiterCollections.filter((c) => matchesDateFilter(c.paidAt || c.verifiedAt || c.createdAt, dateFilter)),
    [recruiterCollections, dateFilter]
  );

  // ── Computed counts ──
  const pendingJobsList    = filteredJobs.filter((j) => j.status === 'PENDING_REVIEW');
  const pendingJobs        = pendingJobsList.length;
  const approvedJobs       = filteredJobs.filter((j) => j.status === 'APPROVED').length;
  const rejectedJobs       = filteredJobs.filter((j) => j.status === 'REJECTED').length;
  const completedJobs      = filteredJobs.filter((j) => j.status === 'COMPLETED').length;
  const pendingApps        = filteredApplications.filter((a) => a.status === 'APPLIED').length;
  const completedAssignments = filteredAssignments.filter((a) => a.status === 'COMPLETED').length;
  const pendingPayments    = filteredPayments.filter((p) => p.status === 'PENDING').length;
  const processingPayments = filteredPayments.filter((p) => p.status === 'PROCESSING').length;
  const paidPayments       = filteredPayments.filter((p) => p.status === 'PAID').length;

  const totalRecruitersCount = filteredRecruiters.length;
  const totalWorkersCount = filteredWorkers.length;

  const upcomingEventsCount = isDateFiltered
    ? filteredJobs.filter((j) => j.status === 'APPROVED' && (!j.eventDate || new Date(j.eventDate) >= new Date())).length
    : eventStats.upcomingEvents;
  const completedEventsCount = isDateFiltered
    ? completedJobs
    : eventStats.completedEvents;

  const recruiterCollectionsCount = isDateFiltered
    ? filteredCollections.length
    : (recruiterCollectionsSummary?.totalCount || recruiterCollections.length || 0);

  const recruiterPaidAmount = isDateFiltered
    ? filteredCollections.filter((c) => c.status === 'COMPLETED' || c.status === 'PAID').reduce((sum, c) => sum + (c.amount || 0), 0)
    : (recruiterCollectionsSummary?.paidAmount || 0);

  const recruiterProcessingAmount = isDateFiltered
    ? filteredCollections.filter((c) => c.status === 'PROCESSING' || c.status === 'SUBMITTED').reduce((sum, c) => sum + (c.amount || 0), 0)
    : (recruiterCollectionsSummary?.processingAmount || 0);

  if (loading) return <LoadingSpinner label="Loading central admin operational metrics..." />;

  if (error) {
    return (
      <div className="glass-card p-10 rounded-3xl border border-rose-500/30 bg-rose-950/20 text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
        <p className="text-white font-bold text-lg">Unable to load dashboard statistics.</p>
        <p className="text-slate-400 text-sm">The API may be temporarily unavailable. Your data is not lost.</p>
        <button
          onClick={fetchAllMetrics}
          className="mx-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600/20 border border-rose-600/40 text-rose-400 font-bold hover:bg-rose-600/40 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  const handleOpenNextReview = () => {
    if (pendingJobsList.length > 0) {
      setSelectedReviewJob(pendingJobsList[0]);
    } else {
      navigate('/admin/job-requests?status=PENDING_REVIEW');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-400" />
            <h1 className="text-2xl font-extrabold text-white">Central Admin Control Center</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Master control platform for JobbyHop job approvals, event staff operations, and 10–15 day payout moderation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateFilter dateFilter={dateFilter} onDateFilterChange={setDateFilter} />
          <button
            onClick={handleOpenNextReview}
            className="gradient-btn px-4 py-2.5 rounded-xl text-xs font-bold uppercase flex items-center gap-1.5"
          >
            <Briefcase className="w-4 h-4" /> Review Jobs ({pendingJobs})
          </button>
        </div>
      </div>

      {/* ── Stats Grid — every card is clickable ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard title="Total Recruiters" value={totalRecruitersCount} icon={Users} color="purple" to="/admin/recruiters" />
        <StatCard title="Total Workers" value={totalWorkersCount} icon={UserCheck} color="indigo" to="/admin/workers" />
        <StatCard title="Pending Job Requests" value={pendingJobs} icon={Clock} color="amber" to="/admin/job-requests?status=PENDING_REVIEW" />
        <StatCard title="Approved Jobs" value={approvedJobs} icon={CheckCircle} color="emerald" to="/admin/job-requests?status=APPROVED" />
        <StatCard title="Rejected Jobs" value={rejectedJobs} icon={XCircle} color="rose" to="/admin/job-requests?status=REJECTED" />
        <StatCard title="Pending Applications" value={pendingApps} icon={FileText} color="amber" to="/admin/applications?status=APPLIED" />
        <StatCard title="Upcoming Events" value={upcomingEventsCount} icon={CalendarCheck} color="purple" to="/admin/events" />
        <StatCard title="Completed Events" value={completedEventsCount} icon={Award} color="emerald" to="/admin/events?tab=COMPLETED" />
        <StatCard title="Pending Payments" value={pendingPayments} icon={CreditCard} color="rose" to="/admin/payments?status=PENDING" />
        <StatCard title="Processing Payments" value={processingPayments} icon={CreditCard} color="amber" to="/admin/payments?status=PROCESSING" />
        <StatCard title="Paid Payments" value={paidPayments} icon={CheckCircle} color="emerald" to="/admin/payments?status=PAID" />
        <StatCard title="Recruiter Collections" value={recruiterCollectionsCount} icon={WalletCards} color="purple" to="/admin/recruiter-collections" />
      </div>

      {/* Priority Action Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Pending Job Requests Queue Card */}
        <div className="block glass-card p-6 rounded-2xl border border-slate-800 space-y-4 hover:border-amber-500/40 transition-all duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-amber-400" /> Job Approval Queue ({pendingJobs})
            </h3>
            <button 
              onClick={handleOpenNextReview}
              className="text-xs text-brand-400 font-semibold hover:underline"
            >
              View Queue →
            </button>
          </div>

          {pendingJobs === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No pending job requests awaiting review.</p>
          ) : (
            <div className="space-y-3">
              {pendingJobsList.slice(0, 3).map((j) => (
                <div key={j._id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <h4 className="font-bold text-white truncate max-w-[140px]">{j.title}</h4>
                    <p className="text-[11px] text-slate-400">
                      Offer: ₹{j.recruiterProposedPayment}/worker
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedReviewJob(j)}
                    className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 transition-colors text-white font-bold text-[11px]"
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Recruiter Collections Queue (Recruiter → Admin) */}
        <Link
          to="/admin/recruiter-collections"
          className="block glass-card p-6 rounded-2xl border border-purple-500/30 space-y-4 hover:border-purple-400 hover:bg-slate-900/60 transition-all duration-200 cursor-pointer group bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/20"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <WalletCards className="w-4 h-4 text-purple-400" /> Recruiter Collections Queue
            </h3>
            <span className="text-xs text-purple-400 font-semibold group-hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Total Collections:</span>
              <span className="font-bold text-white">{recruiterCollectionsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Received (Paid):</span>
              <span className="font-bold text-emerald-400">
                {formatCurrency(recruiterPaidAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">In Review (Processing):</span>
              <span className="font-bold text-amber-400">
                {formatCurrency(recruiterProcessingAmount)}
              </span>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 border-t border-slate-800 pt-2">
            Verify recruiter UTR transaction submissions for approved events.
          </p>
        </Link>

        {/* 3. Worker Payout Releases Queue (Admin → Worker) - UNTOUCHED */}
        <Link
          to="/admin/payments?status=PENDING"
          className="block glass-card p-6 rounded-2xl border border-slate-800 space-y-4 hover:border-emerald-500/40 hover:bg-slate-900/60 transition-all duration-200 cursor-pointer group"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" /> Worker Payouts (10–15d) ({pendingPayments + processingPayments})
            </h3>
            <span className="text-xs text-brand-400 font-semibold group-hover:underline">
              Manage Payments →
            </span>
          </div>

          {filteredPayments.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No payouts pending in 10–15 day pipeline.</p>
          ) : (
            <div className="space-y-3">
              {filteredPayments.slice(0, 3).map((p) => (
                <div key={p._id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <h4 className="font-bold text-white">{p.jobId?.title || '—'}</h4>
                    <p className="text-[11px] text-slate-400">
                      Worker: {p.workerProfile?.fullName || 'Staff'} • Pay: ₹{p.amount}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Link>
      </div>

      {/* Integrated Review Experience */}
      {selectedReviewJob && (
        <JobApprovalModal 
          isOpen={Boolean(selectedReviewJob)} 
          onClose={() => setSelectedReviewJob(null)}
          job={selectedReviewJob}
          onSubmitReview={handleReviewSubmit}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
